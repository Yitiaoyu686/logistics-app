import fs from 'fs';
import path from 'path';
import { getV2Db } from './connectionV2';

const CUSTOMER_CODE_REGEX = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{4}$/;
const CUSTOMER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SUB_ORDER_NO_REGEX = /^[AS]-\d{14}-\d{2}$/;
const ORDER_NO_REGEX = /^[AS]-\d{14}$/;

function resolveSchemaPath(): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'database', 'schema_v2_mvp.sql'),
    path.join(__dirname, 'schema_v2_mvp.sql'),
    path.join(process.cwd(), 'server', 'src', 'database', 'schema_v2_mvp.sql'),
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }

  throw new Error(`V2 schema file not found. tried: ${candidates.join(', ')}`);
}

function randomCustomerCode(): string {
  let value = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * CUSTOMER_CODE_ALPHABET.length);
    value += CUSTOMER_CODE_ALPHABET[idx];
  }
  return value;
}

function normalizeCustomerCodes(db: any): void {
  const rows = db.prepare('SELECT id, customer_code FROM crm_customer ORDER BY created_at ASC').all() as Array<{ id: string; customer_code: string }>;
  const used = new Set<string>();

  const pickUniqueCode = (): string => {
    for (let i = 0; i < 5000; i++) {
      const candidate = randomCustomerCode();
      if (!CUSTOMER_CODE_REGEX.test(candidate)) continue;
      if (used.has(candidate)) continue;
      const exists = db.prepare('SELECT id FROM crm_customer WHERE customer_code = ? LIMIT 1').get(candidate) as any;
      if (!exists) return candidate;
    }
    throw new Error('Failed to normalize customer_code to 4-char unique format');
  };

  const updateCode = db.prepare('UPDATE crm_customer SET customer_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  for (const row of rows) {
    const normalized = String(row.customer_code || '').trim().toUpperCase();
    const valid = CUSTOMER_CODE_REGEX.test(normalized) && !used.has(normalized);
    if (valid) {
      if (normalized !== row.customer_code) {
        updateCode.run(normalized, row.id);
      }
      used.add(normalized);
      continue;
    }

    const replacement = pickUniqueCode();
    updateCode.run(replacement, row.id);
    used.add(replacement);
  }
}

