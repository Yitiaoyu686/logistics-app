import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { commissionApi } from '../../api';

const { Text } = Typography;

type PlanType = 'PLAN_A_ABCD' | 'PLAN_B_SEA_VETERAN' | 'PLAN_C_NIGERIA_SEA' | 'PLAN_D_NIGERIA_AIR';
type OfficeType = 'GUANGZHOU' | 'NIGERIA';
type BizType = 'AIR' | 'SEA' | 'BOTH';
type StatusType = 'ACTIVE' | 'INACTIVE';

interface CommissionRule {
  id: string;
  planType: PlanType;
  planName: string;
  office: OfficeType;
  businessType: BizType;
  status: StatusType;
  config?: any;
  updatedAt: string;
}

interface BonusConfig {
  id: string;
  triggerWeightKg: number;
  bonusAmount: number;
  minPersonalWeightKg: number;
  minQualifiedCount: number;
  updatedAt: string;
}

const PLAN_LABELS: Record<PlanType, string> = {
  PLAN_A_ABCD: '方案A（广州空运）',
  PLAN_B_SEA_VETERAN: '方案B（广州海运）',
  PLAN_C_NIGERIA_SEA: '方案C（尼日利亚海运）',
  PLAN_D_NIGERIA_AIR: '方案D（尼日利亚空运）',
};

const OFFICE_LABELS: Record<OfficeType, string> = {
  GUANGZHOU: '广州',
  NIGERIA: '尼日利亚',
};

const BIZ_LABELS: Record<BizType, string> = {
  AIR: '空运',
  SEA: '海运',
  BOTH: '空运+海运',
};

