import { Router } from 'express';
import { getDb } from '../database/connection';
import { getV2Db } from '../database/connectionV2';
import { success, error } from '../utils/response';
import { generateId, generateSimpleId } from '../utils/idGenerator';
import { addSubOrderLog, syncMasterOrderStatus } from '../utils/orderFlow';

const router = Router();

interface V2OrderRef {
  orderId: string;
  orderNo: string;
  displayOrderNo: string;
  subOrderId?: string | null;
  subOrderNo?: string | null;
  businessLine?: 'SEA' | 'AIR' | null;
}

interface ThirdPartyTrackingRef {
  statusCode?: string | null;
  status?: string | null;
  statusTime?: string | null;
}

function normalizeWaybillNo(raw: unknown): string | null {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return null;
  return /^[AS]-\d{14}$/.test(value) ? value : null;
}

function parseJsonArray(raw: unknown): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function getV2OrderRefsByTrackingNos(trackingNos: string[]): Map<string, V2OrderRef> {
  const result = new Map<string, V2OrderRef>();
  const normalized = Array.from(new Set(
    trackingNos
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
  ));
  if (normalized.length === 0) return result;

  try {
    const v2 = getV2Db();
    const placeholders = normalized.map(() => '?').join(',');

    const actualRows = v2.prepare(`
      SELECT
        a.tracking_no AS trackingNo,
        o.id AS orderId,
        o.order_no AS orderNo,
        o.display_order_no AS displayOrderNo,
        so.id AS subOrderId,
        so.sub_order_no AS subOrderNo,
        o.business_line AS businessLine,
        a.updated_at AS updatedAt
      FROM oms_order_package_actual a
      JOIN oms_order o ON o.id = a.order_id
      LEFT JOIN oms_sub_order so ON so.id = a.sub_order_id
      WHERE UPPER(COALESCE(a.tracking_no, '')) IN (${placeholders})
      ORDER BY datetime(a.updated_at) DESC
    `).all(...normalized) as any[];

    for (const row of actualRows) {
      const key = String(row.trackingNo || '').trim().toUpperCase();
      if (!key || result.has(key)) continue;
      result.set(key, {
        orderId: row.orderId,
        orderNo: row.orderNo,
        displayOrderNo: row.orderNo || row.displayOrderNo,
        subOrderId: row.subOrderId,
        subOrderNo: row.subOrderNo,
        businessLine: row.businessLine,
      });
    }

    const initialRows = v2.prepare(`
      SELECT
        p.tracking_no AS trackingNo,
        o.id AS orderId,
        o.order_no AS orderNo,
        o.display_order_no AS displayOrderNo,
        so.id AS subOrderId,
        so.sub_order_no AS subOrderNo,
        o.business_line AS businessLine,
        p.updated_at AS updatedAt
      FROM oms_order_package_initial p
      JOIN oms_order o ON o.id = p.order_id
      LEFT JOIN oms_sub_order so
        ON so.order_id = p.order_id
       AND so.line_no = p.line_no
      WHERE UPPER(COALESCE(p.tracking_no, '')) IN (${placeholders})
      ORDER BY datetime(p.updated_at) DESC
    `).all(...normalized) as any[];

    for (const row of initialRows) {
      const key = String(row.trackingNo || '').trim().toUpperCase();
      if (!key || result.has(key)) continue;
      result.set(key, {
        orderId: row.orderId,
        orderNo: row.orderNo,
        displayOrderNo: row.orderNo || row.displayOrderNo,
        subOrderId: row.subOrderId,
        subOrderNo: row.subOrderNo,
        businessLine: row.businessLine,
      });
    }
  } catch (_) {
    return result;
  }

  return result;
}

function getV2OrderRefsBySubOrderNos(subOrderNos: string[]): Map<string, V2OrderRef> {
  const result = new Map<string, V2OrderRef>();
  const normalized = Array.from(new Set(
    subOrderNos
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
  ));
  if (normalized.length === 0) return result;

  try {
    const v2 = getV2Db();
    const placeholders = normalized.map(() => '?').join(',');
    const rows = v2.prepare(`
      SELECT
        so.id AS subOrderId,
        so.sub_order_no AS subOrderNo,
        o.id AS orderId,
        o.order_no AS orderNo,
        o.display_order_no AS displayOrderNo,
        o.business_line AS businessLine,
        so.updated_at AS updatedAt
      FROM oms_sub_order so
      JOIN oms_order o ON o.id = so.order_id
      WHERE UPPER(COALESCE(so.sub_order_no, '')) IN (${placeholders})
      ORDER BY datetime(so.updated_at) DESC
    `).all(...normalized) as any[];

    for (const row of rows) {
      const key = String(row.subOrderNo || '').trim().toUpperCase();
      if (!key || result.has(key)) continue;
      result.set(key, {
        orderId: row.orderId,
        orderNo: row.orderNo,
        displayOrderNo: row.orderNo || row.displayOrderNo,
        subOrderId: row.subOrderId,
        subOrderNo: row.subOrderNo,
        businessLine: row.businessLine,
      });
    }
  } catch (_) {
    return result;
  }

  return result;
}

function normalizeThirdPartyStatus(statusCode?: string | null): string {
  const code = String(statusCode || '').trim().toUpperCase();
  if (!code) return '-';

  const pending = new Set(['PENDING', 'PENDING_SIGN', 'WAIT_SIGN', 'NOT_SIGNED', 'UNSIGNED']);
  const signed = new Set(['SIGNED', 'RECEIVED', 'INBOUND', 'IN_STOCK', 'DELIVERED', 'COMPLETED']);
  const cancelled = new Set(['CANCELLED', 'DELETED', 'VOID']);
  const abnormal = new Set(['ABNORMAL', 'EXCEPTION', 'FAILED']);

  if (pending.has(code)) return '未签收';
  if (signed.has(code)) return '已签收';
  if (cancelled.has(code)) return '已取消';
  if (abnormal.has(code)) return '异常';
  return code;
}

