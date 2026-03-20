import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Form, Input, Select, DatePicker, Button,
  Row, Col, Divider, Space, Typography, Table,
  Statistic, Tag, Progress, Upload, message, Modal,
  Affix, Popover, Descriptions
} from 'antd';
import {
  SaveOutlined, LeftOutlined, PlusOutlined,
  DeleteOutlined, UploadOutlined, DownloadOutlined,
  FileExcelOutlined, FilePdfOutlined, InboxOutlined,
  ContainerOutlined, CheckCircleOutlined, EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { warehouseApi, orderApi, jobApi } from '../../api';
import type { ShippingUnit } from '../../types/core';

const { Option } = Select;
const { Title, Text } = Typography;
const { Dragger } = Upload;

interface JobDetailProps {
  onBack: () => void;
  initialJobId?: string;
}

export const JobDetail: React.FC<JobDetailProps> = ({ onBack, initialJobId }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 可用集装箱（已封箱且未绑定任务）
  const [availableUnits, setAvailableUnits] = useState<ShippingUnit[]>([]);
  // 已绑定集装箱
  const [boundUnits, setBoundUnits] = useState<ShippingUnit[]>([]);
  // 可用订单（待发货）
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);

  // 选择状态
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);

  // Modal状态
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [unitDetailVisible, setUnitDetailVisible] = useState(false);
  const [selectedUnitDetail, setSelectedUnitDetail] = useState<ShippingUnit | null>(null);

  // 从 API 加载可用集装箱和订单
  const fetchAvailableUnits = async (transportMode?: string) => {
    try {
      const mode = transportMode || form.getFieldValue('transportType') || 'SEA';
      const res: any = await warehouseApi.listUnits({ status: 'SEALED', transportMode: mode, unbound: true });
      setAvailableUnits(res.data || []);
    } catch (error: any) {
      message.error(error.message || '加载可用集装箱失败');
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const res: any = await orderApi.listSub({ status: 'IN_WAREHOUSE,CREATED' });
      setAvailableOrders(res.data || []);
    } catch (error: any) {
      message.error(error.message || '加载待发货订单失败');
    }
  };

  useEffect(() => {
    fetchAvailableUnits();
    fetchAvailableOrders();
  }, []);

  // 计算统计数据
  const stats = useMemo(() => {
    return {
      containers: boundUnits.length,
      orders: Array.from(new Set(boundUnits.flatMap(u => u.orderIds))).length,
      pieces: boundUnits.reduce((sum, u) => sum + u.loadedPieces, 0),
      weight: boundUnits.reduce((sum, u) => sum + u.currentWeight, 0),
      volume: boundUnits.reduce((sum, u) => sum + u.currentVolume, 0)
    };
  }, [boundUnits]);

  const capacity = useMemo(() => {
    return {
      weight: boundUnits.reduce((sum, u) => sum + u.maxWeight, 0),
      volume: boundUnits.reduce((sum, u) => sum + u.maxVolume, 0)
    };
  }, [boundUnits]);

  // 绑定集装箱
  const handleBindUnits = () => {
    if (selectedUnitIds.length === 0) {
      message.warning('请先选择要绑定的集装箱');
      return;
    }

    const units = availableUnits.filter(u => selectedUnitIds.includes(u.id));
    setBoundUnits([...boundUnits, ...units]);
    setAvailableUnits(availableUnits.filter(u => !selectedUnitIds.includes(u.id)));
    setSelectedUnitIds([]);

    message.success(`已绑定 ${units.length} 个集装箱`);
  };

  // 解绑集装箱
  const handleUnbindUnit = (unitId: string) => {
    Modal.confirm({
      title: '确认移除',
      content: '确定要移除此集装箱的绑定吗？',
      onOk: () => {
        const unit = boundUnits.find(u => u.id === unitId);
        if (unit) {
          setBoundUnits(boundUnits.filter(u => u.id !== unitId));
          setAvailableUnits([...availableUnits, unit]);
          message.success('已移除绑定');
        }
      }
    });
  };

  // 查看集装箱详情
  const handleViewUnitDetail = (unit: ShippingUnit) => {
    setSelectedUnitDetail(unit);
    setUnitDetailVisible(true);
  };

  // 创建新集装箱
  const handleCreateContainer = async (values: any) => {
    const capacityMap: Record<string, { weight: number; volume: number }> = {
      '20GP': { weight: 21000, volume: 33 },
      '40GP': { weight: 26000, volume: 67.7 },
      '40HQ': { weight: 26000, volume: 76 }
    };

    try {
      const transportMode = form.getFieldValue('transportType') || 'SEA';
      const cap = capacityMap[values.type];

      const res: any = await warehouseApi.createUnit({
        unitNo: values.containerNo,
        unitType: values.type,
        transportMode,
        sealNo: values.sealNo,
        maxWeight: cap.weight,
        maxVolume: cap.volume,
        status: 'SEALED',
      });

      const created = res.data;
      const newUnit: ShippingUnit = {
        id: created.id,
        unitNo: created.unitNo,
        unitType: created.unitType,
        transportMode: created.transportMode,
        sealNo: created.sealNo,
        maxWeight: created.maxWeight,
        maxVolume: created.maxVolume,
        currentWeight: created.currentWeight || 0,
        currentVolume: created.currentVolume || 0,
        orderIds: [],
        loadedOrders: 0,
        loadedPieces: 0,
        status: 'SEALED',
        createdAt: created.createdAt,
      };

      setBoundUnits([...boundUnits, newUnit]);
      setUnitModalVisible(false);
      message.success('集装箱创建成功并已添加到任务');
    } catch (error: any) {
      message.error(error.message || '创建集装箱失败');
    }
  };

  // 提交任务
  const handleSubmit = async () => {
    try {
      setLoading(true);

      // 验证基础信息
      await form.validateFields([
        'pol', 'pod', 'transportType', 'carrier', 'etd', 'eta'
      ]);

      // 检查配载
      if (boundUnits.length === 0) {
        message.warning('请至少绑定一个集装箱');
        document.getElementById('loading-section')?.scrollIntoView({
          behavior: 'smooth'
        });
        setLoading(false);
        return;
      }

      const values = form.getFieldsValue();

      const polMap: Record<string, string> = { SZX: '深圳港', PVG: '上海港', HKG: '香港港' };
      const podMap: Record<string, string> = { LAX: '洛杉矶港', LHR: '伦敦港', JFK: '纽约港' };

      const jobData = {
        route: `${polMap[values.pol] || values.pol} → ${podMap[values.pod] || values.pod}`,
        pol: polMap[values.pol] || values.pol,
        pod: podMap[values.pod] || values.pod,
        transportType: values.transportType,
        carrier: values.carrier,
        vesselVoyage: values.transportType === 'SEA' ? values.vessel : undefined,
        flightNo: values.transportType === 'AIR' ? values.vessel : undefined,
        billOfLading: values.mbl,
        etd: values.etd ? dayjs(values.etd).format('YYYY-MM-DD') : undefined,
        eta: values.eta ? dayjs(values.eta).format('YYYY-MM-DD') : undefined,
      };

      const res: any = await jobApi.create(jobData);
      const jobNo = res.data?.jobNo;

      // 绑定已选集装箱到新任务
      if (jobNo && boundUnits.length > 0) {
        await jobApi.bindUnits(jobNo, boundUnits.map(u => u.id));
      }

      message.success('任务创建成功');
      onBack();
    } catch (error: any) {
      message.error(error.message || '请检查必填项');
    } finally {
      setLoading(false);
    }
  };

  // 保存草稿
  const handleSaveDraft = () => {
    message.info('草稿已保存');
  };

  // 可用集装箱表格列
  const unitColumns = [
    {
      title: '集装箱号',
      dataIndex: 'unitNo',
      width: 120,
      render: (t: string) => <Text strong>{t}</Text>
    },
    {
      title: '类型',
      dataIndex: 'unitType',
      width: 70,
      render: (t: string) => <Tag color="blue">{t}</Tag>
    },
    {
      title: '装载率',
      width: 80,
      render: (r: ShippingUnit) => {
        const rate = (r.currentVolume / r.maxVolume) * 100;
        return <Text>{rate.toFixed(0)}%</Text>;
      }
    },
    {
      title: '订单数',
      dataIndex: 'orderIds',
      width: 70,
      render: (ids: string[]) => `${ids.length}票`
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (s: string) => {
        const map: Record<string, string> = { SEALED: '已封箱', LOADING: '装载中' };
        return <Tag color="green">{map[s] || s}</Tag>;
      }
    }
  ];

  // 待发货订单表格列
  const orderColumns = [
    {
      title: '运单号',
      dataIndex: 'trackingNo',
      width: 130
    },
    {
      title: '客户',
      dataIndex: 'clientName',
      width: 130
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      width: 60,
      render: (v: number) => `${v}件`
    },
    {
      title: '重量',
      dataIndex: 'weight',
      width: 80,
      render: (v: number) => `${v}kg`
    },
    {
      title: '目的国',
      dataIndex: 'destCountry',
      width: 80
    }
  ];

  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh' }}>
      {/* 粘性头部 */}
      <Affix offsetTop={0}>
        <div style={{
          background: '#fff',
          padding: '16px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100
        }}>
          <Space>
            <Button icon={<LeftOutlined />} onClick={onBack}>返回</Button>
            <Title level={4} style={{ margin: 0 }}>
              {initialJobId ? '编辑运输任务' : '新建运输任务'}
            </Title>
          </Space>
          <Space>
            <Button onClick={handleSaveDraft}>存为草稿</Button>
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              提交任务
            </Button>
          </Space>
        </div>
      </Affix>

      {/* 表单内容 */}
      <div style={{ padding: 24 }}>
        <Form form={form} layout="vertical" initialValues={{ transportType: 'SEA' }}>
          {/* Card 1: 线路与承运信息 */}
          <Card title="1. 线路与承运信息" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item name="pol" label="起运港 (POL)" rules={[{ required: true, message: '请选择起运港' }]}>
                  <Select showSearch placeholder="选择起运港">
                    <Option value="SZX">SZX - 深圳</Option>
                    <Option value="PVG">PVG - 上海</Option>
                    <Option value="HKG">HKG - 香港</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="pod" label="目的港 (POD)" rules={[{ required: true, message: '请选择目的港' }]}>
                  <Select showSearch placeholder="选择目的港">
                    <Option value="LAX">LAX - 洛杉矶</Option>
                    <Option value="LHR">LHR - 伦敦</Option>
                    <Option value="JFK">JFK - 纽约</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="destWarehouse" label="目的仓">
                  <Select placeholder="选择目的仓">
                    <Option value="US-W01">美西一号仓</Option>
                    <Option value="US-E01">美东一号仓</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col span={6}>
                <Form.Item name="transportType" label="运输方式" rules={[{ required: true }]}>
                  <Select onChange={(value) => {
                    fetchAvailableUnits(value);
                  }}>
                    <Option value="SEA">海运</Option>
                    <Option value="AIR">空运</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="carrier" label="船司/航司" rules={[{ required: true, message: '请输入承运商' }]}>
                  <Input placeholder="例如: Matson" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="vessel" label="船名航次 / 航班号">
                  <Input placeholder="例如: CLX / 045W" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="mbl" label="提单号 (MBL)">
                  <Input placeholder="Master B/L No." />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Card 2: 时间节点 */}
          <Card title="2. 时间节点" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col span={6}>
                <Form.Item name="cutOffTime" label="截单/截关时间">
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="siCutOff" label="截补料时间">
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="etd" label="ETD (预计离港)" rules={[{ required: true, message: '请选择ETD' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="eta" label="ETA (预计到港)" rules={[{ required: true, message: '请选择ETA' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Card 3: 配载与装箱 */}
          <Card title="3. 配载与装箱" style={{ marginBottom: 16 }} id="loading-section">
            <Row gutter={16}>
              {/* 左列：待发货池 */}
              <Col span={10}>
                <Card
                  size="small"
                  title="待发货订单池"
                  extra={<Tag color="blue">{availableOrders.length} 票</Tag>}
                  style={{ height: 500, overflow: 'auto' }}
                >
                  <Table
                    rowKey="id"
                    size="small"
                    columns={orderColumns}
                    dataSource={availableOrders}
                    rowSelection={{
                      selectedRowKeys: selectedOrderIds,
                      onChange: (keys) => setSelectedOrderIds(keys as string[])
                    }}
                    pagination={false}
                    scroll={{ y: 350 }}
                  />
                  <div style={{ marginTop: 8, textAlign: 'center' }}>
                    <Button
                      type="dashed"
                      disabled={selectedOrderIds.length === 0}
                      block
                    >
                      移入新集装箱 ({selectedOrderIds.length})
                    </Button>
                  </div>
                </Card>
              </Col>

              {/* 中列：可用集装箱 */}
              <Col span={7}>
                <Card
                  size="small"
                  title="可用集装箱"
                  extra={<Tag color="green">{availableUnits.length} 个</Tag>}
                  style={{ height: 500, overflow: 'auto' }}
                >
                  <Table
                    rowKey="id"
                    size="small"
                    columns={unitColumns}
                    dataSource={availableUnits}
                    rowSelection={{
                      selectedRowKeys: selectedUnitIds,
                      onChange: (keys) => setSelectedUnitIds(keys as string[])
                    }}
                    pagination={false}
                    scroll={{ y: 300 }}
                  />
                  <Space style={{ marginTop: 8, width: '100%' }} direction="vertical">
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => setUnitModalVisible(true)}
                      block
                    >
                      新建集装箱
                    </Button>
                    <Button
                      type="primary"
                      disabled={selectedUnitIds.length === 0}
                      onClick={handleBindUnits}
                      block
                    >
                      绑定选中 ({selectedUnitIds.length})
                    </Button>
                  </Space>
                </Card>
              </Col>

              {/* 右列：已绑定集装箱 */}
              <Col span={7}>
                <Card
                  size="small"
                  title="已绑定集装箱"
                  extra={<Tag color="orange">{boundUnits.length} 个</Tag>}
                  style={{ height: 500, overflow: 'auto' }}
                >
                  <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                    {boundUnits.map(unit => (
                      <Card
                        key={unit.id}
                        size="small"
                        style={{ marginBottom: 8 }}
                        actions={[
                          <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleUnbindUnit(unit.id)}
                          >
                            移除
                          </Button>,
                          <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewUnitDetail(unit)}
                          >
                            详情
                          </Button>
                        ]}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                            {unit.unitNo}
                          </div>
                          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                            <Tag color="blue">{unit.unitType}</Tag>
                            {unit.transportMode === 'SEA' ? '海运' : '空运'}
                          </div>
                          <div style={{ fontSize: 12 }}>
                            装载: {unit.orderIds.length}票 {unit.loadedPieces}件
                          </div>
                          <div style={{ fontSize: 12 }}>
                            重量: {(unit.currentWeight / 1000).toFixed(1)}/{(unit.maxWeight / 1000).toFixed(0)}t
                          </div>
                          <div style={{ fontSize: 12 }}>
                            体积: {unit.currentVolume.toFixed(1)}/{unit.maxVolume.toFixed(0)}m³
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* 合计统计 */}
                  <Card size="small" style={{ marginTop: 16, background: '#fafafa' }}>
                    <Statistic
                      title="合计"
                      value={boundUnits.length}
                      suffix="个集装箱"
                      valueStyle={{ fontSize: 14 }}
                    />
                    <div style={{ fontSize: 12, marginTop: 8 }}>
                      总订单: {stats.orders} 票
                    </div>
                    <div style={{ fontSize: 12 }}>
                      总件数: {stats.pieces} 件
                    </div>
                    <div style={{ fontSize: 12 }}>
                      总重量: {(stats.weight / 1000).toFixed(1)}t
                    </div>
                  </Card>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Card 4: 单证中心 */}
          <Card title="4. 单证中心" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title="自动生成单证" bordered={false}>
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <Card type="inner" size="small">
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <FileExcelOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                          <div>
                            <div style={{ fontWeight: 'bold' }}>Packing List (装箱单)</div>
                            <div style={{ fontSize: 12, color: '#999' }}>包含所有订单明细</div>
                          </div>
                        </Space>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={() => message.success('正在生成装箱单...')}
                        >
                          生成
                        </Button>
                      </Space>
                    </Card>

                    <Card type="inner" size="small">
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <FilePdfOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                          <div>
                            <div style={{ fontWeight: 'bold' }}>Commercial Invoice (商业发票)</div>
                            <div style={{ fontSize: 12, color: '#999' }}>用于报关清关</div>
                          </div>
                        </Space>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={() => message.success('正在生成商业发票...')}
                        >
                          生成
                        </Button>
                      </Space>
                    </Card>
                  </Space>
                </Card>
              </Col>

              <Col span={12}>
                <Card size="small" title="上传单证文件" bordered={false}>
                  <Dragger
                    name="file"
                    multiple={true}
                    action="/api/upload"
                    onChange={(info) => {
                      if (info.file.status === 'done') {
                        message.success(`${info.file.name} 上传成功`);
                      } else if (info.file.status === 'error') {
                        message.error(`${info.file.name} 上传失败`);
                      }
                    }}
                  >
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                    <p className="ant-upload-hint">
                      支持上传 SO (订舱单)、B/L (提单)、放行条等文件
                    </p>
                  </Dragger>
                </Card>
              </Col>
            </Row>
          </Card>
        </Form>
      </div>

      {/* 新建集装箱 Modal */}
      <Modal
        title="新建集装箱"
        open={unitModalVisible}
        onCancel={() => setUnitModalVisible(false)}
        footer={null}
      >
        <Form onFinish={handleCreateContainer} layout="vertical">
          <Form.Item
            name="containerNo"
            label="集装箱号"
            rules={[{ required: true, message: '请输入集装箱号' }]}
          >
            <Input placeholder="例如: MSKU1234567" />
          </Form.Item>
          <Form.Item
            name="type"
            label="箱型"
            rules={[{ required: true, message: '请选择箱型' }]}
            initialValue="40HQ"
          >
            <Select>
              <Option value="20GP">20GP (33m³ / 21吨)</Option>
              <Option value="40GP">40GP (67.7m³ / 26吨)</Option>
              <Option value="40HQ">40HQ (76m³ / 26吨)</Option>
            </Select>
          </Form.Item>
          <Form.Item name="sealNo" label="封条号">
            <Input placeholder="例如: SEAL123456" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setUnitModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 集装箱详情 Modal */}
      <Modal
        title="集装箱详情"
        open={unitDetailVisible}
        onCancel={() => setUnitDetailVisible(false)}
        footer={<Button onClick={() => setUnitDetailVisible(false)}>关闭</Button>}
        width={600}
      >
        {selectedUnitDetail && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="集装箱号" span={2}>
              <Text strong>{selectedUnitDetail.unitNo}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="箱型">
              <Tag color="blue">{selectedUnitDetail.unitType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="封条号">
              {selectedUnitDetail.sealNo || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="运输方式">
              {selectedUnitDetail.transportMode === 'SEA' ? '海运' : '空运'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color="green">已封箱</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="重量">
              {selectedUnitDetail.currentWeight} / {selectedUnitDetail.maxWeight} kg
            </Descriptions.Item>
            <Descriptions.Item label="体积">
              {selectedUnitDetail.currentVolume} / {selectedUnitDetail.maxVolume} m³
            </Descriptions.Item>
            <Descriptions.Item label="订单数" span={2}>
              {selectedUnitDetail.orderIds.length} 票 / {selectedUnitDetail.loadedPieces} 件
            </Descriptions.Item>
            <Descriptions.Item label="操作人" span={2}>
              {selectedUnitDetail.operator || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};
