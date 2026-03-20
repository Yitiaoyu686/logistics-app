import React, { useState, useMemo } from 'react';
import {
  Drawer, Card, Descriptions, Tag, Space, Row, Col, Typography,
  Statistic, Divider, Timeline, Button, Table, Progress, Modal,
  Form, Input, InputNumber, Select, DatePicker, message, Alert, Badge
} from 'antd';
import {
  HistoryOutlined, DollarOutlined, UserOutlined, PhoneOutlined,
  MailOutlined, WarningOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Currency } from '../../types/finance';
import { CURRENCY_CONFIG } from '../../types/finance';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ==================== 类型定义 ====================

export type OrderPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

/** 应收订单 */
export interface ReceivableOrder {
  orderId: string;
  orderNo: string;
  jobNo: string;
  route: string;
  goodsDescription?: string;
  pieces?: number;
  weight?: number;
  receivableAmount: number;
  receivedAmount: number;
  currency: Currency;
  dueDate: string;
  status: OrderPaymentStatus;
  feeBreakdown: { label: string; amount: number }[];
  createdAt: string;
}

/** 收款分配明细 */
export interface PaymentAllocation {
  orderNo: string;
  amount: number;
}

/** 客户收款记录 */
export interface CustomerPayment {
  id: string;
  paymentNo: string;
  amount: number;
  currency: Currency;
  paymentMethod: string;
  paymentDate: string;
  transactionNo?: string;
  allocations: PaymentAllocation[];
  remark?: string;
  operator: string;
}

/** 客户应收汇总 */
export interface ReceivableCustomer {
  customerId: string;
  customerName: string;
  customerCode: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  totalReceivable: number;
  totalReceived: number;
  currency: Currency;
  orders: ReceivableOrder[];
  payments: CustomerPayment[];
  collectionLogs?: { time: string; operator: string; action: string; detail: string }[];
}

// ==================== 常量 ====================

const ORDER_STATUS_CONFIG: Record<OrderPaymentStatus, { text: string; color: string }> = {
  UNPAID: { text: '未付', color: 'orange' },
  PARTIAL: { text: '部分付', color: 'blue' },
  PAID: { text: '已结清', color: 'green' },
  OVERDUE: { text: '已逾期', color: 'red' }
};

const NAV_ITEMS = [
  { key: 'overview', title: '客户概览' },
  { key: 'orders', title: '订单明细' },
  { key: 'payments', title: '收款记录' },
  { key: 'collection', title: '催收记录' }
];

// ==================== 组件 ====================

interface ReceivableDetailProps {
  visible: boolean;
  data: ReceivableCustomer | null;
  onClose: () => void;
  onReceivePayment: (customerId: string, payment: Omit<CustomerPayment, 'id' | 'paymentNo'>) => void;
  onCollect: (customerId: string, orderNos: string[]) => void;
}

