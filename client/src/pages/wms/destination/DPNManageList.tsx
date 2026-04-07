import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Popover,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { v2PodApi } from '../../../api';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../../components/ListPageToolbar';

type BusinessMode = 'ALL' | 'SEA' | 'AIR';
type DpnStatus = 'DRAFT' | 'PENDING_ASSIGN' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'CANCELLED';
type DeliveryTaskStatus = 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'FAILED' | 'CANCELLED';
type LogisticsFilter = 'ALL' | 'INBOUND' | 'TRANSIT' | 'SIGNED' | 'CANCELLED';
type ExecutionFilter = 'ALL' | 'PENDING' | 'EXECUTING' | 'DONE' | 'CANCELLED';
type DeliveryMethod = 'DELIVERY' | 'SATELLITE_STATION';
type BindMode = 'MANUAL' | 'SCAN';
type DpnRoleType = 'ALL' | 'SENDER' | 'RECEIVER';

interface DpnListRow {
  id: string;
  dpnNo: string;
  businessLine: 'SEA' | 'AIR';
  customerId: string;
  warehouseId: string;
  warehouseName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  totalPieces: number;
  totalWeightKg: number;
  itemCount: number;
  subOrderCount: number;
  dpnStatus: DpnStatus;
  latestTaskNo: string;
  latestTaskStatus: DeliveryTaskStatus | '';
  updatedAt: string;
  createdAt: string;
  jobNos: string[];
  orderNos: string[];
  routeNames: string[];
  remark: string;
}

interface DpnDetailData {
  dpn: any;
  items: any[];
  deliveryTasks: any[];
}

interface DpnCandidateRow {
  subOrderId: string;
  subOrderNo: string;
  orderId: string;
  orderNo: string;
  displayOrderNo: string;
  customerId: string;
  customerName: string;
  businessLine: 'SEA' | 'AIR';
  jobId: string;
  jobNo: string;
  jobStation: string;
  subStatus: string;
  pieces: number;
  weightKg: number;
  updatedAt: string;
}

interface BindTarget {
  id: string;
  dpnNo: string;
  businessLine: 'SEA' | 'AIR';
  customerId?: string;
}

interface DpnDetailRow {
  id: string;
  dpnNo: string;
  dpnRoute: string;
  dpnCreatedAt: string;
  jobStation: string;
  trackingNo: string;
  salesPerson: string;
  userName: string;
  route: string;
  pieces: number;
  dimensionCm: string;
  volumeCbm: number;
  volumeWeightKg: number;
  weightKg: number;
}

interface DpnViewRow extends DpnListRow {
  viewId: string;
  roleType: Exclude<DpnRoleType, 'ALL'>;
  senderStation: string;
  receiverStation: string;
  currentStatusText: string;
  peerStatusText: string;
  currentStationRoleText: string;
}

interface DpnRemarkMeta {
  routeName?: string;
  toStation?: string;
  executeDate?: string;
  logisticsCompany?: string;
  queryPhone?: string;
  driverName?: string;
  driverPhone?: string;
  plateNo?: string;
  note?: string;
}

interface DpnHoverDetail {
  loading: boolean;
  error?: string;
  rows: DpnDetailRow[];
  jobSpans: number[];
}

const AUTO_DRAFT_CUSTOMER_ID = 'CRM-AUTO-DPN-DRAFT';

const LOGISTICS_FILTER_OPTIONS: Array<{ value: LogisticsFilter; label: string }> = [
  { value: 'ALL', label: '选择物流状态' },
  { value: 'INBOUND', label: '选择物流状态' },
  { value: 'TRANSIT', label: '配送中' },
  { value: 'SIGNED', label: '已签收' },
  { value: 'CANCELLED', label: '已取消' },
];

const EXECUTION_FILTER_OPTIONS: Array<{ value: ExecutionFilter; label: string }> = [
  { value: 'ALL', label: '选择执行状态' },
  { value: 'PENDING', label: '待执行' },
  { value: 'EXECUTING', label: '执行中' },
  { value: 'DONE', label: '已执行' },
  { value: 'CANCELLED', label: '已取消' },
];

const DELIVERY_METHOD_OPTIONS = [
  { value: 'DELIVERY', label: '空运口' },
  { value: 'SATELLITE_STATION', label: '陆运口' },
];

const ROLE_FILTER_OPTIONS: Array<{ value: DpnRoleType; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'SENDER', label: '我发出的' },
  { value: 'RECEIVER', label: '发给我的' },
];

const formatTime = (value?: string | null, fallback = '-') => (value ? dayjs(value).format('YYYY/MM/DD HH:mm:ss') : fallback);

const formatNumber = (value: number, digits = 2) => Number(value || 0).toFixed(digits);

const splitCsv = (value: unknown): string[] => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const parseRemarkMeta = (remark: unknown): DpnRemarkMeta => {
  const text = String(remark || '').trim();
  if (!text) return {};

  const meta: DpnRemarkMeta = {};
  text.split('|').map((item) => item.trim()).filter(Boolean).forEach((part) => {
    const [rawKey, ...rest] = part.split(/[:：]/);
    const key = String(rawKey || '').trim();
    const value = rest.join(':').trim();
    if (!key || !value) return;
    if (key === '路线') meta.routeName = value;
    if (key === '发往站点') meta.toStation = value;
    if (key === '执行日期') meta.executeDate = value;
    if (key === '物流公司') meta.logisticsCompany = value;
    if (key === '查询电话') meta.queryPhone = value;
    if (key === '司机名称') meta.driverName = value;
    if (key === '司机电话') meta.driverPhone = value;
    if (key === '车牌') meta.plateNo = value;
    if (key === '备注') meta.note = value;
  });
  return meta;
};

const calcRowSpan = <T,>(rows: T[], getKey: (row: T) => string): number[] => {
  const spans = new Array(rows.length).fill(0);
  let index = 0;
  while (index < rows.length) {
    const current = getKey(rows[index]);
    let next = index + 1;
    while (next < rows.length && getKey(rows[next]) === current) next += 1;
    spans[index] = next - index;
    index = next;
  }
  return spans;
};

const buildRouteDisplay = (row: Pick<DpnListRow, 'routeNames' | 'warehouseName' | 'remark'>) => {
  const meta = parseRemarkMeta(row.remark);
  return row.routeNames[0] || meta.toStation || meta.routeName || row.warehouseName || '-';
};

const parseRouteStations = (row: Pick<DpnListRow, 'routeNames' | 'warehouseName' | 'remark'>) => {
  const meta = parseRemarkMeta(row.remark);
  const routeText = buildRouteDisplay(row);
  const segments = routeText
    .split(/->|→|-/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    senderStation: segments[0] || row.warehouseName || '-',
    receiverStation: meta.toStation || segments[segments.length - 1] || row.warehouseName || '-',
  };
};

const buildLogisticsStatusText = (row: DpnListRow) => {
  const routeTail = parseRemarkMeta(row.remark).toStation || row.routeNames[0] || row.warehouseName || '';
  if (row.dpnStatus === 'SIGNED') return `已入库 ${routeTail}`.trim();
  if (row.dpnStatus === 'ASSIGNED' || row.dpnStatus === 'IN_TRANSIT') return `配送中 ${routeTail}`.trim();
  if (row.dpnStatus === 'CANCELLED') return `已取消 ${routeTail}`.trim();
  return `已入库 ${routeTail}`.trim();
};

