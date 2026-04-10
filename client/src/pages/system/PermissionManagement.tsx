import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Descriptions, Switch
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined, ReloadOutlined, SearchOutlined
} from '@ant-design/icons';
import { systemApi } from '../../api';

const PERMISSION_TYPE_OPTIONS = [
  { label: '菜单', value: 'MENU' },
  { label: '标签页', value: 'TAB' },
  { label: '按钮', value: 'BUTTON' },
  { label: '接口', value: 'API' },
];

interface Permission {
  id: string;
  permissionCode: string;
  permissionName: string;
  moduleKey?: string;
  permissionType: 'MENU' | 'TAB' | 'BUTTON' | 'API';
  path?: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  roleCount?: number;
  createdAt: string;
}

export const PermissionManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>(undefined);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = await systemApi.listRbacPermissions();
      setPermissions((res?.data || res || []) as Permission[]);
    } catch (err: any) {
      message.error(err.message || '加载权限列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingPermission(null);
    form.resetFields();
    form.setFieldsValue({ permissionType: 'MENU', status: 'ACTIVE' });
    setModalVisible(true);
  };

  const handleEdit = (permission: Permission) => {
    setEditingPermission(permission);
    form.setFieldsValue(permission);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);

      if (editingPermission) {
        await systemApi.updateRbacPermission(editingPermission.id, {
          permissionName: values.permissionName,
          moduleKey: values.moduleKey,
          permissionType: values.permissionType,
          path: values.path,
          description: values.description,
          status: values.status,
        });
        message.success('权限更新成功');
      } else {
        await systemApi.createRbacPermission(values);
        message.success('权限创建成功');
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

  const handleDelete = (permission: Permission) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除权限 ${permission.permissionName} 吗？`,
      onOk: async () => {
        try {
          await systemApi.deleteRbacPermission(permission.id);
          message.success('权限删除成功');
          await loadData();
        } catch (err: any) {
          message.error(err.message || '删除失败');
        }
      }
    });
  };

  const handleViewDetail = (permission: Permission) => {
    setSelectedPermission(permission);
    setDetailVisible(true);
  };

  const handleToggleStatus = async (permission: Permission) => {
    const nextStatus = permission.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await systemApi.updateRbacPermission(permission.id, { status: nextStatus });
      message.success(nextStatus === 'ACTIVE' ? '权限已启用' : '权限已停用');
      await loadData();
    } catch (err: any) {
      message.error(err.message || '状态更新失败');
    }
  };

  const columns = [
    {
      title: '权限编码',
      dataIndex: 'permissionCode',
      key: 'permissionCode',
      width: 240,
    },
    {
      title: '权限名称',
      dataIndex: 'permissionName',
      key: 'permissionName',
      width: 160,
    },
    {
      title: '模块',
      dataIndex: 'moduleKey',
      key: 'moduleKey',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '类型',
      dataIndex: 'permissionType',
      key: 'permissionType',
      width: 100,
      render: (value: string) => (
        <Tag color={value === 'MENU' ? 'blue' : value === 'TAB' ? 'cyan' : value === 'BUTTON' ? 'orange' : 'purple'}>
          {PERMISSION_TYPE_OPTIONS.find((item) => item.value === value)?.label || value}
        </Tag>
      ),
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 220,
      render: (value: string) => value || '-',
    },
    {
      title: '关联角色数',
      dataIndex: 'roleCount',
      key: 'roleCount',
      width: 120,
      render: (value: number) => `${value || 0} 个`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (_: string, record: Permission) => (
        <Switch
          checked={record.status === 'ACTIVE'}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="启用"
          unCheckedChildren="停用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: Permission) => (
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

  const filteredPermissions = permissions.filter((perm) => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword && !perm.permissionCode.toLowerCase().includes(keyword) && !perm.permissionName.toLowerCase().includes(keyword)) {
      return false;
    }
    if (filterType && perm.permissionType !== filterType) return false;
    return true;
  });

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="权限编码/名称"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 200 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <Select
            placeholder="类型筛选"
            allowClear
            style={{ width: 130 }}
            value={filterType}
            onChange={(v) => setFilterType(v)}
            options={PERMISSION_TYPE_OPTIONS}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建权限</Button>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredPermissions}
          loading={loading}
          scroll={{ x: 1700 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      <Modal
        title={editingPermission ? '编辑权限' : '新建权限'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={submitLoading}
        width={620}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
          <Form.Item
            label="权限编码"
            name="permissionCode"
            rules={[{ required: true, message: '请输入权限编码' }]}
          >
            <Input placeholder="例如：menu.set_org" disabled={!!editingPermission} />
          </Form.Item>
          <Form.Item
            label="权限名称"
            name="permissionName"
            rules={[{ required: true, message: '请输入权限名称' }]}
          >
            <Input placeholder="请输入权限名称" />
          </Form.Item>
          <Form.Item label="模块键" name="moduleKey">
            <Input placeholder="例如：set_org" />
          </Form.Item>
          <Form.Item
            label="权限类型"
            name="permissionType"
            rules={[{ required: true, message: '请选择权限类型' }]}
          >
            <Select options={PERMISSION_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="路径" name="path">
            <Input placeholder="例如：/system/org" />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'INACTIVE' }]} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="请输入权限描述" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="权限详情"
        open={detailVisible}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        onCancel={() => setDetailVisible(false)}
      >
        {selectedPermission ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="权限编码">{selectedPermission.permissionCode}</Descriptions.Item>
            <Descriptions.Item label="权限名称">{selectedPermission.permissionName}</Descriptions.Item>
            <Descriptions.Item label="模块键">{selectedPermission.moduleKey || '-'}</Descriptions.Item>
            <Descriptions.Item label="权限类型">
              {PERMISSION_TYPE_OPTIONS.find((item) => item.value === selectedPermission.permissionType)?.label || selectedPermission.permissionType}
            </Descriptions.Item>
            <Descriptions.Item label="路径">{selectedPermission.path || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {selectedPermission.status === 'ACTIVE' ? '启用' : '停用'}
            </Descriptions.Item>
            <Descriptions.Item label="描述">{selectedPermission.description || '-'}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
};
