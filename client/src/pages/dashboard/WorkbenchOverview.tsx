import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  ArrowRightOutlined,
  BellOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  ExclamationCircleFilled,
  NotificationOutlined,
  ReloadOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  authApi,
  clientApi,
  feeApi,
  salesApi,
  v2OmsApi,
  v2PodApi,
  v2WmsApi,
  warehouseApi,
} from '../../api';
import { mapV2OrderRowToMasterOrder } from '../oms/orderV2Mapper';
import { LEGACY_TASKS, type LegacyTask } from '../tms/taskManagerLegacyData';
import { buildDeliveryTaskRows, listPickupRecords } from '../wms/destination/podUiMockStore';

const { Text, Title } = Typography;

type UserRole =
  | 'ADMIN'
  | 'SALES'
  | 'WAREHOUSE_CN'
  | 'OPS_CN'
  | 'OPS_US'
  | 'WAREHOUSE_US'
  | 'FINANCE'
  | 'BOSS';
type BusinessMode = 'ALL' | 'AIR' | 'SEA';
type TodoTone = 'blue' | 'orange' | 'red' | 'green' | 'purple' | 'default';
type LegacyTaskMode = 'ORIGIN' | 'DEST';
type SupervisorTaskStatus = 'DRAFT' | 'PENDING_SUPERVISOR' | 'PART_REJECTED' | 'REJECTED' | 'APPROVED';
type OrderFeeStatus = 'DRAFT' | 'PENDING' | 'PART_REJECTED' | 'REJECTED' | 'APPROVED';

interface WorkbenchOverviewProps {
  currentRole: UserRole;
  businessMode: BusinessMode;
  warehouseId?: string;
  onOpenTab: (tabKey: string) => void;
  canOpenTab: (tabKey: string) => boolean;
}

interface WorkbenchAction {
  label: string;
  tabKey: string;
}

interface WorkbenchMetric {
  title: string;
  value: number | string;
  suffix?: string;
  description?: string;
  tabKey: string;
  tone?: TodoTone;
}

interface WorkbenchTodoItem {
  title: string;
  source: string;
  count: number;
  tabKey: string;
  actionLabel?: string;
  tone?: TodoTone;
  summary?: string;
  samples?: string[];
}

interface WorkbenchTodoSection {
  title: string;
  description: string;
  items: WorkbenchTodoItem[];
}

interface WorkbenchProgressItem {
  title: string;
  stage: string;
  meta: string;
  updatedAt?: string;
  tabKey: string;
  tone?: TodoTone;
}

interface TaskProgressCard {
  jobNo: string;
  route: string;
  serviceType: string;
  cargoFilter: string;
  currentNode: string;
  currentNodeIndex: number;
  totalNodes: number;
  isAbnormal: boolean;
  updatedAt: string;
  tabKey: string;
}

interface AlertNoticeItem {
  id: string;
  type: 'ORDER_DELAY' | 'PAYMENT_OVERDUE' | 'STOCK_ABNORMAL' | 'CUSTOMS_DELAY' | 'DELIVERY_FAIL' | 'TASK_ABNORMAL';
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  time: string;
  tabKey: string;
}

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  time: string;
  isRead: boolean;
}

interface RoleWorkbenchData {
  title: string;
  description: string;
  metrics: WorkbenchMetric[];
  sections: WorkbenchTodoSection[];
  progressTitle: string;
  progressItems: WorkbenchProgressItem[];
  quickActions: WorkbenchAction[];
  notes: string[];
  taskProgressCards: TaskProgressCard[];
  alertItems: AlertNoticeItem[];
  notices: NoticeItem[];
}

interface ReviewSnapshot {
  total: number;
  pending: number;
  rejected: number;
  draft: number;
  approved: number;
  pendingSamples: string[];
  rejectedSamples: string[];
  draftSamples: string[];
}

interface FinanceSnapshot {
  pendingApprovalCount: number;
  pendingApprovalSamples: string[];
  rejectedApprovalCount: number;
  rejectedApprovalSamples: string[];
  outstandingReceivableCount: number;
  outstandingReceivableSamples: string[];
  overdueReceivableCount: number;
  overdueReceivableSamples: string[];
  pendingPayableCount: number;
  pendingPayableSamples: string[];
  overduePayableCount: number;
  overduePayableSamples: string[];
  progressItems: WorkbenchProgressItem[];
}

interface LegacyTaskSnapshot {
  openCount: number;
  pendingCount: number;
  inProgressCount: number;
  abnormalCount: number;
  openSamples: string[];
  abnormalSamples: string[];
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '系统管理员',
  SALES: '销售人员',
  WAREHOUSE_CN: '起运国仓管',
  OPS_CN: '起运国操作',
  OPS_US: '目的国操作',
  WAREHOUSE_US: '到达国仓管',
  FINANCE: '财务人员',
  BOSS: '管理层',
};

const PREVIEW_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'SALES', label: '销售工作台' },
  { value: 'WAREHOUSE_CN', label: '中国仓工作台' },
  { value: 'OPS_CN', label: '中国运营工作台' },
  { value: 'OPS_US', label: '美国运营工作台' },
  { value: 'WAREHOUSE_US', label: '美国仓工作台' },
  { value: 'FINANCE', label: '财务工作台' },
  { value: 'BOSS', label: '老板工作台' },
  { value: 'ADMIN', label: '管理员工作台' },
];

const TONE_STYLES: Record<TodoTone, { background: string; border: string; text: string }> = {
  blue: {
    background: '#f3f8ff',
    border: '#d8e7ff',
    text: '#1668dc',
  },
  orange: {
    background: '#fff7e8',
    border: '#ffe0b2',
    text: '#d46b08',
  },
  red: {
    background: '#fff2f0',
    border: '#ffccc7',
    text: '#cf1322',
  },
  green: {
    background: '#f6ffed',
    border: '#d9f7be',
    text: '#389e0d',
  },
  purple: {
    background: '#f9f0ff',
    border: '#efdbff',
    text: '#722ed1',
  },
  default: {
    background: '#fafafa',
    border: '#f0f0f0',
    text: '#595959',
  },
};

const FINAL_MASTER_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
const ORIGIN_INBOUND_PENDING_STATUSES = new Set(['PENDING']);
const TRANSFER_PENDING_STATUSES = new Set(['ARRIVED', 'RECEIVED']);
const RETURN_PENDING_STATUSES = new Set(['PENDING', 'APPROVED', 'CREATED']);
const ACTIVE_DELIVERY_STATUSES = new Set(['PENDING', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED']);

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

const POL_COST_STORAGE_KEY = 'job-cost-pol-task-demo-v4';
const POD_COST_STORAGE_KEY = 'job-cost-pod-task-demo-v20260323';
const DPN_COST_STORAGE_KEY = 'dpn-cost-task-demo-v20260323';
const ORDER_FEE_STORAGE_KEY = 'order-fee-demo-v20260323';

const BUSINESS_LABEL = {
  ALL: '综合协同',
  SEA: '海运业务',
  AIR: '空运业务',
};

const REVIEW_FALLBACKS: Record<
  'POL' | 'POD' | 'DPN' | 'ORDER',
  Record<BusinessMode, ReviewSnapshot>
> = {
  POL: {
    ALL: {
      total: 4,
      pending: 1,
      rejected: 1,
      draft: 1,
      approved: 1,
      pendingSamples: ['S-JOB26030004'],
      rejectedSamples: ['S-JOB26030007'],
      draftSamples: ['S-JOB26030010'],
    },
    SEA: {
      total: 4,
      pending: 1,
      rejected: 1,
      draft: 1,
      approved: 1,
      pendingSamples: ['S-JOB26030004'],
      rejectedSamples: ['S-JOB26030007'],
      draftSamples: ['S-JOB26030010'],
    },
    AIR: {
      total: 0,
      pending: 0,
      rejected: 0,
      draft: 0,
      approved: 0,
      pendingSamples: [],
      rejectedSamples: [],
      draftSamples: [],
    },
  },
  POD: {
    ALL: {
      total: 8,
      pending: 2,
      rejected: 2,
      draft: 2,
      approved: 2,
      pendingSamples: ['S-JOB26030004', 'A-JOB26030004'],
      rejectedSamples: ['S-JOB26030007', 'A-JOB26030007'],
      draftSamples: ['S-JOB26030010', 'A-JOB26030010'],
    },
    SEA: {
      total: 4,
      pending: 1,
      rejected: 1,
      draft: 1,
      approved: 1,
      pendingSamples: ['S-JOB26030004'],
      rejectedSamples: ['S-JOB26030007'],
      draftSamples: ['S-JOB26030010'],
    },
    AIR: {
      total: 4,
      pending: 1,
      rejected: 1,
      draft: 1,
      approved: 1,
      pendingSamples: ['A-JOB26030004'],
      rejectedSamples: ['A-JOB26030007'],
      draftSamples: ['A-JOB26030010'],
    },
  },
  DPN: {
    ALL: {
      total: 8,
      pending: 2,
      rejected: 2,
      draft: 2,
      approved: 2,
      pendingSamples: ['DPN-20260320-0004', 'DPN-20260320-0504'],
      rejectedSamples: ['DPN-20260320-0007', 'DPN-20260320-0507'],
      draftSamples: ['DPN-20260320-0010', 'DPN-20260320-0510'],
    },
    SEA: {
      total: 4,
      pending: 1,
      rejected: 1,
      draft: 1,
      approved: 1,
      pendingSamples: ['DPN-20260320-0004'],
      rejectedSamples: ['DPN-20260320-0007'],
      draftSamples: ['DPN-20260320-0010'],
    },
    AIR: {
      total: 4,
      pending: 1,
      rejected: 1,
      draft: 1,
      approved: 1,
      pendingSamples: ['DPN-20260320-0504'],
      rejectedSamples: ['DPN-20260320-0507'],
      draftSamples: ['DPN-20260320-0510'],
    },
  },
  ORDER: {
    ALL: {
      total: 8,
      pending: 2,
      rejected: 2,
      draft: 2,
      approved: 2,
      pendingSamples: ['S-20260320000002', 'A-20260320000002'],
      rejectedSamples: ['S-20260320000003', 'A-20260320000003'],
      draftSamples: ['S-20260320000004', 'A-20260320000004'],
    },
    SEA: {
      total: 4,
      pending: 1,
      rejected: 1,
      draft: 1,
      approved: 1,
      pendingSamples: ['S-20260320000002'],
      rejectedSamples: ['S-20260320000003'],
      draftSamples: ['S-20260320000004'],
    },
    AIR: {
      total: 4,
      pending: 1,
      rejected: 1,
      draft: 1,
      approved: 1,
      pendingSamples: ['A-20260320000002'],
      rejectedSamples: ['A-20260320000003'],
      draftSamples: ['A-20260320000004'],
    },
  },
};

const originPackingTabFor = (businessMode: BusinessMode) =>
  businessMode === 'AIR' ? 'wms_box_air' : 'wms_box_sea';

const originPackingLabelFor = (businessMode: BusinessMode) =>
  businessMode === 'AIR' ? '集中装箱（空运）' : '集中装箱（海运）';

const toArray = <T,>(payload: any): T[] => {
  if (Array.isArray(payload?.data)) return payload.data as T[];
  if (Array.isArray(payload)) return payload as T[];
  return [];
};

const toNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const compactList = (values: Array<string | undefined | null>, limit = 3) => {
  const seen = new Set<string>();
  const list: string[] = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    list.push(text);
  });
  return list.slice(0, limit);
};

