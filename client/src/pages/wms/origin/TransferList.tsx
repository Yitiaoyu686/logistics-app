import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  message,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  InboxOutlined,
  PlusOutlined,
  PrinterOutlined,
  ScanOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { warehouseApi } from '../../../api';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../../components/ListPageToolbar';
import { buildOriginStockFallbackData, loadOriginFallbackOrders } from './derivedWarehouseData';

const { TextArea } = Input;

type BusinessMode = 'ALL' | 'SEA' | 'AIR';
type TransferDirection = 'SATELLITE_TO_MAIN' | 'MAIN_TO_SATELLITE';
type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED' | 'CANCELLED';
type ShippingMethod = 'DIRECT' | 'VIA_MAIN';
type SelectType = 'order' | 'container';

interface TransferMeta {
  routeName?: string;
  executeDate?: string;
  logisticsCompany?: string;
  queryPhone?: string;
  driverName?: string;
  driverPhone?: string;
  driverAccountId?: string;
  plateNo?: string;
  shippingMethod?: ShippingMethod;
  departureConfirmedAt?: string;
  arrivalConfirmedAt?: string;
  receiveConfirmedAt?: string;
  note?: string;
}

interface FlowRecord {
  time: string;
  action: string;
  operator: string;
  detail?: string;
}

interface TransferOrderItem {
  id: string;
  jobNo?: string;
  subOrderNo: string;
  masterOrderNo: string;
  trackingNo: string;
  clientName: string;
  pieces: number;
  weight: number;
  volume: number;
  route?: string;
}

interface AvailableOrder {
  id: string;
  jobNo: string;
  subOrderNo: string;
  masterOrderNo: string;
  trackingNo: string;
  clientName: string;
  pieces: number;
  weight: number;
  volume: number;
  warehouse: string;
  status: string;
  route: string;
}

interface AvailableContainer {
  id: string;
  containerNo: string;
  type: string;
  warehouse: string;
  orderCount: number;
  pieces: number;
  weight: number;
  volume: number;
  status: string;
}

interface TransferRecord {
  id: string;
  transferNo: string;
  businessLine?: 'SEA' | 'AIR';
  direction: TransferDirection;
  sourceWarehouse: string;
  targetWarehouse: string;
  routeLabel: string;
  orderItems: TransferOrderItem[];
  shippingUnitNo?: string;
  totalPieces: number;
  totalWeight: number;
  totalVolume: number;
  status: TransferStatus;
  shippingMethod?: ShippingMethod;
  reason?: string;
  remark?: string;
  meta: TransferMeta;
  operator?: string;
  createdAt: string;
  updatedAt?: string;
  departureTime?: string;
  arrivalTime?: string;
  confirmedTime?: string;
  isDemo?: boolean;
}

const META_PREFIX = '__TRANSFER_DEMO__';

const STATUS_CONFIG: Record<TransferStatus, { text: string; color: string; icon: React.ReactNode }> = {
  PENDING: { text: '待发运', color: 'gold', icon: <ClockCircleOutlined /> },
  IN_TRANSIT: { text: '运输中', color: 'processing', icon: <CarOutlined /> },
  ARRIVED: { text: '已到达', color: 'cyan', icon: <InboxOutlined /> },
  RECEIVED: { text: '已入库', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { text: '已取消', color: 'default', icon: <ClockCircleOutlined /> },
};

const DIRECTION_OPTIONS = [
  { value: 'ALL', label: '全部方向' },
  { value: 'SATELLITE_TO_MAIN', label: '卫星仓→总仓' },
  { value: 'MAIN_TO_SATELLITE', label: '总仓→卫星仓' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ALL', label: '全部状态' },
  { value: 'PENDING', label: '待发运' },
  { value: 'IN_TRANSIT', label: '运输中' },
  { value: 'ARRIVED', label: '已到达' },
  { value: 'RECEIVED', label: '已入库' },
  { value: 'CANCELLED', label: '已取消' },
] as const;

const REASON_OPTIONS = [
  '集中发货',
  '卫星仓回仓',
  '总仓分拨',
  '库存调整',
  '紧急补货',
  '整箱直发',
  '其他',
];

const WAREHOUSE_OPTIONS = ['广州总仓', '海珠区站点', '白云一号区', '佛山拼货区', '深圳集货区', '番禺转运区'];

const inferDirection = (fromWarehouse: string, toWarehouse: string): TransferDirection => {
  const mainWarehouses = ['广州总仓', '广州仓'];
  return mainWarehouses.some((name) => toWarehouse.includes(name.replace('仓', ''))) ? 'SATELLITE_TO_MAIN' : 'MAIN_TO_SATELLITE';
};

const mapTransferStatus = (status: string): TransferStatus => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'SHIPPED' || normalized === 'IN_TRANSIT') return 'IN_TRANSIT';
  if (normalized === 'ARRIVED') return 'ARRIVED';
  if (normalized === 'RECEIVED') return 'RECEIVED';
  if (normalized === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
};

const parseTransferMeta = (remark?: string | null): TransferMeta => {
  const text = String(remark || '').trim();
  if (!text) return {};

  if (text.startsWith(META_PREFIX)) {
    try {
      return JSON.parse(text.slice(META_PREFIX.length)) as TransferMeta;
    } catch {
      return { note: text };
    }
  }

  const meta: TransferMeta = {};
  text.split('|').map((item) => item.trim()).filter(Boolean).forEach((part) => {
    const [rawKey, ...rest] = part.split(/[:：]/);
    const key = String(rawKey || '').trim();
    const value = rest.join(':').trim();
    if (!key || !value) return;
    if (key === '路线') meta.routeName = value;
    if (key === '执行日期') meta.executeDate = value;
    if (key === '物流公司') meta.logisticsCompany = value;
    if (key === '查询电话') meta.queryPhone = value;
    if (key === '司机名称') meta.driverName = value;
    if (key === '司机电话') meta.driverPhone = value;
    if (key === '司机账号ID') meta.driverAccountId = value;
    if (key === '车牌') meta.plateNo = value;
    if (key === '备注') meta.note = value;
  });

  if (!meta.note && text && !text.includes(':') && !text.includes('：')) {
    meta.note = text;
  }

  return meta;
};

const serializeTransferMeta = (meta: TransferMeta) => {
  const cleanEntries = Object.entries(meta).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
  return cleanEntries.length > 0 ? `${META_PREFIX}${JSON.stringify(Object.fromEntries(cleanEntries))}` : '';
};

const formatDateTime = (value?: string | null, fallback = '-') => (value ? dayjs(value).format('YYYY/MM/DD HH:mm:ss') : fallback);
const formatShortDateTime = (value?: string | null, fallback = '-') => (value ? dayjs(value).format('YYYY/MM/DD HH:mm') : fallback);

const buildLogisticsStatusText = (record: TransferRecord) => {
  switch (record.status) {
    case 'IN_TRANSIT':
      return `运输中 ${record.targetWarehouse}`;
    case 'ARRIVED':
      return `已到达 ${record.targetWarehouse}`;
    case 'RECEIVED':
      return `已入库 ${record.targetWarehouse}`;
    case 'CANCELLED':
      return `已取消 ${record.targetWarehouse}`;
    default:
      return `待绑定 ${record.sourceWarehouse}`;
  }
};

const buildExecutionStatusText = (record: TransferRecord) => {
  if (record.status === 'PENDING' && record.orderItems.length === 0) {
    return '待绑定';
  }

  switch (record.status) {
    case 'IN_TRANSIT':
      return `运输中 ${record.targetWarehouse}`;
    case 'ARRIVED':
      return `待入库 ${record.targetWarehouse}`;
    case 'RECEIVED':
      return `已入库 ${record.targetWarehouse}`;
    case 'CANCELLED':
      return `已取消 ${record.targetWarehouse}`;
    default:
      return `待发运 ${record.sourceWarehouse}`;
  }
};

const buildFlowRecords = (record: TransferRecord): FlowRecord[] => {
  const flows: FlowRecord[] = [
    {
      time: record.createdAt,
      action: '创建调拨单',
      operator: record.operator || '系统',
      detail: `${record.sourceWarehouse} → ${record.targetWarehouse}`,
    },
  ];

  const departureTime = record.departureTime || record.meta.departureConfirmedAt;
  if (departureTime) {
    flows.push({
      time: departureTime,
      action: '发起调拨',
      operator: record.meta.driverName || record.operator || '仓库操作员',
      detail: [record.meta.logisticsCompany, record.meta.plateNo].filter(Boolean).join(' / ') || undefined,
    });
  }

  const arrivalTime = record.arrivalTime || record.meta.arrivalConfirmedAt;
  if (arrivalTime) {
    flows.push({
      time: arrivalTime,
      action: '确认到达',
      operator: record.operator || '仓库操作员',
      detail: record.targetWarehouse,
    });
  }

  const receiveTime = record.confirmedTime || record.meta.receiveConfirmedAt;
  if (receiveTime) {
    flows.push({
      time: receiveTime,
      action: '确认入库',
      operator: record.operator || '仓库操作员',
      detail: record.targetWarehouse,
    });
  }

  return flows.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf());
};

