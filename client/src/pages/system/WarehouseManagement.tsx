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
  Switch,
  message,
  Popconfirm,
  Tag,
  Row,
  Col,
  Statistic,
  Badge,
  InputNumber,
  theme
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
  GlobalOutlined,
  SwapOutlined,
  BankOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { warehouseManagementApi, systemApi } from '../../api';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../components/ListPageToolbar';

const { Option } = Select;
const { TextArea } = Input;

// ========== 类型定义 ==========

type WarehouseType = 'ORIGIN' | 'DESTINATION' | 'TRANSIT';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  type: WarehouseType;
  country: string;
  city: string;
  siteId?: string;
  siteName?: string;
  siteType?: 'HQ' | 'DISPATCH_CENTER' | 'SATELLITE';
  address?: string;
  managerId?: string;
  managerName?: string;
  managerPhone?: string;
  capacity?: number;
  status: 'ACTIVE' | 'INACTIVE';
  remark?: string;
  createdAt: string;
  updatedAt?: string;
}

interface SiteOption {
  id: string;
  siteName: string;
  countryName: string;
  cityName: string;
  siteType: 'HQ' | 'DISPATCH_CENTER' | 'SATELLITE';
}

// ========== 常量映射 ==========

const WAREHOUSE_TYPE_MAP: Record<WarehouseType, { label: string; color: string }> = {
  ORIGIN: { label: '起运国', color: 'blue' },
  DESTINATION: { label: '到达国', color: 'green' },
  TRANSIT: { label: '中转', color: 'orange' },
};

// ========== 主组件 ==========

