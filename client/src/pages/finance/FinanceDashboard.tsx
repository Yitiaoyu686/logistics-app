import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, List, Button, Space, Badge, Tag,
  Typography, Divider, Modal, Form, Input, Select, InputNumber,
  DatePicker, message, Table, Spin
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, DollarOutlined,
  CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
  PlusOutlined, DownloadOutlined, SwapOutlined,
  BankOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { salesApi, feeApi } from '../../api';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PRIORITY_CONFIG = {
  HIGH: { text: '紧急', color: 'red', icon: '🔴' },
  MEDIUM: { text: '待办', color: 'orange', icon: '🟠' },
  LOW: { text: '提醒', color: 'gold', icon: '🟡' }
};

interface PendingTask {
  id: string;
  type: string;
  priority: string;
  title: string;
  count: number;
  amount: number;
  currency: string;
  description: string;
  dueDate: string;
}

interface RecentTransaction {
  id: string;
  type: string;
  orderNo: string;
  client: string;
  amount: number;
  currency: string;
  method: string;
  time: string;
  operator: string;
}

interface FinanceData {
  todayIncome: number;
  todayExpense: number;
  currentCashFlow: number;
  pendingTasks: PendingTask[];
  recentTransactions: RecentTransaction[];
}

export const FinanceDashboard: React.FC = () => {
  const [data, setData] = useState<FinanceData>({
    todayIncome: 0,
    todayExpense: 0,
    currentCashFlow: 0,
    pendingTasks: [],
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [exchangeRateModalVisible, setExchangeRateModalVisible] = useState(false);
  const [receiptForm] = Form.useForm();
  const [rateForm] = Form.useForm();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dashRes, feeRes] = await Promise.all([
          salesApi.dashboard().catch(() => null),
          feeApi.list().catch(() => null),
        ]);
        // Map response data to the component's expected format
        if (dashRes?.data) {
          const d = dashRes.data as any;
          setData(prev => ({
            ...prev,
            todayIncome: d.todayIncome ?? prev.todayIncome,
            todayExpense: d.todayExpense ?? prev.todayExpense,
            currentCashFlow: d.currentCashFlow ?? prev.currentCashFlow,
            pendingTasks: Array.isArray(d.pendingTasks) ? d.pendingTasks : prev.pendingTasks,
            recentTransactions: Array.isArray(d.recentTransactions) ? d.recentTransactions : prev.recentTransactions,
          }));
        }
        if (feeRes?.data || Array.isArray(feeRes)) {
          const fees = Array.isArray(feeRes) ? feeRes : (feeRes as any)?.data ?? [];
          // Derive transactions from fee records if dashboard didn't provide them
          if (fees.length > 0) {
            const transactions: RecentTransaction[] = fees.slice(0, 10).map((fee: any, idx: number) => ({
              id: fee.id || `TXN-${idx}`,
              type: fee.feeType === 'RECEIVABLE' || fee.direction === 'IN' ? 'INCOME' : 'EXPENSE',
              orderNo: fee.orderNo || fee.relatedOrderNo || '-',
              client: fee.clientName || fee.supplierName || '-',
              amount: fee.amount || 0,
              currency: fee.currency || 'CNY',
              method: fee.paymentMethod || '-',
              time: fee.createdAt || fee.date || dayjs().format('YYYY-MM-DD HH:mm:ss'),
              operator: fee.operator || fee.createdBy || '-',
            }));
            setData(prev => ({
              ...prev,
              recentTransactions: prev.recentTransactions.length > 0 ? prev.recentTransactions : transactions,
            }));
          }
        }
      } catch (e) {
        message.error('获取财务数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 处理录入收款
  const handleSubmitReceipt = async () => {
    try {
      const values = await receiptForm.validateFields();
      console.log('录入收款:', values);
      message.success('收款记录已保存');
      setReceiptModalVisible(false);
      receiptForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 处理汇率配置
  const handleSubmitRate = async () => {
    try {
      const values = await rateForm.validateFields();
      console.log('汇率配置:', values);
      message.success('汇率已更新');
      setExchangeRateModalVisible(false);
      rateForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 下载月报
  const handleDownloadReport = () => {
    message.info('正在生成财务月报...');
    setTimeout(() => {
      message.success('月报下载成功');
    }, 1000);
  };

  // 处理待办事项点击
  const handleTaskClick = (task: any) => {
    message.info(`查看详情：${task.title}`);
  };

  return (
    <Spin spinning={loading}>
    <div style={{ background: '#f0f2f5', padding: 0, minHeight: '100%' }}>
      {/* 资金卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="今日入账"
              value={data.todayIncome}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
              prefix="¥"
              suffix={
                <span style={{ fontSize: 14, color: '#999' }}>
                  <ArrowUpOutlined style={{ marginLeft: 8 }} />
                </span>
              }
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="今日出账"
              value={data.todayExpense}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
              prefix="¥"
              suffix={
                <span style={{ fontSize: 14, color: '#999' }}>
                  <ArrowDownOutlined style={{ marginLeft: 8 }} />
                </span>
              }
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false}>
            <Statistic
              title="当前现金流"
              value={data.currentCashFlow}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
              prefix="¥"
              suffix={
                <span style={{ fontSize: 14, color: '#999' }}>
                  <DollarOutlined style={{ marginLeft: 8 }} />
                </span>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 左侧：待办事项 */}
        <Col span={16}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>待办事项</span>
                <Badge count={data.pendingTasks.reduce((sum, t) => sum + t.count, 0)} />
              </Space>
            }
            bordered={false}
            style={{ marginBottom: 16 }}
          >
            <List
              dataSource={data.pendingTasks}
              renderItem={(task) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleTaskClick(task)}
                  actions={[
                    <Button type="link" size="small">
                      去处理
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge
                        count={task.count}
                        style={{
                          backgroundColor:
                            task.priority === 'HIGH'
                              ? '#cf1322'
                              : task.priority === 'MEDIUM'
                              ? '#fa8c16'
                              : '#faad14'
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20
                          }}
                        >
                          {task.type === 'PETTY_CASH_VERIFY' ? (
                            <BankOutlined />
                          ) : task.type === 'SUPPLIER_PAYMENT' ? (
                            <FileTextOutlined />
                          ) : (
                            <WarningOutlined />
                          )}
                        </div>
                      </Badge>
                    }
                    title={
                      <Space>
                        <span style={{ fontSize: 16 }}>
                          {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG].icon}
                        </span>
                        <Tag color={PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG].color}>
                          {PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG].text}
                        </Tag>
                        <Text strong>{task.title}</Text>
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        <div style={{ marginBottom: 4 }}>{task.description}</div>
                        <Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            涉及金额：
                          </Text>
                          <Text strong style={{ color: '#1890ff' }}>
                            {task.currency === 'CNY' ? '¥' : '$'} {task.amount.toLocaleString()}
                          </Text>
                          <Divider type="vertical" />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            截止时间：{dayjs(task.dueDate).format('YYYY-MM-DD')}
                          </Text>
                        </Space>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          {/* 近期交易 */}
          <Card
            title="近期交易记录"
            bordered={false}
            extra={<Button type="link">查看全部</Button>}
          >
            <Table
              dataSource={data.recentTransactions}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '时间',
                  dataIndex: 'time',
                  width: 150,
                  render: (val: string) => dayjs(val).format('MM-DD HH:mm')
                },
                {
                  title: '类型',
                  dataIndex: 'type',
                  width: 80,
                  render: (val: string) =>
                    val === 'INCOME' ? (
                      <Tag color="green" icon={<ArrowUpOutlined />}>
                        收入
                      </Tag>
                    ) : (
                      <Tag color="red" icon={<ArrowDownOutlined />}>
                        支出
                      </Tag>
                    )
                },
                {
                  title: '关联单号',
                  dataIndex: 'orderNo',
                  width: 140,
                  render: (val: string) => <a>{val}</a>
                },
                {
                  title: '客户/供应商',
                  dataIndex: 'client',
                  width: 150
                },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  width: 120,
                  align: 'right' as const,
                  render: (val: number, record: any) => (
                    <Text
                      strong
                      style={{
                        color: record.type === 'INCOME' ? '#52c41a' : '#cf1322'
                      }}
                    >
                      {record.currency === 'CNY' ? '¥' : '$'} {val.toLocaleString()}
                    </Text>
                  )
                },
                {
                  title: '支付方式',
                  dataIndex: 'method',
                  width: 100
                },
                {
                  title: '经办人',
                  dataIndex: 'operator',
                  width: 80
                }
              ]}
            />
          </Card>
        </Col>

        {/* 右侧：快捷入口 + 提醒 */}
        <Col span={8}>
          {/* 快捷操作 */}
          <Card title="快捷操作" bordered={false} style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                block
                size="large"
                icon={<PlusOutlined />}
                onClick={() => setReceiptModalVisible(true)}
              >
                录入收款
              </Button>
              <Button
                block
                size="large"
                icon={<SwapOutlined />}
                onClick={() => setExchangeRateModalVisible(true)}
              >
                汇率配置
              </Button>
              <Button
                block
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleDownloadReport}
              >
                下载月报
              </Button>
            </Space>
          </Card>

          {/* 今日提醒 */}
          <Card
            title={
              <Space>
                <WarningOutlined />
                <span>今日提醒</span>
              </Space>
            }
            bordered={false}
          >
            <List
              size="small"
              dataSource={[
                { id: 1, text: '今日有 3 笔订单待确认收款', time: '09:00' },
                { id: 2, text: 'UPS 月结账单到期提醒', time: '10:30' },
                { id: 3, text: '美元汇率波动超过 2%', time: '14:20' }
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Badge status="processing" />}
                    title={<Text style={{ fontSize: 13 }}>{item.text}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.time}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 录入收款 Modal */}
      <Modal
        title="录入收款记录"
        open={receiptModalVisible}
        onCancel={() => {
          setReceiptModalVisible(false);
          receiptForm.resetFields();
        }}
        onOk={handleSubmitReceipt}
        width={600}
      >
        <Form form={receiptForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="orderNo"
                label="关联运单号"
                rules={[{ required: true, message: '请输入运单号' }]}
              >
                <Input placeholder="例如: ORD-2024-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="client"
                label="客户名称"
                rules={[{ required: true, message: '请选择客户' }]}
              >
                <Select placeholder="选择客户">
                  <Select.Option value="深圳贸易公司">深圳贸易公司</Select.Option>
                  <Select.Option value="广州电子厂">广州电子厂</Select.Option>
                  <Select.Option value="东莞制造">东莞制造</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="收款金额"
                rules={[{ required: true, message: '请输入金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="请输入金额"
                  min={0}
                  precision={2}
                  prefix="¥"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currency"
                label="币种"
                rules={[{ required: true }]}
                initialValue="CNY"
              >
                <Select>
                  <Select.Option value="CNY">CNY (人民币)</Select.Option>
                  <Select.Option value="USD">USD (美元)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="method"
                label="支付方式"
                rules={[{ required: true, message: '请选择支付方式' }]}
              >
                <Select placeholder="选择支付方式">
                  <Select.Option value="微信支付">微信支付</Select.Option>
                  <Select.Option value="支付宝">支付宝</Select.Option>
                  <Select.Option value="银行转账">银行转账</Select.Option>
                  <Select.Option value="现金">现金</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="receiptDate"
                label="收款时间"
                rules={[{ required: true }]}
                initialValue={dayjs()}
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 汇率配置 Modal */}
      <Modal
        title="汇率配置"
        open={exchangeRateModalVisible}
        onCancel={() => {
          setExchangeRateModalVisible(false);
          rateForm.resetFields();
        }}
        onOk={handleSubmitRate}
        width={500}
      >
        <Form form={rateForm} layout="vertical" initialValues={{ effectiveDate: dayjs() }}>
          <Form.Item
            name="fromCurrency"
            label="源币种"
            rules={[{ required: true }]}
            initialValue="USD"
          >
            <Select>
              <Select.Option value="USD">USD (美元)</Select.Option>
              <Select.Option value="EUR">EUR (欧元)</Select.Option>
              <Select.Option value="GBP">GBP (英镑)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="toCurrency"
            label="目标币种"
            rules={[{ required: true }]}
            initialValue="CNY"
          >
            <Select>
              <Select.Option value="CNY">CNY (人民币)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="rate"
            label="汇率"
            rules={[{ required: true, message: '请输入汇率' }]}
            extra="1 USD = ? CNY"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如: 7.2456"
              min={0}
              precision={4}
              step={0.0001}
            />
          </Form.Item>

          <Form.Item
            name="effectiveDate"
            label="生效时间"
            rules={[{ required: true }]}
          >
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="例如: 中国银行中间价" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
    </Spin>
  );
};
