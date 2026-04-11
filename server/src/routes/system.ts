import { Router, Request, Response } from 'express';
import { getDb } from '../database/schema';
import { uuid } from '../utils/idGenerator';

const router = Router();

// ============================================================
// 仓库管理
// ============================================================

router.get('/warehouses', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM md_warehouse ORDER BY created_at').all();
  res.json({ data: rows });
});

router.post('/warehouses', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const { code, name, site_id, country_id, city_id, warehouse_type, manager_name, manager_phone, capacity, status } = req.body;
  db.prepare('INSERT INTO md_warehouse (id, code, name, site_id, country_id, city_id, warehouse_type, manager_name, manager_phone, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, code, name, site_id, country_id, city_id, warehouse_type, manager_name, manager_phone, capacity, status || 'ACTIVE');
  res.json({ data: { id } });
});

router.put('/warehouses/:id', (req: Request, res: Response) => {
  const db = getDb();
  const fields = req.body;
  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE md_warehouse SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(fields), req.params.id);
  res.json({ data: { id: req.params.id } });
});

router.delete('/warehouses/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM md_warehouse WHERE id = ?').run(req.params.id);
  res.json({ data: { deleted: true } });
});

// ============================================================
// 站点
// ============================================================

router.get('/sites', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM md_site ORDER BY created_at').all();
  res.json({ data: rows });
});

router.post('/sites', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const { city_id, code, name, site_type, status } = req.body;
  db.prepare('INSERT INTO md_site (id, city_id, code, name, site_type, status) VALUES (?, ?, ?, ?, ?, ?)').run(id, city_id, code, name, site_type, status || 'ACTIVE');
  res.json({ data: { id } });
});

// ============================================================
// 部门
// ============================================================

router.get('/departments', (req: Request, res: Response) => {
  const db = getDb();
  // Return mock departments from roles
  const roles = db.prepare('SELECT * FROM sys_role ORDER BY created_at').all() as any[];
  const depts = roles.map((r: any, i: number) => ({
    id: r.id,
    deptCode: r.role_code,
    deptName: r.role_name,
    sortOrder: (i + 1) * 10,
    status: r.status,
    userCount: 1,
    remark: r.is_system ? '系统默认部门' : '',
  }));
  res.json({ data: depts });
});

router.post('/departments', (req: Request, res: Response) => {
  res.json({ data: { id: uuid() } });
});

router.put('/departments/:id', (req: Request, res: Response) => {
  res.json({ data: { id: req.params.id } });
});

router.delete('/departments/:id', (req: Request, res: Response) => {
  res.json({ data: { deleted: true } });
});

// ============================================================
// 国家/城市
// ============================================================

router.get('/countries', (req: Request, res: Response) => {
  const db = getDb();
  const countries = db.prepare('SELECT * FROM md_country ORDER BY created_at').all() as any[];
  const cities = db.prepare('SELECT * FROM md_city ORDER BY created_at').all() as any[];
  const result = countries.map((c: any) => ({
    ...c,
    countryCode: c.code,
    countryName: c.name_cn,
    countryNameEn: c.name_en,
    currencyCode: c.currency_code,
    currencyName: c.currency_name,
    currencySymbol: c.currency_symbol,
    phoneCode: c.phone_code,
    cities: cities.filter((ci: any) => ci.country_id === c.id).map((ci: any) => ({
      ...ci,
      cityCode: ci.code,
      cityName: ci.name_cn,
    })),
  }));
  res.json({ data: result });
});

router.post('/countries', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  db.prepare('INSERT INTO md_country (id, code, name_cn, name_en, continent, phone_code, currency_code, currency_name, currency_symbol) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, b.countryCode || b.code, b.countryName || b.name_cn, b.countryNameEn || b.name_en, b.continent, b.phoneCode || b.phone_code, b.currencyCode || b.currency_code, b.currencyName || b.currency_name, b.currencySymbol || b.currency_symbol);
  res.json({ data: { id } });
});

// ============================================================
// 线路
// ============================================================

router.get('/routes', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM md_route ORDER BY created_at').all();
  res.json({ data: rows });
});

router.post('/routes', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  db.prepare('INSERT INTO md_route (id, origin_country, origin_city, dest_country, dest_city, transport_type, transit_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, b.originCountry || b.origin_country, b.originCity || b.origin_city, b.destCountry || b.dest_country, b.destCity || b.dest_city, b.transportType || b.transport_type, b.transitDays || b.transit_days, b.status || 'ACTIVE');
  res.json({ data: { id } });
});

router.put('/routes/:id', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  db.prepare(`UPDATE md_route SET origin_country=COALESCE(?,origin_country), origin_city=COALESCE(?,origin_city), dest_country=COALESCE(?,dest_country), dest_city=COALESCE(?,dest_city), transport_type=COALESCE(?,transport_type), transit_days=COALESCE(?,transit_days), status=COALESCE(?,status), updated_at=datetime('now') WHERE id=?`).run(b.originCountry||b.origin_country||null, b.originCity||b.origin_city||null, b.destCountry||b.dest_country||null, b.destCity||b.dest_city||null, b.transportType||b.transport_type||null, b.transitDays||b.transit_days||null, b.status||null, req.params.id);
  res.json({ data: { id: req.params.id } });
});

router.delete('/routes/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM md_route WHERE id = ?').run(req.params.id);
  res.json({ data: { deleted: true } });
});

// ============================================================
// 物流节点
// ============================================================

