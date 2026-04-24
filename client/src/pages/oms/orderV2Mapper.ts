import type { LogisticsRecord, LogisticsStep, MasterOrder, MasterOrderStatus, SubOrder, SubOrderStatus } from '../../types/order';

const PAYMENT_METHOD_MAP: Record<string, NonNullable<MasterOrder['paymentMethod']>> = {
  COD: 'COD',
  CREDIT_CARD: 'CREDIT_CARD',
  CARD: 'CREDIT_CARD',
  PREPAID: 'PREPAID',
  BANK_TRANSFER: 'PREPAID',
  CASH: 'PREPAID',
};

function mapPaymentMethod(value: unknown): MasterOrder['paymentMethod'] {
  const key = String(value || '').toUpperCase();
  return PAYMENT_METHOD_MAP[key];
}

function mapPaymentStatus(value: unknown): MasterOrder['paymentStatus'] {
  const key = String(value || '').toUpperCase();
  if (key === 'PAID') return 'PAID';
  if (key === 'PARTIAL') return 'PARTIAL';
  if (key === 'UNPAID') return 'UNPAID';
  return undefined;
}

function mapMasterStatus(value: unknown): MasterOrderStatus {
  const key = String(value || '').toUpperCase();
  const all: MasterOrderStatus[] = [
    'PENDING_INBOUND', 'INBOUND', 'PENDING_DEPARTURE', 'DEPARTED', 'IN_TRANSIT',
    'ARRIVED', 'PARTIAL_DELIVERED', 'COMPLETED', 'EXCEPTION', 'RETURN_APPLIED', 'CANCELLED',
  ];
  return (all as string[]).includes(key) ? (key as MasterOrderStatus) : 'PENDING_INBOUND';
}

function mapSubStatus(value: unknown): SubOrderStatus {
  const key = String(value || '').toUpperCase();
  const all: SubOrderStatus[] = [
    'PENDING_INBOUND', 'INBOUND', 'PENDING_PACKING', 'PACKED', 'PENDING_DEPARTURE',
    'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'ARRIVED', 'PENDING_DELIVERY', 'DELIVERING',
    'DELIVERED', 'EXCEPTION', 'RETURN_APPLIED', 'CANCELLED',
  ];
  return (all as string[]).includes(key) ? (key as SubOrderStatus) : 'PENDING_INBOUND';
}

function mapStep(nodeCode?: string, statusCode?: string): LogisticsStep {
  const v = `${nodeCode || ''} ${statusCode || ''}`.toUpperCase();
  if (v.includes('INBOUND')) return 'INBOUND';
  if (v.includes('PACK')) return 'PACKING';
  if (v.includes('CUSTOMS')) return 'IMPORT_CUSTOMS';
  if (v.includes('ARRIVE')) return 'ARRIVED_PORT';
  if (v.includes('DELIVER')) return 'DELIVERED';
  if (v.includes('TRANSIT')) return 'IN_TRANSIT';
  if (v.includes('DEPART')) return 'DEPARTED';
  return 'IN_TRANSIT';
}

function mapLogisticsRecords(subOrderId: string, trackingEvents: any[]): LogisticsRecord[] {
  return (trackingEvents || [])
    .filter((evt: any) => evt?.sub_order_id === subOrderId)
    .map((evt: any) => ({
      id: String(evt.id),
      subOrderId,
      step: mapStep(evt.node_code, evt.status_code),
      status: String(evt.status_code || '').toUpperCase() === 'EXCEPTION' ? 'EXCEPTION' : 'COMPLETED',
      operator: evt.operator_user_id || undefined,
      timestamp: evt.event_time || undefined,
      location: evt.location || undefined,
      remark: evt.remark || evt.node_name || undefined,
      photos: [],
      documents: [],
    }));
}

function mapCurrency(value: unknown): MasterOrder['currency'] {
  const key = String(value || '').toUpperCase();
  if (key === 'USD') return 'USD';
  if (key === 'NGN') return 'NGN';
  return 'CNY';
}

function parseSubOrderSeq(value: unknown): number | null {
  const raw = String(value || '').trim();
  const match = raw.match(/-(\d{2})$/);
  if (!match) return null;
  const seq = Number(match[1]);
  return Number.isFinite(seq) && seq > 0 ? seq : null;
}

