import { Router } from 'express';
import { getDb } from '../database/connection';
import { success, error, paginated } from '../utils/response';
import { generateId, generateSubOrderId } from '../utils/idGenerator';
import { addSubOrderLog, syncMasterOrderStatus, syncMasterOrderStatusBySubOrderId } from '../utils/orderFlow';

const router = Router();

function datePart(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function randomDigits(len: number): string {
  return `${Math.floor(Math.random() * (10 ** len))}`.padStart(len, '0');
}

function createMasterWaybillNo(db: any, transportType?: string): string {
  const prefix = String(transportType || '').toUpperCase() === 'AIR' ? 'A' : 'S';
  const day = datePart();
  for (let i = 0; i < 20; i++) {
    const candidate = `${prefix}-${day}${randomDigits(5)}`;
    const exists = db.prepare('SELECT 1 FROM master_orders WHERE id = ? LIMIT 1').get(candidate);
    if (!exists) return candidate;
  }
  return `${prefix}-${day}${Date.now().toString().slice(-5)}`;
}

// ==================== MASTER ORDERS ====================

// GET /api/orders/master
router.get('/master', (req, res) => {
  const db = getDb();
  const {
    status,
    customerId,
    paymentStatus,
    keyword,
    transportType,
    serviceType,
    salesPerson,
    currency,
    paymentMethod,
    startDate,
    endDate,
    page = '1',
    pageSize = '50',
  } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) { where += ' AND status = ?'; params.push(status); }
  if (customerId) { where += ' AND customerId = ?'; params.push(customerId); }
  if (paymentStatus) { where += ' AND paymentStatus = ?'; params.push(paymentStatus); }
  if (transportType) { where += ' AND transportType = ?'; params.push(transportType); }
  if (serviceType) { where += ' AND serviceType = ?'; params.push(serviceType); }
  if (salesPerson) { where += ' AND salesPerson = ?'; params.push(salesPerson); }
  if (currency) { where += ' AND currency = ?'; params.push(currency); }
  if (paymentMethod) { where += ' AND paymentMethod = ?'; params.push(paymentMethod); }
  if (keyword) {
    where += ' AND (id LIKE ? OR customerName LIKE ? OR customerId LIKE ? OR consignee LIKE ? OR consigneePhone LIKE ? OR routeCode LIKE ? OR warehouseEntryNo LIKE ?)';
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`
    );
  }

  const normalizedStartDate = startDate
    ? `${String(startDate).slice(0, 10)}T00:00:00.000Z`
    : null;
  const normalizedEndDate = endDate
    ? `${String(endDate).slice(0, 10)}T23:59:59.999Z`
    : null;

  if (normalizedStartDate) {
    where += ' AND datetime(createdAt) >= datetime(?)';
    params.push(normalizedStartDate);
  }
  if (normalizedEndDate) {
    where += ' AND datetime(createdAt) <= datetime(?)';
    params.push(normalizedEndDate);
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM master_orders ${where}`).get(...params) as any).c;
  const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
  const rows = db.prepare(`SELECT * FROM master_orders ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
    .all(...params, parseInt(pageSize as string), offset);

  (rows as any[]).forEach(row => { row.orderNo = row.id; });
  paginated(res, rows as any[], total, parseInt(page as string), parseInt(pageSize as string));
});

// GET /api/orders/master/:id
router.get('/master/:id', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM master_orders WHERE id = ?').get(req.params.id) as any;
  if (!order) { error(res, 'Master order not found', 404); return; }
  order.orderNo = order.id;
  if (order.invoiceInfo) {
    try {
      order.invoiceInfo = JSON.parse(order.invoiceInfo);
    } catch (_) {
      // keep raw value if parse failed
    }
  }

  // Include sub orders
  order.subOrders = db.prepare('SELECT * FROM sub_orders WHERE masterOrderId = ? ORDER BY batchNo, createdAt').all(req.params.id);
  (order.subOrders as any[]).forEach(sub => { sub.subOrderNo = sub.id; });

  // Include order items
  order.items = db.prepare('SELECT * FROM order_items WHERE masterOrderId = ?').all(req.params.id);
  (order.items as any[]).forEach(item => {
    item.attributes = item.attributes ? JSON.parse(item.attributes) : [];
  });

  // Include express packages (map DB fields to front-end ExpressPackage interface)
  const rawPkgs = db.prepare('SELECT * FROM express_packages WHERE masterOrderId = ?').all(req.params.id) as any[];
  order.expressPackages = rawPkgs.map(pkg => ({
    ...pkg,
    courier: pkg.expressCompany,          // DB: expressCompany -> FE: courier
    itemName: pkg.name,                   // DB: name -> FE: itemName
    declaredValue: pkg.value,             // DB: value -> FE: declaredValue
    description: pkg.cargoType,           // DB: cargoType -> FE: description
    photos: pkg.photos ? JSON.parse(pkg.photos) : [],
    subOrderNo: pkg.subOrderId || null,
  }));

  // Also attach express packages to each sub order for the detail view
  (order.subOrders as any[]).forEach(sub => {
    sub.expressPackages = order.expressPackages.filter((pkg: any) => pkg.subOrderId === sub.id);
  });

  success(res, order);
});

// POST /api/orders/master
router.post('/master', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();

  const {
    customerId, customerName, totalPieces, totalWeight, totalVolume, totalValue,
    sender, senderPhone, senderAddress, consignee, consigneePhone, consigneeEmail,
    destCountry, destCity, destAddress, transportType, totalFreight, salesPerson, remark, items,
    routeCode, serviceType, paymentMethod, paymentChannel, paymentTime, inboundDate,
    currency, warehouseEntryNo, containerType, invoiceInfo
  } = req.body;
  const id = createMasterWaybillNo(db, transportType);

  if (!customerId || !sender || !consignee || !consigneePhone || !destCountry || !destCity || !destAddress) {
    error(res, 'Missing required fields');
    return;
  }

  const insertMaster = db.prepare(`
    INSERT INTO master_orders (id, customerId, customerName, status, splitStatus, totalPieces, totalWeight, totalVolume, totalValue, sender, senderPhone, senderAddress, consignee, consigneePhone, consigneeEmail, destCountry, destCity, destAddress, transportType, totalFreight, paymentStatus, salesPerson, remark, routeCode, serviceType, paymentMethod, paymentChannel, paymentTime, inboundDate, currency, warehouseEntryNo, containerType, invoiceInfo, createdAt, updatedAt)
    VALUES (?, ?, ?, 'PENDING_INBOUND', 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    insertMaster.run(id, customerId, customerName || '',
      totalPieces || 0, totalWeight || 0, totalVolume || 0, totalValue || 0,
      sender, senderPhone || null, senderAddress || null,
      consignee, consigneePhone, consigneeEmail || null,
      destCountry, destCity, destAddress,
      transportType || null, totalFreight || null, salesPerson || null, remark || null,
      routeCode || null,
      serviceType || null,
      paymentMethod || 'PREPAID',
      paymentChannel || null,
      paymentTime || null,
      inboundDate || null,
      currency || 'CNY',
      warehouseEntryNo || null,
      containerType || null,
      invoiceInfo
        ? (typeof invoiceInfo === 'object' ? JSON.stringify(invoiceInfo) : invoiceInfo)
        : null,
      now, now);

    // Insert order items if provided
    if (items && Array.isArray(items)) {
      const insertItem = db.prepare(`
        INSERT INTO order_items (id, masterOrderId, name, nameEn, quantity, unitPrice, weight, volume, category, attributes, declaredValue, hsCode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        insertItem.run(generateId('ITEM'), id,
          item.name, item.nameEn || null, item.quantity || 0, item.unitPrice || null,
          item.weight || 0, item.volume || 0, item.category || null,
          item.attributes ? JSON.stringify(item.attributes) : null,
          item.declaredValue || null, item.hsCode || null);
      }
    }

    // Insert express packages if provided
    if (req.body.expressPackages && Array.isArray(req.body.expressPackages)) {
      const insertPkg = db.prepare(`
        INSERT INTO express_packages (id, masterOrderId, subOrderId, expressCompany, trackingNo, status, name, category, cargoType, weight, pieces, value, remark, createdAt)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const pkg of req.body.expressPackages) {
        insertPkg.run(
          generateId('EP'), id,
          pkg.subOrderId || null,
          pkg.courier || pkg.expressCompany || '', pkg.trackingNo,
          pkg.itemName || pkg.name || '', pkg.category || null, pkg.cargoType || null,
          pkg.weight || 0, pkg.pieces || 1, pkg.declaredValue || pkg.value || 0,
          pkg.remark || null, now
        );
      }
    }

    // Update client order count
    db.prepare('UPDATE clients SET totalOrders = totalOrders + 1, lastOrderTime = ? WHERE id = ?')
      .run(now, customerId);
  });

  tx();

  const order = db.prepare('SELECT * FROM master_orders WHERE id = ?').get(id) as any;
  order.orderNo = order.id;
  if (order.invoiceInfo) {
    try {
      order.invoiceInfo = JSON.parse(order.invoiceInfo);
    } catch (_) {
      // keep raw value if parse failed
    }
  }
  success(res, order);
});

