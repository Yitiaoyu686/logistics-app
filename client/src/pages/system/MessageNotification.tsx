import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message,
  Popconfirm, Switch, Badge, Tooltip, Row, Col, Statistic, Descriptions, Tabs, Typography
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined,
  SearchOutlined, ReloadOutlined, EyeOutlined, BellOutlined,
  ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Text } = Typography;

// ==================== 共享类型定义 ====================

/** 业务模块 */
const MODULE_OPTIONS = [
  { value: 'SYSTEM', label: '系统管理', color: 'blue' },
  { value: 'OMS', label: '订单中心', color: 'cyan' },
  { value: 'WMS_ORIGIN', label: '起运国仓储', color: 'green' },
  { value: 'TMS', label: '运输管理', color: 'purple' },
  { value: 'WMS_DEST', label: '到达国仓储', color: 'lime' },
  { value: 'FINANCE', label: '财务中心', color: 'gold' },
  { value: 'CRM', label: '客户中心', color: 'magenta' },
  { value: 'ANALYTICS', label: '经营分析', color: 'volcano' },
];

/** 通知渠道 */
const CHANNEL_OPTIONS = [
  { value: 'IN_APP', label: '站内信', color: 'blue' },
  { value: 'EMAIL', label: '邮件', color: 'green' },
  { value: 'SMS', label: '短信', color: 'orange' },
  { value: 'WECHAT', label: '微信', color: 'cyan' },
];

/** 接收角色 */
const ROLE_OPTIONS = [
  { value: 'ADMIN', label: '系统管理员' },
  { value: 'SALES', label: '销售人员' },
  { value: 'WAREHOUSE_CN', label: '起运国仓管' },
  { value: 'OPS_CN', label: '起运国操作' },
  { value: 'OPS_US', label: '到达国操作' },
  { value: 'WAREHOUSE_US', label: '到达国仓管' },
  { value: 'FINANCE', label: '财务人员' },
  { value: 'BOSS', label: '管理层' },
  { value: 'DRIVER', label: '司机' },
  { value: 'CUSTOMER', label: '客户' },
];

// ==================== 消息发布 ====================

interface NoticeMessage {
  id: string;
  title: string;
  content: string;
  module: string;
  type: 'ANNOUNCEMENT' | 'ALERT' | 'REMINDER' | 'POLICY' | 'PROMOTION';
  priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'REVOKED' | 'EXPIRED';
  channels: string[];
  targetScope: 'ALL' | 'ROLE' | 'DEPARTMENT' | 'USER';
  targetRoles?: string[];
  targetUsers?: string;
  scheduledAt?: string;
  expiredAt?: string;
  publishTime?: string;
  createdBy: string;
  createdAt: string;
  readCount: number;
  totalTarget: number;
}

const MSG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  ANNOUNCEMENT: { label: '公告通知', color: 'blue' },
  ALERT: { label: '预警提醒', color: 'red' },
  REMINDER: { label: '业务提醒', color: 'orange' },
  POLICY: { label: '规则变更', color: 'purple' },
  PROMOTION: { label: '活动推广', color: 'green' },
};

const MSG_PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  URGENT: { label: '紧急', color: 'red' },
  HIGH: { label: '重要', color: 'orange' },
  NORMAL: { label: '普通', color: 'blue' },
  LOW: { label: '一般', color: 'default' },
};

const MSG_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT: { label: '草稿', color: 'default', icon: <EditOutlined /> },
  SCHEDULED: { label: '定时发布', color: 'processing', icon: <ClockCircleOutlined /> },
  PUBLISHED: { label: '已发布', color: 'success', icon: <CheckCircleOutlined /> },
  REVOKED: { label: '已撤回', color: 'warning', icon: <StopOutlined /> },
  EXPIRED: { label: '已过期', color: 'default', icon: <ExclamationCircleOutlined /> },
};

