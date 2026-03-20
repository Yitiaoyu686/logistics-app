import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  FileSyncOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { theme } from 'antd';
import { deliveryApi, feeApi } from '../../api';
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

interface DpnOption {
  id: string;
  dpnNo: string;
  recipientName: string;
  recipientPhone?: string;
  recipientAddress?: string;
  totalPieces: number;
  totalWeight: number;
  waybillCount: number;
}

interface DpnFeeRecord {
  id: string;
  feeNo: string;
  dpnId: string;
  dpnNo: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  pieces: number;
  totalWeight: number;
  waybillCount: number;
  feeType: string;
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
  { value: 'DELIVERY', label: '配送费' },
  { value: 'TRUCKING', label: '派车费' },
  { value: 'OVERWEIGHT', label: '超重费' },
  { value: 'HANDLING', label: '装卸费' },
  { value: 'WAREHOUSE', label: '暂存费' },
  { value: 'OTHER', label: '其他' },
];

const FALLBACK_CURRENCY_OPTIONS = [
  { value: 'NGN', label: '奈拉 (NGN)' },
  { value: 'USD', label: '美元 (USD)' },
  { value: 'CNY', label: '人民币 (CNY)' },
];

const TAG_COLORS = ['blue', 'cyan', 'orange', 'purple', 'green', 'geekblue', 'magenta', 'gold'];

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed?.username || parsed?.id || '当前用户';
  } catch {
    return '当前用户';
  }
};

