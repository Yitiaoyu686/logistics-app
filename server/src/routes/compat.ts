/**
 * 兼容路由 — 为 Web 端遗留接口提供别名/最简实现
 * 目的是让 Demo 场景覆盖到的 Web 页面都能正常加载
 * 这里的接口都是 Demo 级别的最简实现，聚焦返回 200 + 可用数据，不做完整业务逻辑
 */
import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';

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
    WHERE so.sub_status IN ('ARRIVED','INBOUND')
      AND NOT EXISTS (SELECT 1 FROM pod_dpn_item di WHERE di.sub_order_id = so.id)
    ORDER BY so.created_at DESC
  `).all();
  res.json({ data: rows });
});

// ============================================================
// 财务费用
// ============================================================

// GET /api/fees
router.get('/fees', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT f.*, o.order_no, o.customer_name
    FROM fin_fee f
    LEFT JOIN oms_order o ON o.id = f.related_id AND f.fee_level = 'ORDER'
    ORDER BY f.created_at DESC
  `).all();
  res.json({ data: rows });
});

// GET /api/fees/coverage — 费用覆盖率统计
router.get('/fees/coverage', (_req: Request, res: Response) => {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM oms_order').get() as any).c;
  const withFees = (db.prepare("SELECT COUNT(DISTINCT related_id) as c FROM fin_fee WHERE fee_level = 'ORDER'").get() as any).c;
  res.json({
    data: {
      totalOrders: total,
      ordersWithFees: withFees,
      coverage: total > 0 ? Math.round((withFees / total) * 100) : 0,
    },
  });
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

export default router;