const matchesPrefix = (value: string, businessMode: BusinessMode) => {
  const text = String(value || '').toUpperCase();
  if (businessMode === 'ALL') return true;
  return businessMode === 'AIR' ? text.startsWith('A-') : text.startsWith('S-');
};

const matchesBusinessModeByText = (text: string, businessMode: BusinessMode) => {
  if (businessMode === 'ALL') return true;
  const upper = String(text || '').toUpperCase();
  if (businessMode === 'AIR') {
    return upper.includes('A-') || upper.includes('AIR') || upper.includes('空运');
  }
  return upper.includes('S-') || upper.includes('SEA') || upper.includes('海运');
};

const isPendingFinancialStatus = (status: string) => !['PAID', 'REJECTED', 'CANCELLED'].includes(String(status || '').toUpperCase());

const formatDateTime = (value?: string) => {
  const parsed = value ? dayjs(value) : null;
  return parsed && parsed.isValid() ? parsed.format('MM-DD HH:mm') : '-';
};

const sortByUpdatedDesc = <T extends { updatedAt?: string }>(rows: T[]) => (
  [...rows].sort((a, b) => {
    const left = a.updatedAt ? dayjs(a.updatedAt).valueOf() : 0;
    const right = b.updatedAt ? dayjs(b.updatedAt).valueOf() : 0;
    return right - left;
  })
);

const LEGACY_TASK_STATUS_LABELS: Record<LegacyTask['status'], string> = {
  PENDING: '待开始',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: '待分派',
  ACCEPTED: '已接单',
  IN_TRANSIT: '配送中',
  DELIVERED: '已送达',
  SIGNED: '已签收',
  FAILED: '配送失败',
  CANCELLED: '已取消',
};

const DPN_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING_ASSIGN: '待分派',
  ASSIGNED: '已分派',
  IN_TRANSIT: '运输中',
  DELIVERED: '已到仓',
  SIGNED: '已签收',
  CANCELLED: '已取消',
};

const ORDER_PROGRESS_STATUS_LABELS: Record<string, string> = {
  PENDING: '待确认',
  PENDING_INBOUND: '待入库',
  INBOUND: '已入库',
  IN_TRANSIT: '运输中',
  ARRIVED: '已到达',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: '未付',
  PARTIAL: '部分付',
  PAID: '已付',
};

const getDueDate = (value?: string) => {
  const base = value ? dayjs(value) : dayjs();
  return (base.isValid() ? base : dayjs()).add(30, 'day');
};

const formatTaskId = (taskId: string, businessMode: BusinessMode) => {
  const raw = String(taskId || '').trim().toUpperCase();
  if (!raw) return '';
  if (/^[AS]-JOB\d{8}$/.test(raw)) return raw;
  if (!/^JOB\d{8}$/.test(raw)) return raw;
  const prefix = businessMode === 'AIR' ? 'A' : 'S';
  return `${prefix}-${raw}`;
};

const calcLegacyCurrentNode = (task: LegacyTask, mode: LegacyTaskMode) => {
  const flow = mode === 'ORIGIN' ? ORIGIN_NODE_FLOW : DEST_NODE_FLOW;
  const trackedCodes = new Set(flow.map((item) => item.nodeCode));
  let minDone = Number.POSITIVE_INFINITY;
  let hasTracked = false;
  let hasAbnormal = false;

  task.jobs.forEach((job) => {
    job.containers.forEach((container) => {
      const tracked = (container.nodeProgress?.completedNodes || []).filter((node) => trackedCodes.has(node.nodeCode));
      if (tracked.length > 0) hasTracked = true;
      if (tracked.some((node) => Boolean(node.isAbnormal))) hasAbnormal = true;
      minDone = Math.min(minDone, tracked.length);
    });
  });

  if (!hasTracked || minDone === Number.POSITIVE_INFINITY) {
    return { currentNodeName: '未开始', hasAbnormal };
  }

  if (minDone >= flow.length) {
    return { currentNodeName: '已完成', hasAbnormal };
  }

  return { currentNodeName: flow[minDone].nodeName, hasAbnormal };
};

const buildLegacyTaskSnapshot = (mode: LegacyTaskMode, businessMode: BusinessMode): LegacyTaskSnapshot => {
  const rows = LEGACY_TASKS.map((task) => {
    const node = calcLegacyCurrentNode(task, mode);
    return {
      id: formatTaskId(task.id, businessMode),
      status: task.status,
      updatedAt: task.updatedAt,
      currentNodeName: node.currentNodeName,
      hasAbnormal: node.hasAbnormal,
    };
  }).sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf());

  const openRows = rows.filter((row) => row.status !== 'COMPLETED');
  const abnormalRows = rows.filter((row) => row.hasAbnormal);

  return {
    openCount: openRows.length,
    pendingCount: rows.filter((row) => row.status === 'PENDING').length,
    inProgressCount: rows.filter((row) => row.status === 'IN_PROGRESS').length,
    abnormalCount: abnormalRows.length,
    openSamples: compactList(openRows.map((row) => `${row.id} · ${row.currentNodeName}`)),
    abnormalSamples: compactList(abnormalRows.map((row) => `${row.id} · ${row.currentNodeName}`)),
  };
};

const buildLegacyTaskProgressItems = (
  mode: LegacyTaskMode,
  businessMode: BusinessMode,
  tabKey: string,
): WorkbenchProgressItem[] => sortByUpdatedDesc(
  LEGACY_TASKS.map((task) => {
    const node = calcLegacyCurrentNode(task, mode);
    const firstJob = task.jobs[0];
    return {
      title: formatTaskId(task.id, businessMode),
      stage: node.currentNodeName,
      meta: `${firstJob?.routeName || '-'} · ${LEGACY_TASK_STATUS_LABELS[task.status]}`,
      updatedAt: task.updatedAt,
      tabKey,
      tone: node.hasAbnormal ? 'red' : task.status === 'IN_PROGRESS' ? 'blue' : 'orange',
    };
  }).filter((row) => row.stage !== '已完成'),
).slice(0, 6);

const buildTaskProgressCards = (
  mode: LegacyTaskMode,
  businessMode: BusinessMode,
  tabKey: string,
): TaskProgressCard[] => {
  const flow = mode === 'ORIGIN' ? ORIGIN_NODE_FLOW : DEST_NODE_FLOW;

  return sortByUpdatedDesc(
    LEGACY_TASKS.map((task) => {
      const firstJob = task.jobs[0];
      const trackedCodes = new Set(flow.map((n) => n.nodeCode));
      let minDone = Number.POSITIVE_INFINITY;
      let hasAbnormal = false;

      task.jobs.forEach((job) => {
        job.containers.forEach((container) => {
          const tracked = (container.nodeProgress?.completedNodes || []).filter((n) => trackedCodes.has(n.nodeCode));
          if (tracked.some((n) => Boolean(n.isAbnormal))) hasAbnormal = true;
          minDone = Math.min(minDone, tracked.length);
        });
      });

      const currentNodeIndex = (minDone === Number.POSITIVE_INFINITY || minDone === 0) ? 0 : Math.min(minDone, flow.length - 1);
      const currentNode = flow[currentNodeIndex]?.nodeName || '未开始';
      const serviceLabel = firstJob?.serviceType === 'EXPRESS' ? '特快' : '普快';
      const cargoLabel = firstJob?.cargoFilter === 'NON_GENERAL' ? '非普货' : '普货';
      const routeName = firstJob?.routeName || `${firstJob?.originPort || '?'}→${firstJob?.destPort || '?'}`;

      return {
        jobNo: formatTaskId(task.id, businessMode),
        route: routeName,
        serviceType: serviceLabel,
        cargoFilter: cargoLabel,
        currentNode,
        currentNodeIndex,
        totalNodes: flow.length,
        isAbnormal: hasAbnormal,
        updatedAt: task.updatedAt,
        tabKey,
      };
    }).filter((card) => card.currentNodeIndex < card.totalNodes - 1 || card.isAbnormal),
  ).slice(0, 8);
};

const buildAllTaskProgressCards = (businessMode: BusinessMode, modes: LegacyTaskMode[]): TaskProgressCard[] => {
  const cards: TaskProgressCard[] = [];
  if (modes.includes('ORIGIN')) {
    cards.push(...buildTaskProgressCards('ORIGIN', businessMode, 'tms_origin_task'));
  }
  if (modes.includes('DEST')) {
    cards.push(...buildTaskProgressCards('DEST', businessMode, 'tms_dest_job_list'));
  }
  return sortByUpdatedDesc(cards).slice(0, 8);
};

const ALERT_TYPE_LABELS: Record<AlertNoticeItem['type'], string> = {
  ORDER_DELAY: '订单延迟',
  PAYMENT_OVERDUE: '付款逾期',
  STOCK_ABNORMAL: '库存异常',
  CUSTOMS_DELAY: '海关延误',
  DELIVERY_FAIL: '配送失败',
  TASK_ABNORMAL: '任务异常',
};

