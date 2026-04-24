import React, { useState, useMemo, useEffect } from 'react';
import {
  Drawer, Card, Row, Col, Button, Tag, Descriptions, Table,
  Timeline, Input, Divider, Modal, Form, Collapse, Dropdown,
  Select, InputNumber, Space, Typography, Badge, DatePicker, message,
  Alert, Radio, Anchor, Spin, Upload
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PrinterOutlined, ShareAltOutlined, DownOutlined, EditOutlined,
  CloseOutlined, PayCircleOutlined, PlusOutlined, EnvironmentOutlined,
  DollarOutlined, CheckCircleOutlined, SplitCellsOutlined, EyeOutlined,
  ClockCircleOutlined, TruckOutlined, InboxOutlined, BellOutlined,
  RollbackOutlined, FileAddOutlined, RedoOutlined,
  CloseCircleOutlined, ArrowLeftOutlined, EllipsisOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MasterOrder, SubOrder, OrderItem, OrderStatus } from '../../types/core';
import { orderApi } from '../../api';
import { OrderSplitModal } from './OrderSplitModal';
import { SubOrderDetail } from './SubOrderDetail';
import { ShippingLabelPrint } from './ShippingLabelPrint';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface OrderDetailProps {
  orderId: string;
  onClose: () => void;
}

