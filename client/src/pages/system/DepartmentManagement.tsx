import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { authApi, systemApi } from '../../api';

interface Department {
  id: string;
  deptCode: string;
  deptName: string;
  managerUserId?: string | null;
  managerName?: string | null;
  sortOrder: number;
  status: 'ACTIVE' | 'INACTIVE';
  remark?: string | null;
  userCount?: number;
}

interface UserOption {
  id: string;
  realName: string;
  username: string;
}

export const DepartmentManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptRes, userRes]: any[] = await Promise.all([
        systemApi.listDepartments(),
        authApi.listUsers(),
      ]);
      setDepartments((deptRes?.data || deptRes || []) as Department[]);
      setUsers((userRes?.data || userRes || []) as UserOption[]);
    } catch (err: any) {
      message.error(err.message || '加载部门数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingDepartment(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE', sortOrder: 0 });
    setModalVisible(true);
  };

  const handleEdit = (record: Department) => {
    setEditingDepartment(record);
    form.setFieldsValue({
      deptCode: record.deptCode,
      deptName: record.deptName,
      managerUserId: record.managerUserId || undefined,
      sortOrder: record.sortOrder ?? 0,
      status: record.status,
      remark: record.remark || undefined,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);

      const payload = {
        deptCode: String(values.deptCode || '').trim().toUpperCase(),
        deptName: String(values.deptName || '').trim(),
        managerUserId: values.managerUserId || null,
        sortOrder: Number(values.sortOrder || 0),
        status: values.status,
        remark: values.remark || null,
      };

      if (editingDepartment) {
        await systemApi.updateDepartment(editingDepartment.id, payload);
        message.success('部门更新成功');
      } else {
        await systemApi.createDepartment(payload);
        message.success('部门创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      await loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || '保存失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (record: Department) => {
    try {
      await systemApi.deleteDepartment(record.id);
      message.success('部门删除成功');
      await loadData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  const handleToggleStatus = async (record: Department, checked: boolean) => {
    try {
      await systemApi.updateDepartment(record.id, { status: checked ? 'ACTIVE' : 'INACTIVE' });
      message.success(checked ? '部门已启用' : '部门已停用');
      await loadData();
    } catch (err: any) {
      message.error(err.message || '状态更新失败');
    }
  };

  const columns = [
    {
      title: '部门编码',
      dataIndex: 'deptCode',
      key: 'deptCode',
      width: 140,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: '部门名称',
      dataIndex: 'deptName',
      key: 'deptName',
      width: 180,
    },
    {
      title: '负责人',
      dataIndex: 'managerName',
      key: 'managerName',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      render: (value: number) => `${value || 0} 人`,
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 90,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (_: string, record: Department) => (
        <Switch
          checked={record.status === 'ACTIVE'}
          onChange={(checked) => handleToggleStatus(record, checked)}
          checkedChildren="启用"
          unCheckedChildren="停用"
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right' as const,
      render: (_: any, record: Department) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该部门？"
            description="仅在无子部门且无关联用户时可删除"
            okText="删除"
            cancelText="取消"
            onConfirm={() => handleDelete(record)}
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
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增部门</Button>
        <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={departments}
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
      />

      <Modal
        title={editingDepartment ? '编辑部门' : '新增部门'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={submitLoading}
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="部门编码" name="deptCode" rules={[{ required: true, message: '请输入部门编码' }]}>
            <Input placeholder="例如：SALES" disabled={!!editingDepartment} />
          </Form.Item>
          <Form.Item label="部门名称" name="deptName" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="例如：销售部" />
          </Form.Item>
          <Form.Item label="负责人" name="managerUserId">
            <Select
              allowClear
              placeholder="选择负责人"
              options={users.map((user) => ({
                value: user.id,
                label: `${user.realName} (${user.username})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="排序" name="sortOrder">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { value: 'ACTIVE', label: '启用' },
                { value: 'INACTIVE', label: '停用' },
              ]}
            />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={3} placeholder="可选备注" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
