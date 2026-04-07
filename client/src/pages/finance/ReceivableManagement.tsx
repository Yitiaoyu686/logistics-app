import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  DollarOutlined,
  EyeOutlined,
  ReloadOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { UploadFile } from 'antd/es/upload/interface';
import { feeApi, jobApi, orderApi, v2OmsApi } from '../../api';
import { FeeLedgerDetailDrawer } from '../tms/FeeLedgerDetailDrawer';
import type { FeeDetailInfoItem, FeeLedgerEntry, FeeLedgerReceipt } from '../tms/FeeLedgerDetailDrawer';
import { getUiFeeStatus, loadFeeWorkflowState } from '../tms/feeWorkflowDemo';
import type { FeeWorkflowState, UiFeeStatus } from '../tms/feeWorkflowDemo';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type BusinessLine = 'ALL' | 'SEA' | 'AIR';
type RowStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

interface FeeRow {
  id: string;
  feeNo: string;
  relatedType: string;
  relatedNo: string;
  feeType: string;
  feeDirection: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  status: string;
  customerName?: string;
  description?: string;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
}

interface OrderReceivableRow {
  orderNo: string;
  customerName: string;
  jobNo: string;
  businessLine: Exclude<BusinessLine, 'ALL'> | 'UNKNOWN';
  receivableCNY: number;
  receivedCNY: number;
  outstandingCNY: number;
  dueDate: string;
  overdueDays: number;
  status: RowStatus;
  entries: FeeLedgerEntry[];
}

interface DetailMeta {
  route: string;
  serviceType: string;
  salesName: string;
  status: string;
  customerName: string;
}

type ReceiptStore = Record<string, FeeLedgerReceipt[]>;

const RECEIPT_STORAGE_KEY = 'finance_receivable_receipt_store_v1';

const STATUS_CONFIG: Record<RowStatus, { text: string; color: string }> = {
  UNPAID: { text: '未收', color: 'orange' },
  PARTIAL: { text: '部分收', color: 'blue' },
  PAID: { text: '已收清', color: 'green' },
  OVERDUE: { text: '逾期', color: 'red' },
};

const FALLBACK_RATE: Record<string, number> = {
  CNY: 1,
  USD: 7.2,
  NGN: 0.0055,
  EUR: 7.8,
};

const DEFAULT_DETAIL_META: DetailMeta = {
  route: '-',
  serviceType: '-',
  salesName: '-',
  status: '-',
  customerName: '-',
};

const toCny = (amount: number, currency?: string, exchangeRate?: number) => {
  const curr = (currency || 'CNY').toUpperCase();
  const rate = exchangeRate || FALLBACK_RATE[curr] || 1;
  return amount * rate;
};

const inferBusinessLine = (row: FeeRow): OrderReceivableRow['businessLine'] => {
  const text = `${row.relatedNo || ''} ${row.description || ''} ${row.customerName || ''} ${row.remark || ''}`.toUpperCase();
  if (text.includes('AIR') || text.includes('空运')) return 'AIR';
  if (text.includes('SEA') || text.includes('海运')) return 'SEA';
  return 'UNKNOWN';
};

const resolveDueDate = (row: FeeRow) => {
  const base = row.createdAt ? dayjs(row.createdAt) : dayjs();
  return base.add(30, 'day').format('YYYY-MM-DD');
};

const resolveRowStatus = (receivableCNY: number, receivedCNY: number, dueDate: string): RowStatus => {
  if (receivedCNY >= receivableCNY) return 'PAID';
  if (dayjs(dueDate).isBefore(dayjs(), 'day')) return 'OVERDUE';
  if (receivedCNY > 0) return 'PARTIAL';
  return 'UNPAID';
};

const sortReceipts = (list: FeeLedgerReceipt[]) =>
  [...list].sort((a, b) => dayjs(b.receivedAt).valueOf() - dayjs(a.receivedAt).valueOf());

const loadReceiptStore = (): ReceiptStore => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RECEIPT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as ReceiptStore;
  } catch {
    return {};
  }
};

const mergeRowWithReceipts = (row: OrderReceivableRow, receipts: FeeLedgerReceipt[]): OrderReceivableRow => {
  const manualReceived = receipts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const receivedCNY = Math.min(row.receivableCNY, row.receivedCNY + manualReceived);
  const outstandingCNY = Math.max(row.receivableCNY - receivedCNY, 0);
  const overdueDays = outstandingCNY > 0 && dayjs(row.dueDate).isBefore(dayjs(), 'day')
    ? dayjs().diff(dayjs(row.dueDate), 'day')
    : 0;
  return {
    ...row,
    receivedCNY,
    outstandingCNY,
    overdueDays,
    status: resolveRowStatus(row.receivableCNY, receivedCNY, row.dueDate),
  };
};