// PUT /api/orders/master/:id
router.put('/master/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM master_orders WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Master order not found', 404); return; }

  // Whitelist valid master_orders columns to prevent SQL errors
  const validColumns = new Set([
    'customerId', 'customerName', 'status', 'splitStatus',
    'totalPieces', 'totalWeight', 'totalVolume', 'totalValue',
    'sender', 'senderPhone', 'senderAddress',
    'consignee', 'consigneePhone', 'consigneeEmail',
    'destCountry', 'destCity', 'destAddress',
    'transportType', 'totalFreight', 'paidAmount', 'paymentStatus',
    'salesPerson', 'remark',
    'routeCode', 'serviceType', 'paymentMethod', 'paymentChannel', 'paymentTime',
    'inboundDate', 'currency', 'warehouseEntryNo', 'containerType', 'invoiceInfo',
    'returnType', 'returnReason', 'returnRefundAmount', 'returnRefundMethod',
    'needReturn', 'returnShippingNote',
    'returnAppliedBy', 'returnAppliedAt', 'previousStatus',
    'returnApprover', 'returnApprovedAt', 'returnRejectReason',
  ]);

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!validColumns.has(key)) continue;
    sets.push(`${key} = ?`);
    if (key === 'invoiceInfo' && value && typeof value === 'object') {
      params.push(JSON.stringify(value));
      continue;
    }
    if (key === 'needReturn' && typeof value === 'boolean') {
      params.push(value ? 1 : 0);
      continue;
    }
    params.push(value === undefined ? null : value);
  }

  const now = new Date().toISOString();
  sets.push('updatedAt = ?');
  params.push(now);
  params.push(req.params.id);

  const tx = db.transaction(() => {
    if (sets.length > 1) {
      db.prepare(`UPDATE master_orders SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    }

    // Handle expressPackages update
    if (fields.expressPackages && Array.isArray(fields.expressPackages)) {
      // Delete existing packages
      db.prepare('DELETE FROM express_packages WHERE masterOrderId = ?').run(req.params.id);
      // Insert new packages
      const insertPkg = db.prepare(`
        INSERT INTO express_packages (id, masterOrderId, subOrderId, expressCompany, trackingNo, status, name, category, cargoType, weight, pieces, value, remark, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const pkg of fields.expressPackages) {
        insertPkg.run(
          pkg.id || generateId('EP'), req.params.id,
          pkg.subOrderId || null,
          pkg.courier || pkg.expressCompany || '', pkg.trackingNo || '',
          pkg.status || 'PENDING',
          pkg.itemName || pkg.name || '', pkg.category || null, pkg.cargoType || pkg.description || null,
          pkg.weight || 0, pkg.pieces || 1, pkg.declaredValue || pkg.value || 0,
          pkg.remark || null, pkg.createdAt || now
        );
      }
    }
  });

  tx();

  const order = db.prepare('SELECT * FROM master_orders WHERE id = ?').get(req.params.id) as any;
  if (order) {
    order.orderNo = order.id;
    if (order.invoiceInfo) {
      try {
        order.invoiceInfo = JSON.parse(order.invoiceInfo);
      } catch (_) {
        // keep raw value if parse failed
      }
    }
  }
  success(res, order);
});

