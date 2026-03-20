import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';

const { Text } = Typography;
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { InboundRecord, InboundStatus } from '../../../types/core';
import { warehouseApi, v2WmsApi } from '../../../api';
import InboundDetailDrawer from './InboundDetailDrawer';

const { RangePicker } = DatePicker;
const { Option } = Select;

type BusinessMode = 'ALL' | 'SEA' | 'AIR';
type InboundTypeFilter = 'ALL' | 'EXPRESS' | 'TRANSFER';

interface InboundListRow extends InboundRecord {
  subOrderNo?: string;
  displaySubOrderNo?: string;
  orderNo?: string;
  displayOrderNo?: string;
  subWaybillNo?: string;
  masterWaybillNo?: string;
  route?: string;
  serviceType?: string;
  goodsDescription?: string;
  logisticsStatus?: string;
  logisticsStatusTime?: string;
  thirdPartyStatus?: string;
  thirdPartyStatusTime?: string;
  salesPerson?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  orderDate?: string;
  updatedAt?: string;
}

interface ManualInboundFormValues {
  subOrderId: string;
  masterOrderId: string;
  trackingNo: string;
  expressCompany: string;
  clientCode: string;
  clientName: string;
  pieces: number;
  actualWeight?: number;
  actualVolume?: number;
  warehouseLocation?: string;
  remark?: string;
}

const STATUS_CONFIG: Record<InboundStatus, { text: string; color: string; icon: React.ReactNode }> = {
  PENDING: { text: '待处理', color: 'warning', icon: <ClockCircleOutlined /> },
  PROCESSING: { text: '处理中', color: 'processing', icon: <ClockCircleOutlined /> },
  COMPLETED: { text: '已入库', color: 'success', icon: <CheckCircleOutlined /> },
  ABNORMAL: { text: '异常', color: 'error', icon: <WarningOutlined /> },
};

const getInboundStatusView = (record: InboundListRow) => {
  if (record.status === 'ABNORMAL' && String(record.remark || '').includes('[取消入库]')) {
    return { text: '已取消', color: 'default', icon: <ClockCircleOutlined /> };
  }
  return STATUS_CONFIG[record.status];
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PREPAID: '预付',
  COD: '到付',
  CREDIT_CARD: '信用卡',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: '未付',
  PARTIAL: '部分付',
  PAID: '已付',
};

const TRACKING_STATUS_COLOR: Record<string, string> = {
  已签收: 'success',
  未签收: 'default',
  已取消: 'warning',
  异常: 'error',
};

const STATION_OPTIONS = [
  { label: '全部', value: 'ALL' },
  { label: '伊科贾站点', value: 'IKEJA' },
  { label: '电脑村站点', value: 'COMPUTER_VILLAGE' },
  { label: '维岛站点', value: 'VICTORIA_ISLAND' },
  { label: '贸易展会站点', value: 'TRADE_FAIR' },
];

