PRAGMA foreign_keys = ON;

-- =========================================================
-- V2 MVP Schema (DB First)
-- Scope: OMS -> WMS -> TMS -> POD -> Finance -> Workflow
-- Note: Fresh design, no backward compatibility with old tables.
-- =========================================================

-- ==================== 1) Identity & Master Data ====================

CREATE TABLE IF NOT EXISTS sys_user (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  real_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS md_country (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_cn TEXT NOT NULL,
  name_en TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS md_city (
  id TEXT PRIMARY KEY,
  country_id TEXT NOT NULL REFERENCES md_country(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name_cn TEXT NOT NULL,
  name_en TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(country_id, code)
);
CREATE INDEX IF NOT EXISTS idx_md_city_country ON md_city(country_id);

CREATE TABLE IF NOT EXISTS md_site (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES md_city(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  site_type TEXT NOT NULL CHECK(site_type IN ('ORIGIN', 'DESTINATION', 'TRANSIT')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(city_id, code)
);
CREATE INDEX IF NOT EXISTS idx_md_site_city ON md_site(city_id);

CREATE TABLE IF NOT EXISTS md_warehouse (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  site_id TEXT REFERENCES md_site(id) ON DELETE SET NULL,
  country_id TEXT NOT NULL REFERENCES md_country(id) ON DELETE RESTRICT,
  city_id TEXT NOT NULL REFERENCES md_city(id) ON DELETE RESTRICT,
  warehouse_type TEXT NOT NULL CHECK(warehouse_type IN ('ORIGIN', 'DESTINATION', 'TRANSIT')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_md_warehouse_site ON md_warehouse(site_id);
CREATE INDEX IF NOT EXISTS idx_md_warehouse_city ON md_warehouse(city_id);

CREATE TABLE IF NOT EXISTS md_supplier (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  supplier_type TEXT NOT NULL CHECK(supplier_type IN ('CARRIER', 'AGENT', 'WAREHOUSE', 'OTHER')),
  country_id TEXT REFERENCES md_country(id) ON DELETE SET NULL,
  city_id TEXT REFERENCES md_city(id) ON DELETE SET NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS md_service_type (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  service_mode TEXT NOT NULL CHECK(service_mode IN ('STANDARD', 'EXPRESS', 'LCL', 'FCL')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_md_service_line ON md_service_type(business_line);

CREATE TABLE IF NOT EXISTS md_fee_item (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('RECEIVABLE', 'PAYABLE', 'BOTH')),
  default_level TEXT NOT NULL CHECK(default_level IN ('ORDER', 'SUB_ORDER', 'JOB', 'DPN', 'TRANSFER', 'PETTY_CASH', 'PURCHASE', 'CLAIM')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fx_currency (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  precision_scale INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fx_rate (
  id TEXT PRIMARY KEY,
  currency_code TEXT NOT NULL REFERENCES fx_currency(code) ON DELETE RESTRICT,
  base_currency_code TEXT NOT NULL REFERENCES fx_currency(code) ON DELETE RESTRICT,
  rate_value REAL NOT NULL,
  rate_date TEXT NOT NULL,
  source TEXT,
  is_latest INTEGER NOT NULL DEFAULT 1 CHECK(is_latest IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(currency_code, base_currency_code, rate_date)
);
CREATE INDEX IF NOT EXISTS idx_fx_rate_latest ON fx_rate(currency_code, base_currency_code, is_latest);

-- ==================== 2) CRM ====================

CREATE TABLE IF NOT EXISTS crm_customer (
  id TEXT PRIMARY KEY,
  customer_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_type TEXT NOT NULL DEFAULT 'COMPANY' CHECK(customer_type IN ('COMPANY', 'PERSONAL')),
  owner_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  source TEXT,
  pool_type TEXT NOT NULL DEFAULT 'PRIVATE' CHECK(pool_type IN ('PRIVATE', 'PUBLIC')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DORMANT', 'FROZEN')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_customer_owner ON crm_customer(owner_user_id);

CREATE TABLE IF NOT EXISTS crm_sender_profile (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES crm_customer(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_phone TEXT,
  sender_address TEXT,
  sender_district TEXT,
  sender_city_id TEXT REFERENCES md_city(id) ON DELETE SET NULL,
  sender_country_id TEXT REFERENCES md_country(id) ON DELETE SET NULL,
  is_default INTEGER NOT NULL DEFAULT 1 CHECK(is_default IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crm_sender_customer ON crm_sender_profile(customer_id);

CREATE TABLE IF NOT EXISTS uc_recipient_address (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES crm_customer(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_email TEXT,
  country_id TEXT NOT NULL REFERENCES md_country(id) ON DELETE RESTRICT,
  city_id TEXT NOT NULL REFERENCES md_city(id) ON DELETE RESTRICT,
  district TEXT,
  detail_address TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 1 CHECK(is_default IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_uc_recipient_customer ON uc_recipient_address(customer_id);

CREATE TABLE IF NOT EXISTS crm_customer_line_profile (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES crm_customer(id) ON DELETE CASCADE,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  preferred_route_code TEXT,
  preferred_service_type_code TEXT REFERENCES md_service_type(code) ON DELETE SET NULL,
  preferred_payment_method TEXT,
  preferred_payment_channel TEXT,
  default_sender_profile_id TEXT REFERENCES crm_sender_profile(id) ON DELETE SET NULL,
  default_recipient_address_id TEXT REFERENCES uc_recipient_address(id) ON DELETE SET NULL,
  price_level TEXT,
  risk_flag TEXT,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, business_line)
);
CREATE INDEX IF NOT EXISTS idx_crm_customer_line_profile_customer ON crm_customer_line_profile(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_customer_line_profile_line ON crm_customer_line_profile(business_line);

-- ==================== 3) OMS ====================

CREATE TABLE IF NOT EXISTS oms_order (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  display_order_no TEXT NOT NULL UNIQUE,
  warehouse_entry_no TEXT UNIQUE,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  service_type_code TEXT NOT NULL REFERENCES md_service_type(code) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES crm_customer(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  sales_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  creator_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  route_code TEXT NOT NULL,
  export_mode TEXT CHECK(export_mode IN ('BUYER_EXPORT', 'SELF_DOCS_EXPORT')),
  order_status TEXT NOT NULL CHECK(order_status IN (
    'DRAFT', 'PENDING_INBOUND', 'INBOUND',
    'PENDING_DEPARTURE', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED',
    'PARTIAL_DELIVERED', 'COMPLETED', 'EXCEPTION', 'RETURN_APPLIED', 'CANCELLED'
  )),
  order_status_updated_at TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
  payment_status_updated_at TEXT,
  payment_method TEXT CHECK(payment_method IN ('PREPAID', 'COD', 'CREDIT_CARD', 'BANK_TRANSFER', 'CASH')),
  payment_channel TEXT,
  payment_time TEXT,
  currency_code TEXT NOT NULL REFERENCES fx_currency(code) ON DELETE RESTRICT,
  total_declared_value REAL NOT NULL DEFAULT 0,
  total_declared_weight_kg REAL NOT NULL DEFAULT 0,
  total_declared_pieces INTEGER NOT NULL DEFAULT 0,
  total_actual_weight_kg REAL NOT NULL DEFAULT 0,
  total_actual_pieces INTEGER NOT NULL DEFAULT 0,
  total_chargeable_weight_kg REAL NOT NULL DEFAULT 0,
  total_receivable_amount REAL NOT NULL DEFAULT 0,
  total_paid_amount REAL NOT NULL DEFAULT 0,
  sender_name TEXT,
  sender_phone TEXT,
  sender_address TEXT,
  sender_district TEXT,
  sender_city_id TEXT REFERENCES md_city(id) ON DELETE SET NULL,
  sender_country_id TEXT REFERENCES md_country(id) ON DELETE SET NULL,
  consignee_name TEXT NOT NULL,
  consignee_phone TEXT NOT NULL,
  consignee_email TEXT,
  consignee_address TEXT NOT NULL,
  consignee_district TEXT,
  consignee_city_id TEXT NOT NULL REFERENCES md_city(id) ON DELETE RESTRICT,
  consignee_country_id TEXT NOT NULL REFERENCES md_country(id) ON DELETE RESTRICT,
  remark TEXT,
  previous_status TEXT,
  return_type TEXT,
  return_reason TEXT,
  return_refund_amount REAL,
  return_refund_method TEXT,
  need_return INTEGER CHECK(need_return IN (0, 1)),
  return_shipping_note TEXT,
  return_applied_by TEXT,
  return_applied_at TEXT,
  return_approver TEXT,
  return_approved_at TEXT,
  return_reject_reason TEXT,
  created_by TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_oms_order_line ON oms_order(business_line);
CREATE INDEX IF NOT EXISTS idx_oms_order_customer ON oms_order(customer_id);
CREATE INDEX IF NOT EXISTS idx_oms_order_status ON oms_order(order_status);
CREATE INDEX IF NOT EXISTS idx_oms_order_updated ON oms_order(updated_at);

CREATE TABLE IF NOT EXISTS oms_order_package_initial (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES oms_order(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  express_company TEXT NOT NULL,
  tracking_no TEXT NOT NULL,
  package_status TEXT NOT NULL CHECK(package_status IN ('PENDING_SIGN', 'SIGNED', 'INBOUND', 'DELETED')),
  package_status_updated_at TEXT NOT NULL,
  goods_name TEXT NOT NULL,
  goods_category TEXT,
  cargo_desc TEXT NOT NULL CHECK(cargo_desc IN ('GENERAL', 'SENSITIVE')),
  declared_weight_kg REAL NOT NULL DEFAULT 0,
  pieces INTEGER NOT NULL DEFAULT 0,
  declared_value_usd REAL NOT NULL DEFAULT 0,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, tracking_no)
);
CREATE INDEX IF NOT EXISTS idx_oms_pkg_init_order ON oms_order_package_initial(order_id);
CREATE INDEX IF NOT EXISTS idx_oms_pkg_init_status ON oms_order_package_initial(package_status);

CREATE TABLE IF NOT EXISTS oms_sub_order (
  id TEXT PRIMARY KEY,
  sub_order_no TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES oms_order(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  sub_status TEXT NOT NULL CHECK(sub_status IN (
    'PENDING_INBOUND', 'INBOUND', 'PENDING_PACKING', 'PACKED',
    'PENDING_DEPARTURE', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'ARRIVED',
    'PENDING_DELIVERY', 'DELIVERING', 'DELIVERED', 'EXCEPTION', 'RETURN_APPLIED', 'CANCELLED'
  )),
  sub_status_updated_at TEXT NOT NULL,
  route_code TEXT NOT NULL,
  service_type_code TEXT NOT NULL REFERENCES md_service_type(code) ON DELETE RESTRICT,
  bill_no TEXT,
  shipping_unit_id TEXT,
  job_id TEXT,
  container_no TEXT,
  chargeable_weight_kg REAL,
  actual_weight_kg REAL,
  volume_cbm REAL,
  volume_weight_kg REAL,
  pieces INTEGER NOT NULL DEFAULT 0,
  remark TEXT,
  etd TEXT,
  eta TEXT,
  atd TEXT,
  ata TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_oms_sub_order_order ON oms_sub_order(order_id);
CREATE INDEX IF NOT EXISTS idx_oms_sub_order_status ON oms_sub_order(sub_status);
CREATE INDEX IF NOT EXISTS idx_oms_sub_order_job ON oms_sub_order(job_id);
CREATE INDEX IF NOT EXISTS idx_oms_sub_order_unit ON oms_sub_order(shipping_unit_id);

CREATE TABLE IF NOT EXISTS oms_order_package_actual (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES oms_order(id) ON DELETE CASCADE,
  sub_order_id TEXT REFERENCES oms_sub_order(id) ON DELETE SET NULL,
  initial_package_id TEXT REFERENCES oms_order_package_initial(id) ON DELETE SET NULL,
  tracking_no TEXT,
  goods_name TEXT NOT NULL,
  cargo_desc TEXT NOT NULL CHECK(cargo_desc IN ('GENERAL', 'SENSITIVE')),
  length_cm REAL,
  width_cm REAL,
  height_cm REAL,
  pieces INTEGER NOT NULL DEFAULT 0,
  gross_weight_kg REAL NOT NULL DEFAULT 0,
  volume_cbm REAL NOT NULL DEFAULT 0,
  volume_weight_kg REAL,
  chargeable_weight_kg REAL,
  package_status TEXT NOT NULL CHECK(package_status IN ('IN_STOCK', 'PACKED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'RETURNED', 'DAMAGED')),
  package_status_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_oms_pkg_actual_order ON oms_order_package_actual(order_id);
CREATE INDEX IF NOT EXISTS idx_oms_pkg_actual_sub ON oms_order_package_actual(sub_order_id);

CREATE TABLE IF NOT EXISTS oms_order_status_log (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES oms_order(id) ON DELETE CASCADE,
  sub_order_id TEXT REFERENCES oms_sub_order(id) ON DELETE CASCADE,
  status_code TEXT NOT NULL,
  node_code TEXT,
  node_name TEXT,
  event_time TEXT NOT NULL,
  operator_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_oms_status_log_order ON oms_order_status_log(order_id, event_time);
CREATE INDEX IF NOT EXISTS idx_oms_status_log_sub ON oms_order_status_log(sub_order_id, event_time);

-- ==================== 4) WMS Origin ====================

CREATE TABLE IF NOT EXISTS wms_inbound_order (
  id TEXT PRIMARY KEY,
  inbound_no TEXT NOT NULL UNIQUE,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  warehouse_id TEXT NOT NULL REFERENCES md_warehouse(id) ON DELETE RESTRICT,
  order_id TEXT REFERENCES oms_order(id) ON DELETE SET NULL,
  sub_order_id TEXT REFERENCES oms_sub_order(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('THIRD_PARTY', 'TRANSFER', 'NO_ORDER', 'MANUAL')),
  source_ref_no TEXT,
  inbound_status TEXT NOT NULL CHECK(inbound_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED')),
  inbound_at TEXT,
  operator_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wms_inbound_wh ON wms_inbound_order(warehouse_id, inbound_status);

CREATE TABLE IF NOT EXISTS wms_inbound_item (
  id TEXT PRIMARY KEY,
  inbound_order_id TEXT NOT NULL REFERENCES wms_inbound_order(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES oms_order(id) ON DELETE SET NULL,
  sub_order_id TEXT REFERENCES oms_sub_order(id) ON DELETE SET NULL,
  package_actual_id TEXT REFERENCES oms_order_package_actual(id) ON DELETE SET NULL,
  tracking_no TEXT,
  pieces INTEGER NOT NULL DEFAULT 0,
  gross_weight_kg REAL NOT NULL DEFAULT 0,
  length_cm REAL,
  width_cm REAL,
  height_cm REAL,
  volume_cbm REAL,
  package_condition TEXT NOT NULL CHECK(package_condition IN ('GOOD', 'DAMAGED', 'WET', 'OPENED', 'INCOMPLETE')),
  location_code TEXT,
  item_status TEXT NOT NULL CHECK(item_status IN ('PENDING', 'COMPLETED', 'ABNORMAL')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wms_inbound_item_order ON wms_inbound_item(order_id, sub_order_id);

CREATE TABLE IF NOT EXISTS wms_unmatched_package (
  id TEXT PRIMARY KEY,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  warehouse_id TEXT NOT NULL REFERENCES md_warehouse(id) ON DELETE RESTRICT,
  inbound_order_id TEXT REFERENCES wms_inbound_order(id) ON DELETE SET NULL,
  inbound_item_id TEXT REFERENCES wms_inbound_item(id) ON DELETE SET NULL,
  tracking_no TEXT,
  express_company TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  consignee_name TEXT,
  consignee_phone TEXT,
  customer_hint TEXT,
  pieces INTEGER NOT NULL DEFAULT 0,
  gross_weight_kg REAL NOT NULL DEFAULT 0,
  volume_cbm REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'MATCHED', 'CLOSED')),
  matched_order_id TEXT REFERENCES oms_order(id) ON DELETE SET NULL,
  matched_sub_order_id TEXT REFERENCES oms_sub_order(id) ON DELETE SET NULL,
  match_method TEXT,
  match_note TEXT,
  matched_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wms_unmatched_status ON wms_unmatched_package(status, business_line, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wms_unmatched_tracking ON wms_unmatched_package(tracking_no);

CREATE TABLE IF NOT EXISTS wms_stock (
  id TEXT PRIMARY KEY,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  warehouse_id TEXT NOT NULL REFERENCES md_warehouse(id) ON DELETE RESTRICT,
  order_id TEXT REFERENCES oms_order(id) ON DELETE SET NULL,
  sub_order_id TEXT REFERENCES oms_sub_order(id) ON DELETE SET NULL,
  package_actual_id TEXT REFERENCES oms_order_package_actual(id) ON DELETE SET NULL,
  stock_status TEXT NOT NULL CHECK(stock_status IN ('IN_STOCK', 'ALLOCATED', 'PACKED', 'OUTBOUND', 'RETURNED', 'DAMAGED')),
  pieces INTEGER NOT NULL DEFAULT 0,
  gross_weight_kg REAL NOT NULL DEFAULT 0,
  volume_cbm REAL NOT NULL DEFAULT 0,
  location_code TEXT,
  last_txn_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wms_stock_wh_status ON wms_stock(warehouse_id, stock_status);
CREATE INDEX IF NOT EXISTS idx_wms_stock_sub ON wms_stock(sub_order_id);

CREATE TABLE IF NOT EXISTS wms_stock_txn (
  id TEXT PRIMARY KEY,
  stock_id TEXT NOT NULL REFERENCES wms_stock(id) ON DELETE CASCADE,
  txn_type TEXT NOT NULL CHECK(txn_type IN ('INBOUND', 'ALLOCATE', 'PACK', 'OUTBOUND', 'TRANSFER_OUT', 'TRANSFER_IN', 'RETURN', 'ADJUST')),
  qty_delta INTEGER NOT NULL,
  weight_delta REAL NOT NULL DEFAULT 0,
  from_location TEXT,
  to_location TEXT,
  ref_type TEXT CHECK(ref_type IN ('INBOUND', 'JOB', 'UNIT', 'TRANSFER', 'DPN', 'MANUAL')),
  ref_id TEXT,
  operator_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  txn_time TEXT NOT NULL,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wms_stock_txn_stock ON wms_stock_txn(stock_id, txn_time);

-- ==================== 5) TMS ====================

CREATE TABLE IF NOT EXISTS tms_shipping_unit (
  id TEXT PRIMARY KEY,
  unit_no TEXT NOT NULL UNIQUE,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  unit_type TEXT NOT NULL CHECK(unit_type IN ('CONTAINER', 'PALLET', 'CARTON', 'BULK')),
  container_type TEXT CHECK(container_type IN ('LCL', '20GP', '40GP', '40HQ', '45HQ', 'AIR_PALLET', 'AIR_BULK')),
  seal_no TEXT,
  warehouse_id TEXT REFERENCES md_warehouse(id) ON DELETE SET NULL,
  job_id TEXT,
  unit_status TEXT NOT NULL CHECK(unit_status IN ('EMPTY', 'LOADING', 'SEALED', 'SHIPPED', 'ARRIVED', 'UNLOADED')),
  max_weight_kg REAL,
  max_volume_cbm REAL,
  current_weight_kg REAL NOT NULL DEFAULT 0,
  current_volume_cbm REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tms_unit_job ON tms_shipping_unit(job_id);

CREATE TABLE IF NOT EXISTS tms_job (
  id TEXT PRIMARY KEY,
  job_no TEXT NOT NULL UNIQUE,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  pol_site_id TEXT REFERENCES md_site(id) ON DELETE SET NULL,
  pod_site_id TEXT REFERENCES md_site(id) ON DELETE SET NULL,
  carrier_supplier_id TEXT REFERENCES md_supplier(id) ON DELETE SET NULL,
  vessel_voyage TEXT,
  flight_no TEXT,
  bill_no TEXT,
  current_phase TEXT NOT NULL CHECK(current_phase IN ('ORIGIN', 'LINE_HAUL', 'DESTINATION')),
  job_status TEXT NOT NULL CHECK(job_status IN ('PLANNED', 'IN_PROGRESS', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'CLEARED', 'COMPLETED', 'CANCELLED')),
  etd TEXT,
  eta TEXT,
  atd TEXT,
  ata TEXT,
  remark TEXT,
  created_by TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tms_job_line_status ON tms_job(business_line, job_status);

CREATE TABLE IF NOT EXISTS tms_job_order_rel (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES tms_job(id) ON DELETE CASCADE,
  sub_order_id TEXT NOT NULL REFERENCES oms_sub_order(id) ON DELETE CASCADE,
  shipping_unit_id TEXT REFERENCES tms_shipping_unit(id) ON DELETE SET NULL,
  sequence_no INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, sub_order_id)
);
CREATE INDEX IF NOT EXISTS idx_tms_job_rel_sub ON tms_job_order_rel(sub_order_id);
CREATE INDEX IF NOT EXISTS idx_tms_job_rel_unit ON tms_job_order_rel(shipping_unit_id);

CREATE TABLE IF NOT EXISTS tms_tracking_event (
  id TEXT PRIMARY KEY,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  event_scope TEXT NOT NULL CHECK(event_scope IN ('ORDER', 'SUB_ORDER', 'JOB', 'DPN')),
  order_id TEXT REFERENCES oms_order(id) ON DELETE SET NULL,
  sub_order_id TEXT REFERENCES oms_sub_order(id) ON DELETE SET NULL,
  job_id TEXT REFERENCES tms_job(id) ON DELETE SET NULL,
  dpn_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN ('EXPORT', 'IMPORT', 'WAREHOUSE', 'CUSTOMS', 'DELIVERY', 'NOTICE', 'EXCEPTION')),
  node_code TEXT,
  node_name TEXT,
  status_code TEXT NOT NULL,
  event_time TEXT NOT NULL,
  location TEXT,
  operator_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  remark TEXT,
  extra_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tms_event_order_time ON tms_tracking_event(order_id, event_time);
CREATE INDEX IF NOT EXISTS idx_tms_event_sub_time ON tms_tracking_event(sub_order_id, event_time);
CREATE INDEX IF NOT EXISTS idx_tms_event_job_time ON tms_tracking_event(job_id, event_time);

-- ==================== 6) POD / Delivery ====================

CREATE TABLE IF NOT EXISTS pod_dpn (
  id TEXT PRIMARY KEY,
  dpn_no TEXT NOT NULL UNIQUE,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  warehouse_id TEXT NOT NULL REFERENCES md_warehouse(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES crm_customer(id) ON DELETE RESTRICT,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  country_id TEXT REFERENCES md_country(id) ON DELETE SET NULL,
  city_id TEXT REFERENCES md_city(id) ON DELETE SET NULL,
  delivery_method TEXT NOT NULL CHECK(delivery_method IN ('SELF_PICKUP', 'DELIVERY', 'SATELLITE_STATION')),
  carrier_supplier_id TEXT REFERENCES md_supplier(id) ON DELETE SET NULL,
  dpn_status TEXT NOT NULL CHECK(dpn_status IN ('DRAFT', 'PENDING_ASSIGN', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'SIGNED', 'CANCELLED')),
  status_updated_at TEXT NOT NULL,
  total_pieces INTEGER NOT NULL DEFAULT 0,
  total_weight_kg REAL NOT NULL DEFAULT 0,
  total_receivable_amount REAL NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL REFERENCES fx_currency(code) ON DELETE RESTRICT,
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
  remark TEXT,
  created_by TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pod_dpn_status ON pod_dpn(dpn_status);
CREATE INDEX IF NOT EXISTS idx_pod_dpn_customer ON pod_dpn(customer_id);

CREATE TABLE IF NOT EXISTS pod_dpn_item (
  id TEXT PRIMARY KEY,
  dpn_id TEXT NOT NULL REFERENCES pod_dpn(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES oms_order(id) ON DELETE SET NULL,
  sub_order_id TEXT REFERENCES oms_sub_order(id) ON DELETE SET NULL,
  stock_id TEXT REFERENCES wms_stock(id) ON DELETE SET NULL,
  pieces INTEGER NOT NULL DEFAULT 0,
  weight_kg REAL NOT NULL DEFAULT 0,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pod_dpn_item_dpn ON pod_dpn_item(dpn_id);
CREATE INDEX IF NOT EXISTS idx_pod_dpn_item_sub ON pod_dpn_item(sub_order_id);

CREATE TABLE IF NOT EXISTS pod_delivery_task (
  id TEXT PRIMARY KEY,
  dpn_id TEXT NOT NULL REFERENCES pod_dpn(id) ON DELETE CASCADE,
  task_no TEXT NOT NULL UNIQUE,
  driver_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  driver_name TEXT,
  driver_phone TEXT,
  task_status TEXT NOT NULL CHECK(task_status IN ('PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'SIGNED', 'FAILED', 'CANCELLED')),
  accepted_at TEXT,
  outbound_at TEXT,
  delivered_at TEXT,
  signed_at TEXT,
  sign_proof_json TEXT,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pod_delivery_dpn ON pod_delivery_task(dpn_id);
CREATE INDEX IF NOT EXISTS idx_pod_delivery_status ON pod_delivery_task(task_status);

-- ==================== 7) Finance ====================

CREATE TABLE IF NOT EXISTS fin_fee (
  id TEXT PRIMARY KEY,
  fee_no TEXT NOT NULL UNIQUE,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  fee_level TEXT NOT NULL CHECK(fee_level IN ('ORDER', 'SUB_ORDER', 'JOB', 'DPN', 'TRANSFER', 'PETTY_CASH', 'PURCHASE', 'CLAIM')),
  related_id TEXT NOT NULL,
  related_no TEXT,
  fee_item_code TEXT NOT NULL REFERENCES md_fee_item(code) ON DELETE RESTRICT,
  fee_direction TEXT NOT NULL CHECK(fee_direction IN ('RECEIVABLE', 'PAYABLE')),
  unit_price REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL REFERENCES fx_currency(code) ON DELETE RESTRICT,
  fx_rate_to_cny REAL,
  counterparty_type TEXT CHECK(counterparty_type IN ('CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'PLATFORM')),
  counterparty_id TEXT,
  counterparty_name TEXT,
  fee_status TEXT NOT NULL CHECK(fee_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PARTIAL_PAID', 'PAID', 'CANCELLED')),
  description TEXT,
  voucher_url TEXT,
  created_by TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_fee_related ON fin_fee(fee_level, related_id);
CREATE INDEX IF NOT EXISTS idx_fin_fee_status ON fin_fee(fee_status);
CREATE INDEX IF NOT EXISTS idx_fin_fee_direction ON fin_fee(fee_direction);

CREATE TABLE IF NOT EXISTS fin_payment (
  id TEXT PRIMARY KEY,
  payment_no TEXT NOT NULL UNIQUE,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  payment_type TEXT NOT NULL CHECK(payment_type IN ('OUTBOUND', 'INBOUND')),
  related_fee_id TEXT REFERENCES fin_fee(id) ON DELETE SET NULL,
  related_id TEXT,
  counterparty_type TEXT CHECK(counterparty_type IN ('CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'PLATFORM')),
  counterparty_id TEXT,
  counterparty_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL REFERENCES fx_currency(code) ON DELETE RESTRICT,
  fx_rate REAL,
  payment_method TEXT CHECK(payment_method IN ('BANK', 'CASH', 'WECHAT', 'ALIPAY', 'CARD', 'OTHER')),
  payment_channel TEXT,
  payment_account TEXT,
  voucher_url TEXT,
  payment_status TEXT NOT NULL CHECK(payment_status IN ('INIT', 'CONFIRMED', 'VOID')),
  payment_time TEXT,
  confirmed_by TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  confirmed_at TEXT,
  remark TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fin_payment_fee ON fin_payment(related_fee_id);
CREATE INDEX IF NOT EXISTS idx_fin_payment_status ON fin_payment(payment_status);

-- ==================== 8) Workflow ====================

CREATE TABLE IF NOT EXISTS wf_instance (
  id TEXT PRIMARY KEY,
  process_code TEXT NOT NULL,
  business_line TEXT NOT NULL CHECK(business_line IN ('SEA', 'AIR')),
  business_type TEXT NOT NULL CHECK(business_type IN ('FEE', 'RECEIVABLE_CHANGE', 'PETTY_CASH', 'PURCHASE', 'CLAIM', 'RETURN_ORDER')),
  business_id TEXT NOT NULL,
  instance_status TEXT NOT NULL CHECK(instance_status IN ('RUNNING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  current_node_code TEXT,
  initiator_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wf_instance_business ON wf_instance(business_type, business_id);
CREATE INDEX IF NOT EXISTS idx_wf_instance_status ON wf_instance(instance_status);

CREATE TABLE IF NOT EXISTS wf_task (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES wf_instance(id) ON DELETE CASCADE,
  node_code TEXT NOT NULL,
  node_name TEXT NOT NULL,
  assignee_user_id TEXT REFERENCES sys_user(id) ON DELETE SET NULL,
  task_status TEXT NOT NULL CHECK(task_status IN ('PENDING', 'APPROVED', 'REJECTED', 'TRANSFERRED', 'CANCELLED')),
  action TEXT CHECK(action IN ('SUBMIT', 'APPROVE', 'REJECT', 'TRANSFER', 'CANCEL')),
  action_comment TEXT,
  action_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wf_task_instance ON wf_task(instance_id);
CREATE INDEX IF NOT EXISTS idx_wf_task_assignee ON wf_task(assignee_user_id, task_status);

-- =========================================================
-- End of V2 MVP Schema
-- =========================================================
