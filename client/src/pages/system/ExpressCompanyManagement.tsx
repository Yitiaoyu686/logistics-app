import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Modal,
  Form,
  message,
  Popconfirm,
  Row,
  Col,
  Select,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { systemApi } from '../../api';

const { TextArea } = Input;
const { Option } = Select;

interface ExpressCompany {
  id: string;
  companyCode: string;
  companyName: string;
  companyNameEn?: string;
  website?: string;
  contactPhone?: string;
  contactEmail?: string;
  serviceHotline?: string;
  trackingUrl?: string;
  remark?: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

function mapBaseDataToCompany(row: any): ExpressCompany {
  const extra = row?.extra || {};
  return {
    id: String(row.id),
    companyCode: String(row.dataCode || ''),
    companyName: String(row.dataName || ''),
    companyNameEn: row.dataNameEn || undefined,
    website: extra.website || undefined,
    contactPhone: extra.contactPhone || undefined,
    contactEmail: extra.contactEmail || undefined,
    serviceHotline: extra.serviceHotline || undefined,
    trackingUrl: extra.trackingUrl || undefined,
    remark: row.remark || undefined,
    sortOrder: Number(row.sortOrder || 0),
    status: String(row.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || ''),
  };
}

export const ExpressCompanyManagement: React.FC = () => {
  const [companies, setCompanies] = useState<ExpressCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState<ExpressCompany | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res: any = await systemApi.listBaseData({ dataType: 'EXPRESS_COMPANY' });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setCompanies(rows.map(mapBaseDataToCompany));
    } catch (err: any) {
      message.error(err.message || '加载快递公司失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const filteredCompanies = useMemo(() => {
    if (!searchText) return companies;
    const kw = searchText.toLowerCase();
    return companies.filter((c) =>
      c.companyName.toLowerCase().includes(kw) ||
      (c.companyNameEn && c.companyNameEn.toLowerCase().includes(kw)) ||
      c.companyCode.toLowerCase().includes(kw)
    );
  }, [companies, searchText]);

  const handleAdd = () => {
    setEditingCompany(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE', sortOrder: 100 });
    setModalVisible(true);
  };

  const handleEdit = (record: ExpressCompany) => {
    setEditingCompany(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        dataType: 'EXPRESS_COMPANY',
        dataCode: String(values.companyCode || '').trim().toUpperCase(),
        dataName: String(values.companyName || '').trim(),
        dataNameEn: values.companyNameEn ? String(values.companyNameEn).trim() : null,
        status: values.status,
        sortOrder: Number(values.sortOrder || 0),
        remark: values.remark ? String(values.remark).trim() : null,
        extra: {
          website: values.website ? String(values.website).trim() : null,
          contactPhone: values.contactPhone ? String(values.contactPhone).trim() : null,
          contactEmail: values.contactEmail ? String(values.contactEmail).trim() : null,
          serviceHotline: values.serviceHotline ? String(values.serviceHotline).trim() : null,
          trackingUrl: values.trackingUrl ? String(values.trackingUrl).trim() : null,
        },
      };

      if (editingCompany) {
        await systemApi.updateBaseData(editingCompany.id, payload);
        message.success('快递公司信息已更新');
      } else {
        await systemApi.createBaseData(payload);
        message.success('快递公司已添加');
      }

      setModalVisible(false);
      await fetchCompanies();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await systemApi.deleteBaseData(id);
      message.success('快递公司已删除');
      await fetchCompanies();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const columns: ColumnsType<ExpressCompany> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '快递公司名称',
      dataIndex: 'companyName',
      width: 180,
      render: (text: string) => <span style={{ color: '#1890ff' }}>{text}</span>,
    },
    {
      title: '英文名称',
      dataIndex: 'companyNameEn',
      width: 180,
      render: (text?: string) => text || '-',
    },
    {
      title: '公司代码',
      dataIndex: 'companyCode',
      width: 120,
    },
    {
      title: '客服热线',
      dataIndex: 'serviceHotline',
      width: 120,
      render: (text?: string) => text || '-',
    },
    {
      title: '官网',
      dataIndex: 'website',
      width: 220,
      ellipsis: true,
      render: (text?: string) => (text ? <a href={text} target="_blank" rel="noreferrer">{text}</a> : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => (value === 'ACTIVE' ? '启用' : '停用'),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除快递公司「${record.companyName}」吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space size="middle">
          <Input
            placeholder="快递公司名称/代码"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />}>查询</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加快递公司</Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredCompanies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1300 }}
        />
      </Card>

      <Modal
        title={editingCompany ? '编辑快递公司' : '添加快递公司'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={760}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="companyCode" label="公司代码" rules={[{ required: true, message: '请输入公司代码' }]}>
                <Input placeholder="如：SF" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="companyName" label="快递公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
                <Input placeholder="如：顺丰速运" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="companyNameEn" label="英文名称">
                <Input placeholder="如：SF Express" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="serviceHotline" label="客服热线">
                <Input placeholder="如：95338" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contactPhone" label="联系电话">
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contactEmail" label="联系邮箱">
                <Input placeholder="联系邮箱" type="email" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="website" label="官方网站">
                <Input placeholder="如：https://www.sf-express.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trackingUrl" label="物流查询地址">
                <Input placeholder="如：https://www.sf-express.com/tracking" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="sortOrder" label="排序">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select>
                  <Option value="ACTIVE">启用</Option>
                  <Option value="INACTIVE">停用</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={2} placeholder="输入备注信息..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
