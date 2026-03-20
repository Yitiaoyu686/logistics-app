import React, { useRef, useState } from 'react';
import {
  Card, Descriptions, Tag, Button, Space, Timeline, Table,
  Row, Col, Typography, Badge, Modal, Form, Select, Input,
  message, InputNumber, Divider, Drawer
} from 'antd';
import {
  TruckOutlined, EnvironmentOutlined,
  CheckCircleOutlined, ClockCircleOutlined, HistoryOutlined,
  EditOutlined, DeleteOutlined, ExclamationCircleOutlined,
  PlusOutlined, WarningOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface DeliveryDetailProps {
  visible: boolean;
  deliveryId: string;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

// 费用记录
interface DeliveryFee {
  id: number;
  category: string;
  item: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'PAID';
  createdAt: string;
  operator: string;
}

// 模拟详情数据
const getMockDetailData = (deliveryId: string) => ({
  id: deliveryId,
  deliveryNo: 'DLV-20240120-001',
  orderIds: ['ORD001', 'ORD002', 'ORD003'],
  orderCount: 3,
  totalPieces: 45,
  totalWeight: 285.8,
  carrier: 'UPS',
  trackingNo: '1Z999AA10123456784',
  status: 'IN_TRANSIT' as string,
  receiverName: 'John Smith',
  receiverPhone: '+1 626-123-4567',
  receiverAddress: '1234 Main St, Los Angeles, CA 90001',
  deliveryFee: 150.00,
  estimatedDeliveryTime: '2024-01-25 17:00:00',
  actualDeliveryTime: null as string | null,
  driverName: 'Mike Wilson',
  driverPhone: '+1 626-888-1234',
  driverPlate: 'CA-7J12345',
  operator: '李配送',
  remark: '请在工作日配送',
  createdAt: '2024-01-20 10:00:00',
  updatedAt: '2024-01-22 14:30:00',
  orders: [
    { id: 'ORD001', trackingNo: 'TRK001', clientName: '客户A', pieces: 15, weight: 75.5, volume: 1.2, status: '配送中' },
    { id: 'ORD002', trackingNo: 'TRK002', clientName: '客户B', pieces: 18, weight: 90.3, volume: 1.5, status: '配送中' },
    { id: 'ORD003', trackingNo: 'TRK003', clientName: '客户C', pieces: 12, weight: 60.0, volume: 0.8, status: '配送中' }
  ],
  fees: [
    { id: 1, category: '配送费', item: 'UPS标准配送', amount: 150.00, currency: 'USD', status: 'CONFIRMED' as const, createdAt: '2024-01-20 10:00', operator: '李配送' },
    { id: 2, category: '附加费', item: '偏远地区附加费', amount: 25.00, currency: 'USD', status: 'PENDING' as const, createdAt: '2024-01-20 10:05', operator: '李配送' }
  ] as DeliveryFee[],
  trackingHistory: [
    { time: '2024-01-22 14:30', status: '运输中', location: 'Los Angeles, CA - Distribution Center', description: '包裹已到达洛杉矶配送中心' },
    { time: '2024-01-21 18:00', status: '运输中', location: 'San Francisco, CA - Hub', description: '包裹已从旧金山中转站发出' },
    { time: '2024-01-21 10:00', status: '揽收', location: 'San Francisco, CA - Warehouse', description: 'UPS已揽收包裹' },
    { time: '2024-01-20 10:00', status: '创建', location: '系统', description: '配送单已创建' }
  ],
  logs: [
    { time: '2024-01-22 14:30', operator: '系统', action: '状态更新', detail: '更新配送状态为"运输中"' },
    { time: '2024-01-21 10:00', operator: '系统', action: '揽收确认', detail: 'UPS已揽收包裹' },
    { time: '2024-01-20 10:05', operator: '李配送', action: '费用录入', detail: '录入偏远地区附加费 $25.00' },
    { time: '2024-01-20 10:00', operator: '李配送', action: '创建配送单', detail: '创建配送单 DLV-20240120-001' }
  ]
});

const STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待配送', color: 'default' },
  IN_TRANSIT: { text: '配送中', color: 'processing' },
  DELIVERED: { text: '已送达', color: 'success' },
  EXCEPTION: { text: '异常', color: 'error' },
  CANCELLED: { text: '已取消', color: 'default' }
};

const FEE_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待确认', color: 'default' },
  CONFIRMED: { text: '已确认', color: 'processing' },
  PAID: { text: '已支付', color: 'success' }
};

