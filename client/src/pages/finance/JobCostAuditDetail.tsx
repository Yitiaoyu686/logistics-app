import React, { useState, useMemo } from 'react';
import {
  Drawer, Card, Row, Col, Statistic, Descriptions, Tag, Table,
  Button, Space, Modal, Divider, Typography,
  Timeline, Alert, Badge, Progress, message
} from 'antd';
import {
  CheckCircleOutlined, WarningOutlined, LockOutlined,
  HistoryOutlined, ContainerOutlined, DollarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { FeeType, FeeDirection, FeeStatus, Currency } from '../../types/finance';
import { FEE_TYPE_CONFIG, FEE_STATUS_CONFIG, CURRENCY_CONFIG } from '../../types/finance';

const { Text, Title } = Typography;

// ==================== 类型定义 ====================

export type FeeLevel = 'JOB' | 'UNIT' | 'ORDER';

/** 费用明细 */
export interface AuditFeeItem {
  id: string;
  feeNo: string;
  feeLevel: FeeLevel;
  shippingUnitNo?: string;
  subOrderNo?: string;
  feeType: FeeType;
  feeDirection: FeeDirection;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  amountCNY?: number;
  estimatedAmount?: number;
  supplierName?: string;
  customerName?: string;
  status: FeeStatus;
  approverName?: string;
  approvedAt?: string;
  rejectReason?: string;
  auditRemark?: string;
  applicant: string;
  applyTime: string;
  invoiceNo?: string;
  description?: string;
  remark?: string;
}

/** 运输单元内的订单 */
export interface AuditOrderInfo {
  subOrderNo: string;
  customerName: string;
  pieces: number;
  weight: number;
  goodsDescription?: string;
}

/** 运输单元 */
export interface AuditShippingUnit {
  unitNo: string;
  unitType: string;
  orders: AuditOrderInfo[];
}

/** 任务记录 */
export interface AuditJobRecord {
  jobNo: string;
  route: string;
  vessel: string;
  transportType: 'SEA' | 'AIR';
  status: string;
  etd?: string;
  eta?: string;
  settlementStatus?: 'UNSETTLED' | 'SETTLED';
  settledAt?: string;
  settledBy?: string;
  shippingUnits: AuditShippingUnit[];
  fees: AuditFeeItem[];
  auditLogs?: { time: string; operator: string; action: string; detail: string }[];
}

// ==================== 常量 ====================

const FEE_LEVEL_CONFIG: Record<FeeLevel, { label: string; color: string }> = {
  JOB: { label: '任务级', color: 'blue' },
  UNIT: { label: '柜/板级', color: 'purple' },
  ORDER: { label: '订单级', color: 'green' }
};

const JOB_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  DEPARTED: { text: '已发运', color: 'blue' },
  IN_TRANSIT: { text: '运输中', color: 'processing' },
  ARRIVED: { text: '已到港', color: 'orange' },
  CLEARED: { text: '已清关', color: 'cyan' },
  CLOSED: { text: '已关账', color: 'green' }
};

// ==================== 组件 ====================

interface JobCostAuditDetailProps {
  visible: boolean;
  data: AuditJobRecord | null;
  onClose: () => void;
  onSettle: (jobNo: string) => void;
}

