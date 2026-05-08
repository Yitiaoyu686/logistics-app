import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, RefreshControl, SafeAreaView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font, shadow } from '../../lib/theme';
import { getRoleLabel, getRoleColor } from '../../lib/auth';
import { jobApi, orderApi, warehouseApi, deliveryApi, customerApi, salesApi } from '../../lib/api';
import { TransferActionDialog, TransferActionMode, TransferTargetItem } from '../../components/TransferActionDialog';
import { UnmatchedMatchDialog, UnmatchedTargetItem } from '../../components/UnmatchedMatchDialog';

const CARD_WIDTH = Dimensions.get('window').width * 0.82;

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
  // 整卡可点击跳转（销售角色用）
  cardRoute?: string;
  cardParams?: Record<string, any>;
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
          // 用件数进度（total_pieces / 预估满载件数）；若无数据则显示重量
          const loadedPieces = j.total_pieces || 0;
          const loadedWeight = j.total_weight_kg || 0;
          // 海运集装箱满载约 500 件，空运约 200 件
          const estimatedMax = j.business_line === 'AIR' ? 200 : 500;
          items.push({
            id: `packing-${j.id}`, type: 'packing', icon: '🏗',
            title: '待添加订单', subtitle: `${j.job_no} · ${j.container_no || '未创建'}`,
            detail: `${j.route_code || ''} · ${j.container_type || ''} · ${j.service_type === 'EXPRESS' ? '特快' : '普快'}`,
            status: '装箱中', statusColor: colors.info,
            progress: { current: loadedPieces, total: estimatedMax },
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
          const isAir = j.business_line === 'AIR';
          const daysToEtd = j.etd ? Math.ceil((new Date(j.etd).getTime() - Date.now()) / 86400000) : null;
          items.push({
            id: `preview-${j.id}`, type: 'preview', icon: isAir ? '✈️' : '🚢',
            title: '即将发运', subtitle: `${j.origin_port || '-'} → ${j.dest_port || '-'}`,
            detail: [
              j.job_no,
              j.carrier_name || '-',
              j.container_no || (isAir ? '集装号待分配' : '箱号待分配'),
              j.container_type || '',
              String(j.total_pieces || 0),
              String(j.total_weight_kg || 0),
              j.etd || '',
              j.eta || '',
              j.service_type || '',
              j.business_line || 'SEA',
            ].join('|'),
            status: daysToEtd !== null ? `ETD ${daysToEtd}天后` : '', statusColor: (daysToEtd || 99) <= 3 ? colors.danger : colors.info,
            actions: [],
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
          const isAir = j.business_line === 'AIR';
          const daysToEta = j.eta ? Math.ceil((new Date(j.eta).getTime() - Date.now()) / 86400000) : null;
          items.push({
            id: `preview-${j.id}`, type: 'preview', icon: isAir ? '✈️' : '🚢',
            title: '即将到港', subtitle: `${j.origin_port || '-'} → ${j.dest_port || '-'}`,
            detail: [
              j.job_no,
              j.carrier_name || '-',
              j.container_no || (isAir ? '集装号待分配' : '箱号待分配'),
              j.container_type || '',
              String(j.total_pieces || 0),
              String(j.total_weight_kg || 0),
              j.etd || '',
              j.eta || '',
              j.service_type || '',
              j.business_line || 'SEA',
            ].join('|'),
            status: daysToEta !== null ? `ETA ${daysToEta}天后` : '在途', statusColor: (daysToEta || 99) <= 5 ? colors.danger : colors.info,
            actions: [],
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
            actions: [],
            borderColor: colors.taskOrphan,
            cardRoute: '/task/order-detail',
            cardParams: { id: o.id },
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
            actions: [],
            borderColor: colors.taskInbound,
            cardRoute: '/task/customer-detail',
            cardParams: { id: c.id },
          });
        }
        // ── 运输进度 preview（顶部横向滑动区，不是待办）
        const allJobsRes = await jobApi.list();
        // 销售只看未发运的批次（装箱中/出口报关），已发运的不需要关注
        const pendingJobs = (allJobsRes.data || []).filter((j: any) =>
          ['LOADING', 'CUSTOMS_EXPORT'].includes(j.job_status)
        ).slice(0, 8);
        for (const j of pendingJobs) {
          const isAir = j.business_line === 'AIR';
          const statusLabelMap: Record<string, string> = {
            LOADING: isAir ? '集货中' : '装箱中',
            CUSTOMS_EXPORT: '出口报关',
            DEPARTED: '已发运',
            IN_TRANSIT: '运输中',
            CLEARED: '清关中',
            ARRIVED: '已到达',
          };
          items.push({
            id: `job-${j.id}`, type: 'preview', icon: isAir ? '✈️' : '🚢',
            title: '运输进度',
            subtitle: `${j.origin_port || '-'} → ${j.dest_port || '-'}`,
            detail: [
              j.job_no,
              j.carrier_name || '-',
              j.container_no || (isAir ? '集装号待分配' : '箱号待分配'),
              j.container_type || '',
              String(j.total_pieces || 0),
              String(j.total_weight_kg || 0),
              j.etd || '',
              j.eta || '',
              j.service_type || '',
              j.business_line || 'SEA',
            ].join('|'),
            status: statusLabelMap[j.job_status] || j.job_status,
            statusColor: j.job_status === 'ARRIVED' ? colors.success : j.job_status === 'IN_TRANSIT' || j.job_status === 'DEPARTED' ? colors.primary : colors.warning,
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
      {/* Header — 深色品牌区 */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreeting}>喵喵国际物流</Text>
            <Text style={styles.headerName}>{userName}</Text>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(role) + '30' }]}>
              <Text style={[styles.roleText, { color: '#fff' }]}>{getRoleLabel(role)}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
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
        {/* 今日任务数量摘要 */}
        <View style={styles.headerStats}>
          <View style={styles.headerStatItem}>
            <Text style={styles.headerStatNum}>{actionTasks.length}</Text>
            <Text style={styles.headerStatLabel}>待办任务</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStatItem}>
            <Text style={styles.headerStatNum}>{previewTasks.length}</Text>
            <Text style={styles.headerStatLabel}>{role === 'WAREHOUSE_US' ? '到港预告' : role === 'SALES' ? '运输批次' : '发运计划'}</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStatItem}>
            <Text style={[styles.headerStatNum, { color: '#FF6B35' }]}>
              {actionTasks.filter(t => t.statusColor === colors.danger || t.statusColor === colors.warning).length}
            </Text>
            <Text style={styles.headerStatLabel}>需关注</Text>
          </View>
        </View>
      </View>

      {/* Preview Cards */}
      {previewTasks.length > 0 && (
        <View style={styles.previewSection}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>{previewLabel} ({previewTasks.length})</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
            {previewTasks.map((task) => {
              const parts = task.detail.split('|');
              const [jobNo, carrier, containerNo, containerType, pieces, weight, etd, eta, serviceType, bizLine] = parts;
              const isAir = bizLine === 'AIR';
              const isExpress = serviceType === 'EXPRESS';
              const etdShort = etd ? etd.substring(5).replace('-', '/') : '-';
              const etaShort = eta ? eta.substring(5).replace('-', '/') : '-';
              return (
                <Pressable key={task.id} style={styles.previewBigCard}>
                  {/* 顶部：路线大字 + 状态 */}
                  <View style={styles.previewBigTop}>
                    <View style={styles.previewRouteWrap}>
                      <Text style={styles.previewRouteIcon}>{task.icon}</Text>
                      <Text style={styles.previewRouteText}>{task.subtitle}</Text>
                      {isExpress && (
                        <View style={styles.previewExpressBadge}>
                          <Text style={styles.previewExpressText}>特快</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.previewBigBadge, { backgroundColor: task.statusColor + '18' }]}>
                      <Text style={[styles.previewBigBadgeText, { color: task.statusColor }]}>{task.status}</Text>
                    </View>
                  </View>
                  {/* ETD / ETA */}
                  <View style={styles.previewDateRow}>
                    <View style={styles.previewDateItem}>
                      <Text style={styles.previewDateLabel}>ETD</Text>
                      <Text style={styles.previewDateValue}>{etdShort}</Text>
                    </View>
                    <View style={styles.previewDateArrow}>
                      <Text style={styles.previewDateArrowText}>→</Text>
                    </View>
                    <View style={styles.previewDateItem}>
                      <Text style={styles.previewDateLabel}>ETA</Text>
                      <Text style={styles.previewDateValue}>{etaShort}</Text>
                    </View>
                  </View>
                  {/* 底部：承运商 / 箱号 / 件重 */}
                  <View style={styles.previewBigMeta}>
                    <Text style={styles.previewBigMetaText}>{carrier}</Text>
                    <Text style={styles.previewBigMetaDot}>·</Text>
                    <Text style={styles.previewBigMetaText} numberOfLines={1}>{isAir ? containerNo : `${containerNo} ${containerType}`}</Text>
                    <Text style={styles.previewBigMetaDot}>·</Text>
                    <Text style={styles.previewBigMetaText}>{pieces}件 {weight}kg</Text>
                  </View>
                  <Text style={styles.previewBigJobNo}>{jobNo}</Text>
                </Pressable>
              );
            })}
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
            <View style={styles.emptyIconWrap}>
              <Ionicons name="checkmark-circle-outline" size={52} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyText}>暂无待办任务</Text>
            <Text style={styles.emptySubText}>所有任务已处理完毕 🎉</Text>
          </View>
        ) : (
          filteredTasks.map((task) => {
            const primaryAction = task.actions[0] || null;
            const secondaryActions = task.actions.slice(1);

            const handleAction = (action: typeof primaryAction) => {
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

            const cardContent = (
              <View style={[styles.card, task.cardRoute && styles.cardClickable]}>
                <View style={styles.cardBody}>
                  {/* 左侧：信息区 */}
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      <View style={[styles.cardIconWrap, { backgroundColor: task.borderColor + '18' }]}>
                        <Text style={styles.cardIcon}>{task.icon}</Text>
                      </View>
                      <Text style={styles.cardTitle}>{task.title}</Text>
                      <Text style={[styles.cardStatus, { color: task.statusColor, backgroundColor: task.statusColor + '15' }]}>
                        {task.status}
                      </Text>
                    </View>
                    <Text style={styles.cardSubtitle}>{task.subtitle}</Text>
                    <Text style={styles.cardDetail}>{task.detail}</Text>
                    {task.progress && (
                      <View style={styles.progressRow}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${Math.min(100, task.progress.total > 0 ? (task.progress.current / task.progress.total) * 100 : 0)}%`, backgroundColor: task.borderColor }]} />
                        </View>
                        <Text style={[styles.progressText, { color: task.borderColor }]}>
                          {task.progress.current > 0 ? `${task.progress.current}件` : '空箱'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* 右侧：主操作按钮，垂直居中 */}
                  {primaryAction && (
                    <Pressable
                      style={[styles.cardActionBtn, {
                        backgroundColor: primaryAction.color === colors.textSecondary
                          ? colors.bg
                          : primaryAction.color,
                      }]}
                      onPress={() => handleAction(primaryAction)}
                    >
                      <Text style={[styles.cardActionBtnText, {
                        color: primaryAction.color === colors.textSecondary
                          ? colors.textSecondary
                          : '#fff',
                      }]}>{primaryAction.label}</Text>
                    </Pressable>
                  )}
                </View>

                {/* 次要操作：底部小字链接 */}
                {secondaryActions.length > 0 && (
                  <View style={styles.cardSecondaryRow}>
                    {secondaryActions.map((action, i) => (
                      <Pressable key={i} onPress={() => handleAction(action)}>
                        <Text style={[styles.cardSecondaryText, { color: action.color === colors.textSecondary ? colors.textSecondary : colors.primary }]}>
                          {action.label}
                        </Text>
                      </Pressable>
                    ))}
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

  // ── Header 深色品牌区
  header: {
    backgroundColor: colors.headerStart,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  headerLeft: { flex: 1 },
  headerGreeting: { fontSize: font.xs, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 4 },
  headerName: { fontSize: font.xl, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, alignSelf: 'flex-start' },
  roleText: { fontSize: font.xs, fontWeight: '600' },
  headerRight: { alignItems: 'flex-end', gap: spacing.sm },
  printerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.2)', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full,
  },
  printerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  printerText: { fontSize: font.xs, color: colors.success, fontWeight: '600' },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { fontSize: font.md, fontWeight: '700', color: '#fff' },
  // 今日统计
  headerStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  headerStatItem: { flex: 1, alignItems: 'center' },
  headerStatNum: { fontSize: font.xl, fontWeight: '800', color: '#fff' },
  headerStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },

  // ── Preview section
  previewSection: { backgroundColor: colors.card, paddingTop: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  previewTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  previewScroll: { paddingHorizontal: spacing.md, paddingRight: spacing.xl, gap: spacing.sm },
  previewListWrap: { paddingHorizontal: spacing.md, gap: spacing.sm },
  previewBigCard: { width: CARD_WIDTH, backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  previewBigTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  previewRouteWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  previewRouteIcon: { fontSize: 20 },
  previewRouteText: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  previewExpressBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  previewExpressText: { fontSize: font.xs, color: colors.warning, fontWeight: '700' },
  previewBigBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  previewBigBadgeText: { fontSize: font.xs, fontWeight: '600' },
  previewDateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  previewDateItem: { flex: 1, alignItems: 'center' },
  previewDateLabel: { fontSize: font.xs, color: colors.textTertiary, marginBottom: 2 },
  previewDateValue: { fontSize: font.lg, fontWeight: '700', color: colors.text, fontFamily: font.mono },
  previewDateArrow: { paddingHorizontal: spacing.md },
  previewDateArrowText: { fontSize: font.lg, color: colors.textTertiary },
  previewBigMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  previewBigMetaText: { fontSize: font.xs, color: colors.textSecondary },
  previewBigMetaDot: { fontSize: font.xs, color: colors.textTertiary },
  previewBigJobNo: { fontSize: font.xs, color: colors.textTertiary, fontFamily: font.mono },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  statNum: { fontSize: font.xl, fontWeight: '700' },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  // ── Filter Tabs
  tabBar: { backgroundColor: colors.card, maxHeight: 44, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tabBarContent: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginRight: spacing.xs },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { fontSize: font.sm, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  tabBadge: { fontSize: font.xs, color: colors.primary },

  // ── Task List
  list: { flex: 1 },
  listContent: { padding: spacing.sm, paddingHorizontal: spacing.md },

  // ── Task Card（左信息 + 右操作）
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardClickable: { opacity: 0.95 },
  cardBody: { flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1, marginRight: spacing.md },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardIconWrap: { width: 24, height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 13 },
  cardTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  cardStatus: { fontSize: 10, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  cardSubtitle: { fontSize: font.xs, color: colors.text, fontWeight: '500', fontFamily: font.mono, marginBottom: 2 },
  cardDetail: { fontSize: font.xs, color: colors.textSecondary, lineHeight: 17 },
  // 右侧主操作按钮
  cardActionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionBtnText: { fontSize: font.xs, fontWeight: '700' },
  // 次要操作行
  cardSecondaryRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderLight,
  },
  cardSecondaryText: { fontSize: font.xs, fontWeight: '500' },

  // ── Progress Bar
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: spacing.sm },
  progressBar: { flex: 1, height: 4, backgroundColor: colors.borderLight, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.primary },
  progressText: { fontSize: font.xs, fontWeight: '600', width: 36, textAlign: 'right', color: colors.textSecondary },

  // ── Empty State
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyText: { fontSize: font.md, color: colors.textSecondary, fontWeight: '600' },
  emptySubText: { fontSize: font.sm, color: colors.textTertiary, marginTop: spacing.xs },

  // legacy (unused but kept to avoid errors)
  quickActions: { flexDirection: 'row' },
  quickAction: { flex: 1 },
  quickActionIcon: { fontSize: 24 },
  quickActionLabel: { fontSize: font.xs },
});
