import React, { useState } from 'react';
import {
  Card, Descriptions, Tag, Button, Space, Timeline, Table,
  Tabs, Row, Col, Typography, Badge, Modal, Form, Select, Input, message, DatePicker
} from 'antd';
import {
  LeftOutlined, TruckOutlined, EnvironmentOutlined,
  CheckCircleOutlined, ClockCircleOutlined, HistoryOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface DeliveryDetailProps {
  deliveryId: string;
  onBack: () => void;
}

// 模拟详情数据
const getMockDetailData = (deliveryId: string) => ({
  id: deliveryId,
  deliveryNo: 'DLV-20240120-001',
  orderIds: ['ORD001', 'ORD002', 'ORD003'],
  orderCount: 3,
  totalPieces: 45,
  carrier: 'UPS',
  trackingNo: '1Z999AA10123456784',
  status: 'IN_TRANSIT',
  receiverName: 'John Smith',
  receiverPhone: '+1 626-123-4567',
  receiverAddress: '1234 Main St, Los Angeles, CA 90001',
  deliveryFee: 150.00,
  estimatedDeliveryTime: '2024-01-25 17:00:00',
  actualDeliveryTime: null,
  operator: '李配送',
  remark: '请在工作日配送',
  createdAt: '2024-01-20 10:00:00',
  updatedAt: '2024-01-22 14:30:00',
  orders: [
    { id: 'ORD001', trackingNo: 'TRK001', clientName: '客户A', pieces: 15, weight: 75.5, status: '配送中' },
    { id: 'ORD002', trackingNo: 'TRK002', clientName: '客户B', pieces: 18, weight: 90.3, status: '配送中' },
    { id: 'ORD003', trackingNo: 'TRK003', clientName: '客户C', pieces: 12, weight: 60.0, status: '配送中' }
  ],
  trackingHistory: [
    { time: '2024-01-22 14:30', status: '运输中', location: 'Los Angeles, CA - Distribution Center', description: '包裹已到达洛杉矶配送中心' },
    { time: '2024-01-21 18:00', status: '运输中', location: 'San Francisco, CA - Hub', description: '包裹已从旧金山中转站发出' },
    { time: '2024-01-21 10:00', status: '揽收', location: 'San Francisco, CA - Warehouse', description: 'UPS已揽收包裹' },
    { time: '2024-01-20 10:00', status: '创建', location: '系统', description: '配送单已创建' }
  ],
  logs: [
    { time: '2024-01-22 14:30', operator: '系统', action: '状态更新', detail: '更新配送状态为"运输中"' },
    { time: '2024-01-21 10:00', operator: '系统', action: '状态更新', detail: 'UPS已揽收包裹' },
    { time: '2024-01-20 10:00', operator: '李配送', action: '创建配送单', detail: '创建配送单 DLV-20240120-001' }
  ]
});

const STATUS_CONFIG = {
  PENDING: { text: '待配送', color: 'default' },
  IN_TRANSIT: { text: '配送中', color: 'processing' },
  DELIVERED: { text: '已送达', color: 'success' },
  EXCEPTION: { text: '异常', color: 'error' },
  CANCELLED: { text: '已取消', color: 'default' }
};

export const DeliveryDetail: React.FC<DeliveryDetailProps> = ({ deliveryId, onBack }) => {
  const [data, setData] = useState(getMockDetailData(deliveryId));
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusForm] = Form.useForm();

  // 更新状态
  const handleUpdateStatus = async () => {
    try {
      const values = await statusForm.validateFields();

      const newTracking = {
        time: dayjs().format('YYYY-MM-DD HH:mm'),
        status: values.status,
        location: values.location || '',
        description: values.description || ''
      };

      setData({
        ...data,
        status: values.newStatus,
        trackingHistory: [newTracking, ...data.trackingHistory],
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });

      message.success('配送状态已更新');
      setStatusModalVisible(false);
      statusForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 订单列表列定义
  const orderColumns = [
    { title: '订单号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '运单号', dataIndex: 'trackingNo', key: 'trackingNo', width: 120 },
    { title: '客户', dataIndex: 'clientName', key: 'clientName', width: 120 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' as const },
    { title: '重量(kg)', dataIndex: 'weight', key: 'weight', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color="processing">{status}</Tag>
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f5f7fa', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={onBack}>返回列表</Button>
          <Title level={4} style={{ margin: 0 }}>
            配送单详情: {data.deliveryNo}
          </Title>
          <Tag color={STATUS_CONFIG[data.status as keyof typeof STATUS_CONFIG].color}>
            {STATUS_CONFIG[data.status as keyof typeof STATUS_CONFIG].text}
          </Tag>
        </Space>
        <Space>
          <Button onClick={() => setStatusModalVisible(true)}>更新状态</Button>
          <Button type="primary">导出单据</Button>
        </Space>
      </div>

      {/* Basic Info Card */}
      <Card style={{ marginBottom: 16 }}>
        <Descriptions title="配送信息" column={3} bordered>
          <Descriptions.Item label="配送单号">{data.deliveryNo}</Descriptions.Item>
          <Descriptions.Item label="配送公司">
            <Space>
              <TruckOutlined />
              {data.carrier}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="追踪号">
            <Text copyable style={{ fontFamily: 'monospace' }}>{data.trackingNo}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="关联订单数">{data.orderCount} 票</Descriptions.Item>
          <Descriptions.Item label="总件数">{data.totalPieces} 件</Descriptions.Item>
          <Descriptions.Item label="配送费用">${data.deliveryFee.toFixed(2)}</Descriptions.Item>

          <Descriptions.Item label="收货人">{data.receiverName}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{data.receiverPhone}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={STATUS_CONFIG[data.status as keyof typeof STATUS_CONFIG].color}>
              {STATUS_CONFIG[data.status as keyof typeof STATUS_CONFIG].text}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="收货地址" span={3}>
            <Space>
              <EnvironmentOutlined />
              {data.receiverAddress}
            </Space>
          </Descriptions.Item>

          <Descriptions.Item label="预计送达">
            {data.estimatedDeliveryTime ? dayjs(data.estimatedDeliveryTime).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="实际送达">
            {data.actualDeliveryTime ? dayjs(data.actualDeliveryTime).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="操作人">{data.operator}</Descriptions.Item>

          {data.remark && (
            <Descriptions.Item label="备注" span={3}>
              {data.remark}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Tabs for detailed sections */}
      <Card>
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: (
                <span>
                  订单列表
                  <Badge count={data.orderCount} style={{ marginLeft: 8 }} />
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  columns={orderColumns}
                  dataSource={data.orders}
                  pagination={false}
                  size="small"
                />
              )
            },
            {
              key: '2',
              label: '配送追踪',
              children: (
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
              )
            },
            {
              key: '3',
              label: (
                <span>
                  <HistoryOutlined style={{ marginRight: 4 }} />
                  操作日志
                </span>
              ),
              children: (
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
                        <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                          操作人: {log.operator}
                        </div>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              )
            }
          ]}
        />
      </Card>

      {/* 更新状态Modal */}
      <Modal
        title="更新配送状态"
        open={statusModalVisible}
        onCancel={() => {
          setStatusModalVisible(false);
          statusForm.resetFields();
        }}
        onOk={handleUpdateStatus}
        width={600}
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item
            name="newStatus"
            label="配送状态"
            rules={[{ required: true, message: '请选择配送状态' }]}
          >
            <Select placeholder="选择新的配送状态">
              <Select.Option value="PENDING">待配送</Select.Option>
              <Select.Option value="IN_TRANSIT">配送中</Select.Option>
              <Select.Option value="DELIVERED">已送达</Select.Option>
              <Select.Option value="EXCEPTION">异常</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="节点状态"
            rules={[{ required: true, message: '请输入节点状态' }]}
          >
            <Input placeholder="例如: 运输中、已签收等" />
          </Form.Item>

          <Form.Item
            name="location"
            label="当前位置"
          >
            <Input placeholder="例如: Los Angeles, CA - Distribution Center" />
          </Form.Item>

          <Form.Item
            name="description"
            label="详细说明"
          >
            <TextArea
              rows={3}
              placeholder="例如: 包裹已到达配送中心，等待派送"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
