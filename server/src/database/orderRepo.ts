import type Database from 'better-sqlite3';
import { uuid, generateOrderNo, generateSubOrderNo } from '../utils/idGenerator';

// ============================================================
// Order Repo - 订单（主单 + 初始包裹 + 自动拆子单）
// 复刻 customerRepo 模式：seed.ts 与 routes/orders.ts 共用
// ============================================================

export interface CreateOrderItem {
  id?: string;
  expressCompany?: string;
  trackingNo?: string;
  goodsName?: string;
  goodsCategory?: string;
  cargoType?: 'GENERAL' | 'SENSITIVE';
  declaredWeightKg?: number;
  pieces?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  declaredValue?: number;
  remark?: string;
  // 拆出来的子单 id（可选，方便 seed 用固定 ID）
  subOrderId?: string;
}

export interface CreateOrderPayload {
  id?: string;
  orderNo?: string;
  warehouseEntryNo?: string;
  businessLine: 'SEA' | 'AIR';
  serviceType?: string;
  customerId: string;
  customerName: string;
  customerCode?: string;
  salesUserId?: string;
  routeCode: string;
  exportMode?: string;
  paymentMethod?: string;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  currencyCode?: string;
  orderStatus?: string;
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  consigneeName?: string;
  consigneePhone?: string;
  consigneeEmail?: string;
  consigneeAddress?: string;
  consigneeCountry?: string;
  consigneeCity?: string;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
  items: CreateOrderItem[];
}

export interface CreateOrderResult {
  id: string;
  orderNo: string;
  warehouseEntryNo: string;
  subOrderIds: string[];
  packageIds: string[];
}

export function createOrder(
  db: Database.Database,
  payload: CreateOrderPayload
): CreateOrderResult {
  const id = payload.id || uuid();
  const orderNo = payload.orderNo || generateOrderNo(payload.businessLine);
  const entryNo =
    payload.warehouseEntryNo ||
    `${(payload.customerCode || 'X').toUpperCase()}${String(
      Math.floor(Math.random() * 999)
    ).padStart(3, '0')}`;
  const createdAt = payload.createdAt || nowStr();

  const totalPieces = payload.items.reduce((s, it) => s + (it.pieces || 1), 0);
  const totalWeight = payload.items.reduce(
    (s, it) => s + (it.declaredWeightKg || 0),
    0
  );

  db.prepare(
    `INSERT INTO oms_order (
      id, order_no, warehouse_entry_no, business_line, service_type,
      customer_id, customer_name, sales_user_id, route_code, export_mode,
      order_status, payment_status, payment_method, currency_code,
      total_declared_pieces, total_declared_weight_kg,
      sender_name, sender_phone, sender_address,
      consignee_name, consignee_phone, consignee_email, consignee_address,
      consignee_country, consignee_city,
      remark, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    orderNo,
    entryNo,
    payload.businessLine,
    payload.serviceType || (payload.businessLine === 'SEA' ? 'LCL_SEA' : 'AIR_STD'),
    payload.customerId,
    payload.customerName,
    payload.salesUserId || null,
    payload.routeCode,
    payload.exportMode || 'BUYER_EXPORT',
    payload.orderStatus || 'PENDING_INBOUND',
    payload.paymentStatus || 'UNPAID',
    payload.paymentMethod || null,
    payload.currencyCode || 'CNY',
    totalPieces,
    totalWeight,
    payload.senderName || null,
    payload.senderPhone || null,
    payload.senderAddress || null,
    payload.consigneeName || null,
    payload.consigneePhone || null,
    payload.consigneeEmail || null,
    payload.consigneeAddress || null,
    payload.consigneeCountry || null,
    payload.consigneeCity || null,
    payload.remark || null,
    payload.createdBy || null,
    createdAt,
    createdAt
  );

  const subOrderIds: string[] = [];
  const packageIds: string[] = [];
  let lineNo = 1;

  const insertPkg = db.prepare(
    `INSERT INTO oms_package_initial (
      id, order_id, line_no, express_company, tracking_no, goods_name,
      goods_category, cargo_type, declared_weight_kg, pieces,
      length_cm, width_cm, height_cm, declared_value, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertSub = db.prepare(
    `INSERT INTO oms_sub_order (
      id, sub_order_no, order_id, line_no, business_line,
      sub_status, route_code, service_type,
      pieces, actual_weight_kg, volume_cbm,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const item of payload.items) {
    const pkgId = item.id || uuid();
    insertPkg.run(
      pkgId,
      id,
      lineNo,
      item.expressCompany || null,
      item.trackingNo || null,
      item.goodsName || null,
      item.goodsCategory || null,
      item.cargoType || 'GENERAL',
      item.declaredWeightKg || 0,
      item.pieces || 1,
      item.lengthCm || null,
      item.widthCm || null,
      item.heightCm || null,
      item.declaredValue || 0,
      item.remark || null,
      createdAt
    );
    packageIds.push(pkgId);

    const subId = item.subOrderId || uuid();
    const subNo = generateSubOrderNo(orderNo, lineNo);
    const volumeCbm =
      item.lengthCm && item.widthCm && item.heightCm
        ? (item.lengthCm * item.widthCm * item.heightCm) / 1_000_000
        : 0;
    insertSub.run(
      subId,
      subNo,
      id,
      lineNo,
      payload.businessLine,
      payload.orderStatus === 'PENDING_INBOUND' ? 'PENDING_INBOUND' : 'PENDING_INBOUND',
      payload.routeCode,
      payload.serviceType || (payload.businessLine === 'SEA' ? 'LCL_SEA' : 'AIR_STD'),
      item.pieces || 1,
      item.declaredWeightKg || 0,
      volumeCbm,
      createdAt,
      createdAt
    );
    subOrderIds.push(subId);
    lineNo++;
  }

  return { id, orderNo, warehouseEntryNo: entryNo, subOrderIds, packageIds };
}

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}