const buildMockAlerts = (
  role: UserRole,
  businessMode: BusinessMode,
): AlertNoticeItem[] => {
  const now = dayjs();
  const prefix = businessMode === 'AIR' ? 'A' : 'S';
  const alerts: AlertNoticeItem[] = [];

  const roleAlertMap: Record<UserRole, Array<{ type: AlertNoticeItem['type']; level: AlertNoticeItem['level']; tabKey: string }>> = {
    SALES: [
      { type: 'PAYMENT_OVERDUE', level: 'HIGH', tabKey: 'oms_order_list' },
      { type: 'ORDER_DELAY', level: 'MEDIUM', tabKey: 'oms_order_list' },
    ],
    WAREHOUSE_CN: [
      { type: 'STOCK_ABNORMAL', level: 'HIGH', tabKey: 'wms_stock_list' },
    ],
    OPS_CN: [
      { type: 'TASK_ABNORMAL', level: 'HIGH', tabKey: 'tms_origin_task' },
      { type: 'CUSTOMS_DELAY', level: 'MEDIUM', tabKey: 'tms_origin_task' },
    ],
    OPS_US: [
      { type: 'CUSTOMS_DELAY', level: 'HIGH', tabKey: 'tms_dest_job_list' },
      { type: 'DELIVERY_FAIL', level: 'MEDIUM', tabKey: 'wms_delivery_list' },
    ],
    WAREHOUSE_US: [
      { type: 'DELIVERY_FAIL', level: 'HIGH', tabKey: 'wms_delivery_list' },
      { type: 'STOCK_ABNORMAL', level: 'MEDIUM', tabKey: 'wms_dest_stock_list' },
    ],
    FINANCE: [
      { type: 'PAYMENT_OVERDUE', level: 'HIGH', tabKey: 'fin_receivable_aging' },
    ],
    BOSS: [
      { type: 'PAYMENT_OVERDUE', level: 'HIGH', tabKey: 'fin_receivable_aging' },
      { type: 'TASK_ABNORMAL', level: 'HIGH', tabKey: 'fin_job_audit' },
      { type: 'ORDER_DELAY', level: 'MEDIUM', tabKey: 'oms_order_list' },
    ],
    ADMIN: [],
  };

  const mockDescriptions: Record<AlertNoticeItem['type'], string[]> = {
    ORDER_DELAY: [`订单${prefix}-20260320000002已超过预计送达时间3天`, `订单${prefix}-20260320000004运输时效异常`],
    PAYMENT_OVERDUE: [`客户深圳测试公司应收账款已逾期15天，金额¥12,500`, `客户广州样品公司应收账款已逾期7天`],
    STOCK_ABNORMAL: [`仓位A-03库存数量与系统不符，差异2件`, `快递YT20260315001在库超30天未匹配订单`],
    CUSTOMS_DELAY: [`${prefix}-JOB26030004海关查验超48小时未放行`, `${prefix}-JOB26030007进口申报被退回`],
    DELIVERY_FAIL: [`DPN-S26030001配送失败：收件人拒收`, `DPN-A26030002配送异常：地址不详`],
    TASK_ABNORMAL: [`${prefix}-JOB26030007节点异常：海关查验超时`, `${prefix}-JOB26030010出口报关遇阻`],
  };

  (roleAlertMap[role] || []).forEach((config, configIdx) => {
    const descriptions = mockDescriptions[config.type] || [];
    descriptions.forEach((desc, descIdx) => {
      alerts.push({
        id: `alert-${role}-${configIdx}-${descIdx}`,
        type: config.type,
        level: config.level,
        title: `${ALERT_TYPE_LABELS[config.type]}`,
        description: desc,
        time: now.subtract(configIdx * 2 + descIdx, 'hour').format('YYYY-MM-DD HH:mm'),
        tabKey: config.tabKey,
      });
    });
  });

  return alerts;
};

const buildMockNotices = (): NoticeItem[] => [
  {
    id: 'notice-1',
    title: '系统升级通知',
    content: '4月5日凌晨2:00-4:00进行系统维护，届时系统将暂停服务。',
    time: '2026-03-30 10:00',
    isRead: false,
  },
  {
    id: 'notice-2',
    title: '业务规则变更',
    content: '自4月1日起，非普货需额外提供MSDS文件，请提前准备。',
    time: '2026-03-28 14:30',
    isRead: true,
  },
  {
    id: 'notice-3',
    title: '节假日安排',
    content: '清明节4月4日-6日放假，4月7日正常上班。',
    time: '2026-03-25 09:00',
    isRead: true,
  },
];

const deriveSupervisorStatus = (items: Array<{ reviewStatus?: string }> = []): SupervisorTaskStatus => {
  if (items.some((item) => item.reviewStatus === 'PENDING')) return 'PENDING_SUPERVISOR';
  if (items.some((item) => item.reviewStatus === 'DRAFT')) return 'DRAFT';
  const rejectedCount = items.filter((item) => item.reviewStatus === 'REJECTED').length;
  const approvedCount = items.filter((item) => item.reviewStatus === 'APPROVED').length;
  if (rejectedCount > 0 && approvedCount > 0) return 'PART_REJECTED';
  if (rejectedCount > 0) return 'REJECTED';
  return 'APPROVED';
};

const deriveOrderFeeStatus = (items: Array<{ reviewStatus?: string }> = []): OrderFeeStatus => {
  if (!items.length) return 'DRAFT';
  if (items.some((item) => item.reviewStatus === 'PENDING')) return 'PENDING';
  if (items.some((item) => item.reviewStatus === 'REJECTED') && items.some((item) => item.reviewStatus === 'APPROVED' || item.reviewStatus === 'DRAFT')) {
    return 'PART_REJECTED';
  }
  if (items.every((item) => item.reviewStatus === 'REJECTED')) return 'REJECTED';
  if (items.every((item) => item.reviewStatus === 'APPROVED')) return 'APPROVED';
  return 'DRAFT';
};

const loadStoredArray = <T,>(storageKey: string): T[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
};

const buildReviewSnapshot = <T,>(
  records: T[] | null,
  pickId: (record: T) => string,
  pickItems: (record: T) => Array<{ reviewStatus?: string }> | undefined,
  businessMode: BusinessMode,
  matchRecord: (record: T, mode: BusinessMode) => boolean,
  deriveStatus: (items: Array<{ reviewStatus?: string }>) => SupervisorTaskStatus | OrderFeeStatus,
  fallback: ReviewSnapshot,
): ReviewSnapshot => {
  if (!records || records.length === 0) return fallback;

  const visible = records.filter((record) => matchRecord(record, businessMode));
  if (!visible.length) return {
    total: 0,
    pending: 0,
    rejected: 0,
    draft: 0,
    approved: 0,
    pendingSamples: [],
    rejectedSamples: [],
    draftSamples: [],
  };

  const mapped = visible.map((record) => {
    const items = pickItems(record) || [];
    return {
      id: pickId(record),
      status: deriveStatus(items),
    };
  });

  return {
    total: mapped.length,
    pending: mapped.filter((record) => record.status === 'PENDING_SUPERVISOR' || record.status === 'PENDING').length,
    rejected: mapped.filter((record) => record.status === 'PART_REJECTED' || record.status === 'REJECTED').length,
    draft: mapped.filter((record) => record.status === 'DRAFT').length,
    approved: mapped.filter((record) => record.status === 'APPROVED').length,
    pendingSamples: compactList(mapped.filter((record) => record.status === 'PENDING_SUPERVISOR' || record.status === 'PENDING').map((record) => record.id)),
    rejectedSamples: compactList(mapped.filter((record) => record.status === 'PART_REJECTED' || record.status === 'REJECTED').map((record) => record.id)),
    draftSamples: compactList(mapped.filter((record) => record.status === 'DRAFT').map((record) => record.id)),
  };
};

const loadPolCostSnapshot = (businessMode: BusinessMode) => buildReviewSnapshot<any>(
  loadStoredArray<any>(POL_COST_STORAGE_KEY),
  (record) => String(record?.jobNo || ''),
  (record) => Array.isArray(record?.items) ? record.items : [],
  businessMode,
  (record, mode) => matchesPrefix(String(record?.jobNo || ''), mode),
  deriveSupervisorStatus,
  REVIEW_FALLBACKS.POL[businessMode],
);

const loadPodCostSnapshot = (businessMode: BusinessMode) => buildReviewSnapshot<any>(
  loadStoredArray<any>(POD_COST_STORAGE_KEY),
  (record) => String(record?.jobNo || ''),
  (record) => Array.isArray(record?.items) ? record.items : [],
  businessMode,
  (record, mode) => matchesPrefix(String(record?.jobNo || ''), mode),
  deriveSupervisorStatus,
  REVIEW_FALLBACKS.POD[businessMode],
);

const loadDpnCostSnapshot = (businessMode: BusinessMode) => buildReviewSnapshot<any>(
  loadStoredArray<any>(DPN_COST_STORAGE_KEY),
  (record) => String(record?.dpnNo || ''),
  (record) => Array.isArray(record?.items) ? record.items : [],
  businessMode,
  (record, mode) => mode === 'ALL' || String(record?.businessLine || '').toUpperCase() === mode,
  deriveSupervisorStatus,
  REVIEW_FALLBACKS.DPN[businessMode],
);

const loadOrderFeeSnapshot = (businessMode: BusinessMode) => buildReviewSnapshot<any>(
  loadStoredArray<any>(ORDER_FEE_STORAGE_KEY),
  (record) => String(record?.orderNo || ''),
  (record) => Array.isArray(record?.items) ? record.items : [],
  businessMode,
  (record, mode) => matchesPrefix(String(record?.orderNo || ''), mode),
  deriveOrderFeeStatus,
  REVIEW_FALLBACKS.ORDER[businessMode],
);

const loadFinanceSnapshot = async (businessMode: BusinessMode): Promise<FinanceSnapshot> => {
  const feeRows = toArray<any>(await feeApi.list()).map((row) => ({
    id: String(row?.id || ''),
    feeNo: String(row?.feeNo || row?.fee_no || '-'),
    relatedNo: String(row?.relatedNo || row?.related_no || row?.relatedId || '-'),
    feeDirection: String(row?.feeDirection || row?.fee_direction || '').toUpperCase(),
    status: String(row?.status || row?.feeStatus || row?.fee_status || '').toUpperCase(),
    createdAt: String(row?.createdAt || row?.created_at || row?.updatedAt || new Date().toISOString()),
    supplierName: String(row?.supplierName || row?.supplier_name || ''),
    customerName: String(row?.customerName || row?.customer_name || ''),
    description: String(row?.description || ''),
  })).filter((row) => matchesBusinessModeByText([
    row.relatedNo,
    row.description,
    row.feeNo,
    row.supplierName,
    row.customerName,
  ].join(' '), businessMode));

  const pendingApproval = feeRows.filter((row) => row.status === 'PENDING');
  const rejectedApproval = feeRows.filter((row) => row.status === 'REJECTED');
  const receivables = feeRows.filter((row) => row.feeDirection === 'RECEIVABLE' && isPendingFinancialStatus(row.status));
  const overdueReceivables = receivables.filter((row) => getDueDate(row.createdAt).isBefore(dayjs(), 'day'));
  const payables = feeRows.filter((row) => row.feeDirection === 'PAYABLE' && isPendingFinancialStatus(row.status));
  const overduePayables = payables.filter((row) => getDueDate(row.createdAt).isBefore(dayjs(), 'day'));
  const progressItems = sortByUpdatedDesc([
    ...pendingApproval.map((row) => ({
      title: row.feeNo,
      stage: '待审批',
      meta: row.relatedNo || row.customerName || row.supplierName || '-',
      updatedAt: row.createdAt,
      tabKey: 'fin_fee_approval',
      tone: 'orange' as TodoTone,
    })),
    ...receivables.map((row) => ({
      title: row.relatedNo || row.feeNo,
      stage: overdueReceivables.some((item) => item.id === row.id) ? '逾期应收' : '应收处理中',
      meta: row.customerName || row.feeNo,
      updatedAt: row.createdAt,
      tabKey: overdueReceivables.some((item) => item.id === row.id) ? 'fin_receivable_aging' : 'fin_receivable',
      tone: overdueReceivables.some((item) => item.id === row.id) ? 'red' as TodoTone : 'blue' as TodoTone,
    })),
    ...payables.map((row) => ({
      title: row.feeNo,
      stage: overduePayables.some((item) => item.id === row.id) ? '逾期应付' : '待付款',
      meta: row.supplierName || row.relatedNo,
      updatedAt: row.createdAt,
      tabKey: overduePayables.some((item) => item.id === row.id) ? 'fin_payable_schedule' : 'fin_payable',
      tone: overduePayables.some((item) => item.id === row.id) ? 'red' as TodoTone : 'purple' as TodoTone,
    })),
  ]).slice(0, 6);

  return {
    pendingApprovalCount: pendingApproval.length,
    pendingApprovalSamples: compactList(pendingApproval.map((row) => `${row.feeNo} · ${row.relatedNo}`)),
    rejectedApprovalCount: rejectedApproval.length,
    rejectedApprovalSamples: compactList(rejectedApproval.map((row) => `${row.feeNo} · ${row.relatedNo}`)),
    outstandingReceivableCount: receivables.length,
    outstandingReceivableSamples: compactList(receivables.map((row) => `${row.relatedNo} · ${row.customerName || row.feeNo}`)),
    overdueReceivableCount: overdueReceivables.length,
    overdueReceivableSamples: compactList(overdueReceivables.map((row) => `${row.relatedNo} · ${row.customerName || row.feeNo}`)),
    pendingPayableCount: payables.length,
    pendingPayableSamples: compactList(payables.map((row) => `${row.feeNo} · ${row.supplierName || row.relatedNo}`)),
    overduePayableCount: overduePayables.length,
    overduePayableSamples: compactList(overduePayables.map((row) => `${row.feeNo} · ${row.supplierName || row.relatedNo}`)),
    progressItems,
  };
};