function getThirdPartyTrackingByTrackingNos(trackingNos: string[]): Map<string, ThirdPartyTrackingRef> {
  const result = new Map<string, ThirdPartyTrackingRef>();
  const normalized = Array.from(new Set(
    trackingNos
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
  ));
  if (normalized.length === 0) return result;

  const upsertLatest = (trackingNoRaw: unknown, statusCodeRaw: unknown, statusTimeRaw: unknown) => {
    const key = String(trackingNoRaw || '').trim().toUpperCase();
    if (!key) return;
    const candidateTime = statusTimeRaw ? String(statusTimeRaw) : null;
    const existing = result.get(key);
    if (existing?.statusTime && candidateTime) {
      const existingTime = Date.parse(existing.statusTime);
      const nextTime = Date.parse(candidateTime);
      if (Number.isFinite(existingTime) && Number.isFinite(nextTime) && nextTime <= existingTime) {
        return;
      }
    }
    const statusCode = statusCodeRaw ? String(statusCodeRaw) : null;
    result.set(key, {
      statusCode,
      status: normalizeThirdPartyStatus(statusCode),
      statusTime: candidateTime,
    });
  };

  try {
    const v2 = getV2Db();
    const placeholders = normalized.map(() => '?').join(',');

    const actualRows = v2.prepare(`
      SELECT
        tracking_no AS trackingNo,
        package_status AS statusCode,
        COALESCE(package_status_updated_at, updated_at, created_at) AS statusTime
      FROM oms_order_package_actual
      WHERE UPPER(COALESCE(tracking_no, '')) IN (${placeholders})
    `).all(...normalized) as any[];
    for (const row of actualRows) {
      upsertLatest(row.trackingNo, row.statusCode, row.statusTime);
    }

    const initialRows = v2.prepare(`
      SELECT
        tracking_no AS trackingNo,
        package_status AS statusCode,
        COALESCE(package_status_updated_at, updated_at, created_at) AS statusTime
      FROM oms_order_package_initial
      WHERE UPPER(COALESCE(tracking_no, '')) IN (${placeholders})
    `).all(...normalized) as any[];
    for (const row of initialRows) {
      upsertLatest(row.trackingNo, row.statusCode, row.statusTime);
    }
  } catch (_) {
    // ignore v2 errors and continue with legacy fallback
  }

  try {
    const db = getDb();
    const placeholders = normalized.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT
        trackingNo,
        status AS statusCode,
        createdAt AS statusTime
      FROM express_packages
      WHERE UPPER(COALESCE(trackingNo, '')) IN (${placeholders})
    `).all(...normalized) as any[];
    for (const row of rows) {
      upsertLatest(row.trackingNo, row.statusCode, row.statusTime);
    }
  } catch (_) {
    // ignore
  }

  return result;
}

// ==================== INBOUND ====================

// GET /api/warehouse/inbound
router.get('/inbound', (req, res) => {
  const db = getDb();
  const {
    status,
    warehouse,
    trackingNo,
    masterOrderId,
    jobNo,
    warehouseId,
    businessLine,
    salesPerson,
    serviceType,
    keyword,
    startDate,
    endDate,
  } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) { where += ' AND ir.status = ?'; params.push(status); }
  if (warehouse) { where += ' AND ir.warehouse = ?'; params.push(warehouse); }
  if (warehouseId) { where += ' AND ir.warehouseId = ?'; params.push(warehouseId); }
  if (trackingNo) { where += ' AND ir.trackingNo LIKE ?'; params.push(`%${trackingNo}%`); }
  if (masterOrderId) { where += ' AND ir.masterOrderId = ?'; params.push(masterOrderId); }
  if (jobNo) { where += ' AND ir.jobNo = ?'; params.push(jobNo); }
  if (businessLine) { where += ' AND COALESCE(so.transportType, mo.transportType) = ?'; params.push(String(businessLine).toUpperCase()); }
  if (salesPerson) { where += ' AND mo.salesPerson = ?'; params.push(salesPerson); }
  if (serviceType) { where += ' AND COALESCE(so.serviceType, mo.serviceType) = ?'; params.push(serviceType); }
  if (startDate) { where += ' AND datetime(ir.createdAt) >= datetime(?)'; params.push(startDate); }
  if (endDate) { where += ' AND datetime(ir.createdAt) <= datetime(?)'; params.push(endDate); }
  if (keyword) {
    where += ' AND (ir.trackingNo LIKE ? OR ir.clientName LIKE ? OR ir.clientCode LIKE ? OR ir.subOrderId LIKE ? OR ir.masterOrderId LIKE ? OR ir.jobNo LIKE ? OR so.route LIKE ? OR mo.routeCode LIKE ?)';
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const rows = db.prepare(`
    SELECT
      ir.*,
      so.status AS subOrderStatus,
      so.transportType AS transportType,
      COALESCE(so.route, mo.routeCode) AS routeCode,
      COALESCE(so.serviceType, mo.serviceType) AS serviceTypeCode,
      so.goodsDescription,
      mo.salesPerson,
      mo.paymentMethod,
      mo.paymentStatus,
      mo.currency,
      mo.createdAt AS orderCreatedAt,
      mo.updatedAt AS orderUpdatedAt
    FROM inbound_records ir
    LEFT JOIN sub_orders so ON so.id = ir.subOrderId
    LEFT JOIN master_orders mo ON mo.id = ir.masterOrderId
    ${where}
    ORDER BY datetime(ir.createdAt) DESC
  `).all(...params);

  const trackingNos = (rows as any[]).map((row) => row.trackingNo);
  const orderRefs = getV2OrderRefsByTrackingNos(trackingNos);
  const subOrderRefs = getV2OrderRefsBySubOrderNos((rows as any[]).map((row) => row.subOrderId));
  const thirdPartyRefs = getThirdPartyTrackingByTrackingNos(trackingNos);
  const data = (rows as any[]).map((row) => {
    const key = String(row.trackingNo || '').trim().toUpperCase();
    const subOrderKey = String(row.subOrderId || '').trim().toUpperCase();
    const ref = orderRefs.get(key) || subOrderRefs.get(subOrderKey);
    const third = thirdPartyRefs.get(key);
    const subWaybillNo = ref?.subOrderNo || normalizeWaybillNo(row.subOrderId);
    const masterWaybillNo = ref?.displayOrderNo || ref?.orderNo || normalizeWaybillNo(row.masterOrderId);
    return {
      ...row,
      legacySubOrderNo: row.subOrderId || null,
      legacyOrderNo: row.masterOrderId || null,
      subWaybillNo: subWaybillNo || null,
      masterWaybillNo: masterWaybillNo || null,
      subOrderNo: subWaybillNo || row.subOrderId,
      orderNo: masterWaybillNo || row.masterOrderId,
      displaySubOrderNo: subWaybillNo || row.subOrderId,
      displayOrderNo: masterWaybillNo || '-',
      photos: parseJsonArray(row.photos),
      route: row.routeCode || '-',
      serviceType: row.serviceTypeCode || '-',
      goodsDescription: row.goodsDescription || '',
      thirdPartyStatusCode: third?.statusCode || null,
      thirdPartyStatus: third?.status || '-',
      thirdPartyStatusTime: third?.statusTime || null,
      logisticsStatus: third?.status || row.subOrderStatus || row.status,
      logisticsStatusTime: third?.statusTime || row.updatedAt || row.createdAt,
      orderDate: row.orderCreatedAt || null,
      updatedAt: row.orderUpdatedAt || row.createdAt,
    };
  });

  success(res, data);
});

// GET /api/warehouse/inbound/:id
router.get('/inbound/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      ir.*,
      so.status AS subOrderStatus,
      so.transportType AS transportType,
      COALESCE(so.route, mo.routeCode) AS routeCode,
      COALESCE(so.serviceType, mo.serviceType) AS serviceTypeCode,
      so.goodsDescription,
      mo.salesPerson,
      mo.paymentMethod,
      mo.paymentStatus,
      mo.currency,
      mo.createdAt AS orderCreatedAt,
      mo.updatedAt AS orderUpdatedAt
    FROM inbound_records ir
    LEFT JOIN sub_orders so ON so.id = ir.subOrderId
    LEFT JOIN master_orders mo ON mo.id = ir.masterOrderId
    WHERE ir.id = ?
    LIMIT 1
  `).get(req.params.id) as any;

  if (!row) {
    error(res, 'Inbound record not found', 404);
    return;
  }

  const key = String(row.trackingNo || '').trim().toUpperCase();
  const ref = getV2OrderRefsByTrackingNos([row.trackingNo || '']).get(key)
    || getV2OrderRefsBySubOrderNos([row.subOrderId || '']).get(String(row.subOrderId || '').trim().toUpperCase());
  const third = getThirdPartyTrackingByTrackingNos([row.trackingNo || '']).get(key);
  const subWaybillNo = ref?.subOrderNo || normalizeWaybillNo(row.subOrderId);
  const masterWaybillNo = ref?.displayOrderNo || ref?.orderNo || normalizeWaybillNo(row.masterOrderId);

  success(res, {
    ...row,
    legacySubOrderNo: row.subOrderId || null,
    legacyOrderNo: row.masterOrderId || null,
    subWaybillNo: subWaybillNo || null,
    masterWaybillNo: masterWaybillNo || null,
    subOrderNo: subWaybillNo || row.subOrderId,
    orderNo: masterWaybillNo || row.masterOrderId,
    displaySubOrderNo: subWaybillNo || row.subOrderId,
    displayOrderNo: masterWaybillNo || '-',
    photos: parseJsonArray(row.photos),
    route: row.routeCode || '-',
    serviceType: row.serviceTypeCode || '-',
    goodsDescription: row.goodsDescription || '',
    thirdPartyStatusCode: third?.statusCode || null,
    thirdPartyStatus: third?.status || '-',
    thirdPartyStatusTime: third?.statusTime || null,
    logisticsStatus: third?.status || row.subOrderStatus || row.status,
    logisticsStatusTime: third?.statusTime || row.updatedAt || row.createdAt,
    orderDate: row.orderCreatedAt || null,
    updatedAt: row.orderUpdatedAt || row.createdAt,
  });
});

