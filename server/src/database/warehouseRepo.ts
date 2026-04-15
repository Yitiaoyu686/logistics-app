import type Database from 'better-sqlite3';
import { uuid, generateInboundNo } from '../utils/idGenerator';

// ============================================================
// Warehouse Repo
// 起运仓快递入库 (createInbound)
// 到达仓任务入库 (createDestInbound)
// ============================================================

export interface CreateInboundPayload {
  id?: string;
  inboundNo?: string;
  businessLine: 'SEA' | 'AIR';
  warehouseId: string;
  orderId: string;
  subOrderId: string;
  trackingNo?: string;
  pieces?: number;
  grossWeightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  packageCondition?: 'GOOD' | 'DAMAGED' | 'WET' | 'OPENED' | 'INCOMPLETE';
  goodsCategory?: string;
  locationCode?: string;
  operatorUserId?: string;
  remark?: string;
  inboundAt?: string;
  // 演示用：自动晋升订单状态
  autoAdvanceOrder?: boolean;
}

export interface CreateInboundResult {
  inboundOrderId: string;
  inboundNo: string;
  inboundItemId: string;
  stockId: string;
}

export function createInbound(
  db: Database.Database,
  payload: CreateInboundPayload
): CreateInboundResult {
  const inboundOrderId = payload.id || uuid();
  const inboundNo = payload.inboundNo || generateInboundNo();
  const inboundAt = payload.inboundAt || nowStr();

  db.prepare(
    `INSERT INTO wms_inbound_order (
      id, inbound_no, business_line, warehouse_id,
      order_id, sub_order_id,
      source_type, inbound_status, inbound_at,
      operator_user_id, remark, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'THIRD_PARTY', 'COMPLETED', ?, ?, ?, ?, ?)`
  ).run(
    inboundOrderId,
    inboundNo,
    payload.businessLine,
    payload.warehouseId,
    payload.orderId,
    payload.subOrderId,
    inboundAt,
    payload.operatorUserId || null,
    payload.remark || null,
    inboundAt,
    inboundAt
  );

  const itemId = uuid();
  const volumeCbm =
    payload.lengthCm && payload.widthCm && payload.heightCm
      ? (payload.lengthCm * payload.widthCm * payload.heightCm) / 1_000_000
      : 0;

  db.prepare(
    `INSERT INTO wms_inbound_item (
      id, inbound_order_id, order_id, sub_order_id, tracking_no,
      pieces, gross_weight_kg, length_cm, width_cm, height_cm, volume_cbm,
      package_condition, location_code, goods_category, item_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`
  ).run(
    itemId,
    inboundOrderId,
    payload.orderId,
    payload.subOrderId,
    payload.trackingNo || null,
    payload.pieces || 1,
    payload.grossWeightKg || 0,
    payload.lengthCm || null,
    payload.widthCm || null,
    payload.heightCm || null,
    volumeCbm,
    payload.packageCondition || 'GOOD',
    payload.locationCode || null,
    payload.goodsCategory || null,
    inboundAt
  );

  // 实际包裹（oms_package_actual）
  db.prepare(
    `INSERT INTO oms_package_actual (
      id, order_id, sub_order_id, tracking_no, pieces,
      gross_weight_kg, length_cm, width_cm, height_cm, volume_cbm,
      package_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_STOCK', ?, ?)`
  ).run(
    uuid(),
    payload.orderId,
    payload.subOrderId,
    payload.trackingNo || null,
    payload.pieces || 1,
    payload.grossWeightKg || 0,
    payload.lengthCm || null,
    payload.widthCm || null,
    payload.heightCm || null,
    volumeCbm,
    inboundAt,
    inboundAt
  );

  // 库存
  const stockId = uuid();
  db.prepare(
    `INSERT INTO wms_stock (
      id, business_line, warehouse_id, order_id, sub_order_id,
      stock_status, pieces, gross_weight_kg, volume_cbm, location_code,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?, ?, ?, ?)`
  ).run(
    stockId,
    payload.businessLine,
    payload.warehouseId,
    payload.orderId,
    payload.subOrderId,
    payload.pieces || 1,
    payload.grossWeightKg || 0,
    volumeCbm,
    payload.locationCode || null,
    inboundAt,
    inboundAt
  );

  // 联动子单 / 主单
  db.prepare(
    `UPDATE oms_sub_order
     SET sub_status='INBOUND', actual_weight_kg=?, volume_cbm=?, updated_at=?
     WHERE id=?`
  ).run(payload.grossWeightKg || 0, volumeCbm, inboundAt, payload.subOrderId);

  if (payload.autoAdvanceOrder !== false) {
    const total = (db
      .prepare('SELECT COUNT(*) AS c FROM oms_sub_order WHERE order_id=?')
      .get(payload.orderId) as { c: number }).c;
    const inbound = (db
      .prepare(
        "SELECT COUNT(*) AS c FROM oms_sub_order WHERE order_id=? AND sub_status IN ('INBOUND','PACKED','PENDING_DEPARTURE','IN_TRANSIT','CUSTOMS_CLEARANCE','ARRIVED','PENDING_DELIVERY','DELIVERING','DELIVERED')"
      )
      .get(payload.orderId) as { c: number }).c;
    const newStatus = inbound >= total ? 'INBOUND' : 'PENDING_INBOUND';
    db.prepare(
      "UPDATE oms_order SET order_status=?, total_actual_pieces=COALESCE(total_actual_pieces,0)+?, total_actual_weight_kg=COALESCE(total_actual_weight_kg,0)+?, updated_at=? WHERE id=?"
    ).run(
      newStatus,
      payload.pieces || 1,
      payload.grossWeightKg || 0,
      inboundAt,
      payload.orderId
    );
  }

  return { inboundOrderId, inboundNo, inboundItemId: itemId, stockId };
}