const buildDetailInfoItems = (
  row: OrderReceivableRow,
  detailMeta: DetailMeta,
  receipts: FeeLedgerReceipt[],
): FeeDetailInfoItem[] => {
  const latestReceipt = receipts[0];
  return [
    { label: '运单号', value: row.orderNo },
    { label: '客户名称', value: detailMeta.customerName || row.customerName || '-' },
    { label: '业务线', value: row.businessLine === 'UNKNOWN' ? '-' : row.businessLine },
    { label: '任务号', value: row.jobNo || '-' },
    { label: '应收总额(CNY)', value: row.receivableCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) },
    { label: '已收(CNY)', value: row.receivedCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) },
    { label: '待收(CNY)', value: row.outstandingCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) },
    { label: '收款次数', value: `${receipts.length} 次` },
    { label: '最近收款', value: latestReceipt ? dayjs(latestReceipt.receivedAt).format('YYYY-MM-DD HH:mm') : '-' },
    { label: '最早到期日', value: row.dueDate || '-' },
    { label: '线路', value: detailMeta.route || '-' },
    { label: '服务类型', value: detailMeta.serviceType || '-' },
    { label: '业务员', value: detailMeta.salesName || '-' },
    { label: '物流状态', value: detailMeta.status || '-' },
  ];
};

const mapToOrderRows = (rows: FeeRow[], workflowState: FeeWorkflowState): OrderReceivableRow[] => {
  const grouped = new Map<string, OrderReceivableRow>();

  rows.forEach((row) => {
    const feeId = String(row.id || '');
    if (workflowState.deletedFeeIds[feeId]) return;

    const orderNo = row.relatedNo || row.feeNo || '-';
    const dueDate = resolveDueDate(row);
    const amountCNY = toCny(Number(row.amount || 0), row.currency, row.exchangeRate);
    const paidCNY = row.status === 'PAID' ? amountCNY : 0;
    const uiStatus = getUiFeeStatus(String(row.status || 'PENDING'), feeId, workflowState);
    const changeRequest = workflowState.changeRequests[feeId];

    const feeEntry: FeeLedgerEntry = {
      id: feeId,
      feeNo: row.feeNo || '-',
      relatedNo: orderNo,
      feeType: row.feeType || '-',
      feeDirection: row.feeDirection,
      amount: Number(row.amount || 0),
      currency: row.currency || 'CNY',
      uiStatus,
      changeRequestStatus: changeRequest?.status,
      changeItemsCount: changeRequest?.items?.length || 0,
      createdBy: row.createdBy || '-',
      createdAt: row.createdAt,
      description: row.description || '',
    };

    const existed = grouped.get(orderNo);
    if (!existed) {
      grouped.set(orderNo, {
        orderNo,
        customerName: row.customerName || '-',
        jobNo: row.relatedType === 'JOB' ? orderNo : '-',
        businessLine: inferBusinessLine(row),
        receivableCNY: amountCNY,
        receivedCNY: paidCNY,
        outstandingCNY: amountCNY - paidCNY,
        dueDate,
        overdueDays: 0,
        status: 'UNPAID',
        entries: [feeEntry],
      });
    } else {
      existed.receivableCNY += amountCNY;
      existed.receivedCNY += paidCNY;
      existed.outstandingCNY = existed.receivableCNY - existed.receivedCNY;
      if (dayjs(dueDate).isBefore(dayjs(existed.dueDate), 'day')) {
        existed.dueDate = dueDate;
      }
      if (!existed.customerName || existed.customerName === '-') {
        existed.customerName = row.customerName || existed.customerName;
      }
      if (existed.jobNo === '-' && row.relatedType === 'JOB') {
        existed.jobNo = orderNo;
      }
      if (existed.businessLine === 'UNKNOWN') {
        existed.businessLine = inferBusinessLine(row);
      }
      existed.entries.push(feeEntry);
    }
  });

  return Array.from(grouped.values())
    .map((item) => {
      const overdueDays = item.outstandingCNY > 0 && dayjs(item.dueDate).isBefore(dayjs(), 'day')
        ? dayjs().diff(dayjs(item.dueDate), 'day')
        : 0;
      const status = resolveRowStatus(item.receivableCNY, item.receivedCNY, item.dueDate);
      return {
        ...item,
        overdueDays,
        status,
      };
    })
    .sort((a, b) => b.outstandingCNY - a.outstandingCNY);
};

