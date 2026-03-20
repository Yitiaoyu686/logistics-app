import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Form,
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
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { v2OmsApi, v2PodApi, warehouseManagementApi } from '../../../api';

type BusinessMode = 'ALL' | 'SEA' | 'AIR';

type DpnStatus = 'DRAFT' | 'PENDING_ASSIGN' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'CANCELLED';
type DeliveryTaskStatus = 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED' | 'FAILED' | 'CANCELLED';
type LogisticsFilter = 'ALL' | 'INBOUND' | 'TRANSIT' | 'SIGNED' | 'CANCELLED';
type ExecutionFilter = 'ALL' | 'PENDING' | 'EXECUTING' | 'DONE' | 'CANCELLED';

interface DpnListRow {
  id: string;
  dpnNo: string;
  businessLine: 'SEA' | 'AIR';
  customerId: string;
  warehouseName: string;
  recipientName: string;
  recipientPhone: string;
  totalPieces: number;
  totalWeightKg: number;
  itemCount: number;
  subOrderCount: number;
  dpnStatus: DpnStatus;
  latestTaskNo: string;
  latestTaskStatus: DeliveryTaskStatus | '';
  updatedAt: string;
  createdAt: string;
  jobNos: string[];
  orderNos: string[];
  routeNames: string[];
}

interface DpnDetailData {
  dpn: any;
  items: any[];
  deliveryTasks: any[];
}

interface DpnCandidateRow {
  subOrderId: string;
  subOrderNo: string;
  orderId: string;
  orderNo: string;
  displayOrderNo: string;
  customerId: string;
  customerName: string;
  businessLine: 'SEA' | 'AIR';
  subStatus: string;
  pieces: number;
  weightKg: number;
  updatedAt: string;
}

interface OptionItem {
  value: string;
  label: string;
}

interface BindTarget {
  id: string;
  dpnNo: string;
  businessLine: 'SEA' | 'AIR';
  customerId: string;
}

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

const LOGISTICS_FILTER_OPTIONS: Array<{ value: LogisticsFilter; label: string }> = [
  { value: 'ALL', label: '选择物流状态' },
  { value: 'INBOUND', label: '已入库' },
  { value: 'TRANSIT', label: '配送中' },
  { value: 'SIGNED', label: '已签收' },
  { value: 'CANCELLED', label: '已取消' },
];

const EXECUTION_FILTER_OPTIONS: Array<{ value: ExecutionFilter; label: string }> = [
  { value: 'ALL', label: '选择执行状态' },
  { value: 'PENDING', label: '待执行' },
  { value: 'EXECUTING', label: '执行中' },
  { value: 'DONE', label: '已执行' },
  { value: 'CANCELLED', label: '已取消' },
];

const ACTIVE_TASK_STATUSES: DeliveryTaskStatus[] = ['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED'];

