import React, { useRef, useState } from 'react';
import {
  Card, Descriptions, Tag, Button, Space, Timeline, Table,
  Row, Col, Typography, Modal, Form, Select, Input,
  message, InputNumber, Radio, Checkbox, Divider, Drawer
} from 'antd';
import {
  TruckOutlined, EnvironmentOutlined,
  CheckCircleOutlined, HistoryOutlined,
  WarningOutlined, PlusOutlined, ContainerOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface DestStockDetailProps {
  visible: boolean;
  stockId: string;
  onClose: () => void;
  onUpdate?: (id: string, updates: any) => void;
}

// 费用记录
interface StockFee {
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
const getMockDetailData = (stockId: string) => ({
  id: stockId,
  orderId: 'ORD001',
  trackingNo: 'TRK001',
  clientName: '客户A',
  clientCode: 'C001',
  // 货物信息
  pieces: 15,
  arrivedPieces: 15,
  weight: 75.5,
  volume: 1.2,
  goodsType: '普通货物',
  goodsDesc: '电子产品配件',
  // 仓储信息
  warehouseLocation: 'US-MAIN-A-01',
  warehouseName: 'LA Main Warehouse',
  arrivalStatus: 'COMPLETE' as string,
  stockStatus: 'IN_STOCK' as string,
  dispatchStatus: 'PENDING' as string,
  arrivalTime: '2024-01-20 10:00:00',
  missingDetails: null as string | null,
  // 收货人信息
  receiverName: 'John Smith',
  receiverPhone: '+1 626-123-4567',
  receiverAddress: '1234 Main St, Los Angeles, CA 90001',
  // 任务关联
  jobNo: 'JOB-SZX-LAX-231028',
  shippingUnitNo: 'MSKU1234567',
  containerNo: 'MSCU1234567',
  routeName: '深圳 → 洛杉矶',
  transportMode: '海运',
  // 配送信息
  deliveryNo: null as string | null,
  carrier: null as string | null,
  // 其他
  remark: '',
  createdAt: '2024-01-20 10:00:00',
  updatedAt: '2024-01-20 12:00:00',
  operator: '张仓管',
  // 费用
  fees: [
    { id: 1, category: '仓储费', item: '标准仓储费（7天）', amount: 35.00, currency: 'USD', status: 'CONFIRMED' as const, createdAt: '2024-01-20 10:00', operator: '张仓管' },
    { id: 2, category: '操作费', item: '卸货操作费', amount: 15.00, currency: 'USD', status: 'PENDING' as const, createdAt: '2024-01-20 10:05', operator: '张仓管' }
  ] as StockFee[],
  // 操作日志
  logs: [
    { time: '2024-01-20 12:00', operator: '张仓管', action: '库位分配', detail: '分配至库位 US-MAIN-A-01' },
    { time: '2024-01-20 10:05', operator: '张仓管', action: '费用录入', detail: '录入卸货操作费 USD 15.00' },
    { time: '2024-01-20 10:00', operator: '系统', action: '入库登记', detail: '货物入库，来源: JOB-SZX-LAX-231028 / MSKU1234567' },
    { time: '2024-01-19 16:00', operator: '系统', action: '预报到达', detail: '货物预计到达 LA Main Warehouse' }
  ]
});

const ARRIVAL_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待确认', color: 'default' },
  COMPLETE: { text: '完整到达', color: 'success' },
  INCOMPLETE: { text: '不完整', color: 'warning' }
};

const STOCK_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  IN_STOCK: { text: '在库', color: 'processing' },
  ALLOCATED: { text: '已分配', color: 'success' },
  OUT_OF_STOCK: { text: '已出库', color: 'default' }
};

const DISPATCH_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待安排', color: 'default' },
  ARRANGED: { text: '已安排', color: 'processing' },
  DISPATCHED: { text: '已配送', color: 'success' }
};

