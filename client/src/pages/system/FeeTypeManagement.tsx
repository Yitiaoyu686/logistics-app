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

interface FeeType {
  id: string;
  feeCode: string;
  feeNameCn: string;
  feeNameEn?: string;
  remark?: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

function mapBaseDataToFeeType(row: any): FeeType {
  return {
    id: String(row.id),
    feeCode: String(row.dataCode || ''),
    feeNameCn: String(row.dataName || ''),
    feeNameEn: row.dataNameEn || undefined,
    remark: row.remark || undefined,
    sortOrder: Number(row.sortOrder || 0),
    status: String(row.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || ''),
  };
}

export const FeeTypeManagement: React.FC = () => {
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchFeeTypes = async () => {
    setLoading(true);
    try {
      const res: any = await systemApi.listBaseData({ dataType: 'FEE_TYPE' });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setFeeTypes(rows.map(mapBaseDataToFeeType));
    } catch (err: any) {
      message.error(err.message || '加载费用类型失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeeTypes();
  }, []);

  const filteredFeeTypes = useMemo(() => {
    if (!searchText) return feeTypes;
    const kw = searchText.toLowerCase();
    return feeTypes.filter((f) =>
      f.feeNameCn.toLowerCase().includes(kw) ||
      f.feeCode.toLowerCase().includes(kw) ||
      (f.feeNameEn && f.feeNameEn.toLowerCase().includes(kw))
    );
  }, [feeTypes, searchText]);

  const handleAdd = () => {
    setEditingFeeType(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE', sortOrder: 100 });
    setModalVisible(true);
  };

  const handleEdit = (record: FeeType) => {
    setEditingFeeType(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        dataType: 'FEE_TYPE',
        dataCode: String(values.feeCode || '').trim().toUpperCase(),
        dataName: String(values.feeNameCn || '').trim(),
        dataNameEn: values.feeNameEn ? String(values.feeNameEn).trim() : null,
        status: values.status,
        sortOrder: Number(values.sortOrder || 0),
        remark: values.remark ? String(values.remark).trim() : null,
      };

      if (editingFeeType) {
        await systemApi.updateBaseData(editingFeeType.id, payload);
        message.success('费用类型已更新');
      } else {
        await systemApi.createBaseData(payload);
        message.success('费用类型已添加');
      }

      setModalVisible(false);
      await fetchFeeTypes();
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
      message.success('费用类型已删除');
      await fetchFeeTypes();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const columns: ColumnsType<FeeType> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '项目编码',
      dataIndex: 'feeCode',
      width: 140,
    },
    {
      title: '项目名称',
      dataIndex: 'feeNameCn',
      width: 180,
    },
    {
      title: '英文名称',
      dataIndex: 'feeNameEn',
      width: 220,
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
      title: '备注',
      dataIndex: 'remark',
      width: 220,
      render: (text?: string) => text || '-',
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
            description={`确定要删除费用类型「${record.feeNameCn}」吗？`}
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
            placeholder="项目名称/编码"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />}>查询</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加费用项目</Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredFeeTypes}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingFeeType ? '编辑费用类型' : '添加费用类型'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={700}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="feeCode" label="项目编码" rules={[{ required: true, message: '请输入项目编码' }]}>
                <Input placeholder="如：FREIGHT" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="feeNameCn" label="项目名称（中文）" rules={[{ required: true, message: '请输入项目名称' }]}>
                <Input placeholder="如：海运费" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="feeNameEn" label="英文名称">
                <Input placeholder="如：Sea Freight" />
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
            <TextArea rows={3} placeholder="输入备注信息..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
