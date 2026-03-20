import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Alert, Segmented, Space, Typography
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, TrophyOutlined, WarningOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

// ==================== 类型 ====================

type PeriodKey = 'month' | 'quarter' | 'year';

interface PeriodStats {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  orders: number;
  tasks: number;
  activeClients: number;
  receivable: number;
  overdueReceivable: number;
  revenueYoY: number;
  costYoY: number;
  profitYoY: number;
}

interface SalespersonRank {
  key: string;
  rank: number;
  name: string;
  revenue: number;
  profit: number;
  profitRate: number;
  orders: number;
  clients: number;
}

interface RouteRank {
  key: string;
  rank: number;
  route: string;
  revenue: number;
  profit: number;
  profitRate: number;
  tasks: number;
  transportType: 'SEA' | 'AIR';
}

// ==================== 数据配置 ====================

const PERIOD_LABEL_MAP: Record<string, PeriodKey> = {
  '本月': 'month',
  '本季度': 'quarter',
  '本年': 'year',
};

const EMPTY_STATS: PeriodStats = {
  revenue: 0,
  cost: 0,
  profit: 0,
  margin: 0,
  orders: 0,
  tasks: 0,
  activeClients: 0,
  receivable: 0,
  overdueReceivable: 0,
  revenueYoY: 0,
  costYoY: 0,
  profitYoY: 0,
};

// ==================== 工具函数 ====================

