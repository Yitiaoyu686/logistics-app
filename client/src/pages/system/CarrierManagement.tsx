import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Modal,
  Form,
  Select,
  message,
  Popconfirm,
  Row,
  Col,
  Tag,
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

const { Option } = Select;
const { TextArea } = Input;

type CarrierType = 'SEA' | 'AIR';

interface Carrier {
  id: string;
  carrierType: CarrierType;
  carrierName: string;
  carrierCode: string;
  carrierNameEn?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  serviceRoutes?: string[];
  contractNo?: string;
  remark?: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

const CARRIER_TYPE_NAMES: Record<CarrierType, string> = {
  SEA: '海运',
  AIR: '空运',
};

const CARRIER_TYPE_COLORS: Record<CarrierType, string> = {
  SEA: 'blue',
  AIR: 'cyan',
};

function mapBaseDataToCarrier(row: any): Carrier {
  const extra = row?.extra || {};
  const carrierType = (extra?.carrierType || row?.transportMode || 'SEA') as CarrierType;
  return {
    id: String(row.id),
    carrierType: carrierType === 'AIR' ? 'AIR' : 'SEA',
    carrierName: String(row.dataName || ''),
    carrierCode: String(row.dataCode || ''),
    carrierNameEn: row.dataNameEn || undefined,
    contactPerson: extra.contactPerson || undefined,
    contactPhone: extra.contactPhone || undefined,
    contactEmail: extra.contactEmail || undefined,
    serviceRoutes: Array.isArray(extra.serviceRoutes) ? extra.serviceRoutes : undefined,
    contractNo: extra.contractNo || undefined,
    remark: row.remark || undefined,
    sortOrder: Number(row.sortOrder || 0),
    status: String(row.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || ''),
  };
}

export const CarrierManagement: React.FC = () => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchCarriers = async () => {
    setLoading(true);
    try {
      const res: any = await systemApi.listBaseData({ dataType: 'CARRIER' });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setCarriers(rows.map(mapBaseDataToCarrier));
    } catch (err: any) {
      message.error(err.message || '加载承运人失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

  const filteredCarriers = useMemo(() => {
    if (!searchText) return carriers;
    const kw = searchText.toLowerCase();
    return carriers.filter((c) =>
      c.carrierName.toLowerCase().includes(kw) ||
      c.carrierCode.toLowerCase().includes(kw) ||
      (c.carrierNameEn && c.carrierNameEn.toLowerCase().includes(kw))
    );
  }, [carriers, searchText]);

  const handleAdd = () => {
    setEditingCarrier(null);
    form.resetFields();
    form.setFieldsValue({ carrierType: 'SEA', status: 'ACTIVE', sortOrder: 100 });
    setModalVisible(true);
  };

  const handleEdit = (record: Carrier) => {
    setEditingCarrier(record);
    form.setFieldsValue({
      ...record,
      serviceRoutesText: (record.serviceRoutes || []).join(', '),
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const serviceRoutes = String(values.serviceRoutesText || '')
        .split(/[，,\n]/)
        .map((item: string) => item.trim())
        .filter(Boolean);

      const payload = {
        dataType: 'CARRIER',
        dataCode: String(values.carrierCode || '').trim().toUpperCase(),
        dataName: String(values.carrierName || '').trim(),
        dataNameEn: values.carrierNameEn ? String(values.carrierNameEn).trim() : null,
        transportMode: values.carrierType,
        status: values.status,
        sortOrder: Number(values.sortOrder || 0),
        remark: values.remark ? String(values.remark).trim() : null,
        extra: {
          carrierType: values.carrierType,
          contactPerson: values.contactPerson ? String(values.contactPerson).trim() : null,
          contactPhone: values.contactPhone ? String(values.contactPhone).trim() : null,
          contactEmail: values.contactEmail ? String(values.contactEmail).trim() : null,
          serviceRoutes,
          contractNo: values.contractNo ? String(values.contractNo).trim() : null,
        },
      };

      if (editingCarrier) {
        await systemApi.updateBaseData(editingCarrier.id, payload);
        message.success('承运人信息已更新');
      } else {
        await systemApi.createBaseData(payload);
        message.success('承运人已添加');
      }

      setModalVisible(false);
      await fetchCarriers();
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
      message.success('承运人已删除');
      await fetchCarriers();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const columns: ColumnsType<Carrier> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '承运类型',
      dataIndex: 'carrierType',
      width: 120,
      render: (type: CarrierType) => (
        <Tag color={CARRIER_TYPE_COLORS[type]}>{CARRIER_TYPE_NAMES[type]}</Tag>
      ),
    },
    {
      title: '承运人名称',
      dataIndex: 'carrierName',
      width: 180,
    },
    {
      title: '承运人简称',
      dataIndex: 'carrierCode',
      width: 120,
    },
    {
      title: '英文名称',
      dataIndex: 'carrierNameEn',
      width: 200,
      render: (text?: string) => text || '-',
    },
    {
      title: '联系人',
      dataIndex: 'contactPerson',
      width: 120,
      render: (text?: string) => text || '-',
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      width: 140,
      render: (text?: string) => text || '-',
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
            description={`确定要删除承运人「${record.carrierName}」吗？`}
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
            placeholder="承运人名称/简称"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />}>查询</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加承运人</Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredCarriers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1300 }}
        />
      </Card>

      <Modal
        title={editingCarrier ? '编辑承运人' : '添加承运人'}
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
              <Form.Item name="carrierType" label="承运类型" rules={[{ required: true, message: '请选择承运类型' }]}>
                <Select placeholder="请选择">
                  <Option value="SEA">海运</Option>
                  <Option value="AIR">空运</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="carrierName" label="承运人名称" rules={[{ required: true, message: '请输入承运人名称' }]}>
                <Input placeholder="如：马士基" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="carrierCode" label="承运人简称" rules={[{ required: true, message: '请输入承运人简称' }]}>
                <Input placeholder="如：MSK" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="carrierNameEn" label="英文名称">
                <Input placeholder="如：Maersk" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contractNo" label="合同编号">
                <Input placeholder="请输入合同编号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="contactPerson" label="联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contactPhone" label="联系电话">
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contactEmail" label="联系邮箱">
                <Input placeholder="联系邮箱" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="serviceRoutesText" label="服务线路（逗号分隔）">
                <Input placeholder="如：CAN.CHN→LOS.NGA, SZX.CHN→ACC.GHA" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sortOrder" label="排序">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select>
                  <Option value="ACTIVE">启用</Option>
                  <Option value="INACTIVE">停用</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="输入备注信息..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
