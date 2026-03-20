import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Input, Select, DatePicker, Tag, Space,
  Row, Col, Statistic, message, Drawer, Descriptions, Divider, Timeline
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined,
  ClockCircleOutlined, DollarOutlined, ExclamationCircleOutlined,
  WalletOutlined, BankOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { feeApi } from '../../api';

const { RangePicker } = DatePicker;
const { Option } = Select;

// Types
type ReceivableStatus = 'PENDING' | 'PARTIAL' | 'RECEIVED' | 'OVERDUE';
type Currency = 'NGN' | 'USD';

interface CollectionRecord {
  id: string;
  amount: number;
  currency: Currency;
  method: string;
  receivedAt: string;
  operator: string;
}

interface ReceivableRecord {
  id: string;
  feeNo: string;
  clientName: string;
  dpnNo: string;
  relatedNo: string;
  feeType: string;
  amount: number;
  receivedAmount: number;
  currency: Currency;
  status: ReceivableStatus;
  dueDate: string;
  receivedAt?: string;
  createdAt: string;
  collections: CollectionRecord[];
}

const STATUS_CONFIG: Record<ReceivableStatus, { text: string; color: string }> = {
  PENDING: { text: '未收', color: 'default' },
  PARTIAL: { text: '部分收款', color: 'processing' },
  RECEIVED: { text: '已收', color: 'success' },
  OVERDUE: { text: '逾期', color: 'error' },
};

const CURRENCY_SYMBOLS: Record<Currency, string> = { NGN: '\u20A6', USD: '$' };

const mapFeeToReceivable = (fee: any): ReceivableRecord => {
  const amount = fee.amount || 0;
  const paidAt = fee.paidAt;
  const isReceived = fee.status === 'PAID' || fee.status === 'APPROVED';
  const receivedAmount = isReceived ? amount : 0;

  let status: ReceivableStatus = 'PENDING';
  if (isReceived) status = 'RECEIVED';
  else if (fee.status === 'PARTIAL') status = 'PARTIAL';
  else if (fee.createdAt && dayjs(fee.createdAt).add(30, 'day').isBefore(dayjs())) status = 'OVERDUE';

  return {
    id: String(fee.id || ''),
    feeNo: fee.feeNo || '',
    clientName: fee.customerName || fee.supplierName || '-',
    dpnNo: fee.relatedNo || '',
    relatedNo: fee.relatedNo || '',
    feeType: fee.feeType || fee.description || '-',
    amount,
    receivedAmount,
    currency: (fee.currency === 'USD' ? 'USD' : 'NGN') as Currency,
    status,
    dueDate: fee.createdAt ? dayjs(fee.createdAt).add(30, 'day').format('YYYY-MM-DD') : '',
    receivedAt: paidAt,
    createdAt: fee.createdAt || '',
    collections: isReceived ? [{
      id: `c-${fee.id}`,
      amount,
      currency: (fee.currency === 'USD' ? 'USD' : 'NGN') as Currency,
      method: '银行转账',
      receivedAt: paidAt || fee.approvedAt || '',
      operator: fee.approver || '-',
    }] : [],
  };
};

