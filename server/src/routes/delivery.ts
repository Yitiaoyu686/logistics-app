import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { uuid, generateDpnNo, generatePickupNo } from '../utils/idGenerator';

const router = Router();

// ============================================================
// DPN 管理
// ============================================================

// GET /api/v2/pod/dpns
router.get('/dpns', (req: Request, res: Response) => {
  const db = getDb();
  const { status, keyword } = req.query;
  let sql = 'SELECT * FROM pod_dpn WHERE 1=1';
  const params: any[] = [];

  if (status) { sql += ' AND dpn_status = ?'; params.push(status); }
  if (keyword) {
    sql += ' AND (dpn_no LIKE ? OR from_site LIKE ? OR to_site LIKE ?)';
    const k = `%${keyword}%`;
    params.push(k, k, k);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// GET /api/v2/pod/dpns/:id
router.get('/dpns/:id', (req: Request, res: Response) => {
  const db = getDb();
  const dpn = db.prepare('SELECT * FROM pod_dpn WHERE id = ? OR dpn_no = ?').get(req.params.id, req.params.id) as any;
  if (!dpn) { res.status(404).json({ error: 'DPN not found' }); return; }

  const items = db.prepare('SELECT * FROM pod_dpn_item WHERE dpn_id = ?').all(dpn.id);
  const tasks = db.prepare('SELECT * FROM pod_delivery_task WHERE dpn_id = ?').all(dpn.id);

  res.json({ data: { ...dpn, items, tasks } });
});

// POST /api/v2/pod/dpns — 创建DPN
const ALLOWED_DELIVERY_METHODS = new Set(['DELIVERY', 'SELF_PICKUP', 'SATELLITE_STATION']);
const ALLOWED_DPN_TYPES = new Set(['DELIVERY', 'TRANSFER']);

router.post('/dpns', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  const dpnNo = generateDpnNo();

  const dpnType = ALLOWED_DPN_TYPES.has(b.dpnType) ? b.dpnType : 'DELIVERY';
  const deliveryMethod = ALLOWED_DELIVERY_METHODS.has(b.deliveryMethod) ? b.deliveryMethod : 'DELIVERY';

  db.prepare('INSERT INTO pod_dpn (id, dpn_no, business_line, dpn_type, from_site, to_site, delivery_method, dpn_status, total_orders, total_pieces, total_weight_kg, remark, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    id, dpnNo, b.businessLine || 'SEA', dpnType,
    b.fromSite, b.toSite, deliveryMethod, 'PENDING_BIND',
    0, 0, 0, b.remark, b.createdBy
  );
  res.json({ data: { id, dpnNo } });
});

// GET /api/v2/pod/dpns/:id/items — 获取 DPN 绑定的运单（含入库状态）
router.get('/dpns/:id/items', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT di.*, so.sub_order_no, so.pieces AS so_pieces, so.actual_weight_kg,
      o.order_no, o.customer_name
    FROM pod_dpn_item di
    LEFT JOIN oms_sub_order so ON so.id = di.sub_order_id
    LEFT JOIN oms_order o ON o.id = so.order_id
    WHERE di.dpn_id = ?
    ORDER BY di.created_at
  `).all(req.params.id);
  res.json({ data: rows });
});

// POST /api/v2/pod/dpns/:id/scan-receive — 扫码逐件确认入库
router.post('/dpns/:id/scan-receive', (req: Request, res: Response) => {
  const db = getDb();
  const dpnId = req.params.id;
  const { code, method } = req.body as { code?: string; method?: 'SCAN' | 'MANUAL' };
  if (!code) { res.status(400).json({ error: 'code required' }); return; }

  // 查找匹配的 pod_dpn_item（按 tracking_no 或关联的 sub_order_no）
  const item = db.prepare(`
    SELECT di.*
    FROM pod_dpn_item di
    LEFT JOIN oms_sub_order so ON so.id = di.sub_order_id
    WHERE di.dpn_id = ?
      AND (di.tracking_no = ? OR so.sub_order_no = ?)
  `).get(dpnId, code, code) as any;

  if (!item) { res.status(404).json({ error: 'Not in DPN' }); return; }
  if (item.inbound_status === 'RECEIVED') {
    res.json({ data: { id: item.id, alreadyReceived: true } });
    return;
  }

  db.prepare("UPDATE pod_dpn_item SET inbound_status='RECEIVED', inbound_method=?, inbound_time=datetime('now') WHERE id=?")
    .run(method || 'SCAN', item.id);

  // 如果该 DPN 全部入库，更新 DPN 状态
  const remaining = (db.prepare("SELECT COUNT(*) c FROM pod_dpn_item WHERE dpn_id=? AND (inbound_status IS NULL OR inbound_status='PENDING')").get(dpnId) as any).c;
  if (remaining === 0) {
    db.prepare("UPDATE pod_dpn SET dpn_status='INBOUND', updated_at=datetime('now') WHERE id=?").run(dpnId);
  }
  res.json({ data: { id: item.id, remaining } });
});

// POST /api/v2/pod/dpns/:id/bind-sub-orders — 绑定运单
router.post('/dpns/:id/bind-sub-orders', (req: Request, res: Response) => {
  const db = getDb();
  const dpnId = req.params.id;
  const { subOrderIds } = req.body;

  for (const subOrderId of (subOrderIds || [])) {
    const itemId = uuid();
    db.prepare('INSERT INTO pod_dpn_item (id, dpn_id, sub_order_id) VALUES (?, ?, ?)').run(itemId, dpnId, subOrderId);
  }

  // Update totals
  const count = (db.prepare('SELECT COUNT(*) as c FROM pod_dpn_item WHERE dpn_id = ?').get(dpnId) as any).c;
  db.prepare("UPDATE pod_dpn SET total_orders = ?, dpn_status = 'PENDING_DISPATCH', updated_at = datetime('now') WHERE id = ?").run(count, dpnId);

  res.json({ data: { success: true } });
});

// PUT /api/v2/pod/dpns/:id — 更新DPN（执行发车等）
const ALLOWED_DPN_STATUSES = new Set([
  'DRAFT', 'PENDING_BIND', 'PENDING_DISPATCH', 'IN_TRANSIT', 'ARRIVED',
  'PENDING_INBOUND', 'INBOUND', 'DELIVERED', 'SIGNED', 'CANCELLED',
]);

router.put('/dpns/:id', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const sets: string[] = [];
  const vals: any[] = [];

  const fieldMap: Record<string, string> = {
    dpnStatus: 'dpn_status', logisticsCompany: 'logistics_company',
    logisticsCompanyId: 'logistics_company_id',
    trackingNo: 'tracking_no', shippingNo: 'shipping_no',
    queryPhone: 'query_phone', trackPhone: 'query_phone',
    trackUrl: 'track_url',
    driverName: 'driver_name', driverPhone: 'driver_phone',
    plateNo: 'plate_no', dispatchTime: 'dispatch_time',
    arrivalTime: 'arrival_time', remark: 'remark',
  };

  const incomingStatus = b.dpnStatus ?? b.dpn_status;
  if (incomingStatus !== undefined && !ALLOWED_DPN_STATUSES.has(incomingStatus)) {
    res.status(400).json({ error: `dpn_status invalid: ${incomingStatus}` });
    return;
  }

  for (const [jsKey, dbKey] of Object.entries(fieldMap)) {
    if (b[jsKey] !== undefined) { sets.push(`${dbKey} = ?`); vals.push(b[jsKey]); }
  }
  for (const [k, v] of Object.entries(b)) {
    if (k.includes('_') && v !== undefined) {
      const exists = sets.some(s => s.startsWith(k));
      if (!exists) { sets.push(`${k} = ?`); vals.push(v); }
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    vals.push(req.params.id);
    db.prepare(`UPDATE pod_dpn SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }

  // 发车后(填了 driver 或 dispatch_time,或状态置为 DISPATCHED/IN_TRANSIT),
  // 为每个已绑运单自动派生一条 pod_delivery_task(若尚未生成)
  const dpn = db.prepare('SELECT * FROM pod_dpn WHERE id = ?').get(req.params.id) as any;
  const hasDispatched = dpn && (dpn.dispatch_time || dpn.driver_name || ['DISPATCHED','IN_TRANSIT','ARRIVED','COMPLETED','SIGNED'].includes(dpn.dpn_status));
  if (hasDispatched && dpn.dpn_type === 'DELIVERY') {
    const items = db.prepare(`
      SELECT di.sub_order_id, so.sub_order_no,
             o.consignee_name, o.consignee_phone, o.consignee_address,
             o.payment_method
      FROM pod_dpn_item di
      LEFT JOIN oms_sub_order so ON so.id = di.sub_order_id
      LEFT JOIN oms_order o ON o.id = so.order_id
      WHERE di.dpn_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM pod_delivery_task dt
          WHERE dt.dpn_id = di.dpn_id AND dt.sub_order_no = so.sub_order_no
        )
    `).all(req.params.id) as any[];
    const taskInsert = db.prepare(
      `INSERT INTO pod_delivery_task (
        id, dpn_id, task_no, sub_order_no,
        recipient_name, recipient_phone, recipient_address,
        service_type, payment_method, payment_status,
        task_status, driver_name, driver_phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DELIVERY', ?, ?, 'PENDING', ?, ?, datetime('now'), datetime('now'))`
    );
    for (const it of items) {
      const tid = uuid();
      taskInsert.run(
        tid, req.params.id, `DT-${dpn.dpn_no}-${tid.slice(-4)}`, it.sub_order_no || null,
        it.consignee_name, it.consignee_phone, it.consignee_address,
        it.payment_method || null, 'UNPAID',
        dpn.driver_name || null, dpn.driver_phone || null
      );
    }
  }

  res.json({ data: { id: req.params.id } });
});

