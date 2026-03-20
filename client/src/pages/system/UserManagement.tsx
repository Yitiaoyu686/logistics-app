import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, ReloadOutlined
} from '@ant-design/icons';
import { authApi, systemApi, warehouseManagementApi } from '../../api';

type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

interface RoleInfo {
  id: string;
  roleCode: string;
  roleName: string;
}

interface SiteInfo {
  id: string;
  siteName: string;
  siteCode: string;
}

interface WarehouseInfo {
  id: string;
  name: string;
  type: string;
}

interface DepartmentInfo {
  id: string;
  deptCode: string;
  deptName: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface User {
  id: string;
  username: string;
  realName: string;
  email?: string;
  phone?: string;
  role: string;
  roles?: string[];
  roleDetails?: RoleInfo[];
  status: UserStatus;
  departmentId?: string | null;
  department?: string;
  sites?: SiteInfo[];
  warehouses?: WarehouseInfo[];
  createdAt: string;
  lastLoginAt?: string;
}

interface FormValues {
  username: string;
  realName: string;
  password?: string;
  email?: string;
  phone?: string;
  status: UserStatus;
  departmentId?: string;
  roleIds: string[];
  siteIds?: string[];
  warehouseIds?: string[];
}

const STATUS_CONFIG: Record<UserStatus, { label: string; color: string }> = {
  ACTIVE: { label: '正常', color: 'success' },
  INACTIVE: { label: '停用', color: 'default' },
  LOCKED: { label: '锁定', color: 'error' }
};

export const UserManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [warehouseList, setWarehouseList] = useState<WarehouseInfo[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm<FormValues>();

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, roleRes, siteRes, departmentRes, warehouseRes]: any[] = await Promise.all([
        authApi.listUsers(),
        systemApi.listRbacRoles({ status: 'ACTIVE' }),
        systemApi.listSites({ status: 'ACTIVE' }),
        systemApi.listDepartments({ status: 'ACTIVE' }),
        warehouseManagementApi.list({ status: 'ACTIVE' }),
      ]);
      setUsers((userRes?.data || userRes || []) as User[]);
      setRoles((roleRes?.data || roleRes || []) as RoleInfo[]);
      setSites((siteRes?.data || siteRes || []) as SiteInfo[]);
      setDepartments((departmentRes?.data || departmentRes || []) as DepartmentInfo[]);
      setWarehouseList((warehouseRes?.data || warehouseRes || []) as WarehouseInfo[]);
    } catch (err: any) {
      message.error(err.message || '加载用户数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'ACTIVE',
      roleIds: [],
      siteIds: [],
      warehouseIds: [],
    });
    setModalVisible(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      realName: user.realName,
      email: user.email,
      phone: user.phone,
      departmentId: user.departmentId || undefined,
      status: user.status,
      roleIds: user.roleDetails?.map((role) => role.id) || [],
      siteIds: user.sites?.map((site) => site.id) || [],
      warehouseIds: user.warehouses?.map((warehouse) => warehouse.id) || [],
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.roleIds || values.roleIds.length === 0) {
        message.warning('请至少选择一个角色');
        return;
      }

      setSubmitLoading(true);
      const payload: any = {
        username: values.username?.trim(),
        realName: values.realName?.trim(),
        email: values.email?.trim(),
        phone: values.phone?.trim(),
        departmentId: values.departmentId || null,
        status: values.status,
        roleIds: values.roleIds || [],
        siteIds: values.siteIds || [],
        warehouseIds: values.warehouseIds || [],
      };
      if (!editingUser) {
        payload.password = values.password;
      } else if (values.password) {
        payload.password = values.password;
      }

      if (editingUser) {
        await authApi.updateUser(editingUser.id, payload);
        message.success('用户更新成功');
      } else {
        await authApi.createUser(payload);
        message.success('用户创建成功');
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

  const handleDelete = (user: User) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除用户 ${user.realName} 吗？`,
      onOk: async () => {
        try {
          await authApi.deleteUser(user.id);
          message.success('用户删除成功');
          await loadData();
        } catch (err: any) {
          message.error(err.message || '删除失败');
        }
      }
    });
  };

  const handleResetPassword = (user: User) => {
    Modal.confirm({
      title: '确认重置密码',
      content: `确定要重置用户 ${user.realName} 的密码吗？（默认 123456）`,
      onOk: async () => {
        try {
          await authApi.resetPassword(user.id, '123456');
          message.success('密码已重置为 123456');
        } catch (err: any) {
          message.error(err.message || '重置失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 140,
    },
    {
      title: '姓名',
      dataIndex: 'realName',
      key: 'realName',
      width: 120,
    },
    {
      title: '角色',
      dataIndex: 'roleDetails',
      key: 'roleDetails',
      width: 240,
      render: (roleDetails: RoleInfo[], record: User) => {
        const list = roleDetails && roleDetails.length > 0
          ? roleDetails.map((item) => item.roleName || item.roleCode)
          : (record.roles || [record.role]);
        return (
          <Space size={[4, 4]} wrap>
            {list.map((name, index) => <Tag key={`${record.id}-${name}-${index}`} color="blue">{name}</Tag>)}
          </Space>
        );
      },
    },
    {
      title: '站点',
      dataIndex: 'sites',
      key: 'sites',
      width: 240,
      render: (siteItems: SiteInfo[]) => (
        <Space size={[4, 4]} wrap>
          {siteItems && siteItems.length > 0
            ? siteItems.map((site) => <Tag key={site.id}>{site.siteName}</Tag>)
            : <span style={{ color: '#999' }}>未分配</span>}
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (value: string) => value || '-',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (value: string) => value || '-',
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: (value: string, record: User) => {
        if (value) return value;
        if (record.departmentId) {
          const dept = departments.find((d) => d.id === record.departmentId);
          if (dept?.deptName) return dept.deptName;
        }
        return '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: UserStatus) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 180,
      render: (text: string) => text ? text.replace('T', ' ').substring(0, 19) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<LockOutlined />} onClick={() => handleResetPassword(record)}>
            重置密码
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建用户</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          scroll={{ x: 1800 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={submitLoading}
        width={700}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            label="姓名"
            name="realName"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            label={editingUser ? '重置密码（可选）' : '登录密码'}
            name="password"
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingUser ? '不填则保持原密码' : '请输入登录密码'} />
          </Form.Item>
          <Form.Item
            label="角色"
            name="roleIds"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择角色"
              options={roles.map((role) => ({ value: role.id, label: `${role.roleName} (${role.roleCode})` }))}
            />
          </Form.Item>
          <Form.Item label="关联站点" name="siteIds">
            <Select
              mode="multiple"
              placeholder="请选择关联站点"
              options={sites.map((site) => ({ value: site.id, label: `${site.siteName} (${site.siteCode})` }))}
            />
          </Form.Item>
          <Form.Item label="附加仓库权限" name="warehouseIds">
            <Select
              mode="multiple"
              placeholder="可选：手动附加仓库权限"
              options={warehouseList.map((warehouse) => ({
                value: warehouse.id,
                label: `${warehouse.name} (${warehouse.type === 'ORIGIN' ? '起运国' : warehouse.type === 'DESTINATION' ? '到达国' : '中转'})`
              }))}
            />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '请输入有效邮箱地址' }]}>
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item label="部门" name="departmentId">
            <Select
              allowClear
              placeholder="请选择部门"
              options={departments.map((dept) => ({
                value: dept.id,
                label: `${dept.deptName} (${dept.deptCode})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              options={[
                { value: 'ACTIVE', label: '正常' },
                { value: 'INACTIVE', label: '停用' },
                { value: 'LOCKED', label: '锁定' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
