import type Database from 'better-sqlite3';
import { uuid, generateFeeNo } from '../utils/idGenerator';

// ============================================================
// Fee Repo — 财务费用 / 收付款
//
// 同时兼容两种调用形状:
//   1. Seed/内部: feeItemCode / feeLevel / counterpartyName (业务语义)
//   2. UI 前端: feeType / relatedType / supplierName / customerName (UI 语义)
// ============================================================

type BusinessLine = 'SEA' | 'AIR';
type FeeDirection = 'RECEIVABLE' | 'PAYABLE';
type FeeLevel = 'ORDER' | 'SUB_ORDER' | 'JOB' | 'DPN' | 'TRANSFER';
type FeeStatusBackend =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'CANCELLED';
type FeeStatusUi = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';
type RelatedTypeUi = 'ORDER' | 'UNIT' | 'JOB' | 'TRANSFER' | 'DPN';

// UI → 后端状态
const UI_STATUS_TO_BACKEND: Record<FeeStatusUi, FeeStatusBackend> = {
  PENDING: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
};

// 后端 → UI 状态
const BACKEND_STATUS_TO_UI: Record<FeeStatusBackend, FeeStatusUi> = {
  DRAFT: 'PENDING',
  PENDING_APPROVAL: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
};

// UI relatedType → 后端 fee_level (fee_level 表有 CHECK 约束,UNIT 退回 JOB)
const UI_RELATED_TO_FEE_LEVEL: Record<RelatedTypeUi, FeeLevel> = {
  ORDER: 'ORDER',
  UNIT: 'JOB',
  JOB: 'JOB',
  TRANSFER: 'TRANSFER',
  DPN: 'DPN',
};

// 后端 fee_item_code → UI feeType (UI 粒度更粗)
const BACKEND_ITEM_TO_UI_TYPE: Record<string, string> = {
  FREIGHT: 'FREIGHT',
  OCEAN_FREIGHT: 'FREIGHT',
  AIR_FREIGHT: 'FREIGHT',
  TRUCKING: 'FREIGHT',
  FIRST_WEIGHT: 'FREIGHT',
  CONTINUATION_WEIGHT: 'FREIGHT',
  FREIGHT_DISCOUNT: 'FREIGHT',
  FUEL_SURCHARGE: 'FREIGHT',
  CUSTOMS_EXPORT: 'CUSTOMS',
  CUSTOMS_IMPORT: 'CUSTOMS',
  CLEARANCE: 'CUSTOMS',
  WAREHOUSING: 'WAREHOUSE',
  LAST_MILE: 'DELIVERY',
  INSURANCE: 'INSURANCE',
  HANDLING: 'HANDLING',
  DOC_FEE: 'HANDLING',
};

