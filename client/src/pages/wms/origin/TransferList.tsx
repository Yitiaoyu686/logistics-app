import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Select, Tag, Space, Row, Col,
  Modal, Form, Input, Radio, InputNumber, message, Descriptions,
  Drawer, Timeline
} from 'antd';
import {
  SwapOutlined, HomeOutlined, ShopOutlined, ClockCircleOutlined,
  CarOutlined, CheckCircleOutlined, PlusOutlined, EyeOutlined,
  SendOutlined, InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { warehouseApi } from '../../../api';

const { Option } = Select;
const { TextArea } = Input;

// 调拨方向
type TransferDirection = 'SATELLITE_TO_MAIN' | 'MAIN_TO_SATELLITE';

// 调拨状态
type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED' | 'CANCELLED';

// 发货方式（针对卫星仓有装箱号的情况）
type ShippingMethod = 'DIRECT' | 'VIA_MAIN';

// 流转记录
interface FlowRecord {
  time: string;
  action: string;
  operator: string;
  detail?: string;
}

// 下属订单信息
interface TransferOrderItem {
  subOrderNo: string;
  masterOrderNo: string;
  trackingNo: string;
  clientName: string;
  pieces: number;
  weight: number;
  volume: number;
}

// 可选订单（用于创建调拨单时选择）
interface AvailableOrder {
  id: string;
  subOrderNo: string;
  masterOrderNo: string;
  trackingNo: string;
  clientName: string;
  pieces: number;
  weight: number;
  volume: number;
  warehouse: string;
  status: string;
}

// 可选集装箱（用于创建调拨单时选择）
interface AvailableContainer {
  id: string;
  containerNo: string;
  type: string;
  warehouse: string;
  orderCount: number;
  pieces: number;
  weight: number;
  volume: number;
  status: string;
}

// 调拨记录
interface TransferRecord {
  id: string;
  transferNo: string;
  businessLine?: 'SEA' | 'AIR';
  direction: TransferDirection;
  sourceWarehouse: string;
  targetWarehouse: string;
  orderItems: TransferOrderItem[]; // 改为多个订单
  shippingUnitNo?: string;
  totalPieces: number;
  totalWeight: number;
  totalVolume: number;
  status: TransferStatus;
  shippingMethod?: ShippingMethod;
  reason?: string;
  remark?: string;
  operator?: string;
  createdAt: string;
  updatedAt?: string;
  departureTime?: string;
  arrivalTime?: string;
  confirmedTime?: string;
  flowRecords?: FlowRecord[]; // 流转记录
}

// 映射服务端状态到组件状态
const mapTransferStatus = (status: string): TransferStatus => {
  const map: Record<string, TransferStatus> = {
    DRAFT: 'PENDING',
    PACKED: 'PENDING',
    SHIPPED: 'IN_TRANSIT',
    IN_TRANSIT: 'IN_TRANSIT',
    ARRIVED: 'ARRIVED',
    RECEIVED: 'RECEIVED',
    CANCELLED: 'CANCELLED',
  };
  return map[status] || 'PENDING';
};

// 推断调拨方向
const inferDirection = (from: string, to: string): TransferDirection => {
  const mainWarehouses = ['广州总仓', '广州仓'];
  if (mainWarehouses.some(w => to.includes(w.replace('仓', '')))) return 'SATELLITE_TO_MAIN';
  return 'MAIN_TO_SATELLITE';
};

// 状态配置
const STATUS_CONFIG: Record<TransferStatus, { text: string; color: string; icon: React.ReactNode }> = {
  PENDING: { text: '待发货', color: 'warning', icon: <ClockCircleOutlined /> },
  IN_TRANSIT: { text: '运输中', color: 'processing', icon: <CarOutlined /> },
  ARRIVED: { text: '已到达', color: 'success', icon: <InboxOutlined /> },
  RECEIVED: { text: '已入库', color: 'success', icon: <CheckCircleOutlined /> },
  CANCELLED: { text: '已取消', color: 'default', icon: <ClockCircleOutlined /> }
};

// 方向配置
const DIRECTION_CONFIG: Record<TransferDirection, { text: string; color: string; icon: React.ReactNode }> = {
  SATELLITE_TO_MAIN: { text: '卫星仓→总仓', color: 'blue', icon: <ShopOutlined /> },
  MAIN_TO_SATELLITE: { text: '总仓→卫星仓', color: 'green', icon: <HomeOutlined /> }
};

// 发货方式配置
const SHIPPING_METHOD_CONFIG: Record<ShippingMethod, { text: string; color: string }> = {
  VIA_MAIN: { text: '先送总仓', color: 'default' },
  DIRECT: { text: '直接发货', color: 'orange' }
};

export const TransferList = ({
  warehouseId,
  businessMode = 'ALL',
}: {
  warehouseId?: string;
  businessMode?: 'ALL' | 'SEA' | 'AIR';
}) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TransferRecord[]>([]);

  // 筛选条件
  const [filterDirection, setFilterDirection] = useState<TransferDirection | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<TransferStatus | 'ALL'>('ALL');

  // 创建Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 订单选择Modal
  const [orderSelectVisible, setOrderSelectVisible] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<AvailableOrder[]>([]);
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<React.Key[]>([]);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);

  // 集装箱选择Modal
  const [containerSelectVisible, setContainerSelectVisible] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<AvailableContainer | null>(null);
  const [availableContainers, setAvailableContainers] = useState<AvailableContainer[]>([]);

  // 选择类型：container（集装箱）或 order（订单）
  const [selectType, setSelectType] = useState<'container' | 'order'>('order');

  // 批量粘贴文本
  const [pasteText, setPasteText] = useState('');

  // 详情Drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TransferRecord | null>(null);

  // 加载调拨数据
  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.listTransfers({
        transferType: 'ORIGIN',
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      });
      const raw = (res as any)?.data || [];
      const mapped: TransferRecord[] = (raw as any[]).map((t: any) => {
        const items: TransferOrderItem[] = (t.items || []).map((item: any) => ({
          subOrderNo: item.subOrderNo || '-',
          masterOrderNo: '-',
          trackingNo: item.trackingNo || '-',
          clientName: item.goodsName || '-',
          pieces: item.pieces || 0,
          weight: item.weight || 0,
          volume: item.volume || 0,
        }));
        return {
          id: t.id,
          transferNo: t.transferNo || '-',
          businessLine: t.businessLine,
          direction: inferDirection(t.fromWarehouse || '', t.toWarehouse || ''),
          sourceWarehouse: t.fromWarehouse || '-',
          targetWarehouse: t.toWarehouse || '-',
          orderItems: items,
          shippingUnitNo: t.containerNo,
          totalPieces: t.totalPieces || 0,
          totalWeight: t.totalWeight || 0,
          totalVolume: t.totalVolume || 0,
          status: mapTransferStatus(t.status),
          reason: t.reason,
          remark: t.remark,
          operator: t.createdBy || '-',
          createdAt: t.createdAt ? t.createdAt.replace('T', ' ').slice(0, 16) : '-',
          updatedAt: t.updatedAt ? t.updatedAt.replace('T', ' ').slice(0, 16) : undefined,
          departureTime: t.outboundAt ? t.outboundAt.replace('T', ' ').slice(0, 16) : undefined,
          arrivalTime: t.inboundAt ? t.inboundAt.replace('T', ' ').slice(0, 16) : undefined,
        };
      });
      setRecords(mapped);
      setFilteredRecords(mapped);
    } catch (err: any) {
      message.error(err.message || '加载调拨数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransfers(); }, [warehouseId, businessMode]);

  // 加载可选订单（库存列表）
  const fetchAvailableOrders = async () => {
    try {
      const res = await warehouseApi.listStock({
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      });
      const raw = (res as any)?.data || [];
      const mapped: AvailableOrder[] = (raw as any[])
        .filter((s: any) => ['IN_STOCK', 'ALLOCATED', 'PACKED'].includes(String(s.status || '').toUpperCase()))
        .map((s: any) => ({
        id: s.id,
        subOrderNo: s.subOrderNo || '-',
        masterOrderNo: s.masterOrderNo || '-',
        trackingNo: s.trackingNo || '-',
        clientName: s.clientName || '-',
        pieces: s.pieces || 0,
        weight: s.weight || 0,
        volume: s.volume || 0,
        warehouse: s.warehouse || '-',
        status: s.status === 'IN_STOCK' ? '已入库' : s.status || '-',
      }));
      setAvailableOrders(mapped);
    } catch (err: any) {
      console.error('加载可选订单失败:', err);
    }
  };

  // 加载可选集装箱
  const fetchAvailableContainers = async () => {
    try {
      const res = await warehouseApi.listUnits({
        warehouseId,
        transportMode: businessMode === 'ALL' ? undefined : businessMode,
      });
      const raw = (res as any)?.data || [];
      const mapped: AvailableContainer[] = (raw as any[])
        .filter((u: any) => ['LOADING', 'SEALED', 'PALLETIZED'].includes(String(u.status || '').toUpperCase()))
        .map((u: any) => ({
        id: u.id,
        containerNo: u.unitNo || '-',
        type: u.transportMode === 'SEA' ? '海运集装箱' : '空运托盘',
        warehouse: u.warehouse || '-',
        orderCount: u.loadedOrders || 0,
        pieces: u.loadedPieces || 0,
        weight: u.currentWeight || 0,
        volume: u.currentVolume || 0,
        status: u.status === 'SEALED' ? '已封箱' : u.status === 'LOADING' ? '装箱中' : u.status || '-',
      }));
      setAvailableContainers(mapped);
    } catch (err: any) {
      console.error('加载可选集装箱失败:', err);
    }
  };

  // 统计数据
  const pendingCount = records.filter(r => r.status === 'PENDING').length;
  const inTransitCount = records.filter(r => r.status === 'IN_TRANSIT').length;
  const arrivedCount = records.filter(r => r.status === 'ARRIVED').length;
  const receivedCount = records.filter(r => r.status === 'RECEIVED').length;

  // 筛选逻辑
  const handleFilter = () => {
    let filtered = [...records];

    if (filterDirection !== 'ALL') {
      filtered = filtered.filter(r => r.direction === filterDirection);
    }

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    setFilteredRecords(filtered);
  };

  // 创建调拨单
  const handleCreate = async () => {
    try {
      const values = await form.validateFields();

      if (selectedOrders.length === 0 && !selectedContainer) {
        message.warning('请选择要调拨的订单或集装箱');
        return;
      }

      setLoading(true);

      const items = selectedOrders.map(order => ({
        subOrderNo: order.subOrderNo,
        trackingNo: order.trackingNo,
        goodsName: order.clientName,
        pieces: order.pieces,
        weight: order.weight,
        volume: order.volume,
      }));

      await warehouseApi.createTransfer({
        fromWarehouse: values.sourceWarehouse,
        toWarehouse: values.targetWarehouse,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
        transferType: 'ORIGIN',
        itemType: selectType === 'container' ? 'CONTAINER' : 'ORDER',
        containerNo: values.shippingUnitNo || (selectedContainer?.containerNo),
        reason: values.reason,
        remark: values.remark,
        items,
      });

      setCreateModalVisible(false);
      form.resetFields();
      setSelectedOrders([]);
      setSelectedOrderKeys([]);
      setSelectedContainer(null);
      message.success('调拨单创建成功');
      await fetchTransfers();
      setLoading(false);
    } catch (error: any) {
      message.error(error.message || '创建失败');
      setLoading(false);
    }
  };

  // 打开订单选择Modal
  const handleOpenOrderSelect = () => {
    fetchAvailableOrders();
    setOrderSelectVisible(true);
  };

  // 确认选择订单
  const handleConfirmOrderSelect = () => {
    if (selectedOrderKeys.length === 0) {
      message.warning('请至少选择一个订单');
      return;
    }
    const selected = availableOrders.filter(order =>
      selectedOrderKeys.includes(order.id)
    );
    setSelectedOrders(selected);
    setOrderSelectVisible(false);
    message.success(`已选择 ${selected.length} 个订单`);
  };

  // 移除已选订单
  const handleRemoveOrder = (orderId: string) => {
    setSelectedOrders(prev => prev.filter(order => order.id !== orderId));
    setSelectedOrderKeys(prev => prev.filter(key => key !== orderId));
  };

  // 打开集装箱选择Modal
  const handleOpenContainerSelect = () => {
    fetchAvailableContainers();
    setContainerSelectVisible(true);
  };

  // 确认选择集装箱
  const handleConfirmContainerSelect = (container: AvailableContainer) => {
    setSelectedContainer(container);
    setContainerSelectVisible(false);
    setSelectedOrders([]);
    setSelectedOrderKeys([]);
    message.success(`已选择集装箱 ${container.containerNo}`);
  };

  // 批量粘贴订单
  const handlePasteOrders = () => {
    if (!pasteText.trim()) {
      message.warning('请输入要粘贴的运单号');
      return;
    }

    // 解析粘贴的文本，支持多种格式
    const lines = pasteText.trim().split('\n');
    const trackingNos: string[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        // 支持逗号、空格、制表符分隔
        const parts = trimmed.split(/[,\s\t]+/);
        trackingNos.push(...parts.filter(p => p));
      }
    });

    // 从可选订单中查找匹配的订单
    const matched = availableOrders.filter(order =>
      trackingNos.includes(order.trackingNo) || trackingNos.includes(order.subOrderNo)
    );

    if (matched.length === 0) {
      message.warning('未找到匹配的订单');
      return;
    }

    setSelectedOrders(matched);
    setSelectedOrderKeys(matched.map(o => o.id));
    setPasteText('');
    message.success(`已匹配 ${matched.length} 个订单`);
  };

  // 查看详情
  const handleViewDetail = (record: TransferRecord) => {
    setSelectedRecord(record);
    setDetailDrawerVisible(true);
  };

  // 确认到达
  const handleConfirmArrival = (record: TransferRecord) => {
    Modal.confirm({
      title: '确认到达',
      content: `确定 ${record.transferNo} 已到达目标仓库吗？`,
      onOk: async () => {
        try {
          await warehouseApi.updateTransfer(record.id, { status: 'ARRIVED', inboundAt: new Date().toISOString() });
          await fetchTransfers();
          message.success('已确认到达');
        } catch (err: any) {
          message.error(err.message || '操作失败');
        }
      }
    });
  };

  // 确认入库
  const handleConfirmReceive = (record: TransferRecord) => {
    Modal.confirm({
      title: '确认入库',
      content: `确定 ${record.transferNo} 已入库吗？`,
      onOk: async () => {
        try {
          await warehouseApi.updateTransfer(record.id, { status: 'RECEIVED' });
          await fetchTransfers();
          message.success('入库确认成功');
        } catch (err: any) {
          message.error(err.message || '操作失败');
        }
      }
    });
  };

  // 发起调拨
  const handleStartTransfer = (record: TransferRecord) => {
    Modal.confirm({
      title: '发起调拨',
      content: `确定开始调拨 ${record.transferNo} 吗？`,
      onOk: async () => {
        try {
          await warehouseApi.updateTransfer(record.id, { status: 'IN_TRANSIT', outboundAt: new Date().toISOString() });
          await fetchTransfers();
          message.success('调拨已发起');
        } catch (err: any) {
          message.error(err.message || '操作失败');
        }
      }
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '调拨单号',
      dataIndex: 'transferNo',
      key: 'transferNo',
      width: 180,
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '源仓库',
      dataIndex: 'sourceWarehouse',
      key: 'sourceWarehouse',
      width: 120
    },
    {
      title: '目标仓库',
      dataIndex: 'targetWarehouse',
      key: 'targetWarehouse',
      width: 120
    },
    {
      title: '业务线',
      dataIndex: 'businessLine',
      key: 'businessLine',
      width: 90,
      render: (line?: string) => (
        <Tag color={line === 'AIR' ? 'gold' : 'blue'}>{line || '-'}</Tag>
      )
    },
    {
      title: '装箱号',
      dataIndex: 'shippingUnitNo',
      key: 'shippingUnitNo',
      width: 150,
      render: (text: string, record: TransferRecord) => (
        <div>
          <div>{text || '-'}</div>
          {text && record.shippingMethod && (
            <Tag
              color={SHIPPING_METHOD_CONFIG[record.shippingMethod].color}
              style={{ marginTop: 4 }}
            >
              {SHIPPING_METHOD_CONFIG[record.shippingMethod].text}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: '货物信息',
      key: 'cargo',
      width: 150,
      render: (record: TransferRecord) => (
        <div>
          <div>{record.orderItems.length} 单 / {record.totalPieces} 件</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.totalWeight.toFixed(2)} kg / {record.totalVolume.toFixed(4)} m³
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: TransferStatus) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      }
    },
    {
      title: '调拨原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-'
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (_: string, record: TransferRecord) =>
        dayjs(record.updatedAt || record.createdAt).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (record: TransferRecord) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'PENDING' && (
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleStartTransfer(record)}
            >
              发起
            </Button>
          )}
          {record.status === 'IN_TRANSIT' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleConfirmArrival(record)}
            >
              确认到达
            </Button>
          )}
          {record.status === 'ARRIVED' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleConfirmReceive(record)}
            >
              确认入库
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag>待调拨 {pendingCount}</Tag>
        <Tag color="processing">运输中 {inTransitCount}</Tag>
        <Tag color="green">已到达 {arrivedCount}</Tag>
        <Tag color="blue">已入库 {receivedCount}</Tag>
      </div>

      {/* 筛选与操作区域 */}
      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Space wrap>
          <Select
            value={filterDirection}
            onChange={value => {
              setFilterDirection(value);
              setTimeout(handleFilter, 0);
            }}
            style={{ width: 150 }}
          >
            <Option value="ALL">全部方向</Option>
            <Option value="SATELLITE_TO_MAIN">卫星仓→总仓</Option>
            <Option value="MAIN_TO_SATELLITE">总仓→卫星仓</Option>
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
            <Option value="PENDING">待调拨</Option>
            <Option value="IN_TRANSIT">运输中</Option>
            <Option value="ARRIVED">已到达</Option>
            <Option value="RECEIVED">已入库</Option>
            <Option value="CANCELLED">已取消</Option>
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建调拨单
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredRecords}
        loading={loading}
        scroll={{ x: 1800, y: 'calc(100vh - 430px)' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条记录`
        }}
        size="small"
      />

      {/* 创建调拨单Modal */}
      <Modal
        title={
          <Space>
            <SwapOutlined />
            <span>创建调拨单</span>
          </Space>
        }
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={loading}
        width={700}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="源仓库"
                name="sourceWarehouse"
                rules={[{ required: true, message: '请选择源仓库' }]}
              >
                <Select placeholder="请选择源仓库">
                  <Option value="广州总仓">广州总仓</Option>
                  <Option value="佛山卫星仓">佛山卫星仓</Option>
                  <Option value="深圳卫星仓">深圳卫星仓</Option>
                  <Option value="东莞卫星仓">东莞卫星仓</Option>
                  <Option value="中山卫星仓">中山卫星仓</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="目标仓库"
                name="targetWarehouse"
                rules={[{ required: true, message: '请选择目标仓库' }]}
              >
                <Select placeholder="请选择目标仓库">
                  <Option value="广州总仓">广州总仓</Option>
                  <Option value="佛山卫星仓">佛山卫星仓</Option>
                  <Option value="深圳卫星仓">深圳卫星仓</Option>
                  <Option value="东莞卫星仓">东莞卫星仓</Option>
                  <Option value="中山卫星仓">中山卫星仓</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="选择方式">
            <Radio.Group value={selectType} onChange={(e) => {
              setSelectType(e.target.value);
              setSelectedOrders([]);
              setSelectedOrderKeys([]);
              setSelectedContainer(null);
            }}>
              <Radio value="order">按订单选择</Radio>
              <Radio value="container">按集装箱选择</Radio>
            </Radio.Group>
          </Form.Item>

          {selectType === 'order' ? (
            <Form.Item label="选择订单">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenOrderSelect}>
                    从列表选择
                  </Button>
                  <Button type="dashed" onClick={() => {
                    Modal.confirm({
                      title: '批量粘贴运单号',
                      width: 600,
                      content: (
                        <div>
                          <p style={{ marginBottom: 8 }}>请输入运单号或快递单号，支持多行，每行一个或用逗号、空格分隔：</p>
                          <TextArea
                            rows={6}
                            placeholder="例如：&#10;SF1012605193888&#10;YT4144353928999&#10;或：SF1012605193888, YT4144353928999"
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                          />
                        </div>
                      ),
                      onOk: handlePasteOrders
                    });
                  }}>
                    批量粘贴
                  </Button>
                </Space>
                {selectedOrders.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Table
                      size="small"
                      dataSource={selectedOrders}
                      pagination={false}
                      rowKey="id"
                      columns={[
                        { title: '子运单号', dataIndex: 'subOrderNo', width: 150 },
                        { title: '快递单号', dataIndex: 'trackingNo', width: 150 },
                        { title: '客户', dataIndex: 'clientName', width: 120 },
                        {
                          title: '件数',
                          dataIndex: 'pieces',
                          width: 60,
                          render: (val: number) => `${val}件`
                        },
                        {
                          title: '操作',
                          width: 60,
                          render: (_: any, record: AvailableOrder) => (
                            <Button
                              type="link"
                              danger
                              size="small"
                              onClick={() => handleRemoveOrder(record.id)}
                            >
                              移除
                            </Button>
                          )
                        }
                      ]}
                    />
                    <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                      已选 {selectedOrders.length} 个运单，
                      共 {selectedOrders.reduce((sum, o) => sum + o.pieces, 0)} 件，
                      {selectedOrders.reduce((sum, o) => sum + o.weight, 0).toFixed(2)} kg，
                      {selectedOrders.reduce((sum, o) => sum + o.volume, 0).toFixed(4)} m³
                    </div>
                  </div>
                )}
              </Space>
            </Form.Item>
          ) : (
            <Form.Item label="选择集装箱">
              <Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenContainerSelect} block>
                选择集装箱
              </Button>
              {selectedContainer && (
                <Card size="small" style={{ marginTop: 12 }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="集装箱号">{selectedContainer.containerNo}</Descriptions.Item>
                    <Descriptions.Item label="类型">{selectedContainer.type}</Descriptions.Item>
                    <Descriptions.Item label="订单数">{selectedContainer.orderCount}个</Descriptions.Item>
                    <Descriptions.Item label="件数">{selectedContainer.pieces}件</Descriptions.Item>
                    <Descriptions.Item label="重量">{selectedContainer.weight.toFixed(2)} kg</Descriptions.Item>
                    <Descriptions.Item label="体积">{selectedContainer.volume.toFixed(2)} m³</Descriptions.Item>
                  </Descriptions>
                </Card>
              )}
            </Form.Item>
          )}

          <Form.Item label="装箱号" name="shippingUnitNo">
            <Input placeholder="如果已装箱，请输入装箱号（可选）" />
          </Form.Item>

          <Form.Item
            label="调拨原因"
            name="reason"
            rules={[{ required: true, message: '请输入调拨原因' }]}
          >
            <Select placeholder="请选择调拨原因">
              <Option value="集中发货">集中发货</Option>
              <Option value="就近发货">就近发货</Option>
              <Option value="库存调整">库存调整</Option>
              <Option value="紧急补货">紧急补货</Option>
              <Option value="已装箱直接发货">已装箱直接发货</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <TextArea rows={3} placeholder="补充说明" maxLength={300} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 订单选择Modal */}
      <Modal
        title="选择要调拨的订单"
        open={orderSelectVisible}
        onOk={handleConfirmOrderSelect}
        onCancel={() => {
          setOrderSelectVisible(false);
          setSelectedOrderKeys([]);
        }}
        width={900}
      >
        <Table
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedOrderKeys,
            onChange: (selectedKeys) => {
              setSelectedOrderKeys(selectedKeys);
            }
          }}
          dataSource={availableOrders}
          pagination={false}
          rowKey="id"
          scroll={{ y: 400 }}
          columns={[
            {
              title: '子运单号',
              dataIndex: 'subOrderNo',
              width: 150
            },
            {
              title: '主运单号',
              dataIndex: 'masterOrderNo',
              width: 150
            },
            {
              title: '快递单号',
              dataIndex: 'trackingNo',
              width: 150
            },
            {
              title: '客户',
              dataIndex: 'clientName',
              width: 120
            },
            {
              title: '仓库',
              dataIndex: 'warehouse',
              width: 100
            },
            {
              title: '件数',
              dataIndex: 'pieces',
              width: 60,
              render: (val: number) => `${val}件`
            },
            {
              title: '重量',
              dataIndex: 'weight',
              width: 80,
              render: (val: number) => `${val.toFixed(2)}kg`
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 80,
              render: (status: string) => (
                <Tag color="success">{status}</Tag>
              )
            }
          ]}
        />
      </Modal>

      {/* 集装箱选择Modal */}
      <Modal
        title="选择集装箱"
        open={containerSelectVisible}
        onCancel={() => setContainerSelectVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={availableContainers}
          pagination={false}
          rowKey="id"
          onRow={(record) => ({
            onClick: () => handleConfirmContainerSelect(record),
            style: { cursor: 'pointer' }
          })}
          columns={[
            {
              title: '集装箱号',
              dataIndex: 'containerNo',
              width: 180
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 120
            },
            {
              title: '仓库',
              dataIndex: 'warehouse',
              width: 120
            },
            {
              title: '订单数',
              dataIndex: 'orderCount',
              width: 80,
              render: (val: number) => `${val}个`
            },
            {
              title: '件数',
              dataIndex: 'pieces',
              width: 80,
              render: (val: number) => `${val}件`
            },
            {
              title: '重量',
              dataIndex: 'weight',
              width: 100,
              render: (val: number) => `${val.toFixed(2)}kg`
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 80,
              render: (status: string) => (
                <Tag color="success">{status}</Tag>
              )
            }
          ]}
        />
      </Modal>

      {/* 详情Drawer */}
      <Drawer
        title="调拨详情"
        placement="right"
        width={800}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedRecord(null);
        }}
      >
        {selectedRecord && (
          <div>
            <Descriptions title="基本信息" column={2} bordered style={{ marginBottom: 24 }}>
              <Descriptions.Item label="调拨单号" span={2}>
                <strong>{selectedRecord.transferNo}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="源仓库">
                {selectedRecord.sourceWarehouse}
              </Descriptions.Item>
              <Descriptions.Item label="目标仓库">
                {selectedRecord.targetWarehouse}
              </Descriptions.Item>
              <Descriptions.Item label="装箱号" span={2}>
                {selectedRecord.shippingUnitNo || '-'}
                {selectedRecord.shippingUnitNo && selectedRecord.shippingMethod && (
                  <Tag
                    color={SHIPPING_METHOD_CONFIG[selectedRecord.shippingMethod].color}
                    style={{ marginLeft: 8 }}
                  >
                    {SHIPPING_METHOD_CONFIG[selectedRecord.shippingMethod].text}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="总件数">
                {selectedRecord.totalPieces} 件
              </Descriptions.Item>
              <Descriptions.Item label="总重量">
                {selectedRecord.totalWeight.toFixed(2)} kg
              </Descriptions.Item>
              <Descriptions.Item label="总体积">
                {selectedRecord.totalVolume.toFixed(4)} m³
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_CONFIG[selectedRecord.status].color} icon={STATUS_CONFIG[selectedRecord.status].icon}>
                  {STATUS_CONFIG[selectedRecord.status].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="调拨原因" span={2}>
                {selectedRecord.reason || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="操作人">
                {selectedRecord.operator}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              {selectedRecord.updatedAt && (
                <Descriptions.Item label="更新时间" span={2}>
                  {dayjs(selectedRecord.updatedAt).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
              {selectedRecord.departureTime && (
                <Descriptions.Item label="发货时间" span={2}>
                  {dayjs(selectedRecord.departureTime).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
              {selectedRecord.arrivalTime && (
                <Descriptions.Item label="到达时间" span={2}>
                  {dayjs(selectedRecord.arrivalTime).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
              {selectedRecord.confirmedTime && (
                <Descriptions.Item label="确认时间" span={2}>
                  {dayjs(selectedRecord.confirmedTime).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
              {selectedRecord.remark && (
                <Descriptions.Item label="备注" span={2}>
                  {selectedRecord.remark}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* 下属订单信息 */}
            <Card title="下属订单信息" size="small" style={{ marginBottom: 24 }}>
              <Table
                dataSource={selectedRecord.orderItems}
                pagination={false}
                size="small"
                rowKey="subOrderNo"
                columns={[
                  {
                    title: '子运单号',
                    dataIndex: 'subOrderNo',
                    key: 'subOrderNo',
                    width: 180
                  },
                  {
                    title: '主运单号',
                    dataIndex: 'masterOrderNo',
                    key: 'masterOrderNo',
                    width: 180
                  },
                  {
                    title: '快递单号',
                    dataIndex: 'trackingNo',
                    key: 'trackingNo',
                    width: 150
                  },
                  {
                    title: '客户',
                    dataIndex: 'clientName',
                    key: 'clientName',
                    width: 150
                  },
                  {
                    title: '件数',
                    dataIndex: 'pieces',
                    key: 'pieces',
                    width: 80,
                    render: (val: number) => `${val} 件`
                  },
                  {
                    title: '重量',
                    dataIndex: 'weight',
                    key: 'weight',
                    width: 100,
                    render: (val: number) => `${val.toFixed(2)} kg`
                  },
                  {
                    title: '体积',
                    dataIndex: 'volume',
                    key: 'volume',
                    width: 100,
                    render: (val: number) => `${val.toFixed(4)} m³`
                  }
                ]}
              />
            </Card>

            {/* 流转记录 */}
            {selectedRecord.flowRecords && selectedRecord.flowRecords.length > 0 && (
              <Card title="流转记录" size="small">
                <Timeline>
                  {selectedRecord.flowRecords.map((flow, index) => (
                    <Timeline.Item key={index} color="blue">
                      <div style={{ marginBottom: 4 }}>
                        <strong>{flow.action}</strong>
                        <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                          {dayjs(flow.time).format('YYYY-MM-DD HH:mm:ss')}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        操作人：{flow.operator}
                      </div>
                      {flow.detail && (
                        <div style={{ fontSize: 12, color: '#999' }}>
                          {flow.detail}
                        </div>
                      )}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