const buildExecutionStatusText = (row: DpnListRow) => {
  const routeTail = parseRemarkMeta(row.remark).toStation || row.routeNames[0] || row.warehouseName || '';
  if (row.dpnStatus === 'SIGNED') return `已执行 ${routeTail}`.trim();
  if (row.dpnStatus === 'ASSIGNED' || row.dpnStatus === 'IN_TRANSIT') return `执行中 ${routeTail}`.trim();
  if (row.dpnStatus === 'CANCELLED') return `已取消 ${routeTail}`.trim();
  return `待执行 ${routeTail}`.trim();
};

const buildSenderStatusText = (row: DpnListRow) => {
  if (row.dpnStatus === 'DRAFT') return '待绑定';
  if (row.dpnStatus === 'PENDING_ASSIGN') return row.itemCount > 0 ? '待发运' : '待绑定';
  if (row.dpnStatus === 'ASSIGNED') return '待发运';
  if (row.dpnStatus === 'IN_TRANSIT') return '运输中';
  if (row.dpnStatus === 'DELIVERED') return '已到达';
  if (row.dpnStatus === 'SIGNED') return '已入库';
  return '已取消';
};

const buildReceiverStatusText = (row: DpnListRow) => {
  if (row.dpnStatus === 'DRAFT' || row.dpnStatus === 'PENDING_ASSIGN') return '未开始';
  if (row.dpnStatus === 'ASSIGNED' || row.dpnStatus === 'IN_TRANSIT') return '待接收';
  if (row.dpnStatus === 'DELIVERED') return '待入库';
  if (row.dpnStatus === 'SIGNED') return '已入库';
  return '已取消';
};

const buildUnifiedStatusText = (row: DpnListRow) => {
  if (row.dpnStatus === 'DRAFT') return '待绑定';
  if (row.dpnStatus === 'PENDING_ASSIGN') return row.itemCount > 0 ? '待发运' : '待绑定';
  if (row.dpnStatus === 'ASSIGNED') return '待发运';
  if (row.dpnStatus === 'IN_TRANSIT') return '运输中';
  if (row.dpnStatus === 'DELIVERED') return '已到达';
  if (row.dpnStatus === 'SIGNED') return '已入库';
  return '已取消';
};

const buildResponsibleStation = (
  row: DpnListRow,
  senderStation: string,
  receiverStation: string,
) => {
  if (row.dpnStatus === 'DRAFT' || row.dpnStatus === 'PENDING_ASSIGN' || row.dpnStatus === 'ASSIGNED' || row.dpnStatus === 'IN_TRANSIT') {
    return senderStation;
  }
  if (row.dpnStatus === 'DELIVERED' || row.dpnStatus === 'SIGNED') {
    return receiverStation;
  }
  return '-';
};

const buildRoleTagColor = (roleType: Exclude<DpnRoleType, 'ALL'>) => (roleType === 'SENDER' ? 'processing' : 'success');

const buildStatusTagColor = (statusText: string) => {
  if (statusText.includes('取消')) return 'default';
  if (statusText.includes('完成')) return 'success';
  if (statusText.includes('运输中') || statusText.includes('待入库')) return 'processing';
  if (statusText.includes('待')) return 'warning';
  return 'default';
};

const buildHoverDetailFromItems = (dpn: any, items: any[]): DpnHoverDetail => {
  const rows = items.map((item) => mapDetailItemRow(dpn, item));
  return {
    loading: false,
    rows,
    jobSpans: calcRowSpan(rows, (row) => row.jobStation),
  };
};

const buildMockDetailItems = (
  jobNo: string,
  polName: string,
  podName: string,
  serialPrefix: string,
  salesPerson: string,
  startIndex: number,
) => ([
  {
    id: `${serialPrefix}-${startIndex}`,
    job_no: jobNo,
    sub_order_no: `${serialPrefix}-${String(startIndex).padStart(2, '0')}`,
    sales_user_name: salesPerson,
    creator_user_name: salesPerson,
    pol_name: polName,
    pod_name: podName,
    pieces: 1,
    dimension_cm: '40*35*41.5',
    pkg_volume_cbm: 0.06,
    pkg_volume_weight_kg: 40,
    pkg_gross_weight_kg: 10,
  },
  {
    id: `${serialPrefix}-${startIndex + 1}`,
    job_no: jobNo,
    sub_order_no: `${serialPrefix}-${String(startIndex + 1).padStart(2, '0')}`,
    sales_user_name: salesPerson,
    creator_user_name: salesPerson,
    pol_name: polName,
    pod_name: podName,
    pieces: 1,
    dimension_cm: '45*40*40',
    pkg_volume_cbm: 0.07,
    pkg_volume_weight_kg: 48,
    pkg_gross_weight_kg: 12,
  },
]);

const MOCK_DPN_DETAIL_MAP: Record<string, DpnDetailData> = {
  'mock-dpn-bind': {
    dpn: { dpn_no: 'DPN-20260326-1001', created_at: '2026-03-26 09:15:00', remark: '发往站点:ABV STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver' },
    items: buildMockDetailItems('S-JOB26030011', '拉各斯到达站', '阿布贾卫星站', 'S-20260326990001', '销售A', 1),
    deliveryTasks: [],
  },
  'mock-dpn-dispatch': {
    dpn: { dpn_no: 'DPN-20260326-1002', created_at: '2026-03-26 10:00:00', remark: '发往站点:KAN STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver' },
    items: buildMockDetailItems('S-JOB26030012', '拉各斯到达站', '卡诺卫星站', 'S-20260326990002', '销售B', 1),
    deliveryTasks: [],
  },
  'mock-dpn-transit': {
    dpn: { dpn_no: 'DPN-20260326-1003', created_at: '2026-03-26 11:00:00', remark: '发往站点:IBA STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver' },
    items: buildMockDetailItems('S-JOB26030013', '拉各斯到达站', '伊巴丹卫星站', 'S-20260326990003', '销售C', 1),
    deliveryTasks: [],
  },
  'mock-dpn-inbound': {
    dpn: { dpn_no: 'DPN-20260326-1004', created_at: '2026-03-26 12:00:00', remark: '发往站点:PHC STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver' },
    items: buildMockDetailItems('S-JOB26030014', '拉各斯到达站', '哈科特港卫星站', 'S-20260326990004', '销售D', 1),
    deliveryTasks: [],
  },
  'mock-dpn-done': {
    dpn: { dpn_no: 'DPN-20260326-1005', created_at: '2026-03-26 13:00:00', remark: '发往站点:ACC STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver' },
    items: buildMockDetailItems('S-JOB26030015', '拉各斯到达站', '阿克拉卫星站', 'S-20260326990005', '销售E', 1),
    deliveryTasks: [],
  },
  'mock-dpn-cancel': {
    dpn: { dpn_no: 'DPN-20260326-1006', created_at: '2026-03-26 14:00:00', remark: '发往站点:BEN STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver' },
    items: buildMockDetailItems('S-JOB26030016', '拉各斯到达站', '贝宁卫星站', 'S-20260326990006', '销售F', 1),
    deliveryTasks: [],
  },
};

