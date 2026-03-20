import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Segmented, Space, DatePicker, Select, Button,
} from 'antd';
import {
  ClockCircleOutlined, CheckCircleOutlined, ImportOutlined, SafetyCertificateOutlined,
  WarningOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

// ==================== 类型 ====================

type ViewMode = 'route' | 'stage' | 'carrier';

interface RouteRecord {
  key: string;
  route: string;
  transportType: '海运' | '空运';
  taskCount: number;
  avgDays: number;
  minDays: number;
  maxDays: number;
  onTimeRate: number;
  exceptions: number;
}

interface StageRecord {
  key: string;
  stage: string;
  avgDays: number;
  medianDays: number;
  maxDays: number;
  overtimeCount: number;
  overtimeRate: number;
}

interface CarrierRecord {
  key: string;
  carrier: string;
  transportType: '海运' | '空运';
  taskCount: number;
  avgDays: number;
  onTimeRate: number;
  exceptionRate: number;
  rating: number;
}

interface Filters {
  dateRange: [Dayjs, Dayjs] | null;
  transportType: string;
}

// ==================== 数据 ====================

const initialRoutes: RouteRecord[] = [];
const initialStages: StageRecord[] = [];
const initialCarriers: CarrierRecord[] = [];

// ==================== 辅助函数 ====================

const VIEW_MODE_MAP: Record<string, ViewMode> = {
  '按线路': 'route',
  '按环节': 'stage',
  '按承运人': 'carrier',
};

const renderRatingStars = (rating: number): React.ReactNode => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const roundUp = rating - fullStars >= 0.75;
  const totalFull = roundUp ? fullStars + 1 : fullStars;
  const totalEmpty = 5 - totalFull - (hasHalf && !roundUp ? 1 : 0);

  const stars: string[] = [];
  for (let i = 0; i < totalFull; i++) stars.push('\u2605');
  if (hasHalf && !roundUp) stars.push('\u2605');
  for (let i = 0; i < totalEmpty; i++) stars.push('\u2606');

  return (
    <span style={{ color: '#faad14', fontSize: 14, letterSpacing: 1 }}>
      {stars.join('')}
      <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
  );
};

const getOnTimeColor = (rate: number): string => {
  if (rate >= 90) return '#52c41a';
  if (rate >= 80) return '#faad14';
  return '#ff4d4f';
};

// ==================== 组件 ====================

