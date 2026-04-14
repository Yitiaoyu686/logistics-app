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
router.post('/dpns', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  const dpnNo = generateDpnNo();

  db.prepare('INSERT INTO pod_dpn (id, dpn_no, business_line, dpn_type, from_site, to_site, dpn_status, total_orders, total_pieces, total_weight_kg, remark, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
    id, dpnNo, b.businessLine || 'SEA', b.dpnType || 'DELIVERY',
    b.fromSite, b.toSite, 'PENDING_BIND',
    0, 0, 0, b.remark, b.createdBy
  );
  res.json({ data: { id, dpnNo } });
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
  db.prepare("UPDATE pod_delivery_task SET task_status='SIGNED', signed_by=?, signed_at=datetime('now'), sign_photo_urls=?, remark=?, updated_at=datetime('now') WHERE id=?").run(
    b.signedBy, JSON.stringify(b.signPhotoUrls || []), b.remark, req.params.id
  );

  // Update DPN status
  const task = db.prepare('SELECT dpn_id FROM pod_delivery_task WHERE id = ?').get(req.params.id) as any;
  if (task) {
    db.prepare("UPDATE pod_dpn SET dpn_status='SIGNED', updated_at=datetime('now') WHERE id=?").run(task.dpn_id);
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
