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
import { feeApi, jobApi, orderApi } from '../../api';
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
      render: (_: unknown, record: OrderReceivableRow) => (
        <Space size={2}>
          {record.outstandingCNY > 0 && (
            <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => handleOpenReceive(record)}>
              收款
            </Button>
          )}
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record)}>
            详情
          </Button>
        </Space>
      ),
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
    </div>
  );
};
