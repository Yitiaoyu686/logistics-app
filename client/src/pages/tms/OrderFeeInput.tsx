import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Tag,
  Space,
  Row,
  Col,
  message,
  Modal,
  Form,
  InputNumber,
  Popconfirm,
  Alert,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  FileSyncOutlined,
  EyeOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { feeApi, orderApi } from '../../api';
import { useOrderBaseOptions } from '../../hooks/useOrderBaseOptions';
import { FeeLedgerDetailDrawer } from './FeeLedgerDetailDrawer';
import {
  CHANGE_REQUEST_STATUS_CONFIG,
  UI_STATUS_CONFIG,
  createChangeRequest,
  getUiFeeStatus,
  loadFeeWorkflowState,
  persistFeeWorkflowState,
  reviewChangeRequest,
} from './feeWorkflowDemo';
import type {
  ChangeType,
  FeeChangeRequest,
  FeeWorkflowState,
  UiFeeStatus,
} from './feeWorkflowDemo';

const { RangePicker } = DatePicker;

type FeeDirection = 'PAYABLE' | 'RECEIVABLE';
type OrderLevel = 'MASTER' | 'SUB';

interface OrderFeeRecord {
  id: string;
  feeNo: string;
  orderNo: string;
  orderLevel: OrderLevel;
  clientName: string;
  feeType: string;
  feeDirection: FeeDirection;
  amount: number;
  currency: string;
  description: string;
  backendStatus: string;
  uiStatus: UiFeeStatus;
  createdBy: string;
  createdAt: string;
  changeRequest?: FeeChangeRequest;
}

const CHANGE_TYPE_OPTIONS: Array<{ value: ChangeType; label: string }> = [
  { value: 'ADD', label: '新增条目' },
  { value: 'UPDATE', label: '修改条目' },
  { value: 'REMOVE', label: '删除条目' },
];

const FALLBACK_FEE_TYPE_OPTIONS = [
  { value: 'FREIGHT', label: '运费' },
  { value: 'CUSTOMS', label: '报关费' },
  { value: 'INSURANCE', label: '保险费' },
  { value: 'MISC', label: '杂费' },
  { value: 'AGENCY', label: '代理费' },
  { value: 'OTHER', label: '其他' },
];

const FALLBACK_CURRENCY_OPTIONS = [
  { value: 'CNY', label: '人民币 (CNY)' },
  { value: 'USD', label: '美元 (USD)' },
];

const TAG_COLORS = ['blue', 'cyan', 'orange', 'purple', 'green', 'geekblue', 'magenta', 'gold'];
const RECEIVABLE_FEE_TYPES = new Set(['FREIGHT', 'AGENCY', 'INSURANCE']);

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed?.username || parsed?.id || '当前用户';
  } catch {
    return '当前用户';
  }
};

const inferDirection = (feeType?: string): FeeDirection => {
  if (!feeType) return 'RECEIVABLE';
  return RECEIVABLE_FEE_TYPES.has(feeType) ? 'RECEIVABLE' : 'PAYABLE';
};

const buildDescription = (orderLevel: OrderLevel, desc?: string) => {
  const prefix = orderLevel === 'SUB' ? '[子运单]' : '[主运单]';
  const clean = (desc || '').trim();
  return clean ? `${prefix} ${clean}` : prefix;
};

const parseDescription = (raw?: string) => {
  const text = raw || '';
  if (text.startsWith('[子运单]')) {
    return { orderLevel: 'SUB' as OrderLevel, description: text.replace(/^\[子运单\]\s*/, '') };
  }
  if (text.startsWith('[主运单]')) {
    return { orderLevel: 'MASTER' as OrderLevel, description: text.replace(/^\[主运单\]\s*/, '') };
  }
  return { orderLevel: 'MASTER' as OrderLevel, description: text };
};

