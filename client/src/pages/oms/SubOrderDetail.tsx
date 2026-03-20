import React, { useState, useEffect } from 'react';
import {
  Drawer, Card, Row, Col, Descriptions, Table, Tag, Space, Typography,
  Divider, Button, Timeline, message
} from 'antd';
import {
  ClockCircleOutlined, CheckCircleOutlined, EnvironmentOutlined,
  FileTextOutlined, DollarOutlined, InboxOutlined, CarOutlined,
  UserOutlined, DownOutlined, UpOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { SubOrder, OrderItem, ExpressPackage } from '../../types/core';
import { orderApi } from '../../api';

const { Text, Title } = Typography;

interface SubOrderDetailProps {
  visible: boolean;
  subOrder: SubOrder | null;
  onClose: () => void;
}

export const SubOrderDetail: React.FC<SubOrderDetailProps> = ({
  visible,
  subOrder,
  onClose
}) => {
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [relatedPackages, setRelatedPackages] = useState<ExpressPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // 加载子订单关联的快递包裹
  useEffect(() => {
    if (!subOrder || !visible) {
      setRelatedPackages([]);
      return;
    }
    const fetchSubOrderDetail = async () => {
      setPackagesLoading(true);
      try {
        const res = await orderApi.getSub(subOrder.id) as any;
        const data = res.data;
        if (data && data.expressPackages) {
          setRelatedPackages(data.expressPackages);
        } else {
          setRelatedPackages([]);
        }
      } catch (error: any) {
        console.error('加载子订单快递包裹失败:', error.message);
        setRelatedPackages([]);
      } finally {
        setPackagesLoading(false);
      }
    };
    fetchSubOrderDetail();
  }, [subOrder?.id, visible]);

  if (!subOrder) return null;

  // Status display functions
  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      'PENDING_INBOUND': 'default',
      'INBOUND': 'cyan',
      'PENDING_PACKING': 'warning',
      'PACKED': 'orange',
      'PENDING_DEPARTURE': 'processing',
      'IN_TRANSIT': 'blue',
      'CUSTOMS_CLEARANCE': 'purple',
      'ARRIVED': 'geekblue',
      'PENDING_DELIVERY': 'lime',
      'DELIVERING': 'cyan',
      'DELIVERED': 'success',
      'EXCEPTION': 'error'
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      'PENDING_INBOUND': '待入库',
      'INBOUND': '已入库',
      'PENDING_PACKING': '待装箱',
      'PACKED': '已装箱',
      'PENDING_DEPARTURE': '待发货',
      'IN_TRANSIT': '运输中',
      'CUSTOMS_CLEARANCE': '清关中',
      'ARRIVED': '已到达',
      'PENDING_DELIVERY': '待配送',
      'DELIVERING': '配送中',
      'DELIVERED': '已签收',
      'EXCEPTION': '异常'
    };
    return textMap[status] || status;
  };
  // 快递包裹表格列
  const expressPackageColumns = [
    {
      title: '第三方运单',
      key: 'tracking',
      width: 200,
      render: (_: any, record: ExpressPackage) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.expressCompany}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.trackingNo}</Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === '已入库' ? 'success' : 'processing'}>{status}</Tag>
      )
    },
    {
      title: '更新日期',
      dataIndex: 'inboundDate',
      key: 'inboundDate',
      width: 150,
      render: (date?: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '品名',
      dataIndex: 'name',
      key: 'name',
      width: 120
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100
    },
    {
      title: '说明',
      dataIndex: 'cargoType',
      key: 'cargoType',
      width: 80
    },
    {
      title: '重量(kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 90,
      align: 'right' as const,
      render: (weight: number) => weight.toFixed(2)
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 70,
      align: 'right' as const
    },
    {
      title: '货值(USD)',
      dataIndex: 'value',
      key: 'value',
      width: 100,
      align: 'right' as const,
      render: (value: number) => `$${value.toFixed(2)}`
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (remark?: string) => remark || '-'
    }
  ];

  // 物品明细表格列
  const itemColumns = [
    {
      title: '物品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: OrderItem) => (
        <Space direction="vertical" size={0}>
          <Text>{text}</Text>
          {record.nameEn && (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.nameEn}</Text>
          )}
        </Space>
      )
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80
    },
    {
      title: '重量(kg)',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      render: (weight: number, record: OrderItem) => (
        <Text>{(weight * record.quantity).toFixed(2)}</Text>
      )
    },
    {
      title: '体积(m³)',
      dataIndex: 'volume',
      key: 'volume',
      width: 100,
      render: (volume: number, record: OrderItem) => (
        <Text>{(volume * record.quantity).toFixed(3)}</Text>
      )
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100
    },
    {
      title: '属性',
      dataIndex: 'attributes',
      key: 'attributes',
      width: 150,
      render: (attrs?: string[]) => (
        <>
          {attrs?.map((attr, idx) => (
            <Tag key={idx} color="orange" style={{ marginBottom: 4 }}>
              {attr}
            </Tag>
          ))}
        </>
      )
    }
  ];

  return (
    <Drawer
      title={
        <Space>
          <FileTextOutlined />
          <span>子订单详情</span>
        </Space>
      }
      open={visible}
      onClose={onClose}
      width={1200}
      extra={
        <Space>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 顶部：子运单号和状态 */}
        <Card bordered={false} style={{ background: '#fafafa' }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Space direction="vertical" size={0}>
                <Text type="secondary" style={{ fontSize: 12 }}>子运单号</Text>
                <Title level={4} style={{ margin: 0 }}>{subOrder.subOrderNo}</Title>
              </Space>
            </Col>
            <Col>
              <Tag color={getStatusColor(subOrder.status)} style={{ fontSize: 14, padding: '4px 12px' }}>
                {getStatusText(subOrder.status)}
              </Tag>
            </Col>
          </Row>
          <Divider style={{ margin: '10px 0 8px' }} />
          <div className="compact-stats">
            <Tag color="blue">总件 {Number(subOrder.pieces || 0)}</Tag>
            <Tag>总重 {Number(subOrder.weight || 0).toFixed(2)}Kg</Tag>
            <Tag color="orange">体积 {Number(subOrder.volume || 0).toFixed(3)}m³</Tag>
            <Tag color="blue">货值 USD {Number(subOrder.value || 0).toFixed(2)}</Tag>
          </div>
        </Card>

        {/* 运输路线 */}
        <Card bordered={false} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Row align="middle" justify="center">
            <Col>
              <Space size="large" align="center">
                <div style={{ textAlign: 'center' }}>
                  <EnvironmentOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                    {subOrder.route?.split('→')[0]?.trim() || '起运地'}
                  </div>
                </div>
                <CarOutlined style={{ fontSize: 32 }} />
                <div style={{ textAlign: 'center' }}>
                  <EnvironmentOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>
                    {subOrder.route?.split('→')[1]?.trim() || '目的地'}
                  </div>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 发货人和收货人信息 */}
        <Row gutter={16}>
          <Col span={12}>
            <Card title={<Space><UserOutlined /><span>发货人</span></Space>} bordered={false}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="客户名称">{subOrder.customerName}</Descriptions.Item>
                <Descriptions.Item label="客户编号">{subOrder.customerId}</Descriptions.Item>
                {subOrder.operator && <Descriptions.Item label="操作人">{subOrder.operator}</Descriptions.Item>}
              </Descriptions>
            </Card>
          </Col>
          <Col span={12}>
            <Card title={<Space><UserOutlined /><span>收货人</span></Space>} bordered={false}>
              <Descriptions column={1} size="small">
                {subOrder.consignee && <Descriptions.Item label="姓名">{subOrder.consignee}</Descriptions.Item>}
                {subOrder.consigneePhone && <Descriptions.Item label="电话">{subOrder.consigneePhone}</Descriptions.Item>}
                <Descriptions.Item label="国家">{subOrder.destCountry}</Descriptions.Item>
                <Descriptions.Item label="城市">{subOrder.destCity}</Descriptions.Item>
                {subOrder.destAddress && <Descriptions.Item label="地址">{subOrder.destAddress}</Descriptions.Item>}
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* 订单初始信息（快递包裹） */}
        {relatedPackages.length > 0 && (
          <Card
            title={<Space><InboxOutlined /><span>订单初始信息 ({relatedPackages.length}个快递包裹)</span></Space>}
            bordered={false}
          >
            <Table
              dataSource={relatedPackages}
              columns={expressPackageColumns}
              rowKey="id"
              size="small"
              pagination={false}
              summary={(pageData) => {
                const totalWeight = pageData.reduce((sum, item) => sum + item.weight, 0);
                const totalPieces = pageData.reduce((sum, item) => sum + item.pieces, 0);
                const totalValue = pageData.reduce((sum, item) => sum + item.value, 0);
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={6}><Text strong>合计</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={6} align="right"><Text strong>{totalWeight.toFixed(2)}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={7} align="right"><Text strong>{totalPieces}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={8} align="right"><Text strong>${totalValue.toFixed(2)}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={9} />
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </Card>
        )}

        {/* 物品明细 */}
        <Card
          title={<Space><InboxOutlined /><span>物品明细 ({subOrder.items.length}项)</span></Space>}
          bordered={false}
        >
          <Table
            dataSource={subOrder.items}
            columns={itemColumns}
            rowKey="id"
            size="small"
            pagination={false}
          />
        </Card>

        {/* 流转记录（可展开/收起） */}
        <Card
          title={<Space><ClockCircleOutlined /><span>流转记录</span></Space>}
          bordered={false}
          extra={
            <Button
              type="link"
              icon={timelineExpanded ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setTimelineExpanded(!timelineExpanded)}
            >
              {timelineExpanded ? '收起' : '展开'}
            </Button>
          }
        >
          {!timelineExpanded ? (
            <div style={{ padding: '16px 0' }}>
              <Space>
                <Tag color="blue">当前节点</Tag>
                <Text strong>{subOrder.currentNode || subOrder.status}</Text>
              </Space>
            </div>
          ) : (
            <Timeline
              items={subOrder.timeline.map((node) => ({
                color: node.status === 'current' ? 'green' : node.status === 'completed' ? 'blue' : 'gray',
                dot: node.status === 'current' ? (
                  <ClockCircleOutlined style={{ fontSize: 16 }} />
                ) : node.status === 'completed' ? (
                  <CheckCircleOutlined style={{ fontSize: 16 }} />
                ) : undefined,
                children: (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                      {node.node}
                      {node.nodeEn && (
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                          ({node.nodeEn})
                        </Text>
                      )}
                    </div>
                    {node.location && (
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                        <EnvironmentOutlined /> {node.location}
                      </div>
                    )}
                    {node.remark && (
                      <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                        {node.remark}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {node.time}
                      {node.operator && ` · ${node.operator}`}
                    </div>
                  </div>
                )
              }))}
            />
          )}
        </Card>

        {/* 运输信息 */}
        <Card
          title={<Space><CarOutlined /><span>运输信息</span></Space>}
          bordered={false}
        >
          <Descriptions column={2} size="small">
            <Descriptions.Item label="运输方式">
              <Tag color={subOrder.transportType === 'SEA' ? 'blue' : 'orange'}>
                {subOrder.transportType === 'SEA' ? '海运' : '空运'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="运输路线">{subOrder.route}</Descriptions.Item>
            {subOrder.shippingUnitId && (
              <Descriptions.Item label="集装箱/货柜">
                <a>{subOrder.shippingUnitId}</a>
              </Descriptions.Item>
            )}
            {subOrder.jobNo && (
              <Descriptions.Item label="任务号">
                <a>{subOrder.jobNo}</a>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* 费用信息 */}
        <Card
          title={<Space><DollarOutlined /><span>费用信息</span></Space>}
          bordered={false}
          extra={
            subOrder.totalFee && (
              <Space>
                <Text type="secondary">总计:</Text>
                <Text strong style={{ fontSize: 16, color: '#cf1322' }}>
                  ¥{subOrder.totalFee.toFixed(2)}
                </Text>
              </Space>
            )
          }
        >
          {subOrder.freight && (
            <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <Space size="large">
                <div>
                  <Text type="secondary">运费: </Text>
                  <Text strong>¥{subOrder.freight.toFixed(2)}</Text>
                </div>
              </Space>
            </div>
          )}
          {subOrder.extraFees.length > 0 && (
            <Table
              dataSource={subOrder.extraFees}
              columns={[
                { title: '费用类型', dataIndex: 'feeTypeName', key: 'feeTypeName' },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  key: 'amount',
                  width: 120,
                  render: (amount: number, record: any) => (
                    <Text strong>{record.currency} {amount.toFixed(2)}</Text>
                  )
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (status: string) => {
                    const colorMap: Record<string, string> = {
                      'PENDING': 'default',
                      'CONFIRMED': 'processing',
                      'PAID': 'success'
                    };
                    const textMap: Record<string, string> = {
                      'PENDING': '待确认',
                      'CONFIRMED': '已确认',
                      'PAID': '已支付'
                    };
                    return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
                  }
                }
              ]}
              rowKey="id"
              size="small"
              pagination={false}
            />
          )}
        </Card>

        {/* 其他信息 */}
        <Card
          title="其他信息"
          bordered={false}
        >
          <Descriptions column={2} size="small">
            <Descriptions.Item label="主运单号">
              <a>{subOrder.masterOrderNo}</a>
            </Descriptions.Item>
            <Descriptions.Item label="批次号">批次 {subOrder.batchNo}</Descriptions.Item>
            {subOrder.splitReason && (
              <Descriptions.Item label="拆单原因" span={2}>{subOrder.splitReason}</Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {dayjs(subOrder.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(subOrder.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
          {subOrder.remark && (
            <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <Text type="secondary">备注：</Text>
              <Text>{subOrder.remark}</Text>
            </div>
          )}
        </Card>
      </Space>
    </Drawer>
  );
};
