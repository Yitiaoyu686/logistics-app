import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Input, Select, Tag, Modal, Form, message, Row, Col, Space, Badge, DatePicker, Popconfirm, Drawer, Tabs, Timeline, Card, Descriptions, Statistic, Typography, Divider, Alert, Collapse } from 'antd';
import { PlusOutlined, SearchOutlined, UserOutlined, ExportOutlined, SwapOutlined, PhoneOutlined, MailOutlined, HomeOutlined, HistoryOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { clientApi, v2OmsApi } from '../../api';

// Status mappings between API (English) and UI (Chinese)
const STATUS_MAP: Record<string, ClientStatus> = { ACTIVE: '活跃', DORMANT: '沉睡', FROZEN: '冻结' };
const STATUS_MAP_REV: Record<string, string> = { '活跃': 'ACTIVE', '沉睡': 'DORMANT', '冻结': 'FROZEN' };
const POOL_MAP: Record<string, ClientPoolType> = { PRIVATE: '私海', PUBLIC: '公海' };
const mapClient = (c: any): Client => ({ ...c, status: STATUS_MAP[c.status] || c.status, poolType: POOL_MAP[c.poolType] || c.poolType });


const { Option } = Select;
const { Text } = Typography;

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

// --- 1. Customer Form Modal ---
interface CustomerFormProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (values: any) => void;
  initialValues?: Partial<Client>;
  poolType: ClientPoolType; 
}

