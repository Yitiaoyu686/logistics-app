import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  message,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { theme } from 'antd';
import { feeApi, jobApi, orderApi } from '../../api';
import { FeeLedgerDetailDrawer } from './FeeLedgerDetailDrawer';
import {
  CHANGE_REQUEST_STATUS_CONFIG,
  UI_STATUS_CONFIG,
  getUiFeeStatus,
  loadFeeWorkflowState,
} from './feeWorkflowDemo';
import type { FeeChangeRequest, FeeWorkflowState, UiFeeStatus } from './feeWorkflowDemo';

const { RangePicker } = DatePicker;

type ReceivableStatus = 'PENDING' | 'RECEIVED' | 'OVERDUE';

interface ReceivableRecord {
  id: string;
  feeNo: string;
  clientName: string;
  jobNo: string;
  relatedNo: string;
  feeType: string;
  amount: number;
  currency: string;
  amountCNY: number;
  status: ReceivableStatus;
  dueDate: string;
  receivedAt?: string;
  description: string;
  createdAt: string;
  backendStatus: string;
  uiFeeStatus: UiFeeStatus;
  changeRequest?: FeeChangeRequest;
}

const STATUS_CONFIG: Record<ReceivableStatus, { text: string; color: string }> = {
  PENDING: { text: '待收', color: 'warning' },
  RECEIVED: { text: '已收', color: 'success' },
  OVERDUE: { text: '逾期', color: 'error' },
};

function mapFeeToReceivableRecord(fee: any): Omit<ReceivableRecord, 'uiFeeStatus' | 'changeRequest'> {
  const exchangeRate = fee.exchangeRate || (fee.currency === 'USD' ? 7.2 : 1);
  const amountCNY = fee.currency === 'CNY' ? fee.amount : fee.amount * exchangeRate;
  const dueDate = fee.createdAt ? dayjs(fee.createdAt).add(30, 'day').format('YYYY-MM-DD') : '';

  let status: ReceivableStatus = 'PENDING';
  if (fee.status === 'PAID') {
    status = 'RECEIVED';
  } else if (dueDate && dayjs(dueDate).isBefore(dayjs(), 'day')) {
    status = 'OVERDUE';
  }

  return {
    id: String(fee.id || ''),
    feeNo: fee.feeNo || '',
    clientName: fee.customerName || '',
    jobNo: fee.relatedNo || '',
    relatedNo: fee.relatedNo || '',
    feeType: fee.feeType || '',
    amount: fee.amount || 0,
    currency: fee.currency || 'CNY',
    amountCNY,
    status,
    dueDate,
    receivedAt: fee.paidAt,
    description: fee.description || '',
    createdAt: fee.createdAt || '',
    backendStatus: String(fee.status || 'PENDING'),
  };
}

