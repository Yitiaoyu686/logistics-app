import React, { useState, useMemo, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Modal, Input, Select,
  Row, Col, message, Typography
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { warehouseApi } from '../../../api';
import { DestTransferDetail } from './DestTransferDetail';
import { DestTransferCreate } from './DestTransferCreate';
import { useOrderBaseOptions } from '../../../hooks/useOrderBaseOptions';

const { Option } = Select;
const { Text } = Typography;

// --- 类型定义 ---
type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'CONFIRMED';
type TransferDirection = 'BRANCH_TO_MAIN' | 'MAIN_TO_BRANCH';

interface TransferRecord {
  id: string;
  transferNo: string;
  direction: TransferDirection;
  fromWarehouse: string;
  toWarehouse: string;
  shippingUnitNo?: string;
  shippingMethod: 'VIA_MAIN' | 'DIRECT';
  logisticsType: 'THIRD_PARTY' | 'SELF_DELIVERY';
  carrier?: string;
  logisticsTrackingNo?: string;
  driverName?: string;
  driverPhone?: string;
  driverPlate?: string;
  orderIds: string[];
  orderCount: number;
  totalPieces: number;
  totalWeight: number;
  status: TransferStatus;
  createdAt: string;
  shippedAt?: string;
  arrivedAt?: string;
  confirmedAt?: string;
  operator: string;
  remark?: string;
}

// --- 仓库选项 ---
const WAREHOUSES = ['US总仓', 'US分仓A', 'US分仓B', 'US分仓C'];

// 映射服务端调拨状态
const mapTransferStatus = (status: string): TransferStatus => {
  const map: Record<string, TransferStatus> = {
    DRAFT: 'PENDING', PACKED: 'PENDING', PENDING: 'PENDING',
    SHIPPED: 'IN_TRANSIT', IN_TRANSIT: 'IN_TRANSIT',
    ARRIVED: 'ARRIVED', CONFIRMED: 'CONFIRMED', CANCELLED: 'CONFIRMED',
  };
  return map[status] || 'PENDING';
};

// 推断调拨方向
const inferDirection = (from: string, to: string): TransferDirection => {
  if (to.includes('总仓') || to.includes('MAIN')) return 'BRANCH_TO_MAIN';
  return 'MAIN_TO_BRANCH';
};

// --- 状态配置 ---
const STATUS_CONFIG: Record<TransferStatus, { text: string; color: string }> = {
  PENDING: { text: '待发运', color: 'default' },
  IN_TRANSIT: { text: '运输中', color: 'processing' },
  ARRIVED: { text: '已到达', color: 'warning' },
  CONFIRMED: { text: '已确认', color: 'success' }
};

const DIRECTION_CONFIG: Record<TransferDirection, { text: string; color: string }> = {
  BRANCH_TO_MAIN: { text: '分仓→总仓', color: 'blue' },
  MAIN_TO_BRANCH: { text: '总仓→分仓', color: 'orange' }
};

export const DestTransferList = ({ warehouseId }: { warehouseId?: string; businessMode?: string }) => {
  const { baseOptions } = useOrderBaseOptions();
  const [data, setData] = useState<TransferRecord[]>([]);
  const carrierOptions = useMemo(
    () => (baseOptions.CARRIER || []).map((item) => item.label).filter(Boolean),
    [baseOptions.CARRIER]
  );

  // 加载数据
  const fetchData = async () => {
    try {
      const res = await warehouseApi.listTransfers({ transferType: 'DESTINATION', warehouseId });
      const raw = (res as any)?.data || [];
      const mapped: TransferRecord[] = (raw as any[]).map((r: any) => ({
        id: r.id,
        transferNo: r.transferNo || r.id,
        direction: inferDirection(r.fromWarehouse || '', r.toWarehouse || ''),
        fromWarehouse: r.fromWarehouse || '-',
        toWarehouse: r.toWarehouse || '-',
        shippingUnitNo: r.containerNo,
        shippingMethod: r.containerNo ? 'DIRECT' as const : 'VIA_MAIN' as const,
        logisticsType: r.driverName ? 'SELF_DELIVERY' as const : 'THIRD_PARTY' as const,
        carrier: r.carrier,
        logisticsTrackingNo: r.logisticsTrackingNo,
        driverName: r.driverName,
        driverPhone: r.driverPhone,
        driverPlate: r.driverPlate,
        orderIds: r.items?.map((i: any) => i.subOrderNo || i.id) || [],
        orderCount: r.items?.length || r.orderCount || 0,
        totalPieces: r.totalPieces || 0,
        totalWeight: r.totalWeight || 0,
        status: mapTransferStatus(r.status),
        createdAt: r.createdAt ? r.createdAt.replace('T', ' ').slice(0, 19) : '-',
        shippedAt: r.outboundAt ? r.outboundAt.replace('T', ' ').slice(0, 19) : undefined,
        arrivedAt: r.inboundAt ? r.inboundAt.replace('T', ' ').slice(0, 19) : undefined,
        confirmedAt: r.status === 'ARRIVED' && r.updatedAt ? r.updatedAt.replace('T', ' ').slice(0, 19) : undefined,
        operator: r.createdBy || '-',
        remark: r.remark,
      }));
      setData(mapped);
    } catch (err: any) {
      message.error(err.message || '加载调拨数据失败');
    }
  };

  useEffect(() => { fetchData(); }, [warehouseId]);

  // 筛选条件
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<TransferStatus | 'ALL'>('ALL');
  const [filterDirection, setFilterDirection] = useState<TransferDirection | 'ALL'>('ALL');
  const [filterWarehouse, setFilterWarehouse] = useState<string>('ALL');
  const [filterLogisticsType, setFilterLogisticsType] = useState<string>('ALL');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 创建/编辑
  const [createVisible, setCreateVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TransferRecord | null>(null);

  // 详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetailId, setCurrentDetailId] = useState('');

  // --- 统计 ---
  const stats = useMemo(() => ({
    pending: data.filter(d => d.status === 'PENDING').length,
    inTransit: data.filter(d => d.status === 'IN_TRANSIT').length,
    arrived: data.filter(d => d.status === 'ARRIVED').length,
    confirmed: data.filter(d => d.status === 'CONFIRMED').length
  }), [data]);

  // --- 筛选 ---
  const filteredData = useMemo(() => {
    let result = [...data];

    if (searchText) {
      const keyword = searchText.toLowerCase();
      result = result.filter(d =>
        d.transferNo.toLowerCase().includes(keyword) ||
        d.fromWarehouse.toLowerCase().includes(keyword) ||
        d.toWarehouse.toLowerCase().includes(keyword) ||
        (d.carrier && d.carrier.toLowerCase().includes(keyword)) ||
        (d.driverName && d.driverName.toLowerCase().includes(keyword)) ||
        d.orderIds.some(id => id.toLowerCase().includes(keyword))
      );
    }

    if (filterStatus !== 'ALL') {
      result = result.filter(d => d.status === filterStatus);
    }

    if (filterDirection !== 'ALL') {
      result = result.filter(d => d.direction === filterDirection);
    }

    if (filterWarehouse !== 'ALL') {
      result = result.filter(d => d.fromWarehouse === filterWarehouse || d.toWarehouse === filterWarehouse);
    }

    if (filterLogisticsType !== 'ALL') {
      result = result.filter(d => d.logisticsType === filterLogisticsType);
    }

    return result;
  }, [data, searchText, filterStatus, filterDirection, filterWarehouse, filterLogisticsType]);

  const handleReset = () => {
    setSearchText('');
    setFilterStatus('ALL');
    setFilterDirection('ALL');
    setFilterWarehouse('ALL');
    setFilterLogisticsType('ALL');
    setShowAdvancedFilters(false);
  };

  // --- 打开详情 ---
  const handleOpenDetail = (id: string) => {
    setCurrentDetailId(id);
    setDetailVisible(true);
  };

  // --- 编辑 ---
  const handleEdit = (record: TransferRecord) => {
    setEditingRecord(record);
    setCreateVisible(true);
  };

  const handleEditFromDetail = (id: string) => {
    const record = data.find(d => d.id === id);
    if (record) {
      setDetailVisible(false);
      setEditingRecord(record);
      setCreateVisible(true);
    }
  };

  // --- 创建/编辑成功 ---
  const handleCreateSuccess = async (newRecord: any) => {
    try {
      if (editingRecord) {
        await warehouseApi.updateTransfer(editingRecord.id, newRecord);
        message.success('调拨单编辑成功');
      } else {
        await warehouseApi.createTransfer({
          ...newRecord,
          transferType: 'DESTINATION',
        });
        message.success('调拨单创建成功');
      }
      setEditingRecord(null);
      fetchData();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  // --- 删除 ---
  const handleDelete = (record: TransferRecord) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: `确定要删除调拨单 ${record.transferNo}？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await warehouseApi.updateTransfer(record.id, { status: 'CANCELLED' });
          message.success('调拨单已删除');
          fetchData();
        } catch (err: any) {
          message.error(err.message || '删除失败');
        }
      }
    });
  };

  const handleDeleteFromDetail = async (id: string) => {
    try {
      await warehouseApi.updateTransfer(id, { status: 'CANCELLED' });
      setDetailVisible(false);
      fetchData();
    } catch (err: any) {
      message.error(err.message || '删除失败');
    }
  };

  // --- 列定义 ---
  const columns = [
    {
      title: '调拨单号',
      dataIndex: 'transferNo',
      key: 'transferNo',
      width: 170,
      render: (text: string, record: TransferRecord) => (
        <a onClick={() => handleOpenDetail(record.id)}>{text}</a>
      )
    },
    {
      title: '调拨方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 100,
      render: (val: TransferDirection) => (
        <Tag color={DIRECTION_CONFIG[val].color}>{DIRECTION_CONFIG[val].text}</Tag>
      )
    },
    {
      title: '来源 → 去向',
      key: 'route',
      width: 180,
      render: (_: unknown, record: TransferRecord) => (
        <Text>{record.fromWarehouse} → {record.toWarehouse}</Text>
      )
    },
    {
      title: '配送方式',
      key: 'logisticsType',
      width: 100,
      render: (_: unknown, record: TransferRecord) => record.logisticsType === 'THIRD_PARTY'
        ? <span>{record.carrier || '第三方'}</span>
        : <span>{record.driverName || '自有司机'}</span>
    },
    {
      title: '订单/件数',
      key: 'orderInfo',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: TransferRecord) => `${record.orderCount}票 / ${record.totalPieces}件`
    },
    {
      title: '重量(kg)',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      width: 80,
      render: (val: number) => val.toFixed(1)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val: TransferStatus) => <Tag color={STATUS_CONFIG[val].color}>{STATUS_CONFIG[val].text}</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: TransferRecord) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record.id)}>
            详情
          </Button>
          {record.status === 'PENDING' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
                删除
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Space size={[8, 8]} wrap style={{ marginBottom: 10 }}>
        <Tag>待发运 {stats.pending}</Tag>
        <Tag color="processing">运输中 {stats.inTransit}</Tag>
        <Tag color="warning">已到达 {stats.arrived}</Tag>
        <Tag color="success">已确认 {stats.confirmed}</Tag>
      </Space>

      {/* 筛选区域 */}
      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Row gutter={[8, 8]} align="middle">
          <Col span={8}>
            <Input
              placeholder="调拨单号/仓库/承运商/司机/订单"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select value={filterStatus} onChange={setFilterStatus} style={{ width: '100%' }}>
              <Option value="ALL">全部状态</Option>
              <Option value="PENDING">待发运</Option>
              <Option value="IN_TRANSIT">运输中</Option>
              <Option value="ARRIVED">已到达</Option>
              <Option value="CONFIRMED">已确认</Option>
            </Select>
          </Col>
          <Col flex="auto" />
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
              <Button type="link" onClick={() => setShowAdvancedFilters(v => !v)}>
                {showAdvancedFilters ? '收起筛选' : '高级筛选'}
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>
                创建调拨单
              </Button>
            </Space>
          </Col>
        </Row>
        {showAdvancedFilters && (
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            <Col span={4}>
              <Select value={filterDirection} onChange={setFilterDirection} style={{ width: '100%' }}>
                <Option value="ALL">全部方向</Option>
                <Option value="BRANCH_TO_MAIN">分仓→总仓</Option>
                <Option value="MAIN_TO_BRANCH">总仓→分仓</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select value={filterWarehouse} onChange={setFilterWarehouse} style={{ width: '100%' }}>
                <Option value="ALL">全部仓库</Option>
                {WAREHOUSES.map(w => <Option key={w} value={w}>{w}</Option>)}
              </Select>
            </Col>
            <Col span={4}>
              <Select value={filterLogisticsType} onChange={setFilterLogisticsType} style={{ width: '100%' }}>
                <Option value="ALL">全部配送方式</Option>
                <Option value="THIRD_PARTY">第三方物流</Option>
                <Option value="SELF_DELIVERY">自有司机</Option>
              </Select>
            </Col>
          </Row>
        )}
      </Card>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: total => `共 ${total} 条记录` }}
        scroll={{ x: 1200, y: showAdvancedFilters ? 'calc(100vh - 510px)' : 'calc(100vh - 460px)' }}
        size="small"
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={editingRecord ? `编辑调拨单: ${editingRecord.transferNo}` : '创建调拨单'}
        open={createVisible}
        onCancel={() => { setCreateVisible(false); setEditingRecord(null); }}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <DestTransferCreate
          onSuccess={handleCreateSuccess}
          onCancel={() => { setCreateVisible(false); setEditingRecord(null); }}
          carrierOptions={carrierOptions}
          editData={editingRecord ? {
            id: editingRecord.id,
            transferNo: editingRecord.transferNo,
            direction: editingRecord.direction,
            fromWarehouse: editingRecord.fromWarehouse,
            toWarehouse: editingRecord.toWarehouse,
            shippingMethod: editingRecord.shippingMethod,
            shippingUnitNo: editingRecord.shippingUnitNo,
            logisticsType: editingRecord.logisticsType,
            carrier: editingRecord.carrier,
            logisticsTrackingNo: editingRecord.logisticsTrackingNo,
            driverName: editingRecord.driverName,
            driverPhone: editingRecord.driverPhone,
            driverPlate: editingRecord.driverPlate,
            orderIds: editingRecord.orderIds,
            remark: editingRecord.remark
          } : undefined}
        />
      </Modal>

      {/* 详情 Drawer */}
      <DestTransferDetail
        visible={detailVisible}
        transferId={currentDetailId}
        onClose={() => setDetailVisible(false)}
        onDelete={handleDeleteFromDetail}
        onEdit={handleEditFromDetail}
      />
    </div>
  );
};