export const WarehouseManagement: React.FC<{ defaultType?: string }> = ({ defaultType }) => {
  const { token } = theme.useToken();

  // 数据状态
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(false);

  // 筛选状态
  const [filterType, setFilterType] = useState<string | undefined>(defaultType);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterCountry, setFilterCountry] = useState<string | undefined>(undefined);
  const [filterSiteId, setFilterSiteId] = useState<string | undefined>(undefined);

  // Modal 状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const [form] = Form.useForm();

  // ========== 数据加载 ==========

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterCountry) params.country = filterCountry;
      if (filterSiteId) params.siteId = filterSiteId;

      const res: any = await warehouseManagementApi.list(params);
      setWarehouses(res.data || res || []);
    } catch (e: any) {
      message.error(e.message || '获取仓库列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSites = async () => {
    try {
      const res: any = await systemApi.listSites({ status: 'ACTIVE' });
      setSites(res.data || res || []);
    } catch (e: any) {
      message.warning(e.message || '站点列表加载失败');
    }
  };

  useEffect(() => {
    fetchData();
    loadSites();
  }, []);

  // ========== 统计数据 ==========

  const stats = useMemo(() => {
    const total = warehouses.length;
    const origin = warehouses.filter(w => w.type === 'ORIGIN').length;
    const destination = warehouses.filter(w => w.type === 'DESTINATION').length;
    const transit = warehouses.filter(w => w.type === 'TRANSIT').length;
    return { total, origin, destination, transit };
  }, [warehouses]);

  // ========== 国家选项（从数据中提取） ==========

  const countryOptions = useMemo(() => {
    const countries = Array.from(new Set(warehouses.map(w => w.country).filter(Boolean)));
    return countries.sort();
  }, [warehouses]);

  // ========== 操作方法 ==========

  const handleSearch = () => {
    fetchData();
  };

  const handleReset = () => {
    setFilterType(undefined);
    setFilterStatus(undefined);
    setFilterCountry(undefined);
    setFilterSiteId(undefined);
    // 重置后重新加载全部数据
    setLoading(true);
    warehouseManagementApi.list({}).then((res: any) => {
      setWarehouses(res.data || res || []);
    }).catch((e: any) => {
      message.error(e.message || '获取数据失败');
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleAdd = () => {
    setEditingWarehouse(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Warehouse) => {
    setEditingWarehouse(record);
    form.setFieldsValue({
      ...record,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingWarehouse) {
        await warehouseManagementApi.update(editingWarehouse.id, values);
        message.success('仓库信息已更新');
      } else {
        await warehouseManagementApi.create(values);
        message.success('仓库已创建');
      }

      setModalVisible(false);
      fetchData();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证失败，不需要额外提示
        return;
      }
      message.error(error.message || '操作失败');
    }
  };

  const handleDelete = async (record: Warehouse) => {
    try {
      await warehouseManagementApi.delete(record.id);
      message.success('仓库已删除');
      fetchData();
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const handleStatusChange = async (record: Warehouse, checked: boolean) => {
    try {
      const newStatus = checked ? 'ACTIVE' : 'INACTIVE';
      await warehouseManagementApi.update(record.id, { status: newStatus });
      message.success(`仓库已${checked ? '启用' : '停用'}`);
      fetchData();
    } catch (e: any) {
      message.error(e.message || '状态切换失败');
    }
  };

  // ========== 表格列定义 ==========

  const columns: ColumnsType<Warehouse> = [
    {
      title: '仓库编码',
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
    },
    {
      title: '仓库名称',
      dataIndex: 'name',
      width: 180,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (type: WarehouseType) => {
        const config = WAREHOUSE_TYPE_MAP[type];
        return config ? <Tag color={config.color}>{config.label}</Tag> : type;
      },
    },
    {
      title: '国家/城市',
      width: 150,
      render: (_, record) => (
        <span>{record.country}{record.city ? ` / ${record.city}` : ''}</span>
      ),
    },
    {
      title: '所属站点',
      width: 160,
      render: (_, record) => record.siteName || '-',
    },
    {
      title: '负责人',
      width: 140,
      render: (_, record) => (
        <span>
          {record.managerName || '-'}
          {record.managerPhone ? ` (${record.managerPhone})` : ''}
        </span>
      ),
    },
    {
      title: '容量',
      dataIndex: 'capacity',
      width: 100,
      render: (val?: number) => val ? `${val} m³` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string, record: Warehouse) => (
        <Switch
          checked={status === 'ACTIVE'}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={(checked) => handleStatusChange(record, checked)}
        />
      ),
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
            description={`确定要删除仓库「${record.name}」吗？`}
            onConfirm={() => handleDelete(record)}
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
      ),
    },
  ];

  // ========== 渲染 ==========

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="总仓库数"
              value={stats.total}
              prefix={<BankOutlined style={{ color: token.colorPrimary }} />}
              valueStyle={{ color: token.colorPrimary }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="起运国仓库"
              value={stats.origin}
              prefix={<HomeOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="到达国仓库"
              value={stats.destination}
              prefix={<GlobalOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="中转仓库"
              value={stats.transit}
              prefix={<SwapOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选区域 */}
      <ListPageToolbarCard bordered={false}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField minWidth={150}>
              <Select
                placeholder="仓库类型"
                value={filterType}
                onChange={(val) => setFilterType(val)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="ORIGIN">起运国</Option>
                <Option value="DESTINATION">到达国</Option>
                <Option value="TRANSIT">中转</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={120}>
              <Select
                placeholder="状态"
                value={filterStatus}
                onChange={(val) => setFilterStatus(val)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="ACTIVE">启用</Option>
                <Option value="INACTIVE">停用</Option>
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={150}>
              <Select
                placeholder="国家"
                value={filterCountry}
                onChange={(val) => setFilterCountry(val)}
                allowClear
                style={{ width: '100%' }}
              >
                {countryOptions.map(c => (
                  <Option key={c} value={c}>{c}</Option>
                ))}
              </Select>
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={180}>
              <Select
                placeholder="站点"
                value={filterSiteId}
                onChange={(val) => setFilterSiteId(val)}
                allowClear
                style={{ width: '100%' }}
                options={sites.map((s) => ({ value: s.id, label: `${s.siteName} (${s.cityName})` }))}
              />
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新建仓库
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      {/* 数据表格 */}
      <Card
        bordered={false}
        title="仓库列表"
      >
        <Table
          columns={columns}
          dataSource={warehouses}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* 创建/编辑 Modal */}
      <Modal
        title={editingWarehouse ? '编辑仓库' : '新建仓库'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={700}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="code"
                label="仓库编码"
                rules={[{ required: true, message: '请输入仓库编码' }]}
              >
                <Input
                  placeholder="如：WH-CN-SZ01"
                  disabled={!!editingWarehouse}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="name"
                label="仓库名称"
                rules={[{ required: true, message: '请输入仓库名称' }]}
              >
                <Input placeholder="如：深圳总仓" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="nameEn" label="英文名称">
                <Input placeholder="如：Shenzhen Main WH" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name="type"
                label="仓库类型"
                rules={[{ required: true, message: '请选择仓库类型' }]}
              >
                <Select placeholder="请选择类型">
                  <Option value="ORIGIN">起运国</Option>
                  <Option value="DESTINATION">到达国</Option>
                  <Option value="TRANSIT">中转</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="siteId"
                label="所属站点"
              >
                <Select
                  placeholder="可选，选择后自动回填国家/城市"
                  allowClear
                  options={sites.map((s) => ({ value: s.id, label: `${s.siteName} (${s.cityName})` }))}
                  onChange={(value) => {
                    const selectedSite = sites.find((s) => s.id === value);
                    if (selectedSite) {
                      form.setFieldsValue({
                        country: selectedSite.countryName,
                        city: selectedSite.cityName,
                      });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="country"
                label="国家"
                rules={[{ required: true, message: '请输入国家' }]}
              >
                <Input placeholder="如：中国" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="city"
                label="城市"
                rules={[{ required: true, message: '请输入城市' }]}
              >
                <Input placeholder="如：深圳" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="address" label="详细地址">
                <Input placeholder="请输入仓库详细地址" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginBottom: 16, marginTop: 8, fontWeight: 'bold', fontSize: 14 }}>
            负责人信息
          </div>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="managerName" label="负责人姓名">
                <Input placeholder="请输入负责人姓名" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="managerPhone" label="负责人电话">
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="capacity" label="仓库容量 (m³)">
                <InputNumber
                  placeholder="请输入容量"
                  min={0}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="输入备注信息..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
