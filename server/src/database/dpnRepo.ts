import type Database from 'better-sqlite3';
import { uuid, generateDpnNo, generatePickupNo } from '../utils/idGenerator';

// ============================================================
// DPN Repo
// DELIVERY 类型: 主仓 → 客户(配送/自提)
// TRANSFER 类型: 主仓 → 卫星站(站点调拨)
// ============================================================

export interface CreateDeliveryDpnPayload {
  id?: string;
  dpnNo?: string;
  businessLine?: 'SEA' | 'AIR';
  warehouseId: string;
  fromSite: string;
  toSite: string;
  customerId?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientCountry?: string;
  recipientCity?: string;
  deliveryMethod?: 'DELIVERY' | 'SELF_PICKUP';
  status?: 'DRAFT' | 'PENDING_BIND' | 'PENDING_DISPATCH' | 'IN_TRANSIT' | 'ARRIVED' | 'INBOUND' | 'DELIVERED' | 'SIGNED';
  driverName?: string;
  driverPhone?: string;
  plateNo?: string;
  dispatchTime?: string;
  arrivalTime?: string;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
  // 直接绑定的子单
  subOrderIds: string[];
  // 配送任务（如果 deliveryMethod=DELIVERY）
  deliveryTasks?: Array<{
    taskNo?: string;
    subOrderNo?: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    paymentMethod?: string;
    codAmount?: number;
    codCurrency?: string;
    taskStatus?: 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'FAILED';
    signedBy?: string;
    signedAt?: string;
    failureReason?: string;
  }>;
  // 自提（如果 deliveryMethod=SELF_PICKUP）
  pickups?: Array<{
    pickupNo?: string;
    subOrderNo?: string;
    trackingNo?: string;
    recipientName: string;
    recipientPhone: string;
    pickupStation: string;
    pickupCode?: string;
    notifyStatus?: 'PENDING' | 'NOTIFIED' | 'PICKED_UP';
  }>;
}

export interface CreateTransferDpnPayload {
  id?: string;
  dpnNo?: string;
  businessLine?: 'SEA' | 'AIR';
  fromSite: string;
  toSite: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status?: 'DRAFT' | 'PENDING_BIND' | 'PENDING_DISPATCH' | 'IN_TRANSIT' | 'ARRIVED' | 'INBOUND';
  driverName?: string;
  driverPhone?: string;
  plateNo?: string;
  dispatchTime?: string;
  arrivalTime?: string;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
  subOrderIds: string[];
}

