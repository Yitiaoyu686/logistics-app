import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';

const { Text } = Typography;
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { InboundRecord, InboundStatus } from '../../../types/core';
import { warehouseApi, v2WmsApi } from '../../../api';
import { useTableScrollY } from '../../../hooks/useTableScrollY';
import InboundDetailDrawer from './InboundDetailDrawer';
import { buildOriginInboundFallbackData, loadOriginFallbackOrders } from './derivedWarehouseData';

const { RangePicker } = DatePicker;
const { Option } = Select;

type BusinessMode = 'ALL' | 'SEA' | 'AIR';
type InboundScene = 'EXPRESS' | 'TRANSFER' | 'RETURN';
type TransferInboundStatus = 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED' | 'CANCELLED';
type TransferInboundMode = 'SCAN' | 'MANUAL';
type TransferInboundItemStatus = 'PENDING' | 'RECEIVED';
type ReturnInboundTaskStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

/** 主单维度的入库分组状态 */
type MasterOrderInboundStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

/** 快递入库按主单号聚合的分组 */
interface MasterOrderInboundGroup {
  masterOrderNo: string;           // 主单号（来自 OMS 订单管理）
  clientName: string;              // 客户名称
  route: string;                   // 线路
  serviceType: string;             // 服务类型
  salesPerson: string;             // 业务员
  paymentMethod?: string;
  paymentStatus?: string;
  waybills: InboundListRow[];      // 该主单下的所有三方快递运单
  totalCount: number;              // 三方运单总数
  receivedCount: number;           // 已入库数
  pendingCount: number;            // 待入库数
  totalPieces: number;             // 总件数
  totalWeight: number;             // 总重量
  masterStatus: MasterOrderInboundStatus;  // 主单聚合状态
  isClosed: boolean;               // 是否已点击"完成入库"
  lastUpdatedAt?: string;
}

interface InboundListRow extends InboundRecord {
  subOrderNo?: string;
  displaySubOrderNo?: string;
  orderNo?: string;
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
  orderDate?: string;
  updatedAt?: string;
}

interface TransferInboundMeta {
  routeName?: string;
  executeDate?: string;
  logisticsCompany?: string;
  queryPhone?: string;
  driverName?: string;
  driverPhone?: string;
  plateNo?: string;
  note?: string;
}

interface TransferInboundItem {
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
  inboundStatus?: TransferInboundItemStatus;
  inboundMethod?: TransferInboundMode;
  inboundTime?: string;
}

interface TransferInboundRow {
  id: string;
  transferNo: string;
  sourceWarehouse: string;
  targetWarehouse: string;
  routeLabel: string;
  shippingUnitNo?: string;
  orderItems: TransferInboundItem[];
  totalPieces: number;
  totalWeight: number;
  totalVolume: number;
  status: TransferInboundStatus;
  meta: TransferInboundMeta;
  operator?: string;
  createdAt: string;
  updatedAt?: string;
  departureTime?: string;
  arrivalTime?: string;
  confirmedTime?: string;
}

interface ReturnInboundItem {
  id: string;
  shippingUnitNo: string;
  subOrderNo: string;
  trackingNo: string;
  clientName: string;
  goodsDescription?: string;
  pieces: number;
  weight: number;
  inboundStatus?: TransferInboundItemStatus;
  inboundMethod?: TransferInboundMode;
  inboundTime?: string;
}

interface ReturnInboundTaskRow {
  id: string;
  taskNo: string;
  sourceTaskNo?: string;
  returnType?: string;
  returnReason?: string;
  sourceWarehouse: string;
  targetWarehouse: string;
  shippingUnits: string[];
  items: ReturnInboundItem[];
  totalPieces: number;
  totalWeight: number;
  status: ReturnInboundTaskStatus;
  createdAt: string;
  updatedAt?: string;
}

interface ManualInboundFormValues {
  subOrderId: string;
  masterOrderId: string;
  trackingNo: string;
  expressCompany: string;
  clientCode: string;
  clientName: string;
  pieces: number;
  actualWeight?: number;
  actualVolume?: number;
  warehouseLocation?: string;
  remark?: string;
}

interface ManualTransferInboundFormValues {
  subOrderNo: string;
  trackingNo?: string;
  clientName?: string;
  pieces: number;
  weight?: number;
  volume?: number;
}

interface ManualReturnInboundFormValues {
  shippingUnitNo: string;
  subOrderNo: string;
  trackingNo?: string;
  clientName?: string;
  goodsDescription?: string;
  pieces: number;
  weight?: number;
}

const STATUS_CONFIG: Record<InboundStatus, { text: string; color: string; icon: React.ReactNode }> = {
  PENDING: { text: '待处理', color: 'warning', icon: <ClockCircleOutlined /> },
  PROCESSING: { text: '处理中', color: 'processing', icon: <ClockCircleOutlined /> },
  COMPLETED: { text: '已入库', color: 'success', icon: <CheckCircleOutlined /> },
  ABNORMAL: { text: '异常', color: 'error', icon: <WarningOutlined /> },
};

const getInboundStatusView = (record: InboundListRow) => {
  if (record.status === 'ABNORMAL' && String(record.remark || '').includes('[取消入库]')) {
    return { text: '已取消', color: 'default', icon: <ClockCircleOutlined /> };
  }
  return STATUS_CONFIG[record.status];
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PREPAID: '预付',
  COD: '到付',
  CREDIT_CARD: '信用卡',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: '未付',
  PARTIAL: '部分付',
  PAID: '已付',
};

const TRACKING_STATUS_COLOR: Record<string, string> = {
  已签收: 'success',
  未签收: 'default',
  已取消: 'warning',
  异常: 'error',
};

const TRANSFER_STATUS_CONFIG: Record<TransferInboundStatus, { text: string; color: string }> = {
  PENDING: { text: '待发运', color: 'gold' },
  IN_TRANSIT: { text: '运输中', color: 'processing' },
  ARRIVED: { text: '待入库', color: 'cyan' },
  RECEIVED: { text: '已入库', color: 'success' },
  CANCELLED: { text: '已取消', color: 'default' },
};

const TRANSFER_META_PREFIX = '__TRANSFER_DEMO__';
const RETURN_STATUS_CONFIG: Record<ReturnInboundTaskStatus, { text: string; color: string }> = {
  PENDING: { text: '待入库', color: 'warning' },
  PARTIAL: { text: '部分入库', color: 'processing' },
  COMPLETED: { text: '已入库', color: 'success' },
};

const parseTransferInboundMeta = (remark?: string | null): TransferInboundMeta => {
  const text = String(remark || '').trim();
  if (!text) return {};

  if (text.startsWith(TRANSFER_META_PREFIX)) {
    try {
      return JSON.parse(text.slice(TRANSFER_META_PREFIX.length)) as TransferInboundMeta;
    } catch {
      return { note: text };
    }
  }

  const meta: TransferInboundMeta = {};
  text
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((part) => {
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
      if (key === '车牌') meta.plateNo = value;
      if (key === '备注') meta.note = value;
    });

  if (!meta.note && text && !text.includes(':') && !text.includes('：')) {
    meta.note = text;
  }

  return meta;
};

const mapTransferInboundStatus = (status: string): TransferInboundStatus => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'SHIPPED' || normalized === 'IN_TRANSIT') return 'IN_TRANSIT';
  if (normalized === 'ARRIVED') return 'ARRIVED';
  if (normalized === 'RECEIVED') return 'RECEIVED';
  if (normalized === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
};

const recalculateTransferInboundRecord = (record: TransferInboundRow): TransferInboundRow => {
  const totalPieces = record.orderItems.reduce((sum, item) => sum + Number(item.pieces || 0), 0);
  const totalWeight = record.orderItems.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const totalVolume = record.orderItems.reduce((sum, item) => sum + Number(item.volume || 0), 0);
  const receivedCount = record.orderItems.filter((item) => item.inboundStatus === 'RECEIVED').length;
  const hasItems = record.orderItems.length > 0;
  const allReceived = hasItems && receivedCount === record.orderItems.length;
  const now = dayjs().toISOString();

  return {
    ...record,
    totalPieces,
    totalWeight,
    totalVolume,
    status: allReceived ? 'RECEIVED' : 'ARRIVED',
    updatedAt: now,
    confirmedTime: allReceived ? now : undefined,
    arrivalTime: record.arrivalTime || now,
  };
};

const recalculateReturnInboundTask = (task: ReturnInboundTaskRow): ReturnInboundTaskRow => {
  const totalPieces = task.items.reduce((sum, item) => sum + Number(item.pieces || 0), 0);
  const totalWeight = task.items.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const receivedCount = task.items.filter((item) => item.inboundStatus === 'RECEIVED').length;
  const status: ReturnInboundTaskStatus =
    receivedCount === 0 ? 'PENDING' : receivedCount === task.items.length ? 'COMPLETED' : 'PARTIAL';

  return {
    ...task,
    totalPieces,
    totalWeight,
    status,
    updatedAt: dayjs().toISOString(),
  };
};

const mapTransferInboundRow = (raw: any): TransferInboundRow => {
  const meta = parseTransferInboundMeta(raw.remark);
  const orderItems: TransferInboundItem[] = Array.isArray(raw.items)
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
      inboundStatus: 'PENDING',
      }))
    : [];

  return {
    id: String(raw.id),
    transferNo: String(raw.transferNo || raw.transfer_no || raw.id),
    sourceWarehouse: String(raw.fromWarehouse || '-'),
    targetWarehouse: String(raw.toWarehouse || '-'),
    routeLabel: meta.routeName || `${String(raw.fromWarehouse || '-')}→${String(raw.toWarehouse || '-')}`,
    shippingUnitNo: raw.containerNo || raw.container_no || undefined,
    orderItems,
    totalPieces: Number(raw.totalPieces || raw.total_pieces || 0),
    totalWeight: Number(raw.totalWeight || raw.total_weight || 0),
    totalVolume: Number(raw.totalVolume || raw.total_volume || 0),
    status: mapTransferInboundStatus(raw.status),
    meta,
    operator: String(raw.createdBy || raw.created_by || '-'),
    createdAt: String(raw.createdAt || raw.created_at || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.updated_at || raw.createdAt || raw.created_at || new Date().toISOString()),
    departureTime: raw.outboundAt || raw.outbound_at || undefined,
    arrivalTime: raw.inboundAt || raw.inbound_at || undefined,
    confirmedTime: raw.confirmedTime || raw.confirmed_time || undefined,
  };
};

const buildTransferInboundFallbackData = (businessMode: BusinessMode): TransferInboundRow[] => {
  const prefix = businessMode === 'AIR' ? 'AIR' : 'SEA';
  return [
    {
      id: `TRF-IN-${prefix}-001`,
      transferNo: `${prefix === 'AIR' ? 'A' : 'S'}-T-20260326-0001`,
      sourceWarehouse: '深圳集货区',
      targetWarehouse: '广州总仓',
      routeLabel: '深圳集货区→广州总仓',
      shippingUnitNo: prefix === 'AIR' ? 'PALT-A-021' : 'SEA-CN-201',
      orderItems: [
        {
          id: `TRF-IN-${prefix}-001-1`,
          jobNo: `${prefix === 'AIR' ? 'A' : 'S'}-JOB26030041`,
          subOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603260041-01`,
          masterOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603260041`,
          trackingNo: `${prefix === 'AIR' ? 'SF' : 'ZT'}2603260001`,
          clientName: '演示客户A',
          pieces: 2,
          weight: 35.6,
          volume: 0.2,
          route: '深圳集货区→广州总仓',
          inboundStatus: 'PENDING',
        },
        {
          id: `TRF-IN-${prefix}-001-2`,
          jobNo: `${prefix === 'AIR' ? 'A' : 'S'}-JOB26030041`,
          subOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603260041-02`,
          masterOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603260041`,
          trackingNo: `${prefix === 'AIR' ? 'JD' : 'YT'}2603260002`,
          clientName: '演示客户A',
          pieces: 1,
          weight: 11.4,
          volume: 0.08,
          route: '深圳集货区→广州总仓',
          inboundStatus: 'PENDING',
        },
      ],
      totalPieces: 3,
      totalWeight: 47,
      totalVolume: 0.28,
      status: 'ARRIVED',
      meta: {
        executeDate: '2026-03-26',
        logisticsCompany: '粤港专线',
        queryPhone: '020-88886666',
        driverName: '陈师傅',
        driverPhone: '13800001111',
        plateNo: '粤A-TRF11',
        note: '整箱完好，可整箱核收。',
      },
      operator: '仓管A',
      createdAt: '2026-03-26T09:10:00',
      updatedAt: '2026-03-26T12:30:00',
      departureTime: '2026-03-26T10:20:00',
      arrivalTime: '2026-03-26T12:20:00',
    },
    {
      id: `TRF-IN-${prefix}-003`,
      transferNo: `${prefix === 'AIR' ? 'A' : 'S'}-T-20260326-0003`,
      sourceWarehouse: '海珠区站点',
      targetWarehouse: '广州总仓',
      routeLabel: '海珠区站点→广州总仓',
      shippingUnitNo: prefix === 'AIR' ? 'PALT-A-023' : 'SEA-CN-203',
      orderItems: [
        {
          id: `TRF-IN-${prefix}-003-1`,
          jobNo: `${prefix === 'AIR' ? 'A' : 'S'}-JOB26030043`,
          subOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603260043-01`,
          masterOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603260043`,
          trackingNo: `${prefix === 'AIR' ? 'YD' : 'JT'}2603260004`,
          clientName: '演示客户C',
          pieces: 2,
          weight: 23.8,
          volume: 0.15,
          route: '海珠区站点→广州总仓',
          inboundStatus: 'RECEIVED',
          inboundMethod: 'SCAN',
          inboundTime: '2026-03-25T17:45:00',
        },
      ],
      totalPieces: 2,
      totalWeight: 23.8,
      totalVolume: 0.15,
      status: 'RECEIVED',
      meta: {
        executeDate: '2026-03-25',
        logisticsCompany: '城配车队',
        queryPhone: '400-900-2200',
        driverName: '王师傅',
        driverPhone: '13800003333',
        plateNo: '粤C-TRF13',
        note: '已完成调拨到仓入库。',
      },
      operator: '仓管C',
      createdAt: '2026-03-25T10:00:00',
      updatedAt: '2026-03-25T17:45:00',
      departureTime: '2026-03-25T12:00:00',
      arrivalTime: '2026-03-25T16:30:00',
      confirmedTime: '2026-03-25T17:45:00',
    },
  ];
};

