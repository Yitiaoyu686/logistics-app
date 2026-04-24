import { getDb } from '../database/schema';

const counters: Record<string, number> = {};
// Bootstrap counters from existing DB rows so restarts do not collide
const bootstrappedPrefixes = new Set<string>();
const COUNTER_SOURCES: Record<string, { table: string; column: string }> = {
  order: { table: 'oms_order', column: 'order_no' },
  job: { table: 'tms_job', column: 'job_no' },
  dpn: { table: 'pod_dpn', column: 'dpn_no' },
  transfer: { table: 'wms_transfer', column: 'transfer_no' },
  pickup: { table: 'pod_pickup', column: 'pickup_no' },
  inbound: { table: 'wms_inbound_order', column: 'inbound_no' },
  fee: { table: 'fin_fee', column: 'fee_no' },
};

function bootstrapCounter(prefix: string, digits: number = 5): void {
  if (bootstrappedPrefixes.has(prefix)) return;
  bootstrappedPrefixes.add(prefix);
  const src = COUNTER_SOURCES[prefix];
  if (!src) return;
  try {
    const rows = getDb().prepare(`SELECT ${src.column} AS v FROM ${src.table}`).all() as Array<{ v: string }>;
    const maxSeq = Math.pow(10, digits);
    let max = 0;
    for (const row of rows) {
      const m = row.v && row.v.match(/(\d+)$/);
      if (m) {
        // 只截取尾部 digits 位,防止历史脏数据(例如 28 位数字)溢出 Number
        const lastN = m[1].slice(-digits);
        const n = Number(lastN);
        if (Number.isFinite(n) && n > max && n < maxSeq) max = n;
      }
    }
    counters[prefix] = max;
  } catch {
    // table may not exist yet during first boot; ignore
  }
}

function nextSeq(prefix: string, digits: number = 5): string {
  bootstrapCounter(prefix, digits);
  const maxSeq = Math.pow(10, digits);
  let next = (counters[prefix] || 0) + 1;
  if (next >= maxSeq) next = 1;
  counters[prefix] = next;
  return String(next).padStart(digits, '0');
}

function dateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function generateOrderNo(businessLine: 'SEA' | 'AIR'): string {
  const prefix = businessLine === 'SEA' ? 'S' : 'A';
  return `${prefix}-${dateStr()}${nextSeq('order')}`;
}

export function generateSubOrderNo(masterOrderNo: string, lineNo: number): string {
  return `${masterOrderNo}-${String(lineNo).padStart(2, '0')}`;
}

export function generateJobNo(businessLine: 'SEA' | 'AIR'): string {
  const prefix = businessLine === 'SEA' ? 'S-JOB' : 'A-JOB';
  return `${prefix}${dateStr().substring(2)}${nextSeq('job')}`;
}

export function generateDpnNo(): string {
  return `DPN-${dateStr()}-${nextSeq('dpn', 4)}`;
}

export function generateTransferNo(businessLine: 'SEA' | 'AIR'): string {
  const prefix = businessLine === 'SEA' ? 'S-T' : 'A-T';
  return `${prefix}-${dateStr()}-${nextSeq('transfer', 4)}`;
}

export function generatePickupNo(): string {
  return `P-${dateStr()}-${nextSeq('pickup', 4)}`;
}

export function generateInboundNo(): string {
  return `IB-${dateStr()}-${nextSeq('inbound', 4)}`;
}

export function generateFeeNo(businessLine: 'SEA' | 'AIR'): string {
  const prefix = businessLine === 'SEA' ? 'F-S' : 'F-A';
  return `${prefix}-${dateStr()}-${nextSeq('fee', 4)}`;
}

export function uuid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