export function mapV2OrderRowToMasterOrder(row: any): MasterOrder {
  return {
    id: String(row.id),
    orderNo: String(row.display_order_no || row.order_no || row.id),
    customerId: String(row.customer_id || ''),
    customerName: String(row.customer_name || '-'),
    subOrderIds: [],
    splitStatus: 'PENDING',
    expressPackages: [],
    items: [],
    sender: row.sender_name || undefined,
    senderPhone: row.sender_phone || undefined,
    senderAddress: row.sender_address || undefined,
    senderCity: row.sender_city_name || row.sender_city_id || undefined,
    consignee: String(row.consignee_name || '-'),
    consigneePhone: String(row.consignee_phone || '-'),
    consigneeEmail: row.consignee_email || undefined,
    destAddress: String(row.consignee_address || '-'),
    destCountry: String(row.consignee_country_name || row.consignee_country_id || '-'),
    destCity: String(row.consignee_city_name || row.consignee_city_id || '-'),
    district: row.consignee_district || undefined,
    senderCityId: row.sender_city_id || undefined,
    senderCountry: row.sender_country_name || row.sender_country_id || undefined,
    senderCountryId: row.sender_country_id || undefined,
    totalPieces: Number(row.total_actual_pieces || row.total_declared_pieces || 0),
    totalWeight: Number(row.total_actual_weight_kg || row.total_declared_weight_kg || 0),
    totalVolume: 0,
    paymentMethod: mapPaymentMethod(row.payment_method),
    paymentStatus: mapPaymentStatus(row.payment_status),
    paymentChannel: row.payment_channel || undefined,
    paymentTime: row.payment_time || undefined,
    totalFreight: Number(row.total_receivable_amount || 0),
    paidAmount: Number(row.total_paid_amount || 0),
    estimatedFreight: Number(row.estimated_freight || 0),
    actualFreight: Number(row.actual_freight || 0),
    freightCurrency: row.freight_currency || 'CNY',
    currency: mapCurrency(row.currency_code),
    status: mapMasterStatus(row.order_status),
    transportType: String(row.business_line || 'SEA').toUpperCase() === 'AIR' ? 'AIR' : 'SEA',
    salesPerson: String(row.sales_user_name || row.sales_user_id || '-'),
    createdBy: String(row.creator_user_name || row.created_by || '-'),
    serviceType: row.service_type_code || undefined,
    routeCode: row.route_code || undefined,
    warehouseEntryNo: row.warehouse_entry_no || undefined,
    containerType: undefined,
    remark: row.remark || undefined,
    previousStatus: row.previous_status || undefined,
    returnType: row.return_type || undefined,
    returnReason: row.return_reason || undefined,
    returnRefundAmount: row.return_refund_amount === null || row.return_refund_amount === undefined
      ? undefined
      : Number(row.return_refund_amount),
    returnRefundMethod: row.return_refund_method || undefined,
    needReturn: row.need_return === null || row.need_return === undefined ? undefined : Number(row.need_return) === 1,
    returnShippingNote: row.return_shipping_note || undefined,
    returnAppliedBy: row.return_applied_by || undefined,
    returnAppliedAt: row.return_applied_at || undefined,
    returnApprovedAt: row.return_approved_at || undefined,
    returnApprover: row.return_approver || undefined,
    returnRejectReason: row.return_reject_reason || undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function mapFees(rawFees: any[]): any[] {
  const toUsdRate: Record<string, number> = {
    USD: 1,
    CNY: 1 / 7.2,
    NGN: 1 / 535,
  };

  return (rawFees || []).map((fee: any) => ({
    id: fee.id,
    feeNo: fee.fee_no,
    feeDirection: fee.fee_direction,
    feeType: fee.fee_item_code,
    amount: Number(fee.amount || 0),
    amountUsd: Number(fee.amount || 0) * (toUsdRate[String(fee.currency_code || 'USD').toUpperCase()] || 1),
    unitPrice: Number(fee.unit_price || 0),
    quantity: Number(fee.quantity || 0),
    currency: fee.currency_code,
    status: fee.fee_status,
    description: fee.description,
    voucherUrl: fee.voucher_url,
    createdBy: fee.created_by,
    createdAt: fee.created_at,
  }));
}

export function mapV2OrderFull(payload: any): {
  order: MasterOrder;
  subOrders: SubOrder[];
  expressPackages: any[];
  fees: any[];
  routeTemplate: any;
  trackingBySubOrder: Record<string, any[]>;
  jobBindingBySubOrder: Record<string, any[]>;
  dpnBySubOrder: Record<string, any[]>;
  deliveryTaskBySubOrder: Record<string, any[]>;
} {
  const orderRow = payload?.order || {};
  const order = mapV2OrderRowToMasterOrder(orderRow);

  const subOrdersRaw = Array.isArray(payload?.subOrders) ? payload.subOrders : [];
  const trackingEvents = Array.isArray(payload?.trackingEvents) ? payload.trackingEvents : [];
  const trackingBySubOrderRows = Array.isArray(payload?.trackingBySubOrder) ? payload.trackingBySubOrder : [];
  const trackingBySubOrder = trackingBySubOrderRows.reduce((acc: Record<string, any[]>, row: any) => {
    const key = String(row?.subOrderId || row?.sub_order_id || '').trim();
    if (!key) return acc;
    acc[key] = Array.isArray(row?.sites) ? row.sites : [];
    return acc;
  }, {});

  const jobBindingsRaw = Array.isArray(payload?.jobBindings) ? payload.jobBindings : [];
  const jobBindingBySubOrder = jobBindingsRaw.reduce((acc: Record<string, any[]>, row: any) => {
    const key = String(row?.sub_order_id || '').trim();
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const subOrders: SubOrder[] = subOrdersRaw.map((sub: any, index: number) => {
    const lineNo = Number(sub.line_no || parseSubOrderSeq(sub.sub_order_no) || (index + 1));
    return ({
    ...((): Partial<SubOrder> => {
      const binding = (jobBindingBySubOrder[String(sub.id)] || [])[0] || {};
      return {
        shippingUnitId: sub.shipping_unit_id || binding.shipping_unit_id || undefined,
        shippingUnitNo: sub.shipping_unit_no || binding.unit_no || undefined,
        jobNo: sub.job_no || binding.job_no || undefined,
      };
    })(),
    id: String(sub.id),
    subOrderNo: String(sub.sub_order_no || '').trim() || '-',
    masterOrderId: String(sub.order_id),
    masterOrderNo: order.orderNo,
    batchNo: lineNo,
    batchName: `批次${lineNo}`,
    transportType: String(sub.business_line || 'SEA').toUpperCase() === 'AIR' ? 'AIR' : 'SEA',
    route: String(sub.route_code || '-'),
    serviceType: String(sub.service_type_code || '-'),
    items: [],
    pieces: Number(sub.pieces || 0),
    weight: Number(sub.actual_weight_kg || 0),
    volume: Number(sub.volume_cbm || 0),
    chargeableWeight: sub.chargeable_weight_kg === null || sub.chargeable_weight_kg === undefined
      ? undefined
      : Number(sub.chargeable_weight_kg),
    trackingNumber: sub.bill_no || undefined,
    thirdPartyTracking: undefined,
    consignee: order.consignee,
    consigneePhone: order.consigneePhone,
    destAddress: order.destAddress,
    destCountry: order.destCountry,
    destCity: order.destCity,
    district: order.district,
    status: mapSubStatus(sub.sub_status),
    logisticsRecords: mapLogisticsRecords(String(sub.id), trackingEvents),
    estimatedCost: undefined,
    actualCost: undefined,
    remark: sub.remark || undefined,
    createdAt: String(sub.created_at || order.createdAt),
    updatedAt: String(sub.updated_at || order.updatedAt),
    inboundAt: undefined,
    packedAt: undefined,
    departedAt: sub.atd || undefined,
    arrivedAt: sub.ata || undefined,
    deliveredAt: undefined,
  })});

  const subNoById = new Map(subOrders.map((s) => [s.id, s.subOrderNo]));
  const initialPkgs = Array.isArray(payload?.initialPackages) ? payload.initialPackages : [];
  const initialById = new Map(initialPkgs.map((pkg: any) => [pkg.id, pkg]));
  const actualPkgs = Array.isArray(payload?.actualPackages) ? payload.actualPackages : [];
  const dpns = Array.isArray(payload?.dpns) ? payload.dpns : [];
  const dpnItems = Array.isArray(payload?.dpnItems) ? payload.dpnItems : [];
  const deliveryTasks = Array.isArray(payload?.deliveryTasks) ? payload.deliveryTasks : [];
  const dpnById = new Map(dpns.map((dpn: any) => [String(dpn.id), dpn]));

  const deliveryTasksByDpn = deliveryTasks.reduce((acc: Record<string, any[]>, row: any) => {
    const key = String(row?.dpn_id || '').trim();
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const dpnBySubOrder = dpnItems.reduce((acc: Record<string, any[]>, row: any) => {
    const subOrderId = String(row?.sub_order_id || '').trim();
    const dpnId = String(row?.dpn_id || '').trim();
    if (!subOrderId || !dpnId) return acc;
    const dpn = dpnById.get(dpnId);
    if (!dpn) return acc;
    if (!acc[subOrderId]) acc[subOrderId] = [];
    if (!acc[subOrderId].some((item) => item.id === dpnId)) {
      acc[subOrderId].push(dpn);
    }
    return acc;
  }, {});

  const deliveryTaskBySubOrder = dpnItems.reduce((acc: Record<string, any[]>, row: any) => {
    const subOrderId = String(row?.sub_order_id || '').trim();
    const dpnId = String(row?.dpn_id || '').trim();
    if (!subOrderId || !dpnId) return acc;
    if (!acc[subOrderId]) acc[subOrderId] = [];
    const tasks = deliveryTasksByDpn[dpnId] || [];
    for (const task of tasks) {
      if (!acc[subOrderId].some((exists) => exists.id === task.id)) {
        acc[subOrderId].push(task);
      }
    }
    return acc;
  }, {});

  const expressPackages = (actualPkgs.length > 0 ? actualPkgs : initialPkgs).map((pkg: any, idx: number) => {
    const initial = pkg.initial_package_id ? initialById.get(pkg.initial_package_id) : pkg;
    return {
      id: String(pkg.id || initial?.id || `PKG-${idx + 1}`),
      courier: initial?.express_company || '未知',
      trackingNo: String(pkg.tracking_no || initial?.tracking_no || ''),
      status: String(pkg.package_status || initial?.package_status || 'PENDING'),
      receivedAt: undefined,
      inboundAt: pkg.created_at || undefined,
      itemName: String(pkg.goods_name || initial?.goods_name || '未命名货物'),
      category: String(initial?.goods_category || ''),
      description: String(pkg.cargo_desc || initial?.cargo_desc || 'GENERAL'),
      weight: Number(pkg.gross_weight_kg || initial?.declared_weight_kg || 0),
      pieces: Number(pkg.pieces || initial?.pieces || 0),
      declaredValue: Number(initial?.declared_value_usd || 0),
      length: pkg.length_cm === null || pkg.length_cm === undefined ? undefined : Number(pkg.length_cm),
      width: pkg.width_cm === null || pkg.width_cm === undefined ? undefined : Number(pkg.width_cm),
      height: pkg.height_cm === null || pkg.height_cm === undefined ? undefined : Number(pkg.height_cm),
      subOrderNo: pkg.sub_order_id ? subNoById.get(String(pkg.sub_order_id)) : undefined,
      shippingUnitNo: undefined,
      photos: [],
      remark: initial?.remark || undefined,
    };
  });

  return {
    order: {
      ...order,
      expressPackages,
      subOrderIds: subOrders.map((s) => s.id),
      splitStatus: subOrders.length > 1 ? 'COMPLETED' : subOrders.length === 1 ? 'PARTIAL' : 'PENDING',
      totalPieces: Number(orderRow.total_actual_pieces || orderRow.total_declared_pieces || 0),
      totalWeight: Number(orderRow.total_actual_weight_kg || orderRow.total_declared_weight_kg || 0),
      paidAmount: Number(orderRow.total_paid_amount || 0),
      totalFreight: Number(orderRow.total_receivable_amount || 0),
      estimatedFreight: Number(orderRow.estimated_freight || 0),
      actualFreight: Number(orderRow.actual_freight || 0),
      freightCurrency: orderRow.freight_currency || 'CNY',
      inboundDate: expressPackages.find((p: any) => p.inboundAt)?.inboundAt,
    },
    subOrders,
    expressPackages,
    fees: mapFees(Array.isArray(payload?.fees) ? payload.fees : []),
    routeTemplate: payload?.routeTemplate || null,
    trackingBySubOrder,
    jobBindingBySubOrder,
    dpnBySubOrder,
    deliveryTaskBySubOrder,
  };
}
