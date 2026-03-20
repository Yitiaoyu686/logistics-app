import React, { useState, useMemo } from 'react';
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
  Checkbox
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;

// ========== 类型定义 ==========

interface TransitWarehouse {
  id: string;
  warehouseName: string;
  warehouseNameEn?: string;
  city: string;
  partnerCity?: string;
  address: string;
  addressEn?: string;
  manager: string;
  managerPhone: string;
  warehousePhone?: string;
  centerCommon?: string;      // 个人中心通用
  centerRecommend?: string;   // 个人中心推荐
  whseName?: string;
  ctin?: string;
  isTransitWarehouse: boolean; // 发运中转仓库
  remark?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}


// ========== 主组件 ==========

export const TransitWarehouseManagement: React.FC = () => {
  const [warehouses, setWarehouses] = useState<TransitWarehouse[]>([]);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<TransitWarehouse | null>(null);

  const [form] = Form.useForm();

  // 搜索过滤
  const filteredWarehouses = useMemo(() => {
    if (!searchText) return warehouses;
    return warehouses.filter(w =>
      w.warehouseName.toLowerCase().includes(searchText.toLowerCase()) ||
      w.city.toLowerCase().includes(searchText.toLowerCase()) ||
      (w.warehouseNameEn && w.warehouseNameEn.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [warehouses, searchText]);

  // 打开新建弹窗
  const handleAdd = () => {
    setEditingWarehouse(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: TransitWarehouse) => {
    setEditingWarehouse(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // 保存中转仓库
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingWarehouse) {
        // 编辑
        setWarehouses(warehouses.map(w =>
          w.id === editingWarehouse.id
            ? { ...w, ...values, updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) }
            : w
        ));
        message.success('中转仓库信息已更新');
      } else {
        // 新建
        const newWarehouse: TransitWarehouse = {
          id: `WH-${Date.now()}`,
          ...values,
          isTransitWarehouse: values.isTransitWarehouse ?? false,
          status: 'ACTIVE',
          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
        };
        setWarehouses([...warehouses, newWarehouse]);
        message.success('中转仓库已添加');
      }

      setModalVisible(false);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 删除中转仓库
  const handleDelete = (id: string) => {
    setWarehouses(warehouses.filter(w => w.id !== id));
    message.success('中转仓库已删除');
  };

  // 表格列定义
  const columns: ColumnsType<TransitWarehouse> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: '仓库地址',
      dataIndex: 'address',
      width: 300,
      ellipsis: true
    },
    {
      title: '所在城市',
      dataIndex: 'city',
      width: 100
    },
    {
      title: '仓库名称',
      dataIndex: 'warehouseName',
      width: 150
    },
    {
      title: '负责人',
      dataIndex: 'manager',
      width: 100,
      render: (text?: string) => text || '-'
    },
    {
      title: '个人联系方式',
      dataIndex: 'managerPhone',
      width: 150
    },
    {
      title: '仓库电话',
      dataIndex: 'warehousePhone',
      width: 150,
      render: (text?: string) => text || '-'
    },
    {
      title: '个人中心通用',
      dataIndex: 'centerCommon',
      width: 200,
      ellipsis: true,
      render: (text?: string) => text || '-'
    },
    {
      title: '个人中心推荐',
      dataIndex: 'centerRecommend',
      width: 150,
      render: (text?: string) => text || '-'
    },
    {
      title: '发运中转仓库',
      dataIndex: 'isTransitWarehouse',
      width: 120,
      align: 'center',
      render: (checked: boolean) => (
        <Checkbox checked={checked} disabled />
      )
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
            description={`确定要删除中转仓库「${record.warehouseName}」吗？`}
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
            placeholder="仓库名称"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} style={{ background: '#52c41a' }}>
            查询
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加
          </Button>
        </Space>
      </Card>

      {/* 中转仓库列表表格 */}
      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredWarehouses}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 2000 }}
        />
      </Card>

      {/* 新建/编辑中转仓库弹窗 */}
      <Modal
        title="中转仓库添加"
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={800}
        okText="提交"
        cancelText="关闭"
        okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            {/* 左列 */}
            <Col span={12}>
              <Form.Item
                name="city"
                label="所在城市"
                rules={[{ required: true, message: '请输入所在城市' }]}
              >
                <Input placeholder="选择" />
              </Form.Item>

              <Form.Item name="partnerCity" label="联营城市">
                <Input placeholder="联营城市" />
              </Form.Item>

              <Form.Item
                name="address"
                label="仓库地址"
                rules={[{ required: true, message: '请输入仓库地址' }]}
              >
                <Input placeholder="仓库地址" />
              </Form.Item>

              <Form.Item name="addressEn" label="Address">
                <Input placeholder="Address" />
              </Form.Item>

              <Form.Item name="manager" label="负责人">
                <Input placeholder="负责人" />
              </Form.Item>

              <Form.Item name="remark" label="备注">
                <TextArea rows={3} placeholder="备注" />
              </Form.Item>
            </Col>

            {/* 右列 */}
            <Col span={12}>
              <Form.Item name="isTransitWarehouse" label="选择" valuePropName="checked">
                <Checkbox>发运中转仓库</Checkbox>
              </Form.Item>

              <Form.Item name="warehousePhone" label="仓库电话">
                <Input placeholder="仓库电话" />
              </Form.Item>

              <Form.Item
                name="warehouseName"
                label="仓库名称"
                rules={[{ required: true, message: '请输入仓库名称' }]}
              >
                <Input placeholder="仓库名称" />
              </Form.Item>

              <Form.Item name="whseName" label="WHSE Name">
                <Input placeholder="WHSE Name" />
              </Form.Item>

              <Form.Item name="ctin" label="CTIN">
                <Input placeholder="CTIN" />
              </Form.Item>

              <Form.Item name="managerPhone" label="个人联系方式">
                <Input placeholder="个人联系方式" />
              </Form.Item>

              <Form.Item name="centerCommon" label="个人中心通用">
                <Input placeholder="个人中心通用" />
              </Form.Item>

              <Form.Item name="centerRecommend" label="个人中心推荐">
                <Input placeholder="个人中心推荐" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