const fmt = (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ============================================================
 * ReceivableManagement - 应收明细
 * ============================================================ */
export const ReceivableManagement: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [loading, setLoading] = useState(false);
  const [baseRows, setBaseRows] = useState<OrderReceivableRow[]>([]);
  const [receiptStore, setReceiptStore] = useState<ReceiptStore>(() => loadReceiptStore());
  const workflowState = useMemo(() => loadFeeWorkflowState(), []);

  const rows = useMemo(
    () => baseRows.map((item) => mergeRowWithReceipts(item, receiptStore[item.orderNo] || [])),
    [baseRows, receiptStore],
  );

  const [searchText, setSearchText] = useState('');
  const [lineFilter, setLineFilter] = useState<BusinessLine>(businessMode === 'AIR' || businessMode === 'SEA' ? businessMode : 'ALL');
  const [statusFilter, setStatusFilter] = useState<RowStatus | 'ALL'>('ALL');

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOrderNo, setDetailOrderNo] = useState('');
  const [detailTitle, setDetailTitle] = useState('应收台账详情');
  const [detailMeta, setDetailMeta] = useState<DetailMeta>(DEFAULT_DETAIL_META);
  const [detailInfoItems, setDetailInfoItems] = useState<FeeDetailInfoItem[]>([]);
  const [detailEntries, setDetailEntries] = useState<FeeLedgerEntry[]>([]);
  const [detailReceipts, setDetailReceipts] = useState<FeeLedgerReceipt[]>([]);

  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [receivingRecord, setReceivingRecord] = useState<OrderReceivableRow | null>(null);
  const [receiveForm] = Form.useForm();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receiptStore));
  }, [receiptStore]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await feeApi.list({ feeDirection: 'RECEIVABLE' });
        const feeRows = ((res as any).data || res || []) as FeeRow[];

        // 补充缺失的客户名：一次性加载订单列表建立映射
        try {
          const ordersRes = await v2OmsApi.listOrders() as any;
          const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : Array.isArray(ordersRes) ? ordersRes : [];
          const orderMap = new Map<string, string>();
          orders.forEach((o: any) => {
            const no = o.order_no || o.orderNo || o.display_order_no;
            const name = o.customer_name || o.customerName;
            if (no && name) orderMap.set(no, name);
          });
          feeRows.forEach(r => {
            if (!r.customerName && r.relatedNo && orderMap.has(r.relatedNo)) {
              r.customerName = orderMap.get(r.relatedNo)!;
            }
          });
        } catch { /* 订单查询失败不影响主流程 */ }

        setBaseRows(mapToOrderRows(feeRows, workflowState));
      } catch {
        message.error('获取应收费用失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workflowState]);

  useEffect(() => {
    if (!detailVisible || !detailOrderNo) return;
    const currentRow = rows.find((item) => item.orderNo === detailOrderNo);
    if (!currentRow) return;
    const receipts = sortReceipts(receiptStore[detailOrderNo] || []);
    setDetailEntries(currentRow.entries);
    setDetailReceipts(receipts);
    setDetailInfoItems(buildDetailInfoItems(currentRow, detailMeta, receipts));
  }, [detailMeta, detailOrderNo, detailVisible, receiptStore, rows]);

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter((item) =>
        item.orderNo.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.jobNo.toLowerCase().includes(q) ||
        item.entries.some((entry) => entry.feeNo.toLowerCase().includes(q))
      );
    }

    if (lineFilter !== 'ALL') {
      result = result.filter((item) => item.businessLine === lineFilter);
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((item) => item.status === statusFilter);
    }

    return result;
  }, [rows, searchText, lineFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalReceivable = filteredRows.reduce((sum, item) => sum + item.receivableCNY, 0);
    const totalReceived = filteredRows.reduce((sum, item) => sum + item.receivedCNY, 0);
    const totalOutstanding = totalReceivable - totalReceived;
    const overdueAmount = filteredRows
      .filter((item) => item.status === 'OVERDUE')
      .reduce((sum, item) => sum + item.outstandingCNY, 0);

    return {
      orderCount: filteredRows.length,
      totalReceivable,
      totalReceived,
      totalOutstanding,
      overdueAmount,
    };
  }, [filteredRows]);

  const handleReset = () => {
    setSearchText('');
    setLineFilter('ALL');
    setStatusFilter('ALL');
  };

  const handleOpenReceive = (record: OrderReceivableRow) => {
    setReceivingRecord(record);
    receiveForm.resetFields();
    receiveForm.setFieldsValue({
      receiveAmount: Number(record.outstandingCNY.toFixed(2)),
      receivedAt: dayjs(),
      vouchers: [],
      remark: '',
    });
    setReceiveModalVisible(true);
  };

  const handleSubmitReceive = async () => {
    try {
      const values = await receiveForm.validateFields();
      if (!receivingRecord) return;

      const receiveAmount = Number(values.receiveAmount || 0);
      if (receiveAmount <= 0) {
        message.warning('收款金额必须大于 0');
        return;
      }
      if (receiveAmount > receivingRecord.outstandingCNY + 0.0001) {
        message.error(`收款金额不能大于待收金额 ${receivingRecord.outstandingCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`);
        return;
      }

      const voucherFiles = ((values.vouchers || []) as UploadFile[]).map((file) => file.name).filter(Boolean);
      if (!voucherFiles.length) {
        message.warning('请上传收款凭证');
        return;
      }

      setReceiveSubmitting(true);
      const receipt: FeeLedgerReceipt = {
        id: `RCV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        amount: Number(receiveAmount.toFixed(2)),
        receivedAt: dayjs(values.receivedAt).toISOString(),
        voucherNames: voucherFiles,
        operator: '当前用户',
        remark: values.remark || undefined,
      };

      setReceiptStore((prev) => {
        const orderNo = receivingRecord.orderNo;
        const history = prev[orderNo] || [];
        return {
          ...prev,
          [orderNo]: sortReceipts([receipt, ...history]),
        };
      });

      message.success('收款已登记');
      setReceiveModalVisible(false);
      setReceivingRecord(null);
      receiveForm.resetFields();
    } catch (error) {
      console.error('收款表单校验失败', error);
    } finally {
      setReceiveSubmitting(false);
    }
  };

  // ---- 审核收款 ----
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewRecord, setReviewRecord] = useState<OrderReceivableRow | null>(null);
  const [reviewReceipts, setReviewReceipts] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState('');

  const handleOpenReview = (record: OrderReceivableRow, pendingReceipts: any[]) => {
    setReviewRecord(record);
    setReviewReceipts(pendingReceipts);
    setRejectReason('');
    setReviewModalVisible(true);
  };

  const handleReviewAction = (receiptId: string, action: 'APPROVED' | 'REJECTED') => {
    if (action === 'REJECTED' && !rejectReason.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    try {
      const store = JSON.parse(localStorage.getItem('finance_payment_receipt_store') || '{}');
      const orderNo = reviewRecord?.orderNo;
      if (!orderNo || !store[orderNo]) return;
      store[orderNo] = store[orderNo].map((r: any) => {
        if (r.id !== receiptId) return r;
        return {
          ...r,
          status: action,
          reviewedBy: '财务人员',
          reviewedAt: new Date().toISOString(),
          rejectReason: action === 'REJECTED' ? rejectReason : undefined,
        };
      });
      localStorage.setItem('finance_payment_receipt_store', JSON.stringify(store));
      message.success(action === 'APPROVED' ? '已通过审核' : '已驳回');
      setReviewReceipts((prev) => prev.filter((r) => r.id !== receiptId));
      if (reviewReceipts.length <= 1) setReviewModalVisible(false);
      setRejectReason('');
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleOpenDetail = async (record: OrderReceivableRow) => {
    setDetailVisible(true);
    setDetailOrderNo(record.orderNo);
    setDetailTitle(`应收台账详情 - ${record.orderNo}`);
    setDetailEntries(record.entries);
    const receipts = sortReceipts(receiptStore[record.orderNo] || []);
    setDetailReceipts(receipts);

    const initialMeta: DetailMeta = {
      ...DEFAULT_DETAIL_META,
      customerName: record.customerName || '-',
    };
    setDetailMeta(initialMeta);
    setDetailInfoItems(buildDetailInfoItems(record, initialMeta, receipts));

    setDetailLoading(true);
    try {
      const [orderRaw, jobRaw] = await Promise.allSettled([
        orderApi.search(record.orderNo),
        record.jobNo && record.jobNo !== '-' ? jobApi.get(record.jobNo) : Promise.resolve({}),
      ]);

      let route = '-';
      let serviceType = '-';
      let salesName = '-';
      let status = '-';
      let customerName = record.customerName || '-';

      if (orderRaw.status === 'fulfilled') {
        const payload = (orderRaw.value as any).data || orderRaw.value || {};
        const masters = Array.isArray(payload.masterOrders) ? payload.masterOrders : [];
        const subs = Array.isArray(payload.subOrders) ? payload.subOrders : [];
        const orderMatched =
          subs.find((item: any) => item.subOrderNo === record.orderNo || item.id === record.orderNo) ||
          masters.find((item: any) => item.orderNo === record.orderNo || item.id === record.orderNo) ||
          subs[0] ||
          masters[0] ||
          {};

        route = orderMatched.routeCode || orderMatched.route || route;
        serviceType = orderMatched.serviceType || serviceType;
        salesName = orderMatched.salesPerson || orderMatched.salesName || salesName;
        status = orderMatched.status || orderMatched.currentStatus || status;
        customerName = orderMatched.customerName || orderMatched.clientName || customerName;
      }

      if (jobRaw.status === 'fulfilled') {
        const payload = (jobRaw.value as any).data || jobRaw.value || {};
        route = route === '-' ? payload.route || payload.routeCode || '-' : route;
        serviceType = serviceType === '-' ? payload.serviceType || payload.transportType || '-' : serviceType;
        salesName = salesName === '-' ? payload.salesPerson || payload.salesName || '-' : salesName;
      }

      const nextMeta: DetailMeta = {
        route,
        serviceType,
        salesName,
        status,
        customerName,
      };
      setDetailMeta(nextMeta);
      setDetailInfoItems(buildDetailInfoItems(record, nextMeta, receipts));
    } catch {
      message.warning('订单基础信息读取失败，已展示应收台账');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: '运单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 170,
      render: (value: string, record: OrderReceivableRow) => (
        <a onClick={() => handleOpenDetail(record)}>{value}</a>
      ),
    },
    {
      title: '业务线',
      dataIndex: 'businessLine',
      key: 'businessLine',
      width: 90,
      render: (value: OrderReceivableRow['businessLine']) => {
        if (value === 'SEA') return <Tag color="blue">海运</Tag>;
        if (value === 'AIR') return <Tag color="purple">空运</Tag>;
        return <Tag>未知</Tag>;
      },
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '任务号',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 160,
      render: (value: string) => value || '-',
    },
    {
      title: '费用条目',
      key: 'entryCount',
      width: 90,
      align: 'right' as const,
      render: (_: unknown, record: OrderReceivableRow) => record.entries.length,
    },
    {
      title: '应收(CNY)',
      dataIndex: 'receivableCNY',
      key: 'receivableCNY',
      width: 130,
      align: 'right' as const,
      sorter: (a: OrderReceivableRow, b: OrderReceivableRow) => a.receivableCNY - b.receivableCNY,
      render: (value: number) => <Text strong style={{ color: '#3f8600' }}>{value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</Text>,
    },
    {
      title: '已收(CNY)',
      dataIndex: 'receivedCNY',
      key: 'receivedCNY',
      width: 130,
      align: 'right' as const,
      render: (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    {
      title: '待收(CNY)',
      dataIndex: 'outstandingCNY',
      key: 'outstandingCNY',
      width: 130,
      align: 'right' as const,
      sorter: (a: OrderReceivableRow, b: OrderReceivableRow) => a.outstandingCNY - b.outstandingCNY,
      render: (value: number) =>
        value > 0
          ? <Text type="danger" strong>{value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</Text>
          : <Text type="success">0.00</Text>,
    },
    {
      title: '最早到期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 110,
    },
    {
      title: '逾期天数',
      dataIndex: 'overdueDays',
      key: 'overdueDays',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value > 0 ? <Text type="danger">{value} 天</Text> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (value: RowStatus) => {
        const cfg = STATUS_CONFIG[value];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: OrderReceivableRow) => {
        const pendingReceipts = (() => {
          try {
            const store = JSON.parse(localStorage.getItem('finance_payment_receipt_store') || '{}');
            return ((store[record.orderNo] || []) as any[]).filter((r: any) => r.status === 'PENDING');
          } catch { return []; }
        })();
        return (
          <Space size={2}>
            {record.outstandingCNY > 0 && (
              <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => handleOpenReceive(record)}>
                收款
              </Button>
            )}
            {pendingReceipts.length > 0 && (
              <Button type="link" size="small" style={{ color: '#fa8c16' }} onClick={() => handleOpenReview(record, pendingReceipts)}>
                审核({pendingReceipts.length})
              </Button>
            )}
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record)}>
              详情
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="应收按运单维度统一管理。支持海运/空运筛选，并可录入收款金额、上传收款凭证，详情可查看完整收款记录。"
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="运单数" value={stats.orderCount} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="应收总额(CNY)" value={stats.totalReceivable} precision={2} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待收总额(CNY)" value={stats.totalOutstanding} precision={2} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="逾期金额(CNY)" value={stats.overdueAmount} precision={2} valueStyle={{ color: '#cf1322' }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col span={7}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>关键词</div>
            <Input
              placeholder="运单号/客户/任务号/费用编号"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>业务线</div>
            <Select value={lineFilter} onChange={setLineFilter} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              <Option value="SEA">海运</Option>
              <Option value="AIR">空运</Option>
            </Select>
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>收款状态</div>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              {(Object.keys(STATUS_CONFIG) as RowStatus[]).map((key) => (
                <Option key={key} value={key}>{STATUS_CONFIG[key].text}</Option>
              ))}
            </Select>
          </Col>
          <Col span={9} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="orderNo"
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 票运单` }}
          scroll={{ x: 1800 }}
        />
      </Card>

      <FeeLedgerDetailDrawer
        open={detailVisible}
        title={detailTitle}
        loading={detailLoading}
        infoItems={detailInfoItems}
        entries={detailEntries}
        receipts={detailReceipts}
        onClose={() => setDetailVisible(false)}
      />

      <Modal
        title={`确认收款 - ${receivingRecord?.orderNo || ''}`}
        open={receiveModalVisible}
        onCancel={() => {
          setReceiveModalVisible(false);
          setReceivingRecord(null);
          receiveForm.resetFields();
        }}
        onOk={handleSubmitReceive}
        okText="确认收款"
        cancelText="取消"
        confirmLoading={receiveSubmitting}
        width={680}
        destroyOnClose
      >
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          showIcon
          message={
            receivingRecord
              ? `待收金额(CNY)：${receivingRecord.outstandingCNY.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`
              : '请填写本次收款信息'
          }
        />
        <Form
          form={receiveForm}
          layout="vertical"
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="receiveAmount"
                label="收款金额(CNY)"
                rules={[
                  { required: true, message: '请输入收款金额' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0.01}
                  precision={2}
                  placeholder="请输入收款金额"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="receivedAt"
                label="收款时间"
                rules={[{ required: true, message: '请选择收款时间' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="vouchers"
            label="上传收款凭证"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList || [])}
            rules={[
              {
                validator: (_, value) => {
                  if (Array.isArray(value) && value.length > 0) return Promise.resolve();
                  return Promise.reject(new Error('请至少上传 1 个收款凭证'));
                },
              },
            ]}
          >
            <Upload beforeUpload={() => false} maxCount={5} multiple>
              <Button icon={<UploadOutlined />}>上传收款凭证（支持多文件）</Button>
            </Upload>
          </Form.Item>

          <Form.Item name="remark" label="收款备注">
            <TextArea rows={3} placeholder="可填写到账说明、银行流水号、核销备注等（选填）" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 审核收款弹窗 */}
      <Modal
        title={`审核收款 - ${reviewRecord?.orderNo || ''}`}
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {reviewReceipts.map((receipt: any) => (
          <Card key={receipt.id} size="small" style={{ marginBottom: 12 }}>
            <Row gutter={16}>
              <Col span={16}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <div><Text strong>收款金额：</Text><Text style={{ color: '#52c41a', fontSize: 16 }}>¥{(receipt.amount || 0).toFixed(2)}</Text></div>
                  <div><Text type="secondary">收款方式：</Text><Text>{{ WECHAT: '微信', ALIPAY: '支付宝', BANK: '银行转账', CASH: '现金', OTHER: '其他' }[receipt.paymentChannel as string] || receipt.paymentChannel}</Text></div>
                  <div><Text type="secondary">收款时间：</Text><Text>{receipt.receivedAt ? dayjs(receipt.receivedAt).format('YYYY-MM-DD HH:mm') : '-'}</Text></div>
                  <div><Text type="secondary">登记人：</Text><Text>{receipt.operator}</Text></div>
                  {receipt.voucherNames?.length > 0 && (
                    <div><Text type="secondary">凭证：</Text>{receipt.voucherNames.map((name: string, i: number) => <Tag key={i}>{name}</Tag>)}</div>
                  )}
                  {receipt.remark && <div><Text type="secondary">备注：</Text><Text>{receipt.remark}</Text></div>}
                </Space>
              </Col>
              <Col span={8} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
                <Button type="primary" block onClick={() => handleReviewAction(receipt.id, 'APPROVED')}>通过</Button>
                <Input.TextArea
                  rows={2}
                  placeholder="驳回原因（驳回时必填）"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  style={{ marginBottom: 4 }}
                />
                <Button danger block onClick={() => handleReviewAction(receipt.id, 'REJECTED')}>驳回</Button>
              </Col>
            </Row>
          </Card>
        ))}
        {reviewReceipts.length === 0 && <Text type="secondary">暂无待审核的收款记录</Text>}
      </Modal>
    </div>
  );
};

/* ============================================================
 * ReceivableStats - 应收统计
 * ============================================================ */
export const ReceivableStats: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [statsTransportMode, setStatsTransportMode] = useState<string>(
    businessMode === 'AIR' ? '空运' : businessMode === 'SEA' ? '海运' : '空运'
  );

  const monthlyStatsData = useMemo(() => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const isAir = statsTransportMode === '空运';
    return months.map((m, i) => {
      const arrivalUsd = isAir ? 3200 + Math.round(Math.random() * 2000) : 8500 + Math.round(Math.random() * 5000);
      const destCostUsd = isAir ? 800 + Math.round(Math.random() * 600) : 2200 + Math.round(Math.random() * 1500);
      const receivableUsd = arrivalUsd - destCostUsd;
      const rate = 7.1 + Math.round(Math.random() * 20) / 100;
      const receivableCny = Math.round(receivableUsd * rate * 100) / 100;
      const receivedLos = Math.round(receivableCny * (0.6 + Math.random() * 0.35) * 100) / 100;
      const dailyExpense = Math.round((200 + Math.random() * 300) * 100) / 100;
      const owedAmount = Math.round((receivableCny - receivedLos - dailyExpense) * 100) / 100;
      return {
        key: `month-${i}`,
        month: m,
        arrivalUsd,
        destCostUsd,
        receivableUsd,
        rate,
        receivableCny,
        receivedLos,
        dailyExpense,
        owedAmount,
        remark: i === 11 ? '年底结算中' : i === 5 ? '含退款调整' : '',
        children: Array.from({ length: 2 + Math.floor(Math.random() * 3) }, (_, j) => ({
          key: `month-${i}-receipt-${j}`,
          date: `2025-${String(i + 1).padStart(2, '0')}-${String(5 + j * 7).padStart(2, '0')}`,
          amount: Math.round((500 + Math.random() * 3000) * 100) / 100,
          directionTag: j % 2 === 0 ? '收款' : '退款',
          channel: ['银行转账', '微信', '支付宝', '现金'][j % 4],
          description: ['客户A批次款', 'LOS系统自动扣款', '退货退款', '尾款结清', '预付款'][j % 5],
        })),
      };
    });
  }, [statsTransportMode]);

  const monthlyStatsColumns: any[] = [
    { title: '月份', dataIndex: 'month', key: 'month', width: 80 },
    { title: '到付金额(USD)', dataIndex: 'arrivalUsd', key: 'arrivalUsd', width: 130, align: 'right' as const, render: (v: number) => v !== undefined ? fmt(v) : '-' },
    { title: '目的港成本(USD)', dataIndex: 'destCostUsd', key: 'destCostUsd', width: 140, align: 'right' as const, render: (v: number) => v !== undefined ? fmt(v) : '-' },
    { title: '应收到付(USD)', dataIndex: 'receivableUsd', key: 'receivableUsd', width: 130, align: 'right' as const, render: (v: number) => v !== undefined ? <Text strong>{fmt(v)}</Text> : '-' },
    { title: '汇率', dataIndex: 'rate', key: 'rate', width: 80, align: 'center' as const, render: (v: number) => v !== undefined ? v.toFixed(2) : '-' },
    { title: '应收到付(¥)', dataIndex: 'receivableCny', key: 'receivableCny', width: 130, align: 'right' as const, render: (v: number) => v !== undefined ? <Text strong style={{ color: '#3f8600' }}>{fmt(v)}</Text> : '-' },
    { title: '实收LOS(¥)', dataIndex: 'receivedLos', key: 'receivedLos', width: 120, align: 'right' as const, render: (v: number) => v !== undefined ? fmt(v) : '-' },
    { title: '减日常支出', dataIndex: 'dailyExpense', key: 'dailyExpense', width: 110, align: 'right' as const, render: (v: number) => v !== undefined ? fmt(v) : '-' },
    { title: '欠款金额(¥)', dataIndex: 'owedAmount', key: 'owedAmount', width: 130, align: 'right' as const, render: (v: number) => v !== undefined ? <Text type={v > 0 ? 'danger' : 'success'} strong>{fmt(v)}</Text> : '-' },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 140 },
  ];

  const historicalOwed = [
    { label: '18-19年', amount: 125600 },
    { label: '20年', amount: 89200 },
    { label: '21年', amount: 63400 },
    { label: '22年', amount: 45800 },
    { label: '23年', amount: 32100 },
    { label: '24年', amount: 18700 },
  ];

  const expandedRowRender = (record: any) => {
    if (!record.children || record.children.length === 0) return null;
    const subColumns = [
      { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
      { title: '金额', dataIndex: 'amount', key: 'amount', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
      { title: '方向', dataIndex: 'directionTag', key: 'directionTag', width: 80, render: (v: string) => <Tag color={v === '收款' ? 'green' : 'red'}>{v}</Tag> },
      { title: '渠道', dataIndex: 'channel', key: 'channel', width: 100 },
      { title: '说明', dataIndex: 'description', key: 'description', width: 200 },
    ];
    return <Table columns={subColumns} dataSource={record.children} pagination={false} size="small" rowKey="key" />;
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={['空运', '海运']}
          value={statsTransportMode}
          onChange={(val) => setStatsTransportMode(val as string)}
        />
      </div>
      <Card title={`${statsTransportMode} - 月度应收统计（2025年）`} style={{ marginBottom: 16 }}>
        <Table
          rowKey="key"
          columns={monthlyStatsColumns}
          dataSource={monthlyStatsData}
          pagination={false}
          scroll={{ x: 1200 }}
          size="middle"
          expandable={{ expandedRowRender, rowExpandable: (record: any) => record.children && record.children.length > 0 }}
          summary={() => {
            const totals = monthlyStatsData.reduce(
              (acc, cur) => ({
                arrivalUsd: acc.arrivalUsd + cur.arrivalUsd,
                destCostUsd: acc.destCostUsd + cur.destCostUsd,
                receivableUsd: acc.receivableUsd + cur.receivableUsd,
                receivableCny: acc.receivableCny + cur.receivableCny,
                receivedLos: acc.receivedLos + cur.receivedLos,
                dailyExpense: acc.dailyExpense + cur.dailyExpense,
                owedAmount: acc.owedAmount + cur.owedAmount,
              }),
              { arrivalUsd: 0, destCostUsd: 0, receivableUsd: 0, receivableCny: 0, receivedLos: 0, dailyExpense: 0, owedAmount: 0 },
            );
            return (
              <Table.Summary.Row style={{ fontWeight: 'bold', background: '#fafafa' }}>
                <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">{fmt(totals.arrivalUsd)}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">{fmt(totals.destCostUsd)}</Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">{fmt(totals.receivableUsd)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="center">-</Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">{fmt(totals.receivableCny)}</Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">{fmt(totals.receivedLos)}</Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">{fmt(totals.dailyExpense)}</Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right"><Text type="danger" strong>{fmt(totals.owedAmount)}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={9} />
              </Table.Summary.Row>
            );
          }}
        />
      </Card>
      <Card title="历年欠款金额">
        <Row gutter={16}>
          {historicalOwed.map((item) => (
            <Col key={item.label} span={4}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#cf1322' }}>¥{fmt(item.amount)}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

/* ============================================================
 * UnpaidList - 未付款清单
 * ============================================================ */
export const UnpaidList: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [unpaidTransportMode, setUnpaidTransportMode] = useState<string>(
    businessMode === 'AIR' ? '空运' : businessMode === 'SEA' ? '海运' : '空运'
  );
  const [unpaidYear, setUnpaidYear] = useState<string>('2025');

  const unpaidMockData = useMemo(() => {
    const isAir = unpaidTransportMode === '空运';
    const names = ['张三', '李四', '王五', '赵六', '陈七', '周八', '吴九', '郑十', '孙一', '钱二'];
    const receivers = ['Tom Wilson', 'Sarah Chen', 'Mike Johnson', 'Emily Davis', 'Chris Brown', 'Alex Lee', 'Nina Wang', 'Bob Smith', 'Lisa Park', 'David Kim'];
    return Array.from({ length: 10 }, (_, i) => {
      const receivableUsd = isAir ? 1200 + Math.round(Math.random() * 3000) : 5000 + Math.round(Math.random() * 8000);
      const receivedCny = Math.round(receivableUsd * 7.15 * (Math.random() * 0.4) * 100) / 100;
      return {
        key: `unpaid-${i}`,
        orderNo: `${isAir ? 'AIR' : 'SEA'}-${unpaidYear.slice(2)}-${String(1001 + i)}`,
        date: `${unpaidYear}-${String(1 + Math.floor(i * 1.2)).padStart(2, '0')}-${String(3 + i * 2).padStart(2, '0')}`,
        sender: names[i],
        receiver: receivers[i],
        volumeWeight: isAir ? `${(0.5 + Math.random() * 2).toFixed(1)}CBM / ${(20 + Math.random() * 80).toFixed(0)}KG` : `${(2 + Math.random() * 10).toFixed(1)}CBM / ${(200 + Math.random() * 800).toFixed(0)}KG`,
        receivableUsd,
        receivedCny,
        remark: i === 0 ? '催款中' : i === 3 ? '已发对账单' : i === 7 ? '客户确认中' : '',
      };
    });
  }, [unpaidTransportMode, unpaidYear]);

  const unpaidStats = useMemo(() => {
    const totalOrders = unpaidMockData.length;
    const totalUsd = unpaidMockData.reduce((s, r) => s + r.receivableUsd, 0);
    const totalReceivedCny = unpaidMockData.reduce((s, r) => s + r.receivedCny, 0);
    return { totalOrders, totalUsd, totalReceivedCny };
  }, [unpaidMockData]);

  const unpaidColumns: any[] = [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo', width: 150, render: (v: string) => <a>{v}</a> },
    { title: '日期', dataIndex: 'date', key: 'date', width: 110 },
    { title: '发货人', dataIndex: 'sender', key: 'sender', width: 100 },
    { title: '收货人', dataIndex: 'receiver', key: 'receiver', width: 130 },
    { title: '体积/重量', dataIndex: 'volumeWeight', key: 'volumeWeight', width: 180 },
    { title: '应收(USD)', dataIndex: 'receivableUsd', key: 'receivableUsd', width: 130, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#3f8600' }}>{fmt(v)}</Text> },
    { title: '已收(¥)', dataIndex: 'receivedCny', key: 'receivedCny', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 140 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Segmented
          options={['空运', '海运']}
          value={unpaidTransportMode}
          onChange={(val) => setUnpaidTransportMode(val as string)}
        />
        <Select value={unpaidYear} onChange={setUnpaidYear} style={{ width: 100 }}>
          <Option value="2025">2025年</Option>
          <Option value="2024">2024年</Option>
          <Option value="2023">2023年</Option>
        </Select>
      </div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="未收订单数" value={unpaidStats.totalOrders} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="未收总额USD" value={unpaidStats.totalUsd} precision={2} prefix={<DollarOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="已收总额RMB" value={unpaidStats.totalReceivedCny} precision={2} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
      </Row>
      <Card>
        <Table
          rowKey="key"
          columns={unpaidColumns}
          dataSource={unpaidMockData}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
};

/* ============================================================
 * ReceivableAgingView - 账龄分析 (placeholder)
 * ============================================================ */
export const ReceivableAgingView: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  return (
    <div>
      <Card>
        <Text type="secondary">账龄分析功能开发中...</Text>
      </Card>
    </div>
  );
};