const loadSalesWorkbench = async (businessMode: BusinessMode): Promise<RoleWorkbenchData> => {
  const notes = ['客户待办取自“我的客户”，订单待办取自“订单列表”，点击后直接进入现有处理页。'];
  const [dashboardRes, customersRes, ordersRes] = await Promise.allSettled([
    salesApi.dashboard(),
    clientApi.list({ poolType: 'PRIVATE' }),
    v2OmsApi.listOrders({
      page: 1,
      pageSize: 500,
      businessLine: businessMode === 'ALL' ? undefined : businessMode,
    }),
  ]);

  const dashboard = dashboardRes.status === 'fulfilled' ? ((dashboardRes.value as any)?.data || dashboardRes.value || {}) : {};
  const customers = customersRes.status === 'fulfilled' ? toArray<any>(customersRes.value) : [];
  const orders = ordersRes.status === 'fulfilled'
    ? toArray<any>(ordersRes.value).map((row) => mapV2OrderRowToMasterOrder(row))
    : [];

  if (dashboardRes.status === 'rejected' || customersRes.status === 'rejected' || ordersRes.status === 'rejected') {
    notes.push('部分统计接口未返回，首页已自动回退到可用数据。');
  }

  const activeCustomers = customers.filter((row) => String(row?.status || '').toUpperCase() !== 'INACTIVE');
  const unfinishedOrders = orders.filter((row) => !FINAL_MASTER_STATUSES.has(String(row.status || '').toUpperCase()));
  const receivableOrders = orders.filter((row) => row.paymentStatus !== 'PAID');
  const overdueReceivableCount = toNumber((dashboard as any)?.kpi?.overdueCount, receivableOrders.length);
  const newCustomerCount = toNumber((dashboard as any)?.kpi?.newCustomers, 0);
  const orderProgressItems = sortByUpdatedDesc(
    unfinishedOrders.map((row) => ({
      title: row.orderNo,
      stage: ORDER_PROGRESS_STATUS_LABELS[String(row.status || '').toUpperCase()] || String(row.status || '处理中'),
      meta: `${row.customerName || '-'} · ${PAYMENT_STATUS_LABELS[String(row.paymentStatus || '').toUpperCase()] || row.paymentStatus || '未付'}`,
      updatedAt: String((row as any)?.updatedAt || (row as any)?.updated_at || (row as any)?.createdAt || ''),
      tabKey: 'oms_order_list',
      tone: row.paymentStatus === 'PAID' ? 'blue' as TodoTone : 'orange' as TodoTone,
    })),
  ).slice(0, 6);

  return {
    title: '销售待办工作台',
    description: '首页只保留客户、订单和收款相关待办，点进去直接处理，不再停留在概览说明。',
    metrics: [
      { title: '我的客户', value: activeCustomers.length, suffix: '个', description: '直接进入我的客户继续跟进', tabKey: 'crm_my', tone: 'blue' },
      { title: '未完成订单', value: unfinishedOrders.length, suffix: '单', description: '直接进入订单列表推进', tabKey: 'oms_order_list', tone: 'orange' },
      { title: '待收款订单', value: receivableOrders.length, suffix: '单', description: '直接进入订单列表核对付款', tabKey: 'oms_order_list', tone: 'red' },
      { title: '本月新增客户', value: newCustomerCount, suffix: '个', description: '来自销售首页同源口径', tabKey: 'crm_my', tone: 'green' },
    ],
    sections: [
      {
        title: '客户待办',
        description: '优先处理需要继续跟进的客户。',
        items: [
          {
            title: '我的客户待跟进',
            source: '客户中心 / 我的客户',
            count: activeCustomers.length,
            tabKey: 'crm_my',
            tone: 'blue',
            summary: '进入客户列表继续查看详情、编辑、转移跟进。',
            samples: compactList(activeCustomers.map((row) => `${row?.shortCode || row?.short_code || '-'} · ${row?.name || row?.customerName || '-'}`)),
          },
          {
            title: '本月新增客户',
            source: '销售首页 / KPI',
            count: newCustomerCount,
            tabKey: 'crm_my',
            tone: 'green',
            summary: '直接回到客户页跟进新客户。',
            samples: compactList(activeCustomers.map((row) => String(row?.name || row?.customerName || '-'))),
          },
        ],
      },
      {
        title: '订单待办',
        description: '订单与回款是销售首页最直接的处理入口。',
        items: [
          {
            title: '未完成订单',
            source: '订单中心 / 订单列表',
            count: unfinishedOrders.length,
            tabKey: 'oms_order_list',
            tone: 'orange',
            summary: '进入订单列表继续查看详情、编辑和推进状态。',
            samples: compactList(unfinishedOrders.map((row) => `${row.orderNo} · ${row.customerName}`)),
          },
          {
            title: '待收款订单',
            source: '订单中心 / 订单列表',
            count: receivableOrders.length,
            tabKey: 'oms_order_list',
            tone: 'red',
            summary: '进入订单列表核对付款状态与应收情况。',
            samples: compactList(receivableOrders.map((row) => `${row.orderNo} · ${row.paymentStatus || 'UNPAID'}`)),
          },
          {
            title: '逾期应收提醒',
            source: '销售首页 / AR应收预警',
            count: overdueReceivableCount,
            tabKey: 'oms_order_list',
            tone: 'red',
            summary: '优先处理逾期账单对应客户和订单。',
            samples: compactList(receivableOrders.map((row) => `${row.orderNo} · ${row.customerName}`)),
          },
        ],
      },
    ],
    progressTitle: '订单推进进展',
    progressItems: orderProgressItems,
    quickActions: [
      { label: '我的客户', tabKey: 'crm_my' },
      { label: '订单列表', tabKey: 'oms_order_list' },
      { label: '运费试算', tabKey: 'crm_price' },
    ],
    notes,
    taskProgressCards: buildAllTaskProgressCards(businessMode, ['ORIGIN', 'DEST']),
    alertItems: buildMockAlerts('SALES', businessMode),
    notices: buildMockNotices(),
  };
};

