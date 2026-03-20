import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Button, Space, Select,
  DatePicker, Typography, Segmented, Progress
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, DollarOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// ==================== 类型 ====================

type ViewMode = 'category' | 'supplier' | 'trend';

interface CategoryRow {
  key: string;
  category: string;
  categoryTag: 'TRANSPORT' | 'CUSTOMS' | 'STORAGE' | 'DELIVERY' | 'OTHER';
  count: number;
  totalAmount: number;
  percentage: number;
  yoyChange: number;
  avgAmount: number;
  maxAmount: number;
}

interface SupplierRow {
  key: string;
  supplier: string;
  categoryTag: 'TRANSPORT' | 'CUSTOMS' | 'STORAGE' | 'DELIVERY' | 'OTHER';
  count: number;
  totalAmount: number;
  percentage: number;
  avgPrice: number;
  lastTransaction: string;
}

interface TrendRow {
  key: string;
  month: string;
  transport: number;
  customs: number;
  storage: number;
  delivery: number;
  other: number;
  total: number;
  momChange: number | null;
}

interface Filters {
  dateRange: [any, any] | null;
  transportMode: string;
}

// ==================== 配置 ====================

const CATEGORY_TAG_CONFIG: Record<string, { label: string; color: string; strokeColor: string }> = {
  TRANSPORT: { label: '运输费', color: 'blue', strokeColor: '#1677ff' },
  CUSTOMS: { label: '报关费', color: 'orange', strokeColor: '#fa8c16' },
  STORAGE: { label: '仓储费', color: 'purple', strokeColor: '#722ed1' },
  DELIVERY: { label: '配送费', color: 'green', strokeColor: '#52c41a' },
  OTHER: { label: '其他', color: 'default', strokeColor: '#8c8c8c' },
};

const VIEW_MODE_LABEL_MAP: Record<string, ViewMode> = {
  '按费用类别': 'category',
  '按供应商': 'supplier',
  '按月度趋势': 'trend',
};

// ==================== 数据 ====================

const categoryData: CategoryRow[] = [];
const supplierData: SupplierRow[] = [];
const trendData: TrendRow[] = [];

// ==================== 工具函数 ====================