const MOCK_DPN_ROWS: DpnListRow[] = [
  {
    id: 'mock-dpn-bind',
    dpnNo: 'DPN-20260326-1001',
    businessLine: 'SEA',
    customerId: 'MOCK-CUST-1',
    warehouseId: 'LAG-WH-01',
    warehouseName: '拉各斯到达站',
    recipientName: 'Abuja Station',
    recipientPhone: '08000000001',
    recipientAddress: 'ABV STA',
    totalPieces: 2,
    totalWeightKg: 22,
    itemCount: 0,
    subOrderCount: 2,
    dpnStatus: 'DRAFT',
    latestTaskNo: '-',
    latestTaskStatus: '',
    updatedAt: '2026-03-26 09:20:00',
    createdAt: '2026-03-26 09:15:00',
    jobNos: ['S-JOB26030011'],
    orderNos: ['S-20260326990001-01', 'S-20260326990001-02'],
    routeNames: ['拉各斯到达站->阿布贾卫星站'],
    remark: '发往站点:ABV STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver',
  },
  {
    id: 'mock-dpn-dispatch',
    dpnNo: 'DPN-20260326-1002',
    businessLine: 'SEA',
    customerId: 'MOCK-CUST-2',
    warehouseId: 'LAG-WH-01',
    warehouseName: '拉各斯到达站',
    recipientName: 'Kano Station',
    recipientPhone: '08000000002',
    recipientAddress: 'KAN STA',
    totalPieces: 2,
    totalWeightKg: 22,
    itemCount: 2,
    subOrderCount: 2,
    dpnStatus: 'ASSIGNED',
    latestTaskNo: 'TK-20260326-1002',
    latestTaskStatus: 'ACCEPTED',
    updatedAt: '2026-03-26 10:20:00',
    createdAt: '2026-03-26 10:00:00',
    jobNos: ['S-JOB26030012'],
    orderNos: ['S-20260326990002-01', 'S-20260326990002-02'],
    routeNames: ['拉各斯到达站->卡诺卫星站'],
    remark: '发往站点:KAN STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver',
  },
  {
    id: 'mock-dpn-transit',
    dpnNo: 'DPN-20260326-1003',
    businessLine: 'AIR',
    customerId: 'MOCK-CUST-3',
    warehouseId: 'LAG-WH-01',
    warehouseName: '拉各斯到达站',
    recipientName: 'Ibadan Station',
    recipientPhone: '08000000003',
    recipientAddress: 'IBA STA',
    totalPieces: 2,
    totalWeightKg: 22,
    itemCount: 2,
    subOrderCount: 2,
    dpnStatus: 'IN_TRANSIT',
    latestTaskNo: 'TK-20260326-1003',
    latestTaskStatus: 'IN_TRANSIT',
    updatedAt: '2026-03-26 11:20:00',
    createdAt: '2026-03-26 11:00:00',
    jobNos: ['S-JOB26030013'],
    orderNos: ['S-20260326990003-01', 'S-20260326990003-02'],
    routeNames: ['拉各斯到达站->伊巴丹卫星站'],
    remark: '发往站点:IBA STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver',
  },
  {
    id: 'mock-dpn-inbound',
    dpnNo: 'DPN-20260326-1004',
    businessLine: 'SEA',
    customerId: 'MOCK-CUST-4',
    warehouseId: 'LAG-WH-01',
    warehouseName: '拉各斯到达站',
    recipientName: 'Port Harcourt Station',
    recipientPhone: '08000000004',
    recipientAddress: 'PHC STA',
    totalPieces: 2,
    totalWeightKg: 22,
    itemCount: 2,
    subOrderCount: 2,
    dpnStatus: 'DELIVERED',
    latestTaskNo: 'TK-20260326-1004',
    latestTaskStatus: 'DELIVERED',
    updatedAt: '2026-03-26 12:20:00',
    createdAt: '2026-03-26 12:00:00',
    jobNos: ['S-JOB26030014'],
    orderNos: ['S-20260326990004-01', 'S-20260326990004-02'],
    routeNames: ['拉各斯到达站->哈科特港卫星站'],
    remark: '发往站点:PHC STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver',
  },
  {
    id: 'mock-dpn-done',
    dpnNo: 'DPN-20260326-1005',
    businessLine: 'AIR',
    customerId: 'MOCK-CUST-5',
    warehouseId: 'LAG-WH-01',
    warehouseName: '拉各斯到达站',
    recipientName: 'Accra Station',
    recipientPhone: '08000000005',
    recipientAddress: 'ACC STA',
    totalPieces: 2,
    totalWeightKg: 22,
    itemCount: 2,
    subOrderCount: 2,
    dpnStatus: 'SIGNED',
    latestTaskNo: 'TK-20260326-1005',
    latestTaskStatus: 'SIGNED',
    updatedAt: '2026-03-26 13:20:00',
    createdAt: '2026-03-26 13:00:00',
    jobNos: ['S-JOB26030015'],
    orderNos: ['S-20260326990005-01', 'S-20260326990005-02'],
    routeNames: ['拉各斯到达站->阿克拉卫星站'],
    remark: '发往站点:ACC STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver',
  },
  {
    id: 'mock-dpn-cancel',
    dpnNo: 'DPN-20260326-1006',
    businessLine: 'SEA',
    customerId: 'MOCK-CUST-6',
    warehouseId: 'LAG-WH-01',
    warehouseName: '拉各斯到达站',
    recipientName: 'Benin Station',
    recipientPhone: '08000000006',
    recipientAddress: 'BEN STA',
    totalPieces: 2,
    totalWeightKg: 22,
    itemCount: 2,
    subOrderCount: 2,
    dpnStatus: 'CANCELLED',
    latestTaskNo: 'TK-20260326-1006',
    latestTaskStatus: 'CANCELLED',
    updatedAt: '2026-03-26 14:20:00',
    createdAt: '2026-03-26 14:00:00',
    jobNos: ['S-JOB26030016'],
    orderNos: ['S-20260326990006-01', 'S-20260326990006-02'],
    routeNames: ['拉各斯到达站->贝宁卫星站'],
    remark: '发往站点:BEN STA | 执行日期:2026-03-26 | 物流公司:Mock Logistics | 司机名称:Mock Driver',
  },
];

const mapDpnListRow = (raw: any): DpnListRow => {
  const remark = String(raw.remark || '');
  const routeNames = splitCsv(raw.route_names || raw.routeNames);
  const meta = parseRemarkMeta(remark);
  const fallbackRoutes = [meta.toStation, meta.routeName].filter(Boolean) as string[];

  return {
    id: String(raw.id),
    dpnNo: String(raw.dpn_no || raw.dpnNo || raw.id),
    businessLine: String(raw.business_line || raw.businessLine || 'SEA').toUpperCase() === 'AIR' ? 'AIR' : 'SEA',
    customerId: String(raw.customer_id || raw.customerId || ''),
    warehouseId: String(raw.warehouse_id || raw.warehouseId || ''),
    warehouseName: String(raw.warehouse_name || raw.warehouseName || '-'),
    recipientName: String(raw.recipient_name || raw.recipientName || '-'),
    recipientPhone: String(raw.recipient_phone || raw.recipientPhone || '-'),
    recipientAddress: String(raw.recipient_address || raw.recipientAddress || '-'),
    totalPieces: Number(raw.total_pieces || raw.totalPieces || 0),
    totalWeightKg: Number(raw.total_weight_kg || raw.totalWeightKg || 0),
    itemCount: Number(raw.item_count || raw.itemCount || 0),
    subOrderCount: Number(raw.sub_order_count || raw.subOrderCount || 0),
    dpnStatus: String(raw.dpn_status || raw.dpnStatus || 'PENDING_ASSIGN') as DpnStatus,
    latestTaskNo: String(raw.latest_task_no || raw.latestTaskNo || '-'),
    latestTaskStatus: String(raw.latest_task_status || raw.latestTaskStatus || '') as DeliveryTaskStatus | '',
    updatedAt: String(raw.updated_at || raw.updatedAt || ''),
    createdAt: String(raw.created_at || raw.createdAt || ''),
    jobNos: splitCsv(raw.job_nos || raw.jobNos),
    orderNos: splitCsv(raw.order_nos || raw.orderNos),
    routeNames: routeNames.length ? routeNames : fallbackRoutes,
    remark,
  };
};