const loadWarehouseCnWorkbench = async (warehouseId: string | undefined, businessMode: BusinessMode): Promise<RoleWorkbenchData> => {
  const packingTab = originPackingTabFor(businessMode);
  const packingLabel = originPackingLabelFor(businessMode);
  const notes = ['仓库统计直接复用入库、库存、无订单快递、退运和调拨页面的同源数据。'];
  const params = {
    warehouseId,
    businessLine: businessMode === 'ALL' ? undefined : businessMode,
  };

  const [inboundRes, transferRes, returnRes, unmatchedRes, stockRes] = await Promise.allSettled([
    warehouseApi.listInbound({ warehouse: 'CN', ...params }),
    warehouseApi.listTransfers({ transferType: 'ORIGIN', businessLine: params.businessLine }),
    warehouseApi.listReturns(params),
    v2WmsApi.listUnmatchedPackages(params),
    warehouseApi.listStock({ warehouse: 'CN', ...params }),
  ]);

  const inboundRows = inboundRes.status === 'fulfilled' ? toArray<any>(inboundRes.value) : [];
  const transferRows = transferRes.status === 'fulfilled' ? toArray<any>(transferRes.value) : [];
  const returnRows = returnRes.status === 'fulfilled' ? toArray<any>(returnRes.value) : [];
  const unmatchedRows = unmatchedRes.status === 'fulfilled' ? toArray<any>(unmatchedRes.value) : [];
  const stockRows = stockRes.status === 'fulfilled' ? toArray<any>(stockRes.value) : [];

  if ([inboundRes, transferRes, returnRes, unmatchedRes, stockRes].some((item) => item.status === 'rejected')) {
    notes.push('部分仓库接口未返回时，首页会只展示当前能拿到的待办数量。');
  }

  const pendingInbound = inboundRows.filter((row) => ORIGIN_INBOUND_PENDING_STATUSES.has(String(row?.status || '').toUpperCase()));
  const pendingTransfers = transferRows.filter((row) => TRANSFER_PENDING_STATUSES.has(String(row?.status || '').toUpperCase()));
  const pendingReturns = returnRows.filter((row) => RETURN_PENDING_STATUSES.has(String(row?.status || '').toUpperCase()));
  const unmatchedPending = unmatchedRows.filter((row) => String(row?.status || '').toUpperCase() === 'PENDING');
  const inStock = stockRows.filter((row) => String(row?.status || '').toUpperCase() === 'IN_STOCK');
  const allocated = stockRows.filter((row) => String(row?.status || '').toUpperCase() === 'ALLOCATED');
  const warehouseProgressItems = sortByUpdatedDesc([
    ...pendingInbound.map((row) => ({
      title: String(row?.trackingNo || row?.tracking_no || row?.displaySubOrderNo || row?.subOrderNo || '待入库件'),
      stage: '待入库',
      meta: '起运国仓储 / 入库记录',
      updatedAt: String(row?.updatedAt || row?.updated_at || row?.createdAt || ''),
      tabKey: 'wms_in_record',
      tone: 'orange' as TodoTone,
    })),
    ...pendingTransfers.map((row) => ({
      title: String(row?.transferNo || row?.transfer_no || row?.id || '调拨单'),
      stage: '调拨到仓',
      meta: '起运国仓储 / 调拨记录',
      updatedAt: String(row?.updatedAt || row?.updated_at || row?.createdAt || ''),
      tabKey: 'wms_transfer_list',
      tone: 'blue' as TodoTone,
    })),
    ...allocated.map((row) => ({
      title: String(row?.displaySubOrderNo || row?.subOrderNo || row?.trackingNo || '待装箱件'),
      stage: '待装箱',
      meta: `起运国仓储 / ${packingLabel}`,
      updatedAt: String(row?.updatedAt || row?.updated_at || row?.createdAt || ''),
      tabKey: packingTab,
      tone: 'green' as TodoTone,
    })),
    ...unmatchedPending.map((row) => ({
      title: String(row?.tracking_no || row?.trackingNo || row?.expressTrackingNo || '无订单快递'),
      stage: '待匹配',
      meta: '起运国仓储 / 无订单快递',
      updatedAt: String(row?.updatedAt || row?.updated_at || row?.createdAt || ''),
      tabKey: 'wms_stock_noorder',
      tone: 'red' as TodoTone,
    })),
    ...pendingReturns.map((row) => ({
      title: String(row?.returnNo || row?.trackingNo || row?.orderNo || '退运单'),
      stage: '退运处理中',
      meta: '起运国仓储 / 退运处理',
      updatedAt: String(row?.updatedAt || row?.updated_at || row?.createdAt || ''),
      tabKey: 'wms_stock_return',
      tone: 'purple' as TodoTone,
    })),
  ]).slice(0, 6);

  return {
    title: '中国仓待办工作台',
    description: '工作台直接聚合仓库现场的待入库、异常件、退运和库存处理入口。',
    metrics: [
      { title: '待入库', value: pendingInbound.length, suffix: '票', description: '来自入库记录', tabKey: 'wms_in_record', tone: 'orange' },
      { title: '无订单快递', value: unmatchedPending.length, suffix: '票', description: '来自无订单快递', tabKey: 'wms_stock_noorder', tone: 'red' },
      { title: '退运待处理', value: pendingReturns.length, suffix: '票', description: '来自退运处理', tabKey: 'wms_stock_return', tone: 'purple' },
      { title: '在库货件', value: inStock.length, suffix: '件', description: '来自库存列表', tabKey: 'wms_stock_list', tone: 'blue' },
    ],
    sections: [
      {
        title: '入库处理',
        description: '优先处理今天进仓和跨仓到货件。',
        items: [
          {
            title: '待入库运单',
            source: '起运国仓储 / 入库记录',
            count: pendingInbound.length,
            tabKey: 'wms_in_record',
            tone: 'orange',
            summary: '进入入库记录继续新增入库、执行入库和补充信息。',
            samples: compactList(pendingInbound.map((row) => row?.trackingNo || row?.tracking_no || row?.displaySubOrderNo || row?.subOrderNo)),
          },
          {
            title: '调拨到仓待处理',
            source: '起运国仓储 / 调拨记录',
            count: pendingTransfers.length,
            tabKey: 'wms_transfer_list',
            tone: 'blue',
            summary: '跨仓到货后，直接进入调拨记录继续入仓。',
            samples: compactList(pendingTransfers.map((row) => row?.transferNo || row?.transfer_no || row?.id)),
          },
          {
            title: '已分配待装箱',
            source: `起运国仓储 / ${packingLabel}`,
            count: allocated.length,
            tabKey: packingTab,
            tone: 'green',
            summary: '进入装箱页继续做海运/空运集中装箱。',
            samples: compactList(allocated.map((row) => row?.displaySubOrderNo || row?.subOrderNo || row?.trackingNo)),
          },
        ],
      },
      {
        title: '异常与库存',
        description: '异常件和库存处理合并放在一个处理区里。',
        items: [
          {
            title: '无订单快递待处理',
            source: '起运国仓储 / 无订单快递',
            count: unmatchedPending.length,
            tabKey: 'wms_stock_noorder',
            tone: 'red',
            summary: '进入无订单快递页继续匹配、创单和通知。',
            samples: compactList(unmatchedPending.map((row) => row?.tracking_no || row?.trackingNo || row?.expressTrackingNo)),
          },
          {
            title: '退运单待处理',
            source: '起运国仓储 / 退运处理',
            count: pendingReturns.length,
            tabKey: 'wms_stock_return',
            tone: 'purple',
            summary: '进入退运处理继续填写快递信息和回仓状态。',
            samples: compactList(pendingReturns.map((row) => row?.returnNo || row?.trackingNo || row?.orderNo)),
          },
          {
            title: '在库货件待处理',
            source: '起运国仓储 / 库存列表',
            count: inStock.length,
            tabKey: 'wms_stock_list',
            tone: 'blue',
            summary: '进入库存列表继续打印、编辑和退运。',
            samples: compactList(inStock.map((row) => row?.displaySubOrderNo || row?.subOrderNo || row?.trackingNo)),
          },
        ],
      },
    ],
    progressTitle: '仓内处理进展',
    progressItems: warehouseProgressItems,
    quickActions: [
      { label: '入库记录', tabKey: 'wms_in_record' },
      { label: packingLabel, tabKey: packingTab },
      { label: '库存列表', tabKey: 'wms_stock_list' },
      { label: '无订单快递', tabKey: 'wms_stock_noorder' },
    ],
    notes,
    taskProgressCards: buildAllTaskProgressCards(businessMode, ['ORIGIN', 'DEST']),
    alertItems: buildMockAlerts('WAREHOUSE_CN', businessMode),
    notices: buildMockNotices(),
  };
};

const loadOpsCnWorkbench = async (businessMode: BusinessMode): Promise<RoleWorkbenchData> => {
  const taskSnapshot = buildLegacyTaskSnapshot('ORIGIN', businessMode);
  const taskProgressItems = buildLegacyTaskProgressItems('ORIGIN', businessMode, 'tms_origin_task');
  const polSnapshot = loadPolCostSnapshot(businessMode);
  const orderFeeSnapshot = loadOrderFeeSnapshot(businessMode);

  return {
    title: '中国运营待办工作台',
    description: '工作台主体聚焦任务推进、JOB成本和订单费用处理。',
    metrics: [
      { title: '待推进任务', value: taskSnapshot.openCount, suffix: '个', description: '来自任务管理', tabKey: 'tms_origin_task', tone: 'orange' },
      { title: '异常任务', value: taskSnapshot.abnormalCount, suffix: '个', description: '来自任务管理节点异常', tabKey: 'tms_origin_task', tone: 'red' },
      { title: 'JOB成本待审', value: polSnapshot.pending, suffix: '条', description: '来自JOB成本页', tabKey: 'tms_cost_pol_list', tone: 'blue' },
      { title: '订单费用待审', value: orderFeeSnapshot.pending, suffix: '条', description: '来自订单费用页', tabKey: 'tms_order_fee_list', tone: 'purple' },
    ],
    sections: [
      {
        title: '任务推进',
        description: '起运运营先把任务和异常推进掉，再回头处理成本。',
        items: [
          {
            title: '待推进任务',
            source: '起运国办 / 任务管理',
            count: taskSnapshot.openCount,
            tabKey: 'tms_origin_task',
            tone: 'orange',
            summary: '进入任务页继续节点更新、查看详情和编辑任务。',
            samples: taskSnapshot.openSamples,
          },
          {
            title: '异常任务',
            source: '起运国办 / 任务管理',
            count: taskSnapshot.abnormalCount,
            tabKey: 'tms_origin_task',
            tone: 'red',
            summary: '异常节点直接在任务管理里继续处理。',
            samples: taskSnapshot.abnormalSamples,
          },
        ],
      },
      {
        title: '成本处理',
        description: '成本待审和退回项都要从首页直接落到现有费用页。',
        items: [
          {
            title: 'JOB成本待主管审核',
            source: '起运国办 / JOB成本',
            count: polSnapshot.pending,
            tabKey: 'tms_cost_pol_list',
            tone: 'blue',
            summary: '直接进入JOB成本页继续审核。',
            samples: polSnapshot.pendingSamples,
          },
          {
            title: 'JOB成本退回/草稿',
            source: '起运国办 / JOB成本',
            count: polSnapshot.rejected + polSnapshot.draft,
            tabKey: 'tms_cost_pol_list',
            tone: 'purple',
            summary: '直接进入JOB成本页补充和重新提交。',
            samples: compactList([...polSnapshot.rejectedSamples, ...polSnapshot.draftSamples]),
          },
          {
            title: '订单费用待审核',
            source: '起运国办 / 订单费用',
            count: orderFeeSnapshot.pending,
            tabKey: 'tms_order_fee_list',
            tone: 'blue',
            summary: '进入订单费用页继续审核。',
            samples: orderFeeSnapshot.pendingSamples,
          },
          {
            title: '订单费用退回/草稿',
            source: '起运国办 / 订单费用',
            count: orderFeeSnapshot.rejected + orderFeeSnapshot.draft,
            tabKey: 'tms_order_fee_list',
            tone: 'purple',
            summary: '进入订单费用页继续补充和修订。',
            samples: compactList([...orderFeeSnapshot.rejectedSamples, ...orderFeeSnapshot.draftSamples]),
          },
        ],
      },
    ],
    progressTitle: '进行中任务进展',
    progressItems: taskProgressItems,
    quickActions: [
      { label: '任务管理', tabKey: 'tms_origin_task' },
      { label: 'JOB成本', tabKey: 'tms_cost_pol_list' },
      { label: '订单费用', tabKey: 'tms_order_fee_list' },
    ],
    notes: [
      '任务数量复用当前任务管理页的 mock 数据口径。',
      'JOB成本和订单费用数量复用各自页面的本地存储/种子数据口径。',
    ],
    taskProgressCards: buildAllTaskProgressCards(businessMode, ['ORIGIN', 'DEST']),
    alertItems: buildMockAlerts('OPS_CN', businessMode),
    notices: buildMockNotices(),
  };
};

