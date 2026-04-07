import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, message, Row, Col,
  Statistic, Typography, Descriptions, Divider, Alert, Drawer,
  Select, DatePicker, Timeline, Progress, Form, InputNumber, Input, Popconfirm
} from 'antd';
import {
  CheckOutlined, EyeOutlined, SendOutlined,
  PrinterOutlined, FileTextOutlined, TeamOutlined,
  RiseOutlined, FallOutlined, MoneyCollectOutlined,
  CalculatorOutlined, BankOutlined, SafetyOutlined,
  AuditOutlined, DownloadOutlined, EditOutlined,
  PlusOutlined, DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

// 详情页左侧导航
const SALARY_NAV_ITEMS = [
  { key: 'basic', title: '基本信息' },
  { key: 'income', title: '收入明细' },
  { key: 'deduction', title: '扣款明细' },
  { key: 'net', title: '实发工资' },
  { key: 'timeline', title: '发放记录' }
];

// --- 类型定义 ---
interface SalaryRecord {
  id: string;
  recordNo: string;
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  month: string;

  // 收入项
  baseSalary: number;
  commission: number;
  bonus: number;
  overtime: number;
  allowance: number;

  // 扣款项
  socialInsurance: number;
  housingFund: number;
  tax: number;
  otherDeduction: number;

  // 计算结果
  totalIncome: number;
  totalDeduction: number;
  netSalary: number;

  // 状态
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PAID';
  calculateTime: string;
  approveTime?: string;
  approver?: string;
  payTime?: string;
  payer?: string;

  // 工资条
  payslipSent?: boolean;
  payslipSentTime?: string;

  remark?: string;
}

// --- 年度排行类型 ---
interface AnnualRankRecord {
  key: string;
  name: string;
  position: string;
  monthly: {
    salary: number;
    airCommission: number;
    seaCommission: number;
  }[];
  companySocialInsurance: number;
  yearEndBonus: number;
  totalAmount: number;
  totalMonths: number;
  monthlyAvg: number;
  leaveDays: number;
  lateTimes: number;
}

// --- 年度排行 Mock 数据生成 ---
function generateAnnualMockData(year: number): AnnualRankRecord[] {
  const employees = [
    { name: '黄颖', position: '推广' },
    { name: '吕沛霖', position: '推广' },
    { name: '罗泳华', position: '推广部经理' },
    { name: '朱小飞', position: '推广' },
    { name: '三凤', position: '推广' },
    { name: '罗敏', position: '客服' },
    { name: '张海峰', position: '仓管员' },
    { name: '李豪', position: '仓管员' },
    { name: '浦海森', position: '总经理' },
  ];

  const rng = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

  return employees.map((emp, idx) => {
    const isManager = emp.position === '推广部经理' || emp.position === '总经理';
    const monthly = Array.from({ length: 12 }, (_, m) => {
      const salary = isManager ? rng(12000, 18000) : rng(5000, 9000);
      const airCommission = rng(500, 4000);
      // 海运提成: 2024年仅6-12月有，其他年份全部有
      let seaCommission = 0;
      if (year === 2024) {
        seaCommission = m >= 5 ? rng(300, 2500) : 0; // month index 5 = June
      } else {
        seaCommission = rng(300, 2500);
      }
      return { salary, airCommission, seaCommission };
    });

    const totalFromMonthly = monthly.reduce(
      (sum, m) => sum + m.salary + m.airCommission + m.seaCommission,
      0
    );
    const companySI = rng(8000, 15000);
    const yearEndBonus = isManager ? rng(15000, 40000) : rng(5000, 15000);
    const totalAmount = totalFromMonthly + companySI + yearEndBonus;
    const activeMonths = year === 2024
      ? 12
      : 12;

    return {
      key: `${idx}`,
      name: emp.name,
      position: emp.position,
      monthly,
      companySocialInsurance: companySI,
      yearEndBonus,
      totalAmount,
      totalMonths: activeMonths,
      monthlyAvg: Math.round(totalAmount / activeMonths),
      leaveDays: rng(0, 8),
      lateTimes: rng(0, 5),
    };
  });
}

// --- 数据状态（暂无API，使用空数组初始化） ---

const DEPARTMENT_CONFIG = {
  '销售部': { color: '#1890ff', icon: <TeamOutlined /> },
  '操作部': { color: '#52c41a', icon: <CalculatorOutlined /> },
  '仓储部': { color: '#fa8c16', icon: <BankOutlined /> },
  '财务部': { color: '#722ed1', icon: <SafetyOutlined /> }
};

// --- 年度排行组件 ---
export const AnnualSalaryRank: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [dataList, setDataList] = useState<AnnualRankRecord[]>(() => generateAnnualMockData(2024));
  const [prevYear, setPrevYear] = useState<number>(2024);

  // 编辑相关状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AnnualRankRecord | null>(null);
  const [editForm] = Form.useForm();

  // 当年份变化时重新生成数据
  if (selectedYear !== prevYear) {
    setDataList(generateAnnualMockData(selectedYear));
    setPrevYear(selectedYear);
  }

  const annualData = dataList;

  const summaryRow = useMemo(() => {
    const result = {
      monthly: Array.from({ length: 12 }, (_, m) => ({
        salary: 0,
        airCommission: 0,
        seaCommission: 0,
      })),
      companySocialInsurance: 0,
      yearEndBonus: 0,
      totalAmount: 0,
      leaveDays: 0,
      lateTimes: 0,
    };
    annualData.forEach(r => {
      r.monthly.forEach((m, i) => {
        result.monthly[i].salary += m.salary;
        result.monthly[i].airCommission += m.airCommission;
        result.monthly[i].seaCommission += m.seaCommission;
      });
      result.companySocialInsurance += r.companySocialInsurance;
      result.yearEndBonus += r.yearEndBonus;
      result.totalAmount += r.totalAmount;
      result.leaveDays += r.leaveDays;
      result.lateTimes += r.lateTimes;
    });
    return result;
  }, [annualData]);

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // 打开编辑弹窗
  const handleEdit = (record: AnnualRankRecord) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      companySocialInsurance: record.companySocialInsurance,
      yearEndBonus: record.yearEndBonus,
      leaveDays: record.leaveDays,
      lateTimes: record.lateTimes,
    });
    setEditModalVisible(true);
  };

  // 保存编辑
  const handleEditSave = () => {
    editForm.validateFields().then(values => {
      if (!editingRecord) return;
      const updatedList = dataList.map(item => {
        if (item.key !== editingRecord.key) return item;
        const totalFromMonthly = item.monthly.reduce(
          (sum, m) => sum + m.salary + m.airCommission + m.seaCommission,
          0
        );
        const newTotal = totalFromMonthly + values.companySocialInsurance + values.yearEndBonus;
        return {
          ...item,
          companySocialInsurance: values.companySocialInsurance,
          yearEndBonus: values.yearEndBonus,
          leaveDays: values.leaveDays,
          lateTimes: values.lateTimes,
          totalAmount: newTotal,
          monthlyAvg: Math.round(newTotal / item.totalMonths),
        };
      });
      setDataList(updatedList);
      setEditModalVisible(false);
      setEditingRecord(null);
      message.success('已更新');
    });
  };

  // 月度明细列（只读展示）
  const monthlyDetailColumns = [
    { title: '月份', dataIndex: 'month', width: 60 },
    { title: '工资', dataIndex: 'salary', width: 100, align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: '空运提成', dataIndex: 'airCommission', width: 100, align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: '海运提成', dataIndex: 'seaCommission', width: 100, align: 'right' as const, render: (v: number) => v > 0 ? v.toLocaleString() : '-' },
    { title: '小计', width: 100, align: 'right' as const, render: (_: any, row: any) => (row.salary + row.airCommission + row.seaCommission).toLocaleString() },
  ];

  const columns: any[] = [
    {
      title: '序号',
      width: 50,
      fixed: 'left' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 80,
      fixed: 'left' as const,
    },
    {
      title: '职务',
      dataIndex: 'position',
      width: 80,
      fixed: 'left' as const,
    },
  ];

  // 12 monthly column groups
  for (let m = 0; m < 12; m++) {
    const showSea = selectedYear !== 2024 || m >= 5;
    const children: any[] = [
      {
        title: '工资',
        width: 90,
        align: 'right' as const,
        render: (_: any, record: AnnualRankRecord) =>
          record.monthly[m].salary.toLocaleString(),
      },
      {
        title: '空运提成',
        width: 90,
        align: 'right' as const,
        render: (_: any, record: AnnualRankRecord) =>
          record.monthly[m].airCommission.toLocaleString(),
      },
    ];
    if (showSea) {
      children.push({
        title: '海运提成',
        width: 90,
        align: 'right' as const,
        render: (_: any, record: AnnualRankRecord) =>
          record.monthly[m].seaCommission > 0
            ? record.monthly[m].seaCommission.toLocaleString()
            : '-',
      });
    }
    columns.push({
      title: monthNames[m],
      children,
    });
  }

  // Fixed right summary columns
  columns.push(
    {
      title: '公司社保费(年)',
      width: 110,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_: any, record: AnnualRankRecord) =>
        record.companySocialInsurance.toLocaleString(),
    },
    {
      title: '年终奖',
      width: 100,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_: any, record: AnnualRankRecord) =>
        record.yearEndBonus.toLocaleString(),
    },
    {
      title: '合计金额',
      width: 120,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_: any, record: AnnualRankRecord) => (
        <Text strong style={{ color: '#1890ff' }}>
          {record.totalAmount.toLocaleString()}
        </Text>
      ),
    },
    {
      title: '共月份',
      width: 70,
      fixed: 'right' as const,
      align: 'center' as const,
      dataIndex: 'totalMonths',
    },
    {
      title: '月均',
      width: 100,
      fixed: 'right' as const,
      align: 'right' as const,
      render: (_: any, record: AnnualRankRecord) =>
        record.monthlyAvg.toLocaleString(),
    },
    {
      title: '请假',
      width: 60,
      fixed: 'right' as const,
      align: 'center' as const,
      dataIndex: 'leaveDays',
    },
    {
      title: '迟到',
      width: 60,
      fixed: 'right' as const,
      align: 'center' as const,
      dataIndex: 'lateTimes',
    },
    {
      title: '操作',
      width: 70,
      fixed: 'right' as const,
      align: 'center' as const,
      render: (_: any, record: AnnualRankRecord) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    }
  );

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Text strong>年份：</Text>
              <Select
                value={selectedYear}
                onChange={setSelectedYear}
                style={{ width: 100 }}
              >
                {[2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                  <Select.Option key={y} value={y}>{y}</Select.Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col>
            <Button icon={<DownloadOutlined />} type="primary">
              导出Excel
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={annualData}
          scroll={{ x: 4200 }}
          pagination={false}
          size="small"
          bordered
          summary={() => {
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                  <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} />
                  {(() => {
                    const cells: React.ReactNode[] = [];
                    let cellIndex = 3;
                    for (let m = 0; m < 12; m++) {
                      const showSea = selectedYear !== 2024 || m >= 5;
                      cells.push(
                        <Table.Summary.Cell key={`s-${m}`} index={cellIndex++} align="right">
                          {summaryRow.monthly[m].salary.toLocaleString()}
                        </Table.Summary.Cell>
                      );
                      cells.push(
                        <Table.Summary.Cell key={`a-${m}`} index={cellIndex++} align="right">
                          {summaryRow.monthly[m].airCommission.toLocaleString()}
                        </Table.Summary.Cell>
                      );
                      if (showSea) {
                        cells.push(
                          <Table.Summary.Cell key={`se-${m}`} index={cellIndex++} align="right">
                            {summaryRow.monthly[m].seaCommission > 0
                              ? summaryRow.monthly[m].seaCommission.toLocaleString()
                              : '-'}
                          </Table.Summary.Cell>
                        );
                      }
                    }
                    // right fixed columns
                    cells.push(
                      <Table.Summary.Cell key="si" index={cellIndex++} align="right">
                        {summaryRow.companySocialInsurance.toLocaleString()}
                      </Table.Summary.Cell>
                    );
                    cells.push(
                      <Table.Summary.Cell key="yeb" index={cellIndex++} align="right">
                        {summaryRow.yearEndBonus.toLocaleString()}
                      </Table.Summary.Cell>
                    );
                    cells.push(
                      <Table.Summary.Cell key="total" index={cellIndex++} align="right">
                        <Text strong style={{ color: '#1890ff' }}>
                          {summaryRow.totalAmount.toLocaleString()}
                        </Text>
                      </Table.Summary.Cell>
                    );
                    cells.push(
                      <Table.Summary.Cell key="months" index={cellIndex++} align="center">
                        -
                      </Table.Summary.Cell>
                    );
                    cells.push(
                      <Table.Summary.Cell key="avg" index={cellIndex++} align="right">
                        -
                      </Table.Summary.Cell>
                    );
                    cells.push(
                      <Table.Summary.Cell key="leave" index={cellIndex++} align="center">
                        {summaryRow.leaveDays}
                      </Table.Summary.Cell>
                    );
                    cells.push(
                      <Table.Summary.Cell key="late" index={cellIndex++} align="center">
                        {summaryRow.lateTimes}
                      </Table.Summary.Cell>
                    );
                    cells.push(
                      <Table.Summary.Cell key="action" index={cellIndex++} align="center">
                        -
                      </Table.Summary.Cell>
                    );
                    return cells;
                  })()}
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? `编辑 - ${editingRecord.name}（${editingRecord.position}）` : '编辑'}
        open={editModalVisible}
        onCancel={() => { setEditModalVisible(false); setEditingRecord(null); }}
        onOk={handleEditSave}
        okText="保存"
        cancelText="取消"
        width={700}
        destroyOnClose
      >
        {editingRecord && (
          <>
            <Divider orientation="left" style={{ marginTop: 0 }}>年度汇总</Divider>
            <Form form={editForm} layout="vertical">
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="公司社保费(年)" name="companySocialInsurance" rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} step={100} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => Number(v?.replace(/,/g, '') || 0)} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="年终奖" name="yearEndBonus" rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} step={100} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => Number(v?.replace(/,/g, '') || 0)} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="请假次数" name="leaveDays" rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="迟到次数" name="lateTimes" rules={[{ required: true, message: '请输入' }]}>
                    <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            <Divider orientation="left">月度明细（只读，请在&ldquo;月度薪资&rdquo;标签页编辑）</Divider>
            <Alert message={'月度薪资数据请切换到"月度薪资"标签页进行编辑'} type="info" showIcon style={{ marginBottom: 12 }} />
            <Table
              rowKey="month"
              columns={monthlyDetailColumns}
              dataSource={editingRecord.monthly.map((m, i) => ({
                month: monthNames[i],
                salary: m.salary,
                airCommission: m.airCommission,
                seaCommission: m.seaCommission,
              }))}
              pagination={false}
              size="small"
              bordered
              scroll={{ y: 300 }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export const SalaryPayment: React.FC = () => {
  const [data, setData] = useState<SalaryRecord[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<SalaryRecord | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // 编辑薪资
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryRecord | null>(null);
  const [editForm] = Form.useForm();

  // 新增薪资
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();

  // 筛选条件
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('2024-01');

  // 过滤数据
  const filteredData = useMemo(() => {
    return data.filter(r => {
      if (departmentFilter !== 'ALL' && r.department !== departmentFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (monthFilter && r.month !== monthFilter) return false;
      return true;
    });
  }, [data, departmentFilter, statusFilter, monthFilter]);

  // 统计数据
  const stats = useMemo(() => {
    const currentMonthData = data.filter(r => r.month === monthFilter);

    return {
      totalIncome: currentMonthData.reduce((sum, r) => sum + r.totalIncome, 0),
      totalNet: currentMonthData.reduce((sum, r) => sum + r.netSalary, 0),
      totalPeople: currentMonthData.length,
      avgSalary: currentMonthData.length > 0
        ? currentMonthData.reduce((sum, r) => sum + r.netSalary, 0) / currentMonthData.length
        : 0,
      pending: currentMonthData.filter(r => r.status === 'PENDING').length,
      approved: currentMonthData.filter(r => r.status === 'APPROVED').length,
      paid: currentMonthData.filter(r => r.status === 'PAID').length
    };
  }, [data, monthFilter]);

  // 上月数据对比
  const lastMonthStats = useMemo(() => {
    const lastMonth = dayjs(monthFilter).subtract(1, 'month').format('YYYY-MM');
    const lastMonthData = data.filter(r => r.month === lastMonth);
    return {
      totalNet: lastMonthData.reduce((sum, r) => sum + r.netSalary, 0)
    };
  }, [data, monthFilter]);

  const changePercent = useMemo(() => {
    if (lastMonthStats.totalNet === 0) return 0;
    return ((stats.totalNet - lastMonthStats.totalNet) / lastMonthStats.totalNet * 100);
  }, [stats.totalNet, lastMonthStats.totalNet]);

  // 查看详情
  const handleViewDetail = (record: SalaryRecord) => {
    setCurrentRecord(record);
    setDetailModalVisible(true);
  };

  // 审批工资
  const handleApprove = (record: SalaryRecord) => {
    Modal.confirm({
      title: '审批通过',
      content: (
        <div>
          <p>确定审批通过 <Text strong>{record.employeeName}</Text> 的 {record.month} 工资吗？</p>
          <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="实发工资">
              <Text strong style={{ color: '#52c41a', fontSize: 18 }}>
                ¥{record.netSalary.toLocaleString()}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
      onOk: () => {
        setData(prev => prev.map(r =>
          r.id === record.id
            ? {
              ...r,
              status: 'APPROVED' as const,
              approveTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              approver: '当前用户'
            }
            : r
        ));
        message.success('审批通过');
      }
    });
  };

  // 发放工资
  const handlePay = (record: SalaryRecord) => {
    Modal.confirm({
      title: '确认发放',
      content: (
        <div>
          <p>确定发放工资给 <Text strong>{record.employeeName}</Text> 吗？</p>
          <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="实发工资">
              <Text strong style={{ color: '#52c41a', fontSize: 18 }}>
                ¥{record.netSalary.toLocaleString()}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="发放月份">
              {record.month}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
      onOk: () => {
        setData(prev => prev.map(r =>
          r.id === record.id
            ? {
              ...r,
              status: 'PAID' as const,
              payTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              payer: '当前用户'
            }
            : r
        ));
        message.success('工资已发放');
      }
    });
  };

  // 批量发放
  const handleBatchPay = () => {
    const selectedRecords = data.filter(r => selectedRowKeys.includes(r.id));
    const approvedRecords = selectedRecords.filter(r => r.status === 'APPROVED');

    if (approvedRecords.length === 0) {
      message.warning('所选记录中没有已审批的工资');
      return;
    }

    const totalAmount = approvedRecords.reduce((sum, r) => sum + r.netSalary, 0);

    Modal.confirm({
      title: '批量发放工资',
      content: (
        <div>
          <p>确定批量发放以下工资吗？</p>
          <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="发放人数">
              {approvedRecords.length} 人
            </Descriptions.Item>
            <Descriptions.Item label="总金额">
              <Text strong style={{ color: '#52c41a', fontSize: 18 }}>
                ¥{totalAmount.toLocaleString()}
              </Text>
            </Descriptions.Item>
          </Descriptions>
          <Alert
            message="发放后将自动生成工资条并发送给员工"
            type="info"
            showIcon
            style={{ marginTop: 12 }}
          />
        </div>
      ),
      onOk: () => {
        const ids = approvedRecords.map(r => r.id);
        setData(prev => prev.map(r =>
          ids.includes(r.id)
            ? {
              ...r,
              status: 'PAID' as const,
              payTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              payer: '当前用户'
            }
            : r
        ));
        message.success(`已批量发放 ${approvedRecords.length} 人的工资`);
        setSelectedRowKeys([]);
      }
    });
  };

  // 发送工资条
  const handleSendPayslip = (record: SalaryRecord) => {
    Modal.confirm({
      title: '发送工资条',
      content: `确定发送工资条给 ${record.employeeName} 吗？`,
      onOk: () => {
        setData(prev => prev.map(r =>
          r.id === record.id
            ? {
              ...r,
              payslipSent: true,
              payslipSentTime: dayjs().format('YYYY-MM-DD HH:mm:ss')
            }
            : r
        ));
        message.success('工资条已发送至员工邮箱');
      }
    });
  };

  // 编辑薪资
  const handleEdit = (record: SalaryRecord) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      baseSalary: record.baseSalary,
      commission: record.commission,
      bonus: record.bonus,
      overtime: record.overtime,
      allowance: record.allowance,
      socialInsurance: record.socialInsurance,
      housingFund: record.housingFund,
      tax: record.tax,
      otherDeduction: record.otherDeduction,
    });
    setEditModalVisible(true);
  };

  const handleEditSave = () => {
    editForm.validateFields().then((values) => {
      if (!editingRecord) return;
      const totalIncome = (values.baseSalary || 0) + (values.commission || 0) + (values.bonus || 0) + (values.overtime || 0) + (values.allowance || 0);
      const totalDeduction = (values.socialInsurance || 0) + (values.housingFund || 0) + (values.tax || 0) + (values.otherDeduction || 0);
      const netSalary = totalIncome - totalDeduction;

      setData(prev => prev.map(r =>
        r.id === editingRecord.id
          ? {
            ...r,
            baseSalary: values.baseSalary || 0,
            commission: values.commission || 0,
            bonus: values.bonus || 0,
            overtime: values.overtime || 0,
            allowance: values.allowance || 0,
            socialInsurance: values.socialInsurance || 0,
            housingFund: values.housingFund || 0,
            tax: values.tax || 0,
            otherDeduction: values.otherDeduction || 0,
            totalIncome,
            totalDeduction,
            netSalary,
          }
          : r
      ));
      message.success('薪资已更新');
      setEditModalVisible(false);
      setEditingRecord(null);
    });
  };

  // 新增薪资
  const handleOpenAdd = () => {
    addForm.resetFields();
    addForm.setFieldsValue({ month: monthFilter });
    setAddModalVisible(true);
  };

  const handleAddSave = () => {
    addForm.validateFields().then((values) => {
      const totalIncome = (values.baseSalary || 0) + (values.commission || 0) + (values.bonus || 0) + (values.overtime || 0) + (values.allowance || 0);
      const totalDeduction = (values.socialInsurance || 0) + (values.housingFund || 0) + (values.tax || 0) + (values.otherDeduction || 0);
      const netSalary = totalIncome - totalDeduction;
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const newId = `SAL-${Date.now()}`;

      const newRecord: SalaryRecord = {
        id: newId,
        recordNo: newId,
        employeeId: `EMP-${Date.now()}`,
        employeeName: values.employeeName,
        department: values.department,
        position: values.position,
        month: values.month || monthFilter,
        baseSalary: values.baseSalary || 0,
        commission: values.commission || 0,
        bonus: values.bonus || 0,
        overtime: values.overtime || 0,
        allowance: values.allowance || 0,
        socialInsurance: values.socialInsurance || 0,
        housingFund: values.housingFund || 0,
        tax: values.tax || 0,
        otherDeduction: values.otherDeduction || 0,
        totalIncome,
        totalDeduction,
        netSalary,
        status: 'DRAFT',
        calculateTime: now,
      };

      setData(prev => [...prev, newRecord]);
      message.success('薪资记录已创建');
      setAddModalVisible(false);
    });
  };

  // 删除薪资
  const handleDelete = (record: SalaryRecord) => {
    setData(prev => prev.filter(r => r.id !== record.id));
    message.success('薪资记录已删除');
  };

  // 列表列定义
  const columns = [
    {
      title: '员工信息',
      width: 180,
      render: (_: any, record: SalaryRecord) => (
        <Space direction="vertical" size={0}>
          <Space>
            {DEPARTMENT_CONFIG[record.department as keyof typeof DEPARTMENT_CONFIG]?.icon}
            <Text strong>{record.employeeName}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.department} · {record.position}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.employeeId}
          </Text>
        </Space>
      )
    },
    {
      title: '基本工资',
      dataIndex: 'baseSalary',
      width: 100,
      align: 'right' as const,
      render: (val: number) => `¥${val.toLocaleString()}`
    },
    {
      title: '提成',
      dataIndex: 'commission',
      width: 100,
      align: 'right' as const,
      render: (val: number) => (
        val > 0 ? (
          <Text style={{ color: '#52c41a' }}>+¥{val.toLocaleString()}</Text>
        ) : (
          <Text type="secondary">-</Text>
        )
      )
    },
    {
      title: '奖金/补贴',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: SalaryRecord) => {
        const total = record.bonus + record.overtime + record.allowance;
        return total > 0 ? `¥${total.toLocaleString()}` : <Text type="secondary">-</Text>;
      }
    },
    {
      title: '应发工资',
      dataIndex: 'totalIncome',
      width: 120,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          ¥{val.toLocaleString()}
        </Text>
      )
    },
    {
      title: '扣款',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: SalaryRecord) => (
        <Text type="danger">-¥{record.totalDeduction.toLocaleString()}</Text>
      )
    },
    {
      title: '实发工资',
      dataIndex: 'netSalary',
      width: 140,
      align: 'right' as const,
      render: (val: number) => (
        <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
          ¥{val.toLocaleString()}
        </Text>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: string) => {
        const statusConfig = {
          DRAFT: { text: '草稿', color: 'default' },
          PENDING: { text: '待审批', color: 'orange' },
          APPROVED: { text: '已审批', color: 'blue' },
          PAID: { text: '已发放', color: 'green' }
        };
        const config = statusConfig[val as keyof typeof statusConfig];
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '工资条',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: SalaryRecord) => (
        record.payslipSent ? (
          <Tag color="green">已发送</Tag>
        ) : (
          <Text type="secondary">-</Text>
        )
      )
    },
    {
      title: '操作',
      width: 280,
      render: (_: any, record: SalaryRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {record.status === 'PENDING' && (
            <Button
              type="link"
              size="small"
              icon={<AuditOutlined />}
              onClick={() => handleApprove(record)}
            >
              审批
            </Button>
          )}
          {record.status === 'APPROVED' && (
            <Button
              type="link"
              size="small"
              icon={<MoneyCollectOutlined />}
              style={{ color: '#52c41a' }}
              onClick={() => handlePay(record)}
            >
              发放
            </Button>
          )}
          {record.status === 'PAID' && (
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleSendPayslip(record)}
            >
              工资条
            </Button>
          )}
          <Popconfirm
            title="确认删除"
            description={`确定删除 ${record.employeeName} 的 ${record.month} 薪资记录吗？`}
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
                {/* 统计卡片 */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="应发总额"
                        value={stats.totalIncome}
                        prefix="¥"
                        valueStyle={{ color: '#1890ff' }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        本月 {stats.totalPeople} 人
                      </Text>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="实发总额"
                        value={stats.totalNet}
                        prefix="¥"
                        valueStyle={{ color: '#52c41a', fontSize: 24 }}
                      />
                      <Space style={{ fontSize: 12 }}>
                        <Text type="secondary">环比</Text>
                        {changePercent >= 0 ? (
                          <Text style={{ color: '#cf1322' }}>
                            <RiseOutlined /> {changePercent.toFixed(1)}%
                          </Text>
                        ) : (
                          <Text style={{ color: '#52c41a' }}>
                            <FallOutlined /> {Math.abs(changePercent).toFixed(1)}%
                          </Text>
                        )}
                      </Space>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="人均薪资"
                        value={stats.avgSalary}
                        prefix="¥"
                        precision={0}
                        valueStyle={{ color: '#722ed1' }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        实发平均值
                      </Text>
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Text type="secondary">发放进度</Text>
                        <Progress
                          percent={stats.totalPeople > 0 ? (stats.paid / stats.totalPeople * 100) : 0}
                          strokeColor="#52c41a"
                          format={(percent) => `${stats.paid}/${stats.totalPeople}`}
                        />
                        <Space size={16} style={{ fontSize: 12 }}>
                          <Text type="secondary">待审批: {stats.pending}</Text>
                          <Text type="secondary">已审批: {stats.approved}</Text>
                        </Space>
                      </Space>
                    </Card>
                  </Col>
                </Row>

                {/* 筛选与操作 */}
                <Card style={{ marginBottom: 16 }}>
                  <Row gutter={16} align="middle">
                    <Col>
                      <Space>
                        <Select
                          value={departmentFilter}
                          onChange={setDepartmentFilter}
                          style={{ width: 120 }}
                        >
                          <Select.Option value="ALL">全部部门</Select.Option>
                          <Select.Option value="销售部">销售部</Select.Option>
                          <Select.Option value="操作部">操作部</Select.Option>
                          <Select.Option value="仓储部">仓储部</Select.Option>
                          <Select.Option value="财务部">财务部</Select.Option>
                        </Select>

                        <Select
                          value={statusFilter}
                          onChange={setStatusFilter}
                          style={{ width: 120 }}
                        >
                          <Select.Option value="ALL">全部状态</Select.Option>
                          <Select.Option value="DRAFT">草稿</Select.Option>
                          <Select.Option value="PENDING">待审批</Select.Option>
                          <Select.Option value="APPROVED">已审批</Select.Option>
                          <Select.Option value="PAID">已发放</Select.Option>
                        </Select>

                        <DatePicker
                          value={dayjs(monthFilter)}
                          onChange={(date) => setMonthFilter(date ? date.format('YYYY-MM') : '2024-01')}
                          picker="month"
                          format="YYYY-MM"
                          style={{ width: 120 }}
                        />
                      </Space>
                    </Col>
                    <Col flex="auto" style={{ textAlign: 'right' }}>
                      <Space>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={handleOpenAdd}
                        >
                          新增薪资
                        </Button>
                        <Button
                          type="primary"
                          icon={<MoneyCollectOutlined />}
                          onClick={handleBatchPay}
                          disabled={selectedRowKeys.length === 0}
                        >
                          批量发放 ({selectedRowKeys.length})
                        </Button>
                        <Button icon={<FileTextOutlined />}>
                          导出工资表
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>

                {/* 数据表格 */}
                <Card>
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredData}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: (keys) => setSelectedRowKeys(keys.map((key) => String(key))),
                      getCheckboxProps: (record) => ({
                        disabled: record.status !== 'APPROVED'
                      })
                    }}
                    pagination={{ pageSize: 10 }}
                    size="small"
                    summary={(pageData) => {
                      const totalIncome = pageData.reduce((sum, r) => sum + r.totalIncome, 0);
                      const totalNet = pageData.reduce((sum, r) => sum + r.netSalary, 0);

                      return (
                        <Table.Summary>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={5}>
                              <Text strong>本页合计</Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5} align="right">
                              <Text strong style={{ color: '#1890ff' }}>
                                ¥{totalIncome.toLocaleString()}
                              </Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={6} />
                            <Table.Summary.Cell index={7} align="right">
                              <Text strong style={{ color: '#52c41a' }}>
                                ¥{totalNet.toLocaleString()}
                              </Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={8} colSpan={3} />
                          </Table.Summary.Row>
                        </Table.Summary>
                      );
                    }}
                  />
                </Card>

      {/* 编辑薪资 Modal */}
      <Modal
        title={editingRecord ? `编辑薪资 - ${editingRecord.employeeName} (${editingRecord.month})` : '编辑薪资'}
        open={editModalVisible}
        onOk={handleEditSave}
        onCancel={() => { setEditModalVisible(false); setEditingRecord(null); }}
        destroyOnClose
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Divider orientation="left" plain>收入项</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="baseSalary" label="基本工资" rules={[{ required: true, message: '请输入基本工资' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="commission" label="提成" rules={[{ required: true, message: '请输入提成' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bonus" label="奖金">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="overtime" label="加班费">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="allowance" label="补贴">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" plain>扣款项</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="socialInsurance" label="社保">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="housingFund" label="公积金">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tax" label="个税">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="otherDeduction" label="其他扣款">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 新增薪资 Modal */}
      <Modal
        title="新增薪资"
        open={addModalVisible}
        onOk={handleAddSave}
        onCancel={() => setAddModalVisible(false)}
        destroyOnClose
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={addForm} layout="vertical" initialValues={{ commission: 0, bonus: 0, overtime: 0, allowance: 0, socialInsurance: 0, housingFund: 0, tax: 0, otherDeduction: 0 }}>
          <Divider orientation="left" plain>员工信息</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="employeeName" label="员工姓名" rules={[{ required: true, message: '请输入员工姓名' }]}>
                <Input placeholder="请输入员工姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="department" label="部门" rules={[{ required: true, message: '请选择部门' }]}>
                <Select placeholder="请选择部门">
                  <Select.Option value="销售部">销售部</Select.Option>
                  <Select.Option value="操作部">操作部</Select.Option>
                  <Select.Option value="仓储部">仓储部</Select.Option>
                  <Select.Option value="财务部">财务部</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="position" label="职务" rules={[{ required: true, message: '请输入职务' }]}>
                <Input placeholder="请输入职务" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="month" label="月份">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" plain>收入项</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="baseSalary" label="基本工资" rules={[{ required: true, message: '请输入基本工资' }]}>
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="commission" label="提成">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bonus" label="奖金">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="overtime" label="加班费">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="allowance" label="补贴">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left" plain>扣款项</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="socialInsurance" label="社保">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="housingFund" label="公积金">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tax" label="个税">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="otherDeduction" label="其他扣款">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 工资详情 Drawer */}
      <Drawer
        title={
          currentRecord ? (
            <Space>
              <Title level={5} style={{ margin: 0 }}>{currentRecord.employeeName} - {currentRecord.month}</Title>
              {currentRecord.status === 'DRAFT' && <Tag color="default">草稿</Tag>}
              {currentRecord.status === 'PENDING' && <Tag color="orange">待审批</Tag>}
              {currentRecord.status === 'APPROVED' && <Tag color="blue">已审批</Tag>}
              {currentRecord.status === 'PAID' && <Tag color="green">已发放</Tag>}
            </Space>
          ) : null
        }
        placement="right"
        width="80%"
        open={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        destroyOnClose
        extra={
          currentRecord ? (
            <Space>
              <Button icon={<PrinterOutlined />}>打印工资条</Button>
              {currentRecord.status === 'PAID' && (
                <Button type="primary" icon={<SendOutlined />} onClick={() => { handleSendPayslip(currentRecord); setDetailModalVisible(false); }}>
                  发送邮件
                </Button>
              )}
              {currentRecord.status === 'PENDING' && (
                <Button type="primary" icon={<AuditOutlined />} onClick={() => { handleApprove(currentRecord); setDetailModalVisible(false); }}>
                  审批通过
                </Button>
              )}
              {currentRecord.status === 'APPROVED' && (
                <Button type="primary" icon={<MoneyCollectOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => { handlePay(currentRecord); setDetailModalVisible(false); }}>
                  发放工资
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {currentRecord && (
          <Row gutter={16}>
            {/* 左侧锚点导航 */}
            <Col span={3}>
              <div style={{ position: 'sticky', top: 100 }}>
                <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 4, padding: '8px 0' }}>
                  {SALARY_NAV_ITEMS.map(item => (
                    <div
                      key={item.key}
                      onClick={() => {
                        const el = document.getElementById(`sal-${item.key}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      style={{ padding: '8px 16px', cursor: 'pointer', fontSize: 14, color: '#666', transition: 'all 0.3s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#1890ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              </div>
            </Col>

            {/* 右侧主要内容 */}
            <Col span={21}>
              {/* 基本信息 */}
              <Card id="sal-basic" title="基本信息" style={{ marginBottom: 16 }}>
                <Descriptions bordered column={3} size="small">
                  <Descriptions.Item label="姓名">
                    <Text strong>{currentRecord.employeeName}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="员工编号">{currentRecord.employeeId}</Descriptions.Item>
                  <Descriptions.Item label="发放月份">{currentRecord.month}</Descriptions.Item>
                  <Descriptions.Item label="部门">{currentRecord.department}</Descriptions.Item>
                  <Descriptions.Item label="职位">{currentRecord.position}</Descriptions.Item>
                  <Descriptions.Item label="工资条">
                    {currentRecord.payslipSent ? <Tag color="green">已发送</Tag> : <Text type="secondary">未发送</Text>}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              {/* 收入明细 */}
              <Card id="sal-income" title="收入明细" style={{ marginBottom: 16 }}>
                <Card size="small" style={{ background: '#f0f5ff', border: '1px solid #adc6ff' }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Row justify="space-between">
                      <Col><Text>基本工资</Text></Col>
                      <Col><Text strong>¥{currentRecord.baseSalary.toLocaleString()}</Text></Col>
                    </Row>
                    {currentRecord.commission > 0 && (
                      <Row justify="space-between">
                        <Col><Text>销售提成</Text></Col>
                        <Col><Text strong style={{ color: '#52c41a' }}>+¥{currentRecord.commission.toLocaleString()}</Text></Col>
                      </Row>
                    )}
                    {currentRecord.bonus > 0 && (
                      <Row justify="space-between">
                        <Col><Text>绩效奖金</Text></Col>
                        <Col><Text strong>¥{currentRecord.bonus.toLocaleString()}</Text></Col>
                      </Row>
                    )}
                    {currentRecord.overtime > 0 && (
                      <Row justify="space-between">
                        <Col><Text>加班费</Text></Col>
                        <Col><Text strong>¥{currentRecord.overtime.toLocaleString()}</Text></Col>
                      </Row>
                    )}
                    {currentRecord.allowance > 0 && (
                      <Row justify="space-between">
                        <Col><Text>各项补贴</Text></Col>
                        <Col><Text strong>¥{currentRecord.allowance.toLocaleString()}</Text></Col>
                      </Row>
                    )}
                    <Divider style={{ margin: '8px 0' }} />
                    <Row justify="space-between">
                      <Col><Text strong>应发工资</Text></Col>
                      <Col><Text strong style={{ color: '#1890ff', fontSize: 18 }}>¥{currentRecord.totalIncome.toLocaleString()}</Text></Col>
                    </Row>
                  </Space>
                </Card>
              </Card>

              {/* 扣款明细 */}
              <Card id="sal-deduction" title="扣款明细" style={{ marginBottom: 16 }}>
                <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Row justify="space-between">
                      <Col><Text>社保</Text></Col>
                      <Col><Text>¥{currentRecord.socialInsurance.toLocaleString()}</Text></Col>
                    </Row>
                    <Row justify="space-between">
                      <Col><Text>公积金</Text></Col>
                      <Col><Text>¥{currentRecord.housingFund.toLocaleString()}</Text></Col>
                    </Row>
                    <Row justify="space-between">
                      <Col><Text>个人所得税</Text></Col>
                      <Col><Text>¥{currentRecord.tax.toLocaleString()}</Text></Col>
                    </Row>
                    {currentRecord.otherDeduction > 0 && (
                      <Row justify="space-between">
                        <Col><Text>其他扣款</Text></Col>
                        <Col><Text>¥{currentRecord.otherDeduction.toLocaleString()}</Text></Col>
                      </Row>
                    )}
                    <Divider style={{ margin: '8px 0' }} />
                    <Row justify="space-between">
                      <Col><Text strong>总扣款</Text></Col>
                      <Col><Text strong style={{ color: '#fa8c16', fontSize: 16 }}>-¥{currentRecord.totalDeduction.toLocaleString()}</Text></Col>
                    </Row>
                  </Space>
                </Card>
              </Card>

              {/* 实发工资 */}
              <Card id="sal-net" title="实发工资" style={{ marginBottom: 16 }}>
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    textAlign: 'center'
                  }}
                >
                  <Title level={2} style={{ color: '#fff', margin: 0 }}>
                    ¥{currentRecord.netSalary.toLocaleString()}
                  </Title>
                  <Text style={{ color: '#fff', opacity: 0.9 }}>
                    应发 ¥{currentRecord.totalIncome.toLocaleString()} - 扣款 ¥{currentRecord.totalDeduction.toLocaleString()}
                  </Text>
                </Card>
              </Card>

              {/* 发放记录 */}
              <Card id="sal-timeline" title="发放记录">
                <Timeline
                  items={[
                    {
                      color: 'green',
                      children: (
                        <div>
                          <Text strong>薪资计算</Text>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {dayjs(currentRecord.calculateTime).format('YYYY-MM-DD HH:mm')}
                          </div>
                        </div>
                      )
                    },
                    ...(currentRecord.approveTime ? [{
                      color: 'blue' as const,
                      children: (
                        <div>
                          <Text strong>财务审核</Text>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {currentRecord.approver} 于 {dayjs(currentRecord.approveTime).format('YYYY-MM-DD HH:mm')} 审批通过
                          </div>
                        </div>
                      )
                    }] : []),
                    ...(currentRecord.payTime ? [{
                      color: 'purple' as const,
                      children: (
                        <div>
                          <Text strong>工资发放</Text>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {currentRecord.payer} 于 {dayjs(currentRecord.payTime).format('YYYY-MM-DD HH:mm')} 发放
                          </div>
                        </div>
                      )
                    }] : []),
                    ...(currentRecord.payslipSent ? [{
                      color: 'green' as const,
                      children: (
                        <div>
                          <Text strong>工资条已发送</Text>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {dayjs(currentRecord.payslipSentTime).format('YYYY-MM-DD HH:mm')} 发送至员工邮箱
                          </div>
                        </div>
                      )
                    }] : [])
                  ]}
                />
              </Card>
            </Col>
          </Row>
        )}
      </Drawer>
    </div>
  );
};
