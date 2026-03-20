import React, { useState, useRef } from 'react';
import {
  Drawer, Card, Row, Col, Descriptions, Table, Tag, Space, Typography,
  Statistic, Divider, Button, Timeline, Modal, Form, Input, Select, InputNumber, message, Badge, Anchor
} from 'antd';
import {
  InboxOutlined, DollarOutlined, PlusOutlined, EnvironmentOutlined,
  CheckCircleOutlined, ClockCircleOutlined, HistoryOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface DestInboundDetailProps {
  visible: boolean;
  recordId: string | null;
  onClose: () => void;
}

// 模拟详情数据
const getMockDetailData = (recordId: string) => ({
  id: recordId,
  jobNo: 'JOB-US-001',
  containerNo: 'MSKU1234567',
  orderCount: 25,
  totalPieces: 120,
  totalWeight: 850.5,
  totalVolume: 12.5,
  eta: '2024-01-20 14:00:00',
  actualArrivalTime: '2024-01-20 15:30:00',
  status: 'CONFIRMED',
  warehouse: 'MAIN',
  warehouseLocation: 'US-MAIN-A-01',
  operator: '李仓管',
  remark: '货物完好',
  createdAt: '2024-01-10 10:00:00',
  updatedAt: '2024-01-20 16:00:00',
  orders: [
    { id: 'ORD001', trackingNo: 'TRK001', clientName: '客户A', pieces: 10, weight: 50.5, volume: 1.2, status: '已入仓' },
    { id: 'ORD002', trackingNo: 'TRK002', clientName: '客户B', pieces: 15, weight: 75.3, volume: 1.8, status: '已入仓' },
    { id: 'ORD003', trackingNo: 'TRK003', clientName: '客户C', pieces: 20, weight: 120.0, volume: 2.5, status: '已入仓' }
  ],
  fees: [
    { id: 1, category: '清关费', item: '进口清关', amount: 500, currency: 'USD', status: 'PAID', createTime: '2024-01-20 16:00' },
    { id: 2, category: '仓储费', item: '总仓仓储5天', amount: 200, currency: 'USD', status: 'PAID', createTime: '2024-01-20 16:05' }
  ],
  logs: [
    { time: '2024-01-20 16:00:00', operator: '李仓管', action: '入仓确认', detail: '确认货物入仓至 US-MAIN-A-01' },
    { time: '2024-01-20 15:30:00', operator: '系统', action: '到达通知', detail: '货物已到达总仓' },
    { time: '2024-01-10 10:00:00', operator: '系统', action: '创建记录', detail: '创建待入仓记录' }
  ]
});

export const DestInboundDetail: React.FC<DestInboundDetailProps> = ({ visible, recordId, onClose }) => {
  if (!recordId) return null;

  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(getMockDetailData(recordId));
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [feeForm] = Form.useForm();

  // 提交费用
  const handleSubmitFee = async () => {
    try {
      const values = await feeForm.validateFields();
      const newFee = {
        id: data.fees.length + 1,
        category: values.category,
        item: values.item,
        amount: values.amount,
        currency: values.currency,
        status: values.status,
        createTime: dayjs().format('YYYY-MM-DD HH:mm')
      };
      setData({ ...data, fees: [...data.fees, newFee] });
      message.success('费用添加成功');
      setFeeModalVisible(false);
      feeForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 订单列表列定义
  const orderColumns = [
    { title: '运单号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '第三方运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 120 },
    { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 150 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' as const },
    { title: '重量(kg)', dataIndex: 'weight', key: 'weight', width: 100 },
    { title: '体积(CBM)', dataIndex: 'volume', key: 'volume', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color="success">{status}</Tag>
    }
  ];

  // 费用列表列定义
  const feeColumns = [
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 150 },
    { title: '费用类别', dataIndex: 'category', key: 'category', width: 120 },
    { title: '费用项目', dataIndex: 'item', key: 'item', width: 200 },
    {
      title: '金额',
      key: 'amount',
      width: 120,
      render: (record: any) => `${record.currency} ${record.amount.toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'PAID' ? 'success' : status === 'CONFIRMED' ? 'processing' : 'default'}>
          {status === 'PAID' ? '已支付' : status === 'CONFIRMED' ? '已确认' : '待确认'}
        </Tag>
      )
    }
  ];

  const warehouseNames = {
    MAIN: '总仓',
    BRANCH_A: '分仓A',
    BRANCH_B: '分仓B'
  };

  return (
    <Drawer
      title={
        <Space>
          <InboxOutlined />
          <span>入库详情</span>
        </Space>
      }
      open={visible}
      onClose={onClose}
      width={1200}
      extra={
        <Space>
          <Button icon={<DollarOutlined />} onClick={() => setFeeModalVisible(true)}>
            录入费用
          </Button>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
        <Row gutter={24}>
        {/* 左侧导航 */}
        <Col span={4}>
          <Anchor
            offsetTop={20}
            getContainer={() => containerRef.current || window}
            items={[
              { key: 'header', href: '#header', title: '任务信息' },
              { key: 'basic', href: '#basic', title: '基本信息' },
              { key: 'cargo', href: '#cargo', title: '货物汇总' },
              { key: 'orders', href: '#orders', title: '订单列表' },
              { key: 'fees', href: '#fees', title: '费用明细' },
              { key: 'logs', href: '#logs', title: '操作日志' }
            ]}
          />
        </Col>

        {/* 右侧内容区域 */}
        <Col span={20}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 顶部：任务号和状态 */}
            <div id="header">
              <Card bordered={false} style={{ background: '#fafafa' }}>
                <Row align="middle" justify="space-between">
                  <Col>
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: 12 }}>任务编号</Text>
                      <Title level={4} style={{ margin: 0 }}>{data.jobNo}</Title>
                    </Space>
                  </Col>
                  <Col>
                    <Tag color={data.status === 'CONFIRMED' ? 'success' : 'processing'} style={{ fontSize: 14, padding: '4px 12px' }}>
                      {data.status === 'CONFIRMED' ? '已入仓' : '待入仓'}
                    </Tag>
                  </Col>
                </Row>
                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={16}>
                  <Col span={8}>
                    <Text type="secondary">集装箱号：</Text>
                    <Text strong>{data.containerNo}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">创建时间：</Text>
                    <Text>{dayjs(data.createdAt).format('YYYY-MM-DD HH:mm')}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">入库仓库：</Text>
                    <Text>{data.warehouse ? warehouseNames[data.warehouse as keyof typeof warehouseNames] : '-'}</Text>
                  </Col>
                </Row>
              </Card>
            </div>

            {/* 基本信息 */}
            <div id="basic">
              <Card title="基本信息" size="small" bordered={false}>
                <Descriptions column={3} size="small" layout="vertical">
                  <Descriptions.Item label="任务编号">{data.jobNo}</Descriptions.Item>
                  <Descriptions.Item label="集装箱号">{data.containerNo}</Descriptions.Item>
                  <Descriptions.Item label="入库仓库">
                    <Space>
                      <EnvironmentOutlined />
                      {data.warehouse ? warehouseNames[data.warehouse as keyof typeof warehouseNames] : '-'}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="预计到达">
                    {dayjs(data.eta).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                  <Descriptions.Item label="实际到达">
                    {data.actualArrivalTime ? dayjs(data.actualArrivalTime).format('YYYY-MM-DD HH:mm') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="延迟">
                    {data.actualArrivalTime ? (
                      <Text type={dayjs(data.actualArrivalTime).isAfter(dayjs(data.eta)) ? 'danger' : 'success'}>
                        {dayjs(data.actualArrivalTime).diff(dayjs(data.eta), 'hour')} 小时
                      </Text>
                    ) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="库位">{data.warehouseLocation || '-'}</Descriptions.Item>
                  <Descriptions.Item label="操作人">{data.operator || '-'}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    {dayjs(data.createdAt).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                </Descriptions>
                {data.remark && (
                  <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                    <Text type="secondary">备注：</Text>
                    <Text>{data.remark}</Text>
                  </div>
                )}
              </Card>
            </div>

            {/* 货物汇总 */}
            <div id="cargo">
              <Card title="货物汇总" size="small" bordered={false}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic title="订单数量" value={data.orderCount} suffix="个" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="总件数" value={data.totalPieces} suffix="件" />
                  </Col>
                  <Col span={6}>
                    <Statistic title="总重量" value={data.totalWeight} suffix="kg" precision={1} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="总体积" value={data.totalVolume} suffix="m³" precision={2} />
                  </Col>
                </Row>
              </Card>
            </div>

            {/* 订单列表 */}
            <div id="orders">
              <Card title="订单列表" size="small" bordered={false}>
                <Table
                  rowKey="id"
                  columns={orderColumns}
                  dataSource={data.orders}
                  pagination={false}
                  size="small"
                />
              </Card>
            </div>

            {/* 费用明细 */}
            <div id="fees">
              <Card
                title={
                  <span>
                    <DollarOutlined /> 费用明细
                    <Badge count={data.fees.length} style={{ marginLeft: 8 }} />
                  </span>
                }
                size="small"
                bordered={false}
                extra={
                  <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setFeeModalVisible(true)}>
                    添加费用
                  </Button>
                }
              >
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 16 }}>总费用: </Text>
                  <Text type="danger" style={{ fontSize: 20, fontWeight: 'bold' }}>
                    USD {data.fees.reduce((sum, fee) => sum + fee.amount, 0).toFixed(2)}
                  </Text>
                </div>
                <Table
                  rowKey="id"
                  columns={feeColumns}
                  dataSource={data.fees}
                  pagination={false}
                  size="small"
                />
              </Card>
            </div>

            {/* 操作日志 */}
            <div id="logs">
              <Card title={<span><HistoryOutlined /> 操作日志</span>} size="small" bordered={false}>
                <Timeline
                  items={data.logs.map(log => ({
                    color: 'blue',
                    children: (
                      <div>
                        <div style={{ marginBottom: 4 }}>
                          <Text strong>{log.action}</Text>
                          <Text type="secondary" style={{ marginLeft: 12, fontSize: 12 }}>
                            {log.time}
                          </Text>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary">操作人：{log.operator}</Text>
                        </div>
                        <div>
                          <Text>{log.detail}</Text>
                        </div>
                      </div>
                    )
                  }))}
                />
              </Card>
            </div>
          </Space>
        </Col>
      </Row>
      </div>

      {/* 费用录入弹窗 */}
      <Modal
        title="录入入仓费用"
        open={feeModalVisible}
        onCancel={() => {
          setFeeModalVisible(false);
          feeForm.resetFields();
        }}
        onOk={handleSubmitFee}
        width={600}
      >
        <Form form={feeForm} layout="vertical">
          <Form.Item
            name="category"
            label="费用类别"
            rules={[{ required: true, message: '请选择费用类别' }]}
          >
            <Select placeholder="选择费用类别">
              <Select.Option value="清关费">清关费</Select.Option>
              <Select.Option value="仓储费">仓储费</Select.Option>
              <Select.Option value="装卸费">装卸费</Select.Option>
              <Select.Option value="其他费用">其他费用</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="item"
            label="费用项目"
            rules={[{ required: true, message: '请输入费用项目' }]}
          >
            <Input placeholder="例如：进口清关" />
          </Form.Item>

          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="0.00"
            />
          </Form.Item>

          <Form.Item
            name="currency"
            label="币种"
            rules={[{ required: true, message: '请选择币种' }]}
            initialValue="USD"
          >
            <Select>
              <Select.Option value="USD">USD</Select.Option>
              <Select.Option value="CNY">CNY</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="费用状态"
            rules={[{ required: true, message: '请选择费用状态' }]}
            initialValue="PENDING"
          >
            <Select>
              <Select.Option value="PENDING">待确认</Select.Option>
              <Select.Option value="CONFIRMED">已确认</Select.Option>
              <Select.Option value="PAID">已支付</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

    </Drawer>
  );
};
