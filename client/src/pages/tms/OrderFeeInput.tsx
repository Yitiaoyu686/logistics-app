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
type OrderLevel = 'MASTER' | 'SUB';
type FeeDirection = 'RECEIVABLE' | 'PAYABLE';
type RecordStatus = 'DRAFT' | 'PENDING' | 'PART_REJECTED' | 'REJECTED' | 'APPROVED';
type ItemReviewStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
type ItemKind = 'NORMAL' | 'CHANGE';

interface MockOrderTask {
  orderNo: string;
  masterOrderNo: string;
  orderLevel: OrderLevel;
  clientName: string;
  station: string;
  route: string;
  serviceType: string;
  carrier: string;
  pieces: number;
  chargeWeight: number;
  salesName: string;
}

interface FeeItemSnapshot {
  feeType: string;
  feeDirection: FeeDirection;
  settlementName: string;
  unitPrice: number;
  quantity: number;
  currency: string;
  exchangeRate: number;
  amount: number;
  remark: string;
}

interface FeeItem extends FeeItemSnapshot {
  id: string;
  kind: ItemKind;
  originalItemId?: string;
  originalSnapshot?: FeeItemSnapshot;
  reviewStatus: ItemReviewStatus;
  reviewComment?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderFeeRecord {
  orderNo: string;
  masterOrderNo: string;
  orderLevel: OrderLevel;
  clientName: string;
  station: string;
  route: string;
  serviceType: string;
  carrier: string;
  pieces: number;
  chargeWeight: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  reviewer?: string;
  reviewedAt?: string;
  reviewerRemark?: string;
  items: FeeItem[];
}

interface ReviewDraftRow {
  id: string;
  decision: 'APPROVED' | 'REJECTED';
  comment: string;
}

const STORAGE_KEY = 'order-fee-demo-v20260323';

const RECORD_STATUS_CONFIG: Record<RecordStatus, { text: string; color: string }> = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING: { text: '待审核', color: 'orange' },
  PART_REJECTED: { text: '部分驳回', color: 'gold' },
  REJECTED: { text: '已驳回', color: 'red' },
  APPROVED: { text: '已审核', color: 'green' },
};

const ITEM_STATUS_CONFIG: Record<ItemReviewStatus, { text: string; color: string }> = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING: { text: '待审核', color: 'orange' },
  APPROVED: { text: '已审核', color: 'green' },
  REJECTED: { text: '已驳回', color: 'red' },
};

const ORDER_LEVEL_CONFIG: Record<OrderLevel, { text: string; color: string }> = {
  MASTER: { text: '主单', color: 'blue' },
  SUB: { text: '子单', color: 'geekblue' },
};

const FEE_DIRECTION_CONFIG: Record<FeeDirection, { text: string; color: string }> = {
  RECEIVABLE: { text: '应收', color: 'green' },
  PAYABLE: { text: '应付', color: 'red' },
};

const FEE_TYPE_OPTIONS = [
  { value: 'FREIGHT', label: '运费' },
  { value: 'CUSTOMS', label: '报关费' },
  { value: 'WAREHOUSE', label: '仓租费' },
  { value: 'DELIVERY', label: '派送费' },
  { value: 'INSURANCE', label: '保险费' },
  { value: 'DOC', label: '文件费' },
  { value: 'AGENCY', label: '代理费' },
  { value: 'OTHER', label: '其他' },
];

const CURRENCY_OPTIONS = [
  { value: 'CNY', label: 'CNY' },
  { value: 'USD', label: 'USD' },
  { value: 'NGN', label: 'NGN' },
];

const SETTLEMENT_OPTIONS = [
  '深圳市喵喵国际物流有限公司',
  '广州白云机场货站',
  'Lagos Delivery Service Ltd.',
  'Nigeria Customs Service',
  '客户月结账户',
  '合作代理商 A',
];

