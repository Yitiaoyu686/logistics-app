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
  leaveWarehouseAt: string;
  leavePortAt: string;
  arrivePortAt: string;
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

const STORAGE_KEY = 'job-cost-pol-task-demo-v4';

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
  { value: 'UNIT', label: '集装箱号公摊' },
  { value: 'ORDER', label: '订单号' },
  { value: 'SUB_ORDER', label: '子单号' },
];

const FEE_TYPE_OPTIONS = [
  { value: 'BOOKING', label: '订舱费' },
  { value: 'CUSTOMS', label: '报关费' },
  { value: 'TRUCKING', label: '拖车费' },
  { value: 'PICKUP', label: '提货费' },
  { value: 'DELIVERY', label: '送货费' },
  { value: 'PACKING', label: '包装费' },
  { value: 'INSPECTION', label: '商检费' },
  { value: 'OTHER', label: '其他' },
];

const CURRENCY_OPTIONS = [
  { value: 'CNY', label: 'CNY' },
  { value: 'USD', label: 'USD' },
];

const SUPPLIER_OPTIONS = [
  '广州喵喵国际货运代理有限公司深圳分公司',
  '广州喵喵国际货运代理有限公司白云分公司',
  '广东广运拖车服务有限公司',
  '深圳华洋报关有限公司',
];