const mapCandidateRow = (raw: any): DpnCandidateRow => ({
  subOrderId: String(raw.sub_order_id || raw.subOrderId || raw.id || ''),
  subOrderNo: String(raw.sub_order_no || raw.subOrderNo || '-'),
  orderId: String(raw.order_id || raw.orderId || ''),
  orderNo: String(raw.order_no || raw.orderNo || '-'),
  displayOrderNo: String(raw.display_order_no || raw.displayOrderNo || ''),
  customerId: String(raw.customer_id || raw.customerId || ''),
  customerName: String(raw.customer_name || raw.customerName || '-'),
  businessLine: String(raw.business_line || raw.businessLine || 'SEA').toUpperCase() === 'AIR' ? 'AIR' : 'SEA',
  jobId: String(raw.job_id || raw.jobId || ''),
  jobNo: String(raw.job_no || raw.jobNo || '未绑定任务'),
  jobStation: `${String(raw.job_no || raw.jobNo || '未绑定任务')}\n${String(raw.pod_site_name || raw.podSiteName || raw.pol_site_name || raw.polSiteName || '-')}`,
  subStatus: String(raw.sub_status || raw.subStatus || '-'),
  pieces: Number(raw.pieces || 0),
  weightKg: Number(raw.actual_weight_kg || raw.weight_kg || raw.weightKg || 0),
  updatedAt: String(raw.updated_at || raw.updatedAt || ''),
});

const mapDetailItemRow = (dpn: any, raw: any): DpnDetailRow => {
  const route = [raw.pol_name, raw.pod_name].filter(Boolean).join('→') || raw.route_code || raw.order_route_code || '-';
  const station = raw.pod_name || raw.pol_name || '-';
  return {
    id: String(raw.id || raw.sub_order_id || raw.sub_order_no),
    dpnNo: String(dpn?.dpn_no || '-'),
    dpnRoute: parseRemarkMeta(dpn?.remark).toStation || route,
    dpnCreatedAt: formatTime(dpn?.created_at),
    jobStation: `${raw.job_no || '-'}\n${station}`,
    trackingNo: String(raw.sub_order_no || raw.display_order_no || raw.order_no || '-'),
    salesPerson: String(raw.sales_user_name || '-'),
    userName: String(raw.creator_user_name || raw.sales_user_name || '-'),
    route,
    pieces: Number(raw.pieces || raw.sub_pieces || 0),
    dimensionCm: String(raw.dimension_cm || '-'),
    volumeCbm: Number(raw.pkg_volume_cbm || raw.sub_volume_cbm || 0),
    volumeWeightKg: Number(raw.pkg_volume_weight_kg || raw.sub_volume_weight_kg || 0),
    weightKg: Number(raw.pkg_gross_weight_kg || raw.sub_actual_weight_kg || raw.weight_kg || 0),
  };
};

interface DPNManageListProps {
  businessMode?: BusinessMode;
  warehouseId?: string;
}

