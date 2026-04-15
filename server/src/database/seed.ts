import { getDb } from './schema';
import { createCustomerRecord, type CustomerCreatePayload } from './customerRepo';
import { createOrder } from './orderRepo';
import { createJob, bindSubOrders, sealUnit, advanceNode } from './jobRepo';
import { createInbound, createDestInbound } from './warehouseRepo';
import { createDeliveryDpn, createTransferDpn } from './dpnRepo';
import { recordFee, recordPayment } from './feeRepo';
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

    INSERT INTO md_fee_item (id, code, name, name_en, direction) VALUES
    -- 应收（向客户收）
    ('fi-freight',         'FREIGHT',             '运费',         'Freight',                 'RECEIVABLE'),
    ('fi-first-weight',    'FIRST_WEIGHT',        '首重',         'First Weight',            'RECEIVABLE'),
    ('fi-cont-weight',     'CONTINUATION_WEIGHT', '续重',         'Continuation Weight',     'RECEIVABLE'),
    ('fi-discount',        'FREIGHT_DISCOUNT',    '运费折扣',     'Freight Discount',        'RECEIVABLE'),
    ('fi-insurance',       'INSURANCE',           '保险费',       'Insurance',               'RECEIVABLE'),
    ('fi-handling',        'HANDLING',            '操作费',       'Handling Fee',            'RECEIVABLE'),
    -- 应付（付供应商）
    ('fi-ocean-freight',   'OCEAN_FREIGHT',       '海运费',       'Ocean Freight',           'PAYABLE'),
    ('fi-air-freight',     'AIR_FREIGHT',         '空运费',       'Air Freight',             'PAYABLE'),
    ('fi-trucking',        'TRUCKING',            '拖车费',       'Trucking',                'PAYABLE'),
    ('fi-customs-exp',     'CUSTOMS_EXPORT',      '出口报关费',   'Export Customs',          'PAYABLE'),
    ('fi-customs-imp',     'CUSTOMS_IMPORT',      '进口报关费',   'Import Customs',          'PAYABLE'),
    ('fi-clearance',       'CLEARANCE',           '清关费',       'Customs Clearance',       'PAYABLE'),
    ('fi-fuel-surcharge',  'FUEL_SURCHARGE',      '燃油附加费',   'Fuel Surcharge',          'PAYABLE'),
    ('fi-warehousing',     'WAREHOUSING',         '仓租费',       'Warehousing',             'PAYABLE'),
    ('fi-last-mile',       'LAST_MILE',           '末端派送费',   'Last Mile Delivery',      'PAYABLE'),
    ('fi-doc-fee',         'DOC_FEE',             '单证费',       'Documentation Fee',       'PAYABLE');

    -- ============================================================
    -- 物流节点模板 (md_logistics_node)
    -- 海运起运国 5 节点 + 到达国 7 节点
    -- 空运起运国 4 节点 + 到达国 6 节点
    -- ============================================================

    -- 4 条海运线路（GZ→LOS / SZX→LOS / HKG→LOS / GZ→ABV / HKG→ACC）共用一份节点定义
    INSERT INTO md_logistics_node (id, route_id, node_code, node_name, node_name_en, node_type, sort_order, is_required) VALUES
    -- route-gz-los-sea
    ('ln-gzlos-01','route-gz-los-sea','WAREHOUSE_OUT','已离库','Departed Warehouse','WAREHOUSE_OUT',1,1),
    ('ln-gzlos-02','route-gz-los-sea','CUSTOMS_EXPORT','出口报关','Export Customs Filing','CUSTOMS_EXPORT',2,1),
    ('ln-gzlos-03','route-gz-los-sea','CUSTOMS_INSPECT','海关查验','Customs Inspection','CUSTOMS_EXPORT',3,0),
    ('ln-gzlos-04','route-gz-los-sea','CUSTOMS_RELEASE','海关放行','Customs Released','CUSTOMS_EXPORT',4,1),
    ('ln-gzlos-05','route-gz-los-sea','DEPARTURE','已起运','Vessel Departed','DEPARTURE',5,1),
    ('ln-gzlos-06','route-gz-los-sea','IN_TRANSIT','在途运输','In Transit','IN_TRANSIT',6,1),
    ('ln-gzlos-07','route-gz-los-sea','ARRIVAL','已到港','Arrived at Port','ARRIVAL',7,1),
    ('ln-gzlos-08','route-gz-los-sea','CUSTOMS_IMPORT','进口申报','Import Filing','CUSTOMS_IMPORT',8,1),
    ('ln-gzlos-09','route-gz-los-sea','CUSTOMS_INSPECT_IMP','进口查验','Import Inspection','CUSTOMS_IMPORT',9,0),
    ('ln-gzlos-10','route-gz-los-sea','CUSTOMS_CLEARED','进口放行','Import Cleared','CUSTOMS_IMPORT',10,1),
    ('ln-gzlos-11','route-gz-los-sea','WAREHOUSE_IN','到达入仓','Arrived at Warehouse','WAREHOUSE_IN',11,1),
    ('ln-gzlos-12','route-gz-los-sea','SIGNED','已签收','Delivered','SIGNED',12,1),

    -- route-sz-los-sea
    ('ln-szlos-01','route-sz-los-sea','WAREHOUSE_OUT','已离库','Departed Warehouse','WAREHOUSE_OUT',1,1),
    ('ln-szlos-02','route-sz-los-sea','CUSTOMS_EXPORT','出口报关','Export Customs Filing','CUSTOMS_EXPORT',2,1),
    ('ln-szlos-03','route-sz-los-sea','CUSTOMS_INSPECT','海关查验','Customs Inspection','CUSTOMS_EXPORT',3,0),
    ('ln-szlos-04','route-sz-los-sea','CUSTOMS_RELEASE','海关放行','Customs Released','CUSTOMS_EXPORT',4,1),
    ('ln-szlos-05','route-sz-los-sea','DEPARTURE','已起运','Vessel Departed','DEPARTURE',5,1),
    ('ln-szlos-06','route-sz-los-sea','IN_TRANSIT','在途运输','In Transit','IN_TRANSIT',6,1),
    ('ln-szlos-07','route-sz-los-sea','ARRIVAL','已到港','Arrived at Port','ARRIVAL',7,1),
    ('ln-szlos-08','route-sz-los-sea','CUSTOMS_IMPORT','进口申报','Import Filing','CUSTOMS_IMPORT',8,1),
    ('ln-szlos-09','route-sz-los-sea','CUSTOMS_INSPECT_IMP','进口查验','Import Inspection','CUSTOMS_IMPORT',9,0),
    ('ln-szlos-10','route-sz-los-sea','CUSTOMS_CLEARED','进口放行','Import Cleared','CUSTOMS_IMPORT',10,1),
    ('ln-szlos-11','route-sz-los-sea','WAREHOUSE_IN','到达入仓','Arrived at Warehouse','WAREHOUSE_IN',11,1),
    ('ln-szlos-12','route-sz-los-sea','SIGNED','已签收','Delivered','SIGNED',12,1),

    -- route-hkg-los-sea
    ('ln-hklos-01','route-hkg-los-sea','WAREHOUSE_OUT','已离库','Departed Warehouse','WAREHOUSE_OUT',1,1),
    ('ln-hklos-02','route-hkg-los-sea','CUSTOMS_EXPORT','出口报关','Export Customs Filing','CUSTOMS_EXPORT',2,1),
    ('ln-hklos-03','route-hkg-los-sea','CUSTOMS_INSPECT','海关查验','Customs Inspection','CUSTOMS_EXPORT',3,0),
    ('ln-hklos-04','route-hkg-los-sea','CUSTOMS_RELEASE','海关放行','Customs Released','CUSTOMS_EXPORT',4,1),
    ('ln-hklos-05','route-hkg-los-sea','DEPARTURE','已起运','Vessel Departed','DEPARTURE',5,1),
    ('ln-hklos-06','route-hkg-los-sea','IN_TRANSIT','在途运输','In Transit','IN_TRANSIT',6,1),
    ('ln-hklos-07','route-hkg-los-sea','ARRIVAL','已到港','Arrived at Port','ARRIVAL',7,1),
    ('ln-hklos-08','route-hkg-los-sea','CUSTOMS_IMPORT','进口申报','Import Filing','CUSTOMS_IMPORT',8,1),
    ('ln-hklos-09','route-hkg-los-sea','CUSTOMS_INSPECT_IMP','进口查验','Import Inspection','CUSTOMS_IMPORT',9,0),
    ('ln-hklos-10','route-hkg-los-sea','CUSTOMS_CLEARED','进口放行','Import Cleared','CUSTOMS_IMPORT',10,1),
    ('ln-hklos-11','route-hkg-los-sea','WAREHOUSE_IN','到达入仓','Arrived at Warehouse','WAREHOUSE_IN',11,1),
    ('ln-hklos-12','route-hkg-los-sea','SIGNED','已签收','Delivered','SIGNED',12,1),

    -- route-gz-abv-sea
    ('ln-gzabv-01','route-gz-abv-sea','WAREHOUSE_OUT','已离库','Departed Warehouse','WAREHOUSE_OUT',1,1),
    ('ln-gzabv-02','route-gz-abv-sea','CUSTOMS_EXPORT','出口报关','Export Customs Filing','CUSTOMS_EXPORT',2,1),
    ('ln-gzabv-03','route-gz-abv-sea','CUSTOMS_INSPECT','海关查验','Customs Inspection','CUSTOMS_EXPORT',3,0),
    ('ln-gzabv-04','route-gz-abv-sea','CUSTOMS_RELEASE','海关放行','Customs Released','CUSTOMS_EXPORT',4,1),
    ('ln-gzabv-05','route-gz-abv-sea','DEPARTURE','已起运','Vessel Departed','DEPARTURE',5,1),
    ('ln-gzabv-06','route-gz-abv-sea','IN_TRANSIT','在途运输','In Transit','IN_TRANSIT',6,1),
    ('ln-gzabv-07','route-gz-abv-sea','ARRIVAL','已到港','Arrived at Port','ARRIVAL',7,1),
    ('ln-gzabv-08','route-gz-abv-sea','CUSTOMS_IMPORT','进口申报','Import Filing','CUSTOMS_IMPORT',8,1),
    ('ln-gzabv-09','route-gz-abv-sea','CUSTOMS_INSPECT_IMP','进口查验','Import Inspection','CUSTOMS_IMPORT',9,0),
    ('ln-gzabv-10','route-gz-abv-sea','CUSTOMS_CLEARED','进口放行','Import Cleared','CUSTOMS_IMPORT',10,1),
    ('ln-gzabv-11','route-gz-abv-sea','WAREHOUSE_IN','到达入仓','Arrived at Warehouse','WAREHOUSE_IN',11,1),
    ('ln-gzabv-12','route-gz-abv-sea','SIGNED','已签收','Delivered','SIGNED',12,1),

    -- route-hkg-acc-sea
    ('ln-hkacc-01','route-hkg-acc-sea','WAREHOUSE_OUT','已离库','Departed Warehouse','WAREHOUSE_OUT',1,1),
    ('ln-hkacc-02','route-hkg-acc-sea','CUSTOMS_EXPORT','出口报关','Export Customs Filing','CUSTOMS_EXPORT',2,1),
    ('ln-hkacc-03','route-hkg-acc-sea','CUSTOMS_INSPECT','海关查验','Customs Inspection','CUSTOMS_EXPORT',3,0),
    ('ln-hkacc-04','route-hkg-acc-sea','CUSTOMS_RELEASE','海关放行','Customs Released','CUSTOMS_EXPORT',4,1),
    ('ln-hkacc-05','route-hkg-acc-sea','DEPARTURE','已起运','Vessel Departed','DEPARTURE',5,1),
    ('ln-hkacc-06','route-hkg-acc-sea','IN_TRANSIT','在途运输','In Transit','IN_TRANSIT',6,1),
    ('ln-hkacc-07','route-hkg-acc-sea','ARRIVAL','已到港','Arrived at Port','ARRIVAL',7,1),
    ('ln-hkacc-08','route-hkg-acc-sea','CUSTOMS_IMPORT','进口申报','Import Filing','CUSTOMS_IMPORT',8,1),
    ('ln-hkacc-09','route-hkg-acc-sea','CUSTOMS_INSPECT_IMP','进口查验','Import Inspection','CUSTOMS_IMPORT',9,0),
    ('ln-hkacc-10','route-hkg-acc-sea','CUSTOMS_CLEARED','进口放行','Import Cleared','CUSTOMS_IMPORT',10,1),
    ('ln-hkacc-11','route-hkg-acc-sea','WAREHOUSE_IN','到达入仓','Arrived at Warehouse','WAREHOUSE_IN',11,1),
    ('ln-hkacc-12','route-hkg-acc-sea','SIGNED','已签收','Delivered','SIGNED',12,1),

    -- route-gz-los-air (空运：少海关查验环节，多预配舱节点)
    ('ln-gzlosair-01','route-gz-los-air','WAREHOUSE_OUT','已离库','Departed Warehouse','WAREHOUSE_OUT',1,1),
    ('ln-gzlosair-02','route-gz-los-air','CUSTOMS_EXPORT','出口报关','Export Customs Filing','CUSTOMS_EXPORT',2,1),
    ('ln-gzlosair-03','route-gz-los-air','CUSTOMS_RELEASE','海关放行','Customs Released','CUSTOMS_EXPORT',3,1),
    ('ln-gzlosair-04','route-gz-los-air','DEPARTURE','航班起飞','Flight Departed','DEPARTURE',4,1),
    ('ln-gzlosair-05','route-gz-los-air','IN_TRANSIT','在途运输','In Transit','IN_TRANSIT',5,1),
    ('ln-gzlosair-06','route-gz-los-air','ARRIVAL','航班抵达','Flight Arrived','ARRIVAL',6,1),
    ('ln-gzlosair-07','route-gz-los-air','CUSTOMS_IMPORT','进口申报','Import Filing','CUSTOMS_IMPORT',7,1),
    ('ln-gzlosair-08','route-gz-los-air','CUSTOMS_CLEARED','进口放行','Import Cleared','CUSTOMS_IMPORT',8,1),
    ('ln-gzlosair-09','route-gz-los-air','WAREHOUSE_IN','到达入仓','Arrived at Warehouse','WAREHOUSE_IN',9,1),
    ('ln-gzlosair-10','route-gz-los-air','SIGNED','已签收','Delivered','SIGNED',10,1);

    INSERT INTO fx_rate (id, from_currency, to_currency, rate, rate_date, is_latest) VALUES
    ('fx-eur', 'EUR', 'CNY', 7.6923, '2026-03-20', 1),
    ('fx-gbp', 'GBP', 'CNY', 9.0909, '2026-03-20', 1),
    ('fx-ghs', 'GHS', 'CNY', 0.5814, '2026-03-20', 1),
    ('fx-ngn', 'NGN', 'CNY', 0.0047, '2026-03-20', 1),
    ('fx-usd', 'USD', 'CNY', 7.1429, '2026-03-20', 1);
  `);

  // ============================================================
  // 4. CRM 客户（9家）—— 全部走 createCustomerRecord，等同于前端新建流程
  // ============================================================

  const customerPayloads: CustomerCreatePayload[] = [
    {
      id: 'cust-1',
      customerCode: 'A1B0',
      name: '深圳市臻诚跨境贸易有限公司',
      customerType: 'COMPANY_CN',
      country: '中国',
      address: '深圳市南山区科技园南区数字大厦18楼1806室',
      industry: '电商',
      source: '线上推广',
      contact: { name: '张铭轩', phone: '13800001111', email: 'zhangmx@zhencheng-trade.cn' },
      salesId: 'user-sales1',
      poolType: 'PRIVATE',
      status: 'ACTIVE',
      preferredTransport: 'SEA',
      preferredPayment: 'T/T',
      remark: '老客户，每月发货 3~5 柜，偏好海运双清',
      enterpriseInfo: {
        entityType: 'COMPANY_CN',
        companyName: '深圳市臻诚跨境贸易有限公司',
        unifiedCreditCode: '91440300MA5G1234X8',
        legalRepresentative: '张铭轩',
        registeredAddress: '深圳市南山区科技园南区数字大厦18楼1806室',
        taxpayerId: '91440300MA5G1234X8',
        invoiceAddress: '深圳市南山区科技园南区数字大厦18楼1806室',
        invoicePhone: '0755-86001234',
        bankName: '中国工商银行深圳南山支行',
        bankAccount: '4000 1234 1000 8888 9999',
        contactPhone: '0755-86001234',
        contactEmail: 'zhangmx@zhencheng-trade.cn',
        documents: [],
      },
      logisticsInfo: {
        senderName: '张铭轩',
        senderPhone: '13800001111',
        senderAddress: '深圳市南山区科技园南区数字大厦18楼1806室',
        senderCity: '深圳',
        senderCountry: '中国',
        consigneeName: 'Ada Nwosu',
        consigneePhone: '+234-903-832-1727',
        consigneeCountry: '尼日利亚',
        consigneeCity: '拉各斯',
        consigneeZipCode: '100001',
        consigneeAddress: '23 Allen Avenue, Ikeja, Lagos',
        preferredTransportType: 'SEA',
        paymentMethod: 'T/T',
      },
      createdAt: now,
    },
    {
      id: 'cust-2',
      customerCode: 'A1B1',
      name: '广州海通进出口有限公司',
      customerType: 'COMPANY_CN',
      country: '中国',
      address: '广州市白云区机场路 1128 号海通大厦 9 楼',
      industry: '贸易',
      source: '老客介绍',
      contact: { name: '李慧敏', phone: '13800002222', email: 'huimin.li@haitong-exp.com' },
      salesId: 'user-sales1',
      poolType: 'PRIVATE',
      status: 'ACTIVE',
      preferredTransport: 'SEA',
      preferredPayment: '月结 30 天',
      remark: '应收账期 30 天，需月度对账',
      enterpriseInfo: {
        entityType: 'COMPANY_CN',
        companyName: '广州海通进出口有限公司',
        unifiedCreditCode: '91440101MA7ABC12X3',
        legalRepresentative: '李慧敏',
        registeredAddress: '广州市白云区机场路 1128 号海通大厦 9 楼',
        taxpayerId: '91440101MA7ABC12X3',
        invoiceAddress: '广州市白云区机场路 1128 号海通大厦 9 楼',
        invoicePhone: '020-86001111',
        bankName: '招商银行广州分行白云支行',
        bankAccount: '7559 0088 2001 0020',
        contactPhone: '020-86001111',
        contactEmail: 'ap@haitong-exp.com',
        documents: [],
      },
      logisticsInfo: {
        senderName: '李慧敏',
        senderPhone: '13800002222',
        senderAddress: '广州市白云区机场路 1128 号海通大厦 9 楼',
        senderCity: '广州',
        senderCountry: '中国',
        consigneeName: 'Emeka Eze',
        consigneePhone: '+234-810-554-7820',
        consigneeCountry: '尼日利亚',
        consigneeCity: '阿布贾',
        consigneeZipCode: '900108',
        consigneeAddress: 'Plot 45, Garki District, Abuja',
        preferredTransportType: 'SEA',
        paymentMethod: 'MONTHLY',
      },
      createdAt: now,
    },
    {
      id: 'cust-3',
      customerCode: 'C2D0',
      name: '义乌锦沪国际物流有限公司',
      customerType: 'COMPANY_CN',
      country: '中国',
      address: '浙江省义乌市国际商贸城四区 B-2033',
      industry: '制造业',
      source: '展会',
      contact: { name: '王俊凯', phone: '13800003333', email: 'junkai@jinhu-intl.com' },
      salesId: 'user-sales1',
      poolType: 'PRIVATE',
      status: 'ACTIVE',
      preferredTransport: 'AIR',
      preferredPayment: 'T/T',
      remark: '主推非洲小家电，对时效敏感',
      enterpriseInfo: {
        entityType: 'COMPANY_CN',
        companyName: '义乌锦沪国际物流有限公司',
        unifiedCreditCode: '91330782MA2H9Y8P1K',
        legalRepresentative: '王俊凯',
        registeredAddress: '浙江省义乌市国际商贸城四区 B-2033',
        taxpayerId: '91330782MA2H9Y8P1K',
        invoiceAddress: '浙江省义乌市国际商贸城四区 B-2033',
        invoicePhone: '0579-85123456',
        bankName: '浦发银行义乌分行',
        bankAccount: '9803 0188 5500 2211',
        contactPhone: '0579-85123456',
        contactEmail: 'sales@jinhu-intl.com',
        documents: [],
      },
      logisticsInfo: {
        senderName: '王俊凯',
        senderPhone: '13800003333',
        senderAddress: '浙江省义乌市国际商贸城四区 B-2033',
        senderCity: '义乌',
        senderCountry: '中国',
        consigneeName: 'Kwame Asante',
        consigneePhone: '+234-701-234-5678',
        consigneeCountry: '加纳',
        consigneeCity: '阿克拉',
        consigneeZipCode: 'GA-039',
        consigneeAddress: 'East Legon, Accra',
        preferredTransportType: 'AIR',
        paymentMethod: 'T/T',
      },
      createdAt: now,
    },
    {
      id: 'cust-4',
      customerCode: 'E3F0',
      name: '东莞恒通电子科技有限公司',
      customerType: 'COMPANY_CN',
      country: '中国',
      address: '东莞市长安镇上沙第三工业区恒通路 8 号',
      industry: '制造业',
      source: '销售录入',
      contact: { name: '赵思琪', phone: '13800004444', email: 'siqi@hengtong-elec.cn' },
      salesId: 'user-sales1',
      poolType: 'PRIVATE',
      status: 'ACTIVE',
      preferredTransport: 'SEA',
      preferredPayment: 'T/T 50% 预付',
      remark: '工厂直发，货值较高，需加固木架',
      enterpriseInfo: {
        entityType: 'COMPANY_CN',
        companyName: '东莞恒通电子科技有限公司',
        unifiedCreditCode: '9144190071234HTEC',
        legalRepresentative: '赵思琪',
        registeredAddress: '东莞市长安镇上沙第三工业区恒通路 8 号',
        taxpayerId: '9144190071234HTEC',
        invoiceAddress: '东莞市长安镇上沙第三工业区恒通路 8 号',
        invoicePhone: '0769-85551234',
        bankName: '中国建设银行东莞长安支行',
        bankAccount: '4367 4201 2000 3388',
        contactPhone: '0769-85551234',
        contactEmail: 'finance@hengtong-elec.cn',
        documents: [],
      },
      logisticsInfo: {
        senderName: '赵思琪',
        senderPhone: '13800004444',
        senderAddress: '东莞市长安镇上沙第三工业区恒通路 8 号',
        senderCity: '东莞',
        senderCountry: '中国',
        consigneeName: 'Amina Yusuf',
        consigneePhone: '+234-803-555-2001',
        consigneeCountry: '尼日利亚',
        consigneeCity: '拉各斯',
        consigneeZipCode: '101233',
        consigneeAddress: '15 Awolowo Way, Ikeja, Lagos',
        preferredTransportType: 'SEA',
        paymentMethod: 'T/T',
      },
      createdAt: now,
    },
    {
      id: 'cust-5',
      customerCode: 'G4H0',
      name: '深圳旺达跨境贸易有限公司',
      customerType: 'COMPANY_CN',
      country: '中国',
      address: '深圳市福田区华强北路赛格广场 28 楼',
      industry: '贸易',
      source: '线上推广',
      contact: { name: '钱立文', phone: '13800005555', email: 'liwen.qian@wangda-trade.cn' },
      salesId: 'user-sales1',
      poolType: 'PRIVATE',
      status: 'ACTIVE',
      preferredTransport: 'SEA',
      preferredPayment: 'T/T',
      remark: '常运尼日利亚拉各斯，偏好整柜',
      enterpriseInfo: {
        entityType: 'COMPANY_CN',
        companyName: '深圳旺达跨境贸易有限公司',
        unifiedCreditCode: '91440300MA5WDTRD2X',
        legalRepresentative: '钱立文',
        registeredAddress: '深圳市福田区华强北路赛格广场 28 楼',
        taxpayerId: '91440300MA5WDTRD2X',
        invoiceAddress: '深圳市福田区华强北路赛格广场 28 楼',
        invoicePhone: '0755-83338888',
        bankName: '中国银行深圳华强北支行',
        bankAccount: '7780 0123 4567 8901',
        contactPhone: '0755-83338888',
        contactEmail: 'ap@wangda-trade.cn',
        documents: [],
      },
      logisticsInfo: {
        senderName: '钱立文',
        senderPhone: '13800005555',
        senderAddress: '深圳市福田区华强北路赛格广场 28 楼',
        senderCity: '深圳',
        senderCountry: '中国',
        consigneeName: 'Amina Yusuf',
        consigneePhone: '+234-803-555-2001',
        consigneeCountry: '尼日利亚',
        consigneeCity: '拉各斯',
        consigneeZipCode: '101233',
        consigneeAddress: '15 Awolowo Way, Ikeja, Lagos',
        preferredTransportType: 'SEA',
        paymentMethod: 'T/T',
      },
      createdAt: now,
    },
    {
      id: 'cust-6',
      customerCode: 'J5K0',
      name: '广州金辉国际贸易有限公司',
      customerType: 'COMPANY_CN',
      country: '中国',
      address: '广州市越秀区环市东路 348 号广东国际大厦 32 楼',
      industry: '零售',
      source: '老客介绍',
      contact: { name: '孙佳怡', phone: '13800006666', email: 'jiayi.sun@jinhui-intl.cn' },
      salesId: 'user-sales1',
      poolType: 'PRIVATE',
      status: 'ACTIVE',
      preferredTransport: 'SEA',
      preferredPayment: 'L/C',
      remark: '主做尼日利亚家居百货',
      enterpriseInfo: {
        entityType: 'COMPANY_CN',
        companyName: '广州金辉国际贸易有限公司',
        unifiedCreditCode: '91440101MAJHINTL66',
        legalRepresentative: '孙佳怡',
        registeredAddress: '广州市越秀区环市东路 348 号广东国际大厦 32 楼',
        taxpayerId: '91440101MAJHINTL66',
        invoiceAddress: '广州市越秀区环市东路 348 号广东国际大厦 32 楼',
        invoicePhone: '020-83330000',
        bankName: '交通银行广州越秀支行',
        bankAccount: '3012 5600 2245 0099',
        contactPhone: '020-83330000',
        contactEmail: 'finance@jinhui-intl.cn',
        documents: [],
      },
      logisticsInfo: {
        senderName: '孙佳怡',
        senderPhone: '13800006666',
        senderAddress: '广州市越秀区环市东路 348 号广东国际大厦 32 楼',
        senderCity: '广州',
        senderCountry: '中国',
        consigneeName: 'Temi Balogun',
        consigneePhone: '+234-805-330-1001',
        consigneeCountry: '尼日利亚',
        consigneeCity: '拉各斯',
        consigneeZipCode: '101245',
        consigneeAddress: 'Lekki Phase 1, Lagos',
        preferredTransportType: 'SEA',
        paymentMethod: 'L/C',
      },
      createdAt: now,
    },
    {
      id: 'cust-7',
      customerCode: 'M7N0',
      name: '义乌明诚小商品集散中心',
      customerType: 'COMPANY_CN',
      country: '中国',
      address: '浙江省义乌市国际商贸城一区 A-1058',
      industry: '贸易',
      source: '展会',
      contact: { name: '周可嘉', phone: '13800007777', email: 'kejia.zhou@mingcheng-yw.com' },
      salesId: null,
      poolType: 'PUBLIC',
      status: 'ACTIVE',
      preferredTransport: 'SEA',
      preferredPayment: 'T/T',
      remark: '公海客户，上次跟进于 3 个月前',
      enterpriseInfo: {
        entityType: 'COMPANY_CN',
        companyName: '义乌明诚小商品集散中心',
        unifiedCreditCode: '91330782MA2MC77YW',
        legalRepresentative: '周可嘉',
        registeredAddress: '浙江省义乌市国际商贸城一区 A-1058',
        taxpayerId: '91330782MA2MC77YW',
        invoiceAddress: '浙江省义乌市国际商贸城一区 A-1058',
        invoicePhone: '0579-85009988',
        bankName: '中国农业银行义乌支行',
        bankAccount: '6228 4808 3322 1166',
        contactPhone: '0579-85009988',
        contactEmail: 'ops@mingcheng-yw.com',
        documents: [],
      },
      createdAt: now,
    },
    {
      id: 'cust-8',
      customerCode: 'P8Q0',
      name: 'Lagos Global Logistics Ltd.',
      customerType: 'COMPANY_OVERSEAS',
      country: '尼日利亚',
      address: '25 Awolowo Road, Ikoyi, Lagos, Nigeria',
      industry: '贸易',
      source: '老客介绍',
      contact: { name: 'Chinwe Okafor', phone: '+234-812-445-0088', email: 'chinwe@lagosgl.ng' },
      salesId: null,
      poolType: 'PUBLIC',
      status: 'DORMANT',
      preferredTransport: 'SEA',
      preferredPayment: 'T/T',
      remark: '海外客户，需英文对账单',
      enterpriseInfo: {
        entityType: 'COMPANY_OVERSEAS',
        overseasCompanyName: 'Lagos Global Logistics Ltd.',
        overseasCountry: '尼日利亚',
        overseasRegNumber: 'RC-1188776',
        overseasTaxNumber: 'TIN-NG-20220011',
        overseasDirector: 'Chinwe Okafor',
        customFields: [
          { label: 'CAC Number', value: 'RC-1188776' },
          { label: 'VAT ID', value: 'NG-VAT-556622' },
        ],
        bankName: 'Zenith Bank Nigeria',
        bankAccount: '1023-4455-6677',
        documents: [],
      },
      createdAt: now,
    },
    {
      id: 'cust-9',
      customerCode: 'R9S0',
      name: '佛山雅居家具出口有限公司',
      customerType: 'COMPANY_CN',
      country: '中国',
      address: '佛山市顺德区龙江镇家具大道 168 号',
      industry: '制造业',
      source: '线上推广',
      contact: { name: '郑楚彤', phone: '13800009999', email: 'chutong@yajia-furn.cn' },
      salesId: null,
      poolType: 'PUBLIC',
      status: 'ACTIVE',
      preferredTransport: 'SEA',
      preferredPayment: 'T/T',
      remark: '木质家具出口，需熏蒸证明',
      enterpriseInfo: {
        entityType: 'COMPANY_CN',
        companyName: '佛山雅居家具出口有限公司',
        unifiedCreditCode: '91440606YJJJ2020MX',
        legalRepresentative: '郑楚彤',
        registeredAddress: '佛山市顺德区龙江镇家具大道 168 号',
        taxpayerId: '91440606YJJJ2020MX',
        invoiceAddress: '佛山市顺德区龙江镇家具大道 168 号',
        invoicePhone: '0757-26668888',
        bankName: '中国工商银行佛山顺德支行',
        bankAccount: '4000 1620 2100 9988 7766',
        contactPhone: '0757-26668888',
        contactEmail: 'export@yajia-furn.cn',
        documents: [],
      },
      createdAt: now,
    },
  ];

  for (const payload of customerPayloads) {
    createCustomerRecord(db, payload);
  }

  // ============================================================
  // 5. JOB 池 — 物流公司订舱后创建（先于订单装箱）
  // ============================================================
  // job-sea-completed   COMPLETED (历史)        GZ→LOS  → 链路 A 主角
  // job-sea-arrived     CLEARED   (待 DPN)      GZ→LOS  → 链路 C 站点调拨
  // job-sea-intransit   IN_TRANSIT             SZ→LOS  → 链路 B 在途
  // job-sea-departed    DEPARTED               HKG→LOS
  // job-sea-loading     LOADING   (装箱中)      GZ→LOS
  // job-sea-planned-1   PLANNED                GZ→LOS
  // job-sea-planned-2   PLANNED                SZ→LOS
  // job-air-loading     LOADING                GZ→LOS AIR (3 集装号)
  // ============================================================

  const jobSeaCompleted = createJob(db, {
    id: 'job-sea-completed',
    jobNo: 'S-JOB260225001',
    businessLine: 'SEA',
    routeCode: 'route-gz-los-sea',
    originPort: 'CAN', destPort: 'LOS',
    carrierName: '马士基', vesselVoyage: 'MAERSK SENTOSA / 250E',
    billNo: 'MBL260225001', containerType: '40HQ', cargoType: 'GENERAL',
    serviceType: 'EXPRESS',
    etd: '2026-02-25', eta: '2026-03-22',
    remark: '链路A：已完成',
    createdBy: 'user-opscn1', createdAt: '2026-02-20 09:00:00',
    units: [{ unitNo: 'MSKU1234567', containerType: '40HQ', sealNo: 'SL-200225-A1' }],
  });

  const jobSeaArrived = createJob(db, {
    id: 'job-sea-arrived',
    jobNo: 'S-JOB260315002',
    businessLine: 'SEA',
    routeCode: 'route-gz-los-sea',
    originPort: 'CAN', destPort: 'LOS',
    carrierName: '马士基', vesselVoyage: 'MAERSK ESSEX / 312E',
    billNo: 'MBL260315002', containerType: '40HQ', cargoType: 'GENERAL',
    serviceType: 'EXPRESS',
    etd: '2026-03-15', eta: '2026-04-10',
    remark: '链路C：已到达，待 DPN 调拨',
    createdBy: 'user-opscn1', createdAt: '2026-03-10 10:00:00',
    units: [{ unitNo: 'MSKU2345678', containerType: '40HQ', sealNo: 'SL-260315-B1' }],
  });

  const jobSeaInTransit = createJob(db, {
    id: 'job-sea-intransit',
    jobNo: 'S-JOB260401003',
    businessLine: 'SEA',
    routeCode: 'route-sz-los-sea',
    originPort: 'SZX', destPort: 'LOS',
    carrierName: '中远海运', vesselVoyage: 'COSCO PRIDE / 415W',
    billNo: 'COSU260401003', containerType: '40HQ', cargoType: 'GENERAL',
    serviceType: 'EXPRESS',
    etd: '2026-04-01', eta: '2026-04-25',
    remark: '链路B：在途',
    createdBy: 'user-opscn1', createdAt: '2026-03-26 11:00:00',
    units: [{ unitNo: 'COSU3456789', containerType: '40HQ', sealNo: 'SL-260401-C1' }],
  });

  const jobSeaDeparted = createJob(db, {
    id: 'job-sea-departed',
    jobNo: 'S-JOB260410004',
    businessLine: 'SEA',
    routeCode: 'route-hkg-los-sea',
    originPort: 'HKG', destPort: 'LOS',
    carrierName: '马士基', vesselVoyage: 'MAERSK HORIZON / 418E',
    billNo: 'MBL260410004', containerType: '40HQ', cargoType: 'GENERAL',
    serviceType: 'EXPRESS',
    etd: '2026-04-10', eta: '2026-05-05',
    remark: '已起运 - 在途较新',
    createdBy: 'user-opscn1', createdAt: '2026-04-05 09:00:00',
    units: [{ unitNo: 'EMCU4567890', containerType: '40HQ', sealNo: 'SL-260410-D1' }],
  });

  const jobSeaLoading = createJob(db, {
    id: 'job-sea-loading',
    jobNo: 'S-JOB260422005',
    businessLine: 'SEA',
    routeCode: 'route-gz-los-sea',
    originPort: 'CAN', destPort: 'LOS',
    carrierName: '中远海运', vesselVoyage: 'COSCO ATLANTIC / 502W',
    containerType: '40HQ', cargoType: 'GENERAL',
    serviceType: 'EXPRESS',
    etd: '2026-04-22', eta: '2026-05-18',
    remark: '装箱中',
    createdBy: 'user-opscn1', createdAt: '2026-04-12 10:00:00',
    units: [{ unitNo: 'EISU5678901', containerType: '40HQ' }],
  });

  const jobSeaPlanned1 = createJob(db, {
    id: 'job-sea-planned-1',
    jobNo: 'S-JOB260428006',
    businessLine: 'SEA',
    routeCode: 'route-gz-los-sea',
    originPort: 'CAN', destPort: 'LOS',
    carrierName: '马士基', vesselVoyage: 'MAERSK NEWPORT / 510E',
    containerType: '40HQ', cargoType: 'GENERAL',
    serviceType: 'EXPRESS',
    etd: '2026-04-28', eta: '2026-05-25',
    remark: '已订舱，待装箱',
    createdBy: 'user-opscn1', createdAt: '2026-04-14 14:00:00',
    units: [{ unitNo: 'MSKU6789012', containerType: '40HQ' }],
  });

  const jobSeaPlanned2 = createJob(db, {
    id: 'job-sea-planned-2',
    jobNo: 'S-JOB260503007',
    businessLine: 'SEA',
    routeCode: 'route-sz-los-sea',
    originPort: 'SZX', destPort: 'LOS',
    carrierName: '中远海运', vesselVoyage: 'COSCO BRILLIANCE / 518W',
    containerType: '40GP', cargoType: 'GENERAL',
    serviceType: 'STANDARD',
    etd: '2026-05-03', eta: '2026-05-28',
    remark: '已订舱，待装箱',
    createdBy: 'user-opscn1', createdAt: '2026-04-15 09:00:00',
    units: [{ unitNo: 'COSU7890123', containerType: '40GP' }],
  });

  const jobAirLoading = createJob(db, {
    id: 'job-air-loading',
    jobNo: 'A-JOB260420008',
    businessLine: 'AIR',
    routeCode: 'route-gz-los-air',
    originPort: 'CAN', destPort: 'LOS',
    carrierName: '埃塞俄比亚航空', flightNo: 'ET 605',
    containerType: 'AIR_PALLET', cargoType: 'GENERAL',
    serviceType: 'EXPRESS',
    etd: '2026-04-20', eta: '2026-04-28',
    remark: '空运 - 多集装号',
    createdBy: 'user-opscn1', createdAt: '2026-04-14 11:00:00',
    units: [
      { unitNo: 'PMC-001', unitType: 'PALLET', maxWeightKg: 1500, maxVolumeCbm: 12 },
      { unitNo: 'PMC-002', unitType: 'PALLET', maxWeightKg: 1500, maxVolumeCbm: 12 },
      { unitNo: 'AKE-003', unitType: 'PALLET', maxWeightKg: 1200, maxVolumeCbm: 10 },
    ],
  });

  // ============================================================
  // 6. 订单池 — 12 个订单分布到 9 个客户
  // ============================================================

  const ord1 = createOrder(db, {
    id: 'ord-cust1-completed',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-1', customerName: '深圳市臻诚跨境贸易有限公司', customerCode: 'A1B0',
    salesUserId: 'user-sales1',
    routeCode: 'route-gz-los-sea',
    paymentMethod: 'T/T', paymentStatus: 'PAID',
    senderName: '张铭轩', senderPhone: '13800001111',
    senderAddress: '深圳市南山区科技园南区数字大厦18楼1806室',
    consigneeName: 'Ada Nwosu', consigneePhone: '+234-903-832-1727',
    consigneeAddress: '23 Allen Avenue, Ikeja, Lagos',
    consigneeCountry: '尼日利亚', consigneeCity: '拉各斯',
    remark: '链路A：已完成全链路',
    createdBy: 'user-sales1', createdAt: '2026-02-22 09:30:00',
    items: [
      { trackingNo: 'SF1100001', expressCompany: '顺丰', goodsName: '蓝牙耳机', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 8, pieces: 2, lengthCm: 35, widthCm: 25, heightCm: 15, declaredValue: 280 },
      { trackingNo: 'SF1100002', expressCompany: '顺丰', goodsName: '智能手表', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 4, pieces: 1, lengthCm: 30, widthCm: 20, heightCm: 12, declaredValue: 350 },
    ],
  });

  const ord2 = createOrder(db, {
    id: 'ord-cust1-pending',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-1', customerName: '深圳市臻诚跨境贸易有限公司', customerCode: 'A1B0',
    salesUserId: 'user-sales1',
    routeCode: 'route-gz-los-sea',
    paymentMethod: 'T/T', paymentStatus: 'UNPAID',
    senderName: '张铭轩', senderPhone: '13800001111',
    senderAddress: '深圳市南山区科技园南区数字大厦18楼1806室',
    consigneeName: 'Ada Nwosu', consigneePhone: '+234-903-832-1727',
    consigneeAddress: '23 Allen Avenue, Ikeja, Lagos',
    consigneeCountry: '尼日利亚', consigneeCity: '拉各斯',
    remark: '客户刚下单，快递还没到仓',
    createdBy: 'user-sales1', createdAt: '2026-04-14 16:00:00',
    items: [
      { trackingNo: 'SF1300001', expressCompany: '顺丰', goodsName: '电子配件', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 5, pieces: 1, lengthCm: 30, widthCm: 25, heightCm: 18, declaredValue: 200 },
    ],
  });

  const ord3 = createOrder(db, {
    id: 'ord-cust2-inbound',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-2', customerName: '广州海通进出口有限公司', customerCode: 'A1B1',
    salesUserId: 'user-sales1',
    routeCode: 'route-gz-los-sea',
    paymentMethod: '月结 30 天', paymentStatus: 'UNPAID',
    senderName: '李慧敏', senderPhone: '13800002222',
    senderAddress: '广州市白云区机场路 1128 号海通大厦 9 楼',
    consigneeName: 'Emeka Eze', consigneePhone: '+234-810-554-7820',
    consigneeAddress: 'Plot 45, Garki District, Abuja',
    consigneeCountry: '尼日利亚', consigneeCity: '阿布贾',
    remark: '已入库待装箱',
    createdBy: 'user-sales1', createdAt: '2026-04-08 10:00:00',
    items: [
      { trackingNo: 'YT1300003', expressCompany: '韵达', goodsName: '家居用品', goodsCategory: 'DAILY_USE', cargoType: 'GENERAL', declaredWeightKg: 12, pieces: 3, lengthCm: 50, widthCm: 40, heightCm: 30, declaredValue: 180 },
    ],
  });

  const ord4 = createOrder(db, {
    id: 'ord-cust2-completed',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-2', customerName: '广州海通进出口有限公司', customerCode: 'A1B1',
    salesUserId: 'user-sales1',
    routeCode: 'route-gz-los-sea',
    paymentMethod: '月结 30 天', paymentStatus: 'PAID',
    senderName: '李慧敏', senderPhone: '13800002222',
    senderAddress: '广州市白云区机场路 1128 号海通大厦 9 楼',
    consigneeName: 'Emeka Eze', consigneePhone: '+234-810-554-7820',
    consigneeAddress: 'Plot 45, Garki District, Abuja',
    consigneeCountry: '尼日利亚', consigneeCity: '阿布贾',
    remark: '链路A 配角：和 ord1 装在同一柜',
    createdBy: 'user-sales1', createdAt: '2026-02-23 14:00:00',
    items: [
      { trackingNo: 'YT1100003', expressCompany: '韵达', goodsName: '美妆护肤', goodsCategory: 'BEAUTY', cargoType: 'GENERAL', declaredWeightKg: 6, pieces: 2, lengthCm: 40, widthCm: 30, heightCm: 20, declaredValue: 320 },
    ],
  });

  const ord5 = createOrder(db, {
    id: 'ord-cust3-loading',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-3', customerName: '义乌锦沪国际物流有限公司', customerCode: 'C2D0',
    salesUserId: 'user-sales1',
    routeCode: 'route-gz-los-sea',
    paymentMethod: 'T/T', paymentStatus: 'UNPAID',
    senderName: '王俊凯', senderPhone: '13800003333',
    senderAddress: '浙江省义乌市国际商贸城四区 B-2033',
    consigneeName: 'Kwame Asante', consigneePhone: '+234-701-234-5678',
    consigneeAddress: 'East Legon, Accra',
    consigneeCountry: '加纳', consigneeCity: '阿克拉',
    remark: '装箱中',
    createdBy: 'user-sales1', createdAt: '2026-04-10 09:30:00',
    items: [
      { trackingNo: 'ZT1300005', expressCompany: '中通', goodsName: '小家电', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 18, pieces: 4, lengthCm: 60, widthCm: 45, heightCm: 35, declaredValue: 420 },
      { trackingNo: 'ZT1300006', expressCompany: '中通', goodsName: '小家电', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 12, pieces: 2, lengthCm: 50, widthCm: 40, heightCm: 30, declaredValue: 280 },
    ],
  });

  const ord6 = createOrder(db, {
    id: 'ord-cust4-intransit-1',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-4', customerName: '东莞恒通电子科技有限公司', customerCode: 'E3F0',
    salesUserId: 'user-sales1',
    routeCode: 'route-sz-los-sea',
    paymentMethod: 'T/T 50% 预付', paymentStatus: 'PARTIAL',
    senderName: '赵思琪', senderPhone: '13800004444',
    senderAddress: '东莞市长安镇上沙第三工业区恒通路 8 号',
    consigneeName: 'Amina Yusuf', consigneePhone: '+234-803-555-2001',
    consigneeAddress: '15 Awolowo Way, Ikeja, Lagos',
    consigneeCountry: '尼日利亚', consigneeCity: '拉各斯',
    remark: '链路B 主角：在途',
    createdBy: 'user-sales1', createdAt: '2026-03-25 10:00:00',
    items: [
      { trackingNo: 'SF1200001', expressCompany: '顺丰', goodsName: '电子主板', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 25, pieces: 5, lengthCm: 60, widthCm: 40, heightCm: 30, declaredValue: 1200 },
    ],
  });

  const ord7 = createOrder(db, {
    id: 'ord-cust4-intransit-2',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-4', customerName: '东莞恒通电子科技有限公司', customerCode: 'E3F0',
    salesUserId: 'user-sales1',
    routeCode: 'route-sz-los-sea',
    paymentMethod: 'T/T', paymentStatus: 'PAID',
    senderName: '赵思琪', senderPhone: '13800004444',
    senderAddress: '东莞市长安镇上沙第三工业区恒通路 8 号',
    consigneeName: 'Amina Yusuf', consigneePhone: '+234-803-555-2001',
    consigneeAddress: '15 Awolowo Way, Ikeja, Lagos',
    consigneeCountry: '尼日利亚', consigneeCity: '拉各斯',
    remark: '链路B 配角：和 ord6 同柜',
    createdBy: 'user-sales1', createdAt: '2026-03-25 14:30:00',
    items: [
      { trackingNo: 'SF1200002', expressCompany: '顺丰', goodsName: '充电器', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 8, pieces: 2, lengthCm: 35, widthCm: 25, heightCm: 18, declaredValue: 220 },
    ],
  });

  const ord8 = createOrder(db, {
    id: 'ord-cust5-pending-delivery',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-5', customerName: '深圳旺达跨境贸易有限公司', customerCode: 'G4H0',
    salesUserId: 'user-sales1',
    routeCode: 'route-gz-los-sea',
    paymentMethod: 'T/T', paymentStatus: 'PAID',
    senderName: '钱立文', senderPhone: '13800005555',
    senderAddress: '深圳市福田区华强北路赛格广场 28 楼',
    consigneeName: 'Hassan Ibrahim', consigneePhone: '+234-810-998-7700',
    consigneeAddress: 'Plot 12, Wuse 2, Abuja',
    consigneeCountry: '尼日利亚', consigneeCity: '阿布贾',
    remark: '链路C：到达后需 DPN 转运到阿布贾',
    createdBy: 'user-sales1', createdAt: '2026-03-12 11:00:00',
    items: [
      { trackingNo: 'YD1200004', expressCompany: '韵达', goodsName: '日用百货', goodsCategory: 'DAILY_USE', cargoType: 'GENERAL', declaredWeightKg: 28, pieces: 6, lengthCm: 70, widthCm: 50, heightCm: 40, declaredValue: 380 },
    ],
  });

  const ord9 = createOrder(db, {
    id: 'ord-cust5-delivering',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-5', customerName: '深圳旺达跨境贸易有限公司', customerCode: 'G4H0',
    salesUserId: 'user-sales1',
    routeCode: 'route-gz-los-sea',
    paymentMethod: 'T/T', paymentStatus: 'PAID',
    senderName: '钱立文', senderPhone: '13800005555',
    senderAddress: '深圳市福田区华强北路赛格广场 28 楼',
    consigneeName: 'Amina Yusuf', consigneePhone: '+234-803-555-2001',
    consigneeAddress: '15 Awolowo Way, Ikeja, Lagos',
    consigneeCountry: '尼日利亚', consigneeCity: '拉各斯',
    remark: '链路C 配角：本站直接配送',
    createdBy: 'user-sales1', createdAt: '2026-03-12 15:00:00',
    items: [
      { trackingNo: 'YD1200005', expressCompany: '韵达', goodsName: '电子配件', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 10, pieces: 2, lengthCm: 40, widthCm: 30, heightCm: 25, declaredValue: 300 },
    ],
  });

  const ord10 = createOrder(db, {
    id: 'ord-cust6-departed',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-6', customerName: '广州金辉国际贸易有限公司', customerCode: 'J5K0',
    salesUserId: 'user-sales1',
    routeCode: 'route-hkg-los-sea',
    paymentMethod: 'L/C', paymentStatus: 'PAID',
    senderName: '孙佳怡', senderPhone: '13800006666',
    senderAddress: '广州市越秀区环市东路 348 号广东国际大厦 32 楼',
    consigneeName: 'Temi Balogun', consigneePhone: '+234-805-330-1001',
    consigneeAddress: 'Lekki Phase 1, Lagos',
    consigneeCountry: '尼日利亚', consigneeCity: '拉各斯',
    remark: '已起运',
    createdBy: 'user-sales1', createdAt: '2026-04-04 11:00:00',
    items: [
      { trackingNo: 'STO1200006', expressCompany: '申通', goodsName: '家居家具', goodsCategory: 'DAILY_USE', cargoType: 'GENERAL', declaredWeightKg: 35, pieces: 4, lengthCm: 80, widthCm: 60, heightCm: 50, declaredValue: 580 },
    ],
  });

  const ord11 = createOrder(db, {
    id: 'ord-cust3-air-loading',
    businessLine: 'AIR',
    serviceType: 'AIR_STD',
    customerId: 'cust-3', customerName: '义乌锦沪国际物流有限公司', customerCode: 'C2D0',
    salesUserId: 'user-sales1',
    routeCode: 'route-gz-los-air',
    paymentMethod: 'T/T', paymentStatus: 'PAID',
    senderName: '王俊凯', senderPhone: '13800003333',
    senderAddress: '浙江省义乌市国际商贸城四区 B-2033',
    consigneeName: 'Kwame Asante', consigneePhone: '+234-701-234-5678',
    consigneeAddress: 'East Legon, Accra',
    consigneeCountry: '加纳', consigneeCity: '阿克拉',
    remark: '空运订单 - 装入空运 JOB',
    createdBy: 'user-sales1', createdAt: '2026-04-12 14:00:00',
    items: [
      { trackingNo: 'YT1300010', expressCompany: '韵达', goodsName: '电子样品', goodsCategory: 'ELECTRONICS', cargoType: 'GENERAL', declaredWeightKg: 6, pieces: 1, lengthCm: 30, widthCm: 20, heightCm: 15, declaredValue: 480 },
    ],
  });

  const ord12 = createOrder(db, {
    id: 'ord-cust9-inbound',
    businessLine: 'SEA',
    serviceType: 'LCL_SEA',
    customerId: 'cust-9', customerName: '佛山雅居家具出口有限公司', customerCode: 'R9S0',
    salesUserId: null as any,
    routeCode: 'route-gz-los-sea',
    paymentMethod: 'T/T', paymentStatus: 'UNPAID',
    senderName: '郑楚彤', senderPhone: '13800009999',
    senderAddress: '佛山市顺德区龙江镇家具大道 168 号',
    consigneeName: 'Lagos Furniture Mart', consigneePhone: '+234-801-234-5566',
    consigneeAddress: '88 Adetokunbo Ademola Street, Victoria Island, Lagos',
    consigneeCountry: '尼日利亚', consigneeCity: '拉各斯',
    remark: '公海客户 - 已入库等待装箱',
    createdBy: 'user-sales1', createdAt: '2026-04-09 11:30:00',
    items: [
      { trackingNo: 'SF1300012', expressCompany: '顺丰', goodsName: '木制家具', goodsCategory: 'OTHER', cargoType: 'GENERAL', declaredWeightKg: 45, pieces: 3, lengthCm: 120, widthCm: 80, heightCm: 60, declaredValue: 850 },
    ],
  });

  // ============================================================
  // 7. 入库 — 除 ord2 外都已入库
  // ============================================================

  const inboundList: Array<{ orderId: string; subOrderId: string; warehouseId: string; trackingNo: string; pieces: number; weightKg: number; lengthCm: number; widthCm: number; heightCm: number; locationCode: string; goodsCategory: string; inboundAt: string }> = [
    // ord1 (链路 A)
    { orderId: ord1.id, subOrderId: ord1.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'SF1100001', pieces: 2, weightKg: 8.2, lengthCm: 35, widthCm: 25, heightCm: 15, locationCode: 'A-01-01', goodsCategory: 'ELECTRONICS', inboundAt: '2026-02-24 10:30:00' },
    { orderId: ord1.id, subOrderId: ord1.subOrderIds[1], warehouseId: 'wh-gz', trackingNo: 'SF1100002', pieces: 1, weightKg: 4.1, lengthCm: 30, widthCm: 20, heightCm: 12, locationCode: 'A-01-02', goodsCategory: 'ELECTRONICS', inboundAt: '2026-02-24 10:35:00' },
    // ord3 入库待装箱
    { orderId: ord3.id, subOrderId: ord3.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'YT1300003', pieces: 3, weightKg: 12.5, lengthCm: 50, widthCm: 40, heightCm: 30, locationCode: 'A-02-05', goodsCategory: 'DAILY_USE', inboundAt: '2026-04-10 14:20:00' },
    // ord4 (链路 A 配角)
    { orderId: ord4.id, subOrderId: ord4.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'YT1100003', pieces: 2, weightKg: 6.3, lengthCm: 40, widthCm: 30, heightCm: 20, locationCode: 'A-01-03', goodsCategory: 'BEAUTY', inboundAt: '2026-02-24 16:00:00' },
    // ord5 装箱中
    { orderId: ord5.id, subOrderId: ord5.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'ZT1300005', pieces: 4, weightKg: 18.5, lengthCm: 60, widthCm: 45, heightCm: 35, locationCode: 'B-02-01', goodsCategory: 'ELECTRONICS', inboundAt: '2026-04-12 09:15:00' },
    { orderId: ord5.id, subOrderId: ord5.subOrderIds[1], warehouseId: 'wh-gz', trackingNo: 'ZT1300006', pieces: 2, weightKg: 12.2, lengthCm: 50, widthCm: 40, heightCm: 30, locationCode: 'B-02-02', goodsCategory: 'ELECTRONICS', inboundAt: '2026-04-12 09:20:00' },
    // ord6 链路 B
    { orderId: ord6.id, subOrderId: ord6.subOrderIds[0], warehouseId: 'wh-sz', trackingNo: 'SF1200001', pieces: 5, weightKg: 25.3, lengthCm: 60, widthCm: 40, heightCm: 30, locationCode: 'SZ-A-08', goodsCategory: 'ELECTRONICS', inboundAt: '2026-03-28 10:30:00' },
    // ord7 链路 B 配角
    { orderId: ord7.id, subOrderId: ord7.subOrderIds[0], warehouseId: 'wh-sz', trackingNo: 'SF1200002', pieces: 2, weightKg: 8.1, lengthCm: 35, widthCm: 25, heightCm: 18, locationCode: 'SZ-A-09', goodsCategory: 'ELECTRONICS', inboundAt: '2026-03-28 10:45:00' },
    // ord8 链路 C
    { orderId: ord8.id, subOrderId: ord8.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'YD1200004', pieces: 6, weightKg: 28.7, lengthCm: 70, widthCm: 50, heightCm: 40, locationCode: 'A-03-01', goodsCategory: 'DAILY_USE', inboundAt: '2026-03-13 15:00:00' },
    // ord9 链路 C 配角
    { orderId: ord9.id, subOrderId: ord9.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'YD1200005', pieces: 2, weightKg: 10.4, lengthCm: 40, widthCm: 30, heightCm: 25, locationCode: 'A-03-02', goodsCategory: 'ELECTRONICS', inboundAt: '2026-03-13 15:10:00' },
    // ord10 已起运
    { orderId: ord10.id, subOrderId: ord10.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'STO1200006', pieces: 4, weightKg: 35.2, lengthCm: 80, widthCm: 60, heightCm: 50, locationCode: 'B-01-01', goodsCategory: 'OTHER', inboundAt: '2026-04-06 11:00:00' },
    // ord11 空运
    { orderId: ord11.id, subOrderId: ord11.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'YT1300010', pieces: 1, weightKg: 6.1, lengthCm: 30, widthCm: 20, heightCm: 15, locationCode: 'AIR-01', goodsCategory: 'ELECTRONICS', inboundAt: '2026-04-13 09:00:00' },
    // ord12 等装箱
    { orderId: ord12.id, subOrderId: ord12.subOrderIds[0], warehouseId: 'wh-gz', trackingNo: 'SF1300012', pieces: 3, weightKg: 45.8, lengthCm: 120, widthCm: 80, heightCm: 60, locationCode: 'B-04-01', goodsCategory: 'OTHER', inboundAt: '2026-04-10 13:00:00' },
  ];
  for (const ib of inboundList) {
    createInbound(db, {
      businessLine: 'SEA',
      warehouseId: ib.warehouseId,
      orderId: ib.orderId,
      subOrderId: ib.subOrderId,
      trackingNo: ib.trackingNo,
      pieces: ib.pieces,
      grossWeightKg: ib.weightKg,
      lengthCm: ib.lengthCm,
      widthCm: ib.widthCm,
      heightCm: ib.heightCm,
      packageCondition: 'GOOD',
      goodsCategory: ib.goodsCategory,
      locationCode: ib.locationCode,
      operatorUserId: 'user-whcn1',
      inboundAt: ib.inboundAt,
    });
  }

  // ============================================================
  // 8. 装箱 — 把已入库子单装入对应 JOB
  // ============================================================

  // job-sea-completed (40HQ MSKU1234567) 装 ord1 + ord4
  bindSubOrders(db, {
    jobId: jobSeaCompleted.id,
    unitId: jobSeaCompleted.unitIds[0],
    subOrderIds: [...ord1.subOrderIds, ...ord4.subOrderIds],
  });
  sealUnit(db, jobSeaCompleted.unitIds[0], 'SL-200225-A1');

  // job-sea-arrived (40HQ MSKU2345678) 装 ord8 + ord9
  bindSubOrders(db, {
    jobId: jobSeaArrived.id,
    unitId: jobSeaArrived.unitIds[0],
    subOrderIds: [...ord8.subOrderIds, ...ord9.subOrderIds],
  });
  sealUnit(db, jobSeaArrived.unitIds[0], 'SL-260315-B1');

  // job-sea-intransit (40HQ COSU3456789) 装 ord6 + ord7
  bindSubOrders(db, {
    jobId: jobSeaInTransit.id,
    unitId: jobSeaInTransit.unitIds[0],
    subOrderIds: [...ord6.subOrderIds, ...ord7.subOrderIds],
  });
  sealUnit(db, jobSeaInTransit.unitIds[0], 'SL-260401-C1');

  // job-sea-departed (40HQ EMCU4567890) 装 ord10
  bindSubOrders(db, {
    jobId: jobSeaDeparted.id,
    unitId: jobSeaDeparted.unitIds[0],
    subOrderIds: ord10.subOrderIds,
  });
  sealUnit(db, jobSeaDeparted.unitIds[0], 'SL-260410-D1');

  // job-sea-loading (40HQ EISU5678901) 装 ord5 (装箱中，未封箱)
  bindSubOrders(db, {
    jobId: jobSeaLoading.id,
    unitId: jobSeaLoading.unitIds[0],
    subOrderIds: ord5.subOrderIds,
  });

  // job-air-loading: 把 ord11 装入第一个集装号 PMC-001
  bindSubOrders(db, {
    jobId: jobAirLoading.id,
    unitId: jobAirLoading.unitIds[0],
    subOrderIds: ord11.subOrderIds,
  });

  // ============================================================
  // 9. 节点推进 — 写 tracking_event 历史
  // ============================================================

  const advanceWith = (jobId: string, events: Array<[string, string, string, string]>) => {
    for (const [code, name, eventTime, location] of events) {
      advanceNode(db, {
        jobId, nodeCode: code, nodeName: name, eventTime, location,
        operatorUserId: 'user-opscn1',
      });
    }
  };

  // job-sea-completed: 12 节点全完成
  advanceWith(jobSeaCompleted.id, [
    ['WAREHOUSE_OUT',     '已离库',     '2026-02-25 08:00:00', '广州总仓'],
    ['CUSTOMS_EXPORT',    '出口报关',   '2026-02-25 14:00:00', '黄埔海关'],
    ['CUSTOMS_RELEASE',   '海关放行',   '2026-02-26 10:00:00', '黄埔海关'],
    ['DEPARTURE',         '已起运',     '2026-02-27 06:00:00', '广州黄埔港'],
    ['IN_TRANSIT',        '在途运输',   '2026-03-01 12:00:00', '南海'],
    ['ARRIVAL',           '已到港',     '2026-03-21 09:00:00', '拉各斯港'],
    ['CUSTOMS_IMPORT',    '进口申报',   '2026-03-21 15:00:00', 'Apapa Customs'],
    ['CUSTOMS_CLEARED',   '进口放行',   '2026-03-23 11:00:00', 'Apapa Customs'],
    ['WAREHOUSE_IN',      '到达入仓',   '2026-03-24 16:00:00', '拉各斯主仓'],
    ['SIGNED',            '已签收',     '2026-03-26 14:00:00', 'Customer'],
  ]);

  // job-sea-arrived: 到 WAREHOUSE_IN，等待 DPN
  advanceWith(jobSeaArrived.id, [
    ['WAREHOUSE_OUT',     '已离库',     '2026-03-15 08:00:00', '广州总仓'],
    ['CUSTOMS_EXPORT',    '出口报关',   '2026-03-15 14:30:00', '黄埔海关'],
    ['CUSTOMS_RELEASE',   '海关放行',   '2026-03-16 11:00:00', '黄埔海关'],
    ['DEPARTURE',         '已起运',     '2026-03-17 06:00:00', '广州黄埔港'],
    ['IN_TRANSIT',        '在途运输',   '2026-03-19 12:00:00', '南海'],
    ['ARRIVAL',           '已到港',     '2026-04-09 09:00:00', '拉各斯港'],
    ['CUSTOMS_IMPORT',    '进口申报',   '2026-04-09 15:00:00', 'Apapa Customs'],
    ['CUSTOMS_CLEARED',   '进口放行',   '2026-04-11 11:00:00', 'Apapa Customs'],
    ['WAREHOUSE_IN',      '到达入仓',   '2026-04-12 16:00:00', '拉各斯主仓'],
  ]);

  // job-sea-intransit: 到 IN_TRANSIT
  advanceWith(jobSeaInTransit.id, [
    ['WAREHOUSE_OUT',     '已离库',     '2026-04-01 08:00:00', '深圳集货区'],
    ['CUSTOMS_EXPORT',    '出口报关',   '2026-04-01 14:00:00', '深圳海关'],
    ['CUSTOMS_RELEASE',   '海关放行',   '2026-04-02 11:00:00', '深圳海关'],
    ['DEPARTURE',         '已起运',     '2026-04-03 06:00:00', '盐田港'],
    ['IN_TRANSIT',        '在途运输',   '2026-04-05 12:00:00', '南海'],
  ]);

  // job-sea-departed: 到 DEPARTURE
  advanceWith(jobSeaDeparted.id, [
    ['WAREHOUSE_OUT',     '已离库',     '2026-04-10 08:00:00', '广州总仓'],
    ['CUSTOMS_EXPORT',    '出口报关',   '2026-04-10 14:00:00', '黄埔海关'],
    ['CUSTOMS_RELEASE',   '海关放行',   '2026-04-11 11:00:00', '黄埔海关'],
    ['DEPARTURE',         '已起运',     '2026-04-12 06:00:00', '香港葵青港'],
  ]);
  // job-sea-loading 没有节点（还在装箱中）
  // job-sea-planned-* 没有节点
  // job-air-loading 没有节点

  // ============================================================
  // 7. 调拨（3条，对齐 Web 调拨管理数据）
  // ============================================================

  db.exec(`
    INSERT INTO wms_transfer (id, transfer_no, business_line, direction, from_warehouse_name, to_warehouse_name, route_label, job_id, shipping_unit_no, total_pieces, total_weight_kg, transfer_status, created_at) VALUES
    ('trf-1', 'S-T-20260321-0001', 'SEA', 'SATELLITE_TO_MAIN', '深圳集货区', '广州总仓', '深圳集货区→广州总仓→拉各斯主仓', 'job-7', 'SEA-CN-201', 5, 120, 'PENDING', '${now}'),
    ('trf-2', 'S-T-20260321-0002', 'SEA', 'MAIN_TO_SATELLITE', '广州总仓', '佛山拼货区', '广州总仓→佛山拼货区', 'job-8', 'SEA-CN-202', 2, 85, 'IN_TRANSIT', '${now}'),
    ('trf-3', 'S-T-20260321-0003', 'SEA', 'MAIN_TO_SATELLITE', '广州总仓', '海珠区站点', '广州总仓→海珠区站点', 'job-8', 'SEA-CN-203', 3, 60, 'ARRIVED', '${now}');

    INSERT INTO wms_transfer_item (id, transfer_id, sub_order_no, tracking_no, customer_name, pieces, weight_kg, volume_cbm, route, inbound_status) VALUES
    -- trf-1 (PENDING) 5 件 / 2 单
    ('tri-1-1', 'trf-1', 'S-202603260001-01', 'SF26032601', '深圳旺达贸易', 3, 65, 0.18, '深圳→广州', 'PENDING'),
    ('tri-1-2', 'trf-1', 'S-202603260002-01', 'YT26032602', '广州金辉国际', 2, 55, 0.12, '深圳→广州', 'PENDING'),
    -- trf-2 (IN_TRANSIT) 2 件 / 2 单
    ('tri-2-1', 'trf-2', 'S-202603260003-01', 'SF26032603', '联调航海客户PSea-2', 1, 40, 0.08, '广州→佛山', 'PENDING'),
    ('tri-2-2', 'trf-2', 'S-202603260004-01', 'YT26032604', '联调综合客户P1-2026', 1, 45, 0.09, '广州→佛山', 'PENDING'),
    -- trf-3 (ARRIVED) 3 件 / 3 单 — 待入库的核心场景
    ('tri-3-1', 'trf-3', 'S-202603260005-01', 'SF26032605', 'Web联调客户-S1836', 1, 20, 0.05, '广州→海珠', 'PENDING'),
    ('tri-3-2', 'trf-3', 'S-202603260006-01', 'YT26032606', 'Web联调客户-S1836-2', 1, 18, 0.04, '广州→海珠', 'PENDING'),
    ('tri-3-3', 'trf-3', 'S-202603260007-01', 'ZT26032607', '深圳旺达贸易', 1, 22, 0.06, '广州→海珠', 'PENDING');
  `);

  // ============================================================
  // 10. 到达国任务入库 — 链路 A（已完成）& 链路 C（已到达）
  // ============================================================

  // job-sea-completed 已签收，但仍需先生成到达入库记录
  createDestInbound(db, {
    jobId: jobSeaCompleted.id,
    warehouseId: 'wh-los',
    operatorUserId: 'user-whus1',
    inboundAt: '2026-03-24 16:30:00',
    items: [
      ...ord1.subOrderIds.map((sid) => ({ subOrderId: sid, cargoStatus: 'INTACT' as const })),
      ...ord4.subOrderIds.map((sid) => ({ subOrderId: sid, cargoStatus: 'INTACT' as const })),
    ],
  });

  // job-sea-arrived 入库（链路 C，等待 DPN）
  createDestInbound(db, {
    jobId: jobSeaArrived.id,
    warehouseId: 'wh-los',
    operatorUserId: 'user-whus1',
    inboundAt: '2026-04-12 16:30:00',
    items: [
      ...ord8.subOrderIds.map((sid) => ({ subOrderId: sid, cargoStatus: 'INTACT' as const })),
      ...ord9.subOrderIds.map((sid) => ({ subOrderId: sid, cargoStatus: 'INTACT' as const })),
    ],
  });

  // ============================================================
  // 11. POD 末端配送 — DPN
  // ============================================================

  // 链路 A 完成态：本站直接配送给客户，已签收
  createDeliveryDpn(db, {
    id: 'dpn-completed',
    businessLine: 'SEA',
    warehouseId: 'wh-los',
    fromSite: 'IKEJ STA',
    toSite: '客户家',
    customerId: 'cust-1',
    recipientName: 'Ada Nwosu',
    recipientPhone: '+234-903-832-1727',
    recipientAddress: '23 Allen Avenue, Ikeja, Lagos',
    recipientCountry: '尼日利亚',
    recipientCity: '拉各斯',
    deliveryMethod: 'DELIVERY',
    status: 'SIGNED',
    driverName: 'Ibrahim Musa',
    driverPhone: '+234-803-555-4001',
    plateNo: 'LAG-218-AB',
    dispatchTime: '2026-03-25 09:00:00',
    arrivalTime: '2026-03-26 13:00:00',
    remark: '链路A：本站配送，已签收',
    createdBy: 'user-opsus1',
    createdAt: '2026-03-24 17:00:00',
    subOrderIds: [...ord1.subOrderIds, ...ord4.subOrderIds],
    deliveryTasks: [
      {
        recipientName: 'Ada Nwosu',
        recipientPhone: '+234-903-832-1727',
        recipientAddress: '23 Allen Avenue, Ikeja, Lagos',
        taskStatus: 'SIGNED',
        signedBy: 'Ada Nwosu',
        signedAt: '2026-03-26 14:00:00',
        codAmount: 0,
      },
    ],
  });

  // 链路 C-1 (DPN 站点调拨)：拉各斯主仓 → 阿布贾卫星 — ord8
  createTransferDpn(db, {
    id: 'dpn-transfer-abv',
    businessLine: 'SEA',
    fromSite: 'IKEJ STA',
    toSite: 'ABV STA',
    fromWarehouseId: 'wh-los',
    toWarehouseId: 'wh-abv',
    status: 'PENDING_DISPATCH',
    driverName: 'Chukwu Obi',
    driverPhone: '+234-803-555-3001',
    plateNo: 'ABV-446-CD',
    remark: '链路C：调拨到阿布贾卫星站',
    createdBy: 'user-opsus1',
    createdAt: '2026-04-13 10:00:00',
    subOrderIds: ord8.subOrderIds,
  });

  // 链路 C-2：本站配送给 ord9 客户（与调拨平行）
  createDeliveryDpn(db, {
    id: 'dpn-delivering',
    businessLine: 'SEA',
    warehouseId: 'wh-los',
    fromSite: 'IKEJ STA',
    toSite: '客户家',
    customerId: 'cust-5',
    recipientName: 'Amina Yusuf',
    recipientPhone: '+234-803-555-2001',
    recipientAddress: '15 Awolowo Way, Ikeja, Lagos',
    recipientCountry: '尼日利亚',
    recipientCity: '拉各斯',
    deliveryMethod: 'DELIVERY',
    status: 'IN_TRANSIT',
    driverName: 'Ibrahim Musa',
    driverPhone: '+234-803-555-4001',
    plateNo: 'LAG-218-AB',
    dispatchTime: '2026-04-13 14:00:00',
    remark: '链路C 配角：本站配送中',
    createdBy: 'user-opsus1',
    createdAt: '2026-04-13 09:30:00',
    subOrderIds: ord9.subOrderIds,
    deliveryTasks: [
      {
        recipientName: 'Amina Yusuf',
        recipientPhone: '+234-803-555-2001',
        recipientAddress: '15 Awolowo Way, Ikeja, Lagos',
        taskStatus: 'IN_TRANSIT',
      },
    ],
  });

  // ============================================================
  // 12. 财务 — 应收/应付/付款
  // ============================================================

  // 链路 A (ord1+ord4) 已完成 → 应收 + 应付都已结清
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'ORDER',
    relatedId: ord1.id, relatedNo: ord1.orderNo,
    feeItemCode: 'FREIGHT', feeDirection: 'RECEIVABLE',
    amount: 4800, currencyCode: 'CNY',
    counterpartyName: '深圳市臻诚跨境贸易有限公司',
    feeStatus: 'PAID',
    description: '运费 - GZ→LOS 海运 LCL',
    createdBy: 'user-fin1',
    createdAt: '2026-02-26 09:00:00',
  });
  const oceanFreight1 = recordFee(db, {
    businessLine: 'SEA', feeLevel: 'JOB',
    relatedId: jobSeaCompleted.id, relatedNo: jobSeaCompleted.jobNo,
    feeItemCode: 'OCEAN_FREIGHT', feeDirection: 'PAYABLE',
    amount: 18000, currencyCode: 'CNY',
    counterpartyName: '马士基',
    feeStatus: 'PAID',
    description: '海运费 - 40HQ MSKU1234567',
    createdBy: 'user-fin1',
    createdAt: '2026-02-27 10:00:00',
  });
  recordPayment(db, {
    relatedFeeId: oceanFreight1.id,
    paymentType: 'OUTBOUND',
    amount: 18000, currencyCode: 'CNY',
    paymentMethod: '银行转账',
    paymentTime: '2026-03-05 14:00:00',
    remark: '付马士基 2 月海运费',
    createdAt: '2026-03-05 14:00:00',
  });
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'JOB',
    relatedId: jobSeaCompleted.id, relatedNo: jobSeaCompleted.jobNo,
    feeItemCode: 'TRUCKING', feeDirection: 'PAYABLE',
    amount: 1200, currencyCode: 'CNY',
    counterpartyName: '广州顺达拖车',
    feeStatus: 'PAID',
    description: '拖车费 - 黄埔港',
    createdBy: 'user-fin1',
    createdAt: '2026-02-28 10:00:00',
  });
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'JOB',
    relatedId: jobSeaCompleted.id, relatedNo: jobSeaCompleted.jobNo,
    feeItemCode: 'CUSTOMS_EXPORT', feeDirection: 'PAYABLE',
    amount: 800, currencyCode: 'CNY',
    counterpartyName: '广州外代',
    feeStatus: 'PAID',
    description: '出口报关费',
    createdBy: 'user-fin1',
    createdAt: '2026-02-28 11:00:00',
  });

  // ord4 应收
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'ORDER',
    relatedId: ord4.id, relatedNo: ord4.orderNo,
    feeItemCode: 'FREIGHT', feeDirection: 'RECEIVABLE',
    amount: 3600, currencyCode: 'CNY',
    counterpartyName: '广州海通进出口有限公司',
    feeStatus: 'PAID',
    description: '运费 - GZ→LOS',
    createdBy: 'user-fin1',
    createdAt: '2026-02-27 09:00:00',
  });

  // 链路 B (ord6+ord7 在途)：应收已收，应付待付
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'ORDER',
    relatedId: ord6.id, relatedNo: ord6.orderNo,
    feeItemCode: 'FREIGHT', feeDirection: 'RECEIVABLE',
    amount: 6800, currencyCode: 'CNY',
    counterpartyName: '东莞恒通电子科技有限公司',
    feeStatus: 'APPROVED',
    description: '运费 - SZ→LOS 在途',
    createdBy: 'user-fin1',
    createdAt: '2026-04-02 10:00:00',
  });
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'JOB',
    relatedId: jobSeaInTransit.id, relatedNo: jobSeaInTransit.jobNo,
    feeItemCode: 'OCEAN_FREIGHT', feeDirection: 'PAYABLE',
    amount: 19500, currencyCode: 'CNY',
    counterpartyName: '中远海运',
    feeStatus: 'APPROVED',
    description: '海运费 - 40HQ COSU3456789',
    createdBy: 'user-fin1',
    createdAt: '2026-04-03 11:00:00',
  });

  // 链路 C (ord8+ord9): 应收已结清
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'ORDER',
    relatedId: ord8.id, relatedNo: ord8.orderNo,
    feeItemCode: 'FREIGHT', feeDirection: 'RECEIVABLE',
    amount: 7200, currencyCode: 'CNY',
    counterpartyName: '深圳旺达跨境贸易有限公司',
    feeStatus: 'PAID',
    description: '运费 - GZ→LOS 待 DPN 转运到 ABV',
    createdBy: 'user-fin1',
    createdAt: '2026-03-13 10:00:00',
  });
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'ORDER',
    relatedId: ord9.id, relatedNo: ord9.orderNo,
    feeItemCode: 'FREIGHT', feeDirection: 'RECEIVABLE',
    amount: 3200, currencyCode: 'CNY',
    counterpartyName: '深圳旺达跨境贸易有限公司',
    feeStatus: 'PAID',
    description: '运费 - GZ→LOS 本站配送',
    createdBy: 'user-fin1',
    createdAt: '2026-03-13 10:30:00',
  });
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'JOB',
    relatedId: jobSeaArrived.id, relatedNo: jobSeaArrived.jobNo,
    feeItemCode: 'OCEAN_FREIGHT', feeDirection: 'PAYABLE',
    amount: 18500, currencyCode: 'CNY',
    counterpartyName: '马士基',
    feeStatus: 'PAID',
    description: '海运费 - 40HQ MSKU2345678',
    createdBy: 'user-fin1',
    createdAt: '2026-03-18 09:00:00',
  });
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'DPN',
    relatedId: 'dpn-transfer-abv',
    feeItemCode: 'LAST_MILE', feeDirection: 'PAYABLE',
    amount: 850, currencyCode: 'NGN', fxRate: 0.0047,
    counterpartyName: '阿布贾本地拖车',
    feeStatus: 'DRAFT',
    description: '末端派送费 - IKEJ→ABV',
    createdBy: 'user-fin1',
    createdAt: '2026-04-13 11:00:00',
  });

  // ord5 (装箱中) 应收待审批
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'ORDER',
    relatedId: ord5.id, relatedNo: ord5.orderNo,
    feeItemCode: 'FREIGHT', feeDirection: 'RECEIVABLE',
    amount: 5600, currencyCode: 'CNY',
    counterpartyName: '义乌锦沪国际物流有限公司',
    feeStatus: 'PENDING_APPROVAL',
    description: '运费 - GZ→LOS 装箱中',
    createdBy: 'user-sales1',
    createdAt: '2026-04-13 14:00:00',
  });

  // ord10 (DEPARTED) 应付驳回
  recordFee(db, {
    businessLine: 'SEA', feeLevel: 'ORDER',
    relatedId: ord10.id, relatedNo: ord10.orderNo,
    feeItemCode: 'INSURANCE', feeDirection: 'RECEIVABLE',
    amount: 380, currencyCode: 'CNY',
    counterpartyName: '广州金辉国际贸易有限公司',
    feeStatus: 'REJECTED',
    description: '保险费 - 客户拒付',
    createdBy: 'user-sales1',
    createdAt: '2026-04-08 14:00:00',
  });

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
