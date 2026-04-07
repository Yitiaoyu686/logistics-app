import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Input, Select, Tag, Modal, Form, message, Row, Col, Space, Badge, DatePicker, Popconfirm, Drawer, Tabs, Timeline, Card, Descriptions, Statistic, Typography, Divider, Alert, Collapse, Upload, Checkbox, Image } from 'antd';
import { PlusOutlined, SearchOutlined, UserOutlined, ExportOutlined, SwapOutlined, PhoneOutlined, MailOutlined, HomeOutlined, HistoryOutlined, FileTextOutlined, UploadOutlined, DeleteOutlined, EyeOutlined, BankOutlined, IdcardOutlined, GlobalOutlined, MinusCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { clientApi, v2OmsApi } from '../../api';

// Status mappings between API (English) and UI (Chinese)
const STATUS_MAP: Record<string, ClientStatus> = { ACTIVE: '活跃', DORMANT: '沉睡', FROZEN: '冻结' };
const STATUS_MAP_REV: Record<string, string> = { '活跃': 'ACTIVE', '沉睡': 'DORMANT', '冻结': 'FROZEN' };
const POOL_MAP: Record<string, ClientPoolType> = { PRIVATE: '私海', PUBLIC: '公海' };
const mapClient = (c: any): Client => ({ ...c, status: STATUS_MAP[c.status] || c.status, poolType: POOL_MAP[c.poolType] || c.poolType });


const { Option } = Select;
const { Text } = Typography;

// ============ 入仓号 Mock 数据 & 工具 ============
type WarehouseEntryStatus = '待使用' | '已关联' | '已入库' | '已失效';
interface WarehouseEntry {
  id: string;
  entryNo: string;
  clientId: string;
  status: WarehouseEntryStatus;
  orderId?: string;
  orderNo?: string;
  createdAt: string;
  usedAt?: string;
}

// 全局 mock 入仓号存储
const globalWarehouseEntries: WarehouseEntry[] = [];
let _entryInited = false;

function initMockEntries(clients: Client[]) {
  if (_entryInited) return;
  _entryInited = true;
  const now = dayjs();
  clients.forEach((c, ci) => {
    const code = c.shortCode;
    // 每个客户生成 3~5 条入仓号
    const count = 3 + (ci % 3);
    for (let i = 1; i <= count; i++) {
      const seq = String(i).padStart(3, '0');
      const entryNo = `${code}${seq}`;
      const daysAgo = count - i;
      const status: WarehouseEntryStatus =
        i === count ? '待使用' :
        i === count - 1 ? '已关联' :
        i <= 2 ? '已入库' : '已失效';
      globalWarehouseEntries.push({
        id: `WE-${c.id}-${i}`,
        entryNo,
        clientId: c.id,
        status,
        orderId: status === '已关联' || status === '已入库' ? `ORDER-MOCK-${ci}-${i}` : undefined,
        orderNo: status === '已关联' || status === '已入库' ? `S-${now.subtract(daysAgo, 'day').format('YYYYMMDD')}00000${i}` : undefined,
        createdAt: now.subtract(daysAgo + 2, 'day').format('YYYY-MM-DD HH:mm'),
        usedAt: status !== '待使用' ? now.subtract(daysAgo, 'day').format('YYYY-MM-DD HH:mm') : undefined,
      });
    }
  });
}

function getEntriesForClient(clientId: string): WarehouseEntry[] {
  return globalWarehouseEntries.filter(e => e.clientId === clientId);
}

function generateNextEntryNo(clientCode: string): string {
  const existing = globalWarehouseEntries.filter(e => e.entryNo.startsWith(clientCode));
  const maxSeq = existing.reduce((max, e) => {
    const seqStr = e.entryNo.slice(clientCode.length);
    const n = parseInt(seqStr, 10);
    return n > max ? n : max;
  }, 0);
  const next = maxSeq + 1;
  const digits = next > 999 ? 4 : 3;
  return `${clientCode}${String(next).padStart(digits, '0')}`;
}

// Mock 企业资质数据 —— 根据客户序号轮转注入不同类型
const MOCK_ENTERPRISE_INFOS: Record<string, any> = {
  COMPANY_CN: {
    entityType: 'COMPANY_CN',
    companyName: '深圳市张三国际贸易有限公司',
    unifiedCreditCode: '91440300MA5G1234X8',
    legalRepresentative: '张三',
    registeredAddress: '深圳市南山区科技园南区数字大厦18楼1806室',
    taxpayerId: '91440300MA5G1234X8',
    invoiceAddress: '深圳市南山区科技园南区数字大厦18楼1806室',
    invoicePhone: '0755-86001234',
    bankName: '中国工商银行深圳南山支行',
    bankAccount: '4000 1234 1000 8888 9999',
    contactPhone: '0755-86001234',
    contactEmail: 'zhang3trade@163.com',
  },
  COMPANY_OVERSEAS: {
    entityType: 'COMPANY_OVERSEAS',
    overseasCompanyName: 'Yiwu Global Trading LLC',
    overseasCountry: '美国',
    overseasRegNumber: 'EIN-88-1234567',
    overseasTaxNumber: '88-1234567',
    overseasDirector: 'Michael Chen',
    customFields: [
      { label: 'D-U-N-S Number', value: '12-345-6789' },
      { label: 'State of Incorporation', value: 'Delaware' },
    ],
    bankName: 'Bank of America',
    bankAccount: '4851 0012 3456 7890',
  },
  INDIVIDUAL: {
    entityType: 'INDIVIDUAL',
    realName: '李明',
    idType: 'ID_CARD',
    idNumber: '440305199501011234',
    contactPhone: '13900001111',
    contactEmail: 'liming@qq.com',
    bankName: '招商银行深圳分行',
  },
};
const ENTERPRISE_TYPES = ['COMPANY_CN', 'COMPANY_OVERSEAS', 'INDIVIDUAL', null]; // 第4个为"未设置"
function injectMockEnterpriseInfo(clients: Client[]): Client[] {
  return clients.map((c, idx) => {
    if (c.enterpriseInfo) return c; // 已有则不覆盖
    const typeKey = ENTERPRISE_TYPES[idx % ENTERPRISE_TYPES.length];
    return { ...c, enterpriseInfo: typeKey ? MOCK_ENTERPRISE_INFOS[typeKey] : undefined };
  });
}

// --- INLINED TYPES ---
export type ClientStatus = '活跃' | '沉睡' | '冻结'; 
export type ClientPoolType = '私海' | '公海'; 

export interface ClientContact {
  name: string;
  phone: string;
  email?: string;
}

export interface SenderContactInfo {
  id: string;
  label?: string;
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  senderCity?: string;
  senderCountry?: string;
}

export interface ReceiverContactInfo {
  id: string;
  label?: string;
  consigneeName?: string;
  consigneePhone?: string;
  consigneeAddress?: string;
  consigneeCity?: string;
  consigneeCountry?: string;
  consigneeZipCode?: string;
}

// 物流下单信息
export interface LogisticsInfo {
  // 发货人信息
  senderName?: string;
  senderPhone?: string;
  senderAddress?: string;
  senderCity?: string;
  senderCountry?: string;

  // 收货人信息
  consigneeName?: string;
  consigneePhone?: string;
  consigneeAddress?: string;
  consigneeCity?: string;
  consigneeCountry?: string;
  consigneeZipCode?: string;

  // 常用物流信息
  preferredTransportType?: string; // 偏好运输方式：SEA/AIR
  preferredRoute?: string; // 常用线路
  preferredServiceType?: string; // 服务类型：普通/加急
  paymentMethod?: string; // 付款方式：预付/到付
  senderContacts?: SenderContactInfo[]; // 多条发货信息
  receiverContacts?: ReceiverContactInfo[]; // 多条收货信息
  contactPairs?: any[]; // 兼容历史结构
}

export interface Client {
  id: string;
  shortCode: string;
  name: string;
  country: string;
  status: ClientStatus;
  poolType: ClientPoolType;
  salesId?: string;
  totalOrders: number;
  lastOrderTime?: string;
  enterPoolTime?: string;
  createdAt: string;
  contact: ClientContact;
  industry?: string;
  address?: string;
  source?: string;
  targetCountries?: string[];
  salesPerson?: string; // 业务员
  remark?: string; // 备注
  companyType?: string; // 公司类型
  creditLevel?: string; // 信用等级
  logisticsInfo?: LogisticsInfo; // 物流下单信息
  enterpriseInfo?: any; // 企业资质信息
}

interface ClientPoolLog {
  id: string;
  action: 'CLAIM' | 'RELEASE' | 'TRANSFER' | 'AUTO_RELEASE';
  fromPoolType?: 'PRIVATE' | 'PUBLIC';
  toPoolType?: 'PRIVATE' | 'PUBLIC';
  fromSalesId?: string;
  toSalesId?: string;
  operatorId?: string;
  operatorName?: string;
  reason?: string;
  createdAt: string;
}

interface SalesUser {
  id: string;
  username: string;
  realName?: string;
  roleCode?: string;
  status?: string;
}

interface ClaimRequestMock {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  applicantId?: string;
  applicantName: string;
  targetSalesId?: string;
  targetSalesName: string;
  reason?: string;
  publicNotice: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedAt: string;
  reviewedAt?: string;
  reviewerName?: string;
  reviewRemark?: string;
}

function getLocalUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function resolvePreferredSalesUserId(salesUsers: SalesUser[]): string | null {
  const localUser: any = getLocalUser();
  const byId = salesUsers.find((item) => item.id === localUser?.id);
  if (byId?.id) return byId.id;
  const byUsername = salesUsers.find((item) => item.username && item.username === localUser?.username);
  if (byUsername?.id) return byUsername.id;
  const byRealName = salesUsers.find((item) => item.realName && item.realName === localUser?.realName);
  if (byRealName?.id) return byRealName.id;
  return salesUsers[0]?.id || null;
}

// --- 1. Customer Form Drawer ---
interface CustomerFormProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (values: any) => void;
  initialValues?: Partial<Client>;
  poolType: ClientPoolType;
}