const MOCK_JOB_TASKS: MockJobTask[] = [
  {
    jobNo: 'S-JOB26030001',
    station: '海珠区站点',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '普快',
    carrier: 'ET',
    blNo: '071-35618004',
    originPort: 'CAN',
    destinationPort: 'LOS',
    pieces: 50,
    blWeight: 2500,
    orderWeight: 2480,
    leaveWarehouseAt: '2026-03-14 10:15',
    leavePortAt: '2026-03-17 19:30',
    arrivePortAt: '2026-03-23 08:00',
    units: ['AK1', 'AK2', 'AK3', 'AK4'],
    orderNos: ['191025000038', '191025000040', '191012000003'],
    subOrderNos: ['191025000038-1', '191025000040-1', '191012000003-2'],
  },
  {
    jobNo: 'S-JOB26030004',
    station: '白云区站点',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '特快',
    carrier: 'ET',
    blNo: '071-35545580',
    originPort: 'CAN',
    destinationPort: 'LOS',
    pieces: 68,
    blWeight: 3600,
    orderWeight: 3525,
    leaveWarehouseAt: '2026-03-15 09:20',
    leavePortAt: '2026-03-18 20:00',
    arrivePortAt: '2026-03-24 09:00',
    units: ['FK1', 'FK2', 'FK3', 'FK4'],
    orderNos: ['191013000009', '190922000006', '190828000021'],
    subOrderNos: ['191013000009-1', '190922000006-2', '190828000021-1'],
  },
  {
    jobNo: 'S-JOB26030007',
    station: '福田区站点',
    route: 'SZX.CHN→LOS.NGN',
    serviceType: '特快',
    carrier: 'EK',
    blNo: '071-35539265',
    originPort: 'SZX',
    destinationPort: 'LOS',
    pieces: 10,
    blWeight: 450,
    orderWeight: 430,
    leaveWarehouseAt: '2026-03-16 08:30',
    leavePortAt: '2026-03-18 18:20',
    arrivePortAt: '2026-03-24 11:10',
    units: ['JK1', 'JK2', 'JK3'],
    orderNos: ['191118000021', '191118000022'],
    subOrderNos: ['191118000021-1', '191118000022-1'],
  },
  {
    jobNo: 'S-JOB26030010',
    station: '香港站点',
    route: 'HKG.CHN→LOS.NGN',
    serviceType: '特快',
    carrier: 'CX',
    blNo: '071-35610222',
    originPort: 'HKG',
    destinationPort: 'LOS',
    pieces: 65,
    blWeight: 3500,
    orderWeight: 3460,
    leaveWarehouseAt: '2026-03-18 14:00',
    leavePortAt: '2026-03-19 20:50',
    arrivePortAt: '2026-03-25 12:30',
    units: ['NK1', 'NK2', 'NK3', 'NK4'],
    orderNos: ['191220000101', '191220000102', '191220000103'],
    subOrderNos: ['191220000101-1', '191220000102-2', '191220000103-1'],
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

const cloneItems = (items: CostItem[]) => items.map((item) => ({
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
    station: '海珠区站点',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '普快',
    carrier: 'ET',
    blNo: '071-35618004',
    originPort: 'CAN',
    destinationPort: 'LOS',
    pieces: 50,
    blWeight: 2500,
    orderWeight: 2480,
    createdBy: 'LUNA',
    createdAt: '2026-03-19 09:30',
    updatedAt: '2026-03-20 15:10',
    supervisor: '仓库主管-陈安',
    reviewedAt: '2026-03-19 17:20',
    supervisorRemark: '现有条目已审核，可继续在原任务下新增费用。',
    items: [
      {
        id: 'seed-1',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030001',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'BOOKING',
        unitPrice: 180,
        quantity: 1,
        currency: 'USD',
        amount: 180,
        paymentStatus: 'PAID',
        reviewStatus: 'APPROVED',
        remark: '订舱基础费用',
        createdAt: '2026-03-19 09:30',
        updatedAt: '2026-03-19 17:20',
      },
      {
        id: 'seed-2',
        kind: 'NORMAL',
        relationLevel: 'ORDER',
        relationTargetNo: '191025000038',
        supplierName: SUPPLIER_OPTIONS[3],
        feeType: 'CUSTOMS',
        unitPrice: 350,
        quantity: 1,
        currency: 'CNY',
        amount: 350,
        paymentStatus: 'PARTIAL',
        reviewStatus: 'APPROVED',
        remark: '报关单证费用',
        createdAt: '2026-03-19 09:30',
        updatedAt: '2026-03-19 17:20',
      },
      {
        id: 'seed-2b',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030001',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'DRAYAGE',
        unitPrice: 85000,
        quantity: 1,
        currency: 'NGN',
        amount: 85000,
        paymentStatus: 'UNPAID',
        reviewStatus: 'APPROVED',
        remark: '拉各斯港拖车费',
        createdAt: '2026-03-19 09:30',
        updatedAt: '2026-03-19 17:20',
      },
    ],
  },
  {
    jobNo: 'S-JOB26030004',
    station: '白云区站点',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '特快',
    carrier: 'ET',
    blNo: '071-35545580',
    originPort: 'CAN',
    destinationPort: 'LOS',
    pieces: 68,
    blWeight: 3600,
    orderWeight: 3525,
    createdBy: 'MAY',
    createdAt: '2026-03-20 10:20',
    updatedAt: '2026-03-20 16:00',
    items: [
      {
        id: 'seed-3',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030004',
        supplierName: SUPPLIER_OPTIONS[1],
        feeType: 'BOOKING',
        unitPrice: 1800,
        quantity: 1,
        currency: 'CNY',
        amount: 1800,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '航司舱位锁仓',
        createdAt: '2026-03-20 10:20',
        updatedAt: '2026-03-20 16:00',
      },
      {
        id: 'seed-4',
        kind: 'NORMAL',
        relationLevel: 'SUB_ORDER',
        relationTargetNo: '191013000009-1',
        supplierName: SUPPLIER_OPTIONS[3],
        feeType: 'INSPECTION',
        unitPrice: 200,
        quantity: 2,
        currency: 'CNY',
        amount: 400,
        paymentStatus: 'UNPAID',
        reviewStatus: 'PENDING',
        remark: '抽检处理',
        createdAt: '2026-03-20 10:20',
        updatedAt: '2026-03-20 16:00',
      },
    ],
  },
  {
    jobNo: 'S-JOB26030007',
    station: '福田区站点',
    route: 'SZX.CHN→LOS.NGN',
    serviceType: '特快',
    carrier: 'EK',
    blNo: '071-35539265',
    originPort: 'SZX',
    destinationPort: 'LOS',
    pieces: 10,
    blWeight: 450,
    orderWeight: 430,
    createdBy: 'NINA',
    createdAt: '2026-03-20 09:15',
    updatedAt: '2026-03-21 09:40',
    supervisor: '仓库主管-陈安',
    reviewedAt: '2026-03-20 18:40',
    supervisorRemark: '拖车费通过，包装费补充供应商依据后可重提。',
    items: [
      {
        id: 'seed-5',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030007',
        supplierName: SUPPLIER_OPTIONS[2],
        feeType: 'TRUCKING',
        unitPrice: 420,
        quantity: 1,
        currency: 'CNY',
        amount: 420,
        paymentStatus: 'UNPAID',
        reviewStatus: 'APPROVED',
        remark: '机场拖车',
        createdAt: '2026-03-20 09:15',
        updatedAt: '2026-03-20 18:40',
      },
      {
        id: 'seed-6',
        kind: 'NORMAL',
        relationLevel: 'ORDER',
        relationTargetNo: '191118000021',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'PACKING',
        unitPrice: 45,
        quantity: 6,
        currency: 'CNY',
        amount: 270,
        paymentStatus: 'UNPAID',
        reviewStatus: 'REJECTED',
        reviewComment: '缺少供应商单据',
        remark: '补打包材料',
        createdAt: '2026-03-20 09:15',
        updatedAt: '2026-03-20 18:40',
      },
    ],
  },
  {
    jobNo: 'S-JOB26030010',
    station: '香港站点',
    route: 'HKG.CHN→LOS.NGN',
    serviceType: '特快',
    carrier: 'CX',
    blNo: '071-35610222',
    originPort: 'HKG',
    destinationPort: 'LOS',
    pieces: 65,
    blWeight: 3500,
    orderWeight: 3460,
    createdBy: 'RITA',
    createdAt: '2026-03-21 09:00',
    updatedAt: '2026-03-21 11:10',
    items: [
      {
        id: 'seed-7',
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: 'S-JOB26030010',
        supplierName: SUPPLIER_OPTIONS[1],
        feeType: 'BOOKING',
        unitPrice: 2200,
        quantity: 1,
        currency: 'CNY',
        amount: 2200,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '待补供应商报价单',
        createdAt: '2026-03-21 09:00',
        updatedAt: '2026-03-21 11:10',
      },
      {
        id: 'seed-8',
        kind: 'NORMAL',
        relationLevel: 'UNIT',
        relationTargetNo: 'NK3',
        supplierName: SUPPLIER_OPTIONS[2],
        feeType: 'TRUCKING',
        unitPrice: 760,
        quantity: 1,
        currency: 'CNY',
        amount: 760,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '港车提柜',
        createdAt: '2026-03-21 09:00',
        updatedAt: '2026-03-21 11:10',
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

export const JobCostInputPOL: React.FC<{ businessMode?: BusinessMode }> = ({ businessMode = 'ALL' }) => {
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
        id: createId('job-cost-item'),
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: task?.jobNo || '',
        supplierName: SUPPLIER_OPTIONS[0],
        feeType: 'BOOKING',
        unitPrice: 0,
        quantity: 1,
        currency: 'CNY',
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
        id: createId('job-cost-change'),
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
    message.success('已生成修改行，提交审核时会保留原数据供审核员对比');
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

    message.success(submitForReview ? '已提交仓库主管审核' : '已保存为草稿');
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
        <Button type="link" style={{ padding: 0 }} onClick={() => { setDetailJobNo(record.jobNo); setDetailVisible(true); }}>
          {value}
        </Button>
      ),
    },
    { title: '站点', dataIndex: 'station', key: 'station', width: 120 },
    { title: '线路', dataIndex: 'route', key: 'route', width: 170 },
    { title: '类型', dataIndex: 'serviceType', key: 'serviceType', width: 80 },
    { title: '承运人', dataIndex: 'carrier', key: 'carrier', width: 90 },
    { title: '提单号', dataIndex: 'blNo', key: 'blNo', width: 130 },
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
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setDetailJobNo(record.jobNo); setDetailVisible(true); }}>
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
      render: (value: RelationLevel, row: CostItem) => (
        isEditableRow(editorRows, row)
          ? (
              <Select
                value={value}
                style={{ width: '100%' }}
                options={RELATION_LEVEL_OPTIONS}
                onChange={(nextValue) => {
                  const nextTarget = getRelationTargetOptions(editorTask, nextValue)[0] || '';
                  updateEditorRow(row.id, { relationLevel: nextValue, relationTargetNo: nextTarget });
                }}
              />
            )
          : RELATION_LEVEL_OPTIONS.find((item) => item.value === value)?.label || value
      ),
    },
    {
      title: '归属对象',
      dataIndex: 'relationTargetNo',
      key: 'relationTargetNo',
      width: 140,
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
      render: (value: string, row: CostItem) => (
        isEditableRow(editorRows, row)
          ? (
              <Select
                value={value}
                showSearch
                optionFilterProp="children"
                style={{ width: '100%' }}
                onChange={(nextValue) => updateEditorRow(row.id, { supplierName: nextValue })}
              >
                {SUPPLIER_OPTIONS.map((item) => (
                  <Select.Option key={item} value={item}>{item}</Select.Option>
                ))}
              </Select>
            )
          : value
      ),
    },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 120,
      render: (value: string, row: CostItem) => (
        isEditableRow(editorRows, row)
          ? (
              <Select
                value={value}
                style={{ width: '100%' }}
                options={FEE_TYPE_OPTIONS}
                onChange={(nextValue) => updateEditorRow(row.id, { feeType: nextValue })}
              />
            )
          : FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value
      ),
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 110,
      render: (value: number, row: CostItem) => (
        isEditableRow(editorRows, row)
          ? <InputNumber min={0} precision={2} value={value} style={{ width: '100%' }} onChange={(nextValue) => updateEditorRow(row.id, { unitPrice: Number(nextValue || 0) })} />
          : value.toFixed(2)
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      render: (value: number, row: CostItem) => (
        isEditableRow(editorRows, row)
          ? <InputNumber min={0} precision={2} value={value} style={{ width: '100%' }} onChange={(nextValue) => updateEditorRow(row.id, { quantity: Number(nextValue || 0) })} />
          : value
      ),
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 90,
      render: (value: string, row: CostItem) => (
        isEditableRow(editorRows, row)
          ? <Select value={value} style={{ width: '100%' }} options={CURRENCY_OPTIONS} onChange={(nextValue) => updateEditorRow(row.id, { currency: nextValue })} />
          : value
      ),
    },
    {
      title: '小计',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
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
      width: 240,
      render: (_: unknown, row: CostItem) => (
        row.originalSnapshot
          ? `${row.originalSnapshot.supplierName} / ${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity}`
          : '-'
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 180,
      render: (value: string, row: CostItem) => (
        isEditableRow(editorRows, row)
          ? <Input value={value} onChange={(event) => updateEditorRow(row.id, { remark: event.target.value })} />
          : value || '-'
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
              <Button type="link" size="small" danger>删除</Button>
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
    { title: '归属对象', dataIndex: 'relationTargetNo', key: 'relationTargetNo', width: 120 },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 220 },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 110,
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
      width: 240,
      render: (_: unknown, row: CostItem) => (
        row.originalSnapshot
          ? `${row.originalSnapshot.supplierName} / ${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity}`
          : '-'
      ),
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
      width: 110,
      render: (value: string) => FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    {
      title: '原数据',
      key: 'origin',
      width: 240,
      render: (_: unknown, row: CostItem) => (
        row.originalSnapshot
          ? `${row.originalSnapshot.supplierName} / ${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity} = ${row.originalSnapshot.amount.toFixed(2)}`
          : '-'
      ),
    },
    {
      title: '申请数据',
      key: 'next',
      width: 240,
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
        title="演示规则：列表只保留任务号一条数据；后续录入在原任务下直接追加费用条目；已审核条目不可直接改值，修改会生成保留原数据的待审核变更行。"
      />

      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">任务记录 {stats.total}</Tag>
        <Tag>草稿 {stats.draft}</Tag>
        <Tag color="orange">待主管审核 {stats.pending}</Tag>
        <Tag color="gold">驳回中 {stats.rejected}</Tag>
        <Tag color="green">已审核 {stats.approved}</Tag>
        <Tag color="processing">应付合计 CNY {stats.totalAmount.toFixed(2)}</Tag>
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
            <Button type="primary" icon={<SearchOutlined />} onClick={() => setFilterKeyword((value) => value.trim())}>查询</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>重置</Button>
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
        scroll={{ x: 1700, y: 'calc(100vh - 430px)' }}
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
            <Button onClick={() => { setEditorVisible(false); setEditorJobNo(''); setEditorRows([]); }}>
              取消
            </Button>
            <Button onClick={() => persistEditor(false)}>
              保存草稿
            </Button>
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
          title="费用条目使用表格式录入。已审核条目为锁定行，只能通过“申请修改”生成待审核变更；新增条目和驳回条目可直接编辑。"
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
          <Descriptions.Item label="应付合计">CNY {editorAmount.toFixed(2)}</Descriptions.Item>
        </Descriptions>

        <Card
          size="small"
          title="费用条目"
          extra={<Button type="dashed" onClick={addEditorRow}>+ 添加行</Button>}
        >
          <Table
            rowKey="id"
            columns={editorColumns}
            dataSource={editorRows}
            pagination={false}
            size="small"
            scroll={{ x: 2100 }}
          />
        </Card>
      </Drawer>

      <Drawer
        title={detailRecord ? `JOB 成本详情 - ${detailRecord.jobNo}` : 'JOB 成本详情'}
        placement="right"
        open={detailVisible}
        onClose={() => { setDetailVisible(false); setDetailJobNo(''); }}
        width="94vw"
        destroyOnHidden
        styles={{ body: { padding: 16 } }}
        extra={detailRecord ? (
          <Space>
            <Button onClick={() => { setDetailVisible(false); setDetailJobNo(''); }}>
              关闭
            </Button>
            {deriveTaskStatus(detailRecord.items) !== 'PENDING_SUPERVISOR' && (
              <Button type="primary" icon={<EditOutlined />} onClick={() => {
                setDetailVisible(false);
                setDetailJobNo('');
                openEditor(detailRecord.jobNo);
              }}>
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
              <Descriptions.Item label="创建人">{detailRecord.createdBy}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(detailRecord.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="主管审核">{detailRecord.supervisor || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{formatDateTime(detailRecord.reviewedAt)}</Descriptions.Item>
              <Descriptions.Item label="主管意见" span={4}>{detailRecord.supervisorRemark || '暂无'}</Descriptions.Item>
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
                      <Table rowKey="id" columns={detailColumns} dataSource={items} pagination={false} size="small" scroll={{ x: 2050 }} locale={{ emptyText: `暂无 ${currency} 费用` }} />
                    </div>
                  );
                });
              })()}
            </Card>
          </>
        )}
      </Drawer>

      <Drawer
        title={reviewRecord ? `仓库主管审核 - ${reviewRecord.jobNo}` : '仓库主管审核'}
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
            <Button onClick={() => {
              setReviewVisible(false);
              setReviewJobNo('');
              setReviewRows([]);
              setReviewRemark('');
            }}>
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
              title="审核员可以直接对比原数据与申请数据。修改类条目只有审核通过后才会替换当前生效内容，原数据会继续保留在详情里。"
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
              scroll={{ x: 1950 }}
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
