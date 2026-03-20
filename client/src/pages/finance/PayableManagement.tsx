import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select,
  Upload, message, DatePicker, Row, Col, Statistic, Typography,
  Alert, InputNumber
} from 'antd';
import {
  DollarOutlined, UploadOutlined, ClockCircleOutlined,
  WarningOutlined, ReloadOutlined, EyeOutlined, BankOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeeType, Currency } from '../../types/finance';
import { FEE_TYPE_CONFIG, CURRENCY_CONFIG } from '../../types/finance';
import { feeApi } from '../../api';
import { PayableDetail } from './PayableDetail';
import type { PayableRecord, PaymentStatus } from './PayableDetail';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ==================== 常量 ====================

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { text: string; color: string }> = {
  PENDING: { text: '待支付', color: 'orange' },
  PROCESSING: { text: '处理中', color: 'blue' },
  PAID: { text: '已支付', color: 'green' }
};

// ==================== 辅助 ====================

const toCNY = (r: PayableRecord) => r.amountCNY || r.amount;

const normalizeCurrency = (currency?: string): Currency => {
  if (!currency) return 'CNY';
  if (currency === 'USD' || currency === 'NGN' || currency === 'EUR') return currency;
  return 'CNY';
};

const normalizeFeeType = (feeType?: string): FeeType => {
  if (!feeType) return 'OTHER';
  return (feeType in FEE_TYPE_CONFIG ? feeType : 'OTHER') as FeeType;
};

const mapFeeStatusToPaymentStatus = (status?: string): PaymentStatus => {
  if (status === 'PAID') return 'PAID';
  if (status === 'APPROVED') return 'PENDING';
  return 'PENDING';
};

const mapToPayableRecords = (rows: any[]): PayableRecord[] => {
  return rows.map((row, index) => {
    const createdAt = row.createdAt || dayjs().toISOString();
    const dueDate = dayjs(createdAt).add(30, 'day').format('YYYY-MM-DD');
    const relatedType: PayableRecord['relatedType'] =
      row.relatedType === 'JOB' || row.relatedType === 'UNIT' || row.relatedType === 'TRANSFER' ? row.relatedType : 'ORDER';
    const transportType: PayableRecord['transportType'] =
      row.transportType === 'SEA' || row.transportType === 'AIR' ? row.transportType : undefined;
    return {
      id: row.id || `PAYABLE-${index}`,
      feeNo: row.feeNo || '-',
      relatedType,
      relatedNo: row.relatedNo || row.relatedId || '-',
      jobNo: relatedType === 'JOB' ? (row.relatedNo || row.relatedId || '-') : '-',
      route: row.route || '-',
      transportType,
      feeType: normalizeFeeType(row.feeType),
      amount: Number(row.amount || 0),
      currency: normalizeCurrency(row.currency),
      exchangeRate: Number(row.exchangeRate || 1),
      amountCNY: Number(row.amountCNY || row.amount || 0),
      description: row.description || '',
      remark: row.remark || '',
      supplierName: row.supplierName || '未设置供应商',
      supplierBank: row.supplierBank,
      supplierAccount: row.supplierAccount,
      supplierContact: row.supplierContact,
      invoiceNo: row.invoiceNo,
      approverName: row.approver || '-',
      approvedAt: row.approvedAt || row.updatedAt || createdAt,
      paymentStatus: mapFeeStatusToPaymentStatus(row.status),
      dueDate: row.dueDate || dueDate,
      paymentMethod: row.paymentMethod,
      transactionNo: row.transactionNo,
      paidAt: row.paidAt,
      paidBy: row.paidBy,
      paymentVoucher: row.paymentVoucher,
      paymentRemark: row.paymentRemark,
      createdByName: row.createdBy || 'system',
      createdAt,
      logs: row.logs || [],
    };
  });
};

// ==================== 组件 ====================