export const CustomerFormDrawer: React.FC<CustomerFormProps> = ({ open, onCancel, onSuccess, initialValues, poolType }) => {
  const [form] = Form.useForm();
  const isEdit = !!initialValues?.id;

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initialValues) {
        form.setFieldsValue({
            ...initialValues,
            contactName: initialValues.contact?.name,
            contactPhone: initialValues.contact?.phone,
            contactEmail: initialValues.contact?.email,
            // 物流信息
            senderName: initialValues.logisticsInfo?.senderName,
            senderPhone: initialValues.logisticsInfo?.senderPhone,
            senderAddress: initialValues.logisticsInfo?.senderAddress,
            senderCity: initialValues.logisticsInfo?.senderCity,
            senderCountry: initialValues.logisticsInfo?.senderCountry,
            consigneeName: initialValues.logisticsInfo?.consigneeName,
            consigneePhone: initialValues.logisticsInfo?.consigneePhone,
            consigneeAddress: initialValues.logisticsInfo?.consigneeAddress,
            consigneeCity: initialValues.logisticsInfo?.consigneeCity,
            consigneeCountry: initialValues.logisticsInfo?.consigneeCountry,
            consigneeZipCode: initialValues.logisticsInfo?.consigneeZipCode,
            preferredTransportType: initialValues.logisticsInfo?.preferredTransportType,
            preferredRoute: initialValues.logisticsInfo?.preferredRoute,
            preferredServiceType: initialValues.logisticsInfo?.preferredServiceType,
            paymentMethod: initialValues.logisticsInfo?.paymentMethod,
            // 企业资质
            enterpriseInfo: initialValues.enterpriseInfo || undefined,
        });
      }
    }
  }, [open, initialValues, form]);

  const handleOk = () => {
    form.validateFields().then(values => {
      const logisticsInfo = {
        senderName: values.senderName,
        senderPhone: values.senderPhone,
        senderAddress: values.senderAddress,
        senderCity: values.senderCity,
        senderCountry: values.senderCountry,
        consigneeName: values.consigneeName,
        consigneePhone: values.consigneePhone,
        consigneeAddress: values.consigneeAddress,
        consigneeCity: values.consigneeCity,
        consigneeCountry: values.consigneeCountry,
        consigneeZipCode: values.consigneeZipCode,
        preferredTransportType: values.preferredTransportType,
        preferredRoute: values.preferredRoute,
        preferredServiceType: values.preferredServiceType,
        paymentMethod: values.paymentMethod,
      };
      const hasLogisticsInfo = Object.values(logisticsInfo).some((value) => value !== undefined && value !== null && value !== '');

      onSuccess({
        ...initialValues,
        ...values,
        poolType: isEdit ? initialValues.poolType : poolType,
        logisticsInfo: hasLogisticsInfo ? logisticsInfo : undefined,
        enterpriseInfo: values.enterpriseInfo?.entityType ? values.enterpriseInfo : undefined,
      });
      form.resetFields();
    });
  };

  return (
    <Drawer
      title={isEdit ? '编辑客户' : '新增客户'}
      open={open}
      onClose={onCancel}
      width={960}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={handleOk}>{isEdit ? '保存' : '创建'}</Button>
        </Space>
      }
    >
      <Form form={form} layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }}>
        {/* Section 1: 基本信息 */}
        <Divider plain style={{ fontSize: 13, marginTop: 0 }}>基本信息</Divider>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="name" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
              <Input placeholder="公司全称/客户名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="country" label="所在国家" rules={[{ required: true, message: '请选择国家' }]}>
              <Select placeholder="选择国家">
                <Option value="中国">中国</Option>
                <Option value="尼日利亚">尼日利亚</Option>
                <Option value="加纳">加纳</Option>
                <Option value="美国">美国</Option>
                <Option value="英国">英国</Option>
                <Option value="日本">日本</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="industry" label="所属行业">
              <Select placeholder="选择行业" allowClear>
                <Option value="电商">电商</Option>
                <Option value="制造业">制造业</Option>
                <Option value="贸易">贸易</Option>
                <Option value="零售">零售</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="source" label="客户来源">
              <Select placeholder="选择来源" allowClear>
                <Option value="线上推广">线上推广</Option>
                <Option value="老客介绍">老客介绍</Option>
                <Option value="展会">展会</Option>
                <Option value="电话营销">电话营销</Option>
                <Option value="销售录入">销售录入</Option>
                <Option value="其他">其他</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Section 2: 联系信息 */}
        <Divider plain style={{ fontSize: 13 }}>联系信息</Divider>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="contactName" label="联系人" rules={[{ required: true, message: '请输入联系人' }]}>
              <Input placeholder="联系人姓名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
              <Input placeholder="手机号码" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name="contactEmail" label="邮箱">
              <Input placeholder="电子邮箱" />
            </Form.Item>
          </Col>
        </Row>

        {/* Section 3: 企业资质信息 */}
        <Divider plain style={{ fontSize: 13 }}>企业资质信息</Divider>
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item name={['enterpriseInfo', 'entityType']} label="客户类型">
              <Select placeholder="选择类型" allowClear>
                <Option value="COMPANY_CN">中国企业</Option>
                <Option value="COMPANY_OVERSEAS">海外企业</Option>
                <Option value="INDIVIDUAL">个人</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        {/* 中国企业 */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.enterpriseInfo?.entityType !== cur?.enterpriseInfo?.entityType}>
          {({ getFieldValue }) => {
            const entityType = getFieldValue(['enterpriseInfo', 'entityType']);
            if (entityType === 'COMPANY_CN') return (
              <>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'companyName']} label="公司全称">
                      <Input placeholder="营业执照上的公司全称" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'unifiedCreditCode']} label="信用代码"
                      rules={[{ pattern: /^[0-9A-Z]{18}$/, message: '请输入18位信用代码' }]}>
                      <Input placeholder="18位统一社会信用代码" maxLength={18} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'legalRepresentative']} label="法定代表人">
                      <Input placeholder="法定代表人姓名" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'registeredAddress']} label="注册地址">
                      <Input placeholder="营业执照上的注册地址" />
                    </Form.Item>
                  </Col>
                </Row>
                <Divider plain style={{ fontSize: 12 }}>开票信息</Divider>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'taxpayerId']} label="纳税人识别号">
                      <Input placeholder="通常同统一社会信用代码" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'invoiceAddress']} label="开票地址">
                      <Input placeholder="开票地址" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'invoicePhone']} label="开票电话">
                      <Input placeholder="开票电话" />
                    </Form.Item>
                  </Col>
                </Row>
                <Divider plain style={{ fontSize: 12 }}>联系方式</Divider>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'contactPhone']} label="联系电话">
                      <Input placeholder="公司联系电话" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'contactEmail']} label="邮箱">
                      <Input placeholder="企业邮箱" />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            );
            if (entityType === 'COMPANY_OVERSEAS') return (
              <>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'overseasCompanyName']} label="公司名称">
                      <Input placeholder="Registered company name" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'overseasCountry']} label="注册国家">
                      <Select placeholder="选择国家">
                        <Option value="尼日利亚">尼日利亚</Option>
                        <Option value="加纳">加纳</Option>
                        <Option value="美国">美国</Option>
                        <Option value="英国">英国</Option>
                        <Option value="其他">其他</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'overseasRegNumber']} label="注册号">
                      <Input placeholder="RC/BN/RGD Number" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'overseasTaxNumber']} label="税号 TIN">
                      <Input placeholder="Tax identification number" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'overseasDirector']} label="负责人">
                      <Input placeholder="负责人 / Owner name" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.List name={['enterpriseInfo', 'customFields']}>
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Row gutter={24} key={key} align="middle">
                          <Col span={11}>
                            <Form.Item {...restField} name={[name, 'label']} label="字段名" rules={[{ required: true, message: '请输入字段名' }]}>
                              <Input placeholder="如 CAC Number" />
                            </Form.Item>
                          </Col>
                          <Col span={11}>
                            <Form.Item {...restField} name={[name, 'value']} label="字段值" rules={[{ required: true, message: '请输入字段值' }]}>
                              <Input placeholder="字段值" />
                            </Form.Item>
                          </Col>
                          <Col span={2}>
                            <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} style={{ marginBottom: 24 }} />
                          </Col>
                        </Row>
                      ))}
                      <Row gutter={24}><Col span={12} offset={0}>
                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginBottom: 16 }}>
                          添加自定义字段
                        </Button>
                      </Col></Row>
                    </>
                  )}
                </Form.List>
              </>
            );
            if (entityType === 'INDIVIDUAL') return (
              <>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'realName']} label="姓名">
                      <Input placeholder="证件上的姓名" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'idType']} label="证件类型">
                      <Select placeholder="选择证件类型">
                        <Option value="ID_CARD">身份证</Option>
                        <Option value="PASSPORT">护照</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'idNumber']} label="证件号码">
                      <Input placeholder="证件号码" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'contactPhone']} label="联系电话">
                      <Input placeholder="联系电话" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item name={['enterpriseInfo', 'contactEmail']} label="邮箱">
                      <Input placeholder="邮箱地址" />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            );
            return null;
          }}
        </Form.Item>
        {/* 银行信息 - 所有类型通用 */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.enterpriseInfo?.entityType !== cur?.enterpriseInfo?.entityType}>
          {({ getFieldValue }) => {
            const entityType = getFieldValue(['enterpriseInfo', 'entityType']);
            if (!entityType) return null;
            return (
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name={['enterpriseInfo', 'bankName']} label="开户银行">
                    <Input placeholder="银行名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name={['enterpriseInfo', 'bankAccount']} label="银行账号">
                    <Input placeholder="银行账号" />
                  </Form.Item>
                </Col>
              </Row>
            );
          }}
        </Form.Item>
        {/* 备注 */}
        <Row gutter={24}>
          <Col span={24}>
            <Form.Item name="remark" label="备注说明" labelCol={{ span: 3 }} wrapperCol={{ span: 21 }}>
              <Input.TextArea rows={2} placeholder="请输入备注信息" />
            </Form.Item>
          </Col>
        </Row>

        {/* Section 5: 物流下单信息 (collapsed) */}
        <Collapse
          size="small"
          items={[
            {
              key: 'logistics',
              label: '物流下单信息（可选）',
              children: (
                <>
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item name="senderName" label="发货人">
                        <Input placeholder="发货人姓名" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="senderPhone" label="发货电话">
                        <Input placeholder="发货人电话" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item name="senderCountry" label="发货国家">
                        <Select placeholder="选择国家">
                          <Option value="中国">中国</Option>
                          <Option value="尼日利亚">尼日利亚</Option>
                          <Option value="加纳">加纳</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="senderCity" label="发货城市">
                        <Input placeholder="发货城市" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={24}>
                    <Col span={24}>
                      <Form.Item name="senderAddress" label="发货地址" labelCol={{ span: 3 }} wrapperCol={{ span: 21 }}>
                        <Input placeholder="发货详细地址" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider style={{ margin: '8px 0' }} />
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item name="consigneeName" label="收货人">
                        <Input placeholder="收货人姓名" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="consigneePhone" label="收货电话">
                        <Input placeholder="收货人电话" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item name="consigneeCountry" label="收货国家">
                        <Select placeholder="选择国家">
                          <Option value="尼日利亚">尼日利亚</Option>
                          <Option value="加纳">加纳</Option>
                          <Option value="美国">美国</Option>
                          <Option value="英国">英国</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="consigneeCity" label="收货城市">
                        <Input placeholder="收货城市" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item name="consigneeZipCode" label="邮编">
                        <Input placeholder="邮政编码" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={24}>
                    <Col span={24}>
                      <Form.Item name="consigneeAddress" label="收货地址" labelCol={{ span: 3 }} wrapperCol={{ span: 21 }}>
                        <Input placeholder="收货详细地址" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )
            }
          ]}
        />
      </Form>
    </Drawer>
  );
};