const loadOpsUsWorkbench = async (businessMode: BusinessMode): Promise<RoleWorkbenchData> => {
  const taskSnapshot = buildLegacyTaskSnapshot('DEST', businessMode);
  const taskProgressItems = buildLegacyTaskProgressItems('DEST', businessMode, 'tms_dest_job_list');
  const podSnapshot = loadPodCostSnapshot(businessMode);
  const dpnSnapshot = loadDpnCostSnapshot(businessMode);
  const orderFeeSnapshot = loadOrderFeeSnapshot(businessMode);

  return {
    title: '美国运营待办工作台',
    description: '首页只聚合到达侧任务推进、JOB成本、订单费用和DPN成本处理。',
    metrics: [
      { title: '待推进任务', value: taskSnapshot.openCount, suffix: '个', description: '来自到达任务管理', tabKey: 'tms_dest_job_list', tone: 'orange' },
      { title: '异常任务', value: taskSnapshot.abnormalCount, suffix: '个', description: '来自到达任务管理', tabKey: 'tms_dest_job_list', tone: 'red' },
      { title: 'JOB成本待审', value: podSnapshot.pending, suffix: '条', description: '来自到达JOB成本', tabKey: 'tms_cost_pod_list', tone: 'blue' },
      { title: 'DPN成本待审', value: dpnSnapshot.pending, suffix: '条', description: '来自DPN成本', tabKey: 'tms_dpn_cost_list', tone: 'purple' },
    ],
    sections: [
      {
        title: '到达任务推进',
        description: '任务推进和异常仍旧是到达运营最先处理的事。',
        items: [
          {
            title: '待推进任务',
            source: '到达国办 / 任务管理',
            count: taskSnapshot.openCount,
            tabKey: 'tms_dest_job_list',
            tone: 'orange',
            summary: '进入任务管理继续节点推进和查看详情。',
            samples: taskSnapshot.openSamples,
          },
          {
            title: '异常任务',
            source: '到达国办 / 任务管理',
            count: taskSnapshot.abnormalCount,
            tabKey: 'tms_dest_job_list',
            tone: 'red',
            summary: '异常任务在任务管理中继续处理。',
            samples: taskSnapshot.abnormalSamples,
          },
        ],
      },
      {
        title: '成本处理',
        description: '成本相关待办全部从首页直接落到对应费用页。',
        items: [
          {
            title: 'JOB成本待审核',
            source: '到达国办 / JOB成本',
            count: podSnapshot.pending,
            tabKey: 'tms_cost_pod_list',
            tone: 'blue',
            summary: '进入JOB成本页继续审核。',
            samples: podSnapshot.pendingSamples,
          },
          {
            title: 'JOB成本退回/草稿',
            source: '到达国办 / JOB成本',
            count: podSnapshot.rejected + podSnapshot.draft,
            tabKey: 'tms_cost_pod_list',
            tone: 'purple',
            summary: '进入JOB成本页补齐被退回和草稿记录。',
            samples: compactList([...podSnapshot.rejectedSamples, ...podSnapshot.draftSamples]),
          },
          {
            title: '订单费用待审核',
            source: '到达国办 / 订单费用',
            count: orderFeeSnapshot.pending,
            tabKey: 'tms_dest_order_fee_list',
            tone: 'blue',
            summary: '进入订单费用页继续审核。',
            samples: orderFeeSnapshot.pendingSamples,
          },
          {
            title: 'DPN成本待审核',
            source: '到达国办 / DPN成本',
            count: dpnSnapshot.pending,
            tabKey: 'tms_dpn_cost_list',
            tone: 'blue',
            summary: '进入DPN成本页继续审核。',
            samples: dpnSnapshot.pendingSamples,
          },
          {
            title: 'DPN成本退回/草稿',
            source: '到达国办 / DPN成本',
            count: dpnSnapshot.rejected + dpnSnapshot.draft,
            tabKey: 'tms_dpn_cost_list',
            tone: 'purple',
            summary: '进入DPN成本页继续补充和重新提交。',
            samples: compactList([...dpnSnapshot.rejectedSamples, ...dpnSnapshot.draftSamples]),
          },
        ],
      },
    ],
    progressTitle: '进行中任务进展',
    progressItems: taskProgressItems,
    quickActions: [
      { label: '任务管理', tabKey: 'tms_dest_job_list' },
      { label: 'JOB成本', tabKey: 'tms_cost_pod_list' },
      { label: '订单费用', tabKey: 'tms_dest_order_fee_list' },
      { label: 'DPN成本', tabKey: 'tms_dpn_cost_list' },
    ],
    notes: [
      '到达任务数量复用当前任务管理页的 mock 数据口径。',
      'JOB成本、订单费用、DPN成本数量复用对应页面的本地存储/种子数据口径。',
    ],
    taskProgressCards: buildAllTaskProgressCards(businessMode, ['DEST']),
    alertItems: buildMockAlerts('OPS_US', businessMode),
    notices: buildMockNotices(),
  };
};

const loadWarehouseUsWorkbench = async (warehouseId: string | undefined, businessMode: BusinessMode): Promise<RoleWorkbenchData> => {
  const notes = ['待配送、自提核销直接复用到达仓现有页面的 mock/store 数据；DPN数量来自 DPN 管理接口。'];
  const line = businessMode === 'ALL' ? undefined : businessMode;

  const dpnRes = await Promise.allSettled([
    v2PodApi.listDpns({
      warehouseId,
      businessLine: line,
      page: 1,
      pageSize: 200,
    }),
  ]);

  const dpnRows = dpnRes[0].status === 'fulfilled' ? toArray<any>(dpnRes[0].value) : [];
  if (dpnRes[0].status === 'rejected') {
    notes.push('DPN接口未返回时，待执行和待入库数量会回退为 0。');
  }

  const deliveryRows = buildDeliveryTaskRows([], {
    warehouseId,
    businessLine: line,
  });
  const pickupRows = listPickupRecords();

  const pendingInboundCount = dpnRows.filter((row) => String(row?.dpn_status || row?.status || '').toUpperCase() === 'DELIVERED').length;
  const pendingDpnRows = dpnRows.filter((row) => ['DRAFT', 'PENDING_ASSIGN'].includes(String(row?.dpn_status || row?.status || '').toUpperCase()));
  const activeDeliveryRows = deliveryRows.filter((row) => ACTIVE_DELIVERY_STATUSES.has(row.taskStatus));
  const failedDeliveryRows = deliveryRows.filter((row) => row.taskStatus === 'FAILED');
  const pickupPendingRows = pickupRows.filter((row) => row.notifyStatus !== 'PICKED_UP');
  const warehouseUsProgressItems = sortByUpdatedDesc([
    ...activeDeliveryRows.map((row) => ({
      title: row.taskNo,
      stage: DELIVERY_STATUS_LABELS[row.taskStatus] || row.taskStatus,
      meta: `${row.dpnNo} · ${row.recipientName}`,
      updatedAt: row.updatedAt,
      tabKey: 'wms_delivery_list',
      tone: row.taskStatus === 'FAILED' ? 'red' as TodoTone : 'purple' as TodoTone,
    })),
    ...pendingDpnRows.map((row) => ({
      title: String(row?.dpn_no || row?.dpnNo || 'DPN'),
      stage: DPN_STATUS_LABELS[String(row?.dpn_status || row?.status || '').toUpperCase()] || String(row?.dpn_status || row?.status || '待执行'),
      meta: '到达国仓储 / DPN管理',
      updatedAt: String(row?.updatedAt || row?.updated_at || row?.createdAt || ''),
      tabKey: 'wms_dest_dpn_manage',
      tone: 'blue' as TodoTone,
    })),
    ...dpnRows.filter((row) => String(row?.dpn_status || row?.status || '').toUpperCase() === 'DELIVERED').map((row) => ({
      title: String(row?.dpn_no || row?.dpnNo || 'DPN'),
      stage: '待入库',
      meta: '到达国仓储 / 货物入库',
      updatedAt: String(row?.updatedAt || row?.updated_at || row?.createdAt || ''),
      tabKey: 'wms_dest_in_list',
      tone: 'orange' as TodoTone,
    })),
  ]).slice(0, 6);

  return {
    title: '美国仓待办工作台',
    description: '仓内首页只保留待入库、DPN执行、配送和自提核销四类业务处理入口。',
    metrics: [
      { title: '待入库', value: pendingInboundCount, suffix: '票', description: '来自货物入库/DPN流转', tabKey: 'wms_dest_in_list', tone: 'orange' },
      { title: '待执行DPN', value: pendingDpnRows.length, suffix: '条', description: '来自DPN管理', tabKey: 'wms_dest_dpn_manage', tone: 'blue' },
      { title: '待配送', value: activeDeliveryRows.length, suffix: '单', description: '来自配送列表', tabKey: 'wms_delivery_list', tone: 'purple' },
      { title: '待自提核销', value: pickupPendingRows.length, suffix: '单', description: '来自自提列表', tabKey: 'wms_pickup_list', tone: 'green' },
    ],
    sections: [
      {
        title: '仓内执行',
        description: '先处理待入库和DPN，再去执行配送。',
        items: [
          {
            title: '待入库件',
            source: '到达国仓储 / 货物入库',
            count: pendingInboundCount,
            tabKey: 'wms_dest_in_list',
            tone: 'orange',
            summary: '进入货物入库页继续确认入库。',
            samples: compactList(dpnRows.filter((row) => String(row?.dpn_status || row?.status || '').toUpperCase() === 'DELIVERED').map((row) => row?.dpn_no || row?.dpnNo)),
          },
          {
            title: '待执行DPN',
            source: '到达国仓储 / DPN管理',
            count: pendingDpnRows.length,
            tabKey: 'wms_dest_dpn_manage',
            tone: 'blue',
            summary: '进入DPN管理继续绑单、打印和执行。',
            samples: compactList(pendingDpnRows.map((row) => row?.dpn_no || row?.dpnNo)),
          },
          {
            title: '待配送任务',
            source: '到达国仓储 / 配送列表',
            count: activeDeliveryRows.length,
            tabKey: 'wms_delivery_list',
            tone: 'purple',
            summary: '进入配送列表继续签收、失败处理和转自提。',
            samples: compactList(activeDeliveryRows.map((row) => `${row.taskNo} · ${row.recipientName}`)),
          },
        ],
      },
      {
        title: '配送与自提',
        description: '配送异常和自提核销都留在首页直接落地。',
        items: [
          {
            title: '配送异常',
            source: '到达国仓储 / 配送列表',
            count: failedDeliveryRows.length,
            tabKey: 'wms_delivery_list',
            tone: 'red',
            summary: '进入配送列表继续处理失败和改约。',
            samples: compactList(failedDeliveryRows.map((row) => `${row.taskNo} · ${row.failureReasonLabel || '配送失败'}`)),
          },
          {
            title: '待自提核销',
            source: '到达国仓储 / 自提列表',
            count: pickupPendingRows.length,
            tabKey: 'wms_pickup_list',
            tone: 'green',
            summary: '进入自提列表继续通知和核销。',
            samples: compactList(pickupPendingRows.map((row) => `${row.pickupNo} · ${row.recipientName}`)),
          },
        ],
      },
    ],
    progressTitle: '仓内执行进展',
    progressItems: warehouseUsProgressItems,
    quickActions: [
      { label: '货物入库', tabKey: 'wms_dest_in_list' },
      { label: 'DPN管理', tabKey: 'wms_dest_dpn_manage' },
      { label: '配送列表', tabKey: 'wms_delivery_list' },
      { label: '自提列表', tabKey: 'wms_pickup_list' },
    ],
    notes,
    taskProgressCards: buildAllTaskProgressCards(businessMode, ['DEST']),
    alertItems: buildMockAlerts('WAREHOUSE_US', businessMode),
    notices: buildMockNotices(),
  };
};