const MOCK_MESSAGES: NoticeMessage[] = [
  {
    id: 'MSG-001', title: '系统升级维护通知', content: '系统将于本周六凌晨2:00-6:00进行版本升级维护，届时所有业务模块将暂停服务。请各部门提前做好工作安排，确保周五下班前完成紧急业务处理。\n\n升级内容：\n1. 到达国仓储模块新增DPN管理功能\n2. 财务中心新增提成计算模块\n3. 系统性能优化',
    module: 'SYSTEM', type: 'ANNOUNCEMENT', priority: 'URGENT', status: 'PUBLISHED', channels: ['IN_APP', 'EMAIL', 'SMS'],
    targetScope: 'ALL', publishTime: '2026-03-30 10:00', createdBy: 'admin', createdAt: '2026-03-29 16:00:00', readCount: 45, totalTarget: 52,
  },
  {
    id: 'MSG-002', title: '非洲航线运费标准调整通知', content: '自4月1日起，广州→拉各斯海运航线运费标准调整如下：\n\n1. 首重单价由 63 元/kg 调整为 65 元/kg\n2. 续重≥5kg 档位由 57 元/kg 调整为 59 元/kg\n3. 体积比维持 1:6000 不变\n4. 最低收费由 150 元调整为 180 元\n\n请销售团队及时更新报价单，并通知已有客户。',
    module: 'TMS', type: 'POLICY', priority: 'HIGH', status: 'PUBLISHED', channels: ['IN_APP', 'EMAIL'],
    targetScope: 'ROLE', targetRoles: ['SALES', 'OPS_CN', 'FINANCE'], publishTime: '2026-03-28 14:30', createdBy: 'admin', createdAt: '2026-03-28 10:00:00', readCount: 18, totalTarget: 23,
  },
  {
    id: 'MSG-003', title: '清明节放假及值班安排', content: '根据国务院办公厅通知，清明节放假安排如下：\n\n放假时间：4月4日（周五）至4月6日（周日），共3天\n上班时间：4月7日（周一）正常上班\n\n值班安排：\n- 起运国仓储：李仓管（4月4日）、张运营（4月5-6日）\n- 到达国仓储：正常运营\n- 客服热线：正常服务\n\n请各部门提前安排好节前工作。',
    module: 'SYSTEM', type: 'ANNOUNCEMENT', priority: 'NORMAL', status: 'PUBLISHED', channels: ['IN_APP', 'EMAIL'],
    targetScope: 'ALL', publishTime: '2026-03-25 09:00', createdBy: 'admin', createdAt: '2026-03-24 14:00:00', readCount: 52, totalTarget: 52,
  },
  {
    id: 'MSG-004', title: '广州总仓库存容量预警', content: '广州总仓（WH-GZ-001）当前库存已达85%，请及时安排以下操作：\n\n1. 加快待装箱货物的拼柜进度\n2. 优先处理滞留超7天的库存\n3. 联系客户催促未发运的预报订单\n\n当前库存明细：\n- 待入库：23单\n- 已入库待拼柜：156单\n- 已装箱待发运：12柜',
    module: 'WMS_ORIGIN', type: 'ALERT', priority: 'URGENT', status: 'PUBLISHED', channels: ['IN_APP', 'EMAIL'],
    targetScope: 'ROLE', targetRoles: ['WAREHOUSE_CN', 'OPS_CN', 'ADMIN'], publishTime: '2026-04-02 11:00', createdBy: 'admin', createdAt: '2026-04-02 11:00:00', readCount: 6, totalTarget: 8,
  },
  {
    id: 'MSG-005', title: '新功能上线：末端派送管理', content: '到达国仓储模块已上线以下新功能：\n\n1. DPN（末端派送单）管理 - 支持创建、分配、跟踪派送任务\n2. 派送路线优化 - 自动规划最优派送路径\n3. 签收确认 - 支持拍照签收和电子签名\n4. 客户短信通知 - 派送前自动发送短信提醒\n\n请到达国操作团队和仓储团队熟悉新功能操作流程。操作手册已上传至系统文档中心。',
    module: 'WMS_DEST', type: 'ANNOUNCEMENT', priority: 'NORMAL', status: 'DRAFT', channels: ['IN_APP'],
    targetScope: 'ROLE', targetRoles: ['OPS_US', 'WAREHOUSE_US'], createdBy: 'admin', createdAt: '2026-04-01 09:00:00', readCount: 0, totalTarget: 12,
  },
  {
    id: 'MSG-006', title: '3月应收账款催收提醒', content: '截至3月31日，以下客户有超期应收账款需要跟进：\n\n1. 深圳旺达贸易 - 超30天未收 ¥45,200\n2. 广州金辉国际 - 超15天未收 ¥28,600\n3. 尼日利亚 Adekunle Trading - 超45天未收 $3,200\n\n请对应销售人员本周内跟进催收，财务部将于下周进行应收账龄分析汇报。',
    module: 'FINANCE', type: 'REMINDER', priority: 'HIGH', status: 'PUBLISHED', channels: ['IN_APP', 'EMAIL'],
    targetScope: 'ROLE', targetRoles: ['SALES', 'FINANCE', 'BOSS'], publishTime: '2026-04-01 09:00', createdBy: 'finance1', createdAt: '2026-03-31 17:00:00', readCount: 8, totalTarget: 12,
  },
  {
    id: 'MSG-007', title: '4月提成规则更新说明', content: '自2026年4月起，销售提成规则做如下调整：\n\n广州空运方案ABCD（双指标互锁）：\n- A指标（重量）达标线由 2000kg 调整为 2500kg\n- B指标（毛利）达标线由 15% 调整为 12%\n\n海运老员工方案（毛利百分比）：\n- 毛利提成比例由 8% 调整为 10%\n\n详见薪资设置→提成规则。',
    module: 'FINANCE', type: 'POLICY', priority: 'HIGH', status: 'SCHEDULED', channels: ['IN_APP', 'EMAIL'],
    targetScope: 'ROLE', targetRoles: ['SALES', 'BOSS'], scheduledAt: '2026-04-01 08:00', createdBy: 'admin', createdAt: '2026-03-29 15:00:00', readCount: 0, totalTarget: 8,
  },
  {
    id: 'MSG-008', title: '海运拼箱S-JOB26030008到港通知', content: '任务编号 S-JOB26030008 已于2026年4月3日到达拉各斯港，请到达国操作团队安排清关。\n\n任务信息：\n- 路线：广州→拉各斯（海运）\n- 集装箱号：MSKU-2026-0301\n- 柜型：40HQ\n- 客户数：5家\n- 预计清关时间：3-5个工作日',
    module: 'TMS', type: 'REMINDER', priority: 'HIGH', status: 'PUBLISHED', channels: ['IN_APP', 'EMAIL', 'SMS'],
    targetScope: 'ROLE', targetRoles: ['OPS_US', 'WAREHOUSE_US'], publishTime: '2026-04-03 09:00', createdBy: 'ops_cn1', createdAt: '2026-04-03 08:30:00', readCount: 4, totalTarget: 5,
  },
];