export const JobCostAuditDetail: React.FC<JobCostAuditDetailProps> = ({ visible, data, onClose, onSettle }) => {
  const [settleConfirmVisible, setSettleConfirmVisible] = useState(false);

  const toCNY = (f: AuditFeeItem) => f.amountCNY || f.amount;

  const fees = data?.fees ?? [];
  const shippingUnits = data?.shippingUnits ?? [];

  // --- 统计 ---
  const stats = useMemo(() => {
    const receivableTotal = fees
      .filter(f => f.feeDirection === 'RECEIVABLE' && f.status !== 'CANCELLED')
      .reduce((sum, f) => sum + toCNY(f), 0);
    const payableTotal = fees
      .filter(f => f.feeDirection === 'PAYABLE' && f.status !== 'CANCELLED')
      .reduce((sum, f) => sum + toCNY(f), 0);
    const pendingCount = fees.filter(f => f.status === 'PENDING').length;
    const approvedCount = fees.filter(f => f.status === 'APPROVED' || f.status === 'PAID').length;
    const rejectedCount = fees.filter(f => f.status === 'REJECTED').length;
    const totalCount = fees.filter(f => f.status !== 'CANCELLED').length;
    const approvalProgress = totalCount > 0 ? Math.round(approvedCount / totalCount * 100) : 0;
    return {
      receivableTotal, payableTotal,
      profit: receivableTotal - payableTotal,
      pendingCount, approvedCount, rejectedCount, totalCount,
      approvalProgress
    };
  }, [fees]);

  // --- 费用分组 ---
  const jobFees = fees.filter(f => f.feeLevel === 'JOB');
  const getUnitFees = (unitNo: string) => fees.filter(f => f.feeLevel === 'UNIT' && f.shippingUnitNo === unitNo);
  const getOrderFees = (orderNo: string) => fees.filter(f => f.feeLevel === 'ORDER' && f.subOrderNo === orderNo);

  // --- 导航 ---
  const navItems = useMemo(() => {
    const items: { key: string; title: string }[] = [
      { key: 'overview', title: '费用概览' },
      { key: 'job-fees', title: '任务级费用' }
    ];
    shippingUnits.forEach(u => {
      items.push({
        key: `unit-${u.unitNo}`,
        title: `${u.unitNo} [${u.unitType}]`
      });
    });
    items.push({ key: 'logs', title: '操作记录' });
    return items;
  }, [fees, shippingUnits]);

  // Early return AFTER all hooks
  if (!data) return null;

  const handleNavClick = (key: string) => {
    const el = document.getElementById(`cost-${key}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 是否可结算：所有费用都已审批通过（无 PENDING），且尚未结算
  const canSettle = stats.pendingCount === 0 && stats.rejectedCount === 0 && stats.totalCount > 0 && data.settlementStatus !== 'SETTLED';
  const isSettled = data.settlementStatus === 'SETTLED';

  const handleSettleConfirm = () => {
    onSettle(data.jobNo);
    setSettleConfirmVisible(false);
    message.success('结算确认成功');
  };

  // --- 只读费用表格列 ---
  const feeColumns = [
    {
      title: '费用编号',
      dataIndex: 'feeNo',
      width: 130,
      render: (text: string) => <Text code style={{ fontSize: 12 }}>{text}</Text>
    },
    {
      title: '类型',
      dataIndex: 'feeType',
      width: 80,
      render: (type: FeeType) => <Tag color={FEE_TYPE_CONFIG[type]?.color}>{FEE_TYPE_CONFIG[type]?.label}</Tag>
    },
    {
      title: '方向',
      dataIndex: 'feeDirection',
      width: 55,
      render: (dir: FeeDirection) => <Tag color={dir === 'PAYABLE' ? 'red' : 'green'}>{dir === 'PAYABLE' ? '应付' : '应收'}</Tag>
    },
    {
      title: '金额',
      key: 'amount',
      width: 120,
      render: (_: unknown, record: AuditFeeItem) => (
        <div>
          <Text strong style={{ color: record.feeDirection === 'PAYABLE' ? '#cf1322' : '#3f8600' }}>
            {CURRENCY_CONFIG[record.currency].symbol}{record.amount.toFixed(2)}
          </Text>
          {record.currency !== 'CNY' && record.amountCNY && (
            <div style={{ fontSize: 11, color: '#999' }}>≈ ¥{record.amountCNY.toFixed(2)}</div>
          )}
        </div>
      )
    },
    {
      title: '预估',
      key: 'estimated',
      width: 100,
      render: (_: unknown, record: AuditFeeItem) => {
        if (!record.estimatedAmount) return <Text type="secondary">-</Text>;
        const diff = record.amount - record.estimatedAmount;
        const pct = record.estimatedAmount > 0 ? (diff / record.estimatedAmount * 100) : 0;
        return (
          <div>
            <div style={{ fontSize: 12 }}>{CURRENCY_CONFIG[record.currency].symbol}{record.estimatedAmount.toFixed(2)}</div>
            {diff !== 0 && (
              <Tag color={pct > 5 ? 'red' : pct > 0 ? 'orange' : 'green'} style={{ fontSize: 11 }}>
                {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
              </Tag>
            )}
          </div>
        );
      }
    },
    {
      title: '供应商/客户',
      key: 'party',
      width: 110,
      ellipsis: true,
      render: (_: unknown, record: AuditFeeItem) => record.supplierName || record.customerName || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 70,
      render: (status: FeeStatus) => <Tag color={FEE_STATUS_CONFIG[status]?.color}>{FEE_STATUS_CONFIG[status]?.label}</Tag>
    },
    {
      title: '审批人',
      key: 'approver',
      width: 90,
      render: (_: unknown, record: AuditFeeItem) => {
        if (record.approverName) {
          return (
            <div>
              <div>{record.approverName}</div>
              {record.approvedAt && <div style={{ fontSize: 11, color: '#999' }}>{dayjs(record.approvedAt).format('MM-DD HH:mm')}</div>}
            </div>
          );
        }
        return <Text type="secondary">-</Text>;
      }
    },
    {
      title: '说明/备注',
      key: 'remarks',
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: AuditFeeItem) => (
        <Space direction="vertical" size={0}>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
          {record.remark && <Text style={{ fontSize: 12, color: '#fa8c16' }}>{record.remark}</Text>}
          {record.auditRemark && <Text style={{ fontSize: 12, color: '#1890ff' }}>审: {record.auditRemark}</Text>}
          {record.rejectReason && <Text type="danger" style={{ fontSize: 12 }}>驳: {record.rejectReason}</Text>}
        </Space>
      )
    }
  ];

  // --- 渲染只读费用表格 ---
  const renderFeeTable = (feeList: AuditFeeItem[]) => (
    <Table
      rowKey="id"
      columns={feeColumns}
      dataSource={feeList}
      pagination={false}
      size="small"
    />
  );

  const statusConfig = JOB_STATUS_CONFIG[data.status] || { text: data.status, color: 'default' };

  return (
    <Drawer
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>{data.jobNo}</Title>
          <Tag color={statusConfig.color}>{statusConfig.text}</Tag>
          {isSettled && <Tag color="success" icon={<LockOutlined />}>已结算</Tag>}
          <Text type="secondary">{data.route} · {data.vessel}</Text>
        </Space>
      }
      placement="right"
      width="80%"
      open={visible}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          {isSettled ? (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 14, padding: '4px 12px' }}>
              已结算 {data.settledAt && `(${data.settledAt})`}
            </Tag>
          ) : canSettle ? (
            <Button type="primary" icon={<LockOutlined />} onClick={() => setSettleConfirmVisible(true)}>
              结算确认
            </Button>
          ) : (
            <Button disabled icon={<LockOutlined />}>
              结算确认（需全部审批通过）
            </Button>
          )}
        </Space>
      }
    >
      <Row gutter={16}>
        {/* 左侧导航 */}
        <Col span={4}>
          <div style={{ position: 'sticky', top: 0 }}>
            <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 4, padding: '8px 0' }}>
              {navItems.map(item => (
                <div
                  key={item.key}
                  onClick={() => handleNavClick(item.key)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#666' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#1890ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 130 }}>{item.title}</span>
                </div>
              ))}
            </div>
          </div>
        </Col>

        {/* 右侧内容 */}
        <Col span={20}>
          {/* === 费用概览 === */}
          <Card id="cost-overview" title="费用概览" style={{ marginBottom: 16 }}>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={5}>
                <Statistic title="应收总额(¥)" value={stats.receivableTotal} prefix="¥" precision={2} valueStyle={{ color: '#3f8600', fontSize: 22 }} />
              </Col>
              <Col span={5}>
                <Statistic title="应付总额(¥)" value={stats.payableTotal} prefix="¥" precision={2} valueStyle={{ color: '#cf1322', fontSize: 22 }} />
              </Col>
              <Col span={5}>
                <Statistic title="预估利润(¥)" value={stats.profit} prefix="¥" precision={2} valueStyle={{ color: stats.profit >= 0 ? '#3f8600' : '#cf1322', fontSize: 22 }} />
              </Col>
              <Col span={4}>
                <Statistic title="费用总数" value={stats.totalCount} suffix="笔" />
              </Col>
              <Col span={5}>
                <div>
                  <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>审批进度</div>
                  <Progress
                    percent={stats.approvalProgress}
                    size="small"
                    status={stats.approvalProgress === 100 ? 'success' : 'active'}
                    format={() => `${stats.approvedCount}/${stats.totalCount}`}
                  />
                  {stats.pendingCount > 0 && (
                    <Text type="warning" style={{ fontSize: 12 }}>{stats.pendingCount}笔待审批</Text>
                  )}
                  {stats.rejectedCount > 0 && (
                    <Text type="danger" style={{ fontSize: 12, marginLeft: 8 }}>{stats.rejectedCount}笔已驳回</Text>
                  )}
                </div>
              </Col>
            </Row>

            {stats.payableTotal > stats.receivableTotal && (
              <Alert
                message="利润预警"
                description={`当前应付总额超过应收总额，预估亏损 ¥${(stats.payableTotal - stats.receivableTotal).toFixed(2)}，请关注`}
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                style={{ marginBottom: 16 }}
              />
            )}

            {isSettled && (
              <Alert
                message="已结算"
                description={`该任务已于 ${data.settledAt || '-'} 由 ${data.settledBy || '-'} 确认结算`}
                type="success"
                showIcon
                icon={<LockOutlined />}
                style={{ marginBottom: 16 }}
              />
            )}

            <Divider style={{ margin: '12px 0' }} />

            <Descriptions column={3} size="small" title="任务信息">
              <Descriptions.Item label="任务号"><Text strong>{data.jobNo}</Text></Descriptions.Item>
              <Descriptions.Item label="航线">{data.route}</Descriptions.Item>
              <Descriptions.Item label="船名/航班">{data.vessel}</Descriptions.Item>
              <Descriptions.Item label="运输方式"><Tag>{data.transportType === 'SEA' ? '海运' : '空运'}</Tag></Descriptions.Item>
              <Descriptions.Item label="运输单元">{data.shippingUnits.length} 个</Descriptions.Item>
              <Descriptions.Item label="费用总笔数">{data.fees.length} 笔</Descriptions.Item>
              {data.etd && <Descriptions.Item label="ETD">{data.etd}</Descriptions.Item>}
              {data.eta && <Descriptions.Item label="ETA">{data.eta}</Descriptions.Item>}
              <Descriptions.Item label="结算状态">
                {isSettled
                  ? <Tag color="success" icon={<LockOutlined />}>已结算</Tag>
                  : <Tag color="warning">未结算</Tag>
                }
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '12px 0' }} />

            {/* 按层级汇总 */}
            <Row gutter={16}>
              {(['JOB', 'UNIT', 'ORDER'] as FeeLevel[]).map(level => {
                const levelFees = data.fees.filter(f => f.feeLevel === level);
                const payable = levelFees.filter(f => f.feeDirection === 'PAYABLE').reduce((s, f) => s + toCNY(f), 0);
                const receivable = levelFees.filter(f => f.feeDirection === 'RECEIVABLE').reduce((s, f) => s + toCNY(f), 0);
                const approved = levelFees.filter(f => f.status === 'APPROVED' || f.status === 'PAID').length;
                return (
                  <Col span={8} key={level}>
                    <Card size="small" style={{ background: '#fafafa' }}>
                      <div style={{ marginBottom: 8 }}>
                        <Tag color={FEE_LEVEL_CONFIG[level].color}>{FEE_LEVEL_CONFIG[level].label}</Tag>
                        <Text type="secondary">（{levelFees.length}笔，已审批{approved}笔）</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div><Text type="secondary">应付: </Text><Text style={{ color: '#cf1322' }}>¥{payable.toFixed(2)}</Text></div>
                        <div><Text type="secondary">应收: </Text><Text style={{ color: '#3f8600' }}>¥{receivable.toFixed(2)}</Text></div>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </Card>

          {/* === 任务级费用 === */}
          <Card
            id="cost-job-fees"
            title={
              <Space>
                <Tag color="blue">任务级费用</Tag>
                <Text type="secondary">{jobFees.length} 笔</Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {jobFees.length > 0 ? renderFeeTable(jobFees) : (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>暂无任务级费用</div>
            )}
          </Card>

          {/* === 各运输单元 === */}
          {data.shippingUnits.map(unit => {
            const unitFees = getUnitFees(unit.unitNo);
            const allUnitOrderFees = unit.orders.flatMap(o => getOrderFees(o.subOrderNo));
            const totalFeesInUnit = [...unitFees, ...allUnitOrderFees];

            return (
              <Card
                key={unit.unitNo}
                id={`cost-unit-${unit.unitNo}`}
                title={
                  <Space>
                    <ContainerOutlined />
                    <Text strong>{unit.unitNo}</Text>
                    <Tag>{unit.unitType}</Tag>
                    <Text type="secondary">{unit.orders.length}票 · {totalFeesInUnit.length}笔费用</Text>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                {/* 运输单元级费用 */}
                {unitFees.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Tag color="purple">运输单元级费用</Tag>
                      <Text type="secondary">{unitFees.length} 笔</Text>
                    </div>
                    {renderFeeTable(unitFees)}
                  </div>
                )}

                {/* 各订单费用 */}
                {unit.orders.map(order => {
                  const oFees = getOrderFees(order.subOrderNo);
                  if (oFees.length === 0) return null;
                  return (
                    <div key={order.subOrderNo} style={{ marginBottom: 16 }}>
                      <div style={{
                        marginBottom: 8, padding: '8px 12px',
                        background: '#f6ffed', borderLeft: '3px solid #52c41a', borderRadius: '0 4px 4px 0'
                      }}>
                        <Space>
                          <Tag color="green">订单级</Tag>
                          <Text strong>{order.subOrderNo}</Text>
                          <Divider type="vertical" />
                          <Text type="secondary">{order.customerName}</Text>
                          <Text type="secondary">{order.pieces}件 / {order.weight}kg</Text>
                          {order.goodsDescription && <Text type="secondary">· {order.goodsDescription}</Text>}
                        </Space>
                      </div>
                      {renderFeeTable(oFees)}
                    </div>
                  );
                })}

                {totalFeesInUnit.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>该运输单元暂无费用</div>
                )}
              </Card>
            );
          })}

          {/* === 操作记录 === */}
          <Card id="cost-logs" title={<span><HistoryOutlined /> 操作记录</span>}>
            {data.auditLogs && data.auditLogs.length > 0 ? (
              <Timeline>
                {data.auditLogs.map((log, index) => (
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

      {/* 结算确认 Modal */}
      <Modal
        title="结算确认"
        open={settleConfirmVisible}
        onCancel={() => setSettleConfirmVisible(false)}
        onOk={handleSettleConfirm}
        okText="确认结算"
        destroyOnClose
      >
        <div style={{ padding: '16px 0' }}>
          <Alert
            message="结算确认后，该任务的财务数据将被锁定"
            description="请确认所有费用已审批完毕且数据准确，结算后不可撤销。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="任务号">{data.jobNo}</Descriptions.Item>
            <Descriptions.Item label="应收合计">
              <Text style={{ color: '#3f8600' }}>¥{stats.receivableTotal.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="应付合计">
              <Text style={{ color: '#cf1322' }}>¥{stats.payableTotal.toFixed(2)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="利润">
              <Text strong style={{ color: stats.profit >= 0 ? '#3f8600' : '#cf1322' }}>
                ¥{stats.profit.toFixed(2)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="费用笔数">{stats.totalCount} 笔（全部已审批）</Descriptions.Item>
          </Descriptions>
        </div>
      </Modal>
    </Drawer>
  );
};