// ==================== SUB ORDERS ====================

// GET /api/orders/sub
router.get('/sub', (req, res) => {
  const db = getDb();
  const { status, jobNo, shippingUnitId, masterOrderId, keyword, page = '1', pageSize = '50' } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) { where += ' AND status = ?'; params.push(status); }
  if (jobNo) { where += ' AND jobNo = ?'; params.push(jobNo); }
  if (shippingUnitId) { where += ' AND shippingUnitId = ?'; params.push(shippingUnitId); }
  if (masterOrderId) { where += ' AND masterOrderId = ?'; params.push(masterOrderId); }
  if (keyword) {
    where += ' AND (id LIKE ? OR expressTrackingNo LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM sub_orders ${where}`).get(...params) as any).c;
  const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
  const rows = db.prepare(`SELECT * FROM sub_orders ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
    .all(...params, parseInt(pageSize as string), offset);

  (rows as any[]).forEach(row => { row.subOrderNo = row.id; });
  paginated(res, rows as any[], total, parseInt(page as string), parseInt(pageSize as string));
});

// GET /api/orders/sub/:id
router.get('/sub/:id', (req, res) => {
  const db = getDb();
  const sub = db.prepare('SELECT * FROM sub_orders WHERE id = ?').get(req.params.id) as any;
  if (!sub) { error(res, 'Sub order not found', 404); return; }
  sub.subOrderNo = sub.id;

  // Include logistics records
  sub.logisticsRecords = db.prepare('SELECT * FROM logistics_records WHERE subOrderId = ? ORDER BY timestamp ASC').all(req.params.id);
  (sub.logisticsRecords as any[]).forEach(r => {
    r.photos = r.photos ? JSON.parse(r.photos) : [];
  });

  // Include order items
  sub.items = db.prepare('SELECT * FROM order_items WHERE subOrderId = ?').all(req.params.id);
  (sub.items as any[]).forEach(item => {
    item.attributes = item.attributes ? JSON.parse(item.attributes) : [];
  });

  success(res, sub);
});

// POST /api/orders/sub
router.post('/sub', (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();

  const {
    masterOrderId, batchNo, pieces, weight, volume, value,
    transportType, route, consignee, consigneePhone, destCountry, destCity, destAddress,
    expressCompany, expressTrackingNo, goodsDescription, remark
  } = req.body;

  if (!masterOrderId || !transportType || !destCountry || !destCity) {
    error(res, 'Missing required fields');
    return;
  }

  const id = generateSubOrderId(transportType);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO sub_orders (id, masterOrderId, batchNo, pieces, weight, volume, value, status, transportType, route, consignee, consigneePhone, destCountry, destCity, destAddress, expressCompany, expressTrackingNo, goodsDescription, remark, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_INBOUND', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, masterOrderId, batchNo || 1,
      pieces || 0, weight || 0, volume || 0, value || 0,
      transportType, route || null, consignee || null, consigneePhone || null,
      destCountry, destCity, destAddress || null,
      expressCompany || null, expressTrackingNo || null, goodsDescription || null, remark || null, now, now);

    // Update master order splitStatus
    db.prepare("UPDATE master_orders SET splitStatus = 'PARTIAL', updatedAt = ? WHERE id = ? AND splitStatus = 'PENDING'")
      .run(now, masterOrderId);

    addSubOrderLog(db, {
      subOrderId: id,
      status: 'PENDING_INBOUND',
      step: '子单创建',
      operator: 'system',
      location: '系统',
      remark: '子单已创建',
      timestamp: now,
    });
    syncMasterOrderStatus(db, masterOrderId, now);
  });
  tx();

  const sub = db.prepare('SELECT * FROM sub_orders WHERE id = ?').get(id) as any;
  sub.subOrderNo = sub.id;
  success(res, sub);
});

// PUT /api/orders/sub/:id
router.put('/sub/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sub_orders WHERE id = ?').get(req.params.id) as any;
  if (!existing) { error(res, 'Sub order not found', 404); return; }

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'subOrderNo' || key === 'logisticsRecords' || key === 'items') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  const now = new Date().toISOString();
  sets.push('updatedAt = ?');
  params.push(now);
  params.push(req.params.id);

  const tx = db.transaction(() => {
    db.prepare(`UPDATE sub_orders SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    if (fields.status && fields.status !== existing.status) {
      addSubOrderLog(db, {
        subOrderId: req.params.id,
        status: String(fields.status),
        operator: 'system',
        location: '系统',
        remark: `状态更新为 ${fields.status}`,
        timestamp: now,
      });
      syncMasterOrderStatusBySubOrderId(db, req.params.id, now);
    }
  });
  tx();

  const sub = db.prepare('SELECT * FROM sub_orders WHERE id = ?').get(req.params.id) as any;
  sub.subOrderNo = sub.id;
  success(res, sub);
});

