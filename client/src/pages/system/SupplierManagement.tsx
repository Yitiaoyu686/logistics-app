import React, { useState, useMemo, useEffect } from 'react';
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
  Tag,
  Row,
  Col,
  Descriptions,
  Drawer
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { supplierApi } from '../../api';

const { Option } = Select;
const { TextArea } = Input;

// ========== 类型定义 ==========

type SupplierType = 'CARRIER' | 'CUSTOMS_BROKER' | 'WAREHOUSE' | 'TRUCKING' | 'AGENT' | 'OTHER';
type ServiceScope = 'AIR' | 'SEA' | 'LAND' | 'CUSTOMS' | 'WAREHOUSE' | 'DELIVERY';

interface Supplier {
  id: string;
  supplierCode: string;
  supplierName: string;
  supplierNameEn?: string;
  supplierType: SupplierType;
  country: string;
  city?: string;
  address?: string;

  // 联系信息
  legalRepresentative?: string;     // 法人代表
  contactPerson?: string;            // 联系人
  position?: string;                 // 职务
  phone?: string;                    // 公司电话
  fax?: string;                      // 传真
  email?: string;                    // 邮箱
  mobile?: string;                   // 手机

  // 业务信息
  serviceScope?: ServiceScope[];     // 服务范围
  serviceProducts?: string;          // 服务产品

  // 财务信息
  bankName?: string;
  bankAccount?: string;
  taxId?: string;

  // 其他
  remark?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}


const SUPPLIER_TYPE_NAMES: Record<SupplierType, string> = {
  CARRIER: '承运商',
  CUSTOMS_BROKER: '报关行',
  WAREHOUSE: '仓储服务商',
  TRUCKING: '拖车公司',
  AGENT: '代理',
  OTHER: '其他'
};

const SERVICE_SCOPE_NAMES: Record<ServiceScope, string> = {
  AIR: '空运',
  SEA: '海运',
  LAND: '陆运',
  CUSTOMS: '清关',
  WAREHOUSE: '仓储',
  DELIVERY: '配送'
};

// ========== 主组件 ==========