export const DPNCost: React.FC<{ businessMode?: 'ALL' | 'AIR' | 'SEA' }> = () => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [changeForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Omit<DpnFeeRecord, 'uiStatus' | 'changeRequest'>[]>([]);
  const [dpnOptions, setDpnOptions] = useState<DpnOption[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DpnFeeRecord | null>(null);

  const [changeModalVisible, setChangeModalVisible] = useState(false);
  const [changeTarget, setChangeTarget] = useState<DpnFeeRecord | null>(null);
  const [workflowState, setWorkflowState] = useState<FeeWorkflowState>(() => loadFeeWorkflowState());

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTitle, setDetailTitle] = useState('DPN 成本详情');
  const [detailInfoItems, setDetailInfoItems] = useState<Array<{ label: string; value: React.ReactNode }>>([]);
  const [detailEntries, setDetailEntries] = useState<any[]>([]);

  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterFeeType, setFilterFeeType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

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
      const [deliveryRes, feeRes] = await Promise.all([
        deliveryApi.list({}),
        feeApi.list({ relatedType: 'DPN', feeDirection: 'PAYABLE' }),
      ]);

      const deliveries = ((deliveryRes as any).data || deliveryRes || []) as any[];
      const fees = ((feeRes as any).data || feeRes || []) as any[];

      const optionRows: DpnOption[] = deliveries.map((item: any) => ({
        id: String(item.id),
        dpnNo: item.dpnNo || '-',
        recipientName: item.recipientName || '-',
        recipientPhone: item.recipientPhone || '',
        recipientAddress: item.recipientAddress || '',
        totalPieces: Number(item.totalPieces || 0),
        totalWeight: Number(item.totalWeight || 0),
        waybillCount: Array.isArray(item.items) ? item.items.length : 0,
      }));
      setDpnOptions(optionRows);

      const deliveryById = new Map(optionRows.map((item) => [item.id, item]));
      const deliveryByNo = new Map(optionRows.map((item) => [item.dpnNo, item]));

      const mapped = fees.map((fee: any) => {
        const relatedId = String(fee.relatedId || '');
        const relatedNo = String(fee.relatedNo || '');
        const dpn = deliveryById.get(relatedId) || deliveryByNo.get(relatedNo);
        return {
          id: String(fee.id || ''),
          feeNo: fee.feeNo || '',
          dpnId: dpn?.id || relatedId,
          dpnNo: dpn?.dpnNo || relatedNo || '-',
          recipientName: dpn?.recipientName || '-',
          recipientPhone: dpn?.recipientPhone || '-',
          recipientAddress: dpn?.recipientAddress || '-',
          pieces: dpn?.totalPieces || 0,
          totalWeight: dpn?.totalWeight || 0,
          waybillCount: dpn?.waybillCount || 0,
          feeType: String(fee.feeType || 'OTHER'),
          amount: Number(fee.amount || 0),
          currency: String(fee.currency || 'NGN'),
          description: fee.description || fee.remark || '',
          backendStatus: String(fee.status || 'PENDING'),
          createdBy: fee.createdBy || '-',
          createdAt: fee.createdAt || '',
        };
      });
      setData(mapped);
    } catch (err: any) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const feeTypeOptions = useMemo(() => FALLBACK_FEE_TYPE_OPTIONS, []);

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

  const currencyOptions = useMemo(() => FALLBACK_CURRENCY_OPTIONS, []);

  const enrichedData = useMemo<DpnFeeRecord[]>(() => {
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
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase();
      result = result.filter((item) =>
        item.dpnNo.toLowerCase().includes(kw) ||
        item.feeNo.toLowerCase().includes(kw) ||
        item.recipientName.toLowerCase().includes(kw),
      );
    }
    if (filterFeeType) {
      result = result.filter((item) => item.feeType === filterFeeType);
    }
    if (filterStatus) {
      result = result.filter((item) => item.uiStatus === filterStatus);
    }
    return result;
  }, [enrichedData, filterKeyword, filterFeeType, filterStatus]);

  const stats = useMemo(() => {
    const totalAmount = enrichedData.reduce((sum, item) => {
      const amountNgn =
        item.currency === 'USD' ? item.amount * 1500 :
        item.currency === 'CNY' ? item.amount * 210 :
        item.amount;
      return sum + amountNgn;
    }, 0);
    return {
      total: enrichedData.length,
      draft: enrichedData.filter((item) => item.uiStatus === 'DRAFT').length,
      pending: enrichedData.filter((item) => item.uiStatus === 'PENDING').length,
      approved: enrichedData.filter((item) => item.uiStatus === 'APPROVED').length,
      paid: enrichedData.filter((item) => item.uiStatus === 'PAID').length,
      totalAmount,
    };
  }, [enrichedData]);

  const handleReset = () => {
    setFilterKeyword('');
    setFilterFeeType('');
    setFilterStatus('');
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ currency: 'NGN' });
    setModalVisible(true);
  };

  const openEditModal = (record: DpnFeeRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      dpnId: record.dpnId,
      feeType: record.feeType,
      amount: record.amount,
      currency: record.currency,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      const dpn = dpnOptions.find((item) => item.id === values.dpnId);
      if (!dpn) {
        message.error('请选择有效的 DPN');
        return;
      }

      const payload = {
        relatedType: 'DPN',
        relatedId: dpn.id,
        relatedNo: dpn.dpnNo,
        feeType: values.feeType,
        feeDirection: 'PAYABLE',
        amount: values.amount,
        currency: values.currency,
        description: values.description || '',
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

  const handleSubmitReview = async (record: DpnFeeRecord) => {
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

  const handleWithdrawToDraft = (record: DpnFeeRecord) => {
    updateWorkflowState((prev) => ({
      ...prev,
      draftOverrides: { ...prev.draftOverrides, [record.id]: true },
    }));
    message.success('已撤回到草稿');
  };

  const handleApprove = async (record: DpnFeeRecord) => {
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

  const handleReject = async (record: DpnFeeRecord) => {
    try {
      await feeApi.reject(record.id, getCurrentUser(), '演示驳回：请补充配送费用依据');
      updateWorkflowState((prev) => {
        const nextDraft = { ...prev.draftOverrides };
        delete nextDraft[record.id];
        return {
          ...prev,
          draftOverrides: nextDraft,
        };
      });
      message.success('已驳回，可编辑后重提');
      await loadData();
    } catch (err: any) {
      message.error(err.message || '驳回失败');
    }
  };

  const handlePay = async (record: DpnFeeRecord) => {
    try {
      await feeApi.pay(record.id, {
        paymentMethod: 'BANK_TRANSFER',
        paymentChannel: '对公账户',
        paymentAccount: 'DPN-DELIVERY-ACCOUNT',
        operator: getCurrentUser(),
      });
      message.success('已确认支付');
      await loadData();
    } catch (err: any) {
      message.error(err.message || '支付失败');
    }
  };

  const handleDeleteDraft = (record: DpnFeeRecord) => {
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

  const openChangeModal = (record: DpnFeeRecord) => {
    setChangeTarget(record);
    changeForm.setFieldsValue({
      reason: '',
      items: [
        {
          feeType: record.feeType,
          changeType: 'UPDATE',
          currency: record.currency,
          feeDirection: 'PAYABLE',
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
        feeDirection: item.feeDirection || 'PAYABLE',
        originalAmount: item.originalAmount,
        newAmount: item.newAmount,
        remark: item.remark,
      }));

      updateWorkflowState((prev) =>
        createChangeRequest(prev, {
          feeId: changeTarget.id,
          feeNo: changeTarget.feeNo,
          reason,
          applicant: getCurrentUser(),
          items: normalized,
        }),
      );

      message.success('更改申请已提交（演示流程）');
      setChangeModalVisible(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || '提交失败');
    }
  };

  const handleReviewChangeRequest = (record: DpnFeeRecord, status: 'APPROVED' | 'REJECTED') => {
    updateWorkflowState((prev) =>
      reviewChangeRequest(prev, {
        feeId: record.id,
        status,
        reviewer: '财务经理(演示)',
        reviewComment: status === 'APPROVED' ? '允许进入草稿修改' : '变更理由不足',
      }),
    );
    message.success(status === 'APPROVED' ? '更改申请已通过，单据已回到草稿' : '更改申请已驳回');
  };

  const handleOpenDetail = async (record: DpnFeeRecord) => {
    setDetailVisible(true);
    setDetailTitle(`DPN 成本详情 - ${record.dpnNo}`);

    const relatedEntries = enrichedData
      .filter((item) => item.dpnId === record.dpnId || item.dpnNo === record.dpnNo)
      .map((item) => ({
        id: item.id,
        feeNo: item.feeNo,
        relatedNo: item.dpnNo,
        feeType: item.feeType,
        feeDirection: 'PAYABLE',
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
      { label: 'DPN号', value: record.dpnNo },
      { label: '收件人', value: record.recipientName || '-' },
      { label: '电话', value: record.recipientPhone || '-' },
      { label: '地址', value: record.recipientAddress || '-' },
      { label: '运单数量', value: record.waybillCount },
      { label: '总件数', value: record.pieces },
      { label: '总重量', value: `${record.totalWeight.toFixed(2)} Kg` },
      { label: '当前费用编号', value: record.feeNo },
    ]);

    setDetailLoading(true);
    try {
      const raw = await deliveryApi.list({});
      const rows = ((raw as any).data || raw || []) as any[];
      const current = rows.find((item: any) => String(item.id) === record.dpnId || item.dpnNo === record.dpnNo);
      if (current) {
        setDetailInfoItems([
          { label: 'DPN号', value: current.dpnNo || record.dpnNo },
          { label: '收件人', value: current.recipientName || '-' },
          { label: '电话', value: current.recipientPhone || '-' },
          { label: '地址', value: current.recipientAddress || '-' },
          { label: '运单数量', value: Array.isArray(current.items) ? current.items.length : record.waybillCount },
          { label: '总件数', value: Number(current.totalPieces || 0) },
          { label: '总重量', value: `${Number(current.totalWeight || 0).toFixed(2)} Kg` },
          { label: '当前费用编号', value: record.feeNo },
        ]);
      }
    } catch {
      message.warning('DPN 基础信息读取失败，已显示费用台账');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    { title: '费用编号', dataIndex: 'feeNo', key: 'feeNo', width: 140 },
    {
      title: 'DPN编号',
      dataIndex: 'dpnNo',
      key: 'dpnNo',
      width: 150,
      render: (text: string) => <a>{text}</a>,
    },
    {
      title: '收件信息',
      key: 'receiver',
      width: 220,
      render: (_: unknown, record: DpnFeeRecord) => (
        <div>
          <div>{record.recipientName || '-'}</div>
          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{record.recipientPhone || '-'}</div>
        </div>
      ),
    },
    {
      title: '运单/件重',
      key: 'summary',
      width: 120,
      render: (_: unknown, record: DpnFeeRecord) => (
        <span>{`${record.waybillCount}单 / ${record.pieces}件 / ${record.totalWeight.toFixed(1)}kg`}</span>
      ),
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 120,
      render: (val: string) => (
        <Tag color={feeTypeColorMap[val] || 'default'}>{feeTypeLabelMap[val] || val || '-'}</Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      render: (val: number) => val.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 80 },
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
      render: (_: unknown, record: DpnFeeRecord) => {
        if (!record.changeRequest) return '-';
        const cfg = CHANGE_REQUEST_STATUS_CONFIG[record.changeRequest.status];
        return <Tag color={cfg.color}>{cfg.text}</Tag>;
      },
    },
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
      render: (_: unknown, record: DpnFeeRecord) => {
        const cr = record.changeRequest;
        const canApplyChange = record.uiStatus === 'APPROVED' && (!cr || cr.status !== 'PENDING');
        return (
          <Space size={4} wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleOpenDetail(record)}>
              详情
            </Button>
            {(record.uiStatus === 'DRAFT' || record.uiStatus === 'REJECTED') && (
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                编辑
              </Button>
            )}
            {(record.uiStatus === 'DRAFT' || record.uiStatus === 'REJECTED') && (
              <Button type="link" size="small" onClick={() => handleSubmitReview(record)}>
                提交审核
              </Button>
            )}
            {record.uiStatus === 'PENDING' && (
              <Button type="link" size="small" onClick={() => handleWithdrawToDraft(record)}>
                撤回草稿
              </Button>
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
            {record.uiStatus === 'APPROVED' && (
              <Popconfirm title="确认已支付该费用？" onConfirm={() => handlePay(record)}>
                <Button type="link" size="small">确认支付</Button>
              </Popconfirm>
            )}
            {record.uiStatus === 'DRAFT' && (
              <Popconfirm title="删除后仅前端隐藏，确认继续？" onConfirm={() => handleDeleteDraft(record)}>
                <Button type="link" size="small" danger>删除</Button>
              </Popconfirm>
            )}
            {canApplyChange && (
              <Button type="link" size="small" icon={<FileSyncOutlined />} onClick={() => openChangeModal(record)}>
                申请更改
              </Button>
            )}
            {cr?.status === 'PENDING' && (
              <Button type="link" size="small" onClick={() => handleReviewChangeRequest(record, 'APPROVED')}>
                模拟批复
              </Button>
            )}
            {cr?.status === 'PENDING' && (
              <Button type="link" size="small" danger onClick={() => handleReviewChangeRequest(record, 'REJECTED')}>
                驳回申请
              </Button>
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
        message="DPN成本演示：草稿录入 -> 提交审核 -> 审核通过 -> 支付；审核后调整请走更改申请。"
      />

      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">总费用 {stats.total}</Tag>
        <Tag>草稿 {stats.draft}</Tag>
        <Tag color="orange">待审核 {stats.pending}</Tag>
        <Tag color="green">已审核 {stats.approved}</Tag>
        <Tag color="processing">已支付 {stats.paid}</Tag>
        <Tag color="blue">总金额 NGN {stats.totalAmount.toFixed(2)}</Tag>
      </div>

      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Space wrap>
          <Input
            placeholder="DPN号/费用号/收件人"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
            allowClear
          />
          <Select placeholder="费用类型" value={filterFeeType || undefined} onChange={setFilterFeeType} style={{ width: 140 }} allowClear>
            {feeTypeOptions.map((item) => (
              <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
            ))}
          </Select>
          <Select placeholder="状态" value={filterStatus || undefined} onChange={setFilterStatus} style={{ width: 140 }} allowClear>
            {Object.entries(UI_STATUS_CONFIG).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v.text}</Select.Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新增费用</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        scroll={{ x: 1900, y: 'calc(100vh - 430px)' }}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        size="small"
      />

      <Modal
        title={editingRecord ? `编辑草稿 - ${editingRecord.feeNo}` : '新增 DPN 成本草稿'}
        open={modalVisible}
        onOk={handleSaveDraft}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        okText="保存草稿"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="dpnId" label="关联 DPN" rules={[{ required: true, message: '请选择 DPN' }]}>
            <Select placeholder="请选择 DPN" showSearch optionFilterProp="children">
              {dpnOptions.map((item) => (
                <Select.Option key={item.id} value={item.id}>
                  {`${item.dpnNo} / ${item.recipientName} / ${item.totalPieces}件 ${item.totalWeight}kg`}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="feeType" label="费用类型" rules={[{ required: true, message: '请选择费用类型' }]}>
            <Select placeholder="请选择费用类型">
              {feeTypeOptions.map((item) => (
                <Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col span={14}><Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入金额" /></Form.Item></Col>
            <Col span={10}><Form.Item name="currency" label="币种" initialValue="NGN" rules={[{ required: true }]}><Select>{currencyOptions.map((item) => (<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>))}</Select></Form.Item></Col>
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
        width={860}
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
                      <Col span={6}>
                        <Form.Item name={[field.name, 'feeType']} label="费用项目" rules={[{ required: true, message: '必填' }]}>
                          <Select placeholder="选择项目">{feeTypeOptions.map((item) => (<Select.Option key={item.value} value={item.value}>{item.label}</Select.Option>))}</Select>
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item name={[field.name, 'changeType']} label="变更类型" rules={[{ required: true, message: '必填' }]}>
                          <Select options={CHANGE_TYPE_OPTIONS} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[field.name, 'originalAmount']} label="原金额">
                          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item name={[field.name, 'newAmount']} label="新金额">
                          <InputNumber style={{ width: '100%' }} min={0} precision={2} />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Form.Item name={[field.name, 'currency']} label="币种" rules={[{ required: true, message: '必填' }]}>
                          <Select>{currencyOptions.map((item) => (<Select.Option key={item.value} value={item.value}>{item.value}</Select.Option>))}</Select>
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
                <Button type="dashed" onClick={() => add({ changeType: 'UPDATE', currency: 'NGN', feeDirection: 'PAYABLE' })} block>
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
