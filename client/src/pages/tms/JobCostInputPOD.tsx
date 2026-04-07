import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import {
  CheckOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../components/ListPageToolbar';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

type BusinessMode = 'ALL' | 'AIR' | 'SEA';
type TaskStatus = 'DRAFT' | 'PENDING_SUPERVISOR' | 'PART_REJECTED' | 'REJECTED' | 'APPROVED';
type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
type RelationLevel = 'JOB' | 'UNIT' | 'ORDER' | 'SUB_ORDER';
type ItemReviewStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
type ItemKind = 'NORMAL' | 'CHANGE';

interface MockJobTask {
  jobNo: string;
  station: string;
  route: string;
  serviceType: string;
  carrier: string;
  blNo: string;
  originPort: string;
  destinationPort: string;
  pieces: number;
  blWeight: number;
  orderWeight: number;
  arrivePortAt: string;
  customsReleaseAt: string;
  warehouseInboundAt: string;
  units: string[];
  orderNos: string[];
  subOrderNos: string[];
}

interface CostItemSnapshot {
  relationLevel: RelationLevel;
  relationTargetNo: string;
  supplierName: string;
  feeType: string;
  unitPrice: number;
  quantity: number;
  currency: string;
  exchangeRate: number;
  amount: number;
  remark: string;
}

interface CostItem extends CostItemSnapshot {
  id: string;
  kind: ItemKind;
  originalItemId?: string;
  originalSnapshot?: CostItemSnapshot;
  paymentStatus: PaymentStatus;
  reviewStatus: ItemReviewStatus;
  reviewComment?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskCostRecord {
  jobNo: string;
  station: string;
  route: string;
  serviceType: string;
  carrier: string;
  blNo: string;
  originPort: string;
  destinationPort: string;
  pieces: number;
  blWeight: number;
  orderWeight: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supervisor?: string;
  reviewedAt?: string;
  supervisorRemark?: string;
  items: CostItem[];
}

interface ReviewDraftRow {
  id: string;
  decision: 'APPROVED' | 'REJECTED';
  comment: string;
}

const STORAGE_KEY = 'job-cost-pod-task-demo-v20260323';

const TASK_STATUS_CONFIG: Record<TaskStatus, { text: string; color: string }> = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING_SUPERVISOR: { text: '待主管审核', color: 'orange' },
  PART_REJECTED: { text: '部分驳回', color: 'gold' },
  REJECTED: { text: '已驳回', color: 'red' },
  APPROVED: { text: '已审核', color: 'green' },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { text: string; color: string }> = {
  UNPAID: { text: '未付', color: 'default' },
  PARTIAL: { text: '部分支付', color: 'processing' },
  PAID: { text: '已付', color: 'green' },
};

const ITEM_STATUS_CONFIG: Record<ItemReviewStatus, { text: string; color: string }> = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING: { text: '待审核', color: 'orange' },
  APPROVED: { text: '已审核', color: 'green' },
  REJECTED: { text: '已驳回', color: 'red' },
};

const RELATION_LEVEL_OPTIONS: Array<{ value: RelationLevel; label: string }> = [
  { value: 'JOB', label: 'JOB公摊' },
  { value: 'UNIT', label: '柜号/板号公摊' },
  { value: 'ORDER', label: '订单号' },
  { value: 'SUB_ORDER', label: '子单号' },
];

const FEE_TYPE_OPTIONS = [
  { value: 'CLEARANCE', label: '清关费' },
  { value: 'DUTY', label: '关税' },
  { value: 'PORT_CHARGE', label: '港杂费' },
  { value: 'UNSTUFFING', label: '拆柜费' },
  { value: 'WAREHOUSE', label: '仓租费' },
  { value: 'TRUCKING', label: '拖车费' },
  { value: 'DELIVERY', label: '末端配送费' },
  { value: 'INSPECTION', label: '查验费' },
  { value: 'OTHER', label: '其他' },
];

const CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'NGN' },
  { value: 'USD', label: 'USD' },
  { value: 'CNY', label: 'CNY' },
];

const SUPPLIER_OPTIONS = [
  'Lagos Port Service Ltd.',
  'Nigeria Customs Service',
  'MiaoMiao Nigeria Warehouse',
  'Lagos Inland Trucking Ltd.',
  'Abuja Clearance Agency',
  'MiaoMiao Nigeria Delivery Team',
];