export const SupplierManagement: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchLegal, setSearchLegal] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);

  const [form] = Form.useForm();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await supplierApi.list();
        setSuppliers(res.data || res || []);
      } catch (e) {
        message.error('获取数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 搜索过滤
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchName = !searchName ||
        s.supplierName.toLowerCase().includes(searchName.toLowerCase()) ||
        s.supplierCode.toLowerCase().includes(searchName.toLowerCase());

      const matchLegal = !searchLegal ||
        (s.legalRepresentative && s.legalRepresentative.toLowerCase().includes(searchLegal.toLowerCase()));

      return matchName && matchLegal;
    });
  }, [suppliers, searchName, searchLegal]);

  // 打开新建弹窗
  const handleAdd = () => {
    setEditingSupplier(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: Supplier) => {
    setEditingSupplier(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // 保存供应商
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingSupplier) {
        // 编辑
        setSuppliers(suppliers.map(s =>
          s.id === editingSupplier.id
            ? { ...s, ...values, updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) }
            : s
        ));
        message.success('供应商信息已更新');
      } else {
        // 新建
        const newSupplier: Supplier = {
          id: `SUP-${Date.now()}`,
          ...values,
          status: 'ACTIVE',
          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
        };
        setSuppliers([...suppliers, newSupplier]);
        message.success('供应商已添加');
      }

      setModalVisible(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 删除供应商
  const handleDelete = (id: string) => {
    setSuppliers(suppliers.filter(s => s.id !== id));
    message.success('供应商已删除');
  };

  // 查看详情
  const handleViewDetail = (record: Supplier) => {
    setViewingSupplier(record);
    setDetailDrawerVisible(true);
  };

  // 表格列定义
  const columns: ColumnsType<Supplier> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: '供应商名称',
      dataIndex: 'supplierName',
      width: 200,
      render: (text: string, record: Supplier) => (
        <Button
          type="link"
          onClick={() => handleViewDetail(record)}
          style={{ padding: 0 }}
        >
          {text}
        </Button>
      )
    },
    {
      title: '所在国',
      dataIndex: 'country',
      width: 120
    },
    {
      title: '职务',
      dataIndex: 'position',
      width: 120,
      render: (text?: string) => text || '-'
    },
    {
      title: '公司电话',
      dataIndex: 'phone',
      width: 150,
      render: (text?: string) => text || '-'
    },
    {
      title: '传真',
      dataIndex: 'fax',
      width: 150,
      render: (text?: string) => text || '-'
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
      render: (text?: string) => text || '-'
    },
    {
      title: '服务产品',
      dataIndex: 'serviceProducts',
      width: 200,
      ellipsis: true,
      render: (text?: string) => text || '-'
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      defaultSortOrder: 'descend'
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 150,
      ellipsis: true,
      render: (text?: string) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除供应商「${record.supplierName}」吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 搜索栏 */}
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space size="middle">
          <Input
            placeholder="供应商名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Input
            placeholder="法人代表"
            value={searchLegal}
            onChange={(e) => setSearchLegal(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} style={{ background: '#52c41a' }}>
            查询
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加供应商
          </Button>
        </Space>
      </Card>

      {/* 供应商列表表格 */}
      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredSuppliers}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 1600 }}
        />
      </Card>

      {/* 新建/编辑供应商弹窗 */}
      <Modal
        title={editingSupplier ? '编辑供应商' : '添加供应商'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={900}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {/* 基本信息 */}
          <div style={{ marginBottom: 16, fontWeight: 'bold', fontSize: 14 }}>基本信息</div>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="supplierCode"
                label="供应商代码"
                rules={[{ required: true, message: '请输入供应商代码' }]}
              >
                <Input placeholder="如：OLAZDE" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="supplierName"
                label="供应商名称"
                rules={[{ required: true, message: '请输入供应商名称' }]}
              >
                <Input placeholder="如：深圳物流公司" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="supplierNameEn" label="英文名称">
                <Input placeholder="如：Shenzhen Logistics" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="supplierType"
                label="供应商类型"
                rules={[{ required: true, message: '请选择供应商类型' }]}
              >
                <Select placeholder="请选择">
                  {Object.entries(SUPPLIER_TYPE_NAMES).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="country"
                label="所在国家"
                rules={[{ required: true, message: '请输入国家' }]}
              >
                <Input placeholder="如：中国" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="city" label="城市">
                <Input placeholder="如：深圳" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="详细地址">
                <Input placeholder="请输入详细地址" />
              </Form.Item>
            </Col>
          </Row>

          {/* 联系信息 */}
          <div style={{ marginBottom: 16, marginTop: 24, fontWeight: 'bold', fontSize: 14 }}>联系信息</div>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="legalRepresentative" label="法人代表">
                <Input placeholder="请输入法人代表" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contactPerson" label="联系人">
                <Input placeholder="请输入联系人" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="position" label="职务">
                <Input placeholder="如：MD、Manager" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="phone" label="公司电话">
                <Input placeholder="请输入电话" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="mobile" label="手机">
                <Input placeholder="请输入手机" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="fax" label="传真">
                <Input placeholder="请输入传真" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="请输入邮箱" />
              </Form.Item>
            </Col>
          </Row>

          {/* 业务信息 */}
          <div style={{ marginBottom: 16, marginTop: 24, fontWeight: 'bold', fontSize: 14 }}>业务信息</div>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="serviceScope" label="服务范围">
                <Select mode="multiple" placeholder="请选择服务范围">
                  {Object.entries(SERVICE_SCOPE_NAMES).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serviceProducts" label="服务产品">
                <Input placeholder="如：国际海运、空运" />
              </Form.Item>
            </Col>
          </Row>

          {/* 财务信息 */}
          <div style={{ marginBottom: 16, marginTop: 24, fontWeight: 'bold', fontSize: 14 }}>财务信息</div>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="bankName" label="开户银行">
                <Input placeholder="请输入开户银行" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bankAccount" label="银行账号">
                <Input placeholder="请输入银行账号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taxId" label="税号">
                <Input placeholder="请输入税号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="输入备注信息..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="供应商详情"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={700}
      >
        {viewingSupplier && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="供应商代码" span={1}>
                {viewingSupplier.supplierCode}
              </Descriptions.Item>
              <Descriptions.Item label="供应商名称" span={1}>
                {viewingSupplier.supplierName}
              </Descriptions.Item>
              <Descriptions.Item label="英文名称" span={2}>
                {viewingSupplier.supplierNameEn || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="供应商类型" span={1}>
                <Tag color="blue">
                  {SUPPLIER_TYPE_NAMES[viewingSupplier.supplierType]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={1}>
                <Tag color={viewingSupplier.status === 'ACTIVE' ? 'green' : 'red'}>
                  {viewingSupplier.status === 'ACTIVE' ? '启用' : '停用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="所在国家" span={1}>
                {viewingSupplier.country}
              </Descriptions.Item>
              <Descriptions.Item label="城市" span={1}>
                {viewingSupplier.city || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="详细地址" span={2}>
                {viewingSupplier.address || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }} title="联系信息">
              <Descriptions.Item label="法人代表" span={1}>
                {viewingSupplier.legalRepresentative || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="联系人" span={1}>
                {viewingSupplier.contactPerson || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="职务" span={2}>
                {viewingSupplier.position || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="公司电话" span={1}>
                {viewingSupplier.phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="手机" span={1}>
                {viewingSupplier.mobile || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="传真" span={1}>
                {viewingSupplier.fax || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱" span={1}>
                {viewingSupplier.email || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }} title="业务信息">
              <Descriptions.Item label="服务范围">
                {viewingSupplier.serviceScope?.map(s => (
                  <Tag key={s} color="green">{SERVICE_SCOPE_NAMES[s]}</Tag>
                )) || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="服务产品">
                {viewingSupplier.serviceProducts || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions column={2} bordered size="small" style={{ marginTop: 16 }} title="财务信息">
              <Descriptions.Item label="开户银行" span={2}>
                {viewingSupplier.bankName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="银行账号" span={2}>
                {viewingSupplier.bankAccount || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="税号" span={2}>
                {viewingSupplier.taxId || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="备注">
                {viewingSupplier.remark || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {viewingSupplier.createdAt}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {viewingSupplier.updatedAt}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
};