const formatMoney = (val: number): string =>
  `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const renderChange = (val: number | null) => {
  if (val === null || val === undefined) return <Text type="secondary">-</Text>;
  if (val > 0) {
    return (
      <Text style={{ color: '#ff4d4f' }}>
        <ArrowUpOutlined /> +{Math.abs(val).toFixed(1)}%
      </Text>
    );
  }
  if (val < 0) {
    return (
      <Text style={{ color: '#52c41a' }}>
        <ArrowDownOutlined /> -{Math.abs(val).toFixed(1)}%
      </Text>
    );
  }
  return <Text type="secondary">0.0%</Text>;
};

// ==================== 组件 ====================

export const CostStructureAnalysis: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('category');
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    transportMode: 'all',
  });

  // ---- 统计卡片数据 ----
  const statsCards = useMemo(() => [
    {
      title: '总成本',
      value: 0,
      prefix: <DollarOutlined />,
      precision: 2,
      suffix: undefined as string | undefined,
      color: '#1677ff',
    },
    { title: '运输费占比', value: 0, prefix: undefined, precision: 1, suffix: '%', color: '#1677ff' },
    { title: '报关费占比', value: 0, prefix: undefined, precision: 1, suffix: '%', color: '#fa8c16' },
    { title: '仓储费占比', value: 0, prefix: undefined, precision: 1, suffix: '%', color: '#722ed1' },
    { title: '配送费占比', value: 0, prefix: undefined, precision: 1, suffix: '%', color: '#52c41a' },
    { title: '其他费用占比', value: 0, prefix: undefined, precision: 1, suffix: '%', color: '#8c8c8c' },
  ], []);

  // ---- 按费用类别表格列 ----
  const categoryColumns: ColumnsType<CategoryRow> = useMemo(() => [
    {
      title: '费用类别',
      dataIndex: 'category',
      key: 'category',
      render: (_: string, record: CategoryRow) => {
        const cfg = CATEGORY_TAG_CONFIG[record.categoryTag];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '费用笔数',
      dataIndex: 'count',
      key: 'count',
      align: 'right' as const,
      render: (val: number) => `${val} 笔`,
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 200,
      render: (val: number, record: CategoryRow) => {
        const cfg = CATEGORY_TAG_CONFIG[record.categoryTag];
        return (
          <Progress
            percent={val}
            size="small"
            strokeColor={cfg.strokeColor}
            format={(p) => `${p}%`}
          />
        );
      },
    },
    {
      title: '同比变化',
      dataIndex: 'yoyChange',
      key: 'yoyChange',
      align: 'center' as const,
      render: (val: number) => renderChange(val),
    },
    {
      title: '平均单笔',
      dataIndex: 'avgAmount',
      key: 'avgAmount',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '最大单笔',
      dataIndex: 'maxAmount',
      key: 'maxAmount',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
  ], []);

  // ---- 按供应商表格列 ----
  const supplierColumns: ColumnsType<SupplierRow> = useMemo(() => [
    {
      title: '供应商',
      dataIndex: 'supplier',
      key: 'supplier',
    },
    {
      title: '费用类别',
      dataIndex: 'categoryTag',
      key: 'categoryTag',
      render: (tag: string) => {
        const cfg = CATEGORY_TAG_CONFIG[tag];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '交易笔数',
      dataIndex: 'count',
      key: 'count',
      align: 'right' as const,
      render: (val: number) => `${val} 笔`,
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      key: 'percentage',
      align: 'right' as const,
      render: (val: number) => `${val.toFixed(1)}%`,
    },
    {
      title: '平均单价',
      dataIndex: 'avgPrice',
      key: 'avgPrice',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '最近交易',
      dataIndex: 'lastTransaction',
      key: 'lastTransaction',
    },
  ], []);

  // ---- 按月度趋势表格列 ----
  const trendColumns: ColumnsType<TrendRow> = useMemo(() => [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
    },
    {
      title: '运输费',
      dataIndex: 'transport',
      key: 'transport',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '报关费',
      dataIndex: 'customs',
      key: 'customs',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '仓储费',
      dataIndex: 'storage',
      key: 'storage',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '配送费',
      dataIndex: 'delivery',
      key: 'delivery',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '其他',
      dataIndex: 'other',
      key: 'other',
      align: 'right' as const,
      render: (val: number) => formatMoney(val),
    },
    {
      title: '合计',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (val: number) => <Text strong>{formatMoney(val)}</Text>,
    },
    {
      title: '环比变化',
      dataIndex: 'momChange',
      key: 'momChange',
      align: 'center' as const,
      render: (val: number | null) => renderChange(val),
    },
  ], []);

  // ---- 类别 Table.Summary ----
  const categorySummary = useMemo(() => {
    const totalCount = categoryData.reduce((s, r) => s + r.count, 0);
    const totalAmount = categoryData.reduce((s, r) => s + r.totalAmount, 0);
    const allAvg = totalCount > 0 ? totalAmount / totalCount : 0;
    const allMax = categoryData.length > 0 ? Math.max(...categoryData.map((r) => r.maxAmount)) : 0;
    return { totalCount, totalAmount, allAvg, allMax };
  }, []);

  // ---- 供应商 Table.Summary ----
  const supplierSummary = useMemo(() => {
    const totalCount = supplierData.reduce((s, r) => s + r.count, 0);
    const totalAmount = supplierData.reduce((s, r) => s + r.totalAmount, 0);
    return { totalCount, totalAmount };
  }, []);

  // ---- 趋势 Table.Summary ----
  const trendSummary = useMemo(() => {
    const sum = (field: keyof TrendRow) =>
      trendData.reduce((s, r) => s + (r[field] as number), 0);
    return {
      transport: sum('transport'),
      customs: sum('customs'),
      storage: sum('storage'),
      delivery: sum('delivery'),
      other: sum('other'),
      total: sum('total'),
    };
  }, []);

  // ---- 视图切换处理 ----
  const handleViewChange = (val: string | number) => {
    const viewModeVal = VIEW_MODE_LABEL_MAP[val as string];
    if (viewModeVal) setViewMode(viewModeVal);
  };

  // ---- 重置筛选 ----
  const handleReset = () => {
    setFilters({ dateRange: null, transportMode: 'all' });
  };

  return (
    <div>
      {/* ========== 统计卡片 ========== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {statsCards.map((item) => (
          <Col span={4} key={item.title}>
            <Card bordered={false} bodyStyle={{ padding: '20px 24px' }}>
              <Statistic
                title={item.title}
                value={item.value}
                precision={item.precision}
                prefix={item.prefix}
                suffix={item.suffix}
                valueStyle={{ color: item.color, fontSize: 24 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ========== 视图切换 ========== */}
      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={['按费用类别', '按供应商', '按月度趋势']}
          onChange={handleViewChange}
          size="large"
        />
      </div>

      {/* ========== 筛选条件 ========== */}
      <Card bordered={false} style={{ marginBottom: 16 }} bodyStyle={{ paddingBottom: 0 }}>
        <Space wrap size="middle" style={{ marginBottom: 16 }}>
          <span>时间范围：</span>
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters((prev) => ({ ...prev, dateRange: dates as [any, any] | null }))}
          />
          <span>运输方式：</span>
          <Select
            value={filters.transportMode}
            onChange={(val) => setFilters((prev) => ({ ...prev, transportMode: val }))}
            style={{ width: 120 }}
          >
            <Select.Option value="all">全部</Select.Option>
            <Select.Option value="sea">海运</Select.Option>
            <Select.Option value="air">空运</Select.Option>
          </Select>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      {/* ========== 按费用类别 ========== */}
      {viewMode === 'category' && (
        <Card bordered={false} title="成本结构 - 按费用类别">
          <Table<CategoryRow>
            columns={categoryColumns}
            dataSource={categoryData}
            pagination={false}
            size="middle"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong>{categorySummary.totalCount} 笔</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <Text strong>{formatMoney(categorySummary.totalAmount)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    <Text strong>100%</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="center">
                    <Text type="secondary">-</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong>{formatMoney(categorySummary.allAvg)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong>{formatMoney(categorySummary.allMax)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      )}

      {/* ========== 按供应商 ========== */}
      {viewMode === 'supplier' && (
        <Card bordered={false} title="成本结构 - 按供应商">
          <Table<SupplierRow>
            columns={supplierColumns}
            dataSource={supplierData}
            pagination={false}
            size="middle"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} align="right">
                    <Text strong>{supplierSummary.totalCount} 笔</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong>{formatMoney(supplierSummary.totalAmount)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>100%</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} />
                  <Table.Summary.Cell index={6} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      )}

      {/* ========== 按月度趋势 ========== */}
      {viewMode === 'trend' && (
        <Card bordered={false} title="成本结构 - 按月度趋势">
          <Table<TrendRow>
            columns={trendColumns}
            dataSource={trendData}
            pagination={false}
            size="middle"
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong>{formatMoney(trendSummary.transport)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <Text strong>{formatMoney(trendSummary.customs)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong>{formatMoney(trendSummary.storage)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>{formatMoney(trendSummary.delivery)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong>{formatMoney(trendSummary.other)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong>{formatMoney(trendSummary.total)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      )}
    </div>
  );
};