const MOCK_JOB_TASKS: MockJobTask[] = [
  {
    jobNo: 'S-JOB26030001',
    station: '拉各斯清关组',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '海运拼箱',
    carrier: 'COSCO',
    blNo: 'COSCO-LOS-260301',
    originPort: 'CAN',
    destinationPort: 'LOS',
    pieces: 50,
    blWeight: 2500,
    orderWeight: 2480,
    arrivePortAt: '2026-03-23 08:00',
    customsReleaseAt: '2026-03-25 15:20',
    warehouseInboundAt: '2026-03-26 10:30',
    units: ['LOS-C1', 'LOS-C2', 'LOS-C3'],
    orderNos: ['S-20260320000001', 'S-20260320000002'],
    subOrderNos: ['S-20260320000001-1', 'S-20260320000002-1'],
  },
  {
    jobNo: 'S-JOB26030004',
    station: '阿布贾监管组',
    route: 'NGB.CHN→ABV.NGN',
    serviceType: '海运整柜',
    carrier: 'MSK',
    blNo: 'MSK-ABV-260304',
    originPort: 'NGB',
    destinationPort: 'ABV',
    pieces: 68,
    blWeight: 3600,
    orderWeight: 3525,
    arrivePortAt: '2026-03-24 09:00',
    customsReleaseAt: '2026-03-26 17:10',
    warehouseInboundAt: '2026-03-27 14:20',
    units: ['ABV-C1', 'ABV-C2', 'ABV-C3', 'ABV-C4'],
    orderNos: ['S-20260320000003', 'S-20260320000004'],
    subOrderNos: ['S-20260320000003-1', 'S-20260320000004-1'],
  },
  {
    jobNo: 'S-JOB26030007',
    station: '卡诺仓储组',
    route: 'SZX.CHN→KAN.NGN',
    serviceType: '海运快线',
    carrier: 'CMA',
    blNo: 'CMA-KAN-260307',
    originPort: 'SZX',
    destinationPort: 'KAN',
    pieces: 16,
    blWeight: 1460,
    orderWeight: 1405,
    arrivePortAt: '2026-03-24 11:10',
    customsReleaseAt: '2026-03-27 13:40',
    warehouseInboundAt: '2026-03-28 09:20',
    units: ['KAN-C1', 'KAN-C2'],
    orderNos: ['S-20260320000005', 'S-20260320000006'],
    subOrderNos: ['S-20260320000005-1', 'S-20260320000006-1'],
  },
  {
    jobNo: 'S-JOB26030010',
    station: '奥尼查派送组',
    route: 'HKG.CHN→ONI.NGN',
    serviceType: '海运拼箱',
    carrier: 'EMC',
    blNo: 'EMC-ONI-260310',
    originPort: 'HKG',
    destinationPort: 'ONI',
    pieces: 65,
    blWeight: 3500,
    orderWeight: 3460,
    arrivePortAt: '2026-03-25 12:30',
    customsReleaseAt: '2026-03-28 16:30',
    warehouseInboundAt: '2026-03-29 11:10',
    units: ['ONI-C1', 'ONI-C2', 'ONI-C3'],
    orderNos: ['S-20260320000007', 'S-20260320000008'],
    subOrderNos: ['S-20260320000007-1', 'S-20260320000008-1'],
  },
  {
    jobNo: 'A-JOB26030001',
    station: '拉各斯空港组',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '空运普快',
    carrier: 'ET',
    blNo: 'ET-LOS-260301',
    originPort: 'CAN',
    destinationPort: 'LOS',
    pieces: 12,
    blWeight: 180,
    orderWeight: 172,
    arrivePortAt: '2026-03-22 06:10',
    customsReleaseAt: '2026-03-22 18:20',
    warehouseInboundAt: '2026-03-23 09:30',
    units: ['LOS-A1', 'LOS-A2'],
    orderNos: ['A-20260320000001', 'A-20260320000002'],
    subOrderNos: ['A-20260320000001-1', 'A-20260320000002-1'],
  },
  {
    jobNo: 'A-JOB26030004',
    station: '阿布贾空港组',
    route: 'SZX.CHN→ABV.NGN',
    serviceType: '空运特快',
    carrier: 'EK',
    blNo: 'EK-ABV-260304',
    originPort: 'SZX',
    destinationPort: 'ABV',
    pieces: 7,
    blWeight: 96,
    orderWeight: 92,
    arrivePortAt: '2026-03-22 08:50',
    customsReleaseAt: '2026-03-23 14:20',
    warehouseInboundAt: '2026-03-23 19:10',
    units: ['ABV-A1'],
    orderNos: ['A-20260320000003'],
    subOrderNos: ['A-20260320000003-1'],
  },
  {
    jobNo: 'A-JOB26030007',
    station: '卡诺配送组',
    route: 'HKG.CHN→KAN.NGN',
    serviceType: '空运特快',
    carrier: 'CX',
    blNo: 'CX-KAN-260307',
    originPort: 'HKG',
    destinationPort: 'KAN',
    pieces: 15,
    blWeight: 245,
    orderWeight: 238,
    arrivePortAt: '2026-03-23 07:40',
    customsReleaseAt: '2026-03-23 21:00',
    warehouseInboundAt: '2026-03-24 10:15',
    units: ['KAN-A1', 'KAN-A2'],
    orderNos: ['A-20260320000004', 'A-20260320000005'],
    subOrderNos: ['A-20260320000004-1', 'A-20260320000005-1'],
  },
  {
    jobNo: 'A-JOB26030010',
    station: '奥尼查配送组',
    route: 'CAN.CHN→ONI.NGN',
    serviceType: '空运普快',
    carrier: 'ET',
    blNo: 'ET-ONI-260310',
    originPort: 'CAN',
    destinationPort: 'ONI',
    pieces: 5,
    blWeight: 58,
    orderWeight: 54,
    arrivePortAt: '2026-03-24 05:50',
    customsReleaseAt: '2026-03-24 18:00',
    warehouseInboundAt: '2026-03-25 08:40',
    units: ['ONI-A1'],
    orderNos: ['A-20260320000006'],
    subOrderNos: ['A-20260320000006-1'],
  },
];

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed?.username || parsed?.id || '当前用户';
  } catch {
    return '当前用户';
  }
};

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const calcAmount = (unitPrice: number, quantity: number) => Number((unitPrice * quantity).toFixed(2));

