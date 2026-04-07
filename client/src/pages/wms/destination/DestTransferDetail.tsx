import React, { useRef, useState } from 'react';
import {
  Card, Descriptions, Tag, Button, Space, Timeline, Table,
  Row, Col, Typography, Badge, Modal, Form, Input, Steps,
  message, Divider, Drawer, InputNumber, Select
} from 'antd';
import {
  TruckOutlined, CheckCircleOutlined, HistoryOutlined,
  EditOutlined, DeleteOutlined, ExclamationCircleOutlined,
  PlusOutlined, EnvironmentOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface DestTransferDetailProps {
  visible: boolean;
  transferId: string;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
}

// 费用记录
interface TransferFee {
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
const getMockDetailData = (transferId: string) => ({
  id: transferId,
  transferNo: 'S-T-20240120-0001',
  direction: 'BRANCH_TO_MAIN' as string,
  fromWarehouse: 'US分仓A',
  fromWarehouseLabel: 'US分仓A（纽约）',
  toWarehouse: 'US总仓',
  toWarehouseLabel: 'US总仓（洛杉矶）',
  shippingMethod: 'VIA_MAIN' as string,
  shippingUnitNo: null as string | null,
  logisticsType: 'THIRD_PARTY' as string,
  carrier: 'UPS',
  logisticsTrackingNo: '1Z999AA10123456799',
  driverName: null as string | null,
  driverPhone: null as string | null,
  driverPlate: null as string | null,
  orderCount: 3,
  totalPieces: 45,
  totalWeight: 320.5,
  status: 'IN_TRANSIT' as string,
  operator: '张仓管',
  remark: '常规调拨',
  createdAt: '2024-01-15 10:00:00',
  shippedAt: '2024-01-15 14:00:00',
  arrivedAt: null as string | null,
  confirmedAt: null as string | null,
  updatedAt: '2024-01-15 14:00:00',
  // 订单列表
  orders: [
    { id: 'ORD-001', trackingNo: 'TRK-001', clientName: '客户A', pieces: 15, weight: 75.5, warehouseLocation: 'US-MAIN-A-01', status: '运输中' },
    { id: 'ORD-002', trackingNo: 'TRK-002', clientName: '客户B', pieces: 18, weight: 90.3, warehouseLocation: 'US-MAIN-A-02', status: '运输中' },
    { id: 'ORD-003', trackingNo: 'TRK-003', clientName: '客户C', pieces: 12, weight: 60.0, warehouseLocation: 'US-MAIN-B-01', status: '运输中' }
  ],
  // 费用
  fees: [
    { id: 1, category: '运输费', item: 'UPS陆运', amount: 280.00, currency: 'USD', status: 'CONFIRMED' as const, createdAt: '2024-01-15 10:00', operator: '张仓管' },
    { id: 2, category: '操作费', item: '装卸费', amount: 50.00, currency: 'USD', status: 'PENDING' as const, createdAt: '2024-01-15 10:05', operator: '张仓管' }
  ] as TransferFee[],
  // 操作日志
  logs: [
    { time: '2024-01-15 14:00', operator: '张仓管', action: '确认发运', detail: '货物已发运，UPS揽收' },
    { time: '2024-01-15 10:05', operator: '张仓管', action: '费用录入', detail: '录入装卸费 USD 50.00' },
    { time: '2024-01-15 10:00', operator: '张仓管', action: '创建调拨单', detail: '创建调拨单 S-T-20240120-0001，分仓A → 总仓' }
  ]
});

const STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待发运', color: 'default' },
  IN_TRANSIT: { text: '运输中', color: 'processing' },
  ARRIVED: { text: '已到达', color: 'warning' },
  CONFIRMED: { text: '已确认', color: 'success' }
};

const FEE_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待确认', color: 'default' },
  CONFIRMED: { text: '已确认', color: 'processing' },
  PAID: { text: '已支付', color: 'success' }
};

// 左侧导航项
const NAV_ITEMS = [
  { key: 'basic', title: '基本信息' },
  { key: 'logistics', title: '物流信息' },
  { key: 'orders', title: '调拨订单' },
  { key: 'progress', title: '流程进度' },
  { key: 'fees', title: '费用信息' },
  { key: 'logs', title: '操作记录' }
];