const MOCK_ORDER_TASKS: MockOrderTask[] = [
  {
    orderNo: 'S-20260320000001',
    masterOrderNo: 'S-M202603200001',
    orderLevel: 'MASTER',
    clientName: '尼日利亚安达贸易',
    station: '广州站点',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '海运拼箱',
    carrier: 'COSCO',
    pieces: 28,
    chargeWeight: 2350,
    salesName: '陈晓雯',
  },
  {
    orderNo: 'S-20260320000002',
    masterOrderNo: 'S-M202603200002',
    orderLevel: 'SUB',
    clientName: '拉各斯千禧百货',
    station: '佛山站点',
    route: 'NGB.CHN→LOS.NGN',
    serviceType: '海运整柜',
    carrier: 'MSK',
    pieces: 42,
    chargeWeight: 4180,
    salesName: '黄梓锋',
  },
  {
    orderNo: 'S-20260320000003',
    masterOrderNo: 'S-M202603200003',
    orderLevel: 'MASTER',
    clientName: '阿布贾瑞丰电子',
    station: '深圳站点',
    route: 'SZX.CHN→TIN.NGN',
    serviceType: '海运快线',
    carrier: 'CMA',
    pieces: 16,
    chargeWeight: 1460,
    salesName: '李天乐',
  },
  {
    orderNo: 'S-20260320000004',
    masterOrderNo: 'S-M202603200004',
    orderLevel: 'SUB',
    clientName: 'Onitsha Home Center',
    station: '东莞站点',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '海运拼箱',
    carrier: 'EMC',
    pieces: 9,
    chargeWeight: 620,
    salesName: '周慧敏',
  },
  {
    orderNo: 'A-20260320000001',
    masterOrderNo: 'A-M202603200001',
    orderLevel: 'MASTER',
    clientName: 'Kano Fashion Hub',
    station: '广州站点',
    route: 'CAN.CHN→LOS.NGN',
    serviceType: '空运普快',
    carrier: 'ET',
    pieces: 12,
    chargeWeight: 180,
    salesName: '张雅琪',
  },
  {
    orderNo: 'A-20260320000002',
    masterOrderNo: 'A-M202603200002',
    orderLevel: 'SUB',
    clientName: 'Abuja Mobile Tech',
    station: '深圳站点',
    route: 'SZX.CHN→ABV.NGN',
    serviceType: '空运特快',
    carrier: 'EK',
    pieces: 7,
    chargeWeight: 96,
    salesName: '陈泽凯',
  },
  {
    orderNo: 'A-20260320000003',
    masterOrderNo: 'A-M202603200003',
    orderLevel: 'MASTER',
    clientName: 'Lagos Premium Store',
    station: '香港站点',
    route: 'HKG.CHN→LOS.NGN',
    serviceType: '空运特快',
    carrier: 'CX',
    pieces: 15,
    chargeWeight: 245,
    salesName: '欧阳璐',
  },
  {
    orderNo: 'A-20260320000004',
    masterOrderNo: 'A-M202603200004',
    orderLevel: 'SUB',
    clientName: 'Jos Retail Group',
    station: '广州站点',
    route: 'CAN.CHN→KAN.NGN',
    serviceType: '空运普快',
    carrier: 'ET',
    pieces: 5,
    chargeWeight: 58,
    salesName: '宋家诚',
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

const matchOrderNoByBusinessMode = (orderNo: string, businessMode: BusinessMode) => {
  if (!orderNo) return false;
  if (businessMode === 'AIR') return orderNo.startsWith('A-');
  if (businessMode === 'SEA') return orderNo.startsWith('S-');
  return true;
};

const getOrderByNo = (orderNo: string) => MOCK_ORDER_TASKS.find((item) => item.orderNo === orderNo);

const createSnapshot = (row: FeeItem): FeeItemSnapshot => ({
  feeType: row.feeType,
  feeDirection: row.feeDirection,
  settlementName: row.settlementName,
  unitPrice: row.unitPrice,
  quantity: row.quantity,
  currency: row.currency,
  amount: row.amount,
  remark: row.remark,
});

const cloneItems = (items: FeeItem[]) =>
  items.map((item) => ({
    ...item,
    originalSnapshot: item.originalSnapshot ? { ...item.originalSnapshot } : undefined,
  }));

const hasApprovedReplacement = (items: FeeItem[], rowId: string) =>
  items.some((item) => item.originalItemId === rowId && item.reviewStatus === 'APPROVED');

const isHistoricalRow = (items: FeeItem[], row: FeeItem) => row.kind === 'NORMAL' && hasApprovedReplacement(items, row.id);

const isEditableRow = (items: FeeItem[], row: FeeItem) => row.reviewStatus !== 'APPROVED' && !isHistoricalRow(items, row);

const shouldCountItem = (items: FeeItem[], row: FeeItem) => {
  if (row.kind === 'CHANGE') {
    return row.reviewStatus === 'APPROVED';
  }
  if (isHistoricalRow(items, row)) {
    return false;
  }
  return row.reviewStatus !== 'REJECTED';
};

const getRowTypeText = (items: FeeItem[], row: FeeItem) => {
  if (row.kind === 'CHANGE' && row.reviewStatus === 'APPROVED') return '已生效修改';
  if (row.kind === 'CHANGE') return '修改申请';
  if (isHistoricalRow(items, row)) return '历史版本';
  if (row.reviewStatus === 'APPROVED') return '已审核条目';
  return '录入条目';
};

const deriveRecordStatus = (items: FeeItem[]): RecordStatus => {
  if (!items.length) return 'DRAFT';
  if (items.some((item) => item.reviewStatus === 'PENDING')) return 'PENDING';
  if (items.some((item) => item.reviewStatus === 'REJECTED') && items.some((item) => item.reviewStatus === 'APPROVED' || item.reviewStatus === 'DRAFT')) {
    return 'PART_REJECTED';
  }
  if (items.every((item) => item.reviewStatus === 'REJECTED')) return 'REJECTED';
  const countableItems = items.filter((item) => shouldCountItem(items, item));
  if (countableItems.length && countableItems.every((item) => item.reviewStatus === 'APPROVED')) return 'APPROVED';
  return 'DRAFT';
};

const getReceivableTotal = (items: FeeItem[]) =>
  items
    .filter((item) => shouldCountItem(items, item) && item.feeDirection === 'RECEIVABLE')
    .reduce((sum, item) => sum + item.amount, 0);

const getPayableTotal = (items: FeeItem[]) =>
  items
    .filter((item) => shouldCountItem(items, item) && item.feeDirection === 'PAYABLE')
    .reduce((sum, item) => sum + item.amount, 0);

const createFeeItem = (patch: Partial<FeeItem> = {}): FeeItem => {
  const now = dayjs().format('YYYY-MM-DD HH:mm');
  const unitPrice = Number(patch.unitPrice || 0);
  const quantity = Number(patch.quantity || 1);
  return {
    id: patch.id || createId('order-fee-item'),
    kind: patch.kind || 'NORMAL',
    feeType: patch.feeType || 'FREIGHT',
    feeDirection: patch.feeDirection || 'RECEIVABLE',
    settlementName: patch.settlementName || SETTLEMENT_OPTIONS[0],
    unitPrice,
    quantity,
    currency: patch.currency || 'CNY',
    exchangeRate: patch.exchangeRate ?? ((patch.currency || 'CNY') === 'CNY' ? 1 : (patch.currency || 'CNY') === 'USD' ? 7.2 : 0.0055),
    amount: patch.amount ?? calcAmount(unitPrice, quantity),
    remark: patch.remark || '',
    reviewStatus: patch.reviewStatus || 'DRAFT',
    reviewComment: patch.reviewComment,
    originalItemId: patch.originalItemId,
    originalSnapshot: patch.originalSnapshot ? { ...patch.originalSnapshot } : undefined,
    createdAt: patch.createdAt || now,
    updatedAt: patch.updatedAt || now,
  };
};

const createSeedRecords = (): OrderFeeRecord[] => {
  const byNo = (orderNo: string) => {
    const found = getOrderByNo(orderNo);
    if (!found) throw new Error(`Missing mock order ${orderNo}`);
    return found;
  };

  const seaApproved = byNo('S-20260320000001');
  const seaPending = byNo('S-20260320000002');
  const seaPartial = byNo('S-20260320000003');
  const seaDraft = byNo('S-20260320000004');
  const airApproved = byNo('A-20260320000001');
  const airPending = byNo('A-20260320000002');
  const airPartial = byNo('A-20260320000003');
  const airDraft = byNo('A-20260320000004');

  return [
    {
      ...seaApproved,
      createdBy: '王海涛',
      createdAt: '2026-03-20 09:20',
      updatedAt: '2026-03-21 15:30',
      reviewer: '李主管',
      reviewedAt: '2026-03-21 15:30',
      reviewerRemark: '费用依据完整',
      items: [
        createFeeItem({
          id: 'seed-s-1-1',
          feeType: 'FREIGHT',
          feeDirection: 'RECEIVABLE',
          settlementName: seaApproved.clientName,
          unitPrice: 12,
          quantity: 44,
          currency: 'USD',
          exchangeRate: 7.25,
          reviewStatus: 'APPROVED',
          createdAt: '2026-03-20 09:20',
          updatedAt: '2026-03-21 15:30',
        }),
        createFeeItem({
          id: 'seed-s-1-2',
          feeType: 'CUSTOMS',
          feeDirection: 'PAYABLE',
          settlementName: 'Nigeria Customs Service',
          unitPrice: 50,
          quantity: 1,
          currency: 'USD',
          exchangeRate: 7.25,
          reviewStatus: 'APPROVED',
          createdAt: '2026-03-20 09:20',
          updatedAt: '2026-03-21 15:30',
        }),
        createFeeItem({
          id: 'seed-s-1-3',
          feeType: 'WAREHOUSE',
          feeDirection: 'PAYABLE',
          settlementName: '深圳市喵喵国际物流有限公司',
          unitPrice: 30,
          quantity: 4,
          currency: 'CNY',
          exchangeRate: 1,
          reviewStatus: 'APPROVED',
          createdAt: '2026-03-20 09:20',
          updatedAt: '2026-03-21 15:30',
        }),
        createFeeItem({
          id: 'seed-s-1-4',
          feeType: 'DOOR_DELIVERY',
          feeDirection: 'PAYABLE',
          settlementName: 'Lagos Express Logistics',
          unitPrice: 15000,
          quantity: 1,
          currency: 'NGN',
          exchangeRate: 0.00061,
          reviewStatus: 'APPROVED',
          createdAt: '2026-03-20 09:20',
          updatedAt: '2026-03-21 15:30',
        }),
      ],
    },
    {
      ...seaPending,
      createdBy: '陈景鸿',
      createdAt: '2026-03-21 10:10',
      updatedAt: '2026-03-22 09:05',
      items: [
        createFeeItem({
          id: 'seed-s-2-1',
          feeType: 'CUSTOMS',
          feeDirection: 'PAYABLE',
          settlementName: 'Nigeria Customs Service',
          unitPrice: 1,
          quantity: 2600,
          currency: 'CNY',
          reviewStatus: 'PENDING',
          createdAt: '2026-03-21 10:10',
          updatedAt: '2026-03-22 09:05',
        }),
        createFeeItem({
          id: 'seed-s-2-2',
          feeType: 'WAREHOUSE',
          feeDirection: 'PAYABLE',
          settlementName: '深圳市喵喵国际物流有限公司',
          unitPrice: 12,
          quantity: 35,
          currency: 'CNY',
          reviewStatus: 'PENDING',
          createdAt: '2026-03-21 10:10',
          updatedAt: '2026-03-22 09:05',
        }),
      ],
    },
    {
      ...seaPartial,
      createdBy: '张慧',
      createdAt: '2026-03-20 13:40',
      updatedAt: '2026-03-22 16:20',
      reviewer: '李主管',
      reviewedAt: '2026-03-22 16:20',
      reviewerRemark: '报关费金额依据不足，请补充',
      items: [
        createFeeItem({
          id: 'seed-s-3-1',
          feeType: 'FREIGHT',
          feeDirection: 'RECEIVABLE',
          settlementName: seaPartial.clientName,
          unitPrice: 20,
          quantity: 60,
          currency: 'CNY',
          reviewStatus: 'APPROVED',
          createdAt: '2026-03-20 13:40',
          updatedAt: '2026-03-22 16:20',
        }),
        createFeeItem({
          id: 'seed-s-3-2',
          feeType: 'CUSTOMS',
          feeDirection: 'PAYABLE',
          settlementName: 'Nigeria Customs Service',
          unitPrice: 1,
          quantity: 1800,
          currency: 'CNY',
          reviewStatus: 'REJECTED',
          reviewComment: '请补充票据',
          createdAt: '2026-03-20 13:40',
          updatedAt: '2026-03-22 16:20',
        }),
      ],
    },
    {
      ...seaDraft,
      createdBy: '卢文杰',
      createdAt: '2026-03-22 11:05',
      updatedAt: '2026-03-22 11:05',
      items: [
        createFeeItem({
          id: 'seed-s-4-1',
          feeType: 'DOC',
          feeDirection: 'RECEIVABLE',
          settlementName: seaDraft.clientName,
          unitPrice: 1,
          quantity: 200,
          currency: 'CNY',
          reviewStatus: 'DRAFT',
          createdAt: '2026-03-22 11:05',
          updatedAt: '2026-03-22 11:05',
        }),
      ],
    },
    {
      ...airApproved,
      createdBy: '赵嘉明',
      createdAt: '2026-03-20 08:25',
      updatedAt: '2026-03-21 14:10',
      reviewer: '李主管',
      reviewedAt: '2026-03-21 14:10',
      reviewerRemark: '已审核通过',
      items: [
        createFeeItem({
          id: 'seed-a-1-1',
          feeType: 'FREIGHT',
          feeDirection: 'RECEIVABLE',
          settlementName: airApproved.clientName,
          unitPrice: 32,
          quantity: 25,
          currency: 'USD',
          reviewStatus: 'APPROVED',
          createdAt: '2026-03-20 08:25',
          updatedAt: '2026-03-21 14:10',
        }),
        createFeeItem({
          id: 'seed-a-1-2',
          feeType: 'INSURANCE',
          feeDirection: 'RECEIVABLE',
          settlementName: airApproved.clientName,
          unitPrice: 1,
          quantity: 120,
          currency: 'USD',
          reviewStatus: 'APPROVED',
          createdAt: '2026-03-20 08:25',
          updatedAt: '2026-03-21 14:10',
        }),
      ],
    },
    {
      ...airPending,
      createdBy: '罗俊伟',
      createdAt: '2026-03-21 09:45',
      updatedAt: '2026-03-22 10:00',
      items: [
        createFeeItem({
          id: 'seed-a-2-1',
          feeType: 'DELIVERY',
          feeDirection: 'PAYABLE',
          settlementName: 'Lagos Delivery Service Ltd.',
          unitPrice: 1,
          quantity: 320,
          currency: 'USD',
          reviewStatus: 'PENDING',
          createdAt: '2026-03-21 09:45',
          updatedAt: '2026-03-22 10:00',
        }),
      ],
    },
    {
      ...airPartial,
      createdBy: '廖冰清',
      createdAt: '2026-03-20 17:20',
      updatedAt: '2026-03-22 18:30',
      reviewer: '李主管',
      reviewedAt: '2026-03-22 18:30',
      reviewerRemark: '代理费通过，其余重提',
      items: [
        createFeeItem({
          id: 'seed-a-3-1',
          feeType: 'AGENCY',
          feeDirection: 'PAYABLE',
          settlementName: '合作代理商 A',
          unitPrice: 1,
          quantity: 150,
          currency: 'USD',
          reviewStatus: 'APPROVED',
          createdAt: '2026-03-20 17:20',
          updatedAt: '2026-03-22 18:30',
        }),
        createFeeItem({
          id: 'seed-a-3-2',
          feeType: 'WAREHOUSE',
          feeDirection: 'PAYABLE',
          settlementName: '广州白云机场货站',
          unitPrice: 1,
          quantity: 90,
          currency: 'USD',
          reviewStatus: 'REJECTED',
          reviewComment: '仓租计费周期不清晰',
          createdAt: '2026-03-20 17:20',
          updatedAt: '2026-03-22 18:30',
        }),
      ],
    },
    {
      ...airDraft,
      createdBy: '何静宜',
      createdAt: '2026-03-22 12:15',
      updatedAt: '2026-03-22 12:15',
      items: [
        createFeeItem({
          id: 'seed-a-4-1',
          feeType: 'DOC',
          feeDirection: 'RECEIVABLE',
          settlementName: airDraft.clientName,
          unitPrice: 1,
          quantity: 45,
          currency: 'USD',
          reviewStatus: 'DRAFT',
          createdAt: '2026-03-22 12:15',
          updatedAt: '2026-03-22 12:15',
        }),
      ],
    },
  ];
};

const loadStoredRecords = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedRecords();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return createSeedRecords();
    return parsed as OrderFeeRecord[];
  } catch {
    return createSeedRecords();
  }
};