// POST /api/warehouse/inbound
router.post('/inbound', (req, res) => {
  const db = getDb();
  const id = generateId('INB');
  const now = new Date().toISOString();

  const {
    subOrderId, masterOrderId, trackingNo, expressCompany, clientCode, clientName,
    pieces, actualWeight, actualVolume, packageCondition, inboundMethod,
    warehouseLocation, warehouse, warehouseId, operator, photos, remark
  } = req.body;

  if (!subOrderId || !masterOrderId || !trackingNo || !expressCompany || !clientCode || !clientName || !pieces) {
    error(res, 'Missing required fields');
    return;
  }

  const sub = db.prepare('SELECT id, masterOrderId, weight, volume, transportType, route, destCountry, destCity FROM sub_orders WHERE id = ?').get(subOrderId) as any;
  if (!sub) {
    error(res, 'Sub order not found', 404);
    return;
  }

  const master = db.prepare('SELECT id, salesPerson FROM master_orders WHERE id = ?').get(masterOrderId) as any;
  if (!master) {
    error(res, 'Master order not found', 404);
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO inbound_records (id, subOrderId, masterOrderId, trackingNo, expressCompany, clientCode, clientName, pieces, actualWeight, actualVolume, packageCondition, status, inboundTime, inboundMethod, warehouseLocation, warehouse, warehouseId, operator, photos, remark, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, subOrderId, masterOrderId, trackingNo, expressCompany, clientCode, clientName,
      pieces, actualWeight || null, actualVolume || null, packageCondition || 'GOOD',
      now, inboundMethod || 'SCAN', warehouseLocation || null, warehouse || 'CN', warehouseId || null,
      operator || null, photos ? JSON.stringify(photos) : null, remark || null, now);

    // Update sub order status to INBOUND
    db.prepare("UPDATE sub_orders SET status = 'INBOUND', currentNode = '已入库', updatedAt = ? WHERE id = ?")
      .run(now, subOrderId);

    const weight = Number(actualWeight ?? sub.weight ?? 0);
    const volume = Number(actualVolume ?? sub.volume ?? 0);
    const stockStatus = (db.prepare('SELECT id FROM stock_items WHERE subOrderNo = ?').get(sub.id) as any)?.id;
    if (stockStatus) {
      db.prepare(`
        UPDATE stock_items
        SET masterOrderNo = ?, trackingNo = ?, clientCode = ?, clientName = ?, pieces = ?, weight = ?, volume = ?,
            status = 'IN_STOCK', warehouseLocation = ?, warehouse = ?, warehouseId = ?, inboundTime = ?,
            shippingUnitId = NULL, transportType = ?, route = ?, destination = ?, salesPerson = ?, remark = ?
        WHERE subOrderNo = ?
      `).run(
        master.id,
        trackingNo,
        clientCode,
        clientName,
        Number(pieces),
        weight,
        volume,
        warehouseLocation || null,
        warehouse || 'CN',
        warehouseId || null,
        now,
        sub.transportType || null,
        sub.route || null,
        `${sub.destCountry || ''}-${sub.destCity || ''}`.replace(/^-|-$/g, ''),
        master.salesPerson || null,
        remark || null,
        sub.id
      );
    } else {
      db.prepare(`
        INSERT INTO stock_items
        (id, masterOrderNo, subOrderNo, trackingNo, clientCode, clientName, pieces, weight, volume, status, warehouseLocation, warehouse, warehouseId, inboundTime, shippingUnitId, transportType, route, destination, salesPerson, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
      `).run(
        `STK-${generateSimpleId()}`,
        master.id,
        sub.id,
        trackingNo,
        clientCode,
        clientName,
        Number(pieces),
        weight,
        volume,
        warehouseLocation || null,
        warehouse || 'CN',
        warehouseId || null,
        now,
        sub.transportType || null,
        sub.route || null,
        `${sub.destCountry || ''}-${sub.destCity || ''}`.replace(/^-|-$/g, ''),
        master.salesPerson || null,
        remark || null
      );
    }

    addSubOrderLog(db, {
      subOrderId,
      status: 'INBOUND',
      operator: operator || 'warehouse',
      location: warehouseLocation || warehouse || 'CN',
      remark: remark || '入库完成',
      timestamp: now,
    });
    syncMasterOrderStatus(db, masterOrderId, now);
  });
  tx();

  const record = db.prepare('SELECT * FROM inbound_records WHERE id = ?').get(id) as any;
  record.photos = parseJsonArray(record.photos);
  success(res, record);
});