const mapTransferRow = (raw: any): TransferRecord => {
  const meta = parseTransferMeta(raw.remark);
  const orderItems: TransferOrderItem[] = Array.isArray(raw.items)
    ? raw.items.map((item: any, index: number) => ({
        id: String(item.id || `${raw.id}-item-${index}`),
        jobNo: String(item.jobNo || item.job_no || ''),
        subOrderNo: String(item.subOrderNo || item.sub_order_no || '-'),
        masterOrderNo: String(item.masterOrderNo || item.master_order_no || item.subOrderNo || '-'),
        trackingNo: String(item.trackingNo || item.tracking_no || '-'),
        clientName: String(item.goodsName || item.goods_name || item.clientName || '-'),
        pieces: Number(item.pieces || 0),
        weight: Number(item.weight || 0),
        volume: Number(item.volume || 0),
        route: meta.routeName,
      }))
    : [];

  const routeLabel = meta.routeName || `${String(raw.fromWarehouse || '-')}→${String(raw.toWarehouse || '-')}`;

  return {
    id: String(raw.id),
    transferNo: String(raw.transferNo || raw.transfer_no || raw.id),
    businessLine: String(raw.businessLine || raw.business_line || 'SEA').toUpperCase() === 'AIR' ? 'AIR' : 'SEA',
    direction: inferDirection(String(raw.fromWarehouse || ''), String(raw.toWarehouse || '')),
    sourceWarehouse: String(raw.fromWarehouse || '-'),
    targetWarehouse: String(raw.toWarehouse || '-'),
    routeLabel,
    orderItems,
    shippingUnitNo: raw.containerNo || raw.container_no || undefined,
    totalPieces: Number(raw.totalPieces || raw.total_pieces || 0),
    totalWeight: Number(raw.totalWeight || raw.total_weight || 0),
    totalVolume: Number(raw.totalVolume || raw.total_volume || 0),
    status: mapTransferStatus(raw.status),
    shippingMethod: (meta.shippingMethod || raw.shippingMethod || raw.shipping_method || undefined) as ShippingMethod | undefined,
    reason: raw.reason || undefined,
    remark: raw.remark || undefined,
    meta,
    operator: String(raw.createdBy || raw.created_by || '-'),
    createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.updated_at || raw.createdAt || raw.created_at || new Date().toISOString()),
    departureTime: raw.outboundAt || raw.outbound_at || undefined,
    arrivalTime: raw.inboundAt || raw.inbound_at || undefined,
    confirmedTime: raw.confirmedTime || raw.confirmed_time || undefined,
  };
};

