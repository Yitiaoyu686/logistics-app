import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input,
  Select, InputNumber, message, Row, Col, Statistic,
  Typography, Descriptions, Alert, Divider,
  Upload, Drawer, Timeline
} from 'antd';
import {
  CheckOutlined, DollarOutlined, FileTextOutlined,
  UploadOutlined, PlusOutlined, DeleteOutlined,
  ClockCircleOutlined, BankOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

// --- 类型定义 ---
interface ExpenseItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  jobNo: string;  // 归属的JOB
}

interface PettyCashForVerify {
  id: string;
  applicationNo: string;
  applicant: string;
  department: string;
  appliedAmount: number;
  currency: string;
  purpose: string;
  relatedJob?: string;
  status: 'PAID' | 'VERIFIED';
  applyTime: string;
  paidTime: string;
  verifyTime?: string;
  verifier?: string;

  // 核销信息
  actualAmount?: number;
  expenses?: ExpenseItem[];
  invoiceUrls?: string[];
  verifyRemark?: string;
}

// --- 数据状态（暂无API，使用空数组初始化） ---

const STATUS_CONFIG = {
  PAID: { text: '待核销', color: 'blue' },
  VERIFIED: { text: '已核销', color: 'green' }
};

// 详情 Drawer 导航项
const DETAIL_NAV_ITEMS = [
  { key: 'verify-basic', title: '基本信息' },
  { key: 'verify-amount', title: '金额信息' },
  { key: 'verify-expenses', title: '费用明细' },
  { key: 'verify-timeline', title: '核销流程' },
];

