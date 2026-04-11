import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { uuid, generateOrderNo, generateSubOrderNo } from '../utils/idGenerator';

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
  const order = db.prepare('SELECT * FROM oms_order WHERE id = ?').get(req.params.id) as any;
  if (!order) { res.status(404).json({ error: 'Order not found' }); return; }

  const subOrders = db.prepare('SELECT * FROM oms_sub_order WHERE order_id = ? ORDER BY line_no').all(req.params.id);
  const packages = db.prepare('SELECT * FROM oms_package_initial WHERE order_id = ? ORDER BY line_no').all(req.params.id);
  const actualPackages = db.prepare('SELECT * FROM oms_package_actual WHERE order_id = ?').all(req.params.id);
  const fees = db.prepare("SELECT * FROM fin_fee WHERE related_id = ? AND fee_level = 'ORDER'").all(req.params.id);

  res.json({
    data: {
      ...order,
      subOrders,
      packages,
      actualPackages,
      fees,
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
  const entryNo = b.warehouseEntryNo || `${b.customerCode || 'X'}${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;

  // Insert master order
  db.prepare(`INSERT INTO oms_order (id, order_no, warehouse_entry_no, business_line, service_type, customer_id, customer_name, sales_user_id, route_code, export_mode, order_status, payment_method, currency_code, total_declared_pieces, total_declared_weight_kg, sender_name, sender_phone, sender_address, consignee_name, consignee_phone, consignee_email, consignee_address, consignee_country, consignee_city, remark, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    orderId, orderNo, entryNo, businessLine,
    b.serviceType || b.service_type,
    b.customerId || b.customer_id,
    b.customerName || b.customer_name,
    b.salesUserId || b.sales_user_id,
    b.routeCode || b.route_code,
    b.exportMode || b.export_mode || 'BUYER_EXPORT',
    'PENDING_INBOUND',
    b.paymentMethod || b.payment_method,
    b.currencyCode || b.currency_code || 'CNY',
    b.totalPieces || 0,
    b.totalWeight || 0,
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
    b.createdBy || b.created_by
  );

  // Insert packages and create sub-orders
  const items = b.items || b.packages || [];
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

    // Create sub-order per package
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

  res.json({ data: { id: orderId, orderNo, warehouseEntryNo: entryNo } });
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
