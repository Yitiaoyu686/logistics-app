import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Select, InputNumber, DatePicker,
  Space, Tag, Button, Typography, Segmented
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined,
  WalletOutlined, SwapOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text } = Typography;

// ==================== 类型 ====================

type ViewMode = 'day' | 'month' | 'year';

interface CashFlowRecord {
  id: string;
  time: string;
  direction: 'IN' | 'OUT';
  amount: number;
  currency: 'CNY' | 'USD' | 'EUR';
  amountCNY: number;
  source: string;
  relatedNo: string;
  category: string;
  operator: string;
  remark?: string;
}

interface DaySummary {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

// ==================== 数据状态（待接入API） ====================

// ==================== 常量 ====================

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
};

const formatMoney = (value: number): string => {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const BASE_BALANCE = 0;

// ==================== 组件 ====================

export const CashFlowDaily: React.FC = () => {
  const [cashFlowData] = useState<CashFlowRecord[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(dayjs('2026-02-09'));
  const [selectedMonth, setSelectedMonth] = useState(dayjs('2026-02'));
  const [selectedYear, setSelectedYear] = useState(dayjs('2026'));
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState<number | null>(null);
  const [maxAmount, setMaxAmount] = useState<number | null>(null);

  const handleReset = () => {
    setDirectionFilter('ALL');
    setCurrencyFilter('ALL');
    setMinAmount(null);
    setMaxAmount(null);
  };

  // ===== 按日：筛选当天明细 =====
  const dayRecords = useMemo(() => {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    let data = cashFlowData.filter((r) => r.time.startsWith(dateStr));
    if (directionFilter !== 'ALL') data = data.filter((r) => r.direction === directionFilter);
    if (currencyFilter !== 'ALL') data = data.filter((r) => r.currency === currencyFilter);
    if (minAmount !== null) data = data.filter((r) => r.amountCNY >= minAmount);
    if (maxAmount !== null) data = data.filter((r) => r.amountCNY <= maxAmount);
    data.sort((a, b) => (a.time > b.time ? -1 : 1));
    return data;
  }, [selectedDate, directionFilter, currencyFilter, minAmount, maxAmount]);

  const dayStats = useMemo(() => {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const all = cashFlowData.filter((r) => r.time.startsWith(dateStr));
    const income = all.filter((r) => r.direction === 'IN').reduce((s, r) => s + r.amountCNY, 0);
    const expense = all.filter((r) => r.direction === 'OUT').reduce((s, r) => s + r.amountCNY, 0);
    return { income, expense, net: income - expense, count: all.length };
  }, [selectedDate]);

  // ===== 按月：按天聚合 =====
  const monthDaySummary = useMemo((): DaySummary[] => {
    const monthStr = selectedMonth.format('YYYY-MM');
    const records = cashFlowData.filter((r) => r.time.startsWith(monthStr));
    const map: Record<string, DaySummary> = {};
    records.forEach((r) => {
      const date = r.time.split(' ')[0];
      if (!map[date]) map[date] = { date, income: 0, expense: 0, net: 0, count: 0 };
      map[date].count++;
      if (r.direction === 'IN') {
        map[date].income += r.amountCNY;
      } else {
        map[date].expense += r.amountCNY;
      }
      map[date].net = map[date].income - map[date].expense;
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedMonth]);

  const monthStats = useMemo(() => {
    const income = monthDaySummary.reduce((s, d) => s + d.income, 0);
    const expense = monthDaySummary.reduce((s, d) => s + d.expense, 0);
    const count = monthDaySummary.reduce((s, d) => s + d.count, 0);
    const days = monthDaySummary.length || 1;
    return { income, expense, net: income - expense, count, avgDaily: (income - expense) / days };
  }, [monthDaySummary]);

  // ===== 按年：按月聚合 =====
  const yearMonthSummary = useMemo((): MonthSummary[] => {
    const yearStr = selectedYear.format('YYYY');
    const records = cashFlowData.filter((r) => r.time.startsWith(yearStr));
    const map: Record<string, MonthSummary> = {};
    records.forEach((r) => {
      const month = r.time.substring(0, 7);
      if (!map[month]) map[month] = { month, income: 0, expense: 0, net: 0, count: 0 };
      map[month].count++;
      if (r.direction === 'IN') {
        map[month].income += r.amountCNY;
      } else {
        map[month].expense += r.amountCNY;
      }
      map[month].net = map[month].income - map[month].expense;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [selectedYear]);

  const yearStats = useMemo(() => {
    const income = yearMonthSummary.reduce((s, m) => s + m.income, 0);
    const expense = yearMonthSummary.reduce((s, m) => s + m.expense, 0);
    const count = yearMonthSummary.reduce((s, m) => s + m.count, 0);
    const months = yearMonthSummary.length || 1;
    return { income, expense, net: income - expense, count, avgMonthly: (income - expense) / months };
  }, [yearMonthSummary]);

  // ===== 币种汇总 (按日视图) =====
  const currencySummary = useMemo(() => {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const all = cashFlowData.filter((r) => r.time.startsWith(dateStr));
    const currencies = Array.from(new Set(all.map((r) => r.currency)));
    return currencies.map((cur) => {
      const recs = all.filter((r) => r.currency === cur);
      const income = recs.filter((r) => r.direction === 'IN').reduce((s, r) => s + r.amount, 0);
      const expense = recs.filter((r) => r.direction === 'OUT').reduce((s, r) => s + r.amount, 0);
      return { currency: cur, incomeTotal: income, expenseTotal: expense, net: income - expense };
    });
  }, [selectedDate]);

  // ===== 统计标题根据模式变化 =====
  const statsConfig = useMemo(() => {
    if (viewMode === 'day') {
      return {
        incomeTitle: '当日收入', expenseTitle: '当日支出', netTitle: '当日净额',
        extraTitle: '累计余额', extraValue: BASE_BALANCE + dayStats.net,
        income: dayStats.income, expense: dayStats.expense, net: dayStats.net,
        isExtraBalance: true,
      };
    } else if (viewMode === 'month') {
      return {
        incomeTitle: '本月收入', expenseTitle: '本月支出', netTitle: '本月净额',
        extraTitle: '日均净额', extraValue: monthStats.avgDaily,
        income: monthStats.income, expense: monthStats.expense, net: monthStats.net,
        isExtraBalance: false,
      };
    } else {
      return {
        incomeTitle: '全年收入', expenseTitle: '全年支出', netTitle: '全年净额',
        extraTitle: '月均净额', extraValue: yearStats.avgMonthly,
        income: yearStats.income, expense: yearStats.expense, net: yearStats.net,
        isExtraBalance: false,
      };
    }
  }, [viewMode, dayStats, monthStats, yearStats]);

  // ===== 日明细列 =====
  const dayColumns: ColumnsType<CashFlowRecord> = [
    { title: '时间', dataIndex: 'time', key: 'time', width: 80, render: (val: string) => <Text>{val.split(' ')[1] || val}</Text> },
    { title: '方向', dataIndex: 'direction', key: 'direction', width: 80, render: (val: 'IN' | 'OUT') => val === 'IN' ? <Tag color="green">收入</Tag> : <Tag color="red">支出</Tag> },
    {
      title: '金额', dataIndex: 'amount', key: 'amount', width: 140, align: 'right',
      render: (_: number, record: CashFlowRecord) => {
        const symbol = CURRENCY_SYMBOLS[record.currency] || '';
        const color = record.direction === 'IN' ? '#52c41a' : '#ff4d4f';
        const prefix = record.direction === 'IN' ? '+' : '-';
        return <Text strong style={{ color }}>{prefix}{symbol}{formatMoney(record.amount)}</Text>;
      },
    },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 70, align: 'center' as const },
    {
      title: '折合人民币', dataIndex: 'amountCNY', key: 'amountCNY', width: 130, align: 'right' as const,
      render: (val: number, record: CashFlowRecord) => record.currency === 'CNY' ? <Text type="secondary">-</Text> : <Text>¥{formatMoney(val)}</Text>,
    },
    { title: '来源/去向', dataIndex: 'source', key: 'source', width: 150, ellipsis: true },
    { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 170, render: (val: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{val}</Text> },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 120,
      render: (val: string) => {
        let color = 'default';
        if (val.includes('收入')) color = 'green';
        else if (val.includes('海运')) color = 'blue';
        else if (val.includes('空运')) color = 'cyan';
        else if (val.includes('报关')) color = 'orange';
        else if (val.includes('拖车')) color = 'purple';
        else if (val.includes('仓储') && val.includes('支出')) color = 'magenta';
        else if (val.includes('派送')) color = 'volcano';
        return <Tag color={color}>{val}</Tag>;
      },
    },
    { title: '经办人', dataIndex: 'operator', key: 'operator', width: 80 },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 160, ellipsis: true, render: (val?: string) => <Text type="secondary" ellipsis={{ tooltip: val }}>{val || '-'}</Text> },
  ];

  // ===== 月汇总列（按天） =====
  const monthColumns: ColumnsType<DaySummary> = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 120, render: (val: string) => <Text strong>{val}</Text> },
    { title: '笔数', dataIndex: 'count', key: 'count', width: 80, align: 'center' as const, render: (val: number) => <Tag>{val}笔</Tag> },
    {
      title: '收入(¥)', dataIndex: 'income', key: 'income', width: 160, align: 'right' as const,
      sorter: (a: DaySummary, b: DaySummary) => a.income - b.income,
      render: (val: number) => val > 0 ? <Text style={{ color: '#52c41a' }}>+¥{formatMoney(val)}</Text> : <Text type="secondary">¥0.00</Text>,
    },
    {
      title: '支出(¥)', dataIndex: 'expense', key: 'expense', width: 160, align: 'right' as const,
      sorter: (a: DaySummary, b: DaySummary) => a.expense - b.expense,
      render: (val: number) => val > 0 ? <Text style={{ color: '#ff4d4f' }}>-¥{formatMoney(val)}</Text> : <Text type="secondary">¥0.00</Text>,
    },
    {
      title: '净额(¥)', dataIndex: 'net', key: 'net', width: 160, align: 'right' as const,
      sorter: (a: DaySummary, b: DaySummary) => a.net - b.net,
      render: (val: number) => <Text strong style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>{val >= 0 ? '+' : ''}¥{formatMoney(val)}</Text>,
    },
  ];

  // ===== 年汇总列（按月） =====
  const yearColumns: ColumnsType<MonthSummary> = [
    { title: '月份', dataIndex: 'month', key: 'month', width: 120, render: (val: string) => <Text strong>{val}</Text> },
    { title: '笔数', dataIndex: 'count', key: 'count', width: 80, align: 'center' as const, render: (val: number) => <Tag>{val}笔</Tag> },
    {
      title: '收入(¥)', dataIndex: 'income', key: 'income', width: 160, align: 'right' as const,
      sorter: (a: MonthSummary, b: MonthSummary) => a.income - b.income,
      render: (val: number) => val > 0 ? <Text style={{ color: '#52c41a' }}>+¥{formatMoney(val)}</Text> : <Text type="secondary">¥0.00</Text>,
    },
    {
      title: '支出(¥)', dataIndex: 'expense', key: 'expense', width: 160, align: 'right' as const,
      sorter: (a: MonthSummary, b: MonthSummary) => a.expense - b.expense,
      render: (val: number) => val > 0 ? <Text style={{ color: '#ff4d4f' }}>-¥{formatMoney(val)}</Text> : <Text type="secondary">¥0.00</Text>,
    },
    {
      title: '净额(¥)', dataIndex: 'net', key: 'net', width: 160, align: 'right' as const,
      sorter: (a: MonthSummary, b: MonthSummary) => a.net - b.net,
      render: (val: number) => <Text strong style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>{val >= 0 ? '+' : ''}¥{formatMoney(val)}</Text>,
    },
  ];

  // ===== 币种汇总列 =====
  const summaryColumns: ColumnsType<{ currency: string; incomeTotal: number; expenseTotal: number; net: number }> = [
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 100, render: (val: string) => <Text strong>{val}</Text> },
    { title: '收入合计', dataIndex: 'incomeTotal', key: 'incomeTotal', width: 160, align: 'right' as const, render: (val: number, record) => <Text style={{ color: '#52c41a' }}>{CURRENCY_SYMBOLS[record.currency] || ''}{formatMoney(val)}</Text> },
    { title: '支出合计', dataIndex: 'expenseTotal', key: 'expenseTotal', width: 160, align: 'right' as const, render: (val: number, record) => <Text style={{ color: '#ff4d4f' }}>{CURRENCY_SYMBOLS[record.currency] || ''}{formatMoney(val)}</Text> },
    {
      title: '净额', dataIndex: 'net', key: 'net', width: 160, align: 'right' as const,
      render: (val: number, record) => {
        const color = val >= 0 ? '#52c41a' : '#ff4d4f';
        const prefix = val >= 0 ? '+' : '';
        return <Text strong style={{ color }}>{prefix}{CURRENCY_SYMBOLS[record.currency] || ''}{formatMoney(val)}</Text>;
      },
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 视图切换 + 时间选择 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space align="center" size="middle">
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as ViewMode)}
            options={[
              { label: '按日', value: 'day' },
              { label: '按月', value: 'month' },
              { label: '按年', value: 'year' },
            ]}
          />
          {viewMode === 'day' && (
            <DatePicker
              value={selectedDate}
              onChange={(date) => { if (date) setSelectedDate(date); }}
              allowClear={false}
              style={{ width: 160 }}
            />
          )}
          {viewMode === 'month' && (
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(date) => { if (date) setSelectedMonth(date); }}
              allowClear={false}
              style={{ width: 160 }}
            />
          )}
          {viewMode === 'year' && (
            <DatePicker
              picker="year"
              value={selectedYear}
              onChange={(date) => { if (date) setSelectedYear(date); }}
              allowClear={false}
              style={{ width: 160 }}
            />
          )}
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card style={{ borderRadius: 8, background: 'linear-gradient(135deg, #f6ffed 0%, #fff 100%)' }} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={statsConfig.incomeTitle}
              value={statsConfig.income}
              precision={2}
              prefix={<span>¥</span>}
              suffix={<ArrowUpOutlined style={{ fontSize: 14, color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 8, background: 'linear-gradient(135deg, #fff1f0 0%, #fff 100%)' }} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={statsConfig.expenseTitle}
              value={statsConfig.expense}
              precision={2}
              prefix={<span>¥</span>}
              suffix={<ArrowDownOutlined style={{ fontSize: 14, color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{ borderRadius: 8, background: statsConfig.net >= 0 ? 'linear-gradient(135deg, #f6ffed 0%, #fff 100%)' : 'linear-gradient(135deg, #fff1f0 0%, #fff 100%)' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Statistic
              title={statsConfig.netTitle}
              value={statsConfig.net}
              precision={2}
              prefix={<span><SwapOutlined style={{ color: statsConfig.net >= 0 ? '#52c41a' : '#ff4d4f', marginRight: 4 }} />¥</span>}
              valueStyle={{ color: statsConfig.net >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 8, background: 'linear-gradient(135deg, #e6f4ff 0%, #fff 100%)' }} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={statsConfig.extraTitle}
              value={statsConfig.extraValue}
              precision={2}
              prefix={<span><WalletOutlined style={{ color: '#1677ff', marginRight: 4 }} />¥</span>}
              valueStyle={{ color: '#1677ff', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 - 仅按日视图显示 */}
      {viewMode === 'day' && (
        <Card style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: '12px 24px' } }}>
          <Space wrap size="middle" align="center">
            <Space align="center">
              <Text>方向：</Text>
              <Select value={directionFilter} onChange={setDirectionFilter} style={{ width: 100 }} options={[{ label: '全部', value: 'ALL' }, { label: '收入', value: 'IN' }, { label: '支出', value: 'OUT' }]} />
            </Space>
            <Space align="center">
              <Text>币种：</Text>
              <Select value={currencyFilter} onChange={setCurrencyFilter} style={{ width: 100 }} options={[{ label: '全部', value: 'ALL' }, { label: 'CNY', value: 'CNY' }, { label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }]} />
            </Space>
            <Space align="center">
              <Text>最小金额：</Text>
              <InputNumber value={minAmount} onChange={(val) => setMinAmount(val)} placeholder="人民币" style={{ width: 130 }} min={0} />
            </Space>
            <Space align="center">
              <Text>最大金额：</Text>
              <InputNumber value={maxAmount} onChange={(val) => setMaxAmount(val)} placeholder="人民币" style={{ width: 130 }} min={0} />
            </Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          </Space>
        </Card>
      )}

      {/* 按日 - 明细表格 */}
      {viewMode === 'day' && (
        <>
          <Card style={{ marginBottom: 16, borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
            <Table<CashFlowRecord>
              dataSource={dayRecords}
              columns={dayColumns}
              rowKey="id"
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条记录` }}
              size="middle"
              scroll={{ x: 1200 }}
            />
          </Card>
          {currencySummary.length > 0 && (
            <Card title="当日各币种收支汇总" style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
              <Table
                dataSource={[
                  ...currencySummary,
                  { currency: '折合人民币合计', incomeTotal: dayStats.income, expenseTotal: dayStats.expense, net: dayStats.net },
                ]}
                columns={summaryColumns}
                rowKey="currency"
                pagination={false}
                size="middle"
                onRow={(_, index) => ({
                  style: index === currencySummary.length ? { backgroundColor: '#fafafa', fontWeight: 'bold', borderTop: '2px solid #f0f0f0' } : {},
                })}
              />
            </Card>
          )}
        </>
      )}

      {/* 按月 - 每日汇总表 */}
      {viewMode === 'month' && (
        <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          <Table<DaySummary>
            dataSource={monthDaySummary}
            columns={monthColumns}
            rowKey="date"
            pagination={false}
            size="middle"
            summary={() => {
              if (monthDaySummary.length === 0) return null;
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ background: '#fafafa' }}>
                    <Table.Summary.Cell index={0}><Text strong>合计</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center"><Tag color="blue">{monthStats.count}笔</Tag></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><Text strong style={{ color: '#52c41a' }}>+¥{formatMoney(monthStats.income)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: '#ff4d4f' }}>-¥{formatMoney(monthStats.expense)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong style={{ color: monthStats.net >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        {monthStats.net >= 0 ? '+' : ''}¥{formatMoney(monthStats.net)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Card>
      )}

      {/* 按年 - 每月汇总表 */}
      {viewMode === 'year' && (
        <Card style={{ borderRadius: 8 }} styles={{ body: { padding: 0 } }}>
          <Table<MonthSummary>
            dataSource={yearMonthSummary}
            columns={yearColumns}
            rowKey="month"
            pagination={false}
            size="middle"
            summary={() => {
              if (yearMonthSummary.length === 0) return null;
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row style={{ background: '#fafafa' }}>
                    <Table.Summary.Cell index={0}><Text strong>合计</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center"><Tag color="blue">{yearStats.count}笔</Tag></Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right"><Text strong style={{ color: '#52c41a' }}>+¥{formatMoney(yearStats.income)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: '#ff4d4f' }}>-¥{formatMoney(yearStats.expense)}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text strong style={{ color: yearStats.net >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        {yearStats.net >= 0 ? '+' : ''}¥{formatMoney(yearStats.net)}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
};