export const OrderDetail: React.FC<OrderDetailProps> = ({ orderId, onClose }) => {
  // Load master order data
  const [masterOrder, setMasterOrder] = useState<MasterOrder | undefined>(undefined);
  const [subOrders, setSubOrders] = useState<SubOrder[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载订单详情
  useEffect(() => {
    const fetchOrderDetail = async () => {
      setLoading(true);
      try {
        const res = await orderApi.getMaster(orderId) as any;
        const data = res.data;
        if (data) {
          setMasterOrder(data);
          setSubOrders(data.subOrders || []);
        }
      } catch (error: any) {
        message.error(error.message || '加载订单详情失败');
      } finally {
        setLoading(false);
      }
    };
    fetchOrderDetail();
  }, [orderId]);

  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [traceModalVisible, setTraceModalVisible] = useState(false);
  const [splitModalVisible, setSplitModalVisible] = useState(false);
  const [selectedSubOrder, setSelectedSubOrder] = useState<SubOrder | null>(null);
  const [subOrderDetailVisible, setSubOrderDetailVisible] = useState(false);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [supplementModalVisible, setSupplementModalVisible] = useState(false);
  const [recoverFeeModalVisible, setRecoverFeeModalVisible] = useState(false);
  const [printLabelVisible, setPrintLabelVisible] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [needReturnShipping, setNeedReturnShipping] = useState(false);

  const [traceForm] = Form.useForm();
  const [feeForm] = Form.useForm();
  const [reminderForm] = Form.useForm();
  const [refundForm] = Form.useForm();
  const [supplementForm] = Form.useForm();
  const [recoverFeeForm] = Form.useForm();
  const [returnForm] = Form.useForm();

  // If loading, show spinner
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" tip="加载订单详情..." />
      </div>
    );
  }

  // If no order found, show error
  if (!masterOrder) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="danger">订单不存在：{orderId}</Text>
        <div style={{ marginTop: 16 }}>
          <Button onClick={onClose}>返回列表</Button>
        </div>
      </div>
    );
  }

  // Calculate order status based on sub-orders (use masterOrder.status directly since server computes it)
  const currentStatus = useMemo(() => {
    return masterOrder.status;
  }, [masterOrder.status]);

  // Status display
  const getStatusColor = (status: OrderStatus | string) => {
    const colorMap: Record<string, string> = {
      'PENDING_INBOUND': 'warning',
      'INBOUND': 'cyan',
      'PENDING_DEPARTURE': 'orange',
      'DEPARTED': 'blue',
      'IN_TRANSIT': 'geekblue',
      'ARRIVED': 'purple',
      'PARTIAL_DELIVERED': 'lime',
      'COMPLETED': 'success',
      'EXCEPTION': 'error',
      'RETURN_APPLIED': 'volcano',
      'CANCELLED': 'default'
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status: OrderStatus | string) => {
    const textMap: Record<string, string> = {
      'PENDING_INBOUND': '待入库',
      'INBOUND': '已入库',
      'PENDING_DEPARTURE': '待发货',
      'DEPARTED': '已发货',
      'IN_TRANSIT': '运输中',
      'ARRIVED': '已到达',
      'PARTIAL_DELIVERED': '部分签收',
      'COMPLETED': '已完成',
      'EXCEPTION': '异常',
      'RETURN_APPLIED': '退单申请中',
      'CANCELLED': '已取消'
    };
    return textMap[status] || status;
  };

  const handleSubmitFee = async () => {
    try {
      const values = await feeForm.validateFields();
      console.log('提交订单费用:', {
        orderId: orderId,
        ...values
      });
      message.success('费用添加成功');
      setFeeModalVisible(false);
      feeForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleUpdateTrace = () => {
    traceForm.validateFields().then(values => {
      message.success('物流轨迹已更新');
      setTraceModalVisible(false);
      traceForm.resetFields();
    });
  };

  // 催款通知
  const handleSendReminder = async () => {
    try {
      const values = await reminderForm.validateFields();
      console.log('发送催款通知:', {
        orderId: orderId,
        ...values
      });
      message.success('催款通知已发送');
      setReminderModalVisible(false);
      reminderForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 订单分享
  const handleShareOrder = () => {
    const shareUrl = `${window.location.origin}/order/${orderId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      message.success('订单链接已复制到剪贴板');
      setShareModalVisible(false);
    }).catch(() => {
      message.error('复制失败，请手动复制');
    });
  };

  // 退款处理
  const handleRefund = async () => {
    try {
      const values = await refundForm.validateFields();
      console.log('退款处理:', {
        orderId: orderId,
        ...values
      });
      message.success('退款申请已提交');
      setRefundModalVisible(false);
      refundForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 补单处理
  const handleSupplement = async () => {
    try {
      const values = await supplementForm.validateFields();
      console.log('补单处理:', {
        orderId: orderId,
        ...values
      });
      message.success('补单申请已提交');
      setSupplementModalVisible(false);
      supplementForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 费用追回
  const handleRecoverFee = async () => {
    try {
      const values = await recoverFeeForm.validateFields();
      console.log('费用追回:', {
        orderId: orderId,
        ...values
      });
      message.success('费用追回申请已提交');
      setRecoverFeeModalVisible(false);
      recoverFeeForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 申请退单
  const handleApplyReturn = async () => {
    try {
      const values = await returnForm.validateFields();
      const updates = {
        previousStatus: currentStatus,
        status: 'RETURN_APPLIED',
        returnType: values.returnType,
        returnReason: values.returnReason,
        returnRefundAmount: values.returnRefundAmount,
        returnRefundMethod: values.returnRefundMethod,
        needReturn: values.needReturn,
        returnShippingNote: values.returnShippingNote,
        returnAppliedBy: '当前用户',
        returnAppliedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      };
      await orderApi.updateMaster(masterOrder.id, updates);
      setMasterOrder({ ...masterOrder, ...updates } as any);
      message.success('退单申请已提交，等待审核');
      setReturnModalVisible(false);
      returnForm.resetFields();
      setNeedReturnShipping(false);
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      } else {
        console.error('表单验证失败:', error);
      }
    }
  };

  const handleViewSubOrder = (subOrder: SubOrder) => {
    setSelectedSubOrder(subOrder);
    setSubOrderDetailVisible(true);
  };

  const handleConfirmSplit = (subOrderConfigs: any[]) => {
    console.log('拆单配置:', subOrderConfigs);

    // TODO: Create actual SubOrder records and update MasterOrder
    // For now, just show success message

    message.success(`订单拆分成功！已创建 ${subOrderConfigs.length} 个子订单`);
    setSplitModalVisible(false);

    // Refresh sub-orders (in real implementation, would fetch from API)
    // For demo, we'll just close the modal
  };

  // Sub-order table columns
  const subOrderColumns = [
    {
      title: '主运单号',
      dataIndex: 'masterOrderNo',
      key: 'masterOrderNo',
      width: 160,
      render: (text: string) => (
        <Text strong style={{ color: '#1890ff' }}>{text}</Text>
      )
    },
    {
      title: '子运单号',
      dataIndex: 'subOrderNo',
      key: 'subOrderNo',
      width: 160,
      render: (text: string, record: SubOrder) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>批次 {record.batchNo}</Text>
        </Space>
      )
    },
    {
      title: '运输方式',
      dataIndex: 'transportType',
      key: 'transportType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'SEA' ? 'blue' : 'orange'}>
          {type === 'SEA' ? '海运' : '空运'}
        </Tag>
      )
    },
    {
      title: '路线',
      dataIndex: 'route',
      key: 'route',
      width: 150
    },
    {
      title: '货物信息',
      key: 'cargo',
      width: 150,
      render: (_: any, record: SubOrder) => (
        <Space direction="vertical" size={0}>
          <Text>{record.pieces} 件</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.weight.toFixed(1)}kg / {record.volume.toFixed(2)}m³
          </Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: '当前节点',
      dataIndex: 'currentNode',
      key: 'currentNode',
      width: 120
    },
    {
      title: '预计到达',
      dataIndex: 'estimatedArrival',
      key: 'estimatedArrival',
      width: 120,
      render: (date?: string) => date ? dayjs(date).format('MM-DD HH:mm') : '-'
    },
    {
      title: '费用',
      dataIndex: 'totalFee',
      key: 'totalFee',
      width: 100,
      render: (fee?: number) => fee ? `¥${fee.toFixed(2)}` : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: SubOrder) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewSubOrder(record)}
          >
            查看
          </Button>
        </Space>
      )
    }
  ];

  // Express package table columns (订单初始信息)
  const expressPackageColumns = [
    {
      title: '第三方运单',
      key: 'express',
      width: 150,
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text>{record.expressCompany}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.trackingNo}</Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80
    },
    {
      title: '更新日期',
      dataIndex: 'inboundDate',
      key: 'inboundDate',
      width: 150
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
      title: '重量Kg',
      dataIndex: 'weight',
      key: 'weight',
      width: 80,
      align: 'right' as const
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 60,
      align: 'right' as const
    },
    {
      title: '货值USD',
      dataIndex: 'value',
      key: 'value',
      width: 90,
      align: 'right' as const
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 100
    },
    {
      title: '关联子订单',
      dataIndex: 'subOrderId',
      key: 'subOrderId',
      width: 150,
      render: (subOrderId: string) => {
        const subOrder = subOrders.find(s => s.id === subOrderId);
        return subOrder ? (
          <Tag color="blue">{subOrder.subOrderNo}</Tag>
        ) : (
          <Text type="secondary">未分配</Text>
        );
      }
    }
  ];

  // Items table columns
  const itemColumns = [
    {
      title: '物品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: OrderItem) => (
        <Space direction="vertical" size={0}>
          <Text>{text}</Text>
          {record.nameEn && <Text type="secondary" style={{ fontSize: 12 }}>{record.nameEn}</Text>}
        </Space>
      )
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 100,
      render: (price?: number) => price ? `$${price.toFixed(2)}` : '-'
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
      title: '货物属性',
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
    },
    {
      title: '申报价值',
      dataIndex: 'declaredValue',
      key: 'declaredValue',
      width: 100,
      render: (value?: number) => value ? `$${value.toFixed(2)}` : '-'
    }
  ];

  // Anchor navigation items
  const anchorItems = [
    { key: 'basic', href: '#order-basic', title: '基本信息' },
    { key: 'route', href: '#order-route', title: '路线与收发货人' },
    { key: 'logistics', href: '#order-logistics', title: '物流状态' },
    { key: 'initial', href: '#order-initial', title: '订单初始信息' },
    { key: 'actual', href: '#order-actual', title: '订单实际信息' },
    { key: 'receivable', href: '#order-receivable', title: '应收明细' },
  ];

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', position: 'relative' }}>
      {/* Sticky Header */}
      <div style={{ background: '#fff', padding: '12px 24px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 10 }}>
        {/* Top Actions Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={onClose}>
              返回列表
            </Button>
            <Divider type="vertical" />
            <Tag color={getStatusColor(currentStatus)} style={{ fontSize: 14, padding: '4px 12px' }}>
              {getStatusText(currentStatus)}
            </Tag>
            <Tag color={masterOrder.paymentStatus === 'PAID' ? 'success' : masterOrder.paymentStatus === 'PARTIAL' ? 'warning' : 'error'}>
              {masterOrder.paymentStatus === 'PAID' ? '已支付' : masterOrder.paymentStatus === 'PARTIAL' ? '部分支付' : '未支付'}
            </Tag>
            {masterOrder.splitStatus !== 'PENDING' && (
              <Tag color="blue">
                {subOrders.length} 个子订单
              </Tag>
            )}
          </Space>
          <Space>
            {currentStatus !== 'CANCELLED' && (
              <>
                <Button icon={<PrinterOutlined />} onClick={() => setPrintLabelVisible(true)} disabled={currentStatus === 'RETURN_APPLIED'}>打印单据</Button>
                <Button icon={<ShareAltOutlined />} onClick={() => setShareModalVisible(true)}>分享订单</Button>
                <Button icon={<DollarOutlined />} onClick={() => setFeeModalVisible(true)} disabled={currentStatus === 'RETURN_APPLIED'}>录入费用</Button>
                {masterOrder.paymentStatus !== 'PAID' && (
                  <Button icon={<BellOutlined />} onClick={() => setReminderModalVisible(true)} disabled={currentStatus === 'RETURN_APPLIED'}>催款</Button>
                )}
                {masterOrder.splitStatus === 'PENDING' && currentStatus !== 'RETURN_APPLIED' && (
                  <Button
                    type="primary"
                    icon={<SplitCellsOutlined />}
                    onClick={() => setSplitModalVisible(true)}
                  >
                    拆分订单
                  </Button>
                )}
                {!['COMPLETED', 'CANCELLED', 'RETURN_APPLIED'].includes(currentStatus) && (
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => {
                      // Auto-recommend need return based on status
                      const needReturnDefault = ['INBOUND', 'PENDING_DEPARTURE', 'DEPARTED', 'IN_TRANSIT'].includes(currentStatus);
                      setNeedReturnShipping(needReturnDefault);
                      returnForm.setFieldsValue({
                        needReturn: needReturnDefault,
                        returnRefundAmount: masterOrder.paidAmount || 0,
                      });
                      setReturnModalVisible(true);
                    }}
                  >
                    申请退单
                  </Button>
                )}
                <Button icon={<EllipsisOutlined />} />
              </>
            )}
          </Space>
        </div>

        {/* Order Info Row */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
          <Title level={3} style={{ margin: 0 }}>{masterOrder.orderNo}</Title>
          <Text type="secondary">客户: <a>{masterOrder.customerCode} ({masterOrder.customerName})</a></Text>
          <Text type="secondary">下单时间: {dayjs(masterOrder.orderDate).format('YYYY-MM-DD HH:mm')}</Text>
        </div>
      </div>

      {/* Status Alerts */}
      {currentStatus === 'RETURN_APPLIED' && (
        <div style={{ padding: '0 24px', paddingTop: 12 }}>
          <Alert
            type="warning"
            showIcon
            message="该订单已申请退单，等待审核"
            description={`退单原因：${masterOrder.returnReason || '-'}  |  申请人：${masterOrder.returnAppliedBy || '-'}  |  申请时间：${masterOrder.returnAppliedAt ? dayjs(masterOrder.returnAppliedAt).format('YYYY-MM-DD HH:mm') : '-'}`}
          />
        </div>
      )}
      {currentStatus === 'CANCELLED' && (
        <div style={{ padding: '0 24px', paddingTop: 12 }}>
          <Alert
            type="info"
            showIcon
            message="该订单已取消"
            description={
              <Space direction="vertical" size={4}>
                <Text>审核人：{masterOrder.returnApprover || '-'}  |  审核时间：{masterOrder.returnApprovedAt ? dayjs(masterOrder.returnApprovedAt).format('YYYY-MM-DD HH:mm') : '-'}</Text>
                <div style={{ marginTop: 8, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                  <Row gutter={[16, 8]}>
                    <Col span={24}>
                      <Text type="secondary">退单原因：</Text>
                      <Text>{masterOrder.returnReason}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">退费金额：</Text>
                      <Text strong style={{ color: '#cf1322' }}>¥{(masterOrder.returnRefundAmount || 0).toFixed(2)}</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">退费方式：</Text>
                      <Text>{
                        { ORIGINAL: '原路退回', BANK_TRANSFER: '银行转账', OFFLINE: '线下退款' }[masterOrder.returnRefundMethod || 'ORIGINAL']
                      }</Text>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">是否退运：</Text>
                      {masterOrder.needReturn ? <Tag color="orange">是</Tag> : <Tag>否</Tag>}
                    </Col>
                  </Row>
                </div>
              </Space>
            }
          />
        </div>
      )}

      {/* Content Body - Anchor Layout */}
      <div style={{ padding: '16px 24px', display: 'flex', gap: 16 }}>
        {/* Left Anchor Navigation */}
        <div style={{ width: 140, flexShrink: 0, position: 'sticky', top: 80, alignSelf: 'flex-start' }}>
          <Anchor
            items={anchorItems}
            getContainer={() => document.getElementById('order-detail-scroll') || window}
          />
        </div>
        {/* Right Content Area */}
        <div id="order-detail-scroll" style={{ flex: 1, overflow: 'auto' }}>
          {/* 基本信息 */}
          <div id="order-basic" style={{ marginBottom: 24 }}>
            <Card title="基本信息" size="small">
              <Descriptions column={3} size="small" layout="vertical">
                <Descriptions.Item label="运单号">{masterOrder.orderNo}</Descriptions.Item>
                <Descriptions.Item label="客户编号">{masterOrder.customerCode}</Descriptions.Item>
                <Descriptions.Item label="客户名称">{masterOrder.customerName}</Descriptions.Item>
                <Descriptions.Item label="下单时间">
                  {dayjs(masterOrder.orderDate).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
                <Descriptions.Item label="运输方式">
                  <Tag color={masterOrder.transportType === 'SEA' ? 'blue' : 'orange'}>
                    {masterOrder.transportType === 'SEA' ? '海运' : '空运'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="首选线路">{masterOrder.preferredRoute}</Descriptions.Item>
              </Descriptions>
              {masterOrder.remark && (
                <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                  <Text type="secondary">备注：</Text>
                  <Text>{masterOrder.remark}</Text>
                </div>
              )}
              <Divider style={{ margin: '10px 0 8px' }} />
              <div className="compact-stats">
                <Tag color="blue">总件 {masterOrder.totalPieces}</Tag>
                <Tag>总重 {Number(masterOrder.totalWeight || 0).toFixed(1)}Kg</Tag>
                <Tag color="orange">体积 {Number(masterOrder.totalVolume || 0).toFixed(3)}m³</Tag>
                <Tag color="blue">货值 USD {Number(masterOrder.totalValue || 0).toFixed(2)}</Tag>
              </div>
            </Card>
          </div>

          {/* 路线与收发货人 */}
          <div id="order-route" style={{ marginBottom: 24 }}>
            <Card title="路线与收发货人" size="small">
              <Row gutter={24}>
                <Col span={12}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 500, marginBottom: 8, color: '#666' }}>发货人信息</div>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="姓名">{masterOrder.sender}</Descriptions.Item>
                      <Descriptions.Item label="电话">{masterOrder.senderPhone}</Descriptions.Item>
                      <Descriptions.Item label="地址">{masterOrder.senderAddress}</Descriptions.Item>
                      {masterOrder.pickupAddress && (
                        <Descriptions.Item label="取件地址">{masterOrder.pickupAddress}</Descriptions.Item>
                      )}
                    </Descriptions>
                  </div>
                </Col>
                <Col span={12} style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: 24 }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 500, marginBottom: 8, color: '#666' }}>收货人信息</div>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="姓名">{masterOrder.consignee}</Descriptions.Item>
                      <Descriptions.Item label="电话">{masterOrder.consigneePhone}</Descriptions.Item>
                      <Descriptions.Item label="邮箱">{masterOrder.consigneeEmail}</Descriptions.Item>
                      <Descriptions.Item label="国家">{masterOrder.destCountry}</Descriptions.Item>
                      <Descriptions.Item label="城市">{masterOrder.destCity}</Descriptions.Item>
                      <Descriptions.Item label="地址">{masterOrder.destAddress}</Descriptions.Item>
                    </Descriptions>
                  </div>
                </Col>
              </Row>
            </Card>
          </div>

          {/* 物流状态 */}
          <div id="order-logistics" style={{ marginBottom: 24 }}>
            <Card
              title={`物流状态 / 子订单 (${subOrders.length}个)`}
              size="small"
              extra={
                masterOrder.splitStatus === 'PENDING' && (
                  <Button
                    type="primary"
                    icon={<SplitCellsOutlined />}
                    onClick={() => setSplitModalVisible(true)}
                  >
                    拆分订单
                  </Button>
                )
              }
            >
              {subOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
                  <InboxOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>暂无子订单，点击"拆分订单"开始拆分</div>
                </div>
              ) : (
                <>
                  <Table
                    dataSource={subOrders}
                    columns={subOrderColumns}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 1400 }}
                    locale={{ emptyText: '暂无子订单' }}
                    style={{ marginBottom: 24 }}
                  />
                  <Divider>物流跟踪</Divider>
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {subOrders.map(subOrder => (
                      <Card
                        key={subOrder.id}
                        title={
                          <Space>
                            <Text>{subOrder.subOrderNo}</Text>
                            <Tag color={getStatusColor(subOrder.status)}>
                              {getStatusText(subOrder.status)}
                            </Tag>
                          </Space>
                        }
                        size="small"
                      >
                        <Timeline
                          items={subOrder.timeline.map((node, idx) => ({
                            color: node.status === 'current' ? 'green' : node.status === 'completed' ? 'blue' : 'gray',
                            dot: node.status === 'current' ? <ClockCircleOutlined /> : node.status === 'completed' ? <CheckCircleOutlined /> : undefined,
                            children: (
                              <>
                                <div style={{ fontWeight: 'bold' }}>
                                  {node.node}
                                  {node.nodeEn && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>({node.nodeEn})</Text>}
                                </div>
                                {node.location && (
                                  <div style={{ fontSize: 12, color: '#666' }}>
                                    <EnvironmentOutlined /> {node.location}
                                  </div>
                                )}
                                {node.remark && (
                                  <div style={{ fontSize: 12, color: '#999' }}>{node.remark}</div>
                                )}
                                <div style={{ fontSize: 12, color: '#999' }}>{node.time}</div>
                                {node.operator && (
                                  <div style={{ fontSize: 12, color: '#999' }}>操作人: {node.operator}</div>
                                )}
                              </>
                            )
                          }))}
                        />
                      </Card>
                    ))}
                  </Space>
                </>
              )}
            </Card>
          </div>

          {/* 订单初始信息 */}
          <div id="order-initial" style={{ marginBottom: 24 }}>
            <Card title={`订单初始信息 (${masterOrder.expressPackages?.length || 0})`} size="small">
              <Table
                dataSource={masterOrder.expressPackages || []}
                columns={expressPackageColumns}
                rowKey="id"
                pagination={false}
                locale={{ emptyText: '暂无快递包裹信息' }}
                summary={(pageData) => {
                  const totalWeight = pageData.reduce((sum, pkg) => sum + pkg.weight, 0);
                  const totalPieces = pageData.reduce((sum, pkg) => sum + pkg.pieces, 0);
                  const totalValue = pageData.reduce((sum, pkg) => sum + pkg.value, 0);
                  return (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={6} align="right">
                          <Text strong>合计</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={6} align="right">
                          <Text strong>{totalWeight}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={7} align="right">
                          <Text strong>{totalPieces}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={8} align="right">
                          <Text strong>{totalValue}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={9} />
                        <Table.Summary.Cell index={10} />
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            </Card>
          </div>

          {/* 订单实际信息 */}
          <div id="order-actual" style={{ marginBottom: 24 }}>
            <Card title={`订单实际信息 / 物品清单 (${masterOrder.items.length})`} size="small">
              <Table
                dataSource={masterOrder.items}
                columns={itemColumns}
                rowKey="id"
                pagination={false}
                scroll={{ x: 1200 }}
              />
            </Card>
          </div>

          {/* 应收明细 */}
          <div id="order-receivable" style={{ marginBottom: 24 }}>
            <Card
              title="应收明细"
              size="small"
              style={{ borderTop: '3px solid #cf1322' }}
              extra={
                !['RETURN_APPLIED', 'CANCELLED'].includes(currentStatus) && (
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setFeeModalVisible(true)}
                  >
                    添加费用
                  </Button>
                )
              }
            >
              <Row gutter={24}>
                <Col span={16}>
                  {/* 运费预估/实际 - 下单即估算，入库称重后实算 */}
                  <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text type="secondary">预估运费（按申报重量）</Text>
                      <Text>¥{(masterOrder.estimatedFreight || 0).toFixed(2)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary">实际运费（按入库称重）</Text>
                      {masterOrder.actualFreight && masterOrder.actualFreight > 0 ? (
                        <Text strong style={{ color: '#389e0d', fontSize: 16 }}>¥{masterOrder.actualFreight.toFixed(2)}</Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>待入库称重后生成</Text>
                      )}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text type="secondary">总运费</Text>
                      <Text>¥{masterOrder.totalFreight?.toFixed(2) || '0.00'}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text type="secondary">总费用</Text>
                      <Text>¥{masterOrder.totalFees?.toFixed(2) || '0.00'}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text type="secondary">已支付</Text>
                      <Text type="success">¥{masterOrder.paidAmount?.toFixed(2) || '0.00'}</Text>
                    </div>
                  </div>
                  <Divider style={{ margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>应收总额</span>
                    <span style={{ color: '#cf1322', fontSize: 20, fontWeight: 'bold' }}>
                      ¥{((masterOrder.totalFees || 0) - (masterOrder.paidAmount || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Tag color={masterOrder.paymentStatus === 'PAID' ? 'success' : masterOrder.paymentStatus === 'PARTIAL' ? 'warning' : 'error'}>
                      {masterOrder.paymentStatus === 'PAID' ? '已支付' : masterOrder.paymentStatus === 'PARTIAL' ? '部分支付' : '未支付'}
                    </Tag>
                  </div>
                </Col>
                <Col span={8}>
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Button
                      type="primary"
                      block
                      icon={<PayCircleOutlined />}
                      onClick={() => setPayModalVisible(true)}
                      disabled={masterOrder.paymentStatus === 'PAID' || ['RETURN_APPLIED', 'CANCELLED'].includes(currentStatus)}
                    >
                      登记收款
                    </Button>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Button
                          block
                          size="small"
                          icon={<RollbackOutlined />}
                          onClick={() => setRefundModalVisible(true)}
                          disabled={['RETURN_APPLIED', 'CANCELLED'].includes(currentStatus)}
                        >
                          退款
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button
                          block
                          size="small"
                          icon={<RedoOutlined />}
                          onClick={() => setRecoverFeeModalVisible(true)}
                          disabled={['RETURN_APPLIED', 'CANCELLED'].includes(currentStatus)}
                        >
                          追回
                        </Button>
                      </Col>
                    </Row>
                    <Button
                      block
                      size="small"
                      icon={<FileAddOutlined />}
                      onClick={() => setSupplementModalVisible(true)}
                      disabled={['RETURN_APPLIED', 'CANCELLED'].includes(currentStatus)}
                    >
                      补单处理
                    </Button>
                  </Space>
                  <Divider style={{ margin: '16px 0' }} />
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">拆单状态</Text>
                      <Tag color={masterOrder.splitStatus === 'COMPLETED' ? 'success' : masterOrder.splitStatus === 'PARTIAL' ? 'processing' : 'default'}>
                        {masterOrder.splitStatus === 'COMPLETED' ? '已完成' : masterOrder.splitStatus === 'PARTIAL' ? '部分拆分' : '待拆分'}
                      </Tag>
                    </div>
                    {masterOrder.splitType && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary">拆单方式</Text>
                        <Text>{masterOrder.splitType === 'MANUAL' ? '手动拆单' : '自动拆单'}</Text>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">子订单数</Text>
                      <Text strong>{subOrders.length}</Text>
                    </div>
                    {subOrders.length > 0 && (
                      <>
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ fontSize: 12 }}>
                          <div style={{ marginBottom: 4 }}>
                            已签收: {subOrders.filter(s => s.status === 'DELIVERED').length} 个
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            运输中: {subOrders.filter(s => ['IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'DELIVERING'].includes(s.status)).length} 个
                          </div>
                          <div>
                            待发货: {subOrders.filter(s => ['PENDING_INBOUND', 'INBOUND', 'PENDING_PACKING', 'PACKED', 'PENDING_DEPARTURE'].includes(s.status)).length} 个
                          </div>
                        </div>
                      </>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* Fee Entry Modal */}
      <Modal
        title="录入订单额外费用"
        open={feeModalVisible}
        onCancel={() => {
          setFeeModalVisible(false);
          feeForm.resetFields();
        }}
        onOk={handleSubmitFee}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">运单号: </Text>
          <Text strong>{masterOrder.orderNo}</Text>
        </div>
        <Form form={feeForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="费用类别"
                rules={[{ required: true, message: '请选择费用类别' }]}
              >
                <Select placeholder="选择费用类别">
                  <Select.Option value="仓储费">仓储费</Select.Option>
                  <Select.Option value="打包费">打包费</Select.Option>
                  <Select.Option value="加固费">加固费</Select.Option>
                  <Select.Option value="超长费">超长费</Select.Option>
                  <Select.Option value="超重费">超重费</Select.Option>
                  <Select.Option value="其他费用">其他费用</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="item"
                label="费用项目"
                rules={[{ required: true, message: '请输入费用项目' }]}
              >
                <Input placeholder="例如: 额外仓储7天" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="金额"
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
                rules={[{ required: true, message: '请选择币种' }]}
                initialValue="CNY"
              >
                <Select>
                  <Select.Option value="CNY">CNY (人民币)</Select.Option>
                  <Select.Option value="USD">USD (美元)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="chargeType"
            label="费用类型"
            rules={[{ required: true, message: '请选择费用类型' }]}
            initialValue="CUSTOMER"
          >
            <Select>
              <Select.Option value="CUSTOMER">向客户收费</Select.Option>
              <Select.Option value="SUPPLIER">付给供应商</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注说明"
          >
            <TextArea
              rows={3}
              placeholder="请输入费用产生原因、详细说明等"
            />
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

      {/* Payment Modal - 登记收款（提交审核） */}
      <Modal
        title="登记收款"
        open={payModalVisible}
        onCancel={() => setPayModalVisible(false)}
        okText="提交审核"
        onOk={() => {
          const receiptStore = JSON.parse(localStorage.getItem('finance_payment_receipt_store') || '{}');
          const orderNo = masterOrder.orderNo;
          const outstanding = (masterOrder.totalFees || 0) - (masterOrder.paidAmount || 0);
          const receipt = {
            id: `RCV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            orderNo,
            amount: outstanding,
            paymentChannel: 'BANK',
            receivedAt: dayjs().toISOString(),
            voucherNames: ['收款凭证.png'],
            operator: '当前用户',
            remark: '',
            status: 'PENDING' as const,
          };
          const list = receiptStore[orderNo] || [];
          list.push(receipt);
          receiptStore[orderNo] = list;
          localStorage.setItem('finance_payment_receipt_store', JSON.stringify(receiptStore));
          message.success('收款登记已提交，等待财务审核');
          setPayModalVisible(false);
        }}
        width={600}
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f' }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>运单号:</Text>
              <Text>{masterOrder.orderNo}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>客户:</Text>
              <Text>{masterOrder.customerName}</Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">订单总额:</Text>
              <Text>¥{(masterOrder.totalFees || 0).toFixed(2)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">已支付:</Text>
              <Text type="success">¥{(masterOrder.paidAmount || 0).toFixed(2)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ color: '#cf1322' }}>待收款:</Text>
              <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                ¥{((masterOrder.totalFees || 0) - (masterOrder.paidAmount || 0)).toFixed(2)}
              </Text>
            </div>
          </Space>
        </div>
        <Form layout="vertical">
          <Form.Item label="收款金额" required>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={(masterOrder.totalFees || 0) - (masterOrder.paidAmount || 0)}
              precision={2}
              prefix="¥"
              defaultValue={(masterOrder.totalFees || 0) - (masterOrder.paidAmount || 0)}
            />
          </Form.Item>
          <Form.Item label="收款方式" required>
            <Select defaultValue="BANK">
              <Select.Option value="WECHAT">微信支付</Select.Option>
              <Select.Option value="ALIPAY">支付宝</Select.Option>
              <Select.Option value="BANK">银行转账</Select.Option>
              <Select.Option value="CASH">现金</Select.Option>
              <Select.Option value="OTHER">其他方式</Select.Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="收款时间" required>
                <DatePicker showTime style={{ width: '100%' }} defaultValue={dayjs()} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="收款账户">
                <Select placeholder="选择收款账户">
                  <Select.Option value="COMPANY_BANK">公司银行账户</Select.Option>
                  <Select.Option value="COMPANY_WECHAT">公司微信</Select.Option>
                  <Select.Option value="COMPANY_ALIPAY">公司支付宝</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="上传收款凭证" required extra="支持图片格式，最多5张">
            <Upload.Dragger
              name="voucher"
              multiple
              maxCount={5}
              accept="image/*"
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽上传收款凭证</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item label="交易凭证号">
            <Input placeholder="请输入交易流水号或凭证号" />
          </Form.Item>
          <Form.Item label="备注">
            <TextArea rows={2} placeholder="收款备注（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Trace Modal */}
      <Modal
        title="更新物流轨迹"
        open={traceModalVisible}
        onCancel={() => setTraceModalVisible(false)}
        onOk={handleUpdateTrace}
      >
        <Form form={traceForm} layout="vertical" initialValues={{ time: dayjs() }}>
          <Form.Item name="subOrderId" label="选择子订单" rules={[{ required: true }]}>
            <Select placeholder="选择要更新的子订单">
              {subOrders.map(sub => (
                <Select.Option key={sub.id} value={sub.id}>
                  {sub.subOrderNo} - {sub.route}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="time" label="发生时间" rules={[{ required: true }]}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="节点状态" rules={[{ required: true }]}>
            <Select placeholder="选择节点状态">
              <Select.Option value="已入库">已入库</Select.Option>
              <Select.Option value="已装箱">已装箱</Select.Option>
              <Select.Option value="已发货">已发货</Select.Option>
              <Select.Option value="运输中">运输中</Select.Option>
              <Select.Option value="已到达">已到达</Select.Option>
              <Select.Option value="清关中">清关中</Select.Option>
              <Select.Option value="清关完成">清关完成</Select.Option>
              <Select.Option value="配送中">配送中</Select.Option>
              <Select.Option value="已签收">已签收</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="location" label="当前位置">
            <Input prefix={<EnvironmentOutlined />} placeholder="例如: 广州仓库" />
          </Form.Item>
          <Form.Item name="desc" label="详细说明">
            <TextArea rows={2} placeholder="详细说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Share Modal - 订单分享 */}
      <Modal
        title="分享订单"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        onOk={handleShareOrder}
        okText="复制链接"
        width={500}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <Text strong>运单号: {masterOrder.orderNo}</Text>
          </div>
          <div>
            <Text type="secondary">分享链接:</Text>
            <Input.TextArea
              value={`${window.location.origin}/order/${orderId}`}
              rows={2}
              readOnly
              style={{ marginTop: 8 }}
            />
          </div>
          <div style={{ padding: 12, background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              提示: 点击"复制链接"按钮将订单链接复制到剪贴板，然后可以通过微信、邮件等方式分享给客户。
            </Text>
          </div>
        </Space>
      </Modal>

      {/* Reminder Modal - 催款通知 */}
      <Modal
        title="发送催款通知"
        open={reminderModalVisible}
        onCancel={() => {
          setReminderModalVisible(false);
          reminderForm.resetFields();
        }}
        onOk={handleSendReminder}
        width={600}
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#fff7e6', borderRadius: 4, border: '1px solid #ffd591' }}>
          <Space direction="vertical" size={4}>
            <Text strong>运单号: {masterOrder.orderNo}</Text>
            <Text type="secondary">客户: {masterOrder.customerName}</Text>
            <Text type="danger">应收金额: ¥{((masterOrder.totalFees || 0) - (masterOrder.paidAmount || 0)).toFixed(2)}</Text>
          </Space>
        </div>
        <Form form={reminderForm} layout="vertical">
          <Form.Item
            name="method"
            label="通知方式"
            rules={[{ required: true, message: '请选择通知方式' }]}
            initialValue="SMS"
          >
            <Select>
              <Select.Option value="SMS">短信通知</Select.Option>
              <Select.Option value="EMAIL">邮件通知</Select.Option>
              <Select.Option value="WECHAT">微信通知</Select.Option>
              <Select.Option value="PHONE">电话通知</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="template"
            label="通知模板"
            rules={[{ required: true, message: '请选择通知模板' }]}
          >
            <Select placeholder="选择催款模板">
              <Select.Option value="GENTLE">温馨提醒</Select.Option>
              <Select.Option value="NORMAL">正常催款</Select.Option>
              <Select.Option value="URGENT">紧急催款</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="content"
            label="通知内容"
            rules={[{ required: true, message: '请输入通知内容' }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入催款通知内容..."
              defaultValue={`尊敬的${masterOrder.customerName}，您的订单${masterOrder.orderNo}尚有¥${((masterOrder.totalFees || 0) - (masterOrder.paidAmount || 0)).toFixed(2)}未支付，请及时处理。`}
            />
          </Form.Item>
          <Form.Item
            name="scheduledTime"
            label="发送时间"
          >
            <DatePicker showTime style={{ width: '100%' }} placeholder="立即发送" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Supplement Modal - 补单处理 */}
      <Modal
        title="补单处理"
        open={supplementModalVisible}
        onCancel={() => {
          setSupplementModalVisible(false);
          supplementForm.resetFields();
        }}
        onOk={handleSupplement}
        width={600}
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
          <Space direction="vertical" size={4}>
            <Text strong>原运单号: {masterOrder.orderNo}</Text>
            <Text type="secondary">客户: {masterOrder.customerName}</Text>
          </Space>
        </div>
        <Form form={supplementForm} layout="vertical">
          <Form.Item
            name="supplementReason"
            label="补单原因"
            rules={[{ required: true, message: '请选择补单原因' }]}
          >
            <Select placeholder="选择补单原因">
              <Select.Option value="LOST">货物丢失</Select.Option>
              <Select.Option value="DAMAGED">货物损坏</Select.Option>
              <Select.Option value="WRONG_DELIVERY">错发漏发</Select.Option>
              <Select.Option value="CUSTOMER_REQUEST">客户要求</Select.Option>
              <Select.Option value="OTHER">其他原因</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="supplementType"
            label="补单方式"
            rules={[{ required: true, message: '请选择补单方式' }]}
            initialValue="RESEND"
          >
            <Select>
              <Select.Option value="RESEND">重新发货</Select.Option>
              <Select.Option value="REFUND">退款处理</Select.Option>
              <Select.Option value="COMPENSATION">赔偿处理</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="responsibleParty"
            label="责任方"
            rules={[{ required: true, message: '请选择责任方' }]}
          >
            <Select placeholder="选择责任方">
              <Select.Option value="COMPANY">公司承担</Select.Option>
              <Select.Option value="CARRIER">承运商承担</Select.Option>
              <Select.Option value="WAREHOUSE">仓库承担</Select.Option>
              <Select.Option value="CUSTOMER">客户承担</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="remark"
            label="详细说明"
            rules={[{ required: true, message: '请输入详细说明' }]}
          >
            <TextArea rows={4} placeholder="请详细描述补单原因和处理方案..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Recover Fee Modal - 费用追回 */}
      <Modal
        title="费用追回"
        open={recoverFeeModalVisible}
        onCancel={() => {
          setRecoverFeeModalVisible(false);
          recoverFeeForm.resetFields();
        }}
        onOk={handleRecoverFee}
        width={600}
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#fff7e6', borderRadius: 4, border: '1px solid #ffd591' }}>
          <Space direction="vertical" size={4}>
            <Text strong>运单号: {masterOrder.orderNo}</Text>
            <Text type="secondary">客户: {masterOrder.customerName}</Text>
          </Space>
        </div>
        <Form form={recoverFeeForm} layout="vertical">
          <Form.Item
            name="recoverAmount"
            label="追回金额"
            rules={[{ required: true, message: '请输入追回金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              prefix="¥"
              placeholder="请输入需要追回的金额"
            />
          </Form.Item>
          <Form.Item
            name="recoverReason"
            label="追回原因"
            rules={[{ required: true, message: '请选择追回原因' }]}
          >
            <Select placeholder="选择追回原因">
              <Select.Option value="OVERCHARGE">多收费用</Select.Option>
              <Select.Option value="DUPLICATE_PAYMENT">重复支付</Select.Option>
              <Select.Option value="SERVICE_NOT_PROVIDED">服务未提供</Select.Option>
              <Select.Option value="CALCULATION_ERROR">计算错误</Select.Option>
              <Select.Option value="OTHER">其他原因</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="recoverFrom"
            label="追回对象"
            rules={[{ required: true, message: '请选择追回对象' }]}
          >
            <Select placeholder="选择追回对象">
              <Select.Option value="CUSTOMER">客户</Select.Option>
              <Select.Option value="SUPPLIER">供应商</Select.Option>
              <Select.Option value="CARRIER">承运商</Select.Option>
              <Select.Option value="WAREHOUSE">仓库</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注说明"
            rules={[{ required: true, message: '请输入备注说明' }]}
          >
            <TextArea rows={3} placeholder="请详细说明费用追回的原因和依据..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Refund Modal - 退款处理 */}
      <Modal
        title="退款处理"
        open={refundModalVisible}
        onCancel={() => {
          setRefundModalVisible(false);
          refundForm.resetFields();
        }}
        onOk={handleRefund}
        width={600}
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#fff1f0', borderRadius: 4, border: '1px solid #ffa39e' }}>
          <Space direction="vertical" size={4}>
            <Text strong>运单号: {masterOrder.orderNo}</Text>
            <Text type="secondary">客户: {masterOrder.customerName}</Text>
            <Text>已支付金额: ¥{(masterOrder.paidAmount || 0).toFixed(2)}</Text>
          </Space>
        </div>
        <Form form={refundForm} layout="vertical">
          <Form.Item
            name="refundAmount"
            label="退款金额"
            rules={[{ required: true, message: '请输入退款金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={masterOrder.paidAmount || 0}
              precision={2}
              prefix="¥"
              placeholder="请输入退款金额"
            />
          </Form.Item>
          <Form.Item
            name="refundReason"
            label="退款原因"
            rules={[{ required: true, message: '请选择退款原因' }]}
          >
            <Select placeholder="选择退款原因">
              <Select.Option value="CUSTOMER_REQUEST">客户要求退款</Select.Option>
              <Select.Option value="ORDER_CANCEL">订单取消</Select.Option>
              <Select.Option value="SERVICE_ISSUE">服务问题</Select.Option>
              <Select.Option value="OVERCHARGE">多收费用</Select.Option>
              <Select.Option value="OTHER">其他原因</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="refundMethod"
            label="退款方式"
            rules={[{ required: true, message: '请选择退款方式' }]}
            initialValue="ORIGINAL"
          >
            <Select>
              <Select.Option value="ORIGINAL">原路退回</Select.Option>
              <Select.Option value="BANK">银行转账</Select.Option>
              <Select.Option value="WECHAT">微信退款</Select.Option>
              <Select.Option value="ALIPAY">支付宝退款</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注说明"
          >
            <TextArea rows={3} placeholder="请输入退款详细说明..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 申请退单 Modal */}
      <Modal
        title="申请退单"
        open={returnModalVisible}
        onCancel={() => {
          setReturnModalVisible(false);
          returnForm.resetFields();
          setNeedReturnShipping(false);
        }}
        onOk={handleApplyReturn}
        width={650}
        destroyOnClose
      >
        <Form form={returnForm} layout="vertical">
          <Divider titlePlacement="left" plain>退单信息</Divider>
          <Form.Item
            name="returnType"
            label="退单类型"
            rules={[{ required: true, message: '请选择退单类型' }]}
          >
            <Select placeholder="请选择退单类型">
              <Select.Option value="CUSTOMER_CANCEL">客户主动取消</Select.Option>
              <Select.Option value="GOODS_ISSUE">货物问题</Select.Option>
              <Select.Option value="ADDRESS_ERROR">地址错误</Select.Option>
              <Select.Option value="OTHER">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="returnReason"
            label="退单原因"
            rules={[{ required: true, message: '请输入退单原因' }]}
          >
            <TextArea rows={3} placeholder="请详细描述退单原因..." maxLength={500} showCount />
          </Form.Item>

          <Divider titlePlacement="left" plain>退费信息</Divider>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <Space split={<Divider type="vertical" />}>
                <span>已产生费用 <Text strong>¥{(masterOrder.totalFees || 0).toFixed(2)}</Text></span>
                <span>已收款 <Text strong>¥{(masterOrder.paidAmount || 0).toFixed(2)}</Text></span>
              </Space>
            }
          />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="returnRefundAmount"
                label="退费金额"
                rules={[{ required: true, message: '请输入退费金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  prefix="¥"
                  placeholder="请输入退费金额"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.returnRefundAmount !== cur.returnRefundAmount}
              >
                {({ getFieldValue }) => (
                  <Form.Item
                    name="returnRefundMethod"
                    label="退费方式"
                    rules={[{ required: (getFieldValue('returnRefundAmount') || 0) > 0, message: '退费金额大于0时必须选择退费方式' }]}
                  >
                    <Select placeholder="请选择退费方式" allowClear>
                      <Select.Option value="ORIGINAL">原路退回</Select.Option>
                      <Select.Option value="BANK_TRANSFER">银行转账</Select.Option>
                      <Select.Option value="OFFLINE">线下退款</Select.Option>
                    </Select>
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>

          <Divider titlePlacement="left" plain>退运信息</Divider>
          <Form.Item
            name="needReturn"
            label="是否需要退运"
            rules={[{ required: true, message: '请选择是否需要退运' }]}
          >
            <Radio.Group onChange={(e) => setNeedReturnShipping(e.target.value)}>
              <Radio value={true}>是</Radio>
              <Radio value={false}>否</Radio>
            </Radio.Group>
          </Form.Item>
          {needReturnShipping && (
            <Form.Item
              name="returnShippingNote"
              label="退运说明"
            >
              <TextArea rows={2} placeholder="请补充退运说明（选填）" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Split Order Modal */}
      <OrderSplitModal
        visible={splitModalVisible}
        masterOrder={masterOrder}
        onCancel={() => setSplitModalVisible(false)}
        onConfirm={handleConfirmSplit}
      />

      {/* Sub-Order Detail Drawer */}
      <SubOrderDetail
        visible={subOrderDetailVisible}
        subOrder={selectedSubOrder}
        onClose={() => {
          setSubOrderDetailVisible(false);
          setSelectedSubOrder(null);
        }}
      />

      {/* Shipping Label Print */}
      <ShippingLabelPrint
        visible={printLabelVisible}
        order={masterOrder as any}
        onClose={() => setPrintLabelVisible(false)}
      />
    </div>
  );
};
