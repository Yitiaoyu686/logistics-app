import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Input, Select, DatePicker, Tag, Space,
  Row, Col, Statistic, message, Modal, Form, Checkbox
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, SendOutlined, EyeOutlined,
  ClockCircleOutlined, CheckCircleOutlined, BellOutlined,
  MailOutlined, MessageOutlined, WhatsAppOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { notificationApi } from '../../api';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

// Types
type NotifyStatus = 'PENDING' | 'SENT' | 'CONFIRMED';
type NotifyMethod = 'SMS' | 'EMAIL' | 'WHATSAPP';

interface NotifyRecord {
  id: string;
  notifyNo: string;
  clientName: string;
  dpnNo: string;
  orderCount: number;
  pieces: number;
  totalWeight: number;
  notifyMethod: NotifyMethod[];
  status: NotifyStatus;
  notifyTime?: string;
  confirmTime?: string;
  contactPhone?: string;
  contactEmail?: string;
  remark?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<NotifyStatus, { text: string; color: string }> = {
  PENDING: { text: '待通知', color: 'default' },
  SENT: { text: '已通知', color: 'processing' },
  CONFIRMED: { text: '已确认', color: 'success' },
};

const METHOD_CONFIG: Record<NotifyMethod, { text: string; color: string; icon: React.ReactNode }> = {
  SMS: { text: 'SMS', color: 'blue', icon: <MessageOutlined /> },
  EMAIL: { text: 'Email', color: 'green', icon: <MailOutlined /> },
  WHATSAPP: { text: 'WhatsApp', color: 'cyan', icon: <WhatsAppOutlined /> },
};

const mapNotificationToRecord = (n: any, index: number): NotifyRecord => ({
  id: String(n.id || index + 1),
  notifyNo: `NTF-${String(n.id || index + 1).padStart(3, '0')}`,
  clientName: n.title || '-',
  dpnNo: n.relatedId || '-',
  orderCount: 0,
  pieces: 0,
  totalWeight: 0,
  notifyMethod: n.type === 'EMAIL' ? ['EMAIL'] : n.type === 'WHATSAPP' ? ['WHATSAPP'] : ['SMS'],
  status: (n.read === 1 || n.read === true ? 'SENT' : 'PENDING') as NotifyStatus,
  notifyTime: n.read ? n.createdAt : undefined,
  createdAt: n.createdAt || '',
});

export const CustomerNotify = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<NotifyRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<NotifyRecord[]>([]);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<NotifyStatus | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  // Modal
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [sendForm] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list({});
      const rows = ((res as any).data || res || []) as any[];
      const mapped = rows.map((n: any, i: number) => mapNotificationToRecord(n, i));
      setRecords(mapped);
      setFilteredRecords(mapped);
    } catch (err: any) {
      message.error('加载数据失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Stats
  const pendingCount = records.filter(r => r.status === 'PENDING').length;
  const sentCount = records.filter(r => r.status === 'SENT').length;
  const confirmedCount = records.filter(r => r.status === 'CONFIRMED').length;

  const handleSearch = () => {
    let filtered = [...records];
    if (searchText) {
      const kw = searchText.toLowerCase();
      filtered = filtered.filter(r => r.clientName.toLowerCase().includes(kw) || r.dpnNo.toLowerCase().includes(kw) || r.notifyNo.toLowerCase().includes(kw));
    }
    if (filterStatus !== 'ALL') filtered = filtered.filter(r => r.status === filterStatus);
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(r => {
        const d = dayjs(r.createdAt);
        return d.isAfter(dateRange[0]) && d.isBefore(dateRange[1]);
      });
    }
    setFilteredRecords(filtered);
  };

  const handleReset = () => {
    setSearchText('');
    setFilterStatus('ALL');
    setDateRange([null, null]);
    setFilteredRecords(records);
  };

  const handleSendNotify = async () => {
    try {
      const values = await sendForm.validateFields();
      await notificationApi.create({
        type: 'PICKUP',
        title: values.clientName,
        content: `Your shipment ${values.dpnNo || ''} has arrived and is ready for pickup.${values.remark ? ' ' + values.remark : ''}`,
        relatedId: values.dpnNo,
        relatedType: 'DELIVERY',
      });
      message.success('通知已发送');
      setSendModalVisible(false);
      sendForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return; // validation error
      message.error('发送失败: ' + (err.message || '未知错误'));
    }
  };

  const columns = [
    { title: '通知编号', dataIndex: 'notifyNo', key: 'notifyNo', width: 140 },
    { title: '客户名称', dataIndex: 'clientName', key: 'clientName', width: 160 },
    { title: 'DPN编号', dataIndex: 'dpnNo', key: 'dpnNo', width: 140 },
    { title: '订单数', dataIndex: 'orderCount', key: 'orderCount', width: 80, align: 'center' as const },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'center' as const },
    {
      title: '总重量', dataIndex: 'totalWeight', key: 'totalWeight', width: 100,
      render: (v: number) => `${v.toLocaleString()} kg`,
    },
    {
      title: '通知方式', dataIndex: 'notifyMethod', key: 'notifyMethod', width: 180,
      render: (methods: NotifyMethod[]) => (
        <Space size={4}>{methods.map(m => <Tag key={m} color={METHOD_CONFIG[m].color} icon={METHOD_CONFIG[m].icon}>{METHOD_CONFIG[m].text}</Tag>)}</Space>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: NotifyStatus) => <Tag color={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].text}</Tag>,
    },
    {
      title: '通知时间', dataIndex: 'notifyTime', key: 'notifyTime', width: 140,
      render: (t?: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '确认时间', dataIndex: 'confirmTime', key: 'confirmTime', width: 140,
      render: (t?: string) => t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right' as const,
      render: (_: any, record: NotifyRecord) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <Button type="link" size="small" icon={<SendOutlined />} onClick={() => {
              sendForm.setFieldsValue({ clientName: record.clientName, dpnNo: record.dpnNo });
              setSendModalVisible(true);
            }}>发送</Button>
          )}
          {record.status === 'SENT' && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => {
              const updated = records.map(r => r.id === record.id ? { ...r, status: 'CONFIRMED' as NotifyStatus, confirmTime: dayjs().format('YYYY-MM-DD HH:mm') } : r);
              setRecords(updated);
              setFilteredRecords(updated);
              message.success('已标记为已确认');
            }}>确认</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="待通知" value={pendingCount} suffix="条" valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="已通知" value={sentCount} suffix="条" valueStyle={{ color: '#1890ff' }} prefix={<SendOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="已确认" value={confirmedCount} suffix="条" valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="通知总数" value={records.length} suffix="条" prefix={<BellOutlined />} /></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="搜索客户名/DPN编号" value={searchText} onChange={e => setSearchText(e.target.value)} onPressEnter={handleSearch} style={{ width: 220 }} allowClear />
          <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 120 }}>
            <Option value="ALL">全部状态</Option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
          </Select>
          <RangePicker value={dateRange} onChange={setDateRange as any} format="YYYY-MM-DD" placeholder={['开始日期', '结束日期']} />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => setSendModalVisible(true)}>发送通知</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRecords}
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条记录` }}
        />
      </Card>

      <Modal
        title="发送客户通知"
        open={sendModalVisible}
        onCancel={() => { setSendModalVisible(false); sendForm.resetFields(); }}
        onOk={handleSendNotify}
        width={600}
        destroyOnClose
      >
        <Form form={sendForm} layout="vertical">
          <Form.Item name="clientName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
            <Input placeholder="请输入客户名称" />
          </Form.Item>
          <Form.Item name="dpnNo" label="DPN编号" rules={[{ required: true, message: '请输入DPN编号' }]}>
            <Input placeholder="请输入DPN编号" />
          </Form.Item>
          <Form.Item name="methods" label="通知方式" rules={[{ required: true, message: '请选择通知方式' }]}>
            <Checkbox.Group options={[
              { label: 'SMS', value: 'SMS' },
              { label: 'Email', value: 'EMAIL' },
              { label: 'WhatsApp', value: 'WHATSAPP' },
            ]} />
          </Form.Item>
          <Form.Item label="通知模板预览">
            <Card size="small" style={{ background: '#f5f5f5' }}>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>
                {`Dear Customer,\n\nYour shipment has arrived at the destination port and is ready for pickup.\n\nDPN No: ${sendForm.getFieldValue('dpnNo') || 'DPN-XXXX-XXX'}\n\nPlease arrange pickup at your earliest convenience.\n\nBest regards,\nLogistics Team`}
              </p>
            </Card>
          </Form.Item>
          <Form.Item name="remark" label="附加备注">
            <TextArea rows={2} placeholder="可选备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
