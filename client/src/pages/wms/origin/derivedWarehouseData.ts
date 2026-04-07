import dayjs from 'dayjs';
import type { InboundRecord, InboundStatus, StockItem, StockStatus } from '../../../types/core';
import { v2OmsApi } from '../../../api';
import { mapV2OrderRowToMasterOrder } from '../../oms/orderV2Mapper';
import type { MasterOrder } from '../../../types/order';

const SERVICE_TYPE_LABEL: Record<string, string> = {
  STANDARD_AIR: '普快(空运)',
  EXPRESS_AIR: '特快(空运)',
  LCL_SEA: '拼柜(海运)',
  FCL_SEA: '整柜(海运)',
};

const EXPRESS_COMPANIES = [
  { name: '顺丰速运', code: 'SF' },
  { name: '圆通速递', code: 'YT' },
  { name: '中通快递', code: 'ZT' },
  { name: '申通快递', code: 'ST' },
  { name: '极兔速递', code: 'JT' },
];

const GOODS_POOL = [
  '日用品混装',
  '家居百货',
  '工艺礼品',
  '服饰配件',
  '电子配件',
  '展会物料',
  '小商品拼箱',
];

const STATION_POOL = [
  '海珠区站点',
  '白云一号区',
  '番禺转运区',
  '佛山拼货区',
  '深圳集货区',
];

const CONTAINER_POOL = ['AK01', 'AK02', 'AK03', 'AK05', 'AK08', 'AK12'];

type FallbackOrder = MasterOrder & { subOrderCount?: number };

function getServiceTypeLabel(order: FallbackOrder): string {
  return SERVICE_TYPE_LABEL[String(order.serviceType || '').toUpperCase()] || (order.transportType === 'AIR' ? '普快(空运)' : '拼柜(海运)');
}

function getRouteLabel(order: FallbackOrder): string {
  if (order.routeCode) return order.routeCode;
  const sender = String(order.senderCity || '').toUpperCase() || 'GZ.CN';
  const destination = `${String(order.destCity || 'LOS').toUpperCase()}.${String(order.destCountry || 'NGA').toUpperCase()}`;
  return `${sender}→${destination}`;
}

function getTrackingStatus(order: FallbackOrder): { text: string; time: string } {
  switch (order.status) {
    case 'PENDING_INBOUND':
      return { text: '已签收', time: dayjs(order.updatedAt || order.createdAt).subtract(2, 'hour').toISOString() };
    case 'INBOUND':
      return { text: '已签收', time: dayjs(order.updatedAt || order.createdAt).subtract(4, 'hour').toISOString() };
    case 'IN_TRANSIT':
      return { text: '已签收', time: dayjs(order.createdAt).add(2, 'hour').toISOString() };
    case 'COMPLETED':
      return { text: '已签收', time: dayjs(order.createdAt).add(1, 'hour').toISOString() };
    default:
      return { text: '已签收', time: order.updatedAt || order.createdAt };
  }
}

function getInboundPattern(order: FallbackOrder): InboundStatus[] {
  switch (order.status) {
    case 'PENDING_INBOUND':
      return ['PENDING', 'PROCESSING'];
    case 'INBOUND':
      return ['COMPLETED', 'COMPLETED'];
    case 'IN_TRANSIT':
      return ['COMPLETED', 'COMPLETED', 'COMPLETED'];
    case 'COMPLETED':
      return ['COMPLETED'];
    default:
      return [];
  }
}

function getStockPattern(order: FallbackOrder): StockStatus[] {
  switch (order.status) {
    case 'INBOUND':
      return ['IN_STOCK', 'PACKED'];
    case 'IN_TRANSIT':
      return ['PACKED', 'SHIPPED', 'SHIPPED'];
    case 'COMPLETED':
      return ['SHIPPED'];
    default:
      return [];
  }
}

function splitWeights(totalWeight: number, count: number): number[] {
  if (count <= 1) return [Number(totalWeight.toFixed(2))];
  const ratios = count === 2 ? [0.54, 0.46] : [0.38, 0.33, 0.29];
  const values = ratios.slice(0, count).map((ratio) => Number((totalWeight * ratio).toFixed(2)));
  const diff = Number((totalWeight - values.reduce((sum, item) => sum + item, 0)).toFixed(2));
  values[values.length - 1] = Number((values[values.length - 1] + diff).toFixed(2));
  return values;
}

function toVolume(weight: number, index: number): number {
  return Number((weight * (0.0042 + index * 0.0004)).toFixed(3));
}

