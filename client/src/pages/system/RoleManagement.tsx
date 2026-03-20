import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, Checkbox, message, Descriptions
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined, ReloadOutlined
} from '@ant-design/icons';
import { systemApi } from '../../api';

const SITE_SCOPE_OPTIONS = [
  { label: '全站点', value: 'ALL_SITE' },
  { label: '分配站点', value: 'ASSIGNED_SITE' },
  { label: '所属站点', value: 'OWN_SITE' },
];

interface RbacRole {
  id: string;
  roleCode: string;
  roleName: string;
  description?: string;
  siteScope: 'ALL_SITE' | 'ASSIGNED_SITE' | 'OWN_SITE';
  status: 'ACTIVE' | 'INACTIVE';
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  createdAt: string;
}

interface RbacPermission {
  id: string;
  permissionCode: string;
  permissionName: string;
  moduleKey?: string;
}

export const RoleManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [permissions, setPermissions] = useState<RbacPermission[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<RbacRole | null>(null);
  const [form] = Form.useForm();

  const permissionMap = useMemo(() => {
    const map = new Map<string, RbacPermission>();
    for (const permission of permissions) map.set(permission.id, permission);
    return map;
  }, [permissions]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [roleRes, permissionRes]: any[] = await Promise.all([
        systemApi.listRbacRoles(),
        systemApi.listRbacPermissions({ status: 'ACTIVE' }),
      ]);
      setRoles((roleRes?.data || roleRes || []) as RbacRole[]);
      setPermissions((permissionRes?.data || permissionRes || []) as RbacPermission[]);
    } catch (err: any) {
      message.error(err.message || '加载角色数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadRolePermissions = async (roleId: string) => {
    const res: any = await systemApi.getRolePermissions(roleId);
    const data = res?.data || res || {};
    return (data.assignedPermissionIds || []) as string[];
  };

  const handleAdd = () => {
    setEditingRole(null);
    setSelectedPermissionIds([]);
    form.resetFields();
    form.setFieldsValue({ siteScope: 'ASSIGNED_SITE', status: 'ACTIVE' });
    setModalVisible(true);
  };

  const handleEdit = async (role: RbacRole) => {
    setEditingRole(role);
    form.setFieldsValue({
      roleCode: role.roleCode,
      roleName: role.roleName,
      description: role.description,
      siteScope: role.siteScope,
      status: role.status,
    });
    try {
      const permissionIds = await loadRolePermissions(role.id);
      setSelectedPermissionIds(permissionIds);
    } catch {
      setSelectedPermissionIds([]);
      message.warning('角色权限加载失败，请重新打开');
    }
    setModalVisible(true);
  };

  const handleViewDetail = async (role: RbacRole) => {
    setSelectedRole(role);
    try {
      const permissionIds = await loadRolePermissions(role.id);
      setSelectedPermissionIds(permissionIds);
    } catch {
      setSelectedPermissionIds([]);
    }
    setDetailVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);

      let roleId = editingRole?.id;
      if (editingRole) {
        await systemApi.updateRbacRole(editingRole.id, {
          roleName: values.roleName,
          description: values.description,
          siteScope: values.siteScope,
          status: values.status,
        });
      } else {
        const created: any = await systemApi.createRbacRole({
          roleCode: values.roleCode,
          roleName: values.roleName,
          description: values.description,
          siteScope: values.siteScope,
          status: values.status,
        });
        roleId = created?.data?.id || created?.id;
      }

      if (!roleId) {
        throw new Error('角色保存成功但未返回 roleId');
      }

      await systemApi.setRolePermissions(roleId, selectedPermissionIds);
      message.success(editingRole ? '角色更新成功' : '角色创建成功');
      setModalVisible(false);
      form.resetFields();
      setSelectedPermissionIds([]);
      await loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || '保存失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = (role: RbacRole) => {
    if (role.isSystem) {
      message.warning('系统内置角色不可删除');
      return;
    }
    if (Number(role.userCount || 0) > 0) {
      message.warning('该角色下还有用户，无法删除');
      return;
    }
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除角色 ${role.roleName} 吗？`,
      onOk: async () => {
        try {
          await systemApi.deleteRbacRole(role.id);
          message.success('角色删除成功');
          await loadData();
        } catch (err: any) {
          message.error(err.message || '删除失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '角色编码',
      dataIndex: 'roleCode',
      key: 'roleCode',
      width: 160,
      render: (value: string, row: RbacRole) => (
        <Space>
          <Tag color={row.isSystem ? 'gold' : 'blue'}>{value}</Tag>
          {row.isSystem ? <Tag color="orange">系统</Tag> : null}
        </Space>
      ),
    },
    {
      title: '角色名称',
      dataIndex: 'roleName',
      key: 'roleName',
      width: 180,
    },
    {
      title: '站点范围',
      dataIndex: 'siteScope',
      key: 'siteScope',
      width: 120,
      render: (value: string) => SITE_SCOPE_OPTIONS.find((item) => item.value === value)?.label || value,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '权限数',
      dataIndex: 'permissionCount',
      key: 'permissionCount',
      width: 100,
      render: (count: number) => `${count || 0} 个`,
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      render: (count: number) => `${count || 0} 人`,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 260,
      ellipsis: true,
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: RbacRole) => (
        <Space size="small">
          <Button type="link" size="small" icon={<SafetyOutlined />} onClick={() => handleViewDetail(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建角色</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={roles}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setSelectedPermissionIds([]);
        }}
        confirmLoading={submitLoading}
        width={780}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item
            label="角色编码"
            name="roleCode"
            rules={[{ required: true, message: '请输入角色编码' }]}
          >
            <Input placeholder="例如：OPS_CN" disabled={!!editingRole} />
          </Form.Item>
          <Form.Item
            label="角色名称"
            name="roleName"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item
            label="站点范围"
            name="siteScope"
            rules={[{ required: true, message: '请选择站点范围' }]}
          >
            <Select options={SITE_SCOPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }]} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="请输入角色描述" />
          </Form.Item>
          <Form.Item label="权限配置">
            <Checkbox.Group
              value={selectedPermissionIds}
              onChange={(checked) => setSelectedPermissionIds(checked as string[])}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {permissions.map((permission) => (
                  <Checkbox key={permission.id} value={permission.id}>
                    {permission.permissionName} ({permission.permissionCode})
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="角色详情"
        open={detailVisible}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        onCancel={() => setDetailVisible(false)}
        width={720}
      >
        {selectedRole ? (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="角色编码">{selectedRole.roleCode}</Descriptions.Item>
              <Descriptions.Item label="角色名称">{selectedRole.roleName}</Descriptions.Item>
              <Descriptions.Item label="站点范围">
                {SITE_SCOPE_OPTIONS.find((item) => item.value === selectedRole.siteScope)?.label || selectedRole.siteScope}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {selectedRole.status === 'ACTIVE' ? '启用' : '停用'}
              </Descriptions.Item>
              <Descriptions.Item label="用户数量">{selectedRole.userCount || 0}</Descriptions.Item>
              <Descriptions.Item label="权限数量">{selectedRole.permissionCount || 0}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{selectedRole.description || '-'}</Descriptions.Item>
            </Descriptions>
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>已分配权限</div>
              <Space wrap>
                {selectedPermissionIds.length > 0 ? selectedPermissionIds.map((permissionId) => {
                  const permission = permissionMap.get(permissionId);
                  return (
                    <Tag key={permissionId} color="blue">
                      {permission ? permission.permissionName : permissionId}
                    </Tag>
                  );
                }) : <Tag>无</Tag>}
              </Space>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
};
