import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Select, Tag, Space, Progress, Row, Col,
  Tooltip, Modal, Form, Input, InputNumber, Radio, message, Typography
} from 'antd';
import {
  PlusOutlined, ContainerOutlined, InboxOutlined,
  CheckCircleOutlined, RocketOutlined, LockOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ShippingUnit, ShippingUnitType, ShippingUnitStatus, TransportMode } from '../../../types/core';
import { ShippingUnitDetail } from './ShippingUnitDetail';
import { warehouseApi, jobApi, orderApi } from '../../../api';
import type { Job } from '../../../types/core';

const { Option } = Select;
const { Text } = Typography;

// 状态配置
const STATUS_CONFIG: Record<ShippingUnitStatus, { text: string; color: string; icon: React.ReactNode }> = {
  EMPTY: { text: '空闲', color: 'default', icon: <InboxOutlined /> },
  LOADING: { text: '装载中', color: 'processing', icon: <ContainerOutlined /> },
  SEALED: { text: '已封箱', color: 'success', icon: <LockOutlined /> },
  SHIPPED: { text: '已出库', color: 'default', icon: <RocketOutlined /> },
  ARRIVED: { text: '已到达', color: 'success', icon: <CheckCircleOutlined /> }
};

// 单元类型配置
const UNIT_TYPE_CONFIG: Record<ShippingUnitType, { text: string; maxWeight: number; maxVolume: number }> = {
  '20GP': { text: '20GP', maxWeight: 21000, maxVolume: 33 },
  '40GP': { text: '40GP', maxWeight: 24000, maxVolume: 67 },
  '40HQ': { text: '40HQ', maxWeight: 26000, maxVolume: 76 },
  '45HQ': { text: '45HQ', maxWeight: 27000, maxVolume: 86 },
  'PALLET': { text: '托盘', maxWeight: 1500, maxVolume: 5 },
  'BOX': { text: '大箱', maxWeight: 500, maxVolume: 2 }
};

