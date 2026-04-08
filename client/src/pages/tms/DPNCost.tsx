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
import dayjs, { type Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

type BusinessMode = 'ALL' | 'AIR' | 'SEA';
type TaskStatus = 'DRAFT' | 'PENDING_SUPERVISOR' | 'PART_REJECTED' | 'REJECTED' | 'APPROVED';
type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
type RelationLevel = 'DPN' | 'JOB' | 'ORDER' | 'SUB_ORDER';
type ItemReviewStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
type ItemKind = 'NORMAL' | 'CHANGE';

interface MockDpnTask {
  dpnNo: string;
  businessLine: 'SEA' | 'AIR';
  fromNode: string;
  toNode: string;
  route: string;
  dispatchType: string;
  logisticsCompany: string;
  driverName: string;
  driverPhone: string;
  plateNo: string;
  dispatchAt: string;
  executedAt: string;
  inboundAt: string;
  waybillCount: number;
  pieces: number;
  totalWeight: number;
  jobNos: string[];
  orderNos: string[];
  subOrderNos: string[];
  remark: string;
}

interface CostItemSnapshot {
  relationLevel: RelationLevel;
  relationTargetNo: string;
  supplierName: string;
  feeType: string;
  unitPrice: number;
  quantity: number;
  currency: string;
  amount: number;
  exchangeRate: number;
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

interface DpnCostRecord {
  dpnNo: string;
  businessLine: 'SEA' | 'AIR';
  fromNode: string;
  toNode: string;
  route: string;
  dispatchType: string;
  logisticsCompany: string;
  driverName: string;
  driverPhone: string;
  plateNo: string;
  waybillCount: number;
  pieces: number;
  totalWeight: number;
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

const STORAGE_KEY = 'dpn-cost-task-demo-v20260323';

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
  { value: 'DPN', label: 'DPN公摊' },
  { value: 'JOB', label: 'JOB' },
  { value: 'ORDER', label: '订单号' },
  { value: 'SUB_ORDER', label: '子单号' },
];

const FEE_TYPE_OPTIONS = [
  { value: 'TRANSFER', label: '站点转运费' },
  { value: 'LINE_HAUL', label: '干线调拨费' },
  { value: 'DISPATCH', label: '派车费' },
  { value: 'DRIVER_ALLOWANCE', label: '司机补贴' },
  { value: 'FUEL', label: '油费' },
  { value: 'TOLL', label: '过路费' },
  { value: 'HANDLING', label: '装卸费' },
  { value: 'TEMP_STORAGE', label: '临时仓租' },
  { value: 'ABNORMAL', label: '异常处理费' },
  { value: 'OTHER', label: '其他' },
];

const CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'NGN' },
  { value: 'USD', label: 'USD' },
  { value: 'CNY', label: 'CNY' },
];

const SUPPLIER_OPTIONS = [
  'MiaoMiao Lagos Dispatch Team',
  'Lagos Interstation Transport Ltd.',
  'Abuja Transfer Fleet',
  'Kano Inland Transit Service',
  'Onitsha Satellite Route Team',
  'Nigeria Regional Dispatch Partner',
];