export const ReceivablePOD = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ReceivableRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ReceivableRecord[]>([]);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<ReceivableStatus | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  // Drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<ReceivableRecord | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await feeApi.list({ feeDirection: 'RECEIVABLE' });
      const rows = ((res as any).data || res || []) as any[];
      const mapped = rows.map((fee: any) => mapFeeToReceivable(fee));
      setRecords(mapped);
      setFilteredRecords(mapped);
    } catch (err: any) {
      message.error('加载数据失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stats (NGN only for summary)
  const ngnRecords = records.filter(r => r.currency === 'NGN');
  const totalNGN = ngnRecords.reduce((s, r) => s + r.amount, 0);
  const receivedNGN = ngnRecords.reduce((s, r) => s + r.receivedAmount, 0);
  const unreceived = ngnRecords.reduce((s, r) => s + (r.amount - r.receivedAmount), 0);
  const overdueCount = records.filter(r => r.status === 'OVERDUE').length;

  const handleSearch = () => {
    let filtered = [...records];
    if (searchText) {
      const kw = searchText.toLowerCase();
      filtered = filtered.filter(r => r.clientName.toLowerCase().includes(kw) || r.dpnNo.toLowerCase().includes(kw) || r.relatedNo.toLowerCase().includes(kw) || r.feeNo.toLowerCase().includes(kw));
    }
    if (filterStatus !== 'ALL') filtered = filtered.filter(r => r.status === filterStatus);
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(r => {
        const d = dayjs(r.dueDate);
        return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1]);
      });
    }
    setFilteredRecords(filtered);
  };

  const handleReset = () => {
    setSearchText('');
    setFilterStatus('ALL');
    setDateRange([null, null]);
    setFilteredRecords(records);
  };

  const openDetail = (record: ReceivableRecord) => {
    setCurrentRecord(record);
    setDrawerVisible(true);
  };

  const handleConfirmReceived = (record: ReceivableRecord) => {
    const updated = records.map(r => r.id === record.id ? {
      ...r,
      status: 'RECEIVED' as ReceivableStatus,
      receivedAmount: r.amount,
      receivedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      collections: [...r.collections, { id: `c-${Date.now()}`, amount: r.amount - r.receivedAmount, currency: r.currency, method: '银行转账', receivedAt: dayjs().format('YYYY-MM-DD HH:mm'), operator: 'Current User' }],
    } : r);
    setRecords(updated);
    setFilteredRecords(updated);
    message.success('已确认收款');
  };

  const formatAmount = (amount: number, currency: Currency) => `${CURRENCY_SYMBOLS[currency]} ${amount.toLocaleString()}`;

  const columns = [
    { title: '费用编号', dataIndex: 'feeNo', key: 'feeNo', width: 130 },
    { title: '客户名称', dataIndex: 'clientName', key: 'clientName', width: 160 },
    { title: 'DPN编号', dataIndex: 'dpnNo', key: 'dpnNo', width: 130 },
    { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 150 },
    { title: '费用类型', dataIndex: 'feeType', key: 'feeType', width: 110 },
    {
      title: '应收金额', dataIndex: 'amount', key: 'amount', width: 140, align: 'right' as const,
      render: (v: number, r: ReceivableRecord) => <span style={{ fontWeight: 'bold' }}>{formatAmount(v, r.currency)}</span>,
      sorter: (a: ReceivableRecord, b: ReceivableRecord) => a.amount - b.amount,
    },
    {
      title: '币种', dataIndex: 'currency', key: 'currency', width: 70,
      render: (c: Currency) => <Tag>{c}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s: ReceivableStatus) => <Tag color={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].text}</Tag>,
    },
    {
      title: '到期日', dataIndex: 'dueDate', key: 'dueDate', width: 110,
      render: (t: string, r: ReceivableRecord) => (
        <span style={{ color: r.status === 'OVERDUE' ? '#ff4d4f' : undefined }}>
          {dayjs(t).format('YYYY-MM-DD')}
        </span>
      ),
      sorter: (a: ReceivableRecord, b: ReceivableRecord) => dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix(),
    },
    {
      title: '收款时间', dataIndex: 'receivedAt', key: 'receivedAt', width: 140,
      render: (t?: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'action', width: 140, fixed: 'right' as const,
      render: (_: any, record: ReceivableRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button>
          {(record.status === 'PENDING' || record.status === 'OVERDUE') && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleConfirmReceived(record)}>收款</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="应收总额(NGN)" value={totalNGN} valueStyle={{ color: '#1890ff' }} prefix={<DollarOutlined />} formatter={v => `\u20A6 ${Number(v).toLocaleString()}`} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="已收(NGN)" value={receivedNGN} valueStyle={{ color: '#52c41a' }} prefix={<WalletOutlined />} formatter={v => `\u20A6 ${Number(v).toLocaleString()}`} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="未收(NGN)" value={unreceived} valueStyle={{ color: '#faad14' }} prefix={<BankOutlined />} formatter={v => `\u20A6 ${Number(v).toLocaleString()}`} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="逾期" value={overdueCount} suffix="笔" valueStyle={{ color: '#ff4d4f' }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索客户/DPN/单号" value={searchText} onChange={e => setSearchText(e.target.value)} onPressEnter={handleSearch} style={{ width: 200 }} allowClear />
          <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 120 }}>
            <Option value="ALL">全部状态</Option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <RangePicker value={dateRange} onChange={setDateRange as any} format="YYYY-MM-DD" placeholder={['到期开始', '到期结束']} />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条记录` }}
        />
      </Card>

      <Drawer
        title="应收详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
        destroyOnClose
      >
        {currentRecord && (
          <div>
            <Descriptions title="应收信息" column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="费用编号">{currentRecord.feeNo}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{currentRecord.clientName}</Descriptions.Item>
              <Descriptions.Item label="DPN编号">{currentRecord.dpnNo}</Descriptions.Item>
              <Descriptions.Item label="关联单号">{currentRecord.relatedNo}</Descriptions.Item>
              <Descriptions.Item label="费用类型">{currentRecord.feeType}</Descriptions.Item>
              <Descriptions.Item label="币种"><Tag>{currentRecord.currency}</Tag></Descriptions.Item>
              <Descriptions.Item label="应收金额">
                <span style={{ fontWeight: 'bold' }}>{formatAmount(currentRecord.amount, currentRecord.currency)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="已收金额">
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{formatAmount(currentRecord.receivedAmount, currentRecord.currency)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="未收金额">
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{formatAmount(currentRecord.amount - currentRecord.receivedAmount, currentRecord.currency)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="到期日">
                <span style={{ color: currentRecord.status === 'OVERDUE' ? '#ff4d4f' : undefined }}>
                  {dayjs(currentRecord.dueDate).format('YYYY-MM-DD')}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                <Tag color={STATUS_CONFIG[currentRecord.status].color}>{STATUS_CONFIG[currentRecord.status].text}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider />
            <h4>收款记录</h4>
            {currentRecord.collections.length > 0 ? (
              <Timeline
                items={currentRecord.collections.map(c => ({
                  color: 'green',
                  children: (
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{formatAmount(c.amount, c.currency)}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {c.method} | {c.operator} | {dayjs(c.receivedAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>暂无收款记录</div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