const buildDemoRecords = (businessMode: BusinessMode): TransferRecord[] => {
  const businessLine = businessMode === 'AIR' ? 'AIR' : 'SEA';
  const routeName = businessLine === 'AIR' ? '深圳集货区→广州总仓→拉各斯到达站' : '深圳集货区→广州总仓→拉各斯主仓';
  const createdBase = businessLine === 'AIR' ? '2026-03-21T09:00:00' : '2026-03-21T10:00:00';

  return [
    {
      id: `DEMO-${businessLine}-001`,
      transferNo: `${businessLine === 'AIR' ? 'A' : 'S'}-T-20260321-0001`,
      businessLine,
      direction: 'SATELLITE_TO_MAIN',
      sourceWarehouse: '深圳集货区',
      targetWarehouse: '广州总仓',
      routeLabel: routeName,
      orderItems: [
        {
          id: `DEMO-${businessLine}-001-1`,
          jobNo: `${businessLine === 'AIR' ? 'A' : 'S'}-JOB26030018`,
          subOrderNo: `${businessLine === 'AIR' ? 'A' : 'S'}-202603210001-01`,
          masterOrderNo: `${businessLine === 'AIR' ? 'A' : 'S'}-202603210001`,
          trackingNo: `${businessLine === 'AIR' ? 'SF' : 'YT'}2603210001`,
          clientName: '联调演示客户A',
          pieces: 2,
          weight: 35.4,
          volume: 0.22,
          route: routeName,
        },
        {
          id: `DEMO-${businessLine}-001-2`,
          jobNo: `${businessLine === 'AIR' ? 'A' : 'S'}-JOB26030018`,
          subOrderNo: `${businessLine === 'AIR' ? 'A' : 'S'}-202603210001-02`,
          masterOrderNo: `${businessLine === 'AIR' ? 'A' : 'S'}-202603210001`,
          trackingNo: `${businessLine === 'AIR' ? 'JD' : 'ZT'}2603210002`,
          clientName: '联调演示客户A',
          pieces: 1,
          weight: 12.6,
          volume: 0.08,
          route: routeName,
        },
      ],
      shippingUnitNo: businessLine === 'AIR' ? 'PALT-A-003' : 'SEA-CN-082',
      totalPieces: 3,
      totalWeight: 48,
      totalVolume: 0.3,
      status: 'PENDING',
      shippingMethod: 'VIA_MAIN',
      reason: '卫星仓回仓',
      remark: serializeTransferMeta({
        routeName,
        executeDate: '2026-03-21',
        logisticsCompany: '粤港专线',
        queryPhone: '020-88886666',
        driverName: '陈师傅',
        driverPhone: '13800001111',
        driverAccountId: 'U-WMS-ORIGIN-01',
        plateNo: '粤A-TRF01',
        shippingMethod: 'VIA_MAIN',
        note: '演示调拨单，待仓库执行。',
      }),
      meta: {
        routeName,
        executeDate: '2026-03-21',
        logisticsCompany: '粤港专线',
        queryPhone: '020-88886666',
        driverName: '陈师傅',
        driverPhone: '13800001111',
        driverAccountId: 'U-WMS-ORIGIN-01',
        plateNo: '粤A-TRF01',
        shippingMethod: 'VIA_MAIN',
        note: '演示调拨单，待仓库执行。',
      },
      operator: '仓管A',
      createdAt: createdBase,
      updatedAt: createdBase,
      isDemo: true,
    },
    {
      id: `DEMO-${businessLine}-002`,
      transferNo: `${businessLine === 'AIR' ? 'A' : 'S'}-T-20260321-0002`,
      businessLine,
      direction: 'MAIN_TO_SATELLITE',
      sourceWarehouse: '广州总仓',
      targetWarehouse: '佛山拼货区',
      routeLabel: '广州总仓→佛山拼货区',
      orderItems: [
        {
          id: `DEMO-${businessLine}-002-1`,
          jobNo: `${businessLine === 'AIR' ? 'A' : 'S'}-JOB26030019`,
          subOrderNo: `${businessLine === 'AIR' ? 'A' : 'S'}-202603210002-01`,
          masterOrderNo: `${businessLine === 'AIR' ? 'A' : 'S'}-202603210002`,
          trackingNo: `${businessLine === 'AIR' ? 'ST' : 'SF'}2603210003`,
          clientName: '联调演示客户B',
          pieces: 4,
          weight: 76.5,
          volume: 0.48,
          route: '广州总仓→佛山拼货区',
        },
      ],
      shippingUnitNo: businessLine === 'AIR' ? 'PALT-A-011' : 'SEA-CN-116',
      totalPieces: 4,
      totalWeight: 76.5,
      totalVolume: 0.48,
      status: 'IN_TRANSIT',
      shippingMethod: 'DIRECT',
      reason: '总仓分拨',
      remark: serializeTransferMeta({
        routeName: '广州总仓→佛山拼货区',
        executeDate: '2026-03-21',
        logisticsCompany: '城配车队',
        queryPhone: '400-900-1100',
        driverName: '李师傅',
        driverPhone: '13800002222',
        driverAccountId: 'U-WMS-ORIGIN-02',
        plateNo: '粤B-TRF02',
        shippingMethod: 'DIRECT',
        departureConfirmedAt: '2026-03-21T11:35:00',
        note: '已离库，等待分仓收货。',
      }),
      meta: {
        routeName: '广州总仓→佛山拼货区',
        executeDate: '2026-03-21',
        logisticsCompany: '城配车队',
        queryPhone: '400-900-1100',
        driverName: '李师傅',
        driverPhone: '13800002222',
        driverAccountId: 'U-WMS-ORIGIN-02',
        plateNo: '粤B-TRF02',
        shippingMethod: 'DIRECT',
        departureConfirmedAt: '2026-03-21T11:35:00',
        note: '已离库，等待分仓收货。',
      },
      operator: '仓管B',
      createdAt: '2026-03-21T11:10:00',
      updatedAt: '2026-03-21T11:35:00',
      departureTime: '2026-03-21T11:35:00',
      isDemo: true,
    },
    {
      id: `DEMO-${businessLine}-003`,
      transferNo: `${businessLine === 'AIR' ? 'A' : 'S'}-T-20260321-0003`,
      businessLine,
      direction: 'MAIN_TO_SATELLITE',
      sourceWarehouse: '广州总仓',
      targetWarehouse: '海珠区站点',
      routeLabel: '广州总仓→海珠区站点',
      orderItems: [
        {
          id: `DEMO-${businessLine}-003-1`,
          jobNo: `${businessLine === 'AIR' ? 'A' : 'S'}-JOB26030020`,
          subOrderNo: `${businessLine === 'AIR' ? 'A' : 'S'}-202603210003-01`,
          masterOrderNo: `${businessLine === 'AIR' ? 'A' : 'S'}-202603210003`,
          trackingNo: `${businessLine === 'AIR' ? 'ZT' : 'JT'}2603210004`,
          clientName: '联调演示客户C',
          pieces: 3,
          weight: 42.2,
          volume: 0.24,
          route: '广州总仓→海珠区站点',
        },
      ],
      shippingUnitNo: businessLine === 'AIR' ? 'PALT-A-020' : 'SEA-CN-139',
      totalPieces: 3,
      totalWeight: 42.2,
      totalVolume: 0.24,
      status: 'ARRIVED',
      shippingMethod: 'DIRECT',
      reason: '紧急补货',
      remark: serializeTransferMeta({
        routeName: '广州总仓→海珠区站点',
        executeDate: '2026-03-21',
        logisticsCompany: '城配车队',
        driverName: '王师傅',
        driverPhone: '13800003333',
        plateNo: '粤C-TRF03',
        shippingMethod: 'DIRECT',
        departureConfirmedAt: '2026-03-21T12:10:00',
        arrivalConfirmedAt: '2026-03-21T14:25:00',
        note: '已到达待入库。',
      }),
      meta: {
        routeName: '广州总仓→海珠区站点',
        executeDate: '2026-03-21',
        logisticsCompany: '城配车队',
        driverName: '王师傅',
        driverPhone: '13800003333',
        plateNo: '粤C-TRF03',
        shippingMethod: 'DIRECT',
        departureConfirmedAt: '2026-03-21T12:10:00',
        arrivalConfirmedAt: '2026-03-21T14:25:00',
        note: '已到达待入库。',
      },
      operator: '仓管C',
      createdAt: '2026-03-21T11:40:00',
      updatedAt: '2026-03-21T14:25:00',
      departureTime: '2026-03-21T12:10:00',
      arrivalTime: '2026-03-21T14:25:00',
      isDemo: true,
    },
  ];
};

