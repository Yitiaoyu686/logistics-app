/**
 * 主订单详情 Drawer
 * 展示主订单完整信息和子订单列表
 */

import { Drawer, Card, Descriptions, Tag, Table, Space, Button, Typography, Row, Col, Divider, Modal, Form, Input, Select, InputNumber, message, Anchor, Radio, Alert, Upload, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CloseOutlined, PrinterOutlined, RollbackOutlined, DollarOutlined, InboxOutlined } from '@ant-design/icons';
import { useState, useRef, useEffect, useMemo, type CSSProperties } from 'react';
import dayjs from 'dayjs';
import type { MasterOrder, SubOrder } from '../../types/order';
import { MASTER_ORDER_STATUS_CONFIG, SUB_ORDER_STATUS_CONFIG } from '../../types/order';
import { systemApi, v2OmsApi, clientApi } from '../../api';
import { mapV2OrderFull } from './orderV2Mapper';
import MasterOrderEditModal from './MasterOrderEditModal';
import InvoiceInfoCard from './components/InvoiceInfoCard';
import { ShippingLabelPrint } from './ShippingLabelPrint';

const { Text } = Typography;

interface MasterOrderDetailDrawerProps {
  open: boolean;
  order: MasterOrder | null;
  onClose: () => void;
  onOrderUpdate?: (orderId: string, updates: Partial<MasterOrder>) => void;
}

const { TextArea } = Input;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: '到付',
  PREPAID: '预付',
  CREDIT_CARD: '信用卡',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: '已付',
  PARTIAL: '部分付',
  UNPAID: '未付',
};

const PAYMENT_CHANNEL_LABEL: Record<string, string> = {
  WECHAT: '微信',
  BANK: '公账',
  CASH: '现金',
};

function formatDateTime(value?: string) {
  return value ? dayjs(value).format('YYYY/MM/DD HH:mm:ss') : '-';
}

function formatPaymentMethod(value?: MasterOrder['paymentMethod']) {
  return value ? PAYMENT_METHOD_LABEL[value] || value : '-';
}

function formatPaymentStatus(value?: MasterOrder['paymentStatus']) {
  return value ? PAYMENT_STATUS_LABEL[value] || value : '-';
}

function formatPaymentChannel(value?: string) {
  return value ? PAYMENT_CHANNEL_LABEL[value] || value : '-';
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ width: 4, height: 16, borderRadius: 2, background: '#1677ff', display: 'inline-block' }} />
      <Text strong style={{ fontSize: 16, color: '#1f1f1f' }}>{title}</Text>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  marginBottom: 18,
  paddingBottom: 2,
};

const personPanelStyle: CSSProperties = {
  height: '100%',
  padding: '8px 0',
};

// 应收总计核算（移到主组件前确保可见）
const SUMMARY_CURRENCY_SYMBOL: Record<string, string> = { USD: '$', CNY: '¥', NGN: '₦', EUR: '€' };

function ReceivableSummaryCard({ order, fees = [] }: { order: MasterOrder; fees?: any[] }) {
  // 按币种汇总应收
  const receivableByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    const rows = (Array.isArray(fees) ? fees : []).filter((f) => f.feeDirection !== 'PAYABLE');
    rows.forEach(f => {
      const cur = f.currency || 'USD';
      map[cur] = (map[cur] || 0) + Number(f.amount || f.amountUsd || 0);
    });
    if (Object.keys(map).length === 0) map['USD'] = order.totalFees || 0;
    return map;
  }, [fees, order.totalFees]);

  // 按币种汇总收款（已通过 / 待审核）
  const receiptsByCurrency = useMemo(() => {
    let receipts: any[] = [];
    try {
      const store = JSON.parse(localStorage.getItem('finance_payment_receipt_store') || '{}');
      receipts = store[order.orderNo] || [];
    } catch { /* ignore */ }
    // 同 PaymentReceiptList 的 mock 注入逻辑
    if (receipts.length === 0) {
      const now = dayjs();
      receipts = [
        { amount: 528, currency: 'USD', status: 'APPROVED' },
        { amount: 50, currency: 'USD', status: 'APPROVED' },
        { amount: 120, currency: 'CNY', status: 'APPROVED' },
        { amount: 80, currency: 'CNY', status: 'PENDING' },
        { amount: 15000, currency: 'NGN', status: 'PENDING' },
      ];
    }
    const approved: Record<string, number> = {};
    const pending: Record<string, number> = {};
    receipts.forEach((r: any) => {
      const cur = r.currency || 'CNY';
      if (r.status === 'APPROVED') approved[cur] = (approved[cur] || 0) + (r.amount || 0);
      else if (r.status === 'PENDING') pending[cur] = (pending[cur] || 0) + (r.amount || 0);
    });
    return { approved, pending };
  }, [order.orderNo]);

  // 所有涉及的币种
  const currencies = useMemo(() => {
    const set = new Set<string>();
    Object.keys(receivableByCurrency).forEach(c => set.add(c));
    Object.keys(receiptsByCurrency.approved).forEach(c => set.add(c));
    Object.keys(receiptsByCurrency.pending).forEach(c => set.add(c));
    return Array.from(set).sort((a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b)));
  }, [receivableByCurrency, receiptsByCurrency]);

  return (
    <div>
      {currencies.map(cur => {
        const symbol = SUMMARY_CURRENCY_SYMBOL[cur] || cur;
        const receivable = receivableByCurrency[cur] || 0;
        const approved = receiptsByCurrency.approved[cur] || 0;
        const pending = receiptsByCurrency.pending[cur] || 0;
        const outstanding = Math.max(0, receivable - approved);
        const tagColor = cur === 'USD' ? 'blue' : cur === 'CNY' ? 'red' : cur === 'NGN' ? 'green' : 'default';
        return (
          <Row gutter={16} key={cur} style={{ marginBottom: currencies.length > 1 ? 12 : 0 }} align="middle">
            <Col span={2} style={{ textAlign: 'center' }}>
              <Tag color={tagColor} style={{ fontSize: 12, margin: 0 }}>{cur}</Tag>
            </Col>
            <Col span={5} style={{ textAlign: 'center' }}>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>应收</Typography.Text>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1677ff' }}>{symbol}{receivable.toFixed(2)}</div>
            </Col>
            <Col span={6} style={{ textAlign: 'center' }}>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>已确认收款</Typography.Text>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}>{symbol}{approved.toFixed(2)}</div>
            </Col>
            <Col span={5} style={{ textAlign: 'center' }}>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>待审核</Typography.Text>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#fa8c16' }}>{symbol}{pending.toFixed(2)}</div>
            </Col>
            <Col span={6} style={{ textAlign: 'center' }}>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>待收余额</Typography.Text>
              <div style={{ fontSize: 18, fontWeight: 600, color: outstanding > 0 ? '#cf1322' : '#52c41a' }}>{symbol}{outstanding.toFixed(2)}</div>
            </Col>
          </Row>
        );
      })}
    </div>
  );
}