const loadFinanceWorkbench = async (businessMode: BusinessMode): Promise<RoleWorkbenchData> => {
  const snapshot = await loadFinanceSnapshot(businessMode);
  return {
    title: '财务待办工作台',
    description: '首页只聚合审批、应收、应付这些真正要处理的待办数量。',
    metrics: [
      { title: '待审批费用', value: snapshot.pendingApprovalCount, suffix: '笔', description: '进入费用审批处理', tabKey: 'fin_fee_approval', tone: 'orange' },
      { title: '逾期应收', value: snapshot.overdueReceivableCount, suffix: '笔', description: '进入应收账龄处理', tabKey: 'fin_receivable_aging', tone: 'red' },
      { title: '待付款', value: snapshot.pendingPayableCount, suffix: '笔', description: '进入应付账款处理', tabKey: 'fin_payable', tone: 'blue' },
      { title: '逾期应付', value: snapshot.overduePayableCount, suffix: '笔', description: '进入付款计划处理', tabKey: 'fin_payable_schedule', tone: 'purple' },
    ],
    sections: [
      {
        title: '审批处理',
        description: '审批池里的单据要优先出清。',
        items: [
          {
            title: '待审批费用',
            source: '财务中心 / 费用审批',
            count: snapshot.pendingApprovalCount,
            tabKey: 'fin_fee_approval',
            tone: 'orange',
            summary: '进入费用审批页继续审批。',
            samples: snapshot.pendingApprovalSamples,
          },
          {
            title: '驳回费用待补充',
            source: '财务中心 / 费用审批',
            count: snapshot.rejectedApprovalCount,
            tabKey: 'fin_fee_approval',
            tone: 'purple',
            summary: '进入费用审批页继续查看被驳回单据。',
            samples: snapshot.rejectedApprovalSamples,
          },
        ],
      },
      {
        title: '往来账处理',
        description: '应收和应付拆成两组待办，从首页就能进处理页。',
        items: [
          {
            title: '应收待处理',
            source: '财务中心 / 应收账款',
            count: snapshot.outstandingReceivableCount,
            tabKey: 'fin_receivable',
            tone: 'blue',
            summary: '进入应收账款页继续登记收款和查看详情。',
            samples: snapshot.outstandingReceivableSamples,
          },
          {
            title: '逾期应收',
            source: '财务中心 / 应收账龄',
            count: snapshot.overdueReceivableCount,
            tabKey: 'fin_receivable_aging',
            tone: 'red',
            summary: '进入应收账龄页优先处理逾期账款。',
            samples: snapshot.overdueReceivableSamples,
          },
          {
            title: '应付待付款',
            source: '财务中心 / 应付账款',
            count: snapshot.pendingPayableCount,
            tabKey: 'fin_payable',
            tone: 'blue',
            summary: '进入应付账款页继续付款处理。',
            samples: snapshot.pendingPayableSamples,
          },
          {
            title: '逾期应付',
            source: '财务中心 / 付款计划',
            count: snapshot.overduePayableCount,
            tabKey: 'fin_payable_schedule',
            tone: 'red',
            summary: '进入付款计划页优先处理逾期待付。',
            samples: snapshot.overduePayableSamples,
          },
        ],
      },
    ],
    progressTitle: '处理中单据进展',
    progressItems: snapshot.progressItems,
    quickActions: [
      { label: '费用审批', tabKey: 'fin_fee_approval' },
      { label: '应收账款', tabKey: 'fin_receivable' },
      { label: '应付账款', tabKey: 'fin_payable' },
      { label: '付款计划', tabKey: 'fin_payable_schedule' },
    ],
    notes: [
      '财务待办统一复用费用审批、应收账款、应收账龄、应付账款和付款计划页面口径。',
    ],
    taskProgressCards: buildAllTaskProgressCards(businessMode, ['ORIGIN', 'DEST']),
    alertItems: buildMockAlerts('FINANCE', businessMode),
    notices: buildMockNotices(),
  };
};

const loadBossWorkbench = async (businessMode: BusinessMode): Promise<RoleWorkbenchData> => {
  const [financeSnapshot, dashboardRes] = await Promise.allSettled([
    loadFinanceSnapshot(businessMode),
    salesApi.dashboard(),
  ]);
  const taskSnapshot = buildLegacyTaskSnapshot('DEST', businessMode);
  const taskProgressItems = buildLegacyTaskProgressItems('DEST', businessMode, 'fin_job_audit');
  const finance = financeSnapshot.status === 'fulfilled'
    ? financeSnapshot.value
    : {
      pendingApprovalCount: 0,
      pendingApprovalSamples: [],
      rejectedApprovalCount: 0,
      rejectedApprovalSamples: [],
      outstandingReceivableCount: 0,
      outstandingReceivableSamples: [],
      overdueReceivableCount: 0,
      overdueReceivableSamples: [],
      pendingPayableCount: 0,
      pendingPayableSamples: [],
      overduePayableCount: 0,
      overduePayableSamples: [],
      progressItems: [],
    };
  const monthlyGmv = toNumber(((dashboardRes.status === 'fulfilled' ? (dashboardRes.value as any)?.data : {}) as any)?.kpi?.monthlyGmv, 0);
  const notes = [
    '老板首页只显示需要决策和催办的任务/财务卡点，不下沉到联调链路。',
  ];
  if (financeSnapshot.status === 'rejected') {
    notes.push('财务风险统计未完全返回时，首页仅展示当前可用数据。');
  }

  return {
    title: '老板待办工作台',
    description: '首页聚合任务推进、审批卡点和应收风险，点进去就是现有经营或财务页。',
    metrics: [
      { title: '进行中任务', value: taskSnapshot.openCount, suffix: '个', description: '来自任务总览口径', tabKey: 'fin_job_audit', tone: 'orange' },
      { title: '异常任务', value: taskSnapshot.abnormalCount, suffix: '个', description: '异常任务优先关注', tabKey: 'fin_job_profit', tone: 'red' },
      { title: '待审批费用', value: finance.pendingApprovalCount, suffix: '笔', description: '来自费用审批', tabKey: 'fin_fee_approval', tone: 'blue' },
      { title: '逾期应收', value: finance.overdueReceivableCount, suffix: '笔', description: '来自应收账龄', tabKey: 'fin_receivable_aging', tone: 'purple' },
    ],
    sections: [
      {
        title: '任务与风险',
        description: '老板首页先看任务推进和异常卡点。',
        items: [
          {
            title: '进行中任务',
            source: '财务中心 / 任务成本总览',
            count: taskSnapshot.openCount,
            tabKey: 'fin_job_audit',
            tone: 'orange',
            summary: '进入任务总览查看状态、结算和利润。',
            samples: taskSnapshot.openSamples,
          },
          {
            title: '异常任务',
            source: '财务中心 / 任务盈亏看板',
            count: taskSnapshot.abnormalCount,
            tabKey: 'fin_job_profit',
            tone: 'red',
            summary: '进入任务盈亏看板优先看异常任务。',
            samples: taskSnapshot.abnormalSamples,
          },
          {
            title: '待审批费用',
            source: '财务中心 / 费用审批',
            count: finance.pendingApprovalCount,
            tabKey: 'fin_fee_approval',
            tone: 'blue',
            summary: '费用审批和大额单据从这里进入。',
            samples: finance.pendingApprovalSamples,
          },
        ],
      },
      {
        title: '经营与回款',
        description: '应收和经营摘要作为老板首页的第二层决策区。',
        items: [
          {
            title: '逾期应收',
            source: '财务中心 / 应收账龄',
            count: finance.overdueReceivableCount,
            tabKey: 'fin_receivable_aging',
            tone: 'red',
            summary: '优先处理逾期客户和高风险账款。',
            samples: finance.overdueReceivableSamples,
          },
          {
            title: '待付款',
            source: '财务中心 / 付款计划',
            count: finance.pendingPayableCount,
            tabKey: 'fin_payable_schedule',
            tone: 'purple',
            summary: '查看即将到期和已到期应付。',
            samples: finance.pendingPayableSamples,
          },
          {
            title: '经营摘要',
            source: '经营分析 / 经营看板',
            count: monthlyGmv > 0 ? 1 : 0,
            tabKey: 'analytics_executive',
            tone: 'green',
            summary: `当前销售首页口径本月 GMV ${monthlyGmv || 0}。`,
            samples: monthlyGmv > 0 ? [`本月GMV ${monthlyGmv}`] : [],
          },
        ],
      },
    ],
    progressTitle: '进行中任务进展',
    progressItems: taskProgressItems,
    quickActions: [
      { label: '任务总览', tabKey: 'fin_job_audit' },
      { label: '任务盈亏', tabKey: 'fin_job_profit' },
      { label: '经营看板', tabKey: 'analytics_executive' },
      { label: '应收账龄', tabKey: 'fin_receivable_aging' },
    ],
    notes,
    taskProgressCards: buildAllTaskProgressCards(businessMode, ['ORIGIN', 'DEST']),
    alertItems: buildMockAlerts('BOSS', businessMode),
    notices: buildMockNotices(),
  };
};

const loadAdminWorkbench = async (): Promise<RoleWorkbenchData> => {
  const notes = ['管理员角色仍以系统支撑为主，业务处理请通过对应业务角色工作台进入。'];
  const usersRes = await Promise.allSettled([authApi.listUsers()]);
  const users = usersRes[0].status === 'fulfilled' ? toArray<any>(usersRes[0].value) : [];
  if (usersRes[0].status === 'rejected') {
    notes.push('当前账号无权读取用户数据时，仅保留系统入口预览。');
  }

  return {
    title: '管理员工作台',
    description: '管理员首页保留系统支撑型待办，不和业务处理页混在一起。',
    metrics: [
      { title: '账号总数', value: users.length, suffix: '个', description: '来自用户管理', tabKey: 'set_auth_user', tone: 'blue' },
      { title: '角色管理入口', value: 1, suffix: '个', description: '进入角色管理', tabKey: 'set_auth_role', tone: 'green' },
      { title: '权限配置入口', value: 1, suffix: '个', description: '进入权限管理', tabKey: 'set_auth_permission', tone: 'orange' },
      { title: '流程管理入口', value: 1, suffix: '个', description: '进入流程管理', tabKey: 'set_workflow_list', tone: 'purple' },
    ],
    sections: [
      {
        title: '系统支撑',
        description: '这部分保留为系统维护入口，避免和业务首页混淆。',
        items: [
          {
            title: '用户账号管理',
            source: '系统管理 / 用户管理',
            count: users.length,
            tabKey: 'set_auth_user',
            tone: 'blue',
            summary: '进入用户管理继续新增、编辑和重置密码。',
            samples: compactList(users.map((row) => row?.realName || row?.username)),
          },
          {
            title: '角色管理',
            source: '系统管理 / 角色权限',
            count: 1,
            tabKey: 'set_auth_role',
            tone: 'green',
            summary: '进入角色管理继续维护角色模板。',
          },
          {
            title: '审批流程维护',
            source: '系统管理 / 流程管理',
            count: 1,
            tabKey: 'set_workflow_list',
            tone: 'purple',
            summary: '进入流程管理继续维护审批流。',
          },
        ],
      },
    ],
    progressTitle: '系统处理进展',
    progressItems: compactList(users.map((row) => row?.realName || row?.username)).map((name) => ({
      title: name,
      stage: '账号已创建',
      meta: '系统管理 / 用户管理',
      tabKey: 'set_auth_user',
      tone: 'blue' as TodoTone,
    })),
    quickActions: [
      { label: '用户管理', tabKey: 'set_auth_user' },
      { label: '角色管理', tabKey: 'set_auth_role' },
      { label: '权限配置', tabKey: 'set_auth_permission' },
      { label: '流程管理', tabKey: 'set_workflow_list' },
    ],
    notes,
    taskProgressCards: buildAllTaskProgressCards('ALL', ['ORIGIN', 'DEST']),
    alertItems: buildMockAlerts('ADMIN', 'ALL'),
    notices: buildMockNotices(),
  };
};