router.get('/logistics-nodes', (req: Request, res: Response) => {
  const db = getDb();
  const { routeId } = req.query;
  let rows;
  if (routeId) {
    rows = db.prepare('SELECT * FROM md_logistics_node WHERE route_id = ? ORDER BY sort_order').all(routeId);
  } else {
    rows = db.prepare('SELECT * FROM md_logistics_node ORDER BY route_id, sort_order').all();
  }
  res.json({ data: rows });
});

router.post('/logistics-nodes', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  db.prepare('INSERT INTO md_logistics_node (id, route_id, node_code, node_name, node_name_en, node_type, sort_order, is_required, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, b.routeId||b.route_id, b.nodeCode||b.node_code, b.nodeName||b.node_name, b.nodeNameEn||b.node_name_en, b.nodeType||b.node_type, b.sortOrder||b.sort_order||0, b.isRequired!==undefined?b.isRequired:1, b.description, b.status||'ACTIVE');
  res.json({ data: { id } });
});

router.put('/logistics-nodes/:id', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  const sets: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(b)) {
    if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
  }
  if (sets.length > 0) {
    vals.push(req.params.id);
    db.prepare(`UPDATE md_logistics_node SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  res.json({ data: { id: req.params.id } });
});

router.delete('/logistics-nodes/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM md_logistics_node WHERE id = ?').run(req.params.id);
  res.json({ data: { deleted: true } });
});

// ============================================================
// 供应商
// ============================================================

router.get('/suppliers', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM md_supplier ORDER BY created_at').all();
  res.json({ data: rows });
});

// ============================================================
// RBAC 角色/权限
// ============================================================

router.get('/rbac/roles', (req: Request, res: Response) => {
  const db = getDb();
  const roles = db.prepare('SELECT * FROM sys_role ORDER BY created_at').all() as any[];
  const result = roles.map((r: any) => {
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM sys_user_role WHERE role_id = ?').get(r.id) as any).count;
    return { ...r, roleCode: r.role_code, roleName: r.role_name, siteScope: r.site_scope, isSystem: !!r.is_system, userCount, permissionCount: 0 };
  });
  res.json({ data: result });
});

router.post('/rbac/roles', (req: Request, res: Response) => {
  const db = getDb();
  const id = uuid();
  const b = req.body;
  db.prepare('INSERT INTO sys_role (id, role_code, role_name, description, site_scope, status) VALUES (?, ?, ?, ?, ?, ?)').run(id, b.roleCode, b.roleName, b.description, b.siteScope || 'ASSIGNED_SITE', b.status || 'ACTIVE');
  res.json({ data: { id } });
});

router.put('/rbac/roles/:id', (req: Request, res: Response) => {
  const db = getDb();
  const b = req.body;
  db.prepare('UPDATE sys_role SET role_name=COALESCE(?,role_name), description=COALESCE(?,description), site_scope=COALESCE(?,site_scope), status=COALESCE(?,status) WHERE id=?').run(b.roleName, b.description, b.siteScope, b.status, req.params.id);
  res.json({ data: { id: req.params.id } });
});

router.delete('/rbac/roles/:id', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM sys_role WHERE id = ?').run(req.params.id);
  res.json({ data: { deleted: true } });
});

// RBAC permissions (stub)
router.get('/rbac/permissions', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

router.get('/rbac/roles/:roleId/permissions', (_req: Request, res: Response) => {
  res.json({ data: { assignedPermissionIds: [] } });
});

router.put('/rbac/roles/:roleId/permissions', (_req: Request, res: Response) => {
  res.json({ data: { success: true } });
});

// ============================================================
// 汇率
// ============================================================

router.get('/exchange-rates', (req: Request, res: Response) => {
  const db = getDb();
  const rates = db.prepare('SELECT * FROM fx_rate WHERE is_latest = 1 ORDER BY from_currency').all();
  res.json({ data: rates });
});

// ============================================================
// 费用类型
// ============================================================

router.get('/fee-types', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM md_fee_item ORDER BY created_at').all();
  res.json({ data: rows });
});

// ============================================================
// 承运人
// ============================================================

router.get('/carriers', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM md_supplier WHERE supplier_type = 'CARRIER' ORDER BY created_at").all();
  res.json({ data: rows });
});

// ============================================================
// 快递公司
// ============================================================

router.get('/express-companies', (req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM md_supplier WHERE supplier_type = 'EXPRESS' ORDER BY created_at").all();
  res.json({ data: rows });
});

// ============================================================
// 货物分类 (stub)
// ============================================================

router.get('/goods-categories', (_req: Request, res: Response) => {
  const categories = [
    { id: '1', code: 'ELECTRONICS', name: '电子产品', nameEn: 'Electronics', status: '启用' },
    { id: '2', code: 'APPAREL', name: '服装鞋帽', nameEn: 'Apparel', status: '启用' },
    { id: '3', code: 'FOOD', name: '食品', nameEn: 'Food', status: '启用' },
    { id: '4', code: 'DAILY_USE', name: '日用品', nameEn: 'Daily Use', status: '启用' },
    { id: '5', code: 'BEAUTY', name: '美妆个护', nameEn: 'Beauty', status: '启用' },
    { id: '6', code: 'MACHINE_PARTS', name: '机械配件', nameEn: 'Machine Parts', status: '启用' },
    { id: '7', code: 'OTHER', name: '其他', nameEn: 'Other', status: '启用' },
  ];
  res.json({ data: categories });
});

// ============================================================
// 审批流程 (stub)
// ============================================================

router.get('/workflows', (_req: Request, res: Response) => {
  res.json({ data: [] });
});

export default router;