const FEE_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待确认', color: 'default' },
  CONFIRMED: { text: '已确认', color: 'processing' },
  PAID: { text: '已支付', color: 'success' }
};

// 左侧导航项
const NAV_ITEMS = [
  { key: 'order', title: '订单信息' },
  { key: 'cargo', title: '货物信息' },
  { key: 'job', title: '任务关联' },
  { key: 'dispatch', title: '配送信息' },
  { key: 'fees', title: '费用信息' },
  { key: 'logs', title: '操作记录' }
];

export const DestStockDetail: React.FC<DestStockDetailProps> = ({ visible, stockId, onClose, onUpdate }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState(getMockDetailData(stockId));

  // 确认到达 Modal
  const [arrivalModalVisible, setArrivalModalVisible] = useState(false);
  const [arrivalForm] = Form.useForm();

  // 配送安排 Modal
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [dispatchForm] = Form.useForm();

  // 出库确认 Modal
  const [outboundModalVisible, setOutboundModalVisible] = useState(false);
  const [outboundForm] = Form.useForm();

  // 费用录入 Modal
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [feeForm] = Form.useForm();

  // 调整库位 Modal
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationForm] = Form.useForm();

  // 锚点导航
  const handleNavClick = (key: string) => {
    const element = contentRef.current?.querySelector<HTMLElement>(`#stock-${key}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 确认到达
  const handleConfirmArrival = async () => {
    try {
      const values = await arrivalForm.validateFields();
      setData({
        ...data,
        arrivalStatus: values.arrivalStatus,
        arrivedPieces: values.arrivedPieces,
        missingDetails: values.arrivalStatus === 'INCOMPLETE' ? values.missingDetails : null,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        logs: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '确认到达', detail: `到达状态: ${ARRIVAL_STATUS_CONFIG[values.arrivalStatus]?.text}，实到${values.arrivedPieces}件` },
          ...data.logs
        ]
      });
      onUpdate?.(data.id, { arrivalStatus: values.arrivalStatus, arrivedPieces: values.arrivedPieces });
      message.success('到达状态已确认');
      setArrivalModalVisible(false);
      arrivalForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 安排配送
  const handleConfirmDispatch = async () => {
    try {
      const values = await dispatchForm.validateFields();
      setData({
        ...data,
        stockStatus: 'ALLOCATED',
        dispatchStatus: 'ARRANGED',
        deliveryNo: values.deliveryNo,
        carrier: values.carrier,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        logs: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '安排配送', detail: `关联配送单: ${values.deliveryNo}，承运商: ${values.carrier}` },
          ...data.logs
        ]
      });
      onUpdate?.(data.id, { stockStatus: 'ALLOCATED', dispatchStatus: 'ARRANGED', deliveryNo: values.deliveryNo });
      message.success('配送安排成功');
      setDispatchModalVisible(false);
      dispatchForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 确认出库
  const handleConfirmOutbound = async () => {
    try {
      const values = await outboundForm.validateFields();
      setData({
        ...data,
        stockStatus: 'OUT_OF_STOCK',
        dispatchStatus: 'DISPATCHED',
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        logs: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '确认出库', detail: values.remark || '货物已出库交付配送' },
          ...data.logs
        ]
      });
      onUpdate?.(data.id, { stockStatus: 'OUT_OF_STOCK', dispatchStatus: 'DISPATCHED' });
      message.success('出库确认成功');
      setOutboundModalVisible(false);
      outboundForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 添加费用
  const handleAddFee = async () => {
    try {
      const values = await feeForm.validateFields();
      const newFee: StockFee = {
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

  // 调整库位
  const handleChangeLocation = async () => {
    try {
      const values = await locationForm.validateFields();
      const oldLocation = data.warehouseLocation;
      setData({
        ...data,
        warehouseLocation: values.newLocation,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        logs: [
          { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '库位调整', detail: `${oldLocation} → ${values.newLocation}${values.reason ? '，原因: ' + values.reason : ''}` },
          ...data.logs
        ]
      });
      message.success('库位已调整');
      setLocationModalVisible(false);
      locationForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 费用列表列定义
  const feeColumns = [
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 140 },
    { title: '费用类别', dataIndex: 'category', key: 'category', width: 100 },
    { title: '费用项目', dataIndex: 'item', key: 'item' },
    {
      title: '金额',
      key: 'amount',
      width: 120,
      render: (record: StockFee) => `${record.currency} ${record.amount.toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const config = FEE_STATUS_CONFIG[status];
        return <Tag color={config?.color}>{config?.text}</Tag>;
      }
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 80 }
  ];

  const totalFee = data.fees.reduce((sum, f) => sum + f.amount, 0);
  const arrivalConfig = ARRIVAL_STATUS_CONFIG[data.arrivalStatus] || ARRIVAL_STATUS_CONFIG.PENDING;
  const stockConfig = STOCK_STATUS_CONFIG[data.stockStatus] || STOCK_STATUS_CONFIG.IN_STOCK;
  const dispatchConfig = DISPATCH_STATUS_CONFIG[data.dispatchStatus] || DISPATCH_STATUS_CONFIG.PENDING;

  return (
    <Drawer
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>库存详情 - {data.orderId}</Title>
          <Tag color={stockConfig.color} style={{ fontSize: 14, padding: '2px 12px' }}>
            {stockConfig.text}
          </Tag>
          {data.arrivalStatus === 'INCOMPLETE' && (
            <Tag color="warning" icon={<WarningOutlined />}>货物不完整</Tag>
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
          {data.arrivalStatus === 'PENDING' && (
            <Button onClick={() => {
              arrivalForm.setFieldsValue({ arrivalStatus: 'COMPLETE', arrivedPieces: data.pieces });
              setArrivalModalVisible(true);
            }}>
              确认到达
            </Button>
          )}
          {data.stockStatus === 'IN_STOCK' && (
            <Button onClick={() => setLocationModalVisible(true)}>
              调整库位
            </Button>
          )}
          {data.stockStatus === 'IN_STOCK' && data.dispatchStatus === 'PENDING' && (
            <Button type="primary" icon={<TruckOutlined />} onClick={() => setDispatchModalVisible(true)}>
              安排配送
            </Button>
          )}
          {data.dispatchStatus === 'ARRANGED' && data.stockStatus !== 'OUT_OF_STOCK' && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setOutboundModalVisible(true)}>
              确认出库
            </Button>
          )}
        </Space>
      }
    >
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
          {/* 订单信息 */}
          <Card id="stock-order" title="订单信息" bordered={false} style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col span={12}>
                <Descriptions column={1} size="small" labelStyle={{ width: 90 }}>
                  <Descriptions.Item label="运单号">
                    <Text strong>{data.orderId}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="第三方运单号">{data.trackingNo}</Descriptions.Item>
                  <Descriptions.Item label="客户编码">{data.clientCode}</Descriptions.Item>
                  <Descriptions.Item label="客户名称">{data.clientName}</Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={12}>
                <Descriptions column={1} size="small" labelStyle={{ width: 90 }}>
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
          </Card>

          {/* 货物信息 */}
          <Card id="stock-cargo" title="货物信息" bordered={false} style={{ marginBottom: 16 }}>
            <div className="compact-stats" style={{ marginBottom: 8 }}>
              <Tag color="blue">应到 {Number(data.pieces || 0)}</Tag>
              <Tag color={data.arrivalStatus === 'INCOMPLETE' ? 'warning' : 'processing'}>
                实到 {data.arrivedPieces ? Number(data.arrivedPieces) : '-'}
              </Tag>
              <Tag>重量 {Number(data.weight || 0).toFixed(1)}Kg</Tag>
              <Tag>体积 {Number(data.volume || 0).toFixed(2)}CBM</Tag>
              <Tag color={arrivalConfig.color}>到达 {arrivalConfig.text}</Tag>
              <Tag color={stockConfig.color}>库存 {stockConfig.text}</Tag>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <Descriptions column={3} size="small">
              <Descriptions.Item label="货物类型">{data.goodsType}</Descriptions.Item>
              <Descriptions.Item label="货物描述">{data.goodsDesc}</Descriptions.Item>
              <Descriptions.Item label="库位">
                <Text strong style={{ color: '#1890ff' }}>{data.warehouseLocation}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="仓库">{data.warehouseName}</Descriptions.Item>
              <Descriptions.Item label="入库时间">{dayjs(data.arrivalTime).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{data.updatedAt ? dayjs(data.updatedAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              {data.missingDetails && (
                <Descriptions.Item label="缺失明细" span={3}>
                  <Text type="warning">{data.missingDetails}</Text>
                </Descriptions.Item>
              )}
              {data.remark && (
                <Descriptions.Item label="备注" span={3}>{data.remark}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* 任务关联 */}
          <Card id="stock-job" title="任务关联" bordered={false} style={{ marginBottom: 16 }}>
            {data.jobNo ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="任务编号">
                  <a style={{ fontWeight: 'bold' }}>{data.jobNo}</a>
                </Descriptions.Item>
                <Descriptions.Item label="运输方式">
                  <Tag color="blue">{data.transportMode}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="运输单元号">{data.shippingUnitNo}</Descriptions.Item>
                <Descriptions.Item label="集装箱号">{data.containerNo}</Descriptions.Item>
                <Descriptions.Item label="线路">{data.routeName}</Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
                <ContainerOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                <div>暂未关联任务</div>
              </div>
            )}
          </Card>

          {/* 配送信息 */}
          <Card id="stock-dispatch" title="配送信息" bordered={false} style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="配送状态">
                <Tag color={dispatchConfig.color}>{dispatchConfig.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="配送单号">
                {data.deliveryNo ? <a>{data.deliveryNo}</a> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="承运商">{data.carrier || '-'}</Descriptions.Item>
              <Descriptions.Item label="操作人">{data.operator}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 费用信息 */}
          <Card
            id="stock-fees"
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

          {/* 操作记录 */}
          <Card id="stock-logs" title={<span><HistoryOutlined /> 操作记录</span>} bordered={false}>
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

      {/* 确认到达 Modal */}
      <Modal
        title="确认到达状态"
        open={arrivalModalVisible}
        onCancel={() => { setArrivalModalVisible(false); arrivalForm.resetFields(); }}
        onOk={handleConfirmArrival}
        width={600}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <Row gutter={16}>
            <Col span={12}>
              <div><strong>运单号:</strong> {data.orderId}</div>
              <div><strong>第三方运单号:</strong> {data.trackingNo}</div>
            </Col>
            <Col span={12}>
              <div><strong>客户:</strong> {data.clientName}</div>
              <div><strong>应到件数:</strong> {data.pieces} 件</div>
            </Col>
          </Row>
        </div>
        <Form form={arrivalForm} layout="vertical">
          <Form.Item name="arrivalStatus" label="到达状态" rules={[{ required: true, message: '请选择到达状态' }]}>
            <Radio.Group>
              <Radio value="COMPLETE">完整到达</Radio>
              <Radio value="INCOMPLETE">不完整</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="arrivedPieces" label="实际到达件数" rules={[{ required: true, message: '请输入实际到达件数' }]}>
            <InputNumber style={{ width: '100%' }} min={0} max={data.pieces} placeholder="请输入实际到达件数" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.arrivalStatus !== cur.arrivalStatus}
          >
            {({ getFieldValue }) =>
              getFieldValue('arrivalStatus') === 'INCOMPLETE' ? (
                <Form.Item name="missingDetails" label="缺失明细" rules={[{ required: true, message: '请填写缺失明细' }]}>
                  <TextArea rows={3} placeholder="请描述缺失情况" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 安排配送 Modal */}
      <Modal
        title="安排配送"
        open={dispatchModalVisible}
        onCancel={() => { setDispatchModalVisible(false); dispatchForm.resetFields(); }}
        onOk={handleConfirmDispatch}
        width={600}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="运单号">{data.orderId}</Descriptions.Item>
            <Descriptions.Item label="客户">{data.clientName}</Descriptions.Item>
            <Descriptions.Item label="件数">{data.arrivedPieces || data.pieces} 件</Descriptions.Item>
            <Descriptions.Item label="库位">{data.warehouseLocation}</Descriptions.Item>
          </Descriptions>
        </div>
        <Form form={dispatchForm} layout="vertical">
          <Form.Item name="deliveryNo" label="关联配送单号" rules={[{ required: true, message: '请输入配送单号' }]}>
            <Input placeholder="例如：DLV-20240120-001" />
          </Form.Item>
          <Form.Item name="carrier" label="承运商" rules={[{ required: true, message: '请选择承运商' }]}>
            <Select placeholder="选择承运商">
              <Select.Option value="UPS">UPS</Select.Option>
              <Select.Option value="FedEx">FedEx</Select.Option>
              <Select.Option value="USPS">USPS</Select.Option>
              <Select.Option value="DHL">DHL</Select.Option>
              <Select.Option value="Amazon Logistics">Amazon Logistics</Select.Option>
              <Select.Option value="自送">自送</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="如有特殊说明请填写" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 确认出库 Modal */}
      <Modal
        title="确认出库"
        open={outboundModalVisible}
        onCancel={() => { setOutboundModalVisible(false); outboundForm.resetFields(); }}
        onOk={handleConfirmOutbound}
        width={600}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="运单号">{data.orderId}</Descriptions.Item>
            <Descriptions.Item label="客户">{data.clientName}</Descriptions.Item>
            <Descriptions.Item label="件数">{data.arrivedPieces || data.pieces} 件</Descriptions.Item>
            <Descriptions.Item label="配送单号">{data.deliveryNo || '-'}</Descriptions.Item>
          </Descriptions>
        </div>
        <Form form={outboundForm} layout="vertical">
          <Form.Item
            name="confirmOutbound"
            valuePropName="checked"
            rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('请确认货物已出库')) }]}
          >
            <Checkbox>我确认货物已按配送计划出库，并已交给配送公司</Checkbox>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="如有特殊说明请填写" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 调整库位 Modal */}
      <Modal
        title="调整库位"
        open={locationModalVisible}
        onCancel={() => { setLocationModalVisible(false); locationForm.resetFields(); }}
        onOk={handleChangeLocation}
        width={500}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          <div><strong>当前库位:</strong> {data.warehouseLocation}</div>
          <div><strong>运单号:</strong> {data.orderId} | <strong>客户:</strong> {data.clientName}</div>
        </div>
        <Form form={locationForm} layout="vertical">
          <Form.Item name="newLocation" label="新库位" rules={[{ required: true, message: '请输入新库位' }]}>
            <Input placeholder="例如: US-MAIN-B-03" />
          </Form.Item>
          <Form.Item name="reason" label="调整原因">
            <Input placeholder="选填" />
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
                  <Select.Option value="仓储费">仓储费</Select.Option>
                  <Select.Option value="操作费">操作费</Select.Option>
                  <Select.Option value="分拣费">分拣费</Select.Option>
                  <Select.Option value="包装费">包装费</Select.Option>
                  <Select.Option value="附加费">附加费</Select.Option>
                  <Select.Option value="其他">其他</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="item" label="费用项目" rules={[{ required: true, message: '请输入费用项目' }]}>
                <Input placeholder="例如: 标准仓储费（7天）" />
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
