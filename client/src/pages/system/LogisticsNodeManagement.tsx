import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Tag,
  Drawer,
  List,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { systemApi } from '../../api';

const { Option } = Select;
const { TextArea } = Input;

type NodeType =
  | 'PICKUP'
  | 'WAREHOUSE_IN'
  | 'CUSTOMS_EXPORT'
  | 'DEPARTURE'
  | 'IN_TRANSIT'
  | 'ARRIVAL'
  | 'CUSTOMS_IMPORT'
  | 'WAREHOUSE_OUT'
  | 'DELIVERY'
  | 'SIGNED';

interface LogisticsNode {
  id: string;
  routeId: string;
  nodeCode: string;
  nodeName: string;
  nodeNameEn?: string;
  nodeType: NodeType;
  sortOrder: number;
  isRequired: boolean;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

interface RouteRow {
  id: string;
  originCountry: string;
  originCity: string;
  destCountry: string;
  destCity: string;
  transportType: 'SEA' | 'AIR';
  transitDays?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
}

const NODE_TYPE_CONFIG: Record<NodeType, { text: string; color: string }> = {
  PICKUP: { text: '揽收', color: 'blue' },
  WAREHOUSE_IN: { text: '入库', color: 'cyan' },
  CUSTOMS_EXPORT: { text: '出口报关', color: 'orange' },
  DEPARTURE: { text: '起运', color: 'purple' },
  IN_TRANSIT: { text: '运输中', color: 'geekblue' },
  ARRIVAL: { text: '到达', color: 'green' },
  CUSTOMS_IMPORT: { text: '进口清关', color: 'gold' },
  WAREHOUSE_OUT: { text: '出库', color: 'lime' },
  DELIVERY: { text: '派送', color: 'volcano' },
  SIGNED: { text: '签收', color: 'success' },
};

export const LogisticsNodeManagement: React.FC = () => {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [nodeCountMap, setNodeCountMap] = useState<Record<string, number>>({});

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteRow | null>(null);
  const [nodes, setNodes] = useState<LogisticsNode[]>([]);
  const [loadingNodes, setLoadingNodes] = useState(false);

  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<LogisticsNode | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteRow | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterTransport, setFilterTransport] = useState<string | undefined>(undefined);

  const [routeForm] = Form.useForm();
  const [nodeForm] = Form.useForm();

  const routeOptions = useMemo(
    () =>
      routes.map((r) => ({
        value: r.id,
        label: `${r.originCity}→${r.destCity} (${r.transportType === 'SEA' ? '海运' : '空运'})`,
      })),
    [routes]
  );

  const loadRoutes = async () => {
    setLoadingRoutes(true);
    try {
      const res: any = await systemApi.routes();
      const list = (res?.data || res || []) as RouteRow[];
      setRoutes(list);
    } catch (err: any) {
      message.error(err.message || '加载路线失败');
    } finally {
      setLoadingRoutes(false);
    }
  };

  const loadNodeCounts = async () => {
    try {
      const res: any = await systemApi.listLogisticsNodes();
      const list = (res?.data || res || []) as LogisticsNode[];
      const next: Record<string, number> = {};
      list.forEach((item) => {
        next[item.routeId] = (next[item.routeId] || 0) + 1;
      });
      setNodeCountMap(next);
    } catch (err: any) {
      message.error(err.message || '加载环节数量失败');
    }
  };

