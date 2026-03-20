import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { v2PodApi } from '../../../api';

type BusinessMode = 'ALL' | 'SEA' | 'AIR';
type DpnStatus = 'DRAFT' | 'PENDING_ASSIGN' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'CANCELLED';
type DeliveryTaskStatus = 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'FAILED' | 'CANCELLED';

interface DeliveryTaskRow {
  id: string;
  taskNo: string;
  taskStatus: DeliveryTaskStatus;
  dpnId: string;
  dpnNo: string;
  dpnStatus: DpnStatus;
  businessLine: 'SEA' | 'AIR';
  warehouseName: string;
  recipientName: string;
  recipientPhone: string;
  driverName: string;
  driverPhone: string;
  totalPieces: number;
  totalWeightKg: number;
  acceptedAt: string;
  signedAt: string;
  updatedAt: string;
}

const DPN_STATUS_OPTIONS: Array<{ value: DpnStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '全部DPN状态' },
  { value: 'PENDING_ASSIGN', label: '待派单' },
  { value: 'ASSIGNED', label: '已派单' },
  { value: 'IN_TRANSIT', label: '配送中/失败待回仓' },
  { value: 'SIGNED', label: '已签收' },
  { value: 'CANCELLED', label: '已取消' },
];

const TASK_STATUS_OPTIONS: Array<{ value: DeliveryTaskStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '全部任务状态' },
  { value: 'ACCEPTED', label: '已接单' },
  { value: 'IN_TRANSIT', label: '配送中' },
  { value: 'DELIVERED', label: '已送达' },
  { value: 'SIGNED', label: '已签收' },
  { value: 'FAILED', label: '配送失败' },
  { value: 'CANCELLED', label: '已取消' },
];

const DPN_STATUS_MAP: Record<DpnStatus, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING_ASSIGN: { label: '待派单', color: 'orange' },
  ASSIGNED: { label: '已派单', color: 'processing' },
  IN_TRANSIT: { label: '配送中/异常待回仓', color: 'warning' },
  DELIVERED: { label: '已送达', color: 'cyan' },
  SIGNED: { label: '已签收', color: 'success' },
  CANCELLED: { label: '已取消', color: 'default' },
};

const TASK_STATUS_MAP: Record<DeliveryTaskStatus, { label: string; color: string }> = {
  PENDING: { label: '待接单', color: 'default' },
  ACCEPTED: { label: '已接单', color: 'processing' },
  IN_TRANSIT: { label: '配送中', color: 'processing' },
  DELIVERED: { label: '已送达', color: 'cyan' },
  SIGNED: { label: '已签收', color: 'success' },
  FAILED: { label: '配送失败', color: 'error' },
  CANCELLED: { label: '已取消', color: 'default' },
};

const ACTIVE_TASK_STATUSES: DeliveryTaskStatus[] = ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED'];

