import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, RefreshControl, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font } from '../../lib/theme';
import { getRoleLabel, getRoleColor } from '../../lib/auth';
import { jobApi, orderApi, warehouseApi, deliveryApi, customerApi, salesApi } from '../../lib/api';
import { TransferActionDialog, TransferActionMode, TransferTargetItem } from '../../components/TransferActionDialog';
import { UnmatchedMatchDialog, UnmatchedTargetItem } from '../../components/UnmatchedMatchDialog';

type ActionIntent = 'transfer-dispatch' | 'transfer-arrive' | 'transfer-receive' | 'unmatched-match';

interface TaskItem {
  id: string;
  type: 'inbound' | 'packing' | 'execute' | 'transfer' | 'orphan' | 'dispatch' | 'delivery' | 'pickup' | 'preview'
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
  // 用于内联弹窗的原始数据
  rawTransfer?: TransferTargetItem;
  rawUnmatched?: UnmatchedTargetItem;
}

interface SalesStats {
  myCustomers: number;
  pendingOrders: number;
  unpaidOrders: number;
  monthlyNew: number;
}

export default function TasksScreen() {
  const router = useRouter();
  const [role, setRole] = useState('');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('全部');
  // 内联弹窗状态
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
        setUserId(user.id);
        loadTasks(user.role);
        // 轮询：每 15 秒静默刷新任务流
        timer = setInterval(() => loadTasks(user.role), 15000);
      }
    });
    return () => { if (timer) clearInterval(timer); };
  }, []);

  // 从详情页返回时自动刷新
  useFocusEffect(useCallback(() => {
    if (role) loadTasks(role);
  }, [role]));

  const loadTasks = async (userRole: string) => {
    try {
      const items: TaskItem[] = [];

      if (userRole === 'WAREHOUSE_CN') {
        // 待入库订单
        const orders = await orderApi.list({ status: 'PENDING_INBOUND' });
        for (const o of (orders.data || []).slice(0, 5)) {
          items.push({
            id: `inbound-${o.id}`, type: 'inbound', icon: '📦',
            title: '待入库', subtitle: `${o.order_no}`,
            detail: `${o.customer_name} · ${o.total_declared_pieces || 0}件 · ${o.route_code || ''}`,
            status: '待处理', statusColor: colors.warning,
            time: formatTime(o.created_at),
            actions: [{ label: '扫码入库', color: colors.primary, route: '/task/inbound', params: { orderId: o.id, orderNo: o.order_no } }],
            borderColor: colors.taskInbound,
          });
        }

        // 待执行出库的JOB
        const jobs = await jobApi.list({ status: 'LOADING' });
        for (const j of (jobs.data || []).slice(0, 3)) {
          items.push({
            id: `packing-${j.id}`, type: 'packing', icon: '🏗',
            title: '待添加订单', subtitle: `${j.job_no} · ${j.container_no || '未创建'}`,
            detail: `${j.route_code || ''} · ${j.container_type || ''} · ${j.service_type === 'EXPRESS' ? '特快' : '普快'}`,
            status: '装箱中', statusColor: colors.info,
            progress: { current: j.total_weight_kg || 0, total: 26000 },
            actions: [
              { label: '添加订单', color: colors.success, route: '/task/packing', params: { jobId: j.id, mode: 'add-order' } },
              ...(j.business_line === 'AIR'
                ? [{ label: '集装号', color: colors.info, route: '/task/shipping-units', params: { jobId: j.id } }]
                : []),
              { label: '执行出库', color: colors.warning, route: '/task/packing', params: { jobId: j.id, mode: 'execute-out' } },
            ],
            borderColor: colors.taskPacking,
          });
        }

        // 调拨 — 按状态显示对应操作按钮，点击直接打开内联弹窗
        const transfers = await warehouseApi.getTransfers();
        for (const t of (transfers.data || []).filter((t: any) => t.transfer_status !== 'CANCELLED' && t.transfer_status !== 'RECEIVED')) {
          const statusMap: Record<string, string> = { PENDING: '待发运', IN_TRANSIT: '运输中', ARRIVED: '已到达' };
          const actions: TaskItem['actions'] = [];
          if (t.transfer_status === 'PENDING') {
            actions.push({ label: '执行发车', color: colors.primary, intent: 'transfer-dispatch' });
          } else if (t.transfer_status === 'IN_TRANSIT') {
            actions.push({ label: '确认到达', color: colors.primary, intent: 'transfer-arrive' });
          } else if (t.transfer_status === 'ARRIVED') {
            // ARRIVED 状态: 跳转扫码入库页（逐件确认而不是简单 confirm）
            actions.push({ label: '扫码入库', color: colors.success, route: '/task/transfer-inbound', params: { id: t.id } });
          }
          items.push({
            id: `transfer-${t.id}`, type: 'transfer', icon: '📋',
            title: `调拨${statusMap[t.transfer_status] || t.transfer_status}`,
            subtitle: t.transfer_no,
            detail: `${t.from_warehouse_name || ''} → ${t.to_warehouse_name || ''} · ${t.total_pieces}件/${t.total_weight_kg}kg`,
            status: statusMap[t.transfer_status] || t.transfer_status, statusColor: t.transfer_status === 'PENDING' ? colors.warning : colors.info,
            actions,
            borderColor: colors.taskTransfer,
            rawTransfer: {
              id: t.id,
              transfer_no: t.transfer_no,
              from_warehouse_name: t.from_warehouse_name || '-',
              to_warehouse_name: t.to_warehouse_name || '-',
              total_pieces: t.total_pieces || 0,
              total_weight_kg: t.total_weight_kg || 0,
            },
          });
        }

        // 无单快递 — 卡片"匹配订单"按钮直接打开内联弹窗
        const unmatched = await warehouseApi.getUnmatched();
        for (const u of (unmatched.data || []).filter((u: any) => u.status === 'PENDING')) {
          items.push({
            id: `orphan-${u.id}`, type: 'orphan', icon: '❓',
            title: '无单快递', subtitle: `${u.tracking_no} · ${u.express_company}`,
            detail: `发件人: ${u.sender_name || '-'} ${u.sender_phone || ''}\n${u.pieces}件 · ${u.gross_weight_kg}kg`,
            status: '待匹配', statusColor: colors.warning,
            time: formatTime(u.created_at),
            actions: [
              { label: '匹配订单', color: colors.warning, intent: 'unmatched-match' },
            ],
            borderColor: colors.taskOrphan,
            rawUnmatched: {
              id: u.id,
              tracking_no: u.tracking_no,
              express_company: u.express_company,
              sender_name: u.sender_name,
              sender_phone: u.sender_phone,
              pieces: u.pieces || 0,
              gross_weight_kg: u.gross_weight_kg || 0,
              customer_hint: u.customer_hint,
            },
          });
        }

        // 退回入库入口 — 常驻快捷卡片（真实场景来自 warehouseApi.getReturns）
        let returnCount = 0;
        try {
          const returnsRes = await warehouseApi.getReturns();
          returnCount = (returnsRes.data || []).length;
        } catch {
          returnCount = 0;
        }
        items.push({
          id: 'return-entry',
          type: 'transfer',
          icon: '↩️',
          title: '退回入库',
          subtitle: returnCount > 0 ? `待处理 ${returnCount} 条` : '暂无待处理',
          detail: '处理从到达国退回的运单 / 配送失败退回',
          status: returnCount > 0 ? '待处理' : '无任务',
          statusColor: returnCount > 0 ? colors.warning : colors.textTertiary,
          actions: [
            { label: '查看列表', color: colors.primary, route: '/task/return-process' },
          ],
          borderColor: colors.taskTransfer,
        });

        // 运营预告：即将发运的JOB
        const allJobs = await jobApi.list();
        for (const j of (allJobs.data || []).filter((j: any) => ['CUSTOMS_EXPORT', 'DEPARTED'].includes(j.job_status))) {
          const daysToEtd = j.etd ? Math.ceil((new Date(j.etd).getTime() - Date.now()) / 86400000) : null;
          items.push({
            id: `preview-${j.id}`, type: 'preview', icon: '🗓',
            title: '即将发运', subtitle: `${j.job_no} · ${j.route_code || ''}`,
            detail: `${j.carrier_name || ''} · ${j.container_no || ''}\n当前: ${j.current_node || j.job_status}`,
            status: daysToEtd !== null ? `ETD ${daysToEtd}天后` : '', statusColor: (daysToEtd || 99) <= 3 ? colors.danger : colors.info,
            actions: [{ label: '查看详情', color: colors.textSecondary }],
            borderColor: colors.taskPreview,
          });
        }

      } else if (userRole === 'WAREHOUSE_US') {
        // 待入库任务
        const jobs = await jobApi.list({ status: 'ARRIVED' });
        for (const j of (jobs.data || []).slice(0, 5)) {
          items.push({
            id: `inbound-${j.id}`, type: 'inbound', icon: '📦',
            title: '任务入库', subtitle: `${j.job_no} · ${j.business_line === 'SEA' ? '海运' : '空运'}`,
            detail: `${j.carrier_name || ''} · ${j.origin_port}→${j.dest_port}\n集装箱 ${j.container_no || '-'} · ${j.total_pieces}件/${j.total_weight_kg}kg`,
            status: '待入库', statusColor: colors.warning,
            actions: [
              { label: '入库核对', color: colors.primary, route: '/task/dest-inbound', params: { jobNo: j.job_no, jobId: j.id } },
              { label: '清单', color: colors.textSecondary, route: '/task/order' },
            ],
            borderColor: colors.taskInbound,
          });
        }

        // DPN
        const dpns = await deliveryApi.getDpns();
        for (const d of (dpns.data || []).filter((d: any) => !['SIGNED', 'CANCELLED'].includes(d.dpn_status)).slice(0, 5)) {
          const statusMap: Record<string, string> = { DRAFT: '草稿', PENDING_BIND: '待绑定', PENDING_DISPATCH: '待发运', IN_TRANSIT: '运输中', ARRIVED: '已到达' };
          const actionMap: Record<string, string> = { PENDING_BIND: '绑定运单', PENDING_DISPATCH: '执行发车', IN_TRANSIT: '确认到达', ARRIVED: '入库确认' };
          const dpnParams = { dpnId: d.id, dpnNo: d.dpn_no, dpnStatus: d.dpn_status, fromSite: d.from_site, toSite: d.to_site };
          items.push({
            id: `dpn-${d.id}`, type: 'dispatch', icon: '📄',
            title: `DPN${statusMap[d.dpn_status] || d.dpn_status}`,
            subtitle: d.dpn_no,
            detail: `${d.from_site || ''} → ${d.to_site || ''}\n运单 ${d.total_orders} · 件数 ${d.total_pieces}`,
            status: statusMap[d.dpn_status] || d.dpn_status, statusColor: colors.info,
            actions: [
              ...(actionMap[d.dpn_status] ? [{ label: actionMap[d.dpn_status], color: colors.primary, route: '/task/dpn', params: dpnParams }] : []),
              { label: '详情', color: colors.textSecondary, route: '/task/dpn', params: dpnParams },
            ],
            borderColor: colors.taskDispatch,
          });
        }

        // 配送任务
        const deliveries = await deliveryApi.getDeliveryTasks();
        for (const dt of (deliveries.data || []).filter((d: any) => !['SIGNED', 'CANCELLED'].includes(d.task_status))) {
          items.push({
            id: `delivery-${dt.id}`, type: 'delivery', icon: '🚚',
            title: '待配送', subtitle: `${dt.task_no}`,
            detail: `${dt.dpn_no || ''} · 送货上门\n${dt.recipient_name || ''} · ${dt.recipient_phone || ''}`,
            status: dt.task_status === 'IN_TRANSIT' ? '执行中' : '待接单', statusColor: dt.task_status === 'FAILED' ? colors.danger : colors.info,
            actions: [
              { label: '配送完成', color: colors.success, route: '/task/delivery', params: { taskId: dt.id, taskNo: dt.task_no, dpnNo: dt.dpn_no, recipientName: dt.recipient_name, recipientPhone: dt.recipient_phone, mode: 'sign' } },
              { label: '配送失败', color: colors.danger, route: '/task/delivery', params: { taskId: dt.id, taskNo: dt.task_no, dpnNo: dt.dpn_no, recipientName: dt.recipient_name, recipientPhone: dt.recipient_phone, mode: 'fail' } },
            ],
            borderColor: colors.taskDelivery,
          });
        }

        // 自提
        const pickups = await deliveryApi.getPickups();
        for (const p of (pickups.data || []).filter((p: any) => p.notify_status !== 'PICKED_UP')) {
          items.push({
            id: `pickup-${p.id}`, type: 'pickup', icon: '🏪',
            title: p.notify_status === 'PENDING' ? '待自提通知' : '待核销',
            subtitle: `${p.pickup_no} · ${p.pickup_station}`,
            detail: `${p.recipient_name || ''} · ${p.recipient_phone || ''}`,
            status: p.notify_status === 'PENDING' ? '待通知' : '已通知', statusColor: p.notify_status === 'PENDING' ? colors.warning : colors.success,
            actions: [
              ...(p.notify_status === 'PENDING' ? [{
                label: '通知', color: colors.primary, route: '/task/pickup',
                params: { pickupId: p.id, pickupNo: p.pickup_no, trackingNo: p.tracking_no, recipientName: p.recipient_name, recipientPhone: p.recipient_phone, pickupStation: p.pickup_station, notifyStatus: p.notify_status, mode: 'notify' },
              }] : []),
              {
                label: '核销自提', color: colors.success, route: '/task/pickup',
                params: { pickupId: p.id, pickupNo: p.pickup_no, trackingNo: p.tracking_no, recipientName: p.recipient_name, recipientPhone: p.recipient_phone, pickupStation: p.pickup_station, notifyStatus: p.notify_status, mode: 'verify' },
              },
            ],
            borderColor: colors.taskPickup,
          });
        }

        // 在途预告
        const inTransitJobs = await jobApi.list({ status: 'IN_TRANSIT' });
        for (const j of (inTransitJobs.data || []).slice(0, 3)) {
          const daysToEta = j.eta ? Math.ceil((new Date(j.eta).getTime() - Date.now()) / 86400000) : null;
          items.push({
            id: `preview-${j.id}`, type: 'preview', icon: '🚢',
            title: '即将到港', subtitle: `${j.job_no} · ${j.route_code || ''}`,
            detail: `${j.carrier_name || ''} · ${j.container_no || ''}\n${j.total_pieces}件/${j.total_weight_kg}kg`,
            status: daysToEta !== null ? `ETA ${daysToEta}天后` : '在途', statusColor: (daysToEta || 99) <= 5 ? colors.danger : colors.info,
            actions: [{ label: '查看详情', color: colors.textSecondary }],
            borderColor: colors.taskPreview,
          });
        }

      } else if (userRole === 'SALES') {
        const [myCustomersRes, allOrdersRes] = await Promise.all([
          customerApi.list({ poolType: 'PRIVATE' }),
          orderApi.list({}),
        ]);
        const myCustomers: any[] = myCustomersRes.data || [];
        const allOrders: any[] = allOrdersRes.data || [];

        // ── 任务1：未收款催收
        // 条件：订单已到达或已签收，但付款状态仍为 UNPAID / PARTIAL
        // 这才是销售真正需要行动的——货已到客户手里，钱还没收
        const urgentUnpaid = allOrders.filter((o: any) =>
          ['ARRIVED', 'DELIVERED'].includes(o.order_status) &&
          ['UNPAID', 'PARTIAL'].includes(o.payment_status)
        );
        for (const o of urgentUnpaid.slice(0, 10)) {
          const amt = Number(o.total_receivable_amount || o.actual_freight || o.estimated_freight || 0);
          const isArrived = o.order_status === 'ARRIVED';
          items.push({
            id: `sales-unpaid-${o.id}`, type: 'sales-unpaid', icon: '💰',
            title: '货到未收款',
            subtitle: `${o.order_no} · ${o.customer_name}`,
            detail: `应收 ¥${amt > 0 ? amt.toFixed(2) : '待确认'} · ${isArrived ? '已到达' : '已签收'} · ${o.payment_status === 'PARTIAL' ? '部分已付' : '未付款'}`,
            status: o.payment_status === 'PARTIAL' ? '部分已付' : '未付款',
            statusColor: colors.danger,
            actions: [{ label: '去催收', color: colors.danger, route: '/task/order-detail', params: { id: o.id } }],
            borderColor: colors.taskOrphan,
          });
        }

        // ── 任务2：新客户超 14 天未下单
        // 条件：客户注册超过 14 天，totalOrders === 0
        const now = Date.now();
        const DAYS_14 = 14 * 86400000;
        const newNoOrder = myCustomers.filter((c: any) => {
          if ((c.totalOrders || 0) > 0) return false;
          const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
          return created > 0 && (now - created) > DAYS_14;
        });
        for (const c of newNoOrder.slice(0, 10)) {
          const daysSince = c.createdAt
            ? Math.floor((now - new Date(c.createdAt).getTime()) / 86400000)
            : 0;
          items.push({
            id: `sales-noorder-${c.id}`, type: 'sales-customer', icon: '👤',
            title: '新客户未下单',
            subtitle: `${c.customerName || c.name} · ${c.customerCode || c.shortCode || ''}`,
            detail: `${c.country || '-'} · ${c.contactPhone || c.contact?.phone || '-'}`,
            status: `已${daysSince}天`,
            statusColor: daysSince > 30 ? colors.danger : colors.warning,
            actions: [{ label: '去跟进', color: colors.primary, route: '/task/customer-detail', params: { id: c.id } }],
            borderColor: colors.taskInbound,
          });
        }
        // ── 运输进度 preview（顶部横向滑动区，不是待办）
        const allJobsRes = await jobApi.list();
        for (const j of (allJobsRes.data || []).filter((j: any) => !['COMPLETED', 'CANCELLED'].includes(j.job_status)).slice(0, 5)) {
          const nodeLabel = j.current_node || j.job_status;
          items.push({
            id: `job-${j.id}`, type: 'preview', icon: '🚢',
            title: '运输进度', subtitle: `${j.job_no} · ${j.route_code || ''}`,
            detail: `${j.carrier_name || '-'} · ${j.container_no || '-'}\n当前: ${nodeLabel}`,
            status: j.etd ? `ETD ${j.etd.substring(5)}` : '', statusColor: colors.info,
            actions: [],
            borderColor: colors.taskPreview,
          });
        }
      }

      setTasks(items);
    } catch (err) {
      console.log('Load tasks error:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasks(role);
    setRefreshing(false);
  }, [role]);

  // 把运营预告(preview)从操作任务中分离出来
  const previewTasks = tasks.filter(t => t.type === 'preview');
  const actionTasks = tasks.filter(t => t.type !== 'preview');

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
    '无单': ['orphan'],
    '待收款': ['sales-unpaid'],
    '新客户': ['sales-customer'],
  };

  const filteredTasks = activeTab === '全部' ? actionTasks : actionTasks.filter(t => (tabTypeMap[activeTab] || []).includes(t.type));

  const previewLabel = role === 'WAREHOUSE_CN' ? '📅 发运计划' : role === 'WAREHOUSE_US' ? '🚢 到港预告' : '🚢 运输进度';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerName}>{userName}</Text>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(role) + '20' }]}>
              <Text style={[styles.roleText, { color: getRoleColor(role) }]}>{getRoleLabel(role)}</Text>
            </View>
          </View>
          {role.includes('WAREHOUSE') && (
            <View style={styles.printerBadge}>
              <Text style={styles.printerText}>🟢 打印机</Text>
            </View>
          )}
        </View>
      </View>

      {/* Preview Cards — 运营预告横向滑动 */}
      {previewTasks.length > 0 && (
        <View style={styles.previewSection}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{previewLabel} ({previewTasks.length})</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
            {previewTasks.map((task) => (
              <Pressable key={task.id} style={styles.previewCard}>
                <Text style={styles.previewCardTitle}>{task.subtitle}</Text>
                <Text style={styles.previewCardDetail} numberOfLines={2}>{task.detail}</Text>
                <Text style={[styles.previewCardEta, { color: task.statusColor }]}>{task.status}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {tabs.map((tab) => {
          const count = tab === '全部' ? actionTasks.length : (tabTypeMap[tab] ? actionTasks.filter(t => (tabTypeMap[tab] || []).includes(t.type)).length : 0);
          return (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab} {count > 0 && <Text style={styles.tabBadge}>{count}</Text>}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Task List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {filteredTasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>暂无待办任务</Text>
          </View>
        ) : (
          filteredTasks.map((task) => (
            <View key={task.id} style={[styles.card, { borderLeftColor: task.borderColor }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardIcon}>{task.icon}</Text>
                  <Text style={styles.cardTitle}>{task.title}</Text>
                </View>
                <Text style={[styles.cardStatus, { color: task.statusColor, backgroundColor: task.statusColor + '15' }]}>
                  {task.status}
                </Text>
              </View>

              <Text style={styles.cardSubtitle}>{task.subtitle}</Text>
              <Text style={styles.cardDetail}>{task.detail}</Text>

              {task.progress && (
                <View style={styles.progressRow}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min(100, (task.progress.current / task.progress.total) * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{Math.round((task.progress.current / task.progress.total) * 100)}%</Text>
                </View>
              )}

              <View style={styles.cardActions}>
                {task.actions.map((action, i) => (
                  <Pressable
                    key={i}
                    style={[styles.actionBtn, action.color === colors.primary && styles.actionBtnPrimary,
                      action.color === colors.success && styles.actionBtnSuccess,
                      action.color === colors.danger && styles.actionBtnDanger,
                      action.color === colors.warning && styles.actionBtnWarning]}
                    onPress={() => {
                      // 内联弹窗：调拨/无单
                      if (action.intent === 'transfer-dispatch' && task.rawTransfer) {
                        setTransferTarget(task.rawTransfer);
                        setTransferMode('dispatch');
                        return;
                      }
                      if (action.intent === 'transfer-arrive' && task.rawTransfer) {
                        setTransferTarget(task.rawTransfer);
                        setTransferMode('arrive');
                        return;
                      }
                      if (action.intent === 'transfer-receive' && task.rawTransfer) {
                        setTransferTarget(task.rawTransfer);
                        setTransferMode('receive');
                        return;
                      }
                      if (action.intent === 'unmatched-match' && task.rawUnmatched) {
                        setUnmatchedTarget(task.rawUnmatched);
                        return;
                      }
                      // 跳转路由
                      if (action.route) {
                        router.push({ pathname: action.route as any, params: action.params || {} });
                      }
                    }}
                  >
                    <Text style={[styles.actionBtnText, {
                      color: [colors.primary, colors.success, colors.danger, colors.warning].includes(action.color) ? '#fff' : action.color
                    }]}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* 内联弹窗：调拨执行/到达/入库 */}
      <TransferActionDialog
        visible={!!transferTarget && !!transferMode}
        target={transferTarget}
        mode={transferMode}
        onClose={() => { setTransferTarget(null); setTransferMode(null); }}
        onSuccess={() => {
          setTransferTarget(null);
          setTransferMode(null);
          loadTasks(role);
        }}
      />

      {/* 内联弹窗：无单快递匹配客户 */}
      <UnmatchedMatchDialog
        visible={!!unmatchedTarget}
        target={unmatchedTarget}
        onClose={() => setUnmatchedTarget(null)}
        onSuccess={() => {
          setUnmatchedTarget(null);
          loadTasks(role);
        }}
      />
    </SafeAreaView>
  );
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  headerName: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  roleBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: spacing.xs, alignSelf: 'flex-start' },
  roleText: { fontSize: font.xs, fontWeight: '600' },
  printerBadge: { backgroundColor: colors.successLight, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  printerText: { fontSize: font.xs, color: colors.success, fontWeight: '500' },
  // 快捷操作入口
  quickActions: { flexDirection: 'row', backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  quickAction: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, gap: 4 },
  quickActionIcon: { fontSize: 24 },
  quickActionLabel: { fontSize: font.xs, color: colors.text, fontWeight: '500' },
  // Preview section (运营预告横向滑动)
  previewSection: { backgroundColor: colors.card, paddingTop: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  previewTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  previewScroll: { paddingHorizontal: spacing.md, gap: spacing.sm },
  previewCard: { width: 180, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.taskPreview },
  previewCardTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text, fontFamily: font.mono, marginBottom: 4 },
  previewCardDetail: { fontSize: font.xs, color: colors.textSecondary, lineHeight: 16, marginBottom: 6 },
  previewCardEta: { fontSize: font.xs, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  statNum: { fontSize: font.xl, fontWeight: '700' },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  tabBar: { backgroundColor: colors.card, maxHeight: 44, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tabBarContent: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginRight: spacing.xs },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: font.sm, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  tabBadge: { fontSize: font.xs, color: colors.primary },
  list: { flex: 1 },
  listContent: { padding: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardIcon: { fontSize: 16 },
  cardTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  cardStatus: { fontSize: font.xs, fontWeight: '500', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  cardSubtitle: { fontSize: font.sm, color: colors.text, fontWeight: '500', fontFamily: font.mono, marginBottom: 4 },
  cardDetail: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  progressBar: { flex: 1, height: 6, backgroundColor: colors.borderLight, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { fontSize: font.xs, color: colors.primary, fontWeight: '600', width: 36, textAlign: 'right' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.bg },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnSuccess: { backgroundColor: colors.success },
  actionBtnDanger: { backgroundColor: colors.danger },
  actionBtnWarning: { backgroundColor: colors.warning },
  actionBtnText: { fontSize: font.sm, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: font.md, color: colors.textTertiary },
});
