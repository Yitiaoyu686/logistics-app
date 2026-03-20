import { getDb } from './connection';

export function seedData() {
  const db = getDb();

  // Check if already seeded
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  if (userCount > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database...');
  const now = new Date().toISOString();

  // ========== 1. USERS ==========
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, realName, password, email, phone, role, status, department, warehouseId, warehouseName, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)
  `);

  const users = [
    ['USR-001', 'admin', '系统管理员', 'admin123', 'admin@logistics.com', '13800000000', 'ADMIN', '管理部', null, null],
    ['USR-002', 'sales1', 'AkinGbolahan', 'sales123', 'akin@logistics.com', '13800000001', 'SALES', '销售部', null, null],
    ['USR-003', 'warehouse_cn1', '李仓管', 'wh123', 'licg@logistics.com', '13800000002', 'WAREHOUSE_CN', '国内仓储部', 'WH-GZ-001', '广州仓库'],
    ['USR-004', 'ops_cn1', '张运营', 'ops123', 'zhangops@logistics.com', '13800000003', 'OPS_CN', '国内运营部', null, null],
    ['USR-005', 'ops_us1', '赵运营', 'ops123', 'zhaoops@logistics.com', '13800000004', 'OPS_US', '海外运营部', null, null],
    ['USR-006', 'warehouse_us1', '王仓管', 'wh123', 'wangcg@logistics.com', '13800000005', 'WAREHOUSE_US', '海外仓储部', 'WH-LOS-001', '拉各斯仓库'],
    ['USR-007', 'finance1', '钱财务', 'fin123', 'qian@logistics.com', '13800000006', 'FINANCE', '财务部', null, null],
    ['USR-008', 'boss1', '孙总', 'boss123', 'sun@logistics.com', '13800000007', 'BOSS', '总经办', null, null],
    ['USR-009', 'driver1', 'Emmanuel', 'drv123', 'emmanuel@logistics.com', '+234-803-1234567', 'DRIVER', '配送部', 'WH-LOS-001', '拉各斯仓库'],
    ['USR-010', 'driver2', 'Chidi', 'drv123', 'chidi@logistics.com', '+234-803-9876543', 'DRIVER', '配送部', 'WH-LOS-001', '拉各斯仓库'],
  ];

  const seedUsers = db.transaction(() => {
    for (const u of users) {
      insertUser.run(...u, now);
    }
  });
  seedUsers();

  const shouldSeedLegacyDemoData = process.env.SEED_LEGACY_DEMO_DATA === '1';
  if (!shouldSeedLegacyDemoData) {
    console.log('[legacy] Skip demo business seed data (set SEED_LEGACY_DEMO_DATA=1 to enable)');
    return;
  }

  // ========== 2. CLIENTS ==========
  const insertClient = db.prepare(`
    INSERT INTO clients (id, shortCode, name, country, address, industry, contact, logisticsInfo, status, poolType, salesId, source, totalOrders, lastOrderTime, remark, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedClients = db.transaction(() => {
    // Private pool clients (我的客户)
    insertClient.run('C1', 'SZ01', '深圳大疆贸易有限公司', '中国', null, '电商',
      JSON.stringify({ name: '张经理', phone: '13800138001', email: 'zhang@dji-trade.com' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', '自主开发', 50, null, null, '2025-02-09T00:00:00Z');
    insertClient.run('C2', 'SH05', '上海极客电子科技有限公司', '中国', null, '电商',
      JSON.stringify({ name: '李思', phone: '13911112222', email: 'li.si@geek-elec.com' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', null, 20, null, null, '2025-11-01T00:00:00Z');
    insertClient.run('C3', 'GZ09', '广州佰伦斯实业', '中国', null, '贸易',
      JSON.stringify({ name: '陈先生', phone: '13588889999' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', null, 15, null, null, '2025-07-24T00:00:00Z');
    insertClient.run('C4', 'NB02', '宁波博洋家纺', '中国', null, '工厂',
      JSON.stringify({ name: '王女士', phone: '13677778888' }),
      null, 'DORMANT', 'PRIVATE', 'USR-002', null, 2, '2025-08-14T00:00:00Z', null, '2025-01-06T00:00:00Z');
    insertClient.run('C5', 'YI01', '义乌市小商品出口中心', '中国', null, '贸易',
      JSON.stringify({ name: '林老板', phone: '13100001111' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', null, 120, null, null, '2024-09-28T00:00:00Z');
    insertClient.run('C6', 'BJ03', '北京蓝天文化创意', '中国', null, '其他',
      JSON.stringify({ name: '赵总', phone: '18600001234' }),
      null, 'FROZEN', 'PRIVATE', 'USR-002', null, 1, null, null, '2025-12-21T00:00:00Z');

    // Public pool clients (公海池)
    insertClient.run('P1', 'LOST', '杭州跨贸通电子商务', '中国', null, null,
      JSON.stringify({ name: '王**', phone: '137****5555' }),
      null, 'ACTIVE', 'PUBLIC', null, null, 0, null, null, '2025-04-15T00:00:00Z');
    insertClient.run('P2', 'NEW1', '成都风行国际贸易', '中国', null, null,
      JSON.stringify({ name: '刘**', phone: '158****0000' }),
      null, 'ACTIVE', 'PUBLIC', null, null, 0, null, null, '2026-02-08T00:00:00Z');
    insertClient.run('P3', 'DROP', '厦门悦海进出口有限公司', '中国', null, null,
      JSON.stringify({ name: '苏**', phone: '133****1111' }),
      null, 'DORMANT', 'PUBLIC', null, null, 5, '2025-07-24T00:00:00Z', null, '2024-05-24T00:00:00Z');
    insertClient.run('P4', 'LEAD', '青岛金利机械厂', '中国', null, null,
      JSON.stringify({ name: '孙**', phone: '150****8888' }),
      null, 'ACTIVE', 'PUBLIC', null, null, 0, null, null, '2026-01-30T00:00:00Z');
    insertClient.run('P5', 'TEMP', '郑州跨境优选(意向)', '中国', null, null,
      JSON.stringify({ name: '周**', phone: '189****9999' }),
      null, 'ACTIVE', 'PUBLIC', null, null, 0, null, null, '2026-02-06T00:00:00Z');

    // Additional clients from orderMock (referenced by master orders)
    insertClient.run('CUST-001', 'ZS001', '张三贸易公司', '中国', '广东省广州市天河区xxx路xxx号', '贸易',
      JSON.stringify({ name: '李经理', phone: '13800138000' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', null, 10, null, null, '2024-01-01T00:00:00Z');
    insertClient.run('CUST-002', 'LS002', '李四电商', '中国', '广东省深圳市南山区xxx路xxx号', '电商',
      JSON.stringify({ name: '王经理', phone: '13900139000' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', null, 5, null, null, '2024-01-01T00:00:00Z');
    insertClient.run('CUST-003', 'WW003', '王五进出口', '中国', '上海市浦东新区xxx路xxx号', '贸易',
      JSON.stringify({ name: '赵经理', phone: '13700137000' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', null, 3, null, null, '2024-01-01T00:00:00Z');
    insertClient.run('CUST-004', 'ZL004', '赵六国际', '中国', '广东省东莞市长安镇xxx路xxx号', '贸易',
      JSON.stringify({ name: '钱经理', phone: '13600136000' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', null, 2, null, null, '2024-01-01T00:00:00Z');
    insertClient.run('CUST-005', 'SQ005', '孙七贸易', '中国', '浙江省义乌市xxx路xxx号', '贸易',
      JSON.stringify({ name: '周经理', phone: '13500135000' }),
      null, 'ACTIVE', 'PRIVATE', 'USR-002', null, 1, null, null, '2024-01-01T00:00:00Z');
  });
  seedClients();

  // ========== 3. JOBS (must be created before shipping_units and sub_orders that reference them) ==========
  const insertJob = db.prepare(`
    INSERT INTO jobs (jobNo, route, pol, pod, transitPort, carrier, billOfLading, vesselVoyage, flightNo, transportType, currentPhase, originPhaseStatus, destPhaseStatus, originOperator, destOperator, status, etd, eta, atd, ata, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedJobs = db.transaction(() => {
    insertJob.run('JOB-SZX-LAX-231028', '深圳 (SZX) → 洛杉矶 (LAX)', '深圳港', '洛杉矶港', null, 'MAERSK', null, null, null, 'SEA', 'IN_TRANSIT', 'DEPARTED', 'IN_TRANSIT', '张运营', null, 'DEPARTED', '2024-01-20', '2024-02-05', null, null, null, '2024-01-15T00:00:00Z', now);
    insertJob.run('JOB-PVG-LHR-231030', '上海 (PVG) → 伦敦 (LHR)', '上海浦东机场', '伦敦希思罗机场', null, 'CA', null, null, null, 'AIR', 'ORIGIN', 'PLANNED', 'IN_TRANSIT', '李运营', null, 'PLANNED', '2024-01-25', '2024-01-26', null, null, null, '2024-01-20T00:00:00Z', now);
    insertJob.run('JOB-20260125-001', '深圳 → 拉各斯', '深圳港', '拉各斯港', null, 'MAERSK LINE', null, 'MAERSK LINE', null, 'SEA', 'DESTINATION', 'DEPARTED', 'CUSTOMS_CLEARANCE', '王运营', '李运营', 'IN_TRANSIT', '2026-01-25 10:00:00', '2026-02-15 08:00:00', '2026-01-25 14:30:00', '2026-02-14 16:20:00', null, '2026-01-25 09:00:00', '2026-02-14 17:00:00');
    insertJob.run('JOB-20260120-002', '广州 → 阿克拉', '广州白云机场', '阿克拉机场', null, 'CZ6043', null, 'CZ6043', 'CZ6043', 'AIR', 'DESTINATION', 'DEPARTED', 'CLEARED', '张运营', '赵运营', 'CLEARED', '2026-01-28 22:00:00', '2026-01-29 06:30:00', '2026-01-28 23:15:00', '2026-01-29 06:45:00', null, '2026-01-20 10:00:00', '2026-01-30 15:30:00');
    // Air jobs referenced by sub_orders
    insertJob.run('JOB-AIR-240118-001', '深圳 → 拉各斯', '深圳机场', '拉各斯机场', null, 'CZ', null, null, 'CZ6043', 'AIR', 'DESTINATION', 'DEPARTED', 'CLEARED', '张运营', null, 'COMPLETED', '2024-01-18 20:00:00', '2024-01-19 14:30:00', '2024-01-18 20:00:00', '2024-01-19 14:30:00', null, '2024-01-15T00:00:00Z', now);
    insertJob.run('JOB-AIR-240110-002', '上海 → 伦敦', '上海浦东机场', '伦敦希思罗机场', null, 'CA', null, null, null, 'AIR', 'DESTINATION', 'DEPARTED', 'CLEARED', '李运营', null, 'COMPLETED', '2024-01-11 18:00:00', '2024-01-12 20:30:00', '2024-01-11 18:00:00', '2024-01-12 20:30:00', null, '2024-01-10T00:00:00Z', now);
  });
  seedJobs();

  // ========== 4. SHIPPING_UNITS ==========
  const insertUnit = db.prepare(`
    INSERT INTO shipping_units (id, unitNo, unitType, transportMode, maxWeight, maxVolume, currentWeight, currentVolume, loadedPieces, loadedOrders, sealNo, warehouse, location, jobNo, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedUnits = db.transaction(() => {
    // Sea containers - shipped
    insertUnit.run('UNIT-001', 'MSKU1234567', '40HQ', 'SEA', 26000, 76, 18500, 58, 30, 2, 'SEAL123456', '深圳龙岗仓A区', null, 'JOB-SZX-LAX-231028', 'SHIPPED', null, '2024-01-05T00:00:00Z', now);
    insertUnit.run('UNIT-002', 'MSCU9876543', '40HQ', 'SEA', 26000, 76, 19800, 62, 40, 2, 'SEAL789012', '深圳龙岗仓A区', null, 'JOB-SZX-LAX-231028', 'SHIPPED', null, '2024-01-05T00:00:00Z', now);
    insertUnit.run('UNIT-003', 'TEMU5555555', '40HQ', 'SEA', 26000, 76, 17200, 54, 20, 1, 'SEAL345678', '深圳龙岗仓A区', null, 'JOB-SZX-LAX-231028', 'SHIPPED', null, '2024-01-05T00:00:00Z', now);
    // Sea containers - sealed, no job
    insertUnit.run('UNIT-004', 'CMAU8888888', '40HQ', 'SEA', 26000, 76, 20800, 65, 38, 0, 'SEAL111222', '深圳宝安仓B区', null, null, 'SEALED', null, '2024-01-07T00:00:00Z', now);
    insertUnit.run('UNIT-005', 'OOLU7777777', '40GP', 'SEA', 26000, 67.7, 22000, 55, 42, 0, 'SEAL333444', '上海浦东仓C区', null, null, 'SEALED', null, '2024-01-09T00:00:00Z', now);
    insertUnit.run('UNIT-006', 'HDMU6666666', '20GP', 'SEA', 21000, 33, 15000, 28, 25, 0, 'SEAL555666', '深圳龙岗仓A区', null, null, 'SEALED', null, '2024-01-10T00:00:00Z', now);
    // Air units
    insertUnit.run('UNIT-AIR-001', 'PLT-20240115-001', 'PALLET', 'AIR', 1000, 5, 850, 1.92, 70, 1, null, '广州白云仓', null, 'JOB-AIR-240118-001', 'SHIPPED', '已打板，等待航班', '2024-01-10T00:00:00Z', now);
    insertUnit.run('UNIT-AIR-002', 'PLT-20240116-002', 'PALLET', 'AIR', 1000, 5, 720, 1.68, 150, 1, null, '上海浦东仓', null, 'JOB-AIR-240110-002', 'SHIPPED', '已发运', '2024-01-12T00:00:00Z', now);
    insertUnit.run('AIR-003', 'CTN-20240117-001', 'CARTON', 'AIR', 500, 2, 25, 0.12, 5, 0, null, '深圳龙岗仓', null, null, 'EMPTY', '小件货物，待打板', '2024-01-14T00:00:00Z', now);
    // Sea container for JOB-20260125-001 (深圳→拉各斯)
    insertUnit.run('UNIT-SEA-LOS-001', 'MSCU2026125', '40HQ', 'SEA', 26000, 76, 113.1, 0.811, 167, 2, 'SEAL260125', '深圳蛇口港', null, 'JOB-20260125-001', 'SHIPPED', '已装船', '2026-01-20T00:00:00Z', '2026-01-25T14:30:00Z');
    // Air pallet for JOB-20260120-002 (广州→阿克拉)
    insertUnit.run('UNIT-AIR-ACCRA-001', 'PLT-20260120-001', 'PALLET', 'AIR', 1000, 5, 0, 0, 0, 0, null, '广州白云仓', null, 'JOB-20260120-002', 'SHIPPED', '已发运至阿克拉', '2026-01-18T00:00:00Z', '2026-01-28T23:15:00Z');
  });
  seedUnits();

  // ========== 5. MASTER_ORDERS ==========
  const insertMaster = db.prepare(`
    INSERT INTO master_orders (id, customerId, customerName, status, splitStatus, totalPieces, totalWeight, totalVolume, totalValue, sender, senderPhone, senderAddress, consignee, consigneePhone, consigneeEmail, destCountry, destCity, destAddress, transportType, totalFreight, paidAmount, paymentStatus, salesPerson, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedMasters = db.transaction(() => {
    insertMaster.run('ORD-20240115-001', 'CUST-001', '张三贸易公司', 'IN_TRANSIT', 'COMPLETED', 239, 143.76, 2.575, 22650, '李经理', '13800138000', '广东省广州市天河区xxx路xxx号', 'John Doe', '+234-123-4567890', 'john@example.com', '尼日利亚', '拉各斯', 'Lagos Main Street, Block A, No.123', 'SEA', 5130, 2150, 'PARTIAL', 'AkinGbolahan', '客户要求部分货物加急空运', '2024-01-15 14:30:00', '2024-01-21 08:00:00');
    insertMaster.run('ORD-20260218-002', 'CUST-002', '李四电商', 'PENDING_INBOUND', 'PENDING', 300, 75, 0.43, 23000, '王经理', '13900139000', '广东省深圳市南山区xxx路xxx号', 'Alice Wang', '+1-555-123-4567', 'alice@example.com', '美国', '洛杉矶', '123 Main St, Los Angeles, CA 90001', 'SEA', 1200, 0, 'UNPAID', null, '等待收货入库', '2026-02-18 10:20:00', '2026-02-18 10:20:00');
    insertMaster.run('ORD-20240110-003', 'CUST-003', '王五进出口', 'COMPLETED', 'COMPLETED', 150, 30, 0.15, 4500, '赵经理', '13700137000', '上海市浦东新区xxx路xxx号', 'Bob Chen', '+44-20-1234-5678', 'bob@example.com', '英国', '伦敦', '456 Oxford Street, London, UK', 'AIR', 800, 800, 'PAID', null, '已完成订单', '2024-01-10 09:00:00', '2024-01-15 16:30:00');
    insertMaster.run('ORD-20240120-004', 'CUST-004', '赵六国际', 'RETURN_APPLIED', 'PENDING', 60, 9, 0.06, 3300, '钱经理', '13600136000', '广东省东莞市长安镇xxx路xxx号', 'David Smith', '+233-50-1234567', 'david@example.com', '加纳', '阿克拉', '123 Independence Ave, Accra', 'SEA', 650, 650, 'PAID', null, '客户申请退单，等待审核', '2024-01-20 11:00:00', '2024-01-22 09:30:00');
    insertMaster.run('ORD-20240108-005', 'CUST-005', '孙七贸易', 'CANCELLED', 'PENDING', 20, 60, 1.0, 4000, '周经理', '13500135000', '浙江省义乌市xxx路xxx号', 'Grace Obi', '+234-803-9876543', 'grace@example.com', '尼日利亚', '阿布贾', '456 Central District, Abuja', 'SEA', 1500, 1500, 'PAID', null, '已退单，货物已退运处理', '2024-01-08 15:00:00', '2024-01-18 14:00:00');
    // 义乌小商品 - 近期订单，部分包裹已到仓
    insertMaster.run('ORD-20260215-006', 'C5', '义乌市小商品出口中心', 'PENDING_INBOUND', 'PARTIAL', 60, 22, 0.15, 6800, '林老板', '13100001111', '浙江省义乌市国际商贸城xxx区xxx号', 'Emeka Okafor', '+234-806-5678901', 'emeka@example.com', '尼日利亚', '拉各斯', '88 Opebi Road, Ikeja, Lagos', 'SEA', 1200, 0, 'UNPAID', 'AkinGbolahan', '客户新单，工艺品+日用品混装', '2026-02-15 10:00:00', '2026-02-24 09:00:00');
  });
  seedMasters();

  // ========== 6. SUB_ORDERS ==========
  const insertSub = db.prepare(`
    INSERT INTO sub_orders (id, masterOrderId, batchNo, pieces, weight, volume, value, status, transportType, route, warehouseId, shippingUnitId, jobNo, currentNode, freight, totalFee, consignee, consigneePhone, destCountry, destCity, destAddress, expressCompany, expressTrackingNo, goodsDescription, etd, eta, atd, ata, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedSubs = db.transaction(() => {
    insertSub.run('ORD-20240115-001-01', 'ORD-20240115-001', 1, 1, 0.52, 0.52, 10250, 'IN_TRANSIT', 'SEA', '广州 → 拉各斯', 'WH-GZ-001', 'UNIT-001', 'JOB-SZX-LAX-231028', '海上运输中', 850, 1050, 'John Doe', '+234-123-4567890', '尼日利亚', '拉各斯', 'Lagos Main Street, Block A, No.123', '顺丰速运', 'SF1012605193752', 'huoguolu', '2024-01-20 14:00:00', '2024-02-05 08:00:00', '2024-01-20 14:00:00', null, null, '2024-01-15 14:30:00', '2024-01-21 08:00:00');
    insertSub.run('ORD-20240115-001-02', 'ORD-20240115-001', 1, 1, 1.14, 1.14, 5800, 'IN_TRANSIT', 'SEA', '广州 → 拉各斯', 'WH-GZ-001', 'UNIT-001', 'JOB-SZX-LAX-231028', '海上运输中', 680, 680, 'John Doe', '+234-123-4567890', '尼日利亚', '拉各斯', 'Lagos Main Street, Block A, No.123', '韵达快递', '4301568788544', 'Seat cushion', '2024-01-20 14:00:00', '2024-02-05 08:00:00', '2024-01-20 14:00:00', null, null, '2024-01-15 14:30:00', '2024-01-21 08:00:00');
    insertSub.run('ORD-20240115-001-03', 'ORD-20240115-001', 2, 70, 29, 0.104, 6600, 'DELIVERED', 'AIR', '深圳 → 拉各斯', 'WH-SZ-001', 'UNIT-AIR-001', 'JOB-AIR-240118-001', '已签收', 1800, 2150, 'John Doe', '+234-123-4567890', '尼日利亚', '拉各斯', 'Lagos Main Street, Block A, No.123', null, null, null, '2024-01-18 20:00:00', '2024-01-19 14:30:00', '2024-01-18 20:00:00', '2024-01-19 14:30:00', '加急空运，已按时送达', '2024-01-15 14:30:00', '2024-01-20 18:30:00');
    insertSub.run('ORD-20240110-003-01', 'ORD-20240110-003', 1, 150, 30, 0.15, 4500, 'DELIVERED', 'AIR', '上海 → 伦敦', 'WH-SH-001', 'UNIT-AIR-002', 'JOB-AIR-240110-002', '已签收', 800, 800, 'Bob Chen', '+44-20-1234-5678', '英国', '伦敦', '456 Oxford Street, London, UK', null, null, null, '2024-01-11 18:00:00', '2024-01-12 20:30:00', '2024-01-11 18:00:00', '2024-01-12 20:30:00', null, '2024-01-10 09:00:00', '2024-01-15 16:30:00');
    // ORD-20260218-002 子订单 - 李四电商 → 美国洛杉矶（批1已入库，批2待到货）
    insertSub.run('ORD-20260218-002-01', 'ORD-20260218-002', 1, 100, 5, 0.03, 15000, 'INBOUND', 'SEA', '深圳 → 洛杉矶', 'WH-SZ-001', null, null, '已入库', 600, 600, 'Alice Wang', '+1-555-123-4567', '美国', '洛杉矶', '123 Main St, Los Angeles, CA 90001', '顺丰速运', 'SF1099887766', '智能手表 Smart Watch', null, null, null, null, null, '2026-02-18 10:20:00', '2026-02-20 15:30:00');
    insertSub.run('ORD-20260218-002-02', 'ORD-20260218-002', 1, 200, 70, 0.40, 8000, 'PENDING_INBOUND', 'SEA', '深圳 → 洛杉矶', 'WH-SZ-001', null, null, '等待到货', 600, 600, 'Alice Wang', '+1-555-123-4567', '美国', '洛杉矶', '123 Main St, Los Angeles, CA 90001', '圆通速递', 'YT1234509876', '保温杯 Thermos', null, null, null, null, null, '2026-02-18 10:20:00', '2026-02-18 10:20:00');
    // ORD-20260215-006 子订单 - 义乌小商品 → 拉各斯（批1已入库，批2入库中）
    insertSub.run('ORD-20260215-006-01', 'ORD-20260215-006', 1, 50, 12, 0.08, 4500, 'INBOUND', 'SEA', '广州 → 拉各斯', 'WH-GZ-001', null, null, '已入库', 700, 700, 'Emeka Okafor', '+234-806-5678901', '尼日利亚', '拉各斯', '88 Opebi Road, Ikeja, Lagos', '顺丰速运', 'SF20260215001', '工艺品摆件 Crafts', null, null, null, null, null, '2026-02-15 10:00:00', '2026-02-22 10:30:00');
    insertSub.run('ORD-20260215-006-02', 'ORD-20260215-006', 1, 10, 10, 0.07, 2300, 'INBOUND', 'SEA', '广州 → 拉各斯', 'WH-GZ-001', null, null, '入库处理中', 500, 500, 'Emeka Okafor', '+234-806-5678901', '尼日利亚', '拉各斯', '88 Opebi Road, Ikeja, Lagos', '申通快递', 'ST20260224001', '日用百货 Daily Goods', null, null, null, null, null, '2026-02-15 10:00:00', '2026-02-24 09:00:00');
    // ORD-20240115-001 拉各斯海运新批次 - 关联 JOB-20260125-001（深圳→拉各斯 SEA，目前在清关中）
    insertSub.run('ORD-20240115-001-04', 'ORD-20240115-001', 3, 120, 85.5, 0.620, 9600, 'ARRIVED', 'SEA', '深圳 → 拉各斯', 'WH-SZ-001', 'UNIT-SEA-LOS-001', 'JOB-20260125-001', '已到达拉各斯港，清关入库中', 1200, 1200, 'John Doe', '+234-123-4567890', '尼日利亚', '拉各斯', 'Lagos Main Street, Block A, No.123', null, null, null, '2026-01-25 14:30:00', '2026-02-14 16:20:00', '2026-01-25 14:30:00', '2026-02-14 16:20:00', '海运到达，分两批清关，第一批已完成', '2026-01-10 08:00:00', '2026-02-14 17:00:00');
    insertSub.run('ORD-20240115-001-05', 'ORD-20240115-001', 3, 47, 27.6, 0.191, 4200, 'ARRIVED', 'SEA', '深圳 → 拉各斯', 'WH-SZ-001', 'UNIT-SEA-LOS-001', 'JOB-20260125-001', '已到达，正在处理局部破损货物', 600, 600, 'John Doe', '+234-123-4567890', '尼日利亚', '拉各斯', 'Lagos Main Street, Block A, No.123', null, null, null, '2026-01-25 14:30:00', '2026-02-14 16:20:00', '2026-01-25 14:30:00', '2026-02-14 16:20:00', '海运到达，部分货物外箱破损，内物核查中', '2026-01-10 08:00:00', '2026-02-14 17:00:00');
    // ORD-20240120-004 子订单 - 赵六国际 → 加纳阿克拉（退单申请中）
    insertSub.run('ORD-20240120-004-01', 'ORD-20240120-004', 1, 60, 9, 0.06, 3300, 'RETURN_APPLIED', 'SEA', '东莞 → 阿克拉', 'WH-SZ-001', null, null, '退单申请中', 650, 650, 'David Smith', '+233-50-1234567', '加纳', '阿克拉', '123 Independence Ave, Accra', null, null, null, null, null, null, null, '客户申请退单，等待审核', '2024-01-20 11:00:00', '2024-01-22 09:30:00');
  });
  seedSubs();

  // ========== 7. ORDER_ITEMS ==========
  const insertItem = db.prepare(`
    INSERT INTO order_items (id, masterOrderId, subOrderId, name, nameEn, quantity, unitPrice, weight, volume, category, attributes, declaredValue, hsCode, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedItems = db.transaction(() => {
    insertItem.run('ITEM-001', 'ORD-20240115-001', 'ORD-20240115-001-01', '蓝牙耳机', 'Bluetooth Headphones', 50, 45, 0.15, 0.001, '电子产品', JSON.stringify(['带电池', '普货']), 2250, '8518300000', null);
    insertItem.run('ITEM-002', 'ORD-20240115-001', 'ORD-20240115-001-01', '运动鞋', 'Sports Shoes', 100, 80, 0.6, 0.012, '服装鞋帽', JSON.stringify(['纺织品', '普货']), 8000, '6403990090', null);
    insertItem.run('ITEM-003', 'ORD-20240115-001', 'ORD-20240115-001-02', '手机支架', 'Phone Holder', 200, 15, 0.08, 0.0005, '日用百货', JSON.stringify(['普货']), 3000, '3926909090', null);
    insertItem.run('ITEM-004', 'ORD-20240115-001', 'ORD-20240115-001-03', '充电宝', 'Power Bank', 30, 60, 0.3, 0.0008, '电子产品', JSON.stringify(['带电池', '带磁性']), 1800, '8507600090', null);
    insertItem.run('ITEM-005', 'ORD-20240115-001', 'ORD-20240115-001-02', 'LED台灯', 'LED Desk Lamp', 80, 35, 0.4, 0.003, '日用百货', JSON.stringify(['带电池', '普货']), 2800, '9405409000', null);
    insertItem.run('ITEM-006', 'ORD-20240115-001', 'ORD-20240115-001-03', '化妆品套装', 'Cosmetics Set', 40, 120, 0.5, 0.002, '化妆品', JSON.stringify(['液体类', '膏状体']), 4800, '3304990099', null);
    insertItem.run('ITEM-007', 'ORD-20260218-002', 'ORD-20260218-002-01', '智能手表', 'Smart Watch', 100, 150, 0.05, 0.0003, '电子产品', JSON.stringify(['带电池', '带磁性']), 15000, null, null);
    insertItem.run('ITEM-008', 'ORD-20260218-002', 'ORD-20260218-002-02', '保温杯', 'Thermos', 200, 40, 0.35, 0.002, '日用百货', JSON.stringify(['普货']), 8000, null, null);
    insertItem.run('ITEM-012', 'ORD-20260215-006', 'ORD-20260215-006-01', '工艺品摆件', 'Crafts & Ornaments', 50, 90, 0.24, 0.0016, '工艺品', JSON.stringify(['普货']), 4500, null, null);
    insertItem.run('ITEM-013', 'ORD-20260215-006', 'ORD-20260215-006-02', '日用百货', 'Daily Goods', 10, 230, 1.0, 0.007, '日用百货', JSON.stringify(['普货']), 2300, null, null);
    insertItem.run('ITEM-009', 'ORD-20240110-003', 'ORD-20240110-003-01', '笔记本电脑配件', 'Laptop Accessories', 150, 30, 0.2, 0.001, '电子产品', JSON.stringify(['普货']), 4500, null, null);
    insertItem.run('ITEM-010', 'ORD-20240120-004', 'ORD-20240120-004-01', '无线充电器', 'Wireless Charger', 60, 55, 0.15, 0.001, '电子产品', JSON.stringify(['带电池', '普货']), 3300, null, null);
    insertItem.run('ITEM-011', 'ORD-20240108-005', null, '户外帐篷', 'Outdoor Tent', 20, 200, 3, 0.05, '户外用品', JSON.stringify(['普货']), 4000, null, null);
  });
  seedItems();

  // ========== 8. EXPRESS_PACKAGES ==========
  const insertPkg = db.prepare(`
    INSERT INTO express_packages (id, masterOrderId, subOrderId, expressCompany, trackingNo, status, name, category, cargoType, weight, pieces, value, remark, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedPkgs = db.transaction(() => {
    insertPkg.run('PKG-001', 'ORD-20240115-001', 'ORD-20240115-001-01', '顺丰速运', 'SF1012605193752', 'INBOUND', 'Seat cushion', '日用百货', '普货', 1, 1, 60, '包装完好', '2024-01-15 16:20:00');
    insertPkg.run('PKG-002', 'ORD-20240115-001', 'ORD-20240115-001-02', '韵达快递', '4301568788544', 'INBOUND', 'maching parts', '日用百货', '普货', 1, 1, 50, '-', '2024-01-15 17:00:00');
    insertPkg.run('PKG-003', 'ORD-20240115-001', 'ORD-20240115-001-01', '圆通速递', 'YT4144353928655', 'INBOUND', 'clothes', '日用百货', '普货', 1, 1, 12, '-', '2024-01-15 18:00:00');
    insertPkg.run('PKG-004', 'ORD-20240115-001', 'ORD-20240115-001-02', '顺丰速运', '163262639592', 'INBOUND', 'huoguolu', '日用百货', '普货', 1, 1, 23, '-', '2024-01-15 19:00:00');
    insertPkg.run('PKG-005', 'ORD-20240115-001', 'ORD-20240115-001-03', '中通快递', 'ZT9876543210', 'INBOUND', 'LED lights', '电子产品', '普货', 2, 1, 80, '-', '2024-01-15 20:00:00');
    insertPkg.run('PKG-006', 'ORD-20240115-001', 'ORD-20240115-001-03', '申通快递', 'ST1234567890', 'INBOUND', 'cosmetics', '化妆品', '敏感货', 1, 1, 120, '-', '2024-01-15 21:00:00');
    // ORD-20260218-002 快递包裹 - 李四电商（批1已入库，批2待到达）
    insertPkg.run('PKG-007', 'ORD-20260218-002', 'ORD-20260218-002-01', '顺丰速运', 'SF1099887766', 'INBOUND', '智能手表', '电子产品', '带电池', 5, 100, 15000, '已入库', '2026-02-18 10:20:00');
    insertPkg.run('PKG-008', 'ORD-20260218-002', 'ORD-20260218-002-02', '圆通速递', 'YT1234509876', 'PENDING', '保温杯', '日用百货', '普货', 70, 200, 8000, '待到货', '2026-02-18 10:20:00');
    // ORD-20260215-006 快递包裹 - 义乌小商品（批1已入库，批2受潮处理中）
    insertPkg.run('PKG-009', 'ORD-20260215-006', 'ORD-20260215-006-01', '顺丰速运', 'SF20260215001', 'INBOUND', '工艺品摆件', '工艺品', '普货', 12, 50, 4500, '已入库', '2026-02-15 10:00:00');
    insertPkg.run('PKG-010', 'ORD-20260215-006', 'ORD-20260215-006-02', '申通快递', 'ST20260224001', 'RECEIVED', '日用百货', '日用百货', '普货', 10, 10, 2300, '受潮复核中', '2026-02-15 10:00:00');
  });
  seedPkgs();

  // ========== 9. LOGISTICS_RECORDS ==========
  const insertLogistics = db.prepare(`
    INSERT INTO logistics_records (id, subOrderId, step, status, operator, timestamp, location, remark, photos, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedLogistics = db.transaction(() => {
    // ORD-20240115-001-01 timeline
    insertLogistics.run('NODE-001', 'ORD-20240115-001-01', '订单创建', 'completed', '张三', '2024-01-15 14:30:00', '系统', null, null, '2024-01-15 14:30:00');
    insertLogistics.run('NODE-002', 'ORD-20240115-001-01', '入库完成', 'completed', '李四', '2024-01-16 10:30:00', '广州仓库', null, null, '2024-01-16 10:30:00');
    insertLogistics.run('NODE-003', 'ORD-20240115-001-01', '装箱完成', 'completed', '王五', '2024-01-18 16:00:00', '广州仓库', null, null, '2024-01-18 16:00:00');
    insertLogistics.run('NODE-004', 'ORD-20240115-001-01', '已发货', 'completed', '赵六', '2024-01-20 14:00:00', '广州港', null, null, '2024-01-20 14:00:00');
    insertLogistics.run('NODE-005', 'ORD-20240115-001-01', '海上运输中', 'current', null, '2024-01-21 08:00:00', '太平洋', null, null, '2024-01-21 08:00:00');

    // ORD-20240115-001-02 timeline
    insertLogistics.run('NODE-006', 'ORD-20240115-001-02', '订单创建', 'completed', '张三', '2024-01-15 14:30:00', '系统', null, null, '2024-01-15 14:30:00');
    insertLogistics.run('NODE-007', 'ORD-20240115-001-02', '入库完成', 'completed', '李四', '2024-01-16 11:00:00', '广州仓库', null, null, '2024-01-16 11:00:00');
    insertLogistics.run('NODE-008', 'ORD-20240115-001-02', '装箱完成', 'completed', '王五', '2024-01-18 16:30:00', '广州仓库', null, null, '2024-01-18 16:30:00');
    insertLogistics.run('NODE-009', 'ORD-20240115-001-02', '已发货', 'completed', '赵六', '2024-01-20 14:00:00', '广州港', null, null, '2024-01-20 14:00:00');
    insertLogistics.run('NODE-010', 'ORD-20240115-001-02', '海上运输中', 'current', null, '2024-01-21 08:00:00', '太平洋', null, null, '2024-01-21 08:00:00');

    // ORD-20240115-001-03 timeline (completed air shipment)
    insertLogistics.run('NODE-011', 'ORD-20240115-001-03', '订单创建', 'completed', '张三', '2024-01-15 14:30:00', '系统', null, null, '2024-01-15 14:30:00');
    insertLogistics.run('NODE-012', 'ORD-20240115-001-03', '入库完成', 'completed', '李四', '2024-01-17 09:00:00', '深圳仓库', null, null, '2024-01-17 09:00:00');
    insertLogistics.run('NODE-013', 'ORD-20240115-001-03', '已发货', 'completed', '赵六', '2024-01-18 20:00:00', '深圳机场', null, null, '2024-01-18 20:00:00');
    insertLogistics.run('NODE-014', 'ORD-20240115-001-03', '到达目的港', 'completed', null, '2024-01-19 14:30:00', '拉各斯机场', null, null, '2024-01-19 14:30:00');
    insertLogistics.run('NODE-015', 'ORD-20240115-001-03', '清关完成', 'completed', null, '2024-01-20 10:00:00', '拉各斯海关', null, null, '2024-01-20 10:00:00');
    insertLogistics.run('NODE-016', 'ORD-20240115-001-03', '配送中', 'completed', null, '2024-01-20 15:00:00', '拉各斯', null, null, '2024-01-20 15:00:00');
    insertLogistics.run('NODE-017', 'ORD-20240115-001-03', '已签收', 'completed', 'John Doe', '2024-01-20 18:30:00', '收货地址', null, null, '2024-01-20 18:30:00');

    // ORD-20240110-003-01 timeline
    insertLogistics.run('NODE-018', 'ORD-20240110-003-01', '订单创建', 'completed', null, '2024-01-10 09:00:00', '系统', null, null, '2024-01-10 09:00:00');
    insertLogistics.run('NODE-019', 'ORD-20240110-003-01', '入库完成', 'completed', null, '2024-01-10 14:00:00', '上海仓库', null, null, '2024-01-10 14:00:00');
    insertLogistics.run('NODE-020', 'ORD-20240110-003-01', '已发货', 'completed', null, '2024-01-11 18:00:00', '上海浦东机场', null, null, '2024-01-11 18:00:00');
    insertLogistics.run('NODE-021', 'ORD-20240110-003-01', '到达目的港', 'completed', null, '2024-01-12 20:30:00', '伦敦希思罗机场', null, null, '2024-01-12 20:30:00');
    insertLogistics.run('NODE-022', 'ORD-20240110-003-01', '清关完成', 'completed', null, '2024-01-13 10:00:00', '伦敦海关', null, null, '2024-01-13 10:00:00');
    insertLogistics.run('NODE-023', 'ORD-20240110-003-01', '已签收', 'completed', 'Bob Chen', '2024-01-15 16:30:00', '收货地址', null, null, '2024-01-15 16:30:00');

    // ORD-20240120-004-01 timeline (return applied)
    insertLogistics.run('NODE-024', 'ORD-20240120-004-01', '订单创建', 'completed', '钱经理', '2024-01-20 11:00:00', '系统', null, null, '2024-01-20 11:00:00');
    insertLogistics.run('NODE-025', 'ORD-20240120-004-01', '入库完成', 'completed', '李仓管', '2024-01-21 09:00:00', '深圳仓库', null, null, '2024-01-21 09:00:00');
    insertLogistics.run('NODE-026', 'ORD-20240120-004-01', '退单申请', 'current', '钱经理', '2024-01-22 09:30:00', '系统', '客户申请退单，等待审核', null, '2024-01-22 09:30:00');
  });
  seedLogistics();

  // ========== 10. STOCK_ITEMS ==========
  const insertStock = db.prepare(`
    INSERT INTO stock_items (id, masterOrderNo, subOrderNo, trackingNo, clientCode, clientName, pieces, weight, volume, status, warehouseLocation, warehouse, inboundTime, shippingUnitId, transportType, route, destination, productName, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedStock = db.transaction(() => {
    insertStock.run('stock-001', 'ORD-20240115-001', 'ORD-20240115-001-01', 'SF1012605193752', 'ZS001', '张三贸易公司', 1, 1.0, 0.0086, 'PACKED', 'A-01-03', 'CN', '2024-01-15 16:20:00', 'UNIT-001', 'SEA', 'SZX → LOS', '尼日利亚-拉各斯', null, '已装入集装箱 AK1');
    insertStock.run('stock-002', 'ORD-20240115-001', 'ORD-20240115-001-02', '4301568788544', 'ZS001', '张三贸易公司', 2, 1.5, 0.015, 'PACKED', 'A-01-04', 'CN', '2024-01-15 17:00:00', 'UNIT-001', 'SEA', 'SZX → LOS', '尼日利亚-拉各斯', null, '已装入集装箱 AK1');
    insertStock.run('stock-003', 'ORD-20240115-001', 'ORD-20240115-001-03', 'YT4144353928655', 'ZS001', '张三贸易公司', 1, 0.8, 0.0147, 'PACKED', 'A-02-05', 'CN', '2024-01-15 18:00:00', 'UNIT-002', 'SEA', 'SZX → LOS', '尼日利亚-拉各斯', null, '已装入集装箱 AK2');
    insertStock.run('stock-004', 'ORD-20240115-001', 'ORD-20240115-001-04', '163262639592', 'ZS001', '张三贸易公司', 1, 2.3, 0.035, 'PACKED', 'A-02-06', 'CN', '2024-01-15 19:00:00', 'UNIT-002', 'SEA', 'SZX → LOS', '尼日利亚-拉各斯', null, '已装入集装箱 AK2');
    insertStock.run('stock-005', 'ORD-20240115-001', 'ORD-20240115-001-03', 'ZT9876543210', 'ZS001', '张三贸易公司', 3, 2.0, 0.0297, 'SHIPPED', 'B-01-01', 'CN', '2024-01-15 20:00:00', null, 'AIR', 'CAN → LOS', '尼日利亚-拉各斯', null, '空运已发出，航班：CZ6123');
    insertStock.run('stock-006', 'ORD-20240115-001', 'ORD-20240115-001-03', 'ST1234567890', 'ZS001', '张三贸易公司', 1, 1.2, 0.0111, 'SHIPPED', 'B-01-02', 'CN', '2024-01-15 21:00:00', null, 'AIR', 'CAN → LOS', '尼日利亚-拉各斯', null, '空运已发出，航班：CZ6123');
    insertStock.run('stock-007', 'ORD-20240120-002', 'ORD-20240120-002-01', 'SF1234567890', 'WW003', '王五进出口公司', 3, 5.5, 0.045, 'IN_STOCK', 'A-03-08', 'CN', '2024-01-20 10:30:00', null, 'SEA', 'SZX → LOS', '尼日利亚-拉各斯', '电子产品配件', '待装载，货物完好');
    // ===== 到达国仓 (Lagos WH-LOS-001) 库存 =====
    insertStock.run('stock-D-001', 'ORD-20240115-001', 'ORD-20240115-001-01', 'MSCULGZ2023001', 'ZS001', '张三贸易公司', 50, 85.5, 0.620, 'IN_STOCK', 'LOS-B-01', 'US', '2026-01-10 14:00:00', 'UNIT-001', 'SEA', '广州 → 拉各斯', '尼日利亚-拉各斯', '各类货物（海运第一批）', '已完成入库，等待客户安排配送');
    insertStock.run('stock-D-002', 'ORD-20240115-001', 'ORD-20240115-001-02', 'MSCULGZ2023001', 'ZS001', '张三贸易公司', 35, 42.3, 0.310, 'ALLOCATED', 'LOS-B-02', 'US', '2026-01-18 09:30:00', 'UNIT-001', 'SEA', '广州 → 拉各斯', '尼日利亚-拉各斯', '各类货物（海运第二批）', '已分配配送单 DEL-20260120-001，待出仓');
    insertStock.run('stock-D-003', 'ORD-20240115-001', 'ORD-20240115-001-04', 'MSCUSZX2026001', 'ZS001', '张三贸易公司', 20, 38.0, 0.240, 'IN_STOCK', 'LOS-C-01', 'US', '2026-02-22 16:00:00', null, 'SEA', '深圳 → 拉各斯', '尼日利亚-拉各斯', '混装货物', '2026-02-22 最新到货，清关完成，已分拣入库');
    insertStock.run('stock-D-004', 'ORD-20240115-001', 'ORD-20240115-001-05', 'MSCUSZX2026001', 'ZS001', '张三贸易公司', 12, 15.6, 0.110, 'IN_STOCK', 'LOS-C-02', 'US', '2026-02-24 08:30:00', null, 'SEA', '深圳 → 拉各斯', '尼日利亚-拉各斯', '混装货物', '3件外箱破损，内物核查完毕均完好，正常入库');
  });
  seedStock();

  // ========== 10.5. INBOUND_RECORDS ==========
  // 按业务逻辑：客户快递寄至仓库 → 仓管扫码入库 → inbound_record 创建 → 子订单状态改为 INBOUND
  const insertInbound = db.prepare(`
    INSERT INTO inbound_records (id, subOrderId, masterOrderId, trackingNo, expressCompany, clientCode, clientName, pieces, actualWeight, actualVolume, packageCondition, status, inboundTime, inboundMethod, warehouseLocation, warehouse, warehouseId, operator, photos, remark, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedInbound = db.transaction(() => {
    // --- ORD-20240115-001 海运批次 (广州仓，2024-01-16) ---
    insertInbound.run('INB-001', 'ORD-20240115-001-01', 'ORD-20240115-001', 'SF1012605193752', '顺丰速运', 'CUST-001', '张三贸易公司', 1, 0.52, 0.005, 'GOOD', 'COMPLETED', '2024-01-16 10:30:00', 'SCAN', 'A-01-03', 'CN', 'WH-GZ-001', '李仓管', null, '包装完好', '2024-01-16 10:30:00');
    insertInbound.run('INB-002', 'ORD-20240115-001-01', 'ORD-20240115-001', 'YT4144353928655', '圆通速递', 'CUST-001', '张三贸易公司', 1, 0.80, 0.010, 'GOOD', 'COMPLETED', '2024-01-16 11:00:00', 'SCAN', 'A-01-04', 'CN', 'WH-GZ-001', '李仓管', null, null, '2024-01-16 11:00:00');
    insertInbound.run('INB-003', 'ORD-20240115-001-02', 'ORD-20240115-001', '4301568788544', '韵达快递', 'CUST-001', '张三贸易公司', 1, 1.14, 0.008, 'GOOD', 'COMPLETED', '2024-01-16 11:30:00', 'SCAN', 'A-02-01', 'CN', 'WH-GZ-001', '李仓管', null, null, '2024-01-16 11:30:00');
    // 外箱破损案例（内物完好，仍正常入库）
    insertInbound.run('INB-004', 'ORD-20240115-001-02', 'ORD-20240115-001', '163262639592', '顺丰速运', 'CUST-001', '张三贸易公司', 1, 2.30, 0.020, 'DAMAGED', 'COMPLETED', '2024-01-16 14:00:00', 'SCAN', 'A-02-02', 'CN', 'WH-GZ-001', '李仓管', null, '外箱局部破损，内物完好，已拍照存档', '2024-01-16 14:00:00');

    // --- ORD-20240115-001 空运批次 (深圳仓，2024-01-17) ---
    insertInbound.run('INB-005', 'ORD-20240115-001-03', 'ORD-20240115-001', 'ZT9876543210', '中通快递', 'CUST-001', '张三贸易公司', 3, 2.00, 0.018, 'GOOD', 'COMPLETED', '2024-01-17 09:00:00', 'SCAN', 'B-01-01', 'CN', 'WH-SZ-001', '李仓管', null, '加急空运批次', '2024-01-17 09:00:00');
    insertInbound.run('INB-006', 'ORD-20240115-001-03', 'ORD-20240115-001', 'ST1234567890', '申通快递', 'CUST-001', '张三贸易公司', 1, 1.20, 0.011, 'GOOD', 'COMPLETED', '2024-01-17 09:30:00', 'SCAN', 'B-01-02', 'CN', 'WH-SZ-001', '李仓管', null, null, '2024-01-17 09:30:00');

    // --- ORD-20240110-003 (上海仓，2024-01-10，人工补录) ---
    insertInbound.run('INB-007', 'ORD-20240110-003-01', 'ORD-20240110-003', 'SF2000098765', '顺丰速运', 'CUST-003', '王五进出口', 150, 30.00, 0.150, 'GOOD', 'COMPLETED', '2024-01-10 14:00:00', 'MANUAL', 'C-01-01', 'CN', 'WH-SH-001', '李仓管', null, '笔记本配件，整箱入库', '2024-01-10 14:00:00');

    // --- ORD-20260218-002 第1批 (深圳仓，2026-02-20，100件智能手表已到) ---
    insertInbound.run('INB-008', 'ORD-20260218-002-01', 'ORD-20260218-002', 'SF1099887766', '顺丰速运', 'CUST-002', '李四电商', 100, 5.00, 0.030, 'GOOD', 'COMPLETED', '2026-02-20 15:30:00', 'SCAN', 'A-03-01', 'CN', 'WH-SZ-001', '李仓管', null, null, '2026-02-20 15:30:00');

    // --- ORD-20260215-006 第1批 (广州仓，2026-02-22，50件工艺品) ---
    insertInbound.run('INB-009', 'ORD-20260215-006-01', 'ORD-20260215-006', 'SF20260215001', '顺丰速运', 'C5', '义乌市小商品出口中心', 50, 12.00, 0.080, 'GOOD', 'COMPLETED', '2026-02-22 10:30:00', 'SCAN', 'A-04-01', 'CN', 'WH-GZ-001', '李仓管', null, null, '2026-02-22 10:30:00');

    // --- ORD-20260215-006 第2批 (广州仓，2026-02-24 今日，正在复核中) ---
    insertInbound.run('INB-010', 'ORD-20260215-006-02', 'ORD-20260215-006', 'ST20260224001', '申通快递', 'C5', '义乌市小商品出口中心', 10, 10.00, 0.070, 'WET', 'PROCESSING', '2026-02-24 09:00:00', 'SCAN', 'A-04-02', 'CN', 'WH-GZ-001', '李仓管', null, '外箱受潮，重新清点货物数量，联系客户确认', '2026-02-24 09:00:00');

    // ===== 起运国调拨入库记录（TRF-009 广州→深圳）=====
    const insertInboundTransfer = db.prepare(`
      INSERT INTO inbound_records (id, subOrderId, masterOrderId, trackingNo, expressCompany, clientCode, clientName, pieces, actualWeight, actualVolume, packageCondition, status, inboundTime, inboundMethod, warehouseLocation, warehouse, warehouseId, transferNo, operator, photos, remark, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    // TRF-009-01: ORD-20260215-006 第1批（50件工艺品）从广州转至深圳仓
    insertInboundTransfer.run('INB-T-001', 'ORD-20260215-006-01', 'ORD-20260215-006', 'TRF-20260220-009-01', '内部调拨', 'C5', '义乌市小商品出口中心', 50, 12.0, 0.080, 'GOOD', 'COMPLETED', '2026-02-20 18:30:00', 'SCAN', 'A-04-01', 'CN', 'WH-SZ-001', 'TRF-20260220-009', '李仓管', null, '调拨单TRF-20260220-009，50件工艺品从广州仓转入，完好', '2026-02-20 18:30:00');
    // TRF-009-02: ORD-20260215-006 第2批（10件日用百货）从广州转至深圳仓
    insertInboundTransfer.run('INB-T-002', 'ORD-20260215-006-02', 'ORD-20260215-006', 'TRF-20260220-009-02', '内部调拨', 'C5', '义乌市小商品出口中心', 10, 10.0, 0.070, 'GOOD', 'COMPLETED', '2026-02-20 18:45:00', 'SCAN', 'A-04-02', 'CN', 'WH-SZ-001', 'TRF-20260220-009', '李仓管', null, '调拨单TRF-20260220-009，10件日用百货从广州仓转入，完好', '2026-02-20 18:45:00');

    // ===== 到达国入库记录（warehouse='US'）=====
    // --- 拉各斯主仓 WH-LOS-001 ---
    // 使用带 jobNo 的单独 prepare（来源编号=运输任务号，运单号=B/L或AWB）
    const insertInboundDest = db.prepare(`
      INSERT INTO inbound_records (id, subOrderId, masterOrderId, trackingNo, expressCompany, clientCode, clientName, pieces, actualWeight, actualVolume, packageCondition, status, inboundTime, inboundMethod, warehouseLocation, warehouse, warehouseId, jobNo, operator, photos, remark, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // ORD-20240115-001-03 空运 JOB-AIR-240118-001（深圳→拉各斯，2024-01-18 发运，2024-01-26 到达）
    insertInboundDest.run('INB-D-001', 'ORD-20240115-001-03', 'ORD-20240115-001', 'ZT9876543210', '中通快递', 'CUST-001', '张三贸易公司', 3, 2.00, 0.018, 'GOOD', 'COMPLETED', '2024-01-26 10:30:00', 'SCAN', 'US-MAIN-A-01', 'US', 'WH-LOS-001', 'JOB-AIR-240118-001', '王仓管', null, '空运到货，3件LED灯具，完好', '2024-01-26 10:30:00');
    insertInboundDest.run('INB-D-002', 'ORD-20240115-001-03', 'ORD-20240115-001', 'ST1234567890', '申通快递', 'CUST-001', '张三贸易公司', 1, 1.20, 0.011, 'GOOD', 'COMPLETED', '2024-01-26 11:00:00', 'SCAN', 'US-MAIN-A-02', 'US', 'WH-LOS-001', 'JOB-AIR-240118-001', '王仓管', null, '空运到货，1件化妆品套装，完好', '2024-01-26 11:00:00');

    // 海运批次 JOB-SZX-LAX-231028（广州→拉各斯）ORD-20240115-001-01/02（2026年1月到港）
    insertInboundDest.run('INB-D-003', 'ORD-20240115-001-01', 'ORD-20240115-001', 'MSCULGZ2023001', '地中海航运MSC', 'CUST-001', '张三贸易公司', 50, 85.50, 0.620, 'GOOD', 'COMPLETED', '2026-01-10 14:00:00', 'MANUAL', 'US-MAIN-B-01', 'US', 'WH-LOS-001', 'JOB-SZX-LAX-231028', '王仓管', null, '提单MSCULGZ2023001首批50件到港，人工清点入库', '2026-01-10 14:00:00');
    insertInboundDest.run('INB-D-004', 'ORD-20240115-001-02', 'ORD-20240115-001', 'MSCULGZ2023001', '地中海航运MSC', 'CUST-001', '张三贸易公司', 35, 42.30, 0.310, 'GOOD', 'COMPLETED', '2026-01-18 09:30:00', 'MANUAL', 'US-MAIN-B-02', 'US', 'WH-LOS-001', 'JOB-SZX-LAX-231028', '王仓管', null, '提单MSCULGZ2023001第二批35件到港，完好入库', '2026-01-18 09:30:00');

    // 最新海运批次 JOB-20260125-001（深圳→拉各斯，2026-01-25 发运）
    insertInboundDest.run('INB-D-005', 'ORD-20240115-001-04', 'ORD-20240115-001', 'MSCUSZX2026001', '地中海航运MSC', 'CUST-001', '张三贸易公司', 20, 38.00, 0.240, 'GOOD', 'PROCESSING', '2026-02-22 16:00:00', 'SCAN', 'US-MAIN-C-01', 'US', 'WH-LOS-001', 'JOB-20260125-001', '王仓管', null, '清关完成，正在逐件扫码分拣，预计今日完成', '2026-02-22 16:00:00');
    insertInboundDest.run('INB-D-006', 'ORD-20240115-001-05', 'ORD-20240115-001', 'MSCUSZX2026001', '地中海航运MSC', 'CUST-001', '张三贸易公司', 12, 15.60, 0.110, 'DAMAGED', 'PROCESSING', '2026-02-24 08:30:00', 'SCAN', 'US-MAIN-C-02', 'US', 'WH-LOS-001', 'JOB-20260125-001', '王仓管', null, '3件外箱破损，内物待核查，已拍照并通知客户', '2026-02-24 08:30:00');
  });
  seedInbound();

  // ========== 11. DELIVERY_ORDERS ==========
  const insertDelivery = db.prepare(`
    INSERT INTO delivery_orders (id, dpnNo, recipientName, recipientPhone, recipientAddress, city, country, deliveryMethod, driverId, driverName, driverPhone, status, totalPieces, totalWeight, deliveryFee, currency, paymentStatus, remark, createdBy, createdAt, acceptedAt, deliveredAt, signedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedDelivery = db.transaction(() => {
    insertDelivery.run('DPN-001', 'DPN-20260130-001', 'Adeola Johnson', '+234-801-234-5678', '123 Victoria Island, Lagos', 'Lagos', 'Nigeria', 'DELIVERY', 'USR-009', 'Emmanuel', '+234-803-1234567', 'SIGNED', 5, 45.5, 15000, 'NGN', 'PAID', null, 'USR-006', '2026-01-30 10:00:00', '2026-01-30 10:30:00', '2026-01-30 15:00:00', '2026-01-30 15:30:00');
    insertDelivery.run('DPN-002', 'DPN-20260131-002', 'Ibrahim Mohammed', '+234-802-345-6789', '456 Ikeja GRA, Lagos', 'Lagos', 'Nigeria', 'DELIVERY', 'USR-009', 'Emmanuel', '+234-803-1234567', 'IN_TRANSIT', 8, 120.0, 25000, 'NGN', 'UNPAID', null, 'USR-006', '2026-01-31 09:00:00', '2026-01-31 09:30:00', null, null);
    insertDelivery.run('DPN-003', 'DPN-20260201-003', 'Chukwu Obi', '+234-803-456-7890', '789 Wuse 2, Abuja', 'Abuja', 'Nigeria', 'DELIVERY', null, null, null, 'PENDING', 3, 25.0, 35000, 'NGN', 'UNPAID', '需跨城配送', 'USR-006', '2026-02-01 08:00:00', null, null, null);
    insertDelivery.run('DPN-004', 'DPN-20260202-004', 'Kwame Asante', '+233-24-567-8901', '321 Oxford Street, Osu, Accra', 'Accra', 'Ghana', 'SELF_PICKUP', null, null, null, 'PENDING', 2, 15.0, 0, 'GHS', 'PAID', '客户自提', 'USR-006', '2026-02-02 10:00:00', null, null, null);
    insertDelivery.run('DPN-005', 'DPN-20260203-005', 'Emeka Nwosu', '+234-804-567-8901', '555 Trans Amadi, Port Harcourt', 'Port Harcourt', 'Nigeria', 'DELIVERY', 'USR-010', 'Chidi', '+234-803-9876543', 'DELIVERED', 10, 85.0, 45000, 'NGN', 'UNPAID', null, 'USR-006', '2026-02-03 07:00:00', '2026-02-03 07:30:00', '2026-02-03 14:00:00', null);
    insertDelivery.run('DPN-006', 'DPN-20260204-006', 'Grace Adeyemi', '+234-805-678-9012', '100 Allen Avenue, Ikeja, Lagos', 'Lagos', 'Nigeria', 'SATELLITE_STATION', null, null, null, 'PENDING', 1, 5.0, 8000, 'NGN', 'PAID', '送至自提点', 'USR-006', '2026-02-04 09:00:00', null, null, null);
    insertDelivery.run('DPN-007', 'DPN-20260205-007', 'Adeola Johnson', '+234-801-234-5678', '123 Victoria Island, Lagos', 'Lagos', 'Nigeria', 'DELIVERY', null, null, null, 'PENDING', 15, 200.0, 55000, 'NGN', 'UNPAID', '大件货物', 'USR-006', '2026-02-05 08:00:00', null, null, null);
    insertDelivery.run('DPN-008', 'DPN-20260206-008', 'David Okonkwo', '+234-806-789-0123', '200 Lekki Phase 1, Lagos', 'Lagos', 'Nigeria', 'DELIVERY', 'USR-009', 'Emmanuel', '+234-803-1234567', 'ACCEPTED', 4, 30.0, 12000, 'NGN', 'UNPAID', null, 'USR-006', '2026-02-06 10:00:00', '2026-02-06 10:15:00', null, null);
    insertDelivery.run('DPN-009', 'DPN-20260207-009', 'Sarah Mensah', '+233-27-890-1234', '50 Airport Rd, Accra', 'Accra', 'Ghana', 'DELIVERY', null, null, null, 'PENDING', 6, 55.0, 200, 'GHS', 'UNPAID', null, 'USR-006', '2026-02-07 11:00:00', null, null, null);
  });
  seedDelivery();

  // ========== 12. TRANSFER_ORDERS ==========
  const insertTransfer = db.prepare(`
    INSERT INTO transfer_orders (id, transferNo, fromWarehouse, toWarehouse, transferType, itemType, containerNo, totalPieces, totalWeight, totalVolume, status, reason, remark, createdBy, outboundAt, inboundAt, expectedArrival, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedTransfers = db.transaction(() => {
    insertTransfer.run('TRF-001', 'TRF-20260125-001', '拉各斯主仓', '阿布贾分仓', 'DESTINATION', 'ORDER', null, 15, 120.5, 8.5, 'ARRIVED', '客户催单', null, 'USR-006', '2026-01-26 08:00:00', '2026-01-28 14:00:00', '2026-01-28', '2026-01-25 10:00:00', '2026-01-28 14:00:00');
    insertTransfer.run('TRF-002', 'TRF-20260128-002', '拉各斯主仓', '拉各斯自提点A', 'DESTINATION', 'ORDER', null, 8, 65.0, 4.2, 'IN_TRANSIT', '自提点补货', null, 'USR-006', '2026-01-29 09:00:00', null, '2026-01-30', '2026-01-28 15:00:00', '2026-01-29 09:00:00');
    insertTransfer.run('TRF-003', 'TRF-20260130-003', '拉各斯主仓', '哈科特港分仓', 'DESTINATION', 'CONTAINER', 'CONT-003', 45, 380.0, 25.0, 'SHIPPED', '整柜调拨', null, 'USR-006', '2026-01-31 07:00:00', null, '2026-02-02', '2026-01-30 16:00:00', '2026-01-31 07:00:00');
    insertTransfer.run('TRF-004', 'TRF-20260201-004', '阿克拉主仓', '阿克拉市中心自提点', 'DESTINATION', 'ORDER', null, 5, 35.0, 2.8, 'ARRIVED', '客户自提', null, 'USR-006', '2026-02-01 10:00:00', '2026-02-01 16:00:00', '2026-02-01', '2026-02-01 08:00:00', '2026-02-01 16:00:00');
    insertTransfer.run('TRF-005', 'TRF-20260203-005', '拉各斯主仓', '阿布贾分仓', 'DESTINATION', 'ORDER', null, 22, 180.0, 12.0, 'DRAFT', '周末批量调拨', '等待装车', 'USR-006', null, null, '2026-02-05', '2026-02-03 09:00:00', '2026-02-03 09:00:00');
    insertTransfer.run('TRF-006', 'TRF-20260204-006', '拉各斯主仓', '拉各斯自提点B', 'DESTINATION', 'ORDER', null, 3, 20.0, 1.5, 'ARRIVED', '紧急调拨', null, 'USR-006', '2026-02-04 14:00:00', '2026-02-04 17:00:00', '2026-02-04', '2026-02-04 11:00:00', '2026-02-04 17:00:00');
    insertTransfer.run('TRF-007', 'TRF-20260206-007', '广州仓', '深圳仓', 'ORIGIN', 'ORDER', null, 10, 85.0, 5.0, 'IN_TRANSIT', '集货转仓', null, 'USR-003', '2026-02-06 08:00:00', null, '2026-02-06', '2026-02-06 06:00:00', '2026-02-06 08:00:00');
    insertTransfer.run('TRF-008', 'TRF-20260208-008', '拉各斯主仓', '伊巴丹卫星仓', 'DESTINATION', 'CONTAINER', 'CONT-008', 30, 250.0, 18.0, 'DRAFT', '新仓备货', '新开伊巴丹线路', 'USR-006', null, null, '2026-02-12', '2026-02-08 10:00:00', '2026-02-08 10:00:00');
    // 起运国调拨：广州仓 → 深圳仓（MORD-006货物集货后转至深圳统一出运）
    insertTransfer.run('TRF-009', 'TRF-20260220-009', '广州仓', '深圳仓', 'ORIGIN', 'ORDER', null, 60, 22.0, 0.15, 'ARRIVED', '集货转仓，深圳统一出运', 'MORD-006两批货物集中转深圳', 'USR-003', '2026-02-20 10:00:00', '2026-02-20 18:30:00', '2026-02-20', '2026-02-20 08:00:00', '2026-02-20 18:30:00');
  });
  seedTransfers();

  // ========== 13. FEE_RECORDS ==========
  const insertFee = db.prepare(`
    INSERT INTO fee_records (id, feeNo, relatedType, relatedId, relatedNo, feeType, feeDirection, amount, currency, exchangeRate, status, supplierId, supplierName, customerId, customerName, description, createdBy, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedFees = db.transaction(() => {
    insertFee.run('FEE-001', 'FEE-20240115-001', 'ORDER', 'ORD-20240115-001-01', 'ORD-20240115-001-01', '清关费', 'PAYABLE', 200, 'USD', 7.2, 'PENDING', 'SUP-002', 'ATEEYAT LOGISTICS', null, null, '拉各斯清关费', 'USR-004', '2024-01-15 14:30:00', now);
    insertFee.run('FEE-002', 'FEE-20240115-002', 'ORDER', 'ORD-20240115-001-03', 'ORD-20240115-001-03', '电池附加费', 'RECEIVABLE', 150, 'USD', 7.2, 'PAID', null, null, 'CUST-001', '张三贸易公司', '带电池货物附加费', 'USR-004', '2024-01-15 14:30:00', now);
    insertFee.run('FEE-003', 'FEE-20240115-003', 'ORDER', 'ORD-20240115-001-03', 'ORD-20240115-001-03', '加急费', 'RECEIVABLE', 200, 'USD', 7.2, 'PAID', null, null, 'CUST-001', '张三贸易公司', '加急空运附加费', 'USR-004', '2024-01-15 14:30:00', now);
    insertFee.run('FEE-004', 'FEE-20240120-004', 'JOB', 'JOB-SZX-LAX-231028', 'JOB-SZX-LAX-231028', '海运费', 'PAYABLE', 45000, 'CNY', 1.0, 'APPROVED', 'SUP-005', '马士基航运', null, null, '深圳-洛杉矶海运费', 'USR-004', '2024-01-20 10:00:00', now);
    insertFee.run('FEE-005', 'FEE-20260125-005', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', '海运费', 'PAYABLE', 85000, 'NGN', 0.0045, 'PENDING', 'SUP-002', 'ATEEYAT LOGISTICS', null, null, '拉各斯清关仓储费', 'USR-005', '2026-01-25 10:00:00', now);
  });
  seedFees();

  // ========== 13b. ADDITIONAL FEE_RECORDS (with approver/paidAt fields) ==========
  const insertFeeEx = db.prepare(`
    INSERT INTO fee_records (id, feeNo, relatedType, relatedId, relatedNo, feeType, feeDirection, amount, currency, exchangeRate, status, supplierId, supplierName, customerId, customerName, description, remark, approver, createdBy, approvedAt, paidAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedFeesEx = db.transaction(() => {
    // Origin port fees (POL) - PAYABLE
    insertFeeEx.run('FEE-POL-001', 'FEE-20260125-001', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', 'CUSTOMS_CLEARANCE', 'PAYABLE', 3500, 'CNY', 1.0, 'APPROVED', null, null, 'CUST-001', '张三贸易公司', '出口报关费', null, 'USR-007', 'USR-004', '2026-01-22T10:00:00Z', null, '2026-01-20T10:00:00Z', now);
    insertFeeEx.run('FEE-POL-002', 'FEE-20260125-002', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', 'BOOKING', 'PAYABLE', 8500, 'CNY', 1.0, 'APPROVED', null, null, null, null, '订舱费 MAERSK LINE', null, 'USR-007', 'USR-004', '2026-01-22T10:00:00Z', null, '2026-01-20T10:00:00Z', now);
    insertFeeEx.run('FEE-POL-003', 'FEE-20260125-003', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', 'TRUCKING', 'PAYABLE', 2200, 'CNY', 1.0, 'PENDING', null, null, null, null, '拖车费 深圳→蛇口港', null, null, 'USR-004', null, null, '2026-01-21T08:00:00Z', now);
    insertFeeEx.run('FEE-POL-004', 'FEE-20260125-004', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', 'WAREHOUSE', 'PAYABLE', 1800, 'CNY', 1.0, 'PENDING', null, null, null, null, '仓储费 深圳仓', null, null, 'USR-004', null, null, '2026-01-22T14:00:00Z', now);
    insertFeeEx.run('FEE-POL-005', 'FEE-20260120-005', 'JOB', 'JOB-20260120-002', 'JOB-20260120-002', 'CUSTOMS_CLEARANCE', 'PAYABLE', 2800, 'CNY', 1.0, 'APPROVED', null, null, null, null, '出口报关费 空运', null, 'USR-007', 'USR-004', '2026-01-25T10:00:00Z', null, '2026-01-24T08:00:00Z', now);
    insertFeeEx.run('FEE-POL-006', 'FEE-20260120-006', 'JOB', 'JOB-20260120-002', 'JOB-20260120-002', 'BOOKING', 'PAYABLE', 15000, 'CNY', 1.0, 'PAID', null, null, null, null, '空运运费 CZ6043', null, 'USR-007', 'USR-004', '2026-01-25T10:00:00Z', '2026-01-28T10:00:00Z', '2026-01-20T10:00:00Z', now);

    // Origin port fees (POL) - RECEIVABLE
    insertFeeEx.run('FEE-POL-R01', 'FEE-20260125-R01', 'ORDER', 'ORD-20240115-001', 'ORD-20240115-001', 'FREIGHT', 'RECEIVABLE', 12000, 'CNY', 1.0, 'PENDING', null, null, 'CUST-001', '张三贸易公司', '海运运费应收', null, null, 'USR-004', null, null, '2026-01-20T10:00:00Z', now);
    insertFeeEx.run('FEE-POL-R02', 'FEE-20260125-R02', 'ORDER', 'ORD-20240115-001', 'ORD-20240115-001', 'HANDLING', 'RECEIVABLE', 3000, 'CNY', 1.0, 'APPROVED', null, null, 'CUST-001', '张三贸易公司', '操作费应收', null, 'USR-007', 'USR-004', '2026-01-22T10:00:00Z', null, '2026-01-20T10:00:00Z', now);
    insertFeeEx.run('FEE-POL-R03', 'FEE-20260218-R01', 'ORDER', 'ORD-20260218-002', 'ORD-20260218-002', 'FREIGHT', 'RECEIVABLE', 8500, 'CNY', 1.0, 'PENDING', null, null, 'CUST-002', '李四电商', '海运运费应收', null, null, 'USR-004', null, null, '2026-02-18T10:00:00Z', now);
    insertFeeEx.run('FEE-POL-R04', 'FEE-20260120-R01', 'ORDER', 'ORD-20240110-003', 'ORD-20240110-003', 'FREIGHT', 'RECEIVABLE', 4500, 'CNY', 1.0, 'PAID', null, null, 'CUST-003', '王五进出口', '空运运费应收', null, 'USR-007', 'USR-004', '2024-01-11T10:00:00Z', '2024-01-15T10:00:00Z', '2024-01-10T10:00:00Z', now);

    // Destination port fees (POD) - PAYABLE
    insertFeeEx.run('FEE-POD-001', 'FEE-20260214-001', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', 'CUSTOMS_CLEARANCE', 'PAYABLE', 450000, 'NGN', 0.0045, 'APPROVED', null, null, null, null, '尼日利亚进口清关费', null, 'USR-007', 'USR-005', '2026-02-15T10:00:00Z', null, '2026-02-14T17:00:00Z', now);
    insertFeeEx.run('FEE-POD-002', 'FEE-20260214-002', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', 'DUTY', 'PAYABLE', 850000, 'NGN', 0.0045, 'PENDING', null, null, null, null, '进口关税', null, null, 'USR-005', null, null, '2026-02-14T17:00:00Z', now);
    insertFeeEx.run('FEE-POD-003', 'FEE-20260214-003', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', 'TRUCKING', 'PAYABLE', 180000, 'NGN', 0.0045, 'PENDING', null, null, null, null, '港口拖车费', null, null, 'USR-005', null, null, '2026-02-15T08:00:00Z', now);
    insertFeeEx.run('FEE-POD-004', 'FEE-20260214-004', 'JOB', 'JOB-20260125-001', 'JOB-20260125-001', 'PORT_CHARGES', 'PAYABLE', 220000, 'NGN', 0.0045, 'APPROVED', null, null, null, null, '港杂费', null, 'USR-007', 'USR-005', '2026-02-15T10:00:00Z', null, '2026-02-14T17:00:00Z', now);
    insertFeeEx.run('FEE-POD-005', 'FEE-20260130-005', 'JOB', 'JOB-20260120-002', 'JOB-20260120-002', 'CUSTOMS_CLEARANCE', 'PAYABLE', 1200, 'USD', 7.2, 'PAID', null, null, null, null, '加纳进口清关费', null, 'USR-007', 'USR-005', '2026-01-30T10:00:00Z', '2026-02-01T10:00:00Z', '2026-01-30T08:00:00Z', now);
    insertFeeEx.run('FEE-POD-006', 'FEE-20260130-006', 'JOB', 'JOB-20260120-002', 'JOB-20260120-002', 'WAREHOUSE', 'PAYABLE', 800, 'USD', 7.2, 'PENDING', null, null, null, null, '阿克拉仓储费', null, null, 'USR-005', null, null, '2026-01-30T12:00:00Z', now);

    // Destination receivables (POD) - RECEIVABLE
    insertFeeEx.run('FEE-POD-R01', 'FEE-20260215-R01', 'ORDER', 'ORD-20240115-001', 'ORD-20240115-001', 'DELIVERY', 'RECEIVABLE', 350000, 'NGN', 0.0045, 'PENDING', null, null, 'CUST-001', '张三贸易公司', '配送费应收', null, null, 'USR-005', null, null, '2026-02-15T10:00:00Z', now);
    insertFeeEx.run('FEE-POD-R02', 'FEE-20260215-R02', 'ORDER', 'ORD-20240115-001', 'ORD-20240115-001', 'HANDLING', 'RECEIVABLE', 150000, 'NGN', 0.0045, 'APPROVED', null, null, 'CUST-001', '张三贸易公司', '操作费应收', null, 'USR-007', 'USR-005', '2026-02-16T10:00:00Z', null, '2026-02-15T10:00:00Z', now);

    // Order-level fees
    insertFeeEx.run('FEE-ORD-001', 'FEE-20260215-O01', 'ORDER', 'ORD-20260215-006', 'ORD-20260215-006', 'FREIGHT', 'PAYABLE', 4200, 'CNY', 1.0, 'PENDING', null, null, 'C5', '义乌市小商品出口中心', '海运运费 广州→拉各斯', null, null, 'USR-004', null, null, '2026-02-15T10:00:00Z', now);
    insertFeeEx.run('FEE-ORD-002', 'FEE-20260218-O01', 'ORDER', 'ORD-20260218-002', 'ORD-20260218-002', 'INSURANCE', 'PAYABLE', 650, 'CNY', 1.0, 'APPROVED', null, null, 'CUST-002', '李四电商', '货物运输保险', null, 'USR-007', 'USR-004', '2026-02-19T10:00:00Z', null, '2026-02-18T10:00:00Z', now);
    insertFeeEx.run('FEE-ORD-003', 'FEE-20240115-O01', 'ORDER', 'ORD-20240115-001', 'ORD-20240115-001', 'HANDLING', 'PAYABLE', 2800, 'CNY', 1.0, 'PAID', null, null, 'CUST-001', '张三贸易公司', '订单操作费', null, 'USR-007', 'USR-004', '2024-01-16T10:00:00Z', '2024-01-18T10:00:00Z', '2024-01-15T14:30:00Z', now);
  });
  seedFeesEx();

  // ========== 14. SUPPLIERS ==========
  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (id, code, name, nameEn, type, country, city, address, contactPerson, phone, email, bankAccount, bankName, taxId, status, remark, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedSuppliers = db.transaction(() => {
    insertSupplier.run('SUP-001', 'OLAZDE', 'OLAZDE', null, 'CARRIER', '中国', '深圳', '深圳市南山区科技园', '李四', '0755-12345678', 'contact@olazde.com', null, null, null, 'ACTIVE', null, '2023-01-01 10:00:00');
    insertSupplier.run('SUP-002', 'ATEEYAT', 'ATEEYAT LOGISTICS', 'ATEEYAT LOGISTICS', 'AGENT', '尼日利亚', 'Lagos', '123 Marina Street, Lagos', 'Ibrahim Mohammed', '08146637488', 'info@ateeyat.ng', null, null, null, 'ACTIVE', null, '2023-02-15 10:00:00');
    insertSupplier.run('SUP-003', 'CONNFEE', 'Connection Fee', null, 'AGENT', '尼日利亚', 'Abuja', null, 'Chukwu Obi', '08052158414', '08052158414', null, null, null, 'ACTIVE', null, '2022-01-01 10:00:00');
    insertSupplier.run('SUP-004', 'COMPENS', 'Compensation', null, 'OTHER', '尼日利亚', 'Port Harcourt', null, 'Emeka Nwosu', '07134563248', '07134563248', null, null, null, 'ACTIVE', '损坏赔偿处理', '2022-01-01 10:00:00');
    insertSupplier.run('SUP-005', 'MAERSK', '马士基航运', 'Maersk Line', 'CARRIER', '丹麦', 'Copenhagen', null, '王经理', '+45-33-63-33-63', 'sales@maersk.com', '6217000010012345678', '中国银行', 'DK12345678', 'ACTIVE', null, '2023-01-01 10:00:00');
    insertSupplier.run('SUP-006', 'COSCO', '中远海运', 'COSCO Shipping', 'CARRIER', '中国', '上海', '上海市浦东新区东方路', '陈经理', '021-65966666', 'service@cosco.com.cn', null, null, null, 'ACTIVE', null, '2023-01-01 10:00:00');
    insertSupplier.run('SUP-007', 'DHL', 'DHL速递', 'DHL Express', 'CARRIER', '德国', 'Bonn', null, '李经理', '+49-228-182-0', 'contact@dhl.com', null, null, null, 'ACTIVE', null, '2023-03-01 10:00:00');
    insertSupplier.run('SUP-008', 'FEDEX', '联邦快递', 'FedEx', 'CARRIER', '美国', 'Memphis', null, 'David Chen', '+1-800-463-3339', 'support@fedex.com', null, null, null, 'ACTIVE', null, '2023-03-01 10:00:00');
    insertSupplier.run('SUP-009', 'CNWAREHOUSE', '深圳国际仓储', null, 'WAREHOUSE', '中国', '深圳', '深圳市宝安区福永镇', '钱主管', '0755-88888888', 'warehouse@cnstore.com', null, null, null, 'ACTIVE', null, '2023-04-01 10:00:00');
    insertSupplier.run('SUP-010', 'USWAREHOUSE', 'LA Warehouse Services', null, 'WAREHOUSE', '美国', 'Los Angeles', '1234 Harbor Blvd, Los Angeles, CA', 'Sarah Johnson', '+1-310-555-1234', 'info@lawarehouse.com', null, null, null, 'ACTIVE', null, '2023-05-01 10:00:00');
  });
  seedSuppliers();

  // ========== 15. ROUTES_CONFIG ==========
  const insertRoute = db.prepare(`
    INSERT INTO routes_config (id, originCountry, originCity, destCountry, destCity, transportType, pricePerKg, pricePerCbm, status, remark, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedRoutes = db.transaction(() => {
    insertRoute.run('ROUTE-001', '中国', '广州', '尼日利亚', '阿布贾联邦首区点对点', 'SEA', 10.00, 70.00, 'ACTIVE', null, '2024-01-01 10:00:00');
    insertRoute.run('ROUTE-002', '中国', '广州', '尼日利亚', '阿布贾包车点', 'SEA', 9.01, 63.00, 'ACTIVE', null, '2024-01-01 10:00:00');
    insertRoute.run('ROUTE-003', '中国', '广州', '尼日利亚', '阿布贾联邦首区', 'SEA', 9.87, 69.00, 'ACTIVE', null, '2024-01-01 10:00:00');
    insertRoute.run('ROUTE-004', '中国', '广州', '尼日利亚', '阿布贾关卡', 'SEA', 10.00, 70.00, 'ACTIVE', null, '2024-01-01 10:00:00');
    insertRoute.run('ROUTE-005', '中国', '广州', '尼日利亚', '阿布贾美食宫自提点', 'SEA', 10.73, 75.00, 'ACTIVE', null, '2024-01-01 10:00:00');
    insertRoute.run('ROUTE-006', '中国', '佛山', '尼日利亚', '阿布贾包车点', 'SEA', 1.00, 0.00, 'ACTIVE', null, '2023-10-11 10:00:00');
    insertRoute.run('ROUTE-007', '中国', '佛山', '尼日利亚', '阿布贾联邦首区', 'SEA', 1.00, 0.00, 'ACTIVE', null, '2023-10-11 10:00:00');
    insertRoute.run('ROUTE-008', '中国', '深圳', '美国', '洛杉矶', 'SEA', 15.00, 105.00, 'ACTIVE', null, '2024-01-01 10:00:00');
    insertRoute.run('ROUTE-009', '中国', '上海', '英国', '伦敦', 'SEA', 12.50, 87.50, 'ACTIVE', null, '2024-01-01 10:00:00');
    insertRoute.run('ROUTE-010', '中国', '深圳', '德国', '汉堡', 'AIR', 35.00, 245.00, 'ACTIVE', null, '2024-01-01 10:00:00');
  });
  seedRoutes();

  // ========== 16. NOTIFICATIONS (sample) ==========
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, type, title, content, warehouse, userId, read, urgent, relatedId, relatedType, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedNotifs = db.transaction(() => {
    insertNotif.run('NOTIF-001', 'PICKUP', '货物到达通知', '您的货物已到达拉各斯仓库，请尽快安排提货。订单号：ORD-20240115-001', 'US', null, 0, 0, 'ORD-20240115-001', 'ORDER', '2026-02-15T10:00:00Z');
    insertNotif.run('NOTIF-002', 'PICKUP', '货物到达通知', '您的货物已清关完毕，可以安排配送。DPN号：DPN-20260215-001', 'US', null, 0, 0, 'DPN-20260215-001', 'DELIVERY', '2026-02-16T09:00:00Z');
    insertNotif.run('NOTIF-003', 'SYSTEM', '费用审批提醒', '有3笔费用待审批，请及时处理。', 'SALES', 'USR-007', 0, 1, null, null, '2026-02-17T08:00:00Z');
    insertNotif.run('NOTIF-004', 'PICKUP', '包裹到达通知', '客户张三贸易公司的47件货物已到达，请通知客户。', 'US', 'USR-005', 0, 0, 'ORD-20240115-001-05', 'ORDER', '2026-02-14T17:00:00Z');
    insertNotif.run('NOTIF-005', 'DELIVERY', '配送完成通知', 'DPN-20260215-001 配送已完成，客户已签收。', 'US', 'USR-006', 1, 0, 'DPN-20260215-001', 'DELIVERY', '2026-02-18T15:00:00Z');
    // Original sample notifications
    insertNotif.run('NOTIF-006', 'INBOUND', '新包裹到货', '快递单号 SF1012605193752 已到货，请及时处理入库', 'CN', 'USR-003', 0, 0, null, null, now);
    insertNotif.run('NOTIF-007', 'DELIVERY', '配送单待处理', 'DPN-20260201-003 需跨城配送至阿布贾，请安排司机', 'US', 'USR-006', 0, 1, 'DPN-20260201-003', 'DELIVERY', now);
    insertNotif.run('NOTIF-008', 'PAYMENT', '催款提醒', '订单 ORD-20260218-002 尚未付款，金额 ¥1,200', 'SALES', 'USR-002', 0, 1, 'ORD-20260218-002', 'ORDER', now);
  });
  seedNotifs();

  // ========== 17. WAREHOUSES ==========
  const insertWarehouse = db.prepare(`
    INSERT INTO warehouses (id, code, name, nameEn, type, country, city, siteId, address, managerId, managerName, managerPhone, capacity, status, remark, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedWarehouses = db.transaction(() => {
    insertWarehouse.run('WH-GZ-001', 'GZ-A', '广州仓A', 'Guangzhou Warehouse A', 'ORIGIN', '中国', '广州', 'SITE-CAN-BY', '广州市白云区太和镇xxx路xxx号', 'USR-003', '李仓管', '13800000002', 5000, 'ACTIVE', null, now, now);
    insertWarehouse.run('WH-SZ-001', 'SZ-A', '深圳仓A', 'Shenzhen Warehouse A', 'ORIGIN', '中国', '深圳', 'SITE-SZX-FT', '深圳市宝安区福永镇xxx路xxx号', null, null, null, 3000, 'ACTIVE', null, now, now);
    insertWarehouse.run('WH-SH-001', 'SH-A', '上海仓A', 'Shanghai Warehouse A', 'ORIGIN', '中国', '上海', 'SITE-SHA-PD', '上海市浦东新区xxx路xxx号', null, null, null, 4000, 'ACTIVE', null, now, now);
    insertWarehouse.run('WH-LOS-001', 'LOS-A', '拉各斯主仓', 'Lagos Main Warehouse', 'DESTINATION', '尼日利亚', '拉各斯', 'SITE-LOS-IKEJA', '123 Marina Street, Lagos', 'USR-006', '王仓管', '13800000005', 8000, 'ACTIVE', null, now, now);
    insertWarehouse.run('WH-ABJ-001', 'ABJ-A', '阿布贾分仓', 'Abuja Branch Warehouse', 'DESTINATION', '尼日利亚', '阿布贾', 'SITE-ABV-CENTER', '456 Central District, Abuja', null, null, null, 2000, 'ACTIVE', null, now, now);
    insertWarehouse.run('WH-ACC-001', 'ACC-A', '阿克拉主仓', 'Accra Main Warehouse', 'DESTINATION', '加纳', '阿克拉', 'SITE-ACC-HQ', '321 Oxford Street, Osu, Accra', null, null, null, 3000, 'ACTIVE', null, now, now);
    insertWarehouse.run('WH-PH-001', 'PH-A', '哈科特港分仓', 'Port Harcourt Warehouse', 'DESTINATION', '尼日利亚', '哈科特港', 'SITE-PHC-SAT', '555 Trans Amadi, Port Harcourt', null, null, null, 1500, 'ACTIVE', null, now, now);
  });
  seedWarehouses();

  // ========== 18. USER_WAREHOUSES ==========
  const insertUserWarehouse = db.prepare(`
    INSERT INTO user_warehouses (id, userId, warehouseId, createdAt)
    VALUES (?, ?, ?, ?)
  `);

  const seedUserWarehouses = db.transaction(() => {
    insertUserWarehouse.run('UW-001', 'USR-003', 'WH-GZ-001', now);
    insertUserWarehouse.run('UW-002', 'USR-003', 'WH-SZ-001', now);
    insertUserWarehouse.run('UW-003', 'USR-004', 'WH-GZ-001', now);
    insertUserWarehouse.run('UW-004', 'USR-004', 'WH-SZ-001', now);
    insertUserWarehouse.run('UW-005', 'USR-004', 'WH-SH-001', now);
    insertUserWarehouse.run('UW-006', 'USR-006', 'WH-LOS-001', now);
    insertUserWarehouse.run('UW-007', 'USR-006', 'WH-ABJ-001', now);
    insertUserWarehouse.run('UW-008', 'USR-005', 'WH-LOS-001', now);
    insertUserWarehouse.run('UW-009', 'USR-005', 'WH-ABJ-001', now);
    insertUserWarehouse.run('UW-010', 'USR-005', 'WH-ACC-001', now);
    insertUserWarehouse.run('UW-011', 'USR-005', 'WH-PH-001', now);
    insertUserWarehouse.run('UW-012', 'USR-009', 'WH-LOS-001', now);
    insertUserWarehouse.run('UW-013', 'USR-010', 'WH-LOS-001', now);
  });
  seedUserWarehouses();

  // ========== 19. USER_SITES ==========
  const insertUserSite = db.prepare(`
    INSERT INTO user_sites (id, userId, siteId, createdAt)
    VALUES (?, ?, ?, ?)
  `);

  const seedUserSites = db.transaction(() => {
    insertUserSite.run('US-001', 'USR-003', 'SITE-CAN-BY', now);
    insertUserSite.run('US-002', 'USR-004', 'SITE-CAN-BY', now);
    insertUserSite.run('US-003', 'USR-004', 'SITE-SZX-FT', now);
    insertUserSite.run('US-004', 'USR-005', 'SITE-LOS-IKEJA', now);
    insertUserSite.run('US-005', 'USR-005', 'SITE-ABV-CENTER', now);
    insertUserSite.run('US-006', 'USR-006', 'SITE-LOS-IKEJA', now);
    insertUserSite.run('US-007', 'USR-009', 'SITE-LOS-IKEJA', now);
    insertUserSite.run('US-008', 'USR-010', 'SITE-LOS-IKEJA', now);
  });
  seedUserSites();

  // ========== DATA MIGRATION: populate warehouseId fields ==========
  db.prepare("UPDATE inbound_records SET warehouseId = 'WH-GZ-001' WHERE warehouse = 'CN'").run();
  db.prepare("UPDATE inbound_records SET warehouseId = 'WH-LOS-001' WHERE warehouse = 'US'").run();
  db.prepare("UPDATE stock_items SET warehouseId = 'WH-GZ-001' WHERE warehouse = 'CN'").run();
  db.prepare("UPDATE stock_items SET warehouseId = 'WH-LOS-001' WHERE warehouse = 'US'").run();
  db.prepare("UPDATE shipping_units SET warehouseId = 'WH-GZ-001' WHERE warehouse LIKE '%深圳%' OR warehouse LIKE '%广州%'").run();
  db.prepare("UPDATE shipping_units SET warehouseId = 'WH-SH-001' WHERE warehouse LIKE '%上海%'").run();
  db.prepare("UPDATE shipping_units SET warehouseId = 'WH-LOS-001' WHERE warehouse LIKE '%拉各斯%'").run();
  db.prepare("UPDATE notifications SET warehouseId = 'WH-GZ-001' WHERE warehouse = 'CN'").run();
  db.prepare("UPDATE notifications SET warehouseId = 'WH-LOS-001' WHERE warehouse = 'US'").run();
  db.prepare("UPDATE delivery_orders SET warehouseId = 'WH-LOS-001'").run();
  db.prepare("UPDATE transfer_orders SET fromWarehouseId = 'WH-LOS-001' WHERE fromWarehouse LIKE '%拉各斯%'").run();
  db.prepare("UPDATE transfer_orders SET fromWarehouseId = 'WH-ACC-001' WHERE fromWarehouse LIKE '%阿克拉%'").run();
  db.prepare("UPDATE transfer_orders SET fromWarehouseId = 'WH-GZ-001' WHERE fromWarehouse LIKE '%广州%'").run();
  db.prepare("UPDATE transfer_orders SET toWarehouseId = 'WH-ABJ-001' WHERE toWarehouse LIKE '%阿布贾%'").run();
  db.prepare("UPDATE transfer_orders SET toWarehouseId = 'WH-LOS-001' WHERE toWarehouse LIKE '%拉各斯%'").run();
  db.prepare("UPDATE transfer_orders SET toWarehouseId = 'WH-PH-001' WHERE toWarehouse LIKE '%哈科特%'").run();
  db.prepare("UPDATE transfer_orders SET toWarehouseId = 'WH-SZ-001' WHERE toWarehouse LIKE '%深圳%'").run();
  db.prepare("UPDATE transfer_orders SET toWarehouseId = 'WH-ACC-001' WHERE toWarehouse LIKE '%阿克拉%'").run();

  console.log('Database seeded successfully!');
}
