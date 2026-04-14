import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { uuid } from '../utils/idGenerator';

const router = Router();

// GET /api/v2/oms/customers
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { keyword, status, poolType } = req.query;
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

  const mapped = rows.map((r: any) => ({
    id: r.id,
    customerCode: r.customer_code,
    customerName: r.customer_name,
    customerType: r.customer_type,
    country: r.country,
    industry: r.industry,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    contactEmail: r.contact_email,
    ownerUserId: r.owner_user_id,
    poolType: r.pool_type,
    status: r.status,
    preferredTransport: r.preferred_transport,
    preferredPayment: r.preferred_payment,
    remark: r.remark,
    createdAt: r.created_at,
    // Count orders
    orderCount: (db.prepare('SELECT COUNT(*) as c FROM oms_order WHERE customer_id = ?').get(r.id) as any).c,
  }));

  res.json({ data: mapped });
});

// GET /api/v2/oms/customers/:id
router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM crm_customer WHERE id = ?').get(req.params.id) as any;
  if (!customer) { res.status(404).json({ error: 'Not found' }); return; }

  const senders = db.prepare('SELECT * FROM crm_sender_profile WHERE customer_id = ?').all(req.params.id);
  const recipients = db.prepare('SELECT * FROM crm_recipient_address WHERE customer_id = ?').all(req.params.id);

  res.json({ data: { ...customer, senders, recipients } });
});

// POST /api/v2/oms/customers
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  const code = b.customerCode || `C${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  db.prepare('INSERT INTO crm_customer (id, customer_code, customer_name, customer_type, country, industry, contact_name, contact_phone, contact_email, owner_user_id, pool_type, status, preferred_transport, preferred_payment, remark) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    id, code, b.customerName, b.customerType || 'COMPANY_CN', b.country, b.industry,
    b.contactName, b.contactPhone, b.contactEmail, b.ownerUserId, b.poolType || 'PRIVATE',
    b.status || 'ACTIVE', b.preferredTransport, b.preferredPayment, b.remark
  );
  res.json({ data: { id, customerCode: code } });
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
