import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font } from '../../lib/theme';
import { getRoleLabel, getRoleColor } from '../../lib/auth';
import { jobApi, orderApi, warehouseApi, deliveryApi } from '../../lib/api';

interface TaskItem {
  id: string;
  type: 'inbound' | 'packing' | 'execute' | 'transfer' | 'orphan' | 'dispatch' | 'delivery' | 'pickup' | 'preview';
  icon: string;
  title: string;
  subtitle: string;
  detail: string;
  status: string;
  statusColor: string;
  time?: string;
  progress?: { current: number; total: number };
  actions: { label: string; color: string; onPress?: () => void }[];
  borderColor: string;
}

export default function TasksScreen() {
  const [role, setRole] = useState('');
  const [userName, setUserName] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('全部');

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) {
        const user = JSON.parse(u);
        setRole(user.role);
        setUserName(user.realName);
        loadTasks(user.role);
      }
    });
  }, []);

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
            actions: [{ label: '扫码入库', color: colors.primary }],
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
              { label: '添加订单', color: colors.success },
              { label: '详情', color: colors.textSecondary },
            ],
            borderColor: colors.taskPacking,
          });
        }

        // 调拨
        const transfers = await warehouseApi.getTransfers();
        for (const t of (transfers.data || []).filter((t: any) => t.transfer_status !== 'CANCELLED')) {
          const statusMap: Record<string, string> = { PENDING: '待发运', IN_TRANSIT: '运输中', ARRIVED: '已到达', RECEIVED: '已签收' };
          const actionMap: Record<string, string[]> = { PENDING: ['绑运单', '执行'], IN_TRANSIT: ['确认到达'], ARRIVED: ['确认入库'] };
          items.push({
            id: `transfer-${t.id}`, type: 'transfer', icon: '📋',
            title: `调拨${statusMap[t.transfer_status] || t.transfer_status}`,
            subtitle: t.transfer_no,
            detail: `${t.from_warehouse_name || ''} → ${t.to_warehouse_name || ''} · ${t.total_pieces}件/${t.total_weight_kg}kg`,
            status: statusMap[t.transfer_status] || t.transfer_status, statusColor: t.transfer_status === 'PENDING' ? colors.warning : colors.info,
            actions: [
              { label: '详情', color: colors.textSecondary },
              ...(actionMap[t.transfer_status] || []).map(a => ({ label: a, color: colors.primary })),
            ],
            borderColor: colors.taskTransfer,
          });
        }

        // 无单快递
        const unmatched = await warehouseApi.getUnmatched();
        for (const u of (unmatched.data || []).filter((u: any) => u.status === 'PENDING')) {
          items.push({
            id: `orphan-${u.id}`, type: 'orphan', icon: '❓',
            title: '无单快递', subtitle: `${u.tracking_no} · ${u.express_company}`,
            detail: `发件人: ${u.sender_name || '-'} ${u.sender_phone || ''}\n${u.pieces}件 · ${u.gross_weight_kg}kg`,
            status: '待匹配', statusColor: colors.warning,
            time: formatTime(u.created_at),
            actions: [
              { label: '详情', color: colors.textSecondary },
              { label: '匹配', color: colors.warning },
            ],
            borderColor: colors.taskOrphan,
          });
        }

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
              { label: '入库', color: colors.primary },
              { label: '清单', color: colors.textSecondary },
            ],
            borderColor: colors.taskInbound,
          });
        }

        // DPN
        const dpns = await deliveryApi.getDpns();
        for (const d of (dpns.data || []).filter((d: any) => !['SIGNED', 'CANCELLED'].includes(d.dpn_status)).slice(0, 5)) {
          const statusMap: Record<string, string> = { DRAFT: '草稿', PENDING_BIND: '待绑定', PENDING_DISPATCH: '待发运', IN_TRANSIT: '运输中', ARRIVED: '已到达' };
          const actionMap: Record<string, string[]> = { PENDING_BIND: ['绑定运单'], PENDING_DISPATCH: ['执行发车'], IN_TRANSIT: ['查看'] };
          items.push({
            id: `dpn-${d.id}`, type: 'dispatch', icon: '📄',
            title: `DPN${statusMap[d.dpn_status] || d.dpn_status}`,
            subtitle: d.dpn_no,
            detail: `${d.from_site || ''} → ${d.to_site || ''}\n运单 ${d.total_orders} · 件数 ${d.total_pieces}`,
            status: statusMap[d.dpn_status] || d.dpn_status, statusColor: colors.info,
            actions: [
              ...(actionMap[d.dpn_status] || []).map(a => ({ label: a, color: colors.primary })),
              { label: '打印', color: colors.textSecondary },
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
              { label: '配送完成', color: colors.success },
              { label: '配送失败', color: colors.danger },
              { label: '转自提', color: colors.textSecondary },
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
              ...(p.notify_status === 'PENDING' ? [{ label: '通知', color: colors.primary }] : []),
              { label: '核销自提', color: colors.success },
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
        // 待处理订单
        const pendingOrders = await orderApi.list({ status: 'PENDING_INBOUND' });
        for (const o of (pendingOrders.data || []).slice(0, 3)) {
          items.push({
            id: `order-pending-${o.id}`, type: 'inbound', icon: '📋',
            title: '未完成订单', subtitle: o.order_no,
            detail: `${o.customer_name} · ${o.total_declared_pieces || 0}件 · ${o.route_code || ''}`,
            status: '待入库', statusColor: colors.warning,
            actions: [{ label: '查看详情', color: colors.primary }],
            borderColor: colors.taskInbound,
          });
        }

        // 运输进度
        const allJobs = await jobApi.list();
        for (const j of (allJobs.data || []).filter((j: any) => !['COMPLETED', 'CANCELLED'].includes(j.job_status)).slice(0, 5)) {
          const nodeLabel = j.current_node || j.job_status;
          items.push({
            id: `job-${j.id}`, type: 'preview', icon: '🚢',
            title: '运输进度', subtitle: `${j.job_no} · ${j.route_code || ''}`,
            detail: `${j.carrier_name || '-'} · ${j.container_no || '-'}\n当前: ${nodeLabel}`,
            status: j.etd ? `ETD ${j.etd.substring(5)}` : '', statusColor: colors.info,
            actions: [
              { label: '详情', color: colors.primary },
              { label: '分享', color: colors.textSecondary },
            ],
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

  const tabs = role === 'WAREHOUSE_CN'
    ? ['全部', '入库', '装箱', '调拨', '其他']
    : role === 'WAREHOUSE_US'
    ? ['全部', '入库', 'DPN', '配送', '自提', '在途']
    : ['全部', '订单', '运输'];

  const tabTypeMap: Record<string, string[]> = {
    '入库': ['inbound'], '装箱': ['packing', 'execute'], '调拨': ['transfer'],
    'DPN': ['dispatch'], '配送': ['delivery'], '自提': ['pickup'], '在途': ['preview'],
    '订单': ['inbound'], '运输': ['preview'],
    '其他': ['orphan', 'preview'],
  };

  const filteredTasks = activeTab === '全部' ? tasks : tasks.filter(t => (tabTypeMap[activeTab] || []).includes(t.type));

  // Stats
  const statItems = role === 'WAREHOUSE_CN'
    ? [
        { label: '待入库', value: tasks.filter(t => t.type === 'inbound').length, color: colors.primary },
        { label: '待装箱', value: tasks.filter(t => t.type === 'packing').length, color: colors.success },
        { label: '调拨', value: tasks.filter(t => t.type === 'transfer').length, color: colors.info },
        { label: '无单', value: tasks.filter(t => t.type === 'orphan').length, color: colors.warning },
      ]
    : role === 'WAREHOUSE_US'
    ? [
        { label: '待入库', value: tasks.filter(t => t.type === 'inbound').length, color: colors.primary },
        { label: 'DPN', value: tasks.filter(t => t.type === 'dispatch').length, color: colors.info },
        { label: '配送', value: tasks.filter(t => t.type === 'delivery').length, color: colors.danger },
        { label: '自提', value: tasks.filter(t => t.type === 'pickup').length, color: colors.success },
      ]
    : [
        { label: '订单', value: tasks.filter(t => t.type === 'inbound').length, color: colors.primary },
        { label: '运输', value: tasks.filter(t => t.type === 'preview').length, color: colors.info },
      ];

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

        {/* Stats */}
        <View style={styles.statsRow}>
          {statItems.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {tabs.map((tab) => {
          const count = tab === '全部' ? tasks.length : (tabTypeMap[tab] ? tasks.filter(t => (tabTypeMap[tab] || []).includes(t.type)).length : 0);
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab} {count > 0 && <Text style={styles.tabBadge}>{count}</Text>}
              </Text>
            </TouchableOpacity>
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
                  <TouchableOpacity
                    key={i}
                    style={[styles.actionBtn, action.color === colors.primary && styles.actionBtnPrimary,
                      action.color === colors.success && styles.actionBtnSuccess,
                      action.color === colors.danger && styles.actionBtnDanger,
                      action.color === colors.warning && styles.actionBtnWarning]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionBtnText, {
                      color: [colors.primary, colors.success, colors.danger, colors.warning].includes(action.color) ? '#fff' : action.color
                    }]}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
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
