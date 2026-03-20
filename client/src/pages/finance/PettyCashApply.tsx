import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input,
  Select, InputNumber, message, Row, Col, Statistic,
  Typography, Descriptions, Alert, Drawer,
  Timeline
} from 'antd';
import {
  PlusOutlined, DollarOutlined, CheckOutlined, CloseOutlined,
  ClockCircleOutlined, EyeOutlined, UserOutlined,
  MoneyCollectOutlined, AuditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { TextArea } = Input;

// 详情页左侧导航
const DETAIL_NAV_ITEMS = [
  { key: 'basic', title: '基本信息' },
  { key: 'amount', title: '金额信息' },
  { key: 'timeline', title: '审批流程' }
];

// --- 类型定义 ---
interface PettyCashApplication {
  id: string;
  applicationNo: string;
  applicant: string;
  department: string;
  amount: number;
  currency: string;
  purpose: string;
  relatedJob?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'VERIFIED';
  applyTime: string;
  approver?: string;
  approveTime?: string;
  rejectReason?: string;
  paymentTime?: string;
  payer?: string;
  verifyTime?: string;
  remark?: string;
}

// --- 数据状态（暂无API，使用空数组初始化） ---

const STATUS_CONFIG = {
  PENDING: { text: '待审批', color: 'orange' },
  APPROVED: { text: '已批准', color: 'blue' },
  REJECTED: { text: '已驳回', color: 'red' },
  PAID: { text: '已支付', color: 'cyan' },
  VERIFIED: { text: '已核销', color: 'green' }
};

export const PettyCashApply: React.FC = () => {
  const [data, setData] = useState<PettyCashApplication[]>([]);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<PettyCashApplication | null>(null);
  const [applyForm] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // 统计数据
  const stats = useMemo(() => ({
    pending: data.filter(d => d.status === 'PENDING').length,
    pendingAmount: data.filter(d => d.status === 'PENDING').reduce((sum, d) => sum + d.amount, 0),
    approved: data.filter(d => d.status === 'APPROVED').length,
    paid: data.filter(d => d.status === 'PAID').length,
    totalAmount: data
      .filter(d => ['APPROVED', 'PAID', 'VERIFIED'].includes(d.status))
      .reduce((sum, d) => sum + d.amount, 0)
  }), [data]);

  // 过滤数据
  const filteredData = useMemo(() => {
    if (statusFilter === 'ALL') return data;
    return data.filter(d => d.status === statusFilter);
  }, [data, statusFilter]);

  // 提交申请
  const handleSubmitApply = async () => {
    try {
      const values = await applyForm.validateFields();
      const newApplication: PettyCashApplication = {
        id: `PC${String(data.length + 1).padStart(3, '0')}`,
        applicationNo: `PETTY-${dayjs().format('YYYY')}-${String(data.length + 1).padStart(3, '0')}`,
        applicant: '当前用户',
        department: values.department,
        amount: values.amount,
        currency: values.currency,
        purpose: values.purpose,
        relatedJob: values.relatedJob,
        status: 'PENDING',
        applyTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        remark: values.remark
      };
      setData(prev => [newApplication, ...prev]);
      message.success('备用金申请已提交，请等待审批');
      setApplyModalVisible(false);
      applyForm.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 查看详情
  const handleViewDetail = (record: PettyCashApplication) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  // 撤回申请
  const handleWithdraw = (record: PettyCashApplication) => {
    Modal.confirm({
      title: '撤回申请',
      content: `确定要撤回申请 ${record.applicationNo} 吗？`,
      onOk: () => {
        setData(prev => prev.filter(d => d.id !== record.id));
        message.success('申请已撤回');
        setDetailVisible(false);
      }
    });
  };

  // 审批通过
  const handleApprove = (record: PettyCashApplication) => {
    Modal.confirm({
      title: '审批通过',
      content: (
        <div>
          <p>确定批准 <Text strong>{record.applicant}</Text> 的备用金申请吗？</p>
          <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="申请金额">
              <Text strong style={{ color: '#1890ff', fontSize: 16 }}>
                {record.currency === 'CNY' ? '¥' : '$'}{record.amount.toLocaleString()}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="用途">{record.purpose}</Descriptions.Item>
          </Descriptions>
        </div>
      ),
      onOk: () => {
        setData(prev => prev.map(d =>
          d.id === record.id
            ? { ...d, status: 'APPROVED' as const, approver: '当前用户', approveTime: dayjs().format('YYYY-MM-DD HH:mm:ss') }
            : d
        ));
        message.success('审批通过');
        setDetailVisible(false);
      }
    });
  };

  // 审批驳回
  const handleReject = (record: PettyCashApplication) => {
    Modal.confirm({
      title: '驳回申请',
      content: (
        <div>
          <p>确定驳回 <Text strong>{record.applicant}</Text> 的备用金申请吗？</p>
          <Alert message="驳回后申请人可重新提交" type="warning" showIcon style={{ marginTop: 12 }} />
        </div>
      ),
      onOk: () => {
        setData(prev => prev.map(d =>
          d.id === record.id
            ? { ...d, status: 'REJECTED' as const, approver: '当前用户', approveTime: dayjs().format('YYYY-MM-DD HH:mm:ss'), rejectReason: '请核实用途后重新提交' }
            : d
        ));
        message.warning('已驳回');
        setDetailVisible(false);
      }
    });
  };

  // 发放备用金
  const handlePay = (record: PettyCashApplication) => {
    Modal.confirm({
      title: '发放备用金',
      content: (
        <div>
          <p>确定发放备用金给 <Text strong>{record.applicant}</Text> 吗？</p>
          <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="发放金额">
              <Text strong style={{ color: '#52c41a', fontSize: 18 }}>
                {record.currency === 'CNY' ? '¥' : '$'}{record.amount.toLocaleString()}
              </Text>
            </Descriptions.Item>
          </Descriptions>
          <Alert message="发放后该笔备用金将进入「待核销」状态" type="info" showIcon style={{ marginTop: 12 }} />
        </div>
      ),
      onOk: () => {
        setData(prev => prev.map(d =>
          d.id === record.id
            ? { ...d, status: 'PAID' as const, paymentTime: dayjs().format('YYYY-MM-DD HH:mm:ss'), payer: '当前用户' }
            : d
        ));
        message.success('备用金已发放');
        setDetailVisible(false);
      }
    });
  };

  // 列表列定义
  const columns = [
    {
      title: '申请单号',
      dataIndex: 'applicationNo',
      width: 160,
      render: (text: string, record: PettyCashApplication) => (
        <a onClick={() => handleViewDetail(record)}>{text}</a>
      )
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 120,
      render: (text: string, record: PettyCashApplication) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <UserOutlined />
            <Text strong>{text}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.department}</Text>
        </Space>
      )
    },
    {
      title: '申请金额',
      dataIndex: 'amount',
      width: 120,
      align: 'right' as const,
      render: (val: number, record: PettyCashApplication) => (
        <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
          {record.currency === 'CNY' ? '¥' : '$'}{val.toLocaleString()}
        </Text>
      )
    },
    {
      title: '用途',
      dataIndex: 'purpose',
      width: 130
    },
    {
      title: '关联任务',
      dataIndex: 'relatedJob',
      width: 160,
      render: (val: string) => val ? <a>{val}</a> : <Text type="secondary">-</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (val: keyof typeof STATUS_CONFIG) => (
        <Tag color={STATUS_CONFIG[val].color}>{STATUS_CONFIG[val].text}</Tag>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'applyTime',
      width: 140,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '审批人',
      dataIndex: 'approver',
      width: 80,
      render: (val: string) => val || <Text type="secondary">-</Text>
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: PettyCashApplication) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'PENDING' && (
            <Button type="link" size="small" icon={<AuditOutlined />} onClick={() => handleApprove(record)}>
              审批
            </Button>
          )}
          {record.status === 'APPROVED' && (
            <Button type="link" size="small" icon={<MoneyCollectOutlined />} style={{ color: '#52c41a' }} onClick={() => handlePay(record)}>
              发放
            </Button>
          )}
          {record.status === 'PENDING' && (
            <Button type="link" size="small" danger onClick={() => handleWithdraw(record)}>
              撤回
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
              title="待审批"
              value={stats.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
              suffix="笔"
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              金额: ¥{stats.pendingAmount.toLocaleString()}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已批准待发放"
              value={stats.approved}
              prefix={<CheckOutlined />}
              valueStyle={{ color: '#1890ff' }}
              suffix="笔"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已支付/待核销"
              value={stats.paid}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#13c2c2' }}
              suffix="笔"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计批准金额"
              value={stats.totalAmount}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#722ed1', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选与操作 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
                <Select.Option value="ALL">全部状态</Select.Option>
                <Select.Option value="PENDING">待审批</Select.Option>
                <Select.Option value="APPROVED">已批准</Select.Option>
                <Select.Option value="PAID">已支付</Select.Option>
                <Select.Option value="REJECTED">已驳回</Select.Option>
                <Select.Option value="VERIFIED">已核销</Select.Option>
              </Select>
            </Space>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setApplyModalVisible(true)}>
              申请备用金
            </Button>
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

      {/* 申请备用金 Modal */}
      <Modal
        title="申请备用金"
        open={applyModalVisible}
        onCancel={() => { setApplyModalVisible(false); applyForm.resetFields(); }}
        onOk={handleSubmitApply}
        width={600}
        destroyOnClose
      >
        <Alert
          message="备用金申请说明"
          description="备用金用于临时、紧急支出，金额一般不超过2000元。大额支出请走正规报销流程。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={applyForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department" label="所属部门" rules={[{ required: true, message: '请选择部门' }]}>
                <Select placeholder="选择部门">
                  <Select.Option value="销售部">销售部</Select.Option>
                  <Select.Option value="操作部">操作部</Select.Option>
                  <Select.Option value="仓储部">仓储部</Select.Option>
                  <Select.Option value="美国分部">美国分部</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="relatedJob" label="关联任务（可选）">
                <Select placeholder="选择任务号" allowClear showSearch>
                  <Select.Option value="JOB-SZX-LAX-231028">JOB-SZX-LAX-231028</Select.Option>
                  <Select.Option value="JOB-SZX-NYC-231101">JOB-SZX-NYC-231101</Select.Option>
                  <Select.Option value="JOB-GZU-LAX-231115">JOB-GZU-LAX-231115</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="申请金额"
                rules={[
                  { required: true, message: '请输入金额' },
                  { validator: (_, value) => value && value > 2000 ? Promise.reject('备用金金额不能超过2000元') : Promise.resolve() }
                ]}
              >
                <InputNumber style={{ width: '100%' }} placeholder="请输入金额" min={0} max={2000} precision={2} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label="币种" rules={[{ required: true }]} initialValue="CNY">
                <Select>
                  <Select.Option value="CNY">CNY (人民币)</Select.Option>
                  <Select.Option value="USD">USD (美元)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="purpose" label="用途说明" rules={[{ required: true, message: '请选择用途' }]}>
            <Select placeholder="选择用途" showSearch allowClear>
              <Select.Option value="客户接待费用">客户接待费用</Select.Option>
              <Select.Option value="码头搬运费">码头搬运费</Select.Option>
              <Select.Option value="港口临时费用">港口临时费用</Select.Option>
              <Select.Option value="打印复印费">打印复印费</Select.Option>
              <Select.Option value="快递费">快递费</Select.Option>
              <Select.Option value="海关查验费">海关查验费</Select.Option>
              <Select.Option value="其他临时支出">其他临时支出</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="详细说明" rules={[{ required: true, message: '请输入详细说明' }]}>
            <TextArea rows={4} placeholder="请详细说明资金用途、预计支出时间、金额明细等" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title={
          currentRecord ? (
            <Space>
              <Title level={5} style={{ margin: 0 }}>{currentRecord.applicationNo}</Title>
              <Tag color={STATUS_CONFIG[currentRecord.status].color}>
                {STATUS_CONFIG[currentRecord.status].text}
              </Tag>
            </Space>
          ) : null
        }
        placement="right"
        width="80%"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        destroyOnClose
        extra={
          currentRecord ? (
            <Space>
              {currentRecord.status === 'PENDING' && (
                <>
                  <Button type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(currentRecord)}>审批通过</Button>
                  <Button danger icon={<CloseOutlined />} onClick={() => handleReject(currentRecord)}>驳回</Button>
                  <Button onClick={() => handleWithdraw(currentRecord)}>撤回申请</Button>
                </>
              )}
              {currentRecord.status === 'APPROVED' && (
                <Button type="primary" icon={<MoneyCollectOutlined />} onClick={() => handlePay(currentRecord)}>
                  发放备用金
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
                  {DETAIL_NAV_ITEMS.map(item => (
                    <div
                      key={item.key}
                      onClick={() => {
                        const el = document.getElementById(`petty-${item.key}`);
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
              <Card id="petty-basic" title="基本信息" style={{ marginBottom: 16 }}>
                <Descriptions bordered column={3} size="small">
                  <Descriptions.Item label="申请单号">
                    <Text strong>{currentRecord.applicationNo}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="申请人">
                    <Space size={4}>
                      <UserOutlined />
                      <Text strong>{currentRecord.applicant}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="所属部门">{currentRecord.department}</Descriptions.Item>
                  <Descriptions.Item label="用途">{currentRecord.purpose}</Descriptions.Item>
                  <Descriptions.Item label="关联任务">
                    {currentRecord.relatedJob ? <a>{currentRecord.relatedJob}</a> : <Text type="secondary">无</Text>}
                  </Descriptions.Item>
                  <Descriptions.Item label="申请时间">
                    {dayjs(currentRecord.applyTime).format('YYYY-MM-DD HH:mm')}
                  </Descriptions.Item>
                  {currentRecord.remark && (
                    <Descriptions.Item label="详细说明" span={3}>{currentRecord.remark}</Descriptions.Item>
                  )}
                  {currentRecord.rejectReason && (
                    <Descriptions.Item label="驳回原因" span={3}>
                      <Alert message={currentRecord.rejectReason} type="error" showIcon />
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>

              {/* 金额信息 */}
              <Card id="petty-amount" title="金额信息" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#f0f5ff', border: '1px solid #adc6ff', textAlign: 'center' }}>
                      <Statistic
                        title="申请金额"
                        value={currentRecord.amount}
                        prefix={currentRecord.currency === 'CNY' ? '¥' : '$'}
                        precision={2}
                        valueStyle={{ color: '#1890ff', fontSize: 24 }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#fafafa', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                      <Statistic
                        title="币种"
                        value={currentRecord.currency === 'CNY' ? '人民币 (CNY)' : '美元 (USD)'}
                        valueStyle={{ fontSize: 18 }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#fafafa', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                      <Statistic
                        title="备用金限额"
                        value={2000}
                        prefix="¥"
                        valueStyle={{ fontSize: 18, color: '#999' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </Card>

              {/* 审批流程 */}
              <Card id="petty-timeline" title="审批流程">
                <Timeline
                  items={[
                    {
                      color: 'green',
                      children: (
                        <div>
                          <Text strong>申请提交</Text>
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            {currentRecord.applicant} 于 {dayjs(currentRecord.applyTime).format('YYYY-MM-DD HH:mm')} 提交申请
                          </div>
                        </div>
                      )
                    },
                    ...(currentRecord.approveTime ? [{
                      color: (currentRecord.status === 'REJECTED' ? 'red' : 'blue') as 'red' | 'blue',
                      children: (
                        <div>
                          <Text strong>{currentRecord.status === 'REJECTED' ? '审批驳回' : '审批通过'}</Text>
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            {currentRecord.approver} 于 {dayjs(currentRecord.approveTime).format('YYYY-MM-DD HH:mm')} 审批
                          </div>
                          {currentRecord.rejectReason && (
                            <Alert message="驳回原因" description={currentRecord.rejectReason} type="error" showIcon style={{ marginTop: 8 }} />
                          )}
                        </div>
                      )
                    }] : []),
                    ...(currentRecord.paymentTime ? [{
                      color: 'cyan' as const,
                      children: (
                        <div>
                          <Text strong>备用金发放</Text>
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            {currentRecord.payer || '财务'} 于 {dayjs(currentRecord.paymentTime).format('YYYY-MM-DD HH:mm')} 发放
                          </div>
                        </div>
                      )
                    }] : []),
                    ...(currentRecord.verifyTime ? [{
                      color: 'green' as const,
                      children: (
                        <div>
                          <Text strong>核销完成</Text>
                          <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                            于 {dayjs(currentRecord.verifyTime).format('YYYY-MM-DD HH:mm')} 核销
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
