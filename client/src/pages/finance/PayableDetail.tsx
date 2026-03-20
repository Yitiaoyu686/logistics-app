import React from 'react';
import {
  Drawer, Card, Descriptions, Tag, Space, Row, Col, Typography,
  Statistic, Divider, Timeline, Button, Badge
} from 'antd';
import {
  HistoryOutlined, DollarOutlined, BankOutlined,
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeeType, Currency } from '../../types/finance';
import { FEE_TYPE_CONFIG, CURRENCY_CONFIG } from '../../types/finance';

const { Title, Text } = Typography;

// ==================== 类型定义 ====================

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID';

export interface PayableRecord {
  id: string;
  feeNo: string;

  // 关联信息
  relatedType: 'ORDER' | 'JOB' | 'UNIT' | 'TRANSFER';
  relatedNo: string;
  jobNo: string;
  route: string;
  transportType?: 'SEA' | 'AIR';

  // 费用信息
  feeType: FeeType;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  amountCNY?: number;
  description?: string;
  remark?: string;

  // 供应商信息
  supplierName: string;
  supplierBank?: string;
  supplierAccount?: string;
  supplierContact?: string;

  // 发票凭证
  invoiceNo?: string;

  // 审批信息
  approverName: string;
  approvedAt: string;

  // 支付信息
  paymentStatus: PaymentStatus;
  dueDate: string;
  paymentMethod?: string;
  transactionNo?: string;
  paidAt?: string;
  paidBy?: string;
  paymentVoucher?: string;
  paymentRemark?: string;

  // 创建信息
  createdByName: string;
  createdAt: string;

  // 操作日志
  logs?: { time: string; operator: string; action: string; detail: string }[];
}

// ==================== 常量 ====================

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { text: string; color: string }> = {
  PENDING: { text: '待支付', color: 'orange' },
  PROCESSING: { text: '处理中', color: 'blue' },
  PAID: { text: '已支付', color: 'green' }
};

const RELATED_TYPE_TEXT: Record<string, string> = {
  ORDER: '订单',
  UNIT: '集装单元',
  JOB: '任务',
  TRANSFER: '调拨单'
};

const NAV_ITEMS = [
  { key: 'fee', title: '费用信息' },
  { key: 'job', title: '关联任务' },
  { key: 'supplier', title: '供应商信息' },
  { key: 'approval', title: '审批信息' },
  { key: 'payment', title: '支付信息' },
  { key: 'logs', title: '操作记录' }
];

// ==================== 组件 ====================

interface PayableDetailProps {
  visible: boolean;
  data: PayableRecord | null;
  onClose: () => void;
  onPay: (record: PayableRecord) => void;
}

