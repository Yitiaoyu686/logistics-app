import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, RefreshControl, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font } from '../../lib/theme';
import { getRoleLabel, getRoleColor } from '../../lib/auth';
import { jobApi, orderApi, warehouseApi, deliveryApi, customerApi, salesApi } from '../../lib/api';

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
  actions: { label: string; color: string; route?: string; params?: Record<string, any> }[];
  borderColor: string;
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
  const [salesStats, setSalesStats] = useState<SalesStats>({ myCustomers: 0, pendingOrders: 0, unpaidOrders: 0, monthlyNew: 0 });

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
              { label: '执行出库', color: colors.warning, route: '/task/packing', params: { jobId: j.id, mode: 'execute-out' } },
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
        // 1. 加载销售统计
        const [myCustomersRes, allOrdersRes] = await Promise.all([
          customerApi.list({ poolType: 'PRIVATE' }),
          orderApi.list({}),
        ]);
        const myCustomers = (myCustomersRes.data || []).length;
        const pendingOrdersList = (allOrdersRes.data || []).filter((o: any) => o.order_status === 'PENDING_INBOUND');
        const unpaidOrdersList = (allOrdersRes.data || []).filter((o: any) => o.payment_status === 'UNPAID' || o.payment_status === 'PARTIAL');
        const now = new Date();
        const monthlyNew = (myCustomersRes.data || []).filter((c: any) => {
          if (!c.createdAt) return false;
          const d = new Date(c.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;
        setSalesStats({
          myCustomers,
          pendingOrders: pendingOrdersList.length,
          unpaidOrders: unpaidOrdersList.length,
          monthlyNew,
        });

        // 2. 待办任务卡片（5 项）
        items.push({
          id: 'todo-customer-followup', type: 'inbound', icon: '👥',
          title: '我的客户待跟进', subtitle: `${myCustomers} 个客户`,
          detail: '查看您负责的所有客户，点击拨打 / 短信跟进',
          status: `${myCustomers} 个`, statusColor: colors.primary,
          actions: [{ label: '去处理', color: colors.primary, route: '/task/customer' }],
          borderColor: colors.taskInbound,
        });

        if (pendingOrdersList.length > 0) {
          items.push({
            id: 'todo-pending-orders', type: 'inbound', icon: '📋',
            title: '未完成订单', subtitle: `${pendingOrdersList.length} 单待入库`,
            detail: '客户已下单但货物未到仓，跟进客户尽快发货',
            status: `${pendingOrdersList.length} 单`, statusColor: colors.warning,
            actions: [{ label: '去处理', color: colors.primary, route: '/task/order' }],
            borderColor: colors.taskInbound,
          });
        }

        if (unpaidOrdersList.length > 0) {
          items.push({
            id: 'todo-unpaid', type: 'inbound', icon: '💰',
            title: '待收款订单', subtitle: `${unpaidOrdersList.length} 单未结清`,
            detail: '订单已完成但客户尚未付款，建议提醒催收',
            status: `${unpaidOrdersList.length} 单`, statusColor: colors.danger,
            actions: [{ label: '去处理', color: colors.danger, route: '/task/order' }],
            borderColor: colors.taskOrphan,
          });
        }

        if (monthlyNew > 0) {
          items.push({
            id: 'todo-monthly-new', type: 'inbound', icon: '✨',
            title: '本月新增客户', subtitle: `本月新增 ${monthlyNew} 个`,
            detail: '关注新客户首单转化',
            status: `${monthlyNew} 个`, statusColor: colors.success,
            actions: [{ label: '去处理', color: colors.success, route: '/task/customer' }],
            borderColor: colors.taskInbound,
          });
        }

        // 3. 运输进度（preview 卡片）— 只显示自己客户的JOB
        const allJobs = await jobApi.list();
        const myCustomerNames = new Set((myCustomersRes.data || []).map((c: any) => c.customerName));
        const myOrderIds = new Set(
          (allOrdersRes.data || [])
            .filter((o: any) => myCustomerNames.has(o.customer_name))
            .map((o: any) => o.id)
        );
        // 简化：所有进行中 JOB 都算（实际应通过 job-order 关联表过滤）
        for (const j of (allJobs.data || []).filter((j: any) => !['COMPLETED', 'CANCELLED'].includes(j.job_status)).slice(0, 5)) {
          const nodeLabel = j.current_node || j.job_status;
          items.push({
            id: `job-${j.id}`, type: 'preview', icon: '🚢',
            title: '运输进度', subtitle: `${j.job_no} · ${j.route_code || ''}`,
            detail: `${j.carrier_name || '-'} · ${j.container_no || '-'}\n当前: ${nodeLabel}`,
            status: j.etd ? `ETD ${j.etd.substring(5)}` : '', statusColor: colors.info,
            actions: [
              { label: '详情', color: colors.primary, route: '/task/order' },
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

  // 把运营预告(preview)从操作任务中分离出来
  const previewTasks = tasks.filter(t => t.type === 'preview');
  const actionTasks = tasks.filter(t => t.type !== 'preview');

  const tabs = role === 'WAREHOUSE_CN'
    ? ['全部', '入库', '装箱', '调拨', '无单']
    : role === 'WAREHOUSE_US'
    ? ['全部', '入库', 'DPN', '配送', '自提']
    : ['全部'];

  const tabTypeMap: Record<string, string[]> = {
    '入库': ['inbound'], '装箱': ['packing', 'execute'], '调拨': ['transfer'],
    'DPN': ['dispatch'], '配送': ['delivery'], '自提': ['pickup'],
    '无单': ['orphan'],
  };

  const filteredTasks = activeTab === '全部' ? actionTasks : actionTasks.filter(t => (tabTypeMap[activeTab] || []).includes(t.type));

  const previewLabel = role === 'WAREHOUSE_CN' ? '📅 发运计划' : role === 'WAREHOUSE_US' ? '🚢 到港预告' : '🚢 运输进度';

  // Stats
  const statItems = role === 'WAREHOUSE_CN'
    ? [
        { label: '待入库', value: tasks.filter(t => t.type === 'inbound').length, color: colors.primary },
        { label: '待装箱', value: tasks.filter(t => t.type === 'packing').length, color: colors.success },
        { label: '调拨', value: tasks.filter(t => t.type === 'transfer').length, color: colors.info },
        { label: '发运计划', value: tasks.filter(t => t.type === 'preview').length, color: colors.taskPreview },
      ]
    : role === 'WAREHOUSE_US'
    ? [
        { label: '待入库', value: tasks.filter(t => t.type === 'inbound').length, color: colors.primary },
        { label: 'DPN', value: tasks.filter(t => t.type === 'dispatch').length, color: colors.info },
        { label: '配送', value: tasks.filter(t => t.type === 'delivery').length, color: colors.danger },
        { label: '到港预告', value: tasks.filter(t => t.type === 'preview').length, color: colors.taskPreview },
      ]
    : [
        { label: '我的客户', value: salesStats.myCustomers, color: colors.primary },
        { label: '未完成订单', value: salesStats.pendingOrders, color: colors.warning },
        { label: '待收款', value: salesStats.unpaidOrders, color: colors.danger },
        { label: '本月新增', value: salesStats.monthlyNew, color: colors.success },
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

      {/* Sales 快捷入口 */}
      {role === 'SALES' && (
        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/customer-create' as any)}>
            <Text style={styles.quickActionIcon}>➕</Text>
            <Text style={styles.quickActionLabel}>新建客户</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/order-create' as any)}>
            <Text style={styles.quickActionIcon}>📝</Text>
            <Text style={styles.quickActionLabel}>新建订单</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/quote' as any)}>
            <Text style={styles.quickActionIcon}>💰</Text>
            <Text style={styles.quickActionLabel}>运费试算</Text>
          </Pressable>
        </View>
      )}

      {/* WAREHOUSE_CN 快捷入口 */}
      {role === 'WAREHOUSE_CN' && (
        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/stock' as any)}>
            <Text style={styles.quickActionIcon}>📋</Text>
            <Text style={styles.quickActionLabel}>库存查询</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/inbound' as any)}>
            <Text style={styles.quickActionIcon}>📦</Text>
            <Text style={styles.quickActionLabel}>扫码入库</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/packing' as any)}>
            <Text style={styles.quickActionIcon}>🏗</Text>
            <Text style={styles.quickActionLabel}>装箱出库</Text>
          </Pressable>
        </View>
      )}

      {/* WAREHOUSE_US 快捷入口 */}
      {role === 'WAREHOUSE_US' && (
        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/dest-inbound' as any)}>
            <Text style={styles.quickActionIcon}>📥</Text>
            <Text style={styles.quickActionLabel}>任务入库</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/dpn' as any)}>
            <Text style={styles.quickActionIcon}>📄</Text>
            <Text style={styles.quickActionLabel}>DPN管理</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => router.push('/task/delivery' as any)}>
            <Text style={styles.quickActionIcon}>🚚</Text>
            <Text style={styles.quickActionLabel}>配送签收</Text>
          </Pressable>
        </View>
      )}

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
