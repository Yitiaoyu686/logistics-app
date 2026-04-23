/**
 * 兼容路由 — 为 Web 端遗留接口提供别名/最简实现
 * 目的是让 Demo 场景覆盖到的 Web 页面都能正常加载
 * 这里的接口都是 Demo 级别的最简实现，聚焦返回 200 + 可用数据，不做完整业务逻辑
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import {
  createUiFee,
  updateUiFee,
  approveFee,
  rejectFee,
  payFee,
  cancelFee,
  bootstrapFees,
  listUiFees,
  getUiFee,
  getFeeCoverage,
  recordPayment,
} from '../database/feeRepo';
import { bindSubOrders, sealUnit, advanceNode, unbindSubOrder } from '../database/jobRepo';

const router = Router();

// ============================================================
// 旧版订单接口 (Web 端部分页面仍在调用 /orders/master 等)
// ============================================================

// GET /api/orders/master — 旧版主单列表（等价于 /v2/oms/orders）
router.get('/orders/master', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.*, (SELECT COUNT(*) FROM oms_sub_order so WHERE so.order_id = o.id) as sub_order_count
    FROM oms_order o
    ORDER BY o.created_at DESC
  `).all();
  res.json({ data: rows });
});

// GET /api/orders/master/:id — 旧版主单详情
router.get('/orders/master/:id', (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM oms_order WHERE id = ? OR order_no = ?').get(req.params.id, req.params.id);
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
  res.json({ data: order });
});

// GET /api/orders/sub — 旧版子单列表
router.get('/orders/sub', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT so.*, o.order_no as parent_order_no, o.customer_name
    FROM oms_sub_order so
    LEFT JOIN oms_order o ON o.id = so.order_id
    ORDER BY so.created_at DESC
  `).all();
  res.json({ data: rows });
});

// GET /api/orders/sub/:id
router.get('/orders/sub/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM oms_sub_order WHERE id = ? OR sub_order_no = ?').get(req.params.id, req.params.id);
  if (!row) { res.status(404).json({ error: 'Sub order not found' }); return; }
  res.json({ data: row });
});

// GET /api/orders/search?q=
router.get('/orders/search', (req: Request, res: Response) => {
  const db = getDb();
  const q = String(req.query.q || '').trim();
  if (!q) { res.json({ data: [] }); return; }
  const k = `%${q}%`;
  const rows = db.prepare(`
    SELECT o.id, o.order_no, o.customer_name, o.order_status, o.route_code,
      (SELECT so.sub_order_no FROM oms_sub_order so WHERE so.order_id = o.id LIMIT 1) as sample_sub_no
    FROM oms_order o
    WHERE o.order_no LIKE ? OR o.customer_name LIKE ? OR o.warehouse_entry_no LIKE ?
       OR EXISTS (SELECT 1 FROM oms_sub_order so WHERE so.order_id = o.id AND so.sub_order_no LIKE ?)
    ORDER BY o.created_at DESC LIMIT 50
  `).all(k, k, k, k);
  res.json({ data: rows });
});

// ============================================================
// 配送 (旧版 alias)
// ============================================================

// GET /api/delivery — 等价于 /v2/pod/delivery-tasks
router.get('/delivery', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT dt.*, d.dpn_no, d.from_site, d.to_site
    FROM pod_delivery_task dt
    LEFT JOIN pod_dpn d ON d.id = dt.dpn_id
    ORDER BY dt.created_at DESC
  `).all();
  res.json({ data: rows });
});

// ============================================================
// 无单快递 (别名)
// ============================================================

// GET /api/v2/wms/unmatched-packages
router.get('/v2/wms/unmatched-packages', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM wms_unmatched_package ORDER BY created_at DESC').all();
  res.json({ data: rows });
});

// GET /api/no-order-express (顶级别名)
router.get('/no-order-express', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM wms_unmatched_package ORDER BY created_at DESC').all();
  res.json({ data: rows });
});

// ============================================================
// DPN 候选运单 (在到达国+已入库+未绑定的子单)
// ============================================================

// GET /api/v2/pod/dpn-candidates
router.get('/v2/pod/dpn-candidates', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT so.*, o.order_no, o.customer_name, o.consignee_name, o.consignee_phone, o.consignee_address
    FROM oms_sub_order so
    LEFT JOIN oms_order o ON o.id = so.order_id
    WHERE so.sub_status IN ('ARRIVED','INBOUND','PENDING_DELIVERY')
      AND NOT EXISTS (SELECT 1 FROM pod_dpn_item di WHERE di.sub_order_id = so.id)
    ORDER BY so.created_at DESC
  `).all();
  res.json({ data: rows });
});

// ============================================================
// 财务费用
// ============================================================

// GET /api/fees — UI 形状的费用列表;支持 ?id=xxx 返回单条
router.get('/fees', (req: Request, res: Response) => {
  const db = getDb();
  const id = (req.query.id as string) || '';
  if (id) {
    const one = getUiFee(db, id);
    res.json({ data: one ? [one] : [] });
    return;
  }
  res.json({ data: listUiFees(db) });
});

// GET /api/fees/coverage — 费用覆盖率统计(UI 形状)
router.get('/fees/coverage', (_req: Request, res: Response) => {
  const db = getDb();
  res.json({ data: getFeeCoverage(db) });
});

// ============================================================
// 销售工作台
// ============================================================

// GET /api/sales/dashboard
router.get('/sales/dashboard', (req: Request, res: Response) => {
  const db = getDb();
  const salesId = req.query.salesId as string;

  const where = salesId ? 'WHERE sales_user_id = ?' : '';
  const params = salesId ? [salesId] : [];

  const totalOrders = (db.prepare(`SELECT COUNT(*) as c FROM oms_order ${where}`).get(...params) as any).c;
  const pendingInbound = (db.prepare(`SELECT COUNT(*) as c FROM oms_order ${where ? where + ' AND' : 'WHERE'} order_status = 'PENDING_INBOUND'`).get(...params) as any).c;
  const inTransit = (db.prepare(`SELECT COUNT(*) as c FROM oms_order ${where ? where + ' AND' : 'WHERE'} order_status IN ('DEPARTED','IN_TRANSIT')`).get(...params) as any).c;
  const delivered = (db.prepare(`SELECT COUNT(*) as c FROM oms_order ${where ? where + ' AND' : 'WHERE'} order_status = 'DELIVERED'`).get(...params) as any).c;

  const customers = (db.prepare(`SELECT COUNT(*) as c FROM crm_customer ${salesId ? "WHERE owner_user_id = ?" : ''}`).get(...params) as any).c;

  res.json({
    data: {
      totalOrders, pendingInbound, inTransit, delivered,
      customers,
      monthlyNewCustomers: 0,
      commission: 0,
    },
  });
});

// GET /api/sales/pending-payments
router.get('/sales/pending-payments', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.id, o.order_no, o.customer_name, o.total_receivable_amount, o.total_paid_amount, o.created_at
    FROM oms_order o
    WHERE o.payment_status = 'UNPAID' OR o.payment_status = 'PARTIAL'
    ORDER BY o.created_at DESC LIMIT 20
  `).all();
  res.json({ data: rows });
});

// GET /api/sales/quotes
router.get('/sales/quotes', (_req: Request, res: Response) => {
  // 报价记录未实现数据表，返回空数组
  res.json({ data: [] });
});

// POST /api/sales/reminders — 催款
router.post('/sales/reminders', (req: Request, res: Response) => {
  res.json({ data: { success: true, id: `reminder-${Date.now()}` } });
});

// GET /api/sales/reminders/:paymentId
router.get('/sales/reminders/:paymentId', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

// ============================================================
// 通知 (消息中心列表，Web 端)
// ============================================================

// GET /api/notifications — 顶级别名，复用 /system/notifications 逻辑
router.get('/notifications', (_req: Request, res: Response) => {
  const db = getDb();
  // 与 system.ts 中的实现保持一致，这里只返回最近 20 条
  const items: any[] = [];

  const arrivedJobs = db.prepare("SELECT * FROM tms_job WHERE job_status = 'ARRIVED' ORDER BY ata DESC, created_at DESC LIMIT 5").all() as any[];
  for (const j of arrivedJobs) {
    items.push({
      id: `job-arrived-${j.id}`,
      title: '任务已到港',
      content: `${j.job_no} 已抵达 ${j.dest_port}`,
      time: j.ata || j.updated_at || j.created_at,
      read: false,
      type: 'BUSINESS',
    });
  }

  const pendingOrders = db.prepare("SELECT * FROM oms_order WHERE order_status = 'PENDING_INBOUND' ORDER BY created_at DESC LIMIT 5").all() as any[];
  for (const o of pendingOrders) {
    items.push({
      id: `order-pending-${o.id}`,
      title: '新订单待入库',
      content: `${o.order_no} · ${o.customer_name}`,
      time: o.created_at,
      read: false,
      type: 'BUSINESS',
    });
  }

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  res.json({ data: items });
});

// PUT /api/notifications/:id/read — 标记已读
router.put('/notifications/:id/read', (_req: Request, res: Response) => {
  res.json({ data: { success: true } });
});

// POST /api/notifications — 创建通知
router.post('/notifications', (_req: Request, res: Response) => {
  res.json({ data: { id: `n-${Date.now()}`, success: true } });
});

// ============================================================
// 客户详情相关 GET 接口
// ============================================================

// GET /api/v2/oms/customers/:id/line-profiles
router.get('/v2/oms/customers/:id/line-profiles', (_req: Request, res: Response) => {
  // Demo: 返回空数组，UI 会显示"无线路档案"
  res.json({ data: [] });
});

// GET /api/v2/oms/customers/:id/pool-logs — 客户公海池日志
router.get('/v2/oms/customers/:id/pool-logs', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

// PUT /api/v2/oms/customers/:id/line-profiles/:businessLine
router.put('/v2/oms/customers/:id/line-profiles/:businessLine', (_req: Request, res: Response) => {
  res.json({ data: { success: true } });
});

// ============================================================
// 仓库相关 GET 详情
// ============================================================

// GET /api/warehouse/inbound/:id
router.get('/warehouse/inbound/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT io.*, ii.tracking_no, ii.pieces as item_pieces, ii.gross_weight_kg,
      ii.length_cm, ii.width_cm, ii.height_cm, ii.package_condition, ii.location_code
    FROM wms_inbound_order io
    LEFT JOIN wms_inbound_item ii ON ii.inbound_order_id = io.id
    WHERE io.id = ? OR io.inbound_no = ?
    LIMIT 1
  `).get(req.params.id, req.params.id);
  if (!row) { res.json({ data: null }); return; }
  res.json({ data: row });
});

// GET /api/warehouse/stock/:subOrderNo — 按子单号查库存
router.get('/warehouse/stock/:subOrderNo', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT s.*, o.order_no, o.customer_name, so.sub_order_no
    FROM wms_stock s
    LEFT JOIN oms_sub_order so ON so.id = s.sub_order_id
    LEFT JOIN oms_order o ON o.id = s.order_id
    WHERE so.sub_order_no = ? OR s.id = ?
    LIMIT 1
  `).get(req.params.subOrderNo, req.params.subOrderNo);
  if (!row) { res.json({ data: null }); return; }
  res.json({ data: row });
});

// GET /api/warehouse/stock/item/:id
router.get('/warehouse/stock/item/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM wms_stock WHERE id = ?').get(req.params.id);
  res.json({ data: row || null });
});

// GET /api/warehouse/units/:id
router.get('/warehouse/units/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tms_shipping_unit WHERE id = ? OR unit_no = ?').get(req.params.id, req.params.id);
  res.json({ data: row || null });
});

// GET /api/warehouse/returns (list) + detail
router.get('/warehouse/returns', (_req: Request, res: Response) => {
  res.json({ data: [] });
});
router.get('/warehouse/returns/:id', (_req: Request, res: Response) => {
  res.json({ data: null });
});

// GET /api/warehouse/no-order-express/:id
router.get('/warehouse/no-order-express/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM wms_unmatched_package WHERE id = ?').get(req.params.id);
  res.json({ data: row || null });
});

// GET /api/v2/wms/unmatched-packages/:id/recommendations — 智能匹配推荐
router.get('/v2/wms/unmatched-packages/:id/recommendations', (_req: Request, res: Response) => {
  // Demo: 返回所有 PENDING_INBOUND 订单作为候选
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.id, o.order_no, o.customer_name, o.total_declared_pieces, o.total_declared_weight_kg
    FROM oms_order o WHERE o.order_status = 'PENDING_INBOUND' LIMIT 10
  `).all();
  res.json({ data: rows });
});

// ============================================================
// 系统管理 GET 扩展
// ============================================================

// GET /api/system/warehouses/:id
router.get('/system/warehouses/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM md_warehouse WHERE id = ?').get(req.params.id);
  res.json({ data: row || null });
});

// GET /api/system/warehouses/user/:userId
router.get('/system/warehouses/user/:userId', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM md_warehouse ORDER BY created_at').all();
  res.json({ data: rows });
});

// GET /api/system/user-sites/:userId
router.get('/system/user-sites/:userId', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

// GET /api/system/rbac/users/:userId/roles
router.get('/system/rbac/users/:userId/roles', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.* FROM sys_role r
    JOIN sys_user_role ur ON ur.role_id = r.id
    WHERE ur.user_id = ?
  `).all(req.params.userId);
  res.json({ data: rows });
});

// GET /api/system/freight-rates
router.get('/system/freight-rates', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

// GET /api/system/base-data
router.get('/system/base-data', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

// GET /api/system/base-data/options
router.get('/system/base-data/options', (_req: Request, res: Response) => {
  res.json({ data: {} });
});

// ============================================================
// 财务 commission
// ============================================================

// GET /api/finance/commission/rules
router.get('/finance/commission/rules', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

// GET /api/finance/commission/bonus
router.get('/finance/commission/bonus', (_req: Request, res: Response) => {
  res.json({ data: { baseBonus: 0, rules: [] } });
});

// ============================================================
// 写操作 stub — 统一返回 success
// 这些接口 Demo 场景下不强制做完整实现，只需 UI 调用时不报错
// ============================================================

const stubSuccess = (_req: Request, res: Response) => {
  res.json({ data: { success: true, id: `stub-${Date.now()}` } });
};

// 订单
router.post('/v2/oms/orders/:id/approve-return', stubSuccess);
router.post('/v2/oms/orders/:id/reject-return', stubSuccess);
router.put('/v2/oms/orders/:id', stubSuccess);
router.post('/v2/oms/customers/:id/claim', stubSuccess);
router.post('/v2/oms/customers/:id/release', stubSuccess);
router.post('/v2/oms/customers/:id/transfer', stubSuccess);

// 入库 / 库存 / 装箱 / 调拨 / 退运 / 无单 写操作
router.post('/warehouse/inbound/:id/cancel', stubSuccess);
router.put('/warehouse/inbound/:id', stubSuccess);
router.delete('/warehouse/inbound/:id', stubSuccess);
router.put('/warehouse/stock/:id', stubSuccess);
router.put('/warehouse/stock/:id/status', stubSuccess);
router.post('/warehouse/stock/:id/return', stubSuccess);
router.delete('/warehouse/stock/:id', stubSuccess);
// 装箱: 把一批子单装入 unit
router.post('/warehouse/units/:id/load', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const unitId = req.params.id;
    const { subOrderIds } = (req.body || {}) as { subOrderIds?: string[] };
    if (!Array.isArray(subOrderIds) || subOrderIds.length === 0) {
      res.status(400).json({ error: '缺少 subOrderIds' });
      return;
    }
    const unit = db.prepare('SELECT id, job_id FROM tms_shipping_unit WHERE id = ? OR unit_no = ?')
      .get(unitId, unitId) as any;
    if (!unit) {
      res.status(404).json({ error: '集装单元不存在' });
      return;
    }
    if (!unit.job_id) {
      res.status(400).json({ error: '集装单元未绑定任务, 无法装箱' });
      return;
    }
    const result = bindSubOrders(db, {
      jobId: unit.job_id,
      unitId: unit.id,
      subOrderIds,
    });
    res.json({ data: { success: true, bound: result.bound, unitId: unit.id, jobId: unit.job_id } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '装箱失败';
    res.status(500).json({ error: msg });
  }
});

// 解绑运单 — 从集装号撤销装箱
router.delete('/warehouse/units/:id/items/:subOrderId', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const unit = db.prepare('SELECT id FROM tms_shipping_unit WHERE id = ? OR unit_no = ?')
      .get(req.params.id, req.params.id) as any;
    if (!unit) {
      res.status(404).json({ error: '集装单元不存在' });
      return;
    }
    const result = unbindSubOrder(db, { unitId: unit.id, subOrderId: String(req.params.subOrderId) });
    if (!result.unbound) {
      res.status(404).json({ error: '该运单未绑定到此集装号' });
      return;
    }
    res.json({ data: { success: true } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '解绑失败';
    res.status(500).json({ error: msg });
  }
});

// 封箱
router.post('/warehouse/units/:id/seal', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const unitId = req.params.id;
    const { sealNo } = (req.body || {}) as { sealNo?: string };
    const unit = db.prepare('SELECT id FROM tms_shipping_unit WHERE id = ? OR unit_no = ?')
      .get(unitId, unitId) as any;
    if (!unit) {
      res.status(404).json({ error: '集装单元不存在' });
      return;
    }
    sealUnit(db, unit.id, sealNo);
    res.json({ data: { success: true, unitId: unit.id, sealNo } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '封箱失败';
    res.status(500).json({ error: msg });
  }
});
router.put('/warehouse/units/:id', stubSuccess);
router.delete('/warehouse/units/:id', stubSuccess);
router.post('/warehouse/returns', stubSuccess);
router.put('/warehouse/returns/:id', stubSuccess);
router.delete('/warehouse/returns/:id', stubSuccess);
router.put('/warehouse/no-order-express/:id', stubSuccess);
router.delete('/warehouse/no-order-express/:id', stubSuccess);
router.put('/v2/wms/unmatched-packages/:id', stubSuccess);
router.delete('/v2/wms/unmatched-packages/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM wms_unmatched_package WHERE id = ?').run(req.params.id);
  res.json({ data: { success: true } });
});

// 真实匹配：把无单快递关联到客户，更新状态为 MATCHED
router.post('/v2/wms/unmatched-packages/:id/match', (req: Request, res: Response) => {
  const db = getDb();
  const { customerId, customerName, orderId } = req.body || {};
  if (!customerId && !orderId) {
    res.status(400).json({ error: 'customerId or orderId required' });
    return;
  }
  db.prepare("UPDATE wms_unmatched_package SET status='MATCHED', matched_order_id=?, customer_hint=?, matched_at=datetime('now'), updated_at=datetime('now') WHERE id=?")
    .run(orderId || null, `已匹配到 ${customerName || customerId || ''}`, req.params.id);
  res.json({ data: { success: true, customerId, orderId } });
});

// Job 写操作 — 绑定/解绑集装号到 JOB(Web 执行任务弹窗 → bindUnits)
router.post('/jobs/:jobNo/bind-units', (req: Request, res: Response) => {
  const db = getDb();
  const { jobNo } = req.params;
  const { unitIds } = (req.body || {}) as { unitIds?: string[] };
  if (!Array.isArray(unitIds) || unitIds.length === 0) {
    res.status(400).json({ error: '缺少 unitIds' });
    return;
  }
  const job = db.prepare('SELECT id, job_no FROM tms_job WHERE id = ? OR job_no = ?').get(jobNo, jobNo) as any;
  if (!job) {
    res.status(404).json({ error: '任务不存在' });
    return;
  }

  const updateUnit = db.prepare(
    "UPDATE tms_shipping_unit SET job_id = ?, updated_at = datetime('now') WHERE id = ? OR unit_no = ?"
  );
  let bound = 0;
  for (const uid of unitIds) {
    const result = updateUnit.run(job.id, uid, uid);
    if (result.changes > 0) bound++;
  }

  // JOB PLANNED → LOADING
  db.prepare(
    `UPDATE tms_job SET
       job_status = CASE WHEN job_status = 'PLANNED' THEN 'LOADING' ELSE job_status END,
       current_node = 'WAREHOUSE_IN',
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(job.id);

  res.json({ data: { success: true, bound, jobId: job.id, jobNo: job.job_no } });
});

router.post('/jobs/:jobNo/unbind-units', (req: Request, res: Response) => {
  const db = getDb();
  const { jobNo } = req.params;
  const { unitIds } = (req.body || {}) as { unitIds?: string[] };
  if (!Array.isArray(unitIds) || unitIds.length === 0) {
    res.status(400).json({ error: '缺少 unitIds' });
    return;
  }
  const job = db.prepare('SELECT id FROM tms_job WHERE id = ? OR job_no = ?').get(jobNo, jobNo) as any;
  if (!job) {
    res.status(404).json({ error: '任务不存在' });
    return;
  }
  const unbind = db.prepare(
    "UPDATE tms_shipping_unit SET job_id = NULL, updated_at = datetime('now') WHERE job_id = ? AND (id = ? OR unit_no = ?)"
  );
  let released = 0;
  for (const uid of unitIds) {
    const r = unbind.run(job.id, uid, uid);
    if (r.changes > 0) released++;
  }
  res.json({ data: { success: true, released } });
});

const advanceNodeHandler = (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { jobNo } = req.params;
    const body = req.body || {};
    const job = db.prepare('SELECT id FROM tms_job WHERE id = ? OR job_no = ?')
      .get(jobNo, jobNo) as any;
    if (!job) {
      res.status(404).json({ error: '任务不存在' });
      return;
    }
    if (!body.nodeCode || !body.nodeName) {
      res.status(400).json({ error: '缺少 nodeCode / nodeName' });
      return;
    }
    const result = advanceNode(db, {
      jobId: job.id,
      nodeCode: body.nodeCode,
      nodeName: body.nodeName,
      eventTime: body.eventTime || new Date().toISOString(),
      location: body.location,
      remark: body.remark,
      operatorUserId: body.operatorUserId,
    });
    res.json({ data: { success: true, eventId: result.eventId } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '节点推进失败';
    res.status(500).json({ error: msg });
  }
};
router.put('/jobs/:jobNo/origin-phase', advanceNodeHandler);
router.put('/jobs/:jobNo/dest-phase', advanceNodeHandler);
router.delete('/jobs/:jobNo', stubSuccess);

// 配送 / DPN / 自提
router.post('/delivery', stubSuccess);
router.put('/delivery/:id', stubSuccess);
router.post('/delivery/:id/assign', stubSuccess);
router.post('/delivery/:id/sign', stubSuccess);
router.post('/v2/pod/dpns/draft', stubSuccess);
router.post('/v2/pod/delivery-tasks', stubSuccess);
router.post('/v2/pod/dpns/:id/return-to-warehouse', stubSuccess);

// ============================================================
// 财务费用 - 真实落库
// ============================================================

const createFeeHandler = (req: Request, res: Response) => {
  try {
    const db = getDb();
    const body = req.body || {};
    if (!body.relatedId || !body.relatedNo || !body.feeType || !body.feeDirection || body.amount == null) {
      res.status(400).json({ error: '缺少必填字段: relatedId / relatedNo / feeType / feeDirection / amount' });
      return;
    }
    const result = createUiFee(db, {
      relatedType: body.relatedType || 'ORDER',
      relatedId: body.relatedId,
      relatedNo: body.relatedNo,
      feeType: body.feeType,
      feeDirection: body.feeDirection,
      amount: Number(body.amount),
      currency: body.currency || 'CNY',
      exchangeRate: body.exchangeRate != null ? Number(body.exchangeRate) : 1,
      supplierName: body.supplierName,
      customerName: body.customerName,
      description: body.description,
      remark: body.remark,
      invoiceNo: body.invoiceNo,
      createdBy: body.createdBy,
      businessLine: body.businessLine,
    });
    const saved = getUiFee(db, result.id);
    res.json({ data: saved });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '创建费用失败';
    res.status(500).json({ error: msg });
  }
};

router.post('/fees', createFeeHandler);
router.post('/v2/finance/fees', createFeeHandler);

router.put('/fees/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const body = req.body || {};
    const result = updateUiFee(db, String(req.params.id), {
      relatedType: body.relatedType,
      relatedId: body.relatedId,
      relatedNo: body.relatedNo,
      feeType: body.feeType,
      feeDirection: body.feeDirection,
      amount: body.amount != null ? Number(body.amount) : undefined,
      currency: body.currency,
      exchangeRate: body.exchangeRate != null ? Number(body.exchangeRate) : undefined,
      supplierName: body.supplierName,
      customerName: body.customerName,
      description: body.description,
      remark: body.remark,
      invoiceNo: body.invoiceNo,
    });
    if (!result) {
      res.status(404).json({ error: '费用不存在' });
      return;
    }
    res.json({ data: getUiFee(db, result.id) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '更新费用失败';
    res.status(400).json({ error: msg });
  }
});

router.post('/fees/:id/approve', (req: Request, res: Response) => {
  const db = getDb();
  const { approver } = req.body || {};
  const result = approveFee(db, String(req.params.id), approver);
  if (!result) {
    res.status(404).json({ error: '费用不存在' });
    return;
  }
  res.json({ data: getUiFee(db, result.id) });
});

router.post('/fees/:id/reject', (req: Request, res: Response) => {
  const db = getDb();
  const { approver, rejectReason } = req.body || {};
  const result = rejectFee(db, String(req.params.id), approver, rejectReason);
  if (!result) {
    res.status(404).json({ error: '费用不存在' });
    return;
  }
  res.json({ data: getUiFee(db, result.id) });
});

router.post('/fees/:id/pay', (req: Request, res: Response) => {
  const db = getDb();
  const body = req.body || {};
  const result = payFee(db, String(req.params.id), {
    paymentMethod: body.paymentMethod,
    paymentTime: body.paidAt || body.paymentTime,
    remark: body.remark,
  });
  if (!result) {
    res.status(404).json({ error: '费用不存在' });
    return;
  }
  res.json({ data: getUiFee(db, result.id) });
});

router.post('/fees/:id/cancel', (req: Request, res: Response) => {
  const db = getDb();
  const { reason } = req.body || {};
  const result = cancelFee(db, String(req.params.id), reason);
  if (!result) {
    res.status(404).json({ error: '费用不存在' });
    return;
  }
  res.json({ data: getUiFee(db, result.id) });
});

router.post('/fees/bootstrap', (req: Request, res: Response) => {
  const db = getDb();
  const body = req.body || {};
  const types = Array.isArray(body.types) ? body.types : ['ORDER', 'UNIT', 'JOB'];
  const valid = types.filter((t: string) => ['ORDER', 'UNIT', 'JOB'].includes(t)) as Array<
    'ORDER' | 'UNIT' | 'JOB'
  >;
  const result = bootstrapFees(db, valid, body.createdBy);
  res.json({ data: result });
});

router.post('/v2/finance/payments/confirm', (req: Request, res: Response) => {
  const db = getDb();
  const body = req.body || {};
  if (!body.feeId) {
    res.status(400).json({ error: '缺少 feeId' });
    return;
  }
  const fee = db.prepare('SELECT * FROM fin_fee WHERE id = ?').get(body.feeId) as any;
  if (!fee) {
    res.status(404).json({ error: '费用不存在' });
    return;
  }
  const pay = recordPayment(db, {
    relatedFeeId: body.feeId,
    paymentType: fee.fee_direction === 'RECEIVABLE' ? 'INBOUND' : 'OUTBOUND',
    amount: body.amount != null ? Number(body.amount) : Number(fee.amount),
    currencyCode: body.currency || fee.currency_code,
    paymentMethod: body.paymentMethod,
    paymentTime: body.paymentTime,
    remark: body.remark,
  });
  res.json({ data: { payment: pay, fee: getUiFee(db, body.feeId) } });
});

router.post('/finance/commission/rules', stubSuccess);
router.put('/finance/commission/rules/:id', stubSuccess);
router.delete('/finance/commission/rules/:id', stubSuccess);
router.put('/finance/commission/bonus', stubSuccess);

// 系统管理写操作
router.post('/system/base-data', stubSuccess);
router.put('/system/base-data/:id', stubSuccess);
router.delete('/system/base-data/:id', stubSuccess);
router.post('/system/countries/:countryId/cities', stubSuccess);
router.put('/system/countries/:countryId/cities/:cityId', stubSuccess);
router.delete('/system/countries/:countryId/cities/:cityId', stubSuccess);
router.post('/system/freight-rates', stubSuccess);
router.put('/system/freight-rates/:id', stubSuccess);
router.delete('/system/freight-rates/:id', stubSuccess);
router.post('/system/exchange-rates/currencies', stubSuccess);
router.put('/system/exchange-rates/currencies/:id', stubSuccess);
router.delete('/system/exchange-rates/currencies/:id', stubSuccess);
router.post('/system/exchange-rates/currencies/:currencyCode/rates', stubSuccess);
router.post('/system/exchange-rates/refresh-live', stubSuccess);
router.post('/system/rbac/permissions', stubSuccess);
router.put('/system/rbac/permissions/:id', stubSuccess);
router.delete('/system/rbac/permissions/:id', stubSuccess);
router.post('/system/workflows', stubSuccess);
router.put('/system/workflows/:id', stubSuccess);
router.put('/system/workflows/:id/status', stubSuccess);
router.delete('/system/workflows/:id', stubSuccess);
router.put('/system/user-sites/:userId', stubSuccess);
router.put('/system/rbac/users/:userId/roles', stubSuccess);
router.put('/system/sites/:id', stubSuccess);
router.delete('/system/sites/:id', stubSuccess);
router.put('/system/countries/:id', stubSuccess);
router.delete('/system/countries/:id', stubSuccess);

// 工作流实例
router.post('/v2/workflow/instances', stubSuccess);
router.post('/v2/workflow/tasks/:taskId/action', stubSuccess);

// Auth 重置密码
router.post('/auth/users/:id/reset-password', stubSuccess);

export default router;