// PUT /api/warehouse/inbound/:id
router.put('/inbound/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM inbound_records WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Inbound record not found', 404);
    return;
  }

  const now = new Date().toISOString();
  const fields = req.body || {};
  const allowed = new Set([
    'actualWeight', 'actualVolume', 'packageCondition', 'status',
    'warehouseLocation', 'operator', 'remark', 'length', 'width',
    'height', 'jobNo', 'transferNo', 'dpnNo',
  ]);

  const sets: string[] = [];
  const params: any[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.has(key)) continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'photos')) {
    sets.push('photos = ?');
    params.push(Array.isArray(fields.photos) ? JSON.stringify(fields.photos) : fields.photos);
  }

  if (sets.length === 0) {
    error(res, 'No valid update fields');
    return;
  }

  const tx = db.transaction(() => {
    params.push(req.params.id);
    db.prepare(`UPDATE inbound_records SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    // 同步库存重量、体积和库位信息
    const latest = db.prepare('SELECT * FROM inbound_records WHERE id = ?').get(req.params.id) as any;
    db.prepare(`
      UPDATE stock_items
      SET weight = COALESCE(?, weight),
          volume = COALESCE(?, volume),
          warehouseLocation = COALESCE(?, warehouseLocation),
          remark = COALESCE(?, remark)
      WHERE subOrderNo = ?
    `).run(
      latest.actualWeight ?? null,
      latest.actualVolume ?? null,
      latest.warehouseLocation ?? null,
      latest.remark ?? null,
      latest.subOrderId
    );

    // 入库状态同步子单
    if (latest.status === 'COMPLETED') {
      db.prepare("UPDATE sub_orders SET status = 'INBOUND', currentNode = '已入库', updatedAt = ? WHERE id = ?")
        .run(now, latest.subOrderId);
      addSubOrderLog(db, {
        subOrderId: latest.subOrderId,
        status: 'INBOUND',
        operator: latest.operator || 'warehouse',
        location: latest.warehouseLocation || latest.warehouse || 'CN',
        remark: latest.remark || '补录确认入库',
        timestamp: now,
      });
      syncMasterOrderStatus(db, latest.masterOrderId, now);
    } else if (latest.status === 'ABNORMAL') {
      db.prepare("UPDATE sub_orders SET status = 'EXCEPTION', currentNode = '入库异常', updatedAt = ? WHERE id = ?")
        .run(now, latest.subOrderId);
      addSubOrderLog(db, {
        subOrderId: latest.subOrderId,
        status: 'EXCEPTION',
        operator: latest.operator || 'warehouse',
        location: latest.warehouseLocation || latest.warehouse || 'CN',
        remark: latest.remark || '入库异常',
        timestamp: now,
      });
      syncMasterOrderStatus(db, latest.masterOrderId, now);
    }
  });
  tx();

  const updated = db.prepare('SELECT * FROM inbound_records WHERE id = ?').get(req.params.id) as any;
  updated.photos = parseJsonArray(updated.photos);
  success(res, updated);
});

// POST /api/warehouse/inbound/:id/cancel
router.post('/inbound/:id/cancel', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM inbound_records WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Inbound record not found', 404);
    return;
  }

  const reason = String(req.body.reason || '').trim() || '仓库取消入库';
  const operator = String(req.body.operator || existing.operator || 'warehouse');
  const now = new Date().toISOString();

  const mergedRemark = existing.remark
    ? `${existing.remark}；[取消入库] ${reason}`
    : `[取消入库] ${reason}`;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE inbound_records
      SET status = 'ABNORMAL',
          operator = ?,
          remark = ?,
          packageCondition = COALESCE(packageCondition, 'INCOMPLETE')
      WHERE id = ?
    `).run(operator, mergedRemark, existing.id);

    if (existing.subOrderId) {
      db.prepare(`
        UPDATE sub_orders
        SET status = 'CANCELLED',
            currentNode = '已取消',
            updatedAt = ?
        WHERE id = ?
      `).run(now, existing.subOrderId);

      addSubOrderLog(db, {
        subOrderId: existing.subOrderId,
        status: 'CANCELLED',
        operator,
        location: existing.warehouseLocation || existing.warehouse || 'CN',
        remark: reason,
        timestamp: now,
      });

      db.prepare(`
        UPDATE stock_items
        SET status = 'RETURNED',
            returnReason = ?,
            returnTime = ?,
            remark = COALESCE(?, remark)
        WHERE subOrderNo = ?
      `).run(reason, now, mergedRemark, existing.subOrderId);
    }

    if (existing.masterOrderId) {
      syncMasterOrderStatus(db, existing.masterOrderId, now);
    }
  });
  tx();

  const updated = db.prepare('SELECT * FROM inbound_records WHERE id = ?').get(existing.id) as any;
  updated.photos = parseJsonArray(updated.photos);
  success(res, updated, '入库记录已取消');
});

// DELETE /api/warehouse/inbound/:id
router.delete('/inbound/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM inbound_records WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Inbound record not found', 404);
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM inbound_records WHERE id = ?').run(existing.id);

    if (existing.subOrderId) {
      const latestInbound = db.prepare(`
        SELECT *
        FROM inbound_records
        WHERE subOrderId = ?
        ORDER BY datetime(createdAt) DESC
        LIMIT 1
      `).get(existing.subOrderId) as any;

      if (!latestInbound) {
        db.prepare('DELETE FROM stock_items WHERE subOrderNo = ?').run(existing.subOrderId);
        db.prepare("UPDATE sub_orders SET status = 'PENDING_INBOUND', currentNode = '待入库', updatedAt = ? WHERE id = ?")
          .run(now, existing.subOrderId);
        addSubOrderLog(db, {
          subOrderId: existing.subOrderId,
          status: 'PENDING_INBOUND',
          operator: String(req.body?.operator || existing.operator || 'warehouse'),
          location: existing.warehouseLocation || existing.warehouse || 'CN',
          remark: '删除入库记录，回退为待入库',
          timestamp: now,
        });
      } else {
        const derivedStatus = latestInbound.status === 'COMPLETED' ? 'INBOUND' : 'EXCEPTION';
        const derivedNode = latestInbound.status === 'COMPLETED' ? '已入库' : '入库异常';
        db.prepare(`
          UPDATE stock_items
          SET trackingNo = ?,
              clientCode = ?,
              clientName = ?,
              pieces = ?,
              weight = COALESCE(?, weight),
              volume = COALESCE(?, volume),
              warehouseLocation = COALESCE(?, warehouseLocation),
              status = CASE WHEN ? = 'COMPLETED' THEN 'IN_STOCK' ELSE status END,
              remark = COALESCE(?, remark)
          WHERE subOrderNo = ?
        `).run(
          latestInbound.trackingNo || null,
          latestInbound.clientCode || null,
          latestInbound.clientName || null,
          Number(latestInbound.pieces || 0),
          latestInbound.actualWeight ?? null,
          latestInbound.actualVolume ?? null,
          latestInbound.warehouseLocation ?? null,
          latestInbound.status,
          latestInbound.remark ?? null,
          existing.subOrderId
        );
        db.prepare('UPDATE sub_orders SET status = ?, currentNode = ?, updatedAt = ? WHERE id = ?')
          .run(derivedStatus, derivedNode, now, existing.subOrderId);
      }
    }

    if (existing.masterOrderId) {
      syncMasterOrderStatus(db, existing.masterOrderId, now);
    }
  });

  tx();
  success(res, null, '入库记录已删除');
});

// ==================== STOCK ====================

// GET /api/warehouse/stock
router.get('/stock', (req, res) => {
  const db = getDb();
  const {
    warehouse,
    warehouseId,
    status,
    keyword,
    businessLine,
    paymentStatus,
    paymentMethod,
    salesPerson,
    serviceType,
    startDate,
    endDate,
  } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (warehouse) { where += ' AND si.warehouse = ?'; params.push(warehouse); }
  if (warehouseId) { where += ' AND si.warehouseId = ?'; params.push(warehouseId); }
  if (status) { where += ' AND si.status = ?'; params.push(status); }
  if (businessLine) { where += ' AND COALESCE(si.transportType, so.transportType, mo.transportType) = ?'; params.push(String(businessLine).toUpperCase()); }
  if (paymentStatus) { where += ' AND mo.paymentStatus = ?'; params.push(paymentStatus); }
  if (paymentMethod) { where += ' AND mo.paymentMethod = ?'; params.push(paymentMethod); }
  if (salesPerson) { where += ' AND COALESCE(si.salesPerson, mo.salesPerson) = ?'; params.push(salesPerson); }
  if (serviceType) { where += ' AND COALESCE(so.serviceType, mo.serviceType) = ?'; params.push(serviceType); }
  if (startDate) { where += ' AND datetime(si.inboundTime) >= datetime(?)'; params.push(startDate); }
  if (endDate) { where += ' AND datetime(si.inboundTime) <= datetime(?)'; params.push(endDate); }
  if (keyword) {
    where += ' AND (si.subOrderNo LIKE ? OR si.masterOrderNo LIKE ? OR si.trackingNo LIKE ? OR si.clientName LIKE ? OR si.clientCode LIKE ? OR so.route LIKE ? OR mo.routeCode LIKE ?)';
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const rows = db.prepare(`
    SELECT
      si.*,
      so.status AS subOrderStatus,
      COALESCE(so.route, si.route, mo.routeCode) AS routeCode,
      COALESCE(so.serviceType, mo.serviceType) AS serviceTypeCode,
      so.goodsDescription,
      so.currentNode,
      mo.paymentMethod,
      mo.paymentStatus,
      mo.currency,
      mo.totalFreight,
      mo.paidAmount,
      mo.createdAt AS orderCreatedAt,
      mo.updatedAt AS orderUpdatedAt,
      COALESCE(si.salesPerson, mo.salesPerson) AS salesPersonLabel,
      su.unitNo AS shippingUnitNo
    FROM stock_items si
    LEFT JOIN sub_orders so ON so.id = si.subOrderNo
    LEFT JOIN master_orders mo ON mo.id = si.masterOrderNo
    LEFT JOIN shipping_units su ON su.id = si.shippingUnitId
    ${where}
    ORDER BY datetime(si.inboundTime) DESC
  `).all(...params);

  const orderRefs = getV2OrderRefsByTrackingNos((rows as any[]).map((row) => row.trackingNo));
  const subOrderRefs = getV2OrderRefsBySubOrderNos((rows as any[]).map((row) => row.subOrderNo));
  const data = (rows as any[]).map((row) => {
    const ref = orderRefs.get(String(row.trackingNo || '').trim().toUpperCase())
      || subOrderRefs.get(String(row.subOrderNo || '').trim().toUpperCase());
    const subWaybillNo = ref?.subOrderNo || normalizeWaybillNo(row.subOrderNo);
    const masterWaybillNo = ref?.displayOrderNo || ref?.orderNo || normalizeWaybillNo(row.masterOrderNo);
    return {
      ...row,
      legacySubOrderNo: row.subOrderNo || null,
      legacyMasterOrderNo: row.masterOrderNo || null,
      subWaybillNo: subWaybillNo || null,
      masterWaybillNo: masterWaybillNo || null,
      displaySubOrderNo: subWaybillNo || row.subOrderNo,
      displayOrderNo: masterWaybillNo || '-',
      route: row.routeCode || row.route || '-',
      serviceType: row.serviceTypeCode || '-',
      salesPerson: row.salesPersonLabel || '-',
      goodsDescription: row.goodsDescription || row.productName || '-',
      logisticsStatus: row.subOrderStatus || row.status,
      updatedAt: row.orderUpdatedAt || row.inboundTime,
    };
  });

  success(res, data);
});

// GET /api/warehouse/stock/:subOrderNo
router.get('/stock/:subOrderNo', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM stock_items WHERE subOrderNo = ?').get(req.params.subOrderNo);
  if (!row) { error(res, 'Stock item not found', 404); return; }
  success(res, row);
});