// PUT /api/orders/sub/:id/status
router.put('/sub/:id/status', (req, res) => {
  const db = getDb();
  const { status, currentNode } = req.body;
  if (!status) { error(res, 'status is required'); return; }

  const existing = db.prepare('SELECT * FROM sub_orders WHERE id = ?').get(req.params.id) as any;
  if (!existing) { error(res, 'Sub order not found', 404); return; }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('UPDATE sub_orders SET status = ?, currentNode = ?, updatedAt = ? WHERE id = ?')
      .run(status, currentNode || null, now, req.params.id);

    addSubOrderLog(db, {
      subOrderId: req.params.id,
      status,
      operator: 'system',
      location: '系统',
      remark: currentNode || `状态更新为 ${status}`,
      timestamp: now,
    });
    syncMasterOrderStatusBySubOrderId(db, req.params.id, now);
  });
  tx();

  const sub = db.prepare('SELECT * FROM sub_orders WHERE id = ?').get(req.params.id) as any;
  sub.subOrderNo = sub.id;
  success(res, sub);
});

// GET /api/orders/search
router.get('/search', (req, res) => {
  const db = getDb();
  const { q } = req.query;
  if (!q) { error(res, 'Search query is required'); return; }

  const pattern = `%${q}%`;

  const masters = db.prepare(
    'SELECT * FROM master_orders WHERE id LIKE ? OR customerName LIKE ? LIMIT 20'
  ).all(pattern, pattern);
  (masters as any[]).forEach(row => { row.orderNo = row.id; });

  const subs = db.prepare(
    'SELECT * FROM sub_orders WHERE id LIKE ? OR expressTrackingNo LIKE ? LIMIT 20'
  ).all(pattern, pattern);
  (subs as any[]).forEach(row => { row.subOrderNo = row.id; });

  success(res, { masterOrders: masters, subOrders: subs });
});

