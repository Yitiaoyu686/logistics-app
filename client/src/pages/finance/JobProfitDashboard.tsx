import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Tag,
  Button, Drawer, Descriptions, Typography, Alert, Progress, message, Menu
} from 'antd';
import {
  DollarOutlined, RiseOutlined, FallOutlined, LineChartOutlined,
  ReloadOutlined, EyeOutlined, CheckCircleOutlined, FileTextOutlined,
  FundOutlined, AccountBookOutlined, BarChartOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// ==================== 类型 ====================

interface JobProfit {
  id: string;
  jobNo: string;
  route: string;
  origin: string;
  destination: string;
  transportType: 'SEA' | 'AIR';
  vesselOrFlight: string;
  status: 'COMPLETED' | 'IN_PROGRESS';
  settlementStatus: 'SETTLED' | 'UNSETTLED';
  completedAt?: string;
  createdAt: string;
  // Revenue items
  revenueItems: { label: string; amount: number }[];
  totalRevenue: number;
  // Cost items
  costItems: { label: string; amount: number }[];
  totalCost: number;
  // Calculated
  profit: number;
  profitRate: number;
}

// ==================== 数据状态（待接入API） ====================

// ==================== 组件 ====================

export const JobProfitDashboard: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [jobs, setJobs] = useState<JobProfit[]>([]);

  // 筛选状态
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterRoute, setFilterRoute] = useState<string>('ALL');
  const [filterTransportType, setFilterTransportType] = useState<string>('ALL');
  const [filterSettlement, setFilterSettlement] = useState<string>('ALL');
  const [filterProfitRange, setFilterProfitRange] = useState<string>('ALL');

  // 详情 Drawer
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentJob, setCurrentJob] = useState<JobProfit | null>(null);
  const [activeSection, setActiveSection] = useState<string>('basic');

  // --- 路线列表 ---
  const routeList = useMemo(() => {
    const set = new Set(jobs.map(j => j.route));
    return Array.from(set).sort();
  }, [jobs]);

  // --- 筛选 ---
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    if (filterDateRange) {
      const [start, end] = filterDateRange;
      result = result.filter(j => {
        const d = dayjs(j.createdAt);
        return d.isAfter(start.startOf('day').subtract(1, 'millisecond')) &&
          d.isBefore(end.endOf('day').add(1, 'millisecond'));
      });
    }
    if (filterRoute !== 'ALL') {
      result = result.filter(j => j.route === filterRoute);
    }
    if (filterTransportType !== 'ALL') {
      result = result.filter(j => j.transportType === filterTransportType);
    }
    if (filterSettlement !== 'ALL') {
      result = result.filter(j => j.settlementStatus === filterSettlement);
    }
    if (filterProfitRange !== 'ALL') {
      switch (filterProfitRange) {
        case 'LOSS':
          result = result.filter(j => j.profit < 0);
          break;
        case '0_10':
          result = result.filter(j => j.profitRate >= 0 && j.profitRate < 10);
          break;
        case '10_20':
          result = result.filter(j => j.profitRate >= 10 && j.profitRate < 20);
          break;
        case '20_PLUS':
          result = result.filter(j => j.profitRate >= 20);
          break;
      }
    }

    return result;
  }, [jobs, filterDateRange, filterRoute, filterTransportType, filterSettlement, filterProfitRange]);

  // --- 全局统计 ---
  const stats = useMemo(() => {
    const totalRevenue = jobs.reduce((sum, j) => sum + j.totalRevenue, 0);
    const totalCost = jobs.reduce((sum, j) => sum + j.totalCost, 0);
    const totalProfit = jobs.reduce((sum, j) => sum + j.profit, 0);
    const avgProfitRate = jobs.length > 0
      ? jobs.reduce((sum, j) => sum + j.profitRate, 0) / jobs.length
      : 0;
    const lossCount = jobs.filter(j => j.profit < 0).length;
    const settledCount = jobs.filter(j => j.settlementStatus === 'SETTLED').length;
    return { totalRevenue, totalCost, totalProfit, avgProfitRate, lossCount, settledCount };
  }, [jobs]);

  // --- 重置 ---
  const handleReset = () => {
    setFilterDateRange(null);
    setFilterRoute('ALL');
    setFilterTransportType('ALL');
    setFilterSettlement('ALL');
    setFilterProfitRange('ALL');
  };

  // --- 打开详情 ---
  const handleOpenDetail = (record: JobProfit) => {
    setCurrentJob(record);
    setActiveSection('basic');
    setDrawerVisible(true);
  };

  // --- 结算确认 ---
  const handleSettle = (record: JobProfit) => {
    setJobs(prev => prev.map(j =>
      j.id !== record.id ? j : { ...j, settlementStatus: 'SETTLED' as const }
    ));
    // 同步更新 currentJob
    if (currentJob && currentJob.id === record.id) {
      setCurrentJob(prev => prev ? { ...prev, settlementStatus: 'SETTLED' as const } : prev);
    }
    message.success(`任务 ${record.jobNo} 已确认结算`);
    setDrawerVisible(false);
  };

  // --- 同路线平均利润率 ---
  const getRouteAvgProfitRate = (route: string): number => {
    const sameRouteJobs = jobs.filter(j => j.route === route);
    if (sameRouteJobs.length === 0) return 0;
    return sameRouteJobs.reduce((sum, j) => sum + j.profitRate, 0) / sameRouteJobs.length;
  };

  // --- 表格列定义 ---
  const columns = [
    {
      title: '任务号',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 200,
      render: (text: string, record: JobProfit) => (
        <a onClick={() => handleOpenDetail(record)}>{text}</a>
      )
    },
    {
      title: '路线',
      dataIndex: 'route',
      key: 'route',
      width: 140
    },
    {
      title: '运输方式',
      dataIndex: 'transportType',
      key: 'transportType',
      width: 90,
      render: (type: 'SEA' | 'AIR') => (
        <Tag color={type === 'SEA' ? 'blue' : 'cyan'}>
          {type === 'SEA' ? '海运' : '空运'}
        </Tag>
      )
    },
    {
      title: '收入',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      width: 120,
      align: 'right' as const,
      sorter: (a: JobProfit, b: JobProfit) => a.totalRevenue - b.totalRevenue,
      render: (val: number) => (
        <Text>¥{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
      )
    },
    {
      title: '成本',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 120,
      align: 'right' as const,
      sorter: (a: JobProfit, b: JobProfit) => a.totalCost - b.totalCost,
      render: (val: number) => (
        <Text>¥{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
      )
    },
    {
      title: '毛利',
      dataIndex: 'profit',
      key: 'profit',
      width: 120,
      align: 'right' as const,
      sorter: (a: JobProfit, b: JobProfit) => a.profit - b.profit,
      render: (val: number) => (
        <Text strong style={{ color: val >= 0 ? '#52c41a' : '#cf1322' }}>
          ¥{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      )
    },
    {
      title: '毛利率',
      dataIndex: 'profitRate',
      key: 'profitRate',
      width: 90,
      align: 'right' as const,
      sorter: (a: JobProfit, b: JobProfit) => a.profitRate - b.profitRate,
      render: (val: number) => (
        <Text style={{
          color: val >= 20 ? '#52c41a' : val >= 10 ? '#faad14' : '#cf1322',
          fontWeight: 600
        }}>
          {val.toFixed(2)}%
        </Text>
      )
    },
    {
      title: '结算状态',
      dataIndex: 'settlementStatus',
      key: 'settlementStatus',
      width: 90,
      render: (status: 'SETTLED' | 'UNSETTLED') => (
        <Tag color={status === 'SETTLED' ? 'green' : 'orange'}>
          {status === 'SETTLED' ? '已结算' : '未结算'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: JobProfit) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record)}>
            查看详情
          </Button>
          {record.settlementStatus === 'UNSETTLED' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleSettle(record)}>
              结算确认
            </Button>
          )}
        </Space>
      )
    }
  ];

  // --- Drawer 内容渲染 ---
  const renderDrawerContent = () => {
    if (!currentJob) return null;

    switch (activeSection) {
      case 'basic':
        return (
          <Card title="基本信息" bordered={false}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="任务号">{currentJob.jobNo}</Descriptions.Item>
              <Descriptions.Item label="路线">{currentJob.route}</Descriptions.Item>
              <Descriptions.Item label="运输方式">
                <Tag color={currentJob.transportType === 'SEA' ? 'blue' : 'cyan'}>
                  {currentJob.transportType === 'SEA' ? '海运' : '空运'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="船名/航班号">{currentJob.vesselOrFlight}</Descriptions.Item>
              <Descriptions.Item label="任务状态">
                <Tag color={currentJob.status === 'COMPLETED' ? 'success' : 'processing'}>
                  {currentJob.status === 'COMPLETED' ? '已完成' : '进行中'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="结算状态">
                <Tag color={currentJob.settlementStatus === 'SETTLED' ? 'green' : 'orange'}>
                  {currentJob.settlementStatus === 'SETTLED' ? '已结算' : '未结算'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(currentJob.createdAt).format('YYYY-MM-DD')}</Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {currentJob.completedAt ? dayjs(currentJob.completedAt).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        );

      case 'revenue':
        return (
          <Card title="收入明细" bordered={false}>
            <Table
              rowKey="label"
              dataSource={currentJob.revenueItems}
              pagination={false}
              size="small"
              columns={[
                { title: '费用项', dataIndex: 'label', key: 'label' },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  key: 'amount',
                  align: 'right' as const,
                  render: (val: number) => (
                    <Text style={{ color: '#3f8600' }}>¥{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  )
                }
              ]}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <Text strong>合计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#3f8600', fontSize: 16 }}>
                        ¥{currentJob.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        );

      case 'cost':
        return (
          <Card title="成本明细" bordered={false}>
            <Table
              rowKey="label"
              dataSource={currentJob.costItems}
              pagination={false}
              size="small"
              columns={[
                { title: '费用项', dataIndex: 'label', key: 'label' },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  key: 'amount',
                  align: 'right' as const,
                  render: (val: number) => (
                    <Text style={{ color: '#cf1322' }}>¥{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  )
                }
              ]}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <Text strong>合计</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                        ¥{currentJob.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        );

      case 'analysis': {
        const routeAvg = getRouteAvgProfitRate(currentJob.route);
        const maxVal = Math.max(currentJob.totalRevenue, currentJob.totalCost);
        const revenuePercent = maxVal > 0 ? Math.round((currentJob.totalRevenue / maxVal) * 100) : 0;
        const costPercent = maxVal > 0 ? Math.round((currentJob.totalCost / maxVal) * 100) : 0;
        const diff = currentJob.profitRate - routeAvg;

        return (
          <Card title="利润分析" bordered={false}>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
                  <Statistic
                    title="总收入"
                    value={currentJob.totalRevenue}
                    prefix="¥"
                    precision={2}
                    valueStyle={{ color: '#1890ff', fontSize: 20 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#fff1f0' }}>
                  <Statistic
                    title="总成本"
                    value={currentJob.totalCost}
                    prefix="¥"
                    precision={2}
                    valueStyle={{ color: '#cf1322', fontSize: 20 }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: currentJob.profit >= 0 ? '#f6ffed' : '#fff1f0' }}>
                  <Statistic
                    title="毛利"
                    value={currentJob.profit}
                    prefix="¥"
                    precision={2}
                    valueStyle={{ color: currentJob.profit >= 0 ? '#52c41a' : '#cf1322', fontSize: 20 }}
                  />
                </Card>
              </Col>
            </Row>

            <Card size="small" style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>收入 vs 成本</Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ width: 60 }}>收入</Text>
                  <Progress
                    percent={revenuePercent}
                    strokeColor="#1890ff"
                    format={() => `¥${currentJob.totalRevenue.toLocaleString()}`}
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Text style={{ width: 60 }}>成本</Text>
                  <Progress
                    percent={costPercent}
                    strokeColor="#cf1322"
                    format={() => `¥${currentJob.totalCost.toLocaleString()}`}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            </Card>

            <Card size="small" style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <Text strong>毛利率</Text>
              </div>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Text style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: currentJob.profitRate >= 20 ? '#52c41a' : currentJob.profitRate >= 10 ? '#faad14' : '#cf1322'
                }}>
                  {currentJob.profitRate.toFixed(2)}%
                </Text>
              </div>
            </Card>

            <Card size="small">
              <div style={{ marginBottom: 12 }}>
                <Text strong>与同路线平均利润率对比</Text>
              </div>
              <Row gutter={16}>
                <Col span={12} style={{ textAlign: 'center' }}>
                  <Text type="secondary">本任务利润率</Text>
                  <div style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: currentJob.profitRate >= 0 ? '#52c41a' : '#cf1322',
                    marginTop: 4
                  }}>
                    {currentJob.profitRate.toFixed(2)}%
                  </div>
                </Col>
                <Col span={12} style={{ textAlign: 'center' }}>
                  <Text type="secondary">同路线平均（{currentJob.route}）</Text>
                  <div style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: routeAvg >= 0 ? '#1890ff' : '#cf1322',
                    marginTop: 4
                  }}>
                    {routeAvg.toFixed(2)}%
                  </div>
                </Col>
              </Row>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                {diff >= 0 ? (
                  <Alert
                    message={`高于同路线平均 ${diff.toFixed(2)} 个百分点`}
                    type="success"
                    showIcon
                    icon={<RiseOutlined />}
                  />
                ) : (
                  <Alert
                    message={`低于同路线平均 ${Math.abs(diff).toFixed(2)} 个百分点`}
                    type="warning"
                    showIcon
                    icon={<FallOutlined />}
                  />
                )}
              </div>
            </Card>

            {currentJob.settlementStatus === 'UNSETTLED' && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleSettle(currentJob)}
                >
                  确认结算
                </Button>
              </div>
            )}
          </Card>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="总收入"
              value={stats.totalRevenue}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#1890ff', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="总成本"
              value={stats.totalCost}
              prefix="¥"
              precision={2}
              valueStyle={{ color: '#cf1322', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="总毛利"
              value={stats.totalProfit}
              prefix="¥"
              precision={2}
              valueStyle={{ color: stats.totalProfit >= 0 ? '#52c41a' : '#cf1322', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="平均毛利率"
              value={stats.avgProfitRate}
              precision={2}
              suffix="%"
              valueStyle={{
                color: stats.avgProfitRate > 15 ? '#52c41a' : stats.avgProfitRate > 10 ? '#faad14' : '#cf1322',
                fontSize: 20
              }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="亏损任务"
              value={stats.lossCount}
              suffix="个"
              prefix={<FallOutlined />}
              valueStyle={{ color: '#cf1322', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已结算"
              value={stats.settledCount}
              suffix={`/ ${jobs.length}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 亏损提醒 */}
      {stats.lossCount > 0 && (
        <Alert
          message="亏损提醒"
          description={`当前有 ${stats.lossCount} 个任务处于亏损状态，请关注成本控制和定价策略`}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]}>
          <Col span={5}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>创建日期</div>
            <RangePicker
              value={filterDateRange}
              onChange={(dates) => setFilterDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>路线</div>
            <Select value={filterRoute} onChange={setFilterRoute} style={{ width: '100%' }}>
              <Option value="ALL">全部路线</Option>
              {routeList.map(r => <Option key={r} value={r}>{r}</Option>)}
            </Select>
          </Col>
          <Col span={3}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>运输方式</div>
            <Select value={filterTransportType} onChange={setFilterTransportType} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              <Option value="SEA">海运</Option>
              <Option value="AIR">空运</Option>
            </Select>
          </Col>
          <Col span={3}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>结算状态</div>
            <Select value={filterSettlement} onChange={setFilterSettlement} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              <Option value="SETTLED">已结算</Option>
              <Option value="UNSETTLED">未结算</Option>
            </Select>
          </Col>
          <Col span={4}>
            <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>利润区间</div>
            <Select value={filterProfitRange} onChange={setFilterProfitRange} style={{ width: '100%' }}>
              <Option value="ALL">全部</Option>
              <Option value="LOSS">亏损</Option>
              <Option value="0_10">0-10%</Option>
              <Option value="10_20">10-20%</Option>
              <Option value="20_PLUS">20%+</Option>
            </Select>
          </Col>
          <Col span={5} style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredJobs}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条` }}
        />
      </Card>

      {/* 详情 Drawer */}
      <Drawer
        title={`任务盈亏详情 - ${currentJob?.jobNo || ''}`}
        width="80%"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        destroyOnClose
      >
        {currentJob && (
          <Row gutter={16}>
            <Col span={4}>
              <Menu
                mode="inline"
                selectedKeys={[activeSection]}
                onClick={({ key }) => setActiveSection(key)}
                items={[
                  { key: 'basic', icon: <FileTextOutlined />, label: '基本信息' },
                  { key: 'revenue', icon: <FundOutlined />, label: '收入明细' },
                  { key: 'cost', icon: <AccountBookOutlined />, label: '成本明细' },
                  { key: 'analysis', icon: <BarChartOutlined />, label: '利润分析' }
                ]}
                style={{ borderRight: 'none' }}
              />
            </Col>
            <Col span={20}>
              {renderDrawerContent()}
            </Col>
          </Row>
        )}
      </Drawer>
    </div>
  );
};
