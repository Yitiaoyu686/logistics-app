import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, message, Row, Col,
  Statistic, Typography, Descriptions, Divider, Alert, Drawer,
  Select, DatePicker, Timeline, Progress
} from 'antd';
import {
  CheckOutlined, EyeOutlined, SendOutlined,
  PrinterOutlined, FileTextOutlined, TeamOutlined,
  RiseOutlined, FallOutlined, MoneyCollectOutlined,
  CalculatorOutlined, BankOutlined, SafetyOutlined,
  AuditOutlined
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

// --- 数据状态（暂无API，使用空数组初始化） ---

const DEPARTMENT_CONFIG = {
  '销售部': { color: '#1890ff', icon: <TeamOutlined /> },
  '操作部': { color: '#52c41a', icon: <CalculatorOutlined /> },
  '仓储部': { color: '#fa8c16', icon: <BankOutlined /> },
  '财务部': { color: '#722ed1', icon: <SafetyOutlined /> }
};

export const SalaryPayment: React.FC = () => {
  const [data, setData] = useState<SalaryRecord[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<SalaryRecord | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

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
      width: 220,
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