export const DPNManageList: React.FC<DPNManageListProps> = ({ businessMode = 'ALL', warehouseId }) => {
  const { token } = theme.useToken();
  const [messageApi, messageContext] = message.useMessage();
  const createBusinessLine = businessMode === 'AIR' ? 'AIR' : 'SEA';

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DpnListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [logisticsFilter, setLogisticsFilter] = useState<LogisticsFilter>('ALL');
  const [executionFilter, setExecutionFilter] = useState<ExecutionFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<DpnRoleType>('ALL');
  const [keyword, setKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  const [bindOpen, setBindOpen] = useState(false);
  const [bindMode, setBindMode] = useState<BindMode>('MANUAL');
  const [bindSubmitting, setBindSubmitting] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [bindTarget, setBindTarget] = useState<BindTarget | null>(null);
  const [bindKeyword, setBindKeyword] = useState('');
  const [bindRows, setBindRows] = useState<DpnCandidateRow[]>([]);
  const [bindTotal, setBindTotal] = useState(0);
  const [bindPage, setBindPage] = useState(1);
  const [bindPageSize, setBindPageSize] = useState(10);
  const [bindSelectedKeys, setBindSelectedKeys] = useState<React.Key[]>([]);
  const [bindSelectedMap, setBindSelectedMap] = useState<Record<string, DpnCandidateRow>>({});

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignTarget, setAssignTarget] = useState<DpnListRow | null>(null);
  const [assignForm] = Form.useForm();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<DpnDetailData | null>(null);
  const [detailRow, setDetailRow] = useState<DpnListRow | null>(null);
  const [detailDepartureDate, setDetailDepartureDate] = useState<Dayjs | null>(null);
  const [hoverDetails, setHoverDetails] = useState<Record<string, DpnHoverDetail>>({});

  const fetchDpns = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize };
      if (routeFilter !== 'ALL') params.route = routeFilter;
      if (logisticsFilter !== 'ALL') params.logisticsStatus = logisticsFilter;
      if (executionFilter !== 'ALL') params.executionStatus = executionFilter;
      if (keyword.trim()) params.keyword = keyword.trim();
      const res: any = await v2PodApi.listDpns(params);
      const dataRows = Array.isArray(res?.data) ? res.data : [];
      const mapped = dataRows.map(mapDpnListRow);
      const existingStatuses = new Set(mapped.map((row) => buildUnifiedStatusText(row)));
      const missingMockRows = MOCK_DPN_ROWS.filter((row) => !existingStatuses.has(buildUnifiedStatusText(row)));
      const nextRows = [...mapped, ...missingMockRows];
      setRows(nextRows);
      setTotal(nextRows.length);
    } catch (err: any) {
      messageApi.error(err?.message || '加载 DPN 列表失败');
    } finally {
      setLoading(false);
    }
  }, [executionFilter, keyword, logisticsFilter, messageApi, page, pageSize, routeFilter]);

  useEffect(() => {
    void fetchDpns();
  }, [fetchDpns]);

  const routeOptions = useMemo(() => {
    const values = Array.from(new Set(rows.flatMap((row) => row.routeNames).filter(Boolean)));
    return [{ value: 'ALL', label: '选择线路' }, ...values.map((value) => ({ value, label: value }))];
  }, [rows]);

  const selectedBindCandidates = useMemo(
    () => bindSelectedKeys.map((key) => bindSelectedMap[String(key)]).filter((item): item is DpnCandidateRow => Boolean(item)),
    [bindSelectedKeys, bindSelectedMap],
  );

  const bindSummary = useMemo(() => ({
    count: selectedBindCandidates.length,
    pieces: selectedBindCandidates.reduce((sum, row) => sum + Number(row.pieces || 0), 0),
    weightKg: selectedBindCandidates.reduce((sum, row) => sum + Number(row.weightKg || 0), 0),
  }), [selectedBindCandidates]);

  const bindJobSpans = useMemo(() => calcRowSpan(bindRows, (row) => row.jobStation), [bindRows]);

  const detailRows = useMemo(() => {
    const dpn = detailData?.dpn;
    const items = Array.isArray(detailData?.items) ? detailData?.items : [];
    return items.map((item) => mapDetailItemRow(dpn, item));
  }, [detailData]);

  const listViewRows = useMemo<DpnViewRow[]>(() => {
    const nextRows = rows.flatMap((row) => {
      const { senderStation, receiverStation } = parseRouteStations(row);

      const senderView: DpnViewRow = {
        ...row,
        viewId: `${row.id}-sender`,
        roleType: 'SENDER',
        senderStation,
        receiverStation,
        currentStatusText: buildUnifiedStatusText(row),
        peerStatusText: '',
        currentStationRoleText: buildResponsibleStation(row, senderStation, receiverStation),
      };

      const receiverView: DpnViewRow = {
        ...row,
        viewId: `${row.id}-receiver`,
        roleType: 'RECEIVER',
        senderStation,
        receiverStation,
        currentStatusText: buildUnifiedStatusText(row),
        peerStatusText: '',
        currentStationRoleText: buildResponsibleStation(row, senderStation, receiverStation),
      };

      return [senderView, receiverView];
    });

    if (roleFilter === 'ALL') return nextRows;
    return nextRows.filter((row) => row.roleType === roleFilter);
  }, [roleFilter, rows]);

  const displayTotal = useMemo(() => {
    if (roleFilter === 'ALL') return total * 2;
    return total;
  }, [roleFilter, total]);

  const detailDpnSpans = useMemo(() => {
    const spans = new Array(detailRows.length).fill(0);
    if (detailRows.length > 0) spans[0] = detailRows.length;
    return spans;
  }, [detailRows]);

  const detailJobSpans = useMemo(() => calcRowSpan(detailRows, (row) => row.jobStation), [detailRows]);

  const detailSummary = useMemo(() => ({
    pieces: detailRows.reduce((sum, row) => sum + Number(row.pieces || 0), 0),
    volume: detailRows.reduce((sum, row) => sum + Number(row.volumeCbm || 0), 0),
    volumeWeight: detailRows.reduce((sum, row) => sum + Number(row.volumeWeightKg || 0), 0),
    weight: detailRows.reduce((sum, row) => sum + Number(row.weightKg || 0), 0),
  }), [detailRows]);

  const openBindDrawer = (target: BindTarget, mode: BindMode = 'MANUAL') => {
    setBindTarget(target);
    setBindMode(mode);
    setBindOpen(true);
    setBindKeyword('');
    setBindRows([]);
    setBindTotal(0);
    setBindPage(1);
    setBindPageSize(10);
    setBindSelectedKeys([]);
    setBindSelectedMap({});
  };

  const closeBindDrawer = () => {
    setBindOpen(false);
    setBindTarget(null);
    setBindMode('MANUAL');
    setBindRows([]);
    setBindTotal(0);
    setBindSelectedKeys([]);
    setBindSelectedMap({});
    setBindKeyword('');
  };

  const fetchBindCandidates = useCallback(async () => {
    if (!bindOpen || !bindTarget) return;
    setBindLoading(true);
    try {
      const params: Record<string, any> = {
        page: bindPage,
        pageSize: bindPageSize,
        businessLine: bindTarget.businessLine,
      };
      if (bindTarget.customerId && bindTarget.customerId !== AUTO_DRAFT_CUSTOMER_ID) {
        params.customerId = bindTarget.customerId;
      }
      if (bindKeyword.trim()) params.keyword = bindKeyword.trim();
      const res: any = await v2PodApi.listDpnCandidates(params);
      const dataRows = Array.isArray(res?.data) ? res.data : [];
      const mapped = dataRows.map(mapCandidateRow);
      setBindRows(mapped);
      setBindTotal(Number(res?.pagination?.total || mapped.length));
    } catch (err: any) {
      messageApi.error(err?.message || '加载可绑定运单失败');
    } finally {
      setBindLoading(false);
    }
  }, [bindKeyword, bindOpen, bindPage, bindPageSize, bindTarget, messageApi]);

  useEffect(() => {
    void fetchBindCandidates();
  }, [fetchBindCandidates]);

  const handleBindSelectionChange = (nextKeys: React.Key[], nextRows: DpnCandidateRow[]) => {
    setBindSelectedKeys(nextKeys);
    setBindSelectedMap((prev) => {
      const next = { ...prev };
      bindRows.forEach((row) => {
        delete next[row.subOrderId];
      });
      nextRows.forEach((row) => {
        next[row.subOrderId] = row;
      });
      return next;
    });
  };

  const handleBindSubOrders = async () => {
    if (!bindTarget) return;
    if (selectedBindCandidates.length === 0) {
      messageApi.warning('请至少选择一个运单');
      return;
    }
    try {
      setBindSubmitting(true);
      await v2PodApi.bindSubOrders(bindTarget.id, {
        subOrderIds: selectedBindCandidates.map((row) => row.subOrderId),
      });
      messageApi.success(`已为 ${bindTarget.dpnNo} 绑定 ${selectedBindCandidates.length} 条运单`);
      closeBindDrawer();
      await fetchDpns();
      if (detailOpen && detailRow?.id === bindTarget.id) {
        await handleViewDetail(detailRow);
      }
    } catch (err: any) {
      messageApi.error(err?.message || '绑定运单失败');
    } finally {
      setBindSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setCreateOpen(true);
    createForm.resetFields();
    createForm.setFieldsValue({
      deliveryMethod: 'DELIVERY',
      executeDate: dayjs(),
      recipientName: '',
      recipientPhone: '',
      recipientAddress: '',
      toStation: '',
      logisticsCompany: '',
      queryPhone: '',
      driverName: '',
      driverPhone: '',
      plateNo: '',
      remark: '',
    });
  };

  const handleCreateDpn = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const remarkParts = [
        values.toStation ? `发往站点:${String(values.toStation).trim()}` : '',
        values.executeDate ? `执行日期:${dayjs(values.executeDate).format('YYYY-MM-DD')}` : '',
        values.logisticsCompany ? `物流公司:${String(values.logisticsCompany).trim()}` : '',
        values.queryPhone ? `查询电话:${String(values.queryPhone).trim()}` : '',
        values.driverName ? `司机名称:${String(values.driverName).trim()}` : '',
        values.driverPhone ? `司机电话:${String(values.driverPhone).trim()}` : '',
        values.plateNo ? `车牌:${String(values.plateNo).trim()}` : '',
        values.remark ? `备注:${String(values.remark).trim()}` : '',
      ].filter(Boolean);

      const createRes: any = await v2PodApi.createDpnDraft({
        businessLine: createBusinessLine,
        warehouseId: warehouseId || undefined,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        recipientAddress: values.recipientAddress,
        deliveryMethod: values.deliveryMethod as DeliveryMethod,
        currencyCode: 'NGN',
        createdBy: 'U-OPS-US-01',
        remark: remarkParts.join(' | ') || null,
      });

      const created = createRes?.data?.dpn || createRes?.dpn || createRes?.data || {};
      const createdId = created?.id ? String(created.id) : '';
      const createdNo = created?.dpn_no || created?.dpnNo || createdId || '新DPN';
      if (!createdId) throw new Error('创建结果缺少 DPN ID');

      setCreateOpen(false);
      createForm.resetFields();
      messageApi.success(`创建成功：${createdNo}`);
      await fetchDpns();
      openBindDrawer({
        id: createdId,
        dpnNo: createdNo,
        businessLine: createBusinessLine,
        customerId: created?.customer_id ? String(created.customer_id) : AUTO_DRAFT_CUSTOMER_ID,
      }, 'MANUAL');
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || '创建 DPN 失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openAssignModal = (row: DpnListRow) => {
    setAssignTarget(row);
    const meta = parseRemarkMeta(row.remark);
    assignForm.setFieldsValue({
      driverName: meta.driverName || '',
      driverPhone: meta.driverPhone || '',
      driverUserId: 'U-OPS-US-01',
    });
    setAssignOpen(true);
  };

  const handleAssignTask = async () => {
    if (!assignTarget) return;
    try {
      const values = await assignForm.validateFields();
      setAssignLoading(true);
      await v2PodApi.createDeliveryTask({
        dpnId: assignTarget.id,
        driverUserId: values.driverUserId || null,
        driverName: values.driverName || null,
        driverPhone: values.driverPhone || null,
        remark: 'DPN页面执行派单',
      });
      messageApi.success(`${assignTarget.dpnNo} 执行成功`);
      setAssignOpen(false);
      setAssignTarget(null);
      assignForm.resetFields();
      await fetchDpns();
      if (detailOpen && detailRow?.id === assignTarget.id) {
        await handleViewDetail(assignTarget);
      }
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || '执行失败');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleViewDetail = async (row: DpnListRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    setDetailRow(row);
    const meta = parseRemarkMeta(row.remark);
    setDetailDepartureDate(meta.executeDate ? dayjs(meta.executeDate) : null);
    try {
      const mockDetail = MOCK_DPN_DETAIL_MAP[row.id];
      const res: any = mockDetail ? { data: mockDetail } : await v2PodApi.getDpnDetail(row.id);
      setDetailData({
        dpn: res?.data?.dpn || {},
        items: Array.isArray(res?.data?.items) ? res.data.items : [],
        deliveryTasks: Array.isArray(res?.data?.deliveryTasks) ? res.data.deliveryTasks : [],
      });
    } catch (err: any) {
      messageApi.error(err?.message || '加载 DPN 详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrint = (row: DpnListRow) => {
    messageApi.info(`${row.dpnNo} 打印功能待接入`);
  };

  const ensureHoverDetail = useCallback(async (row: DpnViewRow) => {
    const existing = hoverDetails[row.id];
    if (existing?.loading || existing?.rows.length) return;

    setHoverDetails((prev) => ({
      ...prev,
      [row.id]: {
        loading: true,
        rows: [],
        jobSpans: [],
      },
    }));

    try {
      const mockDetail = MOCK_DPN_DETAIL_MAP[row.id];
      const res: any = mockDetail ? { data: mockDetail } : await v2PodApi.getDpnDetail(row.id);
      const dpn = res?.data?.dpn || {};
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      setHoverDetails((prev) => ({
        ...prev,
        [row.id]: buildHoverDetailFromItems(dpn, items),
      }));
    } catch (err: any) {
      setHoverDetails((prev) => ({
        ...prev,
        [row.id]: {
          loading: false,
          error: err?.message || '加载详情失败',
          rows: [],
          jobSpans: [],
        },
      }));
    }
  }, [hoverDetails]);

  const renderHoverDetailContent = (row: DpnViewRow) => {
    const detail = hoverDetails[row.id];
    if (!detail || detail.loading) {
      return (
        <div style={{ width: 420, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="small" />
        </div>
      );
    }

    if (detail.error) {
      return <div style={{ width: 420, color: token.colorError }}>{detail.error}</div>;
    }

    if (detail.rows.length === 0) {
      return <div style={{ width: 420, color: token.colorTextSecondary }}>暂无已绑定运单明细</div>;
    }

    const hoverColumns: ColumnsType<DpnDetailRow> = [
      {
        title: 'JOB/站点',
        key: 'jobStation',
        width: 180,
        onCell: (_record, index) => ({ rowSpan: index === undefined ? 1 : detail.jobSpans[index] }),
        render: (_: unknown, detailRow) => <div style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>{detailRow.jobStation}</div>,
      },
      { title: '单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 180 },
      { title: '业务员', dataIndex: 'salesPerson', key: 'salesPerson', width: 110 },
      { title: '用户', dataIndex: 'userName', key: 'userName', width: 110 },
      { title: '线路', dataIndex: 'route', key: 'route', width: 220 },
      { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 70, align: 'center' },
      { title: '尺寸CM', dataIndex: 'dimensionCm', key: 'dimensionCm', width: 120, align: 'center' },
      { title: '体积CBM', dataIndex: 'volumeCbm', key: 'volumeCbm', width: 100, align: 'right', render: (value: number) => formatNumber(value) },
      { title: '体积重Kg', dataIndex: 'volumeWeightKg', key: 'volumeWeightKg', width: 110, align: 'right', render: (value: number) => formatNumber(value) },
      { title: '重量Kg', dataIndex: 'weightKg', key: 'weightKg', width: 100, align: 'right', render: (value: number) => formatNumber(value) },
    ];

    return (
      <div style={{ width: 1360 }}>
        <div style={{ marginBottom: 8, fontWeight: 700 }}>DPN明细</div>
        <Table<DpnDetailRow>
          rowKey="id"
          size="small"
          dataSource={detail.rows}
          columns={hoverColumns}
          pagination={false}
          scroll={{ x: 1320, y: 320 }}
        />
      </div>
    );
  };

  const renderHoverMetric = (value: React.ReactNode, row: DpnViewRow) => (
    <Popover
      trigger="hover"
      placement="top"
      overlayStyle={{ maxWidth: 1420 }}
      content={renderHoverDetailContent(row)}
      onOpenChange={(open) => {
        if (open) void ensureHoverDetail(row);
      }}
    >
      <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{value}</span>
    </Popover>
  );

  const listColumns: ColumnsType<DpnViewRow> = [
    {
      title: 'DPN',
      key: 'dpn',
      width: 180,
      render: (_, row) => (
        <div>
          <a onClick={() => { void handleViewDetail(row); }} style={{ fontWeight: 700, color: token.colorText }}>
            {row.dpnNo}
          </a>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{formatTime(row.createdAt)}</div>
        </div>
      ),
    },
    {
      title: '类型',
      key: 'role',
      width: 110,
      align: 'center',
      render: (_, row) => (
        <Tag color={buildRoleTagColor(row.roleType)}>
          {row.roleType === 'SENDER' ? '发出' : '接收'}
        </Tag>
      ),
    },
    {
      title: '站点流向',
      key: 'stationRoute',
      width: 220,
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.senderStation} -&gt; {row.receiverStation}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{buildRouteDisplay(row)}</div>
        </div>
      ),
    },
    {
      title: '运单数',
      key: 'itemCount',
      width: 110,
      align: 'right',
      render: (_, row) => renderHoverMetric(row.itemCount || 0, row),
    },
    {
      title: '件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 90,
      align: 'right',
      render: (value: number, row) => renderHoverMetric(value || 0, row),
    },
    {
      title: '重量Kg',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      width: 110,
      align: 'right',
      render: (value: number, row) => renderHoverMetric(formatNumber(value), row),
    },
    {
      title: '当前状态',
      key: 'currentStatus',
      width: 160,
      render: (_, row) => <Tag color={buildStatusTagColor(row.currentStatusText)}>{row.currentStatusText}</Tag>,
    },
    {
      title: '当前责任站点',
      key: 'currentStationRoleText',
      width: 170,
      render: (_, row) => (
        <div style={{ lineHeight: '22px' }}>
          <div style={{ fontWeight: 600 }}>{row.currentStationRoleText}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
            当前处理站点
          </div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 210,
      fixed: 'right',
      render: (_, row) => {
        const unifiedStatus = buildUnifiedStatusText(row);
        const canBind = unifiedStatus === '待绑定' && row.dpnStatus !== 'CANCELLED';
        const canExecute = unifiedStatus === '待发运' && row.itemCount > 0;
        const canInbound = unifiedStatus === '待入库';
        return (
          <Space size={4} wrap>
            {row.roleType === 'SENDER' ? (
              <>
                {canBind ? (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => openBindDrawer({ id: row.id, dpnNo: row.dpnNo, businessLine: row.businessLine, customerId: row.customerId }, 'MANUAL')}
                  >
                    绑定运单
                  </Button>
                ) : canExecute ? (
                  <Button type="link" size="small" onClick={() => openAssignModal(row)}>
                    执行发车
                  </Button>
                ) : (
                  <Button type="link" size="small" onClick={() => { void handleViewDetail(row); }}>
                    查看
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button type="link" size="small" onClick={() => { void handleViewDetail(row); }}>
                  查看
                </Button>
                {canInbound && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => messageApi.info(`请前往 货物入库 > DPN入库 继续处理 ${row.dpnNo}`)}
                  >
                    入库
                  </Button>
                )}
              </>
            )}
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(row)}>
              打印
            </Button>
          </Space>
        );
      },
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (value: string) => dayjs(value).format('YYYY/MM/DD HH:mm'),
    },
  ];

  const bindColumns: ColumnsType<DpnCandidateRow> = [
    {
      title: 'JOB/站点',
      key: 'jobStation',
      width: 170,
      onCell: (_record, index) => ({ rowSpan: index === undefined ? 1 : bindJobSpans[index] }),
      render: (_: unknown, row) => <div style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>{row.jobStation}</div>,
    },
    { title: '运单号', dataIndex: 'subOrderNo', key: 'subOrderNo', width: 180 },
    { title: '订单号', key: 'orderNo', width: 180, render: (_, row) => row.displayOrderNo || row.orderNo || '-' },
    { title: '客户', dataIndex: 'customerName', key: 'customerName', width: 180 },
    { title: '状态', dataIndex: 'subStatus', key: 'subStatus', width: 120, render: (value: string) => <Tag>{value || '-'}</Tag> },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'right' },
    { title: '重量Kg', dataIndex: 'weightKg', key: 'weightKg', width: 100, align: 'right', render: (value: number) => formatNumber(value) },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180, render: (value: string) => formatTime(value) },
  ];

  const detailColumns: ColumnsType<DpnDetailRow> = [
    {
      title: 'DPN',
      key: 'dpn',
      width: 170,
      onCell: (_record, index) => ({ rowSpan: index === undefined ? 1 : detailDpnSpans[index] }),
      render: (_: unknown, row) => (
        <div style={{ fontWeight: 700 }}>
          <div>{row.dpnNo}</div>
          <div>{row.dpnRoute}</div>
          <div style={{ fontWeight: 500 }}>{row.dpnCreatedAt}</div>
        </div>
      ),
    },
    {
      title: 'JOB/站点',
      key: 'jobStation',
      width: 170,
      onCell: (_record, index) => ({ rowSpan: index === undefined ? 1 : detailJobSpans[index] }),
      render: (_: unknown, row) => <div style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>{row.jobStation}</div>,
    },
    { title: '单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 160 },
    { title: '业务员', dataIndex: 'salesPerson', key: 'salesPerson', width: 130 },
    { title: '用户', dataIndex: 'userName', key: 'userName', width: 130 },
    { title: '线路', dataIndex: 'route', key: 'route', width: 190 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' },
    { title: '尺寸CM', dataIndex: 'dimensionCm', key: 'dimensionCm', width: 120, align: 'center' },
    { title: '体积CBM', dataIndex: 'volumeCbm', key: 'volumeCbm', width: 110, align: 'right', render: (value: number) => formatNumber(value) },
    { title: '体积重Kg', dataIndex: 'volumeWeightKg', key: 'volumeWeightKg', width: 120, align: 'right', render: (value: number) => formatNumber(value) },
    { title: '重量Kg', dataIndex: 'weightKg', key: 'weightKg', width: 110, align: 'right', render: (value: number) => formatNumber(value) },
  ];

  const detailMeta = parseRemarkMeta(detailData?.dpn?.remark || detailRow?.remark);
  const detailCanBind = detailRow && detailRow.dpnStatus !== 'CANCELLED';
  const detailCanAssign = detailRow && detailRow.dpnStatus === 'PENDING_ASSIGN' && detailRow.itemCount > 0;

  return (
    <div>
      {messageContext}

      <Card
        size="small"
        bordered={false}
        style={{
          marginBottom: 10,
          background: '#f0f7ff',
          border: `1px solid ${token.colorPrimaryBorder}`,
        }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <div style={{ fontWeight: 700, color: token.colorPrimary }}>DPN跨站点转运协同说明</div>
          <div style={{ color: token.colorText }}>
            DPN管理按当前站点分为"我发出的"和"发给我的"。统一流程为：待绑定→待发运→运输中→已到达→待入库→已入库；发出侧负责建单、绑单、发车，接收侧负责确认到达、入库与异常处理。
          </div>
          <Radio.Group
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={ROLE_FILTER_OPTIONS}
          />
          <Space size={[8, 8]} wrap>
            <Tag color="processing">统一流程：待绑定</Tag>
            <Tag color="processing">待发运</Tag>
            <Tag color="processing">运输中</Tag>
            <Tag color="cyan">已到达</Tag>
            <Tag color="success">待入库</Tag>
            <Tag color="success">已入库</Tag>
          </Space>
        </Space>
      </Card>

      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 320px" minWidth={280}>
              <Input
                placeholder="输入DPN号/任务号/运单号/站点"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={() => {
                  setPage(1);
                  void fetchDpns();
                }}
                allowClear
                prefix={<SearchOutlined />}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={160}>
              <Select
                value={routeFilter}
                onChange={setRouteFilter}
                style={{ width: '100%' }}
                options={routeOptions}
                optionFilterProp="label"
                showSearch
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={150}>
              <Select value={logisticsFilter} onChange={setLogisticsFilter} style={{ width: '100%' }} options={LOGISTICS_FILTER_OPTIONS} />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={150}>
              <Select value={executionFilter} onChange={setExecutionFilter} style={{ width: '100%' }} options={EXECUTION_FILTER_OPTIONS} />
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                setPage(1);
                void fetchDpns();
              }}
            >
              查询
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setPage(1);
                void fetchDpns();
              }}
            >
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              创建DPN任务
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      <Table<DpnViewRow>
        rowKey="viewId"
        columns={listColumns}
        dataSource={listViewRows}
        loading={loading}
        size="small"
        scroll={{ x: 1800 }}
        pagination={{
          current: page,
          pageSize,
          total: displayTotal,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条角色记录`,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
          },
        }}
      />

      <Modal
        title="创建DPN"
        open={createOpen}
        width={980}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => { void handleCreateDpn(); }}
        okText="确定"
        cancelText="取消"
        confirmLoading={createSubmitting}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="DPN">
                <Input value="自动生成" disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="recipientName" label="发至 名字" rules={[{ required: true, message: '请输入姓名' }]}> 
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="toStation" label="发往站点" rules={[{ required: true, message: '请输入发往站点' }]}> 
                <Input placeholder="例如 ABUJ STA" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="recipientPhone" label="发至 电话" rules={[{ required: true, message: '请输入电话' }]}> 
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="executeDate" label="执行日期">
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="选择" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="recipientAddress" label="发至 地址" rules={[{ required: true, message: '请输入地址' }]}> 
                <Input.TextArea rows={2} placeholder="录入" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="deliveryMethod" label="运输方式" rules={[{ required: true, message: '请选择运输方式' }]}> 
                <Radio.Group
                  options={DELIVERY_METHOD_OPTIONS}
                  optionType="default"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logisticsCompany" label="物流公司">
                <Input placeholder="选择" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Row gutter={12}>
                <Col span={24}>
                  <Form.Item name="queryPhone" label="查询电话">
                    <Input placeholder="录入" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="driverName" label="司机名称">
                    <Input placeholder="录入" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="driverPhone" label="司机电话">
                    <Input placeholder="录入" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="plateNo" label="车牌">
                    <Input placeholder="录入" />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Drawer
        title={bindTarget ? `绑定运单 - ${bindTarget.dpnNo}` : '绑定运单'}
        width={1200}
        open={bindOpen}
        onClose={closeBindDrawer}
        destroyOnClose
        extra={(
          <Space>
            <Button onClick={closeBindDrawer}>取消</Button>
            <Button type="primary" loading={bindSubmitting} onClick={() => { void handleBindSubOrders(); }}>
              提交绑定
            </Button>
          </Space>
        )}
      >
        <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
          <Row gutter={[8, 8]} align="middle">
            <Col>
              <Space.Compact>
                <Button type={bindMode === 'MANUAL' ? 'primary' : 'default'} onClick={() => setBindMode('MANUAL')}>
                  手动添加运单
                </Button>
                <Button type={bindMode === 'SCAN' ? 'primary' : 'default'} icon={<ScanOutlined />} onClick={() => setBindMode('SCAN')}>
                  扫描添加运单
                </Button>
              </Space.Compact>
            </Col>
            <Col flex="auto">
              <Input
                placeholder={bindMode === 'SCAN' ? '扫描运单号后回车' : '输入运单号/订单号查询'}
                value={bindKeyword}
                onChange={(e) => setBindKeyword(e.target.value)}
                onPressEnter={() => {
                  setBindPage(1);
                  void fetchBindCandidates();
                }}
                allowClear
                prefix={bindMode === 'SCAN' ? <ScanOutlined /> : <SearchOutlined />}
              />
            </Col>
            <Col>
              <Button icon={<ReloadOutlined />} onClick={() => {
                setBindKeyword('');
                setBindPage(1);
              }}>
                重置筛选
              </Button>
            </Col>
          </Row>
        </Card>

        <Table<DpnCandidateRow>
          rowKey="subOrderId"
          size="small"
          loading={bindLoading}
          columns={bindColumns}
          dataSource={bindRows}
          scroll={{ x: 980, y: 320 }}
          rowSelection={{
            selectedRowKeys: bindSelectedKeys,
            preserveSelectedRowKeys: true,
            onChange: (nextKeys, nextRows) => handleBindSelectionChange(nextKeys, nextRows as DpnCandidateRow[]),
          }}
          pagination={{
            current: bindPage,
            pageSize: bindPageSize,
            total: bindTotal,
            showSizeChanger: true,
            showTotal: (value) => `可选 ${value} 条`,
            onChange: (nextPage, nextSize) => {
              setBindPage(nextPage);
              setBindPageSize(nextSize);
            },
          }}
        />

        <Space size={8} style={{ marginTop: 8 }}>
          <Tag color="purple">{bindMode === 'SCAN' ? '扫描添加' : '手动添加'}</Tag>
          <Tag color="blue">已选运单 {bindSummary.count}</Tag>
          <Tag>件数 {bindSummary.pieces}</Tag>
          <Tag color="processing">重量 {formatNumber(bindSummary.weightKg)} kg</Tag>
        </Space>
      </Drawer>

      <Modal
        title={assignTarget ? `执行 - ${assignTarget.dpnNo}` : '执行'}
        open={assignOpen}
        onCancel={() => {
          setAssignOpen(false);
          setAssignTarget(null);
          assignForm.resetFields();
        }}
        onOk={() => { void handleAssignTask(); }}
        okText="确认执行"
        cancelText="取消"
        confirmLoading={assignLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={assignForm}>
          <Form.Item name="driverName" label="司机名称" rules={[{ required: true, message: '请输入司机名称' }]}> 
            <Input placeholder="录入" />
          </Form.Item>
          <Form.Item name="driverPhone" label="司机电话" rules={[{ required: true, message: '请输入司机电话' }]}> 
            <Input placeholder="录入" />
          </Form.Item>
          <Form.Item name="driverUserId" label="司机账号ID">
            <Input placeholder="默认 U-OPS-US-01" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="DPN详情"
        width={1600}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailData(null);
          setDetailRow(null);
        }}
        destroyOnClose
      >
        <Space size={[12, 12]} wrap style={{ marginBottom: 12 }}>
          {detailRow && (
            <Button
              icon={<PlusOutlined />}
              disabled={!detailCanBind}
              onClick={() => openBindDrawer({ id: detailRow.id, dpnNo: detailRow.dpnNo, businessLine: detailRow.businessLine, customerId: detailRow.customerId }, 'MANUAL')}
            >
              手动添加
            </Button>
          )}
          {detailRow && (
            <Button
              icon={<ScanOutlined />}
              disabled={!detailCanBind}
              onClick={() => openBindDrawer({ id: detailRow.id, dpnNo: detailRow.dpnNo, businessLine: detailRow.businessLine, customerId: detailRow.customerId }, 'SCAN')}
            >
              扫描添加
            </Button>
          )}
          <Space>
            <span>离库日期</span>
            <DatePicker value={detailDepartureDate} format="YYYY-MM-DD" placeholder="选择" onChange={setDetailDepartureDate} />
          </Space>
          {detailCanAssign && detailRow && (
            <Button type="primary" icon={<SendOutlined />} onClick={() => openAssignModal(detailRow)}>
              执行
            </Button>
          )}
        </Space>

        <div style={{ marginBottom: 12, color: token.colorTextSecondary }}>
          <Space size={24} wrap>
            <span>DPN: {detailData?.dpn?.dpn_no || detailRow?.dpnNo || '-'}</span>
            <span>发往站点: {detailMeta.toStation || buildRouteDisplay(detailRow || { routeNames: [], warehouseName: '-', remark: '' })}</span>
            <span>物流公司: {detailMeta.logisticsCompany || '-'}</span>
            <span>司机: {detailMeta.driverName || '-'}</span>
            <span>司机电话: {detailMeta.driverPhone || '-'}</span>
          </Space>
        </div>

        <Table<DpnDetailRow>
          rowKey="id"
          size="small"
          loading={detailLoading}
          dataSource={detailRows}
          columns={detailColumns}
          bordered
          scroll={{ x: 1650, y: 640 }}
          pagination={false}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={7} align="right">
                  <strong>合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} align="right"><strong>{formatNumber(detailSummary.volume)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right"><strong>{formatNumber(detailSummary.volumeWeight)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right"><strong>{formatNumber(detailSummary.weight)}</strong></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />

        <div style={{ marginTop: 16 }}>
          <Space size={8} wrap>
            <Tag color="blue">件数 {detailSummary.pieces}</Tag>
            <Tag>体积 {formatNumber(detailSummary.volume)} CBM</Tag>
            <Tag color="processing">体积重 {formatNumber(detailSummary.volumeWeight)} Kg</Tag>
            <Tag color="success">重量 {formatNumber(detailSummary.weight)} Kg</Tag>
          </Space>
        </div>
      </Drawer>
    </div>
  );
};
