import React, { useState, useEffect, useMemo } from 'react';
import {
  Form, Input, Select, Button, Row, Col, Space,
  InputNumber, message, Typography, theme, Modal
} from 'antd';
import { RocketOutlined, PlusOutlined, DeleteOutlined, FileExcelOutlined } from '@ant-design/icons';
import { systemApi, v2OmsApi } from '../../api';
import { useOrderBaseOptions } from '../../hooks/useOrderBaseOptions';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const buildRouteCode = (destCountryCode?: string, destCityCode?: string) => {
  if (!destCountryCode || !destCityCode) return '';
  return `CAN.CHN→${destCityCode.toUpperCase()}.${destCountryCode.toUpperCase()}`;
};

interface OrderCreateProps {
  onCancel: () => void;
  onSubmit: (values: any) => void;
  businessMode?: 'ALL' | 'AIR' | 'SEA';
  initialExpressData?: {
    courier?: string;
    trackingNo?: string;
    itemName?: string;
    pieces?: number;
    weight?: number;
  };
}

export const OrderCreate: React.FC<OrderCreateProps> = ({ onCancel, onSubmit, businessMode = 'ALL', initialExpressData }) => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const resolvedTransportType: 'SEA' | 'AIR' = businessMode === 'AIR' ? 'AIR' : 'SEA';
  const [totalWeight, setTotalWeight] = useState(0);
  const [totalPieces, setTotalPieces] = useState(0);
  const [estPrice, setEstPrice] = useState(0);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routes, setRoutes] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    loading: baseLoading,
    countries,
    baseOptions,
    currencyOptions,
  } = useOrderBaseOptions();

  const [smartPasteVisible, setSmartPasteVisible] = useState(false);
  const [smartPasteText, setSmartPasteText] = useState('');

  const fetchRoutes = async (transport: 'SEA' | 'AIR') => {
    setRoutesLoading(true);
    try {
      const res = await systemApi.routes({ transportType: transport, status: 'ACTIVE' }) as any;
      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setRoutes(rows);
    } catch (error: any) {
      message.error(error.message || '加载线路失败');
      setRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  };

  useEffect(() => {
    const fetchClients = async () => {
      setClientsLoading(true);
      try {
        const res = await v2OmsApi.listCustomers() as any;
        setClients(res.data || []);
      } catch (error: any) {
        message.error(error.message || '加载客户列表失败');
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    fetchRoutes(resolvedTransportType);
  }, [resolvedTransportType]);

  const handleRouteChange = (routeId?: string) => {
    const route = routes.find((item: any) => item.id === routeId);
    if (!route) return;

    const routeCode = `${route.originCity}.${route.originCountry}→${route.destCity}.${route.destCountry}`;
    const country = countries.find((item) =>
      item.countryCode === String(route.destCountry || '').toUpperCase()
      || item.countryName === route.destCountry
      || item.countryNameEn === route.destCountry
    );
    const city = country?.cities.find((item) =>
      item.cityCode === String(route.destCity || '').toUpperCase()
      || item.cityName === route.destCity
      || item.cityNameEn === route.destCity
    );

    form.setFieldsValue({
      routeId: route.id,
      routeCode,
      destCountry: country?.countryCode || form.getFieldValue('destCountry'),
      destCity: city?.cityCode || form.getFieldValue('destCity'),
    });
  };

  const handleClientChange = async (clientId: string) => {
    try {
      const res = await v2OmsApi.getCustomer(clientId) as any;
      const client = res.data;
      if (!client) return;

      setSelectedClient(client);
      const currentLine = String(form.getFieldValue('transportType') || resolvedTransportType);
      const matchedLineProfile = Array.isArray(client.lineProfiles)
        ? client.lineProfiles.find((item: any) => item.businessLine === currentLine)
        : null;
      const defaultRecipient = Array.isArray(client.recipientAddresses) && client.recipientAddresses.length > 0
        ? client.recipientAddresses[0]
        : null;
      const defaultSender = Array.isArray(client.senderProfiles) && client.senderProfiles.length > 0
        ? client.senderProfiles[0]
        : null;

      const countryValue = (() => {
        if (defaultRecipient?.countryId === 'CTRY-NG') return 'NGA';
        if (defaultRecipient?.countryId === 'CTRY-GH') return 'GHA';
        if (defaultRecipient?.countryId === 'CTRY-CN') return 'CN';
        const byName = countries.find(
          (country) => country.countryName === defaultRecipient?.destCountry || country.countryNameEn === defaultRecipient?.destCountry
        );
        return byName?.countryCode;
      })();

      const cityValue = (() => {
        if (!countryValue) return undefined;
        const targetCountry = countries.find((country) => country.countryCode === countryValue);
        const byName = targetCountry?.cities.find(
          (city) => city.cityName === defaultRecipient?.destCity || city.cityNameEn === defaultRecipient?.destCity
        );
        return byName?.cityCode;
      })();

      form.setFieldsValue({
        senderName: defaultSender?.senderName || client.logisticsInfo?.senderName || '',
        senderPhone: defaultSender?.senderPhone || client.logisticsInfo?.senderPhone || '',
        senderAddress: defaultSender?.senderAddress || client.logisticsInfo?.senderAddress || '',
        consigneeName: defaultRecipient?.consigneeName || client.logisticsInfo?.consigneeName || '',
        consigneePhone: defaultRecipient?.consigneePhone || client.logisticsInfo?.consigneePhone || '',
        consigneeEmail: defaultRecipient?.consigneeEmail || client.logisticsInfo?.consigneeEmail || '',
        consigneeAddress: defaultRecipient?.consigneeAddress || client.logisticsInfo?.consigneeAddress || '',
        senderCityId: defaultSender?.senderCityId || undefined,
        senderCountryId: defaultSender?.senderCountryId || undefined,
        consigneeCityId: defaultRecipient?.cityId || undefined,
        consigneeCountryId: defaultRecipient?.countryId || undefined,
        destCountry: countryValue || undefined,
        destCity: cityValue || undefined,
        serviceType: matchedLineProfile?.preferredServiceTypeCode || form.getFieldValue('serviceType'),
        paymentMethod: matchedLineProfile?.preferredPaymentMethod || form.getFieldValue('paymentMethod'),
        paymentChannel: matchedLineProfile?.preferredPaymentChannel || form.getFieldValue('paymentChannel'),
        routeCode: matchedLineProfile?.preferredRouteCode || form.getFieldValue('routeCode'),
      });
      message.success('已自动填充客户常用信息');
    } catch (error: any) {
      message.error(error.message || '获取客户信息失败');
    }
  };

  const destCountry = Form.useWatch('destCountry', form);
  const destCity = Form.useWatch('destCity', form);
  const transportType = Form.useWatch('transportType', form);
  const routeId = Form.useWatch('routeId', form);
  const cityOptions = useMemo(() => {
    const country = countries.find((item) => item.countryCode === destCountry);
    return country?.cities || [];
  }, [countries, destCountry]);

  const serviceTypeOptions = useMemo(() => {
    const mode = (transportType === 'AIR' ? 'AIR' : 'SEA') as 'AIR' | 'SEA';
    return (baseOptions.ORDER_SERVICE_TYPE || []).filter((item) => item.transportMode === 'ALL' || item.transportMode === mode);
  }, [baseOptions.ORDER_SERVICE_TYPE, transportType]);

  const expressCompanyOptions = baseOptions.EXPRESS_COMPANY || [];
  const formItemLayout = { labelCol: { flex: '88px' }, wrapperCol: { flex: 'auto' } };

  useEffect(() => {
    if (routeId) return;
    if (!destCountry || !destCity) return;
    form.setFieldValue('routeCode', buildRouteCode(destCountry, destCity));
  }, [routeId, destCountry, destCity, form]);

  useEffect(() => {
    if (!transportType) return;
    const currentServiceType = String(form.getFieldValue('serviceType') || '');
    const validCodes = serviceTypeOptions.map((item) => item.code);
    if (validCodes.length > 0 && !validCodes.includes(currentServiceType)) {
      form.setFieldValue('serviceType', validCodes[0]);
    }
  }, [transportType, form, serviceTypeOptions]);

  useEffect(() => {
    if (!selectedClient || !transportType) return;
    const profile = Array.isArray(selectedClient.lineProfiles)
      ? selectedClient.lineProfiles.find((item: any) => item.businessLine === transportType)
      : null;
    if (!profile) return;

    if (profile.preferredServiceTypeCode) form.setFieldValue('serviceType', profile.preferredServiceTypeCode);
    if (profile.preferredPaymentMethod) form.setFieldValue('paymentMethod', profile.preferredPaymentMethod);
    if (profile.preferredPaymentChannel) form.setFieldValue('paymentChannel', profile.preferredPaymentChannel);
    if (profile.preferredRouteCode) form.setFieldValue('routeCode', profile.preferredRouteCode);
  }, [transportType, selectedClient]);

  useEffect(() => {
    form.setFieldValue('transportType', resolvedTransportType);
  }, [resolvedTransportType, form]);

  useEffect(() => {
    const currentCurrency = form.getFieldValue('currency');
    if (currentCurrency) return;
    const preferred = currencyOptions.find((item) => item.code === 'CNY') || currencyOptions[0];
    if (preferred) form.setFieldValue('currency', preferred.code);
  }, [currencyOptions, form]);

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

  useEffect(() => {
    if (!initialExpressData) return;
    form.setFieldsValue({
      expressPackages: [{
        courier: initialExpressData.courier,
        trackingNo: initialExpressData.trackingNo,
        itemName: initialExpressData.itemName,
        pieces: initialExpressData.pieces,
        weight: initialExpressData.weight,
      }],
    });
    message.info('已自动填充快递信息，请补充完整订单信息');
    setTimeout(() => recalcStats(), 100);
  }, [initialExpressData]);

  const handleSmartPaste = (text: string) => {
    if (!text) return;
    const lines = text.split('\n').filter((l) => l.trim());
    const parsed = lines.map((line) => {
      const parts = line.split(/[\s\t,，]+/);
      return {
        courier: parts[0] || '',
        trackingNo: parts[1] || '',
        itemName: parts[2] || '未知品名',
        pieces: parseInt(parts[3] || '1', 10) || 1,
        weight: parseFloat(parts[4] || '0') || 0,
      };
    }).filter((p) => p.trackingNo);

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

  const handleSubmit = async () => {
    try {
      await form.validateFields([
        'clientCode',
        'serviceType',
        'senderName',
        'senderPhone',
        'consigneeName',
        'consigneePhone',
        'destCountry',
        'destCity',
        'consigneeAddress',
      ]);
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const values = form.getFieldsValue(true);
      const pkgs = (values.expressPackages || []).filter((p: any) => p?.trackingNo);
      const computedTotalPieces = pkgs.reduce((acc: number, pkg: any) => acc + (pkg?.pieces || 0), 0);
      const computedTotalWeight = pkgs.reduce((acc: number, pkg: any) => acc + (pkg?.weight || 0), 0);
      const computedTotalValue = pkgs.reduce((acc: number, pkg: any) => acc + (pkg?.declaredValue || 0), 0);
      const basePrice = values.transportType === 'AIR' ? 55 : values.transportType === 'SEA' ? 12 : 0;
      const computedFreight = computedTotalWeight > 0 ? computedTotalWeight * basePrice + 100 : 0;
      const finalRouteCode = values.routeCode || buildRouteCode(values.destCountry, values.destCity);
      const finalWarehouseEntryNo = String(values.warehouseEntryNo || '').trim() || undefined;
      const selectedCountry = countries.find((item) => item.countryCode === values.destCountry);
      const selectedCity = selectedCountry?.cities.find((item) => item.cityCode === values.destCity);
      const finalRemark = String(values.remark || '').trim();

      const payload = {
        customerId: values.clientCode,
        customerName: selectedClient?.name,
        senderProfileId: undefined,
        recipientAddressId: undefined,
        senderCityId: values.senderCityId,
        senderCountryId: values.senderCountryId,
        consigneeCityId: values.consigneeCityId,
        consigneeCountryId: values.consigneeCountryId,
        sender: values.senderName,
        senderPhone: values.senderPhone,
        senderAddress: values.senderAddress,
        consignee: values.consigneeName,
        consigneePhone: values.consigneePhone,
        consigneeEmail: values.consigneeEmail,
        destCountry: selectedCountry?.countryName || values.destCountry,
        destCity: selectedCity?.cityName || values.destCity,
        destAddress: values.consigneeAddress,
        transportType: values.transportType,
        serviceType: values.serviceType,
        routeId: values.routeId,
        routeCode: finalRouteCode,
        warehouseEntryNo: finalWarehouseEntryNo,
        containerType: values.containerType,
        totalPieces: computedTotalPieces,
        totalWeight: computedTotalWeight,
        totalVolume: computedTotalWeight * 0.001,
        totalValue: computedTotalValue,
        totalFreight: computedFreight,
        salesPerson: values.salesPerson,
        paymentMethod: values.paymentMethod,
        paymentChannel: values.paymentChannel,
        currency: values.currency,
        remark: finalRemark,
        expressPackages: pkgs.map((p: any) => ({
          courier: p.courier,
          trackingNo: p.trackingNo,
          itemName: p.itemName,
          category: p.category,
          cargoType: p.cargoType,
          pieces: p.pieces || 1,
          weight: p.weight || 0,
          declaredValue: p.declaredValue || 0,
          remark: p.remark,
        })),
      };
      onSubmit(payload);
    } catch (error: any) {
      message.error(error.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: token.colorTextHeading,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: 24,
  };

  const formItemStyle: React.CSSProperties = {
    marginBottom: 16,
  };

  return (
    <Form
      form={form}
      layout="horizontal"
      labelAlign="left"
      colon={false}
      size="middle"
      onValuesChange={() => setTimeout(recalcStats, 0)}
      initialValues={{
        expressPackages: [{}],
        paymentMethod: 'PREPAID',
        paymentChannel: 'WECHAT',
        currency: 'CNY',
        salesPerson: '张业务',
        transportType: resolvedTransportType,
        serviceType: resolvedTransportType === 'AIR' ? 'STANDARD_AIR' : 'LCL_SEA',
        senderName: '',
        senderPhone: '',
        senderAddress: '',
        consigneeName: '',
        consigneePhone: '',
        consigneeEmail: '',
        consigneeAddress: '',
        remark: '',
      }}
    >
      <Form.Item name="transportType" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="routeCode" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="salesPerson" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="currency" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="paymentMethod" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="paymentChannel" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="containerType" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="senderCityId" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="senderCountryId" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="consigneeCityId" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="consigneeCountryId" hidden>
        <Input />
      </Form.Item>

      <div style={{ padding: '2px 8px 0' }}>
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>基础信息</div>
          <Row gutter={20}>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="clientCode"
                label="客户"
                rules={[{ required: true, message: '请选择客户' }]}
                style={formItemStyle}
              >
                <Select
                  showSearch
                  placeholder="搜索客户代码/名称"
                  optionFilterProp="children"
                  onChange={handleClientChange}
                  loading={clientsLoading}
                >
                  {clients.map((client) => (
                    <Option key={client.id} value={client.id}>
                      {client.shortCode || client.id} - {client.name || client.customerName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="serviceType"
                label="服务类型"
                rules={[{ required: true, message: '请选择服务类型' }]}
                style={formItemStyle}
              >
                <Select placeholder="选择服务类型" loading={baseLoading}>
                  {serviceTypeOptions.map((item) => (
                    <Option key={item.code} value={item.code}>{item.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={20}>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="warehouseEntryNo"
                label="入仓号"
                tooltip="留空后系统自动生成短号，便于客户标注快递"
                style={formItemStyle}
              >
                <Input placeholder="留空自动生成短号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="routeId"
                label="线路"
                style={formItemStyle}
              >
                <Select
                  showSearch
                  allowClear
                  loading={routesLoading}
                  placeholder={routesLoading ? '加载线路中...' : '请选择线路'}
                  optionFilterProp="label"
                  onChange={(value) => handleRouteChange(value)}
                  options={routes.map((route: any) => ({
                    value: route.id,
                    label: `${route.originCountry}-${route.originCity} → ${route.destCountry}-${route.destCity}`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>发货信息</div>
          <Row gutter={20}>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="senderName"
                label="姓名"
                rules={[{ required: true, message: '请输入发货人姓名' }]}
                style={formItemStyle}
              >
                <Input placeholder="发货人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="senderPhone"
                label="电话"
                rules={[{ required: true, message: '请输入发货人电话' }]}
                style={formItemStyle}
              >
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={20}>
            <Col span={24}>
              <Form.Item
                {...formItemLayout}
                name="senderAddress"
                label="详细地址"
                rules={[{ required: true, message: '请输入发货地址' }]}
                style={{ ...formItemStyle, marginBottom: 0 }}
              >
                <Input placeholder="发货详细地址" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>收货信息</div>
          <Row gutter={20}>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="consigneeName"
                label="姓名"
                rules={[{ required: true, message: '请输入收货人姓名' }]}
                style={formItemStyle}
              >
                <Input placeholder="收货人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="consigneePhone"
                label="电话"
                rules={[{ required: true, message: '请输入收货人电话' }]}
                style={formItemStyle}
              >
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={20}>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="destCountry"
                label="国家"
                rules={[{ required: true, message: '请选择国家' }]}
                style={formItemStyle}
              >
                <Select
                  placeholder="选择国家"
                  loading={baseLoading}
                  onChange={() => {
                    form.setFieldsValue({
                      routeId: undefined,
                      destCity: undefined,
                    });
                  }}
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
              <Form.Item
                {...formItemLayout}
                name="destCity"
                label="城市"
                rules={[{ required: true, message: '请选择城市' }]}
                style={formItemStyle}
              >
                <Select
                  placeholder={destCountry ? '选择城市' : '请先选择国家'}
                  disabled={!destCountry}
                  loading={baseLoading}
                  onChange={() => form.setFieldValue('routeId', undefined)}
                >
                  {cityOptions.map((city) => (
                    <Option key={city.cityCode} value={city.cityCode}>
                      {city.cityName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={20}>
            <Col span={12}>
              <Form.Item {...formItemLayout} name="consigneeEmail" label="邮箱" style={formItemStyle}>
                <Input placeholder="邮箱（选填）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="consigneeAddress"
                label="详细地址"
                rules={[{ required: true, message: '请输入收货地址' }]}
                style={formItemStyle}
              >
                <Input placeholder="收货详细地址" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={sectionStyle}>
          <div style={{ ...sectionTitleStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>第三方运单 / 包裹明细</span>
            <Space size={12}>
              <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                合计：{totalPieces} 件 / {totalWeight.toFixed(2)} Kg
              </Text>
              <Button icon={<FileExcelOutlined />} onClick={() => setSmartPasteVisible(true)}>
                智能粘贴导入
              </Button>
            </Space>
          </div>

          <Form.List name="expressPackages">
            {(fields, { add, remove }) => (
              <>
                <Row
                  gutter={10}
                  style={{
                    background: token.colorFillAlter,
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  <Col span={4}>物流公司</Col>
                  <Col span={5}>第三方运单</Col>
                  <Col span={4}>品名</Col>
                  <Col span={3}>重量Kg</Col>
                  <Col span={2}>件数</Col>
                  <Col span={3}>货值USD</Col>
                  <Col span={2}>备注</Col>
                  <Col span={1}>删</Col>
                </Row>
                {fields.map(({ key, name, ...restField }) => (
                  <Row
                    key={key}
                    gutter={10}
                    align="middle"
                    style={{
                      padding: '8px 12px',
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  >
                    <Col span={4}>
                      <Form.Item {...restField} name={[name, 'courier']} noStyle>
                        <Select placeholder="物流公司" allowClear>
                          {expressCompanyOptions.map((item) => (
                            <Option key={item.code} value={item.label}>{item.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item {...restField} name={[name, 'trackingNo']} noStyle>
                        <Input placeholder="输入单号" />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item {...restField} name={[name, 'itemName']} noStyle>
                        <Input placeholder="输入品名" />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Form.Item {...restField} name={[name, 'weight']} noStyle>
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="0" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Form.Item {...restField} name={[name, 'pieces']} noStyle>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="1" />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Form.Item {...restField} name={[name, 'declaredValue']} noStyle>
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Form.Item {...restField} name={[name, 'remark']} noStyle>
                        <Input placeholder="备注" />
                      </Form.Item>
                    </Col>
                    <Col span={1}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => { remove(name); setTimeout(recalcStats, 0); }}
                      />
                    </Col>
                  </Row>
                ))}
                <div style={{ paddingTop: 10 }}>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                    添加一行
                  </Button>
                </div>
              </>
            )}
          </Form.List>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>备注</div>
          <Row gutter={20}>
            <Col span={24}>
              <Form.Item {...formItemLayout} name="remark" label="备注" style={{ marginBottom: 0 }}>
                <TextArea rows={3} maxLength={120} showCount placeholder="可补充备注说明（最多120字）" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div
          style={{
            marginTop: 8,
            paddingTop: 14,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space size={24}>
            <Text>总件数：<Text strong>{totalPieces}</Text></Text>
            <Text>总重量：<Text strong>{totalWeight.toFixed(2)} Kg</Text></Text>
            <Text>预估运费：<Text strong style={{ color: '#cf1322' }}>¥{estPrice.toFixed(2)}</Text></Text>
          </Space>
          <Space>
            <Button onClick={onCancel}>返回</Button>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              loading={submitting}
              onClick={handleSubmit}
              style={{ background: '#f0ad29', borderColor: '#f0ad29' }}
            >
              提交
            </Button>
          </Space>
        </div>
      </div>

      <Modal
        title="智能粘贴导入"
        open={smartPasteVisible}
        onCancel={() => setSmartPasteVisible(false)}
        onOk={() => {
          handleSmartPaste(smartPasteText);
          setSmartPasteVisible(false);
          setSmartPasteText('');
        }}
        okText="解析并添加"
        cancelText="取消"
      >
        <Text type="secondary">
          每行格式：快递公司 运单号 品名 件数 重量
          例如：顺丰 SF1001 手机壳 50 25.5
        </Text>
        <TextArea
          rows={10}
          style={{ marginTop: 12 }}
          value={smartPasteText}
          onChange={(e) => setSmartPasteText(e.target.value)}
          placeholder="请粘贴多行数据"
        />
      </Modal>
    </Form>
  );
};