// GET /api/warehouse/stock/item/:id
router.get('/stock/item/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      si.*,
      so.status AS subOrderStatus,
      COALESCE(so.route, si.route, mo.routeCode) AS routeCode,
      COALESCE(so.serviceType, mo.serviceType) AS serviceTypeCode,
      so.goodsDescription,
      so.currentNode,
      mo.paymentMethod,
      mo.paymentStatus,
      mo.currency,
      mo.totalFreight,
      mo.paidAmount,
      mo.createdAt AS orderCreatedAt,
      mo.updatedAt AS orderUpdatedAt,
      COALESCE(si.salesPerson, mo.salesPerson) AS salesPersonLabel,
      su.unitNo AS shippingUnitNo
    FROM stock_items si
    LEFT JOIN sub_orders so ON so.id = si.subOrderNo
    LEFT JOIN master_orders mo ON mo.id = si.masterOrderNo
    LEFT JOIN shipping_units su ON su.id = si.shippingUnitId
    WHERE si.id = ?
    LIMIT 1
  `).get(req.params.id) as any;
  if (!row) {
    error(res, 'Stock item not found', 404);
    return;
  }

  const ref = getV2OrderRefsByTrackingNos([row.trackingNo || ''])
    .get(String(row.trackingNo || '').trim().toUpperCase())
    || getV2OrderRefsBySubOrderNos([row.subOrderNo || ''])
      .get(String(row.subOrderNo || '').trim().toUpperCase());
  const subWaybillNo = ref?.subOrderNo || normalizeWaybillNo(row.subOrderNo);
  const masterWaybillNo = ref?.displayOrderNo || ref?.orderNo || normalizeWaybillNo(row.masterOrderNo);

  success(res, {
    ...row,
    legacySubOrderNo: row.subOrderNo || null,
    legacyMasterOrderNo: row.masterOrderNo || null,
    subWaybillNo: subWaybillNo || null,
    masterWaybillNo: masterWaybillNo || null,
    displaySubOrderNo: subWaybillNo || row.subOrderNo,
    displayOrderNo: masterWaybillNo || '-',
    route: row.routeCode || row.route || '-',
    serviceType: row.serviceTypeCode || '-',
    salesPerson: row.salesPersonLabel || '-',
    goodsDescription: row.goodsDescription || row.productName || '-',
    logisticsStatus: row.subOrderStatus || row.status,
    updatedAt: row.orderUpdatedAt || row.inboundTime,
  });
});

// PUT /api/warehouse/stock/:id/status
router.put('/stock/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  if (!status) { error(res, 'status is required'); return; }

  const result = db.prepare('UPDATE stock_items SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) { error(res, 'Stock item not found', 404); return; }

  const row = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id);
  success(res, row);
});

// PUT /api/warehouse/stock/:id
router.put('/stock/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Stock item not found', 404);
    return;
  }

  const fields = req.body || {};
  const allowed = new Set([
    'trackingNo', 'clientCode', 'clientName', 'pieces', 'weight', 'volume',
    'status', 'warehouseLocation', 'location', 'shippingUnitId', 'transportType',
    'route', 'destination', 'productName', 'salesPerson', 'returnReason', 'returnTime',
    'remark',
  ]);
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (!allowed.has(key)) continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  if (sets.length === 0) {
    error(res, 'No valid update fields');
    return;
  }

  params.push(req.params.id);
  db.prepare(`UPDATE stock_items SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id) as any;

  if (updated?.subOrderNo && fields.status) {
    const now = new Date().toISOString();
    const statusMap: Record<string, { subStatus: string; node: string }> = {
      IN_STOCK: { subStatus: 'INBOUND', node: '已入库' },
      ALLOCATED: { subStatus: 'PENDING_PACKING', node: '待装箱' },
      PACKED: { subStatus: 'PACKED', node: '已装箱' },
      SHIPPED: { subStatus: 'PENDING_DEPARTURE', node: '待发运' },
      RETURNED: { subStatus: 'RETURN_APPLIED', node: '退运申请中' },
    };
    const mapped = statusMap[String(updated.status || '').toUpperCase()];
    if (mapped) {
      db.prepare('UPDATE sub_orders SET status = ?, currentNode = ?, updatedAt = ? WHERE id = ?')
        .run(mapped.subStatus, mapped.node, now, updated.subOrderNo);
      addSubOrderLog(db, {
        subOrderId: updated.subOrderNo,
        status: mapped.subStatus,
        operator: String(fields.operator || 'warehouse'),
        location: updated.warehouseLocation || updated.warehouse || 'CN',
        remark: String(fields.remark || `库存状态更新为 ${updated.status}`),
        timestamp: now,
      });
      if (updated.masterOrderNo) {
        syncMasterOrderStatus(db, updated.masterOrderNo, now);
      }
    }
  }

  success(res, updated);
});

