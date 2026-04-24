import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { uuid, generateOrderNo, generateSubOrderNo } from '../utils/idGenerator';
import { calcFreight } from '../utils/freight';

const router = Router();

// GET /api/v2/oms/orders — 订单列表
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { businessLine, status, keyword, page, pageSize } = req.query;
  let sql = 'SELECT o.*, (SELECT COUNT(*) FROM oms_sub_order WHERE order_id = o.id) as sub_order_count FROM oms_order o WHERE 1=1';
  const params: any[] = [];

  if (businessLine && businessLine !== 'ALL') { sql += ' AND o.business_line = ?'; params.push(businessLine); }
  if (status) { sql += ' AND o.order_status = ?'; params.push(status); }
  if (keyword) {
    sql += ' AND (o.order_no LIKE ? OR o.customer_name LIKE ? OR o.consignee_name LIKE ? OR o.warehouse_entry_no LIKE ?)';
    const k = `%${keyword}%`;
    params.push(k, k, k, k);
  }

  sql += ' ORDER BY o.created_at DESC';
  if (pageSize) { sql += ` LIMIT ${pageSize}`; }

  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows });
});

// GET /api/v2/oms/orders/:id/full — 订单详情
router.get('/:id/full', (req: Request, res: Response) => {
  const db = getDb();
  const order = db.prepare(`
    SELECT o.*, c.customer_code, c.customer_type
    FROM oms_order o
    LEFT JOIN crm_customer c ON c.id = o.customer_id
    WHERE o.id = ?
  `).get(req.params.id) as any;
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const subOrders = db.prepare('SELECT * FROM oms_sub_order WHERE order_id = ? ORDER BY line_no').all(req.params.id);
  const packages = db.prepare('SELECT * FROM oms_package_initial WHERE order_id = ? ORDER BY line_no').all(req.params.id);
  const actualPackages = db.prepare('SELECT * FROM oms_package_actual WHERE order_id = ?').all(req.params.id);
  const fees = db.prepare("SELECT * FROM fin_fee WHERE related_id = ? AND fee_level = 'ORDER'").all(req.params.id);

  const subOrderIds = (subOrders as any[]).map((s) => s.id);
  let relatedJobs: any[] = [];
  let relatedDpns: any[] = [];
  if (subOrderIds.length > 0) {
    const placeholders = subOrderIds.map(() => '?').join(',');
    relatedJobs = db.prepare(`
      SELECT DISTINCT j.id, j.job_no, j.job_status, j.route_code, j.container_no, j.etd, j.eta
      FROM tms_job_order_rel r
      JOIN tms_job j ON j.id = r.job_id
      WHERE r.sub_order_id IN (${placeholders})
    `).all(...subOrderIds);
    relatedDpns = db.prepare(`
      SELECT DISTINCT d.id, d.dpn_no, d.dpn_status, d.from_site, d.to_site
      FROM pod_dpn_item di
      JOIN pod_dpn d ON d.id = di.dpn_id
      WHERE di.sub_order_id IN (${placeholders})
    `).all(...subOrderIds);
  }

  res.json({
    data: {
      ...order,
      subOrders,
      packages,
      actualPackages,
      fees,
      relatedJobs,
      relatedDpns,
    },
  });
});