const formatTime = (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-');

const mapTaskRow = (raw: any): DeliveryTaskRow => ({
  id: String(raw.id),
  taskNo: String(raw.task_no || raw.taskNo || raw.id),
  taskStatus: String(raw.task_status || raw.taskStatus || 'PENDING') as DeliveryTaskStatus,
  dpnId: String(raw.dpn_id || raw.dpnId || ''),
  dpnNo: String(raw.dpn_no || raw.dpnNo || '-'),
  dpnStatus: String(raw.dpn_status || raw.dpnStatus || 'PENDING_ASSIGN') as DpnStatus,
  businessLine: (String(raw.business_line || raw.businessLine || 'SEA').toUpperCase() === 'AIR' ? 'AIR' : 'SEA'),
  warehouseName: String(raw.warehouse_name || raw.warehouseName || '-'),
  recipientName: String(raw.recipient_name || raw.recipientName || '-'),
  recipientPhone: String(raw.recipient_phone || raw.recipientPhone || '-'),
  driverName: String(raw.driver_name || raw.driverName || '-'),
  driverPhone: String(raw.driver_phone || raw.driverPhone || '-'),
  totalPieces: Number(raw.total_pieces || raw.totalPieces || 0),
  totalWeightKg: Number(raw.total_weight_kg || raw.totalWeightKg || 0),
  acceptedAt: String(raw.accepted_at || raw.acceptedAt || ''),
  signedAt: String(raw.signed_at || raw.signedAt || ''),
  updatedAt: String(raw.updated_at || raw.updatedAt || ''),
});

export const DeliveryList: React.FC<{ warehouseId?: string; businessMode?: BusinessMode }> = ({
  warehouseId,
  businessMode = 'ALL',
}) => {
  const { token } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DeliveryTaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [taskStatusFilter, setTaskStatusFilter] = useState<DeliveryTaskStatus | 'ALL'>('ALL');
  const [dpnStatusFilter, setDpnStatusFilter] = useState<DpnStatus | 'ALL'>('ALL');
  const [keyword, setKeyword] = useState('');

  const lineFilter = businessMode === 'SEA' || businessMode === 'AIR' ? businessMode : undefined;

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize };
      if (warehouseId) params.warehouseId = warehouseId;
      if (lineFilter) params.businessLine = lineFilter;
      if (taskStatusFilter !== 'ALL') params.taskStatus = taskStatusFilter;
      if (dpnStatusFilter !== 'ALL') params.dpnStatus = dpnStatusFilter;
      if (keyword.trim()) params.keyword = keyword.trim();

      const res: any = await v2PodApi.listDeliveryTasks(params);
      const list = Array.isArray(res?.data) ? res.data : [];
      const mapped = list.map(mapTaskRow);
      setRows(mapped);
      setTotal(Number(res?.pagination?.total || mapped.length));
    } catch (err: any) {
      messageApi.error(err?.message || '加载配送任务失败');
    } finally {
      setLoading(false);
    }
  }, [dpnStatusFilter, keyword, lineFilter, messageApi, page, pageSize, taskStatusFilter, warehouseId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const handleSign = (row: DeliveryTaskRow) => {
    Modal.confirm({
      title: `确认签收任务 ${row.taskNo} ?`,
      content: `签收后 DPN ${row.dpnNo} 会更新为 SIGNED。`,
      onOk: async () => {
        await v2PodApi.signDeliveryTask(row.id, {
          signProof: {
            by: 'web-user',
            from: 'DeliveryList',
            at: new Date().toISOString(),
          },
        });
        messageApi.success(`任务 ${row.taskNo} 已签收`);
        await fetchTasks();
      },
    });
  };

  const handleFail = (row: DeliveryTaskRow) => {
    Modal.confirm({
      title: `确认标记失败 ${row.taskNo} ?`,
      content: '失败后需要去 DPN 管理执行回仓，才能新建 DPN 重派。',
      okButtonProps: { danger: true },
      okText: '确认失败',
      onOk: async () => {
        await v2PodApi.failDeliveryTask(row.id, { reason: 'DELIVERY_FAILED_BY_WEB' });
        messageApi.success(`任务 ${row.taskNo} 已标记失败`);
        await fetchTasks();
      },
    });
  };

  const stats = useMemo(() => ({
    total,
    active: rows.filter((r) => ACTIVE_TASK_STATUSES.includes(r.taskStatus)).length,
    failed: rows.filter((r) => r.taskStatus === 'FAILED').length,
    signed: rows.filter((r) => r.taskStatus === 'SIGNED').length,
  }), [rows, total]);

  const columns: ColumnsType<DeliveryTaskRow> = [
    {
      title: '任务号',
      key: 'taskNo',
      width: 170,
      render: (_, row) => (
        <div>
          <div style={{ color: token.colorPrimary, fontWeight: 600 }}>{row.taskNo}</div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{formatTime(row.updatedAt)}</div>
        </div>
      ),
    },
    {
      title: '业务线',
      dataIndex: 'businessLine',
      key: 'businessLine',
      width: 90,
      render: (value) => <Tag color={value === 'SEA' ? 'blue' : 'purple'}>{value === 'SEA' ? '海运' : '空运'}</Tag>,
    },
    {
      title: 'DPN号',
      dataIndex: 'dpnNo',
      key: 'dpnNo',
      width: 170,
    },
    {
      title: '收件人',
      key: 'recipient',
      width: 220,
      render: (_, row) => (
        <div>
          <div>{row.recipientName}</div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{row.recipientPhone}</div>
        </div>
      ),
    },
    {
      title: '司机',
      key: 'driver',
      width: 180,
      render: (_, row) => (
        <div>
          <div>{row.driverName}</div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{row.driverPhone}</div>
        </div>
      ),
    },
    {
      title: '件数/重量',
      key: 'piecesWeight',
      width: 130,
      render: (_, row) => `${row.totalPieces} / ${row.totalWeightKg.toFixed(2)}kg`,
    },
    {
      title: '任务状态',
      key: 'taskStatus',
      width: 120,
      render: (_, row) => {
        const cfg = TASK_STATUS_MAP[row.taskStatus] || { label: row.taskStatus, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'DPN状态',
      key: 'dpnStatus',
      width: 140,
      render: (_, row) => {
        const cfg = DPN_STATUS_MAP[row.dpnStatus] || { label: row.dpnStatus, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '接单/签收时间',
      key: 'times',
      width: 220,
      render: (_, row) => (
        <div>
          <div style={{ fontSize: 12 }}>接单: {formatTime(row.acceptedAt)}</div>
          <div style={{ fontSize: 12 }}>签收: {formatTime(row.signedAt)}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      fixed: 'right',
      render: (_, row) => {
        const canOperate = ACTIVE_TASK_STATUSES.includes(row.taskStatus) && row.dpnStatus !== 'SIGNED' && row.dpnStatus !== 'CANCELLED';
        return (
          <Space size={[4, 0]} wrap>
            {canOperate && (
              <Button type="link" size="small" icon={<CloseCircleOutlined />} danger onClick={() => handleFail(row)}>
                失败
              </Button>
            )}
            {canOperate && (
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleSign(row)}>
                签收
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {contextHolder}
      <Space size={[8, 8]} wrap style={{ marginBottom: 10 }}>
        <Tag color="blue">总任务 {stats.total}</Tag>
        <Tag color="processing">执行中 {stats.active}</Tag>
        <Tag color="error">失败 {stats.failed}</Tag>
        <Tag color="success">签收 {stats.signed}</Tag>
      </Space>

      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Row gutter={[8, 8]} align="middle">
          <Col>
            <Select
              style={{ width: 150 }}
              value={taskStatusFilter}
              onChange={setTaskStatusFilter}
              options={TASK_STATUS_OPTIONS}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 180 }}
              value={dpnStatusFilter}
              onChange={setDpnStatusFilter}
              options={DPN_STATUS_OPTIONS}
            />
          </Col>
          <Col flex="auto">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              prefix={<SearchOutlined />}
              placeholder="任务号/DPN号/收件人/电话/司机/子单号"
            />
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); void fetchTasks(); }}>
                刷新
              </Button>
              <Button
                onClick={() => {
                  setTaskStatusFilter('ALL');
                  setDpnStatusFilter('ALL');
                  setKeyword('');
                  setPage(1);
                }}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table<DeliveryTaskRow>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        size="small"
        scroll={{ x: 1700 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (v) => `共 ${v} 条记录`,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
          },
        }}
      />
    </div>
  );
};