function normalizeFeeTypeForUi(feeItemCode?: string | null, storedUi?: string | null): string {
  if (storedUi) return storedUi;
  if (!feeItemCode) return 'OTHER';
  return BACKEND_ITEM_TO_UI_TYPE[feeItemCode] || 'OTHER';
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// ============================================================
// Seed 路径: 业务语义 payload
// ============================================================

export interface RecordFeePayload {
  id?: string;
  feeNo?: string;
  businessLine?: BusinessLine;
  feeLevel?: FeeLevel;
  relatedId: string;
  relatedNo?: string;
  feeItemCode: string;
  feeDirection: FeeDirection;
  unitPrice?: number;
  quantity?: number;
  amount: number;
  currencyCode?: string;
  fxRate?: number;
  counterpartyName?: string;
  feeStatus?: FeeStatusBackend;
  description?: string;
  createdBy?: string;
  createdAt?: string;
}

export function recordFee(
  db: Database.Database,
  payload: RecordFeePayload
): { id: string; feeNo: string } {
  const id = payload.id || uuid();
  const feeNo = payload.feeNo || generateFeeNo(payload.businessLine || 'SEA');
  const createdAt = payload.createdAt || nowStr();
  const direction = payload.feeDirection;
  const counterparty = payload.counterpartyName || null;

  db.prepare(
    `INSERT INTO fin_fee (
      id, fee_no, business_line, fee_level, related_id, related_no,
      fee_item_code, fee_direction,
      unit_price, quantity, amount, currency_code, fx_rate,
      counterparty_name, fee_status, description, created_by, created_at, updated_at,
      related_type, fee_type_ui, supplier_name, customer_name, amount_cny
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    feeNo,
    payload.businessLine || 'SEA',
    payload.feeLevel || 'ORDER',
    payload.relatedId,
    payload.relatedNo || null,
    payload.feeItemCode,
    direction,
    payload.unitPrice || 0,
    payload.quantity || 1,
    payload.amount,
    payload.currencyCode || 'CNY',
    payload.fxRate || 1,
    counterparty,
    payload.feeStatus || 'DRAFT',
    payload.description || null,
    payload.createdBy || null,
    createdAt,
    createdAt,
    // UI 冗余列
    payload.feeLevel === 'JOB' ? 'JOB' : payload.feeLevel || 'ORDER',
    BACKEND_ITEM_TO_UI_TYPE[payload.feeItemCode] || 'OTHER',
    direction === 'PAYABLE' ? counterparty : null,
    direction === 'RECEIVABLE' ? counterparty : null,
    payload.amount * (payload.fxRate || 1)
  );

  return { id, feeNo };
}

// ============================================================
// UI 路径: 前端 FeeRecord 语义 payload
// ============================================================

export interface UiFeeCreatePayload {
  relatedType: RelatedTypeUi;
  relatedId: string;
  relatedNo: string;
  feeType: string;
  feeDirection: FeeDirection;
  amount: number;
  currency?: string;
  exchangeRate?: number;
  supplierName?: string | null;
  customerName?: string | null;
  description?: string;
  remark?: string;
  invoiceNo?: string;
  createdBy?: string;
  businessLine?: BusinessLine;
}

export function createUiFee(
  db: Database.Database,
  payload: UiFeeCreatePayload
): { id: string; feeNo: string } {
  const id = uuid();
  const feeNo = generateFeeNo(payload.businessLine || 'SEA');
  const createdAt = nowStr();
  const fxRate = payload.exchangeRate || 1;
  const amount = Number(payload.amount) || 0;
  const counterparty = payload.feeDirection === 'PAYABLE'
    ? payload.supplierName || null
    : payload.customerName || null;

  db.prepare(
    `INSERT INTO fin_fee (
      id, fee_no, business_line, fee_level, related_id, related_no,
      fee_item_code, fee_direction,
      unit_price, quantity, amount, currency_code, fx_rate,
      counterparty_name, fee_status, description, created_by, created_at, updated_at,
      related_type, fee_type_ui, supplier_name, customer_name, invoice_no, remark, amount_cny
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    feeNo,
    payload.businessLine || 'SEA',
    UI_RELATED_TO_FEE_LEVEL[payload.relatedType] || 'ORDER',
    payload.relatedId,
    payload.relatedNo,
    payload.feeType,
    payload.feeDirection,
    0,
    1,
    amount,
    payload.currency || 'CNY',
    fxRate,
    counterparty,
    'PENDING_APPROVAL',
    payload.description || null,
    payload.createdBy || null,
    createdAt,
    createdAt,
    payload.relatedType,
    payload.feeType,
    payload.feeDirection === 'PAYABLE' ? payload.supplierName || null : null,
    payload.feeDirection === 'RECEIVABLE' ? payload.customerName || null : null,
    payload.invoiceNo || null,
    payload.remark || null,
    amount * fxRate
  );

  return { id, feeNo };
}

export function updateUiFee(
  db: Database.Database,
  id: string,
  payload: Partial<UiFeeCreatePayload>
): { id: string } | null {
  const existing = db.prepare('SELECT * FROM fin_fee WHERE id = ?').get(id) as any;
  if (!existing) return null;
  if (existing.fee_status === 'PAID' || existing.fee_status === 'CANCELLED') {
    throw new Error('已支付或已取消的费用不可编辑');
  }

  const direction = (payload.feeDirection || existing.fee_direction) as FeeDirection;
  const amount = payload.amount !== undefined ? Number(payload.amount) : Number(existing.amount);
  const fxRate = payload.exchangeRate !== undefined ? payload.exchangeRate : Number(existing.fx_rate || 1);
  const supplierName = payload.supplierName !== undefined ? payload.supplierName : existing.supplier_name;
  const customerName = payload.customerName !== undefined ? payload.customerName : existing.customer_name;
  const counterparty = direction === 'PAYABLE' ? supplierName || null : customerName || null;

  db.prepare(
    `UPDATE fin_fee SET
      related_type = COALESCE(?, related_type),
      fee_level = COALESCE(?, fee_level),
      related_id = COALESCE(?, related_id),
      related_no = COALESCE(?, related_no),
      fee_item_code = COALESCE(?, fee_item_code),
      fee_type_ui = COALESCE(?, fee_type_ui),
      fee_direction = ?,
      amount = ?,
      currency_code = COALESCE(?, currency_code),
      fx_rate = ?,
      amount_cny = ?,
      supplier_name = ?,
      customer_name = ?,
      counterparty_name = ?,
      description = COALESCE(?, description),
      remark = COALESCE(?, remark),
      invoice_no = COALESCE(?, invoice_no),
      updated_at = ?
    WHERE id = ?`
  ).run(
    payload.relatedType || null,
    payload.relatedType ? UI_RELATED_TO_FEE_LEVEL[payload.relatedType] : null,
    payload.relatedId || null,
    payload.relatedNo || null,
    payload.feeType || null,
    payload.feeType || null,
    direction,
    amount,
    payload.currency || null,
    fxRate,
    amount * fxRate,
    direction === 'PAYABLE' ? supplierName || null : null,
    direction === 'RECEIVABLE' ? customerName || null : null,
    counterparty,
    payload.description || null,
    payload.remark || null,
    payload.invoiceNo || null,
    nowStr(),
    id
  );
  return { id };
}

export function approveFee(
  db: Database.Database,
  id: string,
  approver?: string
): { id: string } | null {
  const row = db.prepare('SELECT id, fee_status FROM fin_fee WHERE id = ?').get(id) as any;
  if (!row) return null;
  db.prepare(
    `UPDATE fin_fee SET
      fee_status = 'APPROVED',
      approver_name = ?,
      approved_at = ?,
      reject_reason = NULL,
      updated_at = ?
    WHERE id = ?`
  ).run(approver || null, nowStr(), nowStr(), id);
  return { id };
}

export function rejectFee(
  db: Database.Database,
  id: string,
  approver?: string,
  reason?: string
): { id: string } | null {
  const row = db.prepare('SELECT id FROM fin_fee WHERE id = ?').get(id) as any;
  if (!row) return null;
  db.prepare(
    `UPDATE fin_fee SET
      fee_status = 'REJECTED',
      approver_name = ?,
      approved_at = ?,
      reject_reason = ?,
      updated_at = ?
    WHERE id = ?`
  ).run(approver || null, nowStr(), reason || null, nowStr(), id);
  return { id };
}

export function payFee(
  db: Database.Database,
  id: string,
  opts?: { paymentMethod?: string; paymentTime?: string; remark?: string }
): { id: string; paymentId: string; paymentNo: string } | null {
  const row = db.prepare('SELECT * FROM fin_fee WHERE id = ?').get(id) as any;
  if (!row) return null;
  const paidAt = opts?.paymentTime || nowStr();
  db.prepare(
    `UPDATE fin_fee SET
      fee_status = 'PAID',
      payment_method = ?,
      paid_at = ?,
      updated_at = ?
    WHERE id = ?`
  ).run(opts?.paymentMethod || null, paidAt, nowStr(), id);

  const pay = recordPayment(db, {
    relatedFeeId: id,
    paymentType: row.fee_direction === 'RECEIVABLE' ? 'INBOUND' : 'OUTBOUND',
    amount: Number(row.amount),
    currencyCode: row.currency_code || 'CNY',
    paymentMethod: opts?.paymentMethod,
    paymentTime: paidAt,
    remark: opts?.remark,
    createdAt: paidAt,
  });

  return { id, paymentId: pay.id, paymentNo: pay.paymentNo };
}

export function cancelFee(
  db: Database.Database,
  id: string,
  reason?: string
): { id: string } | null {
  const row = db.prepare('SELECT id FROM fin_fee WHERE id = ?').get(id) as any;
  if (!row) return null;
  db.prepare(
    `UPDATE fin_fee SET
      fee_status = 'CANCELLED',
      cancel_reason = ?,
      updated_at = ?
    WHERE id = ?`
  ).run(reason || null, nowStr(), id);
  return { id };
}

// ============================================================
// 一键获取默认费用 (bootstrap)
//   扫描已有 order/unit/job, 给尚未登记过的对象生成一条默认 FREIGHT 记录
// ============================================================

export interface BootstrapResult {
  ORDER: { created: number; skipped: number };
  UNIT: { created: number; skipped: number };
  JOB: { created: number; skipped: number };
}

export function bootstrapFees(
  db: Database.Database,
  types: Array<'ORDER' | 'UNIT' | 'JOB'>,
  createdBy?: string
): BootstrapResult {
  const result: BootstrapResult = {
    ORDER: { created: 0, skipped: 0 },
    UNIT: { created: 0, skipped: 0 },
    JOB: { created: 0, skipped: 0 },
  };

  if (types.includes('ORDER')) {
    const orders = db.prepare(
      `SELECT id, order_no, customer_name, business_line
       FROM oms_order WHERE order_status NOT IN ('CANCELLED')`
    ).all() as any[];
    for (const o of orders) {
      const has = db.prepare(
        "SELECT 1 FROM fin_fee WHERE related_id = ? AND COALESCE(related_type, fee_level) = 'ORDER' LIMIT 1"
      ).get(o.id);
      if (has) {
        result.ORDER.skipped++;
        continue;
      }
      createUiFee(db, {
        relatedType: 'ORDER',
        relatedId: o.id,
        relatedNo: o.order_no,
        feeType: 'FREIGHT',
        feeDirection: 'RECEIVABLE',
        amount: 0,
        currency: 'CNY',
        customerName: o.customer_name,
        description: '自动获取 - 运费',
        createdBy,
        businessLine: (o.business_line as BusinessLine) || 'SEA',
      });
      result.ORDER.created++;
    }
  }

  if (types.includes('UNIT')) {
    const units = db.prepare(
      `SELECT u.id, u.unit_no, j.business_line
       FROM tms_shipping_unit u
       LEFT JOIN tms_job j ON j.id = u.job_id`
    ).all() as any[];
    for (const u of units) {
      const has = db.prepare(
        "SELECT 1 FROM fin_fee WHERE related_id = ? AND related_type = 'UNIT' LIMIT 1"
      ).get(u.id);
      if (has) {
        result.UNIT.skipped++;
        continue;
      }
      createUiFee(db, {
        relatedType: 'UNIT',
        relatedId: u.id,
        relatedNo: u.unit_no,
        feeType: 'FREIGHT',
        feeDirection: 'PAYABLE',
        amount: 0,
        currency: 'CNY',
        description: '自动获取 - 集装单元运费',
        createdBy,
        businessLine: (u.business_line as BusinessLine) || 'SEA',
      });
      result.UNIT.created++;
    }
  }

  if (types.includes('JOB')) {
    const jobs = db.prepare(
      `SELECT id, job_no, business_line FROM tms_job
       WHERE job_status NOT IN ('CANCELLED')`
    ).all() as any[];
    for (const j of jobs) {
      const has = db.prepare(
        "SELECT 1 FROM fin_fee WHERE related_id = ? AND COALESCE(related_type, fee_level) = 'JOB' LIMIT 1"
      ).get(j.id);
      if (has) {
        result.JOB.skipped++;
        continue;
      }
      createUiFee(db, {
        relatedType: 'JOB',
        relatedId: j.id,
        relatedNo: j.job_no,
        feeType: 'FREIGHT',
        feeDirection: 'PAYABLE',
        amount: 0,
        currency: 'CNY',
        description: '自动获取 - 运输任务成本',
        createdBy,
        businessLine: (j.business_line as BusinessLine) || 'SEA',
      });
      result.JOB.created++;
    }
  }

  return result;
}

// ============================================================
// 查询: 把 fin_fee 行转成前端 FeeRecord 形状
// ============================================================

export interface UiFeeRecord {
  id: string;
  feeNo: string;
  relatedType: string;
  relatedId: string;
  relatedNo: string;
  feeType: string;
  feeDirection: FeeDirection;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountCNY: number;
  status: FeeStatusUi;
  supplierName: string | null;
  customerName: string | null;
  description: string | null;
  remark: string | null;
  invoiceNo: string | null;
  approver: string | null;
  approverName: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mapFeeRowToUi(row: any): UiFeeRecord {
  const backendStatus = (row.fee_status || 'DRAFT') as FeeStatusBackend;
  const relatedType = row.related_type || row.fee_level || 'ORDER';
  const feeType = normalizeFeeTypeForUi(row.fee_item_code, row.fee_type_ui);
  const direction = (row.fee_direction || 'RECEIVABLE') as FeeDirection;
  const fxRate = Number(row.fx_rate || 1);
  const amount = Number(row.amount || 0);
  return {
    id: row.id,
    feeNo: row.fee_no,
    relatedType,
    relatedId: row.related_id,
    relatedNo: row.related_no || row.related_id,
    feeType,
    feeDirection: direction,
    amount,
    currency: row.currency_code || 'CNY',
    exchangeRate: fxRate,
    amountCNY: row.amount_cny != null ? Number(row.amount_cny) : amount * fxRate,
    status: BACKEND_STATUS_TO_UI[backendStatus] || 'PENDING',
    supplierName: row.supplier_name || (direction === 'PAYABLE' ? row.counterparty_name : null),
    customerName: row.customer_name || (direction === 'RECEIVABLE' ? row.counterparty_name : null),
    description: row.description || null,
    remark: row.remark || null,
    invoiceNo: row.invoice_no || null,
    approver: row.approver_name || null,
    approverName: row.approver_name || null,
    approvedAt: row.approved_at || null,
    rejectReason: row.reject_reason || null,
    paidAt: row.paid_at || null,
    paymentMethod: row.payment_method || null,
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export function listUiFees(db: Database.Database): UiFeeRecord[] {
  const rows = db.prepare('SELECT * FROM fin_fee ORDER BY created_at DESC').all() as any[];
  return rows.map(mapFeeRowToUi);
}

export function getUiFee(db: Database.Database, id: string): UiFeeRecord | null {
  const row = db.prepare('SELECT * FROM fin_fee WHERE id = ? OR fee_no = ?').get(id, id) as any;
  return row ? mapFeeRowToUi(row) : null;
}

export function getFeeCoverage(db: Database.Database): { ORDER: number; UNIT: number; JOB: number } {
  const orderTotal = (db.prepare('SELECT COUNT(*) as c FROM oms_order').get() as any).c;
  const unitTotal = (db.prepare('SELECT COUNT(*) as c FROM tms_shipping_unit').get() as any).c;
  const jobTotal = (db.prepare('SELECT COUNT(*) as c FROM tms_job').get() as any).c;

  const orderWith = (db.prepare(
    "SELECT COUNT(DISTINCT related_id) as c FROM fin_fee WHERE COALESCE(related_type, fee_level) = 'ORDER'"
  ).get() as any).c;
  const unitWith = (db.prepare(
    "SELECT COUNT(DISTINCT related_id) as c FROM fin_fee WHERE related_type = 'UNIT'"
  ).get() as any).c;
  const jobWith = (db.prepare(
    `SELECT COUNT(DISTINCT related_id) as c FROM fin_fee
     WHERE (related_type = 'JOB' OR (related_type IS NULL AND fee_level = 'JOB'))`
  ).get() as any).c;

  const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 100) : 0);
  return {
    ORDER: pct(orderWith, orderTotal),
    UNIT: pct(unitWith, unitTotal),
    JOB: pct(jobWith, jobTotal),
  };
}

// ============================================================
// 付款记录
// ============================================================

export interface RecordPaymentPayload {
  id?: string;
  paymentNo?: string;
  relatedFeeId: string;
  paymentType?: 'INBOUND' | 'OUTBOUND';
  amount: number;
  currencyCode?: string;
  paymentMethod?: string;
  paymentStatus?: 'INIT' | 'CONFIRMED' | 'VOID';
  paymentTime?: string;
  remark?: string;
  createdAt?: string;
}

export function recordPayment(
  db: Database.Database,
  payload: RecordPaymentPayload
): { id: string; paymentNo: string } {
  const id = payload.id || uuid();
  const paymentNo =
    payload.paymentNo ||
    `PAY-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}-${id.slice(-4).toUpperCase()}`;
  const createdAt = payload.createdAt || nowStr();

  db.prepare(
    `INSERT INTO fin_payment (
      id, payment_no, related_fee_id, payment_type, amount, currency_code,
      payment_method, payment_status, payment_time, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    paymentNo,
    payload.relatedFeeId,
    payload.paymentType || 'INBOUND',
    payload.amount,
    payload.currencyCode || 'CNY',
    payload.paymentMethod || null,
    payload.paymentStatus || 'CONFIRMED',
    payload.paymentTime || createdAt,
    payload.remark || null,
    createdAt
  );

  // 把对应的 fee 标为 PAID
  if (payload.paymentStatus !== 'VOID') {
    db.prepare(
      "UPDATE fin_fee SET fee_status='PAID', paid_at=COALESCE(paid_at, ?), updated_at=? WHERE id=?"
    ).run(payload.paymentTime || createdAt, nowStr(), payload.relatedFeeId);
  }

  return { id, paymentNo };
}
