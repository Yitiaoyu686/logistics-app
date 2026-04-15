import type Database from 'better-sqlite3';
import { uuid, generateJobNo } from '../utils/idGenerator';

// ============================================================
// JOB Repo - 物流公司任务（订舱后创建的运输计划）
// 海运: 1 JOB = 1 集装箱 (CONTAINER)
// 空运: 1 JOB = 多个集装号  (PALLET)
// ============================================================

export interface CreateJobPayload {
  id?: string;
  jobNo?: string;
  businessLine: 'SEA' | 'AIR';
  routeCode: string;
  originPort?: string;
  destPort?: string;
  carrierName?: string;
  vesselVoyage?: string;
  flightNo?: string;
  billNo?: string;
  cargoType?: 'GENERAL' | 'SENSITIVE';
  serviceType?: 'EXPRESS' | 'STANDARD';
  containerType?: '20GP' | '40GP' | '40HQ' | '45HQ' | 'LCL' | 'AIR_PALLET';
  etd?: string;
  eta?: string;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
  // 海运一次性把唯一的 unit 一起带上；空运可以多个 unit
  units?: Array<{
    id?: string;
    unitNo: string;
    unitType?: 'CONTAINER' | 'PALLET';
    containerType?: string;
    sealNo?: string;
    maxWeightKg?: number;
    maxVolumeCbm?: number;
  }>;
}

export function createJob(
  db: Database.Database,
  payload: CreateJobPayload
): { id: string; jobNo: string; unitIds: string[] } {
  const id = payload.id || uuid();
  const jobNo = payload.jobNo || generateJobNo(payload.businessLine);
  const createdAt = payload.createdAt || nowStr();

  const firstUnit = payload.units?.[0];
  const containerNoForJob =
    payload.businessLine === 'SEA' ? firstUnit?.unitNo || null : null;
  const containerTypeForJob =
    payload.containerType || firstUnit?.containerType || null;

  db.prepare(
    `INSERT INTO tms_job (
      id, job_no, business_line, route_code,
      origin_port, dest_port,
      carrier_name, vessel_voyage, flight_no, bill_no,
      container_no, container_type, cargo_type, service_type,
      job_status, current_node,
      total_pieces, total_weight_kg, total_volume_cbm,
      etd, eta, remark, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    jobNo,
    payload.businessLine,
    payload.routeCode,
    payload.originPort || null,
    payload.destPort || null,
    payload.carrierName || null,
    payload.vesselVoyage || null,
    payload.flightNo || null,
    payload.billNo || null,
    containerNoForJob,
    containerTypeForJob,
    payload.cargoType || 'GENERAL',
    payload.serviceType || 'EXPRESS',
    'PLANNED',
    'WAREHOUSE_OUT',
    payload.etd || null,
    payload.eta || null,
    payload.remark || null,
    payload.createdBy || null,
    createdAt,
    createdAt
  );

  const unitIds: string[] = [];
  for (const u of payload.units || []) {
    const unitId = u.id || uuid();
    db.prepare(
      `INSERT INTO tms_shipping_unit (
        id, unit_no, business_line, unit_type, container_type, seal_no,
        warehouse_id, job_id, route_code, unit_status,
        max_weight_kg, max_volume_cbm, current_weight_kg, current_volume_cbm,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
    ).run(
      unitId,
      u.unitNo,
      payload.businessLine,
      u.unitType || (payload.businessLine === 'SEA' ? 'CONTAINER' : 'PALLET'),
      u.containerType || payload.containerType || null,
      u.sealNo || null,
      null,
      id,
      payload.routeCode,
      'EMPTY',
      u.maxWeightKg ||
        (payload.businessLine === 'SEA'
          ? containerTypeForJob === '20GP'
            ? 21000
            : 26000
          : 1500),
      u.maxVolumeCbm ||
        (payload.businessLine === 'SEA'
          ? containerTypeForJob === '20GP'
            ? 33
            : 67.5
          : 12),
      createdAt,
      createdAt
    );
    unitIds.push(unitId);
  }

  return { id, jobNo, unitIds };
}

// ============================================================
// 装箱：把子单装入指定 unit，建立 job ↔ sub_order 关联
// 同时更新 stock / sub_order 状态、unit 累计重量/体积、job 总件数/重量
// ============================================================

export interface BindSubOrdersPayload {
  jobId: string;
  unitId: string;
  subOrderIds: string[];
}

