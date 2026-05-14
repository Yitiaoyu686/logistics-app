import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font, shadow } from '../../lib/theme';
import { getRoleLabel } from '../../lib/auth';
import { jobApi, orderApi, warehouseApi, deliveryApi, customerApi } from '../../lib/api';
import { TransferActionDialog, TransferActionMode, TransferTargetItem } from '../../components/TransferActionDialog';
import { UnmatchedMatchDialog, UnmatchedTargetItem } from '../../components/UnmatchedMatchDialog';

type ActionIntent = 'transfer-dispatch' | 'transfer-arrive' | 'transfer-receive' | 'unmatched-match';

interface TaskItem {
  id: string;
  type: 'inbound' | 'packing' | 'execute' | 'transfer' | 'orphan' | 'dispatch' | 'delivery' | 'pickup'
    | 'sales-customer' | 'sales-unpaid';
  icon: string;
  title: string;
  subtitle: string;
  detail: string;
  status: string;
  statusColor: string;
  time?: string;
  progress?: { current: number; total: number };
  actions: { label: string; color: string; route?: string; params?: Record<string, any>; intent?: ActionIntent }[];
  borderColor: string;
  cardRoute?: string;
  cardParams?: Record<string, any>;
  rawTransfer?: TransferTargetItem;
  rawUnmatched?: UnmatchedTargetItem;
}