export const InboundList = ({
  warehouseId,
  businessMode = 'ALL',
}: {
  warehouseId?: string;
  businessMode?: BusinessMode;
}) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<InboundListRow[]>([]);
  const [unmatchedPendingCount, setUnmatchedPendingCount] = useState(0);

  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<InboundStatus | 'ALL'>('PENDING');
  const [filterType, setFilterType] = useState<InboundTypeFilter>('ALL');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [filterStation, setFilterStation] = useState<string>('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');
  const [filterSales, setFilterSales] = useState<string>('ALL');

  const [supplementDrawerVisible, setSupplementDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<InboundListRow | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<InboundListRow | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createForm] = Form.useForm<ManualInboundFormValues>();

  const fetchUnmatchedCount = async () => {
    try {
      const res: any = await v2WmsApi.listUnmatchedPackages({
        status: 'PENDING',
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      });
      setUnmatchedPendingCount(Array.isArray(res?.data) ? res.data.length : 0);
    } catch (_) {
      setUnmatchedPendingCount(0);
    }
  };

  const fetchData = async (withFilters = false) => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        warehouse: 'CN',
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      };

      if (withFilters) {
        if (searchText.trim()) params.keyword = searchText.trim();
        if (filterStatus !== 'ALL') params.status = filterStatus;
        if (dateRange[0]) params.startDate = dateRange[0].startOf('day').toISOString();
        if (dateRange[1]) params.endDate = dateRange[1].endOf('day').toISOString();
      }

      const inboundRes: any = await warehouseApi.listInbound(params);
      let rows = (Array.isArray(inboundRes?.data) ? inboundRes.data : []) as InboundListRow[];

      if (filterType === 'EXPRESS') rows = rows.filter((row) => !row.transferNo);
      if (filterType === 'TRANSFER') rows = rows.filter((row) => Boolean(row.transferNo));

      setRecords(rows);
      fetchUnmatchedCount();
    } catch (error: any) {
      message.error(error.message || '加载入库数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [warehouseId, businessMode]);

  const handleSearch = () => {
    fetchData(true);
  };

  const handleReset = () => {
    setSearchText('');
    setFilterStatus('ALL');
    setFilterType('ALL');
    setDateRange([null, null]);
    setFilterStation('ALL');
    setFilterPaymentMethod('ALL');
    setFilterPaymentStatus('ALL');
    setFilterSales('ALL');
    fetchData(false);
  };

  const handleSupplement = (record: InboundListRow) => {
    setSelectedRecord(record);
    setSupplementDrawerVisible(true);
  };

  const handleViewDetail = async (record: InboundListRow) => {
    try {
      const res: any = await warehouseApi.getInbound(record.id);
      const latest = (res?.data || record) as InboundListRow;
      setDetailRecord(latest);
      setDetailVisible(true);
    } catch (error: any) {
      message.error(error.message || '加载详情失败');
    }
  };

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelRecord, setCancelRecord] = useState<InboundListRow | null>(null);
  const [cancelGoodsReceived, setCancelGoodsReceived] = useState<'YES' | 'NO' | ''>('');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelRemarkText, setCancelRemarkText] = useState<string>('');
  // 退运信息
  const [returnExpressCompany, setReturnExpressCompany] = useState<string>('');
  const [returnTrackingNo, setReturnTrackingNo] = useState<string>('');
  const [returnAddress, setReturnAddress] = useState<string>('');
  const [returnContact, setReturnContact] = useState<string>('');
  const [returnPhone, setReturnPhone] = useState<string>('');

  const CANCEL_REASONS_NOT_RECEIVED = [
    '未收到货物', '物流丢失', '运单信息错误', '重复下单', '其他',
  ];

  const CANCEL_REASONS_RECEIVED = [
    '客户取消', '货物损坏', '禁运物品', '货物不符', '客户拒收', '其他',
  ];

  const handleCancelInbound = (record: InboundListRow) => {
    setCancelRecord(record);
    setCancelGoodsReceived('');
    setCancelReason('');
    setCancelRemarkText('');
    setReturnExpressCompany('');
    setReturnTrackingNo('');
    setReturnAddress('');
    setReturnContact('');
    setReturnPhone('');
    setCancelModalVisible(true);
  };

  const handleCancelSubmit = async () => {
    if (!cancelGoodsReceived) {
      message.warning('请确认是否已收到货物');
      return;
    }
    if (!cancelReason) {
      message.warning('请选择取消原因');
      return;
    }
    try {
      const reason = cancelReason === '其他' ? (cancelRemarkText || '其他') : cancelReason;
      await warehouseApi.cancelInbound(cancelRecord!.id, {
        reason,
        operator: 'warehouse_cn',
      });

      if (cancelGoodsReceived === 'YES') {
        // Mock: 创建退运单
        message.success('已取消入库，退运单已创建');
      } else {
        message.success('已取消入库');
      }

      setCancelModalVisible(false);
      setCancelRecord(null);
      await fetchData(true);
    } catch (error: any) {
      message.error(error.message || '取消入库失败');
    }
  };

  const handleDeleteInbound = (record: InboundListRow) => {
    Modal.confirm({
      title: '确认删除入库记录',
      content: `删除后将回退关联库存/子单状态，确认删除 ${record.trackingNo || record.id} 吗？`,
      okText: '确认删除',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await warehouseApi.deleteInbound(record.id);
          message.success('入库记录已删除');
          if (detailRecord?.id === record.id) {
            setDetailVisible(false);
            setDetailRecord(null);
          }
          await fetchData(true);
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleCreateInbound = async () => {
    try {
      const values = await createForm.validateFields();
      await warehouseApi.createInbound({
        ...values,
        warehouse: 'CN',
        warehouseId,
        inboundMethod: 'MANUAL',
        packageCondition: 'GOOD',
        operator: 'warehouse_cn',
      });
      message.success('新增入库成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await fetchData(true);
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '新增入库失败');
    }
  };

  const handleSupplementSave = async (updatedRecord: InboundRecord) => {
    const toPhotosArray = () => {
      if (!updatedRecord.photos) return [];
      if (Array.isArray(updatedRecord.photos)) return updatedRecord.photos;
      if (typeof updatedRecord.photos === 'string') {
        try {
          return JSON.parse(updatedRecord.photos);
        } catch (_) {
          return [];
        }
      }
      return [];
    };

    await warehouseApi.updateInbound(updatedRecord.id, {
      actualWeight: updatedRecord.actualWeight ?? null,
      actualVolume: updatedRecord.actualVolume ?? null,
      packageCondition: updatedRecord.packageCondition,
      warehouseLocation: updatedRecord.warehouseLocation ?? null,
      remark: updatedRecord.remark ?? null,
      status: updatedRecord.status,
      photos: toPhotosArray(),
    });

    setSupplementDrawerVisible(false);
    setSelectedRecord(null);
    message.success('入库补录保存成功');
    fetchData(true);
  };

  const todayRecords = records.filter((record) =>
    dayjs(record.inboundTime || record.createdAt).isSame(dayjs(), 'day')
  );
  const todayPieces = todayRecords.reduce((sum, record) => sum + Number(record.pieces || 0), 0);
  const todayWeight = todayRecords.reduce((sum, record) => sum + Number(record.actualWeight || 0), 0);
  const abnormalCount = records.filter((record) => record.status === 'ABNORMAL').length;

  const columns = [
    {
      title: '入库日期',
      key: 'inboundTime',
      width: 170,
      render: (_: unknown, record: InboundListRow) =>
        dayjs(record.inboundTime || record.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '第三方运单号',
      key: 'trackingNo',
      width: 220,
      render: (_: unknown, record: InboundListRow) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.trackingNo || '-'}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.expressCompany || '-'}</div>
        </div>
      ),
    },
    {
      title: '物流状态',
      key: 'status',
      width: 170,
      render: (_: unknown, record: InboundListRow) => {
        const statusText = record.thirdPartyStatus || record.logisticsStatus || '-';
        const statusColor = TRACKING_STATUS_COLOR[statusText] || 'processing';
        const statusTime = record.thirdPartyStatusTime || record.logisticsStatusTime;
        return (
          <Space direction="vertical" size={2}>
            <Tag color={statusColor}>{statusText}</Tag>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
              {statusTime ? dayjs(statusTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </span>
          </Space>
        );
      },
    },
    {
      title: '子运单号',
      key: 'subWaybillNo',
      width: 180,
      render: (_: unknown, record: InboundListRow) => (
        <span style={{ fontWeight: 500 }}>{record.subWaybillNo || record.displaySubOrderNo || record.subOrderNo || record.subOrderId || '-'}</span>
      ),
    },
    {
      title: '主运单号',
      key: 'masterWaybillNo',
      width: 180,
      render: (_: unknown, record: InboundListRow) => (
        <span style={{ fontWeight: 500 }}>{record.masterWaybillNo || record.displayOrderNo || record.orderNo || '-'}</span>
      ),
    },
    {
      title: '业务员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
      width: 110,
      render: (value: string) => value || '-',
    },
    {
      title: '用户',
      key: 'clientName',
      width: 170,
      render: (_: unknown, record: InboundListRow) => (
        <Space direction="vertical" size={0}>
          <span>{record.clientName || '-'}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{record.clientCode || '-'}</span>
        </Space>
      ),
    },
    {
      title: '线路',
      dataIndex: 'route',
      key: 'route',
      width: 180,
      render: (value: string) => value || '-',
    },
    {
      title: '服务类型',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 120,
      render: (value: string) => value || '-',
    },
    {
      title: '说明',
      key: 'description',
      width: 130,
      render: (_: unknown, record: InboundListRow) => record.goodsDescription || record.remark || '-',
    },
    {
      title: '重量Kg',
      key: 'actualWeight',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, record: InboundListRow) => Number(record.actualWeight || 0).toFixed(2),
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 80,
      align: 'right' as const,
    },
    {
      title: '站点/JOB',
      key: 'stationJob',
      width: 160,
      render: (_: unknown, record: InboundListRow) => (
        <Space direction="vertical" size={0}>
          <span>{record.warehouseLocation || '海珠区站点'}</span>
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>{(record as any).jobNo || `JOB${record.id?.slice(-6) || '000000'}`}</span>
        </Space>
      ),
    },
    {
      title: '集装号',
      key: 'containerNos',
      width: 180,
      render: (_: unknown, record: InboundListRow) => {
        const nos = (record as any).containerNos || [`AK${String(Math.floor(Math.random() * 20) + 1).padStart(2, '0')}`];
        return <Space wrap size={4}>{nos.map((n: string) => <Tag key={n}>{n}</Tag>)}</Space>;
      },
    },
    {
      title: '支付方式/状态',
      key: 'paymentInfo',
      width: 170,
      render: (_: unknown, record: InboundListRow) => (
        <Space direction="vertical" size={0}>
          <span>{PAYMENT_METHOD_LABEL[record.paymentMethod || ''] || '-'}</span>
          <Tag color={(record.paymentStatus || 'UNPAID') === 'PAID' ? 'success' : 'warning'}>
            {PAYMENT_STATUS_LABEL[record.paymentStatus || ''] || '-'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '更新日期',
      key: 'updatedAt',
      width: 170,
      render: (_: unknown, record: InboundListRow) =>
        dayjs(record.updatedAt || record.createdAt).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 230,
      fixed: 'right' as const,
      render: (_: unknown, record: InboundListRow) => (
        <Space size={4} wrap>
          {record.status === 'COMPLETED' ? (
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleSupplement(record)}>
              详情
            </Button>
          ) : (
            <Button type="link" size="small" onClick={() => handleSupplement(record)}>
              入库
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            disabled={record.status === 'ABNORMAL'}
            onClick={() => handleCancelInbound(record)}
          >
            取消
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={record.status !== 'ABNORMAL'}
            onClick={() => handleDeleteInbound(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {unmatchedPendingCount > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`待匹配无订单快递 ${unmatchedPendingCount} 条`}
          description="建议优先处理无订单快递，避免滞留。可前往“无订单快递”页执行匹配或创单。"
        />
      )}

      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">今日入库 {todayRecords.length}</Tag>
        <Tag color="green">今日件数 {todayPieces}</Tag>
        <Tag color="orange">今日重量 {todayWeight.toFixed(2)}kg</Tag>
        <Tag color={abnormalCount > 0 ? 'error' : 'default'}>
          异常待处理 {abnormalCount}
        </Tag>
      </div>

      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            新增入库
          </Button>
          <Input
            placeholder="搜索运单号/JOB/快递单号/客户/线路"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 280 }}
            allowClear
          />
          <Select value={filterType} onChange={setFilterType} style={{ width: 130 }}>
            <Option value="ALL">全部类型</Option>
            <Option value="EXPRESS">快递入库</Option>
            <Option value="TRANSFER">调拨入库</Option>
          </Select>
          <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 130 }}>
            <Option value="ALL">全部状态</Option>
            <Option value="PENDING">待处理</Option>
            <Option value="PROCESSING">处理中</Option>
            <Option value="COMPLETED">已入库</Option>
            <Option value="ABNORMAL">异常</Option>
          </Select>
          <RangePicker value={dateRange as any} onChange={setDateRange as any} format="YYYY-MM-DD" />
          <Select value={filterStation} onChange={setFilterStation} style={{ width: 140 }} options={STATION_OPTIONS} />
          <Select value={filterPaymentMethod} onChange={setFilterPaymentMethod} style={{ width: 120 }}
            options={[{ label: '支付方式', value: 'ALL' }, { label: '预付', value: 'PREPAID' }, { label: '到付', value: 'COD' }, { label: '信用卡', value: 'CREDIT_CARD' }]} />
          <Select value={filterPaymentStatus} onChange={setFilterPaymentStatus} style={{ width: 120 }}
            options={[{ label: '支付状态', value: 'ALL' }, { label: '已付', value: 'PAID' }, { label: '未付', value: 'UNPAID' }, { label: '部分付', value: 'PARTIAL' }]} />
          <Select value={filterSales} onChange={setFilterSales} style={{ width: 120 }}
            options={[{ label: '业务员', value: 'ALL' }, { label: 'Smile', value: 'Smile' }, { label: 'Andi', value: 'Andi' }, { label: 'Karena', value: 'Karena' }]} />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>查询</Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={records}
        loading={loading}
        scroll={{ x: 2200, y: 'calc(100vh - 430px)' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        size="small"
      />

      <Drawer
        title="入库详情"
        placement="right"
        width={680}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setDetailRecord(null);
        }}
      >
        {detailRecord && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="入库单ID">{detailRecord.id}</Descriptions.Item>
            <Descriptions.Item label="入库时间">
              {dayjs(detailRecord.inboundTime || detailRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="主运单号">
              {detailRecord.masterWaybillNo || detailRecord.displayOrderNo || detailRecord.orderNo || detailRecord.masterOrderId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="子运单号">
              {detailRecord.subWaybillNo || detailRecord.displaySubOrderNo || detailRecord.subOrderNo || detailRecord.subOrderId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="第三方运单号">{detailRecord.trackingNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="快递公司">{detailRecord.expressCompany || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户">{detailRecord.clientName || '-'}（{detailRecord.clientCode || '-'}）</Descriptions.Item>
            <Descriptions.Item label="线路">{detailRecord.route || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务类型">{detailRecord.serviceType || '-'}</Descriptions.Item>
            <Descriptions.Item label="件数">{detailRecord.pieces || 0}</Descriptions.Item>
            <Descriptions.Item label="重量/体积">
              {Number(detailRecord.actualWeight || 0).toFixed(2)} kg / {Number(detailRecord.actualVolume || 0).toFixed(3)} m³
            </Descriptions.Item>
            <Descriptions.Item label="库位">{detailRecord.warehouseLocation || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getInboundStatusView(detailRecord).color}>{getInboundStatusView(detailRecord).text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="备注">{detailRecord.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Modal
        title="手动新增入库"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        onOk={handleCreateInbound}
        okText="提交"
        cancelText="取消"
        width={760}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="masterOrderId" label="主运单号" rules={[{ required: true, message: '请输入主运单号' }]}>
                <Input placeholder="例如：MO-XXXX 或订单ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="subOrderId" label="子运单号" rules={[{ required: true, message: '请输入子运单号' }]}>
                <Input placeholder="例如：SO-XXXX 或子单ID" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trackingNo" label="第三方运单号" rules={[{ required: true, message: '请输入第三方运单号' }]}>
                <Input placeholder="例如：SF123456789CN" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expressCompany" label="快递公司" rules={[{ required: true, message: '请输入快递公司' }]}>
                <Input placeholder="例如：顺丰速运" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="clientCode" label="客户编码" rules={[{ required: true, message: '请输入客户编码' }]}>
                <Input placeholder="客户编码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="clientName" label="客户名称" rules={[{ required: true, message: '请输入客户名称' }]}>
                <Input placeholder="客户名称" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pieces" label="件数" rules={[{ required: true, message: '请输入件数' }]}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actualWeight" label="重量(kg)">
                <Input type="number" min={0} step="0.01" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actualVolume" label="体积(m³)">
                <Input type="number" min={0} step="0.001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warehouseLocation" label="库位">
                <Input placeholder="例如：A-01-03" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remark" label="备注">
                <Input placeholder="可选备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="取消入库"
        open={cancelModalVisible}
        onCancel={() => { setCancelModalVisible(false); setCancelRecord(null); }}
        onOk={handleCancelSubmit}
        okText={cancelGoodsReceived === 'YES' ? '确认取消并创建退运单' : '确认取消'}
        cancelText="返回"
        okButtonProps={{ danger: true }}
        width={560}
      >
        {/* 运单信息 */}
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
          <Text>第三方运单：<Text strong>{cancelRecord?.expressCompany} {cancelRecord?.trackingNo}</Text></Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            主运单号：{cancelRecord?.masterWaybillNo || cancelRecord?.displayOrderNo || cancelRecord?.orderNo || cancelRecord?.masterOrderId || '-'}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            子运单号：{cancelRecord?.subWaybillNo || cancelRecord?.displaySubOrderNo || cancelRecord?.subOrderNo || cancelRecord?.subOrderId || '-'}
          </Text>
        </div>

        {/* Step 1: 是否已收到货物 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>是否已收到货物 <span style={{ color: '#ff4d4f' }}>*</span></div>
          <Space size="middle">
            <Button
              type={cancelGoodsReceived === 'NO' ? 'primary' : 'default'}
              onClick={() => { setCancelGoodsReceived('NO'); setCancelReason(''); }}
              style={{ width: 120 }}
            >
              未收到货
            </Button>
            <Button
              type={cancelGoodsReceived === 'YES' ? 'primary' : 'default'}
              danger={cancelGoodsReceived === 'YES'}
              onClick={() => { setCancelGoodsReceived('YES'); setCancelReason(''); }}
              style={{ width: 120 }}
            >
              已收到货
            </Button>
          </Space>
        </div>

        {/* Step 2: 取消原因（根据是否收到货显示不同选项） */}
        {cancelGoodsReceived && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>取消原因 <span style={{ color: '#ff4d4f' }}>*</span></div>
            <Select
              style={{ width: '100%' }}
              value={cancelReason || undefined}
              onChange={setCancelReason}
              placeholder="请选择取消原因"
              options={(cancelGoodsReceived === 'YES' ? CANCEL_REASONS_RECEIVED : CANCEL_REASONS_NOT_RECEIVED).map(r => ({ label: r, value: r }))}
            />
          </div>
        )}

        {/* 其他原因补充 */}
        {cancelReason === '其他' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>补充说明</div>
            <Input.TextArea
              rows={2}
              value={cancelRemarkText}
              onChange={e => setCancelRemarkText(e.target.value)}
              placeholder="请输入具体取消原因"
            />
          </div>
        )}

        {/* 已收到货提示 */}
        {cancelGoodsReceived === 'YES' && cancelReason && (
          <div style={{ padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4 }}>
            <Text style={{ color: '#d46b08' }}>
              确认后将自动创建退运单，您可以稍后在「退运处理」中补充退运快递信息和地址。
            </Text>
          </div>
        )}
      </Modal>

      <InboundDetailDrawer
        visible={supplementDrawerVisible}
        mode={selectedRecord?.status === 'COMPLETED' ? 'edit' : 'inbound'}
        orderId={selectedRecord?.id || ''}
        orderNo={selectedRecord?.displaySubOrderNo || selectedRecord?.subOrderNo || selectedRecord?.orderNo}
        routeCode={(selectedRecord as any)?.routeCode || 'CAN.CHN-LOS.NGN'}
        serviceType={selectedRecord?.serviceType === 'EXPRESS' ? 'EXPRESS' : 'STANDARD'}
        salesPerson={selectedRecord?.salesPerson}
        customerName={selectedRecord?.clientName}
        orderDate={selectedRecord?.orderDate}
        trackingNo={selectedRecord?.trackingNo}
        expressCompany={(selectedRecord as any)?.expressCompany}
        signStatus={selectedRecord?.thirdPartyStatus || selectedRecord?.logisticsStatus}
        signTime={selectedRecord?.thirdPartyStatusTime || selectedRecord?.logisticsStatusTime}
        category={(selectedRecord as any)?.category}
        goodsName={(selectedRecord as any)?.goodsName}
        remark={selectedRecord?.remark}
        onSubmit={() => {
          setSupplementDrawerVisible(false);
          setSelectedRecord(null);
          fetchData(true);
        }}
        onClose={() => {
          setSupplementDrawerVisible(false);
          setSelectedRecord(null);
        }}
      />
    </div>
  );
};
