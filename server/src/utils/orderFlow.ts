import type Database from 'better-sqlite3';
import { generateSimpleId } from './idGenerator';

export function deriveMasterStatusFromSubs(subStatuses: string[]): string {
  if (!subStatuses.length) return 'PENDING_INBOUND';
  if (subStatuses.includes('EXCEPTION')) return 'EXCEPTION';
  if (subStatuses.every((s) => s === 'DELIVERED')) return 'COMPLETED';
  if (subStatuses.includes('DELIVERED')) return 'PARTIAL_DELIVERED';
  if (subStatuses.every((s) => s === 'ARRIVED')) return 'ARRIVED';
  if (subStatuses.some((s) => ['IN_TRANSIT', 'CUSTOMS_CLEARANCE'].includes(s))) return 'IN_TRANSIT';
  if (subStatuses.every((s) => ['PENDING_DEPARTURE', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'ARRIVED', 'PENDING_DELIVERY', 'DELIVERING', 'DELIVERED'].includes(s))) {
    return 'DEPARTED';
  }
  if (subStatuses.includes('PENDING_DEPARTURE')) return 'PENDING_DEPARTURE';
  if (subStatuses.every((s) => ['INBOUND', 'PENDING_PACKING', 'PACKED', 'PENDING_DEPARTURE'].includes(s))) return 'INBOUND';
  return 'PENDING_INBOUND';
}

export function syncMasterOrderStatus(db: Database.Database, masterOrderId: string, now = new Date().toISOString()): string {
  const rows = db.prepare('SELECT status FROM sub_orders WHERE masterOrderId = ?').all(masterOrderId) as Array<{ status: string }>;
  const nextStatus = deriveMasterStatusFromSubs(rows.map((r) => r.status));
  db.prepare('UPDATE master_orders SET status = ?, updatedAt = ? WHERE id = ?').run(nextStatus, now, masterOrderId);
  return nextStatus;
}

export function syncMasterOrderStatusBySubOrderId(db: Database.Database, subOrderId: string, now = new Date().toISOString()): string | null {
  const sub = db.prepare('SELECT masterOrderId FROM sub_orders WHERE id = ?').get(subOrderId) as { masterOrderId?: string } | undefined;
  if (!sub?.masterOrderId) return null;
  return syncMasterOrderStatus(db, sub.masterOrderId, now);
}

export function logisticsStepFromSubStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING_INBOUND: '等待入库',
    INBOUND: '入库完成',
    PENDING_PACKING: '待装箱',
    PACKED: '装箱完成',
    PENDING_DEPARTURE: '等待发运',
    IN_TRANSIT: '运输中',
    CUSTOMS_CLEARANCE: '清关中',
    ARRIVED: '到达目的地',
    PENDING_DELIVERY: '待派送',
    DELIVERING: '派送中',
    DELIVERED: '已签收',
    EXCEPTION: '异常',
    CANCELLED: '已取消',
  };
  return map[status] || status;
}

interface AddLogParams {
  subOrderId: string;
  status: string;
  step?: string;
  operator?: string | null;
  location?: string | null;
  remark?: string | null;
  timestamp?: string;
}

export function addSubOrderLog(db: Database.Database, params: AddLogParams): void {
  const ts = params.timestamp || new Date().toISOString();
  db.prepare(`
    INSERT INTO logistics_records (id, subOrderId, step, status, operator, timestamp, location, remark, photos, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `LR-${generateSimpleId()}`,
    params.subOrderId,
    params.step || logisticsStepFromSubStatus(params.status),
    'completed',
    params.operator || null,
    ts,
    params.location || null,
    params.remark || null,
    null,
    ts
  );
}