export const PettyCashVerify: React.FC = () => {
  const [data, setData] = useState<PettyCashForVerify[]>([]);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<PettyCashForVerify | null>(null);
  const [verifyForm] = Form.useForm();
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('PAID');

  // 统计数据
  const stats = useMemo(() => ({
    toVerify: data.filter(d => d.status === 'PAID').length,
    verified: data.filter(d => d.status === 'VERIFIED').length,
    toVerifyAmount: data
      .filter(d => d.status === 'PAID')
      .reduce((sum, d) => sum + d.appliedAmount, 0),
    verifiedAmount: data
      .filter(d => d.status === 'VERIFIED')
      .reduce((sum, d) => sum + (d.actualAmount || 0), 0)
  }), [data]);

  // 过滤数据
  const filteredData = useMemo(() =>
    statusFilter === 'ALL'
      ? data
      : data.filter(d => d.status === statusFilter),
    [data, statusFilter]
  );

  // 打开核销弹窗
  const handleOpenVerify = (record: PettyCashForVerify) => {
    setCurrentRecord(record);
    setVerifyModalVisible(true);
    setExpenses([
      {
        id: 'temp_1',
        category: record.purpose,
        description: '',
        amount: record.appliedAmount,
        jobNo: record.relatedJob || ''
      }
    ]);
  };

  // 打开详情 Drawer
  const handleOpenDetail = (record: PettyCashForVerify) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  // 滚动到指定区域
  const scrollToElement = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 添加费用项
  const handleAddExpense = () => {
    setExpenses(prev => [
      ...prev,
      {
        id: `temp_${Date.now()}`,
        category: '',
        description: '',
        amount: 0,
        jobNo: ''
      }
    ]);
  };

  // 删除费用项
  const handleRemoveExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // 更新费用项
  const handleUpdateExpense = (id: string, field: keyof ExpenseItem, value: any) => {
    setExpenses(prev => prev.map(e =>
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  // 提交核销
  const handleSubmitVerify = async () => {
    try {
      if (expenses.length === 0) {
        message.error('请至少添加一个费用项');
        return;
      }
      const hasEmptyJob = expenses.some(e => !e.jobNo);
      if (hasEmptyJob) {
        message.error('请为每个费用项选择归属任务');
        return;
      }
      const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
      if (totalExpense > currentRecord!.appliedAmount * 1.1) {
        message.error('实际支出金额不能超过申请金额的110%');
        return;
      }

      const values = await verifyForm.validateFields();

      setData(prev => prev.map(d => {
        if (d.id === currentRecord!.id) {
          return {
            ...d,
            status: 'VERIFIED' as const,
            actualAmount: totalExpense,
            expenses: expenses,
            verifyTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            verifier: '财务主管',
            verifyRemark: values.remark,
            invoiceUrls: values.invoices?.fileList?.map((f: any) => f.name) || []
          };
        }
        return d;
      }));

      // 显示归集信息
      const jobGroups = expenses.reduce((acc, e) => {
        if (!acc[e.jobNo]) acc[e.jobNo] = 0;
        acc[e.jobNo] += e.amount;
        return acc;
      }, {} as Record<string, number>);

      const jobSummary = Object.entries(jobGroups)
        .map(([job, amount]) => `${job}: ¥${amount.toLocaleString()}`)
        .join('\n');

      Modal.success({
        title: '核销成功',
        content: (
          <div>
            <p>备用金已核销，费用已归集到以下任务的成本中：</p>
            <pre style={{ background: '#f5f5f5', padding: 12, marginTop: 12 }}>
              {jobSummary}
            </pre>
            <Alert
              message="系统提醒"
              description="这些费用会自动出现在「任务费用审核」页面，并影响对应任务的毛利计算"
              type="info"
              showIcon
              style={{ marginTop: 12 }}
            />
          </div>
        ),
        width: 500
      });

      setVerifyModalVisible(false);
      verifyForm.resetFields();
      setExpenses([]);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 列表列定义
  const columns = [
    {
      title: '申请单号',
      dataIndex: 'applicationNo',
      width: 160,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 100,
      render: (text: string, record: PettyCashForVerify) => (
        <Space direction="vertical" size={0}>
          <Text>{text}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>({record.department})</Text>
        </Space>
      )
    },
    {
      title: '申请金额',
      dataIndex: 'appliedAmount',
      width: 100,
      align: 'right' as const,
      render: (val: number, record: PettyCashForVerify) => (
        <Text strong>
          {record.currency === 'CNY' ? '¥' : '$'}{val.toLocaleString()}
        </Text>
      )
    },
    {
      title: '实际支出',
      dataIndex: 'actualAmount',
      width: 100,
      align: 'right' as const,
      render: (val: number, record: PettyCashForVerify) => {
        if (!val) return <Text type="secondary">-</Text>;
        const diff = val - record.appliedAmount;
        return (
          <Space direction="vertical" size={0}>
            <Text strong style={{ color: diff < 0 ? '#52c41a' : '#000' }}>
              {record.currency === 'CNY' ? '¥' : '$'}{val.toLocaleString()}
            </Text>
            {diff !== 0 && (
              <Text type={diff < 0 ? 'success' : 'warning'} style={{ fontSize: 11 }}>
                {diff > 0 ? '+' : ''}{diff.toFixed(0)}
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      width: 120
    },
    {
      title: '关联任务',
      dataIndex: 'relatedJob',
      width: 150,
      render: (val: string) => val ? <a>{val}</a> : <Text type="secondary">-</Text>
    },
    {
      title: '发放时间',
      dataIndex: 'paidTime',
      width: 140,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val: keyof typeof STATUS_CONFIG) => (
        <Tag color={STATUS_CONFIG[val].color}>
          {STATUS_CONFIG[val].text}
        </Tag>
      )
    },
    {
      title: '操作',
      width: 150,
      render: (_: any, record: PettyCashForVerify) => (
        <Space size="small">
          {record.status === 'PAID' ? (
            <>
              <Button
                type="primary"
                size="small"
                onClick={() => handleOpenVerify(record)}
              >
                核销
              </Button>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleOpenDetail(record)}
              >
                详情
              </Button>
            </>
          ) : (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpenDetail(record)}
            >
              查看详情
            </Button>
          )}
        </Space>
      )
    }
  ];

  // 计算实际支出总额
  const actualTotalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const variance = actualTotalAmount - (currentRecord?.appliedAmount || 0);

  // 当前详情记录的金额差异
  const detailVariance = (currentRecord?.actualAmount || 0) - (currentRecord?.appliedAmount || 0);
  const currencySymbol = currentRecord?.currency === 'CNY' ? '¥' : '$';

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待核销"
              value={stats.toVerify}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
              suffix="笔"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待核销金额"
              value={stats.toVerifyAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已核销"
              value={stats.verified}
              prefix={<CheckOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="笔"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已核销金额"
              value={stats.verifiedAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
              >
                <Select.Option value="ALL">全部状态</Select.Option>
                <Select.Option value="PAID">待核销</Select.Option>
                <Select.Option value="VERIFIED">已核销</Select.Option>
              </Select>
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
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      {/* 核销 Modal */}
      <Modal
        title="备用金核销"
        open={verifyModalVisible}
        onCancel={() => {
          setVerifyModalVisible(false);
          verifyForm.resetFields();
          setExpenses([]);
        }}
        onOk={handleSubmitVerify}
        width={900}
        destroyOnClose
      >
        {currentRecord && (
          <div>
            <Alert
              message="核销说明"
              description="请填写实际支出明细，并为每笔费用指定归属任务。核销后，费用会自动归集到对应任务的成本中。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label="申请单号">
                  {currentRecord.applicationNo}
                </Descriptions.Item>
                <Descriptions.Item label="申请人">
                  {currentRecord.applicant}
                </Descriptions.Item>
                <Descriptions.Item label="申请金额">
                  <Text strong style={{ color: '#1890ff' }}>
                    {currencySymbol}{currentRecord.appliedAmount.toLocaleString()}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="用途">
                  {currentRecord.purpose}
                </Descriptions.Item>
                <Descriptions.Item label="关联任务" span={2}>
                  {currentRecord.relatedJob ? (
                    <a>{currentRecord.relatedJob}</a>
                  ) : (
                    <Text type="secondary">未关联</Text>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Divider titlePlacement="left">
              <Space>
                <FileTextOutlined />
                <span>支出明细</span>
              </Space>
            </Divider>

            {/* 费用项列表 */}
            <div style={{ marginBottom: 16 }}>
              {expenses.map((expense, index) => (
                <Card
                  key={expense.id}
                  size="small"
                  style={{ marginBottom: 8 }}
                  title={`费用项 ${index + 1}`}
                  extra={
                    expenses.length > 1 && (
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveExpense(expense.id)}
                      >
                        删除
                      </Button>
                    )
                  }
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">费用类别</Text>
                      </div>
                      <Select
                        value={expense.category}
                        onChange={(val) => handleUpdateExpense(expense.id, 'category', val)}
                        style={{ width: '100%' }}
                        placeholder="选择类别"
                      >
                        <Select.Option value="客户接待费用">客户接待费用</Select.Option>
                        <Select.Option value="码头搬运费">码头搬运费</Select.Option>
                        <Select.Option value="港口临时费用">港口临时费用</Select.Option>
                        <Select.Option value="打印复印费">打印复印费</Select.Option>
                        <Select.Option value="快递费">快递费</Select.Option>
                        <Select.Option value="海关查验费">海关查验费</Select.Option>
                        <Select.Option value="其他费用">其他费用</Select.Option>
                      </Select>
                    </Col>
                    <Col span={8}>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">金额</Text>
                      </div>
                      <InputNumber
                        value={expense.amount}
                        onChange={(val) => handleUpdateExpense(expense.id, 'amount', val || 0)}
                        style={{ width: '100%' }}
                        placeholder="输入金额"
                        min={0}
                        precision={2}
                        prefix="¥"
                      />
                    </Col>
                    <Col span={8}>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">
                          <BankOutlined /> 归属任务 <Text type="danger">*</Text>
                        </Text>
                      </div>
                      <Select
                        value={expense.jobNo}
                        onChange={(val) => handleUpdateExpense(expense.id, 'jobNo', val)}
                        style={{ width: '100%' }}
                        placeholder="选择归属任务"
                        showSearch
                      >
                        <Select.Option value="JOB-SZX-LAX-231028">JOB-SZX-LAX-231028</Select.Option>
                        <Select.Option value="JOB-SZX-NYC-231101">JOB-SZX-NYC-231101</Select.Option>
                        <Select.Option value="JOB-GZU-LAX-231115">JOB-GZU-LAX-231115</Select.Option>
                      </Select>
                    </Col>
                    <Col span={24} style={{ marginTop: 8 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Text type="secondary">详细说明</Text>
                      </div>
                      <Input
                        value={expense.description}
                        onChange={(e) => handleUpdateExpense(expense.id, 'description', e.target.value)}
                        placeholder="例如: 接待客户用餐费用"
                      />
                    </Col>
                  </Row>
                </Card>
              ))}

              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={handleAddExpense}
              >
                添加费用项
              </Button>
            </div>

            {/* 金额汇总 */}
            <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Statistic
                    title="申请金额"
                    value={currentRecord.appliedAmount}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="实际支出"
                    value={actualTotalAmount}
                    precision={2}
                    prefix="¥"
                    valueStyle={{
                      fontSize: 16,
                      color: variance > 0 ? '#fa8c16' : '#52c41a'
                    }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="节余/超支"
                    value={Math.abs(variance)}
                    precision={2}
                    prefix={variance < 0 ? '节余 ¥' : '超支 ¥'}
                    valueStyle={{
                      fontSize: 16,
                      color: variance < 0 ? '#52c41a' : '#fa8c16'
                    }}
                  />
                </Col>
              </Row>
              {variance > 0 && variance > currentRecord.appliedAmount * 0.1 && (
                <Alert
                  message="超支预警"
                  description="实际支出超过申请金额10%以上，请核实明细是否准确"
                  type="warning"
                  showIcon
                  style={{ marginTop: 12 }}
                />
              )}
            </Card>

            <Form form={verifyForm} layout="vertical">
              <Form.Item
                name="invoices"
                label="上传发票凭证"
                rules={[{ required: true, message: '请上传发票凭证' }]}
              >
                <Upload
                  accept=".pdf,.jpg,.png"
                  maxCount={5}
                  beforeUpload={() => false}
                  listType="picture-card"
                >
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>上传</div>
                  </div>
                </Upload>
              </Form.Item>

              <Form.Item name="remark" label="核销说明">
                <TextArea
                  rows={3}
                  placeholder="输入核销说明、特殊情况等"
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={currentRecord ? `核销详情 - ${currentRecord.applicationNo}` : '核销详情'}
        open={detailVisible}
        onClose={() => { setDetailVisible(false); setCurrentRecord(null); }}
        width="80%"
        destroyOnClose
        extra={
          currentRecord?.status === 'PAID' ? (
            <Button
              type="primary"
              onClick={() => {
                setDetailVisible(false);
                if (currentRecord) handleOpenVerify(currentRecord);
              }}
            >
              核销
            </Button>
          ) : undefined
        }
      >
        {currentRecord && (
          <Row gutter={16}>
            {/* 左侧导航 */}
            <Col span={3}>
              <div style={{ position: 'sticky', top: 100 }}>
                <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 4, padding: '8px 0' }}>
                  {DETAIL_NAV_ITEMS.map(item => (
                    <div
                      key={item.key}
                      onClick={() => scrollToElement(item.key)}
                      style={{
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: '#595959',
                        borderLeft: '3px solid transparent',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.color = '#1890ff';
                        (e.currentTarget as HTMLDivElement).style.borderLeftColor = '#1890ff';
                        (e.currentTarget as HTMLDivElement).style.background = '#f0f5ff';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.color = '#595959';
                        (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent';
                        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                      }}
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              </div>
            </Col>

            {/* 右侧内容 */}
            <Col span={21}>
              {/* 基本信息 */}
              <Card id="verify-basic" title="基本信息" style={{ marginBottom: 16 }}>
                <Descriptions column={3}>
                  <Descriptions.Item label="申请单号">
                    <Text strong>{currentRecord.applicationNo}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="申请人">
                    {currentRecord.applicant}
                  </Descriptions.Item>
                  <Descriptions.Item label="所属部门">
                    {currentRecord.department}
                  </Descriptions.Item>
                  <Descriptions.Item label="用途">
                    {currentRecord.purpose}
                  </Descriptions.Item>
                  <Descriptions.Item label="关联任务">
                    {currentRecord.relatedJob ? (
                      <a>{currentRecord.relatedJob}</a>
                    ) : (
                      <Text type="secondary">未关联</Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={STATUS_CONFIG[currentRecord.status].color}>
                      {STATUS_CONFIG[currentRecord.status].text}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="申请时间">
                    {dayjs(currentRecord.applyTime).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                  <Descriptions.Item label="发放时间">
                    {dayjs(currentRecord.paidTime).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                  {currentRecord.verifyTime && (
                    <Descriptions.Item label="核销时间">
                      {dayjs(currentRecord.verifyTime).format('YYYY-MM-DD HH:mm')}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>

              {/* 金额信息 */}
              <Card id="verify-amount" title="金额信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="申请金额"
                      value={currentRecord.appliedAmount}
                      precision={2}
                      prefix={currencySymbol}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="实际支出"
                      value={currentRecord.actualAmount || 0}
                      precision={2}
                      prefix={currencySymbol}
                      valueStyle={{
                        color: currentRecord.actualAmount ? '#000' : '#999'
                      }}
                    />
                  </Col>
                  <Col span={8}>
                    {currentRecord.actualAmount ? (
                      <Statistic
                        title="节余/超支"
                        value={Math.abs(detailVariance)}
                        precision={2}
                        prefix={detailVariance <= 0 ? `节余 ${currencySymbol}` : `超支 ${currencySymbol}`}
                        valueStyle={{
                          color: detailVariance <= 0 ? '#52c41a' : '#fa8c16'
                        }}
                      />
                    ) : (
                      <Statistic
                        title="节余/超支"
                        value={0}
                        prefix="-"
                        valueStyle={{ color: '#999' }}
                      />
                    )}
                  </Col>
                </Row>
                {currentRecord.verifyRemark && (
                  <Alert
                    message="核销说明"
                    description={currentRecord.verifyRemark}
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                )}
              </Card>

              {/* 费用明细 */}
              <Card id="verify-expenses" title="费用明细" style={{ marginBottom: 16 }}>
                {(currentRecord.expenses && currentRecord.expenses.length > 0) ? (
                  <Table
                    rowKey="id"
                    dataSource={currentRecord.expenses}
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: '费用类别',
                        dataIndex: 'category',
                        width: 150,
                      },
                      {
                        title: '详细说明',
                        dataIndex: 'description',
                        render: (val: string) => val || <Text type="secondary">-</Text>
                      },
                      {
                        title: '金额',
                        dataIndex: 'amount',
                        width: 120,
                        align: 'right' as const,
                        render: (val: number) => (
                          <Text strong>{currencySymbol}{val.toLocaleString()}</Text>
                        )
                      },
                      {
                        title: '归属任务',
                        dataIndex: 'jobNo',
                        width: 200,
                        render: (val: string) => val ? <a>{val}</a> : <Text type="secondary">-</Text>
                      }
                    ]}
                    summary={(pageData) => {
                      const total = pageData.reduce((sum, row) => sum + row.amount, 0);
                      return (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0}>
                            <Text strong>合计</Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} />
                          <Table.Summary.Cell index={2} align="right">
                            <Text strong style={{ color: '#1890ff' }}>
                              {currencySymbol}{total.toLocaleString()}
                            </Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={3} />
                        </Table.Summary.Row>
                      );
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
                    {currentRecord.status === 'PAID' ? '尚未核销，暂无费用明细' : '无费用明细数据'}
                  </div>
                )}
                {currentRecord.invoiceUrls && currentRecord.invoiceUrls.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary">发票凭证：</Text>
                    <Space style={{ marginTop: 8 }}>
                      {currentRecord.invoiceUrls.map((url, idx) => (
                        <Tag key={idx} icon={<FileTextOutlined />} color="blue">
                          {url}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
              </Card>

              {/* 核销流程 */}
              <Card id="verify-timeline" title="核销流程" style={{ marginBottom: 16 }}>
                <Timeline
                  items={[
                    {
                      color: 'blue',
                      children: (
                        <div>
                          <Text strong>提交申请</Text>
                          <br />
                          <Text type="secondary">
                            {currentRecord.applicant} · {dayjs(currentRecord.applyTime).format('YYYY-MM-DD HH:mm')}
                          </Text>
                          <br />
                          <Text>申请备用金 {currencySymbol}{currentRecord.appliedAmount.toLocaleString()}，用途：{currentRecord.purpose}</Text>
                        </div>
                      )
                    },
                    {
                      color: 'blue',
                      children: (
                        <div>
                          <Text strong>已发放</Text>
                          <br />
                          <Text type="secondary">
                            财务 · {dayjs(currentRecord.paidTime).format('YYYY-MM-DD HH:mm')}
                          </Text>
                          <br />
                          <Text>备用金已发放 {currencySymbol}{currentRecord.appliedAmount.toLocaleString()}</Text>
                        </div>
                      )
                    },
                    ...(currentRecord.status === 'VERIFIED' && currentRecord.verifyTime ? [{
                      color: 'green' as const,
                      children: (
                        <div>
                          <Text strong>已核销</Text>
                          <br />
                          <Text type="secondary">
                            {currentRecord.verifier || '财务'} · {dayjs(currentRecord.verifyTime).format('YYYY-MM-DD HH:mm')}
                          </Text>
                          <br />
                          <Text>
                            实际支出 {currencySymbol}{(currentRecord.actualAmount || 0).toLocaleString()}
                            {detailVariance < 0 && <Tag color="green" style={{ marginLeft: 8 }}>节余 {currencySymbol}{Math.abs(detailVariance).toLocaleString()}</Tag>}
                            {detailVariance > 0 && <Tag color="orange" style={{ marginLeft: 8 }}>超支 {currencySymbol}{detailVariance.toLocaleString()}</Tag>}
                          </Text>
                          {currentRecord.verifyRemark && (
                            <>
                              <br />
                              <Text type="secondary">备注：{currentRecord.verifyRemark}</Text>
                            </>
                          )}
                        </div>
                      )
                    }] : [{
                      color: 'gray' as const,
                      children: (
                        <div>
                          <Text type="secondary">待核销</Text>
                          <br />
                          <Text type="secondary">等待核销费用明细</Text>
                        </div>
                      )
                    }])
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
