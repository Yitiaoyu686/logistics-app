import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Switch
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, BranchesOutlined, SearchOutlined
} from '@ant-design/icons';
import { systemApi } from '../../api';

const { Option } = Select;
const { TextArea } = Input;

// 审批流程类型
type WorkflowStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

interface WorkflowNode {
  id: string;
  name: string;
  approverType: 'ROLE' | 'USER';
  approverValue: string;
  order: number;
}

interface WorkflowConfig {
  id: string;
  name: string;
  code: string;
  businessType: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  createdAt: string;
  updatedAt?: string;
}

// 业务类型选项
const BUSINESS_TYPES = [
  { value: 'FEE_APPROVAL', label: '费用审批' },
  { value: 'REFUND_APPROVAL', label: '退款审批' },
  { value: 'RETURN_APPROVAL', label: '退运审批' },
  { value: 'ORDER_CANCEL', label: '订单取消审批' },
  { value: 'PETTY_CASH', label: '备用金审批' },
  { value: 'PAYMENT', label: '付款审批' },
  { value: 'CUSTOM', label: '自定义' },
];

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string }> = {
  ACTIVE: { label: '启用', color: 'success' },
  INACTIVE: { label: '停用', color: 'default' },
  DRAFT: { label: '草稿', color: 'warning' },
};

export const WorkflowConfigPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowConfig | null>(null);
  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterBizType, setFilterBizType] = useState<string | undefined>(undefined);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const res = await systemApi.listWorkflows();
      setWorkflows(res.data || []);
    } catch (err: any) {
      message.error(err.message || '加载审批流程失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  // 新建
  const handleAdd = () => {
    setEditingWorkflow(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 编辑
  const handleEdit = (record: WorkflowConfig) => {
    setEditingWorkflow(record);
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      businessType: record.businessType,
      description: record.description,
    });
    setModalVisible(true);
  };

  // 删除
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确认要删除此审批流程吗？',
      onOk: async () => {
        try {
          await systemApi.deleteWorkflow(id);
          message.success('删除成功');
          await loadWorkflows();
        } catch (err: any) {
          message.error(err.message || '删除失败');
        }
      },
    });
  };

  // 切换状态
  const handleToggleStatus = async (record: WorkflowConfig) => {
    const newStatus: WorkflowStatus = record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await systemApi.updateWorkflowStatus(record.id, newStatus);
      message.success(newStatus === 'ACTIVE' ? '已启用' : '已停用');
      await loadWorkflows();
    } catch (err: any) {
      message.error(err.message || '更新状态失败');
    }
  };

  // 提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingWorkflow) {
        await systemApi.updateWorkflow(editingWorkflow.id, values);
        message.success('更新成功');
      } else {
        await systemApi.createWorkflow({
          ...values,
          status: 'DRAFT',
          nodes: [],
        });
        message.success('创建成功');
      }

      setModalVisible(false);
      form.resetFields();
      await loadWorkflows();
    } catch (error: any) {
      message.error(error.message || '保存流程失败');
    }
  };

  const columns = [
    {
      title: '流程名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string) => (
        <Space>
          <BranchesOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '流程编码',
      dataIndex: 'code',
      key: 'code',
      width: 160,
    },
    {
      title: '业务类型',
      dataIndex: 'businessType',
      key: 'businessType',
      width: 120,
      render: (type: string) => {
        const found = BUSINESS_TYPES.find(t => t.value === type);
        return found ? found.label : type;
      },
    },
    {
      title: '审批节点数',
      key: 'nodeCount',
      width: 100,
      align: 'center' as const,
      render: (record: WorkflowConfig) => (
        <Tag color="blue">{record.nodes.length} 个节点</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: WorkflowStatus) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: WorkflowConfig) => (
        <Space size="small">
          <Switch
            size="small"
            checked={record.status === 'ACTIVE'}
            onChange={() => handleToggleStatus(record)}
          />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const filteredWorkflows = workflows.filter((wf) => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword && !wf.name.toLowerCase().includes(keyword) && !wf.code.toLowerCase().includes(keyword)) {
      return false;
    }
    if (filterBizType && wf.businessType !== filterBizType) return false;
    return true;
  });

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 500 }}>审批流程配置</span>
            <span style={{ color: '#999', fontSize: 13, marginLeft: 12 }}>
              配置各业务模块的审批流程和审批节点
            </span>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建流程
          </Button>
        </div>

        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="流程名称/编码"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 200 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <Select
            placeholder="业务类型"
            allowClear
            style={{ width: 150 }}
            value={filterBizType}
            onChange={(v) => setFilterBizType(v)}
            options={BUSINESS_TYPES}
          />
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredWorkflows}
          loading={loading}
          pagination={false}
        />
      </Card>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingWorkflow ? '编辑审批流程' : '新建审批流程'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="流程名称" rules={[{ required: true, message: '请输入流程名称' }]}>
            <Input placeholder="例如：费用审批流程" />
          </Form.Item>
          <Form.Item name="code" label="流程编码" rules={[{ required: true, message: '请输入流程编码' }]}>
            <Input placeholder="例如：FEE_APPROVE（英文大写+下划线）" />
          </Form.Item>
          <Form.Item name="businessType" label="业务类型" rules={[{ required: true, message: '请选择业务类型' }]}>
            <Select placeholder="选择关联的业务类型">
              {BUSINESS_TYPES.map(t => (
                <Option key={t.value} value={t.value}>{t.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="流程说明">
            <TextArea rows={3} placeholder="描述该审批流程的用途和规则" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