export const OrderFeeInput: React.FC<{ businessMode?: BusinessMode }> = ({ businessMode = 'ALL' }) => {
  const [records, setRecords] = useState<OrderFeeRecord[]>(() => loadStoredRecords());
  const [detailOrderNo, setDetailOrderNo] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [editorOrderNo, setEditorOrderNo] = useState('');
  const [editorRows, setEditorRows] = useState<FeeItem[]>([]);
  const [reviewOrderNo, setReviewOrderNo] = useState('');
  const [reviewRows, setReviewRows] = useState<ReviewDraftRow[]>([]);
  const [reviewRemark, setReviewRemark] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const visibleOrders = useMemo(
    () => MOCK_ORDER_TASKS.filter((item) => matchOrderNoByBusinessMode(item.orderNo, businessMode)),
    [businessMode],
  );

  const visibleRecords = useMemo(
    () =>
      records
        .filter((record) => matchOrderNoByBusinessMode(record.orderNo, businessMode))
        .filter((record) => record.items.length > 0),
    [records, businessMode],
  );

  const recordsByOrderNo = useMemo(
    () => Object.fromEntries(visibleRecords.map((record) => [record.orderNo, record])),
    [visibleRecords],
  );

  const filteredRecords = useMemo(() => {
    let result = [...visibleRecords];
    if (filterKeyword.trim()) {
      const keyword = filterKeyword.trim().toLowerCase();
      result = result.filter((record) =>
        [
          record.orderNo,
          record.masterOrderNo,
          record.clientName,
          record.carrier,
          record.route,
          record.station,
        ].some((value) => String(value || '').toLowerCase().includes(keyword)),
      );
    }
    if (filterStatus) {
      result = result.filter((record) => deriveRecordStatus(record.items) === filterStatus);
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
    const receivableTotal = visibleRecords.reduce((sum, record) => sum + getReceivableTotal(record.items), 0);
    const payableTotal = visibleRecords.reduce((sum, record) => sum + getPayableTotal(record.items), 0);
    return {
      total: visibleRecords.length,
      draft: visibleRecords.filter((record) => deriveRecordStatus(record.items) === 'DRAFT').length,
      pending: visibleRecords.filter((record) => deriveRecordStatus(record.items) === 'PENDING').length,
      rejected: visibleRecords.filter((record) => {
        const status = deriveRecordStatus(record.items);
        return status === 'PART_REJECTED' || status === 'REJECTED';
      }).length,
      approved: visibleRecords.filter((record) => deriveRecordStatus(record.items) === 'APPROVED').length,
      receivableTotal,
      payableTotal,
    };
  }, [visibleRecords]);

  const detailRecord = detailOrderNo ? recordsByOrderNo[detailOrderNo] : undefined;
  const detailOrder = detailOrderNo ? getOrderByNo(detailOrderNo) : undefined;
  const editorOrder = editorOrderNo ? getOrderByNo(editorOrderNo) : undefined;
  const reviewRecord = reviewOrderNo ? recordsByOrderNo[reviewOrderNo] : undefined;

  const editorReceivableTotal = useMemo(
    () => editorRows.filter((row) => shouldCountItem(editorRows, row) && row.feeDirection === 'RECEIVABLE').reduce((sum, row) => sum + row.amount, 0),
    [editorRows],
  );

  const editorPayableTotal = useMemo(
    () => editorRows.filter((row) => shouldCountItem(editorRows, row) && row.feeDirection === 'PAYABLE').reduce((sum, row) => sum + row.amount, 0),
    [editorRows],
  );

  const openEditor = (orderNo?: string) => {
    const nextOrderNo = orderNo || visibleOrders[0]?.orderNo || '';
    const existed = nextOrderNo ? recordsByOrderNo[nextOrderNo] : undefined;
    setEditorOrderNo(nextOrderNo);
    setEditorRows(existed ? cloneItems(existed.items) : []);
    setEditorVisible(true);
  };

  const handleEditorOrderChange = (orderNo: string) => {
    const existed = recordsByOrderNo[orderNo];
    setEditorOrderNo(orderNo);
    setEditorRows(existed ? cloneItems(existed.items) : []);
    if (existed) {
      message.info('当前订单已有费用记录，本次录入会在原订单下继续追加条目。');
    }
  };

  const updateEditorRow = (rowId: string, patch: Partial<FeeItem>) => {
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
    if (!editorOrderNo) {
      message.warning('请先选择订单号');
      return;
    }
    const order = getOrderByNo(editorOrderNo);
    setEditorRows((prev) => [
      ...prev,
      createFeeItem({
        feeType: 'FREIGHT',
        feeDirection: 'RECEIVABLE',
        settlementName: order?.clientName || SETTLEMENT_OPTIONS[0],
      }),
    ]);
  };

  const requestModifyApprovedRow = (row: FeeItem) => {
    if (editorRows.some((item) => item.originalItemId === row.id && item.reviewStatus !== 'REJECTED')) {
      message.warning('该已审核条目已有待处理的修改申请');
      return;
    }
    const snapshot = createSnapshot(row);
    setEditorRows((prev) => [
      ...prev,
      createFeeItem({
        kind: 'CHANGE',
        originalItemId: row.id,
        originalSnapshot: snapshot,
        feeType: row.feeType,
        feeDirection: row.feeDirection,
        settlementName: row.settlementName,
        unitPrice: row.unitPrice,
        quantity: row.quantity,
        currency: row.currency,
        remark: row.remark,
      }),
    ]);
    message.success('已生成修改申请行，审核时会保留原数据对比。');
  };

  const removeEditorRow = (rowId: string) => {
    setEditorRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const validateEditorRows = () => {
    if (!editorOrderNo) {
      message.error('请选择订单号');
      return false;
    }
    if (!editorRows.length) {
      message.error('请至少保留 1 条费用条目');
      return false;
    }
    const editableRows = editorRows.filter((row) => isEditableRow(editorRows, row));
    if (!editableRows.length) {
      message.error('当前没有可提交的新增或修改条目');
      return false;
    }
    for (const row of editableRows) {
      if (!row.feeType || !row.feeDirection || !row.settlementName || !row.currency) {
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
    const order = getOrderByNo(editorOrderNo);
    if (!order) {
      message.error('未找到对应订单');
      return;
    }
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    const currentUser = getCurrentUser();

    const nextItems = editorRows.map((row) => {
      if (!isEditableRow(editorRows, row)) return row;
      return {
        ...row,
        amount: calcAmount(row.unitPrice, row.quantity),
        reviewStatus: submitForReview ? 'PENDING' : 'DRAFT',
        updatedAt: now,
      };
    });

    setRecords((prev) => {
      const existed = prev.find((record) => record.orderNo === editorOrderNo);
      const nextRecord: OrderFeeRecord = {
        orderNo: order.orderNo,
        masterOrderNo: order.masterOrderNo,
        orderLevel: order.orderLevel,
        clientName: order.clientName,
        station: order.station,
        route: order.route,
        serviceType: order.serviceType,
        carrier: order.carrier,
        pieces: order.pieces,
        chargeWeight: order.chargeWeight,
        createdBy: existed?.createdBy || currentUser,
        createdAt: existed?.createdAt || now,
        updatedAt: now,
        reviewer: existed?.reviewer,
        reviewedAt: existed?.reviewedAt,
        reviewerRemark: existed?.reviewerRemark,
        items: nextItems,
      };
      if (existed) {
        return prev.map((record) => (record.orderNo === editorOrderNo ? nextRecord : record));
      }
      return [nextRecord, ...prev];
    });

    message.success(submitForReview ? '已提交审核' : '已保存为草稿');
    setEditorVisible(false);
    setEditorOrderNo('');
    setEditorRows([]);
  };

  const openReview = (record: OrderFeeRecord) => {
    const pendingRows = record.items.filter((item) => item.reviewStatus === 'PENDING');
    if (!pendingRows.length) {
      message.warning('当前没有待审核条目');
      return;
    }
    setReviewOrderNo(record.orderNo);
    setReviewRows(
      pendingRows.map((item) => ({
        id: item.id,
        decision: 'APPROVED',
        comment: '',
      })),
    );
    setReviewRemark(record.reviewerRemark || '');
    setReviewVisible(true);
  };

  const submitReview = () => {
    if (!reviewRecord) return;
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    const reviewer = getCurrentUser();
    setRecords((prev) =>
      prev.map((record) => {
        if (record.orderNo !== reviewRecord.orderNo) return record;
        return {
          ...record,
          updatedAt: now,
          reviewer,
          reviewedAt: now,
          reviewerRemark: reviewRemark,
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
    message.success('审核结果已保存');
    setReviewVisible(false);
    setReviewOrderNo('');
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
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 160,
      render: (value: string, record: OrderFeeRecord) => (
        <Button
          type="link"
          style={{ padding: 0 }}
          onClick={() => {
            setDetailOrderNo(record.orderNo);
            setDetailVisible(true);
          }}
        >
          {value}
        </Button>
      ),
    },
    { title: '主单号', dataIndex: 'masterOrderNo', key: 'masterOrderNo', width: 160 },
    {
      title: '层级',
      dataIndex: 'orderLevel',
      key: 'orderLevel',
      width: 90,
      render: (value: OrderLevel) => <Tag color={ORDER_LEVEL_CONFIG[value].color}>{ORDER_LEVEL_CONFIG[value].text}</Tag>,
    },
    { title: '客户名称', dataIndex: 'clientName', key: 'clientName', width: 180 },
    { title: '站点', dataIndex: 'station', key: 'station', width: 110 },
    { title: '线路', dataIndex: 'route', key: 'route', width: 180 },
    { title: '服务类型', dataIndex: 'serviceType', key: 'serviceType', width: 120 },
    { title: '承运人', dataIndex: 'carrier', key: 'carrier', width: 90 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 70 },
    { title: '费用条目', key: 'itemCount', width: 90, render: (_: unknown, record: OrderFeeRecord) => record.items.length },
    {
      title: '应收合计',
      key: 'receivableTotal',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, record: OrderFeeRecord) => getReceivableTotal(record.items).toFixed(2),
    },
    {
      title: '应付合计',
      key: 'payableTotal',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, record: OrderFeeRecord) => getPayableTotal(record.items).toFixed(2),
    },
    {
      title: '审核状态',
      key: 'recordStatus',
      width: 110,
      render: (_: unknown, record: OrderFeeRecord) => {
        const status = deriveRecordStatus(record.items);
        return <Tag color={RECORD_STATUS_CONFIG[status].color}>{RECORD_STATUS_CONFIG[status].text}</Tag>;
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
      width: 250,
      fixed: 'right' as const,
      render: (_: unknown, record: OrderFeeRecord) => {
        const status = deriveRecordStatus(record.items);
        return (
          <Space size={4} wrap>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setDetailOrderNo(record.orderNo);
                setDetailVisible(true);
              }}
            >
              详情
            </Button>
            {status !== 'PENDING' && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditor(record.orderNo)}>
                继续录入
              </Button>
            )}
            {status === 'PENDING' && (
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => openReview(record)}>
                审核
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
      width: 120,
      fixed: 'left' as const,
      render: (_: unknown, row: FeeItem) => <Tag>{getRowTypeText(editorRows, row)}</Tag>,
    },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 140,
      render: (value: string, row: FeeItem) =>
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
      title: '收支方向',
      dataIndex: 'feeDirection',
      key: 'feeDirection',
      width: 120,
      render: (value: FeeDirection, row: FeeItem) =>
        isEditableRow(editorRows, row) ? (
          <Select
            value={value}
            style={{ width: '100%' }}
            onChange={(nextValue) => updateEditorRow(row.id, { feeDirection: nextValue })}
            options={[
              { value: 'RECEIVABLE', label: '应收' },
              { value: 'PAYABLE', label: '应付' },
            ]}
          />
        ) : (
          <Tag color={FEE_DIRECTION_CONFIG[value].color}>{FEE_DIRECTION_CONFIG[value].text}</Tag>
        ),
    },
    {
      title: '结算对象',
      dataIndex: 'settlementName',
      key: 'settlementName',
      width: 220,
      render: (value: string, row: FeeItem) =>
        isEditableRow(editorRows, row) ? (
          <Select
            value={value}
            showSearch
            optionFilterProp="children"
            style={{ width: '100%' }}
            onChange={(nextValue) => updateEditorRow(row.id, { settlementName: nextValue })}
          >
            {SETTLEMENT_OPTIONS.map((item) => (
              <Select.Option key={item} value={item}>
                {item}
              </Select.Option>
            ))}
            {editorOrder?.clientName && (
              <Select.Option value={editorOrder.clientName}>{editorOrder.clientName}</Select.Option>
            )}
          </Select>
        ) : (
          value
        ),
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 110,
      render: (value: number, row: FeeItem) =>
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
      width: 100,
      render: (value: number, row: FeeItem) =>
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
      width: 100,
      render: (value: string, row: FeeItem) =>
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
      width: 90,
      render: (value: number) => value ? `${value}` : '-',
    },
    {
      title: '折合CNY',
      key: 'amountCNY',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, row: FeeItem) => {
        const rate = row.exchangeRate || (row.currency === 'CNY' ? 1 : row.currency === 'USD' ? 7.2 : 0.0055);
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
      render: (_: unknown, row: FeeItem) =>
        row.originalSnapshot
          ? `${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.feeDirection === 'RECEIVABLE' ? '应收' : '应付'} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity}`
          : '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 200,
      render: (value: string, row: FeeItem) =>
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
      render: (_: unknown, row: FeeItem) => {
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
      width: 120,
      render: (_: unknown, row: FeeItem) => <Tag>{detailRecord ? getRowTypeText(detailRecord.items, row) : '-'}</Tag>,
    },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 140,
      render: (value: string) => FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    {
      title: '收支方向',
      dataIndex: 'feeDirection',
      key: 'feeDirection',
      width: 110,
      render: (value: FeeDirection) => <Tag color={FEE_DIRECTION_CONFIG[value].color}>{FEE_DIRECTION_CONFIG[value].text}</Tag>,
    },
    { title: '结算对象', dataIndex: 'settlementName', key: 'settlementName', width: 220 },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 110, render: (value: number) => value.toFixed(2) },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 100 },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 90 },
    { title: '小计', dataIndex: 'amount', key: 'amount', width: 120, render: (value: number) => value.toFixed(2) },
    { title: '录入汇率', dataIndex: 'exchangeRate', key: 'exchangeRate', width: 90, render: (value: number) => value ? `${value}` : '-' },
    {
      title: '折合CNY', key: 'amountCNY', width: 90, align: 'right' as const,
      render: (_: unknown, row: FeeItem) => {
        const rate = row.exchangeRate || (row.currency === 'CNY' ? 1 : row.currency === 'USD' ? 7.2 : 0.0055);
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
      width: 280,
      render: (_: unknown, row: FeeItem) =>
        row.originalSnapshot
          ? `${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.feeDirection === 'RECEIVABLE' ? '应收' : '应付'} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity} = ${row.originalSnapshot.amount.toFixed(2)}`
          : '-',
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 180, render: (value: string) => value || '-' },
    { title: '审核意见', dataIndex: 'reviewComment', key: 'reviewComment', width: 180, render: (value: string) => value || '-' },
  ];

  const reviewColumns = [
    {
      title: '变更类型',
      key: 'kind',
      width: 120,
      render: (_: unknown, row: FeeItem) => <Tag>{row.kind === 'CHANGE' ? '修改申请' : '新增条目'}</Tag>,
    },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 130,
      render: (value: string) => FEE_TYPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    {
      title: '原数据',
      key: 'origin',
      width: 300,
      render: (_: unknown, row: FeeItem) =>
        row.originalSnapshot
          ? `${FEE_TYPE_OPTIONS.find((item) => item.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.feeDirection === 'RECEIVABLE' ? '应收' : '应付'} / ${row.originalSnapshot.settlementName} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity} = ${row.originalSnapshot.amount.toFixed(2)}`
          : '-',
    },
    {
      title: '申请数据',
      key: 'next',
      width: 320,
      render: (_: unknown, row: FeeItem) =>
        `${FEE_TYPE_OPTIONS.find((item) => item.value === row.feeType)?.label || row.feeType} / ${row.feeDirection === 'RECEIVABLE' ? '应收' : '应付'} / ${row.settlementName} / ${row.unitPrice.toFixed(2)} x ${row.quantity} = ${row.amount.toFixed(2)}`,
    },
    {
      title: '审核结果',
      key: 'decision',
      width: 120,
      render: (_: unknown, row: FeeItem) => {
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
      render: (_: unknown, row: FeeItem) => {
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
        message="演示规则：订单费用按订单号一条记录管理；一次可录入多条费用项目；海运/空运订单号按当前业务页签隔离展示；已审核条目需要先申请修改，再提交审核。"
      />

      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">订单记录 {stats.total}</Tag>
        <Tag>草稿 {stats.draft}</Tag>
        <Tag color="orange">待审核 {stats.pending}</Tag>
        <Tag color="gold">驳回中 {stats.rejected}</Tag>
        <Tag color="green">已审核 {stats.approved}</Tag>
        <Tag color="processing">应收合计 {stats.receivableTotal.toFixed(2)}</Tag>
        <Tag color="volcano">应付合计 {stats.payableTotal.toFixed(2)}</Tag>
      </div>

      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 260px" minWidth={240}>
              <Input
                placeholder="输入订单号/主单号/客户名称"
                value={filterKeyword}
                onChange={(event) => setFilterKeyword(event.target.value)}
                prefix={<SearchOutlined />}
                allowClear
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={150}>
              <Select
                placeholder="审核状态"
                value={filterStatus || undefined}
                onChange={setFilterStatus}
                style={{ width: '100%' }}
                allowClear
              >
                {Object.entries(RECORD_STATUS_CONFIG).map(([value, config]) => (
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
        rowKey="orderNo"
        columns={listColumns}
        dataSource={filteredRecords}
        scroll={{ x: 1950, y: 'calc(100vh - 430px)' }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        size="small"
      />

      <Drawer
        title="订单费用录入"
        placement="right"
        open={editorVisible}
        onClose={() => {
          setEditorVisible(false);
          setEditorOrderNo('');
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
                setEditorOrderNo('');
                setEditorRows([]);
              }}
            >
              取消
            </Button>
            <Button onClick={() => persistEditor(false)}>保存草稿</Button>
            <Button type="primary" onClick={() => persistEditor(true)}>
              提交审核
            </Button>
          </Space>
        )}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="费用条目使用表格式逐行录入。已审核条目为锁定行，只能通过“申请修改”生成待审核变更；新增条目和驳回条目可直接编辑。"
        />

        <Descriptions size="small" column={4} bordered style={{ marginBottom: 12 }}>
          <Descriptions.Item label="订单号" span={2}>
            <Select
              value={editorOrderNo || undefined}
              placeholder="请选择订单号"
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
              onChange={handleEditorOrderChange}
            >
              {visibleOrders.map((item) => (
                <Select.Option key={item.orderNo} value={item.orderNo}>
                  {item.orderNo} / {item.clientName}
                </Select.Option>
              ))}
            </Select>
          </Descriptions.Item>
          <Descriptions.Item label="主单号">{editorOrder?.masterOrderNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="层级">{editorOrder ? ORDER_LEVEL_CONFIG[editorOrder.orderLevel].text : '-'}</Descriptions.Item>
          <Descriptions.Item label="客户名称">{editorOrder?.clientName || '-'}</Descriptions.Item>
          <Descriptions.Item label="站点">{editorOrder?.station || '-'}</Descriptions.Item>
          <Descriptions.Item label="线路">{editorOrder?.route || '-'}</Descriptions.Item>
          <Descriptions.Item label="服务类型">{editorOrder?.serviceType || '-'}</Descriptions.Item>
          <Descriptions.Item label="承运人">{editorOrder?.carrier || '-'}</Descriptions.Item>
          <Descriptions.Item label="件数">{editorOrder?.pieces || '-'}</Descriptions.Item>
          <Descriptions.Item label="计费重量">{editorOrder?.chargeWeight || '-'}</Descriptions.Item>
          <Descriptions.Item label="应收合计">{editorReceivableTotal.toFixed(2)}</Descriptions.Item>
          <Descriptions.Item label="应付合计">{editorPayableTotal.toFixed(2)}</Descriptions.Item>
        </Descriptions>

        <Card size="small" title="费用条目" extra={<Button type="dashed" onClick={addEditorRow}>+ 添加行</Button>}>
          <Table
            rowKey="id"
            columns={editorColumns}
            dataSource={editorRows}
            pagination={false}
            size="small"
            scroll={{ x: 2050 }}
            locale={{ emptyText: '请点击“添加行”开始录入费用条目' }}
          />
        </Card>
      </Drawer>

      <Drawer
        title={detailRecord ? `订单费用详情 - ${detailRecord.orderNo}` : '订单费用详情'}
        placement="right"
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setDetailOrderNo('');
        }}
        width="94vw"
        destroyOnHidden
        styles={{ body: { padding: 16 } }}
        extra={detailRecord ? (
          <Space>
            <Button
              onClick={() => {
                setDetailVisible(false);
                setDetailOrderNo('');
              }}
            >
              关闭
            </Button>
            {deriveRecordStatus(detailRecord.items) !== 'PENDING' && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setDetailVisible(false);
                  setDetailOrderNo('');
                  openEditor(detailRecord.orderNo);
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
              <Descriptions.Item label="订单号">{detailRecord.orderNo}</Descriptions.Item>
              <Descriptions.Item label="主单号">{detailRecord.masterOrderNo}</Descriptions.Item>
              <Descriptions.Item label="层级">{ORDER_LEVEL_CONFIG[detailRecord.orderLevel].text}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{detailRecord.clientName}</Descriptions.Item>
              <Descriptions.Item label="站点">{detailRecord.station}</Descriptions.Item>
              <Descriptions.Item label="线路">{detailRecord.route}</Descriptions.Item>
              <Descriptions.Item label="服务类型">{detailRecord.serviceType}</Descriptions.Item>
              <Descriptions.Item label="承运人">{detailRecord.carrier}</Descriptions.Item>
              <Descriptions.Item label="审核状态">{RECORD_STATUS_CONFIG[deriveRecordStatus(detailRecord.items)].text}</Descriptions.Item>
              <Descriptions.Item label="件数">{detailRecord.pieces}</Descriptions.Item>
              <Descriptions.Item label="计费重量">{detailOrder?.chargeWeight || detailRecord.chargeWeight}</Descriptions.Item>
              <Descriptions.Item label="销售">{detailOrder?.salesName || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建人">{detailRecord.createdBy}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{formatDateTime(detailRecord.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="审核人">{detailRecord.reviewer || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核时间">{formatDateTime(detailRecord.reviewedAt)}</Descriptions.Item>
              <Descriptions.Item label="审核意见" span={4}>
                {detailRecord.reviewerRemark || '暂无'}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="费用条目详情">
              {(() => {
                const currencySymbol: Record<string, string> = { USD: '$', CNY: '¥', NGN: '₦', EUR: '€' };
                const grouped: Record<string, FeeItem[]> = {};
                (detailRecord.items || []).forEach((item: FeeItem) => {
                  const cur = item.currency || 'USD';
                  if (!grouped[cur]) grouped[cur] = [];
                  grouped[cur].push(item);
                });
                if (Object.keys(grouped).length === 0) grouped['USD'] = [];
                return Object.entries(grouped).map(([currency, items]) => {
                  const symbol = currencySymbol[currency] || currency;
                  const receivable = items.filter(i => i.feeDirection === 'RECEIVABLE').reduce((s, i) => s + (i.amount || 0), 0);
                  const payable = items.filter(i => i.feeDirection === 'PAYABLE').reduce((s, i) => s + (i.amount || 0), 0);
                  return (
                    <div key={currency} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Tag color={currency === 'USD' ? 'blue' : currency === 'CNY' ? 'red' : currency === 'NGN' ? 'green' : 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                          {symbol} {currency}
                        </Tag>
                        <Space size={16}>
                          <span style={{ color: '#1677ff', fontWeight: 600 }}>应收：{symbol}{receivable.toFixed(2)}</span>
                          <span style={{ color: '#cf1322', fontWeight: 600 }}>应付：{symbol}{payable.toFixed(2)}</span>
                        </Space>
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
        title={reviewRecord ? `费用审核 - ${reviewRecord.orderNo}` : '费用审核'}
        placement="right"
        open={reviewVisible}
        onClose={() => {
          setReviewVisible(false);
          setReviewOrderNo('');
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
                setReviewOrderNo('');
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
              message="审核页保留原数据和申请数据并排展示。修改申请只有审核通过后才会替换当前生效条目，原数据会继续保留在详情中用于追溯。"
            />

            <Descriptions size="small" column={4} bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="订单号">{reviewRecord.orderNo}</Descriptions.Item>
              <Descriptions.Item label="主单号">{reviewRecord.masterOrderNo}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{reviewRecord.clientName}</Descriptions.Item>
              <Descriptions.Item label="承运人">{reviewRecord.carrier}</Descriptions.Item>
            </Descriptions>

            <Table
              rowKey="id"
              columns={reviewColumns}
              dataSource={reviewRecord.items.filter((item) => item.reviewStatus === 'PENDING')}
              pagination={false}
              size="small"
              scroll={{ x: 1650 }}
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
