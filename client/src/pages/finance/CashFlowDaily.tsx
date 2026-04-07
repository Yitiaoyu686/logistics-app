import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Select, InputNumber, DatePicker,
  Space, Tag, Button, Typography, Segmented, message, Modal, Form, Input, Upload, Popconfirm
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined,
  WalletOutlined, SwapOutlined, UploadOutlined, PlusOutlined, DeleteOutlined, InboxOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Dragger } = Upload;

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
  channel: string;
  relatedOrderNo: string;
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

// ==================== Mock 数据生成 ====================

const generateMockCashFlow = (): CashFlowRecord[] => {
  const records: CashFlowRecord[] = [];
  let id = 1;

  const addRecord = (
    date: string, time: string, direction: 'IN' | 'OUT', amount: number,
    currency: 'CNY' | 'USD' | 'EUR', amountCNY: number, source: string,
    channel: string, relatedNo: string, relatedOrderNo: string,
    category: string, operator: string, remark?: string
  ) => {
    records.push({
      id: `CF${String(id++).padStart(4, '0')}`,
      time: `${date} ${time}`,
      direction, amount, currency, amountCNY, source,
      channel, relatedNo, relatedOrderNo, category, operator, remark,
    });
  };

  // ===== 2026-02-09 当日明细 (~20笔) =====
  const d = '2026-02-09';
  addRecord(d, '08:15', 'IN', 12500, 'CNY', 12500, '收到运费(微信)', '微信', 'S-JOB260200901', 'S-20260209000145', '运费收入', '王芳', '客户张先生海运整柜');
  addRecord(d, '08:32', 'IN', 8600, 'CNY', 8600, '收到运费(广州银行)', '广州银行', 'S-JOB260200902', 'S-20260209000146', '运费收入', '王芳', '散货拼箱运费');
  addRecord(d, '09:00', 'IN', 3200, 'USD', 23360, '美金运费到账', '工行美金', 'S-JOB260200518', 'S-20260205000130', '运费收入', '李明', 'FBA头程运费 汇率7.3');
  addRecord(d, '09:15', 'OUT', 18500, 'CNY', 18500, '支付顶派运费', '工行公账', 'S-JOB260200903', 'S-20260209000140', '派送支出', '陈会计', '顶派2月第1批派送费');
  addRecord(d, '09:45', 'IN', 6800, 'CNY', 6800, 'LOS到付款回款', '兴业公账', 'S-JOB260200812', 'S-20260208000138', '运费收入', '王芳', 'LOS港口到付回款');
  addRecord(d, '10:10', 'OUT', 32000, 'CNY', 32000, '支付阿米拉运费', '工行公账', 'S-JOB260200904', 'S-20260209000135', '海运支出', '陈会计', '阿米拉海运2月账期');
  addRecord(d, '10:30', 'IN', 4500, 'CNY', 4500, '公众号收款', '公众号', 'S-JOB260200905', 'S-20260209000148', '运费收入', '赵敏', '散货客户线上支付');
  addRecord(d, '10:55', 'IN', 9200, 'CNY', 9200, '支付宝收款', '企业支付宝', 'S-JOB260200906', 'S-20260209000149', '运费收入', '赵敏', '电商客户运费');
  addRecord(d, '11:20', 'OUT', 5600, 'CNY', 5600, '报关费', '工行公账', 'S-JOB260200907', 'S-20260209000145', '报关支出', '陈会计', '2月报关服务费');
  addRecord(d, '11:45', 'OUT', 2800, 'CNY', 2800, '拖车费', '兴业29113', 'S-JOB260200908', 'S-20260209000146', '拖车支出', '陈会计', '盐田港拖车');
  addRecord(d, '13:00', 'IN', 15800, 'CNY', 15800, '收到运费(微信)', '微信', 'S-JOB260200909', 'S-20260209000150', '运费收入', '王芳', '大客户月结运费');
  addRecord(d, '13:30', 'OUT', 45000, 'CNY', 45000, '员工工资', '工行公账', '', '', '工资支出', '陈会计', '2月仓库员工工资');
  addRecord(d, '14:00', 'OUT', 12800, 'CNY', 12800, '社保费', '工行公账', '', '', '社保支出', '陈会计', '2月社保公积金');
  addRecord(d, '14:20', 'OUT', 8500, 'CNY', 8500, '仓租水电', '兴业公账', '', '', '仓储支出', '陈会计', '广州仓2月仓租+水电');
  addRecord(d, '14:45', 'IN', 1800, 'USD', 13140, '美金运费到账', '工行美金', 'S-JOB260200715', 'S-20260207000133', '运费收入', '李明', '空运小包运费 汇率7.3');
  addRecord(d, '15:10', 'OUT', 1200, 'CNY', 1200, '办公用品', '微信', '', '', '办公支出', '赵敏', '打印纸、墨盒等');
  addRecord(d, '15:30', 'IN', 7600, 'CNY', 7600, '支付宝收款', '个人支付宝', 'S-JOB260200910', 'S-20260209000151', '运费收入', '赵敏', '个人客户运费');
  addRecord(d, '16:00', 'OUT', 150, 'CNY', 150, '银行手续费', '工行公账', '', '', '财务费用', '陈会计', '转账手续费');
  addRecord(d, '16:20', 'OUT', 3500, 'CNY', 3500, '空运费', '农行', 'S-JOB260200911', 'S-20260209000148', '空运支出', '陈会计', 'CZ空运费');
  addRecord(d, '16:45', 'IN', 22000, 'CNY', 22000, '收到运费(广州银行)', '广州银行', 'S-JOB260200912', 'S-20260209000152', '运费收入', '王芳', '整柜客户运费结算');

  // ===== 2026-02 其他日期 (月视图) =====
  const febDays = [
    { day: '01', inAmt: 35000, outAmt: 22000, count: 8 },
    { day: '02', inAmt: 28000, outAmt: 18000, count: 6 },
    { day: '03', inAmt: 42000, outAmt: 31000, count: 10 },
    { day: '04', inAmt: 19000, outAmt: 15000, count: 5 },
    { day: '05', inAmt: 55000, outAmt: 40000, count: 12 },
    { day: '06', inAmt: 38000, outAmt: 25000, count: 9 },
    { day: '07', inAmt: 31000, outAmt: 28000, count: 7 },
    { day: '08', inAmt: 46000, outAmt: 34000, count: 11 },
  ];
  const operators = ['王芳', '李明', '陈会计', '赵敏'];
  const inSources = ['收到运费(微信)', '收到运费(广州银行)', 'LOS到付款回款', '公众号收款', '支付宝收款'];
  const outSources = ['支付顶派运费', '支付阿米拉运费', '拖车费', '报关费', '仓租水电'];
  const inChannels = ['微信', '广州银行', '兴业公账', '公众号', '企业支付宝'];
  const outChannels = ['工行公账', '兴业公账', '兴业29113', '农行', '工行7882'];
  const inCategories = ['运费收入', '运费收入', '运费收入', '运费收入', '运费收入'];
  const outCategories = ['派送支出', '海运支出', '拖车支出', '报关支出', '仓储支出'];

  febDays.forEach(({ day, inAmt, outAmt, count }) => {
    const date = `2026-02-${day}`;
    const inCount = Math.ceil(count * 0.55);
    const outCount = count - inCount;
    const inPer = Math.round(inAmt / inCount);
    const outPer = Math.round(outAmt / outCount);
    for (let i = 0; i < inCount; i++) {
      const h = 8 + Math.floor((i / inCount) * 9);
      const m = Math.floor(Math.random() * 60);
      const idx = i % inSources.length;
      addRecord(date, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        'IN', inPer + (i % 3) * 500, 'CNY', inPer + (i % 3) * 500,
        inSources[idx], inChannels[idx],
        `S-JOB26020${day}${String(i + 1).padStart(2, '0')}`,
        `S-202602${day}${String(100 + id % 60).padStart(6, '0')}`,
        inCategories[idx], operators[i % operators.length]);
    }
    for (let i = 0; i < outCount; i++) {
      const h = 9 + Math.floor((i / outCount) * 8);
      const m = Math.floor(Math.random() * 60);
      const idx = i % outSources.length;
      addRecord(date, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        'OUT', outPer + (i % 2) * 300, 'CNY', outPer + (i % 2) * 300,
        outSources[idx], outChannels[idx],
        `S-JOB26020${day}${String(i + 20).padStart(2, '0')}`,
        `S-202602${day}${String(100 + id % 60).padStart(6, '0')}`,
        outCategories[idx], operators[i % operators.length]);
    }
  });

  // ===== 2026-01 及其他月份 (年视图) =====
  const otherMonths = [
    { month: '01', inTotal: 580000, outTotal: 420000, daysWithData: 22 },
    { month: '03', inTotal: 0, outTotal: 0, daysWithData: 0 }, // future placeholder, skip
  ];
  otherMonths.forEach(({ month, inTotal, outTotal, daysWithData }) => {
    if (daysWithData === 0) return;
    const inPerDay = Math.round(inTotal / daysWithData);
    const outPerDay = Math.round(outTotal / daysWithData);
    for (let d = 1; d <= daysWithData; d++) {
      const date = `2026-${month}-${String(d).padStart(2, '0')}`;
      addRecord(date, '10:00', 'IN', inPerDay, 'CNY', inPerDay,
        '运费收入汇总', '工行公账',
        `S-JOB26${month}${String(d).padStart(2, '0')}01`,
        `S-2026${month}${String(d).padStart(2, '0')}${String(200 + d).padStart(6, '0')}`,
        '运费收入', '王芳');
      addRecord(date, '14:00', 'OUT', outPerDay, 'CNY', outPerDay,
        '运营支出汇总', '兴业公账',
        `S-JOB26${month}${String(d).padStart(2, '0')}02`,
        `S-2026${month}${String(d).padStart(2, '0')}${String(200 + d).padStart(6, '0')}`,
        '海运支出', '陈会计');
    }
  });

  return records;
};