export const PayableDetail: React.FC<PayableDetailProps> = ({ visible, data, onClose, onPay }) => {
  if (!data) return null;

  const handleNavClick = (key: string) => {
    const el = document.getElementById(`payable-${key}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toCNY = data.amountCNY || data.amount;
  const statusCfg = PAYMENT_STATUS_CONFIG[data.paymentStatus];
  const typeCfg = FEE_TYPE_CONFIG[data.feeType] || FEE_TYPE_CONFIG.OTHER;
  const currencyCfg = CURRENCY_CONFIG[data.currency];
  const isOverdue = data.paymentStatus === 'PENDING' && dayjs(data.dueDate).isBefore(dayjs());
  const daysLeft = dayjs(data.dueDate).diff(dayjs(), 'day');

  return (
    <Drawer
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>{data.feeNo}</Title>
          <Tag color={statusCfg.color}>{statusCfg.text}</Tag>
          <Tag color={typeCfg.color}>{typeCfg.label}</Tag>
          {isOverdue && <Tag color="error" icon={<WarningOutlined />}>已逾期</Tag>}
        </Space>
      }
      placement="right"
      width="80%"
      open={visible}
      onClose={onClose}
      destroyOnClose
      extra={
        data.paymentStatus === 'PENDING' ? (
          <Button type="primary" icon={<DollarOutlined />} onClick={() => onPay(data)}>
            去付款
          </Button>
        ) : data.paymentStatus === 'PAID' ? (
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 14, padding: '4px 12px' }}>
            已支付 {data.paidAt && `(${dayjs(data.paidAt).format('YYYY-MM-DD')})`}
          </Tag>
        ) : (
          <Tag color="processing" style={{ fontSize: 14, padding: '4px 12px' }}>处理中</Tag>
        )
      }
    >
      <Row gutter={16}>
        {/* 左侧导航 */}
        <Col span={3}>
          <div style={{ position: 'sticky', top: 0 }}>
            <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 4, padding: '8px 0' }}>
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
          {/* 费用信息 */}
          <Card id="payable-fee" title="费用信息" style={{ marginBottom: 16 }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic
                  title="应付金额"
                  value={data.amount}
                  prefix={currencyCfg.symbol}
                  precision={2}
                  valueStyle={{ color: '#cf1322', fontSize: 28 }}
                />
              </Col>
              {data.currency !== 'CNY' && data.amountCNY && (
                <Col span={6}>
                  <Statistic title="折合人民币" value={data.amountCNY} prefix="¥" precision={2} />
                </Col>
              )}
              <Col span={6}>
                <div>
                  <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>应付日期</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: isOverdue ? '#cf1322' : undefined }}>
                    {dayjs(data.dueDate).format('YYYY-MM-DD')}
                  </div>
                  {data.paymentStatus === 'PENDING' && (
                    isOverdue
                      ? <Tag color="error" style={{ marginTop: 4 }}>已逾期 {Math.abs(daysLeft)} 天</Tag>
                      : daysLeft <= 3
                        ? <Tag color="warning" style={{ marginTop: 4 }}>剩余 {daysLeft} 天</Tag>
                        : <Tag color="default" style={{ marginTop: 4 }}>剩余 {daysLeft} 天</Tag>
                  )}
                </div>
              </Col>
              <Col span={6}>
                <Statistic
                  title="支付状态"
                  valueRender={() => <Tag color={statusCfg.color} style={{ fontSize: 14, padding: '2px 12px' }}>{statusCfg.text}</Tag>}
                  value=" "
                />
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            <Descriptions column={3} size="small">
              <Descriptions.Item label="费用编号"><Text strong>{data.feeNo}</Text></Descriptions.Item>
              <Descriptions.Item label="费用类型"><Tag color={typeCfg.color}>{typeCfg.label}</Tag></Descriptions.Item>
              <Descriptions.Item label="币种">{currencyCfg.label}（{data.currency}）</Descriptions.Item>
              {data.exchangeRate && data.exchangeRate !== 1 && (
                <Descriptions.Item label="汇率">{data.exchangeRate}</Descriptions.Item>
              )}
              <Descriptions.Item label="发票号">{data.invoiceNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建人">{data.createdByName}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(data.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              {data.description && <Descriptions.Item label="费用说明" span={3}>{data.description}</Descriptions.Item>}
              {data.remark && <Descriptions.Item label="备注" span={3}>{data.remark}</Descriptions.Item>}
            </Descriptions>
          </Card>

          {/* 关联任务 */}
          <Card id="payable-job" title="关联任务" style={{ marginBottom: 16 }}>
            <Descriptions column={3} size="small">
              <Descriptions.Item label="关联类型">
                <Tag>{RELATED_TYPE_TEXT[data.relatedType] || data.relatedType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联单号">
                <a style={{ fontWeight: 'bold' }}>{data.relatedNo}</a>
              </Descriptions.Item>
              <Descriptions.Item label="所属任务">
                <Text strong>{data.jobNo}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="航线">{data.route}</Descriptions.Item>
              {data.transportType && (
                <Descriptions.Item label="运输方式">
                  <Tag>{data.transportType === 'SEA' ? '海运' : '空运'}</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* 供应商信息 */}
          <Card id="payable-supplier" title={<span><BankOutlined /> 供应商信息</span>} style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="供应商名称"><Text strong>{data.supplierName}</Text></Descriptions.Item>
              <Descriptions.Item label="联系人">{data.supplierContact || '-'}</Descriptions.Item>
              <Descriptions.Item label="开户行">{data.supplierBank || '-'}</Descriptions.Item>
              <Descriptions.Item label="银行账号">{data.supplierAccount || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 审批信息 */}
          <Card id="payable-approval" title="审批信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="审批状态">
                <Tag color="success">已审批</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="审批人">{data.approverName}</Descriptions.Item>
              <Descriptions.Item label="审批时间">{dayjs(data.approvedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 支付信息 */}
          <Card id="payable-payment" title={<span><DollarOutlined /> 支付信息</span>} style={{ marginBottom: 16 }}>
            {data.paymentStatus === 'PAID' ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="支付状态">
                  <Tag color="success" icon={<CheckCircleOutlined />}>已支付</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="支付方式">{data.paymentMethod || '-'}</Descriptions.Item>
                <Descriptions.Item label="支付时间">{data.paidAt ? dayjs(data.paidAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
                <Descriptions.Item label="支付人">{data.paidBy || '-'}</Descriptions.Item>
                <Descriptions.Item label="交易流水号"><Text copyable={!!data.transactionNo}>{data.transactionNo || '-'}</Text></Descriptions.Item>
                <Descriptions.Item label="支付凭证">{data.paymentVoucher || '-'}</Descriptions.Item>
                {data.paymentRemark && <Descriptions.Item label="支付备注" span={2}>{data.paymentRemark}</Descriptions.Item>}
              </Descriptions>
            ) : data.paymentStatus === 'PROCESSING' ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <ClockCircleOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} />
                <div><Text type="secondary">支付处理中，请等待银行确认</Text></div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <DollarOutlined style={{ fontSize: 32, color: '#faad14', marginBottom: 8 }} />
                <div style={{ marginBottom: 12 }}><Text type="secondary">等待支付</Text></div>
                <Button type="primary" icon={<DollarOutlined />} onClick={() => onPay(data)}>
                  去付款
                </Button>
              </div>
            )}
          </Card>

          {/* 操作记录 */}
          <Card id="payable-logs" title={<span><HistoryOutlined /> 操作记录</span>}>
            {data.logs && data.logs.length > 0 ? (
              <Timeline>
                {data.logs.map((log, index) => (
                  <Timeline.Item key={index} color={index === 0 ? 'green' : 'gray'}>
                    <div>
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
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>暂无操作记录</div>
            )}
          </Card>
        </Col>
      </Row>
    </Drawer>
  );
};