const formatTime = (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-');

const splitCsv = (value: unknown): string[] => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const mapDpnListRow = (raw: any): DpnListRow => ({
  id: String(raw.id),
  dpnNo: String(raw.dpn_no || raw.dpnNo || raw.id),
  businessLine: (String(raw.business_line || raw.businessLine || 'SEA').toUpperCase() === 'AIR' ? 'AIR' : 'SEA'),
  customerId: String(raw.customer_id || raw.customerId || ''),
  warehouseName: String(raw.warehouse_name || raw.warehouseName || '-'),
  recipientName: String(raw.recipient_name || raw.recipientName || '-'),
  recipientPhone: String(raw.recipient_phone || raw.recipientPhone || '-'),
  totalPieces: Number(raw.total_pieces || raw.totalPieces || 0),
  totalWeightKg: Number(raw.total_weight_kg || raw.totalWeightKg || 0),
  itemCount: Number(raw.item_count || raw.itemCount || 0),
  subOrderCount: Number(raw.sub_order_count || raw.subOrderCount || 0),
  dpnStatus: String(raw.dpn_status || raw.dpnStatus || 'PENDING_ASSIGN') as DpnStatus,
  latestTaskNo: String(raw.latest_task_no || raw.latestTaskNo || '-'),
  latestTaskStatus: String(raw.latest_task_status || raw.latestTaskStatus || '') as DeliveryTaskStatus | '',
  updatedAt: String(raw.updated_at || raw.updatedAt || ''),
  createdAt: String(raw.created_at || raw.createdAt || ''),
  jobNos: splitCsv(raw.job_nos || raw.jobNos),
  orderNos: splitCsv(raw.order_nos || raw.orderNos),
  routeNames: splitCsv(raw.route_names || raw.routeNames),
});

const buildLogisticsStatusText = (row: DpnListRow): string => {
  const routeTail = row.routeNames[0]?.split('-').slice(-1)[0] || row.warehouseName || '';
  if (row.dpnStatus === 'SIGNED') return `已签收${routeTail ? ` ${routeTail}` : ''}`;
  if (row.dpnStatus === 'ASSIGNED' || row.dpnStatus === 'IN_TRANSIT') return `配送中${routeTail ? ` ${routeTail}` : ''}`;
  if (row.dpnStatus === 'CANCELLED') return `已取消${routeTail ? ` ${routeTail}` : ''}`;
  return `已入库${routeTail ? ` ${routeTail}` : ''}`;
};

const buildExecutionStatusText = (row: DpnListRow): string => {
  const routeTail = row.routeNames[0]?.split('-').slice(-1)[0] || row.warehouseName || '';
  if (row.dpnStatus === 'SIGNED') return `已执行${routeTail ? ` ${routeTail}` : ''}`;
  if (row.dpnStatus === 'ASSIGNED' || row.dpnStatus === 'IN_TRANSIT') return `执行中${routeTail ? ` ${routeTail}` : ''}`;
  if (row.dpnStatus === 'CANCELLED') return `已取消${routeTail ? ` ${routeTail}` : ''}`;
  return `待执行${routeTail ? ` ${routeTail}` : ''}`;
};

const mapCandidateRow = (raw: any): DpnCandidateRow => ({
  subOrderId: String(raw.sub_order_id || raw.subOrderId || raw.id || ''),
  subOrderNo: String(raw.sub_order_no || raw.subOrderNo || '-'),
  orderId: String(raw.order_id || raw.orderId || ''),
  orderNo: String(raw.order_no || raw.orderNo || '-'),
  displayOrderNo: String(raw.display_order_no || raw.displayOrderNo || ''),
  customerId: String(raw.customer_id || raw.customerId || ''),
  customerName: String(raw.customer_name || raw.customerName || '-'),
  businessLine: String(raw.business_line || raw.businessLine || 'SEA').toUpperCase() === 'AIR' ? 'AIR' : 'SEA',
  subStatus: String(raw.sub_status || raw.subStatus || '-'),
  pieces: Number(raw.pieces || 0),
  weightKg: Number(raw.actual_weight_kg || raw.weight_kg || raw.weightKg || 0),
  updatedAt: String(raw.updated_at || raw.updatedAt || ''),
});

const BUSINESS_LINE_OPTIONS: OptionItem[] = [
  { value: 'SEA', label: '海运' },
  { value: 'AIR', label: '空运' },
];

interface DPNManageListProps {
  businessMode?: BusinessMode;
}

export const DPNManageList: React.FC<DPNManageListProps> = ({ businessMode = 'ALL' }) => {
  const { token } = theme.useToken();
  const [messageApi, messageContext] = message.useMessage();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DpnListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [routeFilter, setRouteFilter] = useState('ALL');
  const [logisticsFilter, setLogisticsFilter] = useState<LogisticsFilter>('ALL');
  const [executionFilter, setExecutionFilter] = useState<ExecutionFilter>('ALL');
  const [keyword, setKeyword] = useState('');

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignTarget, setAssignTarget] = useState<DpnListRow | null>(null);
  const [assignForm] = Form.useForm();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<DpnDetailData | null>(null);

  const lineFilter = businessMode === 'SEA' || businessMode === 'AIR' ? businessMode : undefined;

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createLine, setCreateLine] = useState<'SEA' | 'AIR'>(lineFilter || 'SEA');
  const [customerOptions, setCustomerOptions] = useState<OptionItem[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<OptionItem[]>([]);
  const [createForm] = Form.useForm();

  const [bindOpen, setBindOpen] = useState(false);
  const [bindSubmitting, setBindSubmitting] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [bindTarget, setBindTarget] = useState<BindTarget | null>(null);
  const [bindKeyword, setBindKeyword] = useState('');
  const [bindRows, setBindRows] = useState<DpnCandidateRow[]>([]);
  const [bindTotal, setBindTotal] = useState(0);
  const [bindPage, setBindPage] = useState(1);
  const [bindPageSize, setBindPageSize] = useState(8);
  const [bindSelectedKeys, setBindSelectedKeys] = useState<React.Key[]>([]);
  const [bindSelectedMap, setBindSelectedMap] = useState<Record<string, DpnCandidateRow>>({});

  const fetchDpns = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        pageSize,
      };
      if (lineFilter) params.businessLine = lineFilter;
      if (routeFilter !== 'ALL') params.route = routeFilter;
      if (logisticsFilter !== 'ALL') params.logisticsStatus = logisticsFilter;
      if (executionFilter !== 'ALL') params.executionStatus = executionFilter;
      if (keyword.trim()) params.keyword = keyword.trim();

      const res: any = await v2PodApi.listDpns(params);
      const dataRows = Array.isArray(res?.data) ? res.data : [];
      const nextRows = dataRows.map(mapDpnListRow);
      setRows(nextRows);
      setTotal(Number(res?.pagination?.total || nextRows.length));
    } catch (err: any) {
      messageApi.error(err?.message || '加载 DPN 列表失败');
    } finally {
      setLoading(false);
    }
  }, [executionFilter, keyword, lineFilter, logisticsFilter, messageApi, page, pageSize, routeFilter]);

  useEffect(() => {
    void fetchDpns();
  }, [fetchDpns]);

  const selectedBindCandidates = useMemo(
    () => bindSelectedKeys
      .map((key) => bindSelectedMap[String(key)])
      .filter((item): item is DpnCandidateRow => Boolean(item)),
    [bindSelectedKeys, bindSelectedMap],
  );

  const bindSummary = useMemo(() => ({
    count: selectedBindCandidates.length,
    pieces: selectedBindCandidates.reduce((sum, row) => sum + Number(row.pieces || 0), 0),
    weightKg: selectedBindCandidates.reduce((sum, row) => sum + Number(row.weightKg || 0), 0),
  }), [selectedBindCandidates]);

  const fetchCreateBaseOptions = useCallback(async () => {
    try {
      const [customerRes, warehouseRes] = await Promise.all([
        v2OmsApi.listCustomers({ page: 1, pageSize: 500 }),
        warehouseManagementApi.list({ type: 'DESTINATION', status: 'ACTIVE' }),
      ]) as any[];

      const customerRows = Array.isArray(customerRes?.data)
        ? customerRes.data
        : (Array.isArray(customerRes) ? customerRes : []);
      const warehouseRows = Array.isArray(warehouseRes?.data)
        ? warehouseRes.data
        : (Array.isArray(warehouseRes) ? warehouseRes : []);

      setCustomerOptions(
        customerRows.map((row: any) => ({
          value: String(row.id),
          label: `${row.customer_code ? `${row.customer_code} / ` : ''}${row.customer_name || row.id}`,
        })),
      );
      setWarehouseOptions(
        warehouseRows.map((row: any) => ({
          value: String(row.id),
          label: `${row.name || row.id}${row.country ? ` (${row.country})` : ''}`,
        })),
      );
    } catch (err: any) {
      messageApi.warning(err?.message || '加载 DPN 创建基础数据失败');
    }
  }, [messageApi]);

  useEffect(() => {
    void fetchCreateBaseOptions();
  }, [fetchCreateBaseOptions]);

  useEffect(() => {
    if (!lineFilter) return;
    setCreateLine(lineFilter);
    createForm.setFieldValue('businessLine', lineFilter);
  }, [createForm, lineFilter]);

  const openBindModal = (target: BindTarget) => {
    setBindTarget(target);
    setBindOpen(true);
    setBindKeyword('');
    setBindRows([]);
    setBindTotal(0);
    setBindPage(1);
    setBindPageSize(8);
    setBindSelectedKeys([]);
    setBindSelectedMap({});
  };

  const closeBindModal = () => {
    setBindOpen(false);
    setBindTarget(null);
    setBindRows([]);
    setBindTotal(0);
    setBindSelectedKeys([]);
    setBindSelectedMap({});
    setBindKeyword('');
  };

  const fetchBindCandidates = useCallback(async () => {
    if (!bindOpen || !bindTarget) return;
    setBindLoading(true);
    try {
      const params: Record<string, any> = {
        page: bindPage,
        pageSize: bindPageSize,
        businessLine: bindTarget.businessLine,
        customerId: bindTarget.customerId,
      };
      if (bindKeyword.trim()) params.keyword = bindKeyword.trim();

      const res: any = await v2PodApi.listDpnCandidates(params);
      const dataRows = Array.isArray(res?.data) ? res.data : [];
      const nextRows = dataRows.map(mapCandidateRow);
      setBindRows(nextRows);
      setBindTotal(Number(res?.pagination?.total || nextRows.length));
    } catch (err: any) {
      messageApi.error(err?.message || '加载可绑定子单失败');
    } finally {
      setBindLoading(false);
    }
  }, [
    bindKeyword,
    bindOpen,
    bindPage,
    bindPageSize,
    bindTarget,
    messageApi,
  ]);

  useEffect(() => {
    void fetchBindCandidates();
  }, [fetchBindCandidates]);

  const handleBindSelectionChange = (nextKeys: React.Key[], nextRows: DpnCandidateRow[]) => {
    setBindSelectedKeys(nextKeys);
    setBindSelectedMap((prev) => {
      const next = { ...prev };
      bindRows.forEach((row) => {
        delete next[row.subOrderId];
      });
      nextRows.forEach((row) => {
        next[row.subOrderId] = row;
      });
      return next;
    });
  };

  const handleBindSubOrders = async () => {
    if (!bindTarget) return;
    if (selectedBindCandidates.length === 0) {
      messageApi.warning('请至少选择一个子单');
      return;
    }
    try {
      setBindSubmitting(true);
      await v2PodApi.bindSubOrders(bindTarget.id, {
        subOrderIds: selectedBindCandidates.map((row) => row.subOrderId),
      });
      messageApi.success(`已为 ${bindTarget.dpnNo} 绑定 ${selectedBindCandidates.length} 条子单`);
      closeBindModal();
      await fetchDpns();
    } catch (err: any) {
      messageApi.error(err?.message || '绑定子单失败');
    } finally {
      setBindSubmitting(false);
    }
  };

  const openCreateModal = () => {
    const initialLine = lineFilter || 'SEA';
    setCreateOpen(true);
    setCreateLine(initialLine);
    createForm.resetFields();
    createForm.setFieldsValue({
      businessLine: initialLine,
      transportMode: 'DELIVERY',
      currencyCode: 'NGN',
      totalReceivableAmount: 0,
      totalPieces: 0,
      totalWeightKg: 0,
    });
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    createForm.resetFields();
  };

  const handleCreateDpn = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const remarkParts = [
        values.remark,
        values.deliveryCompany ? `物流公司:${values.deliveryCompany}` : '',
        values.trackingNo ? `运单号/订单号:${values.trackingNo}` : '',
        values.queryPhone ? `查询电话:${values.queryPhone}` : '',
        values.driverName ? `司机名称:${values.driverName}` : '',
        values.driverPhone ? `司机电话:${values.driverPhone}` : '',
        values.plateNo ? `车牌:${values.plateNo}` : '',
        values.executeDate ? `执行日期:${dayjs(values.executeDate).format('YYYY-MM-DD')}` : '',
        values.toStation ? `发往站点:${values.toStation}` : '',
      ].filter(Boolean);

      const createRes: any = await v2PodApi.createDpnDraft({
        businessLine: values.businessLine,
        customerId: values.customerId,
        warehouseId: values.warehouseId,
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        recipientAddress: values.recipientAddress,
        deliveryMethod: values.transportMode || 'DELIVERY',
        totalPieces: Number(values.totalPieces || 0),
        totalWeightKg: Number(values.totalWeightKg || 0),
        currencyCode: values.currencyCode || 'NGN',
        totalReceivableAmount: Number(values.totalReceivableAmount || 0),
        createdBy: 'U-OPS-US-01',
        remark: remarkParts.join(' | ') || null,
      });
      const created = createRes?.data?.dpn || createRes?.dpn || createRes?.data || {};
      const createdNo = created?.dpn_no || created?.dpnNo || created?.id || '新DPN';
      const createdId = created?.id ? String(created.id) : '';
      if (!createdId) {
        throw new Error('创建结果缺少 DPN ID');
      }
      closeCreateModal();
      messageApi.success(`创建成功：${createdNo}，请继续绑定运单`);
      openBindModal({
        id: createdId,
        dpnNo: createdNo,
        businessLine: String(values.businessLine) === 'AIR' ? 'AIR' : 'SEA',
        customerId: String(values.customerId),
      });
      await fetchDpns();
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || '创建 DPN 失败');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openAssignModal = (row: DpnListRow) => {
    setAssignTarget(row);
    assignForm.setFieldsValue({
      driverName: '',
      driverPhone: '',
      driverUserId: 'U-OPS-US-01',
    });
    setAssignOpen(true);
  };

  const handleAssignTask = async () => {
    if (!assignTarget) return;
    try {
      const values = await assignForm.validateFields();
      setAssignLoading(true);
      await v2PodApi.createDeliveryTask({
        dpnId: assignTarget.id,
        driverUserId: values.driverUserId || null,
        driverName: values.driverName || null,
        driverPhone: values.driverPhone || null,
        remark: 'Web端派单',
      });
      messageApi.success(`${assignTarget.dpnNo} 派单成功`);
      setAssignOpen(false);
      setAssignTarget(null);
      assignForm.resetFields();
      await fetchDpns();
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || '派单失败');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleSign = (row: DpnListRow) => {
    const taskNo = row.latestTaskNo !== '-' ? row.latestTaskNo : '';
    if (!taskNo) {
      messageApi.warning('缺少可签收任务');
      return;
    }
    Modal.confirm({
      title: `确认签收 ${row.dpnNo} ?`,
      content: '签收后该 DPN 下子单将更新为 DELIVERED。',
      onOk: async () => {
        await v2PodApi.signDeliveryTask(taskNo, {
          signProof: {
            by: 'web-user',
            from: 'DPNManageList',
            at: new Date().toISOString(),
          },
        });
        messageApi.success(`${row.dpnNo} 已签收`);
        await fetchDpns();
      },
    });
  };

  const handleFail = (row: DpnListRow) => {
    const taskNo = row.latestTaskNo !== '-' ? row.latestTaskNo : '';
    if (!taskNo) {
      messageApi.warning('缺少可失败任务');
      return;
    }
    Modal.confirm({
      title: `确认标记失败 ${row.dpnNo} ?`,
      content: '失败后需执行回仓，再创建新 DPN 重派。',
      okButtonProps: { danger: true },
      okText: '确认失败',
      onOk: async () => {
        await v2PodApi.failDeliveryTask(taskNo, { reason: 'DELIVERY_FAILED_BY_WEB' });
        messageApi.success(`${row.dpnNo} 已标记配送失败`);
        await fetchDpns();
      },
    });
  };

  const handleReturnToWarehouse = (row: DpnListRow) => {
    Modal.confirm({
      title: `确认回仓 ${row.dpnNo} ?`,
      content: '回仓后旧 DPN 会取消，子单回到 ARRIVED，可重新创建新 DPN。',
      okButtonProps: { danger: true },
      okText: '确认回仓',
      onOk: async () => {
        await v2PodApi.returnDpnToWarehouse(row.id, { remark: 'Web端回仓重派' });
        messageApi.success(`${row.dpnNo} 已回仓并取消旧 DPN`);
        await fetchDpns();
      },
    });
  };

  const handleReDispatch = (row: DpnListRow) => {
    Modal.confirm({
      title: `确认基于 ${row.dpnNo} 重建新 DPN ?`,
      content: '将沿用原 DPN 收件信息，并使用回仓后的子单创建新 DPN。',
      okText: '确认重建',
      onOk: async () => {
        const detailRes: any = await v2PodApi.getDpnDetail(row.id);
        const detail = detailRes?.data || {};
        const dpn = detail?.dpn || {};
        const items = Array.isArray(detail?.items) ? detail.items : [];
        const subOrderIds = Array.from(
          new Set(
            items
              .map((item: any) => String(item.sub_order_id || item.subOrderId || '').trim())
              .filter(Boolean),
          ),
        );
        if (subOrderIds.length === 0) {
          messageApi.warning('该 DPN 无可重派子单');
          return;
        }

        const createRes: any = await v2PodApi.createDpn({
          businessLine: dpn.business_line || row.businessLine,
          customerId: dpn.customer_id,
          warehouseId: dpn.warehouse_id,
          subOrderIds,
          recipientName: dpn.recipient_name || row.recipientName,
          recipientPhone: dpn.recipient_phone || row.recipientPhone,
          recipientAddress: dpn.recipient_address || '待补全',
          deliveryMethod: dpn.delivery_method || 'DELIVERY',
          currencyCode: dpn.currency_code || 'NGN',
          totalReceivableAmount: Number(dpn.total_receivable_amount || 0),
          createdBy: 'U-OPS-US-01',
          remark: `由 ${row.dpnNo} 重派创建`,
        });

        const newDpn = createRes?.data?.dpn || createRes?.dpn || createRes?.data || {};
        const newDpnNo = newDpn?.dpn_no || newDpn?.dpnNo || newDpn?.id || '新DPN';
        messageApi.success(`重派创建成功：${newDpnNo}`);
        await fetchDpns();
      },
    });
  };

  const handleViewDetail = async (row: DpnListRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res: any = await v2PodApi.getDpnDetail(row.id);
      setDetailData({
        dpn: res?.data?.dpn || {},
        items: Array.isArray(res?.data?.items) ? res.data.items : [],
        deliveryTasks: Array.isArray(res?.data?.deliveryTasks) ? res.data.deliveryTasks : [],
      });
    } catch (err: any) {
      messageApi.error(err?.message || '加载 DPN 详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrint = (row: DpnListRow) => {
    messageApi.info(`${row.dpnNo} 打印功能待接入`);
  };

  const routeOptions = useMemo(() => {
    const unique = Array.from(new Set(rows.flatMap((row) => row.routeNames).filter(Boolean)));
    return [
      { value: 'ALL', label: '选择线路' },
      ...unique.map((value) => ({ value, label: value })),
    ];
  }, [rows]);

  const columns: ColumnsType<DpnListRow> = [
    {
      title: '序号',
      key: 'index',
      width: 70,
      align: 'center',
      render: (_: unknown, __: DpnListRow, index: number) => ((page - 1) * pageSize) + index + 1,
    },
    {
      title: 'DPN',
      key: 'dpn',
      width: 200,
      render: (_, row) => (
        <div>
          <a onClick={() => { void handleViewDetail(row); }} style={{ fontWeight: 700 }}>{row.dpnNo}</a>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{formatTime(row.createdAt)}</div>
        </div>
      ),
    },
    {
      title: '线路',
      key: 'route',
      width: 180,
      render: (_, row) => row.routeNames[0] || '-',
    },
    {
      title: 'JOB',
      key: 'job',
      width: 170,
      render: (_, row) => {
        if (!row.jobNos.length) return '-';
        return (
          <div>
            {row.jobNos.slice(0, 3).map((jobNo) => (
              <div key={jobNo} style={{ fontWeight: 600 }}>{jobNo}</div>
            ))}
            {row.jobNos.length > 3 && (
              <div style={{ color: token.colorTextSecondary, fontSize: 11 }}>......More</div>
            )}
          </div>
        );
      },
    },
    {
      title: '订单号',
      key: 'orders',
      width: 420,
      render: (_, row) => {
        if (!row.orderNos.length) return '-';
        const visible = row.orderNos.slice(0, 8);
        const rest = row.orderNos.length - visible.length;
        return (
          <div>
            <div style={{ lineHeight: '20px' }}>{visible.join('  ')}</div>
            {rest > 0 && (
              <div style={{ color: token.colorTextSecondary, fontSize: 11 }}>......More {rest}</div>
            )}
          </div>
        );
      },
    },
    {
      title: '重量Kg',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      width: 100,
      align: 'right',
      render: (value: number) => Number(value || 0).toFixed(2),
    },
    {
      title: '件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 80,
      align: 'right',
    },
    {
      title: '物流状态',
      key: 'logisticsStatus',
      width: 190,
      render: (_, row) => (
        <div>
          <div>{buildLogisticsStatusText(row)}</div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{formatTime(row.updatedAt)}</div>
        </div>
      ),
    },
    {
      title: '执行状态',
      key: 'executionStatus',
      width: 190,
      render: (_, row) => (
        <div>
          <div>{buildExecutionStatusText(row)}</div>
          <div style={{ fontSize: 11, color: token.colorTextSecondary }}>{formatTime(row.updatedAt)}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, row) => {
        const canAssign = row.dpnStatus === 'PENDING_ASSIGN';
        const canBind = row.dpnStatus === 'DRAFT' || row.dpnStatus === 'PENDING_ASSIGN';
        const canFail = row.latestTaskStatus && ACTIVE_TASK_STATUSES.includes(row.latestTaskStatus) && row.dpnStatus !== 'SIGNED' && row.dpnStatus !== 'CANCELLED';
        const canSign = row.latestTaskStatus && ACTIVE_TASK_STATUSES.includes(row.latestTaskStatus) && row.dpnStatus !== 'SIGNED' && row.dpnStatus !== 'CANCELLED';
        const canReturn = row.latestTaskStatus === 'FAILED' && row.dpnStatus !== 'SIGNED' && row.dpnStatus !== 'CANCELLED';
        const canReDispatch = row.dpnStatus === 'CANCELLED';

        return (
          <Space size={[4, 0]} wrap>
            {canBind && (
              <Button
                type="link"
                size="small"
                onClick={() => openBindModal({
                  id: row.id,
                  dpnNo: row.dpnNo,
                  businessLine: row.businessLine,
                  customerId: row.customerId,
                })}
              >
                绑定运单
              </Button>
            )}
            {canAssign && (
              <Button type="link" size="small" icon={<SendOutlined />} onClick={() => openAssignModal(row)}>
                执行
              </Button>
            )}
            {canFail && (
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleFail(row)}>
                失败
              </Button>
            )}
            {canSign && (
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleSign(row)}>
                签收
              </Button>
            )}
            {canReturn && (
              <Button type="link" size="small" danger onClick={() => handleReturnToWarehouse(row)}>
                回仓
              </Button>
            )}
            {canReDispatch && (
              <Button type="link" size="small" onClick={() => handleReDispatch(row)}>
                重派新DPN
              </Button>
            )}
            <Button type="link" size="small" onClick={() => handlePrint(row)}>
              打印
            </Button>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { void handleViewDetail(row); }}>
              详情
            </Button>
          </Space>
        );
      },
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: string) => formatTime(value),
    },
  ];

  const createCandidateColumns: ColumnsType<DpnCandidateRow> = [
    {
      title: '子单号',
      dataIndex: 'subOrderNo',
      key: 'subOrderNo',
      width: 180,
    },
    {
      title: '主单号',
      key: 'orderNo',
      width: 180,
      render: (_, row) => row.displayOrderNo || row.orderNo || '-',
    },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'subStatus',
      key: 'subStatus',
      width: 120,
      render: (value: string) => <Tag>{value || '-'}</Tag>,
    },
    {
      title: '件数',
      dataIndex: 'pieces',
      key: 'pieces',
      width: 80,
      align: 'right',
    },
    {
      title: '重量(kg)',
      dataIndex: 'weightKg',
      key: 'weightKg',
      width: 100,
      align: 'right',
      render: (value: number) => Number(value || 0).toFixed(2),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: string) => formatTime(value),
    },
  ];

  const detailDpn = detailData?.dpn || {};

  return (
    <div>
      {messageContext}
      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Row gutter={[8, 8]} align="middle">
          <Col flex="260px">
            <Input
              placeholder="输入调度号/JOB/订单号"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={() => {
                setPage(1);
                void fetchDpns();
              }}
              allowClear
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              创建DPN任务
            </Button>
          </Col>
          <Col>
            <Select
              value={routeFilter}
              onChange={setRouteFilter}
              style={{ width: 180 }}
              options={routeOptions}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col>
            <Select
              value={logisticsFilter}
              onChange={setLogisticsFilter}
              style={{ width: 150 }}
              options={LOGISTICS_FILTER_OPTIONS}
            />
          </Col>
          <Col>
            <Select
              value={executionFilter}
              onChange={setExecutionFilter}
              style={{ width: 150 }}
              options={EXECUTION_FILTER_OPTIONS}
            />
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setPage(1);
                  void fetchDpns();
                }}
              >
                刷新
              </Button>
              <Button
                onClick={() => {
                  setRouteFilter('ALL');
                  setLogisticsFilter('ALL');
                  setExecutionFilter('ALL');
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

      <Table<DpnListRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        size="small"
        scroll={{ x: 2200 }}
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

      <Modal
        title="创建DPN"
        width={1100}
        open={createOpen}
        onCancel={closeCreateModal}
        onOk={() => { void handleCreateDpn(); }}
        okText="发布并去绑定"
        cancelText="取消"
        confirmLoading={createSubmitting}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="businessLine" label="业务线" rules={[{ required: true, message: '请选择业务线' }]}>
                <Select
                  options={BUSINESS_LINE_OPTIONS}
                  disabled={Boolean(lineFilter)}
                  onChange={(nextLine: 'SEA' | 'AIR') => setCreateLine(nextLine)}
                />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="customerId" label="客户" rules={[{ required: true, message: '请选择客户' }]}>
                <Select showSearch optionFilterProp="label" options={customerOptions} />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="warehouseId" label="仓库" rules={[{ required: true, message: '请选择仓库' }]}>
                <Select showSearch optionFilterProp="label" options={warehouseOptions} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="recipientName" label="发至-名字" rules={[{ required: true, message: '请输入收件人' }]}>
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="recipientPhone" label="发至-电话" rules={[{ required: true, message: '请输入收件电话' }]}>
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="toStation" label="发往站点">
                <Input placeholder="录入/选择" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="recipientAddress" label="发至-地址" rules={[{ required: true, message: '请输入收件地址' }]}>
            <Input.TextArea rows={2} placeholder="录入" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="totalWeightKg" label="重量(KGS)">
                <Input type="number" min={0} step="0.01" placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="totalPieces" label="件数">
                <Input type="number" min={0} step="1" placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="executeDate" label="执行日期">
                <Input placeholder="选择" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="transportMode" label="运输方式" rules={[{ required: true, message: '请选择运输方式' }]}>
                <Select
                  options={[
                    { value: 'DELIVERY', label: '空运口' },
                    { value: 'SELF_PICKUP', label: '陆运口' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="deliveryCompany" label="物流公司">
                <Input placeholder="选择" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="trackingNo" label="运单号/订单号">
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="queryPhone" label="查询电话">
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="driverName" label="司机名称">
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="driverPhone" label="司机电话">
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="plateNo" label="车牌">
                <Input placeholder="录入" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="currencyCode" label="币种" initialValue="NGN">
                <Input placeholder="例如 NGN" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="totalReceivableAmount" label="应收金额">
                <Input type="number" min={0} step="0.01" placeholder="录入" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="录入" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={bindTarget ? `绑定运单 - ${bindTarget.dpnNo}` : '绑定运单'}
        width={1080}
        open={bindOpen}
        onCancel={closeBindModal}
        onOk={() => { void handleBindSubOrders(); }}
        okText="提交绑定"
        cancelText="取消"
        confirmLoading={bindSubmitting}
        destroyOnClose
      >
        <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
          <Row gutter={8} align="middle">
            <Col flex="auto">
              <Input
                placeholder="输入运单号/订单号查询并绑定"
                value={bindKeyword}
                onChange={(e) => setBindKeyword(e.target.value)}
                onPressEnter={() => {
                  setBindPage(1);
                  void fetchBindCandidates();
                }}
                allowClear
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setBindKeyword('');
                  setBindPage(1);
                }}
              >
                重置筛选
              </Button>
            </Col>
          </Row>
        </Card>

        <Table<DpnCandidateRow>
          rowKey="subOrderId"
          size="small"
          loading={bindLoading}
          columns={createCandidateColumns}
          dataSource={bindRows}
          scroll={{ x: 980, y: 320 }}
          rowSelection={{
            selectedRowKeys: bindSelectedKeys,
            preserveSelectedRowKeys: true,
            onChange: (nextKeys, nextRows) => {
              handleBindSelectionChange(nextKeys, nextRows as DpnCandidateRow[]);
            },
          }}
          pagination={{
            current: bindPage,
            pageSize: bindPageSize,
            total: bindTotal,
            showSizeChanger: true,
            showTotal: (v) => `可选 ${v} 条`,
            onChange: (nextPage, nextSize) => {
              setBindPage(nextPage);
              setBindPageSize(nextSize);
            },
          }}
        />
        <Space size={8} style={{ marginTop: 8 }}>
          <Tag color="blue">已选子单 {bindSummary.count}</Tag>
          <Tag>已选件数 {bindSummary.pieces}</Tag>
          <Tag color="processing">已选重量 {bindSummary.weightKg.toFixed(2)} kg</Tag>
        </Space>
      </Modal>

      <Modal
        title={assignTarget ? `配送派单 - ${assignTarget.dpnNo}` : '配送派单'}
        open={assignOpen}
        onCancel={() => {
          setAssignOpen(false);
          setAssignTarget(null);
          assignForm.resetFields();
        }}
        onOk={() => { void handleAssignTask(); }}
        okText="确认派单"
        cancelText="取消"
        confirmLoading={assignLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={assignForm}>
          <Form.Item name="driverName" label="司机姓名" rules={[{ required: true, message: '请输入司机姓名' }]}> 
            <Input placeholder="例如：John" />
          </Form.Item>
          <Form.Item name="driverPhone" label="司机电话" rules={[{ required: true, message: '请输入司机电话' }]}> 
            <Input placeholder="例如：+2348000009999" />
          </Form.Item>
          <Form.Item name="driverUserId" label="司机账号ID">
            <Input placeholder="默认 U-OPS-US-01" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={detailDpn?.dpn_no ? `DPN详情 - ${detailDpn.dpn_no}` : 'DPN详情'}
        width={960}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailData(null);
        }}
        destroyOnClose
      >
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 12 }}>
          <Descriptions.Item label="DPN号">{detailDpn?.dpn_no || '-'}</Descriptions.Item>
          <Descriptions.Item label="业务线">{detailDpn?.business_line || '-'}</Descriptions.Item>
          <Descriptions.Item label="仓库">{detailDpn?.warehouse_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={(DPN_STATUS_MAP[detailDpn?.dpn_status as DpnStatus] || { color: 'default' }).color}>
              {(DPN_STATUS_MAP[detailDpn?.dpn_status as DpnStatus] || { label: detailDpn?.dpn_status || '-' }).label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="收件人">{detailDpn?.recipient_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="电话">{detailDpn?.recipient_phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="地址" span={2}>{detailDpn?.recipient_address || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatTime(detailDpn?.created_at)}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatTime(detailDpn?.updated_at)}</Descriptions.Item>
        </Descriptions>

        <Card title="DPN子单明细" size="small" loading={detailLoading} style={{ marginBottom: 12 }}>
          <Table
            rowKey={(row: any) => String(row.id)}
            size="small"
            pagination={false}
            dataSource={detailData?.items || []}
            columns={[
              { title: '子单号', dataIndex: 'sub_order_no', key: 'sub_order_no', width: 180 },
              { title: '主单号', dataIndex: 'order_no', key: 'order_no', width: 180 },
              {
                title: '子单状态',
                dataIndex: 'sub_status',
                key: 'sub_status',
                width: 140,
                render: (value: string) => <Tag>{value || '-'}</Tag>,
              },
              { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'right' as const },
              {
                title: '重量(kg)',
                dataIndex: 'weight_kg',
                key: 'weight_kg',
                width: 100,
                align: 'right' as const,
                render: (value: number) => Number(value || 0).toFixed(2),
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                key: 'created_at',
                width: 180,
                render: (value: string) => formatTime(value),
              },
            ]}
          />
        </Card>

        <Card title="配送任务记录" size="small" loading={detailLoading}>
          <Table
            rowKey={(row: any) => String(row.id)}
            size="small"
            pagination={false}
            dataSource={detailData?.deliveryTasks || []}
            columns={[
              { title: '任务号', dataIndex: 'task_no', key: 'task_no', width: 170 },
              {
                title: '任务状态',
                dataIndex: 'task_status',
                key: 'task_status',
                width: 120,
                render: (value: DeliveryTaskStatus) => {
                  const cfg = TASK_STATUS_MAP[value] || { label: value, color: 'default' };
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                },
              },
              { title: '司机', dataIndex: 'driver_name', key: 'driver_name', width: 120 },
              { title: '司机电话', dataIndex: 'driver_phone', key: 'driver_phone', width: 150 },
              {
                title: '接单时间',
                dataIndex: 'accepted_at',
                key: 'accepted_at',
                width: 180,
                render: (value: string) => formatTime(value),
              },
              {
                title: '签收时间',
                dataIndex: 'signed_at',
                key: 'signed_at',
                width: 180,
                render: (value: string) => formatTime(value),
              },
            ]}
          />
        </Card>
      </Drawer>
    </div>
  );
};
