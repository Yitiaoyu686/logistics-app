import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message,
  Popconfirm, DatePicker, Switch, Badge
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined,
  SearchOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;

// ==================== 消息发布 ====================

interface NoticeMessage {
  id: string;
  title: string;
  content: string;
  type: 'SYSTEM' | 'BUSINESS' | 'WARNING' | 'PROMOTION';
  priority: 'HIGH' | 'NORMAL' | 'LOW';
  status: 'DRAFT' | 'PUBLISHED' | 'REVOKED';
  targetScope: 'ALL' | 'ROLE' | 'USER';
  targetValue?: string;
  publishTime?: string;
  createdAt: string;
  readCount: number;
}

const TYPE_CONFIG = {
  SYSTEM: { label: '系统通知', color: 'blue' },
  BUSINESS: { label: '业务通知', color: 'green' },
  WARNING: { label: '预警通知', color: 'orange' },
  PROMOTION: { label: '活动推广', color: 'purple' },
};

const PRIORITY_CONFIG = {
  HIGH: { label: '紧急', color: 'red' },
  NORMAL: { label: '普通', color: 'blue' },
  LOW: { label: '低', color: 'default' },
};

const MOCK_MESSAGES: NoticeMessage[] = [
  { id: 'MSG-001', title: '系统升级通知', content: '系统将于本周六凌晨2:00-6:00进行升级维护，届时系统将暂停服务。请各部门提前做好工作安排。', type: 'SYSTEM', priority: 'HIGH', status: 'PUBLISHED', targetScope: 'ALL', publishTime: '2026-03-30 10:00', createdAt: '2026-03-29 16:00:00', readCount: 45 },
  { id: 'MSG-002', title: '业务规则变更', content: '自4月1日起，非洲航线运费标准将进行调整，详情请查看运费规则配置。', type: 'BUSINESS', priority: 'NORMAL', status: 'PUBLISHED', targetScope: 'ROLE', targetValue: 'SALES,OPS_CN', publishTime: '2026-03-28 14:30', createdAt: '2026-03-28 10:00:00', readCount: 23 },
  { id: 'MSG-003', title: '节假日安排', content: '清明节放假通知：4月4日-4月6日放假3天，4月7日正常上班。', type: 'SYSTEM', priority: 'NORMAL', status: 'PUBLISHED', targetScope: 'ALL', publishTime: '2026-03-25 09:00', createdAt: '2026-03-24 14:00:00', readCount: 52 },
  { id: 'MSG-004', title: '新功能上线通知', content: '到达国仓储模块已上线DPN管理和末端派送功能，请相关人员及时使用。', type: 'SYSTEM', priority: 'LOW', status: 'DRAFT', targetScope: 'ROLE', targetValue: 'OPS_US,WAREHOUSE_US', createdAt: '2026-04-01 09:00:00', readCount: 0 },
  { id: 'MSG-005', title: '库存预警', content: '广州总仓库存已达85%，请及时安排出库作业。', type: 'WARNING', priority: 'HIGH', status: 'PUBLISHED', targetScope: 'ROLE', targetValue: 'WAREHOUSE_CN', publishTime: '2026-04-02 11:00', createdAt: '2026-04-02 11:00:00', readCount: 8 },
];

