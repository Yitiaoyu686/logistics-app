import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  ActivityIndicator, ScrollView, Alert, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { customerApi, orderApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface RecipientAddress {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  country: string;
  city: string;
  detail_address: string;
  is_default: number;
}

interface SenderProfile {
  id: string;
  sender_name?: string;
  sender_phone?: string;
  sender_address?: string;
}

interface CustomerDetail {
  id: string;
  customerCode: string;
  customerName: string;
  customerType: string;
  country: string;
  industry: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  poolType: string;
  status: string;
  remark: string | null;
  preferredTransport: string | null;
  preferredPayment: string | null;
  ownerUserId: string | null;
  recipients: RecipientAddress[];
  senders: SenderProfile[];
}

interface CustomerOrder {
  id: string;
  order_no: string;
  order_status: string;
  total_declared_pieces: number;
  total_declared_weight_kg: number;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  COMPANY_CN: '国内企业',
  COMPANY_OS: '海外企业',
  PERSONAL: '个人客户',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_INBOUND: '待入库', INBOUND: '已入库', PACKED: '已装箱',
  DEPARTED: '已发车', IN_TRANSIT: '运输中', ARRIVED: '已到达', DELIVERED: '已签收',
};

type EntryStatus = '待使用' | '已关联' | '已入库' | '已失效';

interface WarehouseEntry {
  id: string;
  entryNo: string;
  status: EntryStatus;
  warehouse: string;
  orderId?: string;
  orderNo?: string;
  createdAt: string;
  usedAt?: string;
}

const ENTRY_STATUS_META: Record<EntryStatus, { color: string; bg: string }> = {
  '待使用': { color: colors.primary, bg: colors.primaryLight },
  '已关联': { color: colors.info, bg: colors.infoLight },
  '已入库': { color: colors.success, bg: colors.successLight },
  '已失效': { color: colors.textTertiary, bg: colors.borderLight },
};

const WAREHOUSE_LIST = ['广州总仓', '深圳分仓', 'LOS 到达仓'];

function generateEntryNo(shortCode: string, existingEntries: WarehouseEntry[]): string {
  const maxSeq = existingEntries.reduce((max, e) => {
    const seqStr = e.entryNo.slice(shortCode.length);
    const n = parseInt(seqStr, 10);
    return isNaN(n) ? max : Math.max(n, max);
  }, 0);
  const next = maxSeq + 1;
  const digits = next > 999 ? 4 : 3;
  return `${shortCode}${String(next).padStart(digits, '0')}`;
}

type TabKey = 'overview' | 'info' | 'address' | 'orders';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'info', label: '信息' },
  { key: 'address', label: '地址' },
  { key: 'orders', label: '订单' },
];

function DetailLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: colors.primary, fontWeight: '600' }]}>{value || '-'}</Text>
    </View>
  );
}

