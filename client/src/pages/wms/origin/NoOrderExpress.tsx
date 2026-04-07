import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Select, Tag, Space, Row, Col,
  Modal, Form, Input, InputNumber, message, Tooltip, Badge,
  Drawer, Timeline, Descriptions
} from 'antd';
import {
  WarningOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PhoneOutlined, UserOutlined, BellOutlined, LinkOutlined,
  PlusCircleOutlined, RollbackOutlined, SearchOutlined,
  EyeOutlined, InboxOutlined, EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { OrderCreate } from '../../oms/OrderCreate';
import { v2OmsApi, v2WmsApi } from '../../../api';

const { Option } = Select;
const { TextArea } = Input;

// 处理状态
type NoOrderStatus = 'PENDING' | 'MATCHED' | 'CLOSED';

// 流转记录
interface FlowRecord {
  time: string;
  action: string;
  operator: string;
  detail?: string;
}

// 无订单快递记录
interface NoOrderExpress {
  id: string;
  expressCompany: string;
  expressTrackingNo: string;
  senderName?: string;
  senderPhone?: string;
  receiverName?: string;
  receiverPhone?: string;
  pieces: number;
  weight?: number;
  volume?: number;
  inboundTime: string;
  warehouseLocation?: string;
  status: NoOrderStatus;
  matchedOrderId?: string;
  notifyRecord?: string[];
  processor?: string;
  remark?: string;
  createdAt: string;
  flowRecords?: FlowRecord[]; // 流转记录
}

interface ManualNoOrderInboundForm {
  businessLine?: 'SEA' | 'AIR';
  trackingNo: string;
  expressCompany: string;
  pieces?: number;
  grossWeightKg?: number;
  volumeCbm?: number;
  senderName?: string;
  senderPhone?: string;
  destCountry?: string;
  category?: string;
  goodsName?: string;
  customerHint?: string;
  locationCode?: string;
  remark?: string;
}

interface NoOrderEditForm {
  expressTrackingNo: string;
  expressCompany: string;
  receiverName?: string;
  receiverPhone?: string;
  pieces: number;
  weight?: number;
  volume?: number;
  remark?: string;
}

// 映射服务端状态到组件状态
const mapNoOrderStatus = (status: string): NoOrderStatus => {
  const map: Record<string, NoOrderStatus> = {
    PENDING: 'PENDING',
    MATCHED: 'MATCHED',
    CLOSED: 'CLOSED',
  };
  return map[status] || 'PENDING';
};

// 状态配置
const STATUS_CONFIG: Record<NoOrderStatus, { text: string; color: string; icon: React.ReactNode }> = {
  PENDING: { text: '待处理', color: 'error', icon: <ClockCircleOutlined /> },
  MATCHED: { text: '已匹配', color: 'success', icon: <LinkOutlined /> },
  CLOSED: { text: '已关闭', color: 'default', icon: <RollbackOutlined /> }
};

const GOODS_CATEGORIES = [
  '日用百货', '机械/五金/仪表', '食品', '化妆品', '保健品',
  '药品', '电子产品', '服装/纺织品', '文件', '其他',
];

const COUNTRY_OPTIONS = [
  { label: '尼日利亚', value: 'NGA' },
  { label: '加纳', value: 'GHA' },
  { label: '几内亚', value: 'GIN' },
  { label: '中国', value: 'CHN' },
];

const WAREHOUSE_LOCATIONS = [
  { label: 'A区-01', value: 'A-01' },
  { label: 'A区-02', value: 'A-02' },
  { label: 'B区-01', value: 'B-01' },
  { label: 'B区-02', value: 'B-02' },
  { label: 'C区-01', value: 'C-01' },
];

const EXPRESS_COMPANY_OPTIONS = [
  { label: '顺丰', value: '顺丰' }, { label: '顺丰速运', value: '顺丰速运' }, { label: '韵达快递', value: '韵达快递' },
  { label: '圆通速递', value: '圆通速递' }, { label: '中通速运', value: '中通速运' },
  { label: '申通快递', value: '申通快递' }, { label: '京东物流', value: '京东物流' },
  { label: '德邦物流', value: '德邦物流' }, { label: '百世快递', value: '百世快递' },
  { label: '其它公司', value: '其它公司' },
];

export const NoOrderExpress = ({ warehouseId, businessMode = 'ALL' }: { warehouseId?: string; businessMode?: 'ALL' | 'SEA' | 'AIR' }) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<NoOrderExpress[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<NoOrderExpress[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendedOrders, setRecommendedOrders] = useState<any[]>([]);
  const [recommendedCustomers, setRecommendedCustomers] = useState<any[]>([]);

  // 筛选条件
  const [filterStatus, setFilterStatus] = useState<NoOrderStatus | 'ALL'>('ALL');
  const [searchText, setSearchText] = useState('');

  // Modal/Drawer状态
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [createOrderModalVisible, setCreateOrderModalVisible] = useState(false);
  const [notifyModalVisible, setNotifyModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [createInboundModalVisible, setCreateInboundModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<NoOrderExpress | null>(null);

  const [matchForm] = Form.useForm();
  const [notifyForm] = Form.useForm();
  const [createInboundForm] = Form.useForm<ManualNoOrderInboundForm>();
  const [editForm] = Form.useForm<NoOrderEditForm>();

  // 加载数据
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await v2WmsApi.listUnmatchedPackages({
        warehouseId,
        businessLine: businessMode === 'ALL' ? undefined : businessMode,
      });
      const raw = (res as any)?.data || [];
      const mapped: NoOrderExpress[] = (raw as any[]).map((r: any) => ({
        id: r.id,
        expressCompany: r.express_company || '-',
        expressTrackingNo: r.tracking_no || '-',
        senderName: r.sender_name || '',
        senderPhone: r.sender_phone || '',
        receiverName: r.consignee_name || '',
        receiverPhone: r.consignee_phone || '',
        pieces: r.pieces || 0,
        weight: r.gross_weight_kg,
        volume: r.volume_cbm,
        inboundTime: (r.created_at || r.matched_at || '').replace('T', ' ').slice(0, 19) || '-',
        warehouseLocation: r.warehouseName || r.warehouseCode || '-',
        status: mapNoOrderStatus(r.status),
        matchedOrderId: r.matchedDisplayOrderNo || r.matchedOrderNo || '',
        processor: r.match_method || '',
        remark: r.match_note || '',
        createdAt: (r.created_at || '').replace('T', ' ').slice(0, 19) || '-',
        flowRecords: [
          { time: (r.created_at || '').replace('T', ' ').slice(0, 19) || '-', action: '入待匹配池', operator: '-', detail: `入库仓：${r.warehouseName || '-'}` },
          ...(r.matched_at ? [{ time: String(r.matched_at).replace('T', ' ').slice(0, 19), action: '匹配订单', operator: r.match_method || '-', detail: `匹配到订单：${r.matchedDisplayOrderNo || r.matchedOrderNo || '-'}` }] : []),
        ],
      }));
      setRecords(mapped);
      setFilteredRecords(mapped);
    } catch (err: any) {
      message.error(err.message || '加载无订单快递数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [warehouseId, businessMode]);

  // 统计数据
  const pendingCount = records.filter(r => r.status === 'PENDING').length;
  const matchedCount = records.filter(r => r.status === 'MATCHED').length;
  const closedCount = records.filter(r => r.status === 'CLOSED').length;

  // 筛选逻辑
  const handleFilter = () => {
    let filtered = [...records];

    if (searchText) {
      filtered = filtered.filter(r =>
        r.expressTrackingNo.toLowerCase().includes(searchText.toLowerCase()) ||
        r.expressCompany.toLowerCase().includes(searchText.toLowerCase()) ||
        r.receiverName?.toLowerCase().includes(searchText.toLowerCase()) ||
        r.senderName?.toLowerCase().includes(searchText.toLowerCase()) ||
        r.receiverPhone?.toLowerCase().includes(searchText.toLowerCase()) ||
        r.senderPhone?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    setFilteredRecords(filtered);
  };

  useEffect(() => {
    handleFilter();
  }, [records, searchText, filterStatus]);

  // 重置筛选
  const handleReset = () => {
    setSearchText('');
    setFilterStatus('ALL');
    setFilteredRecords(records);
  };

  // 查看详情
  const handleViewDetail = (record: NoOrderExpress) => {
    setSelectedRecord(record);
    setDetailDrawerVisible(true);
  };

  // 匹配订单
  const handleMatch = async (record: NoOrderExpress) => {
    setSelectedRecord(record);
    matchForm.resetFields();
    setMatchModalVisible(true);
    setRecommendLoading(true);
    try {
      const res = await v2WmsApi.getUnmatchedRecommendations(record.id);
      const data = (res as any)?.data || {};
      setRecommendedOrders(Array.isArray(data.orders) ? data.orders : []);
      setRecommendedCustomers(Array.isArray(data.customers) ? data.customers : []);
    } catch (err) {
      setRecommendedOrders([]);
      setRecommendedCustomers([]);
    } finally {
      setRecommendLoading(false);
    }
  };

  const handleMatchSubmit = async () => {
    try {
      const values = await matchForm.validateFields();
      setLoading(true);

      await v2WmsApi.matchUnmatchedPackage(selectedRecord!.id, {
        orderId: values.orderId,
        createSubOrder: true,
        operatorUserId: 'U-SALES-01',
        matchMethod: 'MANUAL',
        remark: values.remark,
      });

      setMatchModalVisible(false);
      matchForm.resetFields();
      message.success('订单匹配成功');
      await fetchData();
      setLoading(false);
    } catch (error: any) {
      message.error(error.message || '匹配失败');
      setLoading(false);
    }
  };

  // 创建订单
  const handleCreateOrder = (record: NoOrderExpress) => {
    setSelectedRecord(record);
    setCreateOrderModalVisible(true);
  };

  const handleCreateOrderSubmit = async (values: any) => {
    if (!selectedRecord) return;
    try {
      setLoading(true);
      if (!values.customerId) {
        message.error('请选择已有客户');
        return;
      }
      const reqPayload = {
        customerId: values.customerId,
        orderSource: 'SALES_ASSIST',
        businessLine: values.transportType,
        serviceTypeCode: values.serviceType,
        salesUserId: 'U-SALES-01',
        creatorUserId: 'U-SALES-01',
        routeId: values.routeId,
        routeCode: values.routeCode,
        warehouseEntryNo: values.warehouseEntryNo,
        currencyCode: values.currency,
        senderProfileId: values.senderProfileId,
        recipientAddressId: values.recipientAddressId,
        senderName: values.sender,
        senderPhone: values.senderPhone,
        senderAddress: values.senderAddress,
        senderCityId: values.senderCityId,
        senderCountryId: values.senderCountryId,
        consigneeName: values.consignee,
        consigneePhone: values.consigneePhone,
        consigneeEmail: values.consigneeEmail,
        consigneeAddress: values.destAddress,
        consigneeCityId: values.consigneeCityId,
        consigneeCountryId: values.consigneeCountryId,
        remark: values.remark,
        packages: (values.expressPackages || []).map((pkg: any) => ({
          expressCompany: pkg.courier,
          trackingNo: pkg.trackingNo,
          goodsName: pkg.itemName,
          goodsCategory: pkg.category,
          cargoDesc: pkg.cargoType,
          declaredWeightKg: Number(pkg.weight || 0),
          pieces: Number(pkg.pieces || 0),
          declaredValueUsd: Number(pkg.declaredValue || 0),
          remark: pkg.remark,
        })),
      };
      const createRes = await v2OmsApi.createOrder(reqPayload) as any;
      const orderRow = createRes?.data?.order;
      if (!orderRow?.id) {
        throw new Error('订单创建返回异常，缺少订单ID');
      }

      await v2WmsApi.matchUnmatchedPackage(selectedRecord.id, {
        orderId: orderRow.id,
        createSubOrder: true,
        operatorUserId: 'U-SALES-01',
        matchMethod: 'CREATE_ORDER',
        remark: `创单自动匹配：${orderRow.order_no || orderRow.display_order_no || orderRow.id}`,
      });

      setCreateOrderModalVisible(false);
      setSelectedRecord(null);
      message.success(`运单创建并自动匹配成功：${orderRow.order_no || orderRow.display_order_no || orderRow.id}`);
      await fetchData();
    } catch (error: any) {
      message.error(error.message || '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 通知客户
  const handleNotify = (record: NoOrderExpress) => {
    setSelectedRecord(record);
    notifyForm.resetFields();
    setNotifyModalVisible(true);
  };

  const handleNotifySubmit = async () => {
    try {
      const values = await notifyForm.validateFields();
      setLoading(true);
      if (!selectedRecord) return;
      await v2WmsApi.updateUnmatchedPackage(selectedRecord.id, {
        matchMethod: 'NOTIFY',
        matchNote: values.notifyContent,
      });

      setNotifyModalVisible(false);
      notifyForm.resetFields();
      message.success('通知发送成功');
      await fetchData();
    } catch (error: any) {
      message.error(error.message || '通知失败');
    } finally {
      setLoading(false);
    }
  };

  // 退运相关状态
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [returnRecord, setReturnRecord] = useState<NoOrderExpress | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnRemarkText, setReturnRemarkText] = useState('');

  const RETURN_REASONS = [
    '客户取消', '货物损坏', '禁运物品', '货物不符', '客户拒收', '无人认领', '其他',
  ];

  // 退回处理
  const handleReturn = (record: NoOrderExpress) => {
    setReturnRecord(record);
    setReturnReason('');
    setReturnRemarkText('');
    setReturnModalVisible(true);
  };

  const handleReturnSubmit = async () => {
    if (!returnReason) {
      message.warning('请选择退运原因');
      return;
    }
    try {
      const reason = returnReason === '其他' ? (returnRemarkText || '其他') : returnReason;
      await v2WmsApi.updateUnmatchedPackage(returnRecord!.id, {
        status: 'CLOSED',
        matchMethod: 'CLOSE',
        matchNote: `退运: ${reason}`,
      });
      message.success('已创建退运单，可在「退运处理」中查看');
      setReturnModalVisible(false);
      setReturnRecord(null);
      await fetchData();
    } catch (err: any) {
      message.error(err.message || '操作失败');
    }
  };

  const handleDelete = (record: NoOrderExpress) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除待匹配包裹 ${record.expressTrackingNo} 吗？`,
      okText: '确认删除',
      cancelText: '返回',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await v2WmsApi.deleteUnmatchedPackage(record.id);
          message.success('待匹配包裹已删除');
          await fetchData();
        } catch (error: any) {
          message.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleEdit = (record: NoOrderExpress) => {
    setSelectedRecord(record);
    editForm.setFieldsValue({
      expressTrackingNo: record.expressTrackingNo,
      expressCompany: record.expressCompany,
      receiverName: record.receiverName,
      receiverPhone: record.receiverPhone,
      pieces: record.pieces,
      weight: record.weight,
      volume: record.volume,
      remark: record.remark,
    });
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      if (!selectedRecord) return;
      const values = await editForm.validateFields();
      await v2WmsApi.updateUnmatchedPackage(selectedRecord.id, {
        trackingNo: values.expressTrackingNo,
        expressCompany: values.expressCompany,
        consigneeName: values.receiverName,
        consigneePhone: values.receiverPhone,
        pieces: Number(values.pieces || 0),
        grossWeightKg: Number(values.weight || 0),
        volumeCbm: Number(values.volume || 0),
        matchNote: values.remark || null,
      });
      message.success('无订单快递已更新');
      setEditModalVisible(false);
      editForm.resetFields();
      setSelectedRecord(null);
      await fetchData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '编辑失败');
    }
  };

  const handleCreateInbound = async () => {
    try {
      if (!warehouseId) {
        message.error('当前用户未绑定仓库，无法录入');
        return;
      }
      const values = await createInboundForm.validateFields();
      const effectiveBusinessLine = businessMode === 'ALL' ? (values.businessLine || 'SEA') : businessMode;
      if (!effectiveBusinessLine) {
        message.error('请选择业务线');
        return;
      }

      await v2WmsApi.createInbound({
        warehouseId,
        businessLine: effectiveBusinessLine,
        sourceType: 'NO_ORDER',
        operatorUserId: 'warehouse_cn',
        remark: values.remark || null,
        items: [
          {
            trackingNo: values.trackingNo,
            expressCompany: values.expressCompany,
            pieces: Number(values.pieces || 1),
            grossWeightKg: Number(values.grossWeightKg || 0),
            volumeCbm: Number(values.volumeCbm || 0),
            senderName: values.senderName || null,
            senderPhone: values.senderPhone || null,
            customerHint: values.customerHint || null,
            locationCode: values.locationCode || null,
          },
        ],
      });

      message.success('无订单快递录入成功');
      setCreateInboundModalVisible(false);
      createInboundForm.resetFields();
      await fetchData();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || '录入失败');
    }
  };

  // 计算滞留天数
  const getDaysStayed = (inboundTime: string) => {
    return dayjs().diff(dayjs(inboundTime), 'day');
  };

  // 表格列定义
  const columns = [
    {
      title: '入库时间',
      dataIndex: 'inboundTime',
      key: 'inboundTime',
      width: 160,
      render: (text: string, record: NoOrderExpress) => {
        const days = getDaysStayed(text);
        const isWarning = days > 3;
        return (
          <div>
            <div>{dayjs(text).format('YYYY-MM-DD HH:mm')}</div>
            <div style={{ fontSize: 12, color: isWarning ? '#ff4d4f' : '#999' }}>
              {isWarning && <WarningOutlined style={{ marginRight: 4 }} />}
              滞留 {days} 天
            </div>
          </div>
        );
      }
    },
    {
      title: '快递信息',
      key: 'express',
      width: 180,
      render: (_: unknown, record: NoOrderExpress) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.expressTrackingNo}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.expressCompany}</div>
        </div>
      )
    },
    {
      title: '联系人信息',
      key: 'contact',
      width: 150,
      render: (_: unknown, record: NoOrderExpress) => {
        const contactName = record.receiverName || record.senderName;
        const contactPhone = record.receiverPhone || record.senderPhone;
        return (
          <div>
            {contactName ? (
              <>
                <div>
                  <UserOutlined style={{ marginRight: 4 }} />
                  {contactName}
                </div>
                {contactPhone && (
                  <div style={{ fontSize: 12, color: '#999' }}>
                    <PhoneOutlined style={{ marginRight: 4 }} />
                    {contactPhone}
                  </div>
                )}
              </>
            ) : (
              <Tag color="warning">无联系人信息</Tag>
            )}
          </div>
        );
      }
    },
    {
      title: '货物信息',
      key: 'cargo',
      width: 150,
      render: (_: unknown, record: NoOrderExpress) => (
        <div>
          <div>{record.pieces} 件</div>
          {record.weight && (
            <div style={{ fontSize: 12, color: '#999' }}>
              {record.weight.toFixed(2)} kg
              {record.volume && ` / ${record.volume.toFixed(3)} m³`}
            </div>
          )}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: NoOrderStatus, record: NoOrderExpress) => {
        const config = STATUS_CONFIG[status];
        const days = getDaysStayed(record.inboundTime);
        const isUrgent = status === 'PENDING' && days > 3;

        return (
          <Space>
            <Tag color={config.color} icon={config.icon}>
              {config.text}
            </Tag>
            {isUrgent && (
              <Tooltip title="滞留超过3天">
                <Badge status="error" />
              </Tooltip>
            )}
          </Space>
        );
      }
    },
    {
      title: '关联订单',
      dataIndex: 'matchedOrderId',
      key: 'matchedOrderId',
      width: 130,
      render: (text: string) => text || '-'
    },
    {
      title: '处理人',
      dataIndex: 'processor',
      key: 'processor',
      width: 100,
      render: (text: string) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 360,
      fixed: 'right' as const,
      render: (_: unknown, record: NoOrderExpress) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status !== 'MATCHED' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          )}
          {record.status === 'PENDING' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => handleMatch(record)}
              >
                匹配
              </Button>
              <Button
                type="link"
                size="small"
                icon={<PlusCircleOutlined />}
                onClick={() => handleCreateOrder(record)}
              >
                创单
              </Button>
              <Button
                type="link"
                size="small"
                icon={<BellOutlined />}
                onClick={() => handleNotify(record)}
              >
                通知
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<RollbackOutlined />}
                onClick={() => handleReturn(record)}
              >
                退回
              </Button>
            </>
          )}
          {record.status === 'MATCHED' && (
            <Tag color="success">已处理</Tag>
          )}
          {record.status !== 'MATCHED' && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleDelete(record)}
            >
              删除
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="error">待处理 {pendingCount}</Tag>
        <Tag color="success">已匹配 {matchedCount}</Tag>
        <Tag>已关闭 {closedCount}</Tag>
      </div>

      {/* 筛选区域 */}
      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <div className="list-page-toolbar">
          <div className="list-page-toolbar__filters">
            <div className="list-page-toolbar__field" style={{ flex: '1 1 260px', minWidth: 240 }}>
              <Input
                placeholder="搜索运单号/快递公司/收件人"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onPressEnter={handleFilter}
                allowClear
              />
            </div>
            <div className="list-page-toolbar__field" style={{ minWidth: 120 }}>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                style={{ width: '100%' }}
              >
                <Option value="ALL">全部状态</Option>
                <Option value="PENDING">待处理</Option>
                <Option value="MATCHED">已匹配</Option>
                <Option value="CLOSED">已关闭</Option>
              </Select>
            </div>
          </div>
          <div className="list-page-toolbar__actions">
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleFilter}
            >
              查询
            </Button>
            <Button onClick={handleReset}>
              重置
            </Button>
            <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => setCreateInboundModalVisible(true)}>
              新增无订单快递
            </Button>
          </div>
        </div>
      </Card>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredRecords}
        loading={loading}
        scroll={{ x: 1600, y: 'calc(100vh - 430px)' }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: total => `共 ${total} 条记录`
        }}
        size="small"
      />

      <Modal
        title="新增无订单快递"
        open={createInboundModalVisible}
        onOk={handleCreateInbound}
        onCancel={() => {
          setCreateInboundModalVisible(false);
          createInboundForm.resetFields();
        }}
        width={760}
      >
        <Form
          form={createInboundForm}
          layout="vertical"
          style={{ marginTop: 12 }}
          initialValues={{ businessLine: businessMode === 'ALL' ? undefined : businessMode, pieces: 1 }}
        >
          <Row gutter={16}>
            {businessMode === 'ALL' && (
              <Col span={12}>
                <Form.Item name="businessLine" label="业务线" rules={[{ required: true, message: '请选择业务线' }]}>
                  <Select options={[{ label: '空运', value: 'AIR' }, { label: '海运', value: 'SEA' }]} />
                </Form.Item>
              </Col>
            )}
            <Col span={12}>
              <Form.Item name="expressCompany" label="快递公司" rules={[{ required: true, message: '请选择快递公司' }]}>
                <Select showSearch options={EXPRESS_COMPANY_OPTIONS} placeholder="例如：顺丰" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="trackingNo" label="快递单号" rules={[{ required: true, message: '请输入快递单号' }]}>
                <Input placeholder="例如：SF123456789CN" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="senderName" label="寄件人" rules={[{ required: true, message: '请输入寄件人' }]}>
                <Input placeholder="例如：张三" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="senderPhone" label="寄件人电话">
                <Input placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="destCountry" label="发往国家">
                <Select options={COUNTRY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="pieces" label="件数">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="grossWeightKg" label="重量Kg">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="volumeCbm" label="体积CBM">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="类别">
                <Select options={GOODS_CATEGORIES.map(c => ({ label: c, value: c }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="goodsName" label="说明/品名">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="locationCode" label="仓位">
                <Select options={WAREHOUSE_LOCATIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} maxLength={200} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="编辑无订单快递"
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedRecord(null);
        }}
        width={720}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="expressTrackingNo" label="快递运单号" rules={[{ required: true, message: '请输入快递运单号' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expressCompany" label="快递公司" rules={[{ required: true, message: '请输入快递公司' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="receiverName" label="收件人">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="receiverPhone" label="收件电话">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pieces" label="件数" rules={[{ required: true, message: '请输入件数' }]}>
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weight" label="重量(kg)">
                <Input type="number" min={0} step="0.01" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="volume" label="体积(m³)">
                <Input type="number" min={0} step="0.001" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <TextArea rows={3} maxLength={200} showCount />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="无订单快递详情"
        placement="right"
        width={720}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedRecord(null);
        }}
      >
        {selectedRecord && (
          <div>
            <Descriptions title="基本信息" bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="快递公司">{selectedRecord.expressCompany}</Descriptions.Item>
              <Descriptions.Item label="运单号">{selectedRecord.expressTrackingNo}</Descriptions.Item>
              <Descriptions.Item label="联系人">{selectedRecord.receiverName || selectedRecord.senderName || '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{selectedRecord.receiverPhone || selectedRecord.senderPhone || '-'}</Descriptions.Item>
              <Descriptions.Item label="件数">{selectedRecord.pieces} 件</Descriptions.Item>
              <Descriptions.Item label="重量">{selectedRecord.weight ? `${selectedRecord.weight.toFixed(2)} kg` : '-'}</Descriptions.Item>
              <Descriptions.Item label="体积">{selectedRecord.volume ? `${selectedRecord.volume.toFixed(3)} m³` : '-'}</Descriptions.Item>
              <Descriptions.Item label="入库时间">{dayjs(selectedRecord.inboundTime).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="滞留天数">
                <span style={{ color: getDaysStayed(selectedRecord.inboundTime) > 3 ? '#ff4d4f' : '#000' }}>
                  {getDaysStayed(selectedRecord.inboundTime)} 天
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_CONFIG[selectedRecord.status].color} icon={STATUS_CONFIG[selectedRecord.status].icon}>
                  {STATUS_CONFIG[selectedRecord.status].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联订单">{selectedRecord.matchedOrderId || '-'}</Descriptions.Item>
              <Descriptions.Item label="处理人">{selectedRecord.processor || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{selectedRecord.remark || '-'}</Descriptions.Item>
            </Descriptions>

            {selectedRecord.notifyRecord && selectedRecord.notifyRecord.length > 0 && (
              <Card title="通知记录" size="small" style={{ marginBottom: 24 }}>
                {selectedRecord.notifyRecord.map((record, index) => (
                  <div key={index} style={{ marginBottom: 8, fontSize: 12 }}>
                    <BellOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                    {record}
                  </div>
                ))}
              </Card>
            )}

            <Card title="流转记录" size="small">
              <Timeline
                mode="left"
                items={(selectedRecord.flowRecords || [])
                  .sort((a, b) => dayjs(b.time).valueOf() - dayjs(a.time).valueOf())
                  .map((record) => ({
                    color: record.action?.includes('入库') || record.action?.includes('入待匹配') ? 'green' :
                           record.action?.includes('匹配') ? 'blue' :
                           record.action?.includes('通知') ? 'orange' : 'gray',
                    label: dayjs(record.time).format('YYYY-MM-DD HH:mm'),
                    children: (
                      <div>
                        <div style={{ fontWeight: 500 }}>{record.action}</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                          操作人: {record.operator}{record.detail ? ` | ${record.detail}` : ''}
                        </div>
                      </div>
                    ),
                  }))}
              />
            </Card>
          </div>
        )}
      </Drawer>

      {/* 匹配订单 Modal */}
      <Modal
        title="匹配订单"
        open={matchModalVisible}
        onOk={handleMatchSubmit}
        onCancel={() => {
          setMatchModalVisible(false);
          matchForm.resetFields();
          setRecommendedOrders([]);
          setRecommendedCustomers([]);
        }}
        confirmLoading={loading}
        width={640}
      >
        {selectedRecord && (
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="快递单号">{selectedRecord.expressTrackingNo}</Descriptions.Item>
              <Descriptions.Item label="快递公司">{selectedRecord.expressCompany}</Descriptions.Item>
              <Descriptions.Item label="联系人">{selectedRecord.receiverName || selectedRecord.senderName || '-'}</Descriptions.Item>
              <Descriptions.Item label="件数/重量">{selectedRecord.pieces}件 / {selectedRecord.weight ? `${selectedRecord.weight}kg` : '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}
        <Form form={matchForm} layout="vertical">
          <Form.Item
            name="orderId"
            label="运单号"
            rules={[{ required: true, message: '请输入运单号' }]}
          >
            <Input placeholder="请输入要匹配的运单号" />
          </Form.Item>
          {recommendLoading && (
            <div style={{ marginBottom: 12, color: '#8c8c8c' }}>正在加载推荐订单...</div>
          )}
          {!recommendLoading && recommendedOrders.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>推荐匹配运单（点击选择）</div>
              <Space size={[8, 8]} wrap>
                {recommendedOrders.slice(0, 8).map((order) => {
                  const displayNo = order.orderNo || order.displayOrderNo || order.id;
                  return (
                    <Tag
                      key={order.id}
                      color="blue"
                      style={{ cursor: 'pointer' }}
                      onClick={() => matchForm.setFieldsValue({ orderId: displayNo })}
                    >
                      {displayNo} / {order.customerName || '-'}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          )}
          {!recommendLoading && recommendedOrders.length === 0 && recommendedCustomers.length > 0 && (
            <div style={{ marginBottom: 12, fontSize: 12, color: '#8c8c8c' }}>
              暂无可直接匹配订单，推荐客户：{recommendedCustomers.slice(0, 5).map(c => c.customerName).join('、')}
            </div>
          )}
          <Form.Item name="remark" label="备注">
            <TextArea rows={3} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 通知客户 Modal */}
      <Modal
        title="通知客户"
        open={notifyModalVisible}
        onOk={handleNotifySubmit}
        onCancel={() => {
          setNotifyModalVisible(false);
          notifyForm.resetFields();
        }}
        confirmLoading={loading}
      >
        <Form form={notifyForm} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item
            name="notifyContent"
            label="通知内容"
            rules={[{ required: true, message: '请输入通知内容' }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入通知内容，例如：已通知客户张经理，等待确认订单信息"
              maxLength={200}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建订单 Modal */}
      <Modal
        title={<span style={{ color: '#d48806', fontWeight: 700 }}>创建订单</span>}
        open={createOrderModalVisible}
        onCancel={() => {
          setCreateOrderModalVisible(false);
          setSelectedRecord(null);
        }}
        footer={null}
        width={1400}
        destroyOnClose
      >
        <OrderCreate
          onCancel={() => {
            setCreateOrderModalVisible(false);
            setSelectedRecord(null);
          }}
          onSubmit={handleCreateOrderSubmit}
          businessMode={businessMode}
          initialExpressData={selectedRecord ? {
            courier: selectedRecord.expressCompany,
            trackingNo: selectedRecord.expressTrackingNo,
            itemName: '',
            pieces: selectedRecord.pieces,
            weight: selectedRecord.weight
          } : undefined}
        />
      </Modal>

      {/* 退运弹窗 */}
      <Modal
        title="退运"
        open={returnModalVisible}
        onCancel={() => { setReturnModalVisible(false); setReturnRecord(null); }}
        onOk={handleReturnSubmit}
        okText="确认退运并创建退运单"
        cancelText="返回"
        okButtonProps={{ danger: true }}
        width={480}
      >
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
          <div>快递单号：<strong>{returnRecord?.expressTrackingNo}</strong></div>
          <div style={{ fontSize: 12, color: '#666' }}>快递公司：{returnRecord?.expressCompany}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>退运原因 <span style={{ color: '#ff4d4f' }}>*</span></div>
          <Select
            style={{ width: '100%' }}
            value={returnReason || undefined}
            onChange={setReturnReason}
            placeholder="请选择退运原因"
            options={RETURN_REASONS.map(r => ({ label: r, value: r }))}
          />
        </div>
        {returnReason === '其他' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>补充说明</div>
            <Input.TextArea
              rows={2}
              value={returnRemarkText}
              onChange={e => setReturnRemarkText(e.target.value)}
              placeholder="请输入具体退运原因"
            />
          </div>
        )}
        <div style={{ padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 4 }}>
          确认后将自动创建退运单，您可以稍后在「退运处理」中补充退运快递信息和地址。
        </div>
      </Modal>
    </div>
  );
};