// --- 2. My Customers Page ---
export const MyCustomers: React.FC = () => {
  const [data, setData] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [transferClient, setTransferClient] = useState<Client | null>(null);
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferToSalesId, setTransferToSalesId] = useState<string>();
  const [transferReason, setTransferReason] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [entryTick, setEntryTick] = useState(0);

  const handleQuickGenerate = (client: Client) => {
    const entryNo = generateNextEntryNo(client.shortCode);
    globalWarehouseEntries.push({
      id: `WE-${client.id}-${Date.now()}`,
      entryNo,
      clientId: client.id,
      status: '待使用',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    });
    setEntryTick(n => n + 1);
    message.success(<span>已生成入仓号：<Text copyable strong style={{ fontFamily: 'monospace' }}>{entryNo}</Text></span>);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await clientApi.list({ poolType: 'PRIVATE' });
      const clients = injectMockEnterpriseInfo((res.data || []).map(mapClient));
      initMockEntries(clients);
      setData(clients);
    } catch (e: any) { message.error(e.message); }
    setLoading(false);
  };
  const fetchSalesUsers = async () => {
    try {
      const res: any = await v2OmsApi.listSalesUsers();
      setSalesUsers(res.data || []);
    } catch (e: any) {
      message.error(e.message || '加载业务员列表失败');
    }
  };

  useEffect(() => {
    fetchSalesUsers();
    fetchData();
  }, []);

  // 新增客户
  const handleAdd = async (values: any) => {
    try {
      const salesId = resolvePreferredSalesUserId(salesUsers);
      if (!salesId) {
        message.error('当前没有可分配的业务员，请先在系统中维护业务员账号');
        return;
      }
      const res: any = await clientApi.create({
        name: values.name,
        country: values.country,
        address: values.address,
        industry: values.industry,
        contact: { name: values.contactName, phone: values.contactPhone, email: values.contactEmail },
        logisticsInfo: values.logisticsInfo,
        status: 'ACTIVE',
        poolType: 'PRIVATE',
        salesId,
        source: values.source,
        remark: values.remark,
        companyType: values.companyType,
        creditLevel: values.creditLevel,
      });
      setIsModalOpen(false);
      message.success(`客户新增成功（编号：${res?.data?.shortCode || '-'}）`);
      fetchData();
    } catch (e: any) {
      message.error(e.message || '新增失败');
    }
  };

  // 删除客户
  const handleDelete = async (id: string) => {
    try {
      await clientApi.delete(id);
      message.success('客户已删除');
      fetchData();
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  // 转移跟进人
  const openTransferModal = (client: Client) => {
    const candidates = salesUsers.filter((item) => item.id !== client.salesId);
    setTransferClient(client);
    setTransferToSalesId(candidates[0]?.id);
    setTransferReason('');
    setTransferVisible(true);
  };

  const handleTransfer = async () => {
    if (!transferClient) return;
    if (!transferToSalesId) {
      message.error('请选择要转移给的同事');
      return;
    }
    try {
      const localUser: any = getLocalUser();
      setTransferLoading(true);
      await clientApi.transfer(
        transferClient.id,
        transferToSalesId,
        transferReason || '客户转移给同事跟进',
        localUser?.id,
        localUser?.realName || localUser?.username
      );
      message.success('客户已转移给同事跟进');
      setTransferVisible(false);
      setTransferClient(null);
      fetchData();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    } finally {
      setTransferLoading(false);
    }
  };

  // 筛选数据
  const filteredData = useMemo(() => {
    let result = data;

    // 搜索过滤
    if (search) {
      const keyword = search.trim().toLowerCase();
      result = result.filter(d =>
        d.name?.toLowerCase().includes(keyword) ||
        d.shortCode?.toLowerCase().includes(keyword) ||
        d.country?.toLowerCase().includes(keyword) ||
        d.contact?.name?.toLowerCase().includes(keyword) ||
        d.contact?.phone?.toLowerCase().includes(keyword) ||
        d.contact?.email?.toLowerCase().includes(keyword)
      );
    }

    // 状态过滤
    if (statusFilter) {
      result = result.filter(d => d.status === statusFilter);
    }

    return result;
  }, [data, search, statusFilter]);

  const columns = [
    {
      title: '客户编号',
      dataIndex: 'shortCode',
      width: 80,
      render: (t: string, r: Client) => (
        <a onClick={() => { setCurrentClient(r); setDetailVisible(true); }}>{t}</a>
      )
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      width: 160,
      ellipsis: true,
      render: (t: string) => <Text strong>{t}</Text>
    },
    {
      title: '国家',
      dataIndex: 'country',
      width: 70
    },
    {
      title: '联系人',
      dataIndex: ['contact', 'name'],
      width: 80
    },
    {
      title: '联系电话',
      dataIndex: ['contact', 'phone'],
      width: 120
    },
    {
      title: '订单',
      dataIndex: 'totalOrders',
      width: 55,
      align: 'center' as const
    },
    {
      title: '可用入仓号',
      key: 'warehouseEntry',
      width: 240,
      render: (_: any, r: Client) => {
        void entryTick;
        const available = getEntriesForClient(r.id).filter(e => e.status === '待使用');
        return (
          <Space size={4} wrap>
            {available.length > 0 ? available.map(e => (
              <Text key={e.id} copyable={{ text: e.entryNo, tooltips: ['复制', '已复制'] }} style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 13, background: '#f0f5ff', padding: '1px 6px', borderRadius: 4 }}>
                {e.entryNo}
              </Text>
            )) : <Text type="secondary" style={{ fontSize: 12 }}>无可用</Text>}
            <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); handleQuickGenerate(r); }}>
              生成
            </Button>
          </Space>
        );
      }
    },
    {
      title: '操作',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, r: Client) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => { setCurrentClient(r); setDetailVisible(true); }}>详情</Button>
          <Button type="link" size="small" onClick={() => openTransferModal(r)}>转移跟进</Button>
          <Popconfirm title="确定删除该客户？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger size="small">删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input.Search
            placeholder="搜索客户名称/编号/联系人..."
            style={{ width: 280 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            placeholder="客户状态"
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
          >
            <Option value="活跃">活跃</Option>
            <Option value="沉睡">沉睡</Option>
            <Option value="冻结">冻结</Option>
          </Select>
        </Space>
        <Space>
          <Button icon={<ExportOutlined />}>导出</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
          >
            新增客户
          </Button>
        </Space>
      </div>
      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
        scroll={{ x: 1200 }}
      />
      <CustomerFormDrawer
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSuccess={handleAdd}
        initialValues={undefined}
        poolType="私海"
      />
      <Modal
        title="转移客户跟进人"
        open={transferVisible}
        onCancel={() => {
          setTransferVisible(false);
          setTransferClient(null);
        }}
        onOk={handleTransfer}
        confirmLoading={transferLoading}
        okText="确认转移"
        width={560}
      >
        <Form layout="vertical">
          <Form.Item label="客户">
            <Input value={`${transferClient?.shortCode || '-'} / ${transferClient?.name || '-'}`} disabled />
          </Form.Item>
          <Form.Item label="转移给同事" required>
            <Select
              value={transferToSalesId}
              onChange={setTransferToSalesId}
              placeholder="请选择同事"
              options={salesUsers
                .filter((item) => item.id !== transferClient?.salesId)
                .map((item) => ({
                  value: item.id,
                  label: `${item.realName || item.username} (${item.roleCode || '-'})`
                }))}
            />
          </Form.Item>
          <Form.Item label="转移说明（可选）">
            <Input.TextArea
              rows={3}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="例如：按区域重新分配、客户要求更换对接人"
            />
          </Form.Item>
        </Form>
      </Modal>
      <CustomerDetailDrawer
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setCurrentClient(null);
        }}
        client={currentClient}
        onClientUpdated={(updated) => {
          setCurrentClient(updated);
          fetchData();
        }}
      />
    </div>
  );
};

