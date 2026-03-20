import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Row, Col,
  Statistic, Select, Input, message, Typography
} from 'antd';
import {
  DollarOutlined, CheckCircleOutlined, LockOutlined,
  ReloadOutlined, FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { JobCostAuditDetail } from './JobCostAuditDetail';
import type { AuditJobRecord, AuditFeeItem } from './JobCostAuditDetail';

const { Text } = Typography;
const { Option } = Select;


// ==================== 辅助 ====================

const JOB_STATUS_CONFIG: Record<string, { text: string; color: string }> = {
  DEPARTED: { text: '已发运', color: 'blue' },
  IN_TRANSIT: { text: '运输中', color: 'processing' },
  ARRIVED: { text: '已到港', color: 'orange' },
  CLEARED: { text: '已清关', color: 'cyan' },
  CLOSED: { text: '已关账', color: 'green' }
};

const toCNY = (f: AuditFeeItem) => f.amountCNY || f.amount;

/** 计算单个任务的汇总数据 */
const getJobSummary = (job: AuditJobRecord) => {
  const { fees } = job;
  const receivable = fees.filter(f => f.feeDirection === 'RECEIVABLE' && f.status !== 'CANCELLED').reduce((s, f) => s + toCNY(f), 0);
  const payable = fees.filter(f => f.feeDirection === 'PAYABLE' && f.status !== 'CANCELLED').reduce((s, f) => s + toCNY(f), 0);
  const pendingCount = fees.filter(f => f.status === 'PENDING').length;
  const approvedCount = fees.filter(f => f.status === 'APPROVED' || f.status === 'PAID').length;
  const totalCount = fees.filter(f => f.status !== 'CANCELLED').length;
  const profit = receivable - payable;
  const profitRate = receivable > 0 ? (profit / receivable * 100) : 0;
  return { receivable, payable, pendingCount, approvedCount, totalCount, profit, profitRate, totalFees: fees.length };
};

// ==================== 组件 ====================

export const JobCostAudit: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [jobs, setJobs] = useState<AuditJobRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // 筛选
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterTransport, setFilterTransport] = useState<string>('ALL');
  const [filterSettlement, setFilterSettlement] = useState<string>('ALL');

  // 详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentJob, setCurrentJob] = useState<AuditJobRecord | null>(null);

  // --- 全局统计 ---
  const globalStats = useMemo(() => {
    let totalFees = 0;
    let totalApproved = 0;
    let totalProfit = 0;
    let settledCount = 0;

    jobs.forEach(job => {
      const s = getJobSummary(job);
      totalFees += s.totalFees;
      totalApproved += s.approvedCount;
      totalProfit += s.profit;
      if (job.settlementStatus === 'SETTLED') settledCount++;
    });

    return { totalFees, totalApproved, totalProfit, settledCount, jobCount: jobs.length };
  }, [jobs]);

  // --- 筛选 ---
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    if (searchText) {
      const keyword = searchText.toLowerCase();
      result = result.filter(j =>
        j.jobNo.toLowerCase().includes(keyword) ||
        j.route.toLowerCase().includes(keyword) ||
        j.vessel.toLowerCase().includes(keyword)
      );
    }
    if (filterStatus !== 'ALL') result = result.filter(j => j.status === filterStatus);
    if (filterTransport !== 'ALL') result = result.filter(j => j.transportType === filterTransport);
    if (filterSettlement !== 'ALL') {
      result = result.filter(j => (j.settlementStatus || 'UNSETTLED') === filterSettlement);
    }

    return result;
  }, [jobs, searchText, filterStatus, filterTransport, filterSettlement]);

  const handleReset = () => {
    setSearchText('');
    setFilterStatus('ALL');
    setFilterTransport('ALL');
    setFilterSettlement('ALL');
  };

  // --- 打开详情 ---
  const handleOpenDetail = (job: AuditJobRecord) => {
    setCurrentJob(job);
    setDetailVisible(true);
  };

  // --- 结算确认回调 ---
  const handleSettle = (jobNo: string) => {
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    setJobs(prev => prev.map(j =>
      j.jobNo === jobNo
        ? { ...j, settlementStatus: 'SETTLED' as const, settledAt: now, settledBy: '当前用户' }
        : j
    ));
    // 同步更新 currentJob
    setCurrentJob(prev => {
      if (prev && prev.jobNo === jobNo) {
        return { ...prev, settlementStatus: 'SETTLED' as const, settledAt: now, settledBy: '当前用户' };
      }
      return prev;
    });
  };

  // --- 列定义 ---
  const columns = [
    {
      title: '任务号',
      dataIndex: 'jobNo',
      width: 180,
      render: (text: string, record: AuditJobRecord) => (
        <a onClick={() => handleOpenDetail(record)}>{text}</a>
      )
    },
    {
      title: '航线',
      dataIndex: 'route',
      width: 110
    },
    {
      title: '船名/航班',
      dataIndex: 'vessel',
      width: 130,
      ellipsis: true
    },
    {
      title: '方式',
      dataIndex: 'transportType',
      width: 60,
      render: (val: string) => <Tag>{val === 'SEA' ? '海运' : '空运'}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (val: string) => {
        const cfg = JOB_STATUS_CONFIG[val] || { text: val, color: 'default' };
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      }
    },
    {
      title: '审批进度',
      key: 'progress',
      width: 120,
      render: (_: unknown, record: AuditJobRecord) => {
        const s = getJobSummary(record);
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 13 }}>{s.approvedCount}/{s.totalCount} 笔</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {s.pendingCount > 0 ? `${s.pendingCount}笔待审批` : '全部通过'}
            </Text>
          </Space>
        );
      }
    },
    {
      title: '应收(¥)',
      key: 'receivable',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, record: AuditJobRecord) => {
        const s = getJobSummary(record);
        return <Text style={{ color: '#3f8600' }}>¥{s.receivable.toLocaleString()}</Text>;
      }
    },
    {
      title: '应付(¥)',
      key: 'payable',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, record: AuditJobRecord) => {
        const s = getJobSummary(record);
        return <Text style={{ color: '#cf1322' }}>¥{s.payable.toLocaleString()}</Text>;
      }
    },
    {
      title: '预估利润',
      key: 'profit',
      width: 130,
      render: (_: unknown, record: AuditJobRecord) => {
        const s = getJobSummary(record);
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={{ color: s.profit >= 0 ? '#3f8600' : '#cf1322' }}>
              ¥{s.profit.toLocaleString()}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {s.profitRate.toFixed(1)}%
            </Text>
          </Space>
        );
      }
    },
    {
      title: '结算',
      key: 'settlement',
      width: 80,
      render: (_: unknown, record: AuditJobRecord) => {
        if (record.settlementStatus === 'SETTLED') {
          return <Tag color="success" icon={<LockOutlined />}>已结算</Tag>;
        }
        return <Tag color="warning">未结算</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: AuditJobRecord) => (
        <Button type="link" icon={<FileTextOutlined />} onClick={() => handleOpenDetail(record)}>
          成本明细
        </Button>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="任务总数"
              value={globalStats.jobCount}
              suffix="个"
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="费用笔数（已审批/总数）"
              value={globalStats.totalApproved}
              suffix={`/ ${globalStats.totalFees} 笔`}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已结算任务"
              value={globalStats.settledCount}
              suffix={`/ ${globalStats.jobCount} 个`}
              valueStyle={{ color: '#1890ff' }}
              prefix={<LockOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="利润合计(¥)"
              value={globalStats.totalProfit}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: globalStats.totalProfit >= 0 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col span={6}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>关键词</div>
            <Input
              placeholder="任务号/航线/船名航班"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>任务状态</div>
            <Select value={filterStatus} onChange={setFilterStatus} style={{ width: '100%' }}>
              <Option value="ALL">全部状态</Option>
              {Object.entries(JOB_STATUS_CONFIG).map(([key, cfg]) => (
                <Option key={key} value={key}>{cfg.text}</Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>运输方式</div>
            <Select value={filterTransport} onChange={setFilterTransport} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              <Option value="SEA">海运</Option>
              <Option value="AIR">空运</Option>
            </Select>
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>结算状态</div>
            <Select value={filterSettlement} onChange={setFilterSettlement} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              <Option value="UNSETTLED">未结算</Option>
              <Option value="SETTLED">已结算</Option>
            </Select>
          </Col>
          <Col span={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          rowKey="jobNo"
          columns={columns}
          dataSource={filteredJobs}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 个任务` }}
        />
      </Card>

      {/* 详情 Drawer */}
      <JobCostAuditDetail
        visible={detailVisible}
        data={currentJob}
        onClose={() => setDetailVisible(false)}
        onSettle={handleSettle}
      />
    </div>
  );
};