const MOCK_CASH_FLOW_DATA = generateMockCashFlow();

// ==================== 常量 ====================

const CHANNELS = ['工行公账', '工行7882', '工行美金', '兴业公账', '兴业29113', '农行', '广州银行', '微信', '公众号', '企业支付宝', '个人支付宝'];

const CATEGORIES = ['运费收入', '到付回款', '供应商付款', '工资', '社保', '仓租', '办公费', '手续费', '其他'];

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
};

const EXCHANGE_RATES: Record<string, number> = {
  CNY: 1,
  USD: 7.3,
  EUR: 7.9,
};

const formatMoney = (value: number): string => {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const BASE_BALANCE = 0;

// ==================== 组件 ====================

export const CashFlowDaily: React.FC = () => {
  const [cashFlowData, setCashFlowData] = useState<CashFlowRecord[]>(MOCK_CASH_FLOW_DATA);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(dayjs('2026-02-09'));
  const [selectedMonth, setSelectedMonth] = useState(dayjs('2026-02'));
  const [selectedYear, setSelectedYear] = useState(dayjs('2026'));
  const [directionFilter, setDirectionFilter] = useState<string>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState<number | null>(null);
  const [maxAmount, setMaxAmount] = useState<number | null>(null);
  const [channelFilter, setChannelFilter] = useState<string[]>([]);

  // 新增流水 Modal 状态
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();

  // 导入 Modal 状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importType, setImportType] = useState<string>('');
  const [importChannel, setImportChannel] = useState<string | undefined>(undefined);

  // ID 计数器
  const [nextId, setNextId] = useState(cashFlowData.length + 1);

  const handleReset = () => {
    setDirectionFilter('ALL');
    setCurrencyFilter('ALL');
    setMinAmount(null);
    setMaxAmount(null);
    setChannelFilter([]);
  };

  // ===== 新增流水 =====
  const handleAddRecord = () => {
    addForm.validateFields().then((values) => {
      const now = dayjs().format('YYYY-MM-DD HH:mm');
      const currency = values.currency || 'CNY';
      const amount = values.amount as number;
      const rate = EXCHANGE_RATES[currency] || 1;
      const amountCNY = currency === 'CNY' ? amount : Math.round(amount * rate * 100) / 100;
      const newRecord: CashFlowRecord = {
        id: `CF${String(nextId).padStart(4, '0')}`,
        time: now,
        direction: values.direction,
        amount,
        currency,
        amountCNY,
        source: values.source,
        channel: values.channel,
        relatedNo: values.relatedNo || '',
        relatedOrderNo: values.relatedOrderNo || '',
        category: values.category,
        operator: '当前用户',
        remark: values.remark || undefined,
      };
      setCashFlowData((prev) => [newRecord, ...prev]);
      setNextId((prev) => prev + 1);
      setAddModalVisible(false);
      addForm.resetFields();
      message.success('流水记录添加成功');
    });
  };

  // ===== 导入流水 =====
  const handleOpenImport = (type: string) => {
    setImportType(type);
    setImportChannel(undefined);
    setImportModalVisible(true);
  };

  const handleImportConfirm = () => {
    if (!importChannel) {
      message.warning('请选择导入渠道');
      return;
    }
    const now = dayjs();
    const newRecords: CashFlowRecord[] = [];
    const mockImportSources = importType === '银行流水'
      ? ['转入-客户回款', '转出-供应商付款', '转入-利息', '转出-手续费', '转入-运费收入']
      : importType === '微信明细'
      ? ['微信收款-运费', '微信付款-采购', '微信收款-散货', '微信付款-快递', '微信收款-代收']
      : ['支付宝收款-运费', '支付宝付款-仓租', '支付宝收款-代收', '支付宝付款-办公', '支付宝收款-散货'];
    const mockCategories = ['运费收入', '供应商付款', '手续费', '运费收入', '到付回款'];

    for (let i = 0; i < 5; i++) {
      const direction: 'IN' | 'OUT' = i % 3 === 1 ? 'OUT' : 'IN';
      const amount = Math.round((Math.random() * 20000 + 1000) * 100) / 100;
      const hour = 8 + Math.floor(Math.random() * 10);
      const minute = Math.floor(Math.random() * 60);
      const timeStr = `${now.format('YYYY-MM-DD')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      newRecords.push({
        id: `CF${String(nextId + i).padStart(4, '0')}`,
        time: timeStr,
        direction,
        amount,
        currency: 'CNY',
        amountCNY: amount,
        source: mockImportSources[i],
        channel: importChannel,
        relatedNo: `IMP-${now.format('YYYYMMDD')}-${String(i + 1).padStart(3, '0')}`,
        relatedOrderNo: '',
        category: mockCategories[i],
        operator: '系统导入',
        remark: `${importType}导入`,
      });
    }
    setCashFlowData((prev) => [...newRecords, ...prev]);
    setNextId((prev) => prev + 5);
    setImportModalVisible(false);
    message.success('成功导入 5 条记录');
  };

  // ===== 删除流水 =====
  const handleDeleteRecord = (id: string) => {
    setCashFlowData((prev) => prev.filter((r) => r.id !== id));
    message.success('删除成功');
  };

  // ===== 按日：筛选当天明细 =====
  const dayRecords = useMemo(() => {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    let data = cashFlowData.filter((r) => r.time.startsWith(dateStr));
    if (directionFilter !== 'ALL') data = data.filter((r) => r.direction === directionFilter);
    if (currencyFilter !== 'ALL') data = data.filter((r) => r.currency === currencyFilter);
    if (minAmount !== null) data = data.filter((r) => r.amountCNY >= minAmount);
    if (maxAmount !== null) data = data.filter((r) => r.amountCNY <= maxAmount);
    if (channelFilter.length > 0) data = data.filter((r) => channelFilter.includes(r.channel));
    data.sort((a, b) => (a.time > b.time ? -1 : 1));
    return data;
  }, [selectedDate, cashFlowData, directionFilter, currencyFilter, minAmount, maxAmount, channelFilter]);

  const dayStats = useMemo(() => {
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const all = cashFlowData.filter((r) => r.time.startsWith(dateStr));
    const income = all.filter((r) => r.direction === 'IN').reduce((s, r) => s + r.amountCNY, 0);
    const expense = all.filter((r) => r.direction === 'OUT').reduce((s, r) => s + r.amountCNY, 0);
    return { income, expense, net: income - expense, count: all.length };
  }, [selectedDate, cashFlowData]);

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
  }, [selectedMonth, cashFlowData]);

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
  }, [selectedYear, cashFlowData]);

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
  }, [selectedDate, cashFlowData]);

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
    { title: '渠道', dataIndex: 'channel', key: 'channel', width: 120, render: (val: string) => <Tag>{val}</Tag> },
    { title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 170, render: (val: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{val}</Text> },
    { title: '关联订单', dataIndex: 'relatedOrderNo', key: 'relatedOrderNo', width: 140, render: (val: string) => val ? <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{val}</Text> : <Text type="secondary">-</Text> },
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
    {
      title: '操作', key: 'action', width: 80, align: 'center' as const, fixed: 'right' as const,
      render: (_: unknown, record: CashFlowRecord) => (
        <Popconfirm
          title="确认删除"
          description="确定要删除这条流水记录吗？"
          onConfirm={() => handleDeleteRecord(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
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
            <Space align="center">
              <Text>渠道：</Text>
              <Select
                mode="multiple"
                value={channelFilter}
                onChange={setChannelFilter}
                placeholder="全部渠道"
                style={{ minWidth: 200 }}
                allowClear
                maxTagCount="responsive"
                options={CHANNELS.map((ch) => ({ label: ch, value: ch }))}
              />
            </Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>新增流水</Button>
            <Button icon={<UploadOutlined />} onClick={() => handleOpenImport('银行流水')}>导入银行流水</Button>
            <Button icon={<UploadOutlined />} onClick={() => handleOpenImport('微信明细')}>导入微信明细</Button>
            <Button icon={<UploadOutlined />} onClick={() => handleOpenImport('支付宝明细')}>导入支付宝明细</Button>
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
              scroll={{ x: 1400 }}
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

      {/* 新增流水 Modal */}
      <Modal
        title="新增流水"
        open={addModalVisible}
        onOk={handleAddRecord}
        onCancel={() => { setAddModalVisible(false); addForm.resetFields(); }}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" initialValues={{ currency: 'CNY' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="direction" label="方向" rules={[{ required: true, message: '请选择方向' }]}>
                <Select placeholder="请选择" options={[{ label: '收入', value: 'IN' }, { label: '支出', value: 'OUT' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入金额" precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="currency" label="币种">
                <Select options={[{ label: 'CNY', value: 'CNY' }, { label: 'USD', value: 'USD' }, { label: 'EUR', value: 'EUR' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="channel" label="渠道" rules={[{ required: true, message: '请选择渠道' }]}>
                <Select placeholder="请选择渠道" options={CHANNELS.map((ch) => ({ label: ch, value: ch }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source" label="来源/去向" rules={[{ required: true, message: '请输入来源/去向' }]}>
                <Input placeholder="请输入来源/去向" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
                <Select placeholder="请选择分类" options={CATEGORIES.map((c) => ({ label: c, value: c }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="relatedNo" label="关联单号">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="relatedOrderNo" label="关联订单">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="选填备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入 Modal */}
      <Modal
        title={`导入${importType}`}
        open={importModalVisible}
        onOk={handleImportConfirm}
        onCancel={() => setImportModalVisible(false)}
        okText="确认导入"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text>导入渠道：</Text>
          <Select
            value={importChannel}
            onChange={setImportChannel}
            placeholder="请选择导入数据所属渠道"
            style={{ width: '100%', marginTop: 8 }}
            options={CHANNELS.map((ch) => ({ label: ch, value: ch }))}
          />
        </div>
        <Dragger
          accept=".xlsx,.xls,.csv"
          maxCount={1}
          beforeUpload={() => false}
          style={{ marginBottom: 8 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 .xlsx、.xls、.csv 格式</p>
        </Dragger>
        <Text type="secondary" style={{ fontSize: 12 }}>
          提示：这是演示模式，确认导入后将生成 5 条模拟数据
        </Text>
      </Modal>
    </div>
  );
};
