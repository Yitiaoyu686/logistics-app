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
  Checkbox,
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

interface GoodsCategory {
  id: string;
  categoryCode: string;
  categoryName: string;
  categoryNameEn?: string;
  description: string[];
  descriptionEn: string[];
  remark?: string;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
}

interface GoodsAttribute {
  zh: string;
  en: string;
}

const GOODS_ATTRIBUTES: GoodsAttribute[] = [
  { zh: '带电池', en: 'Containing Battery' },
  { zh: '带磁性', en: 'Containing Magnetic' },
  { zh: '粉末状', en: 'Powder' },
  { zh: '颗粒状', en: 'Granular' },
  { zh: '膏状体', en: 'Cream' },
  { zh: '液体类', en: 'Liquid' },
  { zh: '带消磁', en: 'Oiliness' },
  { zh: '含液体', en: 'Containing Liquid' },
  { zh: '纺织品', en: 'Textile' },
  { zh: '普货', en: 'General Goods' },
  { zh: '其它', en: 'Other' },
];

function mapBaseDataToCategory(row: any): GoodsCategory {
  const extra = row?.extra || {};
  return {
    id: String(row.id),
    categoryCode: String(row.dataCode || ''),
    categoryName: String(row.dataName || ''),
    categoryNameEn: row.dataNameEn || undefined,
    description: Array.isArray(extra.description) ? extra.description : [],
    descriptionEn: Array.isArray(extra.descriptionEn) ? extra.descriptionEn : [],
    remark: row.remark || undefined,
    sortOrder: Number(row.sortOrder || 0),
    status: String(row.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
    updatedAt: String(row.updatedAt || ''),
  };
}

export const GoodsCategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<GoodsCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<GoodsCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res: any = await systemApi.listBaseData({ dataType: 'CARGO_CATEGORY' });
      const rows = Array.isArray(res?.data) ? res.data : [];
      setCategories(rows.map(mapBaseDataToCategory));
    } catch (err: any) {
      message.error(err.message || '加载货物分类失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const filteredCategories = useMemo(() => {
    if (!searchText) return categories;
    const kw = searchText.toLowerCase();
    return categories.filter((c) =>
      c.categoryName.toLowerCase().includes(kw) ||
      c.categoryCode.toLowerCase().includes(kw) ||
      (c.categoryNameEn && c.categoryNameEn.toLowerCase().includes(kw))
    );
  }, [categories, searchText]);

  const handleAdd = () => {
    setEditingCategory(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE', sortOrder: 100, description: [] });
    setModalVisible(true);
  };

  const handleEdit = (record: GoodsCategory) => {
    setEditingCategory(record);
    form.setFieldsValue({ ...record });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const description = Array.isArray(values.description) ? values.description : [];
      const descriptionEn = description.map((zh: string) => {
        const attr = GOODS_ATTRIBUTES.find((a) => a.zh === zh);
        return attr ? attr.en : zh;
      });

      const payload: any = {
        dataType: 'CARGO_CATEGORY',
        dataName: String(values.categoryName || '').trim(),
        dataNameEn: values.categoryNameEn ? String(values.categoryNameEn).trim() : null,
        status: values.status,
        sortOrder: Number(values.sortOrder || 0),
        remark: values.remark ? String(values.remark).trim() : null,
        extra: {
          description,
          descriptionEn,
        },
      };

      const categoryCode = String(values.categoryCode || '').trim().toUpperCase();
      if (categoryCode) payload.dataCode = categoryCode;

      if (editingCategory) {
        await systemApi.updateBaseData(editingCategory.id, payload);
        message.success('货物分类已更新');
      } else {
        await systemApi.createBaseData(payload);
        message.success('货物分类已添加');
      }

      setModalVisible(false);
      await fetchCategories();
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
      message.success('货物分类已删除');
      await fetchCategories();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const columns: ColumnsType<GoodsCategory> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '类别编码',
      dataIndex: 'categoryCode',
      width: 140,
    },
    {
      title: '类别名称',
      dataIndex: 'categoryName',
      width: 160,
    },
    {
      title: '英文名称',
      dataIndex: 'categoryNameEn',
      width: 200,
      render: (text?: string) => text || '-',
    },
    {
      title: '货物属性',
      dataIndex: 'description',
      width: 260,
      render: (desc: string[]) => (Array.isArray(desc) && desc.length > 0 ? desc.join('、') : '-'),
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
            description={`确定要删除货物分类「${record.categoryName}」吗？`}
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
            placeholder="类别名称/编码"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />}>查询</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加货物类别</Button>
        </Space>
      </Card>

      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredCategories}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title={editingCategory ? '编辑货物分类' : '添加货物分类'}
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
              <Form.Item name="categoryCode" label="类别编码">
                <Input placeholder="如：ELECTRONICS（留空自动生成）" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="categoryName" label="类别名称" rules={[{ required: true, message: '请输入类别名称' }]}>
                <Input placeholder="如：日用百货" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="categoryNameEn" label="英文名称">
                <Input placeholder="如：Daily Provisions" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="货物属性" extra="勾选后将自动生成英文属性">
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 12]}>
                {GOODS_ATTRIBUTES.map((attr) => (
                  <Col span={8} key={attr.zh}>
                    <Checkbox value={attr.zh}>{attr.zh} ({attr.en})</Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Form.Item>

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
