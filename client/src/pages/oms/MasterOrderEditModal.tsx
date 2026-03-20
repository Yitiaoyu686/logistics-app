/**
 * 主订单编辑模态框
 * 布局与 OrderCreate 保持一致：两栏卡片 + Form.List 包裹管理
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Modal, Form, Input, Select, Button, Row, Col, Card, Space, Tag,
  InputNumber, message, Typography, Collapse, Spin, theme
} from 'antd';
import {
  UserOutlined, EnvironmentOutlined, RocketOutlined,
  PlusOutlined, DeleteOutlined, FileExcelOutlined,
  InboxOutlined, DownOutlined, UpOutlined
} from '@ant-design/icons';
import type { MasterOrder } from '../../types/order';
import { v2OmsApi } from '../../api';
import { mapV2OrderFull } from './orderV2Mapper';
import { useOrderBaseOptions } from '../../hooks/useOrderBaseOptions';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface MasterOrderEditModalProps {
  open: boolean;
  order: MasterOrder | null;
  onClose: () => void;
  onSave: (orderId: string, updates: Partial<MasterOrder>) => void;
}

export default function MasterOrderEditModal({ open, order, onClose, onSave }: MasterOrderEditModalProps) {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const fixedTransportType: 'SEA' | 'AIR' = order?.transportType === 'AIR' ? 'AIR' : 'SEA';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [totalWeight, setTotalWeight] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [estPrice, setEstPrice] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const {
    loading: baseLoading,
    countries,
    baseOptions,
    currencyOptions,
  } = useOrderBaseOptions();

  const destCountry = Form.useWatch('destCountry', form);
  const transportType = Form.useWatch('transportType', form);

  // 目的城市级联
  const cityOptions = useMemo(() => {
    const country = countries.find((item) => item.countryCode === destCountry);
    return country?.cities || [];
  }, [countries, destCountry]);

  const serviceTypeOptions = useMemo(() => {
    const mode = (transportType === 'AIR' ? 'AIR' : 'SEA') as 'AIR' | 'SEA';
    return (baseOptions.ORDER_SERVICE_TYPE || []).filter((item) => item.transportMode === 'ALL' || item.transportMode === mode);
  }, [baseOptions.ORDER_SERVICE_TYPE, transportType]);

  const seaContainerOptions = useMemo(
    () => (baseOptions.CONTAINER_TYPE || []).filter((item) => item.transportMode === 'ALL' || item.transportMode === 'SEA'),
    [baseOptions.CONTAINER_TYPE]
  );

  const paymentMethodOptions = baseOptions.PAYMENT_METHOD || [];
  const paymentChannelOptions = baseOptions.PAYMENT_CHANNEL || [];
  const expressCompanyOptions = baseOptions.EXPRESS_COMPANY || [];
  const cargoCategoryOptions = baseOptions.CARGO_CATEGORY || [];
  const cargoTypeOptions = baseOptions.CARGO_TYPE || [];

  useEffect(() => {
    if (!transportType) return;
    const currentServiceType = String(form.getFieldValue('serviceType') || '');
    const validCodes = serviceTypeOptions.map((item) => item.code);
    if (validCodes.length > 0 && !validCodes.includes(currentServiceType)) {
      form.setFieldValue('serviceType', validCodes[0]);
    }
  }, [transportType, form, serviceTypeOptions]);

  useEffect(() => {
    const currentCurrency = form.getFieldValue('currency');
    if (currentCurrency) return;
    const preferred = currencyOptions.find((item) => item.code === 'CNY') || currencyOptions[0];
    if (preferred) {
      form.setFieldValue('currency', preferred.code);
    }
  }, [currencyOptions, form]);

  useEffect(() => {
    if (!open) return;
    form.setFieldValue('transportType', fixedTransportType);
  }, [fixedTransportType, open, form]);

  // 统计计算
  const recalcStats = () => {
    const expressPackages = form.getFieldValue('expressPackages') || [];
    const valid = expressPackages.filter((p: any) => p?.trackingNo);
    const totalPcs = valid.reduce((acc: number, pkg: any) => acc + (pkg?.pieces || 0), 0);
    const totalWgt = valid.reduce((acc: number, pkg: any) => acc + (pkg?.weight || 0), 0);
    setTotalPieces(totalPcs);
    setTotalWeight(totalWgt);
    const curTransport = form.getFieldValue('transportType');
    const basePrice = curTransport === 'AIR' ? 55 : curTransport === 'SEA' ? 12 : 0;
    setEstPrice(totalWgt > 0 ? totalWgt * basePrice + 100 : 0);
  };

  // 打开时获取完整订单详情
  useEffect(() => {
    if (!order || !open) return;
    let cancelled = false;
    setLoading(true);
    setExpandedRows(new Set());

    const loadOrder = async () => {
      try {
        const res = await v2OmsApi.getOrderFull(order.id) as any;
        if (cancelled) return;
        const mapped = mapV2OrderFull(res.data || res);
        const fullOrder = {
          ...mapped.order,
          expressPackages: mapped.expressPackages,
        };
        populateForm(fullOrder);
      } catch {
        if (cancelled) return;
        // 降级：使用列表数据
        populateForm(order);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const populateForm = (data: any) => {
      // 将服务端字段映射到表单字段（与 OrderCreate 保持一致的字段名）
      const packages = Array.isArray(data.expressPackages) ? data.expressPackages : [];
      const matchedCountry = countries.find(
        (country) =>
          country.countryCode === data.destCountry ||
          country.countryName === data.destCountry ||
          country.countryNameEn === data.destCountry
      );
      const matchedCity = matchedCountry?.cities.find(
        (city) =>
          city.cityCode === data.destCity ||
          city.cityName === data.destCity ||
          city.cityNameEn === data.destCity
      );
      form.setFieldsValue({
        senderName: data.sender || '',
        senderPhone: data.senderPhone || '',
        senderAddress: data.senderAddress || '',
        consigneeName: data.consignee || '',
        consigneePhone: data.consigneePhone || '',
        consigneeEmail: data.consigneeEmail || '',
        consigneeAddress: data.destAddress || '',
        destCountry: matchedCountry?.countryCode || data.destCountry,
        destCity: matchedCity?.cityCode || data.destCity,
        transportType: fixedTransportType,
        serviceType: data.serviceType || (data.transportType === 'AIR' ? 'STANDARD_AIR' : 'LCL_SEA'),
        routeCode: data.routeCode || '',
        warehouseEntryNo: data.warehouseEntryNo || '',
        containerType: data.containerType || '',
        salesPerson: data.salesPerson || '',
        currency: data.currency || 'CNY',
        paymentMethod: data.paymentMethod || 'PREPAID',
        paymentChannel: data.paymentChannel || 'WECHAT',
        remark: data.remark || '',
        // 将包裹数据映射到 Form.List 的字段名
        expressPackages: packages.length > 0
          ? packages.map((pkg: any) => ({
              courier: pkg.expressCompany || pkg.courier || '',
              trackingNo: pkg.trackingNo || '',
              itemName: pkg.name || pkg.itemName || '',
              pieces: pkg.pieces || 1,
              weight: pkg.weight || 0,
              category: pkg.category || undefined,
              cargoType: pkg.cargoType || undefined,
              declaredValue: pkg.value || pkg.declaredValue || undefined,
              remark: pkg.remark || undefined,
              // 保留原始 ID 和状态
              _id: pkg.id,
              _status: pkg.status,
            }))
          : [{}],
      });
      setTimeout(() => recalcStats(), 100);
    };

    loadOrder();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, open, countries]);

  // 智能粘贴
  const handleSmartPaste = (text: string) => {
    if (!text) return;
    const lines = text.split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split(/[\s\t,，]+/);
      return {
        courier: parts[0] || '',
        trackingNo: parts[1] || '',
        itemName: parts[2] || '未知品名',
        pieces: parseInt(parts[3] || '1') || 1,
        weight: parseFloat(parts[4] || '0') || 0,
      };
    }).filter(p => p.trackingNo);

    if (parsed.length > 0) {
      const current = form.getFieldValue('expressPackages') || [];
      const validCurrent = current.filter((p: any) => p?.trackingNo);
      form.setFieldsValue({ expressPackages: [...validCurrent, ...parsed] });
      message.success(`已解析并添加 ${parsed.length} 条快递包裹`);
      setTimeout(() => recalcStats(), 100);
    } else {
      message.warning('未能解析到有效数据，请检查格式');
    }
  };

  // 展开/收起行
  const toggleExpand = (index: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // 保存
  const handleSave = async () => {
    try {
      await form.validateFields([
        'destCountry', 'destCity',
        'consigneeName', 'consigneePhone', 'consigneeAddress'
      ]);
    } catch {
      return;
    }
    if (!order) return;

    setSaving(true);
    try {
      const values = form.getFieldsValue(true);
      const pkgs = (values.expressPackages || []).filter((p: any) => p?.trackingNo);
      const computedTotalPieces = pkgs.reduce((acc: number, pkg: any) => acc + (pkg?.pieces || 0), 0);
      const computedTotalWeight = pkgs.reduce((acc: number, pkg: any) => acc + (pkg?.weight || 0), 0);
      const computedTotalValue = pkgs.reduce((acc: number, pkg: any) => acc + (pkg?.declaredValue || 0), 0);
      const basePrice = fixedTransportType === 'AIR' ? 55 : fixedTransportType === 'SEA' ? 12 : 0;
      const computedFreight = computedTotalWeight > 0 ? computedTotalWeight * basePrice + 100 : 0;
      const selectedCountry = countries.find((item) => item.countryCode === values.destCountry);
      const selectedCity = selectedCountry?.cities.find((item) => item.cityCode === values.destCity);

      const updates: Partial<MasterOrder> = {
        sender: values.senderName,
        senderPhone: values.senderPhone,
        senderAddress: values.senderAddress,
        consignee: values.consigneeName,
        consigneePhone: values.consigneePhone,
        consigneeEmail: values.consigneeEmail,
        destCountry: selectedCountry?.countryName || values.destCountry,
        destCity: selectedCity?.cityName || values.destCity,
        destAddress: values.consigneeAddress,
        serviceType: values.serviceType,
        routeCode: values.routeCode,
        warehouseEntryNo: values.warehouseEntryNo,
        containerType: values.containerType,
        salesPerson: values.salesPerson,
        currency: values.currency,
        paymentMethod: values.paymentMethod,
        paymentChannel: values.paymentChannel,
        remark: values.remark,
        totalPieces: computedTotalPieces,
        totalWeight: computedTotalWeight,
        totalVolume: computedTotalWeight * 0.001,
        totalValue: computedTotalValue,
        totalFreight: computedFreight,
        expressPackages: pkgs.map((p: any) => ({
          id: p._id || undefined,
          courier: p.courier,
          expressCompany: p.courier,
          trackingNo: p.trackingNo,
          name: p.itemName,
          itemName: p.itemName,
          category: p.category,
          cargoType: p.cargoType,
          pieces: p.pieces || 1,
          weight: p.weight || 0,
          value: p.declaredValue || 0,
          declaredValue: p.declaredValue || 0,
          status: p._status || 'PENDING',
          remark: p.remark,
        })),
      } as any;

      onSave(order.id, updates);
      handleClose();
    } catch (error: any) {
      message.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setExpandedRows(new Set());
    setTotalWeight(0);
    setTotalPieces(0);
    setEstPrice(0);
    onClose();
  };

  if (!order) return null;

  return (
    <Modal
      title={`编辑订单 - ${order.orderNo}`}
      open={open}
      onCancel={handleClose}
      width={1400}
      footer={null}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => setTimeout(recalcStats, 0)}
          style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: 4 }}
        >
          {/* ===== 基本信息 + 收发货人 ===== */}
          <Row gutter={24}>
            <Col span={12}>
              <Card title={<><UserOutlined /> 基本信息</>} size="small" style={{ marginBottom: 16 }}>
                {/* 客户信息（编辑时只读展示） */}
                <Form.Item label="客户">
                  <Input
                    value={`${order.customerName || ''} (${order.customerId || ''})`}
                    disabled
                    style={{ backgroundColor: token.colorBgContainerDisabled }}
                  />
                </Form.Item>

                <Form.Item name="transportType" hidden>
                  <Input />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="业务线">
                      <Tag color={fixedTransportType === 'AIR' ? 'geekblue' : 'blue'}>
                        {fixedTransportType === 'AIR' ? '空运 AIR' : '海运 SEA'}
                      </Tag>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="serviceType" label="服务类型" rules={[{ required: true, message: '请选择服务类型' }]}>
                      <Select placeholder="选择服务类型" loading={baseLoading}>
                        {serviceTypeOptions.map((item) => (
                          <Option key={item.code} value={item.code}>
                            {item.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="warehouseEntryNo"
                      label="入仓号"
                      tooltip="推荐使用客户编号+订单标识的短号，便于仓库收货识别"
                    >
                      <Input placeholder="入仓短号" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="routeCode" label="线路代码">
                      <Input placeholder="如 CAN.CHN→LOS.NG" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    {transportType === 'SEA' && (
                      <Form.Item name="containerType" label="柜型">
                        <Select allowClear placeholder="选择柜型">
                          {seaContainerOptions.map((item) => (
                            <Option key={item.code} value={item.code}>
                              {item.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    )}
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="destCountry" label="目的国家" rules={[{ required: true, message: '请选择目的国家' }]}>
                      <Select
                        placeholder="选择国家"
                        loading={baseLoading}
                        onChange={() => form.setFieldValue('destCity', undefined)}
                      >
                        {countries.map((country) => (
                          <Option key={country.countryCode} value={country.countryCode}>
                            {country.countryName}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="destCity" label="目的城市" rules={[{ required: true, message: '请选择目的城市' }]}>
                      <Select placeholder={destCountry ? '选择城市' : '请先选择国家'} disabled={!destCountry} loading={baseLoading}>
                        {cityOptions.map((city) => (
                          <Option key={city.cityCode} value={city.cityCode}>
                            {city.cityName}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item name="salesPerson" label="业务员">
                      <Input placeholder="业务员姓名" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="currency" label="币种">
                      <Select loading={baseLoading}>
                        {currencyOptions.map((item) => (
                          <Option key={item.code} value={item.code}>
                            {item.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="paymentMethod" label="支付方式">
                      <Select loading={baseLoading}>
                        {paymentMethodOptions.map((item) => (
                          <Option key={item.code} value={item.code}>
                            {item.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="paymentChannel" label="支付途径">
                      <Select loading={baseLoading}>
                        {paymentChannelOptions.map((item) => (
                          <Option key={item.code} value={item.code}>
                            {item.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col span={12}>
              <Card title={<><UserOutlined /> 发货人</>} size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="senderName" label="姓名">
                      <Input placeholder="发货人姓名" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="senderPhone" label="电话">
                      <Input placeholder="联系电话" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="senderAddress" label="地址" style={{ marginBottom: 0 }}>
                  <Input placeholder="详细地址" />
                </Form.Item>
              </Card>

              <Card title={<><EnvironmentOutlined /> 收货人</>} size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="consigneeName" label="姓名" rules={[{ required: true, message: '请输入收货人姓名' }]}>
                      <Input placeholder="收货人姓名" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="consigneePhone" label="电话" rules={[{ required: true, message: '请输入电话' }]}>
                      <Input placeholder="联系电话" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="consigneeEmail" label="邮箱">
                      <Input placeholder="邮箱" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="consigneeAddress" label="详细地址" rules={[{ required: true, message: '请输入地址' }]} style={{ marginBottom: 0 }}>
                  <TextArea rows={2} placeholder="详细地址" />
                </Form.Item>
              </Card>
            </Col>

            <Col span={24}>
              <Form.Item name="remark" label="备注" style={{ marginBottom: 16 }}>
                <TextArea rows={2} placeholder="订单备注信息（选填）" />
              </Form.Item>
            </Col>
          </Row>

          {/* ===== 快递包裹 ===== */}
          <Collapse
            defaultActiveKey={['express']}
            style={{ marginBottom: 16 }}
            items={[{
              key: 'express',
              label: (
                <Space>
                  <InboxOutlined />
                  <span>快递包裹管理</span>
                  {totalPieces > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      已有 {(form.getFieldValue('expressPackages') || []).filter((p: any) => p?.trackingNo).length} 个包裹 | {totalPieces} 件 | {totalWeight.toFixed(2)} kg
                    </Text>
                  )}
                </Space>
              ),
              children: (
                <div>
                  {/* 智能粘贴 */}
                  <Collapse
                    size="small"
                    items={[{
                      key: 'paste',
                      label: <><FileExcelOutlined /> 智能粘贴识别</>,
                      children: (
                        <div>
                          <TextArea
                            placeholder={'每行一条，格式：快递公司 运单号 品名 件数 重量\n例如：顺丰 SF1001 手机壳 50 25.5'}
                            rows={3}
                            id="editSmartPasteInput"
                          />
                          <Button
                            type="primary"
                            size="small"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                              const el = document.getElementById('editSmartPasteInput') as HTMLTextAreaElement;
                              if (el) handleSmartPaste(el.value);
                            }}
                          >
                            解析并添加
                          </Button>
                        </div>
                      ),
                    }]}
                    style={{ marginBottom: 12 }}
                  />

                  {/* 快递包裹表格 - 与 OrderCreate 一致的 Form.List */}
                  <Form.List name="expressPackages">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.length > 0 && (
                          <Row gutter={8} style={{ marginBottom: 8, fontSize: 12, color: '#999', fontWeight: 500, padding: '0 4px' }}>
                            <Col span={4}>快递公司</Col>
                            <Col span={5}>运单号</Col>
                            <Col span={5}>品名</Col>
                            <Col span={3}>件数</Col>
                            <Col span={3}>重量(kg)</Col>
                            <Col span={4}>操作</Col>
                          </Row>
                        )}

                        {fields.map(({ key, name, ...restField }) => (
                          <div key={key} style={{
                            marginBottom: 8,
                            border: `1px solid ${token.colorBorderSecondary}`,
                            borderRadius: 6,
                            padding: '8px 4px',
                          }}>
                            <Row gutter={8} align="middle">
                              <Col span={4}>
                                <Form.Item {...restField} name={[name, 'courier']} noStyle>
                                  <Select placeholder="快递公司" size="small" allowClear>
                                    {expressCompanyOptions.map((item) => (
                                      <Option key={item.code} value={item.label}>
                                        {item.label}
                                      </Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col span={5}>
                                <Form.Item {...restField} name={[name, 'trackingNo']} noStyle>
                                  <Input placeholder="运单号" size="small" />
                                </Form.Item>
                              </Col>
                              <Col span={5}>
                                <Form.Item {...restField} name={[name, 'itemName']} noStyle>
                                  <Input placeholder="品名" size="small" />
                                </Form.Item>
                              </Col>
                              <Col span={3}>
                                <Form.Item {...restField} name={[name, 'pieces']} noStyle>
                                  <InputNumber placeholder="件数" min={1} style={{ width: '100%' }} size="small" />
                                </Form.Item>
                              </Col>
                              <Col span={3}>
                                <Form.Item {...restField} name={[name, 'weight']} noStyle>
                                  <InputNumber placeholder="重量" min={0} step={0.1} style={{ width: '100%' }} size="small" />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Space>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={expandedRows.has(name) ? <UpOutlined /> : <DownOutlined />}
                                    onClick={() => toggleExpand(name)}
                                  >
                                    {expandedRows.has(name) ? '收起' : '更多'}
                                  </Button>
                                  <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => { remove(name); setTimeout(recalcStats, 0); }}
                                  />
                                </Space>
                              </Col>
                            </Row>

                            {expandedRows.has(name) && (
                              <Row gutter={8} style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${token.colorBorderSecondary}` }}>
                                <Col span={6}>
                                  <Form.Item {...restField} name={[name, 'category']} label="类别" style={{ marginBottom: 0 }}>
                                    <Select placeholder="类别" size="small" allowClear>
                                      {cargoCategoryOptions.map((item) => (
                                        <Option key={item.code} value={item.code}>
                                          {item.label}
                                        </Option>
                                      ))}
                                    </Select>
                                  </Form.Item>
                                </Col>
                                <Col span={6}>
                                  <Form.Item {...restField} name={[name, 'cargoType']} label="货物属性" style={{ marginBottom: 0 }}>
                                    <Select placeholder="属性" size="small" allowClear>
                                      {cargoTypeOptions.map((item) => (
                                        <Option key={item.code} value={item.code}>
                                          {item.label}
                                        </Option>
                                      ))}
                                    </Select>
                                  </Form.Item>
                                </Col>
                                <Col span={6}>
                                  <Form.Item {...restField} name={[name, 'declaredValue']} label="货值($)" style={{ marginBottom: 0 }}>
                                    <InputNumber placeholder="货值" min={0} style={{ width: '100%' }} size="small" />
                                  </Form.Item>
                                </Col>
                                <Col span={6}>
                                  <Form.Item {...restField} name={[name, 'remark']} label="备注" style={{ marginBottom: 0 }}>
                                    <Input placeholder="备注" size="small" />
                                  </Form.Item>
                                </Col>
                              </Row>
                            )}
                          </div>
                        ))}

                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} size="small">
                          添加一行
                        </Button>
                      </>
                    )}
                  </Form.List>
                </div>
              ),
            }]}
          />

          {/* ===== 预估运费 + 保存 ===== */}
          <Row gutter={24} align="middle">
            <Col flex="auto">
              {estPrice > 0 && (
                <Space size="large">
                  <Text type="secondary">预估运费：</Text>
                  <Text type="danger" style={{ fontSize: 20, fontWeight: 'bold' }}>¥{estPrice.toFixed(2)}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    ({transportType === 'AIR' ? '55' : '12'} 元/kg × {totalWeight.toFixed(2)}kg + 100 基础费)
                  </Text>
                </Space>
              )}
            </Col>
            <Col>
              <Space>
                <Button onClick={handleClose}>取消</Button>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  loading={saving}
                  onClick={handleSave}
                >
                  保存修改
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Spin>
    </Modal>
  );
}