// --- 3. Public Pool Page ---
export const PublicPool: React.FC = () => {
  const [data, setData] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentClient, setCurrentClient] = useState<Client | null>(null);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [claimRequests, setClaimRequests] = useState<ClaimRequestMock[]>([]);
  const localUser: any = getLocalUser();
  const canReviewClaims = ['ADMIN', 'OPS_CN', 'BOSS'].includes(String(localUser?.role || '').toUpperCase());

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await clientApi.list({ poolType: 'PUBLIC' });
      setData(injectMockEnterpriseInfo((res.data || []).map(mapClient)));
    } catch (e: any) { message.error(e.message); }
    setLoading(false);
  };
  const fetchSalesUsers = async () => {
    try {
      const res: any = await v2OmsApi.listSalesUsers();
      setSalesUsers(res.data || []);
    } catch (e: any) {
      message.error(e.message || '加载业务员列表失败');
    }
  };

  useEffect(() => {
    fetchSalesUsers();
    fetchData();
  }, []);

  const getClaimStatus = (customerId: string) => {
    const latest = claimRequests.find((item) => item.customerId === customerId);
    return latest?.status || null;
  };

  // 申请认领（前端 mock）
  const handleClaim = (client: Client) => {
    const existsPending = claimRequests.some((item) => item.customerId === client.id && item.status === 'PENDING');
    if (existsPending) {
      message.warning('该客户已有待审核认领申请，请勿重复提交');
      return;
    }
    const preferredSalesId = resolvePreferredSalesUserId(salesUsers);
    const targetUser = salesUsers.find((item) => item.id === preferredSalesId);
    const applicantName = localUser?.realName || localUser?.username || '当前用户';
    const next: ClaimRequestMock = {
      id: `MOCK-CLAIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: client.id,
      customerCode: client.shortCode,
      customerName: client.name,
      applicantId: localUser?.id,
      applicantName,
      targetSalesId: targetUser?.id,
      targetSalesName: targetUser?.realName || targetUser?.username || '-',
      reason: '申请认领公海客户',
      publicNotice: '认领申请已公示，等待管理员审核',
      status: 'PENDING',
      appliedAt: dayjs().toISOString(),
    };
    setClaimRequests((prev) => [next, ...prev]);
    message.success('已提交认领申请，进入公示待审核（Mock）');
  };

  const handleReviewClaim = (record: ClaimRequestMock, action: 'APPROVED' | 'REJECTED') => {
    const now = dayjs().toISOString();
    const reviewerName = localUser?.realName || localUser?.username || '审核人';
    setClaimRequests((prev) => prev.map((item) => {
      if (item.id !== record.id) return item;
      return {
        ...item,
        status: action,
        reviewedAt: now,
        reviewerName,
        reviewRemark: action === 'APPROVED' ? '审核通过' : '审核驳回',
      };
    }));
    if (action === 'APPROVED') {
      setData((prev) => prev.filter((item) => item.id !== record.customerId));
      message.success(`已审核通过，客户 ${record.customerName} 转入私海（Mock）`);
      return;
    }
    message.info(`已驳回客户 ${record.customerName} 的认领申请（Mock）`);
  };

  // 录入线索
  const handleAddLead = async (values: any) => {
    try {
      const res: any = await clientApi.create({
        name: values.name,
        country: values.country,
        address: values.address,
        industry: values.industry,
        contact: { name: values.contactName, phone: values.contactPhone, email: values.contactEmail },
        logisticsInfo: values.logisticsInfo,
        status: 'ACTIVE',
        poolType: 'PUBLIC',
        source: values.source,
        remark: values.remark,
      });
      setIsModalOpen(false);
      message.success(`线索录入成功（编号：${res?.data?.shortCode || '-'}）`);
      fetchData();
    } catch (e: any) { message.error(e.message); }
  };

  // 筛选数据
  const filteredData = useMemo(() => {
    if (!search) return data;
    const keyword = search.trim().toLowerCase();
    return data.filter(d =>
      d.name?.toLowerCase().includes(keyword) ||
      d.shortCode?.toLowerCase().includes(keyword) ||
      d.country?.toLowerCase().includes(keyword) ||
      d.contact?.name?.toLowerCase().includes(keyword) ||
      d.contact?.phone?.toLowerCase().includes(keyword) ||
      d.contact?.email?.toLowerCase().includes(keyword)
    );
  }, [data, search]);

  const columns = [
    {
      title: '客户编号',
      dataIndex: 'shortCode',
      width: 100,
      fixed: 'left' as const
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      width: 180,
      render: (t: string) => <Text strong>{t}</Text>
    },
    {
      title: '所属行业',
      dataIndex: 'industry',
      width: 100,
      render: (t: string) => t || '-'
    },
    {
      title: '国家',
      dataIndex: 'country',
      width: 100
    },
    {
      title: '联系人',
      dataIndex: ['contact', 'name'],
      width: 100
    },
    {
      title: '联系电话',
      dataIndex: ['contact', 'phone'],
      width: 120
    },
    {
      title: '客户来源',
      dataIndex: 'source',
      width: 100,
      render: (t: string) => t || '-'
    },
    {
      title: '信用等级',
      dataIndex: 'creditLevel',
      width: 100,
      render: (t: string) => t ? <Tag color={t === 'A' ? 'green' : t === 'B' ? 'blue' : t === 'C' ? 'orange' : 'red'}>{t}级</Tag> : '-'
    },
    {
      title: '订单数',
      dataIndex: 'totalOrders',
      width: 80,
      align: 'center' as const
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: string) => <Tag color={s === '活跃' ? 'green' : s === '沉睡' ? 'orange' : 'red'}>{s}</Tag>
    },
    {
      title: '进入公海时间',
      dataIndex: 'enterPoolTime',
      width: 140,
      render: (t: string, r: Client) => dayjs(t || r.createdAt).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '认领进度',
      key: 'claimStatus',
      width: 130,
      render: (_: any, r: Client) => {
        const status = getClaimStatus(r.id);
        if (status === 'PENDING') return <Tag color="gold">公示中/待审核</Tag>;
        if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
        if (status === 'REJECTED') return <Tag color="red">已驳回</Tag>;
        return <Tag>未申请</Tag>;
      }
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, r: Client) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => { setCurrentClient(r); setDetailVisible(true); }}
          >
            详情
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<SwapOutlined />}
            onClick={() => handleClaim(r)}
            disabled={getClaimStatus(r.id) === 'PENDING'}
          >
            申请认领
          </Button>
        </Space>
      )
    }
  ];

  const claimColumns = [
    { title: '客户编号', dataIndex: 'customerCode', width: 100 },
    { title: '客户名称', dataIndex: 'customerName', width: 160 },
    { title: '申请人', dataIndex: 'applicantName', width: 100 },
    { title: '目标业务员', dataIndex: 'targetSalesName', width: 120 },
    {
      title: '公示时间',
      dataIndex: 'appliedAt',
      width: 150,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: ClaimRequestMock['status']) => {
        if (status === 'PENDING') return <Tag color="gold">待审核</Tag>;
        if (status === 'APPROVED') return <Tag color="green">已通过</Tag>;
        return <Tag color="red">已驳回</Tag>;
      }
    },
    {
      title: '审核信息',
      key: 'reviewInfo',
      width: 180,
      render: (_: unknown, record: ClaimRequestMock) => {
        if (!record.reviewedAt) return '-';
        return `${record.reviewerName || '-'} ${dayjs(record.reviewedAt).format('MM-DD HH:mm')}`;
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: ClaimRequestMock) => {
        if (record.status !== 'PENDING') return <span>-</span>;
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => handleReviewClaim(record, 'APPROVED')} disabled={!canReviewClaims}>
              通过
            </Button>
            <Button type="link" size="small" danger onClick={() => handleReviewClaim(record, 'REJECTED')} disabled={!canReviewClaims}>
              驳回
            </Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索公海客户..."
          style={{ width: 300 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          录入线索
        </Button>
      </div>
      <Card
        size="small"
        title="认领公示与审核（Mock）"
        style={{ marginBottom: 16 }}
        extra={<Text type="secondary">{canReviewClaims ? '当前账号可审核' : '当前账号仅可提交申请'}</Text>}
      >
        <Table
          size="small"
          rowKey="id"
          columns={claimColumns as any}
          dataSource={claimRequests}
          pagination={{ pageSize: 5, showSizeChanger: false }}
          locale={{ emptyText: '暂无认领公示记录' }}
          scroll={{ x: 980 }}
        />
      </Card>
      <Table
        dataSource={filteredData}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
        scroll={{ x: 1200 }}
      />
      <CustomerFormDrawer
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onSuccess={handleAddLead}
        poolType="公海"
      />
      <CustomerDetailDrawer
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setCurrentClient(null);
        }}
        client={currentClient}
        onClientUpdated={(updated) => {
          setCurrentClient(updated);
          fetchData();
        }}
      />
    </div>
  );
};

// --- 4. Detail Drawer ---
// ============ 入仓号管理 Tab ============
const WarehouseEntryTab: React.FC<{ client: Client }> = ({ client }) => {
  const [, forceUpdate] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const entries = getEntriesForClient(client.id);
  const filtered = statusFilter ? entries.filter(e => e.status === statusFilter) : entries;

  const handleGenerate = () => {
    const entryNo = generateNextEntryNo(client.shortCode);
    globalWarehouseEntries.push({
      id: `WE-${client.id}-${Date.now()}`,
      entryNo,
      clientId: client.id,
      status: '待使用',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    });
    forceUpdate(n => n + 1);
    message.success(`已生成入仓号：${entryNo}`);
  };

  const handleInvalidate = (entry: WarehouseEntry) => {
    entry.status = '已失效';
    forceUpdate(n => n + 1);
    message.success(`${entry.entryNo} 已作废`);
  };

  const statusColorMap: Record<string, string> = {
    '待使用': 'blue', '已关联': 'orange', '已入库': 'green', '已失效': 'default',
  };

  const columns = [
    { title: '入仓号', dataIndex: 'entryNo', key: 'entryNo', width: 120,
      render: (v: string) => <Text copyable strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{v}</Text> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: WarehouseEntryStatus) => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: '关联订单', dataIndex: 'orderNo', key: 'orderNo', width: 200,
      render: (v?: string) => v || <Text type="secondary">-</Text> },
    { title: '生成时间', dataIndex: 'createdAt', key: 'createdAt', width: 150 },
    { title: '使用时间', dataIndex: 'usedAt', key: 'usedAt', width: 150,
      render: (v?: string) => v || '-' },
    { title: '操作', key: 'action', width: 100,
      render: (_: any, record: WarehouseEntry) => (
        record.status === '待使用' ? (
          <Popconfirm title="确定作废该入仓号？" onConfirm={() => handleInvalidate(record)}>
            <Button type="link" danger size="small" style={{ padding: 0 }}>作废</Button>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  const pendingCount = entries.filter(e => e.status === '待使用').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Text strong>入仓号管理</Text>
          <Tag color="blue">{pendingCount} 个待使用</Tag>
          <Select
            placeholder="筛选状态"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            size="small"
          >
            <Option value="待使用">待使用</Option>
            <Option value="已关联">已关联</Option>
            <Option value="已入库">已入库</Option>
            <Option value="已失效">已失效</Option>
          </Select>
        </Space>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleGenerate}>
          生成入仓号
        </Button>
      </div>
      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10, size: 'small' }}
      />
    </div>
  );
};

const CustomerDetailDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  client: Client | null;
  onClientUpdated?: (client: Client) => void;
}> = ({ open, onClose, client, onClientUpdated }) => {
  const [clientOrders, setClientOrders] = useState<any[]>([]);
  const [poolLogs, setPoolLogs] = useState<ClientPoolLog[]>([]);
  const [senderModalOpen, setSenderModalOpen] = useState(false);
  const [receiverModalOpen, setReceiverModalOpen] = useState(false);
  const [savingSender, setSavingSender] = useState(false);
  const [savingReceiver, setSavingReceiver] = useState(false);
  const [editingSenderId, setEditingSenderId] = useState<string | null>(null);
  const [editingReceiverId, setEditingReceiverId] = useState<string | null>(null);
  const [senderForm] = Form.useForm();
  const [receiverForm] = Form.useForm();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionForm] = Form.useForm();

  useEffect(() => {
    if (!client || !open) return;
    (async () => {
      try {
        const res: any = await v2OmsApi.listOrders({ customerId: client.id, page: 1, pageSize: 200 });
        setClientOrders(res.data || []);
      } catch { setClientOrders([]); }
    })();
  }, [client, open]);

  const senderEntries = useMemo<SenderContactInfo[]>(() => {
    if (!client?.logisticsInfo) return [];
    const info: any = client.logisticsInfo;
    if (Array.isArray(info.senderContacts)) {
      return info.senderContacts.map((entry: any, index: number) => ({
        id: String(entry?.id || `SENDER-${index + 1}`),
        label: entry?.label,
        senderName: entry?.senderName,
        senderPhone: entry?.senderPhone,
        senderAddress: entry?.senderAddress,
        senderCity: entry?.senderCity,
        senderCountry: entry?.senderCountry
      }));
    }
    if (Array.isArray(info.contactPairs)) {
      const migrated = info.contactPairs
        .map((entry: any, index: number) => ({
          id: String(entry?.id || `SENDER-PAIR-${index + 1}`),
          label: entry?.label,
          senderName: entry?.senderName,
          senderPhone: entry?.senderPhone,
          senderAddress: entry?.senderAddress,
          senderCity: entry?.senderCity,
          senderCountry: entry?.senderCountry
        }))
        .filter((entry: SenderContactInfo) => Boolean(
          entry.senderName || entry.senderPhone || entry.senderAddress || entry.senderCity || entry.senderCountry
        ));
      if (migrated.length > 0) return migrated;
    }
    const hasLegacy = Boolean(
      info.senderName || info.senderPhone || info.senderAddress || info.senderCity || info.senderCountry
    );
    if (!hasLegacy) return [];
    return [{
      id: 'SENDER-LEGACY-1',
      label: '默认发货人',
      senderName: info.senderName,
      senderPhone: info.senderPhone,
      senderAddress: info.senderAddress,
      senderCity: info.senderCity,
      senderCountry: info.senderCountry
    }];
  }, [client]);

  const receiverEntries = useMemo<ReceiverContactInfo[]>(() => {
    if (!client?.logisticsInfo) return [];
    const info: any = client.logisticsInfo;
    if (Array.isArray(info.receiverContacts)) {
      return info.receiverContacts.map((entry: any, index: number) => ({
        id: String(entry?.id || `RECEIVER-${index + 1}`),
        label: entry?.label,
        consigneeName: entry?.consigneeName,
        consigneePhone: entry?.consigneePhone,
        consigneeAddress: entry?.consigneeAddress,
        consigneeCity: entry?.consigneeCity,
        consigneeCountry: entry?.consigneeCountry,
        consigneeZipCode: entry?.consigneeZipCode
      }));
    }
    if (Array.isArray(info.contactPairs)) {
      const migrated = info.contactPairs
        .map((entry: any, index: number) => ({
          id: String(entry?.id || `RECEIVER-PAIR-${index + 1}`),
          label: entry?.label,
          consigneeName: entry?.consigneeName,
          consigneePhone: entry?.consigneePhone,
          consigneeAddress: entry?.consigneeAddress,
          consigneeCity: entry?.consigneeCity,
          consigneeCountry: entry?.consigneeCountry,
          consigneeZipCode: entry?.consigneeZipCode
        }))
        .filter((entry: ReceiverContactInfo) => Boolean(
          entry.consigneeName || entry.consigneePhone || entry.consigneeAddress || entry.consigneeCity || entry.consigneeCountry
        ));
      if (migrated.length > 0) return migrated;
    }
    const hasLegacy = Boolean(
      info.consigneeName || info.consigneePhone || info.consigneeAddress || info.consigneeCity || info.consigneeCountry
    );
    if (!hasLegacy) return [];
    return [{
      id: 'RECEIVER-LEGACY-1',
      label: '默认收货人',
      consigneeName: info.consigneeName,
      consigneePhone: info.consigneePhone,
      consigneeAddress: info.consigneeAddress,
      consigneeCity: info.consigneeCity,
      consigneeCountry: info.consigneeCountry,
      consigneeZipCode: info.consigneeZipCode
    }];
  }, [client]);

  const persistContacts = async (
    nextSenders: SenderContactInfo[],
    nextReceivers: ReceiverContactInfo[],
    successMessage: string
  ) => {
    if (!client) return;
    const currentInfo = (client.logisticsInfo || {}) as LogisticsInfo;
    const nextInfo: LogisticsInfo = {
      ...currentInfo,
      senderContacts: nextSenders,
      receiverContacts: nextReceivers,
      contactPairs: undefined
    };
    const firstSender = nextSenders[0];
    nextInfo.senderName = firstSender?.senderName;
    nextInfo.senderPhone = firstSender?.senderPhone;
    nextInfo.senderAddress = firstSender?.senderAddress;
    nextInfo.senderCity = firstSender?.senderCity;
    nextInfo.senderCountry = firstSender?.senderCountry;
    const firstReceiver = nextReceivers[0];
    nextInfo.consigneeName = firstReceiver?.consigneeName;
    nextInfo.consigneePhone = firstReceiver?.consigneePhone;
    nextInfo.consigneeAddress = firstReceiver?.consigneeAddress;
    nextInfo.consigneeCity = firstReceiver?.consigneeCity;
    nextInfo.consigneeCountry = firstReceiver?.consigneeCountry;
    nextInfo.consigneeZipCode = firstReceiver?.consigneeZipCode;

    const cleanedInfo = Object.fromEntries(
      Object.entries(nextInfo).filter(([, value]) => {
        if (value === undefined || value === null) return false;
        if (Array.isArray(value)) return true;
        if (typeof value === 'string') return value.trim() !== '';
        return true;
      })
    );

    const res: any = await clientApi.update(client.id, { logisticsInfo: cleanedInfo });
    const updatedClient = mapClient(res.data);
    onClientUpdated?.(updatedClient);
    message.success(successMessage);
  };

  const openSenderEditor = (entry?: SenderContactInfo) => {
    setEditingSenderId(entry?.id || null);
    senderForm.setFieldsValue({
      label: entry?.label,
      senderName: entry?.senderName,
      senderPhone: entry?.senderPhone,
      senderCountry: entry?.senderCountry,
      senderCity: entry?.senderCity,
      senderAddress: entry?.senderAddress
    });
    setSenderModalOpen(true);
  };

  const openReceiverEditor = (entry?: ReceiverContactInfo) => {
    setEditingReceiverId(entry?.id || null);
    receiverForm.setFieldsValue({
      label: entry?.label,
      consigneeName: entry?.consigneeName,
      consigneePhone: entry?.consigneePhone,
      consigneeCountry: entry?.consigneeCountry,
      consigneeCity: entry?.consigneeCity,
      consigneeZipCode: entry?.consigneeZipCode,
      consigneeAddress: entry?.consigneeAddress
    });
    setReceiverModalOpen(true);
  };

  const handleSaveSender = async () => {
    if (!client) return;
    try {
      const values = await senderForm.validateFields();
      const entryId = editingSenderId || `SENDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const nextEntry: SenderContactInfo = { id: entryId, ...values };
      const nextSenders = editingSenderId
        ? senderEntries.map((entry) => (entry.id === editingSenderId ? nextEntry : entry))
        : [...senderEntries, nextEntry];

      setSavingSender(true);
      await persistContacts(nextSenders, receiverEntries, editingSenderId ? '发货人信息已更新' : '发货人信息已新增');
      setSenderModalOpen(false);
      setEditingSenderId(null);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '保存发货人信息失败');
    } finally {
      setSavingSender(false);
    }
  };

  const handleSaveReceiver = async () => {
    if (!client) return;
    try {
      const values = await receiverForm.validateFields();
      const entryId = editingReceiverId || `RECEIVER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const nextEntry: ReceiverContactInfo = { id: entryId, ...values };
      const nextReceivers = editingReceiverId
        ? receiverEntries.map((entry) => (entry.id === editingReceiverId ? nextEntry : entry))
        : [...receiverEntries, nextEntry];

      setSavingReceiver(true);
      await persistContacts(senderEntries, nextReceivers, editingReceiverId ? '收货人信息已更新' : '收货人信息已新增');
      setReceiverModalOpen(false);
      setEditingReceiverId(null);
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '保存收货人信息失败');
    } finally {
      setSavingReceiver(false);
    }
  };

  const handleDeleteSender = async (entryId: string) => {
    if (!client) return;
    try {
      const nextSenders = senderEntries.filter((entry) => entry.id !== entryId);
      await persistContacts(nextSenders, receiverEntries, '发货人信息已删除');
    } catch (e: any) {
      message.error(e?.message || '删除发货人信息失败');
    }
  };

  const handleDeleteReceiver = async (entryId: string) => {
    if (!client) return;
    try {
      const nextReceivers = receiverEntries.filter((entry) => entry.id !== entryId);
      await persistContacts(senderEntries, nextReceivers, '收货人信息已删除');
    } catch (e: any) {
      message.error(e?.message || '删除收货人信息失败');
    }
  };

  useEffect(() => {
    if (!client || !open) return;
    (async () => {
      try {
        const res: any = await clientApi.poolLogs(client.id);
        setPoolLogs(res.data || []);
      } catch {
        setPoolLogs([]);
      }
    })();
  }, [client, open]);

  // 计算交易统计数据
  const tradeStats = useMemo(() => {
    const totalAmount = clientOrders.reduce((sum: number, order: any) => {
      const amount = Number(order.total_receivable_amount ?? order.totalAmount ?? order.totalValue ?? 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const totalOrders = clientOrders.length;
    const completedOrders = clientOrders.filter((o: any) => (o.order_status || o.status) === 'COMPLETED').length;

    return {
      totalAmount,
      totalOrders,
      completedOrders,
      avgAmount: totalOrders > 0 ? totalAmount / totalOrders : 0
    };
  }, [clientOrders]);

  const setupSectionForm = (section: string) => {
    if (!client) return;
    sectionForm.resetFields();
    if (section === 'basic') {
      sectionForm.setFieldsValue({
        name: client.name, country: client.country, industry: client.industry,
        source: client.source, creditLevel: client.creditLevel, address: client.address, remark: client.remark,
      });
    } else if (section === 'contact') {
      sectionForm.setFieldsValue({
        contactName: client.contact?.name, contactPhone: client.contact?.phone, contactEmail: client.contact?.email,
      });
    } else if (section === 'enterprise') {
      sectionForm.setFieldsValue({ enterpriseInfo: (client as any).enterpriseInfo || {} });
    }
  };

  const handleSaveSection = async (section: string) => {
    if (!client) return;
    try {
      const values = await sectionForm.validateFields();
      let updateData: any = {};
      if (section === 'basic') {
        updateData = { name: values.name, country: values.country, industry: values.industry, source: values.source, creditLevel: values.creditLevel, address: values.address, remark: values.remark };
      } else if (section === 'contact') {
        updateData = { contact: { ...client.contact, name: values.contactName, phone: values.contactPhone, email: values.contactEmail } };
      } else if (section === 'enterprise') {
        updateData = { enterpriseInfo: values.enterpriseInfo?.entityType ? values.enterpriseInfo : undefined };
      }
      const res: any = await clientApi.update(client.id, updateData);
      const updatedClient = mapClient(res.data);
      onClientUpdated?.(updatedClient);
      setEditingSection(null);
      message.success('保存成功');
    } catch (_e) { /* validation failed */ }
  };

  const SectionHeader: React.FC<{title: string; sectionKey: string}> = ({title, sectionKey}) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 12px' }}>
      <Text strong style={{ fontSize: 15 }}>{title}</Text>
      {editingSection !== sectionKey ? (
        <Button type="link" size="small" onClick={() => { setEditingSection(sectionKey); setupSectionForm(sectionKey); }}>编辑</Button>
      ) : (
        <Space>
          <Button size="small" onClick={() => setEditingSection(null)}>取消</Button>
          <Button type="primary" size="small" onClick={() => handleSaveSection(sectionKey)}>保存</Button>
        </Space>
      )}
    </div>
  );

  if (!client) return null;

  const senderColumns = [
    { title: '标签', dataIndex: 'label', key: 'label', width: 100, render: (v: string) => v || '-' },
    { title: '姓名', dataIndex: 'senderName', key: 'senderName', width: 100, render: (v: string) => v || '-' },
    { title: '电话', dataIndex: 'senderPhone', key: 'senderPhone', width: 130, render: (v: string) => v || '-' },
    { title: '国家', dataIndex: 'senderCountry', key: 'senderCountry', width: 80, render: (v: string) => v || '-' },
    { title: '城市', dataIndex: 'senderCity', key: 'senderCity', width: 80, render: (v: string) => v || '-' },
    { title: '地址', dataIndex: 'senderAddress', key: 'senderAddress', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '操作', key: 'action', width: 120, render: (_: any, record: SenderContactInfo) => (
        <Space size="small">
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openSenderEditor(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteSender(record.id)}>
            <Button type="link" danger size="small" style={{ padding: 0 }}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const receiverColumns = [
    { title: '标签', dataIndex: 'label', key: 'label', width: 90, render: (v: string) => v || '-' },
    { title: '姓名', dataIndex: 'consigneeName', key: 'consigneeName', width: 100, render: (v: string) => v || '-' },
    { title: '电话', dataIndex: 'consigneePhone', key: 'consigneePhone', width: 130, render: (v: string) => v || '-' },
    { title: '国家', dataIndex: 'consigneeCountry', key: 'consigneeCountry', width: 80, render: (v: string) => v || '-' },
    { title: '城市', dataIndex: 'consigneeCity', key: 'consigneeCity', width: 70, render: (v: string) => v || '-' },
    { title: '邮编', dataIndex: 'consigneeZipCode', key: 'consigneeZipCode', width: 70, render: (v: string) => v || '-' },
    { title: '地址', dataIndex: 'consigneeAddress', key: 'consigneeAddress', ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '操作', key: 'action', width: 120, render: (_: any, record: ReceiverContactInfo) => (
        <Space size="small">
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openReceiverEditor(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteReceiver(record.id)}>
            <Button type="link" danger size="small" style={{ padding: 0 }}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Drawer title={client.name} width={1100} onClose={onClose} open={open}>
      <div style={{ padding: 16, background: '#f5f7fa', borderRadius: 8, marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="累计订单" value={tradeStats.totalOrders} suffix="票" />
          </Col>
          <Col span={6}>
            <Statistic title="已完成" value={tradeStats.completedOrders} suffix="票" />
          </Col>
          <Col span={6}>
            <Statistic
              title="交易总额"
              value={tradeStats.totalAmount}
              precision={2}
              prefix="¥"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="客户状态"
              value={client.status}
              valueStyle={{ color: client.status === '活跃' ? '#52c41a' : client.status === '沉睡' ? '#faad14' : '#ff4d4f' }}
            />
          </Col>
        </Row>
      </div>
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab="基础资料" key="1">
          <SectionHeader title="基本信息" sectionKey="basic" />
          {editingSection === 'basic' ? (
            <Form form={sectionForm} layout="horizontal" labelCol={{span:6}} wrapperCol={{span:18}}>
              <Row gutter={24}>
                <Col span={12}><Form.Item name="name" label="客户名称" rules={[{required:true,message:'请输入客户名称'}]}><Input placeholder="客户名称" /></Form.Item></Col>
                <Col span={12}><Form.Item name="country" label="所在国家" rules={[{required:true,message:'请选择国家'}]}>
                  <Select placeholder="选择国家"><Option value="中国">中国</Option><Option value="尼日利亚">尼日利亚</Option><Option value="加纳">加纳</Option><Option value="美国">美国</Option><Option value="英国">英国</Option><Option value="日本">日本</Option></Select>
                </Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col span={12}><Form.Item name="industry" label="所属行业">
                  <Select placeholder="选择行业" allowClear><Option value="电商">电商</Option><Option value="制造业">制造业</Option><Option value="贸易">贸易</Option><Option value="零售">零售</Option><Option value="其他">其他</Option></Select>
                </Form.Item></Col>
                <Col span={12}><Form.Item name="source" label="客户来源">
                  <Select placeholder="选择来源" allowClear><Option value="线上推广">线上推广</Option><Option value="老客介绍">老客介绍</Option><Option value="展会">展会</Option><Option value="电话营销">电话营销</Option><Option value="销售录入">销售录入</Option><Option value="其他">其他</Option></Select>
                </Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col span={12}><Form.Item name="creditLevel" label="信用等级">
                  <Select placeholder="选择等级" allowClear><Option value="A">A级（优秀）</Option><Option value="B">B级（良好）</Option><Option value="C">C级（一般）</Option><Option value="D">D级（较差）</Option></Select>
                </Form.Item></Col>
                <Col span={12}><Form.Item name="address" label="详细地址"><Input placeholder="详细地址" /></Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col span={24}><Form.Item name="remark" label="备注说明" labelCol={{span:3}} wrapperCol={{span:21}}><Input.TextArea rows={2} placeholder="备注信息" /></Form.Item></Col>
              </Row>
            </Form>
          ) : (
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="客户编号">{client.shortCode}</Descriptions.Item>
              <Descriptions.Item label="客户名称">{client.name}</Descriptions.Item>
              <Descriptions.Item label="所属行业">{client.industry || '-'}</Descriptions.Item>
              <Descriptions.Item label="所在国家">{client.country}</Descriptions.Item>
              <Descriptions.Item label="客户来源">{client.source || '-'}</Descriptions.Item>
              <Descriptions.Item label="信用等级">
                {client.creditLevel ? <Tag color={client.creditLevel === 'A' ? 'green' : client.creditLevel === 'B' ? 'blue' : client.creditLevel === 'C' ? 'orange' : 'red'}>{client.creditLevel}级</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="业务员">{client.salesPerson || client.salesId || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{dayjs(client.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="详细地址" span={2}>{client.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注说明" span={2}>{client.remark || '-'}</Descriptions.Item>
            </Descriptions>
          )}

          <SectionHeader title="联系信息" sectionKey="contact" />
          {editingSection === 'contact' ? (
            <Form form={sectionForm} layout="horizontal" labelCol={{span:6}} wrapperCol={{span:18}}>
              <Row gutter={24}>
                <Col span={12}><Form.Item name="contactName" label="联系人" rules={[{required:true,message:'请输入联系人'}]}><Input placeholder="联系人姓名" /></Form.Item></Col>
                <Col span={12}><Form.Item name="contactPhone" label="联系电话" rules={[{required:true,message:'请输入联系电话'}]}><Input placeholder="手机号码" /></Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col span={12}><Form.Item name="contactEmail" label="邮箱"><Input placeholder="电子邮箱" /></Form.Item></Col>
              </Row>
            </Form>
          ) : (
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="联系人">{client.contact.name}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{client.contact.phone}</Descriptions.Item>
              <Descriptions.Item label="联系邮箱" span={2}>{client.contact.email || '-'}</Descriptions.Item>
            </Descriptions>
          )}

          <SectionHeader title="企业资质信息" sectionKey="enterprise" />
          {editingSection === 'enterprise' ? (
            <Form form={sectionForm} layout="horizontal" labelCol={{span:6}} wrapperCol={{span:18}}>
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name={['enterpriseInfo', 'entityType']} label="客户类型">
                    <Select placeholder="选择类型" allowClear>
                      <Option value="COMPANY_CN">中国企业</Option>
                      <Option value="COMPANY_OVERSEAS">海外企业</Option>
                      <Option value="INDIVIDUAL">个人</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item noStyle shouldUpdate={(prev: any, cur: any) => prev?.enterpriseInfo?.entityType !== cur?.enterpriseInfo?.entityType}>
                {({ getFieldValue }: any) => {
                  const entityType = getFieldValue(['enterpriseInfo', 'entityType']);
                  if (entityType === 'COMPANY_CN') return (
                    <>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'companyName']} label="公司全称"><Input placeholder="营业执照上的公司全称" /></Form.Item></Col>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'unifiedCreditCode']} label="信用代码" rules={[{pattern:/^[0-9A-Z]{18}$/,message:'请输入18位信用代码'}]}><Input placeholder="18位统一社会信用代码" maxLength={18} /></Form.Item></Col>
                      </Row>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'legalRepresentative']} label="法定代表人"><Input placeholder="法定代表人姓名" /></Form.Item></Col>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'registeredAddress']} label="注册地址"><Input placeholder="营业执照上的注册地址" /></Form.Item></Col>
                      </Row>
                      <Divider plain style={{ fontSize: 12 }}>开票信息</Divider>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'taxpayerId']} label="纳税人识别号"><Input placeholder="通常同统一社会信用代码" /></Form.Item></Col>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'invoiceAddress']} label="开票地址"><Input placeholder="开票地址" /></Form.Item></Col>
                      </Row>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'invoicePhone']} label="开票电话"><Input placeholder="开票电话" /></Form.Item></Col>
                      </Row>
                      <Divider plain style={{ fontSize: 12 }}>联系方式</Divider>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'contactPhone']} label="联系电话"><Input placeholder="公司联系电话" /></Form.Item></Col>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'contactEmail']} label="邮箱"><Input placeholder="企业邮箱" /></Form.Item></Col>
                      </Row>
                    </>
                  );
                  if (entityType === 'COMPANY_OVERSEAS') return (
                    <>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'overseasCompanyName']} label="公司名称"><Input placeholder="Registered company name" /></Form.Item></Col>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'overseasCountry']} label="注册国家">
                          <Select placeholder="选择国家"><Option value="尼日利亚">尼日利亚</Option><Option value="加纳">加纳</Option><Option value="美国">美国</Option><Option value="英国">英国</Option><Option value="其他">其他</Option></Select>
                        </Form.Item></Col>
                      </Row>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'overseasRegNumber']} label="注册号"><Input placeholder="RC/BN/RGD Number" /></Form.Item></Col>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'overseasTaxNumber']} label="税号 TIN"><Input placeholder="Tax identification number" /></Form.Item></Col>
                      </Row>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'overseasDirector']} label="负责人"><Input placeholder="负责人 / Owner name" /></Form.Item></Col>
                      </Row>
                      <Form.List name={['enterpriseInfo', 'customFields']}>
                        {(fields, { add, remove }) => (
                          <>
                            {fields.map(({ key, name, ...restField }) => (
                              <Row gutter={24} key={key} align="middle">
                                <Col span={11}><Form.Item {...restField} name={[name, 'label']} label="字段名" rules={[{required:true,message:'请输入字段名'}]}><Input placeholder="如 CAC Number" /></Form.Item></Col>
                                <Col span={11}><Form.Item {...restField} name={[name, 'value']} label="字段值" rules={[{required:true,message:'请输入字段值'}]}><Input placeholder="字段值" /></Form.Item></Col>
                                <Col span={2}><Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} style={{marginBottom:24}} /></Col>
                              </Row>
                            ))}
                            <Row gutter={24}><Col span={12}><Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{marginBottom:16}}>添加自定义字段</Button></Col></Row>
                          </>
                        )}
                      </Form.List>
                    </>
                  );
                  if (entityType === 'INDIVIDUAL') return (
                    <>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'realName']} label="姓名"><Input placeholder="证件上的姓名" /></Form.Item></Col>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'idType']} label="证件类型">
                          <Select placeholder="选择证件类型"><Option value="ID_CARD">身份证</Option><Option value="PASSPORT">护照</Option></Select>
                        </Form.Item></Col>
                      </Row>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'idNumber']} label="证件号码"><Input placeholder="证件号码" /></Form.Item></Col>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'contactPhone']} label="联系电话"><Input placeholder="联系电话" /></Form.Item></Col>
                      </Row>
                      <Row gutter={24}>
                        <Col span={12}><Form.Item name={['enterpriseInfo', 'contactEmail']} label="邮箱"><Input placeholder="邮箱地址" /></Form.Item></Col>
                      </Row>
                    </>
                  );
                  return null;
                }}
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev: any, cur: any) => prev?.enterpriseInfo?.entityType !== cur?.enterpriseInfo?.entityType}>
                {({ getFieldValue }: any) => {
                  const entityType = getFieldValue(['enterpriseInfo', 'entityType']);
                  if (!entityType) return null;
                  return (
                    <Row gutter={24}>
                      <Col span={12}><Form.Item name={['enterpriseInfo', 'bankName']} label="开户银行"><Input placeholder="银行名称" /></Form.Item></Col>
                      <Col span={12}><Form.Item name={['enterpriseInfo', 'bankAccount']} label="银行账号"><Input placeholder="银行账号" /></Form.Item></Col>
                    </Row>
                  );
                }}
              </Form.Item>
            </Form>
          ) : (
            <>
              {(client as any).enterpriseInfo?.entityType ? (
                <div style={{ marginBottom: 16 }}>
                  <Tag color={(client as any).enterpriseInfo.entityType === 'COMPANY_CN' ? 'blue' : (client as any).enterpriseInfo.entityType === 'COMPANY_OVERSEAS' ? 'green' : 'orange'} style={{ marginBottom: 12 }}>
                    {(client as any).enterpriseInfo.entityType === 'COMPANY_CN' ? '中国企业' : (client as any).enterpriseInfo.entityType === 'COMPANY_OVERSEAS' ? '海外企业' : '个人'}
                  </Tag>
                  {(client as any).enterpriseInfo.entityType === 'COMPANY_CN' && (
                    <>
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="公司全称" span={2}>{(client as any).enterpriseInfo.companyName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="统一社会信用代码" span={2}>{(client as any).enterpriseInfo.unifiedCreditCode || '-'}</Descriptions.Item>
                        <Descriptions.Item label="法定代表人">{(client as any).enterpriseInfo.legalRepresentative || '-'}</Descriptions.Item>
                        <Descriptions.Item label="注册地址">{(client as any).enterpriseInfo.registeredAddress || '-'}</Descriptions.Item>
                      </Descriptions>
                      <Divider plain style={{ fontSize: 12, margin: '12px 0 8px' }}>开票信息</Divider>
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="纳税人识别号" span={2}>{(client as any).enterpriseInfo.taxpayerId || '-'}</Descriptions.Item>
                        <Descriptions.Item label="开票地址">{(client as any).enterpriseInfo.invoiceAddress || '-'}</Descriptions.Item>
                        <Descriptions.Item label="开票电话">{(client as any).enterpriseInfo.invoicePhone || '-'}</Descriptions.Item>
                      </Descriptions>
                      <Divider plain style={{ fontSize: 12, margin: '12px 0 8px' }}>银行 & 联系方式</Divider>
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="开户银行">{(client as any).enterpriseInfo.bankName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="银行账号">{(client as any).enterpriseInfo.bankAccount || '-'}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{(client as any).enterpriseInfo.contactPhone || '-'}</Descriptions.Item>
                        <Descriptions.Item label="邮箱">{(client as any).enterpriseInfo.contactEmail || '-'}</Descriptions.Item>
                      </Descriptions>
                    </>
                  )}
                  {(client as any).enterpriseInfo.entityType === 'COMPANY_OVERSEAS' && (
                    <>
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="公司名称" span={2}>{(client as any).enterpriseInfo.overseasCompanyName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="注册国家">{(client as any).enterpriseInfo.overseasCountry || '-'}</Descriptions.Item>
                        <Descriptions.Item label="注册号">{(client as any).enterpriseInfo.overseasRegNumber || '-'}</Descriptions.Item>
                        <Descriptions.Item label="税号">{(client as any).enterpriseInfo.overseasTaxNumber || '-'}</Descriptions.Item>
                        <Descriptions.Item label="负责人">{(client as any).enterpriseInfo.overseasDirector || '-'}</Descriptions.Item>
                        {Array.isArray((client as any).enterpriseInfo.customFields) && (client as any).enterpriseInfo.customFields.map((cf: any, idx: number) => (
                          <Descriptions.Item key={idx} label={cf.label}>{cf.value || '-'}</Descriptions.Item>
                        ))}
                      </Descriptions>
                      <Divider plain style={{ fontSize: 12, margin: '12px 0 8px' }}>银行信息</Divider>
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="开户银行">{(client as any).enterpriseInfo.bankName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="银行账号">{(client as any).enterpriseInfo.bankAccount || '-'}</Descriptions.Item>
                      </Descriptions>
                    </>
                  )}
                  {(client as any).enterpriseInfo.entityType === 'INDIVIDUAL' && (
                    <>
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="姓名">{(client as any).enterpriseInfo.realName || '-'}</Descriptions.Item>
                        <Descriptions.Item label="证件类型">{(client as any).enterpriseInfo.idType === 'ID_CARD' ? '身份证' : (client as any).enterpriseInfo.idType === 'PASSPORT' ? '护照' : '-'}</Descriptions.Item>
                        <Descriptions.Item label="证件号码" span={2}>{(client as any).enterpriseInfo.idNumber || '-'}</Descriptions.Item>
                        <Descriptions.Item label="联系电话">{(client as any).enterpriseInfo.contactPhone || '-'}</Descriptions.Item>
                        <Descriptions.Item label="邮箱">{(client as any).enterpriseInfo.contactEmail || '-'}</Descriptions.Item>
                        <Descriptions.Item label="开户银行" span={2}>{(client as any).enterpriseInfo.bankName || '-'}</Descriptions.Item>
                      </Descriptions>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
                  <Alert
                    message={<><Text strong>{client.name}</Text> <Text type="secondary">— 未设置企业资质</Text></>}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                  />
                  <Button type="link" onClick={() => { setEditingSection('enterprise'); setupSectionForm('enterprise'); }}>立即设置</Button>
                </div>
              )}
            </>
          )}

          <Divider style={{ marginTop: 24, marginBottom: 12 }}>物流下单信息</Divider>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>发货人信息</Text>
            <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openSenderEditor()}>新增发货人</Button>
          </div>
          <Table
            dataSource={senderEntries}
            columns={senderColumns}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: '暂无发货人信息' }}
            style={{ marginBottom: 20 }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>收货人信息</Text>
            <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openReceiverEditor()}>新增收货人</Button>
          </div>
          <Table
            dataSource={receiverEntries}
            columns={receiverColumns}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: '暂无收货人信息' }}
            style={{ marginBottom: 20 }}
          />

        </Tabs.TabPane>
        <Tabs.TabPane tab={`订单列表 (${tradeStats.totalOrders})`} key="2">
          <Table
            dataSource={clientOrders}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
            columns={[
              {
                title: '运单号',
                key: 'display_order_no',
                width: 150,
                render: (_: any, row: any) => <a>{row.order_no || row.display_order_no || '-'}</a>
              },
              {
                title: '状态',
                key: 'order_status',
                width: 100,
                render: (_: any, row: any) => {
                  const status = row.order_status || row.status;
                  const statusMap: Record<string, { text: string; color: string }> = {
                    DRAFT: { text: '草稿', color: 'default' },
                    PENDING_INBOUND: { text: '待入库', color: 'default' },
                    INBOUND: { text: '已入库', color: 'processing' },
                    PENDING_DEPARTURE: { text: '待离港', color: 'processing' },
                    DEPARTED: { text: '已离港', color: 'processing' },
                    IN_TRANSIT: { text: '运输中', color: 'blue' },
                    ARRIVED: { text: '已到港', color: 'cyan' },
                    PARTIAL_DELIVERED: { text: '部分妥投', color: 'orange' },
                    COMPLETED: { text: '已完成', color: 'success' },
                    EXCEPTION: { text: '异常', color: 'error' },
                    RETURN_APPLIED: { text: '退货审核中', color: 'warning' },
                    CANCELLED: { text: '已取消', color: 'error' },
                  };
                  const config = statusMap[status] || { text: status, color: 'default' };
                  return <Tag color={config.color}>{config.text}</Tag>;
                }
              },
              {
                title: '金额',
                key: 'total_receivable_amount',
                width: 120,
                render: (_: any, row: any) => {
                  const amount = Number(row.total_receivable_amount ?? row.totalAmount ?? 0);
                  return `¥${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
                }
              },
              {
                title: '创建时间',
                key: 'created_at',
                width: 120,
                render: (_: any, row: any) => dayjs(row.created_at || row.createdAt).format('YYYY-MM-DD')
              }
            ]}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab="交易数据" key="3">
          <Card title="交易统计" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="平均订单金额"
                  value={tradeStats.avgAmount}
                  precision={2}
                  prefix="¥"
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="完成率"
                  value={tradeStats.totalOrders > 0 ? (tradeStats.completedOrders / tradeStats.totalOrders * 100) : 0}
                  precision={1}
                  suffix="%"
                />
              </Col>
            </Row>
          </Card>

          <Card title="订单状态分布">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="待处理">
                {clientOrders.filter(o => ['DRAFT', 'PENDING_INBOUND', 'INBOUND'].includes(o.order_status || o.status)).length} 票
              </Descriptions.Item>
              <Descriptions.Item label="已确认">
                {clientOrders.filter(o => ['PENDING_DEPARTURE', 'DEPARTED'].includes(o.order_status || o.status)).length} 票
              </Descriptions.Item>
              <Descriptions.Item label="运输中">
                {clientOrders.filter(o => ['IN_TRANSIT', 'ARRIVED', 'PARTIAL_DELIVERED'].includes(o.order_status || o.status)).length} 票
              </Descriptions.Item>
              <Descriptions.Item label="已完成">
                {clientOrders.filter(o => (o.order_status || o.status) === 'COMPLETED').length} 票
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Tabs.TabPane>
        <Tabs.TabPane tab="跟进记录" key="4">
          <Timeline
            style={{ marginTop: 20 }}
            items={(poolLogs || []).map((log) => {
              const actionTextMap: Record<string, string> = {
                CLAIM: '认领',
                RELEASE: '释放至公海',
                TRANSFER: '转移归属',
                AUTO_RELEASE: '系统自动回收'
              };
              const poolTypeMap: Record<string, string> = { PRIVATE: '私海', PUBLIC: '公海' };
              const actionText = actionTextMap[log.action] || log.action;
              const fromText = log.fromPoolType ? poolTypeMap[log.fromPoolType] || log.fromPoolType : '-';
              const toText = log.toPoolType ? poolTypeMap[log.toPoolType] || log.toPoolType : '-';
              const operator = log.operatorName || log.operatorId || '系统';
              const reasonText = log.reason ? `；原因：${log.reason}` : '';
              return {
                children: `${dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')} ${actionText}（${fromText} -> ${toText}），操作人：${operator}${reasonText}`
              };
            })}
          />
          {poolLogs.length === 0 && <Text type="secondary">暂无流转记录</Text>}
        </Tabs.TabPane>
        <Tabs.TabPane tab="入仓号" key="5">
          <WarehouseEntryTab client={client} />
        </Tabs.TabPane>
      </Tabs>

      <Modal
        title={editingSenderId ? '编辑发货人信息' : '新增发货人信息'}
        open={senderModalOpen}
        onCancel={() => {
          setSenderModalOpen(false);
          setEditingSenderId(null);
        }}
        onOk={handleSaveSender}
        confirmLoading={savingSender}
        destroyOnClose
        width={680}
        okText="保存"
      >
        <Form form={senderForm} layout="vertical">
          <Form.Item name="label" label="标签（可选）">
            <Input placeholder="例如：广州办公室 / 上海仓" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="senderName" label="发货人姓名" rules={[{ required: true, message: '请输入发货人姓名' }]}>
                <Input placeholder="发货人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="senderPhone" label="发货人电话" rules={[{ required: true, message: '请输入发货人电话' }]}>
                <Input placeholder="发货人电话" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="senderCountry" label="发货国家">
                <Input placeholder="发货国家" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="senderCity" label="发货城市">
                <Input placeholder="发货城市" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="senderAddress" label="发货详细地址" rules={[{ required: true, message: '请输入发货详细地址' }]}>
            <Input.TextArea rows={2} placeholder="发货详细地址" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingReceiverId ? '编辑收货人信息' : '新增收货人信息'}
        open={receiverModalOpen}
        onCancel={() => {
          setReceiverModalOpen(false);
          setEditingReceiverId(null);
        }}
        onOk={handleSaveReceiver}
        confirmLoading={savingReceiver}
        destroyOnClose
        width={680}
        okText="保存"
      >
        <Form form={receiverForm} layout="vertical">
          <Form.Item name="label" label="标签（可选）">
            <Input placeholder="例如：拉各斯总部 / 默认签收点" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="consigneeName" label="收货人姓名" rules={[{ required: true, message: '请输入收货人姓名' }]}>
                <Input placeholder="收货人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="consigneePhone" label="收货人电话" rules={[{ required: true, message: '请输入收货人电话' }]}>
                <Input placeholder="收货人电话" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="consigneeCountry" label="收货国家">
                <Input placeholder="收货国家" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="consigneeCity" label="收货城市">
                <Input placeholder="收货城市" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="consigneeZipCode" label="邮编">
                <Input placeholder="邮编" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="consigneeAddress" label="收货详细地址" rules={[{ required: true, message: '请输入收货详细地址' }]}>
            <Input.TextArea rows={2} placeholder="收货详细地址" />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};
