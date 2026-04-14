import { getDb } from './schema';
import bcrypt from 'bcryptjs';

function uuid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function seedDatabase(): void {
  const db = getDb();

  // Check if already seeded
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM sys_user').get() as any).count;
  if (userCount > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  const hash = bcrypt.hashSync('123456', 10);
  const adminHash = bcrypt.hashSync('admin123', 10);
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // ============================================================
  // 1. 用户 & 角色
  // ============================================================

  const roles = [
    { id: 'role-admin', role_code: 'ADMIN', role_name: '系统管理员', is_system: 1 },
    { id: 'role-sales', role_code: 'SALES', role_name: '销售人员', is_system: 1 },
    { id: 'role-wh-cn', role_code: 'WAREHOUSE_CN', role_name: '起运国仓管', is_system: 1 },
    { id: 'role-ops-cn', role_code: 'OPS_CN', role_name: '起运国操作', is_system: 1 },
    { id: 'role-ops-us', role_code: 'OPS_US', role_name: '到达国操作', is_system: 1 },
    { id: 'role-wh-us', role_code: 'WAREHOUSE_US', role_name: '到达国仓管', is_system: 1 },
    { id: 'role-finance', role_code: 'FINANCE', role_name: '财务人员', is_system: 1 },
    { id: 'role-boss', role_code: 'BOSS', role_name: '管理层', is_system: 1 },
    { id: 'role-driver', role_code: 'DRIVER', role_name: '司机', is_system: 1 },
  ];

  const users = [
    { id: 'user-admin', username: 'admin', real_name: '系统管理员', password_hash: adminHash, email: 'admin@logistics.com', role_id: 'role-admin' },
    { id: 'user-sales1', username: 'sales1', real_name: 'AkinGbolahan', password_hash: hash, email: 'akin@logistics.com', role_id: 'role-sales' },
    { id: 'user-whcn1', username: 'warehouse_cn1', real_name: '李仓管', password_hash: hash, email: 'licg@logistics.com', role_id: 'role-wh-cn' },
    { id: 'user-opscn1', username: 'ops_cn1', real_name: '张运营', password_hash: hash, email: 'zhangops@logistics.com', role_id: 'role-ops-cn' },
    { id: 'user-opsus1', username: 'ops_us1', real_name: '赵运营', password_hash: hash, email: 'zhaoops@logistics.com', role_id: 'role-ops-us' },
    { id: 'user-whus1', username: 'warehouse_us1', real_name: '王仓管', password_hash: hash, email: 'wangcg@logistics.com', role_id: 'role-wh-us' },
    { id: 'user-fin1', username: 'finance1', real_name: '钱财务', password_hash: hash, email: 'qian@logistics.com', role_id: 'role-finance' },
    { id: 'user-boss1', username: 'boss1', real_name: '孙总', password_hash: hash, email: 'sun@logistics.com', role_id: 'role-boss' },
    { id: 'user-driver1', username: 'driver1', real_name: 'Ibrahim Musa', password_hash: hash, email: 'ibrahim@logistics.com', role_id: 'role-driver' },
    { id: 'user-driver2', username: 'driver2', real_name: 'Chukwu Obi', password_hash: hash, email: 'chukwu@logistics.com', role_id: 'role-driver' },
  ];

  const insertRole = db.prepare('INSERT INTO sys_role (id, role_code, role_name, is_system, status) VALUES (?, ?, ?, ?, ?)');
  for (const r of roles) insertRole.run(r.id, r.role_code, r.role_name, r.is_system, 'ACTIVE');

  const insertUser = db.prepare('INSERT INTO sys_user (id, username, real_name, password_hash, email, status) VALUES (?, ?, ?, ?, ?, ?)');
  const insertUserRole = db.prepare('INSERT INTO sys_user_role (id, user_id, role_id) VALUES (?, ?, ?)');
  for (const u of users) {
    insertUser.run(u.id, u.username, u.real_name, u.password_hash, u.email, 'ACTIVE');
    insertUserRole.run(uuid(), u.id, u.role_id);
  }

  // ============================================================
  // 2. 基础数据：国家 → 城市 → 站点 → 仓库
  // ============================================================

  db.exec(`
    INSERT INTO md_country (id, code, name_cn, name_en, continent, phone_code, currency_code, currency_name, currency_symbol) VALUES
    ('country-cn', 'CN', '中国', 'China', '亚洲', '+86', 'CNY', '人民币', '¥'),
    ('country-ng', 'NGA', '尼日利亚', 'Nigeria', '非洲', '+234', 'NGN', '奈拉', '₦'),
    ('country-gh', 'GHA', '加纳', 'Ghana', '非洲', '+233', 'GHS', '塞地', '₵');

    INSERT INTO md_city (id, country_id, code, name_cn, name_en) VALUES
    ('city-gz', 'country-cn', 'GZ', '广州', 'Guangzhou'),
    ('city-sz', 'country-cn', 'SZX', '深圳', 'Shenzhen'),
    ('city-hkg', 'country-cn', 'HKG', '香港', 'Hong Kong'),
    ('city-los', 'country-ng', 'LOS', '拉各斯', 'Lagos'),
    ('city-abv', 'country-ng', 'ABV', '阿布贾', 'Abuja'),
    ('city-acc', 'country-gh', 'ACC', '阿克拉', 'Accra');

    INSERT INTO md_site (id, city_id, code, name, site_type) VALUES
    ('site-gz', 'city-gz', 'GZ-MAIN', '白云区站点', 'ORIGIN'),
    ('site-sz', 'city-sz', 'SZ-MAIN', '福田区站点', 'ORIGIN'),
    ('site-los-ikej', 'city-los', 'IKEJ-STA', '伊科贾站点', 'DESTINATION'),
    ('site-los-abv', 'city-abv', 'ABV-STA', '阿布贾站点', 'DESTINATION'),
    ('site-acc', 'city-acc', 'ACC-STA', '阿克拉站点', 'DESTINATION');

    INSERT INTO md_warehouse (id, code, name, site_id, country_id, city_id, warehouse_type, manager_name, manager_phone, capacity) VALUES
    ('wh-gz', 'WH-GZ-001', '广州总仓', 'site-gz', 'country-cn', 'city-gz', 'ORIGIN', '李仓管', '13800000001', '5000 m³'),
    ('wh-sz', 'WH-SZ-001', '深圳集货区', 'site-sz', 'country-cn', 'city-sz', 'ORIGIN', '张仓管', '13800000002', '3000 m³'),
    ('wh-los', 'WH-LOS-001', '拉各斯主仓', 'site-los-ikej', 'country-ng', 'city-los', 'DESTINATION', 'Amina Yusuf', '+234-803-555-2001', '8000 m³'),
    ('wh-abv', 'WH-ABV-001', '阿布贾中转仓', 'site-los-abv', 'country-ng', 'city-abv', 'DESTINATION', 'Chukwu Obi', '+234-803-555-3001', '4000 m³'),
    ('wh-acc', 'WH-ACC-001', '阿克拉站点仓', 'site-acc', 'country-gh', 'city-acc', 'DESTINATION', 'Kwame Asante', '+233-501-234-001', '3000 m³');
  `);

  // ============================================================
  // 3. 供应商、线路、汇率
  // ============================================================

  db.exec(`
    INSERT INTO md_supplier (id, code, name, supplier_type, contact_person, phone) VALUES
    ('sup-msk', 'MSK', '马士基', 'CARRIER', 'John', '+86-20-88881111'),
    ('sup-cosco', 'COSCO', '中远海运', 'CARRIER', 'Li Wei', '+86-20-88882222'),
    ('sup-et', 'ET', '埃塞俄比亚航空', 'CARRIER', 'Abebe', '+251-11-5551234'),
    ('sup-cz', 'CZ', '中国南方航空', 'CARRIER', '赵经理', '+86-20-86681234'),
    ('sup-truck1', 'TRUCK-GZ', '广州顺达拖车', 'TRUCKING', '刘师傅', '13512345678'),
    ('sup-truck2', 'TRUCK-SZ', '深圳运力物流', 'TRUCKING', '陈师傅', '13612345678'),
    ('sup-sf', 'SF', '顺丰', 'EXPRESS', '客服', '95338'),
    ('sup-yd', 'YUNDA', '韵达', 'EXPRESS', '客服', '95546'),
    ('sup-yt', 'YTO', '圆通', 'EXPRESS', '客服', '95554'),
    ('sup-zt', 'ZTO', '中通', 'EXPRESS', '客服', '95311'),
    ('sup-st', 'STO', '申通', 'EXPRESS', '客服', '95543');

    INSERT INTO md_route (id, origin_country, origin_city, dest_country, dest_city, transport_type, transit_days, volume_ratio) VALUES
    ('route-gz-los-sea', 'CN', 'GZ', 'NGA', 'LOS', 'SEA', '25-35天', 700),
    ('route-gz-los-air', 'CN', 'GZ', 'NGA', 'LOS', 'AIR', '7-10天', 6000),
    ('route-sz-los-sea', 'CN', 'SZX', 'NGA', 'LOS', 'SEA', '28-38天', 700),
    ('route-hkg-los-sea', 'CN', 'HKG', 'NGA', 'LOS', 'SEA', '22-30天', 700),
    ('route-gz-abv-sea', 'CN', 'GZ', 'NGA', 'ABV', 'SEA', '30-40天', 700),
    ('route-hkg-acc-sea', 'CN', 'HKG', 'GHA', 'ACC', 'SEA', '25-35天', 700);

    INSERT INTO md_fee_item (id, code, name, direction) VALUES
    ('fi-freight', 'FREIGHT', '运费', 'RECEIVABLE'),
    ('fi-first-weight', 'FIRST_WEIGHT', '首重', 'RECEIVABLE'),
    ('fi-cont-weight', 'CONTINUATION_WEIGHT', '续重', 'RECEIVABLE'),
    ('fi-customs-imp', 'CUSTOMS_IMPORT', '进口报关费', 'PAYABLE'),
    ('fi-last-mile', 'LAST_MILE', '到门费用', 'PAYABLE'),
    ('fi-discount', 'FREIGHT_DISCOUNT', '运费折扣', 'RECEIVABLE');

    INSERT INTO fx_rate (id, from_currency, to_currency, rate, rate_date, is_latest) VALUES
    ('fx-eur', 'EUR', 'CNY', 7.6923, '2026-03-20', 1),
    ('fx-gbp', 'GBP', 'CNY', 9.0909, '2026-03-20', 1),
    ('fx-ghs', 'GHS', 'CNY', 0.5814, '2026-03-20', 1),
    ('fx-ngn', 'NGN', 'CNY', 0.0047, '2026-03-20', 1),
    ('fx-usd', 'USD', 'CNY', 7.1429, '2026-03-20', 1);
  `);

  // ============================================================
  // 4. CRM 客户（6家，对齐 Web Mock 数据）
  // ============================================================

  const customers = [
    { id: 'cust-1', code: 'A1B0', name: 'Web联调客户-S1836', type: 'COMPANY_CN', country: '中国', contact: '张三', phone: '13800001111', owner: 'user-sales1', pool: 'PRIVATE' },
    { id: 'cust-2', code: 'A1B1', name: 'Web联调客户-S1836-2', type: 'COMPANY_CN', country: '中国', contact: '李四', phone: '13800002222', owner: 'user-sales1', pool: 'PRIVATE' },
    { id: 'cust-3', code: 'C2D0', name: '联调航海客户PSea-2', type: 'COMPANY_CN', country: '中国', contact: '王五', phone: '13800003333', owner: 'user-sales1', pool: 'PRIVATE' },
    { id: 'cust-4', code: 'E3F0', name: '联调综合客户P1-2026', type: 'COMPANY_CN', country: '中国', contact: '赵六', phone: '13800004444', owner: 'user-sales1', pool: 'PRIVATE' },
    { id: 'cust-5', code: 'G4H0', name: '深圳旺达贸易', type: 'COMPANY_CN', country: '中国', contact: '钱七', phone: '13800005555', owner: 'user-sales1', pool: 'PRIVATE' },
    { id: 'cust-6', code: 'J5K0', name: '广州金辉国际', type: 'COMPANY_CN', country: '中国', contact: '孙八', phone: '13800006666', owner: 'user-sales1', pool: 'PRIVATE' },
    // 公海池客户（未认领）
    { id: 'cust-7', code: 'M7N0', name: '义乌小商品市场', type: 'COMPANY_CN', country: '中国', contact: '周九', phone: '13800007777', owner: null, pool: 'PUBLIC' },
    { id: 'cust-8', code: 'P8Q0', name: '东莞机械制造', type: 'COMPANY_CN', country: '中国', contact: '吴十', phone: '13800008888', owner: null, pool: 'PUBLIC' },
    { id: 'cust-9', code: 'R9S0', name: '佛山家具出口', type: 'COMPANY_CN', country: '中国', contact: '郑十一', phone: '13800009999', owner: null, pool: 'PUBLIC' },
  ];

  const insertCust = db.prepare('INSERT INTO crm_customer (id, customer_code, customer_name, customer_type, country, contact_name, contact_phone, owner_user_id, pool_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const c of customers) {
    insertCust.run(c.id, c.code, c.name, c.type, c.country, c.contact, c.phone, c.owner, c.pool, 'ACTIVE', now);
  }

  // 每个客户添加收件人
  db.exec(`
    INSERT INTO crm_recipient_address (id, customer_id, recipient_name, recipient_phone, country, city, detail_address, is_default) VALUES
    ('addr-1', 'cust-5', 'Amina Yusuf', '+234-803-555-2001', '尼日利亚', '拉各斯', '15 Awolowo Way, Ikeja, Lagos', 1),
    ('addr-2', 'cust-6', 'Temi Balogun', '+234-805-330-1001', '尼日利亚', '拉各斯', 'Lekki Phase 1, Lagos', 1),
    ('addr-3', 'cust-1', 'Ada Nwosu', '+234-903-832-1727', '尼日利亚', '拉各斯', '23 Allen Avenue, Ikeja', 1),
    ('addr-4', 'cust-2', 'Emeka Eze', '+234-810-554-7820', '尼日利亚', '阿布贾', 'Garki District, Abuja', 1),
    ('addr-5', 'cust-3', 'Kwame Asante', '+234-701-234-5678', '加纳', '阿克拉', 'East Legon, Accra', 1);
  `);

  // ============================================================
  // 5. 订单（6条主单 + 子单 + 包裹）
  // ============================================================

  const orders = [
    { id: 'ord-1', no: 'S-20260320990003', entry: 'A1B001', line: 'SEA', cust: 'cust-1', cust_name: 'Web联调客户-S1836', route: 'CAN.CHN→LOS.NGA', status: 'INBOUND', pieces: 2, weight: 12.5, consignee: 'Ada Nwosu', consignee_phone: '+234-903-832-1727' },
    { id: 'ord-2', no: 'S-20260320000005', entry: 'A1B002', line: 'SEA', cust: 'cust-2', cust_name: 'Web联调客户-S1836-2', route: 'SZ.CN→LOS.NGA', status: 'INBOUND', pieces: 1, weight: 5.2, consignee: 'Emeka Eze', consignee_phone: '+234-810-554-7820' },
    { id: 'ord-3', no: 'S-20260320000001', entry: 'C2D001', line: 'SEA', cust: 'cust-3', cust_name: '联调航海客户PSea-2', route: 'GZ.CN→LOS.NGA', status: 'PENDING_INBOUND', pieces: 2, weight: 8.0, consignee: 'Kwame Asante', consignee_phone: '+234-701-234-5678' },
    { id: 'ord-4', no: 'S-20260320000002', entry: 'E3F001', line: 'SEA', cust: 'cust-4', cust_name: '联调综合客户P1-2026', route: 'GZ.CN→LOS.NGA', status: 'DEPARTED', pieces: 2, weight: 15.0, consignee: 'Amina Yusuf', consignee_phone: '+234-803-555-2001' },
    { id: 'ord-5', no: 'S-20260320000003', entry: 'G4H001', line: 'SEA', cust: 'cust-5', cust_name: '深圳旺达贸易', route: 'GZ.CN→LOS.NGA', status: 'ARRIVED', pieces: 3, weight: 25.0, consignee: 'Amina Yusuf', consignee_phone: '+234-803-555-2001' },
    { id: 'ord-6', no: 'S-20260320000004', entry: 'J5K001', line: 'SEA', cust: 'cust-6', cust_name: '广州金辉国际', route: 'GZ.CN→LOS.NGA', status: 'PENDING_INBOUND', pieces: 5, weight: 30.0, consignee: 'Temi Balogun', consignee_phone: '+234-805-330-1001' },
  ];

  const insertOrder = db.prepare(`INSERT INTO oms_order (id, order_no, warehouse_entry_no, business_line, customer_id, customer_name, sales_user_id, route_code, order_status, total_declared_pieces, total_declared_weight_kg, consignee_name, consignee_phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  for (const o of orders) {
    insertOrder.run(o.id, o.no, o.entry, o.line, o.cust, o.cust_name, 'user-sales1', o.route, o.status, o.pieces, o.weight, o.consignee, o.consignee_phone, now);
  }

  // 子单
  const insertSub = db.prepare('INSERT INTO oms_sub_order (id, sub_order_no, order_id, line_no, business_line, sub_status, route_code, pieces, actual_weight_kg, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  const subOrders = [
    { id: 'sub-1-1', no: 'S-20260320990003-01', order_id: 'ord-1', line: 1, status: 'INBOUND', route: 'CAN.CHN→LOS.NGA', pieces: 1, weight: 6.5 },
    { id: 'sub-1-2', no: 'S-20260320990003-02', order_id: 'ord-1', line: 2, status: 'PENDING_INBOUND', route: 'CAN.CHN→LOS.NGA', pieces: 1, weight: 6.0 },
    { id: 'sub-2-1', no: 'S-20260320000005-01', order_id: 'ord-2', line: 1, status: 'INBOUND', route: 'SZ.CN→LOS.NGA', pieces: 1, weight: 5.2 },
    { id: 'sub-3-1', no: 'S-20260320000001-01', order_id: 'ord-3', line: 1, status: 'PENDING_INBOUND', route: 'GZ.CN→LOS.NGA', pieces: 1, weight: 4.0 },
    { id: 'sub-3-2', no: 'S-20260320000001-02', order_id: 'ord-3', line: 2, status: 'PENDING_INBOUND', route: 'GZ.CN→LOS.NGA', pieces: 1, weight: 4.0 },
    { id: 'sub-4-1', no: 'S-20260320000002-01', order_id: 'ord-4', line: 1, status: 'IN_TRANSIT', route: 'GZ.CN→LOS.NGA', pieces: 2, weight: 15.0, },
    { id: 'sub-5-1', no: 'S-20260320000003-01', order_id: 'ord-5', line: 1, status: 'ARRIVED', route: 'GZ.CN→LOS.NGA', pieces: 3, weight: 25.0 },
    { id: 'sub-6-1', no: 'S-20260320000004-01', order_id: 'ord-6', line: 1, status: 'PENDING_INBOUND', route: 'GZ.CN→LOS.NGA', pieces: 3, weight: 18.0 },
    { id: 'sub-6-2', no: 'S-20260320000004-02', order_id: 'ord-6', line: 2, status: 'PENDING_INBOUND', route: 'GZ.CN→LOS.NGA', pieces: 2, weight: 12.0 },
  ];

  for (const s of subOrders) {
    insertSub.run(s.id, s.no, s.order_id, s.line, 'SEA', s.status, s.route, s.pieces, s.weight, now);
  }

  // 初始包裹
  db.exec(`
    INSERT INTO oms_package_initial (id, order_id, line_no, express_company, tracking_no, goods_name, goods_category, pieces, declared_weight_kg) VALUES
    ('pkg-i-1', 'ord-1', 1, '顺丰', 'SF1234567890', '电子产品', 'ELECTRONICS', 1, 6.5),
    ('pkg-i-2', 'ord-1', 2, '韵达', 'YT2603210001', '服装鞋帽', 'APPAREL', 1, 6.0),
    ('pkg-i-3', 'ord-2', 1, '圆通', 'YT2603210002', '日用品', 'DAILY_USE', 1, 5.2),
    ('pkg-i-4', 'ord-3', 1, '中通', 'ZT2603210001', '电子产品', 'ELECTRONICS', 1, 4.0),
    ('pkg-i-5', 'ord-3', 2, '申通', 'ST2603210001', '美妆个护', 'BEAUTY', 1, 4.0),
    ('pkg-i-6', 'ord-4', 1, '顺丰', 'SF2603210002', '机械配件', 'MACHINE_PARTS', 2, 15.0),
    ('pkg-i-7', 'ord-5', 1, '顺丰', 'SF2603210003', '电子产品', 'ELECTRONICS', 3, 25.0),
    ('pkg-i-8', 'ord-6', 1, '韵达', 'YD2603210003', '服装鞋帽', 'APPAREL', 3, 18.0),
    ('pkg-i-9', 'ord-6', 2, '中通', 'ZT2603210004', '日用品', 'DAILY_USE', 2, 12.0);
  `);

  // ============================================================
  // 5.5 WMS 库存（已入库的子单 → 在库/已装箱/已出库）
  // ============================================================

  db.exec(`
    INSERT INTO wms_stock (id, business_line, warehouse_id, order_id, sub_order_id, stock_status, pieces, gross_weight_kg, volume_cbm, location_code, created_at) VALUES
    ('stk-1', 'SEA', 'wh-gz', 'ord-1', 'sub-1-1', 'IN_STOCK',  1, 6.5,  0.045, 'A-01-03',  '${now}'),
    ('stk-2', 'SEA', 'wh-gz', 'ord-2', 'sub-2-1', 'IN_STOCK',  1, 5.2,  0.030, 'A-02-01',  '${now}'),
    ('stk-3', 'SEA', 'wh-gz', 'ord-4', 'sub-4-1', 'PACKED',    2, 15.0, 0.120, 'B-03-05',  '${now}'),
    ('stk-4', 'SEA', 'wh-gz', 'ord-5', 'sub-5-1', 'OUTBOUND',  3, 25.0, 0.180, 'C-01-02',  '${now}'),
    ('stk-5', 'SEA', 'wh-sz', 'ord-2', 'sub-2-1', 'IN_STOCK',  1, 5.2,  0.030, 'SZ-A-12',  '${now}'),
    ('stk-6', 'SEA', 'wh-gz', 'ord-1', 'sub-1-2', 'ALLOCATED', 1, 6.0,  0.040, 'A-01-04',  '${now}'),
    ('stk-7', 'SEA', 'wh-gz', 'ord-6', 'sub-6-1', 'IN_STOCK',  3, 18.0, 0.140, 'A-04-02',  '${now}'),
    ('stk-8', 'SEA', 'wh-gz', 'ord-6', 'sub-6-2', 'IN_STOCK',  2, 12.0, 0.090, 'A-04-03',  '${now}');
  `);

  // ============================================================
  // 6. TMS 任务（10条 JOB，对齐 Web 起运国办数据）
  // ============================================================

  db.exec(`
    INSERT INTO tms_job (id, job_no, business_line, route_code, origin_port, dest_port, carrier_name, bill_no, container_no, container_type, cargo_type, service_type, job_status, current_node, total_pieces, total_weight_kg, etd, eta, created_by, created_at) VALUES
    ('job-1', 'S-JOB26030001', 'SEA', 'CAN.CHN→LOS.NGN', 'CAN', 'LOS', '马士基', 'MBL202603210001', 'CSLU2185436', '40HQ', 'GENERAL', 'EXPRESS', 'ARRIVED', 'ARRIVAL', 38, 1820, '2026-03-10', '2026-04-03', 'user-opscn1', '${now}'),
    ('job-2', 'S-JOB26030002', 'SEA', 'HKG.CHN→LOS.NGN', 'HKG', 'LOS', '中远海运', 'MBL202603210002', 'CSLU2185436', '40GP', 'GENERAL', 'EXPRESS', 'ARRIVED', 'ARRIVAL', 25, 1200, '2026-03-12', '2026-04-05', 'user-opscn1', '${now}'),
    ('job-3', 'S-JOB26030003', 'SEA', 'CAN.CHN→LOS.NGN', 'CAN', 'LOS', '马士基', NULL, 'EGLV5678901', '40HQ', 'SENSITIVE', 'EXPRESS', 'CUSTOMS_EXPORT', 'CUSTOMS_EXPORT', 30, 1500, '2026-04-15', '2026-05-10', 'user-opscn1', '${now}'),
    ('job-4', 'S-JOB26030004', 'SEA', 'CAN.CHN→LOS.NGN', 'CAN', 'LOS', '马士基', NULL, 'HLXU7890412', '40HQ', 'GENERAL', 'EXPRESS', 'LOADING', 'WAREHOUSE_IN', 20, 980, '2026-04-20', '2026-05-15', 'user-opscn1', '${now}'),
    ('job-5', 'S-JOB26030005', 'SEA', 'HKG.CHN→LOS.NGN', 'HKG', 'LOS', '中远海运', NULL, 'TCLU9012345', '40HQ', 'GENERAL', 'EXPRESS', 'IN_TRANSIT', 'IN_TRANSIT', 35, 1650, '2026-03-28', '2026-04-18', 'user-opscn1', '${now}'),
    ('job-6', 'S-JOB26030007', 'SEA', 'SZX.CHN→LOS.NGN', 'SZX', 'LOS', '中远海运', NULL, 'TRLU1234567', '40GP', 'SENSITIVE', 'EXPRESS', 'IN_TRANSIT', 'CUSTOMS_IMPORT', 22, 1100, '2026-03-25', '2026-04-14', 'user-opscn1', '${now}'),
    ('job-7', 'S-JOB26030008', 'SEA', 'CAN.CHN→LOS.NGN', 'CAN', 'LOS', '马士基', NULL, 'BMOU2345678', '40HQ', 'GENERAL', 'EXPRESS', 'CUSTOMS_EXPORT', 'CUSTOMS_EXPORT', 45, 2100, '2026-04-15', '2026-05-10', 'user-opscn1', '${now}'),
    ('job-8', 'S-JOB26030010', 'SEA', 'HKG.CHN→LOS.NGN', 'HKG', 'LOS', '中远海运', NULL, 'SEGU5678901', '40GP', 'SENSITIVE', 'EXPRESS', 'DEPARTED', 'DEPARTURE', 28, 1350, '2026-04-08', '2026-05-02', 'user-opscn1', '${now}'),
    ('job-9', 'S-JOB26040001', 'SEA', 'CAN.CHN→LOS.NGN', 'CAN', 'LOS', NULL, NULL, 'CSLU1234567', '40HQ', 'GENERAL', 'EXPRESS', 'LOADING', 'WAREHOUSE_IN', 45, 1200, '2026-04-20', '2026-05-15', 'user-opscn1', '${now}'),
    ('job-10', 'S-JOB26040002', 'SEA', 'SZX.CHN→LOS.NGN', 'SZX', 'LOS', '马士基', NULL, 'MSKU7654321', '40GP', 'GENERAL', 'EXPRESS', 'LOADING', 'WAREHOUSE_IN', 28, 470, '2026-04-12', '2026-05-08', 'user-opscn1', '${now}');
  `);

  // 装箱单元
  db.exec(`
    INSERT INTO tms_shipping_unit (id, unit_no, business_line, unit_type, container_type, warehouse_id, job_id, route_code, unit_status, max_weight_kg, max_volume_cbm, current_weight_kg, current_volume_cbm) VALUES
    ('unit-1', 'CSLU1234567', 'SEA', 'CONTAINER', '40HQ', 'wh-gz', 'job-9', 'CAN.CHN→LOS.NGN', 'LOADING', 26000, 67.5, 1200, 38.5),
    ('unit-2', 'MSKU7654321', 'SEA', 'CONTAINER', '40GP', 'wh-sz', 'job-10', 'SZX.CHN→LOS.NGN', 'LOADING', 21000, 33.0, 470, 28.2);
  `);

  // ============================================================
  // 7. 调拨（3条，对齐 Web 调拨管理数据）
  // ============================================================

  db.exec(`
    INSERT INTO wms_transfer (id, transfer_no, business_line, direction, from_warehouse_name, to_warehouse_name, route_label, job_id, total_pieces, total_weight_kg, transfer_status, created_at) VALUES
    ('trf-1', 'S-T-20260321-0001', 'SEA', 'SATELLITE_TO_MAIN', '深圳集货区', '广州总仓', '深圳集货区→广州总仓→拉各斯主仓', 'job-7', 5, 120, 'PENDING', '${now}'),
    ('trf-2', 'S-T-20260321-0002', 'SEA', 'MAIN_TO_SATELLITE', '广州总仓', '佛山拼货区', '广州总仓→佛山拼货区', 'job-8', 2, 85, 'IN_TRANSIT', '${now}'),
    ('trf-3', 'S-T-20260321-0003', 'SEA', 'MAIN_TO_SATELLITE', '广州总仓', '海珠区站点', '广州总仓→海珠区站点', 'job-8', 3, 60, 'ARRIVED', '${now}');
  `);

  // ============================================================
  // 8. DPN 末端配送（对齐 Web 到达国数据）
  // ============================================================

  db.exec(`
    INSERT INTO pod_dpn (id, dpn_no, business_line, dpn_type, from_site, to_site, dpn_status, total_orders, total_pieces, total_weight_kg, created_by, created_at) VALUES
    ('dpn-1', 'DPN-20260320-9901', 'SEA', 'DELIVERY', '广州起运站', '拉各斯新到达站', 'PENDING_DISPATCH', 6, 6, 180, 'user-opsus1', '${now}'),
    ('dpn-2', 'DPN-20260320-9901-dup', 'SEA', 'DELIVERY', '广州起运站', '拉各斯新到达站', 'IN_TRANSIT', 6, 4, 120, 'user-opsus1', '${now}'),
    ('dpn-3', 'DPN-20260320-1561', 'SEA', 'TRANSFER', '1111111111', '1111111111', 'PENDING_BIND', 0, 0, 0, 'user-opsus1', '${now}'),
    ('dpn-4', 'DPN-20260320-0960', 'SEA', 'TRANSFER', '1111111111111111111', '1111111111111111111', 'PENDING_BIND', 0, 0, 0, 'user-opsus1', '${now}');

    INSERT INTO pod_delivery_task (id, dpn_id, task_no, sub_order_no, recipient_name, recipient_phone, recipient_address, service_type, task_status, driver_name, driver_phone, created_at) VALUES
    ('dt-1', 'dpn-1', 'S-20260320990001-01', 'S-20260320990001', 'Amina Yusuf', '+234 803 555 2001', '15 Awolowo Way, Ikeja, Lagos', 'DELIVERY', 'IN_TRANSIT', 'Ibrahim Musa', '+234-803-555-4001', '${now}'),
    ('dt-2', 'dpn-1', 'S-20260321990001-01', 'S-20260321990001', 'Temi Balogun', '+234 805 330 1001', 'Lekki Phase 1, Lagos', 'DELIVERY', 'PENDING', NULL, NULL, '${now}');

    INSERT INTO pod_pickup (id, pickup_no, dpn_id, sub_order_no, tracking_no, recipient_name, recipient_phone, pickup_station, pickup_code, pieces, weight_kg, notify_status, created_at) VALUES
    ('pk-1', 'P-20260411-0901', 'dpn-1', 'S-202603190041-01', 'SF2603190041', 'Ada Nwosu', '+234 903 832 1727', 'IKEJ STA', '891234', 2, 8.5, 'NOTIFIED', '${now}'),
    ('pk-2', 'P-20260410-0902', 'dpn-2', 'A-202603190042-01', 'YT2603190042', 'Emeka Eze', '+234 810 554 7820', 'ABUJ STA', '567890', 1, 3.2, 'PICKED_UP', '${now}');
  `);

  // ============================================================
  // 9. 无单快递（2条）
  // ============================================================

  db.exec(`
    INSERT INTO wms_unmatched_package (id, business_line, warehouse_id, tracking_no, express_company, sender_name, sender_phone, pieces, gross_weight_kg, customer_hint, status, created_at) VALUES
    ('unm-1', 'SEA', 'wh-gz', 'ZT2603210003', '中通', '张先生', '138****1234', 1, 2.5, '可能是旺达的货', 'PENDING', '${now}'),
    ('unm-2', 'SEA', 'wh-gz', 'SF2603210099', '顺丰', '李女士', '139****5678', 2, 8.0, NULL, 'PENDING', '${now}');
  `);

  console.log('Seed data inserted successfully');
}