const loadWorkbenchData = async (
  role: UserRole,
  businessMode: BusinessMode,
  warehouseId?: string,
): Promise<RoleWorkbenchData> => {
  switch (role) {
    case 'SALES':
      return loadSalesWorkbench(businessMode);
    case 'WAREHOUSE_CN':
      return loadWarehouseCnWorkbench(warehouseId, businessMode);
    case 'OPS_CN':
      return loadOpsCnWorkbench(businessMode);
    case 'OPS_US':
      return loadOpsUsWorkbench(businessMode);
    case 'WAREHOUSE_US':
      return loadWarehouseUsWorkbench(warehouseId, businessMode);
    case 'FINANCE':
      return loadFinanceWorkbench(businessMode);
    case 'BOSS':
      return loadBossWorkbench(businessMode);
    case 'ADMIN':
    default:
      return loadAdminWorkbench();
  }
};

const getTodoPreviewText = (item: WorkbenchTodoItem) => {
  if (item.samples && item.samples.length > 0) {
    return item.samples.join(' / ');
  }
  return item.summary || '进入对应页面继续处理。';
};

/* ── Compact sub-components for one-screen dashboard ── */

const LEVEL_COLORS: Record<AlertNoticeItem['level'], string> = {
  HIGH: '#ff4d4f',
  MEDIUM: '#fa8c16',
  LOW: '#1677ff',
};

const renderTaskNodeFlow = (card: TaskProgressCard) => {
  const isOrigin = card.tabKey.includes('origin');
  const flow = isOrigin ? ORIGIN_NODE_FLOW : DEST_NODE_FLOW;
  const cur = card.currentNodeIndex;
  const startIdx = Math.max(0, cur - 1);
  const endIdx = Math.min(flow.length - 1, cur + 1);
  const sliced = flow.slice(startIdx, endIdx + 1);

  // Generate mock completion times for finished nodes based on updatedAt
  const baseTime = card.updatedAt ? dayjs(card.updatedAt) : dayjs();

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0 }}>
      {sliced.map((node, i) => {
        const realIdx = startIdx + i;
        const isCompleted = realIdx < cur;
        const isCurrent = realIdx === cur;
        const isNext = realIdx > cur;
        const color = isCompleted ? '#52c41a' : isCurrent ? (card.isAbnormal ? '#ff4d4f' : '#1677ff') : '#bfbfbf';
        const icon = isCompleted
          ? <CheckCircleFilled style={{ fontSize: 16, color }} />
          : isCurrent
            ? (card.isAbnormal ? <ExclamationCircleFilled style={{ fontSize: 16, color }} /> : <ClockCircleFilled style={{ fontSize: 16, color }} />)
            : <ClockCircleFilled style={{ fontSize: 16, color: '#d9d9d9' }} />;
        const nodeTime = isCompleted
          ? baseTime.subtract((cur - realIdx) * 2, 'day').format('MM-DD HH:mm')
          : isCurrent
            ? (card.updatedAt?.slice(5, 16) || '')
            : '';
        return (
          <React.Fragment key={node.nodeCode}>
            {i > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 8 }}>
                <div style={{ width: 16, height: 1, background: isCompleted || isCurrent ? color : '#e0e0e0' }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
              {icon}
              <Text style={{ fontSize: 11, color: isCurrent ? color : isNext ? '#bfbfbf' : '#595959', fontWeight: isCurrent ? 600 : 400, marginTop: 2, whiteSpace: 'nowrap' }}>
                {node.nodeName}
              </Text>
              {nodeTime ? (
                <Text type="secondary" style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{nodeTime}</Text>
              ) : (
                <Text style={{ fontSize: 9, color: 'transparent' }}>-</Text>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const WorkbenchOverview: React.FC<WorkbenchOverviewProps> = ({
  currentRole,
  businessMode,
  warehouseId,
  onOpenTab,
  canOpenTab,
}) => {
  const { token } = theme.useToken();
  const [previewRole, setPreviewRole] = useState<UserRole>(currentRole);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<RoleWorkbenchData | null>(null);

  const effectiveBusinessMode = useMemo<BusinessMode>(() => {
    if (previewRole === 'FINANCE' || previewRole === 'BOSS' || previewRole === 'ADMIN') {
      return 'ALL';
    }
    if (businessMode === 'ALL') {
      return 'SEA';
    }
    return businessMode;
  }, [previewRole, businessMode]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    loadWorkbenchData(previewRole, effectiveBusinessMode, warehouseId)
      .then((next) => {
        if (!alive) return;
        setData(next);
      })
      .catch((err: any) => {
        if (!alive) return;
        setError(err?.message || '加载工作台待办失败');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [previewRole, effectiveBusinessMode, warehouseId, reloadKey]);

  const usesBusinessLinePages = useMemo(
    () => ['SALES', 'WAREHOUSE_CN', 'OPS_CN', 'OPS_US', 'WAREHOUSE_US'].includes(previewRole),
    [previewRole],
  );

  const allTodoItems = useMemo(() => {
    if (!data) return [];
    const items: WorkbenchTodoItem[] = [];
    data.sections.forEach((s) => s.items.forEach((it) => items.push(it)));
    return items;
  }, [data]);

  const taskCards = data?.taskProgressCards || [];
  const alertItems = data?.alertItems || [];
  const noticeItems = data?.notices || [];

  return (
    <div style={{ height: 'calc(100vh - 120px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '0 4px' }}>
      {/* ── Stats Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', borderRadius: 8, marginBottom: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <Title level={5} style={{ margin: 0, whiteSpace: 'nowrap' }}>
            {data?.title || `${ROLE_LABELS[previewRole]}工作台`}
          </Title>
          {data?.metrics.map((m) => {
            const toneColor = TONE_STYLES[m.tone || 'default'].text;
            return (
              <Tag
                key={`${previewRole}-${m.title}`}
                color={m.tone || 'default'}
                style={{ cursor: canOpenTab(m.tabKey) ? 'pointer' : 'default', margin: 0 }}
                onClick={() => canOpenTab(m.tabKey) && onOpenTab(m.tabKey)}
              >
                {m.title} <strong style={{ color: toneColor }}>{m.value}</strong>{m.suffix ? m.suffix : ''}
              </Tag>
            );
          })}
        </div>
        <Space.Compact style={{ flexShrink: 0 }}>
          <Select
            value={previewRole}
            suffixIcon={<SwapOutlined />}
            options={PREVIEW_ROLE_OPTIONS}
            onChange={(value) => setPreviewRole(value)}
            size="small"
            style={{ width: 140 }}
          />
          <Button icon={<ReloadOutlined />} size="small" onClick={() => setReloadKey((v) => v + 1)} />
        </Space.Compact>
      </div>

      {/* ── Main content area ── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fff', borderRadius: 8 }}>
          <Spin size="large" />
        </div>
      ) : error ? (
        <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: 24 }}>
          <Alert showIcon type="error" message={error} />
        </div>
      ) : data ? (
        <>
          {/* Two-column layout: Left (Todo + Alerts + Notices) | Right (Task Cards) */}
          <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
            {/* Left: Todo + Alerts + Notices */}
            <div style={{ flex: 1, display: 'flex', gap: 8, minHeight: 0 }}>
              {/* Todo */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 8, overflow: 'hidden', minWidth: 0 }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <span>待办事项</span>
                  <Badge count={allTodoItems.reduce((s, it) => s + it.count, 0)} style={{ backgroundColor: '#1677ff' }} />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                  {allTodoItems.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待办" />
                    </div>
                  ) : (
                    allTodoItems.map((item) => {
                      const toneColor = TONE_STYLES[item.tone || 'default'].text;
                      return (
                        <div key={`${item.tabKey}-${item.title}`} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 3, height: 32, borderRadius: 2, background: toneColor, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 13 }} ellipsis>{item.title}</Text>
                              <Badge count={item.count} style={{ backgroundColor: toneColor }} />
                            </div>
                            <Text type="secondary" style={{ fontSize: 11 }}>{item.source}</Text>
                          </div>
                          <Button type="link" size="small" disabled={!canOpenTab(item.tabKey)} onClick={() => onOpenTab(item.tabKey)} style={{ flexShrink: 0, padding: '0 4px' }}>去处理</Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              {/* Alerts + Notices stacked */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, minWidth: 0 }}>
                <div style={{ flex: 6, background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <Space size={4}><BellOutlined /><span>预警消息</span></Space>
                    <Badge count={alertItems.length} style={{ backgroundColor: '#ff4d4f' }} />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                    {alertItems.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无预警" /></div>
                    ) : (
                      alertItems.map((item) => (
                        <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5', cursor: canOpenTab(item.tabKey) ? 'pointer' : 'default' }} onClick={() => canOpenTab(item.tabKey) && onOpenTab(item.tabKey)}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', marginTop: 6, background: LEVEL_COLORS[item.level], flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                <Text style={{ fontSize: 13 }} ellipsis>{item.title}</Text>
                                <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>{item.time.slice(5)}</Text>
                              </div>
                              <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{item.description}</Text>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div style={{ flex: 4, background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <NotificationOutlined /><span>通知公告</span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                    {noticeItems.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无通知" /></div>
                    ) : (
                      noticeItems.map((item) => (
                        <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            {!item.isRead && <Badge dot style={{ marginTop: 6 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text style={{ fontSize: 13 }} strong={!item.isRead}>{item.title}</Text>
                              <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{item.time.slice(5)}</Text>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Task Cards — single column, max 5 */}
            <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span>任务进展</span>
                <Badge count={taskCards.length} style={{ backgroundColor: '#1677ff' }} />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
                {taskCards.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务" />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {taskCards.slice(0, 5).map((card) => (
                      <div
                        key={`${card.jobNo}-${card.tabKey}`}
                        style={{
                          border: card.isAbnormal ? '1px solid #ffccc7' : '1px solid #f0f0f0',
                          borderRadius: 8,
                          padding: '8px 10px',
                          background: card.isAbnormal ? '#fff2f0' : '#fafafa',
                          cursor: 'pointer',
                        }}
                        onClick={() => canOpenTab(card.tabKey) && onOpenTab(card.tabKey)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text strong style={{ fontSize: 12, color: '#1677ff' }}>{card.jobNo}</Text>
                          {card.isAbnormal && <Tag color="error" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>异常</Tag>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                          <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 3px', margin: 0 }}>{card.route}</Tag>
                          <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 3px', margin: 0 }}>{card.serviceType}</Tag>
                        </div>
                        {renderTaskNodeFlow(card)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom Quick Actions ── */}
          <div style={{ display: 'flex', gap: 8, padding: '8px 0', flexShrink: 0, flexWrap: 'wrap' }}>
            {data.quickActions.map((action) => (
              <Button
                key={action.tabKey}
                size="small"
                icon={<ArrowRightOutlined />}
                disabled={!canOpenTab(action.tabKey)}
                onClick={() => onOpenTab(action.tabKey)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fff', borderRadius: 8 }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工作台数据" />
        </div>
      )}
    </div>
  );
};