const formatDateTime = (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-');

const matchJobNoByBusinessMode = (jobNo: string, businessMode: BusinessMode) => {
  if (!jobNo) return false;
  if (businessMode === 'AIR') return jobNo.startsWith('A-');
  if (businessMode === 'SEA') return jobNo.startsWith('S-');
  return true;
};

const getTaskByJobNo = (jobNo: string) => MOCK_JOB_TASKS.find((item) => item.jobNo === jobNo);

const getRelationTargetOptions = (task?: MockJobTask, level?: RelationLevel) => {
  if (!task || !level) return [];
  if (level === 'JOB') return [task.jobNo];
  if (level === 'UNIT') return task.units;
  if (level === 'ORDER') return task.orderNos;
  return task.subOrderNos;
};

const createSnapshot = (item: CostItem): CostItemSnapshot => ({
  relationLevel: item.relationLevel,
  relationTargetNo: item.relationTargetNo,
  supplierName: item.supplierName,
  feeType: item.feeType,
  unitPrice: item.unitPrice,
  quantity: item.quantity,
  currency: item.currency,
  amount: item.amount,
  remark: item.remark,
});

const cloneItems = (items: CostItem[]) =>
  items.map((item) => ({
    ...item,
    originalSnapshot: item.originalSnapshot ? { ...item.originalSnapshot } : undefined,
  }));

const hasLinkedChange = (items: CostItem[], itemId: string) =>
  items.some((item) => item.originalItemId === itemId && item.reviewStatus !== 'REJECTED');

const isHistoricalRow = (items: CostItem[], row: CostItem) =>
  row.kind === 'NORMAL' && hasLinkedChange(items, row.id);

const isEditableRow = (items: CostItem[], row: CostItem) => {
  if (row.reviewStatus === 'PENDING') return false;
  if (row.reviewStatus === 'APPROVED') return false;
  if (isHistoricalRow(items, row)) return false;
  return true;
};

const shouldCountItem = (items: CostItem[], row: CostItem) => {
  if (row.reviewStatus === 'REJECTED') return false;
  if (isHistoricalRow(items, row)) return false;
  return true;
};

const deriveTaskStatus = (items: CostItem[]): TaskStatus => {
  if (items.some((item) => item.reviewStatus === 'PENDING')) return 'PENDING_SUPERVISOR';
  if (items.some((item) => item.reviewStatus === 'DRAFT')) return 'DRAFT';
  const rejectedCount = items.filter((item) => item.reviewStatus === 'REJECTED').length;
  const approvedCount = items.filter((item) => item.reviewStatus === 'APPROVED').length;
  if (rejectedCount > 0 && approvedCount > 0) return 'PART_REJECTED';
  if (rejectedCount > 0) return 'REJECTED';
  return 'APPROVED';
};

const getSummaryAmount = (items: CostItem[]) =>
  items.filter((item) => shouldCountItem(items, item)).reduce((sum, item) => sum + item.amount, 0);

const getSummaryPaymentStatus = (items: CostItem[]): PaymentStatus => {
  const activeItems = items.filter((item) => shouldCountItem(items, item));
  if (!activeItems.length) return 'UNPAID';
  const paidCount = activeItems.filter((item) => item.paymentStatus === 'PAID').length;
  const partialCount = activeItems.filter((item) => item.paymentStatus === 'PARTIAL').length;
  if (paidCount === activeItems.length) return 'PAID';
  if (paidCount > 0 || partialCount > 0) return 'PARTIAL';
  return 'UNPAID';
};

const getRowTypeText = (items: CostItem[], row: CostItem) => {
  if (row.kind === 'CHANGE') {
    if (row.reviewStatus === 'PENDING') return '修改待审';
    if (row.reviewStatus === 'REJECTED') return '修改驳回';
    if (row.reviewStatus === 'DRAFT') return '修改草稿';
    return '变更后条目';
  }
  if (isHistoricalRow(items, row)) return '原始版本';
  if (row.reviewStatus === 'APPROVED') return '已审核条目';
  if (row.reviewStatus === 'PENDING') return '新增待审';
  if (row.reviewStatus === 'REJECTED') return '新增驳回';
  return '新增草稿';
};

const createSeedRecords = (): TaskCostRecord[] => [
  {
    jobNo: 'S-JOB26030001',
    station: '拉各斯清关组',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '海运拼箱',
    carrier: 'COSCO',
    blNo: 'COSCO-LOS-260301',
    originPort: 'CAN',
    destinationPort: 'LOS',
    pieces: 50,
    blWeight: 2500,
    orderWeight: 2480,
    createdBy: 'RITA',
    createdAt: '2026-03-24 09:20',
    updatedAt: '2026-03-25 16:10',
    supervisor: '主管-王安',
    reviewedAt: '2026-03-25 16:10',
    supervisorRemark: '清关费和港杂费已审核，可继续补录后段费用。',
    items: [
      {
        id: 'pod-seed-1',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030001',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'PORT_CHARGE',
        unitPrice: 180000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 180000,
        paymentStatus: 'PAID',
        reviewStatus: 'APPROVED',
        remark: '港口卸船与文件处理',
        createdAt: '2026-03-24 09:20',
        updatedAt: '2026-03-25 16:10',
      },
      {
        id: 'pod-seed-2',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030001',
        supplierName: SUPPLIER_OPTIONS[1],
        feeType: 'CLEARANCE',
        unitPrice: 260000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 260000,
        paymentStatus: 'PARTIAL',
        reviewStatus: 'APPROVED',
        remark: '整票清关处理',
        createdAt: '2026-03-24 09:20',
        updatedAt: '2026-03-25 16:10',
      },
      {
        id: 'pod-seed-2b',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030001',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'DELIVERY',
        unitPrice: 320,
        quantity: 1,
        currency: 'USD',
        exchangeRate: 7.25,
        amount: 320,
        paymentStatus: 'UNPAID',
        reviewStatus: 'APPROVED',
        remark: '目的港派送至客户仓库',
        createdAt: '2026-03-24 09:20',
        updatedAt: '2026-03-25 16:10',
      },
    ],
  },
  {
    jobNo: 'S-JOB26030004',
    station: '阿布贾监管组',
    route: 'NGB.CHN→ABV.NGN',
    serviceType: '海运整柜',
    carrier: 'MSK',
    blNo: 'MSK-ABV-260304',
    originPort: 'NGB',
    destinationPort: 'ABV',
    pieces: 68,
    blWeight: 3600,
    orderWeight: 3525,
    createdBy: 'MAY',
    createdAt: '2026-03-25 08:50',
    updatedAt: '2026-03-25 17:40',
    items: [
      {
        id: 'pod-seed-3',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030004',
        supplierName: SUPPLIER_OPTIONS[1],
        feeType: 'DUTY',
        unitPrice: 420000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 420000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '进口关税',
        createdAt: '2026-03-25 08:50',
        updatedAt: '2026-03-25 17:40',
      },
      {
        id: 'pod-seed-4',
        kind: 'NORMAL',
        relationLevel: 'UNIT',
        relationTargetNo: 'ABV-C2',
        supplierName: SUPPLIER_OPTIONS[3],
        feeType: 'TRUCKING',
        unitPrice: 90000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 90000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '码头拖车到监管仓',
        createdAt: '2026-03-25 08:50',
        updatedAt: '2026-03-25 17:40',
      },
    ],
  },
  {
    jobNo: 'S-JOB26030007',
    station: '卡诺仓储组',
    route: 'SZX.CHN→KAN.NGN',
    serviceType: '海运快线',
    carrier: 'CMA',
    blNo: 'CMA-KAN-260307',
    originPort: 'SZX',
    destinationPort: 'KAN',
    pieces: 16,
    blWeight: 1460,
    orderWeight: 1405,
    createdBy: 'LUNA',
    createdAt: '2026-03-25 10:15',
    updatedAt: '2026-03-26 09:40',
    supervisor: '主管-王安',
    reviewedAt: '2026-03-26 09:40',
    supervisorRemark: '拆柜费通过，查验费补充票据后重提。',
    items: [
      {
        id: 'pod-seed-5',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030007',
        supplierName: SUPPLIER_OPTIONS[2],
        feeType: 'UNSTUFFING',
        unitPrice: 75000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 75000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'APPROVED',
        remark: '拆柜与分拨',
        createdAt: '2026-03-25 10:15',
        updatedAt: '2026-03-26 09:40',
      },
      {
        id: 'pod-seed-6',
        kind: 'NORMAL',
        relationLevel: 'ORDER',
        relationTargetNo: 'S-20260320000005',
        supplierName: SUPPLIER_OPTIONS[4],
        feeType: 'INSPECTION',
        unitPrice: 32000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 32000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'REJECTED',
        reviewComment: '请补充查验单据',
        remark: '海关开箱查验',
        createdAt: '2026-03-25 10:15',
        updatedAt: '2026-03-26 09:40',
      },
    ],
  },
  {
    jobNo: 'S-JOB26030010',
    station: '奥尼查派送组',
    route: 'HKG.CHN→ONI.NGN',
    serviceType: '海运拼箱',
    carrier: 'EMC',
    blNo: 'EMC-ONI-260310',
    originPort: 'HKG',
    destinationPort: 'ONI',
    pieces: 65,
    blWeight: 3500,
    orderWeight: 3460,
    createdBy: 'NINA',
    createdAt: '2026-03-26 08:10',
    updatedAt: '2026-03-26 11:30',
    items: [
      {
        id: 'pod-seed-7',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030010',
        supplierName: SUPPLIER_OPTIONS[2],
        feeType: 'WAREHOUSE',
        unitPrice: 45000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 45000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '到港后短驳暂存',
        createdAt: '2026-03-26 08:10',
        updatedAt: '2026-03-26 11:30',
      },
      {
        id: 'pod-seed-8',
        kind: 'NORMAL',
        relationLevel: 'SUB_ORDER',
        relationTargetNo: 'S-20260320000007-1',
        supplierName: SUPPLIER_OPTIONS[5],
        feeType: 'DELIVERY',
        unitPrice: 15000,
        quantity: 2,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 30000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '末端派送预约',
        createdAt: '2026-03-26 08:10',
        updatedAt: '2026-03-26 11:30',
      },
    ],
  },
  {
    jobNo: 'A-JOB26030001',
    station: '拉各斯空港组',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '空运普快',
    carrier: 'ET',
    blNo: 'ET-LOS-260301',
    originPort: 'CAN',
    destinationPort: 'LOS',
    pieces: 12,
    blWeight: 180,
    orderWeight: 172,
    createdBy: 'RITA',
    createdAt: '2026-03-23 09:05',
    updatedAt: '2026-03-23 17:20',
    supervisor: '主管-王安',
    reviewedAt: '2026-03-23 17:20',
    supervisorRemark: '空港清关费用已审核。',
    items: [
      {
        id: 'pod-seed-9',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'A-JOB26030001',
        supplierName: SUPPLIER_OPTIONS[1],
        feeType: 'CLEARANCE',
        unitPrice: 82000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 82000,
        paymentStatus: 'PAID',
        reviewStatus: 'APPROVED',
        remark: '空运清关',
        createdAt: '2026-03-23 09:05',
        updatedAt: '2026-03-23 17:20',
      },
      {
        id: 'pod-seed-10',
        kind: 'NORMAL',
        relationLevel: 'ORDER',
        relationTargetNo: 'A-20260320000001',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'PORT_CHARGE',
        unitPrice: 18000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 18000,
        paymentStatus: 'PAID',
        reviewStatus: 'APPROVED',
        remark: '空港地面服务',
        createdAt: '2026-03-23 09:05',
        updatedAt: '2026-03-23 17:20',
      },
    ],
  },
  {
    jobNo: 'A-JOB26030004',
    station: '阿布贾空港组',
    route: 'SZX.CHN→ABV.NGN',
    serviceType: '空运特快',
    carrier: 'EK',
    blNo: 'EK-ABV-260304',
    originPort: 'SZX',
    destinationPort: 'ABV',
    pieces: 7,
    blWeight: 96,
    orderWeight: 92,
    createdBy: 'MAY',
    createdAt: '2026-03-23 10:00',
    updatedAt: '2026-03-23 18:10',
    items: [
      {
        id: 'pod-seed-11',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'A-JOB26030004',
        supplierName: SUPPLIER_OPTIONS[1],
        feeType: 'DUTY',
        unitPrice: 60000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 60000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '税金申报',
        createdAt: '2026-03-23 10:00',
        updatedAt: '2026-03-23 18:10',
      },
      {
        id: 'pod-seed-12',
        kind: 'NORMAL',
        relationLevel: 'SUB_ORDER',
        relationTargetNo: 'A-20260320000003-1',
        supplierName: SUPPLIER_OPTIONS[5],
        feeType: 'DELIVERY',
        unitPrice: 12000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 12000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '提货后派送',
        createdAt: '2026-03-23 10:00',
        updatedAt: '2026-03-23 18:10',
      },
    ],
  },
  {
    jobNo: 'A-JOB26030007',
    station: '卡诺配送组',
    route: 'HKG.CHN→KAN.NGN',
    serviceType: '空运特快',
    carrier: 'CX',
    blNo: 'CX-KAN-260307',
    originPort: 'HKG',
    destinationPort: 'KAN',
    pieces: 15,
    blWeight: 245,
    orderWeight: 238,
    createdBy: 'LUNA',
    createdAt: '2026-03-24 08:30',
    updatedAt: '2026-03-24 16:00',
    supervisor: '主管-王安',
    reviewedAt: '2026-03-24 16:00',
    supervisorRemark: '拖车费通过，仓租费说明不足。',
    items: [
      {
        id: 'pod-seed-13',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'A-JOB26030007',
        supplierName: SUPPLIER_OPTIONS[3],
        feeType: 'TRUCKING',
        unitPrice: 26000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 26000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'APPROVED',
        remark: '机场到仓短驳',
        createdAt: '2026-03-24 08:30',
        updatedAt: '2026-03-24 16:00',
      },
      {
        id: 'pod-seed-14',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'A-JOB26030007',
        supplierName: SUPPLIER_OPTIONS[2],
        feeType: 'WAREHOUSE',
        unitPrice: 14000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 14000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'REJECTED',
        reviewComment: '仓租周期未写明',
        remark: '暂存 2 天',
        createdAt: '2026-03-24 08:30',
        updatedAt: '2026-03-24 16:00',
      },
    ],
  },
  {
    jobNo: 'A-JOB26030010',
    station: '奥尼查配送组',
    route: 'CAN.CHN→ONI.NGN',
    serviceType: '空运普快',
    carrier: 'ET',
    blNo: 'ET-ONI-260310',
    originPort: 'CAN',
    destinationPort: 'ONI',
    pieces: 5,
    blWeight: 58,
    orderWeight: 54,
    createdBy: 'NINA',
    createdAt: '2026-03-25 09:15',
    updatedAt: '2026-03-25 12:40',
    items: [
      {
        id: 'pod-seed-15',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'A-JOB26030010',
        supplierName: SUPPLIER_OPTIONS[5],
        feeType: 'DELIVERY',
        unitPrice: 9000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 9000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '签收前派送',
        createdAt: '2026-03-25 09:15',
        updatedAt: '2026-03-25 12:40',
      },
      {
        id: 'pod-seed-16',
        kind: 'NORMAL',
        relationLevel: 'ORDER',
        relationTargetNo: 'A-20260320000006',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'OTHER',
        unitPrice: 6000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 6000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '异常件处理',
        createdAt: '2026-03-25 09:15',
        updatedAt: '2026-03-25 12:40',
      },
    ],
  },
];

const loadStoredRecords = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedRecords();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as TaskCostRecord[]) : createSeedRecords();
  } catch {
    return createSeedRecords();
  }
};