  const loadNodesByRoute = async (routeId: string) => {
    setLoadingNodes(true);
    try {
      const res: any = await systemApi.listLogisticsNodes({ routeId });
      const list = (res?.data || res || []) as LogisticsNode[];
      setNodes(list.sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err: any) {
      message.error(err.message || '加载环节失败');
      setNodes([]);
    } finally {
      setLoadingNodes(false);
    }
  };

  useEffect(() => {
    loadRoutes();
    loadNodeCounts();
  }, []);

  const handleOpenRouteModal = (route?: RouteRow) => {
    if (route) {
      setEditingRoute(route);
      routeForm.setFieldsValue({
        originCountry: route.originCountry,
        originCity: route.originCity,
        destCountry: route.destCountry,
        destCity: route.destCity,
        transportType: route.transportType,
        status: route.status,
      });
    } else {
      setEditingRoute(null);
      routeForm.resetFields();
      routeForm.setFieldsValue({ transportType: 'SEA', status: 'ACTIVE' });
    }
    setRouteModalVisible(true);
  };

  const handleSaveRoute = async () => {
    try {
      const values = await routeForm.validateFields();
      if (editingRoute) {
        await systemApi.updateRoute(editingRoute.id, values);
        message.success('路线已更新');
      } else {
        await systemApi.createRoute(values);
        message.success('路线已创建');
      }
      setRouteModalVisible(false);
      setEditingRoute(null);
      await loadRoutes();
    } catch (err: any) {
      message.error(err.message || '保存路线失败');
    }
  };

  const handleDeleteRoute = (route: RouteRow) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除路线 ${route.originCity}→${route.destCity} 吗？`,
      onOk: async () => {
        try {
          await systemApi.deleteRoute(route.id);
          message.success('路线删除成功');
          await loadRoutes();
          await loadNodeCounts();
        } catch (err: any) {
          message.error(err.message || '删除路线失败');
        }
      },
    });
  };

  const handleOpenDrawer = async (route: RouteRow) => {
    setSelectedRoute(route);
    setDrawerVisible(true);
    await loadNodesByRoute(route.id);
  };

  const handleOpenNodeModal = (node?: LogisticsNode) => {
    if (!selectedRoute) return;

    if (node) {
      setEditingNode(node);
      nodeForm.setFieldsValue(node);
    } else {
      setEditingNode(null);
      const maxOrder = nodes.length > 0 ? Math.max(...nodes.map((n) => n.sortOrder)) : 0;
      nodeForm.resetFields();
      nodeForm.setFieldsValue({
        routeId: selectedRoute.id,
        isRequired: true,
        sortOrder: maxOrder + 1,
        status: 'ACTIVE',
      });
    }
    setNodeModalVisible(true);
  };

  const handleNodeSubmit = async () => {
    if (!selectedRoute) return;

    try {
      const values = await nodeForm.validateFields();
      const payload = { ...values, routeId: selectedRoute.id };

      if (editingNode) {
        await systemApi.updateLogisticsNode(editingNode.id, payload);
        message.success('环节更新成功');
      } else {
        await systemApi.createLogisticsNode(payload);
        message.success('环节新增成功');
      }

      setNodeModalVisible(false);
      setEditingNode(null);
      nodeForm.resetFields();
      await loadNodesByRoute(selectedRoute.id);
      await loadNodeCounts();
    } catch (err: any) {
      message.error(err.message || '保存环节失败');
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!selectedRoute) return;
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该物流环节吗？',
      onOk: async () => {
        try {
          await systemApi.deleteLogisticsNode(nodeId);
          message.success('环节删除成功');
          await loadNodesByRoute(selectedRoute.id);
          await loadNodeCounts();
        } catch (err: any) {
          message.error(err.message || '删除环节失败');
        }
      },
    });
  };

  const handleMove = async (fromIndex: number, toIndex: number) => {
    if (!selectedRoute) return;
    if (toIndex < 0 || toIndex >= nodes.length) return;

    const fromNode = nodes[fromIndex];
    const toNode = nodes[toIndex];
    if (!fromNode || !toNode) return;

    try {
      await Promise.all([
        systemApi.updateLogisticsNode(fromNode.id, { sortOrder: toNode.sortOrder }),
        systemApi.updateLogisticsNode(toNode.id, { sortOrder: fromNode.sortOrder }),
      ]);
      await loadNodesByRoute(selectedRoute.id);
      await loadNodeCounts();
    } catch (err: any) {
      message.error(err.message || '移动环节失败');
    }
  };

  const routeColumns = [
    {
      title: '路线编号',
      key: 'routeCode',
      width: 180,
      render: (_: any, record: RouteRow) => record.id,
    },
    {
      title: '路线',
      key: 'routeName',
      width: 260,
      render: (_: any, record: RouteRow) => (
        <div>
          <div>{record.originCity} → {record.destCity}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.originCountry} → {record.destCountry}</div>
        </div>
      ),
    },
    {
      title: '运输方式',
      dataIndex: 'transportType',
      width: 100,
      render: (mode: 'SEA' | 'AIR') => (
        <Tag color={mode === 'SEA' ? 'blue' : 'orange'}>
          {mode === 'SEA' ? '海运' : '空运'}
        </Tag>
      ),
    },
    {
      title: '物流环节数',
      key: 'nodeCount',
      width: 120,
      render: (_: any, record: RouteRow) => <Tag color="blue">{nodeCountMap[record.id] || 0} 个</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>{status === 'ACTIVE' ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: any, record: RouteRow) => (
        <Space size="small">
          <Button type="primary" size="small" icon={<SettingOutlined />} onClick={() => handleOpenDrawer(record)}>
            配置环节
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenRouteModal(record)}>
            编辑
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteRoute(record)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const filteredRoutes = routes.filter((route) => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (keyword && !route.originCity.toLowerCase().includes(keyword) && !route.destCity.toLowerCase().includes(keyword) && !route.originCountry.toLowerCase().includes(keyword) && !route.destCountry.toLowerCase().includes(keyword)) {
      return false;
    }
    if (filterTransport && route.transportType !== filterTransport) return false;
    return true;
  });

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="物流环节管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenRouteModal()}>
            新增路线
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="起运/到达城市"
            allowClear
            style={{ width: 200 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <Select
            placeholder="运输方式"
            allowClear
            style={{ width: 130 }}
            value={filterTransport}
            onChange={(v) => setFilterTransport(v)}
            options={[
              { value: 'SEA', label: '海运' },
              { value: 'AIR', label: '空运' },
            ]}
          />
        </Space>
        <Table
          columns={routeColumns}
          dataSource={filteredRoutes}
          rowKey="id"
          loading={loadingRoutes}
          scroll={{ x: 920 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条路线`,
          }}
        />
      </Card>

      <Drawer
        title={`配置环节 - ${selectedRoute ? `${selectedRoute.originCity}→${selectedRoute.destCity}` : ''}`}
        placement="right"
        width={760}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedRoute(null);
          setNodes([]);
        }}
        extra={
          <Space>
            <Select
              style={{ width: 280 }}
              placeholder="切换路线"
              value={selectedRoute?.id}
              options={routeOptions}
              onChange={(routeId) => {
                const route = routes.find((r) => r.id === routeId);
                if (!route) return;
                setSelectedRoute(route);
                loadNodesByRoute(route.id);
              }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenNodeModal()}>
              新增环节
            </Button>
          </Space>
        }
      >
        <List
          loading={loadingNodes}
          dataSource={nodes}
          locale={{ emptyText: '该路线暂无物流环节，请点击右上角“新增环节”' }}
          renderItem={(node, index) => (
            <List.Item
              key={node.id}
              actions={[
                <Button
                  type="link"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={index === 0}
                  onClick={() => handleMove(index, index - 1)}
                >
                  上移
                </Button>,
                <Button
                  type="link"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={index === nodes.length - 1}
                  onClick={() => handleMove(index, index + 1)}
                >
                  下移
                </Button>,
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenNodeModal(node)}>
                  编辑
                </Button>,
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteNode(node.id)}>
                  删除
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color="blue">{node.sortOrder}</Tag>
                    <span style={{ fontWeight: 600 }}>{node.nodeName}</span>
                    {node.nodeNameEn ? <span style={{ color: '#999', fontSize: 12 }}>({node.nodeNameEn})</span> : null}
                    <Tag color={NODE_TYPE_CONFIG[node.nodeType].color}>{NODE_TYPE_CONFIG[node.nodeType].text}</Tag>
                    <Tag color={node.isRequired ? 'success' : 'default'}>{node.isRequired ? '必填' : '选填'}</Tag>
                  </Space>
                }
                description={
                  <div>
                    <div>编码: {node.nodeCode}</div>
                    {node.description ? <div style={{ marginTop: 4, color: '#666' }}>{node.description}</div> : null}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>

      <Modal
        title={editingRoute ? '编辑路线' : '新增路线'}
        open={routeModalVisible}
        onOk={handleSaveRoute}
        onCancel={() => { setRouteModalVisible(false); setEditingRoute(null); }}
        width={700}
      >
        <Form form={routeForm} layout="vertical">
          <Form.Item name="originCountry" label="起运国" rules={[{ required: true, message: '请输入起运国' }]}>
            <Input placeholder="如：中国" />
          </Form.Item>
          <Form.Item name="originCity" label="起运城市" rules={[{ required: true, message: '请输入起运城市' }]}>
            <Input placeholder="如：广州" />
          </Form.Item>
          <Form.Item name="destCountry" label="到达国" rules={[{ required: true, message: '请输入到达国' }]}>
            <Input placeholder="如：尼日利亚" />
          </Form.Item>
          <Form.Item name="destCity" label="到达城市" rules={[{ required: true, message: '请输入到达城市' }]}>
            <Input placeholder="如：拉各斯" />
          </Form.Item>
          <Form.Item name="transportType" label="运输方式" rules={[{ required: true, message: '请选择运输方式' }]}>
            <Select>
              <Option value="SEA">海运</Option>
              <Option value="AIR">空运</Option>
            </Select>
          </Form.Item>
          <Form.Item name="transitDays" label="时效说明">
            <Input placeholder="如：25-35天" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">启用</Option>
              <Option value="INACTIVE">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingNode ? '编辑环节' : '新增环节'}
        open={nodeModalVisible}
        onOk={handleNodeSubmit}
        onCancel={() => {
          setNodeModalVisible(false);
          nodeForm.resetFields();
          setEditingNode(null);
        }}
        width={600}
      >
        <Form form={nodeForm} layout="vertical">
          <Form.Item name="nodeCode" label="环节编码" rules={[{ required: true, message: '请输入环节编码' }]}>
            <Input placeholder="如: PICKUP" />
          </Form.Item>
          <Form.Item name="nodeName" label="环节名称" rules={[{ required: true, message: '请输入环节名称' }]}>
            <Input placeholder="如: 揽收" />
          </Form.Item>
          <Form.Item name="nodeNameEn" label="英文名称">
            <Input placeholder="如: Pickup" />
          </Form.Item>
          <Form.Item name="nodeType" label="环节类型" rules={[{ required: true, message: '请选择环节类型' }]}>
            <Select placeholder="请选择环节类型">
              {Object.entries(NODE_TYPE_CONFIG).map(([key, config]) => (
                <Option key={key} value={key}>
                  <Tag color={config.color}>{config.text}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" rules={[{ required: true, message: '请输入排序号' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isRequired" label="是否必填" rules={[{ required: true, message: '请选择' }]}>
            <Select>
              <Option value={true}>必填</Option>
              <Option value={false}>选填</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">启用</Option>
              <Option value="INACTIVE">停用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入环节描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