export const ReceivablePOL: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const { token } = theme.useToken();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Omit<ReceivableRecord, 'uiFeeStatus' | 'changeRequest'>[]>([]);
  const [workflowState] = useState<FeeWorkflowState>(() => loadFeeWorkflowState());

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTitle, setDetailTitle] = useState('应收费用详情');
  const [detailInfoItems, setDetailInfoItems] = useState<Array<{ label: string; value: React.ReactNode }>>([]);
  const [detailEntries, setDetailEntries] = useState<any[]>([]);

  const [filterClient, setFilterClient] = useState('');
  const [filterJobNo, setFilterJobNo] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const res = await feeApi.list({ feeDirection: 'RECEIVABLE' });
        const rows = ((res as any).data || res || []) as any[];
        setData(rows.map(mapFeeToReceivableRecord));
      } catch (err: any) {
        message.error(err.message || '加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [businessMode]);

  const enrichedData = useMemo<ReceivableRecord[]>(() => {
    return data
      .filter((item) => !workflowState.deletedFeeIds[item.id])
      .map((item) => ({
        ...item,
        uiFeeStatus: getUiFeeStatus(item.backendStatus, item.id, workflowState),
        changeRequest: workflowState.changeRequests[item.id],
      }));
  }, [data, workflowState]);

  const filteredData = useMemo(() => {
    let result = [...enrichedData];
    if (filterClient) {
      result = result.filter((r) => r.clientName.includes(filterClient));
    }
    if (filterJobNo) {
      result = result.filter((r) => r.jobNo.toLowerCase().includes(filterJobNo.toLowerCase()));
    }
    if (filterStatus) {
      result = result.filter((r) => r.status === filterStatus);
    }
    if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
      const start = filterDateRange[0].startOf('day');
      const end = filterDateRange[1].endOf('day');
      result = result.filter((r) => {
        const d = dayjs(r.dueDate);
        return d.isAfter(start) && d.isBefore(end);
      });
    }
    return result;
  }, [enrichedData, filterClient, filterJobNo, filterStatus, filterDateRange]);

  const stats = useMemo(() => {
    const totalAmount = enrichedData.reduce((sum, r) => sum + r.amountCNY, 0);
    const receivedAmount = enrichedData
      .filter((r) => r.status === 'RECEIVED')
      .reduce((sum, r) => sum + r.amountCNY, 0);
    const overdueAmount = enrichedData
      .filter((r) => r.status === 'OVERDUE')
      .reduce((sum, r) => sum + r.amountCNY, 0);
    return {
      totalAmount,
      receivedAmount,
      unreceived: totalAmount - receivedAmount,
      overdueAmount,
    };
  }, [enrichedData]);

  const handleReset = () => {
    setFilterClient('');
    setFilterJobNo('');
    setFilterStatus('');
    setFilterDateRange(null);
  };

  const handleViewDetail = async (record: ReceivableRecord) => {
    setDetailVisible(true);
    setDetailTitle(`应收费用详情 - ${record.relatedNo}`);
    setDetailInfoItems([
      { label: '关联单号', value: record.relatedNo },
      { label: '客户名称', value: record.clientName || '-' },
      { label: '任务号', value: record.jobNo || '-' },
      { label: '到期日', value: record.dueDate || '-' },
      { label: '线路', value: '-' },
      { label: '服务类型', value: '-' },
      { label: '业务员', value: '-' },
      { label: '物流状态', value: '-' },
    ]);

    setDetailLoading(true);
    try {
      const [feeRowsRaw, orderRaw, jobRaw] = await Promise.allSettled([
        feeApi.list({ relatedNo: record.relatedNo }),
        orderApi.search(record.relatedNo),
        record.jobNo ? jobApi.get(record.jobNo) : Promise.resolve({}),
      ]);

      const feeRows = feeRowsRaw.status === 'fulfilled'
        ? (((feeRowsRaw.value as any).data || feeRowsRaw.value || []) as any[])
        : [];

      const mappedEntries = feeRows
        .filter((row) => !workflowState.deletedFeeIds[String(row.id)])
        .map((row) => {
          const feeId = String(row.id || '');
          const changeRequest = workflowState.changeRequests[feeId];
          return {
            id: feeId,
            feeNo: row.feeNo || '-',
            relatedNo: row.relatedNo || record.relatedNo,
            feeType: row.feeType || '-',
            feeDirection: row.feeDirection,
            amount: Number(row.amount || 0),
            currency: row.currency || 'CNY',
            uiStatus: getUiFeeStatus(String(row.status || 'PENDING'), feeId, workflowState),
            changeRequestStatus: changeRequest?.status,
            changeItemsCount: changeRequest?.items?.length || 0,
            createdBy: row.createdBy || '-',
            createdAt: row.createdAt,
            description: row.description || '',
          };
        });
      setDetailEntries(mappedEntries);

      let route = '-';
      let serviceType = '-';
      let salesPerson = '-';
      let logisticsStatus = '-';
      let customerName = record.clientName || '-';

      if (orderRaw.status === 'fulfilled') {
        const orderPayload = (orderRaw.value as any).data || orderRaw.value || {};
        const masters = Array.isArray(orderPayload.masterOrders) ? orderPayload.masterOrders : [];
        const subs = Array.isArray(orderPayload.subOrders) ? orderPayload.subOrders : [];
        const orderMatched =
          subs.find((item: any) => item.subOrderNo === record.relatedNo || item.id === record.relatedNo) ||
          masters.find((item: any) => item.orderNo === record.relatedNo || item.id === record.relatedNo) ||
          subs[0] ||
          masters[0] ||
          {};

        route = orderMatched.routeCode || orderMatched.route || route;
        serviceType = orderMatched.serviceType || serviceType;
        salesPerson = orderMatched.salesPerson || orderMatched.salesName || salesPerson;
        logisticsStatus = orderMatched.status || orderMatched.currentStatus || logisticsStatus;
        customerName = orderMatched.customerName || orderMatched.clientName || customerName;
      }

      if (jobRaw.status === 'fulfilled') {
        const jobPayload = (jobRaw.value as any).data || jobRaw.value || {};
        route = route === '-' ? jobPayload.route || jobPayload.routeCode || '-' : route;
        serviceType = serviceType === '-' ? jobPayload.serviceType || jobPayload.transportType || '-' : serviceType;
        salesPerson = salesPerson === '-' ? jobPayload.salesPerson || jobPayload.salesName || '-' : salesPerson;
      }

      setDetailInfoItems([
        { label: '关联单号', value: record.relatedNo },
        { label: '客户名称', value: customerName },
        { label: '任务号', value: record.jobNo || '-' },
        { label: '到期日', value: record.dueDate || '-' },
        { label: '线路', value: route },
        { label: '服务类型', value: serviceType },
        { label: '业务员', value: salesPerson },
        { label: '物流状态', value: logisticsStatus },
      ]);
    } catch {
      message.warning('详情数据加载失败，已展示当前缓存数据');
      setDetailEntries(
        enrichedData
          .filter((item) => item.relatedNo === record.relatedNo)
          .map((item) => ({
            id: item.id,
            feeNo: item.feeNo,
            relatedNo: item.relatedNo,
            feeType: item.feeType,
            feeDirection: 'RECEIVABLE',
            amount: item.amount,
            currency: item.currency,
            uiStatus: item.uiFeeStatus,
            changeRequestStatus: item.changeRequest?.status,
            changeItemsCount: item.changeRequest?.items?.length || 0,
            createdBy: '-',
            createdAt: item.createdAt,
            description: item.description,
          }))
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    { title: '费用编号', dataIndex: 'feeNo', key: 'feeNo', width: 140 },
    { title: '客户名称', dataIndex: 'clientName', key: 'clientName', width: 160, ellipsis: true },
    {
      title: '任务编号',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 150,
      render: (text: string) => <a>{text}</a>,
    },
    { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 130 },
    { title: '费用类型', dataIndex: 'feeType', key: 'feeType', width: 90 },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      align: 'right' as const,
      render: (val: number) => val.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 60 },
    {
      title: '金额(CNY)',
      dataIndex: 'amountCNY',
      key: 'amountCNY',
      width: 120,
      align: 'right' as const,
      render: (val: number) => <span style={{ fontWeight: 600 }}>{val.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: '应收状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (val: ReceivableStatus) => <Tag color={STATUS_CONFIG[val].color}>{STATUS_CONFIG[val].text}</Tag>,
    },
    {
      title: '费用状态',
      dataIndex: 'uiFeeStatus',
      key: 'uiFeeStatus',
      width: 100,
      render: (val: UiFeeStatus) => <Tag color={UI_STATUS_CONFIG[val].color}>{UI_STATUS_CONFIG[val].text}</Tag>,
    },
    {
      title: '更改申请',
      key: 'changeRequest',
      width: 110,
      render: (_: unknown, record: ReceivableRecord) => {
        if (!record.changeRequest) return '-';
        const cfg = CHANGE_REQUEST_STATUS_CONFIG[record.changeRequest.status];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    {
      title: '到期日',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 110,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD'),
    },
    {
      title: '收款日',
      dataIndex: 'receivedAt',
      key: 'receivedAt',
      width: 110,
      render: (val?: string) => (val ? dayjs(val).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, record: ReceivableRecord) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="应收管理详情已支持查看费用条目清单（已审核/待审核/待更改）及订单基础信息。"
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="应收总额(CNY)" value={stats.totalAmount} precision={2} valueStyle={{ color: token.colorPrimary }} prefix={<DollarOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="已收金额(CNY)" value={stats.receivedAmount} precision={2} valueStyle={{ color: token.colorSuccess }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="未收金额(CNY)" value={stats.unreceived} precision={2} valueStyle={{ color: token.colorWarning }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="逾期金额(CNY)" value={stats.overdueAmount} precision={2} valueStyle={{ color: token.colorError }} prefix={<WarningOutlined />} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="客户名称" value={filterClient} onChange={(e) => setFilterClient(e.target.value)} prefix={<SearchOutlined />} style={{ width: 180 }} allowClear />
          <Input placeholder="任务编号" value={filterJobNo} onChange={(e) => setFilterJobNo(e.target.value)} style={{ width: 160 }} allowClear />
          <Select placeholder="应收状态" value={filterStatus || undefined} onChange={setFilterStatus} style={{ width: 120 }} allowClear>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (<Select.Option key={k} value={k}>{v.text}</Select.Option>))}
          </Select>
          <RangePicker value={filterDateRange} onChange={setFilterDateRange} />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          scroll={{ x: 1800 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <FeeLedgerDetailDrawer
        open={detailVisible}
        title={detailTitle}
        loading={detailLoading}
        infoItems={detailInfoItems}
        entries={detailEntries}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
};
