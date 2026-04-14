import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(__dirname, '..', '..', 'logistics.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function createTables(): void {
  const db = getDb();

  db.exec(`
    -- ============================================================
    -- 1. 身份与权限 (3 tables)
    -- ============================================================

    CREATE TABLE IF NOT EXISTS sys_user (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      real_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      department_id TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','LOCKED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sys_role (
      id TEXT PRIMARY KEY,
      role_code TEXT NOT NULL UNIQUE,
      role_name TEXT NOT NULL,
      description TEXT,
      site_scope TEXT DEFAULT 'ASSIGNED_SITE' CHECK(site_scope IN ('ALL_SITE','ASSIGNED_SITE','OWN_SITE')),
      is_system INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sys_user_role (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES sys_user(id),
      role_id TEXT NOT NULL REFERENCES sys_role(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, role_id)
    );

    -- ============================================================
    -- 2. 基础数据 (9 tables)
    -- ============================================================

    CREATE TABLE IF NOT EXISTS md_country (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name_cn TEXT NOT NULL,
      name_en TEXT,
      continent TEXT,
      phone_code TEXT,
      currency_code TEXT,
      currency_name TEXT,
      currency_symbol TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS md_city (
      id TEXT PRIMARY KEY,
      country_id TEXT NOT NULL REFERENCES md_country(id),
      code TEXT NOT NULL,
      name_cn TEXT NOT NULL,
      name_en TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(country_id, code)
    );

    CREATE TABLE IF NOT EXISTS md_site (
      id TEXT PRIMARY KEY,
      city_id TEXT NOT NULL REFERENCES md_city(id),
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      site_type TEXT NOT NULL CHECK(site_type IN ('ORIGIN','DESTINATION','TRANSIT')),
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(city_id, code)
    );

    CREATE TABLE IF NOT EXISTS md_warehouse (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      site_id TEXT REFERENCES md_site(id),
      country_id TEXT REFERENCES md_country(id),
      city_id TEXT REFERENCES md_city(id),
      warehouse_type TEXT NOT NULL CHECK(warehouse_type IN ('ORIGIN','DESTINATION','TRANSIT')),
      manager_name TEXT,
      manager_phone TEXT,
      capacity TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS md_supplier (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      supplier_type TEXT NOT NULL CHECK(supplier_type IN ('CARRIER','TRUCKING','EXPRESS','CUSTOMS_BROKER','AGENT','OTHER')),
      country TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS md_route (
      id TEXT PRIMARY KEY,
      origin_country TEXT NOT NULL,
      origin_city TEXT NOT NULL,
      dest_country TEXT NOT NULL,
      dest_city TEXT NOT NULL,
      transport_type TEXT NOT NULL CHECK(transport_type IN ('SEA','AIR')),
      transit_days TEXT,
      freight_discount REAL DEFAULT 100,
      volume_ratio REAL DEFAULT 700,
      first_weight_value REAL DEFAULT 1,
      first_weight_price_usd REAL DEFAULT 0,
      first_weight_price_rmb REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS md_logistics_node (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL REFERENCES md_route(id),
      node_code TEXT NOT NULL,
      node_name TEXT NOT NULL,
      node_name_en TEXT,
      node_type TEXT NOT NULL CHECK(node_type IN ('PICKUP','WAREHOUSE_IN','CUSTOMS_EXPORT','DEPARTURE','IN_TRANSIT','ARRIVAL','CUSTOMS_IMPORT','WAREHOUSE_OUT','DELIVERY','SIGNED')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_required INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS md_fee_item (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      name_en TEXT,
      direction TEXT DEFAULT 'BOTH' CHECK(direction IN ('RECEIVABLE','PAYABLE','BOTH')),
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fx_rate (
      id TEXT PRIMARY KEY,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL DEFAULT 'CNY',
      rate REAL NOT NULL,
      rate_date TEXT NOT NULL,
      source TEXT DEFAULT 'MANUAL',
      is_latest INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(from_currency, to_currency, rate_date)
    );

    -- ============================================================
    -- 3. CRM 客户管理 (3 tables)
    -- ============================================================

    CREATE TABLE IF NOT EXISTS crm_customer (
      id TEXT PRIMARY KEY,
      customer_code TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_type TEXT DEFAULT 'COMPANY' CHECK(customer_type IN ('COMPANY_CN','COMPANY_OVERSEAS','INDIVIDUAL')),
      country TEXT,
      industry TEXT,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      owner_user_id TEXT REFERENCES sys_user(id),
      pool_type TEXT NOT NULL DEFAULT 'PRIVATE' CHECK(pool_type IN ('PRIVATE','PUBLIC')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DORMANT','FROZEN')),
      preferred_transport TEXT,
      preferred_payment TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS crm_sender_profile (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES crm_customer(id),
      sender_name TEXT NOT NULL,
      sender_phone TEXT,
      sender_address TEXT,
      sender_city TEXT,
      sender_country TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crm_recipient_address (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES crm_customer(id),
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT,
      recipient_email TEXT,
      country TEXT,
      city TEXT,
      state_province TEXT,
      zip_code TEXT,
      detail_address TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- 4. OMS 订单管理 (4 tables)
    -- ============================================================

    CREATE TABLE IF NOT EXISTS oms_order (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      warehouse_entry_no TEXT UNIQUE,
      business_line TEXT NOT NULL CHECK(business_line IN ('SEA','AIR')),
      service_type TEXT,
      customer_id TEXT REFERENCES crm_customer(id),
      customer_name TEXT,
      sales_user_id TEXT REFERENCES sys_user(id),
      route_code TEXT,
      export_mode TEXT DEFAULT 'BUYER_EXPORT',
      order_status TEXT NOT NULL DEFAULT 'PENDING_INBOUND' CHECK(order_status IN ('DRAFT','PENDING_INBOUND','INBOUND','PENDING_DEPARTURE','DEPARTED','IN_TRANSIT','ARRIVED','CUSTOMS_CLEARANCE','PENDING_DELIVERY','DELIVERING','DELIVERED','COMPLETED','EXCEPTION','RETURN_APPLIED','CANCELLED','SUSPENDED')),
      payment_status TEXT DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID','PARTIAL','PAID')),
      payment_method TEXT,
      currency_code TEXT DEFAULT 'CNY',
      total_declared_pieces INTEGER DEFAULT 0,
      total_declared_weight_kg REAL DEFAULT 0,
      total_actual_pieces INTEGER DEFAULT 0,
      total_actual_weight_kg REAL DEFAULT 0,
      total_chargeable_weight_kg REAL DEFAULT 0,
      total_receivable_amount REAL DEFAULT 0,
      total_paid_amount REAL DEFAULT 0,
      sender_name TEXT,
      sender_phone TEXT,
      sender_address TEXT,
      consignee_name TEXT,
      consignee_phone TEXT,
      consignee_email TEXT,
      consignee_address TEXT,
      consignee_country TEXT,
      consignee_city TEXT,
      remark TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS oms_sub_order (
      id TEXT PRIMARY KEY,
      sub_order_no TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL REFERENCES oms_order(id),
      line_no INTEGER NOT NULL DEFAULT 1,
      business_line TEXT NOT NULL CHECK(business_line IN ('SEA','AIR')),
      sub_status TEXT NOT NULL DEFAULT 'PENDING_INBOUND' CHECK(sub_status IN ('PENDING_INBOUND','INBOUND','PENDING_PACKING','PACKED','PENDING_DEPARTURE','IN_TRANSIT','CUSTOMS_CLEARANCE','ARRIVED','PENDING_DELIVERY','DELIVERING','DELIVERED','EXCEPTION','RETURN_APPLIED','CANCELLED')),
      route_code TEXT,
      service_type TEXT,
      shipping_unit_id TEXT,
      job_id TEXT,
      container_no TEXT,
      pieces INTEGER DEFAULT 0,
      actual_weight_kg REAL DEFAULT 0,
      volume_cbm REAL DEFAULT 0,
      volume_weight_kg REAL DEFAULT 0,
      chargeable_weight_kg REAL DEFAULT 0,
      remark TEXT,
      etd TEXT,
      eta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS oms_package_initial (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES oms_order(id),
      line_no INTEGER NOT NULL DEFAULT 1,
      express_company TEXT,
      tracking_no TEXT,
      goods_name TEXT,
      goods_category TEXT,
      cargo_type TEXT DEFAULT 'GENERAL' CHECK(cargo_type IN ('GENERAL','SENSITIVE')),
      declared_weight_kg REAL DEFAULT 0,
      pieces INTEGER DEFAULT 1,
      declared_value REAL DEFAULT 0,
      length_cm REAL,
      width_cm REAL,
      height_cm REAL,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(order_id, tracking_no)
    );

    CREATE TABLE IF NOT EXISTS oms_package_actual (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES oms_order(id),
      sub_order_id TEXT REFERENCES oms_sub_order(id),
      initial_package_id TEXT REFERENCES oms_package_initial(id),
      tracking_no TEXT,
      goods_name TEXT,
      cargo_type TEXT DEFAULT 'GENERAL',
      pieces INTEGER DEFAULT 1,
      gross_weight_kg REAL DEFAULT 0,
      length_cm REAL,
      width_cm REAL,
      height_cm REAL,
      volume_cbm REAL DEFAULT 0,
      volume_weight_kg REAL DEFAULT 0,
      chargeable_weight_kg REAL DEFAULT 0,
      package_status TEXT DEFAULT 'IN_STOCK' CHECK(package_status IN ('IN_STOCK','PACKED','IN_TRANSIT','ARRIVED','DELIVERED','RETURNED','DAMAGED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    -- ============================================================
    -- 5. WMS 仓储管理 (5 tables)
    -- ============================================================

    CREATE TABLE IF NOT EXISTS wms_inbound_order (
      id TEXT PRIMARY KEY,
      inbound_no TEXT NOT NULL UNIQUE,
      business_line TEXT NOT NULL CHECK(business_line IN ('SEA','AIR')),
      warehouse_id TEXT REFERENCES md_warehouse(id),
      order_id TEXT REFERENCES oms_order(id),
      sub_order_id TEXT REFERENCES oms_sub_order(id),
      source_type TEXT DEFAULT 'THIRD_PARTY' CHECK(source_type IN ('THIRD_PARTY','TRANSFER','RETURN','NO_ORDER','MANUAL')),
      inbound_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(inbound_status IN ('PENDING','PROCESSING','COMPLETED','CANCELLED')),
      inbound_at TEXT,
      operator_user_id TEXT REFERENCES sys_user(id),
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS wms_inbound_item (
      id TEXT PRIMARY KEY,
      inbound_order_id TEXT NOT NULL REFERENCES wms_inbound_order(id),
      order_id TEXT REFERENCES oms_order(id),
      sub_order_id TEXT REFERENCES oms_sub_order(id),
      package_actual_id TEXT REFERENCES oms_package_actual(id),
      tracking_no TEXT,
      pieces INTEGER DEFAULT 1,
      gross_weight_kg REAL DEFAULT 0,
      length_cm REAL,
      width_cm REAL,
      height_cm REAL,
      volume_cbm REAL DEFAULT 0,
      package_condition TEXT DEFAULT 'GOOD' CHECK(package_condition IN ('GOOD','DAMAGED','WET','OPENED','INCOMPLETE')),
      location_code TEXT,
      photo_urls TEXT,
      goods_category TEXT,
      item_status TEXT DEFAULT 'COMPLETED' CHECK(item_status IN ('PENDING','COMPLETED','ABNORMAL')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wms_stock (
      id TEXT PRIMARY KEY,
      business_line TEXT NOT NULL CHECK(business_line IN ('SEA','AIR')),
      warehouse_id TEXT REFERENCES md_warehouse(id),
      order_id TEXT REFERENCES oms_order(id),
      sub_order_id TEXT REFERENCES oms_sub_order(id),
      package_actual_id TEXT REFERENCES oms_package_actual(id),
      stock_status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK(stock_status IN ('IN_STOCK','ALLOCATED','PACKED','OUTBOUND','RETURNED','DAMAGED')),
      pieces INTEGER DEFAULT 0,
      gross_weight_kg REAL DEFAULT 0,
      volume_cbm REAL DEFAULT 0,
      location_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS wms_unmatched_package (
      id TEXT PRIMARY KEY,
      business_line TEXT DEFAULT 'SEA',
      warehouse_id TEXT REFERENCES md_warehouse(id),
      tracking_no TEXT,
      express_company TEXT,
      sender_name TEXT,
      sender_phone TEXT,
      pieces INTEGER DEFAULT 1,
      gross_weight_kg REAL DEFAULT 0,
      customer_hint TEXT,
      goods_name TEXT,
      location_code TEXT,
      photo_urls TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','MATCHED','CLOSED')),
      matched_order_id TEXT,
      matched_at TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS wms_transfer (
      id TEXT PRIMARY KEY,
      transfer_no TEXT NOT NULL UNIQUE,
      business_line TEXT NOT NULL DEFAULT 'SEA',
      direction TEXT DEFAULT 'SATELLITE_TO_MAIN',
      from_warehouse_id TEXT REFERENCES md_warehouse(id),
      to_warehouse_id TEXT REFERENCES md_warehouse(id),
      from_warehouse_name TEXT,
      to_warehouse_name TEXT,
      route_label TEXT,
      job_id TEXT,
      shipping_unit_no TEXT,
      total_pieces INTEGER DEFAULT 0,
      total_weight_kg REAL DEFAULT 0,
      total_volume_cbm REAL DEFAULT 0,
      transfer_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(transfer_status IN ('PENDING','IN_TRANSIT','ARRIVED','RECEIVED','CANCELLED')),
      logistics_company TEXT,
      tracking_no TEXT,
      query_phone TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      plate_no TEXT,
      dispatch_time TEXT,
      arrival_time TEXT,
      receive_time TEXT,
      operator_user_id TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS wms_transfer_item (
      id TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL REFERENCES wms_transfer(id) ON DELETE CASCADE,
      sub_order_id TEXT,
      sub_order_no TEXT,
      tracking_no TEXT,
      customer_name TEXT,
      pieces INTEGER DEFAULT 0,
      weight_kg REAL DEFAULT 0,
      volume_cbm REAL DEFAULT 0,
      route TEXT,
      inbound_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(inbound_status IN ('PENDING','RECEIVED')),
      inbound_method TEXT CHECK(inbound_method IN ('SCAN','MANUAL')),
      inbound_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- 6. TMS 运输管理 (4 tables)
    -- ============================================================

    CREATE TABLE IF NOT EXISTS tms_job (
      id TEXT PRIMARY KEY,
      job_no TEXT NOT NULL UNIQUE,
      business_line TEXT NOT NULL CHECK(business_line IN ('SEA','AIR')),
      route_code TEXT,
      origin_port TEXT,
      dest_port TEXT,
      carrier_name TEXT,
      vessel_voyage TEXT,
      flight_no TEXT,
      bill_no TEXT,
      container_no TEXT,
      container_type TEXT,
      cargo_type TEXT DEFAULT 'GENERAL',
      service_type TEXT DEFAULT 'EXPRESS',
      job_status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(job_status IN ('PLANNED','LOADING','CUSTOMS_EXPORT','DEPARTED','IN_TRANSIT','ARRIVED','CUSTOMS_IMPORT','CLEARED','COMPLETED','CANCELLED')),
      current_node TEXT,
      total_pieces INTEGER DEFAULT 0,
      total_weight_kg REAL DEFAULT 0,
      total_volume_cbm REAL DEFAULT 0,
      etd TEXT,
      eta TEXT,
      atd TEXT,
      ata TEXT,
      remark TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tms_shipping_unit (
      id TEXT PRIMARY KEY,
      unit_no TEXT NOT NULL UNIQUE,
      business_line TEXT NOT NULL CHECK(business_line IN ('SEA','AIR')),
      unit_type TEXT DEFAULT 'CONTAINER' CHECK(unit_type IN ('CONTAINER','PALLET','CARTON','BULK')),
      container_type TEXT CHECK(container_type IN ('20GP','40GP','40HQ','45HQ','LCL','AIR_PALLET','AIR_BULK')),
      seal_no TEXT,
      warehouse_id TEXT REFERENCES md_warehouse(id),
      job_id TEXT REFERENCES tms_job(id),
      route_code TEXT,
      unit_status TEXT NOT NULL DEFAULT 'EMPTY' CHECK(unit_status IN ('EMPTY','LOADING','SEALED','SHIPPED','ARRIVED','UNLOADED')),
      max_weight_kg REAL DEFAULT 0,
      max_volume_cbm REAL DEFAULT 0,
      current_weight_kg REAL DEFAULT 0,
      current_volume_cbm REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tms_job_order_rel (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES tms_job(id),
      sub_order_id TEXT NOT NULL REFERENCES oms_sub_order(id),
      shipping_unit_id TEXT REFERENCES tms_shipping_unit(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(job_id, sub_order_id)
    );

    CREATE TABLE IF NOT EXISTS tms_tracking_event (
      id TEXT PRIMARY KEY,
      business_line TEXT DEFAULT 'SEA',
      event_scope TEXT DEFAULT 'JOB' CHECK(event_scope IN ('ORDER','SUB_ORDER','JOB','DPN')),
      order_id TEXT,
      sub_order_id TEXT,
      job_id TEXT,
      dpn_id TEXT,
      node_code TEXT,
      node_name TEXT,
      event_type TEXT DEFAULT 'EXPORT',
      status_code TEXT,
      event_time TEXT,
      location TEXT,
      operator_user_id TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============================================================
    -- 7. POD 末端配送 (4 tables)
    -- ============================================================

    CREATE TABLE IF NOT EXISTS pod_dpn (
      id TEXT PRIMARY KEY,
      dpn_no TEXT NOT NULL UNIQUE,
      business_line TEXT DEFAULT 'SEA',
      dpn_type TEXT DEFAULT 'DELIVERY' CHECK(dpn_type IN ('DELIVERY','TRANSFER')),
      from_site TEXT,
      to_site TEXT,
      from_warehouse_id TEXT,
      to_warehouse_id TEXT,
      warehouse_id TEXT REFERENCES md_warehouse(id),
      customer_id TEXT,
      recipient_name TEXT,
      recipient_phone TEXT,
      recipient_address TEXT,
      recipient_country TEXT,
      recipient_city TEXT,
      delivery_method TEXT DEFAULT 'DELIVERY' CHECK(delivery_method IN ('DELIVERY','SELF_PICKUP','SATELLITE_STATION')),
      dpn_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(dpn_status IN ('DRAFT','PENDING_BIND','PENDING_DISPATCH','IN_TRANSIT','ARRIVED','PENDING_INBOUND','INBOUND','DELIVERED','SIGNED','CANCELLED')),
      total_orders INTEGER DEFAULT 0,
      total_pieces INTEGER DEFAULT 0,
      total_weight_kg REAL DEFAULT 0,
      logistics_company TEXT,
      tracking_no TEXT,
      query_phone TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      plate_no TEXT,
      dispatch_time TEXT,
      arrival_time TEXT,
      remark TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pod_dpn_item (
      id TEXT PRIMARY KEY,
      dpn_id TEXT NOT NULL REFERENCES pod_dpn(id),
      order_id TEXT REFERENCES oms_order(id),
      sub_order_id TEXT REFERENCES oms_sub_order(id),
      stock_id TEXT REFERENCES wms_stock(id),
      tracking_no TEXT,
      pieces INTEGER DEFAULT 1,
      weight_kg REAL DEFAULT 0,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pod_delivery_task (
      id TEXT PRIMARY KEY,
      dpn_id TEXT NOT NULL REFERENCES pod_dpn(id),
      task_no TEXT NOT NULL UNIQUE,
      sub_order_no TEXT,
      recipient_name TEXT,
      recipient_phone TEXT,
      recipient_address TEXT,
      service_type TEXT DEFAULT 'DELIVERY',
      payment_status TEXT DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID','PARTIAL','PAID')),
      payment_method TEXT,
      cod_amount REAL DEFAULT 0,
      cod_currency TEXT DEFAULT 'NGN',
      task_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(task_status IN ('PENDING','ACCEPTED','IN_TRANSIT','DELIVERED','SIGNED','FAILED','CANCELLED')),
      failure_reason TEXT,
      signed_by TEXT,
      signed_at TEXT,
      sign_photo_urls TEXT,
      driver_name TEXT,
      driver_phone TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pod_pickup (
      id TEXT PRIMARY KEY,
      pickup_no TEXT NOT NULL UNIQUE,
      dpn_id TEXT REFERENCES pod_dpn(id),
      sub_order_no TEXT,
      tracking_no TEXT,
      recipient_name TEXT,
      recipient_phone TEXT,
      pickup_station TEXT,
      pickup_code TEXT,
      pieces INTEGER DEFAULT 1,
      weight_kg REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'UNPAID',
      notify_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(notify_status IN ('PENDING','NOTIFIED','PICKED_UP')),
      notified_at TEXT,
      picked_up_at TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    -- ============================================================
    -- 8. 财务 (2 tables)
    -- ============================================================

    CREATE TABLE IF NOT EXISTS fin_fee (
      id TEXT PRIMARY KEY,
      fee_no TEXT NOT NULL UNIQUE,
      business_line TEXT DEFAULT 'SEA',
      fee_level TEXT DEFAULT 'ORDER' CHECK(fee_level IN ('ORDER','SUB_ORDER','JOB','DPN','TRANSFER')),
      related_id TEXT,
      related_no TEXT,
      fee_item_code TEXT,
      fee_direction TEXT DEFAULT 'RECEIVABLE' CHECK(fee_direction IN ('RECEIVABLE','PAYABLE')),
      unit_price REAL DEFAULT 0,
      quantity REAL DEFAULT 1,
      amount REAL NOT NULL DEFAULT 0,
      currency_code TEXT DEFAULT 'CNY',
      fx_rate REAL DEFAULT 1,
      counterparty_name TEXT,
      fee_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(fee_status IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','PAID','CANCELLED')),
      description TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS fin_payment (
      id TEXT PRIMARY KEY,
      payment_no TEXT NOT NULL UNIQUE,
      related_fee_id TEXT REFERENCES fin_fee(id),
      payment_type TEXT DEFAULT 'INBOUND' CHECK(payment_type IN ('INBOUND','OUTBOUND')),
      amount REAL NOT NULL DEFAULT 0,
      currency_code TEXT DEFAULT 'CNY',
      payment_method TEXT,
      payment_status TEXT DEFAULT 'CONFIRMED' CHECK(payment_status IN ('INIT','CONFIRMED','VOID')),
      payment_time TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 对老库做增量兼容(SQLite 不支持 IF NOT EXISTS 于 ALTER TABLE ADD COLUMN)
  const ensureColumn = (table: string, column: string, ddl: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  };
  ensureColumn('wms_inbound_item', 'goods_category', 'TEXT');
  ensureColumn('wms_inbound_item', 'photo_urls', 'TEXT');
  // 到达国任务入库字段
  ensureColumn('wms_inbound_item', 'delivery_status', 'TEXT');
  ensureColumn('wms_inbound_item', 'cargo_status', 'TEXT');
  // wms_transfer 发车扩展字段
  ensureColumn('wms_transfer', 'shipping_no', 'TEXT');
  ensureColumn('wms_transfer', 'track_url', 'TEXT');
  ensureColumn('wms_transfer', 'remark', 'TEXT');
  ensureColumn('wms_transfer', 'logistics_company_id', 'TEXT');
  // tms_job 发车扩展字段
  ensureColumn('tms_job', 'trucking_company', 'TEXT');
  ensureColumn('tms_job', 'trucking_company_id', 'TEXT');
  ensureColumn('tms_job', 'shipping_no', 'TEXT');
  ensureColumn('tms_job', 'driver_name', 'TEXT');
  ensureColumn('tms_job', 'driver_phone', 'TEXT');
  ensureColumn('tms_job', 'plate_no', 'TEXT');
  ensureColumn('tms_job', 'query_phone', 'TEXT');
  ensureColumn('tms_job', 'track_url', 'TEXT');
  ensureColumn('tms_job', 'recipient_name', 'TEXT');
  ensureColumn('tms_job', 'recipient_phone', 'TEXT');
  ensureColumn('tms_job', 'recipient_address', 'TEXT');
  // pod_dpn 发车扩展字段
  ensureColumn('pod_dpn', 'shipping_no', 'TEXT');
  ensureColumn('pod_dpn', 'track_url', 'TEXT');
  ensureColumn('pod_dpn', 'logistics_company_id', 'TEXT');

  console.log('All tables created successfully');
}
