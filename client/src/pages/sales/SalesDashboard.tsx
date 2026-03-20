import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, List, Button, Input, Select, Tag, message, Spin } from 'antd';
import {
  DollarOutlined, TeamOutlined, AlertOutlined, RiseOutlined,
  CalculatorOutlined, NotificationOutlined
} from '@ant-design/icons';
import { salesApi } from '../../api';

const { Option } = Select;

// --- Types ---
interface KpiData {
  monthlyGmv: string;
  gmvGrowth: string;
  estimatedProfit: string;
  profitMargin: string;
  newCustomers: number;
  activeCustomerRate: string;
  arWarning: string;
  overdueCount: number;
}

interface TodoItem {
  title: string;
  desc: string;
  tag: string;
  color: string;
}

interface Announcement {
  title: string;
  type: string;
}

// --- 1. Top Cards ---
const TopMetricCard = ({ title, value, prefix, color, subValue, loading }: any) => (
  <Card bordered={false} bodyStyle={{ padding: '20px 24px' }}>
    <Spin spinning={loading}>
      <Statistic
        title={<span style={{ color: '#888' }}>{title}</span>}
        value={value}
        prefix={<span style={{ color: color, marginRight: 8, fontSize: 24 }}>{prefix}</span>}
        valueStyle={{ fontWeight: 'bold', fontSize: 24 }}
      />
      {subValue && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          {subValue}
        </div>
      )}
    </Spin>
  </Card>
);

// --- 2. Main Dashboard Component ---
export const SalesDashboard: React.FC = () => {
  // Mini Calculator State
  const [calcCountry, setCalcCountry] = useState('USA');
  const [calcWeight, setCalcWeight] = useState<string>('');
  const [calcResult, setCalcResult] = useState<string | null>(null);

  // Dashboard data states
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState<KpiData>({
    monthlyGmv: '0',
    gmvGrowth: '0%',
    estimatedProfit: '0',
    profitMargin: '0%',
    newCustomers: 0,
    activeCustomerRate: '0%',
    arWarning: '0',
    overdueCount: 0,
  });
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [todoCounts, setTodoCounts] = useState({ exception: 0, fee: 0, leads: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await salesApi.dashboard();
        const data = (res as any)?.data || res;
        if (data) {
          // Map KPI data
          if (data.kpi) {
            setKpi({
              monthlyGmv: data.kpi.monthlyGmv ?? '0',
              gmvGrowth: data.kpi.gmvGrowth ?? '0%',
              estimatedProfit: data.kpi.estimatedProfit ?? '0',
              profitMargin: data.kpi.profitMargin ?? '0%',
              newCustomers: data.kpi.newCustomers ?? 0,
              activeCustomerRate: data.kpi.activeCustomerRate ?? '0%',
              arWarning: data.kpi.arWarning ?? '0',
              overdueCount: data.kpi.overdueCount ?? 0,
            });
          }
          // Map todo items
          if (data.todoItems && Array.isArray(data.todoItems)) {
            setTodoItems(data.todoItems);
          }
          // Map todo counts
          if (data.todoCounts) {
            setTodoCounts({
              exception: data.todoCounts.exception ?? 0,
              fee: data.todoCounts.fee ?? 0,
              leads: data.todoCounts.leads ?? 0,
            });
          }
          // Map announcements
          if (data.announcements && Array.isArray(data.announcements)) {
            setAnnouncements(data.announcements);
          }
        }
      } catch (e) {
        message.error('获取销售数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleMiniCalc = () => {
    if (!calcWeight) return;
    const w = parseFloat(calcWeight);
    const price = w * 55 + 100;
    setCalcResult(`¥${price.toFixed(2)}`);
  };

  return (
    <div className="sales-dashboard">
      {/* Row 1: Metrics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <TopMetricCard
            title="本月业绩 (GMV)"
            value={kpi.monthlyGmv}
            prefix={<DollarOutlined />}
            color="#1890ff"
            loading={loading}
            subValue={<span style={{ color: '#52c41a' }}><RiseOutlined /> 环比增长 {kpi.gmvGrowth}</span>}
          />
        </Col>
        <Col span={6}>
          <TopMetricCard
            title="预估毛利"
            value={kpi.estimatedProfit}
            prefix={<RiseOutlined />}
            color="#722ed1"
            loading={loading}
            subValue={`毛利率约 ${kpi.profitMargin}`}
          />
        </Col>
        <Col span={6}>
          <TopMetricCard
            title="本月新增客户"
            value={kpi.newCustomers}
            prefix={<TeamOutlined />}
            color="#52c41a"
            loading={loading}
            subValue={`活跃客户占比 ${kpi.activeCustomerRate}`}
          />
        </Col>
        <Col span={6}>
          <TopMetricCard
            title="AR 应收预警"
            value={kpi.arWarning}
            prefix={<AlertOutlined />}
            color="#cf1322"
            loading={loading}
            subValue={`${kpi.overdueCount} 笔账单逾期 > 7天`}
          />
        </Col>
      </Row>

      {/* Row 2: Tasks & Tools */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Left: To-Do Center (70%) */}
        <Col span={16}>
          <Card
            title="待办任务中心"
            bordered={false}
            tabList={[
              { key: 'exception', tab: `待处理异常 (${todoCounts.exception})` },
              { key: 'fee', tab: `待确认费用 (${todoCounts.fee})` },
              { key: 'leads', tab: '待跟进线索' },
            ]}
            extra={<Button type="link">查看全部</Button>}
          >
            <Spin spinning={loading}>
              <List
                itemLayout="horizontal"
                dataSource={todoItems}
                locale={{ emptyText: '暂无待办事项' }}
                renderItem={item => (
                  <List.Item actions={[<Button type="link">处理</Button>]}>
                    <List.Item.Meta
                      avatar={<Tag color={item.color}>{item.tag}</Tag>}
                      title={<a href="#">{item.title}</a>}
                      description={item.desc}
                    />
                  </List.Item>
                )}
              />
            </Spin>
          </Card>
        </Col>

        {/* Right: Tools & Notice (30%) */}
        <Col span={8}>
          {/* Mini Calculator */}
          <Card title="运费试算 (Mini)" bordered={false} size="small" style={{ marginBottom: 16 }}>
            <Input.Group compact style={{ display: 'flex' }}>
              <Select value={calcCountry} onChange={setCalcCountry} style={{ width: '40%' }}>
                <Option value="USA">美国</Option>
                <Option value="DE">德国</Option>
              </Select>
              <Input
                style={{ width: '30%' }}
                placeholder="重量kg"
                value={calcWeight}
                onChange={e => setCalcWeight(e.target.value)}
              />
              <Button type="primary" onClick={handleMiniCalc} style={{ width: '30%' }}>查询</Button>
            </Input.Group>
            {calcResult && (
              <div style={{ marginTop: 12, textAlign: 'center', background: '#f6ffed', padding: 8, borderRadius: 4, border: '1px solid #b7eb8f' }}>
                预估: <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: 16 }}>{calcResult}</span> (普货专线)
              </div>
            )}
          </Card>

          {/* Announcements */}
          <Card title="公司公告" bordered={false} size="small" extra={<NotificationOutlined />}>
            <Spin spinning={loading}>
              {announcements.length > 0 ? (
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {announcements.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: 8 }}>
                      <a href="#">[{item.type}] {item.title}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>暂无公告</div>
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* Row 3: Trend Chart (Placeholder) */}
      <Row gutter={16}>
        <Col span={24}>
          <Card title="销售趋势 (近6个月)" bordered={false}>
            <div style={{ height: 200, background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              [此处展示 ECharts 折线图: 货量 vs 销售额]
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
