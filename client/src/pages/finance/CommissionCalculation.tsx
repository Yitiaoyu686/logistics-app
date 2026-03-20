import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { CalculatorOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { authApi, commissionApi, orderApi } from '../../api';

const { Text } = Typography;

type Currency = 'CNY';
type OfficeType = 'GUANGZHOU' | 'NIGERIA';

type PlanType = 'PLAN_A_ABCD' | 'PLAN_B_SEA_VETERAN' | 'PLAN_C_NIGERIA_SEA' | 'PLAN_D_NIGERIA_AIR';

interface SalesUser {
  id: string;
  username: string;
  realName: string;
  role?: string;
}

interface CommissionRule {
  id: string;
  planType: PlanType;
  planName: string;
  office: OfficeType;
  businessType: 'AIR' | 'SEA' | 'BOTH';
  status: 'ACTIVE' | 'INACTIVE';
  config?: any;
}

interface BonusConfig {
  triggerWeightKg: number;
  bonusAmount: number;
  minPersonalWeightKg: number;
  minQualifiedCount: number;
}

interface CommissionResult {
  employeeId: string;
  employeeName: string;
  office: OfficeType;
  orderCount: number;
  totalFreight: number;
  totalWeight: number;
  badDebtAmount: number;
  ruleName: string;
  planType: PlanType | '-';
  qualified: boolean;
  commissionAmount: number;
  bonusAmount: number;
  finalAmount: number;
  currency: Currency;
}

const PLAN_LABELS: Record<PlanType, string> = {
  PLAN_A_ABCD: '方案A',
  PLAN_B_SEA_VETERAN: '方案B',
  PLAN_C_NIGERIA_SEA: '方案C',
  PLAN_D_NIGERIA_AIR: '方案D',
};

function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function inferOffice(user: SalesUser): OfficeType {
  const role = String(user.role || '').toUpperCase();
  if (role.includes('US') || role.includes('NIGERIA')) return 'NIGERIA';
  return 'GUANGZHOU';
}

function pickRule(rules: CommissionRule[], office: OfficeType): CommissionRule | null {
  return rules.find((rule) => rule.office === office && rule.status === 'ACTIVE') || null;
}

function calcByRule(rule: CommissionRule | null, totalFreight: number, totalWeight: number, orderCount: number, totalVolume: number) {
  if (!rule) {
    return { qualified: false, commissionAmount: 0 };
  }

  const cfg = rule.config || {};

  if (rule.planType === 'PLAN_A_ABCD') {
    const baseTickets = toNumber(cfg.baseTickets || 0);
    const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
    const qualified = orderCount >= baseTickets && baseTickets > 0;
    if (!qualified) return { qualified, commissionAmount: 0 };

    const step = baseTickets > 0 ? Math.floor((orderCount - baseTickets) / baseTickets) : 0;
    const tierIndex = Math.max(0, Math.min(step, tiers.length - 1));
    const tier = tiers[tierIndex] || { pricePerTicket: 0, profitRate: 0 };
    const pricePerTicket = toNumber(tier.pricePerTicket);
    const profitRate = toNumber(tier.profitRate);
    const baseProfit = baseTickets * 100;

    const ticketCommission = orderCount * pricePerTicket;
    const profitCommission = Math.max(totalFreight - baseProfit, 0) * profitRate;
    return {
      qualified,
      commissionAmount: ticketCommission + profitCommission,
    };
  }

  if (rule.planType === 'PLAN_B_SEA_VETERAN') {
    const baseTask = toNumber(cfg.baseTask || 0);
    const breakpoint = toNumber(cfg.tierBreakpoint || 0);
    const lowerRate = toNumber(cfg.lowerRate || 0);
    const upperRate = toNumber(cfg.upperRate || 0);
    const qualified = totalFreight >= baseTask && baseTask > 0;
    if (!qualified) return { qualified, commissionAmount: 0 };

    const lowerBase = Math.min(totalFreight, breakpoint);
    const upperBase = Math.max(totalFreight - breakpoint, 0);
    return {
      qualified,
      commissionAmount: lowerBase * lowerRate + upperBase * upperRate,
    };
  }

  if (rule.planType === 'PLAN_C_NIGERIA_SEA') {
    const baseTask = toNumber(cfg.baseTaskCBM || 0);
    const tiers = Array.isArray(cfg.tiers) ? [...cfg.tiers] : [];
    const qualified = totalVolume >= baseTask && baseTask > 0;
    if (!qualified) return { qualified, commissionAmount: 0 };

    tiers.sort((a, b) => toNumber(a.threshold) - toNumber(b.threshold));
    let unitPrice = 0;
    for (const tier of tiers) {
      if (totalVolume >= toNumber(tier.threshold)) {
        unitPrice = toNumber(tier.unitPrice);
      }
    }
    return {
      qualified,
      commissionAmount: totalVolume * unitPrice,
    };
  }

  if (rule.planType === 'PLAN_D_NIGERIA_AIR') {
    const baseTask = toNumber(cfg.baseTaskKg || 0);
    const tiers = Array.isArray(cfg.tiers) ? [...cfg.tiers] : [];
    const qualified = totalWeight >= baseTask && baseTask > 0;
    if (!qualified) return { qualified, commissionAmount: 0 };

    tiers.sort((a, b) => toNumber(a.threshold) - toNumber(b.threshold));
    const excess = Math.max(totalWeight - baseTask, 0);
    let unitPrice = 0;
    for (const tier of tiers) {
      if (excess >= toNumber(tier.threshold)) {
        unitPrice = toNumber(tier.unitPrice);
      }
    }

    return {
      qualified,
      commissionAmount: excess * unitPrice,
    };
  }

  return { qualified: false, commissionAmount: 0 };
}

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
      const [usersRes, rulesRes, bonusRes]: any[] = await Promise.all([
        authApi.listUsers(),
        commissionApi.listRules({ status: 'ACTIVE' }),
        commissionApi.getBonus(),
      ]);

      const users = Array.isArray(usersRes?.data) ? usersRes.data : [];
      const sales = users
        .filter((user: any) => String(user.role || '').toUpperCase() === 'SALES' || !user.role)
        .map((user: any) => ({
          id: String(user.id),
          username: String(user.username || ''),
          realName: String(user.realName || user.username || user.id),
          role: user.role,
        }));

      const activeRules = Array.isArray(rulesRes?.data) ? rulesRes.data : [];
      const bonus = bonusRes?.data || null;

      setSalesUsers(sales);
      setRules(activeRules);
      setBonusConfig(bonus);
      setSelectedEmployees((prev) => (prev.length ? prev : sales.slice(0, 3).map((u: SalesUser) => u.id)));
    } catch (err: any) {
      message.error(err?.message || '加载提成基础数据失败');
      setSalesUsers([]);
      setRules([]);
      setBonusConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaseData();
  }, []);

  const handleCalculate = async () => {
    if (!selectedEmployees.length) {
      message.warning('请先选择员工');
      return;
    }

    setCalcLoading(true);
    try {
      const monthStart = selectedMonth.startOf('month').format('YYYY-MM-DD HH:mm:ss');
      const monthEnd = selectedMonth.endOf('month').format('YYYY-MM-DD HH:mm:ss');

      const ordersRes: any = await orderApi.listMaster({
        page: 1,
        pageSize: 10000,
        startDate: monthStart,
        endDate: monthEnd,
      });

      const allOrders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];

      const rows: CommissionResult[] = selectedEmployees.map((employeeId) => {
        const emp = salesUsers.find((user) => user.id === employeeId);
        const office = emp ? inferOffice(emp) : 'GUANGZHOU';
        const employeeName = emp?.realName || employeeId;
        const username = String(emp?.username || '').toLowerCase();
        const realName = String(emp?.realName || '').toLowerCase();

        const employeeOrders = allOrders.filter((order: any) => {
          const salesPerson = String(order.salesPerson || '').toLowerCase();
          if (!salesPerson) return false;
          return salesPerson === username || salesPerson === realName || salesPerson.includes(realName);
        });

        const orderCount = employeeOrders.length;
        const totalFreight = employeeOrders.reduce((sum: number, order: any) => sum + toNumber(order.totalFreight), 0);
        const totalWeight = employeeOrders.reduce((sum: number, order: any) => sum + toNumber(order.totalWeight), 0);
        const totalVolume = employeeOrders.reduce((sum: number, order: any) => sum + toNumber(order.totalVolume), 0);

        const badDebtAmount = employeeOrders.reduce((sum: number, order: any) => {
          const paymentStatus = String(order.paymentStatus || '').toUpperCase();
          if (paymentStatus === 'PAID') return sum;
          const freight = toNumber(order.totalFreight);
          const paid = toNumber(order.paidAmount);
          return sum + Math.max(freight - paid, 0);
        }, 0);

        const rule = pickRule(rules, office);
        const calcResult = calcByRule(rule, totalFreight, totalWeight, orderCount, totalVolume);
        const commissionAmount = Math.max(calcResult.commissionAmount, 0);
        const finalAmount = Math.max(commissionAmount - badDebtAmount, 0);

        return {
          employeeId,
          employeeName,
          office,
          orderCount,
          totalFreight,
          totalWeight,
          badDebtAmount,
          ruleName: rule?.planName || '未配置规则',
          planType: (rule?.planType || '-') as PlanType | '-',
          qualified: calcResult.qualified,
          commissionAmount,
          bonusAmount: 0,
          finalAmount,
          currency: 'CNY',
        };
      });

      if (bonusConfig) {
        const qualifiedRows = rows.filter((row) => row.qualified && row.totalWeight >= toNumber(bonusConfig.minPersonalWeightKg));
        const totalQualifiedWeight = qualifiedRows.reduce((sum, row) => sum + row.totalWeight, 0);

        if (
          totalQualifiedWeight >= toNumber(bonusConfig.triggerWeightKg)
          && qualifiedRows.length >= toNumber(bonusConfig.minQualifiedCount)
          && totalQualifiedWeight > 0
        ) {
          const bonusPool = toNumber(bonusConfig.bonusAmount);
          rows.forEach((row) => {
            const target = qualifiedRows.find((q) => q.employeeId === row.employeeId);
            if (!target) return;
            const ratio = target.totalWeight / totalQualifiedWeight;
            const bonus = bonusPool * ratio;
            row.bonusAmount = bonus;
            row.finalAmount += bonus;
          });
        }
      }

      setResults(rows);
      message.success(`已完成 ${rows.length} 位员工提成计算`);
    } catch (err: any) {
      message.error(err?.message || '提成计算失败');
      setResults([]);
    } finally {
      setCalcLoading(false);
    }
  };

  const stats = useMemo(() => {
    return {
      totalEmployees: results.length,
      totalCommission: results.reduce((sum, row) => sum + row.finalAmount, 0),
      qualified: results.filter((row) => row.qualified).length,
      totalBadDebt: results.reduce((sum, row) => sum + row.badDebtAmount, 0),
    };
  }, [results]);

  const columns = [
    {
      title: '员工',
      key: 'employee',
      width: 180,
      render: (_: unknown, row: CommissionResult) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.employeeName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.employeeId}</Text>
        </Space>
      ),
    },
    {
      title: '归属',
      dataIndex: 'office',
      width: 100,
      render: (value: OfficeType) => <Tag>{value === 'NIGERIA' ? '尼日利亚' : '广州'}</Tag>,
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      width: 90,
      align: 'right' as const,
    },
    {
      title: '运费总额',
      dataIndex: 'totalFreight',
      width: 130,
      align: 'right' as const,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '重量(kg)',
      dataIndex: 'totalWeight',
      width: 110,
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '方案',
      key: 'rule',
      width: 220,
      render: (_: unknown, row: CommissionResult) => (
        <Space direction="vertical" size={0}>
          <Text>{row.ruleName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.planType === '-' ? '-' : PLAN_LABELS[row.planType]}</Text>
        </Space>
      ),
    },
    {
      title: '达标',
      dataIndex: 'qualified',
      width: 90,
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'error'}>{value ? '达标' : '未达标'}</Tag>
      ),
    },
    {
      title: '坏账扣减',
      dataIndex: 'badDebtAmount',
      width: 120,
      align: 'right' as const,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '提成小计',
      dataIndex: 'commissionAmount',
      width: 120,
      align: 'right' as const,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '彩蛋奖金',
      dataIndex: 'bonusAmount',
      width: 120,
      align: 'right' as const,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: '最终实发',
      dataIndex: 'finalAmount',
      width: 140,
      align: 'right' as const,
      render: (value: number) => <Text strong style={{ color: '#f5222d' }}>¥{value.toFixed(2)}</Text>,
    },
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
          <Select
            mode="multiple"
            value={selectedEmployees}
            onChange={setSelectedEmployees}
            style={{ minWidth: 360 }}
            placeholder="选择员工"
            optionFilterProp="label"
            showSearch
            options={salesUsers.map((user) => ({
              value: user.id,
              label: `${user.realName} (${user.username})`,
            }))}
          />

          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={(value) => setSelectedMonth(value || dayjs())}
            allowClear={false}
          />

          <Button
            type="primary"
            icon={<CalculatorOutlined />}
            loading={calcLoading}
            onClick={handleCalculate}
          >
            执行计算
          </Button>

          <Button onClick={fetchBaseData}>刷新基础数据</Button>
        </Space>
      </Card>

      {bonusConfig && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Tag color="gold">彩蛋奖金规则（数据库）</Tag>
            <Text type="secondary">
              触发总重量 {toNumber(bonusConfig.triggerWeightKg).toLocaleString()}kg，奖金池 ¥{toNumber(bonusConfig.bonusAmount).toLocaleString()}，
              个人最低 {toNumber(bonusConfig.minPersonalWeightKg).toLocaleString()}kg，最少 {toNumber(bonusConfig.minQualifiedCount)} 人
            </Text>
          </Space>
        </Card>
      )}

      <Card title={`${selectedMonth.format('YYYY-MM')} 月度提成结果（数据库）`}>
        <Table
          rowKey="employeeId"
          columns={columns}
          dataSource={results}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1420 }}
        />
      </Card>
    </div>
  );
};