function buildTrackingNo(orderNo: string, orderIndex: number, packageIndex: number): { company: string; trackingNo: string } {
  const company = EXPRESS_COMPANIES[(orderIndex + packageIndex) % EXPRESS_COMPANIES.length];
  const suffix = orderNo.replace(/\D/g, '').slice(-8) || '20260320';
  return {
    company: company.name,
    trackingNo: `${company.code}${suffix}${String(packageIndex + 1).padStart(2, '0')}`,
  };
}

function buildSubOrderNo(orderNo: string, packageIndex: number): string {
  return `${orderNo}-${String(packageIndex + 1).padStart(2, '0')}`;
}

function buildWarehouseLocation(orderIndex: number, packageIndex: number): string {
  return STATION_POOL[(orderIndex + packageIndex) % STATION_POOL.length];
}

function buildContainerNo(orderIndex: number, packageIndex: number): string {
  return CONTAINER_POOL[(orderIndex + packageIndex) % CONTAINER_POOL.length];
}

function buildGoodsDescription(orderIndex: number, packageIndex: number): string {
  return GOODS_POOL[(orderIndex + packageIndex) % GOODS_POOL.length];
}

function buildInboundTime(order: FallbackOrder, packageIndex: number): string {
  const base = dayjs(order.updatedAt || order.createdAt);
  switch (order.status) {
    case 'PENDING_INBOUND':
      return base.subtract(100 - packageIndex * 25, 'minute').toISOString();
    case 'INBOUND':
      return base.subtract(75 - packageIndex * 20, 'minute').toISOString();
    case 'IN_TRANSIT':
      return dayjs(order.createdAt).add(90 + packageIndex * 35, 'minute').toISOString();
    case 'COMPLETED':
      return dayjs(order.createdAt).add(50 + packageIndex * 20, 'minute').toISOString();
    default:
      return base.toISOString();
  }
}

function buildStockTime(order: FallbackOrder, packageIndex: number): string {
  if (order.status === 'INBOUND') {
    return dayjs(order.updatedAt || order.createdAt).subtract(60 - packageIndex * 15, 'minute').toISOString();
  }
  return dayjs(order.createdAt).add(60 + packageIndex * 30, 'minute').toISOString();
}

function shouldIncludeOrder(order: FallbackOrder): boolean {
  return ['PENDING_INBOUND', 'INBOUND', 'IN_TRANSIT', 'COMPLETED'].includes(order.status);
}

export async function loadOriginFallbackOrders(businessMode: 'ALL' | 'SEA' | 'AIR'): Promise<FallbackOrder[]> {
  const res = await v2OmsApi.listOrders({
    page: 1,
    pageSize: 50,
    businessLine: businessMode === 'ALL' ? undefined : businessMode,
  }) as any;

  const rows = Array.isArray(res?.data) ? res.data : [];
  return rows
    .map((row: any) => ({
      ...mapV2OrderRowToMasterOrder(row),
      subOrderCount: Number(row.sub_order_count || 0),
    }))
    .filter(shouldIncludeOrder);
}

