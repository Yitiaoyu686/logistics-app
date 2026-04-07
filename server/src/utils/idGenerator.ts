import { getDb } from '../database/connection';

const counters: Record<string, number> = {};

/**
 * ID format rules:
 * - Order (master): S-YYYYMMDDNNNNN (sea) / A-YYYYMMDDNNNNN (air)
 * - Sub-order: S-YYYYMMDDNNNNN-NN / A-YYYYMMDDNNNNN-NN
 * - JOB: S-JOBYYMMNNNNN (sea) / A-JOBYYMMNNNNN (air)
 * - DPN: DPN-YYYYMMDD-NNNN
 * - Delivery: S-D-YYYYMMDD-NNNN / A-D-YYYYMMDD-NNNN
 * - Return: R-YYYYMMDD-NNNN
 * - Pickup: P-YYYYMMDD-NNNN
 * - Transfer: S-T-YYYYMMDD-NNNN / A-T-YYYYMMDD-NNNN
 * - Fee: F-YYYYMMDD-NNNN
 * - Petty cash: P-YYYYMMDD-NNNN
 */

/**
 * Generate a generic ID with format: PREFIX-YYYYMMDD-NNNN
 * Used for DPN, Return, Pickup, Fee, Petty cash, etc.
 */
export function generateId(prefix: string): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const key = `${prefix}-${dateStr}`;

  if (!counters[key]) {
    // Check DB for existing max sequence for today
    const db = getDb();
    const pattern = `${prefix}-${dateStr}-%`;
    const row = db.prepare(`
      SELECT id FROM (
        SELECT id FROM users WHERE id LIKE ?
        UNION SELECT id FROM clients WHERE id LIKE ?
        UNION SELECT id FROM master_orders WHERE id LIKE ?
        UNION SELECT id FROM sub_orders WHERE id LIKE ?
        UNION SELECT jobNo AS id FROM jobs WHERE jobNo LIKE ?
        UNION SELECT id FROM shipping_units WHERE id LIKE ?
        UNION SELECT id FROM fee_records WHERE id LIKE ?
        UNION SELECT id FROM express_packages WHERE id LIKE ?
        UNION SELECT id FROM order_items WHERE id LIKE ?
        UNION SELECT id FROM inbound_records WHERE id LIKE ?
        UNION SELECT id FROM stock_items WHERE id LIKE ?
        UNION SELECT id FROM transfer_orders WHERE id LIKE ?
        UNION SELECT transferNo AS id FROM transfer_orders WHERE transferNo LIKE ?
        UNION SELECT id FROM transfer_items WHERE id LIKE ?
        UNION SELECT id FROM return_records WHERE id LIKE ?
        UNION SELECT returnNo AS id FROM return_records WHERE returnNo LIKE ?
        UNION SELECT id FROM delivery_orders WHERE id LIKE ?
        UNION SELECT dpnNo AS id FROM delivery_orders WHERE dpnNo LIKE ?
        UNION SELECT id FROM delivery_order_items WHERE id LIKE ?
        UNION SELECT id FROM no_order_express WHERE id LIKE ?
        UNION SELECT id FROM logistics_records WHERE id LIKE ?
        UNION SELECT id FROM notifications WHERE id LIKE ?
      ) ORDER BY id DESC LIMIT 1
    `).get(
      pattern, // users.id
      pattern, // clients.id
      pattern, // master_orders.id
      pattern, // sub_orders.id
      pattern, // jobs.jobNo
      pattern, // shipping_units.id
      pattern, // fee_records.id
      pattern, // express_packages.id
      pattern, // order_items.id
      pattern, // inbound_records.id
      pattern, // stock_items.id
      pattern, // transfer_orders.id
      pattern, // transfer_orders.transferNo
      pattern, // transfer_items.id
      pattern, // return_records.id
      pattern, // return_records.returnNo
      pattern, // delivery_orders.id
      pattern, // delivery_orders.dpnNo
      pattern, // delivery_order_items.id
      pattern, // no_order_express.id
      pattern, // logistics_records.id
      pattern, // notifications.id
    ) as any;

    if (row) {
      const parts = row.id.split('-');
      counters[key] = parseInt(parts[parts.length - 1], 10);
    } else {
      counters[key] = 0;
    }
  }

  counters[key]++;
  return `${prefix}-${dateStr}-${String(counters[key]).padStart(4, '0')}`;
}