// POST /api/warehouse/stock/:id/return
router.post('/stock/:id/return', (req, res) => {
  const db = getDb();
  const stock = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id) as any;
  if (!stock) {
    error(res, 'Stock item not found', 404);
    return;
  }

  const returnReason = String(req.body.returnReason || '').trim();
  if (!returnReason) {
    error(res, 'returnReason is required');
    return;
  }

  const returnType = String(req.body.returnType || 'CLIENT');
  const applicant = String(req.body.applicant || 'warehouse');
  const remark = String(req.body.remark || '').trim() || null;
  const pieces = Number(req.body.pieces || stock.pieces || 0);
  const now = new Date().toISOString();
  const normalizedBusinessLine = String(stock.transportType || '').toUpperCase();
  const safeBusinessLine = normalizedBusinessLine === 'SEA' || normalizedBusinessLine === 'AIR'
    ? normalizedBusinessLine
    : null;
  const masterMeta = stock.masterOrderNo
    ? db.prepare('SELECT serviceType, salesPerson FROM master_orders WHERE id = ?').get(stock.masterOrderNo) as any
    : null;
  const returnId = generateId('RTN');
  const returnNo = `RTN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE stock_items
      SET status = 'RETURNED',
          returnReason = ?,
          returnTime = ?,
          remark = COALESCE(?, remark)
      WHERE id = ?
    `).run(returnReason, now, remark, stock.id);

    db.prepare(`
      INSERT INTO return_records
      (id, returnNo, orderNo, trackingNo, businessLine, warehouse, warehouseId, route, serviceType, salesPerson, customerName, returnType, returnStage, status, reason, pieces, weight, volume, applicant, applyTime, remark, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ORIGIN_WMS', 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      returnId,
      returnNo,
      stock.masterOrderNo || null,
      stock.trackingNo || null,
      safeBusinessLine,
      stock.warehouse || null,
      stock.warehouseId || null,
      stock.route || null,
      masterMeta?.serviceType || null,
      stock.salesPerson || masterMeta?.salesPerson || null,
      stock.clientName || '-',
      returnType,
      returnReason,
      pieces,
      Number(stock.weight || 0),
      Number(stock.volume || 0),
      applicant,
      now,
      remark,
      now
    );

    if (stock.subOrderNo) {
      db.prepare("UPDATE sub_orders SET status = 'RETURN_APPLIED', currentNode = '退运申请中', updatedAt = ? WHERE id = ?")
        .run(now, stock.subOrderNo);
      addSubOrderLog(db, {
        subOrderId: stock.subOrderNo,
        status: 'RETURN_APPLIED',
        operator: applicant,
        location: stock.warehouseLocation || stock.warehouse || 'CN',
        remark: returnReason,
        timestamp: now,
      });
      if (stock.masterOrderNo) {
        syncMasterOrderStatus(db, stock.masterOrderNo, now);
      }
    }
  });
  tx();

  const updatedStock = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(stock.id);
  const returnRecord = db.prepare('SELECT * FROM return_records WHERE id = ?').get(returnId);
  success(res, { stock: updatedStock, returnRecord }, '退运申请已提交');
});

// DELETE /api/warehouse/stock/:id
router.delete('/stock/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Stock item not found', 404);
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM stock_items WHERE id = ?').run(existing.id);
    if (existing.subOrderNo) {
      addSubOrderLog(db, {
        subOrderId: existing.subOrderNo,
        status: 'EXCEPTION',
        operator: String(req.body?.operator || 'warehouse'),
        location: existing.warehouseLocation || existing.warehouse || 'CN',
        remark: '库存记录删除',
        timestamp: now,
      });
      db.prepare("UPDATE sub_orders SET status = 'EXCEPTION', currentNode = '库存记录删除', updatedAt = ? WHERE id = ?")
        .run(now, existing.subOrderNo);
    }
    if (existing.masterOrderNo) {
      syncMasterOrderStatus(db, existing.masterOrderNo, now);
    }
  });
  tx();

  success(res, null, '库存记录已删除');
});

// ==================== SHIPPING UNITS ====================

// GET /api/warehouse/units
router.get('/units', (req, res) => {
  const db = getDb();
  const { status, transportMode, jobNo, warehouseId, keyword } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) { where += ' AND status = ?'; params.push(status); }
  if (transportMode) { where += ' AND transportMode = ?'; params.push(transportMode); }
  if (jobNo) { where += ' AND jobNo = ?'; params.push(jobNo); }
  if (warehouseId) { where += ' AND warehouseId = ?'; params.push(warehouseId); }
  if (keyword) {
    where += ' AND (id LIKE ? OR unitNo LIKE ? OR jobNo LIKE ?)';
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern);
  }

  const rows = db.prepare(`SELECT * FROM shipping_units ${where} ORDER BY createdAt DESC`).all(...params);

  // Add orderIds for each unit
  const data = (rows as any[]).map(u => {
    const subs = db.prepare('SELECT id FROM sub_orders WHERE shippingUnitId = ?').all(u.id) as any[];
    return { ...u, orderIds: subs.map(s => s.id) };
  });

  success(res, data);
});

// GET /api/warehouse/units/:id
router.get('/units/:id', (req, res) => {
  const db = getDb();
  const unit = db.prepare('SELECT * FROM shipping_units WHERE id = ?').get(req.params.id) as any;
  if (!unit) {
    error(res, 'Shipping unit not found', 404);
    return;
  }

  const orders = db.prepare(`
    SELECT
      so.id AS subOrderId,
      so.masterOrderId,
      so.pieces,
      so.weight,
      so.volume,
      so.status,
      so.route,
      so.serviceType,
      so.goodsDescription,
      so.updatedAt,
      mo.customerName,
      mo.salesPerson
    FROM sub_orders so
    LEFT JOIN master_orders mo ON mo.id = so.masterOrderId
    WHERE so.shippingUnitId = ?
    ORDER BY datetime(so.updatedAt) DESC
  `).all(req.params.id) as any[];

  success(res, {
    ...unit,
    orderIds: orders.map((item) => item.subOrderId),
    orders,
  });
});

// POST /api/warehouse/units
router.post('/units', (req, res) => {
  const db = getDb();
  const id = generateId('UNIT');
  const now = new Date().toISOString();

  const {
    unitNo,
    unitType,
    transportMode,
    maxWeight,
    maxVolume,
    sealNo,
    warehouse,
    warehouseId,
    location,
    route,
    jobNo,
    remark,
  } = req.body;

  if (!unitNo || !unitType || !transportMode || !maxWeight || !maxVolume) {
    error(res, 'Missing required fields');
    return;
  }

  db.prepare(`
    INSERT INTO shipping_units (id, unitNo, unitType, transportMode, maxWeight, maxVolume, sealNo, warehouse, warehouseId, location, route, jobNo, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EMPTY', ?, ?, ?)
  `).run(
    id,
    unitNo,
    unitType,
    transportMode,
    maxWeight,
    maxVolume,
    sealNo || null,
    warehouse || null,
    warehouseId || null,
    location || null,
    route || null,
    jobNo || null,
    remark || null,
    now,
    now
  );

  const unit = db.prepare('SELECT * FROM shipping_units WHERE id = ?').get(id);
  success(res, unit);
});

// PUT /api/warehouse/units/:id
router.put('/units/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM shipping_units WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Shipping unit not found', 404); return; }

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'orderIds') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  db.prepare(`UPDATE shipping_units SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const unit = db.prepare('SELECT * FROM shipping_units WHERE id = ?').get(req.params.id);
  success(res, unit);
});

