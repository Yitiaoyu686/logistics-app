import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Tag,
  Button, Segmented, Typography,
} from 'antd';
import {
  ReloadOutlined, NodeIndexOutlined, RiseOutlined, FallOutlined,
  EnvironmentOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// ==================== 类型定义 ====================

interface RouteTask {
  id: string;
  jobNo: string;
  vesselOrFlight: string;
  revenue: number;
  cost: number;
  profit: number;
  profitRate: number;
  completedDate: string | null;
  status: '已完成' | '运输中' | '待发运';
}

interface RouteRecord {
  id: string;
  routeName: string;
  origin: string;
  destination: string;
  transportMode: '海运' | '空运';
  taskCount: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
  profitRate: number;
  avgTransitDays: number;
  onTimeRate: number;
  tasks: RouteTask[];
}

// ==================== 工具函数 ====================

const formatMoney = (val: number): string => {
  return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getProfitRateColor = (rate: number): string => {
  if (rate >= 20) return '#52c41a';
  if (rate >= 10) return '#faad14';
  return '#ff4d4f';
};

const getStatusColor = (status: string): string => {
  if (status === '已完成') return 'green';
  if (status === '运输中') return 'blue';
  return 'orange';
};

// ==================== 数据 ====================

const routeData: RouteRecord[] = [];

// ==================== 组件 ====================

export const RouteProfitAnalysis: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [transportFilter, setTransportFilter] = useState<string>('全部');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [originFilter, setOriginFilter] = useState<string>('ALL');
  const [destinationFilter, setDestinationFilter] = useState<string>('ALL');
  const [profitRangeFilter, setProfitRangeFilter] = useState<string>('ALL');

  // 过滤后的数据
  const filteredRoutes = useMemo(() => {
    return routeData.filter((route) => {
      // 运输方式
      if (transportFilter !== '全部' && route.transportMode !== transportFilter) {
        return false;
      }
      // 起运地
      if (originFilter !== 'ALL' && route.origin !== originFilter) {
        return false;
      }
      // 目的地
      if (destinationFilter !== 'ALL' && route.destination !== destinationFilter) {
        return false;
      }
      // 利润区间
      if (profitRangeFilter !== 'ALL') {
        const rate = route.profitRate;
        if (profitRangeFilter === 'LOSS' && rate >= 0) return false;
        if (profitRangeFilter === '0-10' && (rate < 0 || rate >= 10)) return false;
        if (profitRangeFilter === '10-20' && (rate < 10 || rate >= 20)) return false;
        if (profitRangeFilter === '20+' && rate < 20) return false;
      }
      // 日期范围 - 过滤包含指定日期范围内完成任务的线路
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dateRange[0].startOf('day');
        const end = dateRange[1].endOf('day');
        const hasMatchingTask = route.tasks.some((task) => {
          if (!task.completedDate) return false;
          const d = dayjs(task.completedDate);
          return d.isAfter(start) || d.isSame(start, 'day')
            ? d.isBefore(end) || d.isSame(end, 'day')
            : false;
        });
        if (!hasMatchingTask) return false;
      }
      return true;
    });
  }, [transportFilter, originFilter, destinationFilter, profitRangeFilter, dateRange]);

  // 统计汇总 - 基于过滤后数据
  const summary = useMemo(() => {
    const totalRoutes = filteredRoutes.length;
    const totalRevenue = filteredRoutes.reduce((s, r) => s + r.totalRevenue, 0);
    const totalCost = filteredRoutes.reduce((s, r) => s + r.totalCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgProfitRate = totalRevenue > 0
      ? ((totalProfit / totalRevenue) * 100)
      : 0;
    const totalTasks = filteredRoutes.reduce((s, r) => s + r.taskCount, 0);
    const avgTransitDays = filteredRoutes.length > 0
      ? filteredRoutes.reduce((s, r) => s + r.avgTransitDays * r.taskCount, 0) / totalTasks
      : 0;
    const avgOnTimeRate = filteredRoutes.length > 0
      ? filteredRoutes.reduce((s, r) => s + r.onTimeRate * r.taskCount, 0) / totalTasks
      : 0;

    // 最佳线路
    let bestRoute = filteredRoutes[0];
    filteredRoutes.forEach((r) => {
      if (r.profitRate > (bestRoute?.profitRate ?? 0)) {
        bestRoute = r;
      }
    });

    // 亏损线路数
    const lossCount = filteredRoutes.filter((r) => r.profit < 0).length;

    return {
      totalRoutes,
      totalRevenue,
      totalProfit,
      avgProfitRate,
      bestRoute,
      lossCount,
      totalTasks,
      totalCost,
      avgTransitDays,
      avgOnTimeRate,
    };
  }, [filteredRoutes]);

  // 重置筛选
  const handleReset = () => {
    setDateRange(null);
    setOriginFilter('ALL');
    setDestinationFilter('ALL');
    setProfitRangeFilter('ALL');
  };

  // 嵌套任务表格
  const expandedRowRender = (route: RouteRecord) => {
    const taskColumns: ColumnsType<RouteTask> = [
      {
        title: '任务号',
        dataIndex: 'jobNo',
        key: 'jobNo',
        width: 180,
        render: (val: string) => (
          <Text strong style={{ color: '#1677ff' }}>{val}</Text>
        ),
      },
      {
        title: '船名/航班',
        dataIndex: 'vesselOrFlight',
        key: 'vesselOrFlight',
        width: 150,
      },
      {
        title: '营收',
        dataIndex: 'revenue',
        key: 'revenue',
        width: 130,
        align: 'right' as const,
        render: (val: number) => formatMoney(val),
      },
      {
        title: '成本',
        dataIndex: 'cost',
        key: 'cost',
        width: 130,
        align: 'right' as const,
        render: (val: number) => formatMoney(val),
      },
      {
        title: '毛利',
        dataIndex: 'profit',
        key: 'profit',
        width: 130,
        align: 'right' as const,
        render: (val: number) => (
          <Text style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
            {formatMoney(val)}
          </Text>
        ),
      },
      {
        title: '毛利率',
        dataIndex: 'profitRate',
        key: 'profitRate',
        width: 100,
        align: 'center' as const,
        render: (val: number) => (
          <Text style={{ color: getProfitRateColor(val), fontWeight: 500 }}>
            {val.toFixed(1)}%
          </Text>
        ),
      },
      {
        title: '完成日期',
        dataIndex: 'completedDate',
        key: 'completedDate',
        width: 120,
        render: (val: string | null) => val ? dayjs(val).format('YYYY-MM-DD') : '-',
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 100,
        align: 'center' as const,
        render: (val: string) => (
          <Tag color={getStatusColor(val)}>{val}</Tag>
        ),
      },
    ];

    return (
      <Table<RouteTask>
        columns={taskColumns}
        dataSource={route.tasks}
        rowKey="id"
        pagination={false}
        size="small"
        style={{ margin: '0 0 0 16px' }}
      />
    );
  };

  // 主表格列
  const mainColumns: ColumnsType<RouteRecord> = [
    {
      title: '线路',
      dataIndex: 'routeName',
      key: 'routeName',
      width: 140,
      fixed: 'left' as const,
      render: (name: string) => (
        <Text strong style={{ fontSize: 14 }}>
          <EnvironmentOutlined style={{ marginRight: 6, color: '#1677ff' }} />
          {name}
        </Text>
      ),
    },
    {
      title: '运输方式',
      dataIndex: 'transportMode',
      key: 'transportMode',
      width: 100,
      align: 'center' as const,
      render: (val: string) => (
        <Tag color={val === '海运' ? 'blue' : 'cyan'}>{val}</Tag>
      ),
    },
    {
      title: '任务数',
      dataIndex: 'taskCount',
      key: 'taskCount',
      width: 90,
      align: 'center' as const,
      sorter: (a: RouteRecord, b: RouteRecord) => a.taskCount - b.taskCount,
    },
    {
      title: '总营收',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      width: 150,
      align: 'right' as const,
      sorter: (a: RouteRecord, b: RouteRecord) => a.totalRevenue - b.totalRevenue,
      render: (val: number) => (
        <Text style={{ fontWeight: 500 }}>{formatMoney(val)}</Text>
      ),
    },
    {
      title: '总成本',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 150,
      align: 'right' as const,
      sorter: (a: RouteRecord, b: RouteRecord) => a.totalCost - b.totalCost,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '毛利',
      dataIndex: 'profit',
      key: 'profit',
      width: 150,
      align: 'right' as const,
      sorter: (a: RouteRecord, b: RouteRecord) => a.profit - b.profit,
      render: (val: number) => (
        <Text style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {formatMoney(val)}
        </Text>
      ),
    },
    {
      title: '毛利率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      width: 100,
      align: 'center' as const,
      sorter: (a: RouteRecord, b: RouteRecord) => a.profitRate - b.profitRate,
      render: (val: number) => (
        <Text style={{ color: getProfitRateColor(val), fontWeight: 600 }}>
          {val.toFixed(1)}%
        </Text>
      ),
    },
    {
      title: '平均时效(天)',
      dataIndex: 'avgTransitDays',
      key: 'avgTransitDays',
      width: 120,
      align: 'center' as const,
      sorter: (a: RouteRecord, b: RouteRecord) => a.avgTransitDays - b.avgTransitDays,
      render: (val: number) => (
        <Text>{val}</Text>
      ),
    },
    {
      title: '准时率(%)',
      dataIndex: 'onTimeRate',
      key: 'onTimeRate',
      width: 110,
      align: 'center' as const,
      sorter: (a: RouteRecord, b: RouteRecord) => a.onTimeRate - b.onTimeRate,
      render: (val: number) => {
        let color = '#52c41a';
        if (val < 85) color = '#ff4d4f';
        else if (val < 90) color = '#faad14';
        return (
          <Text style={{ color, fontWeight: 500 }}>
            {val.toFixed(1)}%
          </Text>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #1890ff',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>线路总数</Text>}
              value={summary.totalRoutes}
              valueStyle={{ color: '#1890ff', fontSize: 20, fontWeight: 600 }}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>条</Text>}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              活跃运营线路
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #1677ff',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>总营收</Text>}
              value={summary.totalRevenue}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1677ff', fontSize: 20, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              所有线路营收合计
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #52c41a',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>总毛利</Text>}
              value={summary.totalProfit}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a', fontSize: 20, fontWeight: 600 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              营收减去成本
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: `3px solid ${getProfitRateColor(summary.avgProfitRate)}`,
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>平均毛利率</Text>}
              value={summary.avgProfitRate}
              precision={1}
              suffix="%"
              valueStyle={{
                color: getProfitRateColor(summary.avgProfitRate),
                fontSize: 20,
                fontWeight: 600,
              }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              加权平均
            </Text>
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: '3px solid #52c41a',
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>最佳线路</Text>}
              value={summary.bestRoute ? `${summary.bestRoute.routeName}` : '-'}
              valueStyle={{ color: '#52c41a', fontSize: 18, fontWeight: 600 }}
            />
            <Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 500 }}>
              {summary.bestRoute
                ? `${summary.bestRoute.profitRate.toFixed(1)}%`
                : '-'}
            </Text>
            <RiseOutlined style={{ marginLeft: 4, color: '#52c41a', fontSize: 12 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card
            size="small"
            style={{
              borderTop: `3px solid ${summary.lossCount > 0 ? '#ff4d4f' : '#52c41a'}`,
              borderRadius: 8,
            }}
          >
            <Statistic
              title={<Text style={{ fontSize: 13 }}>亏损线路数</Text>}
              value={summary.lossCount}
              valueStyle={{
                color: summary.lossCount > 0 ? '#ff4d4f' : '#52c41a',
                fontSize: 20,
                fontWeight: 600,
              }}
              prefix={summary.lossCount > 0
                ? <FallOutlined style={{ fontSize: 16 }} />
                : undefined}
              suffix={<Text type="secondary" style={{ fontSize: 14 }}>条</Text>}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {summary.lossCount > 0 ? '需关注优化' : '全部盈利'}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* 运输方式切换 */}
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={['全部', '海运', '空运']}
          value={transportFilter}
          onChange={(val) => setTransportFilter(val as string)}
          size="large"
        />
      </div>

      {/* 筛选栏 */}
      <Card
        size="small"
        style={{ marginBottom: 16, borderRadius: 8 }}
      >
        <Space size="middle" wrap>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: 13 }}>时间范围:</Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              style={{ width: 240 }}
              placeholder={['开始日期', '结束日期']}
            />
          </Space>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: 13 }}>起运地:</Text>
            <Select
              value={originFilter}
              onChange={(val) => setOriginFilter(val)}
              style={{ width: 120 }}
            >
              <Option value="ALL">全部</Option>
              <Option value="SZX">SZX</Option>
              <Option value="PVG">PVG</Option>
              <Option value="GZ">GZ</Option>
            </Select>
          </Space>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: 13 }}>目的地:</Text>
            <Select
              value={destinationFilter}
              onChange={(val) => setDestinationFilter(val)}
              style={{ width: 120 }}
            >
              <Option value="ALL">全部</Option>
              <Option value="LAX">LAX</Option>
              <Option value="LHR">LHR</Option>
              <Option value="Lagos">Lagos</Option>
              <Option value="Accra">Accra</Option>
              <Option value="JFK">JFK</Option>
              <Option value="FRA">FRA</Option>
            </Select>
          </Space>
          <Space size="small">
            <Text type="secondary" style={{ fontSize: 13 }}>利润区间:</Text>
            <Select
              value={profitRangeFilter}
              onChange={(val) => setProfitRangeFilter(val)}
              style={{ width: 130 }}
            >
              <Option value="ALL">全部</Option>
              <Option value="LOSS">亏损(&lt;0%)</Option>
              <Option value="0-10">0-10%</Option>
              <Option value="10-20">10-20%</Option>
              <Option value="20+">20%+</Option>
            </Select>
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 主数据表格 */}
      <Card
        size="small"
        style={{ borderRadius: 8 }}
        title={
          <Space>
            <NodeIndexOutlined />
            <span>线路盈利分析</span>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
              （共 {filteredRoutes.length} 条线路，{summary.totalTasks} 个任务）
            </Text>
          </Space>
        }
        extra={
          <Space>
            <DollarOutlined style={{ color: '#52c41a' }} />
            <Text style={{ fontSize: 13, color: '#52c41a', fontWeight: 500 }}>
              总毛利 {formatMoney(summary.totalProfit)}
            </Text>
          </Space>
        }
      >
        <Table<RouteRecord>
          columns={mainColumns}
          dataSource={filteredRoutes}
          rowKey="id"
          expandable={{
            expandedRowRender,
            rowExpandable: (record) => record.tasks.length > 0,
          }}
          scroll={{ x: 1200 }}
          pagination={false}
          size="middle"
          summary={() => {
            if (filteredRoutes.length === 0) return null;

            const totals = filteredRoutes.reduce(
              (acc, r) => ({
                taskCount: acc.taskCount + r.taskCount,
                totalRevenue: acc.totalRevenue + r.totalRevenue,
                totalCost: acc.totalCost + r.totalCost,
                profit: acc.profit + r.profit,
                weightedDays: acc.weightedDays + r.avgTransitDays * r.taskCount,
                weightedOnTime: acc.weightedOnTime + r.onTimeRate * r.taskCount,
              }),
              {
                taskCount: 0,
                totalRevenue: 0,
                totalCost: 0,
                profit: 0,
                weightedDays: 0,
                weightedOnTime: 0,
              }
            );

            const avgRate = totals.totalRevenue > 0
              ? ((totals.profit / totals.totalRevenue) * 100)
              : 0;
            const avgDays = totals.taskCount > 0
              ? (totals.weightedDays / totals.taskCount)
              : 0;
            const avgOnTime = totals.taskCount > 0
              ? (totals.weightedOnTime / totals.taskCount)
              : 0;

            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa' }}>
                  <Table.Summary.Cell index={0} colSpan={1}>
                    {/* expand column placeholder */}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="center">
                    <Text type="secondary">-</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="center">
                    <Text strong>{totals.taskCount}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>{formatMoney(totals.totalRevenue)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong>{formatMoney(totals.totalCost)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong style={{ color: totals.profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      {formatMoney(totals.profit)}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="center">
                    <Text strong style={{ color: getProfitRateColor(avgRate) }}>
                      {avgRate.toFixed(1)}%
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="center">
                    <Text strong>{avgDays.toFixed(1)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="center">
                    <Text strong>{avgOnTime.toFixed(1)}%</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>
    </div>
  );
};