/**
 * Generate master order ID: S-YYYYMMDDNNNNN or A-YYYYMMDDNNNNN
 */
export function generateMasterOrderId(transportType: string): string {
  const db = getDb();
  const prefix = String(transportType || '').toUpperCase() === 'AIR' ? 'A' : 'S';
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const likePattern = `${prefix}-${day}%`;
  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(id, ${prefix.length + 1 + day.length + 1}, 5) AS INTEGER)) AS maxSeq
    FROM master_orders
    WHERE id LIKE ? AND id NOT LIKE '%-__'
  `).get(likePattern) as any;
  const nextSeq = Number(row?.maxSeq || 0) + 1;
  return `${prefix}-${day}${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Generate sub-order ID: S-YYYYMMDDNNNNN-NN or A-YYYYMMDDNNNNN-NN
 */
export function generateSubOrderId(transportType: string): string {
  const db = getDb();
  const prefix = String(transportType || '').toUpperCase() === 'AIR' ? 'A' : 'S';
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const likePattern = `${prefix}-${day}%`;
  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(id, ${prefix.length + 1 + day.length + 1}, 5) AS INTEGER)) AS maxSeq
    FROM sub_orders
    WHERE id LIKE ?
  `).get(likePattern) as any;
  const nextSeq = Number(row?.maxSeq || 0) + 1;
  return `${prefix}-${day}${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Generate JOB number: S-JOBYYMMNNNNN or A-JOBYYMMNNNNN
 */
export function generateJobNo(transportType: string): string {
  const db = getDb();
  const prefix = String(transportType || '').toUpperCase() === 'AIR' ? 'A' : 'S';
  const date = new Date();
  const yymm = String(date.getFullYear()).slice(2) + String(date.getMonth() + 1).padStart(2, '0');
  const likePattern = `${prefix}-JOB${yymm}%`;
  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(jobNo, ${prefix.length + 4 + yymm.length + 1}, 5) AS INTEGER)) AS maxSeq
    FROM jobs
    WHERE jobNo LIKE ?
  `).get(likePattern) as any;
  const nextSeq = Number(row?.maxSeq || 0) + 1;
  return `${prefix}-JOB${yymm}${String(nextSeq).padStart(5, '0')}`;
}

/**
 * Generate transfer number: S-T-YYYYMMDD-NNNN or A-T-YYYYMMDD-NNNN
 */
export function generateTransferNo(transportType: string): string {
  const db = getDb();
  const prefix = String(transportType || '').toUpperCase() === 'AIR' ? 'A' : 'S';
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const likePattern = `${prefix}-T-${day}-%`;
  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(transferNo, -4) AS INTEGER)) AS maxSeq
    FROM transfer_orders
    WHERE transferNo LIKE ?
  `).get(likePattern) as any;
  const nextSeq = Number(row?.maxSeq || 0) + 1;
  return `${prefix}-T-${day}-${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Generate fee number: F-YYYYMMDD-NNNN
 */
export function generateFeeNo(): string {
  return generateId('F');
}

/**
 * Generate DPN number: DPN-YYYYMMDD-NNNN
 */
export function generateDpnNo(): string {
  return generateId('DPN');
}

/**
 * Generate delivery task number: S-D-YYYYMMDD-NNNN or A-D-YYYYMMDD-NNNN
 */
export function generateDeliveryNo(transportType: string): string {
  const db = getDb();
  const prefix = String(transportType || '').toUpperCase() === 'AIR' ? 'A' : 'S';
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const likePattern = `${prefix}-D-${day}-%`;
  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(id, -4) AS INTEGER)) AS maxSeq
    FROM delivery_orders
    WHERE id LIKE ?
  `).get(likePattern) as any;
  const nextSeq = Number(row?.maxSeq || 0) + 1;
  return `${prefix}-D-${day}-${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Generate return number: R-YYYYMMDD-NNNN
 */
export function generateReturnNo(): string {
  return generateId('R');
}

/**
 * Generate pickup number: P-YYYYMMDD-NNNN
 */
export function generatePickupNo(): string {
  return generateId('P');
}

export function generateSimpleId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
