import React, { useState, useMemo } from 'react';
import {
  Table, Button, Select, Tag, Space, Row, Col,
  Modal, Form, Input, InputNumber, message,
  Descriptions, Divider, Typography, Drawer, Alert
} from 'antd';
import {
  CheckCircleOutlined, PlusOutlined, ReloadOutlined,
  DollarOutlined, EyeOutlined, TruckOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ListPageToolbar, ListPageToolbarActions, ListPageToolbarCard,
  ListPageToolbarField, ListPageToolbarFilters,
} from '../../../components/ListPageToolbar';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

// ======== 类型 ========

type ReturnSource = 'ORDER_CANCEL' | 'STOCK_RETURN' | 'PACKING_RETURN' | 'NO_ORDER_RETURN' | 'MANUAL';
type ReturnType = 'CUSTOMER_CANCEL' | 'GOODS_ISSUE' | 'ADDRESS_ERROR' | 'NO_ORDER' | 'CUSTOMS' | 'CLIENT' | 'OTHER';
type ReturnStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'SETTLING' | 'SETTLED' | 'EXECUTING' | 'COMPLETED' | 'REJECTED' | 'CLOSED';
type DisposalMethod = 'RETURN_TO_CUSTOMER' | 'RETURN_TO_STOCK' | 'DESTROY';
type RefundItemMark = 'REFUNDABLE' | 'NON_REFUNDABLE' | 'CUSTOMER_OWES';

interface FeeSettlementItem {
  feeId: string;
  feeType: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  mark: RefundItemMark;
}

interface ReturnRecord {
  id: string;
  returnNo: string;
  source: ReturnSource;
  masterOrderNo: string;
  subOrderNos: string[];
  businessLine?: 'SEA' | 'AIR';
  clientName: string;
  route?: string;
  containerNo?: string;
  pieces: number;
  weight: number;
  returnType: ReturnType;
  returnReason: string;
  disposalMethod?: DisposalMethod;
  status: ReturnStatus;
  customerPaid: number;
  nonRefundableTotal: number;
  customerOwesTotal: number;
  refundAmount: number;
  refundStatus?: string;
  supplementStatus?: string;
  settlementItems?: FeeSettlementItem[];
  applicant: string;
  processor?: string;
  approver?: string;
  createdAt: string;
  updatedAt: string;
}

// ======== 配置 ========

const STATUS_CFG: Record<ReturnStatus, { text: string; color: string }> = {
  PENDING_APPROVAL: { text: '待审批', color: 'orange' },
  APPROVED: { text: '待结算', color: 'blue' },
  SETTLING: { text: '结算中', color: 'processing' },
  SETTLED: { text: '待执行', color: 'cyan' },
  EXECUTING: { text: '执行中', color: 'geekblue' },
  COMPLETED: { text: '已完成', color: 'green' },
  REJECTED: { text: '已驳回', color: 'red' },
  CLOSED: { text: '已关闭', color: 'default' },
};

const SOURCE_LABEL: Record<ReturnSource, string> = {
  ORDER_CANCEL: '客户取消订单', STOCK_RETURN: '库存退运', PACKING_RETURN: '装箱后退运',
  NO_ORDER_RETURN: '无订单退回', MANUAL: '手动创建',
};

const TYPE_CFG: Record<string, { text: string; color: string }> = {
  CUSTOMER_CANCEL: { text: '客户取消', color: 'warning' }, GOODS_ISSUE: { text: '货物问题', color: 'error' },
  ADDRESS_ERROR: { text: '地址错误', color: 'orange' }, NO_ORDER: { text: '无订单', color: 'default' },
  CUSTOMS: { text: '海关退运', color: 'error' }, CLIENT: { text: '客户退单', color: 'warning' }, OTHER: { text: '其他', color: 'default' },
};

const DISPOSAL_LABEL: Record<DisposalMethod, string> = {
  RETURN_TO_CUSTOMER: '退回客户', RETURN_TO_STOCK: '退回入库', DESTROY: '销毁',
};

// ======== Mock ========

