import React, { useState, useMemo, useEffect } from 'react';
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
  InputNumber,
  Select,
  Tag
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { systemApi } from '../../api';

const { Option } = Select;
const { TextArea } = Input;

// ========== 类型定义 ==========

type TransportType = 'SEA' | 'AIR';

interface Route {
  id: string;
  originCountry: string;
  originCity: string;
  destCountry: string;
  destCity: string;
  transportType: TransportType;
  freightDiscount: number;       // 运费折扣
  volumeRatio: number;           // 体积比
  firstWeightValue: number;      // 首重值
  firstWeightCOD_USD: number;    // 首重到付(USD)
  firstWeightPrepaid_RMB: number; // 首重预付(RMB)
  arrivalStation: string;        // 到达站点
  remark?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}


// ========== 主组件 ==========

export const RouteManagement: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDest, setSearchDest] = useState('');
  const [searchTransportType, setSearchTransportType] = useState<TransportType | 'ALL'>('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  const [form] = Form.useForm();

  const normalizeDateTime = (value?: string) => {
    if (!value) return new Date().toISOString().replace('T', ' ').slice(0, 19);
    return value.replace('T', ' ').slice(0, 19);
  };

  const loadRoutes = async (withLoading = true) => {
    if (withLoading) setLoading(true);
    try {
      const params = searchTransportType === 'ALL' ? undefined : { transportType: searchTransportType };
      const res = await systemApi.routes(params);
      const rows = (res.data || res || []) as any[];
      setRoutes(rows.map((row) => ({
        ...row,
        updatedAt: normalizeDateTime(row.updatedAt || row.createdAt),
        createdAt: normalizeDateTime(row.createdAt),
      })));
    } catch (e) {
      message.error('获取数据失败');
    } finally {
      if (withLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, [searchTransportType]);

  // 搜索过滤
  const filteredRoutes = useMemo(() => {
    return routes.filter(r => {
      const matchOrigin = !searchOrigin ||
        r.originCity.includes(searchOrigin) ||
        r.originCountry.includes(searchOrigin);

      const matchDest = !searchDest ||
        r.destCity.includes(searchDest) ||
        r.destCountry.includes(searchDest);

      const matchTransport = searchTransportType === 'ALL' || r.transportType === searchTransportType;

      return matchOrigin && matchDest && matchTransport;
    });
  }, [routes, searchOrigin, searchDest, searchTransportType]);

  // 打开新建弹窗
  const handleAdd = () => {
    setEditingRoute(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: Route) => {
    setEditingRoute(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // 保存线路
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingRoute) {
        await systemApi.updateRoute(editingRoute.id, values);
        message.success('线路信息已更新');
      } else {
        await systemApi.createRoute(values);
        message.success('线路已添加');
      }

      setModalVisible(false);
      await loadRoutes(false);
    } catch (error) {
      message.error((error as Error)?.message || '保存失败');
    }
  };

  // 删除线路
  const handleDelete = async (id: string) => {
    try {
      await systemApi.deleteRoute(id);
      message.success('线路已删除');
      await loadRoutes(false);
    } catch (error) {
      message.error((error as Error)?.message || '删除失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<Route> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: '起运国城市',
      dataIndex: 'originCity',
      width: 120,
      render: (text: string, record: Route) => (
        <div>
          <div>{record.originCountry}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{text}</div>
        </div>
      )
    },
    {
      title: '到达国城市',
      dataIndex: 'destCity',
      width: 200,
      render: (text: string, record: Route) => (
        <div>
          <div>{record.destCountry}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{text}</div>
        </div>
      )
    },
    {
      title: '运输方式',
      dataIndex: 'transportType',
      width: 100,
      render: (type: TransportType) => (
        <Tag color={type === 'SEA' ? 'blue' : 'cyan'}>
          {type === 'SEA' ? '海运' : '空运'}
        </Tag>
      )
    },
    {
      title: '运费折扣',
      dataIndex: 'freightDiscount',
      width: 100,
      align: 'right'
    },
    {
      title: '体积比',
      dataIndex: 'volumeRatio',
      width: 100,
      align: 'right'
    },
    {
      title: '首重值',
      dataIndex: 'firstWeightValue',
      width: 80,
      align: 'right'
    },
    {
      title: '首重到付(USD)',
      dataIndex: 'firstWeightCOD_USD',
      width: 130,
      align: 'right',
      render: (value: number) => value?.toFixed(2)
    },
    {
      title: '首重预付(RMB)',
      dataIndex: 'firstWeightPrepaid_RMB',
      width: 130,
      align: 'right',
      render: (value: number) => value?.toFixed(2)
    },
    {
      title: '到达站点',
      dataIndex: 'arrivalStation',
      width: 150
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
      width: 100,
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
            description={`确定要删除线路「${record.originCity} → ${record.destCity}」吗？`}
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
            placeholder="起点位置"
            value={searchOrigin}
            onChange={(e) => setSearchOrigin(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Input
            placeholder="终点位置"
            value={searchDest}
            onChange={(e) => setSearchDest(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            value={searchTransportType}
            onChange={(value) => setSearchTransportType(value)}
            style={{ width: 140 }}
            options={[
              { value: 'ALL', label: '全部业务' },
              { value: 'SEA', label: '海运' },
              { value: 'AIR', label: '空运' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} style={{ background: '#52c41a', borderColor: '#52c41a' }}>
            查询
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加路线
          </Button>
        </Space>
      </Card>

      {/* 线路列表表格 */}
      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredRoutes}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 1500 }}
        />
      </Card>

      {/* 新建/编辑线路弹窗 */}
      <Modal
        title={editingRoute ? '编辑线路' : '添加线路'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="originCountry"
                label="起运国"
                rules={[{ required: true, message: '请输入起运国' }]}
              >
                <Input placeholder="如：中国" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="originCity"
                label="起运城市"
                rules={[{ required: true, message: '请输入起运城市' }]}
              >
                <Input placeholder="如：广州" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="destCountry"
                label="目的国"
                rules={[{ required: true, message: '请输入目的国' }]}
              >
                <Input placeholder="如：尼日利亚" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="destCity"
                label="目的城市"
                rules={[{ required: true, message: '请输入目的城市' }]}
              >
                <Input placeholder="如：阿布贾" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="transportType"
                label="运输方式"
                rules={[{ required: true, message: '请选择运输方式' }]}
              >
                <Select placeholder="请选择">
                  <Option value="SEA">海运</Option>
                  <Option value="AIR">空运</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="freightDiscount"
                label="运费折扣"
                rules={[{ required: true, message: '请输入运费折扣' }]}
              >
                <InputNumber placeholder="100" style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="volumeRatio"
                label="体积比"
                rules={[{ required: true, message: '请输入体积比' }]}
              >
                <InputNumber placeholder="6000" style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="firstWeightValue"
                label="首重值"
                rules={[{ required: true, message: '请输入首重值' }]}
              >
                <InputNumber placeholder="1" style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="firstWeightCOD_USD"
                label="首重到付(USD)"
                rules={[{ required: true, message: '请输入首重到付(USD)' }]}
              >
                <InputNumber placeholder="10.00" style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="firstWeightPrepaid_RMB"
                label="首重预付(RMB)"
                rules={[{ required: true, message: '请输入首重预付(RMB)' }]}
              >
                <InputNumber placeholder="70.00" style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="arrivalStation"
                label="到达站点"
                rules={[{ required: true, message: '请输入到达站点' }]}
              >
                <Input placeholder="如：LAGOS Station" />
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
