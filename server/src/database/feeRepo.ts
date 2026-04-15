import type Database from 'better-sqlite3';
import { uuid, generateFeeNo } from '../utils/idGenerator';

// ============================================================
// Fee Repo - 财务费用 / 收付款
// ============================================================

export interface RecordFeePayload {
  id?: string;
  feeNo?: string;
  businessLine?: 'SEA' | 'AIR';
  feeLevel?: 'ORDER' | 'SUB_ORDER' | 'JOB' | 'DPN' | 'TRANSFER';
  relatedId: string;
  relatedNo?: string;
  feeItemCode: string;
  feeDirection: 'RECEIVABLE' | 'PAYABLE';
  unitPrice?: number;
  quantity?: number;
  amount: number;
  currencyCode?: string;
  fxRate?: number;
  counterpartyName?: string;
  feeStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';
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

  db.prepare(
    `INSERT INTO fin_fee (
      id, fee_no, business_line, fee_level, related_id, related_no,
      fee_item_code, fee_direction,
      unit_price, quantity, amount, currency_code, fx_rate,
      counterparty_name, fee_status, description, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    feeNo,
    payload.businessLine || 'SEA',
    payload.feeLevel || 'ORDER',
    payload.relatedId,
    payload.relatedNo || null,
    payload.feeItemCode,
    payload.feeDirection,
    payload.unitPrice || 0,
    payload.quantity || 1,
    payload.amount,
    payload.currencyCode || 'CNY',
    payload.fxRate || 1,
    payload.counterpartyName || null,
    payload.feeStatus || 'DRAFT',
    payload.description || null,
    payload.createdBy || null,
    createdAt,
    createdAt
  );

  return { id, feeNo };
}

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
      "UPDATE fin_fee SET fee_status='PAID', updated_at=datetime('now') WHERE id=?"
    ).run(payload.relatedFeeId);
  }

  return { id, paymentNo };
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
