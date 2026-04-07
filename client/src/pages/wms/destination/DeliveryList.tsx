import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Form, Input, message, Modal, Row, Select, Space, Table, Tag, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  buildDeliveryTaskRows,
  convertDeliveryTaskToPickup,
  DELIVERY_FAILURE_REASONS,
  markDeliveryTaskCompleted,
  markDeliveryTaskFailed,
  PICKUP_STATION_OPTIONS,
  type BusinessMode,
  type DeliveryMethod,
  type DeliveryTaskRow,
  type DeliveryTaskStatus,
  type DpnStatus,
  type PaymentStatus,
} from './podUiMockStore';
import {
  ListPageToolbar,
  ListPageToolbarActions,
  ListPageToolbarCard,
  ListPageToolbarField,
  ListPageToolbarFilters,
} from '../../../components/ListPageToolbar';

const { TextArea } = Input;

const DELIVERY_METHOD_OPTIONS: Array<{ value: DeliveryMethod | 'ALL'; label: string }> = [
  { value: 'ALL', label: '选择服务类型' },
  { value: 'DELIVERY', label: '送货上门' },
  { value: 'SELF_PICKUP', label: '自提' },
  { value: 'SATELLITE_STATION', label: '卫星站点' },
];

const PAYMENT_STATUS_OPTIONS: Array<{ value: PaymentStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '选择支付状态' },
  { value: 'UNPAID', label: '未付' },
  { value: 'PARTIAL', label: '部分付款' },
  { value: 'PAID', label: '已付' },
];

const TASK_STATUS_OPTIONS: Array<{ value: DeliveryTaskStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '选择物流状态' },
  { value: 'PENDING', label: '待接单' },
  { value: 'ACCEPTED', label: '已接单' },
  { value: 'IN_TRANSIT', label: '配送中' },
  { value: 'DELIVERED', label: '已送达' },
  { value: 'SIGNED', label: '已签收' },
  { value: 'FAILED', label: '配送失败' },
  { value: 'CANCELLED', label: '已取消' },
];

const ACTIVE_TASK_STATUSES: DeliveryTaskStatus[] = ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED'];

const taskStatusMap: Record<DeliveryTaskStatus, { label: string; color: string }> = {
  PENDING: { label: '待接单', color: '#fa8c16' },
  ACCEPTED: { label: '已接单', color: '#1677ff' },
  IN_TRANSIT: { label: '配送中', color: '#13a8a8' },
  DELIVERED: { label: '已送达', color: '#52c41a' },
  SIGNED: { label: '已签收', color: '#595959' },
  FAILED: { label: '配送失败', color: '#ff4d4f' },
  CANCELLED: { label: '已取消', color: '#8c8c8c' },
};

const dpnStatusMap: Record<DpnStatus, string> = {
  DRAFT: '草稿',
  PENDING_ASSIGN: '待派单',
  ASSIGNED: '已派单',
  IN_TRANSIT: '运输中',
  DELIVERED: '已送达',
  SIGNED: '已签收',
  CANCELLED: '已取消',
};

const deliveryMethodMap: Record<DeliveryMethod, string> = {
  DELIVERY: '送货上门',
  SELF_PICKUP: '自提',
  SATELLITE_STATION: '卫星站点',
};

const paymentStatusMap: Record<PaymentStatus, string> = {
  UNPAID: '未付',
  PARTIAL: '部分付款',
  PAID: '已付',
};

const formatTime = (value?: string | null) => (value ? dayjs(value).format('YYYY/MM/DD HH:mm:ss') : '-');

