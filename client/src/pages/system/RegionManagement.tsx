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
  Upload,
  message,
  Popconfirm,
  Tag,
  Image,
  Row,
  Col,
  InputNumber,
  Typography
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { systemApi } from '../../api';

const { Option } = Select;
const { Text } = Typography;

// ========== 类型定义 ==========

type Continent = 'ASIA' | 'EUROPE' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'AFRICA' | 'OCEANIA';

interface City {
  id: string;
  countryId: string;
  cityCode: string;
  cityName: string;
  cityNameEn: string;
  provinceState?: string;
  isPort: boolean;
  isAirport: boolean;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

interface Country {
  id: string;
  countryCode: string;
  countryName: string;
  countryNameEn: string;
  continent: Continent;
  phoneCode: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  flagImage?: string;
  countryImage?: string;
  isOrigin: boolean;
  isDestination: boolean;
  requiresMaterial: boolean;
  remark?: string;
  cities?: City[];
  createdAt: string;
  updatedAt: string;
}


const CONTINENT_NAMES: Record<Continent, string> = {
  ASIA: '亚洲',
  EUROPE: '欧洲',
  NORTH_AMERICA: '北美洲',
  SOUTH_AMERICA: '南美洲',
  AFRICA: '非洲',
  OCEANIA: '大洋洲'
};

// ========== 主组件 ==========

export const RegionManagement: React.FC = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');

  const [countryForm] = Form.useForm();
  const [cityForm] = Form.useForm();