export const TransferList = ({
  warehouseId,
  businessMode = 'ALL',
}: {
  warehouseId?: string;
  businessMode?: BusinessMode;
}) => {
  const { token } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [apiRecords, setApiRecords] = useState<TransferRecord[]>([]);
  const [demoRecords, setDemoRecords] = useState<TransferRecord[]>(() => buildDemoRecords(businessMode));
  const [recordOverrides, setRecordOverrides] = useState<Record<string, TransferRecord>>({});

  const [keyword, setKeyword] = useState('');
  const [filterDirection, setFilterDirection] = useState<TransferDirection | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<TransferStatus | 'ALL'>('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [bindOpen, setBindOpen] = useState(false);
  const [bindSubmitting, setBindSubmitting] = useState(false);
  const [bindMode, setBindMode] = useState<'MANUAL' | 'SCAN'>('MANUAL');
  const [bindKeyword, setBindKeyword] = useState('');
  const [bindTarget, setBindTarget] = useState<TransferRecord | null>(null);
  const [bindSelectedKeys, setBindSelectedKeys] = useState<React.Key[]>([]);
  const [bindSelectedMap, setBindSelectedMap] = useState<Record<string, AvailableOrder>>({});

  const [executeOpen, setExecuteOpen] = useState(false);
  const [executeSubmitting, setExecuteSubmitting] = useState(false);
  const [executeForm] = Form.useForm();
  const [executeTarget, setExecuteTarget] = useState<TransferRecord | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<TransferRecord | null>(null);

  const businessLine = businessMode === 'SEA' || businessMode === 'AIR' ? businessMode : undefined;

  useEffect(() => {
    setDemoRecords(buildDemoRecords(businessMode));
  }, [businessMode]);

  useEffect(() => {
    if (!createOpen) return;
    createForm.setFieldsValue({
      sourceWarehouse: '深圳集货区',
      targetWarehouse: '广州总仓',
      routeName: businessMode === 'AIR' ? '深圳集货区→广州总仓→拉各斯到达站' : '深圳集货区→广州总仓→拉各斯主仓',
      executeDate: dayjs(),
      shippingMethod: 'VIA_MAIN',
      logisticsCompany: '',
      queryPhone: '',
      driverName: '',
      driverPhone: '',
      plateNo: '',
      reason: '集中发货',
      remark: '',
      shippingUnitNo: '',
    });
  }, [businessMode, createForm, createOpen]);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const response: any = await warehouseApi.listTransfers({
        transferType: 'ORIGIN',
        warehouseId,
        businessLine,
      });
      const rows = Array.isArray(response?.data) ? response.data : [];
      setApiRecords(rows.map(mapTransferRow));
    } catch (err: any) {
      messageApi.error(err?.message || '加载调拨记录失败');
    } finally {
      setLoading(false);
    }
  }, [businessLine, messageApi, warehouseId]);

  useEffect(() => {
    void fetchTransfers();
  }, [fetchTransfers]);

  const fetchAvailableOrders = useCallback(async () => {
    setBindLoading(true);
    try {
      const response: any = await warehouseApi.listStock({
        warehouse: 'CN',
        warehouseId,
        businessLine,
      });
      let rows = Array.isArray(response?.data) ? response.data : [];
      if (!rows.length) {
        const fallbackOrders = await loadOriginFallbackOrders(businessMode);
        rows = buildOriginStockFallbackData(fallbackOrders);
      }
      const mapped = rows
        .filter((row: any) => ['IN_STOCK', 'ALLOCATED', 'PACKED'].includes(String(row.status || '').toUpperCase()))
        .map((row: any) => ({
          id: String(row.id),
          jobNo: String(row.jobNo || row.job_no || '-'),
          subOrderNo: String(row.displaySubOrderNo || row.subWaybillNo || row.subOrderNo || row.sub_order_no || '-'),
          masterOrderNo: String(row.displayOrderNo || row.masterWaybillNo || row.masterOrderNo || row.master_order_no || row.orderNo || row.order_no || '-'),
          trackingNo: String(row.trackingNo || row.tracking_no || '-'),
          clientName: String(row.clientName || row.client_name || row.customerName || row.customer_name || '-'),
          pieces: Number(row.pieces || 0),
          weight: Number(row.weight || 0),
          volume: Number(row.volume || 0),
          warehouse: String(row.warehouse || row.warehouseName || '-'),
          status: row.status === 'IN_STOCK' ? '已入库' : String(row.status || '-'),
          route: String(row.route || row.routeCode || row.routeName || '-'),
        })) as AvailableOrder[];
      setAvailableOrders(mapped);
    } catch (err) {
      try {
        const fallbackOrders = await loadOriginFallbackOrders(businessMode);
        const rows = buildOriginStockFallbackData(fallbackOrders);
        const mapped = rows
          .filter((row: any) => ['IN_STOCK', 'ALLOCATED', 'PACKED'].includes(String(row.status || '').toUpperCase()))
          .map((row: any) => ({
            id: String(row.id),
            jobNo: String(row.jobNo || row.job_no || '-'),
            subOrderNo: String(row.displaySubOrderNo || row.subWaybillNo || row.subOrderNo || row.sub_order_no || '-'),
            masterOrderNo: String(row.displayOrderNo || row.masterWaybillNo || row.masterOrderNo || row.master_order_no || row.orderNo || row.order_no || '-'),
            trackingNo: String(row.trackingNo || row.tracking_no || '-'),
            clientName: String(row.clientName || row.client_name || row.customerName || row.customer_name || '-'),
            pieces: Number(row.pieces || 0),
            weight: Number(row.weight || 0),
            volume: Number(row.volume || 0),
            warehouse: String(row.warehouse || row.warehouseName || '-'),
            status: row.status === 'IN_STOCK' ? '已入库' : String(row.status || '-'),
            route: String(row.route || row.routeCode || row.routeName || '-'),
          })) as AvailableOrder[];
        setAvailableOrders(mapped);
      } catch (fallbackError) {
        console.error('加载可选运单失败', err, fallbackError);
        setAvailableOrders([]);
      }
    } finally {
      setBindLoading(false);
    }
  }, [businessLine, businessMode, warehouseId]);

  const baseRecords = useMemo(() => {
    // 仅使用本地 Demo Mock 数据；后端接口数据为遗留脏数据（如 TRF- 旧格式前缀），
    // 按 2026-04 编号规则已改为 S-T-/A-T- 格式，apiRecords 不再合并展示
    return [...demoRecords];
  }, [demoRecords]);

  const records = useMemo(
    () => baseRecords.map((record) => recordOverrides[record.id] || record),
    [baseRecords, recordOverrides],
  );

  const updateLocalRecord = useCallback((recordId: string, updater: (record: TransferRecord) => TransferRecord) => {
    setRecordOverrides((prev) => {
      const current = prev[recordId] || baseRecords.find((record) => record.id === recordId);
      if (!current) return prev;
      return {
        ...prev,
        [recordId]: updater(current),
      };
    });
  }, [baseRecords]);

  const filteredRecords = useMemo(() => {
    const keywordValue = keyword.trim().toLowerCase();
    return records.filter((record) => {
      if (filterDirection !== 'ALL' && record.direction !== filterDirection) return false;
      if (filterStatus !== 'ALL' && record.status !== filterStatus) return false;
      if (!keywordValue) return true;

      const searchText = [
        record.transferNo,
        record.sourceWarehouse,
        record.targetWarehouse,
        record.routeLabel,
        record.reason,
        record.meta.driverName,
        record.meta.driverPhone,
        record.shippingUnitNo,
        ...record.orderItems.map((item) => item.jobNo),
        ...record.orderItems.map((item) => item.masterOrderNo),
        ...record.orderItems.map((item) => item.subOrderNo),
        ...record.orderItems.map((item) => item.trackingNo),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchText.includes(keywordValue);
    });
  }, [filterDirection, filterStatus, keyword, records]);

  const stats = useMemo(() => ({
    pending: records.filter((record) => record.status === 'PENDING').length,
    transit: records.filter((record) => record.status === 'IN_TRANSIT').length,
    arrived: records.filter((record) => record.status === 'ARRIVED').length,
    received: records.filter((record) => record.status === 'RECEIVED').length,
    cancelled: records.filter((record) => record.status === 'CANCELLED').length,
  }), [records]);

  useEffect(() => {
    if (!detailRecord) return;
    const latest = records.find((record) => record.id === detailRecord.id);
    if (latest) setDetailRecord(latest);
  }, [detailRecord, records]);

  const resetCreateState = () => {
    createForm.resetFields();
  };

  const openCreateModal = () => {
    resetCreateState();
    setCreateOpen(true);
  };

  const handleQuery = () => {
    setKeyword((value) => value.trim());
  };

  const handleResetFilters = () => {
    setKeyword('');
    setFilterDirection('ALL');
    setFilterStatus('ALL');
    void fetchTransfers();
  };

  const closeBindDrawer = useCallback(() => {
    setBindOpen(false);
    setBindSubmitting(false);
    setBindKeyword('');
    setBindMode('MANUAL');
    setBindTarget(null);
    setBindSelectedKeys([]);
    setBindSelectedMap({});
  }, []);

  const openBindDrawer = useCallback(async (record: TransferRecord, mode: 'MANUAL' | 'SCAN' = 'MANUAL') => {
    setBindTarget(record);
    setBindMode(mode);
    setBindKeyword('');
    setBindSelectedKeys([]);
    setBindSelectedMap({});
    setBindOpen(true);
    await fetchAvailableOrders();
  }, [fetchAvailableOrders]);

  const bindRows = useMemo(() => {
    if (!bindTarget) return [];

    const boundSubOrders = new Set(bindTarget.orderItems.map((item) => item.subOrderNo).filter(Boolean));
    const boundTrackingNos = new Set(bindTarget.orderItems.map((item) => item.trackingNo).filter(Boolean));
    const searchValue = bindKeyword.trim().toLowerCase();

    return availableOrders.filter((order) => {
      if (boundSubOrders.has(order.subOrderNo) || boundTrackingNos.has(order.trackingNo)) return false;
      if (!searchValue) return true;

      const haystack = [
        order.jobNo,
        order.subOrderNo,
        order.masterOrderNo,
        order.trackingNo,
        order.clientName,
        order.warehouse,
        order.route,
      ].join(' ').toLowerCase();

      return haystack.includes(searchValue);
    });
  }, [availableOrders, bindKeyword, bindTarget]);

  const selectedBindOrders = useMemo(
    () => bindSelectedKeys.map((key) => bindSelectedMap[String(key)]).filter((row): row is AvailableOrder => Boolean(row)),
    [bindSelectedKeys, bindSelectedMap],
  );

  const bindSummary = useMemo(() => (
    selectedBindOrders.reduce(
      (acc, row) => ({
        count: acc.count + 1,
        pieces: acc.pieces + Number(row.pieces || 0),
        weight: acc.weight + Number(row.weight || 0),
      }),
      { count: 0, pieces: 0, weight: 0 },
    )
  ), [selectedBindOrders]);

  const appendBindRows = useCallback((rows: AvailableOrder[]) => {
    setBindSelectedMap((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        next[row.id] = row;
      });
      return next;
    });
    setBindSelectedKeys((prev) => Array.from(new Set([...prev, ...rows.map((row) => row.id)])));
  }, []);

  const handleBindSelectionChange = (nextKeys: React.Key[], nextRows: AvailableOrder[]) => {
    setBindSelectedKeys(nextKeys);
    setBindSelectedMap((prev) => {
      const next = { ...prev };
      bindRows.forEach((row) => {
        delete next[row.id];
      });
      nextRows.forEach((row) => {
        next[row.id] = row;
      });
      return next;
    });
  };

  const handleBindSearchEnter = () => {
    if (bindMode !== 'SCAN') return;

    const value = bindKeyword.trim();
    if (!value) return;

    const matched = bindRows.find((row) => (
      row.subOrderNo === value ||
      row.masterOrderNo === value ||
      row.trackingNo === value ||
      row.jobNo === value
    ));

    if (!matched) {
      messageApi.warning('未匹配到可绑定运单');
      return;
    }

    appendBindRows([matched]);
    setBindKeyword('');
    messageApi.success(`已扫描并加入 ${matched.subOrderNo}`);
  };

  const handleBindOrders = async () => {
    if (!bindTarget) return;
    if (selectedBindOrders.length === 0) {
      messageApi.warning('请至少选择一个运单');
      return;
    }

    try {
      setBindSubmitting(true);
      const now = new Date().toISOString();

      const nextItems = [
        ...bindTarget.orderItems,
        ...selectedBindOrders.map((order) => ({
          id: `BIND-${bindTarget.id}-${order.id}`,
          jobNo: order.jobNo,
          subOrderNo: order.subOrderNo,
          masterOrderNo: order.masterOrderNo,
          trackingNo: order.trackingNo,
          clientName: order.clientName,
          pieces: order.pieces,
          weight: order.weight,
          volume: order.volume,
          route: bindTarget.routeLabel,
        })),
      ];

      const totalPieces = nextItems.reduce((sum, item) => sum + Number(item.pieces || 0), 0);
      const totalWeight = nextItems.reduce((sum, item) => sum + Number(item.weight || 0), 0);
      const totalVolume = nextItems.reduce((sum, item) => sum + Number(item.volume || 0), 0);

      const nextRecord: TransferRecord = {
        ...bindTarget,
        orderItems: nextItems,
        totalPieces,
        totalWeight,
        totalVolume,
        updatedAt: now,
      };

      updateLocalRecord(bindTarget.id, () => nextRecord);
      setDetailRecord((current) => (current?.id === bindTarget.id ? nextRecord : current));
      messageApi.success(`已为 ${bindTarget.transferNo} 绑定 ${selectedBindOrders.length} 条运单`);
      closeBindDrawer();
    } catch (err: any) {
      messageApi.error(err?.message || '绑定运单失败');
    } finally {
      setBindSubmitting(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);

      const meta: TransferMeta = {
        routeName: values.routeName,
        executeDate: values.executeDate ? dayjs(values.executeDate).format('YYYY-MM-DD') : undefined,
        logisticsCompany: values.logisticsCompany,
        queryPhone: values.queryPhone,
        driverName: values.driverName,
        driverPhone: values.driverPhone,
        plateNo: values.plateNo,
        shippingMethod: values.shippingMethod,
        note: values.remark,
      };

      const response: any = await warehouseApi.createTransfer({
        fromWarehouse: values.sourceWarehouse,
        toWarehouse: values.targetWarehouse,
        businessLine,
        transferType: 'ORIGIN',
        itemType: 'ORDER',
        containerNo: values.shippingUnitNo || null,
        reason: values.reason,
        remark: serializeTransferMeta(meta),
        items: [],
      });

      const createdRecord = mapTransferRow(response?.data || response);
      setApiRecords((prev) => [createdRecord, ...prev.filter((record) => record.id !== createdRecord.id)]);

      messageApi.success(`创建成功：${createdRecord.transferNo}`);
      setCreateOpen(false);
      resetCreateState();
      await openBindDrawer(createdRecord, 'MANUAL');
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || '创建调拨单失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openExecuteModal = (record: TransferRecord) => {
    setExecuteTarget(record);
    executeForm.setFieldsValue({
      executeDate: record.meta.executeDate ? dayjs(record.meta.executeDate) : dayjs(),
      logisticsCompany: record.meta.logisticsCompany || '',
      queryPhone: record.meta.queryPhone || '',
      driverName: record.meta.driverName || '',
      driverPhone: record.meta.driverPhone || '',
      driverAccountId: record.meta.driverAccountId || 'U-WMS-ORIGIN-01',
      plateNo: record.meta.plateNo || '',
    });
    setExecuteOpen(true);
  };

  const handleExecute = async () => {
    if (!executeTarget) return;
    try {
      const values = await executeForm.validateFields();
      setExecuteSubmitting(true);
      const now = new Date().toISOString();
      const nextMeta: TransferMeta = {
        ...executeTarget.meta,
        executeDate: values.executeDate ? dayjs(values.executeDate).format('YYYY-MM-DD') : executeTarget.meta.executeDate,
        logisticsCompany: values.logisticsCompany,
        queryPhone: values.queryPhone,
        driverName: values.driverName,
        driverPhone: values.driverPhone,
        driverAccountId: values.driverAccountId,
        plateNo: values.plateNo,
        departureConfirmedAt: now,
      };

      if (!executeTarget.isDemo) {
        await warehouseApi.updateTransfer(executeTarget.id, {
          status: 'IN_TRANSIT',
          outboundAt: now,
          remark: serializeTransferMeta(nextMeta),
        });
        await fetchTransfers();
      }

      updateLocalRecord(executeTarget.id, (record) => ({
          ...record,
          status: 'IN_TRANSIT',
          meta: nextMeta,
          remark: serializeTransferMeta(nextMeta),
          departureTime: now,
          updatedAt: now,
        }));

      setExecuteOpen(false);
      setExecuteTarget(null);
      executeForm.resetFields();
      messageApi.success('调拨已发起');
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || '发起调拨失败');
    } finally {
      setExecuteSubmitting(false);
    }
  };

  const handleConfirmArrival = (record: TransferRecord) => {
    Modal.confirm({
      title: '确认到达',
      content: `确定 ${record.transferNo} 已到达 ${record.targetWarehouse} 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        const now = new Date().toISOString();
        const nextMeta: TransferMeta = {
          ...record.meta,
          arrivalConfirmedAt: now,
        };

        try {
          if (!record.isDemo) {
            await warehouseApi.updateTransfer(record.id, {
              status: 'ARRIVED',
              inboundAt: now,
              remark: serializeTransferMeta(nextMeta),
            });
            await fetchTransfers();
          }

          updateLocalRecord(record.id, (current) => ({
              ...current,
              status: 'ARRIVED',
              meta: nextMeta,
              remark: serializeTransferMeta(nextMeta),
              arrivalTime: now,
              updatedAt: now,
            }));
          messageApi.success('已确认到达');
        } catch (err: any) {
          messageApi.error(err?.message || '确认到达失败');
        }
      },
    });
  };

  const handleConfirmReceive = (record: TransferRecord) => {
    Modal.confirm({
      title: '确认入库',
      content: `确定 ${record.transferNo} 已完成入库吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        const now = new Date().toISOString();
        const nextMeta: TransferMeta = {
          ...record.meta,
          receiveConfirmedAt: now,
        };

        try {
          if (!record.isDemo) {
            await warehouseApi.updateTransfer(record.id, {
              status: 'RECEIVED',
              remark: serializeTransferMeta(nextMeta),
            });
            await fetchTransfers();
          }

          updateLocalRecord(record.id, (current) => ({
              ...current,
              status: 'RECEIVED',
              meta: nextMeta,
              remark: serializeTransferMeta(nextMeta),
              confirmedTime: now,
              updatedAt: now,
            }));
          messageApi.success('已确认入库');
        } catch (err: any) {
          messageApi.error(err?.message || '确认入库失败');
        }
      },
    });
  };

  const handleViewDetail = (record: TransferRecord) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const handlePrint = (record: TransferRecord) => {
    messageApi.info(`${record.transferNo} 打印预览待接入（demo）`);
  };

  const columns = useMemo<ColumnsType<TransferRecord>>(() => [
    {
      title: '调拨单号',
      dataIndex: 'transferNo',
      key: 'transferNo',
      width: 220,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.transferNo}</div>
          <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{formatDateTime(record.createdAt)}</div>
        </div>
      ),
    },
    {
      title: '线路 / 来源→去向',
      key: 'route',
      width: 220,
      render: (_, record) => (
        <div>
          <div>{record.routeLabel}</div>
          <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{record.sourceWarehouse} → {record.targetWarehouse}</div>
        </div>
      ),
    },
    {
      title: 'JOB',
      key: 'jobNos',
      width: 180,
      render: (_, record) => {
        const jobNos = Array.from(new Set(record.orderItems.map((item) => item.jobNo).filter(Boolean))) as string[];
        return jobNos.length > 0 ? (
          <Space direction="vertical" size={0}>
            {jobNos.slice(0, 2).map((jobNo) => (
              <span key={jobNo}>{jobNo}</span>
            ))}
            {jobNos.length > 2 && <span style={{ color: token.colorTextSecondary }}>...更多</span>}
          </Space>
        ) : '-';
      },
    },
    {
      title: '订单号 / 运单号',
      key: 'orders',
      width: 220,
      render: (_, record) => {
        const displayItems = Array.from(
          new Map(
            record.orderItems.map((item) => [
              `${item.masterOrderNo || '-'}::${item.trackingNo || item.subOrderNo || '-'}`,
              item,
            ]),
          ).values(),
        );

        return (
          <Space direction="vertical" size={4}>
            {displayItems.slice(0, 2).map((item) => (
              <div key={item.id}>
                <div>{item.masterOrderNo || item.subOrderNo}</div>
                <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{item.trackingNo || item.subOrderNo}</div>
              </div>
            ))}
            {displayItems.length > 2 && <span style={{ color: token.colorTextSecondary }}>...更多</span>}
          </Space>
        );
      },
    },
    {
      title: '重量Kg',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 110,
      render: (value) => Number(value || 0).toFixed(2),
    },
    {
      title: '件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 90,
    },
    {
      title: '物流状态',
      key: 'logistics',
      width: 180,
      render: (_, record) => (
        <div>
          <div>{buildLogisticsStatusText(record)}</div>
          <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
            {formatDateTime(record.arrivalTime || record.departureTime || record.updatedAt)}
          </div>
        </div>
      ),
    },
    {
      title: '执行状态',
      key: 'execution',
      width: 180,
      render: (_, record) => (
        <div>
          <div>{buildExecutionStatusText(record)}</div>
          <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>
            {record.meta.driverName || `已绑定 ${record.orderItems.length} 单`}
          </div>
        </div>
      ),
    },
    {
      title: '调拨原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 140,
      ellipsis: true,
      render: (value) => value || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, record) => {
        const canExecute = record.status === 'PENDING' && record.orderItems.length > 0;

        return (
          <Space size="small" wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
              详情
            </Button>
            <Button type="link" size="small" onClick={() => void openBindDrawer(record, 'MANUAL')}>
              绑定运单
            </Button>
            {record.status === 'PENDING' && (
              <Button
                type="link"
                size="small"
                icon={<SendOutlined />}
                onClick={() => (canExecute ? openExecuteModal(record) : handleViewDetail(record))}
              >
                执行
              </Button>
            )}
            {record.status === 'IN_TRANSIT' && (
              <Button type="link" size="small" onClick={() => handleConfirmArrival(record)}>
                确认到达
              </Button>
            )}
            {record.status === 'ARRIVED' && (
              <Button type="link" size="small" onClick={() => handleConfirmReceive(record)}>
                确认入库
              </Button>
            )}
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>
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
      render: (value) => formatShortDateTime(value),
    },
  ], [token.colorTextSecondary]);

  const detailFlowRecords = useMemo(() => (detailRecord ? buildFlowRecords(detailRecord) : []), [detailRecord]);

  return (
    <>
      {contextHolder}
      <div className="compact-stats" style={{ marginBottom: 12 }}>
        <Tag color="gold">待发运 {stats.pending}</Tag>
        <Tag color="processing">运输中 {stats.transit}</Tag>
        <Tag color="cyan">已到达 {stats.arrived}</Tag>
        <Tag color="success">已入库 {stats.received}</Tag>
        <Tag>已取消 {stats.cancelled}</Tag>
        <Tag color="blue">总记录 {records.length}</Tag>
      </div>

      <ListPageToolbarCard
        style={{
          marginBottom: 12,
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(250,250,250,1) 0%, rgba(245,247,250,1) 100%)',
        }}
      >
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 320px" minWidth={260}>
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onPressEnter={handleQuery}
                placeholder="输入调拨单号/JOB/订单号/运单号"
                prefix={<SearchOutlined />}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={150}>
              <Select
                value={filterDirection}
                onChange={(value) => setFilterDirection(value)}
                options={DIRECTION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={130}>
              <Select
                value={filterStatus}
                onChange={(value) => setFilterStatus(value)}
                options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery}>查询</Button>
            <Button onClick={handleResetFilters}>重置</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              创建调拨单
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={filteredRecords}
        size="small"
        scroll={{ x: 1880, y: 'calc(100vh - 390px)' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={(
          <Space>
            <SwapOutlined />
            <span>创建调拨单</span>
          </Space>
        )}
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          resetCreateState();
        }}
        confirmLoading={createSubmitting}
        okText="创建并去绑定"
        cancelText="取消"
        destroyOnHidden
        width={900}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 20 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="源仓库" name="sourceWarehouse" rules={[{ required: true, message: '请选择源仓库' }]}>
                <Select options={WAREHOUSE_OPTIONS.map((name) => ({ value: name, label: name }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="目标仓库" name="targetWarehouse" rules={[{ required: true, message: '请选择目标仓库' }]}>
                <Select options={WAREHOUSE_OPTIONS.map((name) => ({ value: name, label: name }))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="线路名称" name="routeName" rules={[{ required: true, message: '请输入线路名称' }]}>
                <Input placeholder="例如：深圳集货区→广州总仓→拉各斯主仓" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="执行日期" name="executeDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="运输方式" name="shippingMethod">
                <Radio.Group>
                  <Radio value="VIA_MAIN">先送总仓</Radio>
                  <Radio value="DIRECT">直接发运</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="装箱号" name="shippingUnitNo">
                <Input placeholder="如果已装箱，请输入装箱号（可选）" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="物流公司" name="logisticsCompany">
                <Input placeholder="录入承运商 / 车队名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="查询电话" name="queryPhone">
                <Input placeholder="录入查询电话" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="司机名称" name="driverName">
                <Input placeholder="录入司机姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="司机电话" name="driverPhone">
                <Input placeholder="录入司机电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="车牌" name="plateNo">
                <Input placeholder="录入车牌号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="调拨原因" name="reason" rules={[{ required: true, message: '请选择调拨原因' }]}>
            <Select options={REASON_OPTIONS.map((item) => ({ value: item, label: item }))} />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <TextArea rows={3} placeholder="补充这次调拨的说明" maxLength={300} showCount />
          </Form.Item>

          <Card size="small" style={{ borderRadius: 14, background: '#fafafa' }}>
            <div style={{ color: token.colorTextSecondary }}>
              创建成功后将自动进入“绑定运单”，流程与 DPN 管理保持一致。
            </div>
          </Card>
        </Form>
      </Modal>

      <Drawer
        title={bindTarget ? `绑定运单 - ${bindTarget.transferNo}` : '绑定运单'}
        placement="right"
        width={1120}
        open={bindOpen}
        onClose={closeBindDrawer}
        destroyOnHidden
        extra={(
          <Space>
            <Button onClick={closeBindDrawer}>取消</Button>
            <Button type="primary" loading={bindSubmitting} onClick={() => void handleBindOrders()}>
              提交绑定
            </Button>
          </Space>
        )}
      >
        <Card size="small" style={{ marginBottom: 12, borderRadius: 16, background: '#fafafa' }}>
          <Row gutter={[12, 12]} align="middle">
            <Col>
              <Space.Compact>
                <Button type={bindMode === 'MANUAL' ? 'primary' : 'default'} onClick={() => setBindMode('MANUAL')}>
                  手动添加运单
                </Button>
                <Button
                  type={bindMode === 'SCAN' ? 'primary' : 'default'}
                  icon={<ScanOutlined />}
                  onClick={() => setBindMode('SCAN')}
                >
                  扫描添加运单
                </Button>
              </Space.Compact>
            </Col>
            <Col flex="auto">
              <Input
                value={bindKeyword}
                onChange={(event) => setBindKeyword(event.target.value)}
                onPressEnter={handleBindSearchEnter}
                placeholder={bindMode === 'SCAN' ? '扫描运单号后回车' : '输入运单号/订单号/JOB查询'}
                prefix={bindMode === 'SCAN' ? <ScanOutlined /> : <SearchOutlined />}
                allowClear
              />
            </Col>
            <Col>
              <Button icon={<ReloadOutlined />} onClick={() => setBindKeyword('')}>
                重置筛选
              </Button>
            </Col>
          </Row>
        </Card>

        <Table
          rowKey="id"
          size="small"
          loading={bindLoading}
          dataSource={bindRows}
          scroll={{ x: 980, y: 420 }}
          rowSelection={{
            selectedRowKeys: bindSelectedKeys,
            preserveSelectedRowKeys: true,
            onChange: (nextKeys, nextRows) => handleBindSelectionChange(nextKeys, nextRows as AvailableOrder[]),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `可选 ${total} 条`,
          }}
          columns={[
            {
              title: 'JOB/仓库',
              key: 'jobWarehouse',
              width: 180,
              render: (_, row: AvailableOrder) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{row.jobNo || '-'}</div>
                  <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{row.warehouse}</div>
                </div>
              ),
            },
            { title: '运单号', dataIndex: 'subOrderNo', key: 'subOrderNo', width: 170 },
            { title: '订单号', dataIndex: 'masterOrderNo', key: 'masterOrderNo', width: 170 },
            { title: '快递单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 160 },
            { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 150 },
            { title: '线路', dataIndex: 'route', key: 'route', width: 180 },
            { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (value: string) => <Tag>{value}</Tag> },
            { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'right' },
            { title: '重量Kg', dataIndex: 'weight', key: 'weight', width: 100, align: 'right', render: (value: number) => value.toFixed(2) },
          ]}
        />

        <Space size={8} style={{ marginTop: 12 }} wrap>
          <Tag color={bindMode === 'SCAN' ? 'processing' : 'purple'}>
            {bindMode === 'SCAN' ? '扫描添加' : '手动添加'}
          </Tag>
          <Tag color="blue">已选运单 {bindSummary.count}</Tag>
          <Tag>件数 {bindSummary.pieces}</Tag>
          <Tag color="processing">重量 {bindSummary.weight.toFixed(2)} kg</Tag>
        </Space>
      </Drawer>

      <Modal
        title={executeTarget ? `执行调拨 - ${executeTarget.transferNo}` : '执行调拨'}
        open={executeOpen}
        onOk={handleExecute}
        onCancel={() => {
          setExecuteOpen(false);
          setExecuteTarget(null);
          executeForm.resetFields();
        }}
        confirmLoading={executeSubmitting}
        okText="确认发运"
        cancelText="取消"
        destroyOnHidden
        width={760}
      >
        <Form form={executeForm} layout="vertical" style={{ marginTop: 20 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="执行日期" name="executeDate">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="物流公司" name="logisticsCompany">
                <Input placeholder="录入承运商 / 车队名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="司机名称" name="driverName" rules={[{ required: true, message: '请输入司机名称' }]}>
                <Input placeholder="录入司机姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="司机电话" name="driverPhone" rules={[{ required: true, message: '请输入司机电话' }]}>
                <Input placeholder="录入司机电话" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="司机账号ID" name="driverAccountId">
                <Input placeholder="默认 U-WMS-ORIGIN-01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="车牌" name="plateNo">
                <Input placeholder="录入车牌号" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="查询电话" name="queryPhone">
            <Input placeholder="录入查询电话" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detailRecord ? `调拨详情 - ${detailRecord.transferNo}` : '调拨详情'}
        placement="right"
        width={920}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
        destroyOnHidden
      >
        {detailRecord && (
          <Space direction="vertical" size={18} style={{ width: '100%' }}>
            <Space wrap>
              <Button icon={<PlusOutlined />} onClick={() => void openBindDrawer(detailRecord, 'MANUAL')}>
                手动添加
              </Button>
              <Button icon={<ScanOutlined />} onClick={() => void openBindDrawer(detailRecord, 'SCAN')}>
                扫描添加
              </Button>
              {detailRecord.status === 'PENDING' && detailRecord.orderItems.length > 0 && (
                <Button type="primary" icon={<SendOutlined />} onClick={() => openExecuteModal(detailRecord)}>
                  执行
                </Button>
              )}
            </Space>

            <Card size="small" style={{ borderRadius: 16 }}>
              <Descriptions column={2} bordered>
                <Descriptions.Item label="调拨单号" span={2}>
                  <strong>{detailRecord.transferNo}</strong>
                  {detailRecord.isDemo && <Tag color="purple" style={{ marginLeft: 8 }}>DEMO</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="来源仓库">{detailRecord.sourceWarehouse}</Descriptions.Item>
                <Descriptions.Item label="目标仓库">{detailRecord.targetWarehouse}</Descriptions.Item>
                <Descriptions.Item label="线路名称" span={2}>{detailRecord.routeLabel}</Descriptions.Item>
                <Descriptions.Item label="装箱号">{detailRecord.shippingUnitNo || '-'}</Descriptions.Item>
                <Descriptions.Item label="调拨原因">{detailRecord.reason || '-'}</Descriptions.Item>
                <Descriptions.Item label="总件数">{detailRecord.totalPieces} 件</Descriptions.Item>
                <Descriptions.Item label="总重量">{detailRecord.totalWeight.toFixed(2)} kg</Descriptions.Item>
                <Descriptions.Item label="总体积">{detailRecord.totalVolume.toFixed(4)} m³</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={STATUS_CONFIG[detailRecord.status].color} icon={STATUS_CONFIG[detailRecord.status].icon}>
                    {STATUS_CONFIG[detailRecord.status].text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">{formatDateTime(detailRecord.createdAt)}</Descriptions.Item>
                <Descriptions.Item label="更新时间">{formatDateTime(detailRecord.updatedAt)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="执行信息" style={{ borderRadius: 16 }}>
              <Descriptions column={2}>
                <Descriptions.Item label="执行日期">{detailRecord.meta.executeDate || '-'}</Descriptions.Item>
                <Descriptions.Item label="物流公司">{detailRecord.meta.logisticsCompany || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机名称">{detailRecord.meta.driverName || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机电话">{detailRecord.meta.driverPhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机账号ID">{detailRecord.meta.driverAccountId || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌">{detailRecord.meta.plateNo || '-'}</Descriptions.Item>
                <Descriptions.Item label="查询电话">{detailRecord.meta.queryPhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="运输方式">
                  {detailRecord.shippingMethod === 'DIRECT' ? '直接发运' : detailRecord.shippingMethod === 'VIA_MAIN' ? '先送总仓' : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>{detailRecord.meta.note || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="货物明细" style={{ borderRadius: 16 }}>
              <div style={{ marginBottom: 10, color: token.colorTextSecondary }}>
                已绑定运单 {detailRecord.orderItems.length} 条，件数 {detailRecord.totalPieces}，重量 {detailRecord.totalWeight.toFixed(2)} kg
              </div>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detailRecord.orderItems}
                columns={[
                  { title: 'JOB', dataIndex: 'jobNo', key: 'jobNo', width: 150, render: (value: string) => value || '-' },
                  { title: '运单号', dataIndex: 'subOrderNo', key: 'subOrderNo', width: 170 },
                  { title: '订单号', dataIndex: 'masterOrderNo', key: 'masterOrderNo', width: 170 },
                  { title: '快递单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 150 },
                  { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 150 },
                  { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 70 },
                  { title: '重量Kg', dataIndex: 'weight', key: 'weight', width: 90, render: (value: number) => value.toFixed(2) },
                  { title: '体积', dataIndex: 'volume', key: 'volume', width: 90, render: (value: number) => value.toFixed(3) },
                ]}
              />
            </Card>

            <Card size="small" title="状态轨迹" style={{ borderRadius: 16 }}>
              <Timeline
                items={detailFlowRecords.map((flow) => ({
                  color: 'blue',
                  children: (
                    <div>
                      <div style={{ fontWeight: 600 }}>{flow.action}</div>
                      <div style={{ color: token.colorTextSecondary, fontSize: 12 }}>{formatDateTime(flow.time)}</div>
                      <div style={{ marginTop: 4 }}>操作人：{flow.operator}</div>
                      {flow.detail && <div style={{ color: token.colorTextSecondary, marginTop: 4 }}>{flow.detail}</div>}
                    </div>
                  ),
                }))}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </>
  );
};
