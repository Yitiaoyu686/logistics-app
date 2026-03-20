import React, { useState } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Tag,
  message, DatePicker, Checkbox
} from 'antd';
import {
  PlusOutlined, CheckOutlined, DeleteOutlined, EditOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

// 待办事项类型定义
type TodoPriority = 'HIGH' | 'MEDIUM' | 'LOW';
type TodoStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

interface TodoItem {
  id: string;
  title: string;
  description?: string;
  priority: TodoPriority;
  status: TodoStatus;
  dueDate?: string;
  relatedType?: 'ORDER' | 'JOB' | 'FEE' | 'CUSTOMER';
  relatedId?: string;
  relatedNo?: string;
  assignee?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  completedAt?: string;
}

// 优先级配置
const PRIORITY_CONFIG: Record<TodoPriority, { label: string; color: string }> = {
  HIGH: { label: '高', color: 'red' },
  MEDIUM: { label: '中', color: 'orange' },
  LOW: { label: '低', color: 'blue' },
};

// 状态配置
const STATUS_CONFIG: Record<TodoStatus, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'default' },
  IN_PROGRESS: { label: '处理中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
};


export const TodoList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [form] = Form.useForm();

  // 表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: TodoPriority) => (
        <Tag color={PRIORITY_CONFIG[priority].color}>
          {PRIORITY_CONFIG[priority].label}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TodoStatus) => (
        <Tag color={STATUS_CONFIG[status].color}>
          {STATUS_CONFIG[status].label}
        </Tag>
      ),
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string) => {
        if (!date) return '-';
        const isOverdue = dayjs(date).isBefore(dayjs(), 'day');
        return (
          <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
            {date}
            {isOverdue && <ExclamationCircleOutlined style={{ marginLeft: 4 }} />}
          </span>
        );
      },
    },
    {
      title: '关联单号',
      dataIndex: 'relatedNo',
      key: 'relatedNo',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      key: 'createdByName',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (record: TodoItem) => (
        <Space size="small">
          {record.status !== 'COMPLETED' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleComplete(record.id)}
            >
              完成
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedTodo(record);
              form.setFieldsValue({
                ...record,
                dueDate: record.dueDate ? dayjs(record.dueDate) : undefined,
              });
              setEditModalVisible(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // 完成待办
  const handleComplete = async (id: string) => {
    try {
      setLoading(true);
      // TODO: 调用完成 API
      // await axios.post(`/api/todos/${id}/complete`);

      setTodos(todos.map(todo =>
        todo.id === id
          ? { ...todo, status: 'COMPLETED' as TodoStatus, completedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
          : todo
      ));
      message.success('待办已完成');
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除待办
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条待办事项吗？',
      onOk: async () => {
        try {
          setLoading(true);
          // TODO: 调用删除 API
          // await axios.delete(`/api/todos/${id}`);

          setTodos(todos.filter(todo => todo.id !== id));
          message.success('删除成功');
        } catch (error) {
          message.error('删除失败');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 创建待办
  const handleCreate = async (values: any) => {
    try {
      setLoading(true);
      // TODO: 调用创建 API
      // const response = await axios.post('/api/todos', values);

      const newTodo: TodoItem = {
        id: `TODO${String(todos.length + 1).padStart(3, '0')}`,
        ...values,
        dueDate: values.dueDate ? dayjs(values.dueDate).format('YYYY-MM-DD') : undefined,
        status: 'PENDING' as TodoStatus,
        createdBy: 'CURRENT_USER',
        createdByName: '当前用户',
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      };

      setTodos([newTodo, ...todos]);
      message.success('创建成功');
      setCreateModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 编辑待办
  const handleEdit = async (values: any) => {
    try {
      setLoading(true);
      // TODO: 调用更新 API
      // await axios.put(`/api/todos/${selectedTodo?.id}`, values);

      setTodos(todos.map(todo =>
        todo.id === selectedTodo?.id
          ? {
              ...todo,
              ...values,
              dueDate: values.dueDate ? dayjs(values.dueDate).format('YYYY-MM-DD') : undefined,
            }
          : todo
      ));
      message.success('更新成功');
      setEditModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建待办
          </Button>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={todos}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 创建待办弹窗 */}
      <Modal
        title="新建待办"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入待办标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入详细描述" />
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select placeholder="请选择优先级">
              <Option value="HIGH">高</Option>
              <Option value="MEDIUM">中</Option>
              <Option value="LOW">低</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="dueDate"
            label="截止日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="relatedType"
            label="关联类型"
          >
            <Select placeholder="请选择关联类型" allowClear>
              <Option value="ORDER">订单</Option>
              <Option value="JOB">任务</Option>
              <Option value="FEE">费用</Option>
              <Option value="CUSTOMER">客户</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="relatedNo"
            label="关联单号"
          >
            <Input placeholder="请输入关联单号" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑待办弹窗 */}
      <Modal
        title="编辑待办"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEdit}
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入待办标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入详细描述" />
          </Form.Item>

          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select placeholder="请选择优先级">
              <Option value="HIGH">高</Option>
              <Option value="MEDIUM">中</Option>
              <Option value="LOW">低</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="PENDING">待处理</Option>
              <Option value="IN_PROGRESS">处理中</Option>
              <Option value="COMPLETED">已完成</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="dueDate"
            label="截止日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="relatedType"
            label="关联类型"
          >
            <Select placeholder="请选择关联类型" allowClear>
              <Option value="ORDER">订单</Option>
              <Option value="JOB">任务</Option>
              <Option value="FEE">费用</Option>
              <Option value="CUSTOMER">客户</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="relatedNo"
            label="关联单号"
          >
            <Input placeholder="请输入关联单号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