export const MessagePublish: React.FC = () => {
  const [messages, setMessages] = useState<NoticeMessage[]>(MOCK_MESSAGES);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingMsg, setEditingMsg] = useState<NoticeMessage | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<NoticeMessage | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterModule, setFilterModule] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  const stats = useMemo(() => ({
    total: messages.length,
    published: messages.filter((m) => m.status === 'PUBLISHED').length,
    draft: messages.filter((m) => m.status === 'DRAFT').length,
    scheduled: messages.filter((m) => m.status === 'SCHEDULED').length,
  }), [messages]);

  const handleAdd = () => {
    setEditingMsg(null);
    form.resetFields();
    form.setFieldsValue({ module: 'SYSTEM', type: 'ANNOUNCEMENT', priority: 'NORMAL', targetScope: 'ALL', channels: ['IN_APP'] });
    setModalVisible(true);
  };

  const handleEdit = (record: NoticeMessage) => {
    setEditingMsg(record);
    form.setFieldsValue({ ...record });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingMsg) {
        setMessages((prev) => prev.map((m) => m.id === editingMsg.id ? { ...m, ...values } : m));
        message.success('消息更新成功');
      } else {
        const newMsg: NoticeMessage = {
          id: `MSG-${String(messages.length + 1).padStart(3, '0')}`,
          ...values,
          status: values.scheduledAt ? 'SCHEDULED' : 'DRAFT',
          createdBy: 'admin',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          readCount: 0,
          totalTarget: values.targetScope === 'ALL' ? 52 : 0,
        };
        setMessages((prev) => [newMsg, ...prev]);
        message.success('消息创建成功');
      }
      setModalVisible(false);
      form.resetFields();
    } catch { /* validation error */ }
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    message.success('消息已删除');
  };

  const handlePublish = (record: NoticeMessage) => {
    setMessages((prev) => prev.map((m) =>
      m.id === record.id ? { ...m, status: 'PUBLISHED' as const, publishTime: dayjs().format('YYYY-MM-DD HH:mm') } : m
    ));
    message.success('消息已发布');
  };

  const handleRevoke = (record: NoticeMessage) => {
    setMessages((prev) => prev.map((m) =>
      m.id === record.id ? { ...m, status: 'REVOKED' as const } : m
    ));
    message.success('消息已撤回');
  };

  const filteredMessages = messages.filter((msg) => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword && !msg.title.toLowerCase().includes(keyword) && !msg.content.toLowerCase().includes(keyword)) return false;
    if (filterModule && msg.module !== filterModule) return false;
    if (filterType && msg.type !== filterType) return false;
    if (filterStatus && msg.status !== filterStatus) return false;
    return true;
  });

  const columns = [
    {
      title: '标题', dataIndex: 'title', key: 'title', width: 240, ellipsis: true,
      render: (text: string, record: NoticeMessage) => (
        <Space>
          {record.priority === 'URGENT' && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          <a onClick={() => { setSelectedMsg(record); setDetailVisible(true); }}>{text}</a>
        </Space>
      ),
    },
    {
      title: '业务模块', dataIndex: 'module', key: 'module', width: 110,
      render: (v: string) => {
        const m = MODULE_OPTIONS.find((o) => o.value === v);
        return <Tag color={m?.color}>{m?.label || v}</Tag>;
      },
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 100,
      render: (v: string) => <Tag color={MSG_TYPE_CONFIG[v]?.color}>{MSG_TYPE_CONFIG[v]?.label}</Tag>,
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 80,
      render: (v: string) => <Tag color={MSG_PRIORITY_CONFIG[v]?.color}>{MSG_PRIORITY_CONFIG[v]?.label}</Tag>,
    },
    {
      title: '推送渠道', dataIndex: 'channels', key: 'channels', width: 160,
      render: (channels: string[]) => (
        <Space size={[2, 2]} wrap>
          {channels.map((ch) => {
            const c = CHANNEL_OPTIONS.find((o) => o.value === ch);
            return <Tag key={ch} color={c?.color} style={{ margin: 0 }}>{c?.label}</Tag>;
          })}
        </Space>
      ),
    },
    {
      title: '接收范围', key: 'target', width: 140, ellipsis: true,
      render: (_: any, record: NoticeMessage) => {
        if (record.targetScope === 'ALL') return '全部用户';
        if (record.targetRoles?.length) {
          return record.targetRoles.map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r).join('、');
        }
        return record.targetUsers || record.targetScope;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => {
        const c = MSG_STATUS_CONFIG[status];
        return <Tag icon={c?.icon} color={c?.color}>{c?.label}</Tag>;
      },
    },
    {
      title: '已读/总数', key: 'readRate', width: 90, align: 'center' as const,
      render: (_: any, record: NoticeMessage) => (
        <span style={{ color: record.readCount >= record.totalTarget ? '#52c41a' : '#666' }}>
          {record.readCount}/{record.totalTarget}
        </span>
      ),
    },
    {
      title: '发布时间', dataIndex: 'publishTime', key: 'publishTime', width: 140,
      render: (v: string, record: NoticeMessage) => {
        if (record.status === 'SCHEDULED' && record.scheduledAt) return <Text type="secondary"><ClockCircleOutlined /> {record.scheduledAt}</Text>;
        return v || '-';
      },
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right' as const,
      render: (_: any, record: NoticeMessage) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedMsg(record); setDetailVisible(true); }}>查看</Button>
          {(record.status === 'DRAFT' || record.status === 'SCHEDULED') && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Popconfirm title="确认立即发布？" onConfirm={() => handlePublish(record)}>
                <Button type="link" size="small" icon={<SendOutlined />} style={{ color: '#52c41a' }}>发布</Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'PUBLISHED' && (
            <Popconfirm title="撤回后用户将不再可见，确认？" onConfirm={() => handleRevoke(record)}>
              <Button type="link" size="small" style={{ color: '#faad14' }}>撤回</Button>
            </Popconfirm>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}><Statistic title="消息总数" value={stats.total} prefix={<BellOutlined />} /></Col>
        <Col span={6}><Statistic title="已发布" value={stats.published} valueStyle={{ color: '#52c41a' }} /></Col>
        <Col span={6}><Statistic title="草稿" value={stats.draft} valueStyle={{ color: '#999' }} /></Col>
        <Col span={6}><Statistic title="定时发布" value={stats.scheduled} valueStyle={{ color: '#1890ff' }} /></Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="搜索标题/内容" prefix={<SearchOutlined />} allowClear style={{ width: 200 }} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
        <Select placeholder="业务模块" allowClear style={{ width: 130 }} value={filterModule} onChange={setFilterModule} options={MODULE_OPTIONS} />
        <Select placeholder="消息类型" allowClear style={{ width: 120 }} value={filterType} onChange={setFilterType} options={Object.entries(MSG_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Select placeholder="状态" allowClear style={{ width: 120 }} value={filterStatus} onChange={setFilterStatus} options={Object.entries(MSG_STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>发布消息</Button>
        <Button icon={<ReloadOutlined />} onClick={() => setMessages(MOCK_MESSAGES)}>刷新</Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={filteredMessages} scroll={{ x: 1600 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />

      {/* 新建/编辑弹窗 */}
      <Modal title={editingMsg ? '编辑消息' : '发布消息'} open={modalVisible} onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }} width={720} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="消息标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入消息标题" maxLength={100} showCount />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="业务模块" name="module" rules={[{ required: true }]}>
                <Select options={MODULE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="消息类型" name="type" rules={[{ required: true }]}>
                <Select options={Object.entries(MSG_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="优先级" name="priority" rules={[{ required: true }]}>
                <Select options={Object.entries(MSG_PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="推送渠道" name="channels" rules={[{ required: true, message: '至少选一个渠道' }]}>
                <Select mode="multiple" options={CHANNEL_OPTIONS} placeholder="选择推送渠道" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="接收范围" name="targetScope" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'ALL', label: '全部用户' },
                  { value: 'ROLE', label: '指定角色' },
                  { value: 'DEPARTMENT', label: '指定部门' },
                  { value: 'USER', label: '指定用户' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.targetScope !== cur.targetScope}>
            {({ getFieldValue }) => getFieldValue('targetScope') === 'ROLE' ? (
              <Form.Item label="目标角色" name="targetRoles" rules={[{ required: true, message: '请选择角色' }]}>
                <Select mode="multiple" options={ROLE_OPTIONS} placeholder="选择接收角色" />
              </Form.Item>
            ) : getFieldValue('targetScope') === 'USER' ? (
              <Form.Item label="目标用户" name="targetUsers" rules={[{ required: true, message: '请输入用户' }]}>
                <Input placeholder="输入用户名，多个用逗号分隔" />
              </Form.Item>
            ) : null}
          </Form.Item>
          <Form.Item label="消息内容" name="content" rules={[{ required: true, message: '请输入消息内容' }]}>
            <TextArea rows={6} placeholder="支持换行，请详细描述通知内容" />
          </Form.Item>
          <Form.Item label="过期时间" name="expiredAt" help="可选，过期后消息自动标记为过期状态">
            <Input placeholder="如：2026-04-30 23:59" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal title="消息详情" open={detailVisible} footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        onCancel={() => setDetailVisible(false)} width={700}>
        {selectedMsg && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 8px' }}>{selectedMsg.title}</h3>
              <Space wrap>
                <Tag color={MODULE_OPTIONS.find((o) => o.value === selectedMsg.module)?.color}>
                  {MODULE_OPTIONS.find((o) => o.value === selectedMsg.module)?.label}
                </Tag>
                <Tag color={MSG_TYPE_CONFIG[selectedMsg.type]?.color}>{MSG_TYPE_CONFIG[selectedMsg.type]?.label}</Tag>
                <Tag color={MSG_PRIORITY_CONFIG[selectedMsg.priority]?.color}>{MSG_PRIORITY_CONFIG[selectedMsg.priority]?.label}</Tag>
                <Tag icon={MSG_STATUS_CONFIG[selectedMsg.status]?.icon} color={MSG_STATUS_CONFIG[selectedMsg.status]?.color}>
                  {MSG_STATUS_CONFIG[selectedMsg.status]?.label}
                </Tag>
              </Space>
            </div>
            <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="推送渠道">
                <Space>{selectedMsg.channels.map((ch) => <Tag key={ch} color={CHANNEL_OPTIONS.find((o) => o.value === ch)?.color}>{CHANNEL_OPTIONS.find((o) => o.value === ch)?.label}</Tag>)}</Space>
              </Descriptions.Item>
              <Descriptions.Item label="接收范围">
                {selectedMsg.targetScope === 'ALL' ? '全部用户' : selectedMsg.targetRoles?.map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label).join('、') || selectedMsg.targetUsers || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="已读/总数">{selectedMsg.readCount}/{selectedMsg.totalTarget} 人</Descriptions.Item>
              <Descriptions.Item label="创建人">{selectedMsg.createdBy}</Descriptions.Item>
              <Descriptions.Item label="发布时间">{selectedMsg.publishTime || selectedMsg.scheduledAt || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{selectedMsg.createdAt}</Descriptions.Item>
            </Descriptions>
            <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, lineHeight: 2, whiteSpace: 'pre-wrap' }}>
              {selectedMsg.content}
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
};

// ==================== 推送模板 ====================

interface PushTemplate {
  id: string;
  name: string;
  code: string;
  module: string;
  triggerEvent: string;
  channels: string[];
  targetRoles: string[];
  subject: string;
  body: string;
  variables: string[];
  isAutoTrigger: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
  triggerCount: number;
}

const MOCK_TEMPLATES: PushTemplate[] = [
  // OMS 订单中心
  { id: 'TPL-001', name: '新订单创建通知', code: 'ORDER_CREATED', module: 'OMS', triggerEvent: '客户提交新订单', channels: ['IN_APP', 'EMAIL'], targetRoles: ['WAREHOUSE_CN', 'OPS_CN', 'SALES'], subject: '新订单提醒 - {{orderNo}}', body: '客户 {{customerName}} 提交了新订单 {{orderNo}}，共 {{packageCount}} 件，预估重量 {{weight}} kg，路线 {{route}}。请及时安排入库处理。', variables: ['orderNo', 'customerName', 'packageCount', 'weight', 'route'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 156 },
  { id: 'TPL-002', name: '订单状态变更通知', code: 'ORDER_STATUS_CHANGED', module: 'OMS', triggerEvent: '订单状态流转', channels: ['IN_APP', 'SMS'], targetRoles: ['CUSTOMER', 'SALES'], subject: '订单 {{orderNo}} 状态更新', body: '您的订单 {{orderNo}} 状态已更新为「{{newStatus}}」。{{statusDetail}}', variables: ['orderNo', 'newStatus', 'statusDetail'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 423 },
  { id: 'TPL-003', name: '订单取消/退运审批通知', code: 'ORDER_RETURN_APPLY', module: 'OMS', triggerEvent: '客户申请退运或取消', channels: ['IN_APP', 'EMAIL'], targetRoles: ['ADMIN', 'FINANCE', 'OPS_CN'], subject: '退运/取消审批 - {{orderNo}}', body: '订单 {{orderNo}} 申请{{applyType}}，原因：{{reason}}。金额 ¥{{amount}}，请及时审批。', variables: ['orderNo', 'applyType', 'reason', 'amount'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 12 },

  // WMS 起运国
  { id: 'TPL-004', name: '入库完成通知', code: 'INBOUND_COMPLETED', module: 'WMS_ORIGIN', triggerEvent: '快递入库扫描完成', channels: ['IN_APP'], targetRoles: ['OPS_CN', 'SALES'], subject: '入库完成 - {{orderNo}}', body: '订单 {{orderNo}} 已完成入库，共 {{packageCount}} 件，实际重量 {{actualWeight}} kg。{{abnormalNote}}', variables: ['orderNo', 'packageCount', 'actualWeight', 'abnormalNote'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 289 },
  { id: 'TPL-005', name: '包裹异常通知', code: 'PACKAGE_ABNORMAL', module: 'WMS_ORIGIN', triggerEvent: '入库时发现包裹异常', channels: ['IN_APP', 'EMAIL'], targetRoles: ['OPS_CN', 'ADMIN', 'SALES'], subject: '包裹异常预警 - {{trackingNo}}', body: '快递单号 {{trackingNo}}（订单 {{orderNo}}）入库时发现异常：{{abnormalType}}。备注：{{remark}}。请及时处理。', variables: ['trackingNo', 'orderNo', 'abnormalType', 'remark'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 34 },
  { id: 'TPL-006', name: '库存容量预警', code: 'STOCK_CAPACITY_ALERT', module: 'WMS_ORIGIN', triggerEvent: '仓库库存超过阈值（85%）', channels: ['IN_APP', 'EMAIL'], targetRoles: ['WAREHOUSE_CN', 'OPS_CN', 'ADMIN'], subject: '库存预警 - {{warehouseName}}', body: '{{warehouseName}} 当前库存使用率已达 {{usageRate}}%，剩余容量 {{remaining}} m³。待入库 {{pendingCount}} 单，待出库 {{outboundCount}} 单。请及时安排出库。', variables: ['warehouseName', 'usageRate', 'remaining', 'pendingCount', 'outboundCount'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 8 },
  { id: 'TPL-007', name: '调拨单状态变更', code: 'TRANSFER_STATUS_CHANGED', module: 'WMS_ORIGIN', triggerEvent: '调拨单状态流转', channels: ['IN_APP'], targetRoles: ['WAREHOUSE_CN', 'OPS_CN'], subject: '调拨单 {{transferNo}} - {{newStatus}}', body: '调拨单 {{transferNo}}（{{fromWarehouse}} → {{toWarehouse}}）已更新为「{{newStatus}}」。{{detail}}', variables: ['transferNo', 'fromWarehouse', 'toWarehouse', 'newStatus', 'detail'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 45 },

  // TMS 运输管理
  { id: 'TPL-008', name: '发车通知', code: 'JOB_DEPARTED', module: 'TMS', triggerEvent: '任务确认发车', channels: ['IN_APP', 'EMAIL', 'SMS'], targetRoles: ['OPS_CN', 'OPS_US', 'SALES', 'CUSTOMER'], subject: '发车通知 - {{jobNo}}', body: '任务 {{jobNo}} 已从{{originPort}}发车，承运人 {{carrier}}，船名/航班 {{vesselFlight}}，预计 {{eta}} 到达{{destPort}}。', variables: ['jobNo', 'originPort', 'carrier', 'vesselFlight', 'eta', 'destPort'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 67 },
  { id: 'TPL-009', name: '到港通知', code: 'JOB_ARRIVED', module: 'TMS', triggerEvent: '确认到达目的港', channels: ['IN_APP', 'EMAIL', 'SMS'], targetRoles: ['OPS_US', 'WAREHOUSE_US', 'SALES', 'CUSTOMER'], subject: '到港通知 - {{jobNo}}', body: '任务 {{jobNo}} 已到达{{destPort}}，请到达国团队安排清关和入仓。\n集装箱：{{containers}}\n总重量：{{totalWeight}} kg\n客户数：{{customerCount}} 家', variables: ['jobNo', 'destPort', 'containers', 'totalWeight', 'customerCount'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 52 },
  { id: 'TPL-010', name: '清关完成通知', code: 'CUSTOMS_CLEARED', module: 'TMS', triggerEvent: '海关放行确认', channels: ['IN_APP', 'EMAIL'], targetRoles: ['OPS_US', 'WAREHOUSE_US', 'SALES'], subject: '清关完成 - {{jobNo}}', body: '任务 {{jobNo}} 已完成{{customsType}}清关，海关放行。清关费用 {{customsFee}}。请安排入仓和末端派送。', variables: ['jobNo', 'customsType', 'customsFee'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 48 },
  { id: 'TPL-011', name: '运输时效预警', code: 'TRANSIT_DELAY_ALERT', module: 'TMS', triggerEvent: '运输时间超过预期', channels: ['IN_APP', 'EMAIL'], targetRoles: ['OPS_CN', 'OPS_US', 'ADMIN', 'SALES'], subject: '时效预警 - {{jobNo}}', body: '任务 {{jobNo}} 运输时效异常：已在途 {{actualDays}} 天，预计时效 {{expectedDays}} 天，超时 {{delayDays}} 天。当前位置：{{currentLocation}}。原因：{{delayReason}}', variables: ['jobNo', 'actualDays', 'expectedDays', 'delayDays', 'currentLocation', 'delayReason'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 15 },

  // WMS 到达国
  { id: 'TPL-012', name: 'DPN派送通知（客户短信）', code: 'DPN_DELIVERY_SMS', module: 'WMS_DEST', triggerEvent: 'DPN分配司机/开始派送', channels: ['SMS'], targetRoles: ['CUSTOMER'], subject: '派送通知', body: '您好，您的货物（DPN编号 {{dpnNo}}）将由 {{driverName}}（{{driverPhone}}）为您派送，预计 {{deliveryDate}} 送达 {{deliveryAddress}}。如需改约请联系客服。', variables: ['dpnNo', 'driverName', 'driverPhone', 'deliveryDate', 'deliveryAddress'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 230 },
  { id: 'TPL-013', name: '签收确认通知', code: 'DELIVERY_SIGNED', module: 'WMS_DEST', triggerEvent: '客户签收确认', channels: ['IN_APP', 'SMS'], targetRoles: ['SALES', 'FINANCE', 'CUSTOMER'], subject: '签收确认 - {{dpnNo}}', body: '货物已签收！\nDPN编号：{{dpnNo}}\n签收人：{{signedBy}}\n签收时间：{{signedAt}}\n签收件数：{{signedCount}}\n\n如有问题请在48小时内联系客服。', variables: ['dpnNo', 'signedBy', 'signedAt', 'signedCount'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 198 },
  { id: 'TPL-014', name: '派送失败通知', code: 'DELIVERY_FAILED', module: 'WMS_DEST', triggerEvent: '派送失败/异常', channels: ['IN_APP', 'EMAIL'], targetRoles: ['WAREHOUSE_US', 'OPS_US', 'ADMIN', 'SALES'], subject: '派送失败 - {{dpnNo}}', body: 'DPN {{dpnNo}} 派送失败。\n失败原因：{{failReason}}\n司机备注：{{driverNote}}\n客户地址：{{address}}\n\n请安排重新派送或联系客户确认。', variables: ['dpnNo', 'failReason', 'driverNote', 'address'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 23 },

  // 财务中心
  { id: 'TPL-015', name: '费用审批提醒', code: 'FEE_APPROVAL_PENDING', module: 'FINANCE', triggerEvent: '费用提交待审批', channels: ['IN_APP', 'EMAIL'], targetRoles: ['FINANCE', 'BOSS'], subject: '费用审批 - {{feeType}} ¥{{amount}}', body: '{{submitter}} 提交了一笔费用审批：\n费用类型：{{feeType}}\n金额：¥{{amount}}\n关联任务：{{jobNo}}\n备注：{{remark}}\n\n请及时审核。', variables: ['submitter', 'feeType', 'amount', 'jobNo', 'remark'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 78 },
  { id: 'TPL-016', name: '应收账款逾期提醒', code: 'RECEIVABLE_OVERDUE', module: 'FINANCE', triggerEvent: '应收超期（30/60/90天）', channels: ['IN_APP', 'EMAIL'], targetRoles: ['FINANCE', 'SALES', 'BOSS'], subject: '应收逾期提醒 - {{customerName}}', body: '客户 {{customerName}} 有逾期应收账款：\n逾期金额：{{currency}} {{overdueAmount}}\n逾期天数：{{overdueDays}} 天\n最早账单日期：{{oldestDate}}\n\n请对应销售尽快跟进催收。', variables: ['customerName', 'currency', 'overdueAmount', 'overdueDays', 'oldestDate'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 42 },

  // CRM 客户中心
  { id: 'TPL-017', name: '客户分配通知', code: 'CUSTOMER_ASSIGNED', module: 'CRM', triggerEvent: '公海池客户分配', channels: ['IN_APP'], targetRoles: ['SALES'], subject: '新客户分配 - {{customerName}}', body: '您已被分配客户 {{customerName}}（{{customerType}}），联系人：{{contactName}}，电话：{{contactPhone}}。请在3个工作日内完成首次联系。', variables: ['customerName', 'customerType', 'contactName', 'contactPhone'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 35 },

  // 系统管理
  { id: 'TPL-018', name: '密码重置通知', code: 'PASSWORD_RESET', module: 'SYSTEM', triggerEvent: '管理员重置密码', channels: ['SMS', 'EMAIL'], targetRoles: ['ADMIN'], subject: '密码已重置', body: '您的系统密码已被管理员重置。\n新密码：{{newPassword}}\n请登录后立即修改密码。\n\n如非本人操作，请联系管理员。', variables: ['newPassword'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 18 },
  { id: 'TPL-019', name: '汇率更新通知', code: 'EXCHANGE_RATE_UPDATED', module: 'SYSTEM', triggerEvent: '汇率手动更新', channels: ['IN_APP'], targetRoles: ['FINANCE', 'SALES', 'BOSS'], subject: '汇率更新 - {{currencyPair}}', body: '{{currencyPair}} 汇率已更新：\n旧汇率：{{oldRate}}\n新汇率：{{newRate}}\n变动：{{changePercent}}%\n\n请注意影响未结算订单。', variables: ['currencyPair', 'oldRate', 'newRate', 'changePercent'], isAutoTrigger: true, status: 'ACTIVE', updatedAt: '2026-03-20', triggerCount: 56 },
];

export const PushTemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<PushTemplate[]>(MOCK_TEMPLATES);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingTpl, setEditingTpl] = useState<PushTemplate | null>(null);
  const [selectedTpl, setSelectedTpl] = useState<PushTemplate | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterModule, setFilterModule] = useState<string | undefined>(undefined);
  const [filterChannel, setFilterChannel] = useState<string | undefined>(undefined);

  const handleAdd = () => {
    setEditingTpl(null);
    form.resetFields();
    form.setFieldsValue({ module: 'SYSTEM', channels: ['IN_APP'], isAutoTrigger: true, status: 'ACTIVE' });
    setModalVisible(true);
  };

  const handleEdit = (record: PushTemplate) => {
    setEditingTpl(record);
    form.setFieldsValue({ ...record, variables: record.variables.join(', ') });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const vars = typeof values.variables === 'string' ? values.variables.split(',').map((v: string) => v.trim()).filter(Boolean) : (values.variables || []);
      if (editingTpl) {
        setTemplates((prev) => prev.map((t) => t.id === editingTpl.id ? { ...t, ...values, variables: vars, updatedAt: dayjs().format('YYYY-MM-DD') } : t));
        message.success('模板更新成功');
      } else {
        const newTpl: PushTemplate = { id: `TPL-${String(templates.length + 1).padStart(3, '0')}`, ...values, variables: vars, updatedAt: dayjs().format('YYYY-MM-DD'), triggerCount: 0 };
        setTemplates((prev) => [newTpl, ...prev]);
        message.success('模板创建成功');
      }
      setModalVisible(false);
      form.resetFields();
    } catch { /* validation */ }
  };

  const handleDelete = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    message.success('模板已删除');
  };

  const handleToggleStatus = (record: PushTemplate) => {
    setTemplates((prev) => prev.map((t) =>
      t.id === record.id ? { ...t, status: t.status === 'ACTIVE' ? 'INACTIVE' as const : 'ACTIVE' as const } : t
    ));
    message.success(record.status === 'ACTIVE' ? '模板已停用' : '模板已启用');
  };

  const filteredTemplates = templates.filter((tpl) => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword && !tpl.name.toLowerCase().includes(keyword) && !tpl.code.toLowerCase().includes(keyword) && !tpl.triggerEvent.toLowerCase().includes(keyword)) return false;
    if (filterModule && tpl.module !== filterModule) return false;
    if (filterChannel && !tpl.channels.includes(filterChannel)) return false;
    return true;
  });

  const moduleStats = useMemo(() => {
    const map: Record<string, number> = {};
    templates.forEach((t) => { map[t.module] = (map[t.module] || 0) + 1; });
    return map;
  }, [templates]);

  const columns = [
    {
      title: '模板名称', dataIndex: 'name', key: 'name', width: 200,
      render: (text: string, record: PushTemplate) => (
        <a onClick={() => { setSelectedTpl(record); setDetailVisible(true); }}>{text}</a>
      ),
    },
    { title: '模板编码', dataIndex: 'code', key: 'code', width: 190, render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text> },
    {
      title: '业务模块', dataIndex: 'module', key: 'module', width: 110,
      render: (v: string) => { const m = MODULE_OPTIONS.find((o) => o.value === v); return <Tag color={m?.color}>{m?.label}</Tag>; },
    },
    { title: '触发事件', dataIndex: 'triggerEvent', key: 'triggerEvent', width: 160, ellipsis: true },
    {
      title: '推送渠道', dataIndex: 'channels', key: 'channels', width: 150,
      render: (channels: string[]) => (
        <Space size={[2, 2]} wrap>
          {channels.map((ch) => { const c = CHANNEL_OPTIONS.find((o) => o.value === ch); return <Tag key={ch} color={c?.color} style={{ margin: 0 }}>{c?.label}</Tag>; })}
        </Space>
      ),
    },
    {
      title: '接收角色', dataIndex: 'targetRoles', key: 'targetRoles', width: 180, ellipsis: true,
      render: (roles: string[]) => (
        <Tooltip title={roles.map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label).join('、')}>
          <span>{roles.slice(0, 2).map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label).join('、')}{roles.length > 2 ? `等${roles.length}个` : ''}</span>
        </Tooltip>
      ),
    },
    {
      title: '自动触发', dataIndex: 'isAutoTrigger', key: 'isAutoTrigger', width: 80, align: 'center' as const,
      render: (v: boolean) => v ? <Tag color="green">自动</Tag> : <Tag>手动</Tag>,
    },
    {
      title: '触发次数', dataIndex: 'triggerCount', key: 'triggerCount', width: 80, align: 'center' as const,
      render: (v: number) => <span style={{ fontWeight: v > 100 ? 600 : 400 }}>{v}</span>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (_: string, record: PushTemplate) => (
        <Switch checked={record.status === 'ACTIVE'} onChange={() => handleToggleStatus(record)} checkedChildren="启用" unCheckedChildren="停用" size="small" />
      ),
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right' as const,
      render: (_: any, record: PushTemplate) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedTpl(record); setDetailVisible(true); }}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      {/* 模块分布统计 */}
      <Row gutter={8} style={{ marginBottom: 16 }}>
        {MODULE_OPTIONS.map((m) => (
          <Col key={m.value}>
            <Tag color={filterModule === m.value ? m.color : undefined}
              style={{ cursor: 'pointer', padding: '4px 12px' }}
              onClick={() => setFilterModule(filterModule === m.value ? undefined : m.value)}>
              {m.label} ({moduleStats[m.value] || 0})
            </Tag>
          </Col>
        ))}
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="名称/编码/事件" prefix={<SearchOutlined />} allowClear style={{ width: 200 }} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
        <Select placeholder="推送渠道" allowClear style={{ width: 120 }} value={filterChannel} onChange={setFilterChannel} options={CHANNEL_OPTIONS} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增模板</Button>
        <Button icon={<ReloadOutlined />} onClick={() => setTemplates(MOCK_TEMPLATES)}>刷新</Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={filteredTemplates} scroll={{ x: 1600 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />

      {/* 新建/编辑弹窗 */}
      <Modal title={editingTpl ? '编辑模板' : '新增模板'} open={modalVisible} onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }} width={720} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}><Input placeholder="如：新订单创建通知" /></Form.Item></Col>
            <Col span={12}><Form.Item label="模板编码" name="code" rules={[{ required: true, message: '请输入模板编码' }]}><Input placeholder="如：ORDER_CREATED" disabled={!!editingTpl} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item label="业务模块" name="module" rules={[{ required: true }]}><Select options={MODULE_OPTIONS} /></Form.Item></Col>
            <Col span={16}><Form.Item label="触发事件" name="triggerEvent" rules={[{ required: true, message: '请描述触发条件' }]}><Input placeholder="如：客户提交新订单" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="推送渠道" name="channels" rules={[{ required: true }]}><Select mode="multiple" options={CHANNEL_OPTIONS} /></Form.Item></Col>
            <Col span={12}><Form.Item label="接收角色" name="targetRoles" rules={[{ required: true }]}><Select mode="multiple" options={ROLE_OPTIONS} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="自动触发" name="isAutoTrigger" valuePropName="checked"><Switch checkedChildren="自动" unCheckedChildren="手动" /></Form.Item></Col>
            <Col span={12}><Form.Item label="状态" name="status"><Select options={[{ value: 'ACTIVE', label: '启用' }, { value: 'INACTIVE', label: '停用' }]} /></Form.Item></Col>
          </Row>
          <Form.Item label="消息主题" name="subject" rules={[{ required: true, message: '请输入主题' }]}><Input placeholder="支持变量 {{variable}}" /></Form.Item>
          <Form.Item label="消息模板" name="body" rules={[{ required: true, message: '请输入模板内容' }]}><TextArea rows={4} placeholder="支持变量 {{variable}}，支持换行" /></Form.Item>
          <Form.Item label="变量列表" name="variables" help="逗号分隔变量名，如：orderNo, customerName, weight"><Input placeholder="orderNo, customerName, weight" /></Form.Item>
        </Form>
      </Modal>

      {/* 模板详情 */}
      <Modal title="模板详情" open={detailVisible} footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        onCancel={() => setDetailVisible(false)} width={700}>
        {selectedTpl && (
          <div>
            <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="模板名称">{selectedTpl.name}</Descriptions.Item>
              <Descriptions.Item label="模板编码"><Text code>{selectedTpl.code}</Text></Descriptions.Item>
              <Descriptions.Item label="业务模块"><Tag color={MODULE_OPTIONS.find((o) => o.value === selectedTpl.module)?.color}>{MODULE_OPTIONS.find((o) => o.value === selectedTpl.module)?.label}</Tag></Descriptions.Item>
              <Descriptions.Item label="触发事件">{selectedTpl.triggerEvent}</Descriptions.Item>
              <Descriptions.Item label="推送渠道"><Space>{selectedTpl.channels.map((ch) => <Tag key={ch} color={CHANNEL_OPTIONS.find((o) => o.value === ch)?.color}>{CHANNEL_OPTIONS.find((o) => o.value === ch)?.label}</Tag>)}</Space></Descriptions.Item>
              <Descriptions.Item label="接收角色">{selectedTpl.targetRoles.map((r) => ROLE_OPTIONS.find((o) => o.value === r)?.label).join('、')}</Descriptions.Item>
              <Descriptions.Item label="触发方式">{selectedTpl.isAutoTrigger ? <Tag color="green">自动触发</Tag> : <Tag>手动触发</Tag>}</Descriptions.Item>
              <Descriptions.Item label="累计触发">{selectedTpl.triggerCount} 次</Descriptions.Item>
            </Descriptions>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>主题模板</div>
            <div style={{ padding: 12, background: '#f0f5ff', borderRadius: 6, marginBottom: 12, fontFamily: 'monospace' }}>{selectedTpl.subject}</div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>内容模板</div>
            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, marginBottom: 12, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{selectedTpl.body}</div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>变量说明</div>
            <Space wrap>{selectedTpl.variables.map((v) => <Tag key={v} color="geekblue">{`{{${v}}}`}</Tag>)}</Space>
          </div>
        )}
      </Modal>
    </Card>
  );
};

// ==================== 短信推送 ====================

interface SmsRecord {
  id: string;
  phone: string;
  recipientName: string;
  recipientType: 'STAFF' | 'CUSTOMER' | 'CARRIER' | 'DRIVER';
  templateCode: string;
  templateName: string;
  module: string;
  relatedNo?: string;
  content: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'REJECTED';
  sentAt?: string;
  createdAt: string;
  createdBy: string;
  errorMsg?: string;
  cost?: number;
}

const RECIPIENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  STAFF: { label: '内部员工', color: 'blue' },
  CUSTOMER: { label: '客户', color: 'green' },
  CARRIER: { label: '承运人', color: 'purple' },
  DRIVER: { label: '司机', color: 'orange' },
};

const MOCK_SMS: SmsRecord[] = [
  { id: 'SMS-001', phone: '138****8001', recipientName: '张运营', recipientType: 'STAFF', templateCode: 'JOB_ARRIVED', templateName: '到港通知', module: 'TMS', relatedNo: 'S-JOB26030008', content: '任务 S-JOB26030008 已到达拉各斯港，请安排清关入仓。', status: 'SENT', sentAt: '2026-04-03 09:00', createdAt: '2026-04-03 09:00:00', createdBy: '系统自动', cost: 0.05 },
  { id: 'SMS-002', phone: '+234-803****2001', recipientName: 'Amina Yusuf', recipientType: 'CUSTOMER', templateCode: 'DPN_DELIVERY_SMS', templateName: 'DPN派送通知', module: 'WMS_DEST', relatedNo: 'DPN-20260402-001', content: 'Dear customer, your cargo (DPN-20260402-001) will be delivered by Ibrahim on Apr 5. Contact: +234-803-555-3001', status: 'SENT', sentAt: '2026-04-04 08:00', createdAt: '2026-04-04 08:00:00', createdBy: '系统自动', cost: 0.08 },
  { id: 'SMS-003', phone: '+234-803****3001', recipientName: 'Chukwu Obi', recipientType: 'DRIVER', templateCode: 'DELIVERY_ASSIGN', templateName: '派送任务分配', module: 'WMS_DEST', relatedNo: 'DPN-20260402-001', content: 'You have been assigned delivery DPN-20260402-001 to Ikeja, Lagos. 5 packages, 120kg total.', status: 'SENT', sentAt: '2026-04-04 07:30', createdAt: '2026-04-04 07:30:00', createdBy: '系统自动', cost: 0.08 },
  { id: 'SMS-004', phone: '139****7002', recipientName: '深圳旺达贸易', recipientType: 'CUSTOMER', templateCode: 'ORDER_STATUS_CHANGED', templateName: '订单状态通知', module: 'OMS', relatedNo: 'MO-20260401-0012', content: '您的订单 MO-20260401-0012 已完成出口报关，正在运输中。预计4月底到达拉各斯。', status: 'SENT', sentAt: '2026-04-02 15:00', createdAt: '2026-04-02 15:00:00', createdBy: '系统自动', cost: 0.05 },
  { id: 'SMS-005', phone: '137****5003', recipientName: '赵运营', recipientType: 'STAFF', templateCode: 'STOCK_CAPACITY_ALERT', templateName: '库存预警', module: 'WMS_ORIGIN', relatedNo: 'WH-GZ-001', content: '广州总仓库存使用率已达88%，请及时安排出库。', status: 'SENT', sentAt: '2026-04-02 11:00', createdAt: '2026-04-02 11:00:00', createdBy: '系统自动', cost: 0.05 },
  { id: 'SMS-006', phone: '136****6004', recipientName: '钱财务', recipientType: 'STAFF', templateCode: 'FEE_APPROVAL_PENDING', templateName: '费用审批', module: 'FINANCE', relatedNo: 'FEE-20260401-003', content: '张运营提交了一笔运费审批 ¥5,200，关联任务 S-JOB26030007，请审核。', status: 'FAILED', createdAt: '2026-04-01 10:00:00', createdBy: '系统自动', errorMsg: '运营商限流' },
  { id: 'SMS-007', phone: '135****9005', recipientName: '李仓管', recipientType: 'STAFF', templateCode: 'PASSWORD_RESET', templateName: '密码重置', module: 'SYSTEM', content: '您的系统密码已重置为初始密码，请登录后修改。', status: 'SENT', sentAt: '2026-03-28 14:30', createdAt: '2026-03-28 14:30:00', createdBy: 'admin', cost: 0.05 },
  { id: 'SMS-008', phone: '+234-701****4001', recipientName: 'Kwame Asante', recipientType: 'CUSTOMER', templateCode: 'DELIVERY_SIGNED', templateName: '签收确认', module: 'WMS_DEST', relatedNo: 'DPN-20260328-005', content: 'Your cargo has been delivered and signed. DPN: DPN-20260328-005, Signed by: Kwame, 3 packages.', status: 'SENT', sentAt: '2026-03-30 16:20', createdAt: '2026-03-30 16:20:00', createdBy: '系统自动', cost: 0.08 },
];

export const SmsPushManagement: React.FC = () => {
  const [records, setRecords] = useState<SmsRecord[]>(MOCK_SMS);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterModule, setFilterModule] = useState<string | undefined>(undefined);
  const [filterRecipientType, setFilterRecipientType] = useState<string | undefined>(undefined);

  const stats = useMemo(() => ({
    total: records.length,
    sent: records.filter((r) => r.status === 'SENT').length,
    failed: records.filter((r) => r.status === 'FAILED').length,
    totalCost: records.reduce((sum, r) => sum + (r.cost || 0), 0),
  }), [records]);

  const handleSend = () => {
    form.resetFields();
    form.setFieldsValue({ recipientType: 'STAFF' });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const newRecord: SmsRecord = {
        id: `SMS-${String(records.length + 1).padStart(3, '0')}`,
        phone: values.phone,
        recipientName: values.recipientName || '-',
        recipientType: values.recipientType,
        templateCode: 'MANUAL',
        templateName: '手动发送',
        module: 'SYSTEM',
        content: values.content,
        status: 'PENDING',
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        createdBy: 'admin',
      };
      setRecords((prev) => [newRecord, ...prev]);
      message.success('短信已提交发送');
      setModalVisible(false);
      form.resetFields();
    } catch { /* validation */ }
  };

  const handleResend = (record: SmsRecord) => {
    setRecords((prev) => prev.map((r) =>
      r.id === record.id ? { ...r, status: 'PENDING' as const, errorMsg: undefined } : r
    ));
    message.success('已重新提交发送');
  };

  const handleDelete = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    message.success('记录已删除');
  };

  const filteredRecords = records.filter((r) => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword && !r.phone.includes(keyword) && !r.recipientName.toLowerCase().includes(keyword) && !r.content.toLowerCase().includes(keyword) && !(r.relatedNo || '').toLowerCase().includes(keyword)) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterModule && r.module !== filterModule) return false;
    if (filterRecipientType && r.recipientType !== filterRecipientType) return false;
    return true;
  });

  const columns = [
    { title: '接收人', dataIndex: 'recipientName', key: 'recipientName', width: 130 },
    {
      title: '类型', dataIndex: 'recipientType', key: 'recipientType', width: 90,
      render: (v: string) => <Tag color={RECIPIENT_TYPE_CONFIG[v]?.color}>{RECIPIENT_TYPE_CONFIG[v]?.label}</Tag>,
    },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 140 },
    {
      title: '业务模块', dataIndex: 'module', key: 'module', width: 100,
      render: (v: string) => { const m = MODULE_OPTIONS.find((o) => o.value === v); return <Tag color={m?.color}>{m?.label}</Tag>; },
    },
    { title: '模板', dataIndex: 'templateName', key: 'templateName', width: 120 },
    {
      title: '关联单号', dataIndex: 'relatedNo', key: 'relatedNo', width: 150,
      render: (v: string) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : '-',
    },
    { title: '内容', dataIndex: 'content', key: 'content', width: 280, ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (status: string, record: SmsRecord) => {
        const map: Record<string, { text: string; status: string }> = {
          PENDING: { text: '发送中', status: 'processing' },
          SENT: { text: '已送达', status: 'success' },
          FAILED: { text: '失败', status: 'error' },
          REJECTED: { text: '被拒', status: 'warning' },
        };
        const c = map[status] || { text: status, status: 'default' };
        return (
          <Tooltip title={record.errorMsg}>
            <Badge status={c.status as any} text={c.text} />
          </Tooltip>
        );
      },
    },
    { title: '发送时间', dataIndex: 'sentAt', key: 'sentAt', width: 140, render: (v: string) => v || '-' },
    { title: '触发方式', dataIndex: 'createdBy', key: 'createdBy', width: 90, render: (v: string) => v === '系统自动' ? <Tag color="green">自动</Tag> : <Tag>手动</Tag> },
    {
      title: '操作', key: 'action', width: 130, fixed: 'right' as const,
      render: (_: any, record: SmsRecord) => (
        <Space size="small">
          {record.status === 'FAILED' && <Button type="link" size="small" onClick={() => handleResend(record)}>重发</Button>}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}><Statistic title="短信总数" value={stats.total} /></Col>
        <Col span={6}><Statistic title="发送成功" value={stats.sent} valueStyle={{ color: '#52c41a' }} /></Col>
        <Col span={6}><Statistic title="发送失败" value={stats.failed} valueStyle={{ color: '#ff4d4f' }} /></Col>
        <Col span={6}><Statistic title="短信费用" value={stats.totalCost} precision={2} prefix="¥" /></Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="手机号/接收人/内容/单号" prefix={<SearchOutlined />} allowClear style={{ width: 230 }} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
        <Select placeholder="业务模块" allowClear style={{ width: 120 }} value={filterModule} onChange={setFilterModule} options={MODULE_OPTIONS} />
        <Select placeholder="接收人类型" allowClear style={{ width: 120 }} value={filterRecipientType} onChange={setFilterRecipientType} options={Object.entries(RECIPIENT_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Select placeholder="发送状态" allowClear style={{ width: 110 }} value={filterStatus} onChange={setFilterStatus} options={[{ value: 'PENDING', label: '发送中' }, { value: 'SENT', label: '已送达' }, { value: 'FAILED', label: '失败' }]} />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>手动发送</Button>
        <Button icon={<ReloadOutlined />} onClick={() => setRecords(MOCK_SMS)}>刷新</Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={filteredRecords} scroll={{ x: 1700 }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />

      <Modal title="手动发送短信" open={modalVisible} onOk={handleSubmit} onCancel={() => { setModalVisible(false); form.resetFields(); }} width={520} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="接收人" name="recipientName"><Input placeholder="姓名（可选）" /></Form.Item></Col>
            <Col span={12}><Form.Item label="接收人类型" name="recipientType" rules={[{ required: true }]}><Select options={Object.entries(RECIPIENT_TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} /></Form.Item></Col>
          </Row>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}><Input placeholder="国内号码或国际号码（含区号）" /></Form.Item>
          <Form.Item label="短信内容" name="content" rules={[{ required: true, message: '请输入短信内容' }]}><TextArea rows={4} placeholder="请输入短信内容（限300字）" maxLength={300} showCount /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