function mapFeeToOrderFeeRecord(fee: any): Omit<OrderFeeRecord, 'uiStatus' | 'changeRequest'> {
  const parsed = parseDescription(fee.description);
  return {
    id: String(fee.id || ''),
    feeNo: fee.feeNo || '',
    orderNo: fee.relatedNo || '',
    orderLevel: parsed.orderLevel,
    clientName: fee.customerName || '',
    feeType: String(fee.feeType || 'OTHER'),
    feeDirection: fee.feeDirection === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE',
    amount: Number(fee.amount || 0),
    currency: fee.currency || 'CNY',
    description: parsed.description,
    backendStatus: String(fee.status || 'PENDING'),
    createdBy: fee.createdBy || '',
    createdAt: fee.createdAt || '',
  };
}

export const OrderFeeInput: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = ({ businessMode = 'ALL' }) => {
  const [form] = Form.useForm();
  const [changeForm] = Form.useForm();
  const { baseOptions, currencyOptions } = useOrderBaseOptions();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Omit<OrderFeeRecord, 'uiStatus' | 'changeRequest'>[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OrderFeeRecord | null>(null);
  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [changeTarget, setChangeTarget] = useState<OrderFeeRecord | null>(null);
  const [workflowState, setWorkflowState] = useState<FeeWorkflowState>(() => loadFeeWorkflowState());

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTitle, setDetailTitle] = useState('订单费用详情');
  const [detailInfoItems, setDetailInfoItems] = useState<Array<{ label: string; value: React.ReactNode }>>([]);
  const [detailEntries, setDetailEntries] = useState<any[]>([]);

  const [filterOrderNo, setFilterOrderNo] = useState('');
  const [filterFeeType, setFilterFeeType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<any>(null);

  const updateWorkflowState = (updater: (prev: FeeWorkflowState) => FeeWorkflowState) => {
    setWorkflowState((prev) => {
      const next = updater(prev);
      persistFeeWorkflowState(next);
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await feeApi.list({ relatedType: 'ORDER' });
      const rows = ((res as any).data || res || []) as any[];
      setData(rows.map(mapFeeToOrderFeeRecord));
    } catch (err: any) {
      message.error(err.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [businessMode]);

  const feeTypeOptions = useMemo(() => {
    if ((baseOptions.FEE_TYPE || []).length > 0) {
      return baseOptions.FEE_TYPE.map((item) => ({ value: item.code, label: item.label }));
    }
    return FALLBACK_FEE_TYPE_OPTIONS;
  }, [baseOptions.FEE_TYPE]);

  const feeTypeLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    feeTypeOptions.forEach((item) => {
      map[item.value] = item.label;
    });
    return map;
  }, [feeTypeOptions]);

  const feeTypeColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    feeTypeOptions.forEach((item, idx) => {
      map[item.value] = TAG_COLORS[idx % TAG_COLORS.length];
    });
    map.OTHER = map.OTHER || 'default';
    return map;
  }, [feeTypeOptions]);

  const currencySelectOptions = useMemo(() => {
    if (currencyOptions.length > 0) {
      return currencyOptions.map((item) => ({ value: item.code, label: item.label }));
    }
    return FALLBACK_CURRENCY_OPTIONS;
  }, [currencyOptions]);

  const enrichedData = useMemo<OrderFeeRecord[]>(() => {
    return data
      .filter((item) => !workflowState.deletedFeeIds[item.id])
      .map((item) => ({
        ...item,
        uiStatus: getUiFeeStatus(item.backendStatus, item.id, workflowState),
        changeRequest: workflowState.changeRequests[item.id],
      }));
  }, [data, workflowState]);

  const filteredData = useMemo(() => {
    let result = [...enrichedData];
    if (filterOrderNo) {
      result = result.filter((r) => r.orderNo.toLowerCase().includes(filterOrderNo.toLowerCase()));
    }
    if (filterFeeType) {
      result = result.filter((r) => r.feeType === filterFeeType);
    }
    if (filterStatus) {
      result = result.filter((r) => r.uiStatus === filterStatus);
    }
    if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
      const start = filterDateRange[0].startOf('day');
      const end = filterDateRange[1].endOf('day');
      result = result.filter((r) => {
        const d = dayjs(r.createdAt);
        return d.isAfter(start) && d.isBefore(end);
      });
    }
    return result;
  }, [enrichedData, filterOrderNo, filterFeeType, filterStatus, filterDateRange]);

  const stats = useMemo(() => {
    const totalAmount = enrichedData.reduce((sum, r) => {
      const amountCNY = r.currency === 'USD' ? r.amount * 7.2 : r.amount;
      return sum + amountCNY;
    }, 0);
    return {
      total: enrichedData.length,
      draft: enrichedData.filter((r) => r.uiStatus === 'DRAFT').length,
      pending: enrichedData.filter((r) => r.uiStatus === 'PENDING').length,
      approved: enrichedData.filter((r) => r.uiStatus === 'APPROVED').length,
      totalAmount,
    };
  }, [enrichedData]);

  const handleReset = () => {
    setFilterOrderNo('');
    setFilterFeeType('');
    setFilterStatus('');
    setFilterDateRange(null);
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ orderLevel: 'MASTER', currency: 'CNY', feeDirection: 'RECEIVABLE' });
    setModalVisible(true);
  };

  const openEditModal = (record: OrderFeeRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      orderNo: record.orderNo,
      orderLevel: record.orderLevel,
      feeType: record.feeType,
      feeDirection: record.feeDirection,
      amount: record.amount,
      currency: record.currency,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleFeeTypeChange = (feeType: string) => {
    form.setFieldValue('feeDirection', inferDirection(feeType));
  };

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        relatedType: 'ORDER',
        relatedId: values.orderNo,
        relatedNo: values.orderNo,
        feeType: values.feeType,
        feeDirection: values.feeDirection,
        amount: values.amount,
        currency: values.currency,
        description: buildDescription(values.orderLevel, values.description),
        createdBy: getCurrentUser(),
      };

      if (editingRecord) {
        await feeApi.update(editingRecord.id, payload);
        updateWorkflowState((prev) => ({
          ...prev,
          draftOverrides: { ...prev.draftOverrides, [editingRecord.id]: true },
        }));
        message.success('草稿已保存');
      } else {
        const created = await feeApi.create(payload);
        const createdRow = (created as any).data || created || {};
        const createdId = createdRow?.id;
        if (createdId) {
          updateWorkflowState((prev) => ({
            ...prev,
            draftOverrides: { ...prev.draftOverrides, [String(createdId)]: true },
          }));
        }
        message.success('已创建草稿');
      }

      setModalVisible(false);
      await loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || '保存失败');
    }
  };

  const handleSubmitReview = async (record: OrderFeeRecord) => {
    try {
      await feeApi.update(record.id, { status: 'PENDING' });
    } catch {
      message.warning('后端未同步提交状态，已按前端演示流程处理');
    }

    updateWorkflowState((prev) => {
      const nextDraft = { ...prev.draftOverrides };
      delete nextDraft[record.id];
      return {
        ...prev,
        draftOverrides: nextDraft,
      };
    });
    message.success('已提交审核');
    await loadData();
  };

  const handleWithdrawToDraft = (record: OrderFeeRecord) => {
    updateWorkflowState((prev) => ({
      ...prev,
      draftOverrides: { ...prev.draftOverrides, [record.id]: true },
    }));
    message.success('已撤回到草稿，可继续修改');
  };

  const handleApprove = async (record: OrderFeeRecord) => {
    try {
      await feeApi.approve(record.id, getCurrentUser());
      updateWorkflowState((prev) => {
        const nextDraft = { ...prev.draftOverrides };
        delete nextDraft[record.id];
        return {
          ...prev,
          draftOverrides: nextDraft,
        };
      });
      message.success('审核通过');
      await loadData();
    } catch (err: any) {
      message.error(err.message || '审核失败');
    }
  };

  const handleReject = async (record: OrderFeeRecord) => {
    try {
      await feeApi.reject(record.id, getCurrentUser(), '演示驳回：请补充费用依据');
      updateWorkflowState((prev) => {
        const nextDraft = { ...prev.draftOverrides };
        delete nextDraft[record.id];
        return {
          ...prev,
          draftOverrides: nextDraft,
        };
      });
      message.success('已驳回，可编辑后重新提交');
      await loadData();
    } catch (err: any) {
      message.error(err.message || '驳回失败');
    }
  };

  const handleDeleteDraft = (record: OrderFeeRecord) => {
    updateWorkflowState((prev) => {
      const nextDraft = { ...prev.draftOverrides };
      delete nextDraft[record.id];
      const nextCR = { ...prev.changeRequests };
      delete nextCR[record.id];
      return {
        ...prev,
        draftOverrides: nextDraft,
        changeRequests: nextCR,
        deletedFeeIds: { ...prev.deletedFeeIds, [record.id]: true },
      };
    });
    message.success('草稿已删除（演示模式）');
  };

  const openChangeModal = (record: OrderFeeRecord) => {
    setChangeTarget(record);
    changeForm.setFieldsValue({
      reason: '',
      items: [
        {
          feeType: record.feeType,
          changeType: 'UPDATE',
          currency: record.currency,
          feeDirection: record.feeDirection,
          originalAmount: record.amount,
          newAmount: record.amount,
          remark: '',
        },
      ],
    });
    setChangeModalVisible(true);
  };

  const handleSubmitChangeRequest = async () => {
    if (!changeTarget) return;
    try {
      const values = await changeForm.validateFields();
      const reason = String(values.reason || '').trim();
      if (reason.length < 10) {
        message.error('更改原因至少输入 10 个字符');
        return;
      }

      const items = Array.isArray(values.items) ? values.items : [];
      if (!items.length) {
        message.error('至少新增 1 条费用变更项目');
        return;
      }

      const normalized = items.map((item: any) => ({
        feeType: item.feeType,
        changeType: item.changeType as ChangeType,
        currency: item.currency,
        feeDirection: item.feeDirection,
        originalAmount: item.originalAmount,
        newAmount: item.newAmount,
        remark: item.remark,
      }));

      for (const item of normalized) {
        if (!item.feeType) {
          message.error('费用项目不能为空');
          return;
        }
        if (!item.changeType) {
          message.error('变更类型不能为空');
          return;
        }
        if ((item.changeType === 'ADD' || item.changeType === 'UPDATE') && (item.newAmount === undefined || item.newAmount === null)) {
          message.error('新增/修改条目必须填写新金额');
          return;
        }
        if ((item.changeType === 'REMOVE' || item.changeType === 'UPDATE') && (item.originalAmount === undefined || item.originalAmount === null)) {
          message.error('删除/修改条目必须填写原金额');
          return;
        }
      }

      updateWorkflowState((prev) =>
        createChangeRequest(prev, {
          feeId: changeTarget.id,
          feeNo: changeTarget.feeNo,
          reason,
          applicant: getCurrentUser(),
          items: normalized,
        })
      );
      message.success('更改申请已提交（演示流程）');
      setChangeModalVisible(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || '提交失败');
    }
  };

  const handleReviewChangeRequest = (record: OrderFeeRecord, status: 'APPROVED' | 'REJECTED') => {
    updateWorkflowState((prev) =>
      reviewChangeRequest(prev, {
        feeId: record.id,
        status,
        reviewer: '财务经理(演示)',
        reviewComment: status === 'APPROVED' ? '允许回到草稿修改' : '申请理由不足',
      })
    );
    message.success(status === 'APPROVED' ? '更改申请已通过，单据已回到草稿' : '更改申请已驳回');
  };

  const handleOpenDetail = async (record: OrderFeeRecord) => {
    setDetailVisible(true);
    setDetailTitle(`订单费用详情 - ${record.orderNo}`);

    const relatedEntries = enrichedData
      .filter((item) => item.orderNo === record.orderNo)
      .map((item) => ({
        id: item.id,
        feeNo: item.feeNo,
        relatedNo: item.orderNo,
        feeType: item.feeType,
        feeDirection: item.feeDirection,
        amount: item.amount,
        currency: item.currency,
        uiStatus: item.uiStatus,
        changeRequestStatus: item.changeRequest?.status,
        changeItemsCount: item.changeRequest?.items?.length || 0,
        createdBy: item.createdBy,
        createdAt: item.createdAt,
        description: item.description,
      }));
    setDetailEntries(relatedEntries);

    setDetailInfoItems([
      { label: '订单号', value: record.orderNo },
      { label: '订单层级', value: record.orderLevel === 'SUB' ? '子运单' : '主运单' },
      { label: '客户名称', value: record.clientName || '-' },
      { label: '线路', value: '-' },
      { label: '服务类型', value: '-' },
      { label: '业务员', value: '-' },
      { label: '物流状态', value: '-' },
      { label: '当前费用编号', value: record.feeNo },
    ]);

    setDetailLoading(true);
    try {
      const raw = await orderApi.search(record.orderNo);
      const payload = (raw as any).data || raw || {};
      const masters = Array.isArray(payload.masterOrders) ? payload.masterOrders : [];
      const subs = Array.isArray(payload.subOrders) ? payload.subOrders : [];

      const matchedMaster = masters.find((item: any) => item.orderNo === record.orderNo || item.id === record.orderNo);
      const matchedSub = subs.find((item: any) => item.subOrderNo === record.orderNo || item.id === record.orderNo);
      const matched = matchedSub || matchedMaster || subs[0] || masters[0] || {};

      setDetailInfoItems([
        { label: '订单号', value: record.orderNo },
        { label: '订单层级', value: matchedSub || record.orderLevel === 'SUB' ? '子运单' : '主运单' },
        { label: '客户名称', value: matched.customerName || matched.clientName || record.clientName || '-' },
        { label: '线路', value: matched.routeCode || matched.route || '-' },
        { label: '服务类型', value: matched.serviceType || '-' },
        { label: '业务员', value: matched.salesPerson || matched.salesName || '-' },
        { label: '物流状态', value: matched.status || matched.currentStatus || '-' },
        { label: '当前费用编号', value: record.feeNo },
      ]);
    } catch {
      message.warning('订单基础信息读取失败，已显示费用台账');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    { title: '费用编号', dataIndex: 'feeNo', key: 'feeNo', width: 130 },
    {
      title: '订单编号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: '层级',
      dataIndex: 'orderLevel',
      key: 'orderLevel',
      width: 90,
      render: (value: OrderLevel) => <Tag color={value === 'SUB' ? 'geekblue' : 'blue'}>{value === 'SUB' ? '子运单' : '主运单'}</Tag>,
    },
    { title: '客户名称', dataIndex: 'clientName', key: 'clientName', width: 160, ellipsis: true },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 100,
      render: (val: string) => (
        <Tag color={feeTypeColorMap[val] || 'default'}>{feeTypeLabelMap[val] || val || '-'}</Tag>
      ),
    },
    {
      title: '方向',
      dataIndex: 'feeDirection',
      key: 'feeDirection',
      width: 90,
      render: (val: FeeDirection) => <Tag color={val === 'RECEIVABLE' ? 'green' : 'red'}>{val === 'RECEIVABLE' ? '应收' : '应付'}</Tag>,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (val: number) => val.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 70 },
    { title: '说明', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '费用状态',
      dataIndex: 'uiStatus',
      key: 'uiStatus',
      width: 100,
      render: (val: UiFeeStatus) => <Tag color={UI_STATUS_CONFIG[val].color}>{UI_STATUS_CONFIG[val].text}</Tag>,
    },
    {
      title: '更改申请',
      key: 'changeRequest',
      width: 120,
      render: (_: unknown, record: OrderFeeRecord) => {
        if (!record.changeRequest) return '-';
        const cfg = CHANGE_REQUEST_STATUS_CONFIG[record.changeRequest.status];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 90 },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 340,
      fixed: 'right' as const,
      render: (_: unknown, record: OrderFeeRecord) => {
        const cr = record.changeRequest;
        const canApplyChange = record.uiStatus === 'APPROVED' && (!cr || cr.status !== 'PENDING');
        return (
          <Space size={4} wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record)}>详情</Button>
            {(record.uiStatus === 'DRAFT' || record.uiStatus === 'REJECTED') && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
            )}
            {(record.uiStatus === 'DRAFT' || record.uiStatus === 'REJECTED') && (
              <Button type="link" size="small" onClick={() => handleSubmitReview(record)}>提交审核</Button>
            )}
            {record.uiStatus === 'PENDING' && (
              <Button type="link" size="small" onClick={() => handleWithdrawToDraft(record)}>撤回草稿</Button>
            )}
            {record.uiStatus === 'PENDING' && (
              <Popconfirm title="确认审核通过？" onConfirm={() => handleApprove(record)}>
                <Button type="link" size="small">审核通过</Button>
              </Popconfirm>
            )}
            {record.uiStatus === 'PENDING' && (
              <Popconfirm title="确认驳回？" onConfirm={() => handleReject(record)}>
                <Button type="link" size="small" danger>驳回</Button>
              </Popconfirm>
            )}
            {record.uiStatus === 'DRAFT' && (
              <Popconfirm title="删除后仅前端隐藏，确认继续？" onConfirm={() => handleDeleteDraft(record)}>
                <Button type="link" size="small" danger>删除</Button>
              </Popconfirm>
            )}
            {canApplyChange && (
              <Button type="link" size="small" icon={<FileSyncOutlined />} onClick={() => openChangeModal(record)}>申请更改</Button>
            )}
            {cr?.status === 'PENDING' && (
              <Button type="link" size="small" onClick={() => handleReviewChangeRequest(record, 'APPROVED')}>模拟批复</Button>
            )}
            {cr?.status === 'PENDING' && (
              <Button type="link" size="small" danger onClick={() => handleReviewChangeRequest(record, 'REJECTED')}>驳回申请</Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 10 }}
        message="演示规则：运单费用先保存草稿再提交审核；审核后不可直接编辑，必须提交更改原因和费用项目清单。"
      />

      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">订单费用 {stats.total}</Tag>
        <Tag>草稿 {stats.draft}</Tag>
        <Tag color="orange">待审核 {stats.pending}</Tag>
        <Tag color="green">已审核 {stats.approved}</Tag>
        <Tag color="processing">总金额 CNY {stats.totalAmount.toFixed(2)}</Tag>
      </div>

      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Space wrap>
          <Input placeholder="订单编号" value={filterOrderNo} onChange={(e) => setFilterOrderNo(e.target.value)} prefix={<SearchOutlined />} style={{ width: 180 }} allowClear />
          <Select placeholder="费用类型" value={filterFeeType || undefined} onChange={setFilterFeeType} style={{ width: 130 }} allowClear>
            {feeTypeOptions.map((item) => (<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>))}
          </Select>
          <Select placeholder="状态" value={filterStatus || undefined} onChange={setFilterStatus} style={{ width: 140 }} allowClear>
            {Object.entries(UI_STATUS_CONFIG).map(([k, v]) => (<Select.Option key={k} value={k}>{v.text}</Select.Option>))}
          </Select>
          <RangePicker value={filterDateRange} onChange={setFilterDateRange} />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新增费用</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        scroll={{ x: 1850, y: 'calc(100vh - 430px)' }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="small"
      />

      <Modal
        title={editingRecord ? `编辑草稿 - ${editingRecord.feeNo}` : '新增运单费用草稿'}
        open={modalVisible}
        onOk={handleSaveDraft}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        okText="保存草稿"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="orderNo" label="订单编号" rules={[{ required: true, message: '请输入订单编号' }]}>
            <Input placeholder="请输入主单号或子单号" />
          </Form.Item>
          <Form.Item name="orderLevel" label="费用归属层级" initialValue="MASTER" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="MASTER">主运单</Select.Option>
              <Select.Option value="SUB">子运单</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="feeType" label="费用类型" rules={[{ required: true, message: '请选择费用类型' }]}>
            <Select placeholder="请选择费用类型" onChange={handleFeeTypeChange}>
              {feeTypeOptions.map((item) => (<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>))}
            </Select>
          </Form.Item>
          <Form.Item name="feeDirection" label="费用方向" rules={[{ required: true, message: '请选择费用方向' }]}>
            <Select>
              <Select.Option value="RECEIVABLE">应收（向客户收款）</Select.Option>
              <Select.Option value="PAYABLE">应付（支付供应商）</Select.Option>
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={14}><Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入金额" /></Form.Item></Col>
            <Col span={10}><Form.Item name="currency" label="币种" initialValue="CNY" rules={[{ required: true }]}><Select>{currencySelectOptions.map((item) => (<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>))}</Select></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="费用说明"><Input.TextArea rows={3} placeholder="请输入费用说明" /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={changeTarget ? `发起更改申请 - ${changeTarget.feeNo}` : '发起更改申请'}
        open={changeModalVisible}
        onOk={handleSubmitChangeRequest}
        onCancel={() => setChangeModalVisible(false)}
        okText="提交申请"
        cancelText="取消"
        width={900}
        destroyOnClose
      >
        <Form form={changeForm} layout="vertical">
          <Form.Item name="reason" label="更改原因" rules={[{ required: true, message: '请填写更改原因' }]}>
            <Input.TextArea rows={3} placeholder="请说明为什么需要更改，至少 10 个字符" />
          </Form.Item>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>更改费用项目</div>
                {fields.map((field) => (
                  <Card key={field.key} size="small" style={{ marginBottom: 8 }}>
                    <Row gutter={8}>
                      <Col span={5}>
                        <Form.Item name={[field.name, 'feeType']} label="费用项目" rules={[{ required: true, message: '必填' }]}>
                          <Select placeholder="选择项目">{feeTypeOptions.map((item) => (<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>))}</Select>
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[field.name, 'changeType']} label="变更类型" rules={[{ required: true, message: '必填' }]}>
                          <Select options={CHANGE_TYPE_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[field.name, 'feeDirection']} label="方向" rules={[{ required: true, message: '必填' }]}>
                          <Select>
                            <Select.Option value="RECEIVABLE">应收</Select.Option>
                            <Select.Option value="PAYABLE">应付</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Form.Item name={[field.name, 'originalAmount']} label="原金额">
                          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Form.Item name={[field.name, 'newAmount']} label="新金额">
                          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Form.Item name={[field.name, 'currency']} label="币种" rules={[{ required: true, message: '必填' }]}>
                          <Select>{currencySelectOptions.map((item) => (<Select.Option key={item.value} value={item.value}>{item.value}</Select.Option>))}</Select>
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} style={{ marginTop: 30 }} />
                      </Col>
                    </Row>
                    <Form.Item name={[field.name, 'remark']} label="条目备注">
                      <Input placeholder="可选" />
                    </Form.Item>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ changeType: 'UPDATE', currency: 'CNY', feeDirection: 'RECEIVABLE' })} block>
                  + 添加更改项目
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>

      <FeeLedgerDetailDrawer
        open={detailVisible}
        title={detailTitle}
        loading={detailLoading}
        infoItems={detailInfoItems}
        entries={detailEntries}
        onClose={() => setDetailVisible(false)}
      />
    </div>
  );
};