export const MessagePublish: React.FC = () => {
  const [messages, setMessages] = useState<NoticeMessage[]>(MOCK_MESSAGES);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingMsg, setEditingMsg] = useState<NoticeMessage | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<NoticeMessage | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  const handleAdd = () => {
    setEditingMsg(null);
    form.resetFields();
    form.setFieldsValue({ type: 'SYSTEM', priority: 'NORMAL', targetScope: 'ALL' });
    setModalVisible(true);
  };

  const handleEdit = (record: NoticeMessage) => {
    setEditingMsg(record);
    form.setFieldsValue(record);
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
          status: 'DRAFT',
          createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          readCount: 0,
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
    if (filterType && msg.type !== filterType) return false;
    if (filterStatus && msg.status !== filterStatus) return false;
    return true;
  });

  const columns = [
    {
      title: '标题', dataIndex: 'title', key: 'title', width: 220, ellipsis: true,
      render: (text: string, record: NoticeMessage) => (
        <a onClick={() => { setSelectedMsg(record); setDetailVisible(true); }}>{text}</a>
      ),
    },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 100,
      render: (type: keyof typeof TYPE_CONFIG) => <Tag color={TYPE_CONFIG[type]?.color}>{TYPE_CONFIG[type]?.label}</Tag>,
    },
    {
      title: '优先级', dataIndex: 'priority', key: 'priority', width: 80,
      render: (p: keyof typeof PRIORITY_CONFIG) => <Tag color={PRIORITY_CONFIG[p]?.color}>{PRIORITY_CONFIG[p]?.label}</Tag>,
    },
    {
      title: '接收范围', dataIndex: 'targetScope', key: 'targetScope', width: 120,
      render: (scope: string, record: NoticeMessage) =>
        scope === 'ALL' ? '全部用户' : record.targetValue || scope,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (status: string) => {
        const map: Record<string, { text: string; color: string }> = {
          DRAFT: { text: '草稿', color: 'default' },
          PUBLISHED: { text: '已发布', color: 'success' },
          REVOKED: { text: '已撤回', color: 'warning' },
        };
        const c = map[status] || { text: status, color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '已读', dataIndex: 'readCount', key: 'readCount', width: 70, render: (v: number) => `${v} 人` },
    { title: '发布时间', dataIndex: 'publishTime', key: 'publishTime', width: 150, render: (v: string) => v || '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150 },
    {
      title: '操作', key: 'action', width: 240, fixed: 'right' as const,
      render: (_: any, record: NoticeMessage) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedMsg(record); setDetailVisible(true); }}>查看</Button>
          {record.status === 'DRAFT' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Popconfirm title="确认发布？" onConfirm={() => handlePublish(record)}>
                <Button type="link" size="small" icon={<SendOutlined />} style={{ color: '#52c41a' }}>发布</Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'PUBLISHED' && (
            <Popconfirm title="确认撤回？" onConfirm={() => handleRevoke(record)}>
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
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="搜索标题/内容" prefix={<SearchOutlined />} allowClear style={{ width: 200 }} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
        <Select placeholder="消息类型" allowClear style={{ width: 130 }} value={filterType} onChange={setFilterType} options={Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Select placeholder="状态" allowClear style={{ width: 120 }} value={filterStatus} onChange={setFilterStatus} options={[{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'REVOKED', label: '已撤回' }]} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>发布消息</Button>
        <Button icon={<ReloadOutlined />} onClick={() => setMessages(MOCK_MESSAGES)}>刷新</Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={filteredMessages} scroll={{ x: 1400 }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />

      <Modal title={editingMsg ? '编辑消息' : '发布消息'} open={modalVisible} onOk={handleSubmit} onCancel={() => { setModalVisible(false); form.resetFields(); }} width={640} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}><Input placeholder="请输入消息标题" /></Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true }]}>
            <Select options={Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Form.Item>
          <Form.Item label="优先级" name="priority" rules={[{ required: true }]}>
            <Select options={Object.entries(PRIORITY_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Form.Item>
          <Form.Item label="接收范围" name="targetScope" rules={[{ required: true }]}>
            <Select options={[{ value: 'ALL', label: '全部用户' }, { value: 'ROLE', label: '指定角色' }, { value: 'USER', label: '指定用户' }]} />
          </Form.Item>
          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入消息内容' }]}><TextArea rows={4} placeholder="请输入消息内容" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="消息详情" open={detailVisible} footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>} onCancel={() => setDetailVisible(false)} width={600}>
        {selectedMsg && (
          <div>
            <h3>{selectedMsg.title}</h3>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={TYPE_CONFIG[selectedMsg.type]?.color}>{TYPE_CONFIG[selectedMsg.type]?.label}</Tag>
              <Tag color={PRIORITY_CONFIG[selectedMsg.priority]?.color}>{PRIORITY_CONFIG[selectedMsg.priority]?.label}</Tag>
              <span style={{ color: '#999' }}>{selectedMsg.publishTime || selectedMsg.createdAt}</span>
            </Space>
            <div style={{ padding: 16, background: '#f5f5f5', borderRadius: 8, lineHeight: 1.8 }}>{selectedMsg.content}</div>
            <div style={{ marginTop: 12, color: '#999' }}>已读 {selectedMsg.readCount} 人 · 接收范围：{selectedMsg.targetScope === 'ALL' ? '全部用户' : selectedMsg.targetValue || selectedMsg.targetScope}</div>
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
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WECHAT';
  triggerEvent: string;
  subject: string;
  body: string;
  variables: string[];
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
}

const CHANNEL_CONFIG = {
  IN_APP: { label: '站内信', color: 'blue' },
  EMAIL: { label: '邮件', color: 'green' },
  SMS: { label: '短信', color: 'orange' },
  WECHAT: { label: '微信', color: 'cyan' },
};

const MOCK_TEMPLATES: PushTemplate[] = [
  { id: 'TPL-001', name: '订单创建通知', code: 'ORDER_CREATED', channel: 'IN_APP', triggerEvent: '新订单创建', subject: '新订单提醒', body: '您有新订单 {{orderNo}}，客户 {{customerName}}，请及时处理。', variables: ['orderNo', 'customerName'], status: 'ACTIVE', updatedAt: '2026-03-20' },
  { id: 'TPL-002', name: '发车通知', code: 'DEPARTURE_NOTIFY', channel: 'EMAIL', triggerEvent: '发车操作', subject: '发车通知 - {{jobNo}}', body: '任务 {{jobNo}} 已发车，预计到达时间 {{eta}}。', variables: ['jobNo', 'eta'], status: 'ACTIVE', updatedAt: '2026-03-20' },
  { id: 'TPL-003', name: '到港通知', code: 'ARRIVAL_NOTIFY', channel: 'IN_APP', triggerEvent: '到港确认', subject: '货物到港通知', body: '任务 {{jobNo}} 已到港，请安排清关。', variables: ['jobNo'], status: 'ACTIVE', updatedAt: '2026-03-20' },
  { id: 'TPL-004', name: '费用审批提醒', code: 'FEE_APPROVAL', channel: 'IN_APP', triggerEvent: '费用提交审批', subject: '费用审批提醒', body: '{{submitter}} 提交了一笔 {{amount}} 元的费用审批，请及时审核。', variables: ['submitter', 'amount'], status: 'ACTIVE', updatedAt: '2026-03-20' },
  { id: 'TPL-005', name: '密码重置通知', code: 'PASSWORD_RESET', channel: 'SMS', triggerEvent: '密码重置', subject: '密码重置', body: '您的密码已被管理员重置，新密码为 {{newPassword}}，请及时修改。', variables: ['newPassword'], status: 'INACTIVE', updatedAt: '2026-03-15' },
];

export const PushTemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<PushTemplate[]>(MOCK_TEMPLATES);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTpl, setEditingTpl] = useState<PushTemplate | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterChannel, setFilterChannel] = useState<string | undefined>(undefined);

  const handleAdd = () => {
    setEditingTpl(null);
    form.resetFields();
    form.setFieldsValue({ channel: 'IN_APP', status: 'ACTIVE' });
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
      const vars = typeof values.variables === 'string' ? values.variables.split(',').map((v: string) => v.trim()).filter(Boolean) : [];
      if (editingTpl) {
        setTemplates((prev) => prev.map((t) => t.id === editingTpl.id ? { ...t, ...values, variables: vars, updatedAt: dayjs().format('YYYY-MM-DD') } : t));
        message.success('模板更新成功');
      } else {
        const newTpl: PushTemplate = {
          id: `TPL-${String(templates.length + 1).padStart(3, '0')}`,
          ...values,
          variables: vars,
          updatedAt: dayjs().format('YYYY-MM-DD'),
        };
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
    if (keyword && !tpl.name.toLowerCase().includes(keyword) && !tpl.code.toLowerCase().includes(keyword)) return false;
    if (filterChannel && tpl.channel !== filterChannel) return false;
    return true;
  });

  const columns = [
    { title: '模板名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '模板编码', dataIndex: 'code', key: 'code', width: 160 },
    {
      title: '推送渠道', dataIndex: 'channel', key: 'channel', width: 100,
      render: (ch: keyof typeof CHANNEL_CONFIG) => <Tag color={CHANNEL_CONFIG[ch]?.color}>{CHANNEL_CONFIG[ch]?.label}</Tag>,
    },
    { title: '触发事件', dataIndex: 'triggerEvent', key: 'triggerEvent', width: 130 },
    { title: '主题', dataIndex: 'subject', key: 'subject', width: 200, ellipsis: true },
    {
      title: '变量', dataIndex: 'variables', key: 'variables', width: 160,
      render: (vars: string[]) => <Space size={[4, 4]} wrap>{vars.map((v) => <Tag key={v} color="geekblue">{`{{${v}}}`}</Tag>)}</Space>,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (_: string, record: PushTemplate) => (
        <Switch checked={record.status === 'ACTIVE'} onChange={() => handleToggleStatus(record)} checkedChildren="启用" unCheckedChildren="停用" />
      ),
    },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 120 },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right' as const,
      render: (_: any, record: PushTemplate) => (
        <Space size="small">
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
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="模板名称/编码" prefix={<SearchOutlined />} allowClear style={{ width: 200 }} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
        <Select placeholder="推送渠道" allowClear style={{ width: 130 }} value={filterChannel} onChange={setFilterChannel} options={Object.entries(CHANNEL_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增模板</Button>
        <Button icon={<ReloadOutlined />} onClick={() => setTemplates(MOCK_TEMPLATES)}>刷新</Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={filteredTemplates} scroll={{ x: 1400 }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />

      <Modal title={editingTpl ? '编辑模板' : '新增模板'} open={modalVisible} onOk={handleSubmit} onCancel={() => { setModalVisible(false); form.resetFields(); }} width={640} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}><Input placeholder="如：订单创建通知" /></Form.Item>
          <Form.Item label="模板编码" name="code" rules={[{ required: true, message: '请输入模板编码' }]}><Input placeholder="如：ORDER_CREATED" disabled={!!editingTpl} /></Form.Item>
          <Form.Item label="推送渠道" name="channel" rules={[{ required: true }]}>
            <Select options={Object.entries(CHANNEL_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} />
          </Form.Item>
          <Form.Item label="触发事件" name="triggerEvent" rules={[{ required: true, message: '请输入触发事件' }]}><Input placeholder="如：新订单创建" /></Form.Item>
          <Form.Item label="主题" name="subject" rules={[{ required: true, message: '请输入主题' }]}><Input placeholder="支持变量 {{variable}}" /></Form.Item>
          <Form.Item label="内容模板" name="body" rules={[{ required: true, message: '请输入内容模板' }]}><TextArea rows={4} placeholder="支持变量 {{variable}}" /></Form.Item>
          <Form.Item label="变量列表" name="variables"><Input placeholder="逗号分隔，如：orderNo, customerName" /></Form.Item>
          <Form.Item label="状态" name="status"><Select options={[{ value: 'ACTIVE', label: '启用' }, { value: 'INACTIVE', label: '停用' }]} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

// ==================== 短信推送 ====================

interface SmsRecord {
  id: string;
  phone: string;
  recipientName: string;
  templateCode: string;
  templateName: string;
  content: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentAt?: string;
  createdAt: string;
  errorMsg?: string;
}

const MOCK_SMS: SmsRecord[] = [
  { id: 'SMS-001', phone: '138****0001', recipientName: '李仓管', templateCode: 'PASSWORD_RESET', templateName: '密码重置通知', content: '您的密码已被重置，新密码为 ****，请及时修改。', status: 'SENT', sentAt: '2026-03-28 14:30:00', createdAt: '2026-03-28 14:30:00' },
  { id: 'SMS-002', phone: '139****0002', recipientName: '张运营', templateCode: 'DEPARTURE_NOTIFY', templateName: '发车通知', content: '任务 S-JOB26030007 已发车，预计3月30日到达。', status: 'SENT', sentAt: '2026-03-27 09:00:00', createdAt: '2026-03-27 09:00:00' },
  { id: 'SMS-003', phone: '137****0003', recipientName: '赵运营', templateCode: 'ARRIVAL_NOTIFY', templateName: '到港通知', content: '任务 S-JOB26030008 已到港，请安排清关。', status: 'FAILED', createdAt: '2026-03-29 16:00:00', errorMsg: '号码无效' },
  { id: 'SMS-004', phone: '136****0004', recipientName: '钱财务', templateCode: 'FEE_APPROVAL', templateName: '费用审批提醒', content: '张运营提交了一笔 5000 元的费用审批，请及时审核。', status: 'PENDING', createdAt: '2026-04-01 10:00:00' },
];

export const SmsPushManagement: React.FC = () => {
  const [records, setRecords] = useState<SmsRecord[]>(MOCK_SMS);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  const handleSend = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const newRecord: SmsRecord = {
        id: `SMS-${String(records.length + 1).padStart(3, '0')}`,
        phone: values.phone,
        recipientName: values.recipientName || '-',
        templateCode: 'CUSTOM',
        templateName: '手动发送',
        content: values.content,
        status: 'PENDING',
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
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
    if (keyword && !r.phone.includes(keyword) && !r.recipientName.toLowerCase().includes(keyword) && !r.content.toLowerCase().includes(keyword)) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    return true;
  });

  const columns = [
    { title: '接收人', dataIndex: 'recipientName', key: 'recipientName', width: 100 },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '模板', dataIndex: 'templateName', key: 'templateName', width: 130 },
    { title: '内容', dataIndex: 'content', key: 'content', width: 300, ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (status: string, record: SmsRecord) => {
        const map: Record<string, { text: string; color: string }> = {
          PENDING: { text: '发送中', color: 'processing' },
          SENT: { text: '已发送', color: 'success' },
          FAILED: { text: '失败', color: 'error' },
        };
        const c = map[status] || { text: status, color: 'default' };
        return <Badge status={c.color as any} text={c.text} />;
      },
    },
    { title: '发送时间', dataIndex: 'sentAt', key: 'sentAt', width: 150, render: (v: string) => v || '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 150 },
    {
      title: '备注', dataIndex: 'errorMsg', key: 'errorMsg', width: 100,
      render: (v: string) => v ? <Tag color="red">{v}</Tag> : '-',
    },
    {
      title: '操作', key: 'action', width: 140, fixed: 'right' as const,
      render: (_: any, record: SmsRecord) => (
        <Space size="small">
          {record.status === 'FAILED' && (
            <Button type="link" size="small" onClick={() => handleResend(record)}>重发</Button>
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
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="手机号/接收人/内容" prefix={<SearchOutlined />} allowClear style={{ width: 220 }} value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} />
        <Select placeholder="发送状态" allowClear style={{ width: 120 }} value={filterStatus} onChange={setFilterStatus} options={[{ value: 'PENDING', label: '发送中' }, { value: 'SENT', label: '已发送' }, { value: 'FAILED', label: '失败' }]} />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>手动发送</Button>
        <Button icon={<ReloadOutlined />} onClick={() => setRecords(MOCK_SMS)}>刷新</Button>
      </Space>

      <Table rowKey="id" columns={columns} dataSource={filteredRecords} scroll={{ x: 1400 }} pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }} />

      <Modal title="手动发送短信" open={modalVisible} onOk={handleSubmit} onCancel={() => { setModalVisible(false); form.resetFields(); }} width={500} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="接收人" name="recipientName"><Input placeholder="接收人姓名（可选）" /></Form.Item>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}><Input placeholder="请输入手机号" /></Form.Item>
          <Form.Item label="短信内容" name="content" rules={[{ required: true, message: '请输入短信内容' }]}><TextArea rows={4} placeholder="请输入短信内容" /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
