import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Row,
  Col,
  Tooltip,
  Modal,
  DatePicker,
  Form,
  message,
  Drawer,
  Descriptions,
  InputNumber,
  Checkbox,
  Alert,
  Anchor,
  Upload,
  Popconfirm,
  Typography,
  Steps,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ApartmentOutlined,
  DollarOutlined,
  EyeOutlined,
  UploadOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import type { LegacyContainer, LegacyTask, LegacyJob, LegacyOrderItem } from './taskManagerLegacyData';
import { LEGACY_TASKS } from './taskManagerLegacyData';

const { Option } = Select;
const { Text } = Typography;

export type LegacyTaskMode = 'ORIGIN' | 'DEST';

type TaskStatus = LegacyTask['status'];
type CargoFilter = LegacyJob['cargoFilter'];

interface LegacyNodeRecord {
  nodeCode: string;
  nodeName: string;
  isAbnormal?: boolean;
  date?: string;
  remark?: string;
  updatedAt?: string;
  operator?: string;
  attachments?: LegacyAttachment[];
}

interface LegacyAttachment {
  uid: string;
  name: string;
  size: number;
  type?: string;
  previewUrl?: string;
}

interface NodeChangeRow {
  key: string;
  order: number;
  nodeName: string;
  time: string;
  isAbnormal: boolean;
  remark: string;
  operator: string;
  attachments: LegacyAttachment[];
}

interface LegacyCostItem {
  id: string;
  feeType: string;
  amount: number;
  currency: string;
  status?: string;
  createdAt?: string;
  createdBy?: string;
}

// ---- 成本录入（与 JobCostInputPOL 共享 localStorage） ----
type CostRelationLevel = 'JOB' | 'UNIT' | 'ORDER' | 'SUB_ORDER';
type CostItemReviewStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface CostInputItem {
  id: string;
  kind: 'NORMAL' | 'CHANGE';
  originalItemId?: string;
  originalSnapshot?: CostInputItemSnapshot;
  relationLevel: CostRelationLevel;
  relationTargetNo: string;
  supplierName: string;
  feeType: string;
  unitPrice: number;
  quantity: number;
  currency: string;
  amount: number;
  exchangeRate?: number;
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  reviewStatus: CostItemReviewStatus;
  reviewComment?: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
}

interface CostInputItemSnapshot {
  relationLevel: CostRelationLevel;
  relationTargetNo: string;
  supplierName: string;
  feeType: string;
  unitPrice: number;
  quantity: number;
  currency: string;
  amount: number;
  remark: string;
}

interface CostTaskRecord {
  jobNo: string;
  station: string;
  route: string;
  serviceType: string;
  carrier: string;
  blNo: string;
  originPort: string;
  destinationPort: string;
  pieces: number;
  blWeight: number;
  orderWeight: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supervisor?: string;
  reviewedAt?: string;
  supervisorRemark?: string;
  items: CostInputItem[];
}

const COST_STORAGE_KEY = 'job-cost-pol-task-demo-v4';

const COST_RELATION_LEVEL_OPTIONS: Array<{ value: CostRelationLevel; label: string }> = [
  { value: 'JOB', label: 'JOB公摊' },
  { value: 'UNIT', label: '集装箱号公摊' },
  { value: 'ORDER', label: '订单号' },
  { value: 'SUB_ORDER', label: '子单号' },
];

const COST_FEE_TYPE_OPTIONS = [
  { value: 'BOOKING', label: '订舱费' },
  { value: 'CUSTOMS', label: '报关费' },
  { value: 'TRUCKING', label: '拖车费' },
  { value: 'PICKUP', label: '提货费' },
  { value: 'DELIVERY', label: '送货费' },
  { value: 'PACKING', label: '包装费' },
  { value: 'INSPECTION', label: '商检费' },
  { value: 'OTHER', label: '其他' },
];

const COST_CURRENCY_OPTIONS = [
  { value: 'CNY', label: 'CNY' },
  { value: 'USD', label: 'USD' },
];

const COST_SUPPLIER_OPTIONS = [
  '广州喵喵国际货运代理有限公司深圳分公司',
  '广州喵喵国际货运代理有限公司白云分公司',
  '广东广运拖车服务有限公司',
  '深圳华洋报关有限公司',
];

const COST_ITEM_STATUS_CONFIG: Record<CostItemReviewStatus, { text: string; color: string }> = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING: { text: '待审核', color: 'orange' },
  APPROVED: { text: '已审核', color: 'green' },
  REJECTED: { text: '已驳回', color: 'red' },
};