export const JobCostInputPOD: React.FC<{ businessMode?: BusinessMode }> = ({ businessMode = 'ALL' }) => {
  const [records, setRecords] = useState<TaskCostRecord[]>(() => loadStoredRecords());
  const [detailJobNo, setDetailJobNo] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [editorJobNo, setEditorJobNo] = useState('');
  const [editorRows, setEditorRows] = useState<CostItem[]>([]);
  const [reviewJobNo, setReviewJobNo] = useState('');
  const [reviewRows, setReviewRows] = useState<ReviewDraftRow[]>([]);
  const [reviewRemark, setReviewRemark] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const visibleTasks = useMemo(
    () => MOCK_JOB_TASKS.filter((task) => matchJobNoByBusinessMode(task.jobNo, businessMode)),
    [businessMode],
  );

  const visibleRecords = useMemo(
    () => records.filter((record) => matchJobNoByBusinessMode(record.jobNo, businessMode)),
    [records, businessMode],
  );

  const recordsByJobNo = useMemo(
    () => Object.fromEntries(visibleRecords.map((record) => [record.jobNo, record])),
    [visibleRecords],
  );

  const filteredRecords = useMemo(() => {
    let result = [...visibleRecords];
    if (filterKeyword.trim()) {
      const keyword = filterKeyword.trim().toLowerCase();
      result = result.filter((record) =>
        [
          record.jobNo,
          record.blNo,
          record.carrier,
          record.route,
          record.station,
        ].some((value) => String(value || '').toLowerCase().includes(keyword)),
      );
    }
    if (filterStatus) {
      result = result.filter((record) => deriveTaskStatus(record.items) === filterStatus);
    }
    if (filterDateRange?.[0] && filterDateRange?.[1]) {
      const start = filterDateRange[0].startOf('day');
      const end = filterDateRange[1].endOf('day');
      result = result.filter((record) => {
        const value = dayjs(record.updatedAt);
        return value.isAfter(start) && value.isBefore(end);
      });
    }
    return result.sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf());
  }, [visibleRecords, filterKeyword, filterStatus, filterDateRange]);

  const stats = useMemo(() => {
    const totalAmount = visibleRecords.reduce((sum, record) => sum + getSummaryAmount(record.items), 0);
    return {
      total: visibleRecords.length,
      draft: visibleRecords.filter((record) => deriveTaskStatus(record.items) === 'DRAFT').length,
      pending: visibleRecords.filter((record) => deriveTaskStatus(record.items) === 'PENDING_SUPERVISOR').length,
      rejected: visibleRecords.filter((record) => {
        const status = deriveTaskStatus(record.items);
        return status === 'PART_REJECTED' || status === 'REJECTED';
      }).length,
      approved: visibleRecords.filter((record) => deriveTaskStatus(record.items) === 'APPROVED').length,
      totalAmount,
    };
  }, [visibleRecords]);

  const detailRecord = detailJobNo ? recordsByJobNo[detailJobNo] : undefined;
  const detailTask = detailJobNo ? getTaskByJobNo(detailJobNo) : undefined;
  const editorTask = editorJobNo ? getTaskByJobNo(editorJobNo) : undefined;
  const reviewRecord = reviewJobNo ? recordsByJobNo[reviewJobNo] : undefined;

  const editorAmount = useMemo(
    () => editorRows.filter((row) => shouldCountItem(editorRows, row)).reduce((sum, row) => sum + row.amount, 0),
    [editorRows],
  );

  const openEditor = (jobNo?: string) => {
    const nextJobNo = jobNo || visibleTasks[0]?.jobNo || '';
    const existed = nextJobNo ? recordsByJobNo[nextJobNo] : undefined;
    setEditorJobNo(nextJobNo);
    setEditorRows(existed ? cloneItems(existed.items) : []);
    setEditorVisible(true);
  };

  const handleEditorJobChange = (jobNo: string) => {
    const existed = recordsByJobNo[jobNo];
    setEditorJobNo(jobNo);
    setEditorRows(existed ? cloneItems(existed.items) : []);
    if (existed) {
      message.info('当前任务已有成本记录，本次录入会在原任务下继续追加条目。');
    }
  };

  const updateEditorRow = (rowId: string, patch: Partial<CostItem>) => {
    setEditorRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const unitPrice = patch.unitPrice !== undefined ? Number(patch.unitPrice) : row.unitPrice;
        const quantity = patch.quantity !== undefined ? Number(patch.quantity) : row.quantity;
        return {
          ...row,
          ...patch,
          unitPrice,
          quantity,
          amount: calcAmount(unitPrice, quantity),
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
        };
      }),
    );
  };

  const addEditorRow = () => {
    if (!editorJobNo) {
      message.warning('请先选择任务号');
      return;
    }
    const task = getTaskByJobNo(editorJobNo);
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    setEditorRows((prev) => [
      ...prev,
      {
        id: createId('pod-cost-item'),
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: task?.jobNo || '',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'CLEARANCE',
        unitPrice: 0,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 0,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  };

  const requestModifyApprovedRow = (row: CostItem) => {
    if (editorRows.some((item) => item.originalItemId === row.id && item.reviewStatus !== 'REJECTED')) {
      message.warning('该已审核条目已有待处理的修改记录');
      return;
    }
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    const snapshot = createSnapshot(row);
    setEditorRows((prev) => [
      ...prev,
      {
        ...snapshot,
        id: createId('pod-cost-change'),
        kind: 'CHANGE',
        originalItemId: row.id,
        originalSnapshot: snapshot,
        paymentStatus: row.paymentStatus,
        reviewStatus: 'DRAFT',
        reviewComment: '',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    message.success('已生成修改行，提交审核时会保留原数据供审核员对比。');
  };

  const removeEditorRow = (rowId: string) => {
    setEditorRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const validateEditorRows = () => {
    if (!editorJobNo) {
      message.error('请选择任务号');
      return false;
    }
    if (!editorRows.length) {
      message.error('请至少保留 1 条费用条目');
      return false;
    }
    const editableRows = editorRows.filter((row) => isEditableRow(editorRows, row));
    for (const row of editableRows) {
      if (!row.relationTargetNo || !row.supplierName || !row.feeType || !row.currency) {
        message.error('请完整填写费用条目');
        return false;
      }
      if (row.unitPrice <= 0 || row.quantity <= 0) {
        message.error('单价和数量必须大于 0');
        return false;
      }
    }
    return true;
  };

  const persistEditor = (submitForReview: boolean) => {
    if (!validateEditorRows()) return;
    const task = getTaskByJobNo(editorJobNo);
    if (!task) {
      message.error('未找到对应任务');
      return;
    }
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    const currentUser = getCurrentUser();

    const nextItems = editorRows.map((row) => {
      if (!isEditableRow(editorRows, row)) return row;
      const nextStatus: ItemReviewStatus = submitForReview ? 'PENDING' : 'DRAFT';
      return {
        ...row,
        amount: calcAmount(row.unitPrice, row.quantity),
        reviewStatus: nextStatus,
        updatedAt: now,
      };
    });

    setRecords((prev) => {
      const existed = prev.find((record) => record.jobNo === editorJobNo);
      const nextRecord: TaskCostRecord = {
        jobNo: task.jobNo,
        station: task.station,
        route: task.route,
        serviceType: task.serviceType,
        carrier: task.carrier,
        blNo: task.blNo,
        originPort: task.originPort,
        destinationPort: task.destinationPort,
        pieces: task.pieces,
        blWeight: task.blWeight,
        orderWeight: task.orderWeight,
        createdBy: existed?.createdBy || currentUser,
        createdAt: existed?.createdAt || now,
        updatedAt: now,
        supervisor: existed?.supervisor,
        reviewedAt: existed?.reviewedAt,
        supervisorRemark: existed?.supervisorRemark,
        items: nextItems,
      };
      if (existed) {
        return prev.map((record) => (record.jobNo === editorJobNo ? nextRecord : record));
      }
      return [nextRecord, ...prev];
    });

    message.success(submitForReview ? '已提交主管审核' : '已保存为草稿');
    setEditorVisible(false);
    setEditorJobNo('');
    setEditorRows([]);
  };

  const openReview = (record: TaskCostRecord) => {
    const pendingRows = record.items.filter((item) => item.reviewStatus === 'PENDING');
    if (!pendingRows.length) {
      message.warning('当前没有待审核条目');
      return;
    }
    setReviewJobNo(record.jobNo);
    setReviewRows(
      pendingRows.map((item) => ({
        id: item.id,
        decision: 'APPROVED',
        comment: '',
      })),
    );
    setReviewRemark(record.supervisorRemark || '');
    setReviewVisible(true);
  };

  const submitReview = () => {
    if (!reviewRecord) return;
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    const reviewer = getCurrentUser();
    setRecords((prev) =>
      prev.map((record) => {
        if (record.jobNo !== reviewRecord.jobNo) return record;
        return {
          ...record,
          updatedAt: now,
          supervisor: reviewer,
          reviewedAt: now,
          supervisorRemark: reviewRemark,
          items: record.items.map((item) => {
            const matched = reviewRows.find((row) => row.id === item.id);
            if (!matched) return item;
            return {
              ...item,
              reviewStatus: matched.decision,
              reviewComment: matched.comment,
              updatedAt: now,
            };
          }),
        };
      }),
    );
    message.success('主管审核结果已保存');
    setReviewVisible(false);
    setReviewJobNo('');
    setReviewRows([]);
    setReviewRemark('');
  };

  const resetFilters = () => {
    setFilterKeyword('');
    setFilterStatus('');
    setFilterDateRange(null);
  };

  const listColumns = [
    {
      title: '任务号',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 150,
      render: (value: string, record: TaskCostRecord) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => {
            setDetailJobNo(record.jobNo);
            setDetailVisible(true);
          }}
        >
          {value}
        </Button>
      ),
    },
    { title: '站点', dataIndex: 'station', key: 'station', width: 120 },
    { title: '线路', dataIndex: 'route', key: 'route', width: 170 },
    { title: '类型', dataIndex: 'serviceType', key: 'serviceType', width: 110 },
    { title: '承运人', dataIndex: 'carrier', key: 'carrier', width: 90 },
    { title: '提单号', dataIndex: 'blNo', key: 'blNo', width: 150 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 70 },
    { title: '费用条目', key: 'itemCount', width: 90, render: (_: unknown, record: TaskCostRecord) => record.items.length },
    {
      title: '应付合计',
      key: 'summaryAmount',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, record: TaskCostRecord) =>
        getSummaryAmount(record.items).toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    {
      title: '支付状态',
      key: 'paymentStatus',
      width: 100,
      render: (_: unknown, record: TaskCostRecord) => {
        const status = getSummaryPaymentStatus(record.items);
        return <Tag color={PAYMENT_STATUS_CONFIG[status].color}>{PAYMENT_STATUS_CONFIG[status].text}</Tag>;
      },
    },
    {
      title: '审核状态',
      key: 'taskStatus',
      width: 110,
      render: (_: unknown, record: TaskCostRecord) => {
        const status = deriveTaskStatus(record.items);
        return <Tag color={TASK_STATUS_CONFIG[status].color}>{TASK_STATUS_CONFIG[status].text}</Tag>;
      },
    },
    {
      title: '最近更新',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right' as const,
      render: (_: unknown, record: TaskCostRecord) => {
        const status = deriveTaskStatus(record.items);
        return (
          <Space size={4} wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setDetailJobNo(record.jobNo);
                setDetailVisible(true);
              }}
            >
              详情
            </Button>
            {status !== 'PENDING_SUPERVISOR' && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditor(record.jobNo)}>
                继续录入
              </Button>
            )}
            {status === 'PENDING_SUPERVISOR' && (
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => openReview(record)}>
                主管审核
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const editorColumns = [
    {
      title: '条目类型',
      key: 'rowType',
      width: 110,
      fixed: 'left' as const,
      render: (_: unknown, row: CostItem) => <Tag>{getRowTypeText(editorRows, row)}</Tag>,
    },
    {
      title: '归属层级',
      dataIndex: 'relationLevel',
      key: 'relationLevel',
      width: 120,
      render: (value: RelationLevel, row: CostItem) =>
        isEditableRow(editorRows, row) ? (
          <Select
            value={value}
            style={{ width: '100%' }}
            options={RELATION_LEVEL_OPTIONS}
            onChange={(nextValue) => {
              const nextTarget = getRelationTargetOptions(editorTask, nextValue)[0] || '';
              updateEditorRow(row.id, { relationLevel: nextValue, relationTargetNo: nextTarget });
            }}
          />
        ) : (
          RELATION_LEVEL_OPTIONS.find((item) => item.value === value)?.label || value
        ),
    },
    {
      title: '归属对象',
      dataIndex: 'relationTargetNo',
      key: 'relationTargetNo',
      width: 150,
      render: (value: string, row: CostItem) => {
        const options = getRelationTargetOptions(editorTask, row.relationLevel);
        return isEditableRow(editorRows, row) ? (
          <Select
            value={value}
            style={{ width: '100%' }}
            options={options.map((item) => ({ value: item, label: item }))}
            onChange={(nextValue) => updateEditorRow(row.id, { relationTargetNo: nextValue })}
          />
        ) : value;
      },
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      key: 'supplierName',
      width: 220,
      render: (value: string, row: CostItem) =>
        isEditableRow(editorRows, row) ? (
          <Select
            value={value}
            showSearch
            optionFilterProp="children"
            style={{ width: '100%' }}
            onChange={(nextValue) => updateEditorRow(row.id, { supplierName: nextValue })}
          >
            {SUPPLIER_OPTIONS.map((item) => (
              <Select.Option key={item} value={item}>
                {item}
              </Select.Option>
            ))}
          </Select>
        ) : (
          value
        ),
    },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 130,
      render: (value: string, row: CostItem) =>
        isEditableRow(editorRows, row) ? (
          <Select
            value={value}
            style={{ width: '100%' }}
            options={FEE_TYPE_OPTIONS}
            onChange={(nextValue) => updateEditorRow(row.id, { feeType: nextValue })}
          />
        ) : (
          FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value
        ),
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 110,
      render: (value: number, row: CostItem) =>
        isEditableRow(editorRows, row) ? (
          <InputNumber
            min={0}
            precision={2}
            value={value}
            style={{ width: '100%' }}
            onChange={(nextValue) => updateEditorRow(row.id, { unitPrice: Number(nextValue || 0) })}
          />
        ) : (
          value.toFixed(2)
        ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      render: (value: number, row: CostItem) =>
        isEditableRow(editorRows, row) ? (
          <InputNumber
            min={0}
            precision={2}
            value={value}
            style={{ width: '100%' }}
            onChange={(nextValue) => updateEditorRow(row.id, { quantity: Number(nextValue || 0) })}
          />
        ) : (
          value
        ),
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 90,
      render: (value: string, row: CostItem) =>
        isEditableRow(editorRows, row) ? (
          <Select
            value={value}
            style={{ width: '100%' }}
            options={CURRENCY_OPTIONS}
            onChange={(nextValue) => updateEditorRow(row.id, { currency: nextValue })}
          />
        ) : (
          value
        ),
    },
    {
      title: '小计',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '录入汇率',
      dataIndex: 'exchangeRate',
      key: 'exchangeRate',
      width: 100,
      render: (value: number) => value ? `${value}` : '-',
    },
    {
      title: '折合CNY',
      key: 'amountCNY',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, row: CostItem) => {
        const rate = row.exchangeRate || (row.currency === 'CNY' ? 1 : 0.0055);
        return <span style={{ color: '#8c8c8c' }}>¥{(row.amount * rate).toFixed(2)}</span>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      width: 100,
      render: (value: ItemReviewStatus) => <Tag color={ITEM_STATUS_CONFIG[value].color}>{ITEM_STATUS_CONFIG[value].text}</Tag>,
    },
    {
      title: '原数据',
      key: 'originalSnapshot',
      width: 260,
      render: (_: unknown, row: CostItem) =>
        row.originalSnapshot
          ? `${row.originalSnapshot.supplierName} / ${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity}`
          : '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      render: (value: string, row: CostItem) =>
        isEditableRow(editorRows, row) ? (
          <Input value={value} onChange={(event) => updateEditorRow(row.id, { remark: event.target.value })} />
        ) : (
          value || '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, row: CostItem) => {
        if (row.reviewStatus === 'APPROVED' && !isHistoricalRow(editorRows, row)) {
          return (
            <Button type="link" size="small" onClick={() => requestModifyApprovedRow(row)}>
              申请修改
            </Button>
          );
        }
        if (isEditableRow(editorRows, row)) {
          return (
            <Popconfirm title="确认删除该条目？" onConfirm={() => removeEditorRow(row.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          );
        }
        return '-';
      },
    },
  ];

  const detailColumns = [
    {
      title: '条目类型',
      key: 'rowType',
      width: 110,
      render: (_: unknown, row: CostItem) => <Tag>{detailRecord ? getRowTypeText(detailRecord.items, row) : '-'}</Tag>,
    },
    {
      title: '归属层级',
      dataIndex: 'relationLevel',
      key: 'relationLevel',
      width: 120,
      render: (value: RelationLevel) => RELATION_LEVEL_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    { title: '归属对象', dataIndex: 'relationTargetNo', key: 'relationTargetNo', width: 140 },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 220 },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 120,
      render: (value: string) => FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 100, render: (value: number) => value.toFixed(2) },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 90 },
    { title: '小计', dataIndex: 'amount', key: 'amount', width: 100, render: (value: number) => value.toFixed(2) },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 70 },
    { title: '录入汇率', dataIndex: 'exchangeRate', key: 'exchangeRate', width: 90, render: (value: number) => value ? `${value}` : '-' },
    {
      title: '折合CNY', key: 'amountCNY', width: 100, align: 'right' as const,
      render: (_: unknown, row: CostItem) => {
        const rate = row.exchangeRate || (row.currency === 'CNY' ? 1 : 0.0055);
        return <span style={{ color: '#8c8c8c' }}>¥{(row.amount * rate).toFixed(2)}</span>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      width: 100,
      render: (value: ItemReviewStatus) => <Tag color={ITEM_STATUS_CONFIG[value].color}>{ITEM_STATUS_CONFIG[value].text}</Tag>,
    },
    {
      title: '原数据',
      key: 'originalSnapshot',
      width: 260,
      render: (_: unknown, row: CostItem) =>
        row.originalSnapshot
          ? `${row.originalSnapshot.supplierName} / ${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity}`
          : '-',
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 180 },
    { title: '审核意见', dataIndex: 'reviewComment', key: 'reviewComment', width: 180, render: (value: string) => value || '-' },
  ];

  const reviewColumns = [
    {
      title: '变更类型',
      key: 'kind',
      width: 110,
      render: (_: unknown, row: CostItem) => <Tag>{row.kind === 'CHANGE' ? '修改申请' : '新增条目'}</Tag>,
    },
    {
      title: '归属层级',
      dataIndex: 'relationLevel',
      key: 'relationLevel',
      width: 120,
      render: (value: RelationLevel) => RELATION_LEVEL_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    { title: '归属对象', dataIndex: 'relationTargetNo', key: 'relationTargetNo', width: 120 },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 220 },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 120,
      render: (value: string) => FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    {
      title: '原数据',
      key: 'origin',
      width: 260,
      render: (_: unknown, row: CostItem) =>
        row.originalSnapshot
          ? `${row.originalSnapshot.supplierName} / ${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity} = ${row.originalSnapshot.amount.toFixed(2)}`
          : '-',
    },
    {
      title: '申请数据',
      key: 'next',
      width: 260,
      render: (_: unknown, row: CostItem) =>
        `${row.supplierName} / ${FEE_TYPE_OPTIONS.find((item) => item.value === row.feeType)?.label || row.feeType} / ${row.unitPrice.toFixed(2)} x ${row.quantity} = ${row.amount.toFixed(2)}`,
    },
    {
      title: '审核结果',
      key: 'decision',
      width: 120,
      render: (_: unknown, row: CostItem) => {
        const matched = reviewRows.find((item) => item.id === row.id);
        return (
          <Select
            value={matched?.decision}
            style={{ width: '100%' }}
            options={[
              { value: 'APPROVED', label: '通过' },
              { value: 'REJECTED', label: '驳回' },
            ]}
            onChange={(value) => {
              setReviewRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, decision: value } : item)));
            }}
          />
        );
      },
    },
    {
      title: '审核意见',
      key: 'comment',
      width: 180,
      render: (_: unknown, row: CostItem) => {
        const matched = reviewRows.find((item) => item.id === row.id);
        return (
          <Input
            value={matched?.comment}
            onChange={(event) => {
              const nextValue = event.target.value;
              setReviewRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, comment: nextValue } : item)));
            }}
          />
        );
      },
    },
  ];

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 10 }}
        message="演示规则：列表只保留任务号一条数据；后续录入在原任务下直接追加费用条目；已审核条目不可直接改值，修改会生成保留原数据的待审核变更行。"
      />

      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">任务记录 {stats.total}</Tag>
        <Tag>草稿 {stats.draft}</Tag>
        <Tag color="orange">待主管审核 {stats.pending}</Tag>
        <Tag color="gold">驳回中 {stats.rejected}</Tag>
        <Tag color="green">已审核 {stats.approved}</Tag>
        <Tag color="processing">应付合计 NGN {stats.totalAmount.toFixed(2)}（≈ CNY {(stats.totalAmount * 0.0055).toFixed(2)}）</Tag>
      </div>

      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 260px" minWidth={240}>
              <Input
                placeholder="输入任务号/提单号/承运人"
                value={filterKeyword}
                onChange={(event) => setFilterKeyword(event.target.value)}
                prefix={<SearchOutlined />}
                allowClear
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={160}>
              <Select
                placeholder="审核状态"
                value={filterStatus || undefined}
                onChange={setFilterStatus}
                style={{ width: '100%' }}
                allowClear
              >
                {Object.entries(TASK_STATUS_CONFIG).map(([value, config]) => (
                  <Select.Option key={value} value={value}>
                    {config.text}
                  </Select.Option>
                ))}
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={260}>
              <RangePicker value={filterDateRange} onChange={setFilterDateRange} />
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button type="primary" icon={<SearchOutlined />} onClick={() => setFilterKeyword((value) => value.trim())}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>
              重置
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
              录入费用
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      <Table
        rowKey="jobNo"
        columns={listColumns}
        dataSource={filteredRecords}
        scroll={{ x: 1720, y: 'calc(100vh - 430px)' }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        size="small"
      />

      <Drawer
        title="JOB 成本录入"
        placement="right"
        open={editorVisible}
        onClose={() => {
          setEditorVisible(false);
          setEditorJobNo('');
          setEditorRows([]);
        }}
        width="96vw"
        destroyOnHidden
        styles={{ body: { padding: 16 } }}
        extra={(
          <Space>
            <Button
              onClick={() => {
                setEditorVisible(false);
                setEditorJobNo('');
                setEditorRows([]);
              }}
            >
              取消
            </Button>
            <Button onClick={() => persistEditor(false)}>保存草稿</Button>
            <Button type="primary" onClick={() => persistEditor(true)}>
              提交主管审核
            </Button>
          </Space>
        )}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="费用条目使用表格式录入。已审核条目为锁定行，只能通过“申请修改”生成待审核变更；新增条目和驳回条目可直接编辑。"
        />

        <Descriptions size="small" column={4} bordered style={{ marginBottom: 12 }}>
          <Descriptions.Item label="任务号" span={2}>
            <Select
              value={editorJobNo || undefined}
              placeholder="请选择任务号"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
              onChange={handleEditorJobChange}
            >
              {visibleTasks.map((task) => (
                <Select.Option key={task.jobNo} value={task.jobNo}>
                  {task.jobNo} / {task.station}
                </Select.Option>
              ))}
            </Select>
          </Descriptions.Item>
          <Descriptions.Item label="站点">{editorTask?.station || '-'}</Descriptions.Item>
          <Descriptions.Item label="承运人">{editorTask?.carrier || '-'}</Descriptions.Item>
          <Descriptions.Item label="线路">{editorTask?.route || '-'}</Descriptions.Item>
          <Descriptions.Item label="提单号">{editorTask?.blNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="服务类型">{editorTask?.serviceType || '-'}</Descriptions.Item>
          <Descriptions.Item label="件数">{editorTask?.pieces || '-'}</Descriptions.Item>
          <Descriptions.Item label="应付合计">
            <span style={{ fontWeight: 600 }}>NGN {editorAmount.toFixed(2)}</span>
            <span style={{ marginLeft: 16, color: '#8c8c8c', fontSize: 12 }}>
              折合 CNY ≈ ¥{editorRows.reduce((sum, r) => sum + r.amount * (r.exchangeRate || 0.0055), 0).toFixed(2)}（各条目按录入时汇率独立计算）
            </span>
          </Descriptions.Item>
        </Descriptions>

        <Card size="small" title="费用条目" extra={<Button type="dashed" onClick={addEditorRow}>+ 添加行</Button>}>
          <Table
            rowKey="id"
            columns={editorColumns}
            dataSource={editorRows}
            pagination={false}
            size="small"
            scroll={{ x: 2160 }}
          />
        </Card>
      </Drawer>

      <Drawer
        title={detailRecord ? `JOB 成本详情 - ${detailRecord.jobNo}` : 'JOB 成本详情'}
        placement="right"
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setDetailJobNo('');
        }}
        width="94vw"
        destroyOnHidden
        styles={{ body: { padding: 16 } }}
        extra={detailRecord ? (
          <Space>
            <Button
              onClick={() => {
                setDetailVisible(false);
                setDetailJobNo('');
              }}
            >
              关闭
            </Button>
            {deriveTaskStatus(detailRecord.items) !== 'PENDING_SUPERVISOR' && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailVisible(false);
                  setDetailJobNo('');
                  openEditor(detailRecord.jobNo);
                }}
              >
                继续录入
              </Button>
            )}
          </Space>
        ) : undefined}
      >
        {detailRecord && (
          <>
            <Descriptions size="small" column={4} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="任务号">{detailRecord.jobNo}</Descriptions.Item>
              <Descriptions.Item label="站点">{detailRecord.station}</Descriptions.Item>
              <Descriptions.Item label="承运人">{detailRecord.carrier}</Descriptions.Item>
              <Descriptions.Item label="提单号">{detailRecord.blNo}</Descriptions.Item>
              <Descriptions.Item label="线路">{detailRecord.route}</Descriptions.Item>
              <Descriptions.Item label="服务类型">{detailRecord.serviceType}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{TASK_STATUS_CONFIG[deriveTaskStatus(detailRecord.items)].text}</Descriptions.Item>
              <Descriptions.Item label="支付状态">{PAYMENT_STATUS_CONFIG[getSummaryPaymentStatus(detailRecord.items)].text}</Descriptions.Item>
              <Descriptions.Item label="到港时间">{formatDateTime(detailTask?.arrivePortAt)}</Descriptions.Item>
              <Descriptions.Item label="清关放行">{formatDateTime(detailTask?.customsReleaseAt)}</Descriptions.Item>
              <Descriptions.Item label="仓库入库">{formatDateTime(detailTask?.warehouseInboundAt)}</Descriptions.Item>
              <Descriptions.Item label="件数">{detailRecord.pieces}</Descriptions.Item>
              <Descriptions.Item label="创建人">{detailRecord.createdBy}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(detailRecord.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="主管审核">{detailRecord.supervisor || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{formatDateTime(detailRecord.reviewedAt)}</Descriptions.Item>
              <Descriptions.Item label="主管意见" span={4}>
                {detailRecord.supervisorRemark || '暂无'}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="费用条目详情">
              {(() => {
                const currencySymbol: Record<string, string> = { USD: '$', CNY: '¥', NGN: '₦', EUR: '€' };
                const grouped: Record<string, CostItem[]> = {};
                (detailRecord.items || []).forEach((item: CostItem) => {
                  const cur = item.currency || 'USD';
                  if (!grouped[cur]) grouped[cur] = [];
                  grouped[cur].push(item);
                });
                if (Object.keys(grouped).length === 0) grouped['USD'] = [];
                return Object.entries(grouped).map(([currency, items]) => {
                  const symbol = currencySymbol[currency] || currency;
                  const total = items.reduce((s, i) => s + (i.amount || 0), 0);
                  return (
                    <div key={currency} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Tag color={currency === 'USD' ? 'blue' : currency === 'CNY' ? 'red' : currency === 'NGN' ? 'green' : 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                          {symbol} {currency}
                        </Tag>
                        <span style={{ fontWeight: 600, color: '#1677ff' }}>小计：{symbol}{total.toFixed(2)}</span>
                      </div>
                      <Table rowKey="id" columns={detailColumns} dataSource={items} pagination={false} size="small" scroll={{ x: 2100 }} locale={{ emptyText: `暂无 ${currency} 费用` }} />
                    </div>
                  );
                });
              })()}
            </Card>
          </>
        )}
      </Drawer>

      <Drawer
        title={reviewRecord ? `主管审核 - ${reviewRecord.jobNo}` : '主管审核'}
        placement="right"
        open={reviewVisible}
        onClose={() => {
          setReviewVisible(false);
          setReviewJobNo('');
          setReviewRows([]);
          setReviewRemark('');
        }}
        width="94vw"
        destroyOnHidden
        styles={{ body: { padding: 16 } }}
        extra={(
          <Space>
            <Button
              onClick={() => {
                setReviewVisible(false);
                setReviewJobNo('');
                setReviewRows([]);
                setReviewRemark('');
              }}
            >
              取消
            </Button>
            <Button type="primary" onClick={submitReview}>
              确认审核
            </Button>
          </Space>
        )}
      >
        {reviewRecord && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="审核员可以直接对比原数据与申请数据。修改类条目只有审核通过后才会替换当前生效内容，原数据会继续保留在详情里。"
            />

            <Descriptions size="small" column={4} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="任务号">{reviewRecord.jobNo}</Descriptions.Item>
              <Descriptions.Item label="站点">{reviewRecord.station}</Descriptions.Item>
              <Descriptions.Item label="承运人">{reviewRecord.carrier}</Descriptions.Item>
              <Descriptions.Item label="提单号">{reviewRecord.blNo}</Descriptions.Item>
            </Descriptions>

            <Table
              rowKey="id"
              columns={reviewColumns}
              dataSource={reviewRecord.items.filter((item) => item.reviewStatus === 'PENDING')}
              pagination={false}
              size="small"
              scroll={{ x: 1980 }}
            />

            <Card size="small" title="整单审核意见" style={{ marginTop: 12 }}>
              <Input.TextArea
                rows={3}
                value={reviewRemark}
                onChange={(event) => setReviewRemark(event.target.value)}
                placeholder="补充整单审核意见，供录入人查看"
              />
            </Card>
          </>
        )}
      </Drawer>
    </div>
  );
};
