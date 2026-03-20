import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select,
  InputNumber, message, Popconfirm, Row, Col, Divider,
  Typography, Tabs
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CalculatorOutlined,
  CloudOutlined, RocketOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ChargeCalculator } from './ChargeCalculator';
import {
  CARGO_CATEGORY_LABELS,
  DEFAULT_AIR_CONFIG,
  type CargoCategory, type WeightTier, type SurchargeRateMap,
} from '../../utils/freightCalc';
import { systemApi } from '../../api';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

// ========== 类型定义 ==========

type TransportMode = 'AIR' | 'SEA_LCL';
type RuleStatus = 'ACTIVE' | 'INACTIVE';

interface FreightRateRule {
  id: string;
  name: string;
  transportMode: TransportMode;
  // 航空参数
  volumetricDivisor?: number;
  firstWeightPrice?: number;
  continuationTiers?: WeightTier[];
  surchargeRates?: SurchargeRateMap;
  packagingSurchargePerKg?: number;
  // 海运拼箱参数
  volumeWeightRatio?: number;
  unitPricePerCBM?: number;
  // 通用
  currency: string;
  unitPrice: number;
  unitType: string;
  minCharge?: number;
  remark?: string;
  status: RuleStatus;
  createdAt: string;
  updatedAt?: string;
}

// 运输方式配置
const TRANSPORT_MODE_CONFIG: Record<TransportMode, { label: string; color: string; icon: React.ReactNode }> = {
  AIR: { label: '航空运输', color: 'blue', icon: <RocketOutlined /> },
  SEA_LCL: { label: '海运拼箱', color: 'green', icon: <CloudOutlined /> },
};

// 币种选项
const CURRENCIES = ['CNY', 'USD', 'EUR', 'GBP', 'JPY'];

// 非普货品类列表（用于附加费配置）
const NON_NORMAL_CATEGORIES = Object.entries(CARGO_CATEGORY_LABELS)
  .filter(([k]) => k !== 'NORMAL')
  .map(([value, label]) => ({ value: value as Exclude<CargoCategory, 'NORMAL'>, label }));

// ========== 主组件 ==========