// POST /api/warehouse/units/:id/load
router.post('/units/:id/load', (req, res) => {
  const db = getDb();
  const { subOrderIds } = req.body;
  if (!subOrderIds || !Array.isArray(subOrderIds)) { error(res, 'subOrderIds array is required'); return; }

  const unit = db.prepare('SELECT * FROM shipping_units WHERE id = ?').get(req.params.id) as any;
  if (!unit) { error(res, 'Shipping unit not found', 404); return; }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const subId of subOrderIds) {
      const sub = db.prepare('SELECT id, shippingUnitId, masterOrderId FROM sub_orders WHERE id = ?').get(subId) as any;
      if (!sub) {
        throw new Error(`子订单不存在: ${subId}`);
      }
      if (sub.shippingUnitId && sub.shippingUnitId !== req.params.id) {
        throw new Error(`子订单已装载到其他运输单元: ${subId}`);
      }

      db.prepare('UPDATE sub_orders SET shippingUnitId = ?, status = ?, updatedAt = ? WHERE id = ?')
        .run(req.params.id, 'PACKED', now, subId);

      db.prepare('UPDATE stock_items SET shippingUnitId = ?, status = ? WHERE subOrderNo = ?')
        .run(req.params.id, 'PACKED', subId);

      addSubOrderLog(db, {
        subOrderId: subId,
        status: 'PACKED',
        operator: String(req.body?.operator || 'warehouse'),
        location: unit.location || unit.warehouse || 'CN',
        remark: `装载到运输单元 ${unit.unitNo || unit.id}`,
        timestamp: now,
      });
      if (sub.masterOrderId) {
        syncMasterOrderStatus(db, sub.masterOrderId, now);
      }
    }
    // Update unit stats
    const loaded = db.prepare('SELECT COUNT(*) as c, SUM(pieces) as p, SUM(weight) as w, SUM(volume) as v FROM sub_orders WHERE shippingUnitId = ?')
      .get(req.params.id) as any;
    db.prepare('UPDATE shipping_units SET loadedOrders = ?, loadedPieces = ?, currentWeight = ?, currentVolume = ?, status = ?, updatedAt = ? WHERE id = ?')
      .run(loaded.c, loaded.p || 0, loaded.w || 0, loaded.v || 0, 'LOADING', now, req.params.id);
  });
  try {
    tx();
  } catch (e: any) {
    error(res, e.message || '装载失败');
    return;
  }

  success(res, null, 'Sub orders loaded');
});

// POST /api/warehouse/units/:id/seal
router.post('/units/:id/seal', (req, res) => {
  const db = getDb();
  const { sealNo } = req.body;

  const unit = db.prepare('SELECT * FROM shipping_units WHERE id = ?').get(req.params.id) as any;
  if (!unit) { error(res, 'Shipping unit not found', 404); return; }

  const now = new Date().toISOString();
  db.prepare("UPDATE shipping_units SET status = 'SEALED', sealNo = ?, updatedAt = ? WHERE id = ?")
    .run(sealNo || null, now, req.params.id);

  const updated = db.prepare('SELECT * FROM shipping_units WHERE id = ?').get(req.params.id);
  success(res, updated);
});

// DELETE /api/warehouse/units/:id
router.delete('/units/:id', (req, res) => {
  const db = getDb();
  const unit = db.prepare('SELECT * FROM shipping_units WHERE id = ?').get(req.params.id) as any;
  if (!unit) { error(res, 'Shipping unit not found', 404); return; }

  if (unit.jobNo) {
    error(res, '该运输单元已绑定任务，请先解绑', 400);
    return;
  }

  // Clear references in sub_orders
  db.prepare('UPDATE sub_orders SET shippingUnitId = NULL WHERE shippingUnitId = ?').run(req.params.id);
  db.prepare('DELETE FROM shipping_units WHERE id = ?').run(req.params.id);
  success(res, null, '运输单元删除成功');
});

// ==================== TRANSFERS ====================

// GET /api/warehouse/transfers
router.get('/transfers', (req, res) => {
  const db = getDb();
  const { status, transferType, keyword, businessLine } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status) { where += ' AND status = ?'; params.push(status); }
  if (transferType) { where += ' AND transferType = ?'; params.push(transferType); }
  if (businessLine) { where += ' AND businessLine = ?'; params.push(String(businessLine).toUpperCase()); }
  if (keyword) {
    where += ' AND (id LIKE ? OR transferNo LIKE ? OR fromWarehouse LIKE ? OR toWarehouse LIKE ?)';
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern, pattern);
  }
  if (req.query.warehouseId) {
    where += ' AND (fromWarehouseId = ? OR toWarehouseId = ?)';
    params.push(req.query.warehouseId, req.query.warehouseId);
  }

  const rows = db.prepare(`SELECT * FROM transfer_orders ${where} ORDER BY createdAt DESC`).all(...params);

  // Include items for each transfer
  const data = (rows as any[]).map(t => {
    t.items = db.prepare('SELECT * FROM transfer_items WHERE transferOrderId = ?').all(t.id);
    return t;
  });

  success(res, data);
});

