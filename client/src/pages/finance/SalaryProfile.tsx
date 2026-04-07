import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber,
  message, Row, Col, Statistic, DatePicker, Popconfirm, Drawer, Timeline, Typography, Descriptions
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
  HistoryOutlined, TeamOutlined, DollarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface SalaryProfileRecord {
  id: string;
  name: string;
  department: string;
  position: string;
  entryDate: string;
  baseSalary: number;
  positionAllowance: number;
  mealAllowance: number;
  transportAllowance: number;
  socialInsuranceCompany: number;
  socialInsurancePersonal: number;
  housingFundCompany: number;
  housingFundPersonal: number;
  status: 'ACTIVE' | 'INACTIVE';
  adjustHistory: { date: string; field: string; oldValue: number; newValue: number; reason: string }[];
}

const DEPARTMENTS = ['销售部', '操作部', '仓储部', '财务部', '管理层'];
const POSITIONS = ['推广', '客服', '仓管员', '推广部经理', '总经理', '操作员'];

const fmt = (v: number) => `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const generateMockProfiles = (): SalaryProfileRecord[] => [
  { id: 'SP001', name: '黄颖', department: '销售部', position: '推广', entryDate: '2018-03-15', baseSalary: 5000, positionAllowance: 500, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 1200, socialInsurancePersonal: 480, housingFundCompany: 600, housingFundPersonal: 600, status: 'ACTIVE', adjustHistory: [{ date: '2024-01-01', field: '基本工资', oldValue: 4500, newValue: 5000, reason: '年度调薪' }, { date: '2023-01-01', field: '基本工资', oldValue: 4000, newValue: 4500, reason: '年度调薪' }] },
  { id: 'SP002', name: '吕沛霖', department: '销售部', position: '推广', entryDate: '2019-06-01', baseSalary: 4200, positionAllowance: 400, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 1050, socialInsurancePersonal: 420, housingFundCompany: 500, housingFundPersonal: 500, status: 'ACTIVE', adjustHistory: [{ date: '2024-01-01', field: '基本工资', oldValue: 3800, newValue: 4200, reason: '年度调薪' }] },
  { id: 'SP003', name: '罗泳华', department: '销售部', position: '推广部经理', entryDate: '2017-08-20', baseSalary: 9300, positionAllowance: 1000, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 2200, socialInsurancePersonal: 880, housingFundCompany: 1100, housingFundPersonal: 1100, status: 'ACTIVE', adjustHistory: [] },
  { id: 'SP004', name: '朱小飞', department: '销售部', position: '推广', entryDate: '2019-09-10', baseSalary: 3700, positionAllowance: 300, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 950, socialInsurancePersonal: 380, housingFundCompany: 450, housingFundPersonal: 450, status: 'ACTIVE', adjustHistory: [] },
  { id: 'SP005', name: '陈三凤', department: '销售部', position: '推广', entryDate: '2019-05-15', baseSalary: 3800, positionAllowance: 300, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 960, socialInsurancePersonal: 384, housingFundCompany: 460, housingFundPersonal: 460, status: 'ACTIVE', adjustHistory: [] },
  { id: 'SP006', name: '罗敏', department: '操作部', position: '客服', entryDate: '2020-01-06', baseSalary: 5048, positionAllowance: 400, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 1260, socialInsurancePersonal: 504, housingFundCompany: 620, housingFundPersonal: 620, status: 'ACTIVE', adjustHistory: [] },
  { id: 'SP007', name: '张海峰', department: '仓储部', position: '仓管员', entryDate: '2020-03-15', baseSalary: 4752, positionAllowance: 300, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 1180, socialInsurancePersonal: 472, housingFundCompany: 580, housingFundPersonal: 580, status: 'ACTIVE', adjustHistory: [] },
  { id: 'SP008', name: '李豪', department: '仓储部', position: '仓管员', entryDate: '2020-06-01', baseSalary: 4452, positionAllowance: 300, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 1110, socialInsurancePersonal: 444, housingFundCompany: 540, housingFundPersonal: 540, status: 'ACTIVE', adjustHistory: [] },
  { id: 'SP009', name: '浦海森', department: '管理层', position: '总经理', entryDate: '2017-01-01', baseSalary: 4447, positionAllowance: 0, mealAllowance: 0, transportAllowance: 0, socialInsuranceCompany: 1100, socialInsurancePersonal: 440, housingFundCompany: 550, housingFundPersonal: 550, status: 'ACTIVE', adjustHistory: [] },
  { id: 'SP010', name: '吴敏琪', department: '销售部', position: '推广', entryDate: '2021-02-20', baseSalary: 3500, positionAllowance: 200, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 880, socialInsurancePersonal: 352, housingFundCompany: 420, housingFundPersonal: 420, status: 'INACTIVE', adjustHistory: [] },
];

// 模拟系统用户（来自用户管理模块）
interface SystemUser { id: string; realName: string; department: string; position: string; }
const MOCK_SYSTEM_USERS: SystemUser[] = [
  { id: 'U001', realName: '黄颖', department: '销售部', position: '推广' },
  { id: 'U002', realName: '吕沛霖', department: '销售部', position: '推广' },
  { id: 'U003', realName: '罗泳华', department: '销售部', position: '推广部经理' },
  { id: 'U004', realName: '朱小飞', department: '销售部', position: '推广' },
  { id: 'U005', realName: '陈三凤', department: '销售部', position: '推广' },
  { id: 'U006', realName: '罗敏', department: '操作部', position: '客服' },
  { id: 'U007', realName: '张海峰', department: '仓储部', position: '仓管员' },
  { id: 'U008', realName: '李豪', department: '仓储部', position: '仓管员' },
  { id: 'U009', realName: '浦海森', department: '管理层', position: '总经理' },
  { id: 'U010', realName: '吴敏琪', department: '销售部', position: '推广' },
  { id: 'U011', realName: '罗伟健', department: '销售部', position: '推广' },
  { id: 'U012', realName: '苏慧琪', department: '销售部', position: '推广' },
  { id: 'U013', realName: '罗珮文', department: '操作部', position: '操作员' },
  { id: 'U014', realName: '曾永平', department: '销售部', position: '推广' },
  { id: 'U015', realName: '陆梓龙', department: '销售部', position: '推广' },
];

export const SalaryProfile: React.FC = () => {
  const [data, setData] = useState<SalaryProfileRecord[]>(() => generateMockProfiles());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // 尚未建档的用户
  const availableUsers = useMemo(() => {
    const existingNames = new Set(data.map(d => d.name));
    return MOCK_SYSTEM_USERS.filter(u => !existingNames.has(u.realName));
  }, [data]);

  // 调薪
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustRecord, setAdjustRecord] = useState<SalaryProfileRecord | null>(null);
  const [adjustForm] = Form.useForm();

  // 调薪记录
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyRecord, setHistoryRecord] = useState<SalaryProfileRecord | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  const filteredData = useMemo(() =>
    data.filter(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (deptFilter !== 'ALL' && r.department !== deptFilter) return false;
      return true;
    }), [data, statusFilter, deptFilter]);

  const stats = useMemo(() => {
    const active = data.filter(r => r.status === 'ACTIVE');
    const totalBase = active.reduce((s, r) => s + r.baseSalary + r.positionAllowance + r.mealAllowance + r.transportAllowance, 0);
    const totalSocial = active.reduce((s, r) => s + r.socialInsuranceCompany + r.housingFundCompany, 0);
    return { activeCount: active.length, totalBase, totalSocial, avgSalary: active.length ? totalBase / active.length : 0 };
  }, [data]);

  const getMonthlyTotal = (r: SalaryProfileRecord) => r.baseSalary + r.positionAllowance + r.mealAllowance + r.transportAllowance;

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ status: 'ACTIVE', positionAllowance: 0, mealAllowance: 300, transportAllowance: 200, socialInsuranceCompany: 0, socialInsurancePersonal: 0, housingFundCompany: 0, housingFundPersonal: 0 });
    setModalVisible(true);
  };

  // 选择员工时自动填充部门和职务
  const handleUserSelect = (userId: string) => {
    const user = MOCK_SYSTEM_USERS.find(u => u.id === userId);
    if (user) {
      form.setFieldsValue({ name: user.realName, department: user.department, position: user.position });
    }
  };

  const handleEdit = (record: SalaryProfileRecord) => {
    setEditingId(record.id);
    form.setFieldsValue({ ...record, entryDate: dayjs(record.entryDate) });
    setModalVisible(true);
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      const item: SalaryProfileRecord = {
        id: editingId || `SP${Date.now()}`,
        name: values.name,
        department: values.department,
        position: values.position,
        entryDate: values.entryDate.format('YYYY-MM-DD'),
        baseSalary: values.baseSalary || 0,
        positionAllowance: values.positionAllowance || 0,
        mealAllowance: values.mealAllowance || 0,
        transportAllowance: values.transportAllowance || 0,
        socialInsuranceCompany: values.socialInsuranceCompany || 0,
        socialInsurancePersonal: values.socialInsurancePersonal || 0,
        housingFundCompany: values.housingFundCompany || 0,
        housingFundPersonal: values.housingFundPersonal || 0,
        status: values.status,
        adjustHistory: editingId ? (data.find(d => d.id === editingId)?.adjustHistory || []) : [],
      };
      if (editingId) {
        setData(prev => prev.map(d => d.id === editingId ? item : d));
        message.success('薪资档案已更新');
      } else {
        setData(prev => [...prev, item]);
        message.success('员工薪资档案已创建');
      }
      setModalVisible(false);
    });
  };

  const handleDelete = (id: string) => {
    setData(prev => prev.filter(d => d.id !== id));
    message.success('已删除');
  };

  // 调薪
  const handleOpenAdjust = (record: SalaryProfileRecord) => {
    setAdjustRecord(record);
    adjustForm.resetFields();
    adjustForm.setFieldsValue({ field: '基本工资', newValue: record.baseSalary });
    setAdjustModalVisible(true);
  };

  const handleAdjustSave = () => {
    adjustForm.validateFields().then(values => {
      if (!adjustRecord) return;
      const fieldMap: Record<string, keyof SalaryProfileRecord> = {
        '基本工资': 'baseSalary', '岗位津贴': 'positionAllowance', '餐补': 'mealAllowance',
        '交通补贴': 'transportAllowance', '社保(公司)': 'socialInsuranceCompany', '社保(个人)': 'socialInsurancePersonal',
        '公积金(公司)': 'housingFundCompany', '公积金(个人)': 'housingFundPersonal',
      };
      const key = fieldMap[values.field];
      if (!key) return;
      const oldValue = adjustRecord[key] as number;
      const newHistory = { date: dayjs().format('YYYY-MM-DD'), field: values.field, oldValue, newValue: values.newValue, reason: values.reason || '' };

      setData(prev => prev.map(d => {
        if (d.id !== adjustRecord.id) return d;
        return { ...d, [key]: values.newValue, adjustHistory: [newHistory, ...d.adjustHistory] };
      }));
      message.success(`${values.field} 已从 ${fmt(oldValue)} 调整为 ${fmt(values.newValue)}`);
      setAdjustModalVisible(false);
    });
  };

  const handleShowHistory = (record: SalaryProfileRecord) => {
    setHistoryRecord(record);
    setHistoryVisible(true);
  };

  const columns: any[] = [
    { title: '姓名', dataIndex: 'name', width: 80, fixed: 'left' as const, render: (v: string) => <Text strong>{v}</Text> },
    { title: '部门', dataIndex: 'department', width: 80 },
    { title: '职务', dataIndex: 'position', width: 90 },
    { title: '入职日期', dataIndex: 'entryDate', width: 105 },
    { title: '基本工资', dataIndex: 'baseSalary', width: 100, align: 'right' as const, render: (v: number) => fmt(v) },
    { title: '岗位津贴', dataIndex: 'positionAllowance', width: 90, align: 'right' as const, render: (v: number) => v > 0 ? fmt(v) : '-' },
    { title: '餐补', dataIndex: 'mealAllowance', width: 80, align: 'right' as const, render: (v: number) => v > 0 ? fmt(v) : '-' },
    { title: '交通补贴', dataIndex: 'transportAllowance', width: 90, align: 'right' as const, render: (v: number) => v > 0 ? fmt(v) : '-' },
    {
      title: '月薪合计', key: 'monthlyTotal', width: 110, align: 'right' as const,
      render: (_: unknown, r: SalaryProfileRecord) => <Text strong style={{ color: '#1677ff' }}>{fmt(getMonthlyTotal(r))}</Text>,
    },
    { title: '社保', children: [
      { title: '公司', dataIndex: 'socialInsuranceCompany', width: 85, align: 'right' as const, render: (v: number) => fmt(v) },
      { title: '个人', dataIndex: 'socialInsurancePersonal', width: 85, align: 'right' as const, render: (v: number) => fmt(v) },
    ]},
    { title: '公积金', children: [
      { title: '公司', dataIndex: 'housingFundCompany', width: 85, align: 'right' as const, render: (v: number) => fmt(v) },
      { title: '个人', dataIndex: 'housingFundPersonal', width: 85, align: 'right' as const, render: (v: number) => fmt(v) },
    ]},
    {
      title: '状态', dataIndex: 'status', width: 70, align: 'center' as const,
      render: (v: string) => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v === 'ACTIVE' ? '在职' : '离职'}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 180, fixed: 'right' as const,
      render: (_: unknown, record: SalaryProfileRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => handleOpenAdjust(record)}>调薪</Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => handleShowHistory(record)}>记录</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="在职人数" value={stats.activeCount} prefix={<TeamOutlined />} suffix="人" /></Card></Col>
        <Col span={6}><Card><Statistic title="月薪总额" value={stats.totalBase} prefix="¥" precision={2} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="社保+公积金(公司)/月" value={stats.totalSocial} prefix="¥" precision={2} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均月薪" value={stats.avgSalary} prefix="¥" precision={2} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增员工</Button>
          <Select style={{ width: 120 }} value={statusFilter} onChange={setStatusFilter}>
            <Select.Option value="ALL">全部状态</Select.Option>
            <Select.Option value="ACTIVE">在职</Select.Option>
            <Select.Option value="INACTIVE">离职</Select.Option>
          </Select>
          <Select style={{ width: 120 }} value={deptFilter} onChange={setDeptFilter}>
            <Select.Option value="ALL">全部部门</Select.Option>
            {DEPARTMENTS.map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
          </Select>
          <Button icon={<DownloadOutlined />}>导出Excel</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id" columns={columns} dataSource={filteredData}
          bordered size="small" scroll={{ x: 1500 }}
          pagination={false}
          summary={() => {
            const active = filteredData.filter(r => r.status === 'ACTIVE');
            return (
              <Table.Summary>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}><b>在职合计（{active.length}人）</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right"><b>{fmt(active.reduce((s, r) => s + r.baseSalary, 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right"><b>{fmt(active.reduce((s, r) => s + r.positionAllowance, 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right"><b>{fmt(active.reduce((s, r) => s + r.mealAllowance, 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><b>{fmt(active.reduce((s, r) => s + r.transportAllowance, 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right"><b style={{ color: '#1677ff' }}>{fmt(active.reduce((s, r) => s + getMonthlyTotal(r), 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right"><b>{fmt(active.reduce((s, r) => s + r.socialInsuranceCompany, 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right"><b>{fmt(active.reduce((s, r) => s + r.socialInsurancePersonal, 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right"><b>{fmt(active.reduce((s, r) => s + r.housingFundCompany, 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right"><b>{fmt(active.reduce((s, r) => s + r.housingFundPersonal, 0))}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={10} colSpan={2} />
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </Card>

      {/* 新增/编辑 Modal */}
      <Modal title={editingId ? '编辑薪资档案' : '新增员工薪资档案'} open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} destroyOnClose width={700}>
        <Form form={form} layout="vertical">
          {!editingId ? (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="选择员工" rules={[{ required: true, message: '请选择员工' }]}>
                  <Select
                    placeholder="从用户管理选择"
                    showSearch
                    optionFilterProp="label"
                    onChange={handleUserSelect}
                    options={availableUsers.map(u => ({ value: u.id, label: `${u.realName}（${u.department}）` }))}
                    notFoundContent={availableUsers.length === 0 ? '所有员工已建档' : undefined}
                  />
                </Form.Item>
                <Form.Item name="name" hidden><Input /></Form.Item>
              </Col>
              <Col span={8}><Form.Item name="department" label="部门"><Input disabled /></Form.Item></Col>
              <Col span={8}><Form.Item name="position" label="职务"><Input disabled /></Form.Item></Col>
            </Row>
          ) : (
            <Row gutter={16}>
              <Col span={8}><Form.Item name="name" label="姓名"><Input disabled /></Form.Item></Col>
              <Col span={8}><Form.Item name="department" label="部门"><Input disabled /></Form.Item></Col>
              <Col span={8}><Form.Item name="position" label="职务"><Input disabled /></Form.Item></Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={8}><Form.Item name="entryDate" label="入职日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select><Select.Option value="ACTIVE">在职</Select.Option><Select.Option value="INACTIVE">离职</Select.Option></Select>
            </Form.Item></Col>
            <Col span={8}><Form.Item name="baseSalary" label="基本工资" rules={[{ required: true }]}><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="positionAllowance" label="岗位津贴"><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="mealAllowance" label="餐补"><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="transportAllowance" label="交通补贴"><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="socialInsuranceCompany" label="社保(公司)"><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="socialInsurancePersonal" label="社保(个人)"><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="housingFundCompany" label="公积金(公司)"><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="housingFundPersonal" label="公积金(个人)"><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 调薪 Modal */}
      <Modal title="调薪" open={adjustModalVisible} onOk={handleAdjustSave} onCancel={() => setAdjustModalVisible(false)} destroyOnClose width={500}>
        {adjustRecord && (
          <div>
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="姓名"><Text strong>{adjustRecord.name}</Text></Descriptions.Item>
              <Descriptions.Item label="当前基本工资"><Text strong style={{ color: '#1677ff' }}>{fmt(adjustRecord.baseSalary)}</Text></Descriptions.Item>
            </Descriptions>
            <Form form={adjustForm} layout="vertical">
              <Form.Item name="field" label="调整项目" rules={[{ required: true }]}>
                <Select onChange={(val: string) => {
                  const map: Record<string, keyof SalaryProfileRecord> = { '基本工资': 'baseSalary', '岗位津贴': 'positionAllowance', '餐补': 'mealAllowance', '交通补贴': 'transportAllowance', '社保(公司)': 'socialInsuranceCompany', '社保(个人)': 'socialInsurancePersonal', '公积金(公司)': 'housingFundCompany', '公积金(个人)': 'housingFundPersonal' };
                  const key = map[val];
                  if (key && adjustRecord) adjustForm.setFieldsValue({ newValue: adjustRecord[key] });
                }}>
                  {['基本工资', '岗位津贴', '餐补', '交通补贴', '社保(公司)', '社保(个人)', '公积金(公司)', '公积金(个人)'].map(f => <Select.Option key={f} value={f}>{f}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="newValue" label="调整后金额" rules={[{ required: true }]}><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="reason" label="调薪原因"><Input.TextArea rows={2} placeholder="如：年度调薪、晋升等" /></Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 调薪记录 Drawer */}
      <Drawer title={historyRecord ? `${historyRecord.name} - 调薪记录` : '调薪记录'} open={historyVisible} onClose={() => setHistoryVisible(false)} width={480}>
        {historyRecord && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 24 }}>
              <Descriptions.Item label="姓名">{historyRecord.name}</Descriptions.Item>
              <Descriptions.Item label="部门">{historyRecord.department}</Descriptions.Item>
              <Descriptions.Item label="职务">{historyRecord.position}</Descriptions.Item>
              <Descriptions.Item label="入职日期">{historyRecord.entryDate}</Descriptions.Item>
              <Descriptions.Item label="当前基本工资" span={2}><Text strong style={{ color: '#1677ff', fontSize: 18 }}>{fmt(historyRecord.baseSalary)}</Text></Descriptions.Item>
            </Descriptions>

            {historyRecord.adjustHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无调薪记录</div>
            ) : (
              <Timeline
                items={historyRecord.adjustHistory.map((h, i) => ({
                  key: i,
                  color: 'blue',
                  children: (
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{h.date} — {h.field}</div>
                      <div><Text type="secondary">{fmt(h.oldValue)}</Text> → <Text strong style={{ color: '#52c41a' }}>{fmt(h.newValue)}</Text></div>
                      {h.reason && <div style={{ color: '#666', marginTop: 2 }}>原因：{h.reason}</div>}
                    </div>
                  ),
                }))}
              />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