function normalizeSubOrderNos(db: any): void {
  const rows = db.prepare(`
    SELECT
      so.id,
      so.business_line,
      so.sub_order_no,
      so.created_at,
      so.order_id,
      so.line_no,
      o.order_no
    FROM oms_sub_order so
    LEFT JOIN oms_order o ON o.id = so.order_id
    ORDER BY datetime(so.created_at) ASC, so.id ASC
  `).all() as Array<{
    id: string;
    business_line: 'SEA' | 'AIR';
    sub_order_no: string;
    order_id?: string;
    line_no?: number | null;
    order_no?: string | null;
    created_at?: string;
  }>;

  if (!rows.length) return;

  const used = new Set<string>();
  const updateNo = db.prepare('UPDATE oms_sub_order SET sub_order_no = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const fallbackCounters = new Map<string, number>();

  const expectedPrefix = (line: 'SEA' | 'AIR') => (line === 'AIR' ? 'A' : 'S');
  const datePart = (raw?: string) => {
    const source = raw ? String(raw).slice(0, 10) : new Date().toISOString().slice(0, 10);
    return source.replace(/-/g, '');
  };
  const nextFallbackBase = (line: 'SEA' | 'AIR', createdAt?: string) => {
    const prefix = expectedPrefix(line);
    const day = datePart(createdAt);
    const key = `${prefix}-${day}`;
    const seq = (fallbackCounters.get(key) || 0) + 1;
    fallbackCounters.set(key, seq);
    return `${prefix}-${day}${String(seq).padStart(6, '0')}`;
  };

  // Canonical format: `${主单号}-${两位line_no}`.
  const tx = db.transaction(() => {
    rows.forEach((row) => {
      const prefix = expectedPrefix(row.business_line === 'AIR' ? 'AIR' : 'SEA');
      const parentNoRaw = String(row.order_no || '').trim().toUpperCase();
      const parentNo = ORDER_NO_REGEX.test(parentNoRaw) && parentNoRaw.startsWith(`${prefix}-`)
        ? parentNoRaw
        : nextFallbackBase(row.business_line === 'AIR' ? 'AIR' : 'SEA', row.created_at);
      let lineSeq = Number(row.line_no || 0);
      if (!Number.isFinite(lineSeq) || lineSeq <= 0) lineSeq = 1;

      let candidate = `${parentNo}-${String(lineSeq).padStart(2, '0')}`;
      while (used.has(candidate)) {
        lineSeq += 1;
        candidate = `${parentNo}-${String(lineSeq).padStart(2, '0')}`;
      }

      used.add(candidate);
      const current = String(row.sub_order_no || '').trim().toUpperCase();
      if (current !== candidate || !SUB_ORDER_NO_REGEX.test(current)) {
        updateNo.run(candidate, row.id);
      }
    });
  });

  tx();
}

function normalizeOrderNos(db: any): void {
  const rows = db.prepare(`
    SELECT id, business_line, order_no, display_order_no, created_at
    FROM oms_order
    ORDER BY datetime(created_at) ASC, id ASC
  `).all() as Array<{
    id: string;
    business_line: 'SEA' | 'AIR';
    order_no: string;
    display_order_no?: string | null;
    created_at?: string;
  }>;

  if (!rows.length) return;

  const used = new Set<string>();
  const counters = new Map<string, number>();
  const updateNo = db.prepare(`
    UPDATE oms_order
    SET order_no = ?, display_order_no = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const expectedPrefix = (line: 'SEA' | 'AIR') => (line === 'AIR' ? 'A' : 'S');
  const datePart = (raw?: string) => {
    const source = raw ? String(raw).slice(0, 10) : new Date().toISOString().slice(0, 10);
    return source.replace(/-/g, '');
  };

  rows.forEach((row) => {
    const code = String(row.order_no || '').trim().toUpperCase();
    const prefix = expectedPrefix(row.business_line === 'AIR' ? 'AIR' : 'SEA');
    if (!ORDER_NO_REGEX.test(code)) return;
    if (!code.startsWith(`${prefix}-`)) return;
    if (used.has(code)) return;
    used.add(code);
    const key = `${prefix}-${code.slice(2, 10)}`;
    const seq = Number(code.slice(10)) || 0;
    counters.set(key, Math.max(counters.get(key) || 0, seq));
  });

  const tx = db.transaction(() => {
    rows.forEach((row) => {
      const code = String(row.order_no || '').trim().toUpperCase();
      const prefix = expectedPrefix(row.business_line === 'AIR' ? 'AIR' : 'SEA');
      const day = datePart(row.created_at);
      const keep = ORDER_NO_REGEX.test(code) && code.startsWith(`${prefix}-`) && !used.has(`__DUP__${code}`);
      if (keep && used.has(code)) {
        used.delete(code);
        used.add(`__DUP__${code}`);
        if (row.display_order_no !== code) {
          updateNo.run(code, code, row.id);
        }
        return;
      }

      const key = `${prefix}-${day}`;
      let seq = counters.get(key) || 0;
      let candidate = '';
      do {
        seq += 1;
        candidate = `${prefix}-${day}${String(seq).padStart(6, '0')}`;
      } while (used.has(candidate) || used.has(`__DUP__${candidate}`));

      counters.set(key, seq);
      used.add(candidate);
      updateNo.run(candidate, candidate, row.id);
    });
  });

  tx();
}

export function createV2Tables(): void {
  const db = getV2Db();
  const schemaPath = resolveSchemaPath();
  const sql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(sql);

  // Lightweight migrations for evolving v2 schema during prototype stage.
  const ensureColumn = (table: string, column: string, definition: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (_) {
      // Column already exists
    }
  };

  ensureColumn('wf_instance', 'updated_at', 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP');

  // Return-flow fields for OMS order review/approval.
  ensureColumn('oms_order', 'previous_status', 'TEXT');
  ensureColumn('oms_order', 'return_type', 'TEXT');
  ensureColumn('oms_order', 'return_reason', 'TEXT');
  ensureColumn('oms_order', 'return_refund_amount', 'REAL');
  ensureColumn('oms_order', 'return_refund_method', 'TEXT');
  ensureColumn('oms_order', 'need_return', 'INTEGER CHECK(need_return IN (0, 1))');
  ensureColumn('oms_order', 'return_shipping_note', 'TEXT');
  ensureColumn('oms_order', 'return_applied_by', 'TEXT');
  ensureColumn('oms_order', 'return_applied_at', 'TEXT');
  ensureColumn('oms_order', 'return_approver', 'TEXT');
  ensureColumn('oms_order', 'return_approved_at', 'TEXT');
  ensureColumn('oms_order', 'return_reject_reason', 'TEXT');

  // CRM customer base profile fields for web prototype closure.
  ensureColumn('crm_customer', 'country', 'TEXT');
  ensureColumn('crm_customer', 'address', 'TEXT');
  ensureColumn('crm_customer', 'industry', 'TEXT');
  ensureColumn('crm_customer', 'contact_name', 'TEXT');
  ensureColumn('crm_customer', 'contact_phone', 'TEXT');
  ensureColumn('crm_customer', 'contact_email', 'TEXT');
  ensureColumn('crm_customer', 'company_type', 'TEXT');
  ensureColumn('crm_customer', 'credit_level', 'TEXT');
  ensureColumn('crm_customer', 'remark', 'TEXT');
  ensureColumn('crm_customer', 'enter_pool_time', 'TEXT');
  ensureColumn('crm_customer', 'enterprise_info', 'TEXT');

  // WMS unmatched-item fields (no-order inbound pool + recommendation/matching context).
  ensureColumn('wms_inbound_item', 'sender_name', 'TEXT');
  ensureColumn('wms_inbound_item', 'sender_phone', 'TEXT');
  ensureColumn('wms_inbound_item', 'consignee_name', 'TEXT');
  ensureColumn('wms_inbound_item', 'consignee_phone', 'TEXT');
  ensureColumn('wms_inbound_item', 'customer_hint', 'TEXT');
  ensureColumn('wms_inbound_item', 'matched_order_id', 'TEXT');
  ensureColumn('wms_inbound_item', 'matched_sub_order_id', 'TEXT');
  ensureColumn('wms_inbound_item', 'matched_at', 'TEXT');

  // CRM business-line profile extension.
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_crm_customer_line_profile_customer
      ON crm_customer_line_profile(customer_id);
    CREATE INDEX IF NOT EXISTS idx_crm_customer_line_profile_line
      ON crm_customer_line_profile(business_line);
  `);

  // WMS unmatched package pool.
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_wms_unmatched_status
      ON wms_unmatched_package(status, business_line, warehouse_id);
    CREATE INDEX IF NOT EXISTS idx_wms_unmatched_tracking
      ON wms_unmatched_package(tracking_no);
  `);

  // Customer code sequence for short unique code generation.
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_code_sequence (
      scope TEXT PRIMARY KEY,
      last_value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  // Public/private pool operation logs in v2.
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_customer_pool_log (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES crm_customer(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('CLAIM','RELEASE','TRANSFER','AUTO_RELEASE')),
      from_pool_type TEXT CHECK(from_pool_type IN ('PRIVATE','PUBLIC')),
      to_pool_type TEXT CHECK(to_pool_type IN ('PRIVATE','PUBLIC')),
      from_owner_user_id TEXT,
      to_owner_user_id TEXT,
      operator_id TEXT,
      operator_name TEXT,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_crm_customer_pool_log_customer
      ON crm_customer_pool_log(customer_id);
    CREATE INDEX IF NOT EXISTS idx_crm_customer_pool_log_time
      ON crm_customer_pool_log(created_at);
  `);

  // Normalize existing customer codes to unified 4-char letter+digit format.
  normalizeCustomerCodes(db);
  // Normalize main waybill number: SEA => S-YYYYMMDDNNNNNN, AIR => A-YYYYMMDDNNNNNN
  normalizeOrderNos(db);
  // Normalize sub waybill number: SEA => S-YYYYMMDDNNNNNN, AIR => A-YYYYMMDDNNNNNN
  normalizeSubOrderNos(db);
}
