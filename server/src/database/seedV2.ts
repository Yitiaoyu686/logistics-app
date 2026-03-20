import { getV2Db } from './connectionV2';

export function seedV2Data(): void {
  const db = getV2Db();
  const seeded = (db.prepare('SELECT COUNT(*) as c FROM sys_user').get() as { c: number }).c;
  if (seeded > 0) {
    console.log('[V2] seed skipped: existing data found');
    return;
  }

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const insertUser = db.prepare(`
      INSERT INTO sys_user (id, username, real_name, password_hash, email, phone, role_code, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);

    insertUser.run('U-ADMIN', 'admin', '系统管理员', 'admin123', 'admin@example.com', '13800000000', 'ADMIN', now, now);
    insertUser.run('U-SALES-01', 'sales1', '销售A', 'sales123', 'sales1@example.com', '13800000001', 'SALES', now, now);
    insertUser.run('U-OPS-CN-01', 'ops_cn1', '起运操作A', 'ops123', 'ops_cn1@example.com', '13800000002', 'OPS_CN', now, now);
    insertUser.run('U-OPS-US-01', 'ops_us1', '到达操作A', 'ops123', 'ops_us1@example.com', '13800000003', 'OPS_US', now, now);
    insertUser.run('U-FIN-01', 'finance1', '财务A', 'fin123', 'finance1@example.com', '13800000004', 'FINANCE', now, now);

    const insertCountry = db.prepare(`
      INSERT INTO md_country (id, code, name_cn, name_en, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    insertCountry.run('CTRY-CN', 'CN', '中国', 'China', now, now);
    insertCountry.run('CTRY-NG', 'NGA', '尼日利亚', 'Nigeria', now, now);
    insertCountry.run('CTRY-GH', 'GHA', '加纳', 'Ghana', now, now);

    const insertCity = db.prepare(`
      INSERT INTO md_city (id, country_id, code, name_cn, name_en, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    insertCity.run('CITY-GZ', 'CTRY-CN', 'GZ', '广州', 'Guangzhou', now, now);
    insertCity.run('CITY-SZ', 'CTRY-CN', 'SZ', '深圳', 'Shenzhen', now, now);
    insertCity.run('CITY-LOS', 'CTRY-NG', 'LOS', '拉各斯', 'Lagos', now, now);
    insertCity.run('CITY-ABV', 'CTRY-NG', 'ABV', '阿布贾', 'Abuja', now, now);

    const insertSite = db.prepare(`
      INSERT INTO md_site (id, city_id, code, name, site_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    insertSite.run('SITE-GZ-ORIGIN', 'CITY-GZ', 'GZ_ORIGIN', '广州起运站', 'ORIGIN', now, now);
    insertSite.run('SITE-SZ-ORIGIN', 'CITY-SZ', 'SZ_ORIGIN', '深圳起运站', 'ORIGIN', now, now);
    insertSite.run('SITE-LOS-DEST', 'CITY-LOS', 'LOS_DEST', '拉各斯到达站', 'DESTINATION', now, now);
    insertSite.run('SITE-ABV-DEST', 'CITY-ABV', 'ABV_DEST', '阿布贾到达站', 'DESTINATION', now, now);

    const insertWarehouse = db.prepare(`
      INSERT INTO md_warehouse (id, code, name, site_id, country_id, city_id, warehouse_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    insertWarehouse.run('WH-GZ-001', 'WH_GZ_001', '广州起运仓', 'SITE-GZ-ORIGIN', 'CTRY-CN', 'CITY-GZ', 'ORIGIN', now, now);
    insertWarehouse.run('WH-SZ-001', 'WH_SZ_001', '深圳起运仓', 'SITE-SZ-ORIGIN', 'CTRY-CN', 'CITY-SZ', 'ORIGIN', now, now);
    insertWarehouse.run('WH-LOS-001', 'WH_LOS_001', '拉各斯到达仓', 'SITE-LOS-DEST', 'CTRY-NG', 'CITY-LOS', 'DESTINATION', now, now);
    insertWarehouse.run('WH-ABV-001', 'WH_ABV_001', '阿布贾到达仓', 'SITE-ABV-DEST', 'CTRY-NG', 'CITY-ABV', 'DESTINATION', now, now);

    const insertSupplier = db.prepare(`
      INSERT INTO md_supplier (id, code, name, supplier_type, country_id, city_id, contact_person, phone, email, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    insertSupplier.run('SUP-MAERSK', 'MAERSK', '马士基', 'CARRIER', 'CTRY-CN', 'CITY-SZ', '王经理', '0755-88886666', 'maersk@example.com', now, now);
    insertSupplier.run('SUP-CZ', 'CHINA_SOUTHERN', '南方航空', 'CARRIER', 'CTRY-CN', 'CITY-GZ', '刘经理', '020-88889999', 'cz@example.com', now, now);
    insertSupplier.run('SUP-LOS-LOCAL', 'LOS_LOCAL_DELIVERY', '拉各斯本地配送', 'AGENT', 'CTRY-NG', 'CITY-LOS', 'Emeka', '+234-800-123-0001', 'los-local@example.com', now, now);

    const insertServiceType = db.prepare(`
      INSERT INTO md_service_type (id, code, name, business_line, service_mode, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    insertServiceType.run('SVC-SEA-LCL', 'LCL_SEA', '海运拼柜', 'SEA', 'LCL', now, now);
    insertServiceType.run('SVC-SEA-FCL', 'FCL_SEA', '海运整柜', 'SEA', 'FCL', now, now);
    insertServiceType.run('SVC-AIR-STD', 'STANDARD_AIR', '空运普快', 'AIR', 'STANDARD', now, now);
    insertServiceType.run('SVC-AIR-EXP', 'EXPRESS_AIR', '空运特快', 'AIR', 'EXPRESS', now, now);

    const insertFeeItem = db.prepare(`
      INSERT INTO md_fee_item (id, code, name, direction, default_level, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    insertFeeItem.run('FEE-ITEM-FREIGHT', 'FREIGHT', '运费', 'BOTH', 'ORDER', now, now);
    insertFeeItem.run('FEE-ITEM-CUSTOMS', 'CUSTOMS', '清关费', 'BOTH', 'JOB', now, now);
    insertFeeItem.run('FEE-ITEM-DELIVERY', 'DELIVERY', '配送费', 'BOTH', 'DPN', now, now);
    insertFeeItem.run('FEE-ITEM-HANDLING', 'HANDLING', '操作费', 'BOTH', 'ORDER', now, now);

    const insertCurrency = db.prepare(`
      INSERT INTO fx_currency (id, code, name, symbol, precision_scale, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    insertCurrency.run('CUR-CNY', 'CNY', '人民币', '¥', 2, now, now);
    insertCurrency.run('CUR-USD', 'USD', '美元', '$', 2, now, now);
    insertCurrency.run('CUR-NGN', 'NGN', '奈拉', '₦', 2, now, now);

    const insertRate = db.prepare(`
      INSERT INTO fx_rate (id, currency_code, base_currency_code, rate_value, rate_date, source, is_latest, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRate.run('FX-CNY-CNY', 'CNY', 'CNY', 1, now.slice(0, 10), 'MANUAL', 1, now);
    insertRate.run('FX-USD-CNY', 'USD', 'CNY', 7.2, now.slice(0, 10), 'MANUAL', 1, now);
    insertRate.run('FX-NGN-CNY', 'NGN', 'CNY', 0.0047, now.slice(0, 10), 'MANUAL', 1, now);

    if (process.env.SEED_V2_DEMO_CUSTOMERS === '1') {
      const insertCustomer = db.prepare(`
        INSERT INTO crm_customer (id, customer_code, customer_name, customer_type, owner_user_id, source, pool_type, status, created_at, updated_at)
        VALUES (?, ?, ?, 'COMPANY', ?, ?, 'PRIVATE', 'ACTIVE', ?, ?)
      `);
      insertCustomer.run('CUST-001', 'C001', '张三贸易公司', 'U-SALES-01', '老客户转化', now, now);
      insertCustomer.run('CUST-002', 'C002', '义乌小商品出口中心', 'U-SALES-01', '展会线索', now, now);

      const insertSender = db.prepare(`
        INSERT INTO crm_sender_profile (
          id, customer_id, sender_name, sender_phone, sender_address, sender_district, sender_city_id, sender_country_id, is_default, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      insertSender.run('SENDER-001', 'CUST-001', '李经理', '13811110000', '广州市白云区江夏北二路3号', '白云区', 'CITY-GZ', 'CTRY-CN', now, now);
      insertSender.run('SENDER-002', 'CUST-002', '林老板', '13822220000', '浙江义乌市国际商贸城', '义乌市', 'CITY-SZ', 'CTRY-CN', now, now);

      const insertRecipient = db.prepare(`
        INSERT INTO uc_recipient_address (
          id, customer_id, recipient_name, recipient_phone, recipient_email, country_id, city_id, district, detail_address, is_default, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      insertRecipient.run('REC-001', 'CUST-001', 'John Doe', '+234-800-111-2222', 'john@example.com', 'CTRY-NG', 'CITY-LOS', 'IKEJA', 'No.18 Allen Avenue, Ikeja, Lagos', now, now);
      insertRecipient.run('REC-002', 'CUST-002', 'Emeka Okafor', '+234-800-333-4444', 'emeka@example.com', 'CTRY-NG', 'CITY-LOS', 'VI', 'No.9 Victoria Island, Lagos', now, now);
    }
  });

  tx();
  console.log('[V2] seed completed');
}
