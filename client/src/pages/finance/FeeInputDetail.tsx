import React, { useState, useEffect } from 'react';
import {
  Card, Descriptions, Tag, Button, Space, Timeline,
  Row, Col, Typography, Modal, Form, Input, Select,
  message, Divider, Statistic, Drawer, Spin
} from 'antd';
import {
  DollarOutlined, HistoryOutlined,
  EditOutlined, DeleteOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeeType, FeeDirection, FeeStatus, Currency } from '../../types/finance';
import { FEE_TYPE_CONFIG, FEE_STATUS_CONFIG, CURRENCY_CONFIG } from '../../types/finance';
import { feeApi } from '../../api';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface FeeInputDetailProps {
  visible: boolean;
  feeId: string;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

// 费用详情数据类型
interface FeeDetailData {
  id: string;
  feeNo: string;
  relatedType: string;
  relatedId: string;
  relatedNo: string;
  feeType: FeeType;
  feeDirection: FeeDirection;
  amount: number;
  currency: Currency;
  exchangeRate: number;
  amountCNY: number;
  status: FeeStatus;
  supplierName: string;
  supplierId: string;
  customerName: string | null;
  description: string;
  remark: string;
  invoiceNo: string | null;
  approverName: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  logs: { time: string; operator: string; action: string; detail: string }[];
}

const RELATED_TYPE_TEXT: Record<string, string> = {
  ORDER: '订单',
  UNIT: '集装单元',
  JOB: '任务',
  TRANSFER: '调拨单'
};

// 左侧导航项
const NAV_ITEMS = [
  { key: 'fee', title: '费用信息' },
  { key: 'related', title: '关联信息' },
  { key: 'supplier', title: '供应商/客户' },
  { key: 'approval', title: '审批信息' },
  { key: 'voucher', title: '凭证信息' },
  { key: 'logs', title: '操作记录' }
];

const EMPTY_DETAIL: FeeDetailData = {
  id: '', feeNo: '', relatedType: '', relatedId: '', relatedNo: '',
  feeType: 'OTHER' as FeeType, feeDirection: 'PAYABLE' as FeeDirection,
  amount: 0, currency: 'CNY' as Currency, exchangeRate: 1, amountCNY: 0,
  status: 'PENDING' as FeeStatus, supplierName: '', supplierId: '',
  customerName: null, description: '', remark: '', invoiceNo: null,
  approverName: null, approvedAt: null, rejectReason: null, paidAt: null,
  paymentMethod: null, createdByName: '', createdAt: '', updatedAt: '',
  logs: []
};

export const FeeInputDetail: React.FC<FeeInputDetailProps> = ({ visible, feeId, onClose, onDelete, onEdit }) => {
  const [data, setData] = useState<FeeDetailData>(EMPTY_DETAIL);
  const [loading, setLoading] = useState(false);

  // 从 API 加载费用详情
  useEffect(() => {
    if (!visible || !feeId) return;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res: any = await feeApi.get(feeId);
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        const detail = rows[0];
        if (detail) {
          setData({ ...EMPTY_DETAIL, ...detail, logs: detail.logs ?? [] });
        } else {
          setData(EMPTY_DETAIL);
        }
      } catch (err: any) {
        console.error('加载费用详情失败:', err);
        message.error('加载费用详情失败');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [visible, feeId]);

  // 提交审批 Modal
  const [submitModalVisible, setSubmitModalVisible] = useState(false);

  // 锚点导航
  const handleNavClick = (key: string) => {
    const el = document.getElementById(`fee-${key}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 提交审批
  const handleSubmitApproval = () => {
    Modal.confirm({
      title: '提交审批',
      content: `确定将费用 ${data.feeNo}（${CURRENCY_CONFIG[data.currency].symbol}${data.amount.toFixed(2)}）提交审批？`,
      onOk: () => {
        setData({
          ...data,
          status: 'PENDING' as FeeStatus,
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          logs: [
            { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '提交审批', detail: '费用已提交至财务审批' },
            ...data.logs
          ]
        });
        message.success('已提交审批');
      }
    });
  };

  // 取消费用
  const handleCancel = () => {
    Modal.confirm({
      title: '取消费用',
      icon: <ExclamationCircleOutlined />,
      content: `确定要取消费用 ${data.feeNo}？`,
      okType: 'danger',
      onOk: () => {
        setData({
          ...data,
          status: 'CANCELLED' as FeeStatus,
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          logs: [
            { time: dayjs().format('YYYY-MM-DD HH:mm'), operator: '当前用户', action: '取消费用', detail: '费用已取消' },
            ...data.logs
          ]
        });
        message.success('费用已取消');
      }
    });
  };

  // 删除
  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除费用 ${data.feeNo}？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      onOk: () => {
        message.success('费用已删除');
        onDelete?.(data.id);
        onClose();
      }
    });
  };

  const statusConfig = FEE_STATUS_CONFIG[data.status] || FEE_STATUS_CONFIG.PENDING;
  const typeConfig = FEE_TYPE_CONFIG[data.feeType] || FEE_TYPE_CONFIG.OTHER;
  const currencyConfig = CURRENCY_CONFIG[data.currency];

  return (
    <Drawer
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>{data.feeNo}</Title>
          <Tag color={statusConfig.color} style={{ fontSize: 14, padding: '2px 12px' }}>{statusConfig.label}</Tag>
          <Tag color={data.feeDirection === 'PAYABLE' ? 'red' : 'green'}>
            {data.feeDirection === 'PAYABLE' ? '应付' : '应收'}
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
              <Button onClick={handleCancel}>取消费用</Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
            </>
          )}
          {data.status === 'REJECTED' && (
            <Button icon={<EditOutlined />} onClick={() => onEdit?.(data.id)}>修改重提</Button>
          )}
        </Space>
      }
    >
      <Spin spinning={loading}>
      <Row gutter={16}>
        {/* 左侧导航 */}
        <Col span={3}>
          <div style={{ position: 'sticky', top: 100 }}>
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
          <Card id="fee-fee" title="费用信息" style={{ marginBottom: 16 }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic
                  title="费用金额"
                  value={data.amount}
                  prefix={currencyConfig.symbol}
                  precision={2}
                  valueStyle={{ color: data.feeDirection === 'PAYABLE' ? '#cf1322' : '#3f8600', fontSize: 28 }}
                />
              </Col>
              {data.currency !== 'CNY' && data.amountCNY && (
                <Col span={6}>
                  <Statistic title="折合人民币" value={data.amountCNY} prefix="¥" precision={2} />
                </Col>
              )}
              <Col span={6}>
                <Statistic title="费用类型" valueRender={() => <Tag color={typeConfig.color}>{typeConfig.label}</Tag>} value=" " />
              </Col>
              <Col span={6}>
                <Statistic title="费用状态" valueRender={() => <Tag color={statusConfig.color}>{statusConfig.label}</Tag>} value=" " />
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Descriptions column={3} size="small">
              <Descriptions.Item label="费用编号"><Text strong>{data.feeNo}</Text></Descriptions.Item>
              <Descriptions.Item label="费用方向">
                <Tag color={data.feeDirection === 'PAYABLE' ? 'red' : 'green'}>
                  {data.feeDirection === 'PAYABLE' ? '应付' : '应收'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="币种">{currencyConfig.label}（{data.currency}）</Descriptions.Item>
              {data.exchangeRate && data.exchangeRate !== 1 && (
                <Descriptions.Item label="汇率">{data.exchangeRate}</Descriptions.Item>
              )}
              <Descriptions.Item label="创建人">{data.createdByName}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(data.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{dayjs(data.updatedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              {data.description && <Descriptions.Item label="费用说明" span={3}>{data.description}</Descriptions.Item>}
              {data.remark && <Descriptions.Item label="备注" span={3}>{data.remark}</Descriptions.Item>}
            </Descriptions>
          </Card>

          {/* 关联信息 */}
          <Card id="fee-related" title="关联信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="关联类型">
                <Tag>{RELATED_TYPE_TEXT[data.relatedType] || data.relatedType}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联单号">
                <a style={{ fontWeight: 'bold' }}>{data.relatedNo}</a>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* 供应商/客户 */}
          <Card id="fee-supplier" title={data.feeDirection === 'PAYABLE' ? '供应商信息' : '客户信息'} style={{ marginBottom: 16 }}>
            {data.feeDirection === 'PAYABLE' ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="供应商名称"><Text strong>{data.supplierName || '-'}</Text></Descriptions.Item>
                <Descriptions.Item label="供应商编码">{data.supplierId || '-'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="客户名称"><Text strong>{data.customerName || '-'}</Text></Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          {/* 审批信息 */}
          <Card id="fee-approval" title="审批信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="审批状态"><Tag color={statusConfig.color}>{statusConfig.label}</Tag></Descriptions.Item>
              <Descriptions.Item label="审批人">{data.approverName || '-'}</Descriptions.Item>
              <Descriptions.Item label="审批时间">{data.approvedAt ? dayjs(data.approvedAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              {data.rejectReason && (
                <Descriptions.Item label="驳回原因" span={2}>
                  <Text type="danger">{data.rejectReason}</Text>
                </Descriptions.Item>
              )}
              {data.paidAt && (
                <>
                  <Descriptions.Item label="支付时间">{dayjs(data.paidAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
                  <Descriptions.Item label="支付方式">{data.paymentMethod || '-'}</Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>

          {/* 凭证信息 */}
          <Card id="fee-voucher" title={<span><FileTextOutlined /> 凭证信息</span>} style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="发票号">{data.invoiceNo || '-'}</Descriptions.Item>
            </Descriptions>
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>
              暂无上传凭证
            </div>
          </Card>

          {/* 操作记录 */}
          <Card id="fee-logs" title={<span><HistoryOutlined /> 操作记录</span>}>
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
      </Spin>
    </Drawer>
  );
};