const buildReturnInboundFallbackData = (businessMode: BusinessMode): ReturnInboundTaskRow[] => {
  const prefix = businessMode === 'AIR' ? 'A' : 'S';
  return [
    recalculateReturnInboundTask({
      id: `RET-IN-${prefix}-001`,
      taskNo: `${prefix}-JOB26030061`,
      sourceTaskNo: `${prefix}-JOB26030061`,
      returnType: '客户退单',
      returnReason: '客户拒收后回仓',
      sourceWarehouse: '番禺转运区',
      targetWarehouse: '广州总仓',
      shippingUnits: ['RTN-AK1', 'RTN-AK2'],
      items: [
        {
          id: `RET-IN-${prefix}-001-1`,
          shippingUnitNo: 'RTN-AK1',
          subOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603270061-01`,
          trackingNo: `${prefix === 'AIR' ? 'SF' : 'ZT'}2603270001`,
          clientName: '退回客户A',
          goodsDescription: '电子配件',
          pieces: 1,
          weight: 18.5,
          inboundStatus: 'PENDING',
        },
        {
          id: `RET-IN-${prefix}-001-2`,
          shippingUnitNo: 'RTN-AK2',
          subOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603270061-02`,
          trackingNo: `${prefix === 'AIR' ? 'JD' : 'YT'}2603270002`,
          clientName: '退回客户A',
          goodsDescription: '家居百货',
          pieces: 2,
          weight: 24.2,
          inboundStatus: 'PENDING',
        },
      ],
      totalPieces: 3,
      totalWeight: 42.7,
      status: 'PENDING',
      createdAt: '2026-03-27T09:20:00',
      updatedAt: '2026-03-27T09:20:00',
    }),
    recalculateReturnInboundTask({
      id: `RET-IN-${prefix}-002`,
      taskNo: `${prefix}-JOB26030062`,
      sourceTaskNo: `${prefix}-JOB26030062`,
      returnType: '海关退运',
      returnReason: '查验退回后重新回仓',
      sourceWarehouse: '深圳集货区',
      targetWarehouse: '广州总仓',
      shippingUnits: ['RTN-AK3'],
      items: [
        {
          id: `RET-IN-${prefix}-002-1`,
          shippingUnitNo: 'RTN-AK3',
          subOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603270062-01`,
          trackingNo: `${prefix === 'AIR' ? 'ST' : 'JT'}2603270003`,
          clientName: '退回客户B',
          goodsDescription: '展会物料',
          pieces: 1,
          weight: 15.3,
          inboundStatus: 'RECEIVED',
          inboundMethod: 'SCAN',
          inboundTime: '2026-03-27T11:30:00',
        },
        {
          id: `RET-IN-${prefix}-002-2`,
          shippingUnitNo: 'RTN-AK3',
          subOrderNo: `${prefix === 'AIR' ? 'A' : 'S'}-202603270062-02`,
          trackingNo: `${prefix === 'AIR' ? 'YD' : 'SF'}2603270004`,
          clientName: '退回客户B',
          goodsDescription: '服饰配件',
          pieces: 1,
          weight: 12.6,
          inboundStatus: 'PENDING',
        },
      ],
      totalPieces: 2,
      totalWeight: 27.9,
      status: 'PARTIAL',
      createdAt: '2026-03-27T10:40:00',
      updatedAt: '2026-03-27T11:30:00',
    }),
  ];
};

const buildReturnInboundFromApi = (rawRecords: any[]): ReturnInboundTaskRow[] => {
  if (!rawRecords.length) return [];

  const groups = new Map<string, ReturnInboundTaskRow>();

  rawRecords.forEach((raw: any, index: number) => {
    const dayKey = dayjs(raw.createdAt || raw.applyTime || new Date().toISOString()).format('YYYYMMDD');
    const bucket = Math.floor(index / 3) + 1;
    const groupKey = `${dayKey}-${bucket}`;
    const shippingUnitNo = String(raw.currentLocation || `RTN-AK${bucket}`);

    if (!groups.has(groupKey)) {
      groups.set(
        groupKey,
        {
          id: `RET-API-${groupKey}`,
          taskNo: `RET-TASK-${dayKey}-${String(bucket).padStart(3, '0')}`,
          sourceTaskNo: raw.orderNo || '-',
          returnType: raw.returnType || '客户退单',
          returnReason: raw.reason || '-',
          sourceWarehouse: String(raw.currentLocation || '退回站点'),
          targetWarehouse: String(raw.warehouse || '广州总仓'),
          shippingUnits: [],
          items: [],
          totalPieces: 0,
          totalWeight: 0,
          status: 'PENDING',
          createdAt: raw.createdAt || new Date().toISOString(),
          updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
        },
      );
    }

    const task = groups.get(groupKey)!;
    if (!task.shippingUnits.includes(shippingUnitNo)) {
      task.shippingUnits.push(shippingUnitNo);
    }
    task.items.push({
      id: String(raw.id || `${groupKey}-${index}`),
      shippingUnitNo,
      subOrderNo: String(raw.returnNo || raw.subOrderNo || `RET-${index + 1}`),
      trackingNo: String(raw.trackingNo || '-'),
      clientName: String(raw.customerName || '-'),
      goodsDescription: String(raw.reason || raw.remark || '退回货物'),
      pieces: Number(raw.pieces || 0),
      weight: Number(raw.weight || 0),
      inboundStatus: raw.status === 'COMPLETED' || raw.status === 'RETURNED' ? 'RECEIVED' : 'PENDING',
      inboundMethod: raw.status === 'COMPLETED' || raw.status === 'RETURNED' ? 'MANUAL' : undefined,
      inboundTime: raw.approveTime || undefined,
    });
  });

  return Array.from(groups.values()).map(recalculateReturnInboundTask);
};

const STATION_OPTIONS = [
  { label: '全部', value: 'ALL' },
  { label: '广州总仓', value: '广州总仓' },
  { label: '深圳集货区', value: '深圳集货区' },
  { label: '佛山拼货区', value: '佛山拼货区' },
  { label: '海珠区站点', value: '海珠区站点' },
];

export const InboundList = ({
  warehouseId,
  businessMode = 'ALL',
  initialScene,
}: {
  warehouseId?: string;
  businessMode?: BusinessMode;
  initialScene?: InboundScene;
}) => {
  const [loading, setLoading] = useState(false);
  const [scene, setScene] = useState<InboundScene>(initialScene || 'EXPRESS');
  const [records, setRecords] = useState<InboundListRow[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferInboundRow[]>([]);
  const [returnInboundTasks, setReturnInboundTasks] = useState<ReturnInboundTaskRow[]>([]);
  const [unmatchedPendingCount, setUnmatchedPendingCount] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<InboundStatus | 'ALL'>('PENDING');
  const [transferStatusFilter, setTransferStatusFilter] = useState<TransferInboundStatus | 'ALL'>('ARRIVED');
  const [returnStatusFilter, setReturnStatusFilter] = useState<ReturnInboundTaskStatus | 'ALL'>('PENDING');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [filterStation, setFilterStation] = useState<string>('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');
  const [filterSales, setFilterSales] = useState<string>('ALL');

  const [supplementDrawerVisible, setSupplementDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<InboundListRow | null>(null);

  // 打印面单 Modal
  const [printLabelOpen, setPrintLabelOpen] = useState(false);
  const [printLabelRecord, setPrintLabelRecord] = useState<InboundListRow | null>(null);
  // 主单完成入库的关闭集合（记录哪些主单号已被显式标记完成）
  const [closedMasterOrders, setClosedMasterOrders] = useState<Set<string>>(new Set());
  // 添加三方快递 Modal
  const [addWaybillOpen, setAddWaybillOpen] = useState(false);
  const [addWaybillMasterNo, setAddWaybillMasterNo] = useState<string>('');
  const [addWaybillForm] = Form.useForm();
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<InboundListRow | null>(null);
  const [transferDrawerVisible, setTransferDrawerVisible] = useState(false);
  const [transferDrawerMode, setTransferDrawerMode] = useState<'inbound' | 'detail'>('detail');
  const [selectedTransferRecord, setSelectedTransferRecord] = useState<TransferInboundRow | null>(null);
  const [transferInboundMode, setTransferInboundMode] = useState<TransferInboundMode>('SCAN');
  const [transferInboundKeyword, setTransferInboundKeyword] = useState('');
  const [highlightedTransferItemId, setHighlightedTransferItemId] = useState<string | null>(null);
  const [returnDrawerVisible, setReturnDrawerVisible] = useState(false);
  const [returnDrawerMode, setReturnDrawerMode] = useState<'inbound' | 'detail'>('detail');
  const [selectedReturnTask, setSelectedReturnTask] = useState<ReturnInboundTaskRow | null>(null);
  const [returnInboundKeyword, setReturnInboundKeyword] = useState('');
  const [highlightedReturnItemId, setHighlightedReturnItemId] = useState<string | null>(null);
  const [returnScanMode, setReturnScanMode] = useState(true);
  const [selectedReturnShippingUnit, setSelectedReturnShippingUnit] = useState<string>('ALL');
  const [selectedReturnWaybill, setSelectedReturnWaybill] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm<ManualInboundFormValues>();
  const [manualTransferForm] = Form.useForm<ManualTransferInboundFormValues>();
  const [manualReturnForm] = Form.useForm<ManualReturnInboundFormValues>();

  const normalizeInboundCode = (value: string) => String(value || '').replace(/[\s-]/g, '').toUpperCase();

  const fetchUnmatchedCount = async () => {
    try {
      const res: any = await v2WmsApi.listUnmatchedPackages({
        status: 'PENDING',
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      });
      setUnmatchedPendingCount(Array.isArray(res?.data) ? res.data.length : 0);
    } catch (_) {
      setUnmatchedPendingCount(0);
    }
  };

  const fetchData = async (withFilters = false) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        warehouse: 'CN',
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      };

      if (withFilters) {
        if (searchText.trim()) params.keyword = searchText.trim();
        if (filterStatus !== 'ALL') params.status = filterStatus;
        if (dateRange[0]) params.startDate = dateRange[0].startOf('day').toISOString();
        if (dateRange[1]) params.endDate = dateRange[1].endOf('day').toISOString();
      }

      const inboundRes: any = await warehouseApi.listInbound(params);
      let rows = (Array.isArray(inboundRes?.data) ? inboundRes.data : []) as InboundListRow[];

      if (!rows.length) {
        const fallbackOrders = await loadOriginFallbackOrders(businessMode);
        rows = buildOriginInboundFallbackData(fallbackOrders) as InboundListRow[];
      }

      rows = rows.filter((row) => !row.transferNo);
      setRecords(rows);

      try {
        const transferRes: any = await warehouseApi.listTransfers({
          transferType: 'ORIGIN',
          businessLine: businessMode === 'ALL' ? undefined : businessMode,
        });
        const transferRows = (Array.isArray(transferRes?.data) ? transferRes.data : [])
          .map(mapTransferInboundRow)
          .filter((record) => record.status === 'ARRIVED' || record.status === 'RECEIVED');
        setTransferRecords(transferRows.length ? transferRows : buildTransferInboundFallbackData(businessMode));
      } catch (_) {
        setTransferRecords(buildTransferInboundFallbackData(businessMode));
      }

      try {
        const returnRes: any = await warehouseApi.listReturns({
          warehouseId,
          businessLine: businessMode === 'ALL' ? undefined : businessMode,
        });
        const returnRows = buildReturnInboundFromApi(Array.isArray(returnRes?.data) ? returnRes.data : []);
        setReturnInboundTasks(returnRows.length ? returnRows : buildReturnInboundFallbackData(businessMode));
      } catch (_) {
        setReturnInboundTasks(buildReturnInboundFallbackData(businessMode));
      }

      fetchUnmatchedCount();
    } catch (error: any) {
      try {
        const fallbackOrders = await loadOriginFallbackOrders(businessMode);
        const fallbackRows = (buildOriginInboundFallbackData(fallbackOrders) as InboundListRow[])
          .filter((row) => !row.transferNo);
        setRecords(fallbackRows);
        setTransferRecords(buildTransferInboundFallbackData(businessMode));
        setReturnInboundTasks(buildReturnInboundFallbackData(businessMode));
      } catch (_) {
        message.error(error.message || '加载入库数据失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [warehouseId, businessMode]);

  const handleSearch = () => {
    fetchData(true);
  };

  const handleSceneChange = (nextScene: string) => {
    const normalized = (['EXPRESS', 'TRANSFER', 'RETURN'].includes(nextScene) ? nextScene : 'EXPRESS') as InboundScene;
    setScene(normalized);
    setSearchText('');
    setDateRange([null, null]);
    setFilterStation('ALL');
    if (normalized === 'EXPRESS') {
      setFilterStatus('PENDING');
      setFilterPaymentMethod('ALL');
      setFilterPaymentStatus('ALL');
      setFilterSales('ALL');
    } else if (normalized === 'TRANSFER') {
      setTransferStatusFilter('ARRIVED');
      setFilterPaymentMethod('ALL');
      setFilterPaymentStatus('ALL');
      setFilterSales('ALL');
    } else {
      setReturnStatusFilter('PENDING');
      setFilterPaymentMethod('ALL');
      setFilterPaymentStatus('ALL');
      setFilterSales('ALL');
    }
  };

  const handleReset = () => {
    setSearchText('');
    setDateRange([null, null]);
    setFilterStation('ALL');
    setFilterPaymentMethod('ALL');
    setFilterPaymentStatus('ALL');
    setFilterSales('ALL');
    if (scene === 'EXPRESS') {
      setFilterStatus('ALL');
    } else if (scene === 'TRANSFER') {
      setTransferStatusFilter('ARRIVED');
    } else {
      setReturnStatusFilter('PENDING');
    }
    fetchData(false);
  };

  const handleSupplement = (record: InboundListRow) => {
    setSelectedRecord(record);
    setSupplementDrawerVisible(true);
  };

  /** 获取主单号 - 去掉子单后缀（-01, -02 等） */
  const extractMasterOrderNo = (record: InboundListRow): string => {
    const raw = record.orderNo || record.displayOrderNo || record.subOrderNo || record.displaySubOrderNo || '';
    // 去除末尾的 -NN 子单后缀
    return raw.replace(/-\d{2}$/, '') || record.id;
  };

  /** 将扁平的 records 按主单号聚合 */
  const masterOrderGroups = useMemo<MasterOrderInboundGroup[]>(() => {
    const map = new Map<string, MasterOrderInboundGroup>();
    records.forEach((record) => {
      const masterOrderNo = extractMasterOrderNo(record);
      if (!map.has(masterOrderNo)) {
        map.set(masterOrderNo, {
          masterOrderNo,
          clientName: record.clientName || '-',
          route: record.route || '-',
          serviceType: record.serviceType || '-',
          salesPerson: record.salesPerson || '-',
          paymentMethod: record.paymentMethod,
          paymentStatus: record.paymentStatus,
          waybills: [],
          totalCount: 0,
          receivedCount: 0,
          pendingCount: 0,
          totalPieces: 0,
          totalWeight: 0,
          masterStatus: 'PENDING',
          isClosed: closedMasterOrders.has(masterOrderNo),
          lastUpdatedAt: undefined,
        });
      }
      const group = map.get(masterOrderNo)!;
      group.waybills.push(record);
      group.totalCount += 1;
      if (record.status === 'COMPLETED') {
        group.receivedCount += 1;
      } else {
        group.pendingCount += 1;
      }
      group.totalPieces += Number(record.pieces || 0);
      group.totalWeight += Number(record.actualWeight || 0);
      const recordTime = record.updatedAt || record.createdAt;
      if (recordTime && (!group.lastUpdatedAt || recordTime > group.lastUpdatedAt)) {
        group.lastUpdatedAt = recordTime;
      }
    });

    // 计算主单聚合状态
    return Array.from(map.values()).map((group) => {
      let masterStatus: MasterOrderInboundStatus;
      if (group.isClosed || (group.totalCount > 0 && group.receivedCount === group.totalCount)) {
        masterStatus = 'COMPLETED';
      } else if (group.receivedCount > 0) {
        masterStatus = 'PARTIAL';
      } else {
        masterStatus = 'PENDING';
      }
      return { ...group, masterStatus };
    });
  }, [records, closedMasterOrders]);

  /** 打开打印面单 Modal */
  const handlePrintLabel = (record: InboundListRow) => {
    setPrintLabelRecord(record);
    setPrintLabelOpen(true);
  };

  /** 标记整个主单入库完成 */
  const handleMarkMasterComplete = (masterOrderNo: string) => {
    Modal.confirm({
      title: '确认完成入库？',
      content: `主单号 ${masterOrderNo} 将被关闭，后续不能再新增三方快递运单。`,
      okText: '确认完成',
      cancelText: '取消',
      onOk: () => {
        setClosedMasterOrders((prev) => {
          const next = new Set(prev);
          next.add(masterOrderNo);
          return next;
        });
        message.success(`${masterOrderNo} 已标记为入库完成`);
      },
    });
  };

  /** 打开添加三方快递 Modal */
  const handleOpenAddWaybill = (masterOrderNo: string) => {
    setAddWaybillMasterNo(masterOrderNo);
    addWaybillForm.resetFields();
    setAddWaybillOpen(true);
  };

  /** 提交添加三方快递 */
  const handleSubmitAddWaybill = async () => {
    try {
      const values = await addWaybillForm.validateFields();
      message.success(`已为 ${addWaybillMasterNo} 添加三方运单 ${values.trackingNo}（Demo 数据仅展示，未持久化）`);
      setAddWaybillOpen(false);
      setAddWaybillMasterNo('');
      addWaybillForm.resetFields();
    } catch (_) {
      /* validation failed */
    }
  };

  const handleViewDetail = async (record: InboundListRow) => {
    try {
      const res: any = await warehouseApi.getInbound(record.id);
      const latest = (res?.data || record) as InboundListRow;
      setDetailRecord(latest);
      setDetailVisible(true);
    } catch (_) {
      setDetailRecord(record);
      setDetailVisible(true);
    }
  };

  const handleOpenTransferDrawer = (record: TransferInboundRow, mode: 'inbound' | 'detail') => {
    setSelectedTransferRecord(record);
    setTransferDrawerMode(mode);
    setTransferInboundMode('SCAN');
    setTransferInboundKeyword('');
    setHighlightedTransferItemId(null);
    setTransferDrawerVisible(true);
  };

  const closeTransferDrawer = () => {
    setTransferDrawerVisible(false);
    setSelectedTransferRecord(null);
    setTransferInboundKeyword('');
    setHighlightedTransferItemId(null);
  };

  const updateTransferInboundRecord = (recordId: string, updater: (record: TransferInboundRow) => TransferInboundRow) => {
    let latestRecord: TransferInboundRow | null = null;
    setTransferRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record;
        latestRecord = updater(record);
        return latestRecord!;
      }),
    );
    if (latestRecord) {
      setSelectedTransferRecord(latestRecord);
    }
  };

  const handleTransferScanInbound = (rawKeyword?: string) => {
    const keyword = String(rawKeyword || transferInboundKeyword).trim();
    if (!selectedTransferRecord || !keyword) {
      message.warning('请先扫描集装号或运单号');
      return;
    }

    let matched = false;

    updateTransferInboundRecord(selectedTransferRecord.id, (record) => {
      let nextItems = record.orderItems;

      if (record.shippingUnitNo && keyword === record.shippingUnitNo) {
        matched = record.orderItems.length > 0;
        nextItems = record.orderItems.map((item) => ({
          ...item,
          inboundStatus: 'RECEIVED',
          inboundMethod: 'SCAN',
          inboundTime: dayjs().toISOString(),
        }));
      } else {
        nextItems = record.orderItems.map((item) => {
          const itemMatched = [item.subOrderNo, item.trackingNo, item.masterOrderNo].filter(Boolean).includes(keyword);
          if (!itemMatched) return item;
          matched = true;
          setHighlightedTransferItemId(item.id);
          return {
            ...item,
            inboundStatus: 'RECEIVED',
            inboundMethod: 'SCAN',
            inboundTime: dayjs().toISOString(),
          };
        });
      }

      return recalculateTransferInboundRecord({
        ...record,
        orderItems: nextItems,
      });
    });

    if (matched) {
      message.success('扫码入库已记录');
      setTransferInboundKeyword('');
      return;
    }

    message.warning('未匹配到当前调拨单内的集装号或运单号');
  };

  const handleManualTransferInbound = async () => {
    if (!selectedTransferRecord) return;

    try {
      const values = await manualTransferForm.validateFields();
      const nextItem: TransferInboundItem = {
        id: `${selectedTransferRecord.id}-manual-${Date.now()}`,
        jobNo: selectedTransferRecord.orderItems[0]?.jobNo || '',
        subOrderNo: values.subOrderNo,
        masterOrderNo: values.subOrderNo.split('-').slice(0, -1).join('-') || values.subOrderNo,
        trackingNo: values.trackingNo || '-',
        clientName: values.clientName || '手动录单客户',
        pieces: Number(values.pieces || 0),
        weight: Number(values.weight || 0),
        volume: Number(values.volume || 0),
        route: selectedTransferRecord.routeLabel,
        inboundStatus: 'RECEIVED',
        inboundMethod: 'MANUAL',
        inboundTime: dayjs().toISOString(),
      };

      updateTransferInboundRecord(selectedTransferRecord.id, (record) =>
        recalculateTransferInboundRecord({
          ...record,
          orderItems: [...record.orderItems, nextItem],
        }),
      );

      setHighlightedTransferItemId(nextItem.id);
      manualTransferForm.resetFields();
      message.success('手动录单入库已记录');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '手动录单入库失败');
    }
  };

  const handleTransferInboundStatusChange = (itemId: string, nextStatus: TransferInboundItemStatus) => {
    if (!selectedTransferRecord) return;

    updateTransferInboundRecord(selectedTransferRecord.id, (record) =>
      recalculateTransferInboundRecord({
        ...record,
        orderItems: record.orderItems.map((item) =>
          item.id !== itemId
            ? item
            : {
                ...item,
                inboundStatus: nextStatus,
                inboundMethod: nextStatus === 'RECEIVED' ? item.inboundMethod || 'MANUAL' : undefined,
                inboundTime: nextStatus === 'RECEIVED' ? item.inboundTime || dayjs().toISOString() : undefined,
              },
        ),
      }),
    );
  };

  const handleSaveTransferInbound = () => {
    if (!selectedTransferRecord) return;
    message.success(`${selectedTransferRecord.transferNo} 已保存本次入库`);
    closeTransferDrawer();
  };

  const handleConfirmTransferInbound = () => {
    if (!selectedTransferRecord) return;
    if (selectedTransferRecord.orderItems.some((item) => item.inboundStatus !== 'RECEIVED')) {
      message.warning('还有未入库运单，请全部核对完成后再做最终确认');
      return;
    }
    updateTransferInboundRecord(selectedTransferRecord.id, (record) =>
      recalculateTransferInboundRecord({
        ...record,
        confirmedTime: dayjs().toISOString(),
      }),
    );
    message.success(`${selectedTransferRecord.transferNo} 已完成入库确认`);
    closeTransferDrawer();
  };

  const handleOpenReturnDrawer = (task: ReturnInboundTaskRow, mode: 'inbound' | 'detail') => {
    setSelectedReturnTask(task);
    setReturnDrawerMode(mode);
    setReturnInboundKeyword('');
    setHighlightedReturnItemId(null);
    setReturnScanMode(true);
    setSelectedReturnShippingUnit('ALL');
    setSelectedReturnWaybill(null);
    setReturnDrawerVisible(true);
  };

  const closeReturnDrawer = () => {
    setReturnDrawerVisible(false);
    setSelectedReturnTask(null);
    setReturnInboundKeyword('');
    setHighlightedReturnItemId(null);
    setSelectedReturnShippingUnit('ALL');
    setSelectedReturnWaybill(null);
  };

  const updateReturnInboundTask = (taskId: string, updater: (task: ReturnInboundTaskRow) => ReturnInboundTaskRow) => {
    let latestTask: ReturnInboundTaskRow | null = null;
    setReturnInboundTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        latestTask = updater(task);
        return latestTask!;
      }),
    );
    if (latestTask) {
      setSelectedReturnTask(latestTask);
    }
  };

  const handleReturnScanInbound = (rawKeyword?: string) => {
    const keyword = String(rawKeyword || returnInboundKeyword).trim();
    if (!selectedReturnTask || !keyword) {
      message.warning('请先扫描集装号或运单号');
      return;
    }

    let matched = false;
    const normalizedKeyword = normalizeInboundCode(keyword);

    updateReturnInboundTask(selectedReturnTask.id, (task) =>
      recalculateReturnInboundTask({
        ...task,
        items: task.items.map((item) => {
          const matchedContainer = normalizeInboundCode(item.shippingUnitNo) === normalizedKeyword;
          const matchedWaybill = [item.subOrderNo, item.trackingNo].filter(Boolean).some((value) => normalizeInboundCode(value) === normalizedKeyword);
          if (!matchedContainer && !matchedWaybill) return item;
          matched = true;
          setSelectedReturnShippingUnit(item.shippingUnitNo);
          setSelectedReturnWaybill(matchedWaybill ? item.subOrderNo : null);
          if (!highlightedReturnItemId) {
            setHighlightedReturnItemId(item.id);
          }
          return {
            ...item,
            inboundStatus: 'RECEIVED',
            inboundMethod: 'SCAN',
            inboundTime: dayjs().toISOString(),
          };
        }),
      }),
    );

    if (matched) {
      setReturnInboundKeyword('');
      message.success('退回入库扫码已记录');
      return;
    }

    message.warning('未匹配到当前退回任务内的集装号或运单号');
  };

  const handleManualReturnInbound = async () => {
    if (!selectedReturnTask) return;

    try {
      const values = await manualReturnForm.validateFields();
      const nextItem: ReturnInboundItem = {
        id: `${selectedReturnTask.id}-manual-${Date.now()}`,
        shippingUnitNo: values.shippingUnitNo,
        subOrderNo: values.subOrderNo,
        trackingNo: values.trackingNo || '-',
        clientName: values.clientName || '手动录单客户',
        goodsDescription: values.goodsDescription || '退回货物',
        pieces: Number(values.pieces || 0),
        weight: Number(values.weight || 0),
        inboundStatus: 'RECEIVED',
        inboundMethod: 'MANUAL',
        inboundTime: dayjs().toISOString(),
      };

      updateReturnInboundTask(selectedReturnTask.id, (task) =>
        recalculateReturnInboundTask({
          ...task,
          shippingUnits: task.shippingUnits.includes(values.shippingUnitNo)
            ? task.shippingUnits
            : [...task.shippingUnits, values.shippingUnitNo],
          items: [...task.items, nextItem],
        }),
      );

      manualReturnForm.resetFields();
      setHighlightedReturnItemId(nextItem.id);
      message.success('手动录单退回入库已记录');
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '手动录单失败');
    }
  };

  const handleReturnInboundStatusChange = (itemId: string, nextStatus: TransferInboundItemStatus) => {
    if (!selectedReturnTask) return;

    updateReturnInboundTask(selectedReturnTask.id, (task) =>
      recalculateReturnInboundTask({
        ...task,
        items: task.items.map((item) =>
          item.id !== itemId
            ? item
            : {
                ...item,
                inboundStatus: nextStatus,
                inboundMethod: nextStatus === 'RECEIVED' ? item.inboundMethod || 'MANUAL' : undefined,
                inboundTime: nextStatus === 'RECEIVED' ? item.inboundTime || dayjs().toISOString() : undefined,
              },
        ),
      }),
    );
  };

  const handleSaveReturnInbound = () => {
    if (!selectedReturnTask) return;
    message.success(`${displayReturnTaskNo(selectedReturnTask)} 已保存本次入库`);
    closeReturnDrawer();
  };

  const handleConfirmReturnInbound = () => {
    if (!selectedReturnTask) return;
    if (selectedReturnTask.items.some((item) => item.inboundStatus !== 'RECEIVED')) {
      message.warning('还有未入库运单，请全部核对完成后再做最终确认');
      return;
    }
    updateReturnInboundTask(selectedReturnTask.id, (task) =>
      recalculateReturnInboundTask({
        ...task,
        updatedAt: dayjs().toISOString(),
      }),
    );
    message.success(`${displayReturnTaskNo(selectedReturnTask)} 已完成入库确认`);
    closeReturnDrawer();
  };

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelRecord, setCancelRecord] = useState<InboundListRow | null>(null);
  const [cancelGoodsReceived, setCancelGoodsReceived] = useState<'YES' | 'NO' | ''>('');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelRemarkText, setCancelRemarkText] = useState<string>('');
  // 退运信息
  const [returnExpressCompany, setReturnExpressCompany] = useState<string>('');
  const [returnTrackingNo, setReturnTrackingNo] = useState<string>('');
  const [returnAddress, setReturnAddress] = useState<string>('');
  const [returnContact, setReturnContact] = useState<string>('');
  const [returnPhone, setReturnPhone] = useState<string>('');
  const { tableContainerRef, tableScrollY } = useTableScrollY([scene], 104, 280);

  const CANCEL_REASONS_NOT_RECEIVED = [
    '未收到货物', '物流丢失', '运单信息错误', '重复下单', '其他',
  ];

  const CANCEL_REASONS_RECEIVED = [
    '客户取消', '货物损坏', '禁运物品', '货物不符', '客户拒收', '其他',
  ];

  const handleCancelInbound = (record: InboundListRow) => {
    setCancelRecord(record);
    setCancelGoodsReceived('');
    setCancelReason('');
    setCancelRemarkText('');
    setReturnExpressCompany('');
    setReturnTrackingNo('');
    setReturnAddress('');
    setReturnContact('');
    setReturnPhone('');
    setCancelModalVisible(true);
  };

  const handleCancelSubmit = async () => {
    if (!cancelGoodsReceived) {
      message.warning('请确认是否已收到货物');
      return;
    }
    if (!cancelReason) {
      message.warning('请选择取消原因');
      return;
    }
    try {
      const reason = cancelReason === '其他' ? (cancelRemarkText || '其他') : cancelReason;
      await warehouseApi.cancelInbound(cancelRecord!.id, {
        reason,
        operator: 'warehouse_cn',
      });

      if (cancelGoodsReceived === 'YES') {
        // Mock: 创建退运单
        message.success('已取消入库，退运单已创建');
      } else {
        message.success('已取消入库');
      }

      setCancelModalVisible(false);
      setCancelRecord(null);
      await fetchData(true);
    } catch (error: any) {
      message.error(error.message || '取消入库失败');
    }
  };

  const handleDeleteInbound = (record: InboundListRow) => {
    Modal.confirm({
      title: '确认删除入库记录',
      content: `删除后将回退关联库存/子单状态，确认删除 ${record.trackingNo || record.id} 吗？`,
      okText: '确认删除',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await warehouseApi.deleteInbound(record.id);
          message.success('入库记录已删除');
          if (detailRecord?.id === record.id) {
            setDetailVisible(false);
            setDetailRecord(null);
          }
          await fetchData(true);
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleCreateInbound = async () => {
    try {
      const values = await createForm.validateFields();
      await warehouseApi.createInbound({
        ...values,
        warehouse: 'CN',
        warehouseId,
        inboundMethod: 'MANUAL',
        packageCondition: 'GOOD',
        operator: 'warehouse_cn',
      });
      message.success('新增入库成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await fetchData(true);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '新增入库失败');
    }
  };

  const handleSupplementSave = async (updatedRecord: InboundRecord) => {
    const toPhotosArray = () => {
      if (!updatedRecord.photos) return [];
      if (Array.isArray(updatedRecord.photos)) return updatedRecord.photos;
      if (typeof updatedRecord.photos === 'string') {
        try {
          return JSON.parse(updatedRecord.photos);
        } catch (_) {
          return [];
        }
      }
      return [];
    };

    await warehouseApi.updateInbound(updatedRecord.id, {
      actualWeight: updatedRecord.actualWeight ?? null,
      actualVolume: updatedRecord.actualVolume ?? null,
      packageCondition: updatedRecord.packageCondition,
      warehouseLocation: updatedRecord.warehouseLocation ?? null,
      remark: updatedRecord.remark ?? null,
      status: updatedRecord.status,
      photos: toPhotosArray(),
    });

    setSupplementDrawerVisible(false);
    setSelectedRecord(null);
    message.success('入库补录保存成功');
    fetchData(true);
  };

  const todayRecords = records.filter((record) =>
    dayjs(record.inboundTime || record.createdAt).isSame(dayjs(), 'day')
  );
  const todayPieces = todayRecords.reduce((sum, record) => sum + Number(record.pieces || 0), 0);
  const todayWeight = todayRecords.reduce((sum, record) => sum + Number(record.actualWeight || 0), 0);
  const abnormalCount = records.filter((record) => record.status === 'ABNORMAL').length;
  const filteredTransferRecords = transferRecords.filter((record) => {
    const keyword = searchText.trim().toLowerCase();
    const matchedKeyword = !keyword || [
      record.transferNo,
      record.sourceWarehouse,
      record.targetWarehouse,
      record.routeLabel,
      record.shippingUnitNo,
      ...record.orderItems.flatMap((item) => [item.subOrderNo, item.masterOrderNo, item.trackingNo, item.jobNo, item.clientName]),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));

    const matchedStatus = transferStatusFilter === 'ALL' || record.status === transferStatusFilter;
    const matchedDate =
      (!dateRange[0] || dayjs(record.updatedAt || record.createdAt).isAfter(dateRange[0].startOf('day'))) &&
      (!dateRange[1] || dayjs(record.updatedAt || record.createdAt).isBefore(dateRange[1].endOf('day')));
    const matchedStation =
      filterStation === 'ALL' ||
      record.sourceWarehouse.includes(filterStation) ||
      record.targetWarehouse.includes(filterStation);

    return matchedKeyword && matchedStatus && matchedDate && matchedStation;
  });

  const transferTodayRecords = filteredTransferRecords.filter((record) =>
    dayjs(record.updatedAt || record.createdAt).isSame(dayjs(), 'day')
  );
  const transferWaybillCount = filteredTransferRecords.reduce((sum, record) => sum + record.orderItems.length, 0);
  const transferPendingInboundCount = filteredTransferRecords.filter((record) => record.status === 'ARRIVED').length;
  const transferCompletedInboundCount = filteredTransferRecords.filter((record) => record.status === 'RECEIVED').length;
  const transferTotalWeight = filteredTransferRecords.reduce((sum, record) => sum + Number(record.totalWeight || 0), 0);
  const filteredReturnTasks = returnInboundTasks.filter((task) => {
    const keyword = searchText.trim().toLowerCase();
    const matchedKeyword =
      !keyword ||
      [
        task.taskNo,
        task.sourceTaskNo,
        task.returnType,
        task.returnReason,
        task.sourceWarehouse,
        task.targetWarehouse,
        ...task.shippingUnits,
        ...task.items.flatMap((item) => [item.subOrderNo, item.trackingNo, item.clientName, item.goodsDescription]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

    const matchedStatus =
      returnStatusFilter === 'ALL'
        || (returnStatusFilter === 'PENDING' ? task.status !== 'COMPLETED' : task.status === returnStatusFilter);
    const matchedDate =
      (!dateRange[0] || dayjs(task.updatedAt || task.createdAt).isAfter(dateRange[0].startOf('day'))) &&
      (!dateRange[1] || dayjs(task.updatedAt || task.createdAt).isBefore(dateRange[1].endOf('day')));

    return matchedKeyword && matchedStatus && matchedDate;
  });
  const returnPendingTaskCount = filteredReturnTasks.filter((task) => task.status === 'PENDING').length;
  const returnPartialTaskCount = filteredReturnTasks.filter((task) => task.status === 'PARTIAL').length;
  const returnCompletedTaskCount = filteredReturnTasks.filter((task) => task.status === 'COMPLETED').length;
  const returnShippingUnitCount = filteredReturnTasks.reduce((sum, task) => sum + task.shippingUnits.length, 0);
  const returnWaybillCount = filteredReturnTasks.reduce((sum, task) => sum + task.items.length, 0);
  const returnTotalWeight = filteredReturnTasks.reduce((sum, task) => sum + Number(task.totalWeight || 0), 0);
  const currentReturnItems = React.useMemo(() => {
    if (!selectedReturnTask) return [] as ReturnInboundItem[];
    return selectedReturnTask.items.filter((item) => {
      if (selectedReturnShippingUnit !== 'ALL' && item.shippingUnitNo !== selectedReturnShippingUnit) return false;
      if (selectedReturnWaybill && item.subOrderNo !== selectedReturnWaybill) return false;
      return true;
    });
  }, [selectedReturnTask, selectedReturnShippingUnit, selectedReturnWaybill]);
  const returnInboundSummary = React.useMemo(() => {
    if (!selectedReturnTask) {
      return {
        totalPieces: 0,
        totalWeight: 0,
        handledCount: 0,
        pendingCount: 0,
      };
    }

    const handledCount = selectedReturnTask.items.filter((item) => item.inboundStatus === 'RECEIVED').length;
    return {
      totalPieces: selectedReturnTask.items.reduce((sum, item) => sum + Number(item.pieces || 0), 0),
      totalWeight: selectedReturnTask.items.reduce((sum, item) => sum + Number(item.weight || 0), 0),
      handledCount,
      pendingCount: selectedReturnTask.items.length - handledCount,
    };
  }, [selectedReturnTask]);
  const currentReturnBatchCount = currentReturnItems.filter((item) => item.inboundStatus !== 'RECEIVED').length;
  const displayReturnTaskNo = (task: ReturnInboundTaskRow) => task.sourceTaskNo || task.taskNo;
  const returnShippingUnitRowSpans = React.useMemo(() => {
    if (!currentReturnItems.length) return {} as Record<string, number>;

    const spans: Record<string, number> = {};
    let currentIndex = 0;

    while (currentIndex < currentReturnItems.length) {
      const currentItem = currentReturnItems[currentIndex];
      let nextIndex = currentIndex + 1;
      while (
        nextIndex < currentReturnItems.length &&
        currentReturnItems[nextIndex].shippingUnitNo === currentItem.shippingUnitNo
      ) {
        nextIndex += 1;
      }

      spans[currentItem.id] = nextIndex - currentIndex;
      for (let hiddenIndex = currentIndex + 1; hiddenIndex < nextIndex; hiddenIndex += 1) {
        spans[currentReturnItems[hiddenIndex].id] = 0;
      }
      currentIndex = nextIndex;
    }

    return spans;
  }, [currentReturnItems]);

  /** 主单聚合视图的列定义 */
  const masterOrderColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: MasterOrderInboundGroup, index: number) => index + 1,
    },
    {
      title: '主单号',
      dataIndex: 'masterOrderNo',
      key: 'masterOrderNo',
      width: 200,
      render: (value: string) => <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>,
    },
    {
      title: '客户',
      dataIndex: 'clientName',
      key: 'clientName',
      width: 160,
      ellipsis: true,
    },
    {
      title: '线路',
      dataIndex: 'route',
      key: 'route',
      width: 180,
      ellipsis: true,
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 100,
    },
    {
      title: '三方运单',
      key: 'totalCount',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, group: MasterOrderInboundGroup) => (
        <Tag color="blue">{group.totalCount} 个</Tag>
      ),
    },
    {
      title: '收货进度',
      key: 'progress',
      width: 180,
      render: (_: unknown, group: MasterOrderInboundGroup) => {
        const percent = group.totalCount > 0 ? Math.round((group.receivedCount / group.totalCount) * 100) : 0;
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <div style={{ fontSize: 12 }}>
              已入库 <span style={{ fontWeight: 600, color: '#52c41a' }}>{group.receivedCount}</span>
              {' / '}
              <span>{group.totalCount}</span>
            </div>
            <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${percent}%`,
                height: '100%',
                background: group.masterStatus === 'COMPLETED' ? '#52c41a' : '#1677ff',
                transition: 'width 0.3s',
              }} />
            </div>
          </Space>
        );
      },
    },
    {
      title: '状态',
      key: 'masterStatus',
      width: 110,
      render: (_: unknown, group: MasterOrderInboundGroup) => {
        if (group.masterStatus === 'COMPLETED') return <Tag color="success">已完成入库</Tag>;
        if (group.masterStatus === 'PARTIAL') return <Tag color="processing">部分入库</Tag>;
        return <Tag color="warning">待入库</Tag>;
      },
    },
    {
      title: '总件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 90,
      align: 'center' as const,
    },
    {
      title: '总重量Kg',
      key: 'totalWeight',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, group: MasterOrderInboundGroup) => group.totalWeight.toFixed(2),
    },
    {
      title: '更新时间',
      key: 'lastUpdatedAt',
      width: 150,
      render: (_: unknown, group: MasterOrderInboundGroup) =>
        group.lastUpdatedAt ? dayjs(group.lastUpdatedAt).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, group: MasterOrderInboundGroup) => (
        <Space size={4} wrap>
          <Button
            type="link"
            size="small"
            disabled={group.isClosed}
            onClick={() => handleOpenAddWaybill(group.masterOrderNo)}
          >
            添加三方快递
          </Button>
          <Button
            type="link"
            size="small"
            disabled={group.receivedCount === 0 || group.isClosed}
            style={{ color: group.isClosed ? '#bfbfbf' : '#52c41a' }}
            onClick={() => handleMarkMasterComplete(group.masterOrderNo)}
          >
            {group.isClosed ? '已完成' : '完成入库'}
          </Button>
        </Space>
      ),
    },
  ];

  /** 展开行：该主单下所有三方快递运单的子表 */
  const renderExpandedWaybills = (group: MasterOrderInboundGroup) => {
    const subColumns = [
      {
        title: '三方运单号',
        key: 'trackingNo',
        width: 160,
        render: (_: unknown, record: InboundListRow) => (
          <span style={{ fontWeight: 500 }}>{record.trackingNo || '-'}</span>
        ),
      },
      {
        title: '快递公司',
        dataIndex: 'expressCompany',
        key: 'expressCompany',
        width: 120,
        render: (value: string) => value || '-',
      },
      {
        title: '三方状态',
        key: 'thirdPartyStatus',
        width: 110,
        render: (_: unknown, record: InboundListRow) => {
          const statusText = record.thirdPartyStatus || record.logisticsStatus || '-';
          return <Tag color={TRACKING_STATUS_COLOR[statusText] || 'default'}>{statusText}</Tag>;
        },
      },
      {
        title: '品名',
        key: 'goodsDescription',
        width: 120,
        render: (_: unknown, record: InboundListRow) => record.goodsDescription || record.remark || '-',
      },
      {
        title: '件数',
        dataIndex: 'pieces',
        key: 'pieces',
        width: 70,
        align: 'center' as const,
      },
      {
        title: '重量Kg',
        key: 'actualWeight',
        width: 90,
        align: 'right' as const,
        render: (_: unknown, record: InboundListRow) => Number(record.actualWeight || 0).toFixed(2),
      },
      {
        title: '子运单号',
        key: 'subOrderNo',
        width: 180,
        render: (_: unknown, record: InboundListRow) => {
          // 只有入库完成后才显示子运单号
          if (record.status === 'COMPLETED') {
            return (
              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1677ff' }}>
                {record.subWaybillNo || record.displaySubOrderNo || record.subOrderNo || '-'}
              </span>
            );
          }
          return <span style={{ color: '#bfbfbf' }}>入库后生成</span>;
        },
      },
      {
        title: '入库状态',
        key: 'inboundStatus',
        width: 110,
        render: (_: unknown, record: InboundListRow) => {
          const view = getInboundStatusView(record);
          return <span>{view.text}</span>;
        },
      },
      {
        title: '操作',
        key: 'action',
        width: 160,
        render: (_: unknown, record: InboundListRow) => (
          <Space size={4} wrap>
            {record.status !== 'COMPLETED' ? (
              <Button
                type="link"
                size="small"
                disabled={group.isClosed}
                onClick={() => handleSupplement(record)}
              >
                入库
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                onClick={() => handlePrintLabel(record)}
              >
                🖨 打印面单
              </Button>
            )}
            <Button
              type="link"
              size="small"
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
          </Space>
        ),
      },
    ];
    return (
      <Table
        rowKey="id"
        columns={subColumns}
        dataSource={group.waybills}
        pagination={false}
        size="small"
      />
    );
  };

  const expressColumns = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, __: InboundListRow, index: number) => index + 1,
    },
    {
      title: '运单号',
      key: 'waybillNo',
      width: 180,
      render: (_: unknown, record: InboundListRow) => (
        <span style={{ fontWeight: 600 }}>
          {record.subWaybillNo || record.displaySubOrderNo || record.subOrderNo || record.orderNo || '-'}
        </span>
      ),
    },
    {
      title: '第三方运单号',
      key: 'trackingNo',
      width: 180,
      render: (_: unknown, record: InboundListRow) => (
        <span style={{ fontWeight: 500 }}>{record.trackingNo || '-'}</span>
      ),
    },
    {
      title: '快递公司',
      dataIndex: 'expressCompany',
      key: 'expressCompany',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: '第三方状态',
      key: 'thirdPartyStatus',
      width: 140,
      render: (_: unknown, record: InboundListRow) => {
        const statusText = record.thirdPartyStatus || record.logisticsStatus || '-';
        return <Tag color={TRACKING_STATUS_COLOR[statusText] || 'default'}>{statusText}</Tag>;
      },
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 110,
      render: (value: string) => value || '-',
    },
    {
      title: '用户',
      dataIndex: 'clientName',
      key: 'clientName',
      width: 150,
      render: (value: string) => value || '-',
    },
    {
      title: '线路',
      dataIndex: 'route',
      key: 'route',
      width: 180,
      render: (value: string) => value || '-',
    },
    {
      title: '服务类型',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '说明',
      key: 'description',
      width: 120,
      render: (_: unknown, record: InboundListRow) => record.goodsDescription || record.remark || '-',
    },
    {
      title: '重量Kg',
      key: 'actualWeight',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, record: InboundListRow) => Number(record.actualWeight || 0).toFixed(2),
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '物流状态',
      key: 'inboundStatus',
      width: 190,
      render: (_: unknown, record: InboundListRow) => {
        const inboundView = getInboundStatusView(record);
        const statusTime = record.inboundTime || record.updatedAt || record.createdAt;
        return (
          <Space direction="vertical" size={0}>
            <span>{inboundView.text}</span>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
              {[record.warehouseLocation, statusTime ? dayjs(statusTime).format('YYYY-MM-DD HH:mm:ss') : '']
                .filter(Boolean)
                .join(' ')}
            </span>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: unknown, record: InboundListRow) => (
        <Space size={4} wrap>
          {record.status === 'COMPLETED' ? (
            <Button type="link" size="small" onClick={() => handleSupplement(record)}>
              入库
            </Button>
          ) : (
            <Button type="link" size="small" onClick={() => handleSupplement(record)}>
              入库
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            disabled={record.status === 'ABNORMAL'}
            onClick={() => handleCancelInbound(record)}
          >
            取消
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={record.status !== 'ABNORMAL'}
            onClick={() => handleDeleteInbound(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
    {
      title: '更新日期',
      key: 'updatedAt',
      width: 170,
      render: (_: unknown, record: InboundListRow) =>
        dayjs(record.updatedAt || record.createdAt).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const transferColumns = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, __: TransferInboundRow, index: number) => index + 1,
    },
    {
      title: '调拨单号',
      key: 'transferNo',
      width: 190,
      render: (_: unknown, record: TransferInboundRow) => (
        <span style={{ fontWeight: 600 }}>{record.transferNo}</span>
      ),
    },
    {
      title: '来源仓',
      dataIndex: 'sourceWarehouse',
      key: 'sourceWarehouse',
      width: 140,
    },
    {
      title: '目标仓',
      dataIndex: 'targetWarehouse',
      key: 'targetWarehouse',
      width: 140,
    },
    {
      title: '调拨方式',
      key: 'transferMode',
      width: 140,
      render: (_: unknown, record: TransferInboundRow) => {
        if (record.shippingUnitNo && record.orderItems.length > 0) return '集装号+运单';
        if (record.shippingUnitNo) return '按集装号';
        return '按运单';
      },
    },
    {
      title: '集装信息',
      key: 'shippingUnitNo',
      width: 140,
      render: (_: unknown, record: TransferInboundRow) => record.shippingUnitNo || '-',
    },
    {
      title: '运单数',
      key: 'orderCount',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: TransferInboundRow) => record.orderItems.length,
    },
    {
      title: '总件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 90,
      align: 'center' as const,
    },
    {
      title: '总重量Kg',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 110,
      align: 'right' as const,
      render: (value: number) => Number(value || 0).toFixed(2),
    },
    {
      title: '入库状态',
      key: 'status',
      width: 160,
      render: (_: unknown, record: TransferInboundRow) => {
        const statusView = TRANSFER_STATUS_CONFIG[record.status];
        const statusTime = record.confirmedTime || record.arrivalTime || record.updatedAt || record.createdAt;
        return (
          <Space direction="vertical" size={0}>
            <Tag color={statusView.color}>{statusView.text}</Tag>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
              {statusTime ? dayjs(statusTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </span>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: TransferInboundRow) => (
        <Space size={4} wrap>
          <Button
            type="link"
            size="small"
            onClick={() => handleOpenTransferDrawer(record, record.status === 'ARRIVED' ? 'inbound' : 'detail')}
          >
            {record.status === 'ARRIVED' ? '入库' : '查看'}
          </Button>
          <Button type="link" size="small" onClick={() => handleOpenTransferDrawer(record, 'detail')}>
            清单
          </Button>
        </Space>
      ),
    },
    {
      title: '更新日期',
      key: 'updatedAt',
      width: 170,
      render: (_: unknown, record: TransferInboundRow) =>
        dayjs(record.updatedAt || record.createdAt).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const returnColumns = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      align: 'center' as const,
      render: (_: unknown, __: ReturnInboundTaskRow, index: number) => index + 1,
    },
    {
      title: '任务编号',
      key: 'taskNo',
      width: 180,
      render: (_: unknown, task: ReturnInboundTaskRow) => <span style={{ fontWeight: 600 }}>{displayReturnTaskNo(task)}</span>,
    },
    {
      title: '回仓原因',
      dataIndex: 'returnReason',
      key: 'returnReason',
      width: 180,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '集装号数',
      key: 'shippingUnitCount',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, task: ReturnInboundTaskRow) => task.shippingUnits.length,
    },
    {
      title: '运单数',
      key: 'waybillCount',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, task: ReturnInboundTaskRow) => task.items.length,
    },
    {
      title: '总件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 90,
      align: 'center' as const,
    },
    {
      title: '总重量Kg',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 110,
      align: 'right' as const,
      render: (value: number) => Number(value || 0).toFixed(2),
    },
    {
      title: '入库状态',
      key: 'status',
      width: 130,
      render: (_: unknown, task: ReturnInboundTaskRow) => (
        <Tag color={RETURN_STATUS_CONFIG[task.status].color}>{RETURN_STATUS_CONFIG[task.status].text}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, task: ReturnInboundTaskRow) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => handleOpenReturnDrawer(task, task.status === 'COMPLETED' ? 'detail' : 'inbound')}>
            {task.status === 'COMPLETED' ? '查看' : '入库'}
          </Button>
          <Button type="link" size="small" onClick={() => handleOpenReturnDrawer(task, 'detail')}>
            清单
          </Button>
        </Space>
      ),
    },
    {
      title: '更新日期',
      key: 'updatedAt',
      width: 170,
      render: (_: unknown, task: ReturnInboundTaskRow) => dayjs(task.updatedAt || task.createdAt).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div>
      {!initialScene && (
      <div style={{ marginBottom: 12 }}>
        <Segmented
          size="large"
          value={scene}
          onChange={(value) => handleSceneChange(String(value))}
          options={[
            { value: 'EXPRESS', label: `客户快递入库 ${records.length}` },
            { value: 'TRANSFER', label: `调拨到仓入库 ${filteredTransferRecords.length || transferRecords.length}` },
            { value: 'RETURN', label: `退回入库 ${filteredReturnTasks.length || returnInboundTasks.length}` },
          ]}
        />
      </div>
      )}

      {scene === 'EXPRESS' ? (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="客户快递入库按运单维度执行，当前页面不展示任务号和集装号。"
            description="同一运单可多次打开继续入库，待后续绑定集装号或任务后，再进入集中装箱/任务环节。"
          />

          <div className="compact-stats" style={{ marginBottom: 10 }}>
            <Tag color="blue">今日入库 {todayRecords.length}</Tag>
            <Tag color="green">今日件数 {todayPieces}</Tag>
            <Tag color="orange">今日重量 {todayWeight.toFixed(2)}kg</Tag>
            <Tag color={abnormalCount > 0 ? 'error' : 'default'}>异常待处理 {abnormalCount}</Tag>
            {unmatchedPendingCount > 0 ? <Tag color="gold">无订单快递待匹配 {unmatchedPendingCount}</Tag> : null}
          </div>

          <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
            <div className="list-page-toolbar">
              <div className="list-page-toolbar__filters">
                <div className="list-page-toolbar__field" style={{ flex: '1 1 280px', minWidth: 240 }}>
                  <Input
                    placeholder="搜索运单号/第三方运单号/客户/线路"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    onPressEnter={handleSearch}
                    allowClear
                  />
                </div>
                <div className="list-page-toolbar__field" style={{ minWidth: 130 }}>
                  <Select value={filterStatus} onChange={setFilterStatus} style={{ width: '100%' }}>
                    <Option value="ALL">全部状态</Option>
                    <Option value="PENDING">待处理</Option>
                    <Option value="PROCESSING">处理中</Option>
                    <Option value="COMPLETED">已入库</Option>
                    <Option value="ABNORMAL">异常</Option>
                  </Select>
                </div>
                <div className="list-page-toolbar__field" style={{ minWidth: 260 }}>
                  <RangePicker value={dateRange as any} onChange={setDateRange as any} format="YYYY-MM-DD" />
                </div>
                <div className="list-page-toolbar__field" style={{ minWidth: 140 }}>
                  <Select value={filterStation} onChange={setFilterStation} style={{ width: '100%' }} options={STATION_OPTIONS} />
                </div>
                <div className="list-page-toolbar__field" style={{ minWidth: 120 }}>
                  <Select
                    value={filterPaymentMethod}
                    onChange={setFilterPaymentMethod}
                    style={{ width: '100%' }}
                    options={[
                      { label: '支付方式', value: 'ALL' },
                      { label: '预付', value: 'PREPAID' },
                      { label: '到付', value: 'COD' },
                      { label: '信用卡', value: 'CREDIT_CARD' },
                    ]}
                  />
                </div>
                <div className="list-page-toolbar__field" style={{ minWidth: 120 }}>
                  <Select
                    value={filterPaymentStatus}
                    onChange={setFilterPaymentStatus}
                    style={{ width: '100%' }}
                    options={[
                      { label: '支付状态', value: 'ALL' },
                      { label: '已付', value: 'PAID' },
                      { label: '未付', value: 'UNPAID' },
                      { label: '部分付', value: 'PARTIAL' },
                    ]}
                  />
                </div>
                <div className="list-page-toolbar__field" style={{ minWidth: 120 }}>
                  <Select
                    value={filterSales}
                    onChange={setFilterSales}
                    style={{ width: '100%' }}
                    options={[
                      { label: '业务员', value: 'ALL' },
                      { label: 'Smile', value: 'Smile' },
                      { label: 'Andi', value: 'Andi' },
                      { label: 'Karena', value: 'Karena' },
                    ]}
                  />
                </div>
              </div>
              <div className="list-page-toolbar__actions">
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                  查询
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </div>
            </div>
          </Card>

          <div ref={tableContainerRef} style={{ minHeight: 0 }}>
            <Table
              rowKey="masterOrderNo"
              columns={masterOrderColumns}
              dataSource={masterOrderGroups}
              loading={loading}
              scroll={{ x: 1600, y: tableScrollY }}
              expandable={{
                expandedRowRender: (group) => renderExpandedWaybills(group),
                rowExpandable: (group) => group.waybills.length > 0,
                defaultExpandAllRows: false,
              }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条主单`,
              }}
              size="small"
            />
          </div>
        </>
      ) : scene === 'TRANSFER' ? (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="调拨到仓入库按调拨单维度执行，只展示已到仓待入库和已入库的调拨单。"
            description="调拨的创建、绑单和运输过程仍在“调拨记录”处理；当前页面只负责到仓后的接收与入库操作。"
          />

          <div className="compact-stats" style={{ marginBottom: 10 }}>
            <Tag color="blue">今日到仓 {transferTodayRecords.length}</Tag>
            <Tag color="green">运单数 {transferWaybillCount}</Tag>
            <Tag color="orange">总重量 {transferTotalWeight.toFixed(2)}kg</Tag>
            <Tag color={transferPendingInboundCount > 0 ? 'processing' : 'default'}>
              待入库调拨 {transferPendingInboundCount}
            </Tag>
            <Tag color={transferCompletedInboundCount > 0 ? 'success' : 'default'}>
              已入库调拨 {transferCompletedInboundCount}
            </Tag>
          </div>

          <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
            <Space wrap>
              <Input
                placeholder="搜索调拨单号/来源仓/目标仓/集装号/运单号"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 320 }}
                allowClear
              />
              <Select value={transferStatusFilter} onChange={setTransferStatusFilter} style={{ width: 130 }}>
                <Option value="ALL">全部状态</Option>
                <Option value="ARRIVED">待入库</Option>
                <Option value="RECEIVED">已入库</Option>
              </Select>
              <RangePicker value={dateRange as any} onChange={setDateRange as any} format="YYYY-MM-DD" />
              <Select value={filterStation} onChange={setFilterStation} style={{ width: 140 }} options={STATION_OPTIONS} />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                查询
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Card>

          <div ref={tableContainerRef} style={{ minHeight: 0 }}>
            <Table
              rowKey="id"
              columns={transferColumns}
              dataSource={filteredTransferRecords}
              loading={loading}
              scroll={{ x: 1580, y: tableScrollY }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              size="small"
            />
          </div>
        </>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="退回入库按任务维度执行，一个回仓任务可包含多个集装号，集装号下再挂多个运单。"
            description="当前页面只处理退回货物的回仓接收入库；退运申请和外部寄回过程仍在“退运处理”中维护。"
          />

          <div className="compact-stats" style={{ marginBottom: 10 }}>
            <Tag color="warning">待入库任务 {returnPendingTaskCount}</Tag>
            <Tag color="processing">部分入库任务 {returnPartialTaskCount}</Tag>
            <Tag color="success">已入库任务 {returnCompletedTaskCount}</Tag>
            <Tag>集装号 {returnShippingUnitCount}</Tag>
            <Tag color="blue">运单数 {returnWaybillCount}</Tag>
            <Tag color="orange">总重量 {returnTotalWeight.toFixed(2)}kg</Tag>
          </div>

          <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
            <Space wrap>
              <Input
                placeholder="搜索回仓任务号/原任务/集装号/运单号/回仓原因"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 340 }}
                allowClear
              />
              <Select value={returnStatusFilter} onChange={setReturnStatusFilter} style={{ width: 140 }}>
                <Option value="ALL">全部状态</Option>
                <Option value="PENDING">待入库</Option>
                <Option value="PARTIAL">部分入库</Option>
                <Option value="COMPLETED">已入库</Option>
              </Select>
              <RangePicker value={dateRange as any} onChange={setDateRange as any} format="YYYY-MM-DD" />
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                查询
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Card>

          <div ref={tableContainerRef} style={{ minHeight: 0 }}>
            <Table
              rowKey="id"
              columns={returnColumns}
              dataSource={filteredReturnTasks}
              loading={loading}
              scroll={{ x: 1700, y: tableScrollY }}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条记录`,
              }}
              size="small"
            />
          </div>
        </>
      )}

      <Drawer
        title="入库详情"
        placement="right"
        width={680}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setDetailRecord(null);
        }}
        footer={(
          <Space>
            <Button
              onClick={() => {
                setDetailVisible(false);
                setDetailRecord(null);
              }}
            >
              关闭
            </Button>
          </Space>
        )}
      >
        {detailRecord && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="入库单ID">{detailRecord.id}</Descriptions.Item>
            <Descriptions.Item label="入库时间">
              {dayjs(detailRecord.inboundTime || detailRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="主运单号">
              {detailRecord.masterWaybillNo || detailRecord.displayOrderNo || detailRecord.orderNo || detailRecord.masterOrderId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="子运单号">
              {detailRecord.subWaybillNo || detailRecord.displaySubOrderNo || detailRecord.subOrderNo || detailRecord.subOrderId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="第三方运单号">{detailRecord.trackingNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="快递公司">{detailRecord.expressCompany || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户">{detailRecord.clientName || '-'}（{detailRecord.clientCode || '-'}）</Descriptions.Item>
            <Descriptions.Item label="线路">{detailRecord.route || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务类型">{detailRecord.serviceType || '-'}</Descriptions.Item>
            <Descriptions.Item label="件数">{detailRecord.pieces || 0}</Descriptions.Item>
            <Descriptions.Item label="重量/体积">
              {Number(detailRecord.actualWeight || 0).toFixed(2)} kg / {Number(detailRecord.actualVolume || 0).toFixed(3)} m³
            </Descriptions.Item>
            <Descriptions.Item label="库位">{detailRecord.warehouseLocation || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getInboundStatusView(detailRecord).color}>{getInboundStatusView(detailRecord).text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="备注">{detailRecord.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Drawer
        title={transferDrawerMode === 'inbound' ? '调拨到仓入库' : '调拨清单'}
        placement="right"
        width="96vw"
        open={transferDrawerVisible}
        onClose={closeTransferDrawer}
        footer={transferDrawerMode === 'inbound' ? (
          <Space>
            <Button onClick={closeTransferDrawer}>取消</Button>
            <Button onClick={handleSaveTransferInbound}>保存本次</Button>
            <Button type="primary" onClick={handleConfirmTransferInbound}>最终确认</Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={closeTransferDrawer}>关闭</Button>
          </Space>
        )}
      >
        {selectedTransferRecord && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {transferDrawerMode === 'inbound' ? (
              <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                <Space wrap size={[8, 8]}>
                  <Tag color="blue">调拨单 {selectedTransferRecord.transferNo}</Tag>
                  <Tag>{selectedTransferRecord.sourceWarehouse} → {selectedTransferRecord.targetWarehouse}</Tag>
                  <Tag color="processing">集装信息 {selectedTransferRecord.shippingUnitNo || '-'}</Tag>
                  <Tag>运单数 {selectedTransferRecord.orderItems.length}</Tag>
                  <Tag>总件数 {selectedTransferRecord.totalPieces}</Tag>
                  <Tag color="orange">总重量 {Number(selectedTransferRecord.totalWeight || 0).toFixed(2)}kg</Tag>
                  <Tag color={TRANSFER_STATUS_CONFIG[selectedTransferRecord.status].color}>
                    {TRANSFER_STATUS_CONFIG[selectedTransferRecord.status].text}
                  </Tag>
                </Space>
              </Card>
            ) : (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="调拨单号">{selectedTransferRecord.transferNo}</Descriptions.Item>
                <Descriptions.Item label="执行日期">{selectedTransferRecord.meta.executeDate || '-'}</Descriptions.Item>
                <Descriptions.Item label="来源仓">{selectedTransferRecord.sourceWarehouse}</Descriptions.Item>
                <Descriptions.Item label="目标仓">{selectedTransferRecord.targetWarehouse}</Descriptions.Item>
                <Descriptions.Item label="调拨路线">{selectedTransferRecord.routeLabel}</Descriptions.Item>
                <Descriptions.Item label="集装信息">{selectedTransferRecord.shippingUnitNo || '-'}</Descriptions.Item>
                <Descriptions.Item label="物流公司">{selectedTransferRecord.meta.logisticsCompany || '-'}</Descriptions.Item>
                <Descriptions.Item label="查询电话">{selectedTransferRecord.meta.queryPhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机名称">{selectedTransferRecord.meta.driverName || '-'}</Descriptions.Item>
                <Descriptions.Item label="司机电话">{selectedTransferRecord.meta.driverPhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌">{selectedTransferRecord.meta.plateNo || '-'}</Descriptions.Item>
                <Descriptions.Item label="当前状态">
                  <Tag color={TRANSFER_STATUS_CONFIG[selectedTransferRecord.status].color}>
                    {TRANSFER_STATUS_CONFIG[selectedTransferRecord.status].text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="运单数">{selectedTransferRecord.orderItems.length}</Descriptions.Item>
                <Descriptions.Item label="总件数">{selectedTransferRecord.totalPieces}</Descriptions.Item>
                <Descriptions.Item label="总重量Kg">{Number(selectedTransferRecord.totalWeight || 0).toFixed(2)}</Descriptions.Item>
                <Descriptions.Item label="总材积CBM">{Number(selectedTransferRecord.totalVolume || 0).toFixed(3)}</Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>{selectedTransferRecord.meta.note || '-'}</Descriptions.Item>
              </Descriptions>
            )}

            {transferDrawerMode === 'inbound' && (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="调拨到仓入库为操作页面，支持扫码入库和手动录单入库。"
                  description="扫描集装号可整箱完成入库；扫描运单号则逐票登记。若现场先收到货、后补运单，可直接手动录单并登记入库。"
                />

                <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Space wrap>
                      <Space.Compact>
                        <Button
                          type={transferInboundMode === 'SCAN' ? 'primary' : 'default'}
                          icon={<ScanOutlined />}
                          onClick={() => setTransferInboundMode('SCAN')}
                        >
                          扫码入库
                        </Button>
                        <Button
                          type={transferInboundMode === 'MANUAL' ? 'primary' : 'default'}
                          onClick={() => setTransferInboundMode('MANUAL')}
                        >
                          手动录单入库
                        </Button>
                      </Space.Compact>
                      <Tag color="blue">当前调拨单 {selectedTransferRecord.transferNo}</Tag>
                      <Tag color="processing">
                        已入库运单 {selectedTransferRecord.orderItems.filter((item) => item.inboundStatus === 'RECEIVED').length}
                      </Tag>
                      <Tag>
                        待入库运单 {selectedTransferRecord.orderItems.filter((item) => item.inboundStatus !== 'RECEIVED').length}
                      </Tag>
                    </Space>

                    {transferInboundMode === 'SCAN' ? (
                      <Space wrap>
                        <Input
                          value={transferInboundKeyword}
                          onChange={(event) => setTransferInboundKeyword(event.target.value)}
                          placeholder="扫描集装号或运单号后回车"
                          prefix={<ScanOutlined />}
                          style={{ width: 360 }}
                          onPressEnter={() => handleTransferScanInbound()}
                        />
                        <Button type="primary" onClick={() => handleTransferScanInbound()}>
                          记录入库
                        </Button>
                        <Button onClick={() => setTransferInboundKeyword('')}>清空</Button>
                      </Space>
                    ) : (
                      <Form form={manualTransferForm} layout="vertical">
                        <Row gutter={12}>
                          <Col span={8}>
                            <Form.Item
                              name="subOrderNo"
                              label="运单号"
                              rules={[{ required: true, message: '请输入运单号' }]}
                            >
                              <Input placeholder="例如：S-202603260041-03" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="trackingNo" label="第三方运单号">
                              <Input placeholder="可选" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="clientName" label="客户">
                              <Input placeholder="可选" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item
                              name="pieces"
                              label="件数"
                              rules={[{ required: true, message: '请输入件数' }]}
                            >
                              <Input type="number" min={1} />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="weight" label="重量Kg">
                              <Input type="number" min={0} step="0.01" />
                            </Form.Item>
                          </Col>
                          <Col span={6}>
                            <Form.Item name="volume" label="体积CBM">
                              <Input type="number" min={0} step="0.001" />
                            </Form.Item>
                          </Col>
                          <Col span={6} style={{ display: 'flex', alignItems: 'end' }}>
                            <Button type="primary" style={{ width: '100%' }} onClick={() => void handleManualTransferInbound()}>
                              添加并入库
                            </Button>
                          </Col>
                        </Row>
                      </Form>
                    )}
                  </Space>
                </Card>

                <Space size={8} wrap>
                  <Tag color="warning">橙色行：未入库</Tag>
                  <Tag color="success">绿色行：已入库</Tag>
                  <Tag color="blue">蓝色行：本次扫码/手动刚处理</Tag>
                </Space>
              </>
            )}

            <Table
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 1400, y: 'calc(100vh - 420px)' }}
              dataSource={selectedTransferRecord.orderItems}
              rowClassName={(record: TransferInboundItem) =>
                record.id === highlightedTransferItemId ? 'transfer-inbound-highlight-row' : ''
              }
              onRow={(record: TransferInboundItem) => ({
                style:
                  record.id === highlightedTransferItemId
                    ? { background: '#e6f4ff' }
                    : record.inboundStatus === 'RECEIVED'
                      ? { background: '#f6ffed' }
                      : { background: '#fff7e6' },
              })}
              columns={[
                {
                  title: '任务号',
                  dataIndex: 'jobNo',
                  key: 'jobNo',
                  width: 150,
                  render: (value: string) => value || '-',
                },
                {
                  title: '运单号',
                  dataIndex: 'subOrderNo',
                  key: 'subOrderNo',
                  width: 180,
                },
                {
                  title: '第三方运单号',
                  dataIndex: 'trackingNo',
                  key: 'trackingNo',
                  width: 160,
                },
                {
                  title: '客户',
                  dataIndex: 'clientName',
                  key: 'clientName',
                  width: 160,
                },
                {
                  title: '线路',
                  dataIndex: 'route',
                  key: 'route',
                  width: 180,
                  render: (value: string) => value || selectedTransferRecord.routeLabel,
                },
                {
                  title: '件数',
                  dataIndex: 'pieces',
                  key: 'pieces',
                  width: 80,
                  align: 'center',
                },
                {
                  title: '重量Kg',
                  dataIndex: 'weight',
                  key: 'weight',
                  width: 100,
                  align: 'right',
                  render: (value: number) => Number(value || 0).toFixed(2),
                },
                {
                  title: '体积CBM',
                  dataIndex: 'volume',
                  key: 'volume',
                  width: 100,
                  align: 'right',
                  render: (value: number) => Number(value || 0).toFixed(3),
                },
                ...(transferDrawerMode === 'inbound'
                  ? [
                      {
                        title: '入库方式',
                        key: 'inboundMethod',
                        width: 110,
                        render: (_: unknown, item: TransferInboundItem) => item.inboundMethod === 'MANUAL' ? '手动录单' : item.inboundMethod === 'SCAN' ? '扫码' : '-',
                      },
                      {
                        title: '入库状态',
                        key: 'inboundStatus',
                        width: 170,
                        render: (_: unknown, item: TransferInboundItem) => (
                          <Space size={6}>
                            <Tag color={item.inboundStatus === 'RECEIVED' ? 'success' : 'warning'}>
                              {item.inboundStatus === 'RECEIVED' ? '已入库' : '未入库'}
                            </Tag>
                            <Select
                              size="small"
                              value={item.inboundStatus === 'RECEIVED' ? 'RECEIVED' : 'PENDING'}
                              status={item.inboundStatus === 'RECEIVED' ? undefined : 'warning'}
                              style={{ width: 92 }}
                              onChange={(value) => handleTransferInboundStatusChange(item.id, value as TransferInboundItemStatus)}
                              options={[
                                { label: '未入库', value: 'PENDING' },
                                { label: '已入库', value: 'RECEIVED' },
                              ]}
                            />
                          </Space>
                        ),
                      },
                      {
                        title: '入库时间',
                        key: 'inboundTime',
                        width: 170,
                        render: (_: unknown, item: TransferInboundItem) =>
                          item.inboundTime ? dayjs(item.inboundTime).format('YYYY-MM-DD HH:mm') : '-',
                      },
                    ]
                  : []),
              ]}
            />
          </Space>
        )}
      </Drawer>

      <Drawer
        title={returnDrawerMode === 'inbound' ? '退回入库' : '退回清单'}
        placement="right"
        width="96vw"
        open={returnDrawerVisible}
        onClose={closeReturnDrawer}
        footer={returnDrawerMode === 'inbound' ? (
          <Space>
            <Button onClick={closeReturnDrawer}>取消</Button>
            <Button onClick={handleSaveReturnInbound}>保存本次</Button>
            <Button type="primary" onClick={handleConfirmReturnInbound}>最终确认</Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={closeReturnDrawer}>关闭</Button>
          </Space>
        )}
      >
        {selectedReturnTask && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {returnDrawerMode === 'inbound' ? (
              <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                <Space wrap size={[8, 8]}>
                  <Tag color="blue">任务: {displayReturnTaskNo(selectedReturnTask)}</Tag>
                  <Tag>总件数 {returnInboundSummary.totalPieces}</Tag>
                  <Tag color="processing">总重量 {returnInboundSummary.totalWeight.toFixed(2)}kg</Tag>
                  <Tag color="success">已处理 {returnInboundSummary.handledCount}</Tag>
                  <Tag color="warning">剩余未处理 {returnInboundSummary.pendingCount}</Tag>
                  <Tag>{selectedReturnTask.sourceWarehouse} → {selectedReturnTask.targetWarehouse}</Tag>
                  <Tag color={RETURN_STATUS_CONFIG[selectedReturnTask.status].color}>
                    {RETURN_STATUS_CONFIG[selectedReturnTask.status].text}
                  </Tag>
                </Space>
              </Card>
            ) : (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="任务编号">{displayReturnTaskNo(selectedReturnTask)}</Descriptions.Item>
                <Descriptions.Item label="退回类型">{selectedReturnTask.returnType || '-'}</Descriptions.Item>
                <Descriptions.Item label="回仓原因">{selectedReturnTask.returnReason || '-'}</Descriptions.Item>
                <Descriptions.Item label="来源站点">{selectedReturnTask.sourceWarehouse}</Descriptions.Item>
                <Descriptions.Item label="当前仓">{selectedReturnTask.targetWarehouse}</Descriptions.Item>
                <Descriptions.Item label="集装号">{selectedReturnTask.shippingUnits.join('、') || '-'}</Descriptions.Item>
                <Descriptions.Item label="运单数">{selectedReturnTask.items.length}</Descriptions.Item>
                <Descriptions.Item label="总件数">{selectedReturnTask.totalPieces}</Descriptions.Item>
                <Descriptions.Item label="总重量Kg">{selectedReturnTask.totalWeight.toFixed(2)}</Descriptions.Item>
              </Descriptions>
            )}

            {returnDrawerMode === 'inbound' && (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="退回入库按任务批次执行。先扫描集装号定位本箱运单，再逐票核对入库状态；扫码命中后直接变更为已入库，也可以手动改状态。"
                  description="未处理完的任务可多次打开继续入库，全部核对完成后任务会自动变成已入库。"
                />

                <Card size="small" bordered={false} style={{ background: '#fafafa' }}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Space wrap>
                      <Checkbox checked={returnScanMode} onChange={(event) => setReturnScanMode(event.target.checked)}>
                        <ScanOutlined /> 扫码定位
                      </Checkbox>
                      <Tag color="blue">
                        当前结果 {selectedReturnWaybill || (selectedReturnShippingUnit === 'ALL' ? '全部集装号' : selectedReturnShippingUnit)}
                      </Tag>
                      <Tag>本批次待提交 {currentReturnBatchCount}</Tag>
                      <Tag color="warning">剩余未处理 {returnInboundSummary.pendingCount}</Tag>
                    </Space>

                    {returnScanMode && (
                      <Space wrap>
                        <Input
                          value={returnInboundKeyword}
                          onChange={(event) => setReturnInboundKeyword(event.target.value)}
                          placeholder="扫描/输入集装号或运单号"
                          prefix={<ScanOutlined />}
                          style={{ width: 320 }}
                          onPressEnter={() => handleReturnScanInbound()}
                        />
                        <Button type="primary" onClick={() => handleReturnScanInbound()}>
                          定位并入库
                        </Button>
                        <Button onClick={() => setReturnInboundKeyword('')}>清空</Button>
                      </Space>
                    )}

                    <Space wrap>
                      <span style={{ color: '#8c8c8c' }}>集装号筛选</span>
                      <Button
                        type={selectedReturnShippingUnit === 'ALL' && !selectedReturnWaybill ? 'primary' : 'default'}
                        onClick={() => {
                          setSelectedReturnShippingUnit('ALL');
                          setSelectedReturnWaybill(null);
                        }}
                      >
                        全部集装号
                      </Button>
                      {selectedReturnTask.shippingUnits.map((unit) => (
                        <Button
                          key={unit}
                          type={selectedReturnShippingUnit === unit && !selectedReturnWaybill ? 'primary' : 'default'}
                          onClick={() => {
                            setSelectedReturnShippingUnit(unit);
                            setSelectedReturnWaybill(null);
                          }}
                        >
                          {unit}
                        </Button>
                      ))}
                    </Space>
                  </Space>
                </Card>

                <Space size={8} wrap>
                  <Tag color="warning">橙色行：未入库</Tag>
                  <Tag color="success">绿色行：已入库</Tag>
                  <Tag color="blue">蓝色行：本次扫码/手动刚处理</Tag>
                </Space>
              </>
            )}

            <Table
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ x: 1230, y: 'calc(100vh - 430px)' }}
              dataSource={currentReturnItems}
              onRow={(record: ReturnInboundItem) => ({
                style:
                  record.id === highlightedReturnItemId
                    ? { background: '#e6f4ff' }
                    : record.inboundStatus === 'RECEIVED'
                      ? { background: '#f6ffed' }
                      : { background: '#fff7e6' },
              })}
              columns={[
                {
                  title: '集装号',
                  dataIndex: 'shippingUnitNo',
                  key: 'shippingUnitNo',
                  width: 120,
                  onCell: (item: ReturnInboundItem) => ({
                    rowSpan: returnShippingUnitRowSpans[item.id] ?? 1,
                  }),
                  render: (value: string) => <span style={{ fontWeight: 600 }}>{value}</span>,
                },
                { title: '运单号', dataIndex: 'subOrderNo', key: 'subOrderNo', width: 190 },
                { title: '第三方运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 170 },
                { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 150 },
                {
                  title: '说明',
                  dataIndex: 'goodsDescription',
                  key: 'goodsDescription',
                  width: 180,
                  render: (value: string) => value || '-',
                },
                { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' },
                {
                  title: '重量Kg',
                  dataIndex: 'weight',
                  key: 'weight',
                  width: 100,
                  align: 'right',
                  render: (value: number) => Number(value || 0).toFixed(2),
                },
                ...(returnDrawerMode === 'inbound'
                  ? [
                      {
                        title: '处理状态',
                        key: 'inboundStatus',
                        width: 180,
                        render: (_: unknown, item: ReturnInboundItem) => (
                          <Space direction="vertical" size={4}>
                            <Space size={6}>
                              <Tag color={item.inboundStatus === 'RECEIVED' ? 'success' : 'warning'}>
                                {item.inboundStatus === 'RECEIVED' ? '已入库' : '待入库'}
                              </Tag>
                              <Select
                                size="small"
                                value={item.inboundStatus === 'RECEIVED' ? 'RECEIVED' : 'PENDING'}
                                status={item.inboundStatus === 'RECEIVED' ? undefined : 'warning'}
                                style={{ width: 92 }}
                                onChange={(value) => handleReturnInboundStatusChange(item.id, value as TransferInboundItemStatus)}
                                options={[
                                  { label: '待入库', value: 'PENDING' },
                                  { label: '已入库', value: 'RECEIVED' },
                                ]}
                              />
                            </Space>
                            {item.inboundTime ? (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {dayjs(item.inboundTime).format('YYYY-MM-DD HH:mm')}
                              </Text>
                            ) : null}
                          </Space>
                        ),
                      },
                      {
                        title: '入库方式',
                        key: 'inboundMethod',
                        width: 100,
                        render: (_: unknown, item: ReturnInboundItem) =>
                          item.inboundMethod === 'MANUAL' ? '手动录单' : item.inboundMethod === 'SCAN' ? '扫码' : '-',
                      },
                    ]
                  : []),
              ]}
            />
          </Space>
        )}
      </Drawer>

      <Modal
        title="手动新增客户快递入库"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={handleCreateInbound}
        okText="提交"
        cancelText="取消"
        width={760}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="masterOrderId" label="主运单号" rules={[{ required: true, message: '请输入主运单号' }]}>
                <Input placeholder="例如：MO-XXXX 或订单ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subOrderId" label="子运单号" rules={[{ required: true, message: '请输入子运单号' }]}>
                <Input placeholder="例如：SO-XXXX 或子单ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trackingNo" label="第三方运单号" rules={[{ required: true, message: '请输入第三方运单号' }]}>
                <Input placeholder="例如：SF123456789CN" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expressCompany" label="快递公司" rules={[{ required: true, message: '请输入快递公司' }]}>
                <Input placeholder="例如：顺丰速运" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="clientCode" label="客户编码" rules={[{ required: true, message: '请输入客户编码' }]}>
                <Input placeholder="客户编码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="clientName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input placeholder="客户名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pieces" label="件数" rules={[{ required: true, message: '请输入件数' }]}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actualWeight" label="重量(kg)">
                <Input type="number" min={0} step="0.01" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actualVolume" label="体积(m³)">
                <Input type="number" min={0} step="0.001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warehouseLocation" label="库位">
                <Input placeholder="例如：A-01-03" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remark" label="备注">
                <Input placeholder="可选备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="取消入库"
        open={cancelModalVisible}
        onCancel={() => { setCancelModalVisible(false); setCancelRecord(null); }}
        onOk={handleCancelSubmit}
        okText={cancelGoodsReceived === 'YES' ? '确认取消并创建退运单' : '确认取消'}
        cancelText="返回"
        okButtonProps={{ danger: true }}
        width={560}
      >
        {/* 运单信息 */}
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
          <Text>第三方运单：<Text strong>{cancelRecord?.expressCompany} {cancelRecord?.trackingNo}</Text></Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            主运单号：{cancelRecord?.masterWaybillNo || cancelRecord?.displayOrderNo || cancelRecord?.orderNo || cancelRecord?.masterOrderId || '-'}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            子运单号：{cancelRecord?.subWaybillNo || cancelRecord?.displaySubOrderNo || cancelRecord?.subOrderNo || cancelRecord?.subOrderId || '-'}
          </Text>
        </div>

        {/* Step 1: 是否已收到货物 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>是否已收到货物 <span style={{ color: '#ff4d4f' }}>*</span></div>
          <Space size="middle">
            <Button
              type={cancelGoodsReceived === 'NO' ? 'primary' : 'default'}
              onClick={() => { setCancelGoodsReceived('NO'); setCancelReason(''); }}
              style={{ width: 120 }}
            >
              未收到货
            </Button>
            <Button
              type={cancelGoodsReceived === 'YES' ? 'primary' : 'default'}
              danger={cancelGoodsReceived === 'YES'}
              onClick={() => { setCancelGoodsReceived('YES'); setCancelReason(''); }}
              style={{ width: 120 }}
            >
              已收到货
            </Button>
          </Space>
        </div>

        {/* Step 2: 取消原因（根据是否收到货显示不同选项） */}
        {cancelGoodsReceived && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>取消原因 <span style={{ color: '#ff4d4f' }}>*</span></div>
            <Select
              style={{ width: '100%' }}
              value={cancelReason || undefined}
              onChange={setCancelReason}
              placeholder="请选择取消原因"
              options={(cancelGoodsReceived === 'YES' ? CANCEL_REASONS_RECEIVED : CANCEL_REASONS_NOT_RECEIVED).map(r => ({ label: r, value: r }))}
            />
          </div>
        )}

        {/* 其他原因补充 */}
        {cancelReason === '其他' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>补充说明</div>
            <Input.TextArea
              rows={2}
              value={cancelRemarkText}
              onChange={e => setCancelRemarkText(e.target.value)}
              placeholder="请输入具体取消原因"
            />
          </div>
        )}

        {/* 已收到货提示 */}
        {cancelGoodsReceived === 'YES' && cancelReason && (
          <div style={{ padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4 }}>
            <Text style={{ color: '#d46b08' }}>
              确认后将自动创建退运单，您可以稍后在「退运处理」中补充退运快递信息和地址。
            </Text>
          </div>
        )}
      </Modal>

      {/* 打印面单 Modal */}
      <Modal
        title="打印面单（Demo 预览）"
        open={printLabelOpen}
        onCancel={() => { setPrintLabelOpen(false); setPrintLabelRecord(null); }}
        width={420}
        footer={[
          <Button key="close" onClick={() => { setPrintLabelOpen(false); setPrintLabelRecord(null); }}>关闭</Button>,
          <Button key="print" type="primary" onClick={() => { window.print(); }}>🖨 打印</Button>,
        ]}
      >
        {printLabelRecord && (
          <div style={{
            border: '1px dashed #d9d9d9',
            borderRadius: 6,
            padding: 20,
            background: '#fafafa',
            fontFamily: 'monospace',
          }}>
            <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, borderBottom: '1px solid #999', paddingBottom: 8, marginBottom: 12 }}>
              喵喵国际物流 · 面单
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>子运单号</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
                {printLabelRecord.subWaybillNo || printLabelRecord.displaySubOrderNo || printLabelRecord.subOrderNo || '-'}
              </div>
            </div>
            <div style={{
              height: 40,
              background: 'repeating-linear-gradient(90deg, #000 0 2px, #fff 2px 5px)',
              marginBottom: 12,
              borderRadius: 2,
            }} />
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px 12px', fontSize: 13 }}>
              <div style={{ color: '#8c8c8c' }}>客户:</div>
              <div style={{ fontWeight: 600 }}>{printLabelRecord.clientName || '-'}</div>
              <div style={{ color: '#8c8c8c' }}>线路:</div>
              <div>{printLabelRecord.route || '-'}</div>
              <div style={{ color: '#8c8c8c' }}>服务:</div>
              <div>{printLabelRecord.serviceType || '-'}</div>
              <div style={{ color: '#8c8c8c' }}>品名:</div>
              <div>{printLabelRecord.goodsDescription || '-'}</div>
              <div style={{ color: '#8c8c8c' }}>件数/重量:</div>
              <div>{printLabelRecord.pieces || 0} 件 / {Number(printLabelRecord.actualWeight || 0).toFixed(2)} kg</div>
              <div style={{ color: '#8c8c8c' }}>三方运单:</div>
              <div style={{ fontSize: 11 }}>{printLabelRecord.trackingNo || '-'}</div>
              <div style={{ color: '#8c8c8c' }}>入库时间:</div>
              <div style={{ fontSize: 11 }}>{printLabelRecord.inboundTime ? dayjs(printLabelRecord.inboundTime).format('YYYY-MM-DD HH:mm') : '-'}</div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px dashed #d9d9d9', textAlign: 'center', fontSize: 10, color: '#bfbfbf' }}>
              * 此面单为 Demo 预览，最终样式待客户确认
            </div>
          </div>
        )}
      </Modal>

      {/* 添加三方快递 Modal */}
      <Modal
        title={`添加三方快递 - ${addWaybillMasterNo}`}
        open={addWaybillOpen}
        onCancel={() => { setAddWaybillOpen(false); setAddWaybillMasterNo(''); addWaybillForm.resetFields(); }}
        onOk={handleSubmitAddWaybill}
        okText="添加"
        cancelText="取消"
        width={460}
      >
        <Form form={addWaybillForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="trackingNo"
            label="三方运单号"
            rules={[{ required: true, message: '请输入三方运单号' }]}
          >
            <Input placeholder="例如：SF1234567890" />
          </Form.Item>
          <Form.Item
            name="expressCompany"
            label="快递公司"
            rules={[{ required: true, message: '请选择快递公司' }]}
          >
            <Select placeholder="选择快递公司">
              <Option value="顺丰速运">顺丰速运</Option>
              <Option value="圆通速递">圆通速递</Option>
              <Option value="中通快递">中通快递</Option>
              <Option value="韵达快递">韵达快递</Option>
              <Option value="申通快递">申通快递</Option>
              <Option value="京东物流">京东物流</Option>
              <Option value="德邦物流">德邦物流</Option>
            </Select>
          </Form.Item>
          <Form.Item name="goodsDescription" label="品名">
            <Input placeholder="选填" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            message="Demo 原型提示：添加后仅弹出成功提示，不会真正写入 Mock 数据"
          />
        </Form>
      </Modal>

      <InboundDetailDrawer
        visible={supplementDrawerVisible}
        mode={selectedRecord?.status === 'COMPLETED' ? 'edit' : 'inbound'}
        orderId={selectedRecord?.id || ''}
        orderNo={selectedRecord?.displaySubOrderNo || selectedRecord?.subOrderNo || selectedRecord?.orderNo}
        routeCode={(selectedRecord as any)?.routeCode || 'CAN.CHN-LOS.NGN'}
        serviceType={selectedRecord?.serviceType === 'EXPRESS' ? 'EXPRESS' : 'STANDARD'}
        salesPerson={selectedRecord?.salesPerson}
        customerName={selectedRecord?.clientName}
        orderDate={selectedRecord?.orderDate}
        trackingNo={selectedRecord?.trackingNo}
        expressCompany={(selectedRecord as any)?.expressCompany}
        signStatus={selectedRecord?.thirdPartyStatus || selectedRecord?.logisticsStatus}
        signTime={selectedRecord?.thirdPartyStatusTime || selectedRecord?.logisticsStatusTime}
        category={(selectedRecord as any)?.category}
        goodsName={(selectedRecord as any)?.goodsName}
        remark={selectedRecord?.remark}
        onSubmit={() => {
          setSupplementDrawerVisible(false);
          setSelectedRecord(null);
          fetchData(true);
        }}
        onClose={() => {
          setSupplementDrawerVisible(false);
          setSelectedRecord(null);
        }}
      />
    </div>
  );
};