const MOCK: ReturnRecord[] = [
  // ① PENDING_APPROVAL — 客户取消订单，预付已付980，2个子单，等待主管审批
  {
    id: 'R-1', returnNo: 'R-20260331-0001', source: 'ORDER_CANCEL', masterOrderNo: 'S-20260320000001',
    subOrderNos: ['S-20260320000001-01', 'S-20260320000001-02'], businessLine: 'SEA', clientName: '联调私海客户SEA-20260320',
    route: 'GZ.CN→LOS.NGA', pieces: 2, weight: 40.5, returnType: 'CUSTOMER_CANCEL',
    returnReason: '客户不想要了，已沟通确认全部退回，要求退货退款。客户已付预付款980元。',
    disposalMethod: 'RETURN_TO_CUSTOMER', status: 'PENDING_APPROVAL',
    customerPaid: 980, nonRefundableTotal: 0, customerOwesTotal: 0, refundAmount: 0,
    applicant: '销售A', createdAt: '2026-03-31 09:00', updatedAt: '2026-03-31 09:00',
  },
  // ② APPROVED — 库存退运，货物破损，审批已通过待财务结算，有3笔费用待标记
  {
    id: 'R-2', returnNo: 'R-20260331-0002', source: 'STOCK_RETURN', masterOrderNo: 'S-20260320000002',
    subOrderNos: ['S-20260320000002-01'], businessLine: 'SEA', clientName: '联调综合客户1-20260320',
    route: 'GZ.CN→LOS.NGA', containerNo: 'KK3', pieces: 1, weight: 30, returnType: 'GOODS_ISSUE',
    returnReason: '货物外包装严重破损，内件受潮，客户拒收要求退回仓库。仓库已拍照留存，附照片3张。',
    disposalMethod: 'RETURN_TO_STOCK', status: 'APPROVED',
    customerPaid: 600, nonRefundableTotal: 0, customerOwesTotal: 0, refundAmount: 0,
    applicant: '李仓管', approver: '主管A', createdAt: '2026-03-30 14:00', updatedAt: '2026-03-31 10:00',
    settlementItems: [
      { feeId: 'F1', feeType: '运费', amount: 500, currency: 'CNY', paymentStatus: '已付', mark: 'REFUNDABLE' },
      { feeId: 'F2', feeType: '打木架费', amount: 80, currency: 'CNY', paymentStatus: '已付', mark: 'NON_REFUNDABLE' },
      { feeId: 'F3', feeType: '仓储费(7天)', amount: 50, currency: 'CNY', paymentStatus: '未付(垫付)', mark: 'CUSTOMER_OWES' },
    ],
  },
  // ③ SETTLING — 到付客户取消，仓库已垫付150元，客户需先补缴才能放货
  {
    id: 'R-3', returnNo: 'R-20260331-0003', source: 'ORDER_CANCEL', masterOrderNo: 'S-20260320000004',
    subOrderNos: ['S-20260320000004-01'], businessLine: 'SEA', clientName: '联调综合客户1-20260320',
    route: 'GZ.CN→LOS.NGA', pieces: 1, weight: 19, returnType: 'CUSTOMER_CANCEL',
    returnReason: '客户取消整单。该订单为到付，客户未支付任何费用，但仓库已垫付仓储费100元和入库操作费50元，需客户补缴后放货。',
    disposalMethod: 'RETURN_TO_CUSTOMER', status: 'SETTLING',
    customerPaid: 0, nonRefundableTotal: 0, customerOwesTotal: 150, refundAmount: -150,
    supplementStatus: 'PENDING', applicant: '销售A', approver: '主管A',
    createdAt: '2026-03-28 10:00', updatedAt: '2026-03-31 09:30',
    settlementItems: [
      { feeId: 'F4', feeType: '仓储费(12天)', amount: 100, currency: 'CNY', paymentStatus: '未付(垫付)', mark: 'CUSTOMER_OWES' },
      { feeId: 'F5', feeType: '入库操作费', amount: 50, currency: 'CNY', paymentStatus: '未付(垫付)', mark: 'CUSTOMER_OWES' },
    ],
  },
  // ④ SETTLED — 费用已结清，应退950元（待财务退款），等待仓库执行退运
  {
    id: 'R-4', returnNo: 'R-20260331-0004', source: 'STOCK_RETURN', masterOrderNo: 'S-20260320000003',
    subOrderNos: ['S-20260320000003-02'], businessLine: 'SEA', clientName: '联调综合客户2-20260320',
    route: 'GZ.CN→LOS.NGA', pieces: 1, weight: 15, returnType: 'CUSTOMER_CANCEL',
    returnReason: '客户取消该子单，其余子单继续发运。客户已付1200元，扣除打木架费200元和待补缴仓储费50元后应退950元。',
    disposalMethod: 'RETURN_TO_CUSTOMER', status: 'SETTLED',
    customerPaid: 1200, nonRefundableTotal: 200, customerOwesTotal: 50, refundAmount: 950,
    refundStatus: 'PENDING', applicant: '销售B', approver: '主管A',
    createdAt: '2026-03-29 11:00', updatedAt: '2026-03-31 08:00',
    settlementItems: [
      { feeId: 'F6', feeType: '运费', amount: 900, currency: 'CNY', paymentStatus: '已付', mark: 'REFUNDABLE' },
      { feeId: 'F7', feeType: '配送费', amount: 100, currency: 'CNY', paymentStatus: '已付', mark: 'REFUNDABLE' },
      { feeId: 'F8', feeType: '打木架费', amount: 200, currency: 'CNY', paymentStatus: '已付', mark: 'NON_REFUNDABLE' },
      { feeId: 'F9', feeType: '仓储费(5天)', amount: 50, currency: 'CNY', paymentStatus: '未付(垫付)', mark: 'CUSTOMER_OWES' },
    ],
  },
  // ⑤ EXECUTING — 退运执行中，仓管正在安排退回快递
  {
    id: 'R-5', returnNo: 'R-20260331-0005', source: 'STOCK_RETURN', masterOrderNo: 'S-20260320990002',
    subOrderNos: ['S-20260320990002-01'], businessLine: 'SEA', clientName: 'Web联调客户-S183620515',
    route: 'GZ.CN→LOS.NGA', pieces: 1, weight: 9.5, returnType: 'ADDRESS_ERROR',
    returnReason: '客户收货地址错误，无法投递。客户已付1350元，扣除报关费300元后应退1050元，退款已确认。仓管正在联系顺丰安排退回。',
    disposalMethod: 'RETURN_TO_CUSTOMER', status: 'EXECUTING',
    customerPaid: 1350, nonRefundableTotal: 300, customerOwesTotal: 0, refundAmount: 1050,
    refundStatus: 'REFUNDED', processor: '李仓管', applicant: '销售B', approver: '主管A',
    createdAt: '2026-03-27 15:00', updatedAt: '2026-03-31 11:00',
    settlementItems: [
      { feeId: 'F10', feeType: '运费', amount: 1050, currency: 'CNY', paymentStatus: '已付', mark: 'REFUNDABLE' },
      { feeId: 'F11', feeType: '出口报关费', amount: 300, currency: 'CNY', paymentStatus: '已付', mark: 'NON_REFUNDABLE' },
    ],
  },
  // ⑥ COMPLETED — 无订单快递退回，全流程已完成
  {
    id: 'R-6', returnNo: 'R-20260331-0006', source: 'NO_ORDER_RETURN', masterOrderNo: '-',
    subOrderNos: [], businessLine: 'SEA', clientName: '-', pieces: 1, weight: 9.8,
    returnType: 'NO_ORDER',
    returnReason: '无订单快递(SF2099001522)，仓库收到后无法匹配任何订单，联系发件人无回应，滞留超8天后安排退回原发件地址。',
    disposalMethod: 'RETURN_TO_CUSTOMER', status: 'COMPLETED',
    customerPaid: 0, nonRefundableTotal: 0, customerOwesTotal: 0, refundAmount: 0,
    applicant: '李仓管', processor: '李仓管', approver: '主管A',
    createdAt: '2026-03-28 16:00', updatedAt: '2026-03-29 10:00',
  },
  // ⑦ REJECTED — 装箱后退运申请被驳回（主管认为可以继续发运）
  {
    id: 'R-7', returnNo: 'R-20260331-0007', source: 'PACKING_RETURN', masterOrderNo: 'S-20260320000003',
    subOrderNos: ['S-20260320000003-01'], businessLine: 'SEA', clientName: '联调综合客户2-20260320',
    route: 'GZ.CN→LOS.NGA', containerNo: 'KK1', pieces: 1, weight: 25.3, returnType: 'GOODS_ISSUE',
    returnReason: '仓管发现该子单外包装有轻微变形，建议退运检查。已装入集装号KK1。',
    disposalMethod: 'RETURN_TO_STOCK', status: 'REJECTED',
    customerPaid: 0, nonRefundableTotal: 0, customerOwesTotal: 0, refundAmount: 0,
    applicant: '张仓管', approver: '主管A',
    createdAt: '2026-03-30 09:00', updatedAt: '2026-03-30 14:00',
  },
  // ⑧ CLOSED — 客户反悔取消退运，退运单关闭
  {
    id: 'R-8', returnNo: 'R-20260331-0008', source: 'ORDER_CANCEL', masterOrderNo: 'S-20260320990001',
    subOrderNos: ['S-20260320990001-03', 'S-20260320990001-04'], businessLine: 'SEA', clientName: 'Web联调客户-S183620515',
    route: 'GZ.CN→LOS.NGA', pieces: 2, weight: 22, returnType: 'CUSTOMER_CANCEL',
    returnReason: '客户最初要求取消空运订单，提交退运申请后又联系销售表示继续发运，协商后关闭退运单，订单恢复正常流程。',
    disposalMethod: 'RETURN_TO_CUSTOMER', status: 'CLOSED',
    customerPaid: 2600, nonRefundableTotal: 0, customerOwesTotal: 0, refundAmount: 0,
    applicant: '销售B', approver: '主管A',
    createdAt: '2026-03-29 08:30', updatedAt: '2026-03-29 16:00',
  },
];