export const TransitPerformance: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const { token } = theme.useToken();

  const [viewMode, setViewMode] = useState<ViewMode>('route');
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    transportType: 'all',
  });

  // ---------- 过滤后的数据 ----------

  const filteredRoutes = useMemo(() => {
    let data = [...initialRoutes];
    if (filters.transportType !== 'all') {
      data = data.filter((r) => r.transportType === filters.transportType);
    }
    return data;
  }, [filters.transportType]);

  const filteredCarriers = useMemo(() => {
    let data = [...initialCarriers];
    if (filters.transportType !== 'all') {
      data = data.filter((r) => r.transportType === filters.transportType);
    }
    return data;
  }, [filters.transportType]);

  // stages are not filtered by transport type
  const filteredStages = initialStages;

  // ---------- 统计数据 ----------

  const statsCards = useMemo(() => [
    {
      title: '平均全程时效',
      value: 0,
      suffix: '天',
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: token.colorPrimary }} />,
      valueStyle: { color: token.colorTextBase },
    },
    {
      title: '准时到达率',
      value: 0,
      suffix: '%',
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      valueStyle: { color: '#52c41a' },
    },
    {
      title: '平均入库时效',
      value: 0,
      suffix: '天',
      icon: <ImportOutlined style={{ fontSize: 24, color: token.colorPrimary }} />,
      valueStyle: { color: token.colorTextBase },
    },
    {
      title: '平均清关时效',
      value: 0,
      suffix: '天',
      icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: token.colorPrimary }} />,
      valueStyle: { color: token.colorTextBase },
    },
    {
      title: '异常任务数',
      value: 0,
      suffix: undefined,
      icon: <WarningOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
      valueStyle: { color: '#ff4d4f' },
    },
  ], [token]);

  // ---------- 线路表格列 ----------

  const routeColumns: ColumnsType<RouteRecord> = [
    {
      title: '线路',
      dataIndex: 'route',
      key: 'route',
      width: 140,
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '运输方式',
      dataIndex: 'transportType',
      key: 'transportType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === '海运' ? 'blue' : 'cyan'}>{type}</Tag>
      ),
    },
    {
      title: '任务数',
      dataIndex: 'taskCount',
      key: 'taskCount',
      width: 80,
      align: 'center',
    },
    {
      title: '平均全程(天)',
      dataIndex: 'avgDays',
      key: 'avgDays',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.avgDays - b.avgDays,
    },
    {
      title: '最短(天)',
      dataIndex: 'minDays',
      key: 'minDays',
      width: 90,
      align: 'center',
    },
    {
      title: '最长(天)',
      dataIndex: 'maxDays',
      key: 'maxDays',
      width: 90,
      align: 'center',
    },
    {
      title: '准时率(%)',
      dataIndex: 'onTimeRate',
      key: 'onTimeRate',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.onTimeRate - b.onTimeRate,
      render: (val: number) => (
        <span style={{ color: getOnTimeColor(val), fontWeight: 600 }}>
          {val.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '异常次数',
      dataIndex: 'exceptions',
      key: 'exceptions',
      width: 90,
      align: 'center',
      render: (val: number) => (
        <span style={{ color: val > 0 ? '#ff4d4f' : token.colorTextBase, fontWeight: val > 0 ? 600 : 400 }}>
          {val}
        </span>
      ),
    },
  ];

  // ---------- 环节表格列 ----------

  const stageColumns: ColumnsType<StageRecord> = [
    {
      title: '环节名称',
      dataIndex: 'stage',
      key: 'stage',
      width: 150,
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '平均用时(天)',
      dataIndex: 'avgDays',
      key: 'avgDays',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.avgDays - b.avgDays,
    },
    {
      title: '中位数(天)',
      dataIndex: 'medianDays',
      key: 'medianDays',
      width: 110,
      align: 'center',
    },
    {
      title: '最长(天)',
      dataIndex: 'maxDays',
      key: 'maxDays',
      width: 90,
      align: 'center',
    },
    {
      title: '超时次数',
      dataIndex: 'overtimeCount',
      key: 'overtimeCount',
      width: 100,
      align: 'center',
      render: (val: number) => (
        <span style={{ color: val > 0 ? '#ff4d4f' : token.colorTextBase, fontWeight: val > 0 ? 600 : 400 }}>
          {val}
        </span>
      ),
    },
    {
      title: '超时率(%)',
      dataIndex: 'overtimeRate',
      key: 'overtimeRate',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.overtimeRate - b.overtimeRate,
      render: (val: number) => (
        <span style={{ color: getOnTimeColor(100 - val), fontWeight: 600 }}>
          {val.toFixed(1)}%
        </span>
      ),
    },
  ];

  // ---------- 承运人表格列 ----------

  const carrierColumns: ColumnsType<CarrierRecord> = [
    {
      title: '承运人',
      dataIndex: 'carrier',
      key: 'carrier',
      width: 150,
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '运输方式',
      dataIndex: 'transportType',
      key: 'transportType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === '海运' ? 'blue' : 'cyan'}>{type}</Tag>
      ),
    },
    {
      title: '任务数',
      dataIndex: 'taskCount',
      key: 'taskCount',
      width: 80,
      align: 'center',
    },
    {
      title: '平均运输时效(天)',
      dataIndex: 'avgDays',
      key: 'avgDays',
      width: 140,
      align: 'center',
      sorter: (a, b) => a.avgDays - b.avgDays,
    },
    {
      title: '准时率(%)',
      dataIndex: 'onTimeRate',
      key: 'onTimeRate',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.onTimeRate - b.onTimeRate,
      render: (val: number) => (
        <span style={{ color: getOnTimeColor(val), fontWeight: 600 }}>
          {val.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '异常率(%)',
      dataIndex: 'exceptionRate',
      key: 'exceptionRate',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.exceptionRate - b.exceptionRate,
      render: (val: number) => (
        <span style={{ color: val > 10 ? '#ff4d4f' : val > 5 ? '#faad14' : '#52c41a', fontWeight: 600 }}>
          {val.toFixed(1)}%
        </span>
      ),
    },
    {
      title: '评分',
      dataIndex: 'rating',
      key: 'rating',
      width: 160,
      sorter: (a, b) => a.rating - b.rating,
      render: (val: number) => renderRatingStars(val),
    },
  ];

  // ---------- 事件处理 ----------

  const handleSegmentedChange = (label: string | number) => {
    const viewModeVal = VIEW_MODE_MAP[label as string];
    if (viewModeVal) setViewMode(viewModeVal);
  };

  const handleResetFilters = () => {
    setFilters({ dateRange: null, transportType: 'all' });
  };

  // ---------- 渲染数据表 ----------

  const renderTable = () => {
    switch (viewMode) {
      case 'route':
        return (
          <Table<RouteRecord>
            columns={routeColumns}
            dataSource={filteredRoutes}
            pagination={false}
            size="middle"
            rowKey="key"
            style={{ marginTop: 16 }}
          />
        );
      case 'stage':
        return (
          <Table<StageRecord>
            columns={stageColumns}
            dataSource={filteredStages}
            pagination={false}
            size="middle"
            rowKey="key"
            style={{ marginTop: 16 }}
          />
        );
      case 'carrier':
        return (
          <Table<CarrierRecord>
            columns={carrierColumns}
            dataSource={filteredCarriers}
            pagination={false}
            size="middle"
            rowKey="key"
            style={{ marginTop: 16 }}
          />
        );
      default:
        return null;
    }
  };

  const VIEW_MODE_LABEL_MAP: Record<ViewMode, string> = {
    route: '按线路',
    stage: '按环节',
    carrier: '按承运人',
  };

  // ---------- 渲染 ----------

  return (
    <div style={{ padding: 0 }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        {statsCards.map((card, index) => (
          <Col key={index} span={4} style={{ minWidth: 180 }}>
            <Card
              bordered={false}
              style={{
                borderRadius: token.borderRadiusLG,
                boxShadow: token.boxShadowTertiary,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: token.borderRadiusLG,
                    background: token.colorBgTextHover,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {card.icon}
                </div>
                <Statistic
                  title={card.title}
                  value={card.value}
                  suffix={card.suffix}
                  valueStyle={{ ...card.valueStyle, fontSize: 22 }}
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 视图切换 + 筛选 */}
      <Card
        bordered={false}
        style={{
          marginTop: 16,
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <Segmented
            options={['按线路', '按环节', '按承运人']}
            value={VIEW_MODE_LABEL_MAP[viewMode]}
            onChange={handleSegmentedChange}
            style={{ fontWeight: 500 }}
          />

          <Space wrap size="middle">
            <Space size={4}>
              <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>时间范围:</span>
              <RangePicker
                value={filters.dateRange}
                onChange={(dates) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: dates as [Dayjs, Dayjs] | null,
                  }))
                }
                allowClear
                style={{ width: 240 }}
              />
            </Space>

            <Space size={4}>
              <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>运输方式:</span>
              <Select
                value={filters.transportType}
                onChange={(val) => setFilters((prev) => ({ ...prev, transportType: val }))}
                style={{ width: 100 }}
                options={[
                  { label: '全部', value: 'all' },
                  { label: '海运', value: '海运' },
                  { label: '空运', value: '空运' },
                ]}
              />
            </Space>

            <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
              重置
            </Button>
          </Space>
        </div>
      </Card>

      {/* 数据表格 */}
      <Card
        bordered={false}
        style={{
          marginTop: 16,
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowTertiary,
        }}
        title={
          <span style={{ fontWeight: 600 }}>
            {viewMode === 'route' && '线路时效分析'}
            {viewMode === 'stage' && '环节耗时分析'}
            {viewMode === 'carrier' && '承运人绩效分析'}
          </span>
        }
      >
        {renderTable()}
      </Card>
    </div>
  );
};