// POST /api/v2/oms/orders — 创建订单
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const orderId = uuid();
  const businessLine = b.businessLine || b.business_line || 'SEA';
  const orderNo = generateOrderNo(businessLine);
  // 入仓号规则(对齐 Web OrderCreate):客户编号 + 3 位流水(100-999)
  // 优先级:payload 传入 > customerCode / shortCode > 从 DB 回查 customer_code > 兜底 'X'
  let entryCode = b.customerCode || b.shortCode;
  if (!entryCode) {
    const custRow = db.prepare('SELECT customer_code FROM crm_customer WHERE id = ?').get(b.customerId || b.customer_id) as { customer_code?: string } | undefined;
    entryCode = custRow?.customer_code;
  }
  const entrySeq = String(Math.floor(Math.random() * 900) + 100);
  const entryNo = b.warehouseEntryNo || `${entryCode || 'X'}${entrySeq}`;

  // 校验 FK：客户必须存在；销售如果传了也必须存在,否则置 null（避免 FK 500）
  const customerId = b.customerId || b.customer_id;
  if (!customerId) { res.status(400).json({ error: '缺少 customerId' }); return; }
  const customerExists = db.prepare('SELECT 1 FROM crm_customer WHERE id = ?').get(customerId);
  if (!customerExists) { res.status(400).json({ error: `客户不存在: ${customerId}` }); return; }

  let salesUserId: string | null = b.salesUserId || b.sales_user_id || null;
  if (salesUserId) {
    const userExists = db.prepare('SELECT 1 FROM sys_user WHERE id = ?').get(salesUserId);
    if (!userExists) salesUserId = null;
  }

  const items = b.items || b.packages || [];

  // 预估运费:按申报总重量 × 服务类型系数
  const declaredWeight = Number(b.totalWeight || b.total_declared_weight_kg || 0);
  const serviceType = b.serviceType || b.service_type;
  const estimatedFreight = calcFreight(declaredWeight, serviceType);

  // 所有插入放在一个事务里,出错原子回滚
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO oms_order (id, order_no, warehouse_entry_no, business_line, service_type, customer_id, customer_name, sales_user_id, route_code, export_mode, order_status, payment_method, currency_code, total_declared_pieces, total_declared_weight_kg, sender_name, sender_phone, sender_address, consignee_name, consignee_phone, consignee_email, consignee_address, consignee_country, consignee_city, remark, created_by, estimated_freight, freight_currency) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      orderId, orderNo, entryNo, businessLine,
      serviceType,
      customerId,
      b.customerName || b.customer_name,
      salesUserId,
      b.routeCode || b.route_code,
      b.exportMode || b.export_mode || 'BUYER_EXPORT',
      'PENDING_INBOUND',
      b.paymentMethod || b.payment_method,
      b.currencyCode || b.currency_code || 'CNY',
      b.totalPieces || 0,
      declaredWeight,
      b.senderName || b.sender_name,
      b.senderPhone || b.sender_phone,
      b.senderAddress || b.sender_address,
      b.consigneeName || b.consignee_name,
      b.consigneePhone || b.consignee_phone,
      b.consigneeEmail || b.consignee_email,
      b.consigneeAddress || b.consignee_address,
      b.consigneeCountry || b.consignee_country,
      b.consigneeCity || b.consignee_city,
      b.remark,
      b.createdBy || b.created_by,
      estimatedFreight,
      b.currencyCode || b.currency_code || 'CNY'
    );

    let lineNo = 1;
    for (const item of items) {
      const pkgId = uuid();
      db.prepare('INSERT INTO oms_package_initial (id, order_id, line_no, express_company, tracking_no, goods_name, goods_category, cargo_type, declared_weight_kg, pieces, length_cm, width_cm, height_cm, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
        pkgId, orderId, lineNo,
        item.expressCompany || item.express_company,
        item.trackingNo || item.tracking_no,
        item.goodsName || item.goods_name,
        item.goodsCategory || item.goods_category,
        item.cargoType || item.cargo_type || 'GENERAL',
        item.weight || item.declared_weight_kg || 0,
        item.pieces || 1,
        item.lengthCm || item.length_cm,
        item.widthCm || item.width_cm,
        item.heightCm || item.height_cm,
        item.remark
      );

      const subId = uuid();
      const subNo = generateSubOrderNo(orderNo, lineNo);
      db.prepare('INSERT INTO oms_sub_order (id, sub_order_no, order_id, line_no, business_line, sub_status, route_code, pieces, actual_weight_kg) VALUES (?,?,?,?,?,?,?,?,?)').run(
        subId, subNo, orderId, lineNo, businessLine, 'PENDING_INBOUND',
        b.routeCode || b.route_code,
        item.pieces || 1,
        item.weight || item.declared_weight_kg || 0
      );
      lineNo++;
    }
  });

  try {
    tx();
  } catch (err: any) {
    res.status(400).json({ error: `创建订单失败: ${err?.message || err}` });
    return;
  }

  res.json({ data: { id: orderId, orderNo, warehouseEntryNo: entryNo } });
});

// POST /api/v2/oms/orders/:id/pay — 客户支付(按 actual_freight)
router.post('/:id/pay', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, actual_freight, payment_status FROM oms_order WHERE id = ?'
  ).get(req.params.id) as { id: string; actual_freight: number | null; payment_status: string } | undefined;
  if (!row) { res.status(404).json({ error: '订单不存在' }); return; }
  if (!row.actual_freight || row.actual_freight <= 0) {
    res.status(400).json({ error: '实际运费未生成,等仓库入库称重后再支付' });
    return;
  }
  if (row.payment_status === 'PAID') {
    res.json({ data: { id: row.id, alreadyPaid: true } });
    return;
  }
  db.prepare(
    "UPDATE oms_order SET payment_status='PAID', total_paid_amount=?, total_receivable_amount=?, updated_at=datetime('now') WHERE id=?"
  ).run(row.actual_freight, row.actual_freight, req.params.id);
  res.json({ data: { id: req.params.id, paidAmount: row.actual_freight } });
});

// PUT /api/v2/oms/orders/:id — 更新订单
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  if (b.order_status || b.orderStatus) {
    db.prepare("UPDATE oms_order SET order_status=?, updated_at=datetime('now') WHERE id=?").run(b.order_status || b.orderStatus, req.params.id);
  }
  if (b.remark !== undefined) {
    db.prepare("UPDATE oms_order SET remark=?, updated_at=datetime('now') WHERE id=?").run(b.remark, req.params.id);
  }
  res.json({ data: { id: req.params.id } });
});

// Sales users for dropdown
router.get('/users/sales', (req: Request, res: Response) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.username, u.real_name as realName
    FROM sys_user u
    JOIN sys_user_role ur ON ur.user_id = u.id
    JOIN sys_role r ON r.id = ur.role_id
    WHERE r.role_code = 'SALES' AND u.status = 'ACTIVE'
  `).all();
  res.json({ data: users });
});

export default router;