function loadCostRecords(): CostTaskRecord[] {
  try {
    const raw = localStorage.getItem(COST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCostRecords(records: CostTaskRecord[]) {
  localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(records));
}

function costCalcAmount(unitPrice: number, quantity: number) {
  return Number((unitPrice * quantity).toFixed(2));
}

function costCreateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isCostItemEditable(items: CostInputItem[], row: CostInputItem) {
  if (row.reviewStatus === 'PENDING') return false;
  if (row.reviewStatus === 'APPROVED') return false;
  if (row.kind === 'NORMAL' && items.some((item) => item.originalItemId === row.id && item.reviewStatus !== 'REJECTED')) return false;
  return true;
}

function isCostItemHistorical(items: CostInputItem[], row: CostInputItem) {
  return row.kind === 'NORMAL' && items.some((item) => item.originalItemId === row.id && item.reviewStatus !== 'REJECTED');
}

function getCostRowTypeText(items: CostInputItem[], row: CostInputItem) {
  if (row.kind === 'CHANGE') {
    if (row.reviewStatus === 'PENDING') return '修改待审';
    if (row.reviewStatus === 'REJECTED') return '修改驳回';
    if (row.reviewStatus === 'DRAFT') return '修改草稿';
    return '变更后条目';
  }
  if (isCostItemHistorical(items, row)) return '原始版本';
  if (row.reviewStatus === 'APPROVED') return '已审核条目';
  if (row.reviewStatus === 'PENDING') return '新增待审';
  if (row.reviewStatus === 'REJECTED') return '新增驳回';
  return '新增草稿';
}

interface TaskFormMeta {
  jobNo: string;
  createdBy: string;
  createdAt: string;
}

type MutableLegacyContainer = LegacyContainer & {
  nodeProgress: {
    completedNodes: LegacyNodeRecord[];
  };
};

type MutableLegacyJob = LegacyJob & {
  containers: MutableLegacyContainer[];
};

type MutableLegacyTask = LegacyTask & {
  jobs: MutableLegacyJob[];
  costItems?: LegacyCostItem[];
};

interface TaskListRow {
  key: string;
  taskId: string;
  task: MutableLegacyTask;
  firstJob: MutableLegacyJob;
  status: TaskStatus;
  routeName: string;
  serviceTypeLabel: string;
  originPort: string;
  destPort: string;
  cargoFilterLabel: string;
  allContainers: MutableLegacyContainer[];
  totalWeightKg: number;
  totalPieces: number;
  currentNodeName: string;
  hasAbnormal: boolean;
  updatedAt: string;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: '待执行',
  IN_PROGRESS: '执行中',
  COMPLETED: '已完成',
  SUSPENDED: '已暂停',
};
const STATUS_COLOR: Record<TaskStatus, string> = {
  PENDING: 'warning',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  SUSPENDED: 'red',
};

const SERVICE_LABEL: Record<LegacyJob['serviceType'], string> = {
  EXPRESS: '特快',
  STANDARD: '普快',
};

const FILTER_LABEL: Record<CargoFilter, string> = {
  GENERAL: '普货',
  NON_GENERAL: '非普货',
  ALL: '全部',
};

const STATION_OPTIONS = ['海珠区站点', '白云区站点', '福田区站点', '南方大厦站点', '广园西站点'];
const PORT_OPTIONS = ['CAN', 'SZX', 'HKG', 'SHA', 'LOS', 'ACC', 'ABV', 'KAN', 'ADD'];
const DELIVERY_COMPANIES = ['顺丰速运', '德邦物流', '韵达快递', '中通快递', '申通快递', '圆通速递'];
// 海运船公司
const SEA_CARRIER_OPTIONS = [
  { value: 'COSCO', label: '中远海运 COSCO' },
  { value: 'MSK', label: '马士基 Maersk' },
  { value: 'MSC', label: '地中海航运 MSC' },
  { value: 'CMA', label: '达飞轮船 CMA-CGM' },
  { value: 'ONE', label: '海洋网联 ONE' },
  { value: 'EMC', label: '长荣海运 Evergreen' },
  { value: 'HPL', label: '赫伯罗特 Hapag-Lloyd' },
];
// 海运柜型
const CONTAINER_TYPE_OPTIONS = [
  { value: '20GP', label: '20GP（20尺普柜）' },
  { value: '40GP', label: '40GP（40尺普柜）' },
  { value: '40HQ', label: '40HQ（40尺高柜）' },
  { value: '45HQ', label: '45HQ（45尺高柜）' },
];
// 空运航空公司
const AIR_CARRIER_OPTIONS = [
  { value: 'ET', label: '埃塞俄比亚航空 ET' },
  { value: 'CZ', label: '南方航空 CZ' },
  { value: 'CX', label: '国泰航空 CX' },
  { value: 'TK', label: '土耳其航空 TK' },
  { value: 'EK', label: '阿联酋航空 EK' },
  { value: 'QR', label: '卡塔尔航空 QR' },
];

const ORIGIN_NODE_FLOW = [
  { nodeCode: 'WAREHOUSE_OUT', nodeName: '已离库' },
  { nodeCode: 'CUSTOMS_EXPORT', nodeName: '出口报关' },
  { nodeCode: 'CUSTOMS_CHECK', nodeName: '海关查验' },
  { nodeCode: 'CUSTOMS_RELEASE', nodeName: '海关放行' },
  { nodeCode: 'DEPARTURE', nodeName: '已起运' },
];

const DEST_NODE_FLOW = [
  { nodeCode: 'ARRIVAL', nodeName: '已到港' },
  { nodeCode: 'IMPORT_CUSTOMS_DECLARE', nodeName: '进口申报' },
  { nodeCode: 'IMPORT_CUSTOMS_CHECK', nodeName: '进口查验' },
  { nodeCode: 'IMPORT_CUSTOMS_RELEASE', nodeName: '进口放行' },
  { nodeCode: 'DEST_WAREHOUSE_IN', nodeName: '到达入仓' },
  { nodeCode: 'DELIVERY', nodeName: '派送中' },
  { nodeCode: 'SIGNED', nodeName: '已签收' },
];

const NODE_STAGE_MAP: Record<string, { key: string; label: string; order: number }> = {
  PICKUP: { key: 'TASK_ACCEPTED', label: '任务受理', order: 1 },
  WAREHOUSE_IN: { key: 'TASK_ACCEPTED', label: '任务受理', order: 1 },
  WAREHOUSE_OUT: { key: 'ORIGIN_HANDLING', label: '起运处理', order: 2 },
  ORIGIN_WAREHOUSE_OUT: { key: 'ORIGIN_HANDLING', label: '起运处理', order: 2 },
  CUSTOMS_EXPORT: { key: 'ORIGIN_HANDLING', label: '起运处理', order: 2 },
  CUSTOMS_CHECK: { key: 'ORIGIN_HANDLING', label: '起运处理', order: 2 },
  CUSTOMS_RELEASE: { key: 'ORIGIN_HANDLING', label: '起运处理', order: 2 },
  DEPARTURE: { key: 'DEPARTED', label: '已发运', order: 3 },
  ARRIVAL: { key: 'ARRIVED', label: '已到港', order: 4 },
  IMPORT_CUSTOMS_DECLARE: { key: 'DEST_HANDLING', label: '到达处理', order: 5 },
  IMPORT_CUSTOMS_CHECK: { key: 'DEST_HANDLING', label: '到达处理', order: 5 },
  IMPORT_CUSTOMS_RELEASE: { key: 'DEST_HANDLING', label: '到达处理', order: 5 },
  DEST_WAREHOUSE_IN: { key: 'DEST_HANDLING', label: '到达处理', order: 5 },
  DELIVERY: { key: 'DELIVERED', label: '已派送', order: 6 },
  SIGNED: { key: 'SIGNED', label: '已签收', order: 7 },
};

function mapNodeStage(nodeCode: string) {
  return NODE_STAGE_MAP[nodeCode] || { key: 'NODE_UPDATE', label: '节点更新', order: 99 };
}

function formatAttachmentSize(size: number) {
  if (!size) return '0 B';
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function cloneTasks(businessMode: LegacyBusinessMode = 'ALL'): MutableLegacyTask[] {
  const prefix = businessMode === 'AIR' ? 'A' : 'S';
  const cloned = JSON.parse(JSON.stringify(LEGACY_TASKS)) as MutableLegacyTask[];
  // 按编号规则为任务编号添加业务前缀（S- 海运 / A- 空运）
  return cloned.map((task) => {
    const prefixedId = /^[AS]-/.test(task.id) ? task.id : `${prefix}-${task.id}`;
    return {
      ...task,
      id: prefixedId,
      jobs: task.jobs.map((job) => ({
        ...job,
        jobNo: /^[AS]-/.test(job.jobNo) ? job.jobNo : `${prefix}-${job.jobNo}`,
      })),
    };
  });
}

function nodeFlowByMode(mode: LegacyTaskMode) {
  return mode === 'ORIGIN' ? ORIGIN_NODE_FLOW : DEST_NODE_FLOW;
}

function calcTaskNodeStatus(task: MutableLegacyTask, mode: LegacyTaskMode): { currentNodeName: string; hasAbnormal: boolean } {
  const flow = nodeFlowByMode(mode);
  const flowSet = new Set(flow.map((item) => item.nodeCode));

  let minTrackedDone = Number.POSITIVE_INFINITY;
  let hasTracked = false;
  let hasAbnormal = false;

  task.jobs.forEach((job) => {
    job.containers.forEach((container) => {
      const tracked = (container.nodeProgress?.completedNodes || []).filter((node) => flowSet.has(node.nodeCode));
      if (tracked.length > 0) {
        hasTracked = true;
      }
      if (tracked.some((node) => Boolean(node.isAbnormal))) {
        hasAbnormal = true;
      }
      minTrackedDone = Math.min(minTrackedDone, tracked.length);
    });
  });

  if (!hasTracked || minTrackedDone === Number.POSITIVE_INFINITY) {
    return { currentNodeName: '未开始', hasAbnormal };
  }

  if (minTrackedDone >= flow.length) {
    return { currentNodeName: '已完成', hasAbnormal };
  }

  return { currentNodeName: flow[minTrackedDone].nodeName, hasAbnormal };
}

function aggregateTaskRow(task: MutableLegacyTask, mode: LegacyTaskMode): TaskListRow {
  const firstJob = task.jobs[0];
  const containers = task.jobs.flatMap((job) => job.containers);
  const totalWeightKg = task.jobs.reduce((sum, job) => sum + Number(job.weightKg || 0), 0);
  const totalPieces = task.jobs.reduce((sum, job) => sum + Number(job.pieces || 0), 0);
  const routeNames = Array.from(new Set(task.jobs.map((job) => job.routeName).filter(Boolean)));
  const routeName = routeNames[0] || '';
  const serviceTypes = Array.from(new Set(task.jobs.map((job) => job.serviceType)));
  const serviceTypeLabel = serviceTypes.length > 1 ? '混合' : SERVICE_LABEL[serviceTypes[0] || firstJob.serviceType];
  const cargoFilters = Array.from(new Set(task.jobs.map((job) => job.cargoFilter)));
  const cargoFilterLabel = cargoFilters.length > 1 ? '混合' : FILTER_LABEL[cargoFilters[0] || firstJob.cargoFilter];
  const nodeStatus = calcTaskNodeStatus(task, mode);

  return {
    key: task.id,
    taskId: task.id,
    task,
    firstJob,
    status: task.status,
    routeName,
    serviceTypeLabel,
    originPort: firstJob.originPort,
    destPort: firstJob.destPort,
    cargoFilterLabel,
    allContainers: containers,
    totalWeightKg,
    totalPieces,
    currentNodeName: nodeStatus.currentNodeName,
    hasAbnormal: nodeStatus.hasAbnormal,
    updatedAt: task.updatedAt,
  };
}

function makeContainerPrefix(originPort: string, destPort: string) {
  const a = (originPort || 'N').slice(0, 1).toUpperCase();
  const b = (destPort || 'K').slice(0, 1).toUpperCase();
  return `${a}${b}`;
}

function genOrders(containerNo: string, count: number): LegacyOrderItem[] {
  const cities = ['LAGOS', 'IKEJA', 'ABUJA', 'ACCRA'];
  return Array.from({ length: count }).map((_, index) => {
    const seq = index + 1;
    const volumeCbm = Number((0.12 + seq * 0.08).toFixed(4));
    const volumeWeightKgs = Number((volumeCbm * 167).toFixed(2));
    const grossWeightKgs = Number((volumeWeightKgs * 0.82).toFixed(2));
    return {
      seq,
      orderNo: `${dayjs().format('YYMMDD')}${containerNo}${seq}`.slice(0, 14),
      thirdPartyTracking: `SF${dayjs().format('HHmmss')}${seq}`,
      city: cities[index % cities.length],
      salesPerson: 'OPS',
      userName: `User${seq}`,
      goodsName: '普货',
      description: '普货',
      pieces: 1,
      volumeCbm,
      volumeWeightKgs,
      grossWeightKgs,
    };
  });
}

function genContainers(prefix: string, routeName: string, serviceType: string, count = 5): MutableLegacyContainer[] {
  return Array.from({ length: count }).map((_, index) => {
    const containerNo = `${prefix}${index + 1}`;
    const orders = genOrders(containerNo, 2);
    const pieces = orders.reduce((sum, item) => sum + item.pieces, 0);
    const volumeCbm = Number(orders.reduce((sum, item) => sum + item.volumeCbm, 0).toFixed(4));
    const volumeWeightKgs = Number(orders.reduce((sum, item) => sum + item.volumeWeightKgs, 0).toFixed(2));
    const grossWeightKgs = Number(orders.reduce((sum, item) => sum + item.grossWeightKgs, 0).toFixed(2));
    return {
      id: `${containerNo}-${dayjs().valueOf()}`,
      containerNo,
      routeName,
      serviceType,
      orders,
      pieces,
      volumeCbm,
      volumeWeightKgs,
      grossWeightKgs,
      nodeProgress: {
        completedNodes: [],
      },
    };
  });
}

interface LegacyTaskManagerProps {
  mode?: LegacyTaskMode;
  businessMode?: LegacyBusinessMode;
}

export const LegacyTaskManager: React.FC<LegacyTaskManagerProps> = ({ mode = 'ORIGIN', businessMode = 'ALL' }) => {
  const [tasks, setTasks] = useState<MutableLegacyTask[]>(() => cloneTasks(businessMode));

  // 当 businessMode 切换时（如海运↔空运），重新加载数据并应用对应前缀
  useEffect(() => {
    setTasks(cloneTasks(businessMode));
  }, [businessMode]);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);

  const [keyword, setKeyword] = useState('');
  const [currentNodeFilter, setCurrentNodeFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<Dayjs | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editContainerCount, setEditContainerCount] = useState(0);
  const [editForm] = Form.useForm();
  const [taskFormMeta, setTaskFormMeta] = useState<TaskFormMeta>({
    jobNo: '提交后自动生成',
    createdBy: 'CANSAMPAO',
    createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTask, setDeleteTask] = useState<MutableLegacyTask | null>(null);
  const [selectedDeleteJobIds, setSelectedDeleteJobIds] = useState<string[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);

  const [nodeUpdateOpen, setNodeUpdateOpen] = useState(false);
  const [nodeUpdateTaskId, setNodeUpdateTaskId] = useState<string | null>(null);
  const [nodeUpdateForm] = Form.useForm();

  const [containerDetailOpen, setContainerDetailOpen] = useState(false);
  const [detailContainer, setDetailContainer] = useState<MutableLegacyContainer | null>(null);
  const [attachmentOverrides, setAttachmentOverrides] = useState<Record<string, LegacyAttachment[]>>({});
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [activeNodeKey, setActiveNodeKey] = useState<string | null>(null);

  // ---- 暂停任务 ----
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspendForm] = Form.useForm();
  const [suspendTargetId, setSuspendTargetId] = useState<string | null>(null);

  const openSuspendModal = (row: TaskListRow) => {
    setSuspendTargetId(row.taskId);
    suspendForm.resetFields();
    setSuspendModalOpen(true);
  };

  const handleSuspendConfirm = () => {
    suspendForm.validateFields().then(() => {
      if (!suspendTargetId) return;
      setTasks(prev => prev.map(t => t.id === suspendTargetId ? { ...t, status: 'SUSPENDED' as const } : t));
      message.success('Task suspended');
      setSuspendModalOpen(false);
      setSuspendTargetId(null);
    });
  };

  const handleResume = (row: TaskListRow) => {
    setTasks(prev => prev.map(t => t.id === row.taskId ? { ...t, status: 'IN_PROGRESS' as const } : t));
    message.success('Task resumed');
  };

  // ---- 成本录入 Drawer 状态 ----
  const [costRecords, setCostRecords] = useState<CostTaskRecord[]>(() => loadCostRecords());
  const [costEditorOpen, setCostEditorOpen] = useState(false);
  const [costEditorTaskId, setCostEditorTaskId] = useState<string | null>(null);
  const [costEditorRows, setCostEditorRows] = useState<CostInputItem[]>([]);

  useEffect(() => { saveCostRecords(costRecords); }, [costRecords]);

  const costEditorTask = useMemo(
    () => (costEditorTaskId ? tasks.find((t) => t.id === costEditorTaskId) || null : null),
    [tasks, costEditorTaskId],
  );

  const costEditorJobNo = useMemo(() => {
    if (!costEditorTask) return '';
    const prefix = businessMode === 'AIR' ? 'A' : 'S';
    const raw = costEditorTask.id;
    return /^[AS]-/.test(raw) ? raw : `${prefix}-${raw}`;
  }, [costEditorTask, businessMode]);

  const costEditorAmount = useMemo(
    () => costEditorRows
      .filter((row) => {
        if (row.reviewStatus === 'REJECTED') return false;
        if (isCostItemHistorical(costEditorRows, row)) return false;
        return true;
      })
      .reduce((sum, row) => sum + row.amount, 0),
    [costEditorRows],
  );

  const getCostRelationTargetOptions = (level?: CostRelationLevel): string[] => {
    if (!costEditorTask || !level) return [];
    const firstJob = costEditorTask.jobs[0];
    if (!firstJob) return [];
    if (level === 'JOB') return [costEditorJobNo];
    if (level === 'UNIT') return costEditorTask.jobs.flatMap((j) => j.containers.map((c) => c.containerNo));
    if (level === 'ORDER') return Array.from(new Set(costEditorTask.jobs.flatMap((j) => j.containers.flatMap((c) => c.orders.map((o) => o.orderNo)))));
    return Array.from(new Set(costEditorTask.jobs.flatMap((j) => j.containers.flatMap((c) => c.orders.map((o) => o.orderNo + '-1')))));
  };

  const openCostEditor = (row: TaskListRow) => {
    const taskId = row.taskId;
    const prefix = businessMode === 'AIR' ? 'A' : 'S';
    const jobNo = /^[AS]-/.test(taskId) ? taskId : `${prefix}-${taskId}`;
    const existed = costRecords.find((r) => r.jobNo === jobNo);
    setCostEditorTaskId(taskId);
    setCostEditorRows(existed ? existed.items.map((item) => ({ ...item, originalSnapshot: item.originalSnapshot ? { ...item.originalSnapshot } : undefined })) : []);
    setCostEditorOpen(true);
    if (existed) {
      message.info('当前任务已有成本记录，本次录入会在原任务下继续追加条目。');
    }
  };

  const updateCostEditorRow = (rowId: string, patch: Partial<CostInputItem>) => {
    setCostEditorRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const unitPrice = patch.unitPrice !== undefined ? Number(patch.unitPrice) : row.unitPrice;
        const quantity = patch.quantity !== undefined ? Number(patch.quantity) : row.quantity;
        return {
          ...row,
          ...patch,
          unitPrice,
          quantity,
          amount: costCalcAmount(unitPrice, quantity),
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
        };
      }),
    );
  };

  const addCostEditorRow = () => {
    if (!costEditorJobNo) { message.warning('请先选择任务'); return; }
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    setCostEditorRows((prev) => [
      ...prev,
      {
        id: costCreateId('task-cost-item'),
        kind: 'NORMAL',
        relationLevel: 'JOB',
        relationTargetNo: costEditorJobNo,
        supplierName: COST_SUPPLIER_OPTIONS[0],
        feeType: 'BOOKING',
        unitPrice: 0,
        quantity: 1,
        currency: 'CNY',
        amount: 0,
        paymentStatus: 'UNPAID',
        reviewStatus: 'DRAFT',
        remark: '',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  };

  const removeCostEditorRow = (rowId: string) => {
    setCostEditorRows((prev) => prev.filter((row) => row.id !== rowId));
  };

  const requestModifyCostApprovedRow = (row: CostInputItem) => {
    if (costEditorRows.some((item) => item.originalItemId === row.id && item.reviewStatus !== 'REJECTED')) {
      message.warning('该已审核条目已有待处理的修改记录');
      return;
    }
    const now = dayjs().format('YYYY-MM-DD HH:mm');
    const snapshot: CostInputItemSnapshot = {
      relationLevel: row.relationLevel,
      relationTargetNo: row.relationTargetNo,
      supplierName: row.supplierName,
      feeType: row.feeType,
      unitPrice: row.unitPrice,
      quantity: row.quantity,
      currency: row.currency,
      amount: row.amount,
      remark: row.remark,
    };
    setCostEditorRows((prev) => [
      ...prev,
      {
        ...snapshot,
        id: costCreateId('task-cost-change'),
        kind: 'CHANGE',
        originalItemId: row.id,
        originalSnapshot: snapshot,
        paymentStatus: row.paymentStatus,
        reviewStatus: 'DRAFT',
        reviewComment: '',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    message.success('已生成修改行');
  };

  const persistCostEditor = (submitForReview: boolean) => {
    if (!costEditorJobNo || !costEditorTask) { message.error('未找到对应任务'); return; }
    if (!costEditorRows.length) { message.error('请至少保留 1 条费用条目'); return; }
    const editableRows = costEditorRows.filter((row) => isCostItemEditable(costEditorRows, row));
    for (const row of editableRows) {
      if (!row.relationTargetNo || !row.supplierName || !row.feeType || !row.currency) {
        message.error('请完整填写费用条目'); return;
      }
      if (row.unitPrice <= 0 || row.quantity <= 0) {
        message.error('单价和数量必须大于 0'); return;
      }
    }

    const now = dayjs().format('YYYY-MM-DD HH:mm');
    const currentUser = (() => { try { const raw = localStorage.getItem('user'); const p = raw ? JSON.parse(raw) : {}; return p?.username || p?.id || '当前用户'; } catch { return '当前用户'; } })();
    const firstJob = costEditorTask.jobs[0];

    const nextItems = costEditorRows.map((row) => {
      if (!isCostItemEditable(costEditorRows, row)) return row;
      return { ...row, amount: costCalcAmount(row.unitPrice, row.quantity), reviewStatus: (submitForReview ? 'PENDING' : 'DRAFT') as CostItemReviewStatus, updatedAt: now };
    });

    setCostRecords((prev) => {
      const existed = prev.find((r) => r.jobNo === costEditorJobNo);
      const nextRecord: CostTaskRecord = {
        jobNo: costEditorJobNo,
        station: firstJob?.stationName || '',
        route: firstJob?.routeName || '',
        serviceType: SERVICE_LABEL[firstJob?.serviceType || 'STANDARD'],
        carrier: '',
        blNo: '',
        originPort: firstJob?.originPort || '',
        destinationPort: firstJob?.destPort || '',
        pieces: costEditorTask.jobs.reduce((sum, j) => sum + Number(j.pieces || 0), 0),
        blWeight: 0,
        orderWeight: costEditorTask.jobs.reduce((sum, j) => sum + Number(j.weightKg || 0), 0),
        createdBy: existed?.createdBy || currentUser,
        createdAt: existed?.createdAt || now,
        updatedAt: now,
        supervisor: existed?.supervisor,
        reviewedAt: existed?.reviewedAt,
        supervisorRemark: existed?.supervisorRemark,
        items: nextItems,
      };
      if (existed) return prev.map((r) => (r.jobNo === costEditorJobNo ? nextRecord : r));
      return [nextRecord, ...prev];
    });

    message.success(submitForReview ? '已提交主管审核' : '已保存为草稿');
    setCostEditorOpen(false);
    setCostEditorTaskId(null);
    setCostEditorRows([]);
  };

  // 获取详情页面的成本数据
  const getDetailCostItems = (task: MutableLegacyTask | null): CostInputItem[] => {
    if (!task) return [];
    const prefix = businessMode === 'AIR' ? 'A' : 'S';
    const jobNo = /^[AS]-/.test(task.id) ? task.id : `${prefix}-${task.id}`;
    const record = costRecords.find((r) => r.jobNo === jobNo);
    return record?.items || [];
  };

  const rows = useMemo(
    () => tasks
      .map((task) => aggregateTaskRow(task, mode))
      .sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf()),
    [tasks, mode],
  );

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (currentNodeFilter && row.currentNodeName !== currentNodeFilter) return false;
      if (countryFilter !== 'ALL' && !row.task.jobs.some((job) => job.routeName.includes(`.${countryFilter}`))) return false;
      if (cityFilter !== 'ALL' && !row.task.jobs.some((job) => job.originPort === cityFilter || job.destPort === cityFilter)) return false;
      if (dateFilter && !row.task.jobs.some((job) => job.executeDate === dateFilter.format('YYYY-MM-DD'))) return false;

      if (!kw) return true;

      const taskHit = row.taskId.toLowerCase().includes(kw);
      const jobHit = row.task.jobs.some((job) => (
        job.jobNo.toLowerCase().includes(kw)
        || job.routeName.toLowerCase().includes(kw)
        || job.originPort.toLowerCase().includes(kw)
        || job.destPort.toLowerCase().includes(kw)
      ));
      const containerHit = row.allContainers.some((container) => container.containerNo.toLowerCase().includes(kw));
      const delivery = row.task.deliveryCompany;
      const deliveryHit = [delivery?.driverName, delivery?.driverPhone, delivery?.plateNo]
        .some((item) => (item || '').toLowerCase().includes(kw));
      return taskHit || jobHit || containerHit || deliveryHit;
    });
  }, [rows, keyword, currentNodeFilter, countryFilter, cityFilter, dateFilter]);

  const stats = useMemo(() => {
    const currentNodes = new Set(filteredRows.map((row) => row.currentNodeName));
    return {
      total: filteredRows.length,
      trackedTasks: filteredRows.filter((row) => row.currentNodeName !== '未开始').length,
      uniqueCurrentNodes: currentNodes.size,
      abnormal: filteredRows.filter((row) => row.hasAbnormal).length,
    };
  }, [filteredRows]);

  const nodeOptions = useMemo(() => nodeFlowByMode(mode), [mode]);

  const selectedTask = useMemo(
    () => (detailTaskId ? tasks.find((task) => task.id === detailTaskId) || null : null),
    [tasks, detailTaskId],
  );

  const selectedJob = useMemo(() => {
    if (!selectedTask) return null;
    if (detailJobId) {
      return selectedTask.jobs.find((job) => job.id === detailJobId) || selectedTask.jobs[0] || null;
    }
    return selectedTask.jobs[0] || null;
  }, [selectedTask, detailJobId]);

  const selectedCostItems = getDetailCostItems(selectedTask);
  const selectedContainers = useMemo(
    () => {
      if (!selectedTask) return [];
      const all = selectedTask.jobs.flatMap((job) => job.containers);
      // 海运：一个任务只展示一个集装箱（取第一个）
      if (businessMode === 'SEA') return all.slice(0, 1);
      return all;
    },
    [selectedTask, businessMode],
  );

  const baseNodeChangeRows = useMemo<NodeChangeRow[]>(() => {
    if (!selectedTask) return [];

    const grouped = new Map<string, {
      key: string;
      order: number;
      nodeName: string;
      time: string;
      isAbnormal: boolean;
      remark: string;
      operator: string;
      attachmentMap: Map<string, LegacyAttachment>;
    }>();

    grouped.set('TASK_CREATED', {
      key: 'TASK_CREATED',
      order: 0,
      nodeName: '任务创建',
      time: selectedTask.createdAt,
      isAbnormal: false,
      remark: '',
      operator: selectedTask.createdBy,
      attachmentMap: new Map<string, LegacyAttachment>(),
    });

    selectedTask.jobs.forEach((job) => {
      job.containers.forEach((container) => {
        (container.nodeProgress?.completedNodes || []).forEach((node) => {
          const stage = mapNodeStage(node.nodeCode);
          const stageKey = stage.key;
          const nodeTime = node.updatedAt || (node.date ? `${node.date} 00:00:00` : selectedTask.updatedAt);

          if (!grouped.has(stageKey)) {
            grouped.set(stageKey, {
              key: stageKey,
              order: stage.order,
              nodeName: stage.label,
              time: nodeTime,
              isAbnormal: Boolean(node.isAbnormal),
              remark: node.remark || '',
              operator: node.operator || selectedTask.createdBy,
              attachmentMap: new Map<string, LegacyAttachment>(),
            });
          }

          const record = grouped.get(stageKey)!;
          if (nodeTime >= record.time) {
            record.time = nodeTime;
            record.isAbnormal = Boolean(node.isAbnormal);
            record.remark = node.remark || '';
            record.operator = node.operator || selectedTask.createdBy;
          }

          (node.attachments || []).forEach((attachment) => {
            if (!record.attachmentMap.has(attachment.uid)) {
              record.attachmentMap.set(attachment.uid, { ...attachment });
            }
          });
        });
      });
    });

    return Array.from(grouped.values())
      .map((item) => ({
        key: item.key,
        order: item.order,
        nodeName: item.nodeName,
        time: item.time,
        isAbnormal: item.isAbnormal,
        remark: item.remark,
        operator: item.operator,
        attachments: Array.from(item.attachmentMap.values()),
      }))
      .sort((a, b) => (a.order !== b.order ? a.order - b.order : dayjs(a.time).valueOf() - dayjs(b.time).valueOf()));
  }, [selectedTask]);

  const nodeChangeRows = useMemo<NodeChangeRow[]>(() => {
    const taskPrefix = `${selectedTask?.id || ''}::`;
    return baseNodeChangeRows.map((row) => {
      const override = attachmentOverrides[`${taskPrefix}${row.key}`];
      return override ? { ...row, attachments: override } : row;
    });
  }, [baseNodeChangeRows, attachmentOverrides, selectedTask?.id]);

  const activeNodeRow = useMemo<NodeChangeRow | null>(
    () => nodeChangeRows.find((row) => row.key === activeNodeKey) || null,
    [nodeChangeRows, activeNodeKey],
  );

  const openCreate = () => {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    setIsEditMode(false);
    setEditingTaskId(null);
    setEditContainerCount(0);
    setTaskFormMeta({
      jobNo: '提交后自动生成',
      createdBy: 'CANSAMPAO',
      createdAt: now,
    });
    editForm.resetFields();
    editForm.setFieldsValue({
      dispatchCenter: '总调度中心',
      serviceType: 'STANDARD',
      cargoFilter: 'GENERAL',
      executeDate: dayjs(),
      weightKg: 500,
      pieces: 10,
    });
    setEditOpen(true);
  };

  const openEdit = (row: TaskListRow) => {
    const task = row.task;
    const job = task.jobs[0];
    setIsEditMode(true);
    setEditingTaskId(task.id);
    setEditContainerCount(job.containers.length);
    setTaskFormMeta({
      jobNo: task.id,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
    });
    editForm.setFieldsValue({
      dispatchCenter: job.routeId || '',
      stationName: job.stationName,
      routeName: job.routeName,
      serviceType: job.serviceType,
      cargoFilter: job.cargoFilter,
      originPort: job.originPort,
      transitPort: job.transitPort || undefined,
      destPort: job.destPort,
      weightKg: job.weightKg,
      pieces: job.pieces,
      executeDate: dayjs(job.executeDate),
      remark: job.remark || '',
      // 发往/送货公司信息由"任务执行"环节填写，这里不再重复录入
    });
    setEditOpen(true);
  };

  const handleSaveTask = async () => {
    const values = await editForm.validateFields();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    if (isEditMode && editingTaskId) {
      setTasks((prev) => prev.map((task) => {
        if (task.id !== editingTaskId) return task;
        const first = task.jobs[0];
        const updatedJob: MutableLegacyJob = {
          ...first,
          routeId: values.dispatchCenter?.trim() || first.routeId,
          stationName: values.stationName,
          routeName: values.routeName,
          serviceType: values.serviceType,
          cargoFilter: values.cargoFilter || first.cargoFilter || 'ALL',
          originPort: values.originPort,
          transitPort: values.transitPort || '',
          destPort: values.destPort,
          weightKg: Number(values.weightKg || 0),
          pieces: Number(values.pieces || 0),
          executeDate: values.executeDate.format('YYYY-MM-DD'),
          remark: values.remark || '',
        };
        // 发往/送货公司信息由任务执行环节维护，此处保持原值不变
        return {
          ...task,
          updatedAt: now,
          jobs: [updatedJob, ...task.jobs.slice(1)],
        };
      }));
      message.success('任务已更新');
    } else {
      const bizPrefix = businessMode === 'AIR' ? 'A' : 'S';
      const taskId = `${bizPrefix}-JOB${dayjs().format('YYMM')}${String(Math.floor(Math.random() * 9000 + 1000)).padStart(4, '0')}`;
      const jobId = `J${Math.floor(Math.random() * 900 + 100)}`;
      const prefix = makeContainerPrefix(values.originPort, values.destPort);
      const containers = genContainers(prefix, values.routeName, values.serviceType === 'EXPRESS' ? '特快' : '普快', 5);
      const newTask: MutableLegacyTask = {
        id: taskId,
        status: 'PENDING',
        createdBy: 'CANSAMPAO',
        createdAt: now,
        updatedAt: now,
        // 发往/送货公司信息由任务执行环节填写，创建时为空占位
        supplier: {
          supplierName: '',
          phone: '',
          address: '',
        },
        deliveryCompany: {
          companyName: '',
          trackingNo: '',
          queryPhone: '',
          driverName: '',
          driverPhone: '',
          plateNo: '',
        },
        jobs: [{
          id: jobId,
          jobNo: `${taskId}-01`,
            stationName: values.stationName,
            routeId: values.dispatchCenter?.trim() || `R-${dayjs().format('HHmmss')}`,
            routeName: values.routeName,
          serviceType: values.serviceType,
          originPort: values.originPort,
          transitPort: values.transitPort || '',
          destPort: values.destPort,
          cargoFilter: values.cargoFilter,
          weightKg: Number(values.weightKg || 0),
          pieces: Number(values.pieces || 0),
          executeDate: values.executeDate.format('YYYY-MM-DD'),
          remark: values.remark || '',
          containers,
        }],
        costItems: [],
      };
      setTasks((prev) => [newTask, ...prev]);
      message.success('任务已创建');
    }

    setEditOpen(false);
  };

  const openDelete = (row: TaskListRow) => {
    setDeleteTask(row.task);
    setSelectedDeleteJobIds(row.task.jobs.map((job) => job.id));
    setDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTask) return;
    if (selectedDeleteJobIds.length === 0) {
      message.warning('请先选择要删除的 JOB');
      return;
    }

    setTasks((prev) => prev
      .map((task) => {
        if (task.id !== deleteTask.id) return task;
        return {
          ...task,
          updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          jobs: task.jobs.filter((job) => !selectedDeleteJobIds.includes(job.id)),
        };
      })
      .filter((task) => task.jobs.length > 0));

    if (selectedDeleteJobIds.length === deleteTask.jobs.length) {
      message.success('任务已删除');
    } else {
      message.success(`已删除 ${selectedDeleteJobIds.length} 个 JOB`);
    }

    setDeleteOpen(false);
    setDeleteTask(null);
    setSelectedDeleteJobIds([]);
  };

  const openDetail = (row: TaskListRow) => {
    setDetailTaskId(row.taskId);
    setDetailJobId(row.firstJob.id);
    setActiveNodeKey(null);
    setDetailOpen(true);
  };

  const scrollDetailTo = (id: string) => {
    const container = detailScrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`#${id}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openCostInput = (row: TaskListRow) => {
    openCostEditor(row);
  };

  const openNodeUpdate = (row: TaskListRow) => {
    setNodeUpdateTaskId(row.taskId);
    nodeUpdateForm.resetFields();
    setNodeUpdateOpen(true);
  };

  const submitNodeUpdate = async (nodeCode: string) => {
    if (!nodeUpdateTaskId) return;
    const values = await nodeUpdateForm.validateFields();
    const flow = nodeFlowByMode(mode);
    const nodeMeta = flow.find((item) => item.nodeCode === nodeCode);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const nodeRecord = {
      nodeCode,
      nodeName: nodeMeta?.nodeName || nodeCode,
      isAbnormal: Boolean(values.isAbnormal),
      date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      remark: values.remark || '',
      operator: 'CANSAMPAO',
      updatedAt: now,
    };

    setTasks((prev) => prev.map((task) => {
      if (task.id !== nodeUpdateTaskId) return task;
      return {
        ...task,
        updatedAt: now,
        status: task.status === 'PENDING' ? 'IN_PROGRESS' : task.status,
        jobs: task.jobs.map((job) => ({
          ...job,
          containers: job.containers.map((container) => ({
            ...container,
            nodeProgress: {
              ...container.nodeProgress,
              completedNodes: [
                ...(container.nodeProgress?.completedNodes || []),
                nodeRecord,
              ],
            },
          })),
        })),
      };
    }));

    message.success(`${nodeMeta?.nodeName || nodeCode} 已完成`);
    nodeUpdateForm.resetFields();
  };

  const resetFilters = () => {
    setKeyword('');
    setCurrentNodeFilter('');
    setCountryFilter('ALL');
    setCityFilter('ALL');
    setDateFilter(null);
    setShowAdvanced(false);
  };

  const openContainerDetail = (container: MutableLegacyContainer) => {
    setDetailContainer(container);
    setContainerDetailOpen(true);
  };

  const openAttachmentModal = (nodeKey: string) => {
    setActiveNodeKey(nodeKey);
    setAttachmentOpen(true);
  };

  const updateNodeAttachments = (
    nodeKey: string,
    updater: (prev: LegacyAttachment[]) => LegacyAttachment[],
  ) => {
    if (!selectedTask) return;
    const overrideKey = `${selectedTask.id}::${nodeKey}`;
    const fallback = nodeChangeRows.find((row) => row.key === nodeKey)?.attachments || [];
    setAttachmentOverrides((prev) => ({
      ...prev,
      [overrideKey]: updater(prev[overrideKey] || fallback),
    }));
  };

  const addAttachment = (nodeKey: string, file: File) => {
    const attachment: LegacyAttachment = {
      uid: `${dayjs().valueOf()}-${Math.floor(Math.random() * 10000)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      previewUrl: URL.createObjectURL(file),
    };
    updateNodeAttachments(nodeKey, (prev) => [...prev, attachment]);
    message.success('附件已新增');
  };

  const deleteAttachment = (nodeKey: string, attachment: LegacyAttachment) => {
    if (attachment.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    updateNodeAttachments(nodeKey, (prev) => prev.filter((item) => item.uid !== attachment.uid));
    message.success('附件已删除');
  };

  const previewAttachment = (attachment: LegacyAttachment) => {
    if (!attachment.previewUrl) {
      message.info('该附件暂不支持预览');
      return;
    }
    window.open(attachment.previewUrl, '_blank', 'noopener,noreferrer');
  };

  const closeDetailDrawer = () => {
    setDetailOpen(false);
    setAttachmentOpen(false);
    setActiveNodeKey(null);
  };

  const columns: ColumnsType<TaskListRow> = [
    {
      title: '任务编号',
      dataIndex: 'taskId',
      key: 'taskId',
      width: 150,
      render: (value: string) => <span style={{ fontWeight: 600 }}>{value}</span>,
    },
    {
      title: '线路',
      dataIndex: 'routeName',
      key: 'routeName',
      width: 200,
    },
    {
      title: '类型',
      dataIndex: 'serviceTypeLabel',
      key: 'serviceTypeLabel',
      width: 80,
      align: 'center',
      render: (value: string) => value === '特快' ? <Tag color="red">{value}</Tag> : <Tag color="blue">{value}</Tag>,
    },
    {
      title: '起运港',
      dataIndex: 'originPort',
      key: 'originPort',
      width: 80,
      align: 'center',
    },
    {
      title: '目的港',
      dataIndex: 'destPort',
      key: 'destPort',
      width: 80,
      align: 'center',
    },
    {
      title: '货物类型',
      dataIndex: 'cargoFilterLabel',
      key: 'cargoFilterLabel',
      width: 90,
      align: 'center',
    },
    {
      title: businessMode === 'AIR' ? '集装号' : '集装箱',
      key: 'containers',
      width: 180,
      render: (_value, row) => {
        const list = row.allContainers;
        // 海运只展示第一个集装箱
        const display = businessMode === 'SEA' ? list.slice(0, 1) : list.slice(0, 4);
        const hidden = businessMode === 'SEA' ? [] : list.slice(4);
        return (
          <Space wrap size={[4, 4]}>
            {display.map((container) => (
              <Tag
                key={container.containerNo}
                color={businessMode === 'SEA' ? 'blue' : undefined}
                style={{ cursor: 'pointer', marginInlineEnd: 0, fontFamily: businessMode === 'SEA' ? 'monospace' : undefined, fontWeight: businessMode === 'SEA' ? 600 : undefined }}
                onClick={() => openContainerDetail(container)}
              >
                {container.containerNo}
              </Tag>
            ))}
            {hidden.length > 0 ? (
              <Tooltip title={hidden.map((item) => item.containerNo).join(' ')}>
                <Tag style={{ marginInlineEnd: 0 }}>{`...${hidden.length}更多`}</Tag>
              </Tooltip>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: '重量Kg',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      width: 90,
      align: 'right',
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '件数',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 70,
      align: 'right',
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_value, row) => <Tag color={STATUS_COLOR[row.status]}>{STATUS_LABEL[row.status]}</Tag>,
    },
    {
      title: '当前节点',
      key: 'currentNode',
      width: 180,
      render: (_value, row) => (
        <Space size={4}>
          <Tag color="processing">{row.currentNodeName}</Tag>
          {row.hasAbnormal ? <Tag color="error">异常</Tag> : null}
        </Space>
      ),
    },
    {
      title: '更新日期',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 130,
      render: (value: string) => <span style={{ fontSize: 12 }}>{value.slice(0, 10)}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: mode === 'ORIGIN' ? 300 : 160,
      align: 'center',
      fixed: 'right',
      render: (_value, row) => (
        <Space size={0} wrap>
          <Button type="link" size="small" icon={<ApartmentOutlined />} onClick={() => openNodeUpdate(row)} disabled={row.status === 'SUSPENDED'}>节点更新</Button>
          {mode === 'ORIGIN' ? (
            <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => openCostInput(row)} disabled={row.status === 'SUSPENDED'}>成本录入</Button>
          ) : null}
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(row)}>详情</Button>
          {mode === 'ORIGIN' && row.status !== 'SUSPENDED' ? (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => openDelete(row)}>删除</Button>
            </>
          ) : null}
          {row.status !== 'SUSPENDED' && row.status !== 'COMPLETED' && (
            <Button type="link" size="small" style={{ color: '#fa8c16' }} onClick={() => openSuspendModal(row)}>暂停</Button>
          )}
          {row.status === 'SUSPENDED' && (
            <Button type="link" size="small" style={{ color: '#52c41a' }} onClick={() => handleResume(row)}>恢复</Button>
          )}
        </Space>
      ),
    },
  ];

  const orderColumns = [
    { title: '序号', dataIndex: 'seq', key: 'seq', width: 60, align: 'center' as const },
    { title: '单号', dataIndex: 'orderNo', key: 'orderNo', width: 160 },
    { title: '第三方运单', dataIndex: 'thirdPartyTracking', key: 'thirdPartyTracking', width: 160 },
    { title: '城市', dataIndex: 'city', key: 'city', width: 80, align: 'center' as const },
    { title: '业务员', dataIndex: 'salesPerson', key: 'salesPerson', width: 100 },
    { title: '用户', dataIndex: 'userName', key: 'userName', width: 100 },
    { title: '品名', dataIndex: 'goodsName', key: 'goodsName', width: 100 },
    { title: '说明', dataIndex: 'description', key: 'description', width: 80, align: 'center' as const },
    { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 70, align: 'right' as const },
    {
      title: '体积CBM',
      dataIndex: 'volumeCbm',
      key: 'volumeCbm',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value.toFixed(4),
    },
    {
      title: '体积重KGS',
      dataIndex: 'volumeWeightKgs',
      key: 'volumeWeightKgs',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '毛重KGS',
      dataIndex: 'grossWeightKgs',
      key: 'grossWeightKgs',
      width: 100,
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
  ];

  const nodeChangeColumns: ColumnsType<NodeChangeRow> = [
    { title: '序号', key: 'index', width: 60, align: 'center', render: (_: unknown, __: NodeChangeRow, index: number) => index + 1 },
    { title: '时间', dataIndex: 'time', key: 'time', width: 170 },
    { title: '节点', dataIndex: 'nodeName', key: 'nodeName', width: 140 },
    {
      title: '状态',
      dataIndex: 'isAbnormal',
      key: 'isAbnormal',
      width: 90,
      align: 'center',
      render: (value: boolean) => <Tag color={value ? 'error' : 'success'}>{value ? '异常' : '正常'}</Tag>,
    },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 100 },
    {
      title: '附件数',
      key: 'attachmentCount',
      width: 90,
      align: 'center',
      render: (_: unknown, row: NodeChangeRow) => (
        <Tag color={row.attachments.length > 0 ? 'processing' : 'default'}>{row.attachments.length}</Tag>
      ),
    },
    {
      title: '附件操作',
      key: 'attachmentAction',
      width: 120,
      render: (_: unknown, row: NodeChangeRow) => (
        <Button type="link" size="small" onClick={() => openAttachmentModal(row.key)}>
          {row.attachments.length > 0 ? `查看(${row.attachments.length})` : '新增附件'}
        </Button>
      ),
    },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
  ];

  const attachmentColumns: ColumnsType<LegacyAttachment> = [
    { title: '附件名', dataIndex: 'name', key: 'name' },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      align: 'right',
      render: (value: number) => formatAttachmentSize(value),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_: unknown, attachment: LegacyAttachment) => (
        <Space size={0}>
          <Button type="link" size="small" onClick={() => previewAttachment(attachment)}>预览</Button>
          <Popconfirm
            title="确认删除该附件？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => {
              if (activeNodeRow) {
                deleteAttachment(activeNodeRow.key, attachment);
              }
            }}
          >
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 详情页的费用条目详情列定义（与 JobCostInputPOL 详情列一致）
  const costDetailColumns = [
    {
      title: '条目类型',
      key: 'rowType',
      width: 110,
      render: (_: unknown, row: CostInputItem) => <Tag>{getCostRowTypeText(selectedCostItems, row)}</Tag>,
    },
    {
      title: '归属层级',
      dataIndex: 'relationLevel',
      key: 'relationLevel',
      width: 120,
      render: (value: CostRelationLevel) => COST_RELATION_LEVEL_OPTIONS.find((o) => o.value === value)?.label || value,
    },
    { title: '归属对象', dataIndex: 'relationTargetNo', key: 'relationTargetNo', width: 120 },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName', width: 220 },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 110,
      render: (value: string) => COST_FEE_TYPE_OPTIONS.find((o) => o.value === value)?.label || value,
    },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', width: 100, render: (value: number) => value?.toFixed(2) },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 90 },
    { title: '小计', dataIndex: 'amount', key: 'amount', width: 100, render: (value: number) => value?.toFixed(2) },
    { title: '币种', dataIndex: 'currency', key: 'currency', width: 70 },
    {
      title: '录入汇率',
      key: 'exchangeRate',
      width: 90,
      render: (_: unknown, row: CostInputItem) => (row.currency === 'CNY' ? '-' : (row.exchangeRate || '-')),
    },
    {
      title: '折合CNY',
      key: 'amountCNY',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, row: CostInputItem) => {
        const rate = row.exchangeRate || (row.currency === 'CNY' ? 1 : 0.0055);
        return <span style={{ color: '#8c8c8c' }}>¥{(row.amount * rate).toFixed(2)}</span>;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      width: 100,
      render: (value: CostItemReviewStatus) => <Tag color={COST_ITEM_STATUS_CONFIG[value].color}>{COST_ITEM_STATUS_CONFIG[value].text}</Tag>,
    },
    {
      title: '原数据',
      key: 'originalSnapshot',
      width: 240,
      render: (_: unknown, row: CostInputItem) => (
        row.originalSnapshot
          ? `${row.originalSnapshot.supplierName} / ${COST_FEE_TYPE_OPTIONS.find((o) => o.value === row.originalSnapshot?.feeType)?.label || row.originalSnapshot.feeType} / ${row.originalSnapshot.unitPrice.toFixed(2)} x ${row.originalSnapshot.quantity}`
          : '-'
      ),
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 180, render: (value: string) => value || '-' },
    { title: '审核意见', dataIndex: 'reviewComment', key: 'reviewComment', width: 180, render: (value: string) => value || '-' },
  ];

  // 成本录入 Drawer 的编辑列
  const costEditorColumns = [
    {
      title: '条目类型',
      key: 'rowType',
      width: 110,
      fixed: 'left' as const,
      render: (_: unknown, row: CostInputItem) => <Tag>{getCostRowTypeText(costEditorRows, row)}</Tag>,
    },
    {
      title: '归属层级',
      dataIndex: 'relationLevel',
      key: 'relationLevel',
      width: 120,
      render: (value: CostRelationLevel, row: CostInputItem) => (
        isCostItemEditable(costEditorRows, row)
          ? <Select value={value} style={{ width: '100%' }} options={COST_RELATION_LEVEL_OPTIONS} onChange={(v) => { const target = getCostRelationTargetOptions(v)[0] || ''; updateCostEditorRow(row.id, { relationLevel: v, relationTargetNo: target }); }} />
          : COST_RELATION_LEVEL_OPTIONS.find((o) => o.value === value)?.label || value
      ),
    },
    {
      title: '归属对象',
      dataIndex: 'relationTargetNo',
      key: 'relationTargetNo',
      width: 140,
      render: (value: string, row: CostInputItem) => {
        const options = getCostRelationTargetOptions(row.relationLevel);
        return isCostItemEditable(costEditorRows, row) ? (
          <Select value={value} style={{ width: '100%' }} options={options.map((o) => ({ value: o, label: o }))} onChange={(v) => updateCostEditorRow(row.id, { relationTargetNo: v })} />
        ) : value;
      },
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      key: 'supplierName',
      width: 220,
      render: (value: string, row: CostInputItem) => (
        isCostItemEditable(costEditorRows, row)
          ? <Select value={value} showSearch optionFilterProp="children" style={{ width: '100%' }} onChange={(v) => updateCostEditorRow(row.id, { supplierName: v })}>{COST_SUPPLIER_OPTIONS.map((s) => <Select.Option key={s} value={s}>{s}</Select.Option>)}</Select>
          : value
      ),
    },
    {
      title: '费用项目',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 120,
      render: (value: string, row: CostInputItem) => (
        isCostItemEditable(costEditorRows, row)
          ? <Select value={value} style={{ width: '100%' }} options={COST_FEE_TYPE_OPTIONS} onChange={(v) => updateCostEditorRow(row.id, { feeType: v })} />
          : COST_FEE_TYPE_OPTIONS.find((o) => o.value === value)?.label || value
      ),
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 110,
      render: (value: number, row: CostInputItem) => (
        isCostItemEditable(costEditorRows, row)
          ? <InputNumber min={0} precision={2} value={value} style={{ width: '100%' }} onChange={(v) => updateCostEditorRow(row.id, { unitPrice: Number(v || 0) })} />
          : value.toFixed(2)
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      render: (value: number, row: CostInputItem) => (
        isCostItemEditable(costEditorRows, row)
          ? <InputNumber min={0} precision={2} value={value} style={{ width: '100%' }} onChange={(v) => updateCostEditorRow(row.id, { quantity: Number(v || 0) })} />
          : value
      ),
    },
    {
      title: '币种',
      dataIndex: 'currency',
      key: 'currency',
      width: 90,
      render: (value: string, row: CostInputItem) => (
        isCostItemEditable(costEditorRows, row)
          ? <Select value={value} style={{ width: '100%' }} options={COST_CURRENCY_OPTIONS} onChange={(v) => updateCostEditorRow(row.id, { currency: v })} />
          : value
      ),
    },
    {
      title: '录入汇率',
      key: 'exchangeRate',
      width: 110,
      render: (_: unknown, row: CostInputItem) => {
        if (row.currency === 'CNY') return <span style={{ color: '#bfbfbf' }}>-</span>;
        return isCostItemEditable(costEditorRows, row) ? (
          <InputNumber
            min={0}
            precision={4}
            value={row.exchangeRate}
            placeholder="兑CNY汇率"
            style={{ width: '100%' }}
            onChange={(v) => updateCostEditorRow(row.id, { exchangeRate: Number(v || 0) })}
          />
        ) : (row.exchangeRate || '-');
      },
    },
    {
      title: '小计',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '折合CNY',
      key: 'amountCNY',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, row: CostInputItem) => {
        const rate = row.currency === 'CNY' ? 1 : (row.exchangeRate || 0);
        return <span style={{ color: '#8c8c8c' }}>¥{(row.amount * rate).toFixed(2)}</span>;
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 180,
      render: (value: string, row: CostInputItem) => (
        isCostItemEditable(costEditorRows, row)
          ? <Input value={value} onChange={(e) => updateCostEditorRow(row.id, { remark: e.target.value })} />
          : value || '-'
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, row: CostInputItem) => {
        if (row.reviewStatus === 'APPROVED' && !isCostItemHistorical(costEditorRows, row)) {
          return <Button type="link" size="small" onClick={() => requestModifyCostApprovedRow(row)}>申请修改</Button>;
        }
        if (isCostItemEditable(costEditorRows, row)) {
          return (
            <Popconfirm title="确认删除该条目？" onConfirm={() => removeCostEditorRow(row.id)}>
              <Button type="link" size="small" danger>删除</Button>
            </Popconfirm>
          );
        }
        return '-';
      },
    },
  ];

  const { token } = theme.useToken();

  const createSectionTitleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 600,
    color: token.colorTextHeading,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  };

  const createSectionStyle: React.CSSProperties = {
    marginBottom: 24,
  };

  const createFormItemLayout = { labelCol: { flex: '88px' }, wrapperCol: { flex: 'auto' } };

  const createFormItemStyle: React.CSSProperties = {
    marginBottom: 16,
  };

  return (
    <div>
      <div className="compact-stats" style={{ marginBottom: 10 }}>
        <Tag color="blue">全部任务 {stats.total}</Tag>
        <Tag color="processing">已跟进 {stats.trackedTasks}</Tag>
        <Tag>节点类型 {stats.uniqueCurrentNodes}</Tag>
        <Tag color={stats.abnormal > 0 ? 'error' : 'default'}>异常任务 {stats.abnormal}</Tag>
      </div>

      <Card size="small" bordered={false} style={{ marginBottom: 10, background: '#fafafa' }}>
        <Row gutter={[8, 8]} align="middle">
          <Col span={4}>
            <Select
              placeholder="当前节点"
              value={currentNodeFilter}
              onChange={setCurrentNodeFilter}
              style={{ width: '100%' }}
              allowClear
              onClear={() => setCurrentNodeFilter('')}
            >
              {['未开始', ...nodeOptions.map((item) => item.nodeName), '已完成']
                .map((item) => <Option key={item} value={item}>{item}</Option>)}
            </Select>
          </Col>
          <Col flex="auto">
            <Input
              placeholder="输入任务号/JOB/起运港/司机/电话/车牌查询"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              allowClear
            />
          </Col>
          <Col>
            <Space>
              <Button onClick={resetFilters}>重置</Button>
              <Button type="link" onClick={() => setShowAdvanced((value) => !value)}>
                {showAdvanced ? '收起筛选' : '高级筛选'}
              </Button>
              {mode === 'ORIGIN' ? (
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>创建任务</Button>
              ) : null}
            </Space>
          </Col>
        </Row>

        {showAdvanced ? (
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            <Col span={4}>
              <Select
                placeholder="选择国家"
                value={countryFilter}
                onChange={(value) => {
                  setCountryFilter(value);
                  setCityFilter('ALL');
                }}
                style={{ width: '100%' }}
              >
                <Option value="ALL">全部</Option>
                <Option value="NGN">尼日利亚</Option>
                <Option value="GHA">加纳</Option>
                <Option value="CHN">中国</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="选择城市"
                value={cityFilter}
                onChange={setCityFilter}
                style={{ width: '100%' }}
              >
                <Option value="ALL">全部</Option>
                <Option value="LOS">拉各斯</Option>
                <Option value="ABV">阿布贾</Option>
                <Option value="KAN">卡诺</Option>
                <Option value="ACC">阿克拉</Option>
                <Option value="CAN">广州</Option>
                <Option value="SZX">深圳</Option>
                <Option value="HKG">香港</Option>
              </Select>
            </Col>
            <Col span={4}>
              <DatePicker
                placeholder="选择日期"
                value={dateFilter}
                onChange={setDateFilter}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
        ) : null}
      </Card>

      <Table<TaskListRow>
        columns={columns}
        dataSource={filteredRows}
        rowKey="key"
        size="small"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        scroll={{ x: 1700, y: showAdvanced ? 'calc(100vh - 510px)' : 'calc(100vh - 460px)' }}
      />

      <Modal
        title={isEditMode ? '编辑任务' : '创建任务'}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSaveTask}
        okText={isEditMode ? '保存' : '提交'}
        width={980}
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto' } }}
      >
        <Form
          form={editForm}
          layout="horizontal"
          labelAlign="left"
          colon={false}
          size="middle"
        >
          <div style={{ padding: '2px 8px 0' }}>
            <div style={createSectionStyle}>
              <div style={createSectionTitleStyle}>基础信息</div>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} label="任务编号" style={createFormItemStyle}>
                    <Input value={taskFormMeta.jobNo} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} label="创建人" style={createFormItemStyle}>
                    <Input value={taskFormMeta.createdBy} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} label="创建日期" style={createFormItemStyle}>
                    <Input value={taskFormMeta.createdAt} disabled />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} name="stationName" label="操作站点" rules={[{ required: true, message: '请选择站点' }]} style={createFormItemStyle}>
                    <Select placeholder="选择站点">
                      {STATION_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} name="serviceType" label="服务类型" rules={[{ required: true }]} style={createFormItemStyle}>
                    <Select>
                      <Option value="EXPRESS">特快</Option>
                      <Option value="STANDARD">普快</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} name="routeName" label="线路" rules={[{ required: true, message: '请输入线路' }]} style={createFormItemStyle}>
                    <Input placeholder="如 CAN.CHN→LOS.NGN" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={createSectionStyle}>
              <div style={createSectionTitleStyle}>{businessMode === 'AIR' ? '航班信息' : '船务信息'}</div>
              {businessMode === 'AIR' ? (
                <>
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="mawbNo" label="主运单号" rules={[{ required: true, message: '请输入MAWB' }]} style={createFormItemStyle}>
                        <Input placeholder="如 071-35610222" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="hawbNo" label="分运单号" style={createFormItemStyle}>
                        <Input placeholder="选填" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="carrier" label="航空公司" rules={[{ required: true, message: '请选择航空公司' }]} style={createFormItemStyle}>
                        <Select placeholder="选择航空公司" options={AIR_CARRIER_OPTIONS} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="flightNo" label="航班号" style={createFormItemStyle}>
                        <Input placeholder="如 ET606" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="originPort" label="起飞机场" rules={[{ required: true }]} style={createFormItemStyle}>
                        <Select placeholder="选择机场">
                          {PORT_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="destPort" label="目的机场" rules={[{ required: true }]} style={createFormItemStyle}>
                        <Select placeholder="选择机场">
                          {PORT_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="cutoffDate" label="截单时间" rules={[{ required: true }]} style={createFormItemStyle}>
                        <DatePicker showTime style={{ width: '100%' }} placeholder="截单截止" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="etd" label="起飞日期" rules={[{ required: true }]} style={createFormItemStyle}>
                        <DatePicker style={{ width: '100%' }} placeholder="预计起飞" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="eta" label="预计到达" style={createFormItemStyle}>
                        <DatePicker style={{ width: '100%' }} placeholder="预计到达" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ) : (
                <>
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="blNo" label="提单号" rules={[{ required: true, message: '请输入提单号' }]} style={createFormItemStyle}>
                        <Input placeholder="如 COSCO-LOS-260301" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="carrier" label="船公司" rules={[{ required: true, message: '请选择船公司' }]} style={createFormItemStyle}>
                        <Select placeholder="选择船公司" options={SEA_CARRIER_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="vesselVoyage" label="船名/航次" style={createFormItemStyle}>
                        <Input placeholder="如 COSCO FORTUNE V.025E" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="containerNo" label="集装箱号" style={createFormItemStyle}>
                        <Input placeholder="如 MSKU1234567" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="containerType" label="柜型" rules={[{ required: true }]} style={createFormItemStyle}>
                        <Select placeholder="选择柜型" options={CONTAINER_TYPE_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="serviceMode" label="装柜方式" style={createFormItemStyle}>
                        <Select placeholder="选择方式">
                          <Option value="FCL">整柜 FCL</Option>
                          <Option value="LCL">拼柜 LCL</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="originPort" label="起运港" rules={[{ required: true }]} style={createFormItemStyle}>
                        <Select placeholder="选择港口">
                          {PORT_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="transitPort" label="中转港" style={createFormItemStyle}>
                        <Select allowClear placeholder="选填">
                          {PORT_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="destPort" label="目的港" rules={[{ required: true }]} style={createFormItemStyle}>
                        <Select placeholder="选择港口">
                          {PORT_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={20}>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="cutoffDate" label="截关日期" rules={[{ required: true }]} style={createFormItemStyle}>
                        <DatePicker style={{ width: '100%' }} placeholder="货物截止入港" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="etd" label="开船日期" rules={[{ required: true }]} style={createFormItemStyle}>
                        <DatePicker style={{ width: '100%' }} placeholder="预计开船" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item {...createFormItemLayout} name="eta" label="预计到港" style={createFormItemStyle}>
                        <DatePicker style={{ width: '100%' }} placeholder="预计到达" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              )}
            </div>

            <div style={createSectionStyle}>
              <div style={createSectionTitleStyle}>货物信息</div>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} name="weightKg" label="总重量(KG)" rules={[{ required: true, message: '请输入重量' }]} style={createFormItemStyle}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} name="pieces" label="总件数" rules={[{ required: true, message: '请输入件数' }]} style={createFormItemStyle}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} name="volumeCbm" label="总体积(CBM)" style={createFormItemStyle}>
                    <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={24}>
                  <Form.Item {...createFormItemLayout} name="remark" label="备注" style={{ ...createFormItemStyle, marginBottom: 0 }}>
                    <Input.TextArea rows={2} placeholder="特殊要求、注意事项等" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {isEditMode ? (
              <Alert style={{ marginBottom: 16 }} type="info" showIcon message={businessMode === 'AIR' ? `关联集装号：${editContainerCount} 个` : `关联集装箱：${editContainerCount} 个`} />
            ) : null}

            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8 }}
              message="发往地址、拖车公司、司机与车牌等信息在「起运国仓储 → 任务执行」环节由仓管员填写，本表单不再重复录入。"
            />
          </div>
        </Form>
      </Modal>

      <Modal
        title="暂停任务"
        open={suspendModalOpen}
        onCancel={() => { setSuspendModalOpen(false); setSuspendTargetId(null); }}
        onOk={handleSuspendConfirm}
        okText="确认暂停"
        okButtonProps={{ style: { background: '#fa8c16', borderColor: '#fa8c16' } }}
        width={480}
        destroyOnClose
      >
        <Form form={suspendForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="suspendReason" label="暂停原因" rules={[{ required: true, message: '请选择暂停原因' }]}>
            <Select placeholder="选择暂停原因">
              <Option value="客户要求暂停">客户要求暂停</Option>
              <Option value="付款问题">付款问题</Option>
              <Option value="海关查验">海关查验</Option>
              <Option value="单证不齐">单证不齐</Option>
              <Option value="货物问题">货物问题（破损/短缺）</Option>
              <Option value="船期变更">船期/航班变更</Option>
              <Option value="内部调度">内部调度调整</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="suspendRemark" label="备注说明">
            <Input.TextArea rows={2} placeholder="补充说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="节点跟踪"
        open={nodeUpdateOpen}
        onClose={() => { setNodeUpdateOpen(false); setNodeUpdateTaskId(null); }}
        width={500}
        destroyOnClose
      >
        {(() => {
          const currentTask = tasks.find((t) => t.id === nodeUpdateTaskId);
          if (!currentTask) return null;
          const firstContainer = currentTask.jobs.flatMap((j) => j.containers)[0];
          const flow = nodeFlowByMode(mode);
          const flowSet = new Set(flow.map((item) => item.nodeCode));
          const completedNodes = (firstContainer?.nodeProgress?.completedNodes || []).filter((n) => flowSet.has(n.nodeCode));
          const completedMap = new Map(completedNodes.map((n) => [n.nodeCode, n]));
          const completedCount = flow.filter((item) => completedMap.has(item.nodeCode)).length;
          const nextNodeIndex = flow.findIndex((item) => !completedMap.has(item.nodeCode));
          const firstJob = currentTask.jobs[0];
          const containerNos = currentTask.jobs.flatMap((j) => j.containers).map((c) => c.containerNo);

          return (
            <div>
              {/* 头部信息 */}
              <div style={{ marginBottom: 20, padding: '12px 16px', background: '#f5f5f5', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{currentTask.id}</div>
                <Space size={12} style={{ color: '#8c8c8c', fontSize: 13 }}>
                  <span>{firstJob?.routeName}</span>
                  <span>{firstJob?.originPort} → {firstJob?.destPort}</span>
                </Space>
              </div>

              {/* 关联集装箱 */}
              {containerNos.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Space size={4} wrap>
                    {containerNos.map((no) => (
                      <Tag key={no} color="blue" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{no}</Tag>
                    ))}
                  </Space>
                </div>
              )}

              {/* 进度概览 */}
              <div style={{ marginBottom: 20, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  进度：{completedCount} / {flow.length} 个节点已完成
                  {completedCount === flow.length && <Tag color="success" style={{ marginLeft: 8 }}>全部完成</Tag>}
                </Text>
              </div>

              {/* 纵向时间轴 */}
              <div style={{ padding: '0 4px' }}>
                {flow.map((node, index) => {
                  const completed = completedMap.get(node.nodeCode);
                  const isCurrent = index === nextNodeIndex;
                  const isFuture = !completed && !isCurrent;

                  return (
                    <div key={node.nodeCode} style={{ display: 'flex', gap: 12, minHeight: isCurrent ? 'auto' : 56 }}>
                      {/* 左侧时间轴线 */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
                        {completed ? (
                          completed.isAbnormal ? (
                            <ExclamationCircleFilled style={{ fontSize: 20, color: '#fa8c16' }} />
                          ) : (
                            <CheckCircleFilled style={{ fontSize: 20, color: '#52c41a' }} />
                          )
                        ) : isCurrent ? (
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 0 3px rgba(22, 119, 255, 0.2)',
                          }}>
                            <ClockCircleFilled style={{ fontSize: 12, color: '#fff' }} />
                          </div>
                        ) : (
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            border: '2px solid #d9d9d9', background: '#fff',
                          }} />
                        )}
                        {index < flow.length - 1 && (
                          <div style={{
                            flex: 1, width: 2, minHeight: 16,
                            background: completed ? '#52c41a' : '#d9d9d9',
                          }} />
                        )}
                      </div>

                      {/* 右侧内容 */}
                      <div style={{ flex: 1, paddingBottom: isCurrent ? 16 : 8 }}>
                        <div style={{
                          fontWeight: isCurrent ? 600 : completed ? 500 : 400,
                          fontSize: 14,
                          color: isFuture ? '#bfbfbf' : '#262626',
                          lineHeight: '20px',
                        }}>
                          {node.nodeName}
                          {completed?.isAbnormal && (
                            <Tag color="warning" style={{ marginLeft: 8, fontSize: 11 }}>异常</Tag>
                          )}
                        </div>

                        {/* 已完成节点：显示时间和操作人 */}
                        {completed && (
                          <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                            <Space size={8}>
                              <span>{completed.date}</span>
                              {completed.operator && <span>操作人: {completed.operator}</span>}
                            </Space>
                            {completed.remark && (
                              <div style={{ marginTop: 2, color: '#8c8c8c', fontStyle: 'italic' }}>
                                备注: {completed.remark}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 当前待执行节点：内联表单 */}
                        {isCurrent && (
                          <div style={{
                            marginTop: 8, padding: 12, background: '#f0f5ff',
                            borderRadius: 6, border: '1px solid #d6e4ff',
                          }}>
                            <Form form={nodeUpdateForm} layout="vertical" initialValues={{ isAbnormal: false, date: dayjs() }} size="small">
                              <Form.Item name="date" label="完成日期" rules={[{ required: true, message: '请选择日期' }]} style={{ marginBottom: 8 }}>
                                <DatePicker style={{ width: '100%' }} />
                              </Form.Item>
                              <Form.Item name="isAbnormal" valuePropName="checked" style={{ marginBottom: 8 }}>
                                <Checkbox>该节点存在异常</Checkbox>
                              </Form.Item>
                              <Form.Item name="remark" label="备注" style={{ marginBottom: 8 }}>
                                <Input.TextArea rows={2} placeholder="选填备注" />
                              </Form.Item>
                              <Button type="primary" size="small" onClick={() => submitNodeUpdate(node.nodeCode)}>
                                确认完成
                              </Button>
                            </Form>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </Drawer>

      <Modal
        title="删除任务"
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={confirmDelete}
        okText="确认删除"
        okButtonProps={{ danger: true, disabled: selectedDeleteJobIds.length === 0 }}
      >
        {deleteTask ? (
          <>
            <p>请选择要删除的 JOB：</p>
            <Checkbox.Group
              value={selectedDeleteJobIds}
              onChange={(values) => setSelectedDeleteJobIds(values as string[])}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {deleteTask.jobs.map((job) => (
                  <Checkbox key={job.id} value={job.id}>
                    <Space>
                      <span style={{ fontWeight: 600 }}>{job.jobNo}</span>
                      <span style={{ color: '#8c8c8c' }}>{job.stationName}</span>
                      <span style={{ color: '#8c8c8c' }}>{job.routeName}</span>
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </>
        ) : null}
      </Modal>

      <Drawer title="任务详情" open={detailOpen} onClose={closeDetailDrawer} width="90%">
        {selectedTask && selectedJob ? (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 180, borderRight: '1px solid #f0f0f0', paddingRight: 8 }}>
              <Anchor
                affix={false}
                getContainer={() => detailScrollRef.current || window}
                items={[
                  { key: 'basic', href: '#task-basic-info', title: '基本信息' },
                  { key: 'shipping', href: '#task-basic-info', title: businessMode === 'AIR' ? '航班信息' : '船务信息' },
                  { key: 'supplier', href: '#task-supplier-info', title: '供应商 / 送货' },
                  { key: 'node', href: '#task-node-change', title: '节点变更记录' },
                  { key: 'container', href: '#task-container-list', title: businessMode === 'AIR' ? '集装号列表' : '集装箱列表' },
                  { key: 'cost', href: '#task-cost-detail', title: '成本明细' },
                ]}
              />
            </div>
            <div
              ref={detailScrollRef}
              style={{ flex: 1, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: 8 }}
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div id="task-basic-info">
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>基本信息</Text>
                  <Descriptions column={4} size="small" bordered>
                    <Descriptions.Item label="任务编号">{selectedTask.id}</Descriptions.Item>
                    <Descriptions.Item label="JOB号">{selectedJob.jobNo}</Descriptions.Item>
                    <Descriptions.Item label="操作站点">{selectedJob.stationName}</Descriptions.Item>
                    <Descriptions.Item label="执行状态"><Tag color={STATUS_COLOR[selectedTask.status]}>{STATUS_LABEL[selectedTask.status]}</Tag></Descriptions.Item>
                    <Descriptions.Item label="服务类型">{SERVICE_LABEL[selectedJob.serviceType]}</Descriptions.Item>
                    <Descriptions.Item label="线路">{selectedJob.routeName}</Descriptions.Item>
                    <Descriptions.Item label="创建人">{selectedTask.createdBy}</Descriptions.Item>
                    <Descriptions.Item label="更新日期">{selectedTask.updatedAt}</Descriptions.Item>
                  </Descriptions>

                  <Text strong style={{ fontSize: 15, display: 'block', margin: '16px 0 8px' }}>{businessMode === 'AIR' ? '航班信息' : '船务信息'}</Text>
                  {businessMode === 'AIR' ? (
                    <Descriptions column={4} size="small" bordered>
                      <Descriptions.Item label="主运单号">{selectedJob.mawbNo || '-'}</Descriptions.Item>
                      <Descriptions.Item label="分运单号">{selectedJob.hawbNo || '-'}</Descriptions.Item>
                      <Descriptions.Item label="航空公司">{selectedJob.carrier || '-'}</Descriptions.Item>
                      <Descriptions.Item label="航班号">{selectedJob.flightNo || '-'}</Descriptions.Item>
                      <Descriptions.Item label="起飞机场">{selectedJob.originPort}</Descriptions.Item>
                      <Descriptions.Item label="目的机场">{selectedJob.destPort}</Descriptions.Item>
                      <Descriptions.Item label="截单时间">{selectedJob.cutoffDate || '-'}</Descriptions.Item>
                      <Descriptions.Item label="起飞日期">{selectedJob.etd || '-'}</Descriptions.Item>
                      <Descriptions.Item label="预计到达">{selectedJob.eta || '-'}</Descriptions.Item>
                    </Descriptions>
                  ) : (
                    <Descriptions column={4} size="small" bordered>
                      <Descriptions.Item label="提单号">{selectedJob.blNo || '-'}</Descriptions.Item>
                      <Descriptions.Item label="船公司">{selectedJob.carrier || '-'}</Descriptions.Item>
                      <Descriptions.Item label="船名/航次">{selectedJob.vesselVoyage || '-'}</Descriptions.Item>
                      <Descriptions.Item label="集装箱号">{selectedJob.containerNo || '-'}</Descriptions.Item>
                      <Descriptions.Item label="柜型">{selectedJob.containerType || '-'}</Descriptions.Item>
                      <Descriptions.Item label="装柜方式">{selectedJob.serviceMode === 'FCL' ? '整柜 FCL' : selectedJob.serviceMode === 'LCL' ? '拼柜 LCL' : '-'}</Descriptions.Item>
                      <Descriptions.Item label="起运港">{selectedJob.originPort}</Descriptions.Item>
                      <Descriptions.Item label="中转港">{selectedJob.transitPort || '-'}</Descriptions.Item>
                      <Descriptions.Item label="目的港">{selectedJob.destPort}</Descriptions.Item>
                      <Descriptions.Item label="截关日期">{selectedJob.cutoffDate || '-'}</Descriptions.Item>
                      <Descriptions.Item label="开船日期">{selectedJob.etd || '-'}</Descriptions.Item>
                      <Descriptions.Item label="预计到港">{selectedJob.eta || '-'}</Descriptions.Item>
                    </Descriptions>
                  )}

                  <Text strong style={{ fontSize: 15, display: 'block', margin: '16px 0 8px' }}>货物信息</Text>
                  <Descriptions column={4} size="small" bordered>
                    <Descriptions.Item label="总重量(KG)">{selectedJob.weightKg.toLocaleString()}</Descriptions.Item>
                    <Descriptions.Item label="总件数">{selectedJob.pieces}</Descriptions.Item>
                    <Descriptions.Item label="总体积(CBM)">{selectedJob.volumeCbm?.toFixed(2) || '-'}</Descriptions.Item>
                    <Descriptions.Item label="备注">{selectedJob.remark || '-'}</Descriptions.Item>
                  </Descriptions>
                </div>

                <div id="task-supplier-info" style={{ marginTop: 20 }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>供应商 / 送货信息</Text>
                  <Descriptions column={2} size="small" bordered>
                    <Descriptions.Item label="供应商">{selectedTask.supplier?.supplierName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="电话">{selectedTask.supplier?.phone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="地址" span={2}>{selectedTask.supplier?.address || '-'}</Descriptions.Item>
                    <Descriptions.Item label="送货公司">{selectedTask.deliveryCompany?.companyName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="运单号">{selectedTask.deliveryCompany?.trackingNo || '-'}</Descriptions.Item>
                    <Descriptions.Item label="司机">
                      {(selectedTask.deliveryCompany?.driverName || '-')}{' / '}{(selectedTask.deliveryCompany?.driverPhone || '-')}
                    </Descriptions.Item>
                    <Descriptions.Item label="车牌">{selectedTask.deliveryCompany?.plateNo || '-'}</Descriptions.Item>
                  </Descriptions>
                </div>

                <div id="task-node-change" style={{ marginTop: 20 }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>{`节点变更记录（${nodeChangeRows.length}）`}</Text>
                  <Table
                    rowKey="key"
                    columns={nodeChangeColumns}
                    dataSource={nodeChangeRows}
                    size="small"
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                </div>

                <div id="task-container-list" style={{ marginTop: 20 }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>{businessMode === 'AIR' ? `集装号列表（${selectedContainers.length}）` : `集装箱列表（${selectedContainers.length}）`}</Text>
                  <Table
                    rowKey="containerNo"
                    columns={[
                      {
                        title: businessMode === 'AIR' ? '集装号' : '集装箱号',
                        dataIndex: 'containerNo',
                        key: 'containerNo',
                        width: 140,
                        render: (value: string, record: MutableLegacyContainer) => (
                          <a onClick={() => openContainerDetail(record)} style={{ fontFamily: 'monospace', fontWeight: 600 }}>{value}</a>
                        ),
                      },
                      { title: '线路', dataIndex: 'routeName', key: 'routeName', width: 220 },
                      { title: '服务', dataIndex: 'serviceType', key: 'serviceType', width: 90, align: 'center' as const },
                      { title: '件数', dataIndex: 'pieces', key: 'pieces', width: 80, align: 'right' as const },
                      {
                        title: '体积CBM',
                        dataIndex: 'volumeCbm',
                        key: 'volumeCbm',
                        width: 110,
                        align: 'right' as const,
                        render: (value: number) => value.toFixed(4),
                      },
                      {
                        title: '体积重KGS',
                        dataIndex: 'volumeWeightKgs',
                        key: 'volumeWeightKgs',
                        width: 110,
                        align: 'right' as const,
                        render: (value: number) => value.toFixed(2),
                      },
                      {
                        title: '毛重KGS',
                        dataIndex: 'grossWeightKgs',
                        key: 'grossWeightKgs',
                        width: 110,
                        align: 'right' as const,
                        render: (value: number) => value.toFixed(2),
                      },
                    ]}
                    dataSource={selectedContainers}
                    size="small"
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                </div>

                <div id="task-cost-detail" style={{ marginTop: 20 }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>{`费用条目详情（${selectedCostItems.length}）`}</Text>
                  <Table
                    rowKey="id"
                    columns={costDetailColumns}
                    dataSource={selectedCostItems}
                    size="small"
                    pagination={false}
                    locale={{ emptyText: '暂无成本记录' }}
                    scroll={{ x: 2050 }}
                  />
                </div>
              </Space>
            </div>
          </div>
        ) : (
          <Alert type="error" showIcon message="任务或JOB不存在" />
        )}
      </Drawer>

      <Modal
        title={activeNodeRow ? `附件管理 - ${activeNodeRow.nodeName}` : '附件管理'}
        open={attachmentOpen}
        onCancel={() => setAttachmentOpen(false)}
        footer={null}
        width={760}
      >
        {activeNodeRow ? (
          <>
            <Space style={{ marginBottom: 12 }} align="center">
              <Text type="secondary">时间：{activeNodeRow.time}</Text>
              <Text type="secondary">附件总数：{activeNodeRow.attachments.length}</Text>
              <Upload
                showUploadList={false}
                multiple
                beforeUpload={(file) => {
                  addAttachment(activeNodeRow.key, file as File);
                  return Upload.LIST_IGNORE;
                }}
              >
                <Button icon={<UploadOutlined />} type="primary" size="small">新增附件</Button>
              </Upload>
            </Space>
            <Table
              rowKey="uid"
              size="small"
              columns={attachmentColumns}
              dataSource={activeNodeRow.attachments}
              pagination={false}
              locale={{ emptyText: '暂无附件，请点击“新增附件”' }}
            />
          </>
        ) : (
          <Alert type="warning" showIcon message="未选择节点记录" />
        )}
      </Modal>

      <Modal
        title={detailContainer ? `${businessMode === 'AIR' ? '集装号' : '集装箱'}详情 - ${detailContainer.containerNo}` : '详情'}
        open={containerDetailOpen}
        onCancel={() => setContainerDetailOpen(false)}
        footer={null}
        width={1200}
      >
        <Table
          rowKey="seq"
          columns={orderColumns}
          dataSource={detailContainer?.orders || []}
          size="small"
          pagination={false}
          scroll={{ x: 1300 }}
        />
      </Modal>

      {/* 成本录入 Drawer */}
      <Drawer
        title="JOB 成本录入"
        placement="right"
        open={costEditorOpen}
        onClose={() => { setCostEditorOpen(false); setCostEditorTaskId(null); setCostEditorRows([]); }}
        width="96vw"
        destroyOnHidden
        styles={{ body: { padding: 16 } }}
        extra={(
          <Space>
            <Button onClick={() => { setCostEditorOpen(false); setCostEditorTaskId(null); setCostEditorRows([]); }}>取消</Button>
            <Button onClick={() => persistCostEditor(false)}>保存草稿</Button>
            <Button type="primary" onClick={() => persistCostEditor(true)}>提交主管审核</Button>
          </Space>
        )}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={'费用条目使用表格式录入。已审核条目为锁定行，只能通过\u201C申请修改\u201D生成待审核变更；新增条目和驳回条目可直接编辑。'}
        />

        <Descriptions size="small" column={4} bordered style={{ marginBottom: 12 }}>
          <Descriptions.Item label="任务号" span={2}>{costEditorJobNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="站点">{costEditorTask?.jobs[0]?.stationName || '-'}</Descriptions.Item>
          <Descriptions.Item label="线路">{costEditorTask?.jobs[0]?.routeName || '-'}</Descriptions.Item>
          <Descriptions.Item label="起运港">{costEditorTask?.jobs[0]?.originPort || '-'}</Descriptions.Item>
          <Descriptions.Item label="目的港">{costEditorTask?.jobs[0]?.destPort || '-'}</Descriptions.Item>
          <Descriptions.Item label="服务类型">{costEditorTask ? SERVICE_LABEL[costEditorTask.jobs[0]?.serviceType || 'STANDARD'] : '-'}</Descriptions.Item>
          <Descriptions.Item label="件数">{costEditorTask ? costEditorTask.jobs.reduce((sum, j) => sum + Number(j.pieces || 0), 0) : '-'}</Descriptions.Item>
          <Descriptions.Item label="应付合计">CNY {costEditorAmount.toFixed(2)}</Descriptions.Item>
        </Descriptions>

        <Card size="small" title="费用条目" extra={<Button type="dashed" onClick={addCostEditorRow}>+ 添加行</Button>}>
          <Table
            rowKey="id"
            columns={costEditorColumns}
            dataSource={costEditorRows}
            pagination={false}
            size="small"
            scroll={{ x: 2100 }}
          />
        </Card>
      </Drawer>
    </div>
  );
};