// 左侧导航项
const NAV_ITEMS = [
  { key: 'basic', title: '基本信息' },
  { key: 'delivery', title: '配送信息' },
  { key: 'orders', title: '订单列表' },
  { key: 'tracking', title: '配送追踪' },
  { key: 'fees', title: '费用信息' },
  { key: 'logs', title: '操作日志' }
];

export const DeliveryDetail: React.FC<DeliveryDetailProps> = ({ visible, deliveryId, onClose, onDelete, onEdit }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(getMockDetailData(deliveryId));

  // 更新状态 Modal
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusForm] = Form.useForm();

  // 确认送达 Modal
  const [deliverModalVisible, setDeliverModalVisible] = useState(false);
  const [deliverForm] = Form.useForm();

  // 异常上报 Modal
  const [exceptionModalVisible, setExceptionModalVisible] = useState(false);
  const [exceptionForm] = Form.useForm();

  // 费用录入 Modal
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [feeForm] = Form.useForm();

  // 锚点导航
  const handleNavClick = (key: string) => {
    const element = contentRef.current?.querySelector<HTMLElement>(`#${key}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 更新状态
  const handleUpdateStatus = async () => {
    try {
      const values = await statusForm.validateFields();
      const newTracking = {
        time: dayjs().format('YYYY-MM-DD HH:mm'),
        status: values.nodeStatus,
        location: values.location || '',
        description: values.description || ''
      };
      setData({
        ...data,
        status: values.newStatus,
        trackingHistory: [newTracking, ...data.trackingHistory],
        logs: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '状态更新', detail: `更新配送状态为"${STATUS_CONFIG[values.newStatus]?.text}"` },
          ...data.logs
        ],
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });
      message.success('配送状态已更新');
      setStatusModalVisible(false);
      statusForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 确认送达
  const handleConfirmDeliver = async () => {
    try {
      const values = await deliverForm.validateFields();
      setData({
        ...data,
        status: 'DELIVERED',
        actualDeliveryTime: values.actualDeliveryTime?.format('YYYY-MM-DD HH:mm:ss') || dayjs().format('YYYY-MM-DD HH:mm:ss'),
        trackingHistory: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), status: '已签收', location: data.receiverAddress, description: values.remark || '收货人已签收' },
          ...data.trackingHistory
        ],
        logs: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '确认送达', detail: values.remark || '确认包裹已送达' },
          ...data.logs
        ],
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });
      message.success('已确认送达');
      setDeliverModalVisible(false);
      deliverForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 异常上报
  const handleReportException = async () => {
    try {
      const values = await exceptionForm.validateFields();
      setData({
        ...data,
        status: 'EXCEPTION',
        trackingHistory: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), status: '异常', location: values.location || '', description: values.reason },
          ...data.trackingHistory
        ],
        logs: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '异常上报', detail: `异常类型: ${values.exceptionType}，原因: ${values.reason}` },
          ...data.logs
        ],
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });
      message.success('异常已上报');
      setExceptionModalVisible(false);
      exceptionForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 添加费用
  const handleAddFee = async () => {
    try {
      const values = await feeForm.validateFields();
      const newFee: DeliveryFee = {
        id: data.fees.length + 1,
        category: values.category,
        item: values.item,
        amount: values.amount,
        currency: values.currency,
        status: 'PENDING',
        createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
        operator: '当前用户'
      };
      setData({
        ...data,
        fees: [...data.fees, newFee],
        logs: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '费用录入', detail: `录入${values.category} ${values.currency} ${values.amount.toFixed(2)}` },
          ...data.logs
        ]
      });
      message.success('费用添加成功');
      setFeeModalVisible(false);
      feeForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 删除配送单
  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除配送单 ${data.deliveryNo} 吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      onOk: () => {
        message.success('配送单已删除');
        onDelete?.(data.id);
        onClose();
      }
    });
  };

  // 订单列表列定义
  const orderColumns = [
    { title: '运单号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '第三方运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 120 },
    { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 120 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' as const },
    { title: '重量(kg)', dataIndex: 'weight', key: 'weight', width: 100 },
    { title: '体积(CBM)', dataIndex: 'volume', key: 'volume', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color="processing">{status}</Tag>
    }
  ];

  // 费用列表列定义
  const feeColumns = [
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 140 },
    { title: '费用类别', dataIndex: 'category', key: 'category', width: 120 },
    { title: '费用项目', dataIndex: 'item', key: 'item', width: 180 },
    {
      title: '金额',
      key: 'amount',
      width: 120,
      render: (record: DeliveryFee) => `${record.currency} ${record.amount.toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = FEE_STATUS_CONFIG[status];
        return <Tag color={config?.color}>{config?.text}</Tag>;
      }
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 }
  ];

  const totalFee = data.fees.reduce((sum, f) => sum + f.amount, 0);
  const statusConfig = STATUS_CONFIG[data.status] || STATUS_CONFIG.PENDING;

  return (
    <Drawer
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>{data.deliveryNo}</Title>
          <Tag color={statusConfig.color} style={{ fontSize: 14, padding: '2px 12px' }}>
            {statusConfig.text}
          </Tag>
          {data.status === 'EXCEPTION' && (
            <Tag color="error" icon={<WarningOutlined />}>需处理</Tag>
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
          {data.status === 'PENDING' && (
            <Button icon={<EditOutlined />} onClick={() => onEdit?.(data.id)}>
              编辑
            </Button>
          )}
          {(data.status === 'PENDING' || data.status === 'IN_TRANSIT') && (
            <Button onClick={() => setStatusModalVisible(true)}>更新状态</Button>
          )}
          {data.status === 'IN_TRANSIT' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setDeliverModalVisible(true)}>
              确认送达
            </Button>
          )}
          {(data.status === 'PENDING' || data.status === 'IN_TRANSIT') && (
            <Button danger icon={<WarningOutlined />} onClick={() => setExceptionModalVisible(true)}>
              异常上报
            </Button>
          )}
          {data.status === 'PENDING' && (
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              删除
            </Button>
          )}
        </Space>
      }
    >

      {/* 主体内容 - 左侧导航+右侧单列布局 */}
      <div ref={contentRef} style={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto', paddingRight: 4 }}>
      <Row gutter={16}>
        {/* 左侧锚点导航 */}
        <Col span={3}>
          <div style={{ position: 'sticky', top: 100 }}>
            <div style={{
              background: '#fafafa',
              borderRadius: 4,
              padding: '8px 0'
            }}>
              {NAV_ITEMS.map(item => (
                <div
                  key={item.key}
                  onClick={() => handleNavClick(item.key)}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: '#666',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f5f5f5';
                    e.currentTarget.style.color = '#1890ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#666';
                  }}
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        </Col>

        {/* 右侧主要内容 */}
        <Col span={21}>
          {/* 基本信息 */}
          <Card id="basic" title="基本信息" bordered={false} style={{ marginBottom: 16 }}>
            <Descriptions column={3} size="small">
              <Descriptions.Item label="配送单号">
                <Text strong>{data.deliveryNo}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="操作人">{data.operator}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(data.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {data.updatedAt ? dayjs(data.updatedAt).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="关联订单数">
                <Badge count={data.orderCount} style={{ backgroundColor: '#1890ff' }} /> 票
              </Descriptions.Item>
              {data.remark && (
                <Descriptions.Item label="备注" span={3}>{data.remark}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* 配送信息 */}
          <Card id="delivery" title="配送信息" bordered={false} style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col span={12}>
                <Descriptions column={1} size="small" labelStyle={{ width: 100 }}>
                  <Descriptions.Item label="配送公司">
                    <Space>
                      <TruckOutlined />
                      <Text strong>{data.carrier}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="追踪号">
                    <Text copyable style={{ fontFamily: 'monospace' }}>{data.trackingNo}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="司机">
                    {data.driverName ? (
                      <span>{data.driverName} {data.driverPhone && <Text type="secondary">({data.driverPhone})</Text>}</span>
                    ) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="车牌号">
                    {data.driverPlate || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="预计送达">
                    {data.estimatedDeliveryTime ? dayjs(data.estimatedDeliveryTime).format('YYYY-MM-DD HH:mm') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="实际送达">
                    {data.actualDeliveryTime ? (
                      <Text type="success">{dayjs(data.actualDeliveryTime).format('YYYY-MM-DD HH:mm')}</Text>
                    ) : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={12}>
                <Descriptions column={1} size="small" labelStyle={{ width: 100 }}>
                  <Descriptions.Item label="收货人">
                    <Text strong>{data.receiverName}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="联系电话">{data.receiverPhone}</Descriptions.Item>
                  <Descriptions.Item label="收货地址">
                    <Space>
                      <EnvironmentOutlined style={{ color: '#1890ff' }} />
                      {data.receiverAddress}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
            <Divider style={{ margin: '10px 0 8px' }} />
            <div className="compact-stats">
              <Tag color="blue">总件 {Number(data.totalPieces || 0)}</Tag>
              <Tag>总重 {Number(data.totalWeight || 0).toFixed(1)}Kg</Tag>
              <Tag color="orange">配送费 USD {Number(data.deliveryFee || 0).toFixed(2)}</Tag>
              <Tag color="blue">关联订单 {Number(data.orderCount || 0)}</Tag>
            </div>
          </Card>

          {/* 订单列表 */}
          <Card
            id="orders"
            title={<span>订单列表 <Badge count={data.orderCount} style={{ marginLeft: 8, backgroundColor: '#1890ff' }} /></span>}
            bordered={false}
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="id"
              columns={orderColumns}
              dataSource={data.orders}
              pagination={false}
              size="small"
            />
          </Card>

          {/* 配送追踪 */}
          <Card id="tracking" title="配送追踪" bordered={false} style={{ marginBottom: 16 }}>
            {data.trackingHistory.length > 0 ? (
              <Timeline>
                {data.trackingHistory.map((track, index) => (
                  <Timeline.Item
                    key={index}
                    color={index === 0 ? 'green' : 'gray'}
                    dot={index === 0 ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong>{track.status}</Text>
                        <Text type="secondary">{track.time}</Text>
                      </div>
                      {track.location && (
                        <div style={{ color: '#1890ff', fontSize: 13, marginBottom: 4 }}>
                          <EnvironmentOutlined /> {track.location}
                        </div>
                      )}
                      <div style={{ color: '#666' }}>{track.description}</div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>暂无追踪信息</div>
            )}
          </Card>

          {/* 费用信息 */}
          <Card
            id="fees"
            title="费用信息"
            bordered={false}
            style={{ marginBottom: 16 }}
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setFeeModalVisible(true)}>
                添加费用
              </Button>
            }
          >
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>总费用: </Text>
              <Text type="danger" style={{ fontSize: 20, fontWeight: 'bold' }}>
                USD {totalFee.toFixed(2)}
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

          {/* 操作日志 */}
          <Card id="logs" title={<span><HistoryOutlined /> 操作日志</span>} bordered={false}>
            <Timeline>
              {data.logs.map((log, index) => (
                <Timeline.Item
                  key={index}
                  color={index === 0 ? 'green' : 'gray'}
                >
                  <div style={{ marginBottom: 8 }}>
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
          </Card>
        </Col>
      </Row>
      </div>

      {/* 更新状态 Modal */}
      <Modal
        title="更新配送状态"
        open={statusModalVisible}
        onCancel={() => { setStatusModalVisible(false); statusForm.resetFields(); }}
        onOk={handleUpdateStatus}
        width={600}
        destroyOnClose
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item name="newStatus" label="配送状态" rules={[{ required: true, message: '请选择配送状态' }]}>
            <Select placeholder="选择新的配送状态">
              <Select.Option value="PENDING">待配送</Select.Option>
              <Select.Option value="IN_TRANSIT">配送中</Select.Option>
              <Select.Option value="DELIVERED">已送达</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="nodeStatus" label="节点状态" rules={[{ required: true, message: '请输入节点状态' }]}>
            <Input placeholder="例如: 运输中、已签收、揽收等" />
          </Form.Item>
          <Form.Item name="location" label="当前位置">
            <Input placeholder="例如: Los Angeles, CA - Distribution Center" />
          </Form.Item>
          <Form.Item name="description" label="详细说明">
            <TextArea rows={3} placeholder="例如: 包裹已到达配送中心，等待派送" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 确认送达 Modal */}
      <Modal
        title="确认送达"
        open={deliverModalVisible}
        onCancel={() => { setDeliverModalVisible(false); deliverForm.resetFields(); }}
        onOk={handleConfirmDeliver}
        width={500}
        destroyOnClose
      >
        <Form form={deliverForm} layout="vertical">
          <Form.Item name="actualDeliveryTime" label="实际送达时间">
            <Input placeholder="留空则默认为当前时间" disabled value={dayjs().format('YYYY-MM-DD HH:mm')} />
          </Form.Item>
          <Form.Item name="remark" label="签收备注">
            <TextArea rows={3} placeholder="例如: 收货人本人签收" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 异常上报 Modal */}
      <Modal
        title="异常上报"
        open={exceptionModalVisible}
        onCancel={() => { setExceptionModalVisible(false); exceptionForm.resetFields(); }}
        onOk={handleReportException}
        okType="danger"
        okText="提交异常"
        width={600}
        destroyOnClose
      >
        <Form form={exceptionForm} layout="vertical">
          <Form.Item name="exceptionType" label="异常类型" rules={[{ required: true, message: '请选择异常类型' }]}>
            <Select placeholder="选择异常类型">
              <Select.Option value="地址错误">地址错误</Select.Option>
              <Select.Option value="无人签收">无人签收</Select.Option>
              <Select.Option value="拒收">拒收</Select.Option>
              <Select.Option value="货物损坏">货物损坏</Select.Option>
              <Select.Option value="货物丢失">货物丢失</Select.Option>
              <Select.Option value="派送延迟">派送延迟</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="location" label="异常发生地点">
            <Input placeholder="例如: Los Angeles, CA" />
          </Form.Item>
          <Form.Item name="reason" label="异常详细说明" rules={[{ required: true, message: '请输入异常原因' }]}>
            <TextArea rows={4} placeholder="请详细描述异常情况" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 费用录入 Modal */}
      <Modal
        title="添加费用"
        open={feeModalVisible}
        onCancel={() => { setFeeModalVisible(false); feeForm.resetFields(); }}
        onOk={handleAddFee}
        width={600}
        destroyOnClose
      >
        <Form form={feeForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="费用类别" rules={[{ required: true, message: '请选择费用类别' }]}>
                <Select placeholder="选择费用类别">
                  <Select.Option value="配送费">配送费</Select.Option>
                  <Select.Option value="附加费">附加费</Select.Option>
                  <Select.Option value="包装费">包装费</Select.Option>
                  <Select.Option value="保险费">保险费</Select.Option>
                  <Select.Option value="退件费">退件费</Select.Option>
                  <Select.Option value="其他">其他</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="item" label="费用项目" rules={[{ required: true, message: '请输入费用项目' }]}>
                <Input placeholder="例如: UPS标准配送费" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" prefix="$" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]} initialValue="USD">
                <Select>
                  <Select.Option value="USD">USD (美元)</Select.Option>
                  <Select.Option value="CNY">CNY (人民币)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Drawer>
  );
};