const MOCK_DPN_TASKS: MockDpnTask[] = [
  {
    dpnNo: 'DPN-20260320-0001',
    businessLine: 'SEA',
    fromNode: '拉各斯中心仓',
    toNode: '阿布贾卫星站',
    route: 'LOS中心仓→ABV卫星站',
    dispatchType: '海运到港后站点调拨',
    logisticsCompany: 'Lagos Interstation Transport Ltd.',
    driverName: 'Ayo',
    driverPhone: '0803-222-1101',
    plateNo: 'LOS-ABV-01',
    dispatchAt: '2026-03-23 09:30',
    executedAt: '2026-03-23 12:40',
    inboundAt: '2026-03-23 18:20',
    waybillCount: 18,
    pieces: 52,
    totalWeight: 2450,
    jobNos: ['S-JOB26030001', 'S-JOB26030002'],
    orderNos: ['S-20260320000001', 'S-20260320000002'],
    subOrderNos: ['S-20260320000001-1', 'S-20260320000002-1'],
    remark: '从拉各斯中心仓分拨至阿布贾卫星站。',
  },
  {
    dpnNo: 'DPN-20260320-0004',
    businessLine: 'SEA',
    fromNode: '拉各斯中心仓',
    toNode: '卡诺卫星站',
    route: 'LOS中心仓→KAN卫星站',
    dispatchType: '海运末段站点干线',
    logisticsCompany: 'Kano Inland Transit Service',
    driverName: 'Musa',
    driverPhone: '0803-333-4421',
    plateNo: 'LOS-KAN-03',
    dispatchAt: '2026-03-24 08:10',
    executedAt: '2026-03-24 13:30',
    inboundAt: '2026-03-24 20:45',
    waybillCount: 12,
    pieces: 31,
    totalWeight: 1680,
    jobNos: ['S-JOB26030004'],
    orderNos: ['S-20260320000003', 'S-20260320000004'],
    subOrderNos: ['S-20260320000003-1', 'S-20260320000004-1'],
    remark: '卡诺站点当日到货，需短驳及装卸。',
  },
  {
    dpnNo: 'DPN-20260320-0007',
    businessLine: 'SEA',
    fromNode: '阿布贾中转仓',
    toNode: '奥尼查卫星站',
    route: 'ABV中转仓→ONI卫星站',
    dispatchType: '海运跨站点调拨',
    logisticsCompany: 'Onitsha Satellite Route Team',
    driverName: 'Ifeanyi',
    driverPhone: '0803-665-9002',
    plateNo: 'ABV-ONI-08',
    dispatchAt: '2026-03-25 09:00',
    executedAt: '2026-03-25 15:20',
    inboundAt: '2026-03-25 22:00',
    waybillCount: 9,
    pieces: 27,
    totalWeight: 980,
    jobNos: ['S-JOB26030007'],
    orderNos: ['S-20260320000005', 'S-20260320000006'],
    subOrderNos: ['S-20260320000005-1', 'S-20260320000006-1'],
    remark: '存在异常件二次装卸。',
  },
  {
    dpnNo: 'DPN-20260320-0010',
    businessLine: 'SEA',
    fromNode: '拉各斯中心仓',
    toNode: '伊巴丹卫星站',
    route: 'LOS中心仓→IBA卫星站',
    dispatchType: '海运末段站点调拨',
    logisticsCompany: 'Nigeria Regional Dispatch Partner',
    driverName: 'Samuel',
    driverPhone: '0803-118-3322',
    plateNo: 'LOS-IBA-06',
    dispatchAt: '2026-03-26 07:50',
    executedAt: '2026-03-26 11:10',
    inboundAt: '2026-03-26 16:50',
    waybillCount: 7,
    pieces: 18,
    totalWeight: 730,
    jobNos: ['S-JOB26030010'],
    orderNos: ['S-20260320000007'],
    subOrderNos: ['S-20260320000007-1'],
    remark: '伊巴丹站点补录费用待提交。',
  },
  {
    dpnNo: 'DPN-20260320-0501',
    businessLine: 'AIR',
    fromNode: '拉各斯空港仓',
    toNode: '阿布贾空港站',
    route: 'LOS空港仓→ABV空港站',
    dispatchType: '空运到港后站点转运',
    logisticsCompany: 'Abuja Transfer Fleet',
    driverName: 'Femi',
    driverPhone: '0803-442-8099',
    plateNo: 'AIR-ABV-01',
    dispatchAt: '2026-03-23 10:10',
    executedAt: '2026-03-23 12:00',
    inboundAt: '2026-03-23 15:10',
    waybillCount: 6,
    pieces: 14,
    totalWeight: 210,
    jobNos: ['A-JOB26030001'],
    orderNos: ['A-20260320000001', 'A-20260320000002'],
    subOrderNos: ['A-20260320000001-1', 'A-20260320000002-1'],
    remark: '空港快转任务。',
  },
  {
    dpnNo: 'DPN-20260320-0504',
    businessLine: 'AIR',
    fromNode: '阿布贾空港站',
    toNode: '卡诺空港站',
    route: 'ABV空港站→KAN空港站',
    dispatchType: '空运跨站点派车',
    logisticsCompany: 'Kano Inland Transit Service',
    driverName: 'Sani',
    driverPhone: '0803-776-1208',
    plateNo: 'AIR-KAN-02',
    dispatchAt: '2026-03-24 09:40',
    executedAt: '2026-03-24 13:40',
    inboundAt: '2026-03-24 18:00',
    waybillCount: 4,
    pieces: 10,
    totalWeight: 146,
    jobNos: ['A-JOB26030004'],
    orderNos: ['A-20260320000003'],
    subOrderNos: ['A-20260320000003-1'],
    remark: '空港短驳转运。',
  },
  {
    dpnNo: 'DPN-20260320-0507',
    businessLine: 'AIR',
    fromNode: '拉各斯空港仓',
    toNode: '奥尼查卫星站',
    route: 'LOS空港仓→ONI卫星站',
    dispatchType: '空运末端站点调拨',
    logisticsCompany: 'Nigeria Regional Dispatch Partner',
    driverName: 'Daniel',
    driverPhone: '0803-219-0043',
    plateNo: 'AIR-ONI-09',
    dispatchAt: '2026-03-25 08:30',
    executedAt: '2026-03-25 11:50',
    inboundAt: '2026-03-25 17:25',
    waybillCount: 5,
    pieces: 11,
    totalWeight: 132,
    jobNos: ['A-JOB26030007'],
    orderNos: ['A-20260320000004', 'A-20260320000005'],
    subOrderNos: ['A-20260320000004-1', 'A-20260320000005-1'],
    remark: '含临时仓租和异常件处理。',
  },
  {
    dpnNo: 'DPN-20260320-0510',
    businessLine: 'AIR',
    fromNode: '卡诺空港站',
    toNode: '索科托卫星站',
    route: 'KAN空港站→SOK卫星站',
    dispatchType: '空运站点二次分拨',
    logisticsCompany: 'MiaoMiao Lagos Dispatch Team',
    driverName: 'Bala',
    driverPhone: '0803-998-1110',
    plateNo: 'AIR-SOK-05',
    dispatchAt: '2026-03-26 09:20',
    executedAt: '2026-03-26 14:00',
    inboundAt: '2026-03-26 19:45',
    waybillCount: 3,
    pieces: 8,
    totalWeight: 96,
    jobNos: ['A-JOB26030010'],
    orderNos: ['A-20260320000006'],
    subOrderNos: ['A-20260320000006-1'],
    remark: '新建 DPN，待录入成本。',
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

// DPN 不区分海运/空运，所有业务模式下展示全部 DPN
const matchDpnNoByBusinessMode = (dpnNo: string, _businessMode: BusinessMode) => {
  return !!dpnNo;
};

const getTaskByDpnNo = (dpnNo: string) => MOCK_DPN_TASKS.find((item) => item.dpnNo === dpnNo);

const getRelationTargetOptions = (task?: MockDpnTask, level?: RelationLevel) => {
  if (!task || !level) return [];
  if (level === 'DPN') return [task.dpnNo];
  if (level === 'JOB') return task.jobNos;
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

const createSeedRecords = (): DpnCostRecord[] => [
  {
    dpnNo: 'DPN-20260320-0001',
    businessLine: 'SEA',
    fromNode: '拉各斯中心仓',
    toNode: '阿布贾卫星站',
    route: 'LOS中心仓→ABV卫星站',
    dispatchType: '海运到港后站点调拨',
    logisticsCompany: 'Lagos Interstation Transport Ltd.',
    driverName: 'Ayo',
    driverPhone: '0803-222-1101',
    plateNo: 'LOS-ABV-01',
    waybillCount: 18,
    pieces: 52,
    totalWeight: 2450,
    createdBy: 'RITA',
    createdAt: '2026-03-23 09:40',
    updatedAt: '2026-03-24 16:20',
    supervisor: '主管-王安',
    reviewedAt: '2026-03-24 16:20',
    supervisorRemark: '首段转运费和装卸费已审核，可继续补录异常处理费用。',
    items: [
      {
        id: 'dpn-seed-1',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0001',
        supplierName: SUPPLIER_OPTIONS[1],
        feeType: 'LINE_HAUL',
        unitPrice: 180000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 180000,
        paymentStatus: 'PARTIAL',
        reviewStatus: 'APPROVED',
        remark: '中心仓到阿布贾干线调拨',
        createdAt: '2026-03-23 09:40',
        updatedAt: '2026-03-24 16:20',
      },
      {
        id: 'dpn-seed-2',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030001',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'HANDLING',
        unitPrice: 32000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 32000,
        paymentStatus: 'PAID',
        reviewStatus: 'APPROVED',
        remark: '装车与卸车人工',
        createdAt: '2026-03-23 09:40',
        updatedAt: '2026-03-24 16:20',
      },
      {
        id: 'dpn-seed-2b',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0001',
        supplierName: SUPPLIER_OPTIONS[1],
        feeType: 'INSURANCE',
        unitPrice: 45,
        quantity: 1,
        currency: 'USD',
        exchangeRate: 7.25,
        amount: 45,
        paymentStatus: 'UNPAID',
        reviewStatus: 'APPROVED',
        remark: '干线运输保险',
        createdAt: '2026-03-23 09:40',
        updatedAt: '2026-03-24 16:20',
      },
      {
        id: 'dpn-seed-2c',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0001',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'PACKAGING',
        unitPrice: 200,
        quantity: 3,
        currency: 'CNY',
        exchangeRate: 1,
        amount: 600,
        paymentStatus: 'PAID',
        reviewStatus: 'APPROVED',
        remark: '加固木架包装',
        createdAt: '2026-03-23 09:40',
        updatedAt: '2026-03-24 16:20',
      },
    ],
  },
  {
    dpnNo: 'DPN-20260320-0004',
    businessLine: 'SEA',
    fromNode: '拉各斯中心仓',
    toNode: '卡诺卫星站',
    route: 'LOS中心仓→KAN卫星站',
    dispatchType: '海运末段站点干线',
    logisticsCompany: 'Kano Inland Transit Service',
    driverName: 'Musa',
    driverPhone: '0803-333-4421',
    plateNo: 'LOS-KAN-03',
    waybillCount: 12,
    pieces: 31,
    totalWeight: 1680,
    createdBy: 'MAY',
    createdAt: '2026-03-24 08:20',
    updatedAt: '2026-03-24 17:50',
    items: [
      {
        id: 'dpn-seed-3',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0004',
        supplierName: SUPPLIER_OPTIONS[3],
        feeType: 'TRANSFER',
        unitPrice: 96000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 96000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '拉各斯至卡诺转运',
        createdAt: '2026-03-24 08:20',
        updatedAt: '2026-03-24 17:50',
      },
      {
        id: 'dpn-seed-4',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0004',
        supplierName: SUPPLIER_OPTIONS[3],
        feeType: 'FUEL',
        unitPrice: 28000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 28000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '长途油费',
        createdAt: '2026-03-24 08:20',
        updatedAt: '2026-03-24 17:50',
      },
    ],
  },
  {
    dpnNo: 'DPN-20260320-0007',
    businessLine: 'SEA',
    fromNode: '阿布贾中转仓',
    toNode: '奥尼查卫星站',
    route: 'ABV中转仓→ONI卫星站',
    dispatchType: '海运跨站点调拨',
    logisticsCompany: 'Onitsha Satellite Route Team',
    driverName: 'Ifeanyi',
    driverPhone: '0803-665-9002',
    plateNo: 'ABV-ONI-08',
    waybillCount: 9,
    pieces: 27,
    totalWeight: 980,
    createdBy: 'LUNA',
    createdAt: '2026-03-25 09:10',
    updatedAt: '2026-03-26 09:40',
    supervisor: '主管-王安',
    reviewedAt: '2026-03-26 09:40',
    supervisorRemark: '主调拨费用通过，异常处理补充原因后重提。',
    items: [
      {
        id: 'dpn-seed-5',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0007',
        supplierName: SUPPLIER_OPTIONS[4],
        feeType: 'DISPATCH',
        unitPrice: 54000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 54000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'APPROVED',
        remark: '跨站点派车',
        createdAt: '2026-03-25 09:10',
        updatedAt: '2026-03-26 09:40',
      },
      {
        id: 'dpn-seed-6',
        kind: 'NORMAL',
        relationLevel: 'ORDER',
        relationTargetNo: 'S-20260320000005',
        supplierName: SUPPLIER_OPTIONS[4],
        feeType: 'ABNORMAL',
        unitPrice: 18000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 18000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'REJECTED',
        reviewComment: '请补充异常处理依据',
        remark: '异常件二次分拨处理',
        createdAt: '2026-03-25 09:10',
        updatedAt: '2026-03-26 09:40',
      },
    ],
  },
  {
    dpnNo: 'DPN-20260320-0010',
    businessLine: 'SEA',
    fromNode: '拉各斯中心仓',
    toNode: '伊巴丹卫星站',
    route: 'LOS中心仓→IBA卫星站',
    dispatchType: '海运末段站点调拨',
    logisticsCompany: 'Nigeria Regional Dispatch Partner',
    driverName: 'Samuel',
    driverPhone: '0803-118-3322',
    plateNo: 'LOS-IBA-06',
    waybillCount: 7,
    pieces: 18,
    totalWeight: 730,
    createdBy: 'NINA',
    createdAt: '2026-03-26 08:10',
    updatedAt: '2026-03-26 11:30',
    items: [
      {
        id: 'dpn-seed-7',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0010',
        supplierName: SUPPLIER_OPTIONS[5],
        feeType: 'TEMP_STORAGE',
        unitPrice: 22000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 22000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '待转运前临时存放',
        createdAt: '2026-03-26 08:10',
        updatedAt: '2026-03-26 11:30',
      },
      {
        id: 'dpn-seed-8',
        kind: 'NORMAL',
        relationLevel: 'SUB_ORDER',
        relationTargetNo: 'S-20260320000007-1',
        supplierName: SUPPLIER_OPTIONS[5],
        feeType: 'TOLL',
        unitPrice: 6500,
        quantity: 2,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 13000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '伊巴丹路线过路费',
        createdAt: '2026-03-26 08:10',
        updatedAt: '2026-03-26 11:30',
      },
    ],
  },
  {
    dpnNo: 'DPN-20260320-0501',
    businessLine: 'AIR',
    fromNode: '拉各斯空港仓',
    toNode: '阿布贾空港站',
    route: 'LOS空港仓→ABV空港站',
    dispatchType: '空运到港后站点转运',
    logisticsCompany: 'Abuja Transfer Fleet',
    driverName: 'Femi',
    driverPhone: '0803-442-8099',
    plateNo: 'AIR-ABV-01',
    waybillCount: 6,
    pieces: 14,
    totalWeight: 210,
    createdBy: 'RITA',
    createdAt: '2026-03-23 10:20',
    updatedAt: '2026-03-23 17:20',
    supervisor: '主管-王安',
    reviewedAt: '2026-03-23 17:20',
    supervisorRemark: '空港转运费用已审核。',
    items: [
      {
        id: 'dpn-seed-9',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0501',
        supplierName: SUPPLIER_OPTIONS[2],
        feeType: 'TRANSFER',
        unitPrice: 42000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 42000,
        paymentStatus: 'PAID',
        reviewStatus: 'APPROVED',
        remark: '空港站点转运',
        createdAt: '2026-03-23 10:20',
        updatedAt: '2026-03-23 17:20',
      },
      {
        id: 'dpn-seed-10',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'A-JOB26030001',
        supplierName: SUPPLIER_OPTIONS[2],
        feeType: 'DRIVER_ALLOWANCE',
        unitPrice: 6000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 6000,
        paymentStatus: 'PAID',
        reviewStatus: 'APPROVED',
        remark: '司机补贴',
        createdAt: '2026-03-23 10:20',
        updatedAt: '2026-03-23 17:20',
      },
    ],
  },
  {
    dpnNo: 'DPN-20260320-0504',
    businessLine: 'AIR',
    fromNode: '阿布贾空港站',
    toNode: '卡诺空港站',
    route: 'ABV空港站→KAN空港站',
    dispatchType: '空运跨站点派车',
    logisticsCompany: 'Kano Inland Transit Service',
    driverName: 'Sani',
    driverPhone: '0803-776-1208',
    plateNo: 'AIR-KAN-02',
    waybillCount: 4,
    pieces: 10,
    totalWeight: 146,
    createdBy: 'MAY',
    createdAt: '2026-03-24 09:50',
    updatedAt: '2026-03-24 18:10',
    items: [
      {
        id: 'dpn-seed-11',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0504',
        supplierName: SUPPLIER_OPTIONS[3],
        feeType: 'DISPATCH',
        unitPrice: 24000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 24000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '跨站点派车',
        createdAt: '2026-03-24 09:50',
        updatedAt: '2026-03-24 18:10',
      },
      {
        id: 'dpn-seed-12',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0504',
        supplierName: SUPPLIER_OPTIONS[3],
        feeType: 'FUEL',
        unitPrice: 8200,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 8200,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '站点间油费',
        createdAt: '2026-03-24 09:50',
        updatedAt: '2026-03-24 18:10',
      },
    ],
  },
  {
    dpnNo: 'DPN-20260320-0507',
    businessLine: 'AIR',
    fromNode: '拉各斯空港仓',
    toNode: '奥尼查卫星站',
    route: 'LOS空港仓→ONI卫星站',
    dispatchType: '空运末端站点调拨',
    logisticsCompany: 'Nigeria Regional Dispatch Partner',
    driverName: 'Daniel',
    driverPhone: '0803-219-0043',
    plateNo: 'AIR-ONI-09',
    waybillCount: 5,
    pieces: 11,
    totalWeight: 132,
    createdBy: 'LUNA',
    createdAt: '2026-03-25 08:40',
    updatedAt: '2026-03-25 16:00',
    supervisor: '主管-王安',
    reviewedAt: '2026-03-25 16:00',
    supervisorRemark: '主转运费用通过，仓租费说明不足。',
    items: [
      {
        id: 'dpn-seed-13',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0507',
        supplierName: SUPPLIER_OPTIONS[5],
        feeType: 'LINE_HAUL',
        unitPrice: 21000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 21000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'APPROVED',
        remark: '站点干线调拨',
        createdAt: '2026-03-25 08:40',
        updatedAt: '2026-03-25 16:00',
      },
      {
        id: 'dpn-seed-14',
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: 'DPN-20260320-0507',
        supplierName: SUPPLIER_OPTIONS[5],
        feeType: 'TEMP_STORAGE',
        unitPrice: 9000,
        quantity: 1,
        currency: 'NGN',
        exchangeRate: 0.0055,
        amount: 9000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'REJECTED',
        reviewComment: '请补充仓租天数',
        remark: '空港仓临时存放',
        createdAt: '2026-03-25 08:40',
        updatedAt: '2026-03-25 16:00',
      },
    ],
  },
];

const loadStoredRecords = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedRecords();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as DpnCostRecord[]) : createSeedRecords();
  } catch {
    return createSeedRecords();
  }
};