// POST /api/warehouse/transfers
router.post('/transfers', (req, res) => {
  const db = getDb();
  const trfPrefix = String(req.body.transportType || 'SEA').toUpperCase() === 'AIR' ? 'A' : 'S';
  const id = generateId(`${trfPrefix}-T`);
  const transferNo = id;
  const now = new Date().toISOString();

  const {
    fromWarehouse,
    toWarehouse,
    fromWarehouseId,
    toWarehouseId,
    businessLine,
    transferType,
    itemType,
    containerNo,
    reason,
    remark,
    createdBy,
    items
  } = req.body;

  if (!fromWarehouse || !toWarehouse) {
    error(res, 'fromWarehouse and toWarehouse are required');
    return;
  }

  let totalPieces = 0, totalWeight = 0, totalVolume = 0;

  const normalizedBusinessLine = String(businessLine || '').toUpperCase();
  const safeBusinessLine = normalizedBusinessLine === 'SEA' || normalizedBusinessLine === 'AIR'
    ? normalizedBusinessLine
    : null;

  const tx = db.transaction(() => {
    if (items && Array.isArray(items)) {
      for (const item of items) {
        totalPieces += item.pieces || 0;
        totalWeight += item.weight || 0;
        totalVolume += item.volume || 0;
      }
    }

    db.prepare(`
      INSERT INTO transfer_orders (id, transferNo, fromWarehouse, toWarehouse, fromWarehouseId, toWarehouseId, businessLine, transferType, itemType, containerNo, totalPieces, totalWeight, totalVolume, status, reason, remark, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?)
    `).run(id, transferNo, fromWarehouse, toWarehouse, fromWarehouseId || null, toWarehouseId || null,
      safeBusinessLine, transferType || 'ORIGIN', itemType || 'ORDER', containerNo || null,
      totalPieces, totalWeight, totalVolume, reason || null, remark || null, createdBy || null, now, now);

    if (items && Array.isArray(items)) {
      const insertItem = db.prepare(`
        INSERT INTO transfer_items (id, transferOrderId, subOrderNo, trackingNo, goodsName, pieces, weight, volume, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of items) {
        insertItem.run(generateId('TI'), id, item.subOrderNo || null, item.trackingNo || null,
          item.goodsName || null, item.pieces || 0, item.weight || 0, item.volume || 0, item.remark || null);
      }
    }
  });
  tx();

  const transfer = db.prepare('SELECT * FROM transfer_orders WHERE id = ?').get(id) as any;
  transfer.items = db.prepare('SELECT * FROM transfer_items WHERE transferOrderId = ?').all(id);
  success(res, transfer);
});

// PUT /api/warehouse/transfers/:id
router.put('/transfers/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM transfer_orders WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Transfer order not found', 404); return; }

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'transferNo' || key === 'items') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  sets.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  db.prepare(`UPDATE transfer_orders SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const transfer = db.prepare('SELECT * FROM transfer_orders WHERE id = ?').get(req.params.id) as any;
  transfer.items = db.prepare('SELECT * FROM transfer_items WHERE transferOrderId = ?').all(req.params.id);
  success(res, transfer);
});

// ==================== RETURNS ====================

// GET /api/warehouse/returns
router.get('/returns', (req, res) => {
  const db = getDb();
  const { status, businessLine, warehouseId, keyword } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (businessLine) { where += ' AND businessLine = ?'; params.push(String(businessLine).toUpperCase()); }
  if (warehouseId) { where += ' AND warehouseId = ?'; params.push(warehouseId); }
  if (keyword) {
    where += ' AND (returnNo LIKE ? OR orderNo LIKE ? OR trackingNo LIKE ? OR customerName LIKE ? OR route LIKE ?)';
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  const rows = db.prepare(`SELECT * FROM return_records ${where} ORDER BY createdAt DESC`).all(...params);
  (rows as any[]).forEach((r) => { r.photos = parseJsonArray(r.photos); });
  success(res, rows);
});

// GET /api/warehouse/returns/:id
router.get('/returns/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM return_records WHERE id = ?').get(req.params.id) as any;
  if (!row) {
    error(res, 'Return record not found', 404);
    return;
  }
  row.photos = parseJsonArray(row.photos);
  success(res, row);
});

// POST /api/warehouse/returns
router.post('/returns', (req, res) => {
  const db = getDb();
  const id = generateId('R');
  const returnNo = id;
  const now = new Date().toISOString();

  const {
    orderNo,
    trackingNo,
    customerName,
    returnType,
    returnStage,
    reason,
    pieces,
    weight,
    volume,
    applicant,
    photos,
    remark,
    businessLine,
    warehouse,
    warehouseId,
    route,
    serviceType,
    salesPerson
  } = req.body;

  if (!customerName || !returnType || !reason || !pieces || !weight || !applicant) {
    error(res, 'Missing required fields');
    return;
  }

  const normalizedBusinessLine = String(businessLine || '').toUpperCase();
  const safeBusinessLine = normalizedBusinessLine === 'SEA' || normalizedBusinessLine === 'AIR'
    ? normalizedBusinessLine
    : null;

  db.prepare(`
    INSERT INTO return_records
    (id, returnNo, orderNo, trackingNo, businessLine, warehouse, warehouseId, route, serviceType, salesPerson, customerName, returnType, returnStage, status, reason, pieces, weight, volume, applicant, applyTime, photos, remark, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    returnNo,
    orderNo || null,
    trackingNo || null,
    safeBusinessLine,
    warehouse || null,
    warehouseId || null,
    route || null,
    serviceType || null,
    salesPerson || null,
    customerName,
    returnType,
    returnStage || null,
    reason,
    pieces,
    weight,
    volume || 0,
    applicant,
    now,
    photos ? JSON.stringify(photos) : null,
    remark || null,
    now
  );

  const record = db.prepare('SELECT * FROM return_records WHERE id = ?').get(id) as any;
  record.photos = parseJsonArray(record.photos);
  success(res, record);
});

// PUT /api/warehouse/returns/:id
router.put('/returns/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM return_records WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Return record not found', 404); return; }

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id' || key === 'returnNo') continue;
    if (key === 'photos') {
      sets.push('photos = ?');
      params.push(JSON.stringify(value));
    } else {
      sets.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (sets.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE return_records SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  const record = db.prepare('SELECT * FROM return_records WHERE id = ?').get(req.params.id) as any;
  record.photos = parseJsonArray(record.photos);
  success(res, record);
});

// DELETE /api/warehouse/returns/:id
router.delete('/returns/:id', (req, res) => {
  const db = getDb();
  const record = db.prepare('SELECT * FROM return_records WHERE id = ?').get(req.params.id) as any;
  if (!record) {
    error(res, 'Return record not found', 404);
    return;
  }

  if (!['PENDING', 'REJECTED'].includes(String(record.status || '').toUpperCase())) {
    error(res, '仅待处理或已驳回的退运记录允许删除', 400);
    return;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM return_records WHERE id = ?').run(record.id);

    if (record.trackingNo) {
      const relatedStocks = db.prepare(`
        SELECT id, subOrderNo, masterOrderNo
        FROM stock_items
        WHERE trackingNo = ?
          AND status = 'RETURNED'
      `).all(record.trackingNo) as any[];

      for (const stock of relatedStocks) {
        db.prepare(`
          UPDATE stock_items
          SET status = 'IN_STOCK',
              returnReason = NULL,
              returnTime = NULL
          WHERE id = ?
        `).run(stock.id);

        if (stock.subOrderNo) {
          db.prepare("UPDATE sub_orders SET status = 'INBOUND', currentNode = '已入库', updatedAt = ? WHERE id = ?")
            .run(now, stock.subOrderNo);
          addSubOrderLog(db, {
            subOrderId: stock.subOrderNo,
            status: 'INBOUND',
            operator: String(req.body?.operator || 'warehouse'),
            location: record.warehouse || 'CN',
            remark: `删除退运记录 ${record.returnNo}，回退为已入库`,
            timestamp: now,
          });
        }
        if (stock.masterOrderNo) {
          syncMasterOrderStatus(db, stock.masterOrderNo, now);
        }
      }
    }
  });
  tx();

  success(res, null, '退运记录已删除');
});

// ==================== NO ORDER EXPRESS ====================

// GET /api/warehouse/no-order-express
router.get('/no-order-express', (req, res) => {
  const db = getDb();
  const { status, keyword, company, startDate, endDate } = req.query;

  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (company) { where += ' AND (company = ? OR companyName = ?)'; params.push(company, company); }
  if (startDate) { where += ' AND datetime(signTime) >= datetime(?)'; params.push(startDate); }
  if (endDate) { where += ' AND datetime(signTime) <= datetime(?)'; params.push(endDate); }
  if (keyword) {
    where += ' AND (trackingNo LIKE ? OR company LIKE ? OR companyName LIKE ? OR remark LIKE ?)';
    const pattern = `%${keyword}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  const rows = db.prepare(`SELECT * FROM no_order_express ${where} ORDER BY signTime DESC`).all(...params);
  success(res, rows);
});

// GET /api/warehouse/no-order-express/:id
router.get('/no-order-express/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM no_order_express WHERE id = ?').get(req.params.id);
  if (!row) {
    error(res, 'Record not found', 404);
    return;
  }
  success(res, row);
});

// POST /api/warehouse/no-order-express
router.post('/no-order-express', (req, res) => {
  const db = getDb();
  const id = generateId('NOE');
  const { trackingNo, company, companyName, pieces, weight, signOperator, storageLocation, remark } = req.body;

  if (!trackingNo || !company || !companyName || !pieces || !signOperator) {
    error(res, 'Missing required fields');
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO no_order_express (id, trackingNo, company, companyName, pieces, weight, signTime, signOperator, status, storageLocation, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `).run(id, trackingNo, company, companyName, pieces, weight || null, now, signOperator, storageLocation || null, remark || null);

  const record = db.prepare('SELECT * FROM no_order_express WHERE id = ?').get(id);
  success(res, record);
});

// PUT /api/warehouse/no-order-express/:id
router.put('/no-order-express/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM no_order_express WHERE id = ?').get(req.params.id);
  if (!existing) { error(res, 'Record not found', 404); return; }

  const fields = req.body;
  const sets: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'id') continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }

  if (sets.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE no_order_express SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  const record = db.prepare('SELECT * FROM no_order_express WHERE id = ?').get(req.params.id);
  success(res, record);
});

// DELETE /api/warehouse/no-order-express/:id
router.delete('/no-order-express/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id, status FROM no_order_express WHERE id = ?').get(req.params.id) as any;
  if (!existing) {
    error(res, 'Record not found', 404);
    return;
  }

  if (String(existing.status || '').toUpperCase() === 'MATCHED') {
    error(res, '已匹配的记录不允许删除，请先解除关联', 400);
    return;
  }

  db.prepare('DELETE FROM no_order_express WHERE id = ?').run(req.params.id);
  success(res, null, '无订单快递记录已删除');
});

export default router;