// ==================== RETURN ORDER APPROVAL ====================

// POST /api/orders/master/:id/approve-return
router.post('/master/:id/approve-return', (req, res) => {
  const db = getDb();
  const { approver } = req.body;
  const now = new Date().toISOString();

  const order = db.prepare('SELECT * FROM master_orders WHERE id = ?').get(req.params.id) as any;
  if (!order) { error(res, '主订单不存在', 404); return; }
  if (order.status !== 'RETURN_APPLIED') { error(res, '订单状态不是待审核退单', 400); return; }

  const summary = { returnRecords: 0, stockUpdated: 0, containerUpdated: 0, feeCancelled: 0, deliveryDeleted: 0 };

  const tx = db.transaction(() => {
    // 1. Update master order → CANCELLED
    db.prepare(`UPDATE master_orders SET status = 'CANCELLED', returnApprover = ?, returnApprovedAt = ?, updatedAt = ? WHERE id = ?`)
      .run(approver || '系统', now, now, req.params.id);

    // 2. Get all sub orders, then cancel them
    const subOrders = db.prepare('SELECT * FROM sub_orders WHERE masterOrderId = ?').all(req.params.id) as any[];
    if (subOrders.length > 0) {
      db.prepare(`UPDATE sub_orders SET status = 'CANCELLED', updatedAt = ? WHERE masterOrderId = ?`)
        .run(now, req.params.id);
    }

    // 3. Generate return records if needReturn
    if (order.needReturn) {
      for (const sub of subOrders) {
        const returnId = generateId('R');
        const returnNo = returnId;
        db.prepare(`
          INSERT INTO return_records (id, returnNo, orderNo, trackingNo, customerName, returnType, returnStage, status, reason, pieces, weight, volume, applicant, applyTime, approver, approveTime, currentLocation, remark, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, 'ORIGIN', 'APPROVED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          returnId, returnNo,
          order.id,
          sub.expressTrackingNo || null,
          order.customerName,
          order.returnType || 'OTHER',
          order.returnReason || '退单审核通过',
          sub.pieces || 0,
          sub.weight || 0,
          sub.volume || 0,
          order.returnAppliedBy || '系统',
          order.returnAppliedAt || now,
          approver || '系统',
          now,
          'CN仓库',
          order.returnShippingNote || null,
          now
        );
        summary.returnRecords++;
      }
    }

    // 4. Update stock items → RETURNED
    const stockResult = db.prepare(`UPDATE stock_items SET status = 'RETURNED' WHERE masterOrderNo = ? AND status IN ('IN_STOCK', 'ALLOCATED')`)
      .run(order.id);
    summary.stockUpdated = stockResult.changes;

    // 5. Handle shipping units (containers)
    const affectedUnits = new Set<string>();
    for (const sub of subOrders) {
      if (sub.shippingUnitId) {
        affectedUnits.add(sub.shippingUnitId);
        db.prepare('UPDATE sub_orders SET shippingUnitId = NULL WHERE id = ?').run(sub.id);
      }
    }
    for (const unitId of affectedUnits) {
      const stats = db.prepare(`
        SELECT COUNT(*) as orderCount, COALESCE(SUM(pieces), 0) as totalPieces,
               COALESCE(SUM(weight), 0) as totalWeight, COALESCE(SUM(volume), 0) as totalVolume
        FROM sub_orders WHERE shippingUnitId = ? AND status != 'CANCELLED'
      `).get(unitId) as any;

      if (stats.orderCount === 0) {
        db.prepare(`UPDATE shipping_units SET loadedOrders = 0, loadedPieces = 0, currentWeight = 0, currentVolume = 0, status = 'EMPTY', updatedAt = ? WHERE id = ?`)
          .run(now, unitId);
      } else {
        db.prepare(`UPDATE shipping_units SET loadedOrders = ?, loadedPieces = ?, currentWeight = ?, currentVolume = ?, updatedAt = ? WHERE id = ?`)
          .run(stats.orderCount, stats.totalPieces, stats.totalWeight, stats.totalVolume, now, unitId);
      }
      summary.containerUpdated++;
    }

    // 6. Cancel pending fee records
    const feeResult = db.prepare(`UPDATE fee_records SET status = 'CANCELLED', updatedAt = ? WHERE relatedType = 'ORDER' AND relatedId = ? AND status = 'PENDING'`)
      .run(now, req.params.id);
    summary.feeCancelled = feeResult.changes;

    // 7. Delete pending delivery orders
    const subOrderIds = subOrders.map(s => s.id);
    if (subOrderIds.length > 0) {
      const placeholders = subOrderIds.map(() => '?').join(',');
      const affectedDeliveryItems = db.prepare(`
        SELECT DISTINCT deliveryOrderId FROM delivery_order_items WHERE subOrderId IN (${placeholders})
      `).all(...subOrderIds) as any[];

      for (const item of affectedDeliveryItems) {
        const deliveryOrder = db.prepare('SELECT status FROM delivery_orders WHERE id = ?').get(item.deliveryOrderId) as any;
        if (deliveryOrder && deliveryOrder.status === 'PENDING') {
          db.prepare('DELETE FROM delivery_orders WHERE id = ?').run(item.deliveryOrderId);
          summary.deliveryDeleted++;
        }
      }
    }
  });

  tx();

  const updated = db.prepare('SELECT * FROM master_orders WHERE id = ?').get(req.params.id);
  success(res, { order: updated, summary });
});

// POST /api/orders/master/:id/reject-return
router.post('/master/:id/reject-return', (req, res) => {
  const db = getDb();
  const { rejectReason, approver } = req.body;
  const now = new Date().toISOString();

  const order = db.prepare('SELECT * FROM master_orders WHERE id = ?').get(req.params.id) as any;
  if (!order) { error(res, '主订单不存在', 404); return; }
  if (order.status !== 'RETURN_APPLIED') { error(res, '订单状态不是待审核退单', 400); return; }

  const restoreStatus = order.previousStatus || 'PENDING_INBOUND';

  db.prepare(`
    UPDATE master_orders SET
      status = ?,
      returnType = NULL, returnReason = NULL, returnRefundAmount = NULL, returnRefundMethod = NULL,
      needReturn = NULL, returnShippingNote = NULL,
      returnAppliedBy = NULL, returnAppliedAt = NULL, previousStatus = NULL,
      returnApprover = ?, returnApprovedAt = ?, returnRejectReason = ?,
      updatedAt = ?
    WHERE id = ?
  `).run(restoreStatus, approver || '系统', now, rejectReason || '', now, req.params.id);

  const updated = db.prepare('SELECT * FROM master_orders WHERE id = ?').get(req.params.id);
  success(res, updated);
});

export default router;