export const FreightRateRule: React.FC = () => {
  const [rules, setRules] = useState<FreightRateRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<FreightRateRule | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>('AIR');
  const [filterMode, setFilterMode] = useState<TransportMode | 'ALL'>('ALL');
  const [form] = Form.useForm();

  const normalizeDateTime = (value?: string) => {
    if (!value) return new Date().toISOString().replace('T', ' ').slice(0, 19);
    return value.replace('T', ' ').slice(0, 19);
  };

  const loadRules = async (withLoading = true) => {
    if (withLoading) setLoading(true);
    try {
      const params = filterMode === 'ALL' ? undefined : { transportMode: filterMode };
      const res = await systemApi.listFreightRates(params);
      const rows = (res.data || res || []) as any[];
      setRules(rows.map((row) => ({
        ...row,
        createdAt: normalizeDateTime(row.createdAt),
        updatedAt: normalizeDateTime(row.updatedAt || row.createdAt),
        continuationTiers: Array.isArray(row.continuationTiers) ? row.continuationTiers : [],
        surchargeRates: row.surchargeRates && typeof row.surchargeRates === 'object' ? row.surchargeRates : {},
      })));
    } catch (error) {
      message.error((error as Error)?.message || '获取运费规则失败');
    } finally {
      if (withLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [filterMode]);

  const filteredRules = useMemo(() => (
    filterMode === 'ALL'
      ? rules
      : rules.filter(r => r.transportMode === filterMode)
  ), [filterMode, rules]);

  // 新建
  const handleAdd = () => {
    setEditingRule(null);
    setTransportMode('AIR');
    form.resetFields();
    form.setFieldsValue({
      transportMode: 'AIR',
      volumetricDivisor: 6000,
      volumeWeightRatio: 700,
      currency: 'CNY',
      unitType: '/kg',
      firstWeightPrice: 63,
      packagingSurchargePerKg: 2,
      continuationTiers: [
        { minWeight: 1, maxWeight: 5, unitPrice: 60 },
        { minWeight: 5, maxWeight: 20, unitPrice: 57 },
        { minWeight: 20, maxWeight: null, unitPrice: 55 },
      ],
      surchargeRates: NON_NORMAL_CATEGORIES.map(c => ({
        category: c.value,
        rate: DEFAULT_AIR_CONFIG.surchargeRates[c.value] * 100,
      })),
      unitPricePerCBM: 1800,
    });
    setModalVisible(true);
  };

  // 编辑
  const handleEdit = (record: FreightRateRule) => {
    setEditingRule(record);
    setTransportMode(record.transportMode);
    const surchargeRatesArr = record.surchargeRates
      ? NON_NORMAL_CATEGORIES.map(c => ({
          category: c.value,
          rate: (record.surchargeRates![c.value] ?? 0) * 100,
        }))
      : NON_NORMAL_CATEGORIES.map(c => ({
          category: c.value,
          rate: DEFAULT_AIR_CONFIG.surchargeRates[c.value] * 100,
        }));

    form.setFieldsValue({
      name: record.name,
      transportMode: record.transportMode,
      volumetricDivisor: record.volumetricDivisor || 6000,
      volumeWeightRatio: record.volumeWeightRatio || 700,
      currency: record.currency,
      unitPrice: record.unitPrice,
      unitType: record.unitType,
      minCharge: record.minCharge,
      remark: record.remark,
      firstWeightPrice: record.firstWeightPrice || 63,
      packagingSurchargePerKg: record.packagingSurchargePerKg ?? 2,
      continuationTiers: record.continuationTiers || [
        { minWeight: 1, maxWeight: 5, unitPrice: 60 },
      ],
      surchargeRates: surchargeRatesArr,
      unitPricePerCBM: record.unitPricePerCBM || 1800,
    });
    setModalVisible(true);
  };

  // 删除
  const handleDelete = async (id: string) => {
    try {
      await systemApi.deleteFreightRate(id);
      message.success('删除成功');
      await loadRules(false);
    } catch (error) {
      message.error((error as Error)?.message || '删除失败');
    }
  };

  // 切换状态
  const handleToggleStatus = async (record: FreightRateRule) => {
    const newStatus: RuleStatus = record.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await systemApi.updateFreightRate(record.id, { status: newStatus });
      message.success(newStatus === 'ACTIVE' ? '已启用' : '已停用');
      await loadRules(false);
    } catch (error) {
      message.error((error as Error)?.message || '状态更新失败');
    }
  };

  // 提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 构建附加费率 Map
      const surchargeRatesMap: SurchargeRateMap = {} as SurchargeRateMap;
      if (values.surchargeRates) {
        for (const item of values.surchargeRates) {
          surchargeRatesMap[item.category as Exclude<CargoCategory, 'NORMAL'>] = (item.rate || 0) / 100;
        }
      }

      const payload = {
        name: values.name,
        transportMode: values.transportMode,
        volumetricDivisor: values.transportMode === 'AIR' ? values.volumetricDivisor : null,
        firstWeightPrice: values.transportMode === 'AIR' ? values.firstWeightPrice : null,
        continuationTiers: values.transportMode === 'AIR' ? (values.continuationTiers || []) : [],
        surchargeRates: values.transportMode === 'AIR' ? surchargeRatesMap : {},
        packagingSurchargePerKg: values.transportMode === 'AIR' ? values.packagingSurchargePerKg : null,
        volumeWeightRatio: values.transportMode === 'SEA_LCL' ? values.volumeWeightRatio : null,
        unitPricePerCBM: values.transportMode === 'SEA_LCL' ? values.unitPricePerCBM : null,
        currency: values.currency,
        unitPrice: values.unitPrice,
        unitType: values.unitType,
        minCharge: values.minCharge,
        remark: values.remark,
      };

      if (editingRule) {
        await systemApi.updateFreightRate(editingRule.id, payload);
        message.success('保存成功');
      } else {
        await systemApi.createFreightRate(payload);
        message.success('保存成功');
      }

      setModalVisible(false);
      form.resetFields();
      await loadRules(false);
    } catch (error) {
      message.error((error as Error)?.message || '保存失败');
    }
  };

  // 运输方式切换
  const handleTransportModeChange = (mode: TransportMode) => {
    setTransportMode(mode);
    if (mode === 'AIR') {
      form.setFieldsValue({ unitType: '/kg', volumetricDivisor: 6000 });
    } else {
      form.setFieldsValue({ unitType: '/CBM', volumeWeightRatio: 700 });
    }
  };

  // 表格列
  const columns: ColumnsType<FreightRateRule> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (text: string, record: FreightRateRule) => (
        <Space>
          {TRANSPORT_MODE_CONFIG[record.transportMode].icon}
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '运输方式',
      dataIndex: 'transportMode',
      key: 'transportMode',
      width: 100,
      render: (mode: TransportMode) => (
        <Tag color={TRANSPORT_MODE_CONFIG[mode].color}>
          {TRANSPORT_MODE_CONFIG[mode].label}
        </Tag>
      ),
    },
    {
      title: '计费参数',
      key: 'billingParam',
      width: 200,
      render: (_: unknown, record: FreightRateRule) => {
        if (record.transportMode === 'AIR') {
          const tierCount = record.continuationTiers?.length || 0;
          return (
            <div>
              <div>首重：<Text strong>{record.firstWeightPrice || record.unitPrice}</Text> 元/kg</div>
              <div style={{ fontSize: 12, color: '#999' }}>
                续重 {tierCount} 档阶梯 | 除数 {record.volumetricDivisor}
              </div>
            </div>
          );
        }
        return (
          <div>
            <div>单价：<Text strong>{record.unitPricePerCBM || record.unitPrice}</Text> 元/m³</div>
            <div style={{ fontSize: 12, color: '#999' }}>1m³ = {record.volumeWeightRatio}kg</div>
          </div>
        );
      },
    },
    {
      title: '附加费/配置',
      key: 'extras',
      width: 160,
      render: (_: unknown, record: FreightRateRule) => {
        if (record.transportMode === 'AIR') {
          const hasSurcharge = record.surchargeRates && Object.keys(record.surchargeRates).length > 0;
          const hasPkg = record.packagingSurchargePerKg && record.packagingSurchargePerKg > 0;
          return (
            <Space direction="vertical" size={0}>
              {hasSurcharge && <Tag color="orange">品类附加费 {Object.keys(record.surchargeRates!).length}项</Tag>}
              {hasPkg && <Tag color="cyan">木箱 {record.packagingSurchargePerKg}元/kg</Tag>}
              {!hasSurcharge && !hasPkg && <Text type="secondary">-</Text>}
            </Space>
          );
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: '最低收费',
      key: 'minCharge',
      width: 100,
      render: (_: unknown, record: FreightRateRule) => (
        record.minCharge ? `${record.currency} ${record.minCharge}` : '-'
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 70,
      render: (status: RuleStatus) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
          {status === 'ACTIVE' ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      key: 'updatedAt',
      width: 150,
      render: (_: unknown, record: FreightRateRule) => record.updatedAt || record.createdAt,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: unknown, record: FreightRateRule) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleToggleStatus(record)}>
            {record.status === 'ACTIVE' ? '停用' : '启用'}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此规则？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ========== 渲染 Modal 表单 ==========
  const renderModalForm = () => (
    <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
      <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
        <Input placeholder="例如：中国→美国 航空标准运费" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="transportMode" label="运输方式" rules={[{ required: true }]}>
            <Select onChange={handleTransportModeChange}>
              <Option value="AIR"><RocketOutlined /> 航空运输</Option>
              <Option value="SEA_LCL"><CloudOutlined /> 海运拼箱</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="currency" label="币种" rules={[{ required: true }]}>
            <Select>{CURRENCIES.map(c => <Option key={c} value={c}>{c}</Option>)}</Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="minCharge" label="最低收费">
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="可选" />
          </Form.Item>
        </Col>
      </Row>

      {/* 空运/海运分Tab配置 */}
      <Tabs
        activeKey={transportMode}
        onChange={(k) => {
          setTransportMode(k as TransportMode);
          form.setFieldsValue({ transportMode: k });
          if (k === 'AIR') form.setFieldsValue({ unitType: '/kg' });
          else form.setFieldsValue({ unitType: '/CBM' });
        }}
        items={[
          {
            key: 'AIR',
            label: <span><RocketOutlined /> 空运配置</span>,
            children: (
              <div>
                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item name="volumetricDivisor" label="体积重除数" rules={[{ required: true }]}
                      extra="体积重=长×宽×高÷此值">
                      <InputNumber style={{ width: '100%' }} min={1} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="firstWeightPrice" label="首重单价(元/kg)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="packagingSurchargePerKg" label="木箱包装(元/kg)">
                      <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="unitPrice" label="基础单价(参考)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="unitType" hidden><Input /></Form.Item>

                {/* 续重阶梯配置 */}
                <Divider titlePlacement="left" style={{ fontSize: 13, margin: '8px 0 16px' }}>续重阶梯配置</Divider>
                <Form.List name="continuationTiers">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Row gutter={8} key={key} style={{ marginBottom: 8 }}>
                          <Col span={7}>
                            <Form.Item {...restField} name={[name, 'minWeight']} rules={[{ required: true, message: '最小重量' }]}>
                              <InputNumber style={{ width: '100%' }} min={0} placeholder="≥ 最小kg" addonAfter="kg" />
                            </Form.Item>
                          </Col>
                          <Col span={7}>
                            <Form.Item {...restField} name={[name, 'maxWeight']}>
                              <InputNumber style={{ width: '100%' }} min={0} placeholder="最大kg（空=无上限）" addonAfter="kg" />
                            </Form.Item>
                          </Col>
                          <Col span={7}>
                            <Form.Item {...restField} name={[name, 'unitPrice']} rules={[{ required: true, message: '单价' }]}>
                              <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="元/kg" addonAfter="元/kg" />
                            </Form.Item>
                          </Col>
                          <Col span={3}>
                            <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                          </Col>
                        </Row>
                      ))}
                      <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} style={{ width: '100%' }}>
                        添加阶梯
                      </Button>
                    </>
                  )}
                </Form.List>

                {/* 附加费率配置 */}
                <Divider titlePlacement="left" style={{ fontSize: 13, margin: '16px 0 12px' }}>品类附加费率</Divider>
                <Form.List name="surchargeRates">
                  {(fields) => (
                    <Row gutter={[8, 4]}>
                      {fields.map(({ key, name, ...restField }) => (
                        <Col span={8} key={key}>
                          <Space size={4} style={{ display: 'flex' }}>
                            <Form.Item {...restField} name={[name, 'category']} noStyle>
                              <Select disabled style={{ width: 90 }}>
                                {NON_NORMAL_CATEGORIES.map(c => (
                                  <Option key={c.value} value={c.value}>{c.label}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item {...restField} name={[name, 'rate']} noStyle>
                              <InputNumber min={0} max={200} step={1} addonAfter="%" style={{ width: 100 }} />
                            </Form.Item>
                          </Space>
                        </Col>
                      ))}
                    </Row>
                  )}
                </Form.List>
              </div>
            ),
          },
          {
            key: 'SEA_LCL',
            label: <span><CloudOutlined /> 海运拼箱配置</span>,
            children: (
              <div>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="volumeWeightRatio" label="换算标准(kg/m³)" rules={[{ required: true }]}
                      extra="1m³ = N kg">
                      <InputNumber style={{ width: '100%' }} min={1} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="unitPricePerCBM" label="每立方米单价(元)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="unitPrice" label="基础单价(参考)" rules={[{ required: true }]}>
                      <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="unitType" hidden><Input /></Form.Item>
              </div>
            ),
          },
        ]}
      />

      <Form.Item name="remark" label="备注">
        <TextArea rows={2} placeholder="规则说明" />
      </Form.Item>
    </Form>
  );

  return (
    <div>
      {/* 计费计算器 */}
      <Card
        size="small"
        title={<span><CalculatorOutlined /> 运费计算器</span>}
        style={{ marginBottom: 16 }}
      >
        <ChargeCalculator />
      </Card>

      {/* 规则列表 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <span style={{ fontSize: 15, fontWeight: 500 }}>运费规则列表</span>
            <Select value={filterMode} onChange={setFilterMode} style={{ width: 140 }} size="small">
              <Option value="ALL">全部类型</Option>
              <Option value="AIR">航空运输</Option>
              <Option value="SEA_LCL">海运拼箱</Option>
            </Select>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建规则
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredRules}
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingRule ? '编辑运费规则' : '新建运费规则'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        destroyOnClose
        width={720}
      >
        {renderModalForm()}
      </Modal>
    </div>
  );
};