function bindItemsAndAggregate(
  db: Database.Database,
  dpnId: string,
  subOrderIds: string[]
): void {
  const insertItem = db.prepare(
    `INSERT INTO pod_dpn_item (
      id, dpn_id, order_id, sub_order_id, tracking_no, pieces, weight_kg, inbound_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  for (const subId of subOrderIds) {
    const sub = db
      .prepare(
        'SELECT id, order_id, pieces, actual_weight_kg FROM oms_sub_order WHERE id=?'
      )
      .get(subId) as any;
    if (!sub) continue;
    const pkg = db
      .prepare('SELECT tracking_no FROM oms_package_actual WHERE sub_order_id=? LIMIT 1')
      .get(subId) as any;
    insertItem.run(
      uuid(),
      dpnId,
      sub.order_id,
      sub.id,
      pkg?.tracking_no || null,
      sub.pieces || 1,
      sub.actual_weight_kg || 0,
      'PENDING'
    );
  }
  const agg = db
    .prepare(
      `SELECT COUNT(DISTINCT sub_order_id) AS orders, COALESCE(SUM(pieces),0) AS pieces, COALESCE(SUM(weight_kg),0) AS weight
       FROM pod_dpn_item WHERE dpn_id=?`
    )
    .get(dpnId) as { orders: number; pieces: number; weight: number };
  db.prepare(
    `UPDATE pod_dpn SET total_orders=?, total_pieces=?, total_weight_kg=?, updated_at=datetime('now') WHERE id=?`
  ).run(agg.orders, agg.pieces, agg.weight, dpnId);
}

export function createDeliveryDpn(
  db: Database.Database,
  payload: CreateDeliveryDpnPayload
): { id: string; dpnNo: string } {
  const id = payload.id || uuid();
  const dpnNo = payload.dpnNo || generateDpnNo();
  const createdAt = payload.createdAt || nowStr();

  db.prepare(
    `INSERT INTO pod_dpn (
      id, dpn_no, business_line, dpn_type,
      from_site, to_site, warehouse_id, customer_id,
      recipient_name, recipient_phone, recipient_address, recipient_country, recipient_city,
      delivery_method, dpn_status,
      total_orders, total_pieces, total_weight_kg,
      driver_name, driver_phone, plate_no, dispatch_time, arrival_time,
      remark, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, 'DELIVERY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    dpnNo,
    payload.businessLine || 'SEA',
    payload.fromSite,
    payload.toSite,
    payload.warehouseId,
    payload.customerId || null,
    payload.recipientName || null,
    payload.recipientPhone || null,
    payload.recipientAddress || null,
    payload.recipientCountry || null,
    payload.recipientCity || null,
    payload.deliveryMethod || 'DELIVERY',
    payload.status || 'PENDING_BIND',
    payload.driverName || null,
    payload.driverPhone || null,
    payload.plateNo || null,
    payload.dispatchTime || null,
    payload.arrivalTime || null,
    payload.remark || null,
    payload.createdBy || null,
    createdAt,
    createdAt
  );

  bindItemsAndAggregate(db, id, payload.subOrderIds);

  // 配送任务
  for (const dt of payload.deliveryTasks || []) {
    const taskId = uuid();
    db.prepare(
      `INSERT INTO pod_delivery_task (
        id, dpn_id, task_no, sub_order_no,
        recipient_name, recipient_phone, recipient_address,
        service_type, payment_method, payment_status,
        cod_amount, cod_currency, task_status,
        signed_by, signed_at, failure_reason,
        driver_name, driver_phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DELIVERY', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      taskId,
      id,
      dt.taskNo || `DT-${dpnNo}-${taskId.slice(-4)}`,
      dt.subOrderNo || null,
      dt.recipientName,
      dt.recipientPhone,
      dt.recipientAddress,
      dt.paymentMethod || null,
      dt.taskStatus === 'SIGNED' || dt.taskStatus === 'DELIVERED' ? 'PAID' : 'UNPAID',
      dt.codAmount || 0,
      dt.codCurrency || 'NGN',
      dt.taskStatus || 'PENDING',
      dt.signedBy || null,
      dt.signedAt || null,
      dt.failureReason || null,
      payload.driverName || null,
      payload.driverPhone || null,
      createdAt,
      createdAt
    );
    if (dt.taskStatus === 'SIGNED' || dt.taskStatus === 'DELIVERED') {
      // 同步子单为 DELIVERED
      db.prepare(
        `UPDATE oms_sub_order
         SET sub_status='DELIVERED', updated_at=?
         WHERE id IN (SELECT sub_order_id FROM pod_dpn_item WHERE dpn_id=?)`
      ).run(createdAt, id);
    }
  }

  // 自提
  for (const pk of payload.pickups || []) {
    db.prepare(
      `INSERT INTO pod_pickup (
        id, pickup_no, dpn_id, sub_order_no, tracking_no,
        recipient_name, recipient_phone, pickup_station, pickup_code,
        pieces, weight_kg, payment_status, notify_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'UNPAID', ?, ?, ?)`
    ).run(
      uuid(),
      pk.pickupNo || generatePickupNo(),
      id,
      pk.subOrderNo || null,
      pk.trackingNo || null,
      pk.recipientName,
      pk.recipientPhone,
      pk.pickupStation,
      pk.pickupCode || null,
      pk.notifyStatus || 'PENDING',
      createdAt,
      createdAt
    );
  }

  return { id, dpnNo };
}

export function createTransferDpn(
  db: Database.Database,
  payload: CreateTransferDpnPayload
): { id: string; dpnNo: string } {
  const id = payload.id || uuid();
  const dpnNo = payload.dpnNo || generateDpnNo();
  const createdAt = payload.createdAt || nowStr();

  db.prepare(
    `INSERT INTO pod_dpn (
      id, dpn_no, business_line, dpn_type,
      from_site, to_site, from_warehouse_id, to_warehouse_id, warehouse_id,
      delivery_method, dpn_status,
      total_orders, total_pieces, total_weight_kg,
      driver_name, driver_phone, plate_no, dispatch_time, arrival_time,
      remark, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, 'TRANSFER', ?, ?, ?, ?, ?, 'SATELLITE_STATION', ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    dpnNo,
    payload.businessLine || 'SEA',
    payload.fromSite,
    payload.toSite,
    payload.fromWarehouseId,
    payload.toWarehouseId,
    payload.fromWarehouseId,
    payload.status || 'PENDING_BIND',
    payload.driverName || null,
    payload.driverPhone || null,
    payload.plateNo || null,
    payload.dispatchTime || null,
    payload.arrivalTime || null,
    payload.remark || null,
    payload.createdBy || null,
    createdAt,
    createdAt
  );

  bindItemsAndAggregate(db, id, payload.subOrderIds);
  return { id, dpnNo };
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