export const ShippingUnitList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<ShippingUnit[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<ShippingUnit[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [allSubOrders, setAllSubOrders] = useState<any[]>([]);

  // 筛选条件
  const [filterMode, setFilterMode] = useState<TransportMode | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<ShippingUnitStatus | 'ALL'>('ALL');
  const [filterJobBound, setFilterJobBound] = useState<'ALL' | 'BOUND' | 'UNBOUND'>('ALL');
  const [searchText, setSearchText] = useState<string>('');

  // 创建Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 详情页状态
  const [selectedUnit, setSelectedUnit] = useState<ShippingUnit | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // 任务绑定Modal状态
  const [jobBindModalVisible, setJobBindModalVisible] = useState(false);
  const [currentBindingUnit, setCurrentBindingUnit] = useState<ShippingUnit | null>(null);
  const [selectedJobNo, setSelectedJobNo] = useState<string | undefined>(undefined);

  // 从API加载数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [unitsRes, jobsRes, subOrdersRes]: any[] = await Promise.all([
          warehouseApi.listUnits(),
          jobApi.list(),
          orderApi.listSub(),
        ]);
        const unitItems = unitsRes.data || [];
        setUnits(unitItems);
        setFilteredUnits(unitItems);
        setAllJobs(jobsRes.data || []);
        setAllSubOrders(subOrdersRes.data || []);
      } catch (error: any) {
        message.error(error.message || '加载数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 获取可用任务列表（未满载或当前绑定的任务）
  const availableJobs = allJobs.filter(job => {
    // 已绑定当前集装箱的任务
    if (currentBindingUnit?.jobNo === job.jobNo) return true;
    // 状态为 PLANNED 或 IN_PROGRESS 的任务
    return job.status === 'PLANNED' || job.status === 'IN_PROGRESS';
  });

  // 统计数据
  const loadingCount = units.filter(u => u.status === 'LOADING').length;
  const sealedCount = units.filter(u => u.status === 'SEALED').length;
  const totalOrders = units.reduce((sum, u) => sum + u.orderIds.length, 0);

  // 筛选逻辑
  const handleFilter = () => {
    let filtered = [...units];

    // 运输方式筛选
    if (filterMode !== 'ALL') {
      filtered = filtered.filter(u => u.transportMode === filterMode);
    }

    // 状态筛选
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(u => u.status === filterStatus);
    }

    // 任务绑定状态筛选
    if (filterJobBound === 'BOUND') {
      filtered = filtered.filter(u => u.jobNo);
    } else if (filterJobBound === 'UNBOUND') {
      filtered = filtered.filter(u => !u.jobNo);
    }

    // 搜索文本筛选
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(u =>
        u.unitNo.toLowerCase().includes(search) ||
        u.jobNo?.toLowerCase().includes(search)
      );
    }

    setFilteredUnits(filtered);
  };

  // 创建运输单元
  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 模拟创建
      await new Promise(resolve => setTimeout(resolve, 500));

      const typeConfig = UNIT_TYPE_CONFIG[values.unitType as ShippingUnitType];

      // 计算体积（如果提供了长宽高）
      let calculatedVolume = typeConfig.maxVolume;
      if (values.length && values.width && values.height) {
        calculatedVolume = (values.length * values.width * values.height) / 1000000; // cm³转m³
      }

      const newUnit: ShippingUnit = {
        id: `UNIT-${Date.now()}`,
        unitNo: values.unitNo,
        unitType: values.unitType,
        transportMode: values.transportMode,
        sealNo: values.sealNo,
        route: values.route,
        maxWeight: values.maxWeight || typeConfig.maxWeight,
        maxVolume: calculatedVolume,
        currentWeight: 0,
        currentVolume: 0,
        length: values.length,
        width: values.width,
        height: values.height,
        orderIds: [],
        loadedOrders: 0,
        loadedPieces: 0,
        status: 'EMPTY',
        operator: '当前用户',
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      };

      setUnits([newUnit, ...units]);
      setFilteredUnits([newUnit, ...filteredUnits]);
      setCreateModalVisible(false);
      form.resetFields();
      message.success('集装号创建成功');
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  // 封箱
  const handleSeal = (unit: ShippingUnit) => {
    Modal.confirm({
      title: '确认封箱',
      content: `确定要封箱 ${unit.unitNo} 吗？封箱后将无法继续装载。`,
      onOk: () => {
        setUnits(prevUnits =>
          prevUnits.map(u =>
            u.id === unit.id
              ? { ...u, status: 'SEALED', sealedTime: dayjs().format('YYYY-MM-DD HH:mm:ss') }
              : u
          )
        );
        setFilteredUnits(prevUnits =>
          prevUnits.map(u =>
            u.id === unit.id
              ? { ...u, status: 'SEALED', sealedTime: dayjs().format('YYYY-MM-DD HH:mm:ss') }
              : u
          )
        );
        message.success('封箱成功');
      }
    });
  };

  // 打开任务绑定Modal
  const handleOpenJobBind = (unit: ShippingUnit) => {
    setCurrentBindingUnit(unit);
    setSelectedJobNo(unit.jobNo);
    setJobBindModalVisible(true);
  };

  // 绑定任务
  const handleBindJob = () => {
    if (!currentBindingUnit || !selectedJobNo) {
      message.warning('请选择要绑定的任务');
      return;
    }

    setUnits(prevUnits =>
      prevUnits.map(u =>
        u.id === currentBindingUnit.id
          ? { ...u, jobNo: selectedJobNo, status: 'SHIPPED' }
          : u
      )
    );
    setFilteredUnits(prevUnits =>
      prevUnits.map(u =>
        u.id === currentBindingUnit.id
          ? { ...u, jobNo: selectedJobNo, status: 'SHIPPED' }
          : u
      )
    );

    message.success('任务绑定成功');
    setJobBindModalVisible(false);
    setCurrentBindingUnit(null);
    setSelectedJobNo(undefined);
  };

  // 解绑任务
  const handleUnbindJob = (unit: ShippingUnit) => {
    Modal.confirm({
      title: '确认解绑',
      content: `确定要解绑集装箱 ${unit.unitNo} 与任务 ${unit.jobNo} 的关联吗？`,
      onOk: () => {
        setUnits(prevUnits =>
          prevUnits.map(u =>
            u.id === unit.id
              ? { ...u, jobNo: undefined, status: 'SEALED' }
              : u
          )
        );
        setFilteredUnits(prevUnits =>
          prevUnits.map(u =>
            u.id === unit.id
              ? { ...u, jobNo: undefined, status: 'SEALED' }
              : u
          )
        );
        message.success('任务解绑成功');
      }
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '集装号',
      dataIndex: 'unitNo',
      key: 'unitNo',
      width: 150,
      render: (text: string, record: ShippingUnit) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.transportMode === 'SEA' ? '海运' : '空运'} - {UNIT_TYPE_CONFIG[record.unitType].text}
          </div>
        </div>
      )
    },
    {
      title: '装载率',
      key: 'loadRate',
      width: 200,
      render: (record: ShippingUnit) => {
        const weightRate = (record.currentWeight / record.maxWeight) * 100;
        const volumeRate = (record.currentVolume / record.maxVolume) * 100;
        const maxRate = Math.max(weightRate, volumeRate);

        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#999' }}>重量:</span>
              <Progress
                percent={Number(weightRate.toFixed(1))}
                size="small"
                status={weightRate > 100 ? 'exception' : weightRate > 90 ? 'normal' : 'success'}
                style={{ width: 120, display: 'inline-block', marginLeft: 8 }}
              />
            </div>
            <div>
              <span style={{ fontSize: 12, color: '#999' }}>体积:</span>
              <Progress
                percent={Number(volumeRate.toFixed(1))}
                size="small"
                status={volumeRate > 100 ? 'exception' : volumeRate > 90 ? 'normal' : 'success'}
                style={{ width: 120, display: 'inline-block', marginLeft: 8 }}
              />
            </div>
          </div>
        );
      }
    },
    {
      title: '重量(kg)',
      key: 'weight',
      width: 150,
      render: (record: ShippingUnit) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.currentWeight.toFixed(0)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>/ {record.maxWeight}</div>
        </div>
      )
    },
    {
      title: '体积(m³)',
      key: 'volume',
      width: 150,
      render: (record: ShippingUnit) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.currentVolume.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: '#999' }}>/ {record.maxVolume}</div>
        </div>
      )
    },
    {
      title: '装载信息',
      key: 'loaded',
      width: 200,
      render: (record: ShippingUnit) => {
        // 获取关联的子订单信息
        const subOrders = allSubOrders.filter(s => record.orderIds.includes(s.id));

        return (
          <Space orientation="vertical" size={2} style={{ width: '100%' }}>
            <div>
              <span style={{ fontWeight: 'bold' }}>{record.orderIds.length} 票</span>
              <span style={{ color: '#999', marginLeft: 4 }}>/ {record.loadedPieces} 件</span>
            </div>
            {subOrders.map(sub => (
              <div key={sub.id} style={{ fontSize: 11, color: '#666' }}>
                <div>{sub.subOrderNo}</div>
                <div style={{ color: '#999' }}>
                  主: {sub.masterOrderNo}
                </div>
              </div>
            ))}
            {record.orderIds.length === 0 && (
              <div style={{ fontSize: 12, color: '#999' }}>暂无装载</div>
            )}
          </Space>
        );
      }
    },
    {
      title: '关联任务',
      dataIndex: 'jobNo',
      key: 'jobNo',
      width: 180,
      render: (jobNo: string | undefined, record: ShippingUnit) => {
        if (!jobNo) {
          return <Text type="secondary">未绑定</Text>;
        }

        const job = allJobs.find(j => j.jobNo === jobNo);
        return (
          <Space orientation="vertical" size={0}>
            <a>{jobNo}</a>
            {job && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {job.route}
              </Text>
            )}
          </Space>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: ShippingUnitStatus) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      }
    },
    {
      title: '封条号',
      dataIndex: 'sealNo',
      key: 'sealNo',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (record: ShippingUnit) => (
        <Space size="small">
          {record.status === 'LOADING' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleSeal(record)}
            >
              封箱
            </Button>
          )}
          {record.status === 'SEALED' && !record.jobNo && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleOpenJobBind(record)}
            >
              绑定任务
            </Button>
          )}
          {record.jobNo && record.status !== 'ARRIVED' && (
            <Button
              size="small"
              danger
              onClick={() => handleUnbindJob(record)}
            >
              解绑
            </Button>
          )}
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedUnit(record);
              setDetailVisible(true);
            }}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">装载中 {loadingCount}</Tag>
        <Tag color="green">已封箱 {sealedCount}</Tag>
        <Tag color="orange">总订单 {totalOrders}</Tag>
        <Tag color="processing">总单元 {units.length}</Tag>
      </div>

      {/* 筛选与操作区域 */}
      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Space wrap>
          <Input
            placeholder="搜索集装号/任务号"
            value={searchText}
            onChange={e => {
              setSearchText(e.target.value);
              setTimeout(handleFilter, 0);
            }}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            value={filterMode}
            onChange={value => {
              setFilterMode(value);
              setTimeout(handleFilter, 0);
            }}
            style={{ width: 120 }}
          >
            <Option value="ALL">全部方式</Option>
            <Option value="SEA">海运</Option>
            <Option value="AIR">空运</Option>
          </Select>
          <Select
            value={filterStatus}
            onChange={value => {
              setFilterStatus(value);
              setTimeout(handleFilter, 0);
            }}
            style={{ width: 120 }}
          >
            <Option value="ALL">全部状态</Option>
            <Option value="EMPTY">空闲</Option>
            <Option value="LOADING">装载中</Option>
            <Option value="SEALED">已封箱</Option>
            <Option value="SHIPPED">已出库</Option>
          </Select>
          <Select
            value={filterJobBound}
            onChange={value => {
              setFilterJobBound(value);
              setTimeout(handleFilter, 0);
            }}
            style={{ width: 120 }}
          >
            <Option value="ALL">全部任务</Option>
            <Option value="BOUND">已绑定</Option>
            <Option value="UNBOUND">未绑定</Option>
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建运输单元
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredUnits}
        loading={loading}
        scroll={{ x: 1600, y: 'calc(100vh - 430px)' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条记录`
        }}
        size="small"
      />

      {/* 创建Modal */}
      <Modal
        title="创建运输单元"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={loading}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ transportMode: 'SEA' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="运输方式"
                name="transportMode"
                rules={[{ required: true, message: '请选择运输方式' }]}
              >
                <Radio.Group>
                  <Radio value="SEA">海运</Radio>
                  <Radio value="AIR">空运</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.transportMode !== currentValues.transportMode
                }
              >
                {({ getFieldValue }) => {
                  const mode = getFieldValue('transportMode');
                  return (
                    <Form.Item
                      label="单元类型"
                      name="unitType"
                      rules={[{ required: true, message: '请选择单元类型' }]}
                    >
                      <Select placeholder="请选择类型">
                        {mode === 'SEA' ? (
                          <>
                            <Option value="20GP">20GP (21t / 33m³)</Option>
                            <Option value="40GP">40GP (24t / 67m³)</Option>
                            <Option value="40HQ">40HQ (26t / 76m³)</Option>
                            <Option value="45HQ">45HQ (27t / 86m³)</Option>
                          </>
                        ) : (
                          <>
                            <Option value="PALLET">托盘 (1.5t / 5m³)</Option>
                            <Option value="BOX">大箱 (0.5t / 2m³)</Option>
                          </>
                        )}
                      </Select>
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="集装号"
                name="unitNo"
                rules={[{ required: true, message: '请输入集装号' }]}
              >
                <Input placeholder="例如: MSKU1234567 或 PALLET-A001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.transportMode !== currentValues.transportMode
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue('transportMode') === 'SEA' && (
                    <Form.Item label="封条号" name="sealNo">
                      <Input placeholder="请输入封条号" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="线路"
            name="route"
            rules={[{ required: true, message: '请选择线路' }]}
          >
            <Select placeholder="请选择线路">
              <Option value="中国佛山→尼日利亚拉各斯">中国佛山→尼日利亚拉各斯</Option>
              <Option value="中国广州→美国洛杉矶">中国广州→美国洛杉矶</Option>
              <Option value="中国深圳→英国伦敦">中国深圳→英国伦敦</Option>
              <Option value="中国上海→澳大利亚悉尼">中国上海→澳大利亚悉尼</Option>
              <Option value="中国宁波→加拿大温哥华">中国宁波→加拿大温哥华</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                label="长(cm)"
                name="length"
                rules={[{ required: true, message: '请输入长度' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  placeholder="1200"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="宽(cm)"
                name="width"
                rules={[{ required: true, message: '请输入宽度' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  placeholder="260"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="高(cm)"
                name="height"
                rules={[{ required: true, message: '请输入高度' }]}
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  placeholder="230"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="重量(kg)"
                name="maxWeight"
              >
                <InputNumber
                  min={0}
                  precision={0}
                  style={{ width: '100%' }}
                  placeholder="22110"
                />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>

      {/* 任务绑定Modal */}
      <Modal
        title="绑定运输任务"
        open={jobBindModalVisible}
        onOk={handleBindJob}
        onCancel={() => {
          setJobBindModalVisible(false);
          setCurrentBindingUnit(null);
          setSelectedJobNo(undefined);
        }}
        width={700}
      >
        {currentBindingUnit && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">集装箱编号: </Text>
              <Text strong>{currentBindingUnit.unitNo}</Text>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">类型: </Text>
              <Text>{currentBindingUnit.unitType} - {currentBindingUnit.transportMode === 'SEA' ? '海运' : '空运'}</Text>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary">装载: </Text>
              <Text>{currentBindingUnit.orderIds.length} 票 / {currentBindingUnit.loadedPieces} 件</Text>
            </div>
          </div>
        )}

        <Form.Item label="选择任务" required>
          <Select
            value={selectedJobNo}
            onChange={setSelectedJobNo}
            placeholder="请选择要绑定的任务"
            style={{ width: '100%' }}
          >
            {availableJobs.map(job => (
              <Option key={job.jobNo} value={job.jobNo}>
                <Space orientation="vertical" size={0} style={{ width: '100%' }}>
                  <div>
                    <Text strong>{job.jobNo}</Text>
                    <Tag
                      color={job.transportType === 'SEA' ? 'blue' : 'orange'}
                      style={{ marginLeft: 8 }}
                    >
                      {job.transportType === 'SEA' ? '海运' : '空运'}
                    </Tag>
                    <Tag color="processing" style={{ marginLeft: 4 }}>
                      {job.status === 'PLANNED' ? '计划中' : '进行中'}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {job.route} | ETD: {dayjs(job.etd).format('YYYY-MM-DD')}
                  </div>
                  {job.stats && (
                    <div style={{ fontSize: 12, color: '#999' }}>
                      已装: {job.stats.containers}箱 {job.stats.orders}票 {job.stats.pieces}件
                    </div>
                  )}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {selectedJobNo && (
          <div style={{
            marginTop: 16,
            padding: 12,
            background: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 4
          }}>
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text>绑定后集装箱状态将自动更新为"已出库"</Text>
            </Space>
          </div>
        )}
      </Modal>

      {/* 详情页 */}
      <ShippingUnitDetail
        visible={detailVisible}
        unit={selectedUnit}
        onClose={() => {
          setDetailVisible(false);
          setSelectedUnit(null);
        }}
        onUpdate={(updatedUnit) => {
          setUnits(prevUnits =>
            prevUnits.map(u => (u.id === updatedUnit.id ? updatedUnit : u))
          );
          setFilteredUnits(prevUnits =>
            prevUnits.map(u => (u.id === updatedUnit.id ? updatedUnit : u))
          );
          // 更新选中的单元，保持详情页打开
          setSelectedUnit(updatedUnit);
        }}
      />
    </div>
  );
};
