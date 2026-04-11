import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { uuid, generateInboundNo } from '../utils/idGenerator';

const router = Router();

// ============================================================
// 入库管理
// ============================================================

// POST /api/v2/wms/inbounds — 创建入库记录
router.post('/inbounds', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const id = uuid();
  const inboundNo = generateInboundNo();

  db.prepare('INSERT INTO wms_inbound_order (id, inbound_no, business_line, warehouse_id, order_id, sub_order_id, source_type, inbound_status, inbound_at, operator_user_id, remark) VALUES (?,?,?,?,?,?,?,?,datetime("now"),?,?)').run(
    id, inboundNo, b.businessLine || 'SEA', b.warehouseId, b.orderId, b.subOrderId,
    b.sourceType || 'THIRD_PARTY', 'COMPLETED', b.operatorUserId, b.remark
  );

  // Create inbound item
  if (b.trackingNo) {
    const itemId = uuid();
    db.prepare('INSERT INTO wms_inbound_item (id, inbound_order_id, order_id, sub_order_id, tracking_no, pieces, gross_weight_kg, length_cm, width_cm, height_cm, package_condition, location_code, item_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      itemId, id, b.orderId, b.subOrderId, b.trackingNo,
      b.pieces || 1, b.grossWeightKg || 0,
      b.lengthCm, b.widthCm, b.heightCm,
      b.packageCondition || 'GOOD', b.locationCode, 'COMPLETED'
    );
  }

  // Update sub-order status to INBOUND
  if (b.subOrderId) {
    db.prepare("UPDATE oms_sub_order SET sub_status='INBOUND', updated_at=datetime('now') WHERE id=?").run(b.subOrderId);
  }

  res.json({ data: { id, inboundNo } });
});

// GET /api/warehouse/inbound — 入库记录列表
router.get('/inbound', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT io.*, ii.tracking_no, ii.pieces as item_pieces, ii.gross_weight_kg, ii.package_condition, ii.location_code
    FROM wms_inbound_order io
    LEFT JOIN wms_inbound_item ii ON ii.inbound_order_id = io.id
    ORDER BY io.created_at DESC
  `).all();
  res.json({ data: rows });
});

// ============================================================
// 库存管理
// ============================================================

// GET /api/warehouse/stock
router.get('/stock', (req: Request, res: Response) => {
  const db = getDb();
  const { status, warehouseId, keyword } = req.query;
  let sql = `SELECT s.*, o.order_no, o.customer_name, o.route_code, o.consignee_name,
    so.sub_order_no, so.sub_status
    FROM wms_stock s
    LEFT JOIN oms_order o ON o.id = s.order_id
    LEFT JOIN oms_sub_order so ON so.id = s.sub_order_id
    WHERE 1=1`;
  const params: any[] = [];

  if (status) { sql += ' AND s.stock_status = ?'; params.push(status); }
  if (warehouseId) { sql += ' AND s.warehouse_id = ?'; params.push(warehouseId); }
  if (keyword) {
    sql += ' AND (o.order_no LIKE ? OR o.customer_name LIKE ? OR so.sub_order_no LIKE ?)';
    const k = `%${keyword}%`;
    params.push(k, k, k);
  }

  sql += ' ORDER BY s.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// ============================================================
// 集装箱/装箱单元
// ============================================================

// GET /api/warehouse/units
router.get('/units', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tms_shipping_unit ORDER BY created_at DESC').all();
  res.json({ data: rows });
});

// POST /api/warehouse/units
router.post('/units', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  db.prepare('INSERT INTO tms_shipping_unit (id, unit_no, business_line, unit_type, container_type, warehouse_id, job_id, route_code, unit_status, max_weight_kg, max_volume_cbm) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    id, b.unitNo, b.businessLine || 'SEA', b.unitType || 'CONTAINER',
    b.containerType, b.warehouseId, b.jobId, b.routeCode,
    'EMPTY', b.maxWeightKg || 0, b.maxVolumeCbm || 0
  );
  res.json({ data: { id } });
});

// ============================================================
// 调拨管理
// ============================================================

// GET /api/warehouse/transfers
router.get('/transfers', (req: Request, res: Response) => {
  const db = getDb();
  const { status, direction } = req.query;
  let sql = 'SELECT * FROM wms_transfer WHERE 1=1';
  const params: any[] = [];

  if (status) { sql += ' AND transfer_status = ?'; params.push(status); }
  if (direction) { sql += ' AND direction = ?'; params.push(direction); }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// POST /api/warehouse/transfers
router.post('/transfers', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  const transferNo = `S-T-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

  db.prepare('INSERT INTO wms_transfer (id, transfer_no, business_line, direction, from_warehouse_name, to_warehouse_name, route_label, total_pieces, total_weight_kg, transfer_status, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    id, transferNo, b.businessLine || 'SEA', b.direction,
    b.fromWarehouseName, b.toWarehouseName, b.routeLabel,
    b.totalPieces || 0, b.totalWeightKg || 0,
    'PENDING', b.remark
  );
  res.json({ data: { id, transferNo } });
});

// PUT /api/warehouse/transfers/:id
router.put('/transfers/:id', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const sets: string[] = [];
  const vals: any[] = [];

  const fieldMap: Record<string, string> = {
    transferStatus: 'transfer_status', logisticsCompany: 'logistics_company',
    trackingNo: 'tracking_no', queryPhone: 'query_phone', driverName: 'driver_name',
    driverPhone: 'driver_phone', plateNo: 'plate_no', dispatchTime: 'dispatch_time',
    arrivalTime: 'arrival_time', receiveTime: 'receive_time', remark: 'remark',
  };

  for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
    if (b[jsKey] !== undefined) { sets.push(`${dbKey} = ?`); vals.push(b[jsKey]); }
  }
  // Also accept snake_case directly
  for (const [k, v] of Object.entries(b)) {
    if (k.includes('_') && v !== undefined && !vals.includes(v)) {
      sets.push(`${k} = ?`); vals.push(v);
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    vals.push(req.params.id);
    db.prepare(`UPDATE wms_transfer SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  res.json({ data: { id: req.params.id } });
});

// ============================================================
// 无单快递
// ============================================================

// GET /api/warehouse/no-order-express (also /api/no-order-express)
router.get('/no-order-express', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM wms_unmatched_package ORDER BY created_at DESC').all();
  res.json({ data: rows });
});

// POST /api/warehouse/no-order-express
router.post('/no-order-express', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  db.prepare('INSERT INTO wms_unmatched_package (id, business_line, warehouse_id, tracking_no, express_company, sender_name, sender_phone, pieces, gross_weight_kg, customer_hint, goods_name, location_code, status, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    id, b.businessLine || 'SEA', b.warehouseId, b.trackingNo, b.expressCompany,
    b.senderName, b.senderPhone, b.pieces || 1, b.grossWeightKg || 0,
    b.customerHint, b.goodsName, b.locationCode, 'PENDING', b.remark
  );
  res.json({ data: { id } });
});

// ============================================================
// 退运
// ============================================================

router.get('/returns', (req: Request, res: Response) => {
  res.json({ data: [] });
});

export default router;
