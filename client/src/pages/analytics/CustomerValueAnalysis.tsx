import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Button, Space, Drawer, Tabs,
  Descriptions, Select, DatePicker, Typography, theme
} from 'antd';
import {
  UserOutlined, DollarOutlined, WarningOutlined, TeamOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// ==================== 类型定义 ====================

interface MonthlyTrend {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  profitRate: number;
  orderCount: number;
}

interface RecentOrder {
  orderNo: string;
  date: string;
  route: string;
  transportMode: string;
  amount: number;
  status: string;
}

interface FeeBreakdown {
  category: string;
  amount: number;
  ratio: number;
  count: number;
}

interface CustomerValue {
  id: string;
  name: string;
  level: 'A' | 'B' | 'C' | 'D';
  industry: string;
  salesPerson: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  createdDate: string;
  totalRevenue: number;
  totalProfit: number;
  profitRate: number;
  orderCount: number;
  lastOrderDate: string;
  receivableBalance: number;
  monthlyTrend: MonthlyTrend[];
  recentOrders: RecentOrder[];
  feeBreakdown: FeeBreakdown[];
}

// ==================== 工具函数 ====================

const formatMoney = (val: number): string => {
  return `\u00a5${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getProfitRateColor = (rate: number): string => {
  if (rate >= 20) return '#52c41a';
  if (rate >= 10) return '#faad14';
  return '#ff4d4f';
};

const getLevelColor = (level: string): string => {
  switch (level) {
    case 'A': return 'gold';
    case 'B': return 'blue';
    case 'C': return 'default';
    case 'D': return 'red';
    default: return 'default';
  }
};

// ==================== 数据 ====================

const customerData: CustomerValue[] = [];

// ==================== 组件 ====================

export const CustomerValueAnalysis: React.FC = () => {
  const { token } = theme.useToken();

  // Filter states
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [industryFilter, setIndustryFilter] = useState<string>('全部');
  const [salesFilter, setSalesFilter] = useState<string>('全部');
  const [levelFilter, setLevelFilter] = useState<string>('全部');

  // Drawer states
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerValue | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState('basic');

  // Filtered data
  const filteredData = useMemo(() => {
    return customerData.filter((c) => {
      if (industryFilter !== '全部' && c.industry !== industryFilter) return false;
      if (salesFilter !== '全部' && c.salesPerson !== salesFilter) return false;
      if (levelFilter !== '全部' && c.level !== levelFilter) return false;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const lastOrder = dayjs(c.lastOrderDate);
        if (lastOrder.isBefore(dateRange[0], 'day') || lastOrder.isAfter(dateRange[1], 'day')) {
          return false;
        }
      }
      return true;
    });
  }, [industryFilter, salesFilter, levelFilter, dateRange]);

  // Reset filters
  const handleReset = () => {
    setDateRange(null);
    setIndustryFilter('全部');
    setSalesFilter('全部');
    setLevelFilter('全部');
  };

  // Open detail drawer
  const handleViewDetail = (record: CustomerValue) => {
    setSelectedCustomer(record);
    setActiveDrawerTab('basic');
    setDrawerVisible(true);
  };

  // ==================== 主表列定义 ====================

  const mainColumns: ColumnsType<CustomerValue> = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      fixed: 'left',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '客户等级',
      dataIndex: 'level',
      key: 'level',
      width: 90,
      align: 'center',
      render: (level: string) => <Tag color={getLevelColor(level)}>{level}级</Tag>,
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      width: 80,
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 80,
    },
    {
      title: '累计营收',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      width: 140,
      align: 'right',
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
      defaultSortOrder: 'descend',
      render: (val: number) => <Text strong>{formatMoney(val)}</Text>,
    },
    {
      title: '累计毛利',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.totalProfit - b.totalProfit,
      render: (val: number) => (
        <Text style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {formatMoney(val)}
        </Text>
      ),
    },
    {
      title: '毛利率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.profitRate - b.profitRate,
      render: (val: number) => (
        <Text style={{ color: getProfitRateColor(val), fontWeight: 600 }}>
          {val.toFixed(1)}%
        </Text>
      ),
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
      width: 80,
      align: 'right',
      sorter: (a, b) => a.orderCount - b.orderCount,
    },
    {
      title: '最近下单',
      dataIndex: 'lastOrderDate',
      key: 'lastOrderDate',
      width: 120,
      render: (date: string) => {
        const daysDiff = dayjs().diff(dayjs(date), 'day');
        return (
          <Text style={{ color: daysDiff > 60 ? '#ff4d4f' : undefined }}>
            {date}
          </Text>
        );
      },
    },
    {
      title: '应收余额',
      dataIndex: 'receivableBalance',
      key: 'receivableBalance',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.receivableBalance - b.receivableBalance,
      render: (val: number) => (
        <Text style={{ color: val > 0 ? '#ff4d4f' : undefined }}>
          {formatMoney(val)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: CustomerValue) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  // ==================== Drawer 表列定义 ====================

  const trendColumns: ColumnsType<MonthlyTrend> = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 100,
    },
    {
      title: '收入',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 130,
      align: 'right',
      render: (val: number) => formatMoney(val),
    },
    {
      title: '成本',
      dataIndex: 'cost',
      key: 'cost',
      width: 130,
      align: 'right',
      render: (val: number) => formatMoney(val),
    },
    {
      title: '利润',
      dataIndex: 'profit',
      key: 'profit',
      width: 130,
      align: 'right',
      render: (val: number) => (
        <Text style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {formatMoney(val)}
        </Text>
      ),
    },
    {
      title: '毛利率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      width: 90,
      align: 'right',
      render: (val: number) => (
        <Text style={{ color: getProfitRateColor(val), fontWeight: 600 }}>
          {val > 0 ? `${val.toFixed(1)}%` : '-'}
        </Text>
      ),
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
      width: 80,
      align: 'right',
    },
  ];

  const orderColumns: ColumnsType<RecentOrder> = [
    {
      title: '运单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 170,
      render: (text: string) => <Text copyable={{ text }}>{text}</Text>,
    },
    {
      title: '下单日期',
      dataIndex: 'date',
      key: 'date',
      width: 110,
    },
    {
      title: '路线',
      dataIndex: 'route',
      key: 'route',
      width: 110,
    },
    {
      title: '运输方式',
      dataIndex: 'transportMode',
      key: 'transportMode',
      width: 90,
      align: 'center',
      render: (mode: string) => (
        <Tag color={mode === '空运' ? 'blue' : 'cyan'}>{mode}</Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (val: number) => formatMoney(val),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          '已下单': 'blue',
          '运输中': 'processing',
          '已签收': 'success',
          '已取消': 'error',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
  ];

  const feeColumns: ColumnsType<FeeBreakdown> = [
    {
      title: '费用类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      align: 'right',
      render: (val: number) => formatMoney(val),
    },
    {
      title: '占比',
      dataIndex: 'ratio',
      key: 'ratio',
      width: 90,
      align: 'right',
      render: (val: number) => `${val.toFixed(1)}%`,
    },
    {
      title: '笔数',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      align: 'right',
    },
  ];

  // ==================== Drawer 内容 ====================

  const renderDrawerContent = () => {
    if (!selectedCustomer) return null;

    const c = selectedCustomer;

    const totalFeeReceivable = c.receivableBalance;
    const totalFeeReceived = c.totalRevenue - c.receivableBalance;
    const overdueAmount = c.receivableBalance > 50000 ? c.receivableBalance : 0;

    const tabItems = [
      {
        key: 'basic',
        label: '基本信息',
        children: (
          <Descriptions
            bordered
            column={2}
            size="middle"
            labelStyle={{ fontWeight: 600, width: 120 }}
          >
            <Descriptions.Item label="客户名称">{c.name}</Descriptions.Item>
            <Descriptions.Item label="客户等级">
              <Tag color={getLevelColor(c.level)}>{c.level}级</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="行业">{c.industry}</Descriptions.Item>
            <Descriptions.Item label="联系人">{c.contact}</Descriptions.Item>
            <Descriptions.Item label="电话">{c.phone}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{c.email}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{c.address}</Descriptions.Item>
            <Descriptions.Item label="业务员">{c.salesPerson}</Descriptions.Item>
            <Descriptions.Item label="创建日期">{c.createdDate}</Descriptions.Item>
          </Descriptions>
        ),
      },
      {
        key: 'trend',
        label: '营收趋势',
        children: (
          <Table<MonthlyTrend>
            columns={trendColumns}
            dataSource={c.monthlyTrend}
            rowKey="month"
            pagination={false}
            size="middle"
            bordered
            summary={(data) => {
              const totals = data.reduce(
                (acc, row) => ({
                  revenue: acc.revenue + row.revenue,
                  cost: acc.cost + row.cost,
                  profit: acc.profit + row.profit,
                  orderCount: acc.orderCount + row.orderCount,
                }),
                { revenue: 0, cost: 0, profit: 0, orderCount: 0 }
              );
              const avgRate = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    <Text strong>{formatMoney(totals.revenue)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <Text strong>{formatMoney(totals.cost)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong style={{ color: totals.profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
                      {formatMoney(totals.profit)}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong style={{ color: getProfitRateColor(avgRate) }}>
                      {avgRate > 0 ? `${avgRate.toFixed(1)}%` : '-'}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong>{totals.orderCount}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        ),
      },
      {
        key: 'orders',
        label: '订单明细',
        children: (
          <Table<RecentOrder>
            columns={orderColumns}
            dataSource={c.recentOrders}
            rowKey="orderNo"
            pagination={false}
            size="middle"
            bordered
          />
        ),
      },
      {
        key: 'fees',
        label: '费用概况',
        children: (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="应收合计"
                    value={totalFeeReceivable}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: totalFeeReceivable > 0 ? '#ff4d4f' : token.colorTextSecondary }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="已收合计"
                    value={totalFeeReceived}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="逾期金额"
                    value={overdueAmount}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: overdueAmount > 0 ? '#ff4d4f' : token.colorTextSecondary }}
                  />
                </Card>
              </Col>
            </Row>
            <Table<FeeBreakdown>
              columns={feeColumns}
              dataSource={c.feeBreakdown}
              rowKey="category"
              pagination={false}
              size="middle"
              bordered
              summary={(data) => {
                const totalAmount = data.reduce((acc, row) => acc + row.amount, 0);
                const totalCount = data.reduce((acc, row) => acc + row.count, 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <Text strong>合计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong>{formatMoney(totalAmount)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong>100.0%</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text strong>{totalCount}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </div>
        ),
      },
    ];

    return (
      <Tabs
        tabPosition="left"
        activeKey={activeDrawerTab}
        onChange={setActiveDrawerTab}
        items={tabItems}
        style={{ minHeight: 400 }}
      />
    );
  };

  // ==================== 渲染 ====================

  return (
    <div style={{ padding: 0 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small" hoverable>
            <Statistic
              title="客户总数"
              value={0}
              prefix={<TeamOutlined style={{ color: token.colorPrimary }} />}
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" hoverable>
            <Statistic
              title="本期活跃客户"
              value={0}
              prefix={<UserOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" hoverable>
            <Statistic
              title="客户总营收"
              value={0}
              precision={2}
              prefix={<DollarOutlined style={{ color: token.colorPrimary }} />}
              valueStyle={{ color: token.colorPrimary, fontSize: 20 }}
              formatter={(val) => `¥${Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" hoverable>
            <Statistic
              title="平均客单价"
              value={0}
              precision={2}
              prefix="¥"
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" hoverable>
            <Statistic
              title="客户集中度/TOP5占比"
              value={0}
              suffix="%"
              valueStyle={{ color: token.colorTextBase }}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" hoverable>
            <Statistic
              title="流失预警数"
              value={0}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选区 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Space>
            <Text>时间范围:</Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
              style={{ width: 240 }}
            />
          </Space>
          <Space>
            <Text>行业:</Text>
            <Select
              value={industryFilter}
              onChange={setIndustryFilter}
              style={{ width: 120 }}
            >
              <Option value="全部">全部</Option>
              <Option value="电商">电商</Option>
              <Option value="贸易">贸易</Option>
              <Option value="工厂">工厂</Option>
              <Option value="个人">个人</Option>
            </Select>
          </Space>
          <Space>
            <Text>业务员:</Text>
            <Select
              value={salesFilter}
              onChange={setSalesFilter}
              style={{ width: 120 }}
            >
              <Option value="全部">全部</Option>
              <Option value="张丽">张丽</Option>
              <Option value="王磊">王磊</Option>
              <Option value="李娜">李娜</Option>
              <Option value="陈波">陈波</Option>
              <Option value="刘芳">刘芳</Option>
            </Select>
          </Space>
          <Space>
            <Text>客户等级:</Text>
            <Select
              value={levelFilter}
              onChange={setLevelFilter}
              style={{ width: 100 }}
            >
              <Option value="全部">全部</Option>
              <Option value="A">A</Option>
              <Option value="B">B</Option>
              <Option value="C">C</Option>
              <Option value="D">D</Option>
            </Select>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Card
        size="small"
        title={
          <Space>
            <TeamOutlined />
            <span>客户价值明细</span>
            <Tag color="blue">{filteredData.length} 条记录</Tag>
          </Space>
        }
      >
        <Table<CustomerValue>
          columns={mainColumns}
          dataSource={filteredData}
          rowKey="id"
          size="middle"
          scroll={{ x: 1280 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title={
          selectedCustomer ? (
            <Space>
              <UserOutlined />
              <span>{selectedCustomer.name}</span>
              <Tag color={getLevelColor(selectedCustomer.level)}>{selectedCustomer.level}级</Tag>
            </Space>
          ) : '客户详情'
        }
        width="80%"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        destroyOnClose
      >
        {renderDrawerContent()}
      </Drawer>
    </div>
  );
};