export default function TasksScreen() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [userName, setUserName] = useState('');
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TaskItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mainTab, setMainTab] = useState<'pending' | 'completed'>('pending');
  const [activeTab, setActiveTab] = useState('全部');
  const [transferTarget, setTransferTarget] = useState<TransferTargetItem | null>(null);
  const [transferMode, setTransferMode] = useState<TransferActionMode | null>(null);
  const [unmatchedTarget, setUnmatchedTarget] = useState<UnmatchedTargetItem | null>(null);

  useEffect(() => {
    let timer: any = null;
    AsyncStorage.getItem('user').then((u) => {
      if (u) {
        const user = JSON.parse(u);
        setRole(user.role);
        setUserName(user.realName);
        loadAllTasks(user.role);
        timer = setInterval(() => loadAllTasks(user.role), 15000);
      }
    });
    return () => { if (timer) clearInterval(timer); };
  }, []);

  useFocusEffect(useCallback(() => {
    if (role) loadAllTasks(role);
  }, [role]));

  const loadAllTasks = async (userRole: string) => {
    try {
      const pending: TaskItem[] = [];
      const completed: TaskItem[] = [];

      if (userRole === 'WAREHOUSE_CN') {
        await loadWarehouseCnTasks(pending, completed);
      } else if (userRole === 'WAREHOUSE_US') {
        await loadWarehouseUsTasks(pending, completed);
      } else if (userRole === 'SALES') {
        await loadSalesTasks(pending, completed);
      }

      setPendingTasks(pending);
      setCompletedTasks(completed);
    } catch (err) {
      console.log('Load tasks error:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllTasks(role);
    setRefreshing(false);
  }, [role]);

  const tabs = role === 'WAREHOUSE_CN'
    ? ['全部', '入库', '装箱', '调拨', '无单']
    : role === 'WAREHOUSE_US'
    ? ['全部', '入库', 'DPN', '配送', '自提']
    : role === 'SALES'
    ? ['全部', '待收款', '新客户']
    : ['全部'];

  const tabTypeMap: Record<string, string[]> = {
    '入库': ['inbound'], '装箱': ['packing', 'execute'], '调拨': ['transfer'],
    'DPN': ['dispatch'], '配送': ['delivery'], '自提': ['pickup'],
    '无单': ['orphan'], '待收款': ['sales-unpaid'], '新客户': ['sales-customer'],
  };

  const currentTasks = mainTab === 'pending' ? pendingTasks : completedTasks;
  const filteredTasks = activeTab === '全部'
    ? currentTasks
    : currentTasks.filter(t => (tabTypeMap[activeTab] || []).includes(t.type));

  const handleAction = (task: TaskItem, action: TaskItem['actions'][0]) => {
    if (!action) return;
    if (action.intent === 'transfer-dispatch' && task.rawTransfer) {
      setTransferTarget(task.rawTransfer); setTransferMode('dispatch'); return;
    }
    if (action.intent === 'transfer-arrive' && task.rawTransfer) {
      setTransferTarget(task.rawTransfer); setTransferMode('arrive'); return;
    }
    if (action.intent === 'transfer-receive' && task.rawTransfer) {
      setTransferTarget(task.rawTransfer); setTransferMode('receive'); return;
    }
    if (action.intent === 'unmatched-match' && task.rawUnmatched) {
      setUnmatchedTarget(task.rawUnmatched); return;
    }
    if (action.route) {
      router.push({ pathname: action.route as any, params: action.params || {} });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header — 单行压缩 */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerName}>{userName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{getRoleLabel(role)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {role.includes('WAREHOUSE') && (
            <View style={styles.printerBadge}>
              <View style={styles.printerDot} />
              <Text style={styles.printerText}>打印机</Text>
            </View>
          )}
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{userName ? userName[0] : '?'}</Text>
          </View>
        </View>
      </View>

      {/* 主Tab：待办 / 已完成 */}
      <View style={styles.mainTabBar}>
        <Pressable
          style={[styles.mainTab, mainTab === 'pending' && styles.mainTabActive]}
          onPress={() => { setMainTab('pending'); setActiveTab('全部'); }}
        >
          <Text style={[styles.mainTabText, mainTab === 'pending' && styles.mainTabTextActive]}>
            待办
          </Text>
          <Text style={[styles.mainTabCount, mainTab === 'pending' && styles.mainTabCountActive]}>
            {pendingTasks.length}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.mainTab, mainTab === 'completed' && styles.mainTabActive]}
          onPress={() => { setMainTab('completed'); setActiveTab('全部'); }}
        >
          <Text style={[styles.mainTabText, mainTab === 'completed' && styles.mainTabTextActive]}>
            已完成
          </Text>
          <Text style={[styles.mainTabCount, mainTab === 'completed' && styles.mainTabCountActive]}>
            {completedTasks.length}
          </Text>
        </Pressable>
      </View>

      {/* 子筛选Tab — 仅待办下显示 */}
      {mainTab === 'pending' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabBar} contentContainerStyle={styles.subTabBarContent}>
          {tabs.map((tab) => {
            const count = tab === '全部' ? pendingTasks.length : pendingTasks.filter(t => (tabTypeMap[tab] || []).includes(t.type)).length;
            return (
              <Pressable
                key={tab}
                style={[styles.subTab, activeTab === tab && styles.subTabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.subTabText, activeTab === tab && styles.subTabTextActive]}>
                  {tab}{count > 0 ? ` ${count}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Task List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {filteredTasks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name={mainTab === 'pending' ? 'checkmark-circle-outline' : 'time-outline'} size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              {mainTab === 'pending' ? '暂无待办任务' : '暂无已完成记录'}
            </Text>
          </View>
        ) : (
          filteredTasks.map((task) => {
            const primaryAction = task.actions[0] || null;
            const isCompleted = mainTab === 'completed';

            const cardContent = (
              <View key={task.id} style={styles.card}>
                {/* Row 1: icon + title + status ... action/time */}
                <View style={styles.cardRow1}>
                  <View style={[styles.cardIconWrap, { backgroundColor: task.borderColor + '18' }]}>
                    <Text style={styles.cardIcon}>{task.icon}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>{task.title}</Text>
                  <View style={[styles.cardStatusBadge, { backgroundColor: task.statusColor + '15' }]}>
                    <Text style={[styles.cardStatusText, { color: task.statusColor }]}>{task.status}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  {isCompleted && task.time ? (
                    <Text style={styles.cardTime}>{task.time}</Text>
                  ) : primaryAction ? (
                    <Pressable
                      style={[styles.cardActionBtn, {
                        backgroundColor: primaryAction.color === colors.textSecondary ? colors.bg : primaryAction.color,
                      }]}
                      onPress={() => handleAction(task, primaryAction)}
                    >
                      <Text style={[styles.cardActionBtnText, {
                        color: primaryAction.color === colors.textSecondary ? colors.textSecondary : '#fff',
                      }]}>{primaryAction.label}</Text>
                    </Pressable>
                  ) : null}
                </View>
                {/* Row 2: subtitle */}
                <Text style={styles.cardSubtitle} numberOfLines={1}>{task.subtitle}</Text>
                {/* Row 3: detail */}
                <Text style={styles.cardDetail} numberOfLines={1}>{task.detail}</Text>
                {/* Progress bar (packing tasks only) */}
                {task.progress && (
                  <View style={styles.progressRow}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, {
                        width: `${Math.min(100, task.progress.total > 0 ? (task.progress.current / task.progress.total) * 100 : 0)}%`,
                        backgroundColor: task.borderColor,
                      }]} />
                    </View>
                    <Text style={[styles.progressText, { color: task.borderColor }]}>
                      {task.progress.current > 0 ? `${task.progress.current}件` : '空箱'}
                    </Text>
                  </View>
                )}
              </View>
            );

            if (task.cardRoute) {
              return (
                <Pressable key={task.id} onPress={() => router.push({ pathname: task.cardRoute as any, params: task.cardParams || {} })}>
                  {cardContent}
                </Pressable>
              );
            }
            return cardContent;
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      <TransferActionDialog
        visible={!!transferTarget && !!transferMode}
        target={transferTarget}
        mode={transferMode}
        onClose={() => { setTransferTarget(null); setTransferMode(null); }}
        onSuccess={() => { setTransferTarget(null); setTransferMode(null); loadAllTasks(role); }}
      />
      <UnmatchedMatchDialog
        visible={!!unmatchedTarget}
        target={unmatchedTarget}
        onClose={() => setUnmatchedTarget(null)}
        onSuccess={() => { setUnmatchedTarget(null); loadAllTasks(role); }}
      />
    </SafeAreaView>
  );
}

// ── Data loaders per role ──

async function loadWarehouseCnTasks(pending: TaskItem[], completed: TaskItem[]) {
  const [ordersRes, jobsRes, transfersRes, unmatchedRes, returnsRes, completedOrdersRes, completedJobsRes] = await Promise.all([
    orderApi.list({ status: 'PENDING_INBOUND' }),
    jobApi.list({ status: 'LOADING' }),
    warehouseApi.getTransfers(),
    warehouseApi.getUnmatched(),
    warehouseApi.getReturns().catch(() => ({ data: [] })),
    orderApi.list({ status: 'INBOUND' }),
    jobApi.list({ status: 'DEPARTED' }),
  ]);

  // 待入库
  for (const o of (ordersRes.data || [])) {
    pending.push({
      id: `inbound-${o.id}`, type: 'inbound', icon: '📦',
      title: '待入库', subtitle: o.order_no,
      detail: `${o.customer_name} · ${o.total_declared_pieces || 0}件 · ${o.route_code || ''}`,
      status: '待处理', statusColor: colors.warning,
      time: fmtTime(o.created_at),
      actions: [{ label: '扫码入库', color: colors.primary, route: '/task/inbound', params: { orderId: o.id, orderNo: o.order_no } }],
      borderColor: colors.taskInbound,
    });
  }

  // 待装箱
  for (const j of (jobsRes.data || [])) {
    const loadedPieces = j.total_pieces || 0;
    const estimatedMax = j.business_line === 'AIR' ? 200 : 500;
    pending.push({
      id: `packing-${j.id}`, type: 'packing', icon: '🏗',
      title: '待添加订单', subtitle: `${j.job_no} · ${j.container_no || '未创建'}`,
      detail: `${j.route_code || ''} · ${j.container_type || ''} · ${j.service_type === 'EXPRESS' ? '特快' : '普快'}`,
      status: '装箱中', statusColor: colors.info,
      progress: { current: loadedPieces, total: estimatedMax },
      actions: [{ label: '添加订单', color: colors.success, route: '/task/packing', params: { jobId: j.id, mode: 'add-order' } }],
      borderColor: colors.taskPacking,
    });
  }

  // 调拨
  for (const t of (transfersRes.data || []).filter((t: any) => !['CANCELLED', 'RECEIVED'].includes(t.transfer_status))) {
    const statusMap: Record<string, string> = { PENDING: '待发运', IN_TRANSIT: '运输中', ARRIVED: '已到达' };
    const actions: TaskItem['actions'] = [];
    if (t.transfer_status === 'PENDING') {
      actions.push({ label: '执行发车', color: colors.primary, intent: 'transfer-dispatch' });
    } else if (t.transfer_status === 'IN_TRANSIT') {
      actions.push({ label: '确认到达', color: colors.primary, intent: 'transfer-arrive' });
    } else if (t.transfer_status === 'ARRIVED') {
      actions.push({ label: '扫码入库', color: colors.success, route: '/task/transfer-inbound', params: { id: t.id } });
    }
    pending.push({
      id: `transfer-${t.id}`, type: 'transfer', icon: '📋',
      title: `调拨${statusMap[t.transfer_status] || t.transfer_status}`,
      subtitle: t.transfer_no,
      detail: `${t.from_warehouse_name || ''} → ${t.to_warehouse_name || ''} · ${t.total_pieces}件`,
      status: statusMap[t.transfer_status] || t.transfer_status,
      statusColor: t.transfer_status === 'PENDING' ? colors.warning : colors.info,
      actions,
      borderColor: colors.taskTransfer,
      rawTransfer: { id: t.id, transfer_no: t.transfer_no, from_warehouse_name: t.from_warehouse_name || '-', to_warehouse_name: t.to_warehouse_name || '-', total_pieces: t.total_pieces || 0, total_weight_kg: t.total_weight_kg || 0 },
    });
  }

  // 无单快递
  for (const u of (unmatchedRes.data || []).filter((u: any) => u.status === 'PENDING')) {
    pending.push({
      id: `orphan-${u.id}`, type: 'orphan', icon: '❓',
      title: '无单快递', subtitle: `${u.tracking_no} · ${u.express_company}`,
      detail: `${u.sender_name || '-'} · ${u.pieces}件 · ${u.gross_weight_kg}kg`,
      status: '待匹配', statusColor: colors.warning,
      time: fmtTime(u.created_at),
      actions: [{ label: '匹配订单', color: colors.warning, intent: 'unmatched-match' }],
      borderColor: colors.taskOrphan,
      rawUnmatched: { id: u.id, tracking_no: u.tracking_no, express_company: u.express_company, sender_name: u.sender_name, sender_phone: u.sender_phone, pieces: u.pieces || 0, gross_weight_kg: u.gross_weight_kg || 0, customer_hint: u.customer_hint },
    });
  }

  // 退回入库
  const returnCount = (returnsRes.data || []).length;
  if (returnCount > 0) {
    pending.push({
      id: 'return-entry', type: 'transfer', icon: '↩️',
      title: '退回入库', subtitle: `待处理 ${returnCount} 条`,
      detail: '从到达国退回的运单/配送失败退回',
      status: '待处理', statusColor: colors.warning,
      actions: [{ label: '查看列表', color: colors.primary, route: '/task/return-process' }],
      borderColor: colors.taskTransfer,
    });
  }

  // ── 已完成 ──
  for (const o of (completedOrdersRes.data || [])) {
    completed.push({
      id: `done-inbound-${o.id}`, type: 'inbound', icon: '📦',
      title: '已入库', subtitle: o.order_no,
      detail: `${o.customer_name} · ${o.total_declared_pieces || 0}件 · ${o.route_code || ''}`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(o.updated_at || o.created_at),
      actions: [], borderColor: colors.taskInbound,
    });
  }
  for (const j of (completedJobsRes.data || [])) {
    completed.push({
      id: `done-packing-${j.id}`, type: 'packing', icon: '🏗',
      title: '已发运', subtitle: j.job_no,
      detail: `${j.route_code || ''} · ${j.total_pieces || 0}件 · ${j.total_weight_kg || 0}kg`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(j.updated_at || j.created_at),
      actions: [], borderColor: colors.taskPacking,
    });
  }
  for (const t of (transfersRes.data || []).filter((t: any) => t.transfer_status === 'RECEIVED')) {
    completed.push({
      id: `done-transfer-${t.id}`, type: 'transfer', icon: '📋',
      title: '调拨完成', subtitle: t.transfer_no,
      detail: `${t.from_warehouse_name || ''} → ${t.to_warehouse_name || ''} · ${t.total_pieces}件`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(t.updated_at || t.created_at),
      actions: [], borderColor: colors.taskTransfer,
    });
  }
  for (const u of (unmatchedRes.data || []).filter((u: any) => u.status === 'MATCHED')) {
    completed.push({
      id: `done-orphan-${u.id}`, type: 'orphan', icon: '❓',
      title: '已匹配', subtitle: `${u.tracking_no} · ${u.express_company}`,
      detail: `${u.sender_name || '-'} · ${u.pieces}件`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(u.updated_at || u.created_at),
      actions: [], borderColor: colors.taskOrphan,
    });
  }
}

async function loadWarehouseUsTasks(pending: TaskItem[], completed: TaskItem[]) {
  const [jobsRes, dpnsRes, deliveriesRes, pickupsRes, completedJobsRes] = await Promise.all([
    jobApi.list({ status: 'ARRIVED' }),
    deliveryApi.getDpns(),
    deliveryApi.getDeliveryTasks(),
    deliveryApi.getPickups(),
    jobApi.list({ status: 'COMPLETED' }),
  ]);

  // 待入库
  for (const j of (jobsRes.data || [])) {
    pending.push({
      id: `inbound-${j.id}`, type: 'inbound', icon: '📦',
      title: '任务入库', subtitle: `${j.job_no} · ${j.business_line === 'SEA' ? '海运' : '空运'}`,
      detail: `${j.origin_port}→${j.dest_port} · ${j.total_pieces}件/${j.total_weight_kg}kg`,
      status: '待入库', statusColor: colors.warning,
      actions: [{ label: '入库核对', color: colors.primary, route: '/task/dest-inbound', params: { jobNo: j.job_no, jobId: j.id } }],
      borderColor: colors.taskInbound,
    });
  }

  // DPN
  const dpnStatusMap: Record<string, string> = { DRAFT: '草稿', PENDING_BIND: '待绑定', PENDING_DISPATCH: '待发运', IN_TRANSIT: '运输中', ARRIVED: '已到达' };
  const dpnActionMap: Record<string, string> = { PENDING_BIND: '绑定运单', PENDING_DISPATCH: '执行发车', IN_TRANSIT: '确认到达', ARRIVED: '入库确认' };
  for (const d of (dpnsRes.data || []).filter((d: any) => !['SIGNED', 'CANCELLED'].includes(d.dpn_status))) {
    const dpnParams = { dpnId: d.id, dpnNo: d.dpn_no, dpnStatus: d.dpn_status, fromSite: d.from_site, toSite: d.to_site };
    pending.push({
      id: `dpn-${d.id}`, type: 'dispatch', icon: '📄',
      title: `DPN${dpnStatusMap[d.dpn_status] || d.dpn_status}`,
      subtitle: d.dpn_no,
      detail: `${d.from_site || ''} → ${d.to_site || ''} · ${d.total_orders}单/${d.total_pieces}件`,
      status: dpnStatusMap[d.dpn_status] || d.dpn_status, statusColor: colors.info,
      actions: dpnActionMap[d.dpn_status]
        ? [{ label: dpnActionMap[d.dpn_status], color: colors.primary, route: '/task/dpn', params: dpnParams }]
        : [],
      borderColor: colors.taskDispatch,
    });
  }

  // 配送
  for (const dt of (deliveriesRes.data || []).filter((d: any) => !['SIGNED', 'CANCELLED'].includes(d.task_status))) {
    pending.push({
      id: `delivery-${dt.id}`, type: 'delivery', icon: '🚚',
      title: '待配送', subtitle: dt.task_no,
      detail: `${dt.recipient_name || ''} · ${dt.recipient_phone || ''}`,
      status: dt.task_status === 'IN_TRANSIT' ? '执行中' : '待接单',
      statusColor: dt.task_status === 'FAILED' ? colors.danger : colors.info,
      actions: [{ label: '配送完成', color: colors.success, route: '/task/delivery', params: { taskId: dt.id, taskNo: dt.task_no, dpnNo: dt.dpn_no, recipientName: dt.recipient_name, recipientPhone: dt.recipient_phone, mode: 'sign' } }],
      borderColor: colors.taskDelivery,
    });
  }

  // 自提
  for (const p of (pickupsRes.data || []).filter((p: any) => p.notify_status !== 'PICKED_UP')) {
    const isPending = p.notify_status === 'PENDING';
    pending.push({
      id: `pickup-${p.id}`, type: 'pickup', icon: '🏪',
      title: isPending ? '待自提通知' : '待核销',
      subtitle: `${p.pickup_no} · ${p.pickup_station}`,
      detail: `${p.recipient_name || ''} · ${p.recipient_phone || ''}`,
      status: isPending ? '待通知' : '已通知',
      statusColor: isPending ? colors.warning : colors.success,
      actions: [{
        label: isPending ? '通知取件' : '核销自提',
        color: isPending ? colors.primary : colors.success,
        route: '/task/pickup',
        params: { pickupId: p.id, pickupNo: p.pickup_no, trackingNo: p.tracking_no, recipientName: p.recipient_name, recipientPhone: p.recipient_phone, pickupStation: p.pickup_station, notifyStatus: p.notify_status, mode: isPending ? 'notify' : 'verify' },
      }],
      borderColor: colors.taskPickup,
    });
  }

  // ── 已完成 ──
  for (const j of (completedJobsRes.data || [])) {
    completed.push({
      id: `done-inbound-${j.id}`, type: 'inbound', icon: '📦',
      title: '已入库', subtitle: j.job_no,
      detail: `${j.origin_port}→${j.dest_port} · ${j.total_pieces}件`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(j.updated_at || j.created_at),
      actions: [], borderColor: colors.taskInbound,
    });
  }
  for (const d of (dpnsRes.data || []).filter((d: any) => ['SIGNED', 'COMPLETED'].includes(d.dpn_status))) {
    completed.push({
      id: `done-dpn-${d.id}`, type: 'dispatch', icon: '📄',
      title: 'DPN完成', subtitle: d.dpn_no,
      detail: `${d.from_site || ''} → ${d.to_site || ''} · ${d.total_orders}单`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(d.updated_at || d.created_at),
      actions: [], borderColor: colors.taskDispatch,
    });
  }
  for (const dt of (deliveriesRes.data || []).filter((d: any) => d.task_status === 'SIGNED')) {
    completed.push({
      id: `done-delivery-${dt.id}`, type: 'delivery', icon: '🚚',
      title: '已签收', subtitle: dt.task_no,
      detail: `${dt.recipient_name || ''}`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(dt.updated_at || dt.created_at),
      actions: [], borderColor: colors.taskDelivery,
    });
  }
  for (const p of (pickupsRes.data || []).filter((p: any) => p.notify_status === 'PICKED_UP')) {
    completed.push({
      id: `done-pickup-${p.id}`, type: 'pickup', icon: '🏪',
      title: '已自提', subtitle: `${p.pickup_no}`,
      detail: `${p.recipient_name || ''} · ${p.pickup_station || ''}`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(p.updated_at || p.created_at),
      actions: [], borderColor: colors.taskPickup,
    });
  }
}

async function loadSalesTasks(pending: TaskItem[], completed: TaskItem[]) {
  const [myCustomersRes, allOrdersRes] = await Promise.all([
    customerApi.list({ poolType: 'PRIVATE' }),
    orderApi.list({}),
  ]);
  const myCustomers: any[] = myCustomersRes.data || [];
  const allOrders: any[] = allOrdersRes.data || [];
  const now = Date.now();
  const DAYS_14 = 14 * 86400000;

  // 货到未收款
  const urgentUnpaid = allOrders.filter((o: any) =>
    ['ARRIVED', 'DELIVERED'].includes(o.order_status) &&
    ['UNPAID', 'PARTIAL'].includes(o.payment_status)
  );
  for (const o of urgentUnpaid) {
    const amt = Number(o.total_receivable_amount || o.actual_freight || o.estimated_freight || 0);
    pending.push({
      id: `sales-unpaid-${o.id}`, type: 'sales-unpaid', icon: '💰',
      title: '货到未收款', subtitle: `${o.order_no} · ${o.customer_name}`,
      detail: `应收 ¥${amt > 0 ? amt.toFixed(2) : '待确认'} · ${o.order_status === 'ARRIVED' ? '已到达' : '已签收'}`,
      status: o.payment_status === 'PARTIAL' ? '部分已付' : '未付款',
      statusColor: colors.danger,
      actions: [],
      borderColor: colors.taskOrphan,
      cardRoute: '/task/order-detail', cardParams: { id: o.id },
    });
  }

  // 新客户未下单
  const newNoOrder = myCustomers.filter((c: any) => {
    if ((c.totalOrders || 0) > 0) return false;
    const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    return created > 0 && (now - created) > DAYS_14;
  });
  for (const c of newNoOrder) {
    const daysSince = c.createdAt ? Math.floor((now - new Date(c.createdAt).getTime()) / 86400000) : 0;
    pending.push({
      id: `sales-noorder-${c.id}`, type: 'sales-customer', icon: '👤',
      title: '新客户未下单',
      subtitle: `${c.customerName || c.name} · ${c.customerCode || c.shortCode || ''}`,
      detail: `${c.country || '-'} · ${c.contactPhone || c.contact?.phone || '-'}`,
      status: `已${daysSince}天`, statusColor: daysSince > 30 ? colors.danger : colors.warning,
      actions: [],
      borderColor: colors.taskInbound,
      cardRoute: '/task/customer-detail', cardParams: { id: c.id },
    });
  }

  // ── 已完成：已收款订单 ──
  const paidOrders = allOrders.filter((o: any) => o.payment_status === 'PAID' && ['ARRIVED', 'DELIVERED'].includes(o.order_status));
  for (const o of paidOrders) {
    const amt = Number(o.total_receivable_amount || o.actual_freight || 0);
    completed.push({
      id: `done-paid-${o.id}`, type: 'sales-unpaid', icon: '💰',
      title: '已收款', subtitle: `${o.order_no} · ${o.customer_name}`,
      detail: `¥${amt > 0 ? amt.toFixed(2) : '-'}`,
      status: '已完成', statusColor: colors.success,
      time: fmtTime(o.updated_at || o.created_at),
      actions: [], borderColor: colors.taskOrphan,
    });
  }
}

function fmtTime(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // ── Header: single row, ~52px
  header: {
    backgroundColor: colors.headerStart,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerName: { fontSize: font.lg, fontWeight: '800', color: '#fff' },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  roleText: { fontSize: font.xs, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  printerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.2)',
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },
  printerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  printerText: { fontSize: font.xs, color: colors.success, fontWeight: '600' },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },

  // ── Main Tab: 待办 / 已完成
  mainTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mainTabActive: { borderBottomColor: colors.primary },
  mainTabText: { fontSize: font.md, fontWeight: '500', color: colors.textSecondary },
  mainTabTextActive: { color: colors.primary, fontWeight: '700' },
  mainTabCount: { fontSize: font.sm, color: colors.textTertiary, fontWeight: '500' },
  mainTabCountActive: { color: colors.primary },

  // ── Sub filter tabs
  subTabBar: { backgroundColor: colors.card, maxHeight: 42, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  subTabBarContent: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  subTab: { paddingHorizontal: spacing.md, paddingVertical: 10, marginRight: spacing.xs },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  subTabText: { fontSize: font.sm, color: colors.textSecondary },
  subTabTextActive: { color: colors.primary, fontWeight: '600' },

  // ── Task List
  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  // ── Compact Card (~72px)
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    ...shadow.sm,
  },
  cardRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardIconWrap: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 13 },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  cardStatusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  cardStatusText: { fontSize: font.xs, fontWeight: '600' },
  cardTime: { fontSize: font.xs, color: colors.textTertiary },
  cardSubtitle: { fontSize: font.sm, color: colors.text, fontWeight: '500', fontFamily: font.mono, marginBottom: 2, paddingLeft: 32 },
  cardDetail: { fontSize: font.sm, color: colors.textSecondary, paddingLeft: 32 },
  cardActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    minWidth: 72,
    alignItems: 'center',
  },
  cardActionBtnText: { fontSize: font.sm, fontWeight: '700' },

  // ── Progress Bar
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: spacing.sm, paddingLeft: 32 },
  progressBar: { flex: 1, height: 4, backgroundColor: colors.borderLight, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: font.xs, fontWeight: '600', width: 36, textAlign: 'right' },

  // ── Empty State
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: { fontSize: font.md, color: colors.textSecondary, fontWeight: '600' },
});