// ======== 组件 ========

export const ReturnProcess = ({ businessMode = 'ALL' }: { warehouseId?: string; businessMode?: 'ALL' | 'SEA' | 'AIR' }) => {
  const [records, setRecords] = useState<ReturnRecord[]>(MOCK);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [detailRecord, setDetailRecord] = useState<ReturnRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [settleRecord, setSettleRecord] = useState<ReturnRecord | null>(null);
  const [settleVisible, setSettleVisible] = useState(false);

  const stats = useMemo(() => {
    const s = { pendingApproval: 0, settling: 0, customerOwes: 0, executing: 0, completed: 0, rejected: 0 };
    records.forEach(r => {
      if (r.status === 'PENDING_APPROVAL') s.pendingApproval++;
      else if (['APPROVED', 'SETTLING'].includes(r.status)) s.settling++;
      else if (r.status === 'SETTLED' || r.status === 'EXECUTING') s.executing++;
      else if (r.status === 'COMPLETED') s.completed++;
      else if (r.status === 'REJECTED') s.rejected++;
      if (r.supplementStatus === 'PENDING') s.customerOwes++;
    });
    return s;
  }, [records]);

  const filtered = useMemo(() => {
    let list = [...records];
    const kw = keyword.trim().toLowerCase();
    if (kw) list = list.filter(r => `${r.returnNo} ${r.masterOrderNo} ${r.subOrderNos.join(' ')} ${r.clientName} ${r.returnReason}`.toLowerCase().includes(kw));
    if (filterStatus !== 'ALL') list = list.filter(r => r.status === filterStatus);
    if (filterSource !== 'ALL') list = list.filter(r => r.source === filterSource);
    if (businessMode !== 'ALL') list = list.filter(r => r.businessLine === businessMode);
    return list;
  }, [records, keyword, filterStatus, filterSource, businessMode]);

  const updateRecord = (id: string, patch: Partial<ReturnRecord>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch, updatedAt: dayjs().format('YYYY-MM-DD HH:mm') } : r));
  };

  const handleApprove = (record: ReturnRecord, approved: boolean) => {
    Modal.confirm({
      title: approved ? '确认通过退运审批' : '确认驳回',
      content: `${approved ? '通过' : '驳回'} ${record.returnNo}？`,
      okButtonProps: approved ? {} : { danger: true },
      onOk: () => {
        updateRecord(record.id, { status: approved ? 'APPROVED' : 'REJECTED', approver: '当前用户' });
        message.success(approved ? '退运审批已通过' : '已驳回');
      },
    });
  };

  const handleSettleMark = (feeId: string, mark: RefundItemMark) => {
    if (!settleRecord) return;
    const items = (settleRecord.settlementItems || []).map(i => i.feeId === feeId ? { ...i, mark } : i);
    const nonRef = items.filter(i => i.mark === 'NON_REFUNDABLE').reduce((s, i) => s + i.amount, 0);
    const owes = items.filter(i => i.mark === 'CUSTOMER_OWES').reduce((s, i) => s + i.amount, 0);
    const refund = settleRecord.customerPaid - nonRef - owes;
    setSettleRecord({ ...settleRecord, settlementItems: items, nonRefundableTotal: nonRef, customerOwesTotal: owes, refundAmount: refund });
  };

  const handleConfirmSettle = () => {
    if (!settleRecord) return;
    const refund = settleRecord.refundAmount;
    const result = refund > 0 ? 'REFUND' : refund === 0 ? 'EVEN' : 'CUSTOMER_OWES';
    updateRecord(settleRecord.id, {
      status: result === 'CUSTOMER_OWES' ? 'SETTLING' : 'SETTLED',
      nonRefundableTotal: settleRecord.nonRefundableTotal,
      customerOwesTotal: settleRecord.customerOwesTotal,
      refundAmount: refund,
      refundStatus: result === 'REFUND' ? 'PENDING' : 'NONE',
      supplementStatus: result === 'CUSTOMER_OWES' ? 'PENDING' : 'NONE',
      settlementItems: settleRecord.settlementItems,
    });
    setSettleVisible(false);
    message.success('费用结算已确认');
  };

  const handleCreate = () => {
    createForm.validateFields().then(values => {
      const nr: ReturnRecord = {
        id: `R-${Date.now()}`, returnNo: `R-${dayjs().format('YYYYMMDD')}-${String(records.length + 1).padStart(4, '0')}`,
        source: 'MANUAL', masterOrderNo: values.orderNo || '-', subOrderNos: values.subOrderNo ? [values.subOrderNo] : [],
        businessLine: businessMode === 'ALL' ? 'SEA' : businessMode, clientName: values.customerName, route: values.route,
        pieces: values.pieces || 0, weight: values.weight || 0, returnType: values.returnType, returnReason: values.reason,
        disposalMethod: values.disposalMethod, status: 'PENDING_APPROVAL',
        customerPaid: 0, nonRefundableTotal: 0, customerOwesTotal: 0, refundAmount: 0,
        applicant: '当前用户', createdAt: dayjs().format('YYYY-MM-DD HH:mm'), updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      };
      setRecords(prev => [nr, ...prev]);
      setCreateVisible(false);
      createForm.resetFields();
      message.success('退运单创建成功，等待审批');
    });
  };

  const columns = [
    { title: '退运单号', dataIndex: 'returnNo', key: 'returnNo', width: 170, render: (v: string) => <a onClick={() => { setDetailRecord(records.find(r => r.returnNo === v) || null); setDetailVisible(true); }}>{v}</a> },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 135 },
    { title: '来源', dataIndex: 'source', key: 'source', width: 115, render: (v: ReturnSource) => SOURCE_LABEL[v] || v },
    { title: '订单', key: 'order', width: 175, render: (_: unknown, r: ReturnRecord) => (<div><div style={{ fontWeight: 500 }}>{r.masterOrderNo}</div>{r.subOrderNos.length > 0 && <div style={{ fontSize: 12, color: '#999' }}>{r.subOrderNos.join(', ')}</div>}</div>) },
    { title: '业务线', dataIndex: 'businessLine', key: 'bl', width: 75, render: (v: string) => <Tag color={v === 'AIR' ? 'gold' : 'blue'}>{v || '-'}</Tag> },
    { title: '客户', dataIndex: 'clientName', key: 'client', width: 155 },
    { title: '货物', key: 'cargo', width: 110, render: (_: unknown, r: ReturnRecord) => `${r.pieces}件 / ${r.weight}kg` },
    { title: '退运类型', dataIndex: 'returnType', key: 'type', width: 95, render: (v: string) => { const c = TYPE_CFG[v]; return c ? <Tag color={c.color}>{c.text}</Tag> : <Tag>{v}</Tag>; } },
    { title: '处置方式', dataIndex: 'disposalMethod', key: 'disposal', width: 90, render: (v: DisposalMethod) => v ? DISPOSAL_LABEL[v] : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (v: ReturnStatus) => <Tag color={STATUS_CFG[v]?.color}>{STATUS_CFG[v]?.text}</Tag> },
    {
      title: '费用结算', key: 'settle', width: 140,
      render: (_: unknown, r: ReturnRecord) => {
        if (r.source === 'NO_ORDER_RETURN') return <Tag>无需结算</Tag>;
        if (['PENDING_APPROVAL', 'REJECTED', 'CLOSED'].includes(r.status)) return '-';
        if (r.refundAmount > 0) return <Space size={4}><Tag color="green">退¥{r.refundAmount.toFixed(0)}</Tag>{r.refundStatus === 'REFUNDED' ? <Tag color="success">已退</Tag> : <Tag color="orange">待退</Tag>}</Space>;
        if (r.refundAmount < 0) return <Space size={4}><Tag color="red">补¥{Math.abs(r.refundAmount).toFixed(0)}</Tag>{r.supplementStatus === 'PAID' ? <Tag color="success">已缴</Tag> : <Tag color="orange">待缴</Tag>}</Space>;
        if (r.status === 'APPROVED') return <Tag color="blue">待结算</Tag>;
        return <Tag>已结清</Tag>;
      },
    },
    {
      title: '操作', key: 'action', width: 200, fixed: 'right' as const,
      render: (_: unknown, r: ReturnRecord) => (
        <Space size={4} wrap>
          {r.status === 'PENDING_APPROVAL' && (<><Button type="link" size="small" onClick={() => handleApprove(r, true)}>通过</Button><Button type="link" size="small" danger onClick={() => handleApprove(r, false)}>驳回</Button></>)}
          {r.status === 'APPROVED' && r.source !== 'NO_ORDER_RETURN' && <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => { setSettleRecord({ ...r }); setSettleVisible(true); }}>费用结算</Button>}
          {r.status === 'APPROVED' && r.source === 'NO_ORDER_RETURN' && <Button type="link" size="small" onClick={() => { updateRecord(r.id, { status: 'EXECUTING', processor: '当前用户' }); message.success('退运开始执行'); }}>执行退运</Button>}
          {r.status === 'SETTLING' && r.supplementStatus === 'PENDING' && <Button type="link" size="small" style={{ color: '#fa8c16' }} onClick={() => { updateRecord(r.id, { supplementStatus: 'PAID', status: 'SETTLED' }); message.success('补缴已确认'); }}>确认补缴</Button>}
          {r.status === 'SETTLED' && <Button type="link" size="small" icon={<TruckOutlined />} onClick={() => { updateRecord(r.id, { status: 'EXECUTING', processor: '当前用户' }); message.success('退运开始执行'); }}>执行退运</Button>}
          {r.status === 'EXECUTING' && <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => { updateRecord(r.id, { status: 'COMPLETED' }); message.success('退运已完成'); }}>完成</Button>}
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setDetailRecord(r); setDetailVisible(true); }}>详情</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="orange">待审批 {stats.pendingApproval}</Tag>
        <Tag color="blue">待结算 {stats.settling}</Tag>
        <Tag color="red">待补缴 {stats.customerOwes}</Tag>
        <Tag color="cyan">待执行 {stats.executing}</Tag>
        <Tag color="green">已完成 {stats.completed}</Tag>
        {stats.rejected > 0 && <Tag color="default">已驳回 {stats.rejected}</Tag>}
        <Tag>总计 {records.length}</Tag>
      </div>
      <ListPageToolbarCard style={{ marginBottom: 10 }}>
        <ListPageToolbar>
          <ListPageToolbarFilters>
            <ListPageToolbarField flex="1 1 280px" minWidth={220}><Input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜索退运单号/主单号/客户/原因" allowClear /></ListPageToolbarField>
            <ListPageToolbarField minWidth={120}><Select value={filterStatus} onChange={setFilterStatus} style={{ width: '100%' }}>
              <Option value="ALL">全部状态</Option>
              {Object.entries(STATUS_CFG).map(([k, v]) => <Option key={k} value={k}>{v.text}</Option>)}
            </Select></ListPageToolbarField>
            <ListPageToolbarField minWidth={130}><Select value={filterSource} onChange={setFilterSource} style={{ width: '100%' }}>
              <Option value="ALL">全部来源</Option>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Select></ListPageToolbarField>
          </ListPageToolbarFilters>
          <ListPageToolbarActions>
            <Button icon={<ReloadOutlined />} onClick={() => { setKeyword(''); setFilterStatus('ALL'); setFilterSource('ALL'); }}>重置</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新建退运</Button>
          </ListPageToolbarActions>
        </ListPageToolbar>
      </ListPageToolbarCard>

      <Table rowKey="id" columns={columns} dataSource={filtered} scroll={{ x: 1700 }} pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }} size="small" />

      {/* 新建退运 */}
      <Modal title="新建退运" open={createVisible} onOk={handleCreate} onCancel={() => { setCreateVisible(false); createForm.resetFields(); }} width={680}>
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="orderNo" label="主运单号"><Input placeholder="可选" /></Form.Item></Col>
            <Col span={12}><Form.Item name="subOrderNo" label="子运单号"><Input placeholder="可选" /></Form.Item></Col>
            <Col span={12}><Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="returnType" label="退运类型" rules={[{ required: true }]}>
              <Select><Option value="CUSTOMER_CANCEL">客户取消</Option><Option value="GOODS_ISSUE">货物问题</Option><Option value="ADDRESS_ERROR">地址错误</Option><Option value="OTHER">其他</Option></Select>
            </Form.Item></Col>
            <Col span={12}><Form.Item name="disposalMethod" label="货物处置方式" rules={[{ required: true }]}>
              <Select><Option value="RETURN_TO_CUSTOMER">退回客户</Option><Option value="RETURN_TO_STOCK">退回入库</Option><Option value="DESTROY">销毁</Option></Select>
            </Form.Item></Col>
            <Col span={6}><Form.Item name="pieces" label="件数" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="weight" label="重量(kg)" rules={[{ required: true }]}><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="route" label="线路"><Input placeholder="可选" /></Form.Item></Col>
            <Col span={24}><Form.Item name="reason" label="退运原因" rules={[{ required: true }]}><TextArea rows={3} maxLength={300} showCount /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* 费用结算 */}
      <Drawer title={`费用结算 - ${settleRecord?.returnNo || ''}`} open={settleVisible} onClose={() => setSettleVisible(false)} width={720}
        footer={<div style={{ textAlign: 'right' }}><Space><Button onClick={() => setSettleVisible(false)}>取消</Button><Button type="primary" onClick={handleConfirmSettle}>确认结算</Button></Space></div>}>
        {settleRecord && (<>
          <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="退运单号">{settleRecord.returnNo}</Descriptions.Item>
            <Descriptions.Item label="客户">{settleRecord.clientName}</Descriptions.Item>
            <Descriptions.Item label="订单号">{settleRecord.masterOrderNo}</Descriptions.Item>
            <Descriptions.Item label="退运原因">{settleRecord.returnReason}</Descriptions.Item>
          </Descriptions>
          <Alert style={{ marginBottom: 16 }} type="info" showIcon message="请逐条标记每笔费用：可退（退还客户）、不可退（已消费如打木架/仓储费）、待补缴（到付场景仓库已垫付客户未付）。" />
          <Table rowKey="feeId" size="small" pagination={false} dataSource={settleRecord.settlementItems || []} columns={[
            { title: '费用项目', dataIndex: 'feeType', width: 120 },
            { title: '金额', dataIndex: 'amount', width: 100, render: (v: number) => `¥${v.toFixed(2)}` },
            { title: '币种', dataIndex: 'currency', width: 70 },
            { title: '支付状态', dataIndex: 'paymentStatus', width: 110 },
            { title: '退款标记', dataIndex: 'mark', width: 200, render: (v: RefundItemMark, row: FeeSettlementItem) => (
              <Select value={v} size="small" style={{ width: '100%' }} onChange={(val: RefundItemMark) => handleSettleMark(row.feeId, val)}>
                <Option value="REFUNDABLE"><Tag color="green">可退</Tag></Option>
                <Option value="NON_REFUNDABLE"><Tag color="red">不可退（已消费）</Tag></Option>
                <Option value="CUSTOMER_OWES"><Tag color="orange">待补缴</Tag></Option>
              </Select>
            )},
          ]} />
          <Divider />
          <Row gutter={32}>
            <Col span={6} style={{ textAlign: 'center' }}><Text type="secondary" style={{ fontSize: 12 }}>客户已付</Text><div style={{ fontSize: 20, fontWeight: 600, color: '#1677ff' }}>¥{settleRecord.customerPaid.toFixed(2)}</div></Col>
            <Col span={6} style={{ textAlign: 'center' }}><Text type="secondary" style={{ fontSize: 12 }}>不可退（已消费）</Text><div style={{ fontSize: 20, fontWeight: 600, color: '#cf1322' }}>¥{settleRecord.nonRefundableTotal.toFixed(2)}</div></Col>
            <Col span={6} style={{ textAlign: 'center' }}><Text type="secondary" style={{ fontSize: 12 }}>待补缴（客户欠）</Text><div style={{ fontSize: 20, fontWeight: 600, color: '#fa8c16' }}>¥{settleRecord.customerOwesTotal.toFixed(2)}</div></Col>
            <Col span={6} style={{ textAlign: 'center' }}><Text type="secondary" style={{ fontSize: 12 }}>{settleRecord.refundAmount >= 0 ? '应退客户' : '客户需补缴'}</Text><div style={{ fontSize: 20, fontWeight: 600, color: settleRecord.refundAmount >= 0 ? '#52c41a' : '#cf1322' }}>¥{Math.abs(settleRecord.refundAmount).toFixed(2)}</div></Col>
          </Row>
        </>)}
      </Drawer>

      {/* 详情 */}
      <Drawer title={`退运详情 - ${detailRecord?.returnNo || ''}`} open={detailVisible} onClose={() => setDetailVisible(false)} width={640}>
        {detailRecord && (<>
          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="退运单号">{detailRecord.returnNo}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={STATUS_CFG[detailRecord.status]?.color}>{STATUS_CFG[detailRecord.status]?.text}</Tag></Descriptions.Item>
            <Descriptions.Item label="来源">{SOURCE_LABEL[detailRecord.source]}</Descriptions.Item>
            <Descriptions.Item label="退运类型"><Tag color={TYPE_CFG[detailRecord.returnType]?.color}>{TYPE_CFG[detailRecord.returnType]?.text}</Tag></Descriptions.Item>
            <Descriptions.Item label="主单号">{detailRecord.masterOrderNo}</Descriptions.Item>
            <Descriptions.Item label="子单号">{detailRecord.subOrderNos.join(', ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="业务线">{detailRecord.businessLine || '-'}</Descriptions.Item>
            <Descriptions.Item label="客户">{detailRecord.clientName}</Descriptions.Item>
            <Descriptions.Item label="路线">{detailRecord.route || '-'}</Descriptions.Item>
            <Descriptions.Item label="货物处置">{detailRecord.disposalMethod ? DISPOSAL_LABEL[detailRecord.disposalMethod] : '-'}</Descriptions.Item>
            <Descriptions.Item label="货物">{detailRecord.pieces}件 / {detailRecord.weight}kg</Descriptions.Item>
            <Descriptions.Item label="集装号">{detailRecord.containerNo || '-'}</Descriptions.Item>
            <Descriptions.Item label="退运原因" span={2}>{detailRecord.returnReason}</Descriptions.Item>
            <Descriptions.Item label="申请人">{detailRecord.applicant}</Descriptions.Item>
            <Descriptions.Item label="审批人">{detailRecord.approver || '-'}</Descriptions.Item>
            <Descriptions.Item label="处理人">{detailRecord.processor || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{detailRecord.createdAt}</Descriptions.Item>
          </Descriptions>
          {detailRecord.source !== 'NO_ORDER_RETURN' && !['PENDING_APPROVAL', 'REJECTED'].includes(detailRecord.status) && (<>
            <Divider>费用结算</Divider>
            <Row gutter={16}>
              <Col span={6} style={{ textAlign: 'center' }}><Text type="secondary">客户已付</Text><div style={{ fontSize: 18, fontWeight: 600 }}>¥{detailRecord.customerPaid.toFixed(2)}</div></Col>
              <Col span={6} style={{ textAlign: 'center' }}><Text type="secondary">不可退</Text><div style={{ fontSize: 18, fontWeight: 600, color: '#cf1322' }}>¥{detailRecord.nonRefundableTotal.toFixed(2)}</div></Col>
              <Col span={6} style={{ textAlign: 'center' }}><Text type="secondary">待补缴</Text><div style={{ fontSize: 18, fontWeight: 600, color: '#fa8c16' }}>¥{detailRecord.customerOwesTotal.toFixed(2)}</div></Col>
              <Col span={6} style={{ textAlign: 'center' }}><Text type="secondary">{detailRecord.refundAmount >= 0 ? '应退' : '需补缴'}</Text><div style={{ fontSize: 18, fontWeight: 600, color: detailRecord.refundAmount >= 0 ? '#52c41a' : '#cf1322' }}>¥{Math.abs(detailRecord.refundAmount).toFixed(2)}</div></Col>
            </Row>
            {detailRecord.refundStatus === 'PENDING' && <Alert style={{ marginTop: 12 }} type="warning" showIcon message="退款待财务确认，请在 财务中心→往来账款 处理退款" />}
            {detailRecord.supplementStatus === 'PENDING' && <Alert style={{ marginTop: 12 }} type="error" showIcon message="客户需补缴费用后才能放货退运，请通知客户付款" />}
          </>)}
        </>)}
      </Drawer>
    </div>
  );
};