// ============================================================
// 到达仓任务入库（按 JOB 整柜入库）
// ============================================================

export interface CreateDestInboundPayload {
  jobId: string;
  warehouseId: string;
  operatorUserId?: string;
  remark?: string;
  inboundAt?: string;
  items: Array<{
    subOrderId: string;
    trackingNo?: string;
    pieces?: number;
    weightKg?: number;
    cargoStatus?: 'INTACT' | 'DAMAGED_GOODS' | 'DAMAGED_PACKAGE' | 'LOST';
    deliveryStatus?: 'PENDING_DELIVERY' | 'PENDING_PICKUP';
  }>;
}

const CARGO_TO_CONDITION: Record<string, string> = {
  INTACT: 'GOOD',
  DAMAGED_GOODS: 'DAMAGED',
  DAMAGED_PACKAGE: 'OPENED',
  LOST: 'INCOMPLETE',
};

export function createDestInbound(
  db: Database.Database,
  payload: CreateDestInboundPayload
): { inboundOrderId: string; inboundNo: string } {
  const job = db
    .prepare('SELECT * FROM tms_job WHERE id=?')
    .get(payload.jobId) as any;
  if (!job) throw new Error(`Job not found: ${payload.jobId}`);

  const inboundOrderId = uuid();
  const inboundNo = generateInboundNo();
  const inboundAt = payload.inboundAt || nowStr();

  db.prepare(
    `INSERT INTO wms_inbound_order (
      id, inbound_no, business_line, warehouse_id,
      source_type, inbound_status, inbound_at, operator_user_id, remark,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'MANUAL', 'COMPLETED', ?, ?, ?, ?, ?)`
  ).run(
    inboundOrderId,
    inboundNo,
    job.business_line || 'SEA',
    payload.warehouseId,
    inboundAt,
    payload.operatorUserId || null,
    payload.remark || `按 JOB ${job.job_no} 入库`,
    inboundAt,
    inboundAt
  );

  const insertItem = db.prepare(
    `INSERT INTO wms_inbound_item (
      id, inbound_order_id, order_id, sub_order_id, tracking_no,
      pieces, gross_weight_kg, package_condition, delivery_status, cargo_status,
      item_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertStock = db.prepare(
    `INSERT INTO wms_stock (
      id, business_line, warehouse_id, order_id, sub_order_id,
      stock_status, pieces, gross_weight_kg, volume_cbm, location_code,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'IN_STOCK', ?, ?, ?, ?, ?, ?)`
  );
  const updateSub = db.prepare(
    `UPDATE oms_sub_order SET sub_status='PENDING_DELIVERY', updated_at=? WHERE id=?`
  );

  for (const it of payload.items) {
    const sub = db
      .prepare('SELECT order_id, pieces, actual_weight_kg, volume_cbm FROM oms_sub_order WHERE id=?')
      .get(it.subOrderId) as any;
    const cargo = it.cargoStatus || 'INTACT';
    insertItem.run(
      uuid(),
      inboundOrderId,
      sub?.order_id || null,
      it.subOrderId,
      it.trackingNo || null,
      it.pieces || sub?.pieces || 1,
      it.weightKg || sub?.actual_weight_kg || 0,
      CARGO_TO_CONDITION[cargo] || 'GOOD',
      it.deliveryStatus || 'PENDING_DELIVERY',
      cargo,
      cargo === 'LOST' ? 'ABNORMAL' : 'COMPLETED',
      inboundAt
    );
    insertStock.run(
      uuid(),
      job.business_line || 'SEA',
      payload.warehouseId,
      sub?.order_id || null,
      it.subOrderId,
      it.pieces || sub?.pieces || 1,
      it.weightKg || sub?.actual_weight_kg || 0,
      sub?.volume_cbm || 0,
      null,
      inboundAt,
      inboundAt
    );
    updateSub.run(inboundAt, it.subOrderId);
  }

  // 更新 JOB 已到达入仓
  db.prepare(
    `UPDATE tms_job SET job_status='CLEARED', current_node='WAREHOUSE_IN', updated_at=? WHERE id=?`
  ).run(inboundAt, payload.jobId);

  return { inboundOrderId, inboundNo };
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