export function buildOriginInboundFallbackData(orders: FallbackOrder[]): Array<InboundRecord & {
  displaySubOrderNo?: string;
  displayOrderNo?: string;
  subWaybillNo?: string;
  masterWaybillNo?: string;
  route?: string;
  serviceType?: string;
  goodsDescription?: string;
  logisticsStatus?: string;
  logisticsStatusTime?: string;
  thirdPartyStatus?: string;
  thirdPartyStatusTime?: string;
  salesPerson?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  orderNo?: string;
  updatedAt?: string;
  containerNos?: string[];
}> {
  return orders.flatMap((order, orderIndex) => {
    const pattern = getInboundPattern(order);
    const weights = splitWeights(order.totalWeight || 0, pattern.length || 1);
    const tracking = getTrackingStatus(order);

    return pattern.map((status, packageIndex) => {
      const subOrderNo = buildSubOrderNo(order.orderNo, packageIndex);
      const trackingMeta = buildTrackingNo(order.orderNo, orderIndex, packageIndex);
      const inboundTime = buildInboundTime(order, packageIndex);
      const actualWeight = weights[packageIndex] || Number((order.totalWeight || 0).toFixed(2));

      return {
        id: `derived-inb-${order.orderNo}-${packageIndex + 1}`,
        subOrderId: subOrderNo,
        masterOrderId: order.orderNo,
        trackingNo: trackingMeta.trackingNo,
        expressCompany: trackingMeta.company,
        clientCode: order.customerId || `CUST-${String(orderIndex + 1).padStart(3, '0')}`,
        clientName: order.customerName,
        pieces: 1,
        actualWeight,
        actualVolume: toVolume(actualWeight, packageIndex),
        packageCondition: 'GOOD',
        status,
        inboundTime,
        inboundMethod: status === 'PENDING' ? 'MANUAL' : 'SCAN',
        warehouseLocation: buildWarehouseLocation(orderIndex, packageIndex),
        warehouse: 'CN',
        jobNo: `JOB-SEA-${dayjs(order.createdAt).format('YYYYMMDD')}-${String(orderIndex + 1).padStart(3, '0')}`,
        remark: status === 'PROCESSING' ? '已签收，待复核尺寸' : '包裹外箱完整，按订单资料入库',
        operator: status === 'PENDING' ? '待分配' : '李仓管',
        photos: '[]',
        createdAt: inboundTime,
        displaySubOrderNo: subOrderNo,
        displayOrderNo: order.orderNo,
        subWaybillNo: subOrderNo,
        masterWaybillNo: order.orderNo,
        orderNo: order.orderNo,
        route: getRouteLabel(order),
        serviceType: getServiceTypeLabel(order),
        goodsDescription: buildGoodsDescription(orderIndex, packageIndex),
        logisticsStatus: status === 'PENDING' ? '待上架' : status === 'PROCESSING' ? '入库处理中' : '已完成入库',
        logisticsStatusTime: dayjs(inboundTime).add(10, 'minute').toISOString(),
        thirdPartyStatus: tracking.text,
        thirdPartyStatusTime: tracking.time,
        salesPerson: order.salesPerson,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt,
        containerNos: [buildContainerNo(orderIndex, packageIndex)],
      };
    });
  });
}

export function buildOriginStockFallbackData(orders: FallbackOrder[]): Array<StockItem & {
  serviceType?: string;
  goodsDescription?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  orderUpdatedAt?: string;
  orderCreatedAt?: string;
  displayOrderNo?: string;
  displaySubOrderNo?: string;
}> {
  return orders.flatMap((order, orderIndex) => {
    const pattern = getStockPattern(order);
    const weights = splitWeights(order.totalWeight || 0, pattern.length || 1);

    return pattern.map((status, packageIndex) => {
      const subOrderNo = buildSubOrderNo(order.orderNo, packageIndex);
      const trackingMeta = buildTrackingNo(order.orderNo, orderIndex, packageIndex);
      const inboundTime = buildStockTime(order, packageIndex);
      const weight = weights[packageIndex] || Number((order.totalWeight || 0).toFixed(2));

      return {
        id: `derived-stock-${order.orderNo}-${packageIndex + 1}`,
        masterOrderNo: order.orderNo,
        subOrderNo,
        trackingNo: trackingMeta.trackingNo,
        clientCode: order.customerId || `CUST-${String(orderIndex + 1).padStart(3, '0')}`,
        clientName: order.customerName,
        pieces: 1,
        weight,
        volume: toVolume(weight, packageIndex),
        transportType: order.transportType,
        route: getRouteLabel(order),
        recipient: order.consignee,
        destination: `${order.destCountry}-${order.destCity}`,
        status,
        warehouseLocation: status === 'SHIPPED' ? '已出库/待发运' : buildWarehouseLocation(orderIndex, packageIndex),
        warehouse: 'CN',
        location: buildWarehouseLocation(orderIndex, packageIndex),
        inboundTime,
        shippingUnitId: status === 'PACKED' || status === 'SHIPPED'
          ? `UNIT-${dayjs(order.createdAt).format('MMDD')}-${String(orderIndex + 1).padStart(2, '0')}`
          : undefined,
        shippingUnitNo: status === 'PACKED' || status === 'SHIPPED'
          ? `AK-${dayjs(order.createdAt).format('MMDD')}-${String(orderIndex + 1).padStart(2, '0')}`
          : undefined,
        productName: buildGoodsDescription(orderIndex, packageIndex),
        salesPerson: order.salesPerson,
        remark: status === 'IN_STOCK'
          ? '已完成上架，等待集货'
          : status === 'PACKED'
            ? '已完成拼箱，等待发运'
            : '已完成出库，运往目的港',
        serviceType: getServiceTypeLabel(order),
        goodsDescription: buildGoodsDescription(orderIndex, packageIndex),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderUpdatedAt: order.updatedAt,
        orderCreatedAt: order.createdAt,
        displayOrderNo: order.orderNo,
        displaySubOrderNo: subOrderNo,
      };
    });
  });
}