export const CommissionRuleManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [bonus, setBonus] = useState<BonusConfig | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [form] = Form.useForm();

  const [bonusVisible, setBonusVisible] = useState(false);
  const [bonusForm] = Form.useForm();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rulesRes, bonusRes]: any[] = await Promise.all([
        commissionApi.listRules(),
        commissionApi.getBonus(),
      ]);
      setRules(Array.isArray(rulesRes?.data) ? rulesRes.data : []);
      const bonusData = bonusRes?.data || null;
      setBonus(bonusData);
      if (bonusData) {
        bonusForm.setFieldsValue({
          triggerWeightKg: Number(bonusData.triggerWeightKg || 0),
          bonusAmount: Number(bonusData.bonusAmount || 0),
          minPersonalWeightKg: Number(bonusData.minPersonalWeightKg || 0),
          minQualifiedCount: Number(bonusData.minQualifiedCount || 0),
        });
      }
    } catch (err: any) {
      message.error(err?.message || '加载提成规则失败');
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      planType: 'PLAN_A_ABCD',
      office: 'GUANGZHOU',
      businessType: 'AIR',
      status: 'ACTIVE',
      configText: '{}',
    });
    setEditVisible(true);
  };

  const openEdit = (row: CommissionRule) => {
    setEditingRule(row);
    form.setFieldsValue({
      planType: row.planType,
      planName: row.planName,
      office: row.office,
      businessType: row.businessType,
      status: row.status,
      configText: JSON.stringify(row.config || {}, null, 2),
    });
    setEditVisible(true);
  };

  const saveRule = async () => {
    try {
      const values = await form.validateFields();
      let configObj: any = null;
      if (String(values.configText || '').trim()) {
        try {
          configObj = JSON.parse(String(values.configText));
        } catch {
          message.error('配置 JSON 格式不正确');
          return;
        }
      }

      const payload = {
        planType: values.planType,
        planName: values.planName,
        office: values.office,
        businessType: values.businessType,
        status: values.status,
        config: configObj,
      };

      if (editingRule) {
        await commissionApi.updateRule(editingRule.id, payload);
        message.success('规则已更新');
      } else {
        await commissionApi.createRule(payload);
        message.success('规则已创建');
      }

      setEditVisible(false);
      setEditingRule(null);
      form.resetFields();
      fetchAll();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || '保存失败');
    }
  };

  const toggleStatus = async (row: CommissionRule) => {
    try {
      const nextStatus: StatusType = row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await commissionApi.updateRule(row.id, { status: nextStatus });
      message.success(nextStatus === 'ACTIVE' ? '规则已启用' : '规则已停用');
      fetchAll();
    } catch (err: any) {
      message.error(err?.message || '状态更新失败');
    }
  };

  const deleteRule = async (row: CommissionRule) => {
    try {
      await commissionApi.deleteRule(row.id);
      message.success('规则已删除');
      fetchAll();
    } catch (err: any) {
      message.error(err?.message || '删除失败');
    }
  };

  const saveBonus = async () => {
    try {
      const values = await bonusForm.validateFields();
      await commissionApi.updateBonus(values);
      message.success('彩蛋奖金配置已保存');
      setBonusVisible(false);
      fetchAll();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || '保存失败');
    }
  };

  const columns = [
    {
      title: '方案',
      key: 'plan',
      width: 240,
      render: (_: unknown, row: CommissionRule) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.planName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.id} · {PLAN_LABELS[row.planType]}</Text>
        </Space>
      ),
    },
    {
      title: '归属',
      key: 'office',
      width: 180,
      render: (_: unknown, row: CommissionRule) => (
        <Space>
          <Tag color="blue">{OFFICE_LABELS[row.office]}</Tag>
          <Tag>{BIZ_LABELS[row.businessType]}</Tag>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: StatusType) => (
        <Tag color={value === 'ACTIVE' ? 'success' : 'default'}>{value}</Tag>
      ),
    },
    {
      title: '配置项',
      key: 'config',
      width: 120,
      render: (_: unknown, row: CommissionRule) => Object.keys(row.config || {}).length,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 170,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right' as const,
      render: (_: unknown, row: CommissionRule) => (
        <Space size="small">
          <Button size="small" onClick={() => openEdit(row)}>编辑</Button>
          <Button size="small" onClick={() => toggleStatus(row)}>{row.status === 'ACTIVE' ? '停用' : '启用'}</Button>
          <Popconfirm title="确认删除该规则？" onConfirm={() => deleteRule(row)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Tag color="blue">规则总数 {rules.length}</Tag></Col>
        <Col span={8}><Tag color="success">启用 {rules.filter((r) => r.status === 'ACTIVE').length}</Tag></Col>
        <Col span={8}><Tag>停用 {rules.filter((r) => r.status === 'INACTIVE').length}</Tag></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增规则</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchAll}>刷新</Button>
          <Button onClick={() => setBonusVisible(true)}>彩蛋奖金配置</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rules}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1020 }}
      />

      <Card style={{ marginTop: 16 }}>
        <Space direction="vertical" size={4}>
          <Text strong>彩蛋奖金配置（数据库）</Text>
          <Text type="secondary">触发总重量: {bonus ? Number(bonus.triggerWeightKg).toLocaleString() : '-'} kg</Text>
          <Text type="secondary">奖金池: {bonus ? Number(bonus.bonusAmount).toLocaleString() : '-'} CNY</Text>
          <Text type="secondary">个人最低重量: {bonus ? Number(bonus.minPersonalWeightKg).toLocaleString() : '-'} kg</Text>
          <Text type="secondary">最少达标人数: {bonus ? Number(bonus.minQualifiedCount) : '-'}</Text>
        </Space>
      </Card>

      <Modal
        title={editingRule ? '编辑提成规则' : '新增提成规则'}
        open={editVisible}
        onCancel={() => {
          setEditVisible(false);
          setEditingRule(null);
          form.resetFields();
        }}
        onOk={saveRule}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="planType" label="方案类型" rules={[{ required: true, message: '请选择方案类型' }]}> 
                <Select>
                  {Object.entries(PLAN_LABELS).map(([value, label]) => (
                    <Select.Option key={value} value={value}>{label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}> 
                <Select>
                  <Select.Option value="ACTIVE">ACTIVE</Select.Option>
                  <Select.Option value="INACTIVE">INACTIVE</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="planName" label="方案名称" rules={[{ required: true, message: '请输入方案名称' }]}> 
            <Input placeholder="例如：广州主方案ABCD" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="office" label="归属办公室" rules={[{ required: true, message: '请选择办公室' }]}> 
                <Select>
                  <Select.Option value="GUANGZHOU">广州</Select.Option>
                  <Select.Option value="NIGERIA">尼日利亚</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="businessType" label="业务线" rules={[{ required: true, message: '请选择业务线' }]}> 
                <Select>
                  <Select.Option value="AIR">空运</Select.Option>
                  <Select.Option value="SEA">海运</Select.Option>
                  <Select.Option value="BOTH">空运+海运</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="configText" label="规则配置 JSON" rules={[{ required: true, message: '请输入配置 JSON' }]}> 
            <Input.TextArea rows={10} placeholder='{"baseTickets":50,"tiers":[...]}' />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="彩蛋奖金配置"
        open={bonusVisible}
        onCancel={() => setBonusVisible(false)}
        onOk={saveBonus}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={bonusForm} layout="vertical">
          <Form.Item name="triggerWeightKg" label="触发总重量(kg)" rules={[{ required: true, message: '请输入触发总重量' }]}> 
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="bonusAmount" label="奖金池(CNY)" rules={[{ required: true, message: '请输入奖金池' }]}> 
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minPersonalWeightKg" label="个人最低重量(kg)" rules={[{ required: true, message: '请输入个人最低重量' }]}> 
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minQualifiedCount" label="最少达标人数" rules={[{ required: true, message: '请输入最少达标人数' }]}> 
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