export default function MasterOrderDetailDrawer({ open, order, onClose, onOrderUpdate }: MasterOrderDetailDrawerProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [supplementModalOpen, setSupplementModalOpen] = useState(false);
  const [recoverFeeModalOpen, setRecoverFeeModalOpen] = useState(false);
  const [printLabelOpen, setPrintLabelOpen] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  // 内容容器引用，用于锚点定位
  const containerRef = useRef<HTMLDivElement>(null);

  const [reminderForm] = Form.useForm();
  const [refundForm] = Form.useForm();
  const [supplementForm] = Form.useForm();
  const [recoverFeeForm] = Form.useForm();
  const [feeForm] = Form.useForm();
  const [returnForm] = Form.useForm();

  const [subOrders, setSubOrders] = useState<SubOrder[]>([]);
  const [expressPackages, setExpressPackages] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [trackingBySubOrder, setTrackingBySubOrder] = useState<Record<string, any[]>>({});
  const [jobBindingBySubOrder, setJobBindingBySubOrder] = useState<Record<string, any[]>>({});
  const [dpnBySubOrder, setDpnBySubOrder] = useState<Record<string, any[]>>({});
  const [deliveryTaskBySubOrder, setDeliveryTaskBySubOrder] = useState<Record<string, any[]>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [freightRateModalOpen, setFreightRateModalOpen] = useState(false);
  const [freightRates, setFreightRates] = useState<any[]>([]);
  const [freightRateLoading, setFreightRateLoading] = useState(false);

  // 加载订单详情数据（子订单和快递包裹）
  useEffect(() => {
    if (!order || !open) {
      setSubOrders([]);
      setExpressPackages([]);
      setFees([]);
      setTrackingBySubOrder({});
      setJobBindingBySubOrder({});
      setDpnBySubOrder({});
      setDeliveryTaskBySubOrder({});
      setFreightRateModalOpen(false);
      setFreightRates([]);
      setClientInfo(null);
      return;
    }
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        const res = await v2OmsApi.getOrderFull(order.id) as any;
        const mapped = mapV2OrderFull(res.data || res);
        setSubOrders(mapped.subOrders || []);
        setExpressPackages(mapped.expressPackages || order.expressPackages || []);
        const apiFees = mapped.fees || [];
        // 注入 mock 费用数据用于演示（如果 API 没返回费用）
        if (apiFees.length === 0) {
          const now = dayjs().format('YYYY-MM-DD HH:mm');
          apiFees.push(
            { id: 'F-S-20260408-0001', feeType: '海运运费', feeDirection: 'RECEIVABLE', currency: 'USD', unitPrice: 12, quantity: 44, exchangeRate: 1, amount: 528, amountUsd: 528, createdBy: '仓管A', createdAt: now, remark: '计费重44kg' },
            { id: 'F-S-20260408-0002', feeType: '报关费', feeDirection: 'RECEIVABLE', currency: 'USD', unitPrice: 50, quantity: 1, exchangeRate: 1, amount: 50, amountUsd: 50, createdBy: '仓管A', createdAt: now, remark: '' },
            { id: 'F-S-20260408-0003', feeType: '包装费', feeDirection: 'RECEIVABLE', currency: 'CNY', unitPrice: 30, quantity: 4, exchangeRate: 7.25, amount: 120, amountUsd: 16.55, createdBy: '仓管A', createdAt: now, remark: '4件木架加固' },
            { id: 'F-S-20260408-0004', feeType: '保险费', feeDirection: 'RECEIVABLE', currency: 'CNY', unitPrice: 80, quantity: 1, exchangeRate: 7.25, amount: 80, amountUsd: 11.03, createdBy: '仓管A', createdAt: now, remark: '' },
            { id: 'F-S-20260408-0005', feeType: '到门费', feeDirection: 'RECEIVABLE', currency: 'NGN', unitPrice: 15000, quantity: 1, exchangeRate: 1650, amount: 15000, amountUsd: 9.09, createdBy: '操作B', createdAt: now, remark: '拉各斯市区配送' },
          );
        }
        setFees(apiFees);
        setTrackingBySubOrder(mapped.trackingBySubOrder || {});
        setJobBindingBySubOrder(mapped.jobBindingBySubOrder || {});
        setDpnBySubOrder(mapped.dpnBySubOrder || {});
        setDeliveryTaskBySubOrder(mapped.deliveryTaskBySubOrder || {});
        // 获取客户企业资质信息
        if (order.customerId) {
          try {
            const clientRes = await clientApi.get(order.customerId) as any;
            setClientInfo(clientRes.data || null);
          } catch { setClientInfo(null); }
        }
      } catch (error: any) {
        // 回退到订单自身数据
        setSubOrders([]);
        setExpressPackages(order.expressPackages || []);
        setFees([]);
        setTrackingBySubOrder({});
        setJobBindingBySubOrder({});
        setDpnBySubOrder({});
        setDeliveryTaskBySubOrder({});
        console.error('加载订单详情失败:', error.message);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [order?.id, open]);

  if (!order) return null;

  const statusConfig = MASTER_ORDER_STATUS_CONFIG[order.status];

  // 处理订单更新
  const handleOrderUpdate = (orderId: string, updates: Partial<MasterOrder>) => {
    if (onOrderUpdate) {
      onOrderUpdate(orderId, updates);
    }
    setEditModalOpen(false);
  };

  // 提交退单申请
  const handleReturnSubmit = () => {
    returnForm.validateFields().then((values) => {
      if (onOrderUpdate) {
        onOrderUpdate(order.id, {
          status: 'RETURN_APPLIED',
          previousStatus: order.status,
          returnType: values.returnType,
          returnReason: values.returnReason,
          returnRefundAmount: values.returnRefundAmount,
          returnRefundMethod: values.returnRefundMethod,
          needReturn: values.needReturn,
          returnShippingNote: values.returnShippingNote,
          returnAppliedBy: '当前用户',
          returnAppliedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        });
      }
      message.success('退单申请已提交，等待审核');
      setReturnModalOpen(false);
      returnForm.resetFields();
    });
  };

  // 处理打印面单
  const handlePrint = () => {
    setPrintLabelOpen(true);
  };

  const receivableFees = (Array.isArray(fees) ? fees : []).filter((fee) => fee.feeDirection !== 'PAYABLE');

  const handleOpenFreightRates = async () => {
    const transportMode = order.transportType === 'AIR' ? 'AIR' : 'SEA_LCL';
    setFreightRateModalOpen(true);
    setFreightRateLoading(true);
    try {
      const res = await systemApi.listFreightRates({ transportMode, status: 'ACTIVE' }) as any;
      const rows = Array.isArray(res?.data) ? res.data : [];
      setFreightRates(rows);
      if (rows.length === 0) {
        message.info('当前业务线暂无可用运价规则');
      }
    } catch (error: any) {
      message.error(error.message || '加载运价规则失败');
    } finally {
      setFreightRateLoading(false);
    }
  };

  const escapeCsvField = (value: unknown) => {
    const text = String(value ?? '');
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const handleExportBill = () => {
    if (!receivableFees.length) {
      message.warning('当前订单暂无应收明细可导出');
      return;
    }
    const header = [
      '运单号',
      '客户',
      '运输方式',
      '服务类型',
      '费用项目',
      '单价USD',
      '数量',
      '小计USD',
      '录入账号',
      '录入日期',
      '支付方式',
      '支付状态',
    ];
    const rows = receivableFees.map((fee) => ([
      order.orderNo,
      order.customerName || '-',
      order.transportType === 'AIR' ? '空运' : '海运',
      order.serviceType || '-',
      fee.feeType || '-',
      Number(fee.unitPrice || 0).toFixed(2),
      Number(fee.quantity || 0).toFixed(2),
      Number(fee.amountUsd || 0).toFixed(2),
      fee.createdBy || '-',
      fee.createdAt ? dayjs(fee.createdAt).format('YYYY-MM-DD HH:mm') : '-',
      formatPaymentMethod(order.paymentMethod),
      formatPaymentStatus(order.paymentStatus),
    ]));
    const csvText = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
      .join('\n');
    const blob = new Blob([`\ufeff${csvText}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${order.orderNo}-账单-${dayjs().format('YYYYMMDDHHmmss')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('账单已导出');
  };

  return (
    <>
      <Drawer
        title="订单详情"
        width="90%"
        open={open}
        onClose={onClose}
        closeIcon={<CloseOutlined />}
        styles={{ body: { padding: '16px 24px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0' }}>
            <Space>
              <Button size="small" onClick={handleOpenFreightRates}>运价列表</Button>
              <Button size="small" onClick={handleExportBill}>导出账单</Button>
              <RegisterPaymentButton order={order} />
              <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>打印面单</Button>
            </Space>
          </div>
        }
      >
        {/* 退单状态提示 */}
        {order.status === 'RETURN_APPLIED' && (
          <Alert
            message="该订单已申请退单，等待审核"
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">退单类型：{order.returnType === 'CUSTOMER_CANCEL' ? '客户主动取消' : order.returnType === 'GOODS_ISSUE' ? '货物问题' : order.returnType === 'ADDRESS_ERROR' ? '地址错误' : '其他'}</Text>
                <Text type="secondary">申请人：{order.returnAppliedBy} | 申请时间：{order.returnAppliedAt}</Text>
              </Space>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        {order.status === 'CANCELLED' && (
          <Alert
            message="该订单已取消"
            description={
              <Space direction="vertical" size={4}>
                {order.returnApprover && <Text type="secondary">审核人：{order.returnApprover} | 审核时间：{order.returnApprovedAt}</Text>}
                {order.returnReason && <Text type="secondary">退单原因：{order.returnReason}</Text>}
                {(order.returnRefundAmount ?? 0) > 0 && <Text type="secondary">退费金额：¥{order.returnRefundAmount?.toFixed(2)} | 退费方式：{order.returnRefundMethod === 'ORIGINAL' ? '原路退回' : order.returnRefundMethod === 'BANK_TRANSFER' ? '银行转账' : '线下退款'}</Text>}
                {order.needReturn && <Text type="secondary">需要退运：是 {order.returnShippingNote ? `(${order.returnShippingNote})` : ''}</Text>}
              </Space>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 左侧导航 + 右侧内容布局 */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* 左侧导航菜单 */}
          <div style={{ width: 180, flexShrink: 0, position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
            <Anchor
              affix={false}
              targetOffset={80}
              getContainer={() => containerRef.current || window}
              items={[
                { key: 'basic-info', href: '#basic-info', title: '基本信息' },
                { key: 'user-company-info', href: '#user-company-info', title: '用户/公司信息' },
                { key: 'invoice-card', href: '#invoice-card', title: '发票信息' },
                { key: 'logistics-status', href: '#logistics-status', title: '物流状态栏' },
                { key: 'route-contact', href: '#route-contact', title: '路线与地址' },
                { key: 'cargo-info', href: '#cargo-info', title: '订单初始信息' },
                { key: 'sub-orders', href: '#sub-orders', title: '订单实际信息' },
                { key: 'receivable-fees', href: '#receivable-fees', title: '应收明细' },
                { key: 'payment-records', href: '#payment-records', title: '已付款记录' },
              ]}
            />
          </div>

          {/* 右侧内容区域 */}
          <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }}>
            <section id="basic-info" style={sectionStyle}>
              <SectionTitle title="基本信息" />
              <div style={{ opacity: detailLoading ? 0.68 : 1, transition: 'opacity 0.2s ease' }}>
                <Row gutter={[16, 12]}>
                  <Col span={16}>
                    <Space wrap>
                      <Text strong style={{ fontSize: 18 }}>{order.orderNo}</Text>
                      <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
                      <Tag color={order.transportType === 'SEA' ? 'blue' : 'orange'}>
                        {order.transportType === 'SEA' ? '海运' : '空运'}
                      </Tag>
                      <Tag>{order.serviceType || '-'}</Tag>
                      {(order as any).warehouseEntryNo && (
                        <Tag color="purple" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13 }}>
                          入仓号：{(order as any).warehouseEntryNo}
                        </Tag>
                      )}
                    </Space>
                  </Col>
                  <Col span={8} style={{ textAlign: 'right' }}>
                    <Text type="secondary">业务员：{order.salesPerson || '-'}</Text>
                  </Col>
                  <Col span={24}>
                    <Descriptions size="small" column={4}>
                      <Descriptions.Item label="下单日期">{formatDateTime(order.createdAt)}</Descriptions.Item>
                      <Descriptions.Item label="入库日期">{formatDateTime(order.inboundDate || expressPackages.find((p: any) => p.inboundAt)?.inboundAt)}</Descriptions.Item>
                      <Descriptions.Item label="支付方式">{formatPaymentMethod(order.paymentMethod)}</Descriptions.Item>
                      <Descriptions.Item label="支付状态">{formatPaymentStatus(order.paymentStatus)}</Descriptions.Item>
                      <Descriptions.Item label="支付途径">{formatPaymentChannel(order.paymentChannel)}</Descriptions.Item>
                      <Descriptions.Item label="支付日期">{formatDateTime(order.paymentTime)}</Descriptions.Item>
                      <Descriptions.Item label="更新日期">{formatDateTime(order.updatedAt)}</Descriptions.Item>
                      <Descriptions.Item label="路线">{order.routeCode || '-'}</Descriptions.Item>
                      <Descriptions.Item label="交付方式">
                        {(order as any).deliveryMethod === 'DELIVERY' ? <Tag color="blue">配送（送货上门）</Tag>
                          : (order as any).deliveryMethod === 'PICKUP' ? <Tag color="green">自提（客户到站取货）</Tag>
                          : <Tag>未选择</Tag>}
                      </Descriptions.Item>
                      <Descriptions.Item label="出口方式">{(order as any).exportMode || '-'}</Descriptions.Item>
                    </Descriptions>
                  </Col>
                </Row>
              </div>
            </section>

            <section id="user-company-info" style={sectionStyle}>
              <SectionTitle title="用户/公司信息" />
              <div style={{ opacity: detailLoading ? 0.68 : 1, transition: 'opacity 0.2s ease' }}>
                {(() => {
                  const ei = clientInfo?.enterpriseInfo;
                  const contactPhone = clientInfo?.contact?.phone || order.senderPhone || '-';
                  const contactEmail = clientInfo?.contact?.email || order.consigneeEmail || '-';
                  const contactName = clientInfo?.contact?.name || '-';
                  if (!ei?.entityType) {
                    return (
                      <Descriptions size="small" column={2} bordered>
                        <Descriptions.Item label="客户名称">{order.customerName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="客户类型"><Tag>未设置企业资质</Tag></Descriptions.Item>
                        <Descriptions.Item label="联系人">{contactName}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{contactPhone}</Descriptions.Item>
                        <Descriptions.Item label="邮箱" span={2}>{contactEmail}</Descriptions.Item>
                      </Descriptions>
                    );
                  }
                  if (ei.entityType === 'COMPANY_CN') {
                    return (
                      <Descriptions size="small" column={2} bordered>
                        <Descriptions.Item label="客户类型"><Tag color="blue">中国企业</Tag></Descriptions.Item>
                        <Descriptions.Item label="公司全称">{ei.companyName || order.customerName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="统一社会信用代码" span={2}>{ei.unifiedCreditCode || '-'}</Descriptions.Item>
                        <Descriptions.Item label="联系人">{contactName}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{ei.contactPhone || contactPhone}</Descriptions.Item>
                        <Descriptions.Item label="邮箱" span={2}>{ei.contactEmail || contactEmail}</Descriptions.Item>
                        <Descriptions.Item label="开户银行">{ei.bankName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="银行账号">{ei.bankAccount || '-'}</Descriptions.Item>
                      </Descriptions>
                    );
                  }
                  if (ei.entityType === 'COMPANY_OVERSEAS') {
                    return (
                      <Descriptions size="small" column={2} bordered>
                        <Descriptions.Item label="客户类型"><Tag color="green">海外企业</Tag></Descriptions.Item>
                        <Descriptions.Item label="公司名称">{ei.overseasCompanyName || order.customerName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="注册国家">{ei.overseasCountry || '-'}</Descriptions.Item>
                        <Descriptions.Item label="税号">{ei.overseasTaxNumber || '-'}</Descriptions.Item>
                        <Descriptions.Item label="联系人">{ei.overseasDirector || contactName}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{contactPhone}</Descriptions.Item>
                        <Descriptions.Item label="邮箱" span={2}>{contactEmail}</Descriptions.Item>
                        <Descriptions.Item label="开户银行">{ei.bankName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="银行账号">{ei.bankAccount || '-'}</Descriptions.Item>
                      </Descriptions>
                    );
                  }
                  // INDIVIDUAL
                  return (
                    <Descriptions size="small" column={2} bordered>
                      <Descriptions.Item label="客户类型"><Tag color="orange">个人</Tag></Descriptions.Item>
                      <Descriptions.Item label="姓名">{ei.realName || order.customerName || '-'}</Descriptions.Item>
                      <Descriptions.Item label="证件类型">{ei.idType === 'ID_CARD' ? '身份证' : ei.idType === 'PASSPORT' ? '护照' : '-'}</Descriptions.Item>
                      <Descriptions.Item label="证件号码">{ei.idNumber || '-'}</Descriptions.Item>
                      <Descriptions.Item label="联系电话">{ei.contactPhone || contactPhone}</Descriptions.Item>
                      <Descriptions.Item label="邮箱">{ei.contactEmail || contactEmail}</Descriptions.Item>
                      <Descriptions.Item label="开户银行" span={2}>{ei.bankName || '-'}</Descriptions.Item>
                    </Descriptions>
                  );
                })()}
              </div>
            </section>

            <section id="invoice-card" style={sectionStyle}>
              <SectionTitle title="发票信息" />
              <div style={{ opacity: detailLoading ? 0.68 : 1, transition: 'opacity 0.2s ease' }}>
                {(() => {
                  const ei = clientInfo?.enterpriseInfo;
                  if (ei?.entityType === 'COMPANY_CN' && (ei.taxpayerId || ei.unifiedCreditCode)) {
                    return (
                      <Descriptions size="small" column={2} bordered>
                        <Descriptions.Item label="开票抬头">{ei.companyName || order.customerName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="纳税人识别号">{ei.taxpayerId || ei.unifiedCreditCode || '-'}</Descriptions.Item>
                        <Descriptions.Item label="开票地址">{ei.invoiceAddress || ei.registeredAddress || '-'}</Descriptions.Item>
                        <Descriptions.Item label="开票电话">{ei.invoicePhone || ei.contactPhone || '-'}</Descriptions.Item>
                        <Descriptions.Item label="开户银行">{ei.bankName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="银行账号">{ei.bankAccount || '-'}</Descriptions.Item>
                      </Descriptions>
                    );
                  }
                  return <InvoiceInfoCard invoiceInfo={order.invoiceInfo} />;
                })()}
              </div>
            </section>

            <section id="logistics-status" style={sectionStyle}>
              <SectionTitle title="物流状态栏" />
              <OrderStatusBar
                order={order}
                subOrders={subOrders}
                expressPackages={expressPackages}
                trackingBySubOrder={trackingBySubOrder}
                jobBindingBySubOrder={jobBindingBySubOrder}
                dpnBySubOrder={dpnBySubOrder}
                deliveryTaskBySubOrder={deliveryTaskBySubOrder}
              />
            </section>

            <section id="route-contact" style={sectionStyle}>
              <SectionTitle title="路线与地址" />
              <div style={{
                background: '#1677ff',
                color: '#fff',
                padding: '8px 16px',
                marginBottom: 16,
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                {order.routeCode || `CAN.CHN→${order.destCity}.${order.destCountry}`}
              </div>

              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={12}>
                  <div style={personPanelStyle}>
                    <Text strong style={{ display: 'inline-block', marginBottom: 8 }}>发货人</Text>
                    <Descriptions column={1} size="small" labelStyle={{ width: 90 }}>
                      <Descriptions.Item label="名字">{order.sender || order.createdBy || '-'}</Descriptions.Item>
                      <Descriptions.Item label="电话">{order.senderPhone || '-'}</Descriptions.Item>
                      <Descriptions.Item label="详细地址">{order.senderAddress || '-'}</Descriptions.Item>
                      <Descriptions.Item label="区">{order.senderDistrict || '-'}</Descriptions.Item>
                      <Descriptions.Item label="城市">{order.senderCity || '-'}</Descriptions.Item>
                      <Descriptions.Item label="国家">{order.senderCountry || '-'}</Descriptions.Item>
                    </Descriptions>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={personPanelStyle}>
                    <Text strong style={{ display: 'inline-block', marginBottom: 8 }}>收货人</Text>
                    <Descriptions column={1} size="small" labelStyle={{ width: 90 }}>
                      <Descriptions.Item label="名字">{order.consignee || '-'}</Descriptions.Item>
                      <Descriptions.Item label="电话">{order.consigneePhone || '-'}</Descriptions.Item>
                      <Descriptions.Item label="详细地址">{order.destAddress || '-'}</Descriptions.Item>
                      <Descriptions.Item label="州/省">{(order as any).consigneeState || order.district || '-'}</Descriptions.Item>
                      <Descriptions.Item label="城市">{order.destCity || '-'}</Descriptions.Item>
                      <Descriptions.Item label="国家">{order.destCountry || '-'}</Descriptions.Item>
                    </Descriptions>
                  </div>
                </Col>
              </Row>
            </section>

            <section id="cargo-info" style={sectionStyle}>
              <SectionTitle title="订单初始信息" />
              <ItemsTable order={order} expressPackages={expressPackages} />
              {(order as any).remark && (
                <div style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 4, marginTop: 12 }}>
                  <Text type="secondary">备注：</Text>
                  <Text>{(order as any).remark}</Text>
                </div>
              )}
            </section>

            <section id="sub-orders" style={sectionStyle}>
              <SectionTitle title="订单实际信息" />
              <SubOrdersTable order={order} subOrders={subOrders} expressPackages={expressPackages} />
            </section>

            <section id="receivable-fees" style={sectionStyle}>
              <SectionTitle title="应收明细" />
              <FeesTable
                order={order}
                subOrders={subOrders}
                fees={fees}
                onOpenFreightRates={handleOpenFreightRates}
                onExportBill={handleExportBill}
              />
            </section>

            <section id="payment-records" style={sectionStyle}>
              <SectionTitle title="已付款记录" />
              <PaymentReceiptList orderNo={order.orderNo} />
            </section>

            <section style={{ ...sectionStyle, background: '#fafafa', borderRadius: 6, padding: '12px 16px' }}>
              <ReceivableSummaryCard order={order} fees={fees} />
            </section>


          </div>
          {/* 右侧内容区域结束 */}
        </div>
        {/* 左侧导航 + 右侧内容布局结束 */}

      {/* 编辑订单模态框 */}
      <MasterOrderEditModal
        open={editModalOpen}
        order={order}
        onClose={() => setEditModalOpen(false)}
        onSave={handleOrderUpdate}
      />
      </Drawer>

      <Modal
        title="运价列表"
        open={freightRateModalOpen}
        onCancel={() => setFreightRateModalOpen(false)}
        footer={
          <Button onClick={() => setFreightRateModalOpen(false)}>
            关闭
          </Button>
        }
        width={920}
      >
        <Table
          rowKey="id"
          size="small"
          loading={freightRateLoading}
          pagination={false}
          dataSource={freightRates}
          locale={{ emptyText: '暂无运价规则' }}
          columns={[
            { title: '规则名称', dataIndex: 'name', key: 'name', width: 180 },
            {
              title: '运输方式',
              dataIndex: 'transportMode',
              key: 'transportMode',
              width: 110,
              render: (value: string) => (value === 'AIR' ? '空运' : '海运拼柜'),
            },
            { title: '币种', dataIndex: 'currency', key: 'currency', width: 90, render: (value: string) => value || '-' },
            {
              title: '单价',
              key: 'unitPrice',
              width: 150,
              render: (_: unknown, record: any) => `${record.currency || 'USD'} ${Number(record.unitPrice || 0).toFixed(2)}${record.unitType || ''}`,
            },
            {
              title: '最低收费',
              key: 'minCharge',
              width: 130,
              render: (_: unknown, record: any) => record.minCharge ? `${record.currency || 'USD'} ${Number(record.minCharge).toFixed(2)}` : '-',
            },
            { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, render: (value: string) => value || '-' },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              key: 'updatedAt',
              width: 170,
              render: (value: string) => value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-',
            },
          ]}
        />
      </Modal>

      {/* 费用录入 Modal */}
      <Modal
        title="录入订单费用"
        open={feeModalOpen}
        onCancel={() => {
          setFeeModalOpen(false);
          feeForm.resetFields();
        }}
        onOk={() => {
          feeForm.validateFields().then(() => {
            message.success('费用添加成功');
            setFeeModalOpen(false);
            feeForm.resetFields();
          });
        }}
        width={700}
      >
        <Form form={feeForm} layout="vertical">
          <Form.Item name="feeLevel" label="费用归属" rules={[{ required: true, message: '请选择费用归属' }]}>
            <Radio.Group>
              <Radio value="master">主订单费用</Radio>
              <Radio value="sub">子订单费用</Radio>
              <Radio value="container">集装箱费用（均摊）</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.feeLevel !== currentValues.feeLevel}
          >
            {({ getFieldValue }) => {
              const feeLevel = getFieldValue('feeLevel');
              if (feeLevel === 'sub') {
                return (
                  <Form.Item name="subOrderNo" label="选择子订单" rules={[{ required: true, message: '请选择子订单' }]}>
                    <Select placeholder="请选择子订单">
                      {subOrders.map(sub => (
                        <Select.Option key={sub.id} value={sub.subOrderNo}>
                          {sub.subOrderNo} - {sub.batchName}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }
              if (feeLevel === 'container') {
                return (
                  <Form.Item name="shippingUnitNo" label="选择集装箱" rules={[{ required: true, message: '请选择集装箱' }]}>
                    <Select placeholder="请选择集装箱">
                      {Array.from(new Set(subOrders.map(s => s.shippingUnitNo))).map(unitNo => (
                        <Select.Option key={unitNo} value={unitNo}>
                          {unitNo}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="feeItem" label="费用项目" rules={[{ required: true, message: '请输入费用项目' }]}>
            <Input placeholder="例如：仓储费、打包费、报关费等" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="unitPrice" label="单价(USD)" rules={[{ required: true, message: '请输入单价' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="1.00" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注说明">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 打印面单组件 */}
      <ShippingLabelPrint
        visible={printLabelOpen}
        order={order}
        onClose={() => setPrintLabelOpen(false)}
      />

      {/* 补单处理 Modal */}
      <Modal
        title="补单处理"
        open={supplementModalOpen}
        onCancel={() => {
          setSupplementModalOpen(false);
          supplementForm.resetFields();
        }}
        onOk={() => {
          supplementForm.validateFields().then(() => {
            message.success('补单申请已提交');
            setSupplementModalOpen(false);
            supplementForm.resetFields();
          });
        }}
        width={600}
      >
        <Form form={supplementForm} layout="vertical">
          <Form.Item name="supplementReason" label="补单原因" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="LOST">货物丢失</Select.Option>
              <Select.Option value="DAMAGED">货物损坏</Select.Option>
              <Select.Option value="WRONG_DELIVERY">错发漏发</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="详细说明" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 费用追回 Modal */}
      <Modal
        title="费用追回"
        open={recoverFeeModalOpen}
        onCancel={() => {
          setRecoverFeeModalOpen(false);
          recoverFeeForm.resetFields();
        }}
        onOk={() => {
          recoverFeeForm.validateFields().then(() => {
            message.success('费用追回申请已提交');
            setRecoverFeeModalOpen(false);
            recoverFeeForm.resetFields();
          });
        }}
        width={600}
      >
        <Form form={recoverFeeForm} layout="vertical">
          <Form.Item name="recoverAmount" label="追回金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="recoverReason" label="追回原因" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="OVERCHARGE">多收费用</Select.Option>
              <Select.Option value="DUPLICATE_PAYMENT">重复支付</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注说明" rules={[{ required: true }]}>
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 退款处理 Modal */}
      <Modal
        title="退款处理"
        open={refundModalOpen}
        onCancel={() => {
          setRefundModalOpen(false);
          refundForm.resetFields();
        }}
        onOk={() => {
          refundForm.validateFields().then(() => {
            message.success('退款申请已提交');
            setRefundModalOpen(false);
            refundForm.resetFields();
          });
        }}
        width={600}
      >
        <Form form={refundForm} layout="vertical">
          <Form.Item name="refundAmount" label="退款金额" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="refundReason" label="退款原因" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="CUSTOMER_REQUEST">客户要求退款</Select.Option>
              <Select.Option value="ORDER_CANCEL">订单取消</Select.Option>
              <Select.Option value="SERVICE_ISSUE">服务问题</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注说明">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分享订单 Modal */}
      <Modal
        title="分享订单"
        open={shareModalOpen}
        onCancel={() => setShareModalOpen(false)}
        onOk={() => {
          const shareUrl = `${window.location.origin}/order/${order.id}`;
          navigator.clipboard.writeText(shareUrl).then(() => {
            message.success('订单链接已复制到剪贴板');
            setShareModalOpen(false);
          });
        }}
        okText="复制链接"
        width={500}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <Text strong>运单号: {order.orderNo}</Text>
          </div>
          <div>
            <Text type="secondary">分享链接:</Text>
            <Input.TextArea
              value={`${window.location.origin}/order/${order.id}`}
              rows={2}
              readOnly
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>

      {/* 申请退单 Modal */}
      <Modal
        title="申请退单"
        open={returnModalOpen}
        onCancel={() => {
          setReturnModalOpen(false);
          returnForm.resetFields();
        }}
        onOk={handleReturnSubmit}
        okText="提交申请"
        okButtonProps={{ danger: true }}
        width={650}
        destroyOnClose
      >
        <Form form={returnForm} layout="vertical">
          <Divider>退单信息</Divider>
          <Form.Item name="returnType" label="退单类型" rules={[{ required: true, message: '请选择退单类型' }]}>
            <Select placeholder="请选择退单类型">
              <Select.Option value="CUSTOMER_CANCEL">客户主动取消</Select.Option>
              <Select.Option value="GOODS_ISSUE">货物问题</Select.Option>
              <Select.Option value="ADDRESS_ERROR">地址错误</Select.Option>
              <Select.Option value="OTHER">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="returnReason" label="退单原因" rules={[{ required: true, message: '请填写退单原因' }]}>
            <TextArea rows={3} maxLength={500} showCount placeholder="请详细说明退单原因..." />
          </Form.Item>

          <Divider>退费信息</Divider>
          <Alert
            message={`该订单已产生费用 ¥${(order.totalFreight || 0).toFixed(2)}，已收款 ¥${(order.paidAmount || 0).toFixed(2)}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="returnRefundAmount" label="退费金额" rules={[{ required: true, message: '请输入退费金额' }]} initialValue={order.paidAmount || 0}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.returnRefundAmount !== cur.returnRefundAmount}
              >
                {({ getFieldValue }) => {
                  const amount = getFieldValue('returnRefundAmount');
                  return amount > 0 ? (
                    <Form.Item name="returnRefundMethod" label="退费方式" rules={[{ required: true, message: '请选择退费方式' }]}>
                      <Select placeholder="请选择退费方式">
                        <Select.Option value="ORIGINAL">原路退回</Select.Option>
                        <Select.Option value="BANK_TRANSFER">银行转账</Select.Option>
                        <Select.Option value="OFFLINE">线下退款</Select.Option>
                      </Select>
                    </Form.Item>
                  ) : null;
                }}
              </Form.Item>
            </Col>
          </Row>

          <Divider>退运信息</Divider>
          <Form.Item name="needReturn" label="是否需要退运">
            <Radio.Group>
              <Radio value={true}>是</Radio>
              <Radio value={false}>否</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.needReturn !== cur.needReturn}
          >
            {({ getFieldValue }) =>
              getFieldValue('needReturn') ? (
                <Form.Item name="returnShippingNote" label="退运说明">
                  <TextArea rows={2} placeholder="请输入退运说明（选填）" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 催款通知弹窗 - 完善版 */}
      <Modal
        title="发送催款通知"
        open={reminderModalOpen}
        onCancel={() => {
          setReminderModalOpen(false);
          reminderForm.resetFields();
        }}
        onOk={() => {
          reminderForm.validateFields().then(() => {
            message.success('催款通知已发送');
            setReminderModalOpen(false);
            reminderForm.resetFields();
          });
        }}
        width={600}
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#fff7e6', borderRadius: 4, border: '1px solid #ffd591' }}>
          <Space direction="vertical" size={4}>
            <Text strong>运单号: {order.orderNo}</Text>
            <Text type="secondary">客户: {order.customerName}</Text>
            <Text type="danger">应收金额: ¥{order.totalFreight?.toFixed(2)}</Text>
          </Space>
        </div>
        <Form form={reminderForm} layout="vertical">
          <Form.Item name="method" label="通知方式" rules={[{ required: true }]} initialValue="SMS">
            <Select>
              <Select.Option value="SMS">短信通知</Select.Option>
              <Select.Option value="EMAIL">邮件通知</Select.Option>
              <Select.Option value="WECHAT">微信通知</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="template" label="通知模板" rules={[{ required: true }]}>
            <Select placeholder="选择催款模板">
              <Select.Option value="GENTLE">温馨提醒</Select.Option>
              <Select.Option value="NORMAL">正常催款</Select.Option>
              <Select.Option value="URGENT">紧急催款</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="content" label="通知内容" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="请输入催款通知内容..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// 旧子订单折叠与轨迹组件已移除，统一使用后端事件驱动状态栏。

function OrderStatusBar({
  order,
  subOrders,
  expressPackages,
  trackingBySubOrder,
  jobBindingBySubOrder,
  dpnBySubOrder,
  deliveryTaskBySubOrder,
}: {
  order: MasterOrder;
  subOrders: SubOrder[];
  expressPackages: any[];
  trackingBySubOrder: Record<string, any[]>;
  jobBindingBySubOrder: Record<string, any[]>;
  dpnBySubOrder: Record<string, any[]>;
  deliveryTaskBySubOrder: Record<string, any[]>;
}) {
  const [expandedRowKeys, setExpandedRowKeys] = useState<Array<string | number>>([]);
  const defaultSubOrderNo = subOrders.length === 1 ? subOrders[0].subOrderNo : undefined;

  const packageMap = (expressPackages || []).reduce((acc, pkg) => {
    const key = pkg.subOrderNo || defaultSubOrderNo || '__NONE__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(pkg);
    return acc;
  }, {} as Record<string, any[]>);

  const rows = subOrders.map((sub) => {
    const subId = String(sub.id);
    const bindings = jobBindingBySubOrder[subId] || [];
    const binding = bindings[0] || {};
    const jobNo = sub.jobNo || binding.job_no || '-';
    const shippingUnitNo = sub.shippingUnitNo || binding.unit_no || '-';
    const related = packageMap[sub.subOrderNo] || [];
    const routePart = sub.route || order.routeCode || '-';
    const carrierPart = sub.transportType === 'SEA' ? '海运' : '空运';
    const billPart = sub.trackingNumber || binding.bill_no || binding.flight_no || binding.vessel_voyage || '-';
    const containerPart = shippingUnitNo;
    const trackingSites = trackingBySubOrder[subId] || [];
    const latestNodeEventTime = trackingSites
      .flatMap((site) => Array.isArray(site?.nodes) ? site.nodes : [])
      .map((node) => String(node?.eventTime || ''))
      .filter(Boolean)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    return {
      id: sub.id,
      subOrderNo: sub.subOrderNo,
      jobNo,
      thirdPartyText: related.length
        ? related.map((p: any) => `${p.courier || '-'} ${p.trackingNo || '-'}`).join(' / ')
        : '-',
      routeText: routePart,
      carrierText: carrierPart,
      billText: billPart,
      containerText: containerPart,
      status: sub.status,
      updatedAt: latestNodeEventTime || sub.updatedAt,
      subOrder: sub,
      trackingSites,
      dpns: dpnBySubOrder[subId] || [],
      deliveryTasks: deliveryTaskBySubOrder[subId] || [],
    };
  });

  const columns: ColumnsType<any> = [
    { title: 'JOB号', dataIndex: 'jobNo', key: 'jobNo', width: 140 },
    { title: '子运单号', dataIndex: 'subOrderNo', key: 'subOrderNo', width: 180 },
    { title: '第三方运单号', dataIndex: 'thirdPartyText', key: 'thirdPartyText', width: 260, ellipsis: true },
    { title: '路线', dataIndex: 'routeText', key: 'routeText', width: 120, ellipsis: true },
    { title: '航司/船司', dataIndex: 'carrierText', key: 'carrierText', width: 120, ellipsis: true },
    { title: '提单号', dataIndex: 'billText', key: 'billText', width: 180, ellipsis: true },
    { title: '集装箱号', dataIndex: 'containerText', key: 'containerText', width: 150, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: SubOrder['status']) => {
        const cfg = SUB_ORDER_STATUS_CONFIG[status] || { label: status, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (v: string) => (v ? dayjs(v).format('YYYY/MM/DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => {
        const active = expandedRowKeys.includes(record.id);
        return (
          <Button type="link" size="small" onClick={() => {
            setExpandedRowKeys((prev) => (active ? prev.filter((k) => k !== record.id) : [...prev, record.id]));
          }}>
            {active ? '收起' : '展开'}
          </Button>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={rows}
      rowKey="id"
      pagination={false}
      size="small"
      scroll={{ x: 1650 }}
      expandable={{
        expandedRowKeys,
        onExpandedRowsChange: (keys) => setExpandedRowKeys(Array.from(keys) as Array<string | number>),
        expandedRowRender: (record) => (
          <SubOrderSiteTimeline
            subOrder={record.subOrder}
            summaryText={[record.jobNo, record.subOrder?.shippingUnitNo, record.subOrderNo]
              .filter((v) => v && v !== '-')
              .join('  ')}
            sites={record.trackingSites || []}
            dpns={record.dpns || []}
            deliveryTasks={record.deliveryTasks || []}
          />
        ),
        rowExpandable: (record) => !!record.subOrder,
      }}
    />
  );
}

function SubOrderSiteTimeline({
  subOrder,
  summaryText,
  sites,
  dpns,
  deliveryTasks,
}: {
  subOrder: SubOrder;
  summaryText: string;
  sites: any[];
  dpns: any[];
  deliveryTasks: any[];
}) {
  const records = subOrder.logisticsRecords || [];
  const fallbackSites = records.length > 0 ? [{
    siteCode: 'EVENT_LOG',
    siteName: '物流事件',
    nodes: records.map((record) => ({
      nodeCode: record.step,
      nodeName: record.remark || record.step,
      statusCode: record.status,
      eventTime: record.timestamp,
    })),
  }] : [];
  const displaySites = (Array.isArray(sites) && sites.length > 0 ? sites : fallbackSites)
    .map((site) => ({
      ...site,
      nodes: (Array.isArray(site?.nodes) ? site.nodes : []).filter((node: any) => !!node?.eventTime || !!node?.nodeName),
    }))
    .filter((site) => site.nodes.length > 0);

  const colorByStatus = (statusCode?: string): string => {
    const code = String(statusCode || '').toUpperCase();
    if (code.includes('EXCEPTION') || code.includes('FAILED') || code.includes('CANCEL')) return 'error';
    if (code.includes('DELIVER') || code.includes('SIGNED') || code.includes('COMPLETED') || code.includes('ARRIVED')) return 'success';
    if (code.includes('TRANSIT') || code.includes('DEPART') || code.includes('ASSIGNED') || code.includes('DELIVERING')) return 'processing';
    if (code.includes('PENDING')) return 'warning';
    return 'default';
  };

  return (
    <div style={{ padding: '4px 0 2px' }}>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Text strong>{summaryText || subOrder.subOrderNo}</Text>

        {displaySites.length === 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>暂无物流进度节点</Text>
        )}

        {displaySites.map((site) => (
          <div key={`${site.siteCode || site.siteName}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <Text style={{ minWidth: 180, marginTop: 2 }} strong>{site.siteName || '未命名站点'}</Text>
            <Space size={[6, 4]} wrap>
              {site.nodes.map((node: any, idx: number) => (
                <Tag
                  key={`${site.siteCode || site.siteName}-${node.nodeCode || node.nodeName || idx}`}
                  color={colorByStatus(node.statusCode)}
                  style={{ marginInlineEnd: 0 }}
                >
                  {`${node.nodeName || node.nodeCode || '节点'} ${node.eventTime ? dayjs(node.eventTime).format('MM/DD HH:mm') : ''}`.trim()}
                </Tag>
              ))}
            </Space>
          </div>
        ))}

        {(dpns.length > 0 || deliveryTasks.length > 0) && (
          <div style={{ marginTop: 2 }}>
            <Space size={[6, 4]} wrap>
              {dpns.map((dpn) => (
                <Tag key={dpn.id} color="purple">
                  {`DPN ${dpn.dpn_no || dpn.dpnNo || dpn.id} ${dpn.dpn_status || '-'}`}
                </Tag>
              ))}
              {deliveryTasks.map((task) => (
                <Tag key={task.id} color="cyan">
                  {`配送 ${task.task_no || task.taskNo || task.id} ${task.task_status || '-'}`}
                </Tag>
              ))}
            </Space>
          </div>
        )}
      </Space>
    </div>
  );
}

// 订单初始信息表格组件 - 显示客户寄送的原始快递包裹
function ItemsTable({ order, expressPackages: pkgsFromState }: { order: MasterOrder; expressPackages: any[] }) {
  const expressPackages = pkgsFromState.length > 0 ? pkgsFromState : (order.expressPackages || []);
  const statusMap: Record<string, { label: string; color: string }> = {
    PENDING_SIGN: { label: '未签收', color: 'default' },
    SIGNED: { label: '已签收', color: 'processing' },
    INBOUND: { label: '已入库', color: 'success' },
    DELETED: { label: '已删除', color: 'default' },
  };

  const columns: ColumnsType<any> = [
    {
      title: '第三方运单号',
      key: 'tracking',
      width: 210,
      render: (_, record) => `${record.courier || '-'} ${record.trackingNo || '-'}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = statusMap[status] || { label: status || '-', color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '更新日期',
      key: 'updatedAt',
      width: 170,
      render: (_, record) => formatDateTime(record.inboundAt || record.receivedAt),
    },
    { title: '品名', dataIndex: 'itemName', key: 'itemName', width: 140 },
    { title: '类别', dataIndex: 'category', key: 'category', width: 120, render: (v: string) => v || '-' },
    { title: '说明', dataIndex: 'description', key: 'description', width: 100, render: (v: string) => v || '-' },
    {
      title: '重量Kg',
      dataIndex: 'weight',
      key: 'weight',
      width: 90,
      align: 'right',
      render: (v: number, record) => record.status === 'DELETED' ? '已删除' : Number(v || 0).toFixed(2),
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 80,
      align: 'right',
      render: (v: number, record) => record.status === 'DELETED' ? '已删除' : Number(v || 0),
    },
    {
      title: '货值USD',
      dataIndex: 'declaredValue',
      key: 'declaredValue',
      width: 100,
      align: 'right',
      render: (v: number, record) => record.status === 'DELETED' ? '已删除' : Number(v || 0).toFixed(2),
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 180, render: (v: string) => v || '-' },
  ];

  const activeRows = expressPackages.filter((pkg: any) => pkg.status !== 'DELETED');
  const totalWeight = activeRows.reduce((sum: number, pkg: any) => sum + Number(pkg.weight || 0), 0);
  const totalPieces = activeRows.reduce((sum: number, pkg: any) => sum + Number(pkg.pieces || 0), 0);
  const totalValue = activeRows.reduce((sum: number, pkg: any) => sum + Number(pkg.declaredValue || 0), 0);

  return (
    <Table
      columns={columns}
      dataSource={expressPackages}
      rowKey="id"
      pagination={false}
      size="small"
      scroll={{ x: 1350 }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={6}>
              <Text strong>合计</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="right">
              <Text strong>{totalWeight.toFixed(2)}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right">
              <Text strong>{totalPieces}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="right">
              <Text strong>{totalValue.toFixed(2)}</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={9} />
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
}

// 订单实际信息表格组件 - 显示快递包裹与子订单的关联
function SubOrdersTable({ order, subOrders, expressPackages: pkgsFromState }: { order: MasterOrder; subOrders: SubOrder[]; expressPackages: any[] }) {
  const expressPackages = pkgsFromState.length > 0 ? pkgsFromState : (order.expressPackages || []);
  const subOrderByNo = new Map(subOrders.map((sub) => [sub.subOrderNo, sub]));

  let tableData = expressPackages.map((pkg: any, index: number) => {
    const sub = subOrderByNo.get(pkg.subOrderNo);
    const length = Number(pkg.length || 0);
    const width = Number(pkg.width || 0);
    const height = Number(pkg.height || 0);
    const volume = length && width && height ? (length * width * height) / 1000000 : 0;
    const volumeWeight = volume > 0 ? volume * 167 : 0;
    return {
      id: `${pkg.id || `ACT-${index + 1}`}`,
      thirdParty: `${pkg.courier || '-'} ${pkg.trackingNo || '-'}`,
      orderNo: pkg.subOrderNo || sub?.subOrderNo || '-',
      containerNo: sub?.shippingUnitNo || pkg.shippingUnitNo || '-',
      status: sub?.status || 'PACKED',
      itemName: pkg.itemName || '-',
      description: pkg.description || '-',
      dimensions: length && width && height ? `${length}*${width}*${height}` : '-',
      pieces: Number(pkg.pieces || 0),
      volume,
      volumeWeight,
      grossWeight: Number(pkg.weight || 0),
    };
  });

  if (tableData.length === 0) {
    tableData = subOrders.map((sub) => ({
      id: sub.id,
      thirdParty: '-',
      orderNo: sub.subOrderNo,
      containerNo: sub.shippingUnitNo || '-',
      status: sub.status,
      itemName: '-',
      description: '-',
      dimensions: '-',
      pieces: Number(sub.pieces || 0),
      volume: Number(sub.volume || 0),
      volumeWeight: Number(sub.volume || 0) * 167,
      grossWeight: Number(sub.weight || 0),
    }));
  }

  const statusLabelMap: Record<string, { label: string; color: string }> = {
    PACKED: { label: '已集装', color: 'blue' },
    PENDING_DEPARTURE: { label: '待发货', color: 'orange' },
    IN_TRANSIT: { label: '运输中', color: 'processing' },
    ARRIVED: { label: '已到达', color: 'cyan' },
    DELIVERED: { label: '已完成', color: 'success' },
  };

  const columns: ColumnsType<any> = [
    { title: '第三方运单号', dataIndex: 'thirdParty', key: 'thirdParty', width: 210 },
    { title: '运单号', dataIndex: 'orderNo', key: 'orderNo', width: 180 },
    { title: '集装箱号', dataIndex: 'containerNo', key: 'containerNo', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => {
        const cfg = statusLabelMap[v] || { label: SUB_ORDER_STATUS_CONFIG[v as SubOrder['status']]?.label || v, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    { title: '品名', dataIndex: 'itemName', key: 'itemName', width: 140 },
    { title: '说明', dataIndex: 'description', key: 'description', width: 110 },
    { title: '尺寸cm', dataIndex: 'dimensions', key: 'dimensions', width: 140 },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'right' },
    { title: '体积CBM', dataIndex: 'volume', key: 'volume', width: 110, align: 'right', render: (v: number) => Number(v || 0).toFixed(4) },
    { title: '体积重Kg', dataIndex: 'volumeWeight', key: 'volumeWeight', width: 110, align: 'right', render: (v: number) => Number(v || 0).toFixed(2) },
    { title: '毛重Kg', dataIndex: 'grossWeight', key: 'grossWeight', width: 100, align: 'right', render: (v: number) => Number(v || 0).toFixed(2) },
  ];

  const totalPieces = tableData.reduce((sum, r) => sum + Number(r.pieces || 0), 0);
  const totalVolume = tableData.reduce((sum, r) => sum + Number(r.volume || 0), 0);
  const totalVolumeWeight = tableData.reduce((sum, r) => sum + Number(r.volumeWeight || 0), 0);
  const totalGross = tableData.reduce((sum, r) => sum + Number(r.grossWeight || 0), 0);

  return (
    <Table
      columns={columns}
      dataSource={tableData}
      rowKey="id"
      pagination={false}
      size="small"
      scroll={{ x: 1500 }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={7}>
              <Text strong>合计</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="right"><Text strong>{totalPieces}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="right"><Text strong>{totalVolume.toFixed(4)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={9} align="right"><Text strong>{totalVolumeWeight.toFixed(2)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={10} align="right"><Text strong>{totalGross.toFixed(2)}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
}

// 应收明细表格组件 — 按币种分组展示
const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', CNY: '¥', NGN: '₦', EUR: '€' };

function FeesTable({
  order,
  subOrders: _subOrders,
  fees: initialFees = [],
  onOpenFreightRates,
  onExportBill,
}: {
  order: MasterOrder;
  subOrders: SubOrder[];
  fees?: any[];
  onOpenFreightRates?: () => void;
  onExportBill?: () => void;
}) {
  const rows = (Array.isArray(initialFees) ? initialFees : []).filter((f) => f.feeDirection !== 'PAYABLE');

  // 按币种分组
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    rows.forEach(f => {
      const cur = f.currency || 'USD';
      if (!map[cur]) map[cur] = [];
      map[cur].push(f);
    });
    // 确保至少有一组（即使为空也展示 USD 组）
    if (Object.keys(map).length === 0) map['USD'] = [];
    return map;
  }, [rows]);

  const columns: ColumnsType<any> = [
    { title: '费用类型', dataIndex: 'feeType', key: 'feeType', width: 160, render: (v: string) => v || '-' },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 100, align: 'right', render: (v: number) => Number(v || 0).toFixed(2) },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'right', render: (v: number) => Number(v || 0).toFixed(2) },
    { title: '汇率', dataIndex: 'exchangeRate', key: 'exchangeRate', width: 80, render: (v: number) => v ? Number(v).toFixed(2) : '-' },
    { title: '金额', key: 'amount', width: 110, align: 'right', render: (_: any, f: any) => <Text strong>{Number(f.amountUsd || f.amount || 0).toFixed(2)}</Text> },
    { title: '录入人', dataIndex: 'createdBy', key: 'createdBy', width: 100, render: (v: string) => v || '-' },
    { title: '日期', dataIndex: 'createdAt', key: 'createdAt', width: 130, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, render: (v: string) => v || '-' },
  ];

  return (
    <>
      {Object.entries(grouped).map(([currency, items]) => {
        const symbol = CURRENCY_SYMBOL[currency] || currency;
        const subtotal = items.reduce((sum, f) => sum + Number(f.amountUsd || f.amount || 0), 0);
        return (
          <div key={currency} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Tag color={currency === 'USD' ? 'blue' : currency === 'CNY' ? 'red' : currency === 'NGN' ? 'green' : 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                {symbol} {currency}
              </Tag>
              <Text strong style={{ color: '#1677ff' }}>小计：{symbol} {subtotal.toFixed(2)}</Text>
            </div>
            <Table
              columns={columns}
              dataSource={items}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: `暂无 ${currency} 费用` }}
            />
          </div>
        );
      })}
    </>
  );
}

// 登记收款按钮+弹窗组件
function RegisterPaymentButton({ order }: { order: MasterOrder }) {
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  const outstanding = (order.totalFees || 0) - (order.paidAmount || 0);
  const isPaid = order.paymentStatus === 'PAID';

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const voucherFiles = (values.vouchers || []).map((f: any) => f.name || f.originFileObj?.name || '凭证').filter(Boolean);
      const receipt = {
        id: `RCV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderNo: order.orderNo,
        amount: values.amount,
        paymentChannel: values.paymentChannel,
        receivedAt: values.receivedAt ? values.receivedAt.toISOString() : new Date().toISOString(),
        voucherNames: voucherFiles,
        operator: '当前用户',
        remark: values.remark || '',
        relatedFeeItem: values.relatedFeeItem || undefined,
        status: 'PENDING' as const,
      };
      const store = JSON.parse(localStorage.getItem('finance_payment_receipt_store') || '{}');
      const list = store[order.orderNo] || [];
      list.push(receipt);
      store[order.orderNo] = list;
      localStorage.setItem('finance_payment_receipt_store', JSON.stringify(store));
      message.success('收款登记已提交，等待财务审核');
      setVisible(false);
      form.resetFields();
    } catch { /* validation error */ }
  };

  return (
    <>
      <Button type="primary" size="small" icon={<DollarOutlined />} onClick={() => {
          form.setFieldsValue({ amount: Math.max(0, Number(outstanding.toFixed(2))), paymentChannel: 'BANK' });
          setVisible(true);
        }}>
          登记收款
        </Button>
      <Modal
        title="登记收款"
        open={visible}
        onCancel={() => setVisible(false)}
        okText="提交审核"
        onOk={handleSubmit}
        width={600}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f' }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Typography.Text strong>运单号:</Typography.Text><Typography.Text>{order.orderNo}</Typography.Text></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Typography.Text strong>客户:</Typography.Text><Typography.Text>{order.customerName || '-'}</Typography.Text></div>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Typography.Text type="secondary">订单总额:</Typography.Text><Typography.Text>¥{(order.totalFees || 0).toFixed(2)}</Typography.Text></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Typography.Text type="secondary">已支付:</Typography.Text><Typography.Text type="success">¥{(order.paidAmount || 0).toFixed(2)}</Typography.Text></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><Typography.Text strong style={{ color: '#cf1322' }}>待收款:</Typography.Text><Typography.Text strong style={{ color: '#cf1322', fontSize: 16 }}>¥{outstanding.toFixed(2)}</Typography.Text></div>
          </Space>
        </div>
        <Form form={form} layout="vertical">
          <Form.Item name="relatedFeeItem" label="关联应收项目">
            <Select placeholder="选择关联的应收项目（可选，默认整单）" allowClear>
              <Select.Option value="运费">运费</Select.Option>
              <Select.Option value="配送费">配送费</Select.Option>
              <Select.Option value="仓储费">仓储费</Select.Option>
              <Select.Option value="清关费">清关费</Select.Option>
              <Select.Option value="包装费">包装费</Select.Option>
              <Select.Option value="其他费用">其他费用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="amount" label="收款金额" rules={[{ required: true, message: '请输入收款金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} max={outstanding + 0.01} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="paymentChannel" label="收款方式" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="BANK">银行转账</Select.Option>
              <Select.Option value="WECHAT">微信支付</Select.Option>
              <Select.Option value="ALIPAY">支付宝</Select.Option>
              <Select.Option value="CASH">现金</Select.Option>
              <Select.Option value="OTHER">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="receivedAt" label="收款时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="vouchers" label="上传收款凭证" valuePropName="fileList" getValueFromEvent={(e: any) => Array.isArray(e) ? e : e?.fileList || []}
            rules={[{ validator: (_, v) => v?.length > 0 ? Promise.resolve() : Promise.reject('请上传至少1张凭证') }]}>
            <Upload.Dragger beforeUpload={() => false} multiple maxCount={5} accept="image/*" listType="picture">
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽上传收款凭证</p>
            </Upload.Dragger>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="收款备注（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// 收款记录展示组件
// 已付款记录 — 按币种分组展示
function PaymentReceiptList({ orderNo }: { orderNo: string }) {
  const receipts = useMemo(() => {
    try {
      const store = JSON.parse(localStorage.getItem('finance_payment_receipt_store') || '{}');
      const list = (store[orderNo] || []) as Array<{
        id: string; amount: number; currency?: string; paymentChannel: string; receivedAt: string;
        voucherNames: string[]; operator: string; remark?: string; relatedFeeItem?: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewedBy?: string; reviewedAt?: string; rejectReason?: string;
      }>;
      // 注入 mock 收款记录用于演示
      if (list.length === 0) {
        const now = dayjs();
        list.push(
          { id: 'RCV-MOCK-01', amount: 528, currency: 'USD', paymentChannel: 'BANK', receivedAt: now.subtract(2, 'day').toISOString(), voucherNames: ['bank_slip_01.jpg'], operator: '财务C', relatedFeeItem: '海运运费', status: 'APPROVED', reviewedBy: '主管D', reviewedAt: now.subtract(1, 'day').toISOString() },
          { id: 'RCV-MOCK-02', amount: 50, currency: 'USD', paymentChannel: 'BANK', receivedAt: now.subtract(2, 'day').toISOString(), voucherNames: ['bank_slip_01.jpg'], operator: '财务C', relatedFeeItem: '报关费', status: 'APPROVED', reviewedBy: '主管D', reviewedAt: now.subtract(1, 'day').toISOString() },
          { id: 'RCV-MOCK-03', amount: 120, currency: 'CNY', paymentChannel: 'WECHAT', receivedAt: now.subtract(1, 'day').toISOString(), voucherNames: ['wechat_pay.png'], operator: '财务C', relatedFeeItem: '包装费', status: 'APPROVED', reviewedBy: '主管D' },
          { id: 'RCV-MOCK-04', amount: 80, currency: 'CNY', paymentChannel: 'ALIPAY', receivedAt: now.toISOString(), voucherNames: [], operator: '财务C', relatedFeeItem: '保险费', status: 'PENDING' },
          { id: 'RCV-MOCK-05', amount: 15000, currency: 'NGN', paymentChannel: 'CASH', receivedAt: now.toISOString(), voucherNames: ['cash_receipt.jpg'], operator: '操作B', relatedFeeItem: '到门费', status: 'PENDING' },
        );
      }
      return list;
    } catch { return []; }
  }, [orderNo]);

  const channelLabel: Record<string, string> = { WECHAT: '微信', ALIPAY: '支付宝', BANK: '银行转账', CASH: '现金', OTHER: '其他' };
  const statusConfig: Record<string, { color: string; label: string }> = {
    PENDING: { color: 'orange', label: '待审核' },
    APPROVED: { color: 'green', label: '已通过' },
    REJECTED: { color: 'red', label: '已驳回' },
  };

  const grouped = useMemo(() => {
    const map: Record<string, typeof receipts> = {};
    receipts.forEach(r => {
      const cur = r.currency || 'CNY';
      if (!map[cur]) map[cur] = [];
      map[cur].push(r);
    });
    return map;
  }, [receipts]);

  const columns: ColumnsType<any> = [
    { title: '关联项目', dataIndex: 'relatedFeeItem', key: 'relatedFeeItem', width: 120, render: (v: string) => v || '整单' },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 110, align: 'right', render: (v: number, r: any) => <Typography.Text strong style={{ color: '#52c41a' }}>{CURRENCY_SYMBOL[r.currency || 'CNY'] || ''}{v.toFixed(2)}</Typography.Text> },
    { title: '收款方式', dataIndex: 'paymentChannel', key: 'paymentChannel', width: 90, render: (v: string) => channelLabel[v] || v },
    { title: '收款时间', dataIndex: 'receivedAt', key: 'receivedAt', width: 140, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '凭证', dataIndex: 'voucherNames', key: 'voucherNames', width: 70, render: (v: string[]) => v?.length ? <Tag>{v.length}张</Tag> : '-' },
    { title: '登记人', dataIndex: 'operator', key: 'operator', width: 70 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (v: string) => <Tag color={statusConfig[v]?.color}>{statusConfig[v]?.label}</Tag> },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true, render: (v: string, r: any) => r.rejectReason ? <Typography.Text type="danger">驳回: {r.rejectReason}</Typography.Text> : (v || '-') },
  ];

  if (receipts.length === 0) {
    return <Table rowKey="id" size="small" dataSource={[]} pagination={false} locale={{ emptyText: '暂无收款记录' }} columns={columns} />;
  }

  return (
    <>
      {Object.entries(grouped).map(([currency, items]) => {
        const symbol = CURRENCY_SYMBOL[currency] || currency;
        const subtotal = items.reduce((sum, r) => sum + (r.amount || 0), 0);
        return (
          <div key={currency} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Tag color={currency === 'USD' ? 'blue' : currency === 'CNY' ? 'red' : currency === 'NGN' ? 'green' : 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
                {symbol} {currency}
              </Tag>
              <Text strong style={{ color: '#52c41a' }}>小计：{symbol} {subtotal.toFixed(2)}</Text>
            </div>
            <Table rowKey="id" size="small" dataSource={items} pagination={false} columns={columns} />
          </div>
        );
      })}
    </>
  );
}