export const DeliveryList: React.FC<{ warehouseId?: string; businessMode?: BusinessMode }> = ({
  warehouseId,
  businessMode = 'ALL',
}) => {
  const { token } = theme.useToken();
  const [messageApi, contextHolder] = message.useMessage();

  const [rows, setRows] = useState<DeliveryTaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState<DeliveryMethod | 'ALL'>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [taskStatusFilter, setTaskStatusFilter] = useState<DeliveryTaskStatus | 'ALL'>('ALL');
  const [keyword, setKeyword] = useState('');
  const [failModalVisible, setFailModalVisible] = useState(false);
  const [pickupModalVisible, setPickupModalVisible] = useState(false);
  const [activeRow, setActiveRow] = useState<DeliveryTaskRow | null>(null);
  const [failForm] = Form.useForm();
  const [pickupForm] = Form.useForm();

  const lineFilter = businessMode === 'SEA' || businessMode === 'AIR' ? businessMode : undefined;

  const refreshRows = useCallback(() => {
    const mapped = buildDeliveryTaskRows([], {
      warehouseId,
      businessLine: lineFilter,
      deliveryMethod: deliveryMethodFilter,
      paymentStatus: paymentStatusFilter,
      taskStatus: taskStatusFilter,
      keyword,
    });
    setRows(mapped);
    setTotal(mapped.length);
  }, [deliveryMethodFilter, keyword, lineFilter, paymentStatusFilter, taskStatusFilter, warehouseId]);

  useEffect(() => {
    refreshRows();
  }, [refreshRows]);

  useEffect(() => {
    setPage(1);
  }, [deliveryMethodFilter, paymentStatusFilter, taskStatusFilter, keyword, businessMode]);

  const handleSign = (row: DeliveryTaskRow) => {
    Modal.confirm({
      title: `确认完成配送 ${row.taskNo} ?`,
      content: `完成后 DPN ${row.dpnNo} 会更新为 SIGNED。`,
      onOk: () => {
        markDeliveryTaskCompleted(row);
        messageApi.success(`任务 ${row.taskNo} 已完成配送`);
        refreshRows();
      },
    });
  };

  const openFailModal = (row: DeliveryTaskRow) => {
    setActiveRow(row);
    failForm.setFieldsValue({
      reasonCode: row.failureReasonCode,
      remark: row.failureRemark,
    });
    setFailModalVisible(true);
  };

  const openPickupModal = (row: DeliveryTaskRow) => {
    setActiveRow(row);
    pickupForm.setFieldsValue({
      pickupStation: PICKUP_STATION_OPTIONS[0],
      remark: `客户 ${row.recipientName} 改为站点自提`,
    });
    setPickupModalVisible(true);
  };

  const handleFailSubmit = async () => {
    if (!activeRow) return;
    const values = await failForm.validateFields();
    const reason = DELIVERY_FAILURE_REASONS.find((item) => item.value === values.reasonCode);
    if (!reason) return;

    markDeliveryTaskFailed(activeRow, reason, values.remark);
    messageApi.success(`任务 ${activeRow.taskNo} 已标记为配送失败`);
    setFailModalVisible(false);
    failForm.resetFields();
    setActiveRow(null);
    refreshRows();
  };

  const handleConvertPickupSubmit = async () => {
    if (!activeRow) return;
    const values = await pickupForm.validateFields();
    convertDeliveryTaskToPickup(activeRow, values.pickupStation, values.remark);
    messageApi.success(`任务 ${activeRow.taskNo} 已转入自提列表`);
    setPickupModalVisible(false);
    pickupForm.resetFields();
    setActiveRow(null);
    refreshRows();
  };

  const stats = useMemo(() => ({
    total,
    active: rows.filter((row) => ACTIVE_TASK_STATUSES.includes(row.taskStatus)).length,
    failed: rows.filter((row) => row.taskStatus === 'FAILED').length,
    signed: rows.filter((row) => row.taskStatus === 'SIGNED').length,
  }), [rows, total]);

  const pagedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, rows],
  );

  const columns: ColumnsType<DeliveryTaskRow> = [
    {
      title: '序号',
      key: 'index',
      width: 72,
      align: 'center',
      render: (_value, _row, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: '运单编号',
      key: 'waybillNo',
      width: 220,
      render: (_value, row) => (
        <div>
          <div style={{ fontWeight: 700, color: '#333' }}>{row.waybillNo}</div>
          <div style={{ marginTop: 4, color: token.colorTextSecondary, fontSize: 12 }}>{row.masterWaybillNo}</div>
        </div>
      ),
    },
    {
      title: 'DPN',
      dataIndex: 'dpnNo',
      key: 'dpnNo',
      width: 190,
      render: (value: string, row) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600, color: token.colorText }}>{value || '-'}</span>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{row.taskNo}</span>
        </Space>
      ),
    },
    {
      title: '服务类型',
      key: 'serviceType',
      width: 132,
      render: (_value, row) => (
        <Space direction="vertical" size={2}>
          <span>{deliveryMethodMap[row.deliveryMethod]}</span>
          <Tag color={row.businessLine === 'SEA' ? 'blue' : 'purple'} style={{ marginInlineEnd: 0, width: 'fit-content' }}>
            {row.businessLine === 'SEA' ? '海运' : '空运'}
          </Tag>
        </Space>
      ),
    },
    {
      title: '发货人',
      key: 'sender',
      width: 150,
      render: (_value, row) => (
        <div>
          <div>{row.customerName}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: token.colorTextSecondary }}>{row.warehouseName}</div>
        </div>
      ),
    },
    {
      title: '收货人',
      dataIndex: 'recipientName',
      key: 'recipientName',
      width: 130,
    },
    {
      title: '电话',
      dataIndex: 'recipientPhone',
      key: 'recipientPhone',
      width: 150,
    },
    {
      title: '详细地址',
      dataIndex: 'recipientAddress',
      key: 'recipientAddress',
      width: 360,
      render: (value: string) => (
        <div style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>
          {value || '-'}
        </div>
      ),
    },
    {
      title: '区/城市',
      key: 'city',
      width: 150,
      render: (_value, row) => `${row.cityName || '-'}${row.countryName && row.countryName !== '-' ? `, ${row.countryName}` : ''}`,
    },
    {
      title: '重量kg',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      width: 100,
      align: 'right',
      render: (value: number) => value.toFixed(1),
    },
    {
      title: '件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 90,
      align: 'right',
    },
    {
      title: '支付方式/状态',
      key: 'payment',
      width: 180,
      render: (_value, row) => (
        <Space direction="vertical" size={2}>
          <Tag
            color={row.paymentStatus === 'PAID' ? 'success' : row.paymentStatus === 'PARTIAL' ? 'processing' : 'warning'}
            style={{ marginInlineEnd: 0, width: 'fit-content' }}
          >
            {paymentStatusMap[row.paymentStatus]}
          </Tag>
          <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
            {row.totalReceivableAmount.toFixed(2)} {row.currencyCode}
          </span>
        </Space>
      ),
    },
    {
      title: '物流状态',
      key: 'logisticsStatus',
      width: 190,
      render: (_value, row) => (
        <Space direction="vertical" size={2}>
          <Tag color={
            row.taskStatus === 'SIGNED' ? 'success'
              : row.taskStatus === 'FAILED' ? 'error'
                : row.taskStatus === 'DELIVERED' ? 'cyan'
                  : row.taskStatus === 'PENDING' ? 'default'
                    : 'processing'
          } style={{ marginInlineEnd: 0, width: 'fit-content' }}>
            {taskStatusMap[row.taskStatus].label}
          </Tag>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{dpnStatusMap[row.dpnStatus]}</span>
          {row.taskStatus === 'FAILED' && row.failureReasonLabel ? (
            <span style={{ fontSize: 12, color: token.colorError }}>
              {row.failureReasonLabel}
              {row.failureRemark ? ` / ${row.failureRemark}` : ''}
            </span>
          ) : null}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_value, row) => {
        const canOperate = ACTIVE_TASK_STATUSES.includes(row.taskStatus)
          && row.dpnStatus !== 'SIGNED'
          && row.dpnStatus !== 'CANCELLED'
          && row.deliveryMethod === 'DELIVERY';
        if (!canOperate) {
          return <span style={{ color: token.colorTextSecondary }}>-</span>;
        }
        return (
          <Space direction="vertical" size={2}>
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleSign(row)} style={{ paddingInline: 0 }}>
              配送完成
            </Button>
            <Button type="link" size="small" icon={<CloseCircleOutlined />} danger onClick={() => openFailModal(row)} style={{ paddingInline: 0 }}>
              配送失败
            </Button>
            <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => openPickupModal(row)} style={{ paddingInline: 0 }}>
              转为自提
            </Button>
          </Space>
        );
      },
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 172,
      render: (value: string) => formatTime(value),
    },
  ];

  return (
    <div>
      {contextHolder}

      <Space size={[8, 8]} wrap style={{ marginBottom: 10 }}>
        <Tag color="blue">配送单总数 {stats.total}</Tag>
        <Tag color="processing">执行中 {stats.active}</Tag>
        <Tag color="success">已签收 {stats.signed}</Tag>
        <Tag color="error">失败 {stats.failed}</Tag>
      </Space>

      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField minWidth={160}>
              <Select
                style={{ width: '100%' }}
                value={deliveryMethodFilter}
                onChange={(value) => setDeliveryMethodFilter(value)}
                options={DELIVERY_METHOD_OPTIONS}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={160}>
              <Select
                style={{ width: '100%' }}
                value={paymentStatusFilter}
                onChange={(value) => setPaymentStatusFilter(value)}
                options={PAYMENT_STATUS_OPTIONS}
              />
            </ListPageToolbarField>
            <ListPageToolbarField minWidth={160}>
              <Select
                style={{ width: '100%' }}
                value={taskStatusFilter}
                onChange={(value) => setTaskStatusFilter(value)}
                options={TASK_STATUS_OPTIONS}
              />
            </ListPageToolbarField>
            <ListPageToolbarField flex="1 1 320px" minWidth={260}>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                allowClear
                prefix={<SearchOutlined />}
                placeholder="任务号/DPN号/收件人/电话/客户/地址"
              />
            </ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                setKeyword((value) => value.trim());
                setPage(1);
              }}
            >
              查询
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setPage(1);
                refreshRows();
              }}
            >
              刷新
            </Button>
            <Button
              onClick={() => {
                setDeliveryMethodFilter('ALL');
                setPaymentStatusFilter('ALL');
                setTaskStatusFilter('ALL');
                setKeyword('');
                setPage(1);
              }}
            >
              重置
            </Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      <Table<DeliveryTaskRow>
        rowKey="id"
        columns={columns}
        dataSource={pagedRows}
        size="small"
        scroll={{ x: 2280 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条记录`,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
          },
        }}
      />

      <Modal
        title={activeRow ? `配送失败 - ${activeRow.taskNo}` : '配送失败'}
        open={failModalVisible}
        onCancel={() => {
          setFailModalVisible(false);
          setActiveRow(null);
          failForm.resetFields();
        }}
        onOk={() => void handleFailSubmit()}
        okText="确认失败"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form layout="vertical" form={failForm}>
          <Form.Item
            name="reasonCode"
            label="失败原因"
            rules={[{ required: true, message: '请选择配送失败原因' }]}
          >
            <Select
              placeholder="请选择常见物流失败原因"
              options={DELIVERY_FAILURE_REASONS.map((item) => ({ value: item.value, label: item.label }))}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={4} placeholder="可补充司机反馈、联系结果、现场情况等" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={activeRow ? `转为自提 - ${activeRow.taskNo}` : '转为自提'}
        open={pickupModalVisible}
        onCancel={() => {
          setPickupModalVisible(false);
          setActiveRow(null);
          pickupForm.resetFields();
        }}
        onOk={() => void handleConvertPickupSubmit()}
        okText="确认转为自提"
        destroyOnClose
      >
        <Form layout="vertical" form={pickupForm}>
          <Form.Item
            name="pickupStation"
            label="自提站点"
            rules={[{ required: true, message: '请选择自提站点' }]}
          >
            <Select options={PICKUP_STATION_OPTIONS.map((item) => ({ value: item, label: item }))} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={4} placeholder="例如：客户电话确认改为站点自提" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