export default function CustomerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [entries, setEntries] = useState<WarehouseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const [detailRes, orderRes] = await Promise.all([
        customerApi.get(id),
        orderApi.list({}),
      ]);
      setDetail(detailRes.data);
      const allOrders = orderRes.data || [];
      setOrders(allOrders.filter((o: any) => o.customer_id === id));
      // 初始化入仓号 (Mock: 每个仓库生成3-5个)
      const code = detailRes.data.customerCode || 'XX';
      const mockEntries: WarehouseEntry[] = [];
      const customerOrders = allOrders.filter((o: any) => o.customer_id === id);
      WAREHOUSE_LIST.forEach((wh) => {
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 1; i <= count; i++) {
          const entryNo = `${code}${String(i).padStart(3, '0')}`;
          const linkedOrder = customerOrders.find((o: any) => o.warehouse_entry_no === entryNo);
          mockEntries.push({
            id: `${wh}-${i}`,
            entryNo,
            status: linkedOrder ? '已关联' : i === 1 ? '已入库' : '待使用',
            warehouse: wh,
            orderId: linkedOrder?.id,
            orderNo: linkedOrder?.order_no,
            createdAt: new Date(Date.now() - (count - i) * 86400000).toISOString(),
            usedAt: linkedOrder ? new Date().toISOString() : undefined,
          });
        }
      });
      setEntries(mockEntries);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      Alert.alert('加载失败', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEntry = (warehouse: string) => {
    if (!detail) return;
    const whEntries = entries.filter((e) => e.warehouse === warehouse);
    const entryNo = generateEntryNo(detail.customerCode, entries);
    const newEntry: WarehouseEntry = {
      id: `${warehouse}-${Date.now()}`,
      entryNo,
      status: '待使用',
      warehouse,
      createdAt: new Date().toISOString(),
    };
    setEntries((prev) => [...prev, newEntry]);
    Alert.alert('已生成', `入仓号 ${entryNo} 已生成\n仓库：${warehouse}`);
  };

  const handleInvalidateEntry = (entry: WarehouseEntry) => {
    Alert.alert('作废入仓号', `确认作废 ${entry.entryNo} 吗？\n作废后该入仓号将不可使用。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '作废', style: 'destructive',
        onPress: () => {
          setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, status: '已失效' as EntryStatus } : e));
          Alert.alert('已作废', `${entry.entryNo} 已标记为失效`);
        },
      },
    ]);
  };

  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('拨号失败'));
  };

  const handleRelease = async () => {
    if (!detail) return;
    Alert.alert('释放客户', `确认将 "${detail.customerName}" 释放回公海池吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '释放', style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await customerApi.release(detail.id);
            Alert.alert('已释放');
            safeBack(router);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '请重试';
            Alert.alert('释放失败', msg);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleStatusChange = (newStatus: string) => {
    if (!detail) return;
    const labels: Record<string, string> = { ACTIVE: '激活', SLEEP: '设为沉睡', FROZEN: '冻结' };
    Alert.alert(
      '变更客户状态',
      `确认将 "${detail.customerName}" 状态改为「${labels[newStatus] || newStatus}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: () => {
            setDetail({ ...detail, status: newStatus });
            Alert.alert('状态已更新', `客户"${detail.customerName}" → ${labels[newStatus] || newStatus}`);
          },
        },
      ],
    );
  };

  const renderOverview = (d: CustomerDetail) => {
    const availableEntries = entries.filter((e) => e.status === '待使用');
    const usedEntries = entries.filter((e) => e.status === '已关联' || e.status === '已入库');
    return (
      <>
        {/* 入仓号概览卡片 */}
        <View style={styles.entrySection}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryLabel}>入仓号管理</Text>
            <View style={styles.entrySummary}>
              <View style={styles.entryStat}>
                <Text style={[styles.entryStatVal, { color: colors.primary }]}>{availableEntries.length}</Text>
                <Text style={styles.entryStatLabel}>待使用</Text>
              </View>
              <View style={styles.entryStat}>
                <Text style={[styles.entryStatVal, { color: colors.success }]}>{usedEntries.length}</Text>
                <Text style={styles.entryStatLabel}>已使用</Text>
              </View>
            </View>
          </View>
          <Text style={styles.entryHint}>客户包裹填写任一「待使用」入仓号，仓库收货后自动关联订单</Text>
        </View>

        {/* 按仓库列出入仓号 */}
        {WAREHOUSE_LIST.map((wh) => {
          const whEntries = entries.filter((e) => e.warehouse === wh);
          const whAvailable = whEntries.filter((e) => e.status === '待使用');
          return (
            <View key={wh} style={styles.whSection}>
              <View style={styles.whHeader}>
                <Ionicons name="business-outline" size={16} color={colors.primary} />
                <Text style={styles.whTitle}>{wh}</Text>
                <View style={styles.whBadge}>
                  <Text style={styles.whBadgeText}>{whAvailable.length} 个待使用</Text>
                </View>
                <TouchableOpacity style={styles.genBtn} onPress={() => handleGenerateEntry(wh)}>
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.genBtnText}>生成</Text>
                </TouchableOpacity>
              </View>
              {whEntries.length === 0 ? (
                <Text style={styles.whEmpty}>暂无入仓号，点击"生成"创建</Text>
              ) : (
                whEntries.map((e) => {
                  const meta = ENTRY_STATUS_META[e.status];
                  return (
                    <View key={e.id} style={styles.entryRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.entryNoText, e.status === '已失效' && styles.entryNoInvalid]}>
                          {e.entryNo}
                        </Text>
                        {e.orderNo && (
                          <Text style={styles.entryOrderNo}>关联：{e.orderNo}</Text>
                        )}
                        <Text style={styles.entryTime}>
                          {e.createdAt?.substring(0, 10)}
                          {e.usedAt && ` · 使用于 ${e.usedAt.substring(0, 10)}`}
                        </Text>
                      </View>
                      <View style={[styles.entryStatusBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.entryStatusText, { color: meta.color }]}>{e.status}</Text>
                      </View>
                      {e.status === '待使用' && (
                        <TouchableOpacity style={styles.invalidateBtn} onPress={() => handleInvalidateEntry(e)}>
                          <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          );
        })}
      </>
    );
  };

  const renderInfo = (d: CustomerDetail) => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <DetailLine label="客户编号" value={d.customerCode} />
        <DetailLine label="客户名称" value={d.customerName} />
        <DetailLine label="客户类型" value={TYPE_LABEL[d.customerType] || d.customerType} />
        <DetailLine label="所在国家" value={d.country} />
        <DetailLine label="行业" value={d.industry || '-'} />
        <DetailLine label="状态" value={d.status === 'ACTIVE' ? '活跃' : d.status} />
        <DetailLine label="池类型" value={d.poolType === 'PRIVATE' ? '我的客户' : '公海池'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>联系人</Text>
        <DetailLine label="联系人" value={d.contactName} />
        <DetailLine label="电话" value={d.contactPhone} highlight />
        <DetailLine label="邮箱" value={d.contactEmail || '-'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>物流偏好</Text>
        <DetailLine label="运输方式" value={d.preferredTransport || '未设置'} />
        <DetailLine label="付款方式" value={d.preferredPayment || '未设置'} />
      </View>

      {d.remark && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>备注</Text>
          <Text style={styles.remarkText}>{d.remark}</Text>
        </View>
      )}
    </>
  );

  const renderAddress = (d: CustomerDetail) => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>发货人 ({d.senders?.length || 0})</Text>
        {(d.senders || []).length === 0 ? (
          <Text style={styles.empty}>暂无发货人信息</Text>
        ) : (
          d.senders.map((s) => (
            <View key={s.id} style={styles.addrCard}>
              <Text style={styles.addrName}>{s.sender_name || '-'}</Text>
              <Text style={styles.addrPhone}>{s.sender_phone || '-'}</Text>
              <Text style={styles.addrText}>{s.sender_address || '-'}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>收货人 ({d.recipients?.length || 0})</Text>
        {(d.recipients || []).length === 0 ? (
          <Text style={styles.empty}>暂无收货人</Text>
        ) : (
          d.recipients.map((r) => (
            <View key={r.id} style={styles.addrCard}>
              <View style={styles.addrHeader}>
                <Text style={styles.addrName}>{r.recipient_name}</Text>
                {r.is_default === 1 && (
                  <View style={styles.defaultBadge}><Text style={styles.defaultText}>默认</Text></View>
                )}
              </View>
              <Text style={styles.addrPhone}>{r.recipient_phone}</Text>
              <Text style={styles.addrText}>{r.country} · {r.city}</Text>
              <Text style={styles.addrText}>{r.detail_address}</Text>
            </View>
          ))
        )}
      </View>
    </>
  );

  const renderOrders = (d: CustomerDetail) => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>客户订单 ({orders.length})</Text>
        {orders.length === 0 ? (
          <Text style={styles.empty}>暂无订单</Text>
        ) : (
          orders.map((o) => (
            <TouchableOpacity
              key={o.id}
              style={styles.orderCard}
              onPress={() => router.push({ pathname: '/task/order-detail' as any, params: { id: o.id } })}
            >
              <View style={styles.orderHeader}>
                <Text style={styles.orderNo}>{o.order_no}</Text>
                <Text style={styles.orderStatus}>{ORDER_STATUS_LABEL[o.order_status] || o.order_status}</Text>
              </View>
              <Text style={styles.orderInfo}>
                {o.total_declared_pieces}件 · {o.total_declared_weight_kg}kg · {o.created_at?.substring(0, 10)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* 状态变更 */}
      {d.status === 'ACTIVE' ? (
        <View style={styles.statusActionRow}>
          <TouchableOpacity style={[styles.statusBtn, { borderColor: colors.warning, backgroundColor: colors.warningLight }]} onPress={() => handleStatusChange('SLEEP')}>
            <Ionicons name="moon-outline" size={16} color={colors.warning} />
            <Text style={[styles.statusBtnText, { color: colors.warning }]}>设为沉睡</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { borderColor: colors.danger, backgroundColor: colors.dangerLight }]} onPress={() => handleStatusChange('FROZEN')}>
            <Ionicons name="snow-outline" size={16} color={colors.danger} />
            <Text style={[styles.statusBtnText, { color: colors.danger }]}>冻结客户</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.statusBtnFull, { borderColor: colors.success, backgroundColor: colors.successLight }]} onPress={() => handleStatusChange('ACTIVE')}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
          <Text style={[styles.statusBtnText, { color: colors.success }]}>恢复活跃</Text>
        </TouchableOpacity>
      )}
      {d.poolType === 'PRIVATE' && (
        <TouchableOpacity
          style={[styles.releaseBtn, actionLoading && styles.btnDisabled]}
          onPress={handleRelease}
          disabled={actionLoading}
        >
          <Text style={styles.releaseBtnText}>释放回公海池</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <View style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>客户详情</Text>
        <View style={styles.navBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : !detail ? (
        <View style={styles.center}><Text style={styles.emptyText}>加载失败</Text></View>
      ) : (
        <>
          {/* Hero - always visible */}
          <View style={styles.detailHero}>
            <View style={styles.detailAvatar}>
              <Text style={styles.detailAvatarText}>{(detail.customerName || '?')[0]}</Text>
            </View>
            <Text style={styles.detailName}>{detail.customerName}</Text>
            <Text style={styles.detailCode}>{detail.customerCode}</Text>
            <View style={styles.detailTags}>
              <View style={styles.tagPill}>
                <Text style={styles.tagText}>{TYPE_LABEL[detail.customerType] || detail.customerType}</Text>
              </View>
              <View style={[styles.tagPill, { backgroundColor: colors.successLight }]}>
                <Text style={[styles.tagText, { color: colors.success }]}>
                  {detail.status === 'ACTIVE' ? '活跃' : detail.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick actions - always visible */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => handleCall(detail.contactPhone)}>
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={styles.quickText}>拨打</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => Alert.alert('短信', `准备发送给 ${detail.contactPhone}`)}>
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
              <Text style={styles.quickText}>短信</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push({ pathname: '/task/order-create' as any, params: { customerId: detail.id, customerName: detail.customerName } })}>
              <Ionicons name="document-text" size={20} color={colors.primary} />
              <Text style={styles.quickText}>下单</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/task/quote' as any)}>
              <Ionicons name="calculator" size={20} color={colors.primary} />
              <Text style={styles.quickText}>试算</Text>
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={styles.tabRow}>
            {TABS.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Tab content */}
          <ScrollView contentContainerStyle={styles.content}>
            {activeTab === 'overview' && renderOverview(detail)}
            {activeTab === 'info' && renderInfo(detail)}
            {activeTab === 'address' && renderAddress(detail)}
            {activeTab === 'orders' && renderOrders(detail)}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 40 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: '600', color: colors.text },
  content: { padding: spacing.md, paddingBottom: 40 },

  detailHero: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginHorizontal: spacing.md, marginTop: spacing.md },
  detailAvatar: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  detailAvatarText: { fontSize: font.xl, fontWeight: '700', color: colors.primary },
  detailName: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  detailCode: { fontSize: font.sm, fontFamily: font.mono, color: colors.textSecondary, marginTop: 2 },
  detailTags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  tagPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  tagText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },

  quickRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.sm, gap: spacing.sm },
  quickBtn: { flex: 1, alignItems: 'center', gap: 4, padding: spacing.sm },
  quickText: { fontSize: font.xs, color: colors.text },

  tabRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4, marginHorizontal: spacing.md, marginTop: spacing.sm, gap: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontSize: font.xs, color: colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },

  entrySection: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.primary, marginBottom: spacing.md },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  entryLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
  entrySummary: { flexDirection: 'row', gap: spacing.lg },
  entryStat: { alignItems: 'center' },
  entryStatVal: { fontSize: font.xl, fontWeight: '800' },
  entryStatLabel: { fontSize: 10, color: colors.textTertiary },
  entryHint: { fontSize: font.xs, color: colors.textSecondary },
  // 仓库区块
  whSection: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  whHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  whTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, flex: 1 },
  whBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  whBadgeText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },
  whEmpty: { fontSize: font.xs, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.md },
  genBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary },
  genBtnText: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },
  // 入仓号行
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight, gap: spacing.sm },
  entryNoText: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  entryNoInvalid: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  entryOrderNo: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  entryTime: { fontSize: font.xs, color: colors.textTertiary, marginTop: 1 },
  entryStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  entryStatusText: { fontSize: font.xs, fontWeight: '600' },
  invalidateBtn: { padding: 4 },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary },
  detailValue: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
  remarkText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22 },
  empty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.md },
  addrCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  addrHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  addrName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  defaultBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  defaultText: { fontSize: font.xs, color: colors.warning, fontWeight: '600' },
  addrPhone: { fontSize: font.sm, color: colors.primary, marginBottom: 2 },
  addrText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
  orderCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  orderNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '600', color: colors.primary },
  orderStatus: { fontSize: font.xs, color: colors.textSecondary },
  orderInfo: { fontSize: font.xs, color: colors.textSecondary },
  releaseBtn: { height: 48, backgroundColor: colors.warningLight, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.warning, marginTop: spacing.md },
  releaseBtnText: { color: colors.warning, fontSize: font.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
  statusActionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statusBtn: { flex: 1, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1 },
  statusBtnFull: { height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, marginTop: spacing.md },
  statusBtnText: { fontSize: font.sm, fontWeight: '600' },
});
