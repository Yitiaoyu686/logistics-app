import React, { useMemo, useState, useRef } from 'react';
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

function cloneTasks(): MutableLegacyTask[] {
  return JSON.parse(JSON.stringify(LEGACY_TASKS)) as MutableLegacyTask[];
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
  const routeName = routeNames.length > 1 ? `${routeNames[0]} 等${routeNames.length}条` : (routeNames[0] || '');
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
}

export const LegacyTaskManager: React.FC<LegacyTaskManagerProps> = ({ mode = 'ORIGIN' }) => {
  const [tasks, setTasks] = useState<MutableLegacyTask[]>(() => cloneTasks());
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

  const selectedCostItems = (selectedTask?.costItems || []) as LegacyCostItem[];
  const selectedContainers = useMemo(
    () => (selectedTask ? selectedTask.jobs.flatMap((job) => job.containers) : []),
    [selectedTask],
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
      supplierName: task.supplier?.supplierName || '',
      supplierPhone: task.supplier?.phone || '',
      supplierAddress: task.supplier?.address || '',
      deliveryCompany: task.deliveryCompany?.companyName || '',
      trackingNo: task.deliveryCompany?.trackingNo || '',
      queryPhone: task.deliveryCompany?.queryPhone || '',
      driverName: task.deliveryCompany?.driverName || '',
      driverPhone: task.deliveryCompany?.driverPhone || '',
      plateNo: task.deliveryCompany?.plateNo || '',
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
        return {
          ...task,
          updatedAt: now,
          supplier: {
            supplierName: values.supplierName || '',
            phone: values.supplierPhone || '',
            address: values.supplierAddress || '',
          },
          deliveryCompany: {
            companyName: values.deliveryCompany || '',
            trackingNo: values.trackingNo || '',
            queryPhone: values.queryPhone || '',
            driverName: values.driverName || '',
            driverPhone: values.driverPhone || '',
            plateNo: values.plateNo || '',
          },
          jobs: [updatedJob, ...task.jobs.slice(1)],
        };
      }));
      message.success('任务已更新');
    } else {
      const taskId = `JOB${dayjs().format('YYMMDDHHmmss')}${Math.floor(Math.random() * 90 + 10)}`;
      const jobId = `J${Math.floor(Math.random() * 900 + 100)}`;
      const prefix = makeContainerPrefix(values.originPort, values.destPort);
      const containers = genContainers(prefix, values.routeName, values.serviceType === 'EXPRESS' ? '特快' : '普快', 5);
      const newTask: MutableLegacyTask = {
        id: taskId,
        status: 'PENDING',
        createdBy: 'CANSAMPAO',
        createdAt: now,
        updatedAt: now,
        supplier: {
          supplierName: values.supplierName || '',
          phone: values.supplierPhone || '',
          address: values.supplierAddress || '',
        },
        deliveryCompany: {
          companyName: values.deliveryCompany || '',
          trackingNo: values.trackingNo || '',
          queryPhone: values.queryPhone || '',
          driverName: values.driverName || '',
          driverPhone: values.driverPhone || '',
          plateNo: values.plateNo || '',
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
    setDetailTaskId(row.taskId);
    setDetailJobId(row.firstJob.id);
    setActiveNodeKey(null);
    setDetailOpen(true);
    setTimeout(() => {
      scrollDetailTo('task-cost-detail');
    }, 320);
  };

  const openNodeUpdate = (row: TaskListRow) => {
    const flow = nodeFlowByMode(mode);
    const flowSet = new Set(flow.map((item) => item.nodeCode));

    let defaultContainer: MutableLegacyContainer | null = null;
    let defaultNodeCode = flow[0]?.nodeCode || '';

    for (const container of row.allContainers) {
      const completedSet = new Set((container.nodeProgress?.completedNodes || [])
        .filter((node) => flowSet.has(node.nodeCode))
        .map((node) => node.nodeCode));
      const nextNode = flow.find((item) => !completedSet.has(item.nodeCode));
      if (nextNode) {
        defaultContainer = container;
        defaultNodeCode = nextNode.nodeCode;
        break;
      }
    }

    if (!defaultContainer) {
      message.info('该任务当前环节节点已全部更新完成');
      return;
    }

    setNodeUpdateTaskId(row.taskId);
    nodeUpdateForm.setFieldsValue({
      containerNo: defaultContainer.containerNo,
      nodeCode: defaultNodeCode,
      date: dayjs(),
      isAbnormal: false,
      remark: '',
    });
    setNodeUpdateOpen(true);
  };

  const submitNodeUpdate = async () => {
    if (!nodeUpdateTaskId) return;
    const values = await nodeUpdateForm.validateFields();
    const flow = nodeFlowByMode(mode);
    const nodeMeta = flow.find((item) => item.nodeCode === values.nodeCode);
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    setTasks((prev) => prev.map((task) => {
      if (task.id !== nodeUpdateTaskId) return task;
      return {
        ...task,
        updatedAt: now,
        status: task.status === 'PENDING' ? 'IN_PROGRESS' : task.status,
        jobs: task.jobs.map((job) => ({
          ...job,
          containers: job.containers.map((container) => {
            if (container.containerNo !== values.containerNo) return container;
            return {
              ...container,
              nodeProgress: {
                ...container.nodeProgress,
                completedNodes: [
                  ...(container.nodeProgress?.completedNodes || []),
                  {
                    nodeCode: values.nodeCode,
                    nodeName: nodeMeta?.nodeName || values.nodeCode,
                    isAbnormal: Boolean(values.isAbnormal),
                    date: values.date.format('YYYY-MM-DD'),
                    remark: values.remark || '',
                    operator: 'CANSAMPAO',
                    updatedAt: now,
                  },
                ],
              },
            };
          }),
        })),
      };
    }));

    message.success(`${values.containerNo} 节点已更新`);
    setNodeUpdateOpen(false);
    setNodeUpdateTaskId(null);
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
      title: '筛选条件',
      dataIndex: 'cargoFilterLabel',
      key: 'cargoFilterLabel',
      width: 90,
      align: 'center',
    },
    {
      title: '集装号',
      key: 'containers',
      width: 260,
      render: (_value, row) => {
        const list = row.allContainers;
        const visible = list.slice(0, 4);
        const hidden = list.slice(4);
        return (
          <Space wrap size={[4, 4]}>
            {visible.map((container) => (
              <Tag
                key={container.containerNo}
                style={{ cursor: 'pointer', marginInlineEnd: 0 }}
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
          <Button type="link" size="small" icon={<ApartmentOutlined />} onClick={() => openNodeUpdate(row)}>节点更新</Button>
          {mode === 'ORIGIN' ? (
            <Button type="link" size="small" icon={<DollarOutlined />} onClick={() => openCostInput(row)}>成本录入</Button>
          ) : null}
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(row)}>详情</Button>
          {mode === 'ORIGIN' ? (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>编辑</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => openDelete(row)}>删除</Button>
            </>
          ) : null}
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

  const costColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_value: unknown, _row: LegacyCostItem, index: number) => index + 1,
    },
    { title: '费用类型', dataIndex: 'feeType', key: 'feeType', width: 120 },
    {
      title: '金额',
      key: 'amount',
      width: 140,
      align: 'right' as const,
      render: (_value: unknown, row: LegacyCostItem) => `${Number(row.amount || 0).toFixed(2)} ${row.currency || 'CNY'}`,
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' as const },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy', width: 120 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
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
                  <Form.Item {...createFormItemLayout} label="JOB" style={createFormItemStyle}>
                    <Input value={taskFormMeta.jobNo} disabled />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} label="创建账号" style={createFormItemStyle}>
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
                <Col span={12}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="stationName"
                    label="站点"
                    rules={[{ required: true, message: '请选择站点' }]}
                    style={createFormItemStyle}
                  >
                    <Select placeholder="选择站点">
                      {STATION_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="serviceType"
                    label="服务类型"
                    rules={[{ required: true }]}
                    style={createFormItemStyle}
                  >
                    <Select>
                      <Option value="EXPRESS">特快</Option>
                      <Option value="STANDARD">普快</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="routeName"
                    label="线路"
                    rules={[{ required: true, message: '请输入线路' }]}
                    style={createFormItemStyle}
                  >
                    <Input placeholder="例如 CAN.CHN→LOS.NGN" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="dispatchCenter"
                    label="调度中心"
                    style={createFormItemStyle}
                  >
                    <Input placeholder="例如 总调度中心 / R001" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={8}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="originPort"
                    label="起运港"
                    rules={[{ required: true, message: '请选择起运港' }]}
                    style={createFormItemStyle}
                  >
                    <Select>
                      {PORT_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item {...createFormItemLayout} name="transitPort" label="中转港" style={createFormItemStyle}>
                    <Select allowClear>
                      {PORT_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="destPort"
                    label="到达港"
                    rules={[{ required: true, message: '请选择到达港' }]}
                    style={createFormItemStyle}
                  >
                    <Select>
                      {PORT_OPTIONS.map((item) => <Option key={item} value={item}>{item}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="executeDate"
                    label="执行日期"
                    rules={[{ required: true, message: '请选择日期' }]}
                    style={createFormItemStyle}
                  >
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="weightKg"
                    label="重量KG"
                    rules={[{ required: true, message: '请输入重量' }]}
                    style={createFormItemStyle}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="pieces"
                    label="件数"
                    rules={[{ required: true, message: '请输入件数' }]}
                    style={createFormItemStyle}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={24}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="remark"
                    label="备注"
                    style={{ ...createFormItemStyle, marginBottom: 0 }}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {isEditMode ? (
              <Alert style={{ marginBottom: 16 }} type="info" showIcon message={`关联集装号：${editContainerCount} 个`} />
            ) : null}

            <div style={createSectionStyle}>
              <div style={createSectionTitleStyle}>发往信息</div>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="supplierName"
                    label="供应商"
                    rules={[{ required: true, message: '请输入供应商' }]}
                    style={createFormItemStyle}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item {...createFormItemLayout} name="supplierPhone" label="电话" style={createFormItemStyle}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={24}>
                  <Form.Item
                    {...createFormItemLayout}
                    name="supplierAddress"
                    label="地址"
                    style={{ ...createFormItemStyle, marginBottom: 0 }}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={createSectionTitleStyle}>送货公司信息</div>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item {...createFormItemLayout} name="deliveryCompany" label="公司名称" style={createFormItemStyle}>
                    <Select allowClear>
                      {DELIVERY_COMPANIES.map((item) => <Option key={item} value={item}>{item}</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item {...createFormItemLayout} name="trackingNo" label="运单号/订单号" style={createFormItemStyle}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item {...createFormItemLayout} name="driverName" label="司机名称" style={createFormItemStyle}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item {...createFormItemLayout} name="driverPhone" label="司机电话" style={createFormItemStyle}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={20}>
                <Col span={12}>
                  <Form.Item {...createFormItemLayout} name="queryPhone" label="查询电话" style={{ ...createFormItemStyle, marginBottom: 0 }}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item {...createFormItemLayout} name="plateNo" label="车牌号码" style={{ ...createFormItemStyle, marginBottom: 0 }}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </div>
        </Form>
      </Modal>

      <Modal
        title="节点更新"
        open={nodeUpdateOpen}
        onCancel={() => setNodeUpdateOpen(false)}
        onOk={submitNodeUpdate}
        okText="提交"
        width={520}
      >
        <Form form={nodeUpdateForm} layout="vertical" initialValues={{ isAbnormal: false }}>
          <Form.Item name="containerNo" label="集装号" rules={[{ required: true, message: '请选择集装号' }]}>
            <Select placeholder="选择集装号">
              {(tasks.find((task) => task.id === nodeUpdateTaskId)?.jobs || [])
                .flatMap((job) => job.containers)
                .map((container) => (
                  <Option key={container.containerNo} value={container.containerNo}>{container.containerNo}</Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="nodeCode" label="物流节点" rules={[{ required: true, message: '请选择节点' }]}>
            <Select placeholder="选择节点">
              {nodeOptions.map((item) => (
                <Option key={item.nodeCode} value={item.nodeCode}>{item.nodeName}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isAbnormal" valuePropName="checked">
            <Checkbox>该节点存在异常情况</Checkbox>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="选填备注" />
          </Form.Item>
        </Form>
      </Modal>

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
                  { key: 'supplier', href: '#task-supplier-info', title: '供应商 / 送货' },
                  { key: 'node', href: '#task-node-change', title: '节点变更记录' },
                  { key: 'container', href: '#task-container-list', title: '集装号列表' },
                  { key: 'cost', href: '#task-cost-detail', title: '成本明细' },
                ]}
              />
            </div>
            <div
              ref={detailScrollRef}
              style={{ flex: 1, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: 8 }}
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card id="task-basic-info" size="small" title="基本信息">
                  <Descriptions column={4} size="small" bordered>
                    <Descriptions.Item label="任务编号">{selectedTask.id}</Descriptions.Item>
                    <Descriptions.Item label="JOB号">{selectedJob.jobNo}</Descriptions.Item>
                    <Descriptions.Item label="服务类型">{SERVICE_LABEL[selectedJob.serviceType]}</Descriptions.Item>
                    <Descriptions.Item label="执行状态">{STATUS_LABEL[selectedTask.status]}</Descriptions.Item>
                    <Descriptions.Item label="线路">{selectedJob.routeName}</Descriptions.Item>
                    <Descriptions.Item label="起运港">{selectedJob.originPort}</Descriptions.Item>
                    <Descriptions.Item label="目的港">{selectedJob.destPort}</Descriptions.Item>
                    <Descriptions.Item label="执行日期">{selectedJob.executeDate}</Descriptions.Item>
                    <Descriptions.Item label="重量Kg">{selectedJob.weightKg.toLocaleString()}</Descriptions.Item>
                    <Descriptions.Item label="件数">{selectedJob.pieces}</Descriptions.Item>
                    <Descriptions.Item label="创建人">{selectedTask.createdBy}</Descriptions.Item>
                    <Descriptions.Item label="更新日期">{selectedTask.updatedAt}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Card id="task-supplier-info" size="small" title="供应商 / 送货信息">
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
                </Card>

                <Card id="task-node-change" size="small" title={`节点变更记录（${nodeChangeRows.length}）`}>
                  <Table
                    rowKey="key"
                    columns={nodeChangeColumns}
                    dataSource={nodeChangeRows}
                    size="small"
                    pagination={false}
                    scroll={{ x: 1100 }}
                  />
                </Card>

                <Card id="task-container-list" size="small" title={`集装号列表（${selectedContainers.length}）`}>
                  <Table
                    rowKey="containerNo"
                    columns={[
                      {
                        title: '集装号',
                        dataIndex: 'containerNo',
                        key: 'containerNo',
                        width: 120,
                        render: (value: string, record: MutableLegacyContainer) => (
                          <a onClick={() => openContainerDetail(record)}>{value}</a>
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
                </Card>

                <Card id="task-cost-detail" size="small" title={`成本明细（${selectedCostItems.length}）`}>
                  <Table
                    rowKey="id"
                    columns={costColumns}
                    dataSource={selectedCostItems}
                    size="small"
                    pagination={false}
                    locale={{ emptyText: '暂无成本记录' }}
                    scroll={{ x: 760 }}
                  />
                </Card>
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
        title={detailContainer ? `集装号详情 - ${detailContainer.containerNo}` : '集装号详情'}
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
    </div>
  );
};