  const loadCountries = async () => {
    setLoading(true);
    try {
      const res = await systemApi.listCountries();
      setCountries(res.data || []);
    } catch (err: any) {
      message.error(err.message || '加载国家列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCountries();
  }, []);

  // 搜索过滤
  const filteredCountries = useMemo(() => {
    if (!searchText) return countries;
    return countries.filter(c =>
      c.countryName.includes(searchText) ||
      c.countryNameEn.toLowerCase().includes(searchText.toLowerCase()) ||
      c.countryCode.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [countries, searchText]);

  // 打开新建国家弹窗
  const handleAddCountry = () => {
    setEditingCountry(null);
    countryForm.resetFields();
    countryForm.setFieldsValue({
      isOrigin: false,
      isDestination: false,
      requiresMaterial: false,
      continent: 'ASIA',
    });
    setCountryModalVisible(true);
  };

  // 打开编辑国家弹窗
  const handleEditCountry = (record: Country) => {
    setEditingCountry(record);
    countryForm.setFieldsValue(record);
    setCountryModalVisible(true);
  };

  // 保存国家
  const handleSaveCountry = async () => {
    try {
      const values = await countryForm.validateFields();

      if (editingCountry) {
        await systemApi.updateCountry(editingCountry.id, values);
        message.success('国家信息已更新');
      } else {
        await systemApi.createCountry(values);
        message.success('国家已添加');
      }

      setCountryModalVisible(false);
      await loadCountries();
    } catch (error: any) {
      message.error(error.message || '保存国家失败');
    }
  };

  // 删除国家
  const handleDeleteCountry = async (id: string) => {
    try {
      await systemApi.deleteCountry(id);
      message.success('国家已删除');
      await loadCountries();
    } catch (err: any) {
      message.error(err.message || '删除国家失败');
    }
  };

  // 打开新建城市弹窗
  const handleAddCity = (countryId: string) => {
    setSelectedCountryId(countryId);
    setEditingCity(null);
    cityForm.resetFields();
    setCityModalVisible(true);
  };

  // 打开编辑城市弹窗
  const handleEditCity = (city: City) => {
    setEditingCity(city);
    setSelectedCountryId(city.countryId);
    cityForm.setFieldsValue(city);
    setCityModalVisible(true);
  };

  // 保存城市
  const handleSaveCity = async () => {
    try {
      const values = await cityForm.validateFields();
      if (!selectedCountryId) {
        message.error('未选择国家');
        return;
      }

      if (editingCity) {
        await systemApi.updateCity(selectedCountryId, editingCity.id, values);
      } else {
        await systemApi.createCity(selectedCountryId, values);
      }

      message.success(editingCity ? '城市信息已更新' : '城市已添加');
      setCityModalVisible(false);
      await loadCountries();
    } catch (error: any) {
      message.error(error.message || '保存城市失败');
    }
  };

  // 删除城市
  const handleDeleteCity = async (countryId: string, cityId: string) => {
    try {
      await systemApi.deleteCity(countryId, cityId);
      message.success('城市已删除');
      await loadCountries();
    } catch (err: any) {
      message.error(err.message || '删除城市失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<Country> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: '国家名称',
      dataIndex: 'countryName',
      key: 'countryName',
      width: 150,
      render: (text: string, record: Country) => (
        <Space>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>({record.countryCode})</Text>
        </Space>
      )
    },
    {
      title: '货币名称',
      dataIndex: 'currencyName',
      width: 100
    },
    {
      title: '大洲',
      dataIndex: 'continent',
      width: 100,
      render: (continent: Continent) => (
        <Tag color="blue">{CONTINENT_NAMES[continent]}</Tag>
      )
    },
    {
      title: '国家区号',
      dataIndex: 'phoneCode',
      width: 100
    },
    {
      title: '国家图片',
      dataIndex: 'countryImage',
      width: 100,
      render: (url?: string) => url ? (
        <Image src={url} width={60} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} />
      ) : (
        <Text type="secondary">-</Text>
      )
    },
    {
      title: '国旗',
      dataIndex: 'flagImage',
      width: 80,
      render: (url?: string) => url ? (
        <Image src={url} width={50} height={30} style={{ objectFit: 'cover', borderRadius: 2 }} />
      ) : (
        <Text type="secondary">-</Text>
      )
    },
    {
      title: '货币缩写',
      dataIndex: 'currencyCode',
      width: 100
    },
    {
      title: '货币符号',
      dataIndex: 'currencySymbol',
      width: 100,
      render: (symbol: string) => <Text strong>{symbol}</Text>
    },
    {
      title: '起运',
      dataIndex: 'isOrigin',
      width: 80,
      align: 'center',
      render: (checked: boolean) => (
        <Switch checked={checked} disabled size="small" />
      )
    },
    {
      title: '到达',
      dataIndex: 'isDestination',
      width: 80,
      align: 'center',
      render: (checked: boolean) => (
        <Switch checked={checked} disabled size="small" />
      )
    },
    {
      title: '是否到付',
      dataIndex: 'requiresMaterial',
      width: 100,
      align: 'center',
      render: (checked: boolean) => (
        <Switch checked={checked} disabled size="small" />
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 150,
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditCountry(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EnvironmentOutlined />}
            onClick={() => handleAddCity(record.id)}
          >
            添加城市
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除国家「${record.countryName}」吗？`}
            onConfirm={() => handleDeleteCountry(record.id)}
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

  // 城市表格列定义（嵌套表格）
  const cityColumns: ColumnsType<City> = [
    {
      title: '序号',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: '城市名称',
      dataIndex: 'cityName',
      width: 150,
      render: (text: string, record: City) => (
        <Space>
          <Text>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>({record.cityCode})</Text>
        </Space>
      )
    },
    {
      title: '英文名称',
      dataIndex: 'cityNameEn',
      width: 150
    },
    {
      title: '省份/州',
      dataIndex: 'provinceState',
      width: 120,
      render: (text?: string) => text || '-'
    },
    {
      title: '港口',
      dataIndex: 'isPort',
      width: 80,
      align: 'center',
      render: (checked: boolean) => (
        <Switch checked={checked} disabled size="small" />
      )
    },
    {
      title: '机场',
      dataIndex: 'isAirport',
      width: 80,
      align: 'center',
      render: (checked: boolean) => (
        <Switch checked={checked} disabled size="small" />
      )
    },
    {
      title: '时区',
      dataIndex: 'timezone',
      width: 100,
      render: (text?: string) => text || '-'
    },
    {
      title: '经纬度',
      width: 200,
      render: (_, record) => {
        if (record.latitude && record.longitude) {
          return `${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}`;
        }
        return '-';
      }
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditCity(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除城市「${record.cityName}」吗？`}
            onConfirm={() => handleDeleteCity(record.countryId, record.id)}
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
            placeholder="国家名称"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            allowClear
          />
          <Button type="primary" icon={<SaveOutlined />} onClick={loadCountries} loading={loading}>
            保存
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCountry}>
            添加国家
          </Button>
        </Space>
      </Card>

      {/* 国家列表表格 */}
      <Card bordered={false}>
        <Table
          columns={columns}
          dataSource={filteredCountries}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 1800 }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '0 24px' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>城市列表</Text>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => handleAddCity(record.id)}
                  >
                    添加城市
                  </Button>
                </div>
                <Table
                  columns={cityColumns}
                  dataSource={record.cities || []}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </div>
            ),
            rowExpandable: (record) => (record.cities?.length ?? 0) > 0
          }}
        />
      </Card>

      {/* 新建/编辑国家弹窗 */}
      <Modal
        title={editingCountry ? '编辑国家' : '添加国家'}
        open={countryModalVisible}
        onOk={handleSaveCountry}
        onCancel={() => setCountryModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={countryForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="countryName"
                label="国家名称"
                rules={[{ required: true, message: '请输入国家名称' }]}
              >
                <Input placeholder="如：中国" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="countryNameEn"
                label="英文名称"
                rules={[{ required: true, message: '请输入英文名称' }]}
              >
                <Input placeholder="如：China" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="countryCode"
                label="国家代码"
                rules={[{ required: true, message: '请输入国家代码' }]}
              >
                <Input placeholder="如：CN" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="phoneCode"
                label="国家区号"
                rules={[{ required: true, message: '请输入国家区号' }]}
              >
                <Input placeholder="如：+86" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="continent"
                label="所属大洲"
                rules={[{ required: true, message: '请选择所属大洲' }]}
              >
                <Select placeholder="请选择">
                  {Object.entries(CONTINENT_NAMES).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="currencyCode"
                label="货币代码"
                rules={[{ required: true, message: '请输入货币代码' }]}
              >
                <Input placeholder="如：CNY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="currencyName"
                label="货币名称"
                rules={[{ required: true, message: '请输入货币名称' }]}
              >
                <Input placeholder="如：人民币" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="currencySymbol"
                label="货币符号"
                rules={[{ required: true, message: '请输入货币符号' }]}
              >
                <Input placeholder="如：¥" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="flagImage" label="国旗图片">
                <Input placeholder="国旗图片URL" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="countryImage" label="国家图片">
                <Input placeholder="国家图片URL" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="isOrigin" label="可作为起运地" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isDestination" label="可作为目的地" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="requiresMaterial" label="是否到付" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="输入备注信息..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新建/编辑城市弹窗 */}
      <Modal
        title={editingCity ? '编辑城市' : '添加城市'}
        open={cityModalVisible}
        onOk={handleSaveCity}
        onCancel={() => setCityModalVisible(false)}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={cityForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="cityName"
                label="城市名称"
                rules={[{ required: true, message: '请输入城市名称' }]}
              >
                <Input placeholder="如：深圳" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cityNameEn"
                label="英文名称"
                rules={[{ required: true, message: '请输入英文名称' }]}
              >
                <Input placeholder="如：Shenzhen" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="cityCode"
                label="城市代码"
                rules={[{ required: true, message: '请输入城市代码' }]}
              >
                <Input placeholder="如：SZX" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="provinceState" label="省份/州">
                <Input placeholder="如：广东省" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="timezone" label="时区">
                <Input placeholder="如：UTC+8" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="latitude" label="纬度">
                <InputNumber
                  placeholder="如：22.5431"
                  style={{ width: '100%' }}
                  precision={6}
                  step={0.1}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="longitude" label="经度">
                <InputNumber
                  placeholder="如：114.0579"
                  style={{ width: '100%' }}
                  precision={6}
                  step={0.1}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="isPort" label="是否为港口城市" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isAirport" label="是否有机场" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="输入备注信息..." />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};