export const DestTransferDetail: React.FC<DestTransferDetailProps> = ({
  visible, transferId, onClose, onDelete, onEdit, onStatusChange
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(getMockDetailData(transferId));

  // 费用录入 Modal
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [feeForm] = Form.useForm();

  // 锚点导航
  const handleNavClick = (key: string) => {
    const el = contentRef.current?.querySelector<HTMLElement>(`#transfer-${key}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 确认发运
  const handleShip = () => {
    Modal.confirm({
      title: '确认发运',
      content: `确定将调拨单 ${data.transferNo} 标记为已发运？`,
      onOk: () => {
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        setData({
          ...data,
          status: 'IN_TRANSIT',
          shippedAt: now,
          updatedAt: now,
          logs: [
            { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '确认发运', detail: '货物已发运' },
            ...data.logs
          ]
        });
        onStatusChange?.(data.id, 'IN_TRANSIT');
        message.success('已确认发运');
      }
    });
  };

  // 确认到达
  const handleArrive = () => {
    Modal.confirm({
      title: '确认到达',
      content: `确定货物已到达 ${data.toWarehouse}？`,
      onOk: () => {
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        setData({
          ...data,
          status: 'ARRIVED',
          arrivedAt: now,
          updatedAt: now,
          logs: [
            { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '确认到达', detail: `货物已到达 ${data.toWarehouse}` },
            ...data.logs
          ]
        });
        onStatusChange?.(data.id, 'ARRIVED');
        message.success('已确认到达');
      }
    });
  };

  // 确认入库
  const handleConfirmInbound = () => {
    Modal.confirm({
      title: '确认入库',
      content: `确定货物已入库到 ${data.toWarehouse}？`,
      onOk: () => {
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        setData({
          ...data,
          status: 'CONFIRMED',
          confirmedAt: now,
          updatedAt: now,
          logs: [
            { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '确认入库', detail: `货物已入库 ${data.toWarehouse}` },
            ...data.logs
          ]
        });
        onStatusChange?.(data.id, 'CONFIRMED');
        message.success('已确认入库');
      }
    });
  };

  // 删除
  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除调拨单 ${data.transferNo}？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      onOk: () => {
        message.success('调拨单已删除');
        onDelete?.(data.id);
        onClose();
      }
    });
  };

  // 添加费用
  const handleAddFee = async () => {
    try {
      const values = await feeForm.validateFields();
      const newFee: TransferFee = {
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

  // 订单列表列
  const orderColumns = [
    { title: '运单号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '第三方运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 100 },
    { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 80 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 60, align: 'center' as const },
    { title: '重量(kg)', dataIndex: 'weight', key: 'weight', width: 80 },
    { title: '库位', dataIndex: 'warehouseLocation', key: 'warehouseLocation', width: 120 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => <Tag color="processing">{s}</Tag>
    }
  ];

  // 费用列表列
  const feeColumns = [
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 140 },
    { title: '费用类别', dataIndex: 'category', key: 'category', width: 100 },
    { title: '费用项目', dataIndex: 'item', key: 'item' },
    {
      title: '金额', key: 'amount', width: 120,
      render: (r: TransferFee) => `${r.currency} ${r.amount.toFixed(2)}`
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => {
        const c = FEE_STATUS_CONFIG[s];
        return <Tag color={c?.color}>{c?.text}</Tag>;
      }
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 80 }
  ];

  const totalFee = data.fees.reduce((sum, f) => sum + f.amount, 0);
  const statusConfig = STATUS_CONFIG[data.status] || STATUS_CONFIG.PENDING;

  const stepCurrent = data.status === 'PENDING' ? 0 : data.status === 'IN_TRANSIT' ? 1 : data.status === 'ARRIVED' ? 2 : 3;

  return (
    <Drawer
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>{data.transferNo}</Title>
          <Tag color={statusConfig.color} style={{ fontSize: 14, padding: '2px 12px' }}>
            {statusConfig.text}
          </Tag>
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
            <>
              <Button icon={<EditOutlined />} onClick={() => onEdit?.(data.id)}>编辑</Button>
              <Button type="primary" onClick={handleShip}>确认发运</Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
            </>
          )}
          {data.status === 'IN_TRANSIT' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleArrive}>确认到达</Button>
          )}
          {data.status === 'ARRIVED' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleConfirmInbound}>确认入库</Button>
          )}
        </Space>
      }
    >
      <div ref={contentRef} style={{ maxHeight: 'calc(100vh - 180px)', overflow: 'auto', paddingRight: 4 }}>
      <Row gutter={16}>
        {/* 左侧导航 */}
        <Col span={3}>
          <div style={{ position: 'sticky', top: 100 }}>
            <div style={{ background: '#fafafa', borderRadius: 4, padding: '8px 0' }}>
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
          {/* 基本信息 */}
          <Card id="transfer-basic" title="基本信息" bordered={false} style={{ marginBottom: 16 }}>
            <Descriptions column={3} size="small">
              <Descriptions.Item label="调拨单号"><Text strong>{data.transferNo}</Text></Descriptions.Item>
              <Descriptions.Item label="状态"><Tag color={statusConfig.color}>{statusConfig.text}</Tag></Descriptions.Item>
              <Descriptions.Item label="操作人">{data.operator}</Descriptions.Item>
              <Descriptions.Item label="调拨方向">
                <Text strong>
                  {data.direction === 'BRANCH_TO_MAIN' ? '分仓 → 总仓' : '总仓 → 分仓'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="来源仓库">
                <Space><EnvironmentOutlined style={{ color: '#faad14' }} />{data.fromWarehouseLabel}</Space>
              </Descriptions.Item>
              <Descriptions.Item label="去向仓库">
                <Space><EnvironmentOutlined style={{ color: '#52c41a' }} />{data.toWarehouseLabel}</Space>
              </Descriptions.Item>
              <Descriptions.Item label="运输方式">
                {data.shippingMethod === 'DIRECT' ? (
                  <Space><Tag color="blue">集装箱直达</Tag>{data.shippingUnitNo && <Text code>{data.shippingUnitNo}</Text>}</Space>
                ) : <Tag>经总仓中转</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(data.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{data.updatedAt ? dayjs(data.updatedAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              {data.remark && <Descriptions.Item label="备注" span={3}>{data.remark}</Descriptions.Item>}
            </Descriptions>
            <Divider style={{ margin: '10px 0 8px' }} />
            <div className="compact-stats">
              <Tag color="blue">订单 {Number(data.orderCount || 0)}</Tag>
              <Tag>件数 {Number(data.totalPieces || 0)}</Tag>
              <Tag color="orange">重量 {Number(data.totalWeight || 0).toFixed(1)}Kg</Tag>
              <Tag color="blue">费用 USD {totalFee.toFixed(2)}</Tag>
            </div>
          </Card>

          {/* 物流信息 */}
          <Card id="transfer-logistics" title="物流信息" bordered={false} style={{ marginBottom: 16 }}>
            {data.logisticsType === 'THIRD_PARTY' ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="配送方式"><Tag color="blue">第三方物流</Tag></Descriptions.Item>
                <Descriptions.Item label="物流公司">
                  <Space><TruckOutlined /><Text strong>{data.carrier}</Text></Space>
                </Descriptions.Item>
                <Descriptions.Item label="物流追踪号">
                  {data.logisticsTrackingNo ? <Text copyable style={{ fontFamily: 'monospace' }}>{data.logisticsTrackingNo}</Text> : '-'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="配送方式"><Tag color="green">自有司机</Tag></Descriptions.Item>
                <Descriptions.Item label="司机姓名"><Text strong>{data.driverName || '-'}</Text></Descriptions.Item>
                <Descriptions.Item label="司机电话">{data.driverPhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="车牌号">{data.driverPlate || '-'}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          {/* 调拨订单 */}
          <Card
            id="transfer-orders"
            title={<span>调拨订单 <Badge count={data.orderCount} style={{ marginLeft: 8, backgroundColor: '#1890ff' }} /></span>}
            bordered={false}
            style={{ marginBottom: 16 }}
          >
            <Table rowKey="id" columns={orderColumns} dataSource={data.orders} pagination={false} size="small" scroll={{ x: 760 }} />
          </Card>

          {/* 流程进度 */}
          <Card id="transfer-progress" title="流程进度" bordered={false} style={{ marginBottom: 16 }}>
            <Steps
              current={stepCurrent}
              items={[
                { title: '创建', description: data.createdAt ? dayjs(data.createdAt).format('MM-DD HH:mm') : '-' },
                { title: '发运', description: data.shippedAt ? dayjs(data.shippedAt).format('MM-DD HH:mm') : '-' },
                { title: '到达', description: data.arrivedAt ? dayjs(data.arrivedAt).format('MM-DD HH:mm') : '-' },
                { title: '确认入库', description: data.confirmedAt ? dayjs(data.confirmedAt).format('MM-DD HH:mm') : '-' }
              ]}
            />
          </Card>

          {/* 费用信息 */}
          <Card
            id="transfer-fees"
            title="费用信息"
            bordered={false}
            style={{ marginBottom: 16 }}
            extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setFeeModalVisible(true)}>添加费用</Button>}
          >
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>总费用: </Text>
              <Text type="danger" style={{ fontSize: 20, fontWeight: 'bold' }}>USD {totalFee.toFixed(2)}</Text>
            </div>
            <Table rowKey="id" columns={feeColumns} dataSource={data.fees} pagination={false} size="small" scroll={{ x: 760 }} />
          </Card>

          {/* 操作记录 */}
          <Card id="transfer-logs" title={<span><HistoryOutlined /> 操作记录</span>} bordered={false}>
            <Timeline>
              {data.logs.map((log, index) => (
                <Timeline.Item key={index} color={index === 0 ? 'green' : 'gray'}>
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
                  <Select.Option value="运输费">运输费</Select.Option>
                  <Select.Option value="操作费">操作费</Select.Option>
                  <Select.Option value="包装费">包装费</Select.Option>
                  <Select.Option value="保险费">保险费</Select.Option>
                  <Select.Option value="附加费">附加费</Select.Option>
                  <Select.Option value="其他">其他</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="item" label="费用项目" rules={[{ required: true, message: '请输入费用项目' }]}>
                <Input placeholder="例如: UPS陆运费" />
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
              <Form.Item name="currency" label="币种" rules={[{ required: true }]} initialValue="USD">
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
