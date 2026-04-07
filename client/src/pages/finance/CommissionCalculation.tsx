import React, { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Tag, Typography, message,
} from 'antd';
import { CalculatorOutlined, DownloadOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { authApi, commissionApi, orderApi } from '../../api';

const { Text } = Typography;
type Currency = 'CNY';
type OfficeType = 'GUANGZHOU' | 'NIGERIA';
type PlanType = 'PLAN_A_ABCD' | 'PLAN_B_SEA_VETERAN' | 'PLAN_C_NIGERIA_SEA' | 'PLAN_D_NIGERIA_AIR';

interface SalesUser { id: string; username: string; realName: string; role?: string; }
interface CommissionRule { id: string; planType: PlanType; planName: string; office: OfficeType; businessType: 'AIR' | 'SEA' | 'BOTH'; status: 'ACTIVE' | 'INACTIVE'; config?: any; }
interface BonusConfig { triggerWeightKg: number; bonusAmount: number; minPersonalWeightKg: number; minQualifiedCount: number; }
interface CommissionResult {
  employeeId: string; employeeName: string; office: OfficeType; orderCount: number; totalFreight: number;
  totalWeight: number; badDebtAmount: number; ruleName: string; planType: PlanType | '-';
  qualified: boolean; commissionAmount: number; bonusAmount: number; finalAmount: number; currency: Currency;
}

const PLAN_LABELS: Record<PlanType, string> = { PLAN_A_ABCD: '方案A', PLAN_B_SEA_VETERAN: '方案B', PLAN_C_NIGERIA_SEA: '方案C', PLAN_D_NIGERIA_AIR: '方案D' };
const SALES_PERSONS = ['黄颖', '三凤', '吕沛霖', '朱小飞', '罗伟健', '苏慧琪', '罗珮文', '曾永平', '陆梓龙', '谭小瑜', '吴敏琪', '浦海森'];
const DEST_LIST = ['LOS', 'ACC', 'NBO', '越南', 'LLW', 'TNR', 'OTP', 'FBM', 'MPM', 'DAR'];

function toNumber(value: any): number { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function inferOffice(user: SalesUser): OfficeType { const role = String(user.role || '').toUpperCase(); return role.includes('US') || role.includes('NIGERIA') ? 'NIGERIA' : 'GUANGZHOU'; }
function pickRule(rules: CommissionRule[], office: OfficeType) { return rules.find(r => r.office === office && r.status === 'ACTIVE') || null; }

function calcByRule(rule: CommissionRule | null, totalFreight: number, totalWeight: number, orderCount: number, totalVolume: number) {
  if (!rule) return { qualified: false, commissionAmount: 0 };
  const cfg = rule.config || {};
  if (rule.planType === 'PLAN_A_ABCD') {
    const baseTickets = toNumber(cfg.baseTickets); const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
    const qualified = orderCount >= baseTickets && baseTickets > 0;
    if (!qualified) return { qualified, commissionAmount: 0 };
    const step = baseTickets > 0 ? Math.floor((orderCount - baseTickets) / baseTickets) : 0;
    const tier = tiers[Math.max(0, Math.min(step, tiers.length - 1))] || { pricePerTicket: 0, profitRate: 0 };
    return { qualified, commissionAmount: orderCount * toNumber(tier.pricePerTicket) + Math.max(totalFreight - baseTickets * 100, 0) * toNumber(tier.profitRate) };
  }
  if (rule.planType === 'PLAN_B_SEA_VETERAN') {
    const baseTask = toNumber(cfg.baseTask); const bp = toNumber(cfg.tierBreakpoint); const lr = toNumber(cfg.lowerRate); const ur = toNumber(cfg.upperRate);
    const qualified = totalFreight >= baseTask && baseTask > 0;
    return qualified ? { qualified, commissionAmount: Math.min(totalFreight, bp) * lr + Math.max(totalFreight - bp, 0) * ur } : { qualified, commissionAmount: 0 };
  }
  if (rule.planType === 'PLAN_C_NIGERIA_SEA') {
    const baseTask = toNumber(cfg.baseTaskCBM); const tiers = Array.isArray(cfg.tiers) ? [...cfg.tiers].sort((a: any, b: any) => toNumber(a.threshold) - toNumber(b.threshold)) : [];
    const qualified = totalVolume >= baseTask && baseTask > 0;
    if (!qualified) return { qualified, commissionAmount: 0 };
    let unitPrice = 0; for (const t of tiers) { if (totalVolume >= toNumber(t.threshold)) unitPrice = toNumber(t.unitPrice); }
    return { qualified, commissionAmount: totalVolume * unitPrice };
  }
  if (rule.planType === 'PLAN_D_NIGERIA_AIR') {
    const baseTask = toNumber(cfg.baseTaskKg); const tiers = Array.isArray(cfg.tiers) ? [...cfg.tiers].sort((a: any, b: any) => toNumber(a.threshold) - toNumber(b.threshold)) : [];
    const qualified = totalWeight >= baseTask && baseTask > 0;
    if (!qualified) return { qualified, commissionAmount: 0 };
    const excess = Math.max(totalWeight - baseTask, 0); let unitPrice = 0;
    for (const t of tiers) { if (excess >= toNumber(t.threshold)) unitPrice = toNumber(t.unitPrice); }
    return { qualified, commissionAmount: excess * unitPrice };
  }
  return { qualified: false, commissionAmount: 0 };
}

const fmt = (v: number) => `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ===== Mock 空运提成汇总数据 =====
interface AirCommRow { name: string; [key: string]: any; }
const generateAirCommSummary = (month: string): AirCommRow[] => {
  const activeDests = Math.random() > 0.5 ? ['LOS', 'ACC', 'NBO'] : ['LOS', 'ACC', 'NBO', '越南'];
  return SALES_PERSONS.slice(0, 8 + Math.floor(Math.random() * 3)).map(name => {
    const row: AirCommRow = { name, key: name };
    let totalCount = 0, totalProfit = 0;
    activeDests.forEach(dest => {
      const count = dest === 'LOS' ? 80 + Math.floor(Math.random() * 200) : Math.floor(Math.random() * 10);
      const profit = dest === 'LOS' ? 10000 + Math.random() * 100000 : Math.random() * 15000;
      row[`${dest}_count`] = count;
      row[`${dest}_profit`] = +profit.toFixed(2);
      totalCount += count;
      totalProfit += profit;
    });
    row.totalCount = totalCount;
    row.totalProfit = +totalProfit.toFixed(2);
    row.baseCount = 50;
    row.baseProfit = 15000;
    row.commissionCount = totalCount - 50;
    row._dests = activeDests;
    return row;
  });
};

// ===== Mock 海运提成汇总数据 =====
interface SeaCommRow {
  key: string; name: string; losProfit: number; totalVolume: number;
  tierBase: number; tierCalc: number; tierRate: number; tierAmount: number;
  highBase: number; highCalc: number; highRate: number; highAmount: number;
  totalCommission: number; remark: string;
}
const generateSeaCommSummary = (): SeaCommRow[] => {
  const names = ['黄颖', '三凤', '朱小飞', '吕沛霖', '陆梓龙', '苏慧琪', '罗珮文', '浦海森'];
  const rates: Record<string, number> = { '黄颖': 0.4, '三凤': 0.15, '朱小飞': 0.15, '吕沛霖': 0.4, '陆梓龙': 0.4, '苏慧琪': 0, '罗珮文': 0, '浦海森': 0.4 };
  const bases: Record<string, number> = { '黄颖': 6000, '三凤': 3000, '朱小飞': 3000, '吕沛霖': 6000, '陆梓龙': 0, '苏慧琪': 0, '罗珮文': 0, '浦海森': 6000 };
  return names.map(name => {
    const losProfit = +(5000 + Math.random() * 50000).toFixed(2);
    const totalVolume = +(5 + Math.random() * 280).toFixed(4);
    const base = bases[name] || 6000;
    const rate = rates[name] || 0;
    const tierCalc = Math.max(losProfit - base, 0);
    const tierAmount = +(Math.min(tierCalc, 35000 - base) * rate).toFixed(2);
    const highCalc = Math.max(losProfit - 35000, 0);
    const highAmount = +(highCalc * 0.5).toFixed(2);
    const totalCommission = +(tierAmount + (losProfit > 35000 ? highAmount : 0)).toFixed(2);
    return {
      key: name, name, losProfit, totalVolume, tierBase: base,
      tierCalc: +tierCalc.toFixed(2), tierRate: rate, tierAmount,
      highBase: 35000, highCalc: +highCalc.toFixed(2), highRate: 0.5, highAmount,
      totalCommission: Math.max(totalCommission, 0),
      remark: name === '陆梓龙' ? '无基数要求' : tierCalc <= 0 ? `不够基数，下月基数补${Math.abs(tierCalc).toFixed(0)}` : '',
    };
  });
};

// ==================== 空运提成汇总 ====================
export const AirCommissionSummary: React.FC = () => {
  const [month, setMonth] = useState(dayjs('2024-06'));
  const data = useMemo(() => generateAirCommSummary(month.format('YYYY-MM')), [month]);
  const activeDests = useMemo(() => data.length > 0 ? (data[0]._dests as string[]) : ['LOS'], [data]);

  const columns: any[] = [
    { title: '姓名', dataIndex: 'name', width: 80, fixed: 'left' as const },
  ];
  activeDests.forEach(dest => {
    columns.push({
      title: dest, children: [
        { title: '票数', dataIndex: `${dest}_count`, width: 70, align: 'right' as const },
        { title: '毛利', dataIndex: `${dest}_profit`, width: 110, align: 'right' as const, render: (v: number) => v ? fmt(v) : '-' },
      ]
    });
  });
  columns.push(
    { title: '合计', children: [
      { title: '票数', dataIndex: 'totalCount', width: 80, align: 'right' as const, render: (v: number) => <b>{v}</b> },
      { title: '毛利', dataIndex: 'totalProfit', width: 120, align: 'right' as const, render: (v: number) => <b style={{ color: '#52c41a' }}>{fmt(v)}</b> },
    ]},
    { title: '基数票数', dataIndex: 'baseCount', width: 80, align: 'right' as const },
    { title: '基数毛利', dataIndex: 'baseProfit', width: 100, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '提成计数', dataIndex: 'commissionCount', width: 80, align: 'right' as const },
  );

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <DatePicker picker="month" value={month} onChange={v => v && setMonth(v)} allowClear={false} />
          <Button icon={<DownloadOutlined />}>导出Excel</Button>
        </Space>
      </Card>
      <Card>
        <Table rowKey="key" columns={columns} dataSource={data} bordered size="small" scroll={{ x: 1200 }} pagination={false}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><b>合计</b></Table.Summary.Cell>
                {activeDests.map((dest, i) => (
                  <React.Fragment key={dest}>
                    <Table.Summary.Cell index={i * 2 + 1} align="right"><b>{data.reduce((s, r) => s + (r[`${dest}_count`] || 0), 0)}</b></Table.Summary.Cell>
                    <Table.Summary.Cell index={i * 2 + 2} align="right"><b>{fmt(data.reduce((s, r) => s + (r[`${dest}_profit`] || 0), 0))}</b></Table.Summary.Cell>
                  </React.Fragment>
                ))}
                <Table.Summary.Cell index={90} align="right"><b>{data.reduce((s, r) => s + r.totalCount, 0)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={91} align="right"><b style={{ color: '#52c41a' }}>{fmt(data.reduce((s, r) => s + r.totalProfit, 0))}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={92} colSpan={3} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>
    </div>
  );
};

// ==================== 海运提成汇总 ====================
export const SeaCommissionSummary: React.FC = () => {
  const [month, setMonth] = useState(dayjs('2024-06'));
  const data = useMemo(() => generateSeaCommSummary(), [month]);

  const columns: any[] = [
    { title: '姓名', dataIndex: 'name', width: 80, fixed: 'left' as const },
    { title: 'LOS毛利', dataIndex: 'losProfit', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '计费体积(m³)', dataIndex: 'totalVolume', width: 110, align: 'right' as const, render: (v: number) => v.toFixed(4) },
    { title: '6千-3.5万', children: [
      { title: '基数', dataIndex: 'tierBase', width: 80, align: 'right' as const, render: (v: number) => v.toLocaleString() },
      { title: '提成计数', dataIndex: 'tierCalc', width: 100, align: 'right' as const, render: (v: number) => fmt(v) },
      { title: '提成点数', dataIndex: 'tierRate', width: 80, align: 'right' as const, render: (v: number) => v > 0 ? `${(v * 100).toFixed(0)}%` : '-' },
      { title: '提成金额', dataIndex: 'tierAmount', width: 110, align: 'right' as const, render: (v: number) => fmt(v) },
    ]},
    { title: '3.5万以上', children: [
      { title: '基数', dataIndex: 'highBase', width: 80, align: 'right' as const, render: (v: number) => v.toLocaleString() },
      { title: '提成计数', dataIndex: 'highCalc', width: 100, align: 'right' as const, render: (v: number) => v > 0 ? fmt(v) : '-' },
      { title: '提成点数', dataIndex: 'highRate', width: 80, align: 'right' as const, render: () => '50%' },
      { title: '提成金额', dataIndex: 'highAmount', width: 110, align: 'right' as const, render: (v: number) => v > 0 ? fmt(v) : '-' },
    ]},
    { title: '合计提成', dataIndex: 'totalCommission', width: 130, align: 'right' as const, fixed: 'right' as const, render: (v: number) => <b style={{ color: '#52c41a' }}>{fmt(v)}</b> },
    { title: '备注', dataIndex: 'remark', width: 200 },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <DatePicker picker="month" value={month} onChange={v => v && setMonth(v)} allowClear={false} />
          <Button icon={<DownloadOutlined />}>导出Excel</Button>
        </Space>
      </Card>
      <Card>
        <Table rowKey="key" columns={columns} dataSource={data} bordered size="small" scroll={{ x: 1600 }} pagination={false}
          summary={() => (
            <Table.Summary>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}><b>合计</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><b>{fmt(data.reduce((s, r) => s + r.losProfit, 0))}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right"><b>{data.reduce((s, r) => s + r.totalVolume, 0).toFixed(4)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={3} colSpan={8} />
                <Table.Summary.Cell index={11} align="right"><b style={{ color: '#52c41a' }}>{fmt(data.reduce((s, r) => s + r.totalCommission, 0))}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={12} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
        <div style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
          <p>提成规则说明：</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>基本任务：毛利不足基数的不计提成，差额累计到下月</li>
            <li>6千-3.5万：黄颖/吕沛霖/浦海森/陆总按40%，三凤/朱小飞按15%</li>
            <li>3.5万以上：按50%提成</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

// ==================== 提成计算(数据库) ====================
export const CommissionCalculation: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [bonusConfig, setBonusConfig] = useState<BonusConfig | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [results, setResults] = useState<CommissionResult[]>([]);

  const fetchBaseData = async () => {
    setLoading(true);
    try {
      const [usersRes, rulesRes, bonusRes]: any[] = await Promise.all([authApi.listUsers(), commissionApi.listRules({ status: 'ACTIVE' }), commissionApi.getBonus()]);
      const users = Array.isArray(usersRes?.data) ? usersRes.data : [];
      const sales = users.filter((u: any) => String(u.role || '').toUpperCase() === 'SALES' || !u.role)
        .map((u: any) => ({ id: String(u.id), username: String(u.username || ''), realName: String(u.realName || u.username || u.id), role: u.role }));
      setSalesUsers(sales); setRules(Array.isArray(rulesRes?.data) ? rulesRes.data : []); setBonusConfig(bonusRes?.data || null);
      setSelectedEmployees(prev => prev.length ? prev : sales.slice(0, 3).map((u: SalesUser) => u.id));
    } catch (err: any) { message.error(err?.message || '加载提成基础数据失败'); setSalesUsers([]); setRules([]); setBonusConfig(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchBaseData(); }, []);

  const handleCalculate = async () => {
    if (!selectedEmployees.length) { message.warning('请先选择员工'); return; }
    setCalcLoading(true);
    try {
      const monthStart = selectedMonth.startOf('month').format('YYYY-MM-DD HH:mm:ss');
      const monthEnd = selectedMonth.endOf('month').format('YYYY-MM-DD HH:mm:ss');
      const ordersRes: any = await orderApi.listMaster({ page: 1, pageSize: 10000, startDate: monthStart, endDate: monthEnd });
      const allOrders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
      const rows: CommissionResult[] = selectedEmployees.map(employeeId => {
        const emp = salesUsers.find(u => u.id === employeeId);
        const office = emp ? inferOffice(emp) : 'GUANGZHOU';
        const employeeName = emp?.realName || employeeId;
        const username = String(emp?.username || '').toLowerCase();
        const realName = String(emp?.realName || '').toLowerCase();
        const employeeOrders = allOrders.filter((o: any) => { const sp = String(o.salesPerson || '').toLowerCase(); return sp && (sp === username || sp === realName || sp.includes(realName)); });
        const orderCount = employeeOrders.length;
        const totalFreight = employeeOrders.reduce((s: number, o: any) => s + toNumber(o.totalFreight), 0);
        const totalWeight = employeeOrders.reduce((s: number, o: any) => s + toNumber(o.totalWeight), 0);
        const totalVolume = employeeOrders.reduce((s: number, o: any) => s + toNumber(o.totalVolume), 0);
        const badDebtAmount = employeeOrders.reduce((s: number, o: any) => { if (String(o.paymentStatus || '').toUpperCase() === 'PAID') return s; return s + Math.max(toNumber(o.totalFreight) - toNumber(o.paidAmount), 0); }, 0);
        const rule = pickRule(rules, office);
        const calc = calcByRule(rule, totalFreight, totalWeight, orderCount, totalVolume);
        const commissionAmount = Math.max(calc.commissionAmount, 0);
        return { employeeId, employeeName, office, orderCount, totalFreight, totalWeight, badDebtAmount, ruleName: rule?.planName || '未配置规则', planType: (rule?.planType || '-') as PlanType | '-', qualified: calc.qualified, commissionAmount, bonusAmount: 0, finalAmount: Math.max(commissionAmount - badDebtAmount, 0), currency: 'CNY' as Currency };
      });
      if (bonusConfig) {
        const qualifiedRows = rows.filter(r => r.qualified && r.totalWeight >= toNumber(bonusConfig.minPersonalWeightKg));
        const totalQW = qualifiedRows.reduce((s, r) => s + r.totalWeight, 0);
        if (totalQW >= toNumber(bonusConfig.triggerWeightKg) && qualifiedRows.length >= toNumber(bonusConfig.minQualifiedCount) && totalQW > 0) {
          const pool = toNumber(bonusConfig.bonusAmount);
          rows.forEach(row => { const t = qualifiedRows.find(q => q.employeeId === row.employeeId); if (!t) return; const bonus = pool * (t.totalWeight / totalQW); row.bonusAmount = bonus; row.finalAmount += bonus; });
        }
      }
      setResults(rows); message.success(`已完成 ${rows.length} 位员工提成计算`);
    } catch (err: any) { message.error(err?.message || '提成计算失败'); setResults([]); }
    finally { setCalcLoading(false); }
  };

  const stats = useMemo(() => ({
    totalEmployees: results.length, totalCommission: results.reduce((s, r) => s + r.finalAmount, 0),
    qualified: results.filter(r => r.qualified).length, totalBadDebt: results.reduce((s, r) => s + r.badDebtAmount, 0),
  }), [results]);

  const columns = [
    { title: '员工', key: 'employee', width: 180, render: (_: unknown, row: CommissionResult) => <Space direction="vertical" size={0}><Text strong>{row.employeeName}</Text><Text type="secondary" style={{ fontSize: 12 }}>{row.employeeId}</Text></Space> },
    { title: '归属', dataIndex: 'office', width: 100, render: (v: OfficeType) => <Tag>{v === 'NIGERIA' ? '尼日利亚' : '广州'}</Tag> },
    { title: '订单数', dataIndex: 'orderCount', width: 90, align: 'right' as const },
    { title: '运费总额', dataIndex: 'totalFreight', width: 130, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '重量(kg)', dataIndex: 'totalWeight', width: 110, align: 'right' as const, render: (v: number) => v.toFixed(2) },
    { title: '方案', key: 'rule', width: 220, render: (_: unknown, row: CommissionResult) => <Space direction="vertical" size={0}><Text>{row.ruleName}</Text><Text type="secondary" style={{ fontSize: 12 }}>{row.planType === '-' ? '-' : PLAN_LABELS[row.planType]}</Text></Space> },
    { title: '达标', dataIndex: 'qualified', width: 90, render: (v: boolean) => <Tag color={v ? 'success' : 'error'}>{v ? '达标' : '未达标'}</Tag> },
    { title: '坏账扣减', dataIndex: 'badDebtAmount', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '提成小计', dataIndex: 'commissionAmount', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '彩蛋奖金', dataIndex: 'bonusAmount', width: 120, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '最终实发', dataIndex: 'finalAmount', width: 140, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#f5222d' }}>{fmt(v)}</Text> },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="已计算员工" value={stats.totalEmployees} prefix={<UserOutlined />} suffix="人" /></Card></Col>
        <Col span={6}><Card><Statistic title="提成总额" value={stats.totalCommission} precision={2} prefix="¥" valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="达标人数" value={stats.qualified} suffix={`/ ${stats.totalEmployees}`} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="坏账扣减" value={stats.totalBadDebt} precision={2} prefix="¥" valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>
      <Card style={{ marginBottom: 16 }} loading={loading}>
        <Space wrap>
          <Select mode="multiple" value={selectedEmployees} onChange={setSelectedEmployees} style={{ minWidth: 360 }} placeholder="选择员工" optionFilterProp="label" showSearch
            options={salesUsers.map(u => ({ value: u.id, label: `${u.realName} (${u.username})` }))} />
          <DatePicker picker="month" value={selectedMonth} onChange={v => setSelectedMonth(v || dayjs())} allowClear={false} />
          <Button type="primary" icon={<CalculatorOutlined />} loading={calcLoading} onClick={handleCalculate}>执行计算</Button>
          <Button onClick={fetchBaseData}>刷新基础数据</Button>
        </Space>
      </Card>
      {bonusConfig && (
        <Card style={{ marginBottom: 16 }}>
          <Space><Tag color="gold">彩蛋奖金规则</Tag><Text type="secondary">触发总重量 {toNumber(bonusConfig.triggerWeightKg).toLocaleString()}kg，奖金池 ¥{toNumber(bonusConfig.bonusAmount).toLocaleString()}，个人最低 {toNumber(bonusConfig.minPersonalWeightKg).toLocaleString()}kg，最少 {toNumber(bonusConfig.minQualifiedCount)} 人</Text></Space>
        </Card>
      )}
      <Card title={`${selectedMonth.format('YYYY-MM')} 月度提成结果`}>
        <Table rowKey="employeeId" columns={columns} dataSource={results} size="small" pagination={{ pageSize: 10 }} scroll={{ x: 1420 }} />
      </Card>
    </div>
  );
};
