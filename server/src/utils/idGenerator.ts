import { getDb } from '../database/connection';

const counters: Record<string, number> = {};

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
  return `${prefix}-${dateStr}-${String(counters[key]).padStart(3, '0')}`;
}

export function generateSubOrderId(transportType: string): string {
  const db = getDb();
  const prefix = String(transportType || '').toUpperCase() === 'AIR' ? 'A' : 'S';
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const likePattern = `${prefix}-${day}%`;
  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(id, 11, 6) AS INTEGER)) AS maxSeq
    FROM sub_orders
    WHERE id LIKE ?
  `).get(likePattern) as any;
  const nextSeq = Number(row?.maxSeq || 0) + 1;
  return `${prefix}-${day}${String(nextSeq).padStart(6, '0')}`;
}

export function generateSimpleId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
