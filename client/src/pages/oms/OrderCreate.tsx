import React, { useState, useEffect, useMemo } from 'react';
import {
  Form, Input, Select, Button, Row, Col, Space,
  InputNumber, message, Typography, theme, Modal, Table, Tag
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

const normalizeCargoType = (value: unknown): 'GENERAL' | 'SENSITIVE' => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return 'GENERAL';
  if (raw === 'SENSITIVE' || raw.includes('SENSITIVE') || raw.includes('敏感') || raw.includes('非普')) {
    return 'SENSITIVE';
  }
  return 'GENERAL';
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
  const [senderPickerVisible, setSenderPickerVisible] = useState(false);
  const [receiverPickerVisible, setReceiverPickerVisible] = useState(false);
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

      // 自动生成入仓号：客户编号 + 3位流水号
      const customerCode = client.shortCode || client.customerCode || clientId.slice(-3).toUpperCase();
      const seq = String(Math.floor(Math.random() * 900) + 100); // mock: 100-999
      const entryNo = `${customerCode}${seq}`;

      form.setFieldsValue({
        warehouseEntryNo: entryNo,
        senderName: defaultSender?.senderName || client.logisticsInfo?.senderName || '',
        senderPhone: defaultSender?.senderPhone || client.logisticsInfo?.senderPhone || '',
        senderAddress: defaultSender?.senderAddress || client.logisticsInfo?.senderAddress || '',
        receivers: [{
          consigneeName: defaultRecipient?.consigneeName || client.logisticsInfo?.consigneeName || '',
          consigneePhone: defaultRecipient?.consigneePhone || client.logisticsInfo?.consigneePhone || '',
          consigneeEmail: defaultRecipient?.consigneeEmail || '',
          consigneeAddress: defaultRecipient?.consigneeAddress || client.logisticsInfo?.consigneeAddress || '',
          destCountry: countryValue || undefined,
          destCity: cityValue || undefined,
          consigneeZipCode: defaultRecipient?.consigneeZipCode || '',
        }],
        senderCityId: defaultSender?.senderCityId || undefined,
        senderCountryId: defaultSender?.senderCountryId || undefined,
        consigneeCityId: defaultRecipient?.cityId || undefined,
        consigneeCountryId: defaultRecipient?.countryId || undefined,
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

  const transportType = Form.useWatch('transportType', form);

  const serviceTypeOptions = useMemo(() => {
    const mode = (transportType === 'AIR' ? 'AIR' : 'SEA') as 'AIR' | 'SEA';
    return (baseOptions.ORDER_SERVICE_TYPE || []).filter((item) => item.transportMode === 'ALL' || item.transportMode === mode);
  }, [baseOptions.ORDER_SERVICE_TYPE, transportType]);

  const expressCompanyOptions = baseOptions.EXPRESS_COMPANY || [];
  const cargoTypeOptions = useMemo(() => {
    const rows = baseOptions.CARGO_TYPE || [];
    if (rows.length > 0) {
      return rows.map((item) => ({
        value: item.code,
        label: item.label,
      }));
    }
    return [
      { value: 'GENERAL', label: '普货' },
      { value: 'SENSITIVE', label: '非普货' },
    ];
  }, [baseOptions.CARGO_TYPE]);
  const remarkTagOptions = (baseOptions.ORDER_REMARK_TAG && baseOptions.ORDER_REMARK_TAG.length > 0)
    ? baseOptions.ORDER_REMARK_TAG
    : [
        { code: 'NO_BATTERY', label: '无电池', transportMode: 'ALL' as const },
        { code: 'URGENT', label: '加急处理', transportMode: 'ALL' as const },
        { code: 'FRAGILE', label: '易碎品', transportMode: 'ALL' as const },
      ];
  const formItemLayout = { labelCol: { flex: '88px' }, wrapperCol: { flex: 'auto' } };

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
          cargoType: 'GENERAL',
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
        ['receivers', 0, 'consigneeName'],
        ['receivers', 0, 'consigneePhone'],
        ['receivers', 0, 'destCountry'],
        ['receivers', 0, 'consigneeAddress'],
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
      const primaryReceiver = values.receivers?.[0] || {};
      const finalRouteCode = values.routeCode || buildRouteCode(primaryReceiver.destCountry, primaryReceiver.destCity);
      const finalWarehouseEntryNo = String(values.warehouseEntryNo || '').trim() || undefined;
      const selectedCountry = countries.find((item) => item.countryCode === primaryReceiver.destCountry);
      const selectedCity = selectedCountry?.cities.find((item) => item.cityCode === primaryReceiver.destCity);
      const selectedRemarkTags = Array.isArray(values.remarkTags)
        ? values.remarkTags.filter((item: unknown) => String(item || '').trim())
        : [];
      const customRemark = String(values.remarkCustom || '').trim();
      const fixedRemark = selectedRemarkTags.length > 0 ? `固定备注: ${selectedRemarkTags.join('、')}` : '';
      const finalRemark = [fixedRemark, customRemark].filter(Boolean).join('；');

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
        consignee: primaryReceiver.consigneeName,
        consigneePhone: primaryReceiver.consigneePhone,
        consigneeEmail: primaryReceiver.consigneeEmail,
        destCountry: selectedCountry?.countryName || primaryReceiver.destCountry,
        destCity: selectedCity?.cityName || primaryReceiver.destCity,
        destAddress: primaryReceiver.consigneeAddress,
        consigneeState: primaryReceiver.consigneeState,
        consigneeZipCode: primaryReceiver.consigneeZipCode,
        allReceivers: values.receivers,
        transportType: values.transportType,
        serviceType: values.serviceType,
        routeId: values.routeId,
        routeCode: finalRouteCode,
        warehouseEntryNo: finalWarehouseEntryNo,
        exportMode: values.exportMode,
        containerType: values.containerType,
        totalPieces: computedTotalPieces,
        totalWeight: computedTotalWeight,
        totalVolume: computedTotalWeight * 0.001,
        totalValue: computedTotalValue,
        totalFreight: computedFreight,
        salesPerson: values.salesPerson,
        paymentMethod: values.paymentMethod,
        paymentChannel: values.paymentChannel,
        deliveryMethod: values.deliveryMethod || null,
        currency: values.currency,
        remark: finalRemark,
        expressPackages: pkgs.map((p: any) => ({
          courier: p.courier,
          trackingNo: p.trackingNo,
          itemName: p.itemName,
          category: p.category,
          cargoType: normalizeCargoType(p.cargoType),
          pieces: p.pieces || 1,
          weight: p.weight || 0,
          length: p.length || undefined,
          width: p.width || undefined,
          height: p.height || undefined,
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
        expressPackages: [{ cargoType: 'GENERAL' }],
        paymentMethod: 'PREPAID',
        paymentChannel: 'PUBLIC_ACCOUNT',
        deliveryMethod: undefined,
        currency: 'CNY',
        salesPerson: '张业务',
        transportType: resolvedTransportType,
        serviceType: resolvedTransportType === 'AIR' ? 'STANDARD_AIR' : 'LCL_SEA',
        exportMode: 'BUYER_EXPORT',
        senderName: '',
        senderPhone: '',
        senderAddress: '',
        receivers: [{}],
        remarkTags: [],
        remarkCustom: '',
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
      {/* paymentMethod / paymentChannel / deliveryMethod 已移到基础信息区域可见 */}
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
                tooltip="选择客户后自动生成，格式：客户编号+流水号"
                style={formItemStyle}
              >
                <Input
                  placeholder={selectedClient ? '已自动生成' : '请先选择客户'}
                  readOnly
                  style={{ fontFamily: 'monospace', fontWeight: 600 }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="exportMode"
                label="出口方式"
                style={formItemStyle}
              >
                <Select>
                  <Option value="BUYER_EXPORT">买单出口</Option>
                  <Option value="SELF_DOCS_EXPORT">自备单证出口</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={20}>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="paymentMethod"
                label="支付方式"
                style={formItemStyle}
              >
                <Select>
                  <Option value="PREPAID">预付</Option>
                  <Option value="COLLECT">到付</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                {...formItemLayout}
                name="deliveryMethod"
                label="交付方式"
                style={formItemStyle}
              >
                <Select placeholder="可选，入库后由仓管决定" allowClear>
                  <Option value="DELIVERY">配送（送货上门）</Option>
                  <Option value="PICKUP">自提（客户到站取货）</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={sectionStyle}>
          <div style={{ ...sectionTitleStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>发货信息</span>
            {selectedClient && (
              <Button type="link" size="small" onClick={() => setSenderPickerVisible(true)}>从客户发货人中选择</Button>
            )}
          </div>
          <Modal
            title="选择发货人"
            open={senderPickerVisible}
            onCancel={() => setSenderPickerVisible(false)}
            footer={null}
            width={700}
            destroyOnClose
          >
            <Table
              dataSource={[
                ...(selectedClient?.logisticsInfo?.senderContacts || []),
                ...(selectedClient?.senderProfiles || []),
              ].map((c: any, i: number) => ({ ...c, _idx: i }))}
              rowKey="_idx"
              size="small"
              pagination={false}
              columns={[
                { title: '姓名', dataIndex: 'senderName', key: 'name', width: 100, render: (_: any, r: any) => r.senderName || r.name || '-' },
                { title: '电话', dataIndex: 'senderPhone', key: 'phone', width: 130, render: (_: any, r: any) => r.senderPhone || r.phone || '-' },
                { title: '国家', dataIndex: 'senderCountry', key: 'country', width: 80, render: (_: any, r: any) => r.senderCountry || r.country || '-' },
                { title: '城市', dataIndex: 'senderCity', key: 'city', width: 80, render: (_: any, r: any) => r.senderCity || r.city || '-' },
                { title: '地址', dataIndex: 'senderAddress', key: 'address', ellipsis: true, render: (_: any, r: any) => r.senderAddress || r.address || '-' },
                {
                  title: '操作', key: 'action', width: 70,
                  render: (_: any, r: any) => (
                    <Button type="link" size="small" onClick={() => {
                      form.setFieldsValue({
                        senderName: r.senderName || r.name || '',
                        senderPhone: r.senderPhone || r.phone || '',
                        senderAddress: r.senderAddress || r.address || '',
                      });
                      setSenderPickerVisible(false);
                      message.success('已选择发货人');
                    }}>选择</Button>
                  ),
                },
              ]}
              locale={{ emptyText: '暂无发货人信息，请先在客户详情中添加' }}
            />
          </Modal>
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
          <div style={{ ...sectionTitleStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>收货信息</span>
            {selectedClient && (
              <Button type="link" size="small" onClick={() => setReceiverPickerVisible(true)}>从客户收件人中选择</Button>
            )}
          </div>
          <Modal
            title="选择收件人"
            open={receiverPickerVisible}
            onCancel={() => setReceiverPickerVisible(false)}
            footer={null}
            width={850}
            destroyOnClose
          >
            <Table
              dataSource={[
                ...(selectedClient?.logisticsInfo?.receiverContacts || []),
                ...(selectedClient?.recipientAddresses || []),
              ].map((c: any, i: number) => ({ ...c, _idx: i }))}
              rowKey="_idx"
              size="small"
              pagination={false}
              columns={[
                { title: '姓名', key: 'name', width: 90, render: (_: any, r: any) => r.consigneeName || r.name || '-' },
                { title: '电话', key: 'phone', width: 130, render: (_: any, r: any) => r.consigneePhone || r.phone || '-' },
                { title: '国家', key: 'country', width: 80, render: (_: any, r: any) => r.consigneeCountry || r.country || '-' },
                { title: '城市', key: 'city', width: 80, render: (_: any, r: any) => r.consigneeCity || r.city || '-' },
                { title: '邮编', key: 'zip', width: 70, render: (_: any, r: any) => r.consigneeZipCode || r.zipCode || '-' },
                { title: '地址', key: 'address', ellipsis: true, render: (_: any, r: any) => r.consigneeAddress || r.address || '-' },
                {
                  title: '操作', key: 'action', width: 70,
                  render: (_: any, r: any) => (
                    <Button type="link" size="small" onClick={() => {
                      const receivers = form.getFieldValue('receivers') || [];
                      const newReceiver = {
                        consigneeName: r.consigneeName || r.name || '',
                        consigneePhone: r.consigneePhone || r.phone || '',
                        destCountry: r.consigneeCountry || r.countryId || '',
                        destCity: r.consigneeCity || r.cityId || '',
                        consigneeState: r.consigneeState || '',
                        consigneeZipCode: r.consigneeZipCode || r.zipCode || '',
                        consigneeAddress: r.consigneeAddress || r.address || '',
                        consigneeEmail: r.consigneeEmail || r.email || '',
                      };
                      const first = receivers[0];
                      const isFirstEmpty = !first?.consigneeName && !first?.consigneePhone;
                      form.setFieldsValue({
                        receivers: isFirstEmpty ? [newReceiver] : [...receivers, newReceiver],
                      });
                      setReceiverPickerVisible(false);
                      message.success('已添加收件人');
                    }}>选择</Button>
                  ),
                },
              ]}
              locale={{ emptyText: '暂无收件人信息，请先在客户详情中添加' }}
            />
          </Modal>

          <Form.List name="receivers" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => (
                  <div key={key} style={{ background: index % 2 === 0 ? '#fafafa' : '#fff', padding: '12px 8px', borderRadius: 6, marginBottom: 8, position: 'relative' }}>
                    {fields.length > 1 && (
                      <div style={{ position: 'absolute', right: 8, top: 8 }}>
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)}>删除</Button>
                      </div>
                    )}
                    {fields.length > 1 && <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>收件人 #{index + 1}</Text>}
                    <Row gutter={20}>
                      <Col span={12}>
                        <Form.Item {...restField} {...formItemLayout} name={[name, 'consigneeName']} label="姓名"
                          rules={[{ required: true, message: '请输入收货人姓名' }]} style={formItemStyle}>
                          <Input placeholder="收货人姓名" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item {...restField} {...formItemLayout} name={[name, 'consigneePhone']} label="电话"
                          rules={[{ required: true, message: '请输入收货人电话' }]} style={formItemStyle}>
                          <Input placeholder="联系电话（含国际区号）" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={20}>
                      <Col span={12}>
                        <Form.Item {...restField} {...formItemLayout} name={[name, 'destCountry']} label="国家"
                          rules={[{ required: true, message: '请选择国家' }]} style={formItemStyle}>
                          <Select placeholder="选择国家" loading={baseLoading}>
                            {countries.map((country) => (
                              <Option key={country.countryCode} value={country.countryCode}>
                                {country.countryName}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item {...restField} {...formItemLayout} name={[name, 'destCity']} label="城市" style={formItemStyle}>
                          <Input placeholder="城市名称" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={20}>
                      <Col span={12}>
                        <Form.Item {...restField} {...formItemLayout} name={[name, 'consigneeState']} label="州/省" style={formItemStyle}>
                          <Input placeholder="州/省（如适用）" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item {...restField} {...formItemLayout} name={[name, 'consigneeZipCode']} label="邮编" style={formItemStyle}>
                          <Input placeholder="邮政编码" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={20}>
                      <Col span={12}>
                        <Form.Item {...restField} {...formItemLayout} name={[name, 'consigneeAddress']} label="详细地址"
                          rules={[{ required: true, message: '请输入收货地址' }]} style={formItemStyle}>
                          <Input placeholder="街道门牌号等详细地址" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item {...restField} {...formItemLayout} name={[name, 'consigneeEmail']} label="邮箱" style={formItemStyle}>
                          <Input placeholder="邮箱（选填）" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginBottom: 0 }}>
                  添加收件人
                </Button>
              </>
            )}
          </Form.List>
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
                  <Col span={3}>物流公司</Col>
                  <Col span={4}>第三方运单</Col>
                  <Col span={3}>品名</Col>
                  <Col span={2}>货物属性</Col>
                  <Col span={2}>重量Kg</Col>
                  <Col span={2}>件数</Col>
                  <Col span={5}>尺寸(长×宽×高 cm)</Col>
                  <Col span={2}>货值USD</Col>
                  <Col span={1}></Col>
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
                    <Col span={3}>
                      <Form.Item {...restField} name={[name, 'courier']} noStyle>
                        <Select placeholder="物流公司" allowClear>
                          {expressCompanyOptions.map((item) => (
                            <Option key={item.code} value={item.label}>{item.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item {...restField} name={[name, 'trackingNo']} noStyle>
                        <Input placeholder="输入单号" />
                      </Form.Item>
                    </Col>
                    <Col span={3}>
                      <Form.Item {...restField} name={[name, 'itemName']} noStyle>
                        <Input placeholder="品名" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Form.Item {...restField} name={[name, 'cargoType']} noStyle>
                        <Select placeholder="普/非普">
                          {cargoTypeOptions.map((item) => (
                            <Option key={item.value} value={item.value}>{item.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Form.Item {...restField} name={[name, 'weight']} noStyle>
                        <InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="Kg" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Form.Item {...restField} name={[name, 'pieces']} noStyle>
                        <InputNumber min={1} style={{ width: '100%' }} placeholder="件" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Row gutter={4}>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'length']} noStyle>
                            <InputNumber min={0} precision={1} style={{ width: '100%' }} placeholder="长" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'width']} noStyle>
                            <InputNumber min={0} precision={1} style={{ width: '100%' }} placeholder="宽" />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'height']} noStyle>
                            <InputNumber min={0} precision={1} style={{ width: '100%' }} placeholder="高" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>
                    <Col span={2}>
                      <Form.Item {...restField} name={[name, 'declaredValue']} noStyle>
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="USD" />
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
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ cargoType: 'GENERAL' })} block>
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
              <Form.Item {...formItemLayout} name="remarkTags" label="固定备注" style={formItemStyle}>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="选择固定备注（可多选）"
                  options={remarkTagOptions.map((item) => ({ value: item.code, label: item.label }))}
                />
              </Form.Item>
              <Form.Item {...formItemLayout} name="remarkCustom" label="自定义备注" style={{ marginBottom: 0 }}>
                <TextArea rows={3} maxLength={120} showCount placeholder="补充自定义说明（最多120字）" />
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