export const CustomerFormModal: React.FC<CustomerFormProps> = ({ open, onCancel, onSuccess, initialValues, poolType }) => {
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
        logisticsInfo: hasLogisticsInfo ? logisticsInfo : undefined
      });
      form.resetFields();
    });
  };

  return (
    <Modal
      title={isEdit ? '编辑客户资料' : '快速创建客户'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={isEdit ? 800 : 680}
      okText={isEdit ? '保存' : '创建客户'}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        {!isEdit ? (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="创建后可在客户详情继续完善海运/空运档案、收件人地址和物流偏好。"
            />
            <Divider plain style={{ fontSize: 12 }}>快速创建</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="name" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                  <Input placeholder="公司全称/客户名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="country" label="所在国家" rules={[{ required: true, message: '请选择国家' }]}>
                  <Select placeholder="选择国家">
                    <Option value="中国">中国</Option>
                    <Option value="美国">美国</Option>
                    <Option value="英国">英国</Option>
                    <Option value="日本">日本</Option>
                    <Option value="韩国">韩国</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="contactName" label="联系人" rules={[{ required: true, message: '请输入联系人' }]}>
                  <Input placeholder="联系人姓名" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                  <Input placeholder="手机号码" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="source" label="客户来源">
                  <Select placeholder="选择来源">
                    <Option value="线上推广">线上推广</Option>
                    <Option value="老客介绍">老客介绍</Option>
                    <Option value="展会">展会</Option>
                    <Option value="电话营销">电话营销</Option>
                    <Option value="其他">其他</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Collapse
              size="small"
              items={[
                {
                  key: 'advanced',
                  label: '补充资料（可选）',
                  children: (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="industry" label="所属行业">
                            <Select placeholder="选择行业">
                              <Option value="电商">电商</Option>
                              <Option value="制造业">制造业</Option>
                              <Option value="贸易">贸易</Option>
                              <Option value="零售">零售</Option>
                              <Option value="其他">其他</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="companyType" label="公司类型">
                            <Select placeholder="选择类型">
                              <Option value="个人">个人</Option>
                              <Option value="企业">企业</Option>
                              <Option value="个体工商户">个体工商户</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="creditLevel" label="信用等级">
                            <Select placeholder="选择等级">
                              <Option value="A">A级（优秀）</Option>
                              <Option value="B">B级（良好）</Option>
                              <Option value="C">C级（一般）</Option>
                              <Option value="D">D级（较差）</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="contactEmail" label="邮箱">
                            <Input placeholder="电子邮箱" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={24}>
                          <Form.Item name="address" label="详细地址">
                            <Input.TextArea rows={2} placeholder="请输入详细地址" />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={24}>
                          <Form.Item name="remark" label="备注说明">
                            <Input.TextArea rows={2} placeholder="请输入备注信息" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )
                }
              ]}
            />
          </>
        ) : (
          <>
            <Divider plain style={{ fontSize: 12 }}>基本信息</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="name" label="客户名称" rules={[{ required: true }]}>
                  <Input placeholder="公司全称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="country" label="所在国家" rules={[{ required: true }]}>
                  <Select placeholder="选择国家">
                    <Option value="中国">中国</Option>
                    <Option value="美国">美国</Option>
                    <Option value="英国">英国</Option>
                    <Option value="日本">日本</Option>
                    <Option value="韩国">韩国</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="industry" label="所属行业">
                  <Select placeholder="选择行业">
                    <Option value="电商">电商</Option>
                    <Option value="制造业">制造业</Option>
                    <Option value="贸易">贸易</Option>
                    <Option value="零售">零售</Option>
                    <Option value="其他">其他</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="companyType" label="公司类型">
                  <Select placeholder="选择类型">
                    <Option value="个人">个人</Option>
                    <Option value="企业">企业</Option>
                    <Option value="个体工商户">个体工商户</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="source" label="客户来源">
                  <Select placeholder="选择来源">
                    <Option value="线上推广">线上推广</Option>
                    <Option value="老客介绍">老客介绍</Option>
                    <Option value="展会">展会</Option>
                    <Option value="电话营销">电话营销</Option>
                    <Option value="其他">其他</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="creditLevel" label="信用等级">
                  <Select placeholder="选择等级">
                    <Option value="A">A级（优秀）</Option>
                    <Option value="B">B级（良好）</Option>
                    <Option value="C">C级（一般）</Option>
                    <Option value="D">D级（较差）</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="address" label="详细地址">
                  <Input.TextArea rows={2} placeholder="请输入详细地址" />
                </Form.Item>
              </Col>
            </Row>
            <Divider plain style={{ fontSize: 12 }}>联系信息</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="contactName" label="联系人" rules={[{ required: true }]}>
                  <Input placeholder="联系人姓名" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true }]}>
                  <Input placeholder="手机号码" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="contactEmail" label="邮箱">
                  <Input placeholder="电子邮箱" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="remark" label="备注说明">
                  <Input.TextArea rows={3} placeholder="请输入备注信息" />
                </Form.Item>
              </Col>
            </Row>
            <Divider plain style={{ fontSize: 12 }}>物流下单信息</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="senderName" label="发货人姓名">
                  <Input placeholder="发货人姓名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="senderPhone" label="发货人电话">
                  <Input placeholder="发货人电话" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="senderCountry" label="发货国家">
                  <Select placeholder="选择国家">
                    <Option value="中国">中国</Option>
                    <Option value="美国">美国</Option>
                    <Option value="英国">英国</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="senderCity" label="发货城市">
                  <Input placeholder="发货城市" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="senderAddress" label="发货详细地址">
                  <Input.TextArea rows={2} placeholder="请输入发货详细地址" />
                </Form.Item>
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="consigneeName" label="收货人姓名">
                  <Input placeholder="收货人姓名" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="consigneePhone" label="收货人电话">
                  <Input placeholder="收货人电话" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="consigneeCountry" label="收货国家">
                  <Select placeholder="选择国家">
                    <Option value="美国">美国</Option>
                    <Option value="英国">英国</Option>
                    <Option value="加拿大">加拿大</Option>
                    <Option value="澳大利亚">澳大利亚</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="consigneeCity" label="收货城市">
                  <Input placeholder="收货城市" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="consigneeZipCode" label="邮编">
                  <Input placeholder="邮政编码" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="consigneeAddress" label="收货详细地址">
                  <Input.TextArea rows={2} placeholder="请输入收货详细地址" />
                </Form.Item>
              </Col>
            </Row>
            <Divider plain style={{ fontSize: 12 }}>常用物流设置</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="preferredTransportType" label="偏好运输方式">
                  <Select placeholder="选择运输方式">
                    <Option value="SEA">海运</Option>
                    <Option value="AIR">空运</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="preferredServiceType" label="服务类型">
                  <Select placeholder="选择服务类型">
                    <Option value="普通">普通</Option>
                    <Option value="加急">加急</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="preferredRoute" label="常用线路">
                  <Input placeholder="例如：广州-洛杉矶" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="paymentMethod" label="付款方式">
                  <Select placeholder="选择付款方式">
                    <Option value="预付">预付</Option>
                    <Option value="到付">到付</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </>
        )}
      </Form>
    </Modal>
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
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [transferClient, setTransferClient] = useState<Client | null>(null);
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferToSalesId, setTransferToSalesId] = useState<string>();
  const [transferReason, setTransferReason] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await clientApi.list({ poolType: 'PRIVATE' });
      setData((res.data || []).map(mapClient));
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
      setEditingClient(null);
      message.success(`客户新增成功（编号：${res?.data?.shortCode || '-'}）`);
      fetchData();
    } catch (e: any) {
      message.error(e.message || '新增失败');
    }
  };

  // 编辑客户
  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  // 更新客户
  const handleUpdate = async (values: any) => {
    if (!editingClient) return;
    try {
      await clientApi.update(editingClient.id, {
        name: values.name,
        country: values.country,
        address: values.address,
        industry: values.industry,
        contact: { name: values.contactName, phone: values.contactPhone, email: values.contactEmail },
        logisticsInfo: values.logisticsInfo,
        source: values.source,
        remark: values.remark,
        companyType: values.companyType,
        creditLevel: values.creditLevel,
      });
      setIsModalOpen(false);
      setEditingClient(null);
      message.success('客户更新成功');
      fetchData();
    } catch (e: any) {
      message.error(e.message || '更新失败');
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
      width: 100,
      fixed: 'left' as const,
      render: (t: string, r: Client) => (
        <a onClick={() => { setCurrentClient(r); setDetailVisible(true); }}>{t}</a>
      )
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
      title: '最近下单',
      dataIndex: 'lastOrderTime',
      width: 120,
      render: (t: string) => t ? dayjs(t).format('YYYY-MM-DD') : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (s: string) => <Tag color={s === '活跃' ? 'green' : s === '沉睡' ? 'orange' : 'red'}>{s}</Tag>
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, r: Client) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => { setCurrentClient(r); setDetailVisible(true); }}>详情</Button>
          <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
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
            onClick={() => {
              setEditingClient(null);
              setIsModalOpen(true);
            }}
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
        scroll={{ x: 1600 }}
      />
      <CustomerFormModal
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingClient(null);
        }}
        onSuccess={editingClient ? handleUpdate : handleAdd}
        initialValues={editingClient || undefined}
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await clientApi.list({ poolType: 'PUBLIC' });
      setData((res.data || []).map(mapClient));
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

  // 认领客户
  const handleClaim = async (client: Client) => {
    try {
      const localUser: any = getLocalUser();
      const preferredSalesId = resolvePreferredSalesUserId(salesUsers);
      if (!preferredSalesId) {
        message.error('当前没有可认领的业务员，请先在系统中维护业务员账号');
        return;
      }
      await clientApi.claim(client.id, preferredSalesId, localUser?.id, localUser?.realName || localUser?.username);
      message.success('认领成功！已移入我的客户');
      fetchData();
    } catch (e: any) { message.error(e.message); }
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
          >
            认领
          </Button>
        </Space>
      )
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
        scroll={{ x: 1600 }}
      />
      <CustomerFormModal
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

  if (!client) return null;

  return (
    <Drawer title={client.name} width={700} onClose={onClose} open={open}>
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
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="客户编号">{client.shortCode}</Descriptions.Item>
            <Descriptions.Item label="客户名称">{client.name}</Descriptions.Item>
            <Descriptions.Item label="所属行业">{client.industry || '-'}</Descriptions.Item>
            <Descriptions.Item label="公司类型">{client.companyType || '-'}</Descriptions.Item>
            <Descriptions.Item label="所在国家">{client.country}</Descriptions.Item>
            <Descriptions.Item label="详细地址">{client.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系人">{client.contact.name}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{client.contact.phone}</Descriptions.Item>
            <Descriptions.Item label="联系邮箱">{client.contact.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户来源">{client.source || '-'}</Descriptions.Item>
            <Descriptions.Item label="信用等级">
              {client.creditLevel ? <Tag color={client.creditLevel === 'A' ? 'green' : client.creditLevel === 'B' ? 'blue' : client.creditLevel === 'C' ? 'orange' : 'red'}>{client.creditLevel}级</Tag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="业务员">{client.salesPerson || client.salesId || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{dayjs(client.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="备注说明">{client.remark || '-'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ marginTop: 24, marginBottom: 12 }}>物流下单信息</Divider>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong>发货人信息</Text>
            <Button type="link" onClick={() => openSenderEditor()}>新增发货人</Button>
          </div>
          {senderEntries.length === 0 && (
            <Alert
              type="warning"
              showIcon
              message="暂无发货人信息"
              style={{ marginBottom: 16 }}
            />
          )}
          {senderEntries.map((entry, index) => (
            <Card
              key={entry.id}
              title={entry.label || `发货人 #${index + 1}`}
              size="small"
              style={{ marginBottom: 16 }}
              extra={(
                <Space>
                  <Button type="link" size="small" onClick={() => openSenderEditor(entry)}>编辑</Button>
                  <Popconfirm title="确定删除这条发货人信息？" onConfirm={() => handleDeleteSender(entry.id)}>
                    <Button type="link" danger size="small">删除</Button>
                  </Popconfirm>
                </Space>
              )}
            >
              <Descriptions column={2} size="small">
                <Descriptions.Item label="姓名">{entry.senderName || '-'}</Descriptions.Item>
                <Descriptions.Item label="电话">{entry.senderPhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="国家">{entry.senderCountry || '-'}</Descriptions.Item>
                <Descriptions.Item label="城市">{entry.senderCity || '-'}</Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>{entry.senderAddress || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>
          ))}

          <Divider style={{ margin: '8px 0 12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong>收货人信息</Text>
            <Button type="link" onClick={() => openReceiverEditor()}>新增收货人</Button>
          </div>
          {receiverEntries.length === 0 && (
            <Alert
              type="warning"
              showIcon
              message="暂无收货人信息"
              style={{ marginBottom: 16 }}
            />
          )}
          {receiverEntries.map((entry, index) => (
            <Card
              key={entry.id}
              title={entry.label || `收货人 #${index + 1}`}
              size="small"
              style={{ marginBottom: 16 }}
              extra={(
                <Space>
                  <Button type="link" size="small" onClick={() => openReceiverEditor(entry)}>编辑</Button>
                  <Popconfirm title="确定删除这条收货人信息？" onConfirm={() => handleDeleteReceiver(entry.id)}>
                    <Button type="link" danger size="small">删除</Button>
                  </Popconfirm>
                </Space>
              )}
            >
              <Descriptions column={2} size="small">
                <Descriptions.Item label="姓名">{entry.consigneeName || '-'}</Descriptions.Item>
                <Descriptions.Item label="电话">{entry.consigneePhone || '-'}</Descriptions.Item>
                <Descriptions.Item label="国家">{entry.consigneeCountry || '-'}</Descriptions.Item>
                <Descriptions.Item label="城市">{entry.consigneeCity || '-'}</Descriptions.Item>
                <Descriptions.Item label="邮编">{entry.consigneeZipCode || '-'}</Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>{entry.consigneeAddress || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>
          ))}

          <Card title="常用物流设置" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="偏好运输方式">
                {client.logisticsInfo?.preferredTransportType ? (
                  <Tag color={client.logisticsInfo.preferredTransportType === 'SEA' ? 'blue' : 'orange'}>
                    {client.logisticsInfo.preferredTransportType === 'SEA' ? '海运' : '空运'}
                  </Tag>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="服务类型">{client.logisticsInfo?.preferredServiceType || '-'}</Descriptions.Item>
              <Descriptions.Item label="常用线路">{client.logisticsInfo?.preferredRoute || '-'}</Descriptions.Item>
              <Descriptions.Item label="付款方式">{client.logisticsInfo?.paymentMethod || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
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