export const DPNCost: React.FC<{ businessMode?: BusinessMode }> = ({ businessMode = 'ALL' }) => {
  const [records, setRecords] = useState<DpnCostRecord[]>(() => loadStoredRecords());
  const [detailDpnNo, setDetailDpnNo] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [editorDpnNo, setEditorDpnNo] = useState('');
  const [editorRows, setEditorRows] = useState<CostItem[]>([]);
  const [reviewDpnNo, setReviewDpnNo] = useState('');
  const [reviewRows, setReviewRows] = useState<ReviewDraftRow[]>([]);
  const [reviewRemark, setReviewRemark] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const visibleTasks = useMemo(
    () => MOCK_DPN_TASKS.filter((task) => matchDpnNoByBusinessMode(task.dpnNo, businessMode)),
    [businessMode],
  );

  const visibleRecords = useMemo(
    () => records.filter((record) => matchDpnNoByBusinessMode(record.dpnNo, businessMode)),
    [records, businessMode],
  );

  const recordsByDpnNo = useMemo(
    () => Object.fromEntries(visibleRecords.map((record) => [record.dpnNo, record])),
    [visibleRecords],
  );

  const filteredRecords = useMemo(() => {
    let result = [...visibleRecords];
    if (filterKeyword.trim()) {
      const keyword = filterKeyword.trim().toLowerCase();
      result = result.filter((record) =>
        [
          record.dpnNo,
          record.route,
          record.fromNode,
          record.toNode,
          record.logisticsCompany,
          ...getTaskByDpnNo(record.dpnNo)?.jobNos || [],
          ...getTaskByDpnNo(record.dpnNo)?.orderNos || [],
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

  const detailRecord = detailDpnNo ? recordsByDpnNo[detailDpnNo] : undefined;
  const detailTask = detailDpnNo ? getTaskByDpnNo(detailDpnNo) : undefined;
  const editorTask = editorDpnNo ? getTaskByDpnNo(editorDpnNo) : undefined;
  const reviewRecord = reviewDpnNo ? recordsByDpnNo[reviewDpnNo] : undefined;

  const editorAmount = useMemo(
    () => editorRows.filter((row) => shouldCountItem(editorRows, row)).reduce((sum, row) => sum + row.amount, 0),
    [editorRows],
  );

  const openEditor = (dpnNo?: string) => {
    const nextDpnNo = dpnNo || visibleTasks[0]?.dpnNo || '';
    const existed = nextDpnNo ? recordsByDpnNo[nextDpnNo] : undefined;
    setEditorDpnNo(nextDpnNo);
    setEditorRows(existed ? cloneItems(existed.items) : []);
    setEditorVisible(true);
  };

  const handleEditorDpnChange = (dpnNo: string) => {
    const existed = recordsByDpnNo[dpnNo];
    setEditorDpnNo(dpnNo);
    setEditorRows(existed ? cloneItems(existed.items) : []);
    if (existed) {
      message.info('当前 DPN 已有成本记录，本次录入会在原 DPN 下继续追加条目。');
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
    if (!editorDpnNo) {
      message.warning('请先选择 DPN 号');
      return;
    }
    const task = getTaskByDpnNo(editorDpnNo);
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    setEditorRows((prev) => [
      ...prev,
      {
        id: createId('dpn-cost-item'),
        kind: 'NORMAL',
        relationLevel: 'DPN',
        relationTargetNo: task?.dpnNo || '',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'TRANSFER',
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
        id: createId('dpn-cost-change'),
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
    if (!editorDpnNo) {
      message.error('请选择 DPN 号');
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
    const task = getTaskByDpnNo(editorDpnNo);
    if (!task) {
      message.error('未找到对应 DPN');
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
      const existed = prev.find((record) => record.dpnNo === editorDpnNo);
      const nextRecord: DpnCostRecord = {
        dpnNo: task.dpnNo,
        businessLine: task.businessLine,
        fromNode: task.fromNode,
        toNode: task.toNode,
        route: task.route,
        dispatchType: task.dispatchType,
        logisticsCompany: task.logisticsCompany,
        driverName: task.driverName,
        driverPhone: task.driverPhone,
        plateNo: task.plateNo,
        waybillCount: task.waybillCount,
        pieces: task.pieces,
        totalWeight: task.totalWeight,
        createdBy: existed?.createdBy || currentUser,
        createdAt: existed?.createdAt || now,
        updatedAt: now,
        supervisor: existed?.supervisor,
        reviewedAt: existed?.reviewedAt,
        supervisorRemark: existed?.supervisorRemark,
        items: nextItems,
      };
      if (existed) {
        return prev.map((record) => (record.dpnNo === editorDpnNo ? nextRecord : record));
      }
      return [nextRecord, ...prev];
    });

    message.success(submitForReview ? '已提交主管审核' : '已保存为草稿');
    setEditorVisible(false);
    setEditorDpnNo('');
    setEditorRows([]);
  };

  const openReview = (record: DpnCostRecord) => {
    const pendingRows = record.items.filter((item) => item.reviewStatus === 'PENDING');
    if (!pendingRows.length) {
      message.warning('当前没有待审核条目');
      return;
    }
    setReviewDpnNo(record.dpnNo);
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
        if (record.dpnNo !== reviewRecord.dpnNo) return record;
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
    setReviewDpnNo('');
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
      title: 'DPN号',
      dataIndex: 'dpnNo',
      key: 'dpnNo',
      width: 160,
      fixed: 'left' as const,
      render: (value: string, record: DpnCostRecord) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => {
            setDetailDpnNo(record.dpnNo);
            setDetailVisible(true);
          }}
        >
          {value}
        </Button>
      ),
    },
    {
      title: '业务线',
      dataIndex: 'businessLine',
      key: 'businessLine',
      width: 90,
      render: (value: 'SEA' | 'AIR') => <Tag color={value === 'SEA' ? 'blue' : 'purple'}>{value === 'SEA' ? '海运' : '空运'}</Tag>,
    },
    { title: '起始站点/仓', dataIndex: 'fromNode', key: 'fromNode', width: 150 },
    { title: '目的站点', dataIndex: 'toNode', key: 'toNode', width: 140 },
    { title: '线路', dataIndex: 'route', key: 'route', width: 190 },
    { title: '调拨类型', dataIndex: 'dispatchType', key: 'dispatchType', width: 160 },
    {
      title: 'JOB',
      key: 'jobs',
      width: 180,
      render: (_: unknown, record: DpnCostRecord) => {
        const task = getTaskByDpnNo(record.dpnNo);
        return task?.jobNos.length ? (
          <Space size={[4, 4]} wrap>
            {task.jobNos.slice(0, 4).map((jobNo) => (
              <Tag key={jobNo}>{jobNo}</Tag>
            ))}
          </Space>
        ) : '-';
      },
    },
    {
      title: '订单号',
      key: 'orders',
      width: 220,
      render: (_: unknown, record: DpnCostRecord) => {
        const task = getTaskByDpnNo(record.dpnNo);
        return task?.orderNos.length ? (
          <Space size={[4, 4]} wrap>
            {task.orderNos.slice(0, 3).map((orderNo) => (
              <Tag key={orderNo}>{orderNo}</Tag>
            ))}
          </Space>
        ) : '-';
      },
    },
    {
      title: '运单/件重',
      key: 'summary',
      width: 150,
      render: (_: unknown, record: DpnCostRecord) =>
        `${record.waybillCount}单 / ${record.pieces}件 / ${record.totalWeight.toFixed(1)}kg`,
    },
    { title: '费用条目', key: 'itemCount', width: 90, render: (_: unknown, record: DpnCostRecord) => record.items.length },
    {
      title: '应付合计',
      key: 'summaryAmount',
      width: 130,
      align: 'right' as const,
      render: (_: unknown, record: DpnCostRecord) =>
        getSummaryAmount(record.items).toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    {
      title: '支付状态',
      key: 'paymentStatus',
      width: 100,
      render: (_: unknown, record: DpnCostRecord) => {
        const status = getSummaryPaymentStatus(record.items);
        return <Tag color={PAYMENT_STATUS_CONFIG[status].color}>{PAYMENT_STATUS_CONFIG[status].text}</Tag>;
      },
    },
    {
      title: '审核状态',
      key: 'taskStatus',
      width: 110,
      render: (_: unknown, record: DpnCostRecord) => {
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
      render: (_: unknown, record: DpnCostRecord) => {
        const status = deriveTaskStatus(record.items);
        return (
          <Space size={4} wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setDetailDpnNo(record.dpnNo);
                setDetailVisible(true);
              }}
            >
              详情
            </Button>
            {status !== 'PENDING_SUPERVISOR' && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditor(record.dpnNo)}>
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
      width: 170,
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
      width: 140,
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
        const rate = row.exchangeRate || 0.0055;
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
      width: 220,
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
    { title: '归属对象', dataIndex: 'relationTargetNo', key: 'relationTargetNo', width: 160 },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 220 },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 140,
      render: (value: string) => FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 100, render: (value: number) => value.toFixed(2) },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 90 },
    { title: '小计', dataIndex: 'amount', key: 'amount', width: 110, render: (value: number) => value.toFixed(2) },
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
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 200 },
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
    { title: '归属对象', dataIndex: 'relationTargetNo', key: 'relationTargetNo', width: 150 },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 220 },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 140,
      render: (value: string) => FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    {
      title: '原数据',
      key: 'origin',
      width: 280,
      render: (_: unknown, row: CostItem) =>
        row.originalSnapshot
          ? `${row.originalSnapshot.supplierName} / ${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity} = ${row.originalSnapshot.amount.toFixed(2)}`
          : '-',
    },
    {
      title: '申请数据',
      key: 'next',
      width: 280,
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
        message="演示规则：列表按 DPN 调拨单展示；后续录入直接在原 DPN 下追加费用条目；已审核条目不可直接改值，修改会生成保留原数据的待审核变更行。"
      />

      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">DPN记录 {stats.total}</Tag>
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
                placeholder="输入DPN号/JOB/订单号/站点"
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
              <RangePicker value={filterDateRange} onChange={(dates) => setFilterDateRange(dates as [Dayjs, Dayjs] | null)} />
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
        rowKey="dpnNo"
        columns={listColumns}
        dataSource={filteredRecords}
        scroll={{ x: 2320, y: 'calc(100vh - 430px)' }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        size="small"
      />

      <Drawer
        title="DPN 成本录入"
        placement="right"
        open={editorVisible}
        onClose={() => {
          setEditorVisible(false);
          setEditorDpnNo('');
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
                setEditorDpnNo('');
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
          <Descriptions.Item label="DPN号" span={2}>
            <Select
              value={editorDpnNo || undefined}
              placeholder="请选择 DPN 号"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
              onChange={handleEditorDpnChange}
            >
              {visibleTasks.map((task) => (
                <Select.Option key={task.dpnNo} value={task.dpnNo}>
                  {task.dpnNo} / {task.fromNode} → {task.toNode}
                </Select.Option>
              ))}
            </Select>
          </Descriptions.Item>
          <Descriptions.Item label="业务线">{editorTask?.businessLine === 'SEA' ? '海运' : editorTask?.businessLine === 'AIR' ? '空运' : '-'}</Descriptions.Item>
          <Descriptions.Item label="调拨类型">{editorTask?.dispatchType || '-'}</Descriptions.Item>
          <Descriptions.Item label="起始站点/仓">{editorTask?.fromNode || '-'}</Descriptions.Item>
          <Descriptions.Item label="目的站点">{editorTask?.toNode || '-'}</Descriptions.Item>
          <Descriptions.Item label="线路">{editorTask?.route || '-'}</Descriptions.Item>
          <Descriptions.Item label="物流公司">{editorTask?.logisticsCompany || '-'}</Descriptions.Item>
          <Descriptions.Item label="司机">{editorTask?.driverName || '-'}</Descriptions.Item>
          <Descriptions.Item label="司机电话">{editorTask?.driverPhone || '-'}</Descriptions.Item>
          <Descriptions.Item label="车牌">{editorTask?.plateNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="调拨日期">{formatDateTime(editorTask?.dispatchAt)}</Descriptions.Item>
          <Descriptions.Item label="入库时间">{formatDateTime(editorTask?.inboundAt)}</Descriptions.Item>
          <Descriptions.Item label="运单数量">{editorTask?.waybillCount || '-'}</Descriptions.Item>
          <Descriptions.Item label="件数">{editorTask?.pieces || '-'}</Descriptions.Item>
          <Descriptions.Item label="总重量">{editorTask ? `${editorTask.totalWeight.toFixed(1)} kg` : '-'}</Descriptions.Item>
          <Descriptions.Item label="应付合计" span={4}>
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
            scroll={{ x: 2200 }}
          />
        </Card>
      </Drawer>

      <Drawer
        title={detailRecord ? `DPN 成本详情 - ${detailRecord.dpnNo}` : 'DPN 成本详情'}
        placement="right"
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setDetailDpnNo('');
        }}
        width="94vw"
        destroyOnHidden
        styles={{ body: { padding: 16 } }}
        extra={detailRecord ? (
          <Space>
            <Button
              onClick={() => {
                setDetailVisible(false);
                setDetailDpnNo('');
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
                  setDetailDpnNo('');
                  openEditor(detailRecord.dpnNo);
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
              <Descriptions.Item label="DPN号">{detailRecord.dpnNo}</Descriptions.Item>
              <Descriptions.Item label="业务线">{detailRecord.businessLine === 'SEA' ? '海运' : '空运'}</Descriptions.Item>
              <Descriptions.Item label="调拨类型">{detailRecord.dispatchType}</Descriptions.Item>
              <Descriptions.Item label="线路">{detailRecord.route}</Descriptions.Item>
              <Descriptions.Item label="起始站点/仓">{detailRecord.fromNode}</Descriptions.Item>
              <Descriptions.Item label="目的站点">{detailRecord.toNode}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{TASK_STATUS_CONFIG[deriveTaskStatus(detailRecord.items)].text}</Descriptions.Item>
              <Descriptions.Item label="支付状态">{PAYMENT_STATUS_CONFIG[getSummaryPaymentStatus(detailRecord.items)].text}</Descriptions.Item>
              <Descriptions.Item label="调拨日期">{formatDateTime(detailTask?.dispatchAt)}</Descriptions.Item>
              <Descriptions.Item label="执行完成">{formatDateTime(detailTask?.executedAt)}</Descriptions.Item>
              <Descriptions.Item label="站点入库">{formatDateTime(detailTask?.inboundAt)}</Descriptions.Item>
              <Descriptions.Item label="物流公司">{detailRecord.logisticsCompany}</Descriptions.Item>
              <Descriptions.Item label="司机">{detailRecord.driverName}</Descriptions.Item>
              <Descriptions.Item label="司机电话">{detailRecord.driverPhone}</Descriptions.Item>
              <Descriptions.Item label="车牌">{detailRecord.plateNo}</Descriptions.Item>
              <Descriptions.Item label="运单数量">{detailRecord.waybillCount}</Descriptions.Item>
              <Descriptions.Item label="件数">{detailRecord.pieces}</Descriptions.Item>
              <Descriptions.Item label="总重量">{detailRecord.totalWeight.toFixed(1)} kg</Descriptions.Item>
              <Descriptions.Item label="创建人">{detailRecord.createdBy}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(detailRecord.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="主管审核" span={2}>
                {detailRecord.supervisor || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="审核时间" span={2}>
                {formatDateTime(detailRecord.reviewedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="关联JOB" span={4}>
                {(detailTask?.jobNos || []).join(' / ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联订单" span={4}>
                {(detailTask?.orderNos || []).join(' / ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="调拨备注" span={4}>
                {detailTask?.remark || '暂无'}
              </Descriptions.Item>
              <Descriptions.Item label="主管意见" span={4}>
                {detailRecord.supervisorRemark || '暂无'}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="费用条目详情">
              {(() => {
                const currencySymbol: Record<string, string> = { USD: '$', CNY: '¥', NGN: '₦', EUR: '€' };
                const grouped: Record<string, CostItem[]> = {};
                (detailRecord.items || []).forEach((item: CostItem) => {
                  const cur = item.currency || 'NGN';
                  if (!grouped[cur]) grouped[cur] = [];
                  grouped[cur].push(item);
                });
                if (Object.keys(grouped).length === 0) grouped['NGN'] = [];
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
                      <Table rowKey="id" columns={detailColumns} dataSource={items} pagination={false} size="small" scroll={{ x: 2140 }} locale={{ emptyText: `暂无 ${currency} 费用` }} />
                    </div>
                  );
                });
              })()}
            </Card>
          </>
        )}
      </Drawer>

      <Drawer
        title={reviewRecord ? `主管审核 - ${reviewRecord.dpnNo}` : '主管审核'}
        placement="right"
        open={reviewVisible}
        onClose={() => {
          setReviewVisible(false);
          setReviewDpnNo('');
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
                setReviewDpnNo('');
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
              <Descriptions.Item label="DPN号">{reviewRecord.dpnNo}</Descriptions.Item>
              <Descriptions.Item label="起始站点/仓">{reviewRecord.fromNode}</Descriptions.Item>
              <Descriptions.Item label="目的站点">{reviewRecord.toNode}</Descriptions.Item>
              <Descriptions.Item label="物流公司">{reviewRecord.logisticsCompany}</Descriptions.Item>
            </Descriptions>

            <Table
              rowKey="id"
              columns={reviewColumns}
              dataSource={reviewRecord.items.filter((item) => item.reviewStatus === 'PENDING')}
              pagination={false}
              size="small"
              scroll={{ x: 2080 }}
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
