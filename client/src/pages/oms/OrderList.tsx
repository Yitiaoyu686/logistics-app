import React, { useState, useMemo, useEffect } from 'react';
import {
  Table, Input, Button, Row, Col, Form, Select,
  Tag, Space, Modal, Typography, Card, Drawer, message, InputNumber, Badge, Divider
} from 'antd';
import {
  DollarOutlined, PlusOutlined, SplitCellsOutlined, AuditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MasterOrder, OrderStatus } from '../../types/core';
import { orderApi } from '../../api';
import { OrderCreate } from './OrderCreate';
import MasterOrderDetailDrawer from './MasterOrderDetailDrawer';

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

export const OrderList: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<MasterOrder | null>(null);
  const [feeModalVisible, setFeeModalVisible] = useState(false);
  const [currentFeeOrderId, setCurrentFeeOrderId] = useState('');
  const [feeForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<MasterOrder | null>(null);
  const [reviewForm] = Form.useForm();
  const [reviewResult, setReviewResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<MasterOrder[]>([]);
  const [allSubOrders, setAllSubOrders] = useState<any[]>([]);

  // 加载数据
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [masterRes, subRes] = await Promise.all([
        orderApi.listMaster(),
        orderApi.listSub(),
      ]) as any[];
      setOrders(masterRes.data || []);
      setAllSubOrders(subRes.data || []);
    } catch (error: any) {
      message.error(error.message || '加载订单数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Calculate real-time status for each order
  const ordersWithStatus = useMemo(() => {
    return orders.map(order => {
      const subOrders = allSubOrders.filter(sub => sub.masterOrderId === order.id);
      const currentStatus = subOrders.length > 0
        ? (order.status as OrderStatus)
        : order.status;

      return {
        ...order,
        currentStatus,
        subOrderCount: subOrders.length
      };
    });
  }, [orders, allSubOrders]);

  const handleOpenFeeModal = (orderId: string) => {
    setCurrentFeeOrderId(orderId);
    setFeeModalVisible(true);
  };

  const handleSubmitFee = async () => {
    try {
      const values = await feeForm.validateFields();
      console.log('提交订单费用:', {
        orderId: currentFeeOrderId,
        ...values
      });
      message.success('费用添加成功');
      setFeeModalVisible(false);
      feeForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const TABS = [
    { key: 'ALL', label: '全部', count: ordersWithStatus.length },
    { key: 'PENDING_INBOUND', label: '等待入库', count: ordersWithStatus.filter(o => o.currentStatus === 'PENDING_INBOUND').length },
    { key: 'INBOUND', label: '已入库', count: ordersWithStatus.filter(o => o.currentStatus === 'INBOUND').length },
    { key: 'IN_TRANSIT', label: '运输中', count: ordersWithStatus.filter(o => ['PENDING_DEPARTURE', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'].includes(o.currentStatus)).length },
    { key: 'PARTIAL_DELIVERED', label: '部分签收', count: ordersWithStatus.filter(o => o.currentStatus === 'PARTIAL_DELIVERED').length },
    { key: 'COMPLETED', label: '已完成', count: ordersWithStatus.filter(o => o.currentStatus === 'COMPLETED').length },
    { key: 'RETURN', label: '退单', count: ordersWithStatus.filter(o => ['RETURN_APPLIED', 'CANCELLED'].includes(o.currentStatus)).length },
  ];

  const STATUS_MAP: Record<OrderStatus, { label: string, color: string }> = {
    'PENDING_INBOUND': { label: '待入库', color: 'warning' },
    'INBOUND': { label: '已入库', color: 'cyan' },
    'PENDING_DEPARTURE': { label: '待发货', color: 'orange' },
    'DEPARTED': { label: '已发货', color: 'blue' },
    'IN_TRANSIT': { label: '运输中', color: 'geekblue' },
    'ARRIVED': { label: '已到达', color: 'purple' },
    'PARTIAL_DELIVERED': { label: '部分签收', color: 'lime' },
    'COMPLETED': { label: '已完成', color: 'success' },
    'EXCEPTION': { label: '异常', color: 'error' },
    'RETURN_APPLIED': { label: '退单申请中', color: 'volcano' },
    'CANCELLED': { label: '已取消', color: 'default' }
  };

  const columns = [
    {
      title: '序号',
      render: (_: any, __: any, i: number) => i + 1,
      width: 60,
      fixed: 'left' as const
    },
    {
      title: '运单号',
      dataIndex: 'orderNo',
      width: 180,
      fixed: 'left' as const,
      render: (t: string, r: MasterOrder & { currentStatus: OrderStatus; subOrderCount: number }) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => { setSelectedOrder(r); setDetailVisible(true); }}>
            {t}
          </a>
          {r.subOrderCount > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {r.subOrderCount} 个子订单
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '客户',
      width: 150,
      render: (r: MasterOrder) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.customerName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.customerCode}</Text>
        </Space>
      )
    },
    {
      title: '目的地',
      width: 130,
      render: (r: MasterOrder) => (
        <Space direction="vertical" size={0}>
          <Text>{r.destCountry}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.destCity}</Text>
        </Space>
      )
    },
    {
      title: '运输方式',
      dataIndex: 'transportType',
      width: 100,
      render: (type?: string) => type ? (
        <Tag color={type === 'SEA' ? 'blue' : 'orange'}>
          {type === 'SEA' ? '海运' : '空运'}
        </Tag>
      ) : '-'
    },
    {
      title: '货物信息',
      width: 150,
      render: (r: MasterOrder) => (
        <Space direction="vertical" size={0}>
          <Text>{r.totalPieces} 件</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.totalWeight.toFixed(1)}kg / {r.totalVolume.toFixed(2)}m³
          </Text>
        </Space>
      )
    },
    {
      title: '拆单状态',
      dataIndex: 'splitStatus',
      width: 100,
      render: (status: string, r: MasterOrder & { subOrderCount: number }) => {
        const colorMap: Record<string, string> = {
          'PENDING': 'default',
          'PARTIAL': 'processing',
          'COMPLETED': 'success'
        };
        const textMap: Record<string, string> = {
          'PENDING': '待拆分',
          'PARTIAL': '部分拆分',
          'COMPLETED': '已拆分'
        };
        return (
          <Space direction="vertical" size={0}>
            <Tag color={colorMap[status]} icon={status === 'COMPLETED' ? <SplitCellsOutlined /> : undefined}>
              {textMap[status]}
            </Tag>
            {r.subOrderCount > 0 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {r.subOrderCount}个
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: '订单状态',
      width: 110,
      render: (_: any, r: MasterOrder & { currentStatus: OrderStatus }) => (
        <Tag color={STATUS_MAP[r.currentStatus]?.color}>
          {STATUS_MAP[r.currentStatus]?.label}
        </Tag>
      )
    },
    {
      title: '支付状态',
      dataIndex: 'paymentStatus',
      width: 100,
      render: (v?: string) => {
        const colorMap: Record<string, string> = {
          'PAID': 'success',
          'PARTIAL': 'warning',
          'UNPAID': 'error'
        };
        const textMap: Record<string, string> = {
          'PAID': '已支付',
          'PARTIAL': '部分支付',
          'UNPAID': '未支付'
        };
        return v ? <Tag color={colorMap[v]}>{textMap[v]}</Tag> : '-';
      }
    },
    {
      title: '费用',
      width: 120,
      render: (r: MasterOrder) => (
        <Space direction="vertical" size={0}>
          <Text strong>¥{r.totalFees?.toFixed(2) || '0.00'}</Text>
          {r.paidAmount !== undefined && r.paidAmount > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              已付: ¥{r.paidAmount.toFixed(2)}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: '下单时间',
      dataIndex: 'orderDate',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      fixed: 'right' as const,
      width: 180,
      render: (r: MasterOrder & { currentStatus: OrderStatus }) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => { setSelectedOrder(r); setDetailVisible(true); }}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DollarOutlined />}
            onClick={() => handleOpenFeeModal(r.id)}
          >
            费用
          </Button>
          {r.currentStatus === 'RETURN_APPLIED' && (
            <Button
              type="link"
              size="small"
              icon={<AuditOutlined />}
              style={{ color: '#fa541c' }}
              onClick={() => { setReviewOrder(r); setReviewModalVisible(true); }}
            >
              审核
            </Button>
          )}
        </Space>
      )
    }
  ];

  // Filter data
  const filteredData = useMemo(() => {
    let result = ordersWithStatus;

    // Filter by tab
    if (activeTab !== 'ALL') {
      if (activeTab === 'IN_TRANSIT') {
        result = result.filter(o => ['PENDING_DEPARTURE', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED'].includes(o.currentStatus));
      } else if (activeTab === 'RETURN') {
        result = result.filter(o => ['RETURN_APPLIED', 'CANCELLED'].includes(o.currentStatus));
      } else {
        result = result.filter(o => o.currentStatus === activeTab);
      }
    }

    // Filter by search text
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(o =>
        o.orderNo.toLowerCase().includes(search) ||
        o.customerName.toLowerCase().includes(search) ||
        o.customerCode?.toLowerCase().includes(search) ||
        o.destCountry.toLowerCase().includes(search) ||
        o.destCity.toLowerCase().includes(search)
      );
    }

    return result;
  }, [ordersWithStatus, activeTab, searchText]);

  return (
    <div>
      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Select
                value={activeTab}
                onChange={setActiveTab}
                style={{ width: 150 }}
              >
                {TABS.map(t => (
                  <Option key={t.key} value={t.key}>
                    <Badge count={t.count} offset={[10, 0]} showZero style={{ backgroundColor: '#999' }}>
                      {t.label}
                    </Badge>
                  </Option>
                ))}
              </Select>
              <Input.Search
                placeholder="搜索运单号、客户、目的地..."
                style={{ width: 300 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
              <Select
                placeholder="运输方式"
                style={{ width: 120 }}
                allowClear
              >
                <Option value="SEA">海运</Option>
                <Option value="AIR">空运</Option>
              </Select>
              <Select
                placeholder="拆单状态"
                style={{ width: 120 }}
                allowClear
              >
                <Option value="PENDING">待拆分</Option>
                <Option value="PARTIAL">部分拆分</Option>
                <Option value="COMPLETED">已拆分</Option>
              </Select>
            </Space>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space>
              <Text type="secondary">
                共 {filteredData.length} 个订单
              </Text>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateVisible(true)}
              >
                新建订单
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
          scroll={{ x: 1600 }}
          size="small"
        />
      </Card>

      {/* 费用录入 Modal */}
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
          <Text type="secondary">订单ID: </Text>
          <Text strong>{currentFeeOrderId}</Text>
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
                  <Select.Option value="标签费">标签费</Select.Option>
                  <Select.Option value="照片费">照片费</Select.Option>
                  <Select.Option value="退运费">退运费</Select.Option>
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

      {/* 退单审核 Modal */}
      <Modal
        title="退单审核"
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          setReviewOrder(null);
          reviewForm.resetFields();
          setReviewResult('');
        }}
        onOk={async () => {
          try {
            const values = await reviewForm.validateFields();
            if (!reviewOrder) return;
            if (values.result === 'APPROVE') {
              const updates = {
                status: 'CANCELLED',
                returnApprovedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                returnApprover: '当前用户',
              };
              await orderApi.updateMaster(reviewOrder.id, updates);
              setOrders(prev => prev.map(o => o.id === reviewOrder.id ? { ...o, ...updates } as any : o));
              message.success('审核通过，订单已取消');
              if ((reviewOrder.returnRefundAmount || 0) > 0) {
                message.success('已生成退费记录，请在财务模块处理');
              }
              if (reviewOrder.needReturn) {
                message.success('已生成退运记录，请在仓储模块处理');
              }
            } else {
              const updates = {
                status: reviewOrder.previousStatus || 'PENDING_INBOUND',
                returnType: undefined,
                returnReason: undefined,
                returnRefundAmount: undefined,
                returnRefundMethod: undefined,
                needReturn: undefined,
                returnShippingNote: undefined,
                returnAppliedBy: undefined,
                returnAppliedAt: undefined,
                previousStatus: undefined,
                returnRejectReason: values.opinion,
              };
              await orderApi.updateMaster(reviewOrder.id, updates);
              setOrders(prev => prev.map(o => o.id === reviewOrder.id ? { ...o, ...updates } as any : o));
              message.success('已驳回退单申请，订单恢复为原状态');
            }
            setReviewModalVisible(false);
            setReviewOrder(null);
            reviewForm.resetFields();
            setReviewResult('');
          } catch (error: any) {
            if (error.message) {
              message.error(error.message);
            } else {
              console.error('表单验证失败:', error);
            }
          }
        }}
        width={700}
        destroyOnClose
      >
        {reviewOrder && (
          <>
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, marginBottom: 20 }}>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Text type="secondary">运单号：</Text>
                  <Text strong>{reviewOrder.orderNo}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">客户名称：</Text>
                  <Text strong>{reviewOrder.customerName}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">申请前状态：</Text>
                  <Tag color={STATUS_MAP[reviewOrder.previousStatus || 'PENDING_INBOUND']?.color}>
                    {STATUS_MAP[reviewOrder.previousStatus || 'PENDING_INBOUND']?.label}
                  </Tag>
                </Col>
                <Col span={12}>
                  <Text type="secondary">退单类型：</Text>
                  <Text>{
                    { CUSTOMER_CANCEL: '客户主动取消', GOODS_ISSUE: '货物问题', ADDRESS_ERROR: '地址错误', OTHER: '其他' }[reviewOrder.returnType || 'OTHER']
                  }</Text>
                </Col>
                <Col span={24}>
                  <Text type="secondary">退单原因：</Text>
                  <Text>{reviewOrder.returnReason}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">退费金额：</Text>
                  <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                    ¥{(reviewOrder.returnRefundAmount || 0).toFixed(2)}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">退费方式：</Text>
                  <Text>{
                    { ORIGINAL: '原路退回', BANK_TRANSFER: '银行转账', OFFLINE: '线下退款' }[reviewOrder.returnRefundMethod || 'ORIGINAL']
                  }</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">是否需要退运：</Text>
                  {reviewOrder.needReturn
                    ? <Tag color="orange">是</Tag>
                    : <Tag>否</Tag>
                  }
                </Col>
                {reviewOrder.returnShippingNote && (
                  <Col span={12}>
                    <Text type="secondary">退运说明：</Text>
                    <Text>{reviewOrder.returnShippingNote}</Text>
                  </Col>
                )}
                <Col span={12}>
                  <Text type="secondary">申请人：</Text>
                  <Text>{reviewOrder.returnAppliedBy}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">申请时间：</Text>
                  <Text>{reviewOrder.returnAppliedAt ? dayjs(reviewOrder.returnAppliedAt).format('YYYY-MM-DD HH:mm') : '-'}</Text>
                </Col>
              </Row>
            </div>
            <Divider>审核意见</Divider>
            <Form form={reviewForm} layout="vertical">
              <Form.Item
                name="result"
                label="审核结果"
                rules={[{ required: true, message: '请选择审核结果' }]}
              >
                <Select
                  placeholder="请选择审核结果"
                  onChange={(v: string) => setReviewResult(v)}
                >
                  <Select.Option value="APPROVE">✓ 通过</Select.Option>
                  <Select.Option value="REJECT">✗ 驳回</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                name="opinion"
                label="审核意见"
                rules={[{ required: reviewResult === 'REJECT', message: '驳回时必须填写审核意见' }]}
              >
                <TextArea
                  rows={3}
                  placeholder={reviewResult === 'REJECT' ? '请填写驳回原因（必填）' : '请填写审核意见（选填）'}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Drawer
        title={<span style={{ color: '#d48806', fontWeight: 700 }}>创建订单</span>}
        width="100%"
        open={createVisible}
        onClose={() => setCreateVisible(false)}
        destroyOnClose
      >
        <OrderCreate
          onCancel={() => setCreateVisible(false)}
          onSubmit={() => setCreateVisible(false)}
        />
      </Drawer>

      <MasterOrderDetailDrawer
        open={detailVisible}
        order={selectedOrder as any}
        onClose={() => {
          setDetailVisible(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
};