export const ReceivableDetail: React.FC<ReceivableDetailProps> = ({
  visible, data, onClose, onReceivePayment, onCollect
}) => {
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentForm] = Form.useForm();

  // 计算统计需要在 hooks 之前
  const outstanding = (data?.totalReceivable ?? 0) - (data?.totalReceived ?? 0);
  const overdueOrders = useMemo(() =>
    (data?.orders ?? []).filter(o => o.status === 'OVERDUE'),
    [data?.orders]
  );
  const overdueAmount = useMemo(() =>
    overdueOrders.reduce((sum, o) => sum + (o.receivableAmount - o.receivedAmount), 0),
    [overdueOrders]
  );
  const unpaidOrders = useMemo(() =>
    (data?.orders ?? []).filter(o => o.status !== 'PAID'),
    [data?.orders]
  );

  if (!data) return null;

  const handleNavClick = (key: string) => {
    const el = document.getElementById(`recv-${key}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const progressPercent = data.totalReceivable > 0
    ? Math.round(data.totalReceived / data.totalReceivable * 100) : 0;

  const currencyCfg = CURRENCY_CONFIG[data.currency];

  // --- 确认收款 ---
  const handleOpenPayment = () => {
    paymentForm.resetFields();
    // 默认分配：按未付订单等比分配
    const allocs = unpaidOrders.map(o => ({
      orderNo: o.orderNo,
      amount: o.receivableAmount - o.receivedAmount
    }));
    paymentForm.setFieldsValue({
      paymentDate: dayjs(),
      allocations: allocs
    });
    setPaymentModalVisible(true);
  };

  const handleSubmitPayment = async () => {
    try {
      const values = await paymentForm.validateFields();
      const totalAlloc = (values.allocations as PaymentAllocation[]).reduce((sum, a) => sum + (a.amount || 0), 0);
      if (totalAlloc <= 0) {
        message.warning('请至少分配一笔金额');
        return;
      }
      onReceivePayment(data.customerId, {
        amount: totalAlloc,
        currency: data.currency,
        paymentMethod: values.paymentMethod,
        paymentDate: dayjs(values.paymentDate).format('YYYY-MM-DD HH:mm:ss'),
        transactionNo: values.transactionNo,
        allocations: (values.allocations as PaymentAllocation[]).filter(a => a.amount > 0),
        remark: values.remark,
        operator: '当前用户'
      });
      setPaymentModalVisible(false);
      paymentForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // --- 催收 ---
  const handleCollectAll = () => {
    const orderNos = unpaidOrders.map(o => o.orderNo);
    if (orderNos.length === 0) { message.info('没有待收款订单'); return; }
    Modal.confirm({
      title: '批量催收',
      icon: <MailOutlined style={{ color: '#1890ff' }} />,
      content: (
        <div>
          <p>确定向 <Text strong>{data.customerName}</Text> 发送催收通知？</p>
          <Alert
            message={`涉及 ${orderNos.length} 笔订单，待收金额 ${currencyCfg.symbol}${outstanding.toLocaleString()}`}
            description="将通过短信+邮件发送催收通知"
            type="info"
            showIcon
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      onOk: () => onCollect(data.customerId, orderNos)
    });
  };

  // --- 订单表格列 ---
  const orderColumns = [
    {
      title: '运单号',
      dataIndex: 'orderNo',
      width: 170,
      render: (text: string) => <Text strong style={{ fontSize: 12 }}>{text}</Text>
    },
    {
      title: '任务号',
      dataIndex: 'jobNo',
      width: 170,
      render: (text: string) => <Text code style={{ fontSize: 12 }}>{text}</Text>
    },
    {
      title: '航线',
      dataIndex: 'route',
      width: 100
    },
    {
      title: '货物',
      key: 'goods',
      width: 120,
      ellipsis: true,
      render: (_: unknown, record: ReceivableOrder) => (
        <Text type="secondary">
          {record.goodsDescription || '-'}
          {record.pieces && ` (${record.pieces}件/${record.weight}kg)`}
        </Text>
      )
    },
    {
      title: '应收',
      dataIndex: 'receivableAmount',
      width: 110,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#3f8600' }}>{currencyCfg.symbol}{val.toLocaleString()}</Text>
      )
    },
    {
      title: '已收',
      dataIndex: 'receivedAmount',
      width: 110,
      align: 'right' as const,
      render: (val: number) => (
        <Text>{currencyCfg.symbol}{val.toLocaleString()}</Text>
      )
    },
    {
      title: '未收',
      key: 'outstanding',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, record: ReceivableOrder) => {
        const amt = record.receivableAmount - record.receivedAmount;
        return amt > 0
          ? <Text type="danger" strong>{currencyCfg.symbol}{amt.toLocaleString()}</Text>
          : <Text type="success">0</Text>;
      }
    },
    {
      title: '应收日',
      dataIndex: 'dueDate',
      width: 100,
      render: (val: string, record: ReceivableOrder) => {
        const isOverdue = record.status === 'OVERDUE';
        return (
          <Space direction="vertical" size={0}>
            <Text type={isOverdue ? 'danger' : undefined}>{dayjs(val).format('YYYY-MM-DD')}</Text>
            {isOverdue && <Tag color="error" style={{ fontSize: 11 }}>逾期 {dayjs().diff(dayjs(val), 'day')} 天</Tag>}
          </Space>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status: OrderPaymentStatus) => (
        <Tag color={ORDER_STATUS_CONFIG[status].color}>{ORDER_STATUS_CONFIG[status].text}</Tag>
      )
    }
  ];

  // --- 收款记录时间轴 ---
  const renderPaymentTimeline = () => {
    if (data.payments.length === 0) {
      return <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>暂无收款记录</div>;
    }
    return (
      <Timeline>
        {data.payments.map((p, index) => (
          <Timeline.Item key={p.id} color={index === 0 ? 'green' : 'gray'}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Space>
                  <Text strong>收款 {currencyCfg.symbol}{p.amount.toLocaleString()}</Text>
                  <Tag>{p.paymentMethod}</Tag>
                  <Text code style={{ fontSize: 12 }}>{p.paymentNo}</Text>
                </Space>
                <Text type="secondary">{dayjs(p.paymentDate).format('YYYY-MM-DD HH:mm')}</Text>
              </div>
              {p.transactionNo && (
                <div style={{ fontSize: 12, color: '#666' }}>流水号: {p.transactionNo}</div>
              )}
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>分配:</Text>
                {p.allocations.map(a => (
                  <Tag key={a.orderNo} style={{ marginLeft: 4, fontSize: 11 }}>
                    {a.orderNo}: {currencyCfg.symbol}{a.amount.toLocaleString()}
                  </Tag>
                ))}
              </div>
              {p.remark && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>备注: {p.remark}</div>}
              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>操作人: {p.operator}</div>
            </div>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  return (
    <Drawer
      title={
        <Space>
          <UserOutlined />
          <Title level={5} style={{ margin: 0 }}>{data.customerName}</Title>
          <Text type="secondary">({data.customerCode})</Text>
          {overdueOrders.length > 0 && (
            <Badge count={`${overdueOrders.length}笔逾期`} style={{ backgroundColor: '#cf1322' }} />
          )}
        </Space>
      }
      placement="right"
      width="80%"
      open={visible}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Button icon={<MailOutlined />} onClick={handleCollectAll} disabled={unpaidOrders.length === 0}>
            催收通知
          </Button>
          <Button type="primary" icon={<DollarOutlined />} onClick={handleOpenPayment} disabled={unpaidOrders.length === 0}>
            确认收款
          </Button>
        </Space>
      }
    >
      <Row gutter={16}>
        {/* 左侧导航 */}
        <Col span={3}>
          <div style={{ position: 'sticky', top: 0 }}>
            <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 4, padding: '8px 0' }}>
              {NAV_ITEMS.map(item => (
                <div
                  key={item.key}
                  onClick={() => handleNavClick(item.key)}
                  style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 14, color: '#666', transition: 'all 0.3s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#1890ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        </Col>

        {/* 右侧内容 */}
        <Col span={21}>
          {/* === 客户概览 === */}
          <Card id="recv-overview" title="客户概览" style={{ marginBottom: 16 }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={5}>
                <Statistic
                  title="应收总额"
                  value={data.totalReceivable}
                  prefix={currencyCfg.symbol}
                  precision={2}
                  valueStyle={{ color: '#3f8600', fontSize: 24 }}
                />
              </Col>
              <Col span={5}>
                <Statistic
                  title="已收金额"
                  value={data.totalReceived}
                  prefix={currencyCfg.symbol}
                  precision={2}
                  valueStyle={{ fontSize: 24 }}
                />
              </Col>
              <Col span={5}>
                <Statistic
                  title="待收金额"
                  value={outstanding}
                  prefix={currencyCfg.symbol}
                  precision={2}
                  valueStyle={{ color: outstanding > 0 ? '#cf1322' : '#52c41a', fontSize: 24 }}
                />
              </Col>
              <Col span={4}>
                <Statistic title="订单数" value={data.orders.length} suffix="笔" />
              </Col>
              <Col span={5}>
                <div>
                  <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>收款进度</div>
                  <Progress
                    percent={progressPercent}
                    size="small"
                    status={progressPercent === 100 ? 'success' : 'active'}
                    strokeColor={progressPercent < 50 ? '#cf1322' : undefined}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {data.payments.length} 次收款
                  </Text>
                </div>
              </Col>
            </Row>

            {overdueOrders.length > 0 && (
              <Alert
                message="逾期预警"
                description={`该客户有 ${overdueOrders.length} 笔订单已逾期，逾期金额 ${currencyCfg.symbol}${overdueAmount.toLocaleString()}，请及时催收`}
                type="error"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 16 }}
              />
            )}

            <Divider style={{ margin: '12px 0' }} />

            <Descriptions column={3} size="small" title="客户信息">
              <Descriptions.Item label="客户名称"><Text strong>{data.customerName}</Text></Descriptions.Item>
              <Descriptions.Item label="客户编码">{data.customerCode}</Descriptions.Item>
              <Descriptions.Item label="币种">{currencyCfg.label}（{data.currency}）</Descriptions.Item>
              <Descriptions.Item label="联系人">{data.contactName || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {data.contactPhone
                  ? <Text copyable>{data.contactPhone}</Text>
                  : '-'
                }
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">{data.contactEmail || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* === 订单明细 === */}
          <Card
            id="recv-orders"
            title={
              <Space>
                订单明细
                <Text type="secondary">（{data.orders.length} 笔）</Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="orderId"
              columns={orderColumns}
              dataSource={data.orders}
              pagination={false}
              size="small"
              expandable={{
                expandedRowRender: (record: ReceivableOrder) => (
                  <div style={{ padding: '8px 16px' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>费用明细：</Text>
                    <Space wrap style={{ marginTop: 4 }}>
                      {record.feeBreakdown.map((f, i) => (
                        <Tag key={i}>{f.label}: {currencyCfg.symbol}{f.amount.toLocaleString()}</Tag>
                      ))}
                    </Space>
                  </div>
                ),
                rowExpandable: (record: ReceivableOrder) => record.feeBreakdown.length > 0
              }}
            />
          </Card>

          {/* === 收款记录 === */}
          <Card
            id="recv-payments"
            title={
              <Space>
                <DollarOutlined />
                收款记录
                <Text type="secondary">（{data.payments.length} 次）</Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {renderPaymentTimeline()}
          </Card>

          {/* === 催收记录 === */}
          <Card id="recv-collection" title={<span><HistoryOutlined /> 催收记录</span>}>
            {data.collectionLogs && data.collectionLogs.length > 0 ? (
              <Timeline>
                {data.collectionLogs.map((log, index) => (
                  <Timeline.Item key={index} color={index === 0 ? 'blue' : 'gray'}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong>{log.action}</Text>
                        <Text type="secondary">{log.time}</Text>
                      </div>
                      <div style={{ color: '#666' }}>{log.detail}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>操作人: {log.operator}</div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>暂无催收记录</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 确认收款 Modal */}
      <Modal
        title={`确认收款 - ${data.customerName}`}
        open={paymentModalVisible}
        onCancel={() => { setPaymentModalVisible(false); paymentForm.resetFields(); }}
        onOk={handleSubmitPayment}
        okText="确认收款"
        width={700}
        destroyOnClose
      >
        <Alert
          message="请将收到的款项分配到对应的订单"
          description="可以部分付款，未分配完的金额将作为该客户的余额"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={paymentForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="paymentMethod"
                label="收款方式"
                rules={[{ required: true, message: '请选择收款方式' }]}
              >
                <Select placeholder="选择收款方式">
                  <Option value="银行转账">银行转账</Option>
                  <Option value="支付宝">支付宝</Option>
                  <Option value="微信支付">微信支付</Option>
                  <Option value="现金">现金</Option>
                  <Option value="信用证">信用证</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="paymentDate"
                label="收款日期"
                rules={[{ required: true, message: '请选择收款日期' }]}
              >
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="transactionNo" label="交易流水号">
                <Input placeholder="银行流水号（选填）" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 16px' }}>分配到订单</Divider>

          <Form.List name="allocations">
            {(fields) => (
              <div>
                {fields.map((field) => {
                  const order = unpaidOrders[field.key];
                  if (!order) return null;
                  const remainAmt = order.receivableAmount - order.receivedAmount;
                  return (
                    <Row key={field.key} gutter={16} style={{ marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
                      <Col span={10}>
                        <Space direction="vertical" size={0}>
                          <Text strong style={{ fontSize: 12 }}>{order.orderNo}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            待收: {currencyCfg.symbol}{remainAmt.toLocaleString()}
                            {order.status === 'OVERDUE' && <Tag color="error" style={{ marginLeft: 4, fontSize: 10 }}>逾期</Tag>}
                          </Text>
                        </Space>
                        <Form.Item name={[field.name, 'orderNo']} hidden>
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col span={14}>
                        <Form.Item
                          name={[field.name, 'amount']}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            max={remainAmt}
                            precision={2}
                            addonBefore={currencyCfg.symbol}
                            placeholder="本次收款金额"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  );
                })}
              </div>
            )}
          </Form.List>

          <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
            <TextArea rows={2} placeholder="收款备注（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};
