import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { createCustomerRecord, mapCustomerRow } from '../database/customerRepo';

const router = Router();

// GET /api/v2/oms/customers
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { keyword, status, poolType, needFollowup } = req.query;
  let sql = 'SELECT * FROM crm_customer WHERE 1=1';
  const params: any[] = [];

  if (keyword) {
    sql += ' AND (customer_name LIKE ? OR customer_code LIKE ? OR contact_name LIKE ? OR contact_phone LIKE ?)';
    const k = `%${keyword}%`;
    params.push(k, k, k, k);
  }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (poolType) { sql += ' AND pool_type = ?'; params.push(poolType); }

  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params) as any[];

  // 增强：添加跟进统计
  const customers = rows.map((r) => {
    const mapped = mapCustomerRow(db, r);

    // 查询该客户的订单统计
    const orderStats = db.prepare(`
      SELECT
        COUNT(*) as total_orders,
        MAX(created_at) as last_order_date,
        SUM(CASE WHEN order_status = 'PENDING_INBOUND' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN payment_status IN ('UNPAID', 'PARTIAL') THEN 1 ELSE 0 END) as unpaid_orders
      FROM oms_order
      WHERE customer_id = ?
    `).get(r.id) as any;

    const totalOrders = orderStats?.total_orders || 0;
    const lastOrderDate = orderStats?.last_order_date;
    const daysSinceOrder = lastOrderDate
      ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000)
      : null;

    // 判断是否需要跟进
    const needsFollowup =
      (totalOrders === 0) || // 新客户未下单
      (totalOrders > 0 && daysSinceOrder && daysSinceOrder > 30) || // 老客户超30天未下单
      (orderStats?.pending_orders > 0) || // 有待入库订单
      (orderStats?.unpaid_orders > 0); // 有未付款订单

    return {
      ...mapped,
      totalOrders,
      lastOrderDate,
      daysSinceOrder,
      pendingOrders: orderStats?.pending_orders || 0,
      unpaidOrders: orderStats?.unpaid_orders || 0,
      needsFollowup,
    };
  });

  // 如果请求需要跟进的客户，则过滤
  const result = needFollowup === 'true'
    ? customers.filter(c => c.needsFollowup)
    : customers;

  res.json({ data: result });
});

// GET /api/v2/oms/customers/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }

  const senders = db.prepare('SELECT * FROM crm_sender_profile WHERE customer_id = ? ORDER BY is_default DESC, created_at ASC').all(req.params.id) as any[];
  const recipients = db.prepare('SELECT * FROM crm_recipient_address WHERE customer_id = ? ORDER BY is_default DESC, created_at ASC').all(req.params.id) as any[];

  const senderContacts = senders.map((s, i) => ({
    id: s.id || `SENDER-${i + 1}`,
    label: i === 0 ? '默认发货人' : `发货人 ${i + 1}`,
    senderName: s.sender_name,
    senderPhone: s.sender_phone,
    senderAddress: s.sender_address,
    senderCity: s.sender_city,
    senderCountry: s.sender_country,
  }));
  const receiverContacts = recipients.map((r, i) => ({
    id: r.id || `RECEIVER-${i + 1}`,
    label: i === 0 ? '默认收货人' : `收货人 ${i + 1}`,
    consigneeName: r.recipient_name,
    consigneePhone: r.recipient_phone,
    consigneeCountry: r.country,
    consigneeCity: r.city,
    consigneeZipCode: r.zip_code,
    consigneeAddress: r.detail_address,
  }));
  const firstSender = senderContacts[0];
  const firstReceiver = receiverContacts[0];
  const logisticsInfo = {
    senderContacts,
    receiverContacts,
    senderName: firstSender?.senderName,
    senderPhone: firstSender?.senderPhone,
    senderAddress: firstSender?.senderAddress,
    senderCity: firstSender?.senderCity,
    senderCountry: firstSender?.senderCountry,
    consigneeName: firstReceiver?.consigneeName,
    consigneePhone: firstReceiver?.consigneePhone,
    consigneeCountry: firstReceiver?.consigneeCountry,
    consigneeCity: firstReceiver?.consigneeCity,
    consigneeZipCode: firstReceiver?.consigneeZipCode,
    consigneeAddress: firstReceiver?.consigneeAddress,
    preferredTransportType: row.preferred_transport,
    paymentMethod: row.preferred_payment,
  };

  res.json({
    data: {
      ...mapCustomerRow(db, row),
      senders,
      recipients,
      logisticsInfo,
    },
  });
});

// POST /api/v2/oms/customers
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body || {};
  const { id, customerCode } = createCustomerRecord(db, {
    name: b.name || b.customerName,
    customerType: b.customerType || b.enterpriseInfo?.entityType,
    country: b.country,
    address: b.address,
    industry: b.industry,
    source: b.source,
    contact: b.contact,
    contactName: b.contactName,
    contactPhone: b.contactPhone,
    contactEmail: b.contactEmail,
    salesId: b.salesId,
    ownerUserId: b.ownerUserId,
    poolType: b.poolType || 'PRIVATE',
    status: b.status || 'ACTIVE',
    preferredTransport: b.preferredTransport,
    preferredPayment: b.preferredPayment,
    remark: b.remark,
    enterpriseInfo: b.enterpriseInfo,
    logisticsInfo: b.logisticsInfo,
  });
  const row = db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(id) as any;
  res.json({ data: { ...mapCustomerRow(db, row), id, customerCode, shortCode: customerCode } });
});

// PUT /api/v2/oms/customers/:id
router.put('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  db.prepare(`UPDATE crm_customer SET customer_name=COALESCE(?,customer_name), customer_type=COALESCE(?,customer_type), country=COALESCE(?,country), contact_name=COALESCE(?,contact_name), contact_phone=COALESCE(?,contact_phone), status=COALESCE(?,status), remark=COALESCE(?,remark), updated_at=datetime('now') WHERE id=?`).run(
    b.customerName, b.customerType, b.country, b.contactName, b.contactPhone, b.status, b.remark, req.params.id
  );
  res.json({ data: { id: req.params.id } });
});

// DELETE
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM crm_customer WHERE id = ?').run(req.params.id);
  res.json({ data: { deleted: true } });
});

// POST /:id/claim
router.post('/:id/claim', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE crm_customer SET pool_type='PRIVATE', owner_user_id=?, updated_at=datetime('now') WHERE id=?").run(req.body.userId || 'user-sales1', req.params.id);
  res.json({ data: { success: true } });
});

// POST /:id/release
router.post('/:id/release', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare("UPDATE crm_customer SET pool_type='PUBLIC', owner_user_id=NULL, updated_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ data: { success: true } });
});

// POST /:id/transfer — 转移客户给其他业务员
router.post('/:id/transfer', (req: Request, res: Response) => {
  const db = getDb();
  const { toSalesId } = req.body;
  if (!toSalesId) {
    res.status(400).json({ error: 'toSalesId is required' });
    return;
  }
  db.prepare("UPDATE crm_customer SET owner_user_id=?, pool_type='PRIVATE', updated_at=datetime('now') WHERE id=?").run(toSalesId, req.params.id);
  res.json({ data: { success: true } });
});

// GET /:id/pool-logs — 客户公海池日志（暂返回空数组）
router.get('/:id/pool-logs', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

// GET /:id/line-profiles — 客户线路档案（暂返回空数组）
router.get('/:id/line-profiles', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

export default router;