export function bindSubOrders(
  db: Database.Database,
  payload: BindSubOrdersPayload
): { bound: number } {
  const { jobId, unitId, subOrderIds } = payload;
  if (!subOrderIds.length) return { bound: 0 };

  const insertRel = db.prepare(
    `INSERT OR IGNORE INTO tms_job_order_rel (id, job_id, sub_order_id, shipping_unit_id, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  );
  const updateSubOrder = db.prepare(
    `UPDATE oms_sub_order
     SET sub_status='PACKED', shipping_unit_id=?, job_id=?, updated_at=datetime('now')
     WHERE id=?`
  );
  const updateStock = db.prepare(
    `UPDATE wms_stock SET stock_status='PACKED', updated_at=datetime('now') WHERE sub_order_id=?`
  );

  let bound = 0;
  for (const subOrderId of subOrderIds) {
    insertRel.run(uuid(), jobId, subOrderId, unitId);
    updateSubOrder.run(unitId, jobId, subOrderId);
    updateStock.run(subOrderId);
    bound++;
  }

  // 重算 unit 和 job 的总量
  const agg = db
    .prepare(
      `SELECT COALESCE(SUM(so.pieces),0) AS pieces,
              COALESCE(SUM(so.actual_weight_kg),0) AS weight,
              COALESCE(SUM(so.volume_cbm),0) AS volume
       FROM tms_job_order_rel rel
       LEFT JOIN oms_sub_order so ON so.id = rel.sub_order_id
       WHERE rel.shipping_unit_id = ?`
    )
    .get(unitId) as { pieces: number; weight: number; volume: number };

  db.prepare(
    `UPDATE tms_shipping_unit
     SET unit_status='LOADING', current_weight_kg=?, current_volume_cbm=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(agg.weight, agg.volume, unitId);

  const jobAgg = db
    .prepare(
      `SELECT COALESCE(SUM(so.pieces),0) AS pieces,
              COALESCE(SUM(so.actual_weight_kg),0) AS weight,
              COALESCE(SUM(so.volume_cbm),0) AS volume
       FROM tms_job_order_rel rel
       LEFT JOIN oms_sub_order so ON so.id = rel.sub_order_id
       WHERE rel.job_id = ?`
    )
    .get(jobId) as { pieces: number; weight: number; volume: number };

  db.prepare(
    `UPDATE tms_job
     SET total_pieces=?, total_weight_kg=?, total_volume_cbm=?,
         job_status=CASE WHEN job_status='PLANNED' THEN 'LOADING' ELSE job_status END,
         current_node='WAREHOUSE_IN', updated_at=datetime('now')
     WHERE id=?`
  ).run(jobAgg.pieces, jobAgg.weight, jobAgg.volume, jobId);

  return { bound };
}

// ============================================================
// 封箱：unit_status → SEALED；job 进入 LOADING 完成态
// ============================================================

export function sealUnit(
  db: Database.Database,
  unitId: string,
  sealNo?: string
): void {
  db.prepare(
    `UPDATE tms_shipping_unit
     SET unit_status='SEALED', seal_no=COALESCE(?, seal_no), updated_at=datetime('now')
     WHERE id=?`
  ).run(sealNo || null, unitId);
}

// ============================================================
// 节点推进：写 tracking_event + 联动 job/sub 状态
// ============================================================

export interface AdvanceNodePayload {
  jobId: string;
  nodeCode: string;
  nodeName: string;
  eventTime: string; // ISO 字符串
  location?: string;
  remark?: string;
  operatorUserId?: string;
}

const NODE_TO_JOB_STATUS: Record<string, string> = {
  WAREHOUSE_OUT: 'LOADING',
  CUSTOMS_EXPORT: 'CUSTOMS_EXPORT',
  CUSTOMS_INSPECT: 'CUSTOMS_EXPORT',
  CUSTOMS_RELEASE: 'CUSTOMS_EXPORT',
  DEPARTURE: 'DEPARTED',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVAL: 'ARRIVED',
  CUSTOMS_IMPORT: 'CUSTOMS_IMPORT',
  CUSTOMS_INSPECT_IMP: 'CUSTOMS_IMPORT',
  CUSTOMS_CLEARED: 'CLEARED',
  WAREHOUSE_IN: 'CLEARED',
  SIGNED: 'COMPLETED',
};

const NODE_TO_SUB_STATUS: Record<string, string> = {
  WAREHOUSE_OUT: 'PENDING_DEPARTURE',
  CUSTOMS_EXPORT: 'PENDING_DEPARTURE',
  CUSTOMS_INSPECT: 'PENDING_DEPARTURE',
  CUSTOMS_RELEASE: 'PENDING_DEPARTURE',
  DEPARTURE: 'IN_TRANSIT',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVAL: 'CUSTOMS_CLEARANCE',
  CUSTOMS_IMPORT: 'CUSTOMS_CLEARANCE',
  CUSTOMS_INSPECT_IMP: 'CUSTOMS_CLEARANCE',
  CUSTOMS_CLEARED: 'ARRIVED',
  WAREHOUSE_IN: 'PENDING_DELIVERY',
  SIGNED: 'DELIVERED',
};

// 主订单状态映射（取节点对应的最高态）
const NODE_TO_ORDER_STATUS: Record<string, string> = {
  WAREHOUSE_OUT: 'PENDING_DEPARTURE',
  CUSTOMS_EXPORT: 'PENDING_DEPARTURE',
  CUSTOMS_INSPECT: 'PENDING_DEPARTURE',
  CUSTOMS_RELEASE: 'PENDING_DEPARTURE',
  DEPARTURE: 'DEPARTED',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVAL: 'ARRIVED',
  CUSTOMS_IMPORT: 'CUSTOMS_CLEARANCE',
  CUSTOMS_INSPECT_IMP: 'CUSTOMS_CLEARANCE',
  CUSTOMS_CLEARED: 'CUSTOMS_CLEARANCE',
  WAREHOUSE_IN: 'PENDING_DELIVERY',
  SIGNED: 'DELIVERED',
};

export function advanceNode(
  db: Database.Database,
  payload: AdvanceNodePayload
): { eventId: string } {
  const eventId = uuid();
  db.prepare(
    `INSERT INTO tms_tracking_event (
      id, business_line, event_scope, job_id,
      node_code, node_name, event_type,
      event_time, location, operator_user_id, remark, created_at
    ) VALUES (?, (SELECT business_line FROM tms_job WHERE id=?), 'JOB', ?, ?, ?, 'EXPORT', ?, ?, ?, ?, datetime('now'))`
  ).run(
    eventId,
    payload.jobId,
    payload.jobId,
    payload.nodeCode,
    payload.nodeName,
    payload.eventTime,
    payload.location || null,
    payload.operatorUserId || null,
    payload.remark || null
  );

  const newJobStatus = NODE_TO_JOB_STATUS[payload.nodeCode];
  if (newJobStatus) {
    const atdField =
      payload.nodeCode === 'DEPARTURE' ? `, atd=COALESCE(atd, ?)` : '';
    const ataField =
      payload.nodeCode === 'ARRIVAL' ? `, ata=COALESCE(ata, ?)` : '';
    const params: any[] = [newJobStatus, payload.nodeCode];
    if (payload.nodeCode === 'DEPARTURE') params.push(payload.eventTime);
    if (payload.nodeCode === 'ARRIVAL') params.push(payload.eventTime);
    params.push(payload.jobId);
    db.prepare(
      `UPDATE tms_job
       SET job_status=?, current_node=?${atdField}${ataField}, updated_at=datetime('now')
       WHERE id=?`
    ).run(...params);
  }

  const newSubStatus = NODE_TO_SUB_STATUS[payload.nodeCode];
  if (newSubStatus) {
    db.prepare(
      `UPDATE oms_sub_order
       SET sub_status=?, updated_at=datetime('now')
       WHERE id IN (SELECT sub_order_id FROM tms_job_order_rel WHERE job_id=?)`
    ).run(newSubStatus, payload.jobId);
  }

  // 同步主订单状态（取节点对应的最高态）
  const newOrderStatus = NODE_TO_ORDER_STATUS[payload.nodeCode];
  if (newOrderStatus) {
    db.prepare(
      `UPDATE oms_order
       SET order_status=?, updated_at=datetime('now')
       WHERE id IN (
         SELECT DISTINCT so.order_id
         FROM tms_job_order_rel rel
         JOIN oms_sub_order so ON so.id = rel.sub_order_id
         WHERE rel.job_id = ?
       )`
    ).run(newOrderStatus, payload.jobId);
  }

  return { eventId };
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