export const PayableManagement: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [records, setRecords] = useState<PayableRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await feeApi.list({ feeDirection: 'PAYABLE' });
        const rows = ((res as any).data || res || []) as any[];
        setRecords(mapToPayableRecords(rows));
      } catch (e) {
        message.error('获取应付费用失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 筛选
  const [searchText, setSearchText] = useState('');
  const [filterFeeType, setFilterFeeType] = useState<FeeType | 'ALL'>('ALL');
  const [filterPayStatus, setFilterPayStatus] = useState<PaymentStatus | 'ALL'>('ALL');
  const [filterCurrency, setFilterCurrency] = useState<Currency | 'ALL'>('ALL');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');

  // 详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<PayableRecord | null>(null);

  // 支付弹窗
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [payingRecord, setPayingRecord] = useState<PayableRecord | null>(null);
  const [paymentForm] = Form.useForm();

  // --- 供应商列表 ---
  const supplierList = useMemo(() => {
    const set = new Set(records.map(r => r.supplierName));
    return Array.from(set).sort();
  }, [records]);

  // --- 全局统计 ---
  const stats = useMemo(() => {
    const pendingItems = records.filter(r => r.paymentStatus === 'PENDING');
    const paidItems = records.filter(r => r.paymentStatus === 'PAID');
    const overdueItems = pendingItems.filter(r => dayjs(r.dueDate).isBefore(dayjs()));
    const pendingAmount = pendingItems.reduce((sum, r) => sum + toCNY(r), 0);
    const overdueAmount = overdueItems.reduce((sum, r) => sum + toCNY(r), 0);
    return {
      pendingCount: pendingItems.length,
      pendingAmount,
      paidCount: paidItems.length,
      overdueCount: overdueItems.length,
      overdueAmount
    };
  }, [records]);

  // --- 筛选 ---
  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (searchText) {
      const keyword = searchText.toLowerCase();
      result = result.filter(r =>
        r.feeNo.toLowerCase().includes(keyword) ||
        r.jobNo.toLowerCase().includes(keyword) ||
        r.relatedNo.toLowerCase().includes(keyword) ||
        r.supplierName.toLowerCase().includes(keyword) ||
        (r.description && r.description.toLowerCase().includes(keyword)) ||
        (r.invoiceNo && r.invoiceNo.toLowerCase().includes(keyword))
      );
    }
    if (filterFeeType !== 'ALL') result = result.filter(r => r.feeType === filterFeeType);
    if (filterPayStatus !== 'ALL') result = result.filter(r => r.paymentStatus === filterPayStatus);
    if (filterCurrency !== 'ALL') result = result.filter(r => r.currency === filterCurrency);
    if (filterSupplier !== 'ALL') result = result.filter(r => r.supplierName === filterSupplier);

    return result;
  }, [records, searchText, filterFeeType, filterPayStatus, filterCurrency, filterSupplier]);

  const handleReset = () => {
    setSearchText('');
    setFilterFeeType('ALL');
    setFilterPayStatus('ALL');
    setFilterCurrency('ALL');
    setFilterSupplier('ALL');
  };

  // --- 打开详情 ---
  const handleOpenDetail = (record: PayableRecord) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  // --- 打开支付弹窗 ---
  const handleOpenPay = (record: PayableRecord) => {
    setPayingRecord(record);
    paymentForm.resetFields();
    paymentForm.setFieldsValue({ paymentDate: dayjs(), paymentAmount: record.amount });
    setPaymentModalVisible(true);
    // 如果详情正在展示，先关掉
    setDetailVisible(false);
  };

  // --- 提交支付 ---
  const handleSubmitPayment = async () => {
    try {
      const values = await paymentForm.validateFields();
      if (!payingRecord) return;

      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const nowShort = dayjs().format('YYYY-MM-DD HH:mm');
      const txnNo = `TXN-${dayjs().format('YYYYMMDD')}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
      const symbol = CURRENCY_CONFIG[payingRecord.currency].symbol;

      setRecords(prev => prev.map(r => r.id !== payingRecord.id ? r : {
        ...r,
        paymentStatus: 'PAID' as PaymentStatus,
        paymentMethod: values.paymentMethod,
        transactionNo: values.transactionNo || txnNo,
        paidAt: now,
        paidBy: '当前用户',
        paymentVoucher: values.voucher?.fileList?.[0]?.name || undefined,
        paymentRemark: values.remark,
        logs: [
          { time: nowShort, operator: '当前用户', action: '支付完成', detail: `${values.paymentMethod} ${symbol}${payingRecord.amount.toLocaleString()}，流水号 ${values.transactionNo || txnNo}` },
          ...(r.logs || [])
        ]
      }));

      message.success('支付成功');
      setPaymentModalVisible(false);
      setPayingRecord(null);
      paymentForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // --- 列定义 ---
  const columns = [
    {
      title: '费用编号',
      dataIndex: 'feeNo',
      width: 140,
      render: (text: string, record: PayableRecord) => (
        <a onClick={() => handleOpenDetail(record)}>{text}</a>
      )
    },
    {
      title: '关联任务',
      dataIndex: 'jobNo',
      width: 170,
      render: (text: string) => <Text strong style={{ fontSize: 12 }}>{text}</Text>
    },
    {
      title: '航线',
      dataIndex: 'route',
      width: 100
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      width: 90,
      render: (type: FeeType) => <Tag color={FEE_TYPE_CONFIG[type]?.color}>{FEE_TYPE_CONFIG[type]?.label}</Tag>
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      width: 140,
      ellipsis: true
    },
    {
      title: '金额',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      render: (_: unknown, record: PayableRecord) => (
        <div>
          <Text strong style={{ color: '#cf1322' }}>
            {CURRENCY_CONFIG[record.currency].symbol}{record.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
          {record.currency !== 'CNY' && record.amountCNY && (
            <div style={{ fontSize: 11, color: '#999' }}>≈ ¥{record.amountCNY.toLocaleString()}</div>
          )}
        </div>
      )
    },
    {
      title: '应付日期',
      dataIndex: 'dueDate',
      width: 110,
      sorter: (a: PayableRecord, b: PayableRecord) => dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix(),
      render: (val: string, record: PayableRecord) => {
        const isOverdue = record.paymentStatus === 'PENDING' && dayjs(val).isBefore(dayjs());
        const daysLeft = dayjs(val).diff(dayjs(), 'day');
        return (
          <Space direction="vertical" size={0}>
            <Text type={isOverdue ? 'danger' : undefined}>{dayjs(val).format('YYYY-MM-DD')}</Text>
            {record.paymentStatus === 'PENDING' && (
              isOverdue
                ? <Tag color="error" style={{ fontSize: 11 }}>逾期 {Math.abs(daysLeft)} 天</Tag>
                : daysLeft <= 3
                  ? <Tag color="warning" style={{ fontSize: 11 }}>剩余 {daysLeft} 天</Tag>
                  : null
            )}
          </Space>
        );
      }
    },
    {
      title: '发票号',
      dataIndex: 'invoiceNo',
      width: 140,
      ellipsis: true,
      render: (val: string) => val ? <Text code style={{ fontSize: 12 }}>{val}</Text> : <Text type="secondary">-</Text>
    },
    {
      title: '状态',
      dataIndex: 'paymentStatus',
      width: 80,
      render: (status: PaymentStatus) => (
        <Tag color={PAYMENT_STATUS_CONFIG[status].color}>{PAYMENT_STATUS_CONFIG[status].text}</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: PayableRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record)}>
            详情
          </Button>
          {record.paymentStatus === 'PENDING' && (
            <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => handleOpenPay(record)}>
              付款
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待支付"
              value={stats.pendingCount}
              suffix="笔"
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待支付总额(¥)"
              value={stats.pendingAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#cf1322', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已支付"
              value={stats.paidCount}
              suffix="笔"
              valueStyle={{ color: '#52c41a' }}
              prefix={<BankOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="逾期未付"
              value={stats.overdueCount}
              suffix="笔"
              valueStyle={{ color: '#cf1322' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 逾期提醒 */}
      {stats.overdueCount > 0 && (
        <Alert
          message="逾期提醒"
          description={`有 ${stats.overdueCount} 笔费用已逾期，涉及金额 ¥${stats.overdueAmount.toLocaleString()}，可能导致货物滞留，请尽快处理`}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col span={5}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>关键词</div>
            <Input
              placeholder="费用编号/任务号/供应商/发票号"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>费用类型</div>
            <Select value={filterFeeType} onChange={setFilterFeeType} style={{ width: '100%' }}>
              <Option value="ALL">全部类型</Option>
              {(Object.keys(FEE_TYPE_CONFIG) as FeeType[]).map(key => (
                <Option key={key} value={key}>{FEE_TYPE_CONFIG[key].label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={3}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>支付状态</div>
            <Select value={filterPayStatus} onChange={setFilterPayStatus} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              {(Object.keys(PAYMENT_STATUS_CONFIG) as PaymentStatus[]).map(key => (
                <Option key={key} value={key}>{PAYMENT_STATUS_CONFIG[key].text}</Option>
              ))}
            </Select>
          </Col>
          <Col span={3}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>币种</div>
            <Select value={filterCurrency} onChange={setFilterCurrency} style={{ width: '100%' }}>
              <Option value="ALL">全部币种</Option>
              {(Object.keys(CURRENCY_CONFIG) as Currency[]).map(key => (
                <Option key={key} value={key}>{CURRENCY_CONFIG[key].label}</Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>供应商</div>
            <Select value={filterSupplier} onChange={setFilterSupplier} style={{ width: '100%' }} showSearch optionFilterProp="children">
              <Option value="ALL">全部供应商</Option>
              {supplierList.map(s => <Option key={s} value={s}>{s}</Option>)}
            </Select>
          </Col>
          <Col span={5} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
        />
      </Card>

      {/* 详情 Drawer */}
      <PayableDetail
        visible={detailVisible}
        data={currentRecord}
        onClose={() => setDetailVisible(false)}
        onPay={handleOpenPay}
      />

      {/* 支付弹窗 */}
      <Modal
        title="支付确认"
        open={paymentModalVisible}
        onCancel={() => { setPaymentModalVisible(false); setPayingRecord(null); paymentForm.resetFields(); }}
        onOk={handleSubmitPayment}
        okText="确认支付"
        width={640}
        destroyOnClose
      >
        {payingRecord && (
          <div>
            <Alert
              message="支付后将自动解锁提单释放流程"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text type="secondary">费用编号：</Text>
                  <Text strong>{payingRecord.feeNo}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">关联任务：</Text>
                  <Text strong>{payingRecord.jobNo}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">供应商：</Text>
                  <Text strong>{payingRecord.supplierName}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">应付金额：</Text>
                  <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                    {CURRENCY_CONFIG[payingRecord.currency].symbol}{payingRecord.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">费用类型：</Text>
                  <Tag color={FEE_TYPE_CONFIG[payingRecord.feeType]?.color}>{FEE_TYPE_CONFIG[payingRecord.feeType]?.label}</Tag>
                </Col>
                <Col span={12}>
                  <Text type="secondary">应付日期：</Text>
                  <Text>{dayjs(payingRecord.dueDate).format('YYYY-MM-DD')}</Text>
                </Col>
                {payingRecord.supplierBank && (
                  <Col span={24}>
                    <Text type="secondary">收款账号：</Text>
                    <Text>{payingRecord.supplierBank} {payingRecord.supplierAccount}</Text>
                  </Col>
                )}
              </Row>
            </Card>

            <Form form={paymentForm} layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="paymentMethod"
                    label="支付方式"
                    rules={[{ required: true, message: '请选择支付方式' }]}
                  >
                    <Select placeholder="选择支付方式">
                      <Option value="银行转账">银行转账</Option>
                      <Option value="支票">支票</Option>
                      <Option value="线上支付">线上支付</Option>
                      <Option value="信用证">信用证</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="paymentDate"
                    label="支付时间"
                    rules={[{ required: true, message: '请选择支付时间' }]}
                  >
                    <DatePicker
                      showTime
                      format="YYYY-MM-DD HH:mm"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="transactionNo"
                    label="交易流水号"
                    rules={[{ required: true, message: '请输入交易流水号' }]}
                  >
                    <Input placeholder="输入银行或支付平台的交易流水号" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="paymentAmount"
                    label="实付金额"
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      precision={2}
                      disabled
                      addonBefore={CURRENCY_CONFIG[payingRecord.currency].symbol}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="voucher"
                label="上传支付凭证"
              >
                <Upload
                  accept=".pdf,.jpg,.png"
                  maxCount={3}
                  beforeUpload={() => false}
                >
                  <Button icon={<UploadOutlined />}>上传水单/支付截图（最多3个）</Button>
                </Upload>
              </Form.Item>

              <Form.Item name="remark" label="备注">
                <TextArea rows={2} placeholder="输入备注信息（选填）" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};