// ============================================================
// 配送任务
// ============================================================

// GET /api/v2/pod/delivery-tasks
router.get('/delivery-tasks', (req: Request, res: Response) => {
  const db = getDb();
  const { status, keyword } = req.query;
  let sql = `SELECT dt.*, d.dpn_no, d.from_site, d.to_site, d.business_line
    FROM pod_delivery_task dt
    LEFT JOIN pod_dpn d ON d.id = dt.dpn_id WHERE 1=1`;
  const params: any[] = [];

  if (status) { sql += ' AND dt.task_status = ?'; params.push(status); }
  if (keyword) {
    sql += ' AND (dt.task_no LIKE ? OR d.dpn_no LIKE ? OR dt.recipient_name LIKE ? OR dt.recipient_phone LIKE ?)';
    const k = `%${keyword}%`;
    params.push(k, k, k, k);
  }

  sql += ' ORDER BY dt.created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// POST /api/v2/pod/delivery-tasks/:id/sign — 配送签收
router.post('/delivery-tasks/:id/sign', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const signPhotoUrls = b.signPhotoUrls || b.photoUrls || [];
  db.prepare("UPDATE pod_delivery_task SET task_status='SIGNED', signed_by=?, signed_at=datetime('now'), sign_photo_urls=?, remark=?, updated_at=datetime('now') WHERE id=?").run(
    b.signedBy, JSON.stringify(signPhotoUrls), b.remark, req.params.id
  );

  const task = db.prepare('SELECT * FROM pod_delivery_task WHERE id = ?').get(req.params.id) as any;
  if (task) {
    // 联动更新子单 → DELIVERED,主单 → DELIVERED(如果全部子单都到)
    if (task.sub_order_no) {
      const sub = db.prepare('SELECT id, order_id FROM oms_sub_order WHERE sub_order_no = ?').get(task.sub_order_no) as any;
      if (sub) {
        db.prepare("UPDATE oms_sub_order SET sub_status='DELIVERED', updated_at=datetime('now') WHERE id=?").run(sub.id);
        db.prepare("UPDATE wms_stock SET stock_status='OUTBOUND', updated_at=datetime('now') WHERE sub_order_id=?").run(sub.id);

        // 主单联动: 全部子单都 DELIVERED 才升级
        const remaining = (db.prepare(
          "SELECT COUNT(*) as c FROM oms_sub_order WHERE order_id=? AND sub_status != 'DELIVERED'"
        ).get(sub.order_id) as any).c;
        if (remaining === 0) {
          db.prepare("UPDATE oms_order SET order_status='DELIVERED', updated_at=datetime('now') WHERE id=?").run(sub.order_id);
        }
      }
    }

    // DPN 状态: 全部 task 都签收才置 COMPLETED, 否则 IN_TRANSIT 保持
    const pending = (db.prepare(
      "SELECT COUNT(*) as c FROM pod_delivery_task WHERE dpn_id=? AND task_status NOT IN ('SIGNED','FAILED')"
    ).get(task.dpn_id) as any).c;
    const dpnStatus = pending === 0 ? 'COMPLETED' : 'IN_TRANSIT';
    db.prepare("UPDATE pod_dpn SET dpn_status=?, updated_at=datetime('now') WHERE id=?").run(dpnStatus, task.dpn_id);
  }

  res.json({ data: { success: true } });
});

// POST /api/v2/pod/delivery-tasks/:id/fail — 配送失败
router.post('/delivery-tasks/:id/fail', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  db.prepare("UPDATE pod_delivery_task SET task_status='FAILED', failure_reason=?, remark=?, updated_at=datetime('now') WHERE id=?").run(
    b.failureReason || b.reason, b.remark, req.params.id
  );
  res.json({ data: { success: true } });
});

// ============================================================
// 自提管理
// ============================================================

// GET /api/pickups
router.get('/pickups', (req: Request, res: Response) => {
  const db = getDb();
  const { station, notifyStatus } = req.query;
  let sql = 'SELECT * FROM pod_pickup WHERE 1=1';
  const params: any[] = [];

  if (station) { sql += ' AND pickup_station = ?'; params.push(station); }
  if (notifyStatus) { sql += ' AND notify_status = ?'; params.push(notifyStatus); }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// PUT /api/pickups/:id/notify — 通知自提
router.put('/pickups/:id/notify', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE pod_pickup SET notify_status='NOTIFIED', notified_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ data: { success: true } });
});

// PUT /api/pickups/:id/complete — 核销自提
router.put('/pickups/:id/complete', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE pod_pickup SET notify_status='PICKED_UP', picked_up_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ data: { success: true } });
});

export default router;