const formatMoney = (val: number): string =>
  `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const getProfitRateColor = (rate: number): string => {
  if (rate >= 20) return '#52c41a';
  if (rate >= 10) return '#faad14';
  return '#ff4d4f';
};

// ==================== 组件 ====================

export const ExecutiveDashboard: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [periodLabel, setPeriodLabel] = useState<string>('本月');

  const periodKey = useMemo<PeriodKey>(
    () => PERIOD_LABEL_MAP[periodLabel] || 'month',
    [periodLabel]
  );

  const stats = useMemo(() => EMPTY_STATS, [periodKey]);
  const salespersonData = useMemo<SalespersonRank[]>(() => [], [periodKey]);
  const routeData = useMemo<RouteRank[]>(() => [], [periodKey]);
  const risks = useMemo<string[]>(() => [], [periodKey]);

  // ==================== 表格列定义 ====================

  const salespersonColumns: ColumnsType<SalespersonRank> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      align: 'center',
      render: (rank: number) => {
        if (rank <= 3) {
          const colors = ['#faad14', '#bfbfbf', '#d48806'];
          return <TrophyOutlined style={{ color: colors[rank - 1], fontSize: 16 }} />;
        }
        return <Text type="secondary">{rank}</Text>;
      },
    },
    {
      title: '业务员',
      dataIndex: 'name',
      key: 'name',
      width: 80,
    },
    {
      title: '营收',
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right',
      render: (val: number) => formatMoney(val),
    },
    {
      title: '毛利',
      dataIndex: 'profit',
      key: 'profit',
      align: 'right',
      render: (val: number) => (
        <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {formatMoney(val)}
        </span>
      ),
    },
    {
      title: '毛利率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      width: 90,
      align: 'right',
      render: (val: number) => (
        <span style={{ color: getProfitRateColor(val), fontWeight: 600 }}>
          {val.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '订单数',
      dataIndex: 'orders',
      key: 'orders',
      width: 80,
      align: 'right',
    },
    {
      title: '客户数',
      dataIndex: 'clients',
      key: 'clients',
      width: 80,
      align: 'right',
    },
  ];

  const routeColumns: ColumnsType<RouteRank> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      align: 'center',
      render: (rank: number) => {
        if (rank <= 3) {
          const colors = ['#faad14', '#bfbfbf', '#d48806'];
          return <TrophyOutlined style={{ color: colors[rank - 1], fontSize: 16 }} />;
        }
        return <Text type="secondary">{rank}</Text>;
      },
    },
    {
      title: '路线',
      dataIndex: 'route',
      key: 'route',
      width: 110,
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: '营收',
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right',
      render: (val: number) => formatMoney(val),
    },
    {
      title: '毛利',
      dataIndex: 'profit',
      key: 'profit',
      align: 'right',
      render: (val: number) => (
        <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {formatMoney(val)}
        </span>
      ),
    },
    {
      title: '毛利率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      width: 90,
      align: 'right',
      render: (val: number) => (
        <span style={{ color: getProfitRateColor(val), fontWeight: 600 }}>
          {val.toFixed(2)}%
        </span>
      ),
    },
    {
      title: '任务数',
      dataIndex: 'tasks',
      key: 'tasks',
      width: 80,
      align: 'right',
    },
    {
      title: '运输方式',
      dataIndex: 'transportType',
      key: 'transportType',
      width: 90,
      align: 'center',
      render: (val: 'SEA' | 'AIR') => (
        <Tag color={val === 'SEA' ? 'blue' : 'cyan'}>
          {val === 'SEA' ? '海运' : '空运'}
        </Tag>
      ),
    },
  ];

  // ==================== 渲染 ====================

  return (
    <div style={{ padding: '0 2px' }}>
      {/* 时间切换 */}
      <div style={{ marginBottom: 20 }}>
        <Space size="middle" align="center">
          <Segmented
            options={['本月', '本季度', '本年']}
            value={periodLabel}
            onChange={(val) => setPeriodLabel(val as string)}
            size="large"
          />
        </Space>
      </div>

      {/* Row 1: 营收指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="本期营收"
              value={stats.revenue}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                同比{' '}
                <span style={{ color: stats.revenueYoY >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  {stats.revenueYoY >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {' '}{Math.abs(stats.revenueYoY)}%
                </span>
              </Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="本期成本"
              value={stats.cost}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f', fontSize: 22 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                同比{' '}
                <span style={{ color: stats.costYoY >= 0 ? '#ff4d4f' : '#52c41a' }}>
                  {stats.costYoY >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {' '}{Math.abs(stats.costYoY)}%
                </span>
              </Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="本期毛利"
              value={stats.profit}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a', fontSize: 22 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                同比{' '}
                <span style={{ color: stats.profitYoY >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  {stats.profitYoY >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {' '}{Math.abs(stats.profitYoY)}%
                </span>
              </Text>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="毛利率"
              value={stats.margin}
              precision={1}
              suffix="%"
              valueStyle={{ color: getProfitRateColor(stats.margin), fontSize: 22 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                目标 25%{'  '}
                <span style={{ color: stats.margin >= 25 ? '#52c41a' : '#faad14' }}>
                  {stats.margin >= 25 ? '已达标' : '未达标'}
                </span>
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Row 2: 运营指标 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="订单量"
              value={stats.orders}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
              suffix="单"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="任务完成量"
              value={stats.tasks}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="活跃客户数"
              value={stats.activeClients}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
              suffix="家"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="应收余额"
              value={stats.receivable}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                其中逾期{' '}
                <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
                  {formatMoney(stats.overdueReceivable)}
                </span>
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 排名表格 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#faad14' }} />
                <span>业务员业绩排名</span>
              </Space>
            }
            size="small"
          >
            <Table<SalespersonRank>
              columns={salespersonColumns}
              dataSource={salespersonData}
              pagination={false}
              size="middle"
              rowKey="key"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#faad14' }} />
                <span>路线业绩排名</span>
              </Space>
            }
            size="small"
          >
            <Table<RouteRank>
              columns={routeColumns}
              dataSource={routeData}
              pagination={false}
              size="middle"
              rowKey="key"
            />
          </Card>
        </Col>
      </Row>

      {/* 风险提示 */}
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        message="经营风险提示"
        description={
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            {risks.map((item, idx) => (
              <li key={idx} style={{ marginBottom: idx < risks.length - 1 ? 6 : 0, lineHeight: 1.6 }}>
                {item}
              </li>
            ))}
          </ul>
        }
        style={{ marginBottom: 16 }}
      />
    </div>
  );
};
