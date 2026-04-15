import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, Modal, ScrollView, Alert, Linking,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { customerApi, orderApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type PoolType = 'PRIVATE' | 'PUBLIC';
type StatusFilter = 'ALL' | 'ACTIVE' | 'SLEEP' | 'FROZEN';

interface CustomerListItem {
  id: string;
  customerCode: string;
  customerName: string;
  customerType: string;
  country: string | null;
  industry: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  ownerUserId: string | null;
  poolType: PoolType;
  status: string;
  preferredTransport: string | null;
  preferredPayment: string | null;
  remark: string | null;
  orderCount: number;
}

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
  customer_code: string;
  customer_name: string;
  customer_type: string;
  country: string;
  industry: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  pool_type: PoolType;
  status: string;
  remark: string | null;
  preferred_transport: string | null;
  preferred_payment: string | null;
  owner_user_id: string | null;
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
  COMPANY_CN: '🏭 国内企业',
  COMPANY_OS: '🏢 海外企业',
  PERSONAL: '👤 个人客户',
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'ACTIVE', label: '活跃' },
  { value: 'SLEEP', label: '沉睡' },
  { value: 'FROZEN', label: '冻结' },
];

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_INBOUND: '待入库',
  INBOUND: '已入库',
  PACKED: '已装箱',
  DEPARTED: '已发车',
  IN_TRANSIT: '运输中',
  ARRIVED: '已到达',
  DELIVERED: '已签收',
};

interface CollapseSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapseSection({ title, defaultOpen = false, children }: CollapseSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.collapse}>
      <TouchableOpacity style={styles.collapseHeader} onPress={() => setOpen(!open)}>
        <Text style={styles.collapseTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      {open && <View style={styles.collapseBody}>{children}</View>}
    </View>
  );
}

interface DetailLineProps {
  label: string;
  value: string;
  highlight?: boolean;
}

function DetailLine({ label, value, highlight }: DetailLineProps) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: colors.primary, fontWeight: '600' }]}>
        {value || '-'}
      </Text>
    </View>
  );
}

interface CustomerScreenProps {
  embedded?: boolean;
}

export default function CustomerScreen({ embedded = false }: CustomerScreenProps = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<PoolType>('PRIVATE');
  const [list, setList] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailOrders, setDetailOrders] = useState<CustomerOrder[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setCurrentUserId(JSON.parse(u).id);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [tab]));

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerApi.list({ poolType: tab });
      setList(res.data || []);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    let result = list;
    if (statusFilter !== 'ALL') {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (keyword) {
      const k = keyword.toLowerCase();
      result = result.filter((c) =>
        c.customerName?.toLowerCase().includes(k) ||
        c.customerCode?.toLowerCase().includes(k) ||
        c.contactName?.toLowerCase().includes(k) ||
        c.contactPhone?.includes(k)
      );
    }
    return result;
  }, [list, keyword, statusFilter]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailOrders([]);
    setDetailLoading(true);
    try {
      const [detailRes, orderRes] = await Promise.all([
        customerApi.get(id),
        orderApi.list({}),
      ]);
      setDetail(detailRes.data);
      const allOrders = orderRes.data || [];
      setDetailOrders(allOrders.filter((o: any) => o.customer_id === id));
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('拨号失败'));
  };

  const handleClaim = async (item: CustomerListItem) => {
    Alert.alert('认领客户', `确认认领 "${item.customerName}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认认领',
        onPress: async () => {
          setActionLoading(true);
          try {
            await customerApi.claim(item.id, currentUserId || 'user-sales1');
            Alert.alert('认领成功', `${item.customerName} 已加入您的客户列表`);
            await load();
          } catch (err: any) {
            Alert.alert('认领失败', err.message || '请重试');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleRelease = async () => {
    if (!detail) return;
    Alert.alert('释放客户', `确认将 "${detail.customer_name}" 释放回公海池吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '释放',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            await customerApi.release(detail.id);
            Alert.alert('已释放');
            setSelectedId(null);
            await load();
          } catch (err: any) {
            Alert.alert('释放失败', err.message || '请重试');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const renderListItem = ({ item }: { item: CustomerListItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item.id)} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.customerName || '?')[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardHeader}>
          <Text style={styles.customerName} numberOfLines={1}>{item.customerName}</Text>
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>{item.customerCode}</Text>
          </View>
        </View>
        <View style={styles.contactRow}>
          <Text style={styles.contactName}>{item.contactName}</Text>
          <Text style={styles.contactDot}>·</Text>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleCall(item.contactPhone); }}>
            <Text style={styles.contactPhone}>📞 {item.contactPhone}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.typeText}>{TYPE_LABEL[item.customerType] || item.customerType}</Text>
          <Text style={styles.orderCount}>📦 订单 {item.orderCount || 0}</Text>
        </View>
      </View>
      {tab === 'PUBLIC' ? (
        <TouchableOpacity
          style={styles.claimBtn}
          onPress={(e) => { e.stopPropagation(); handleClaim(item); }}
          disabled={actionLoading}
        >
          <Text style={styles.claimBtnText}>认领</Text>
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        {embedded ? (
          <View style={styles.navBtn} />
        ) : (
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.navTitle}>客户中心</Text>
        <TouchableOpacity onPress={() => router.push('/task/customer-create' as any)} style={styles.navBtn}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab 切换：我的客户 / 公海池 */}
      <View style={styles.poolTabs}>
        <TouchableOpacity
          style={[styles.poolTab, tab === 'PRIVATE' && styles.poolTabActive]}
          onPress={() => setTab('PRIVATE')}
        >
          <Text style={[styles.poolTabText, tab === 'PRIVATE' && styles.poolTabTextActive]}>
            我的客户
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.poolTab, tab === 'PUBLIC' && styles.poolTabActive]}
          onPress={() => setTab('PUBLIC')}
        >
          <Text style={[styles.poolTabText, tab === 'PUBLIC' && styles.poolTabTextActive]}>
            公海池
          </Text>
        </TouchableOpacity>
      </View>

      {/* 搜索栏 */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索客户名 / 编号 / 联系人 / 电话"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => setKeyword('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 状态筛选 */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatusFilter(f.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 列表 */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{tab === 'PUBLIC' ? '公海池暂无客户' : '暂无客户'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderListItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      {/* 客户详情 Modal */}
      <Modal visible={!!selectedId} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>客户详情</Text>
              <TouchableOpacity onPress={() => setSelectedId(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : detail ? (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
                {/* Hero */}
                <View style={styles.detailHero}>
                  <View style={styles.detailAvatar}>
                    <Text style={styles.detailAvatarText}>{(detail.customer_name || '?')[0]}</Text>
                  </View>
                  <Text style={styles.detailName}>{detail.customer_name}</Text>
                  <Text style={styles.detailCode}>{detail.customer_code}</Text>
                  <View style={styles.detailTags}>
                    <View style={styles.tagPill}>
                      <Text style={styles.tagText}>{TYPE_LABEL[detail.customer_type] || detail.customer_type}</Text>
                    </View>
                    <View style={[styles.tagPill, { backgroundColor: colors.successLight }]}>
                      <Text style={[styles.tagText, { color: colors.success }]}>
                        {detail.status === 'ACTIVE' ? '✓ 活跃' : detail.status}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 快捷操作 */}
                <View style={styles.quickRow}>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => handleCall(detail.contact_phone)}>
                    <Ionicons name="call" size={20} color={colors.primary} />
                    <Text style={styles.quickText}>拨打</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => Alert.alert('短信', `准备发送给 ${detail.contact_phone}`)}>
                    <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
                    <Text style={styles.quickText}>短信</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => { setSelectedId(null); router.push({ pathname: '/task/order-create' as any, params: { customerId: detail.id, customerName: detail.customer_name } }); }}>
                    <Ionicons name="document-text" size={20} color={colors.primary} />
                    <Text style={styles.quickText}>下单</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => { setSelectedId(null); router.push('/task/quote' as any); }}>
                    <Ionicons name="calculator" size={20} color={colors.primary} />
                    <Text style={styles.quickText}>试算</Text>
                  </TouchableOpacity>
                </View>

                {/* 入仓号区块 — 客户专属入仓标识 */}
                <View style={styles.entrySection}>
                  <Text style={styles.entryLabel}>🏷️ 入仓号</Text>
                  <View style={styles.entryCard}>
                    <Text style={styles.entryCode}>{detail.customer_code}</Text>
                    <Text style={styles.entryHint}>
                      客户包裹填写此入仓号可自动关联订单
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    {['广州总仓', '深圳分仓', 'LOS 到达仓'].map((wh, i) => (
                      <View key={i} style={styles.entryChip}>
                        <Text style={styles.entryChipLabel}>{wh}</Text>
                        <Text style={styles.entryChipValue}>
                          {detail.customer_code}-{['GZ', 'SZ', 'LOS'][i]}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 折叠区：基本信息 */}
                <CollapseSection title="📋 基本信息" defaultOpen>
                  <DetailLine label="客户编号" value={detail.customer_code} />
                  <DetailLine label="客户名称" value={detail.customer_name} />
                  <DetailLine label="客户类型" value={TYPE_LABEL[detail.customer_type] || detail.customer_type} />
                  <DetailLine label="所在国家" value={detail.country} />
                  <DetailLine label="行业" value={detail.industry || '-'} />
                  <DetailLine label="状态" value={detail.status === 'ACTIVE' ? '活跃' : detail.status} />
                  <DetailLine label="池类型" value={detail.pool_type === 'PRIVATE' ? '我的客户' : '公海池'} />
                </CollapseSection>

                {/* 折叠区：联系人 */}
                <CollapseSection title="👤 联系人" defaultOpen>
                  <DetailLine label="联系人" value={detail.contact_name} />
                  <DetailLine label="电话" value={detail.contact_phone} highlight />
                  <DetailLine label="邮箱" value={detail.contact_email || '-'} />
                </CollapseSection>

                {/* 折叠区：发货人 */}
                <CollapseSection title={`📤 发货人 (${detail.senders?.length || 0})`}>
                  {(detail.senders || []).length === 0 ? (
                    <Text style={styles.empty}>暂无发货人信息</Text>
                  ) : (
                    detail.senders.map((s) => (
                      <View key={s.id} style={styles.addrCard}>
                        <Text style={styles.addrName}>{s.sender_name || '-'}</Text>
                        <Text style={styles.addrPhone}>📱 {s.sender_phone || '-'}</Text>
                        <Text style={styles.addrText}>📍 {s.sender_address || '-'}</Text>
                      </View>
                    ))
                  )}
                </CollapseSection>

                {/* 折叠区：收货人 */}
                <CollapseSection title={`📥 收货人 (${detail.recipients?.length || 0})`}>
                  {(detail.recipients || []).length === 0 ? (
                    <Text style={styles.empty}>暂无收货人</Text>
                  ) : (
                    detail.recipients.map((r) => (
                      <View key={r.id} style={styles.addrCard}>
                        <View style={styles.addrHeader}>
                          <Text style={styles.addrName}>{r.recipient_name}</Text>
                          {r.is_default === 1 && (
                            <View style={styles.defaultBadge}><Text style={styles.defaultText}>默认</Text></View>
                          )}
                        </View>
                        <Text style={styles.addrPhone}>📱 {r.recipient_phone}</Text>
                        <Text style={styles.addrText}>📍 {r.country} · {r.city}</Text>
                        <Text style={styles.addrText}>{r.detail_address}</Text>
                      </View>
                    ))
                  )}
                </CollapseSection>

                {/* 折叠区：物流偏好 */}
                <CollapseSection title="🚢 物流偏好">
                  <DetailLine label="运输方式" value={detail.preferred_transport || '未设置'} />
                  <DetailLine label="付款方式" value={detail.preferred_payment || '未设置'} />
                </CollapseSection>

                {/* 折叠区：客户订单 */}
                <CollapseSection title={`📦 客户订单 (${detailOrders.length})`}>
                  {detailOrders.length === 0 ? (
                    <Text style={styles.empty}>暂无订单</Text>
                  ) : (
                    detailOrders.map((o) => (
                      <View key={o.id} style={styles.orderCard}>
                        <View style={styles.orderHeader}>
                          <Text style={styles.orderNo}>{o.order_no}</Text>
                          <Text style={styles.orderStatus}>{ORDER_STATUS_LABEL[o.order_status] || o.order_status}</Text>
                        </View>
                        <Text style={styles.orderInfo}>
                          {o.total_declared_pieces}件 · {o.total_declared_weight_kg}kg · {o.created_at?.substring(0, 10)}
                        </Text>
                      </View>
                    ))
                  )}
                </CollapseSection>

                {/* 折叠区：备注 */}
                {detail.remark && (
                  <CollapseSection title="📝 备注">
                    <Text style={styles.remarkText}>{detail.remark}</Text>
                  </CollapseSection>
                )}

                {/* 操作按钮 */}
                {detail.pool_type === 'PRIVATE' && (
                  <TouchableOpacity
                    style={[styles.releaseBtn, actionLoading && styles.btnDisabled]}
                    onPress={handleRelease}
                    disabled={actionLoading}
                  >
                    <Text style={styles.releaseBtnText}>释放回公海池</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },

  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  // Pool 切换
  poolTabs: { flexDirection: 'row', backgroundColor: colors.card, paddingTop: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  poolTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  poolTabActive: { borderBottomColor: colors.primary },
  poolTabText: { fontSize: font.md, color: colors.textSecondary, fontWeight: '500' },
  poolTabTextActive: { color: colors.primary, fontWeight: '700' },

  // 搜索
  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  // 筛选
  filterRow: { paddingVertical: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // 列表
  listContent: { padding: spacing.md, gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.xl, fontWeight: '700', color: colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  customerName: { flex: 1, fontSize: font.md, fontWeight: '600', color: colors.text },
  codeBadge: { backgroundColor: colors.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  codeText: { fontSize: font.xs, fontFamily: font.mono, color: colors.textSecondary },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  contactName: { fontSize: font.sm, color: colors.text },
  contactDot: { fontSize: font.sm, color: colors.textTertiary },
  contactPhone: { fontSize: font.sm, color: colors.primary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeText: { fontSize: font.xs, color: colors.textSecondary },
  orderCount: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },
  claimBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md },
  claimBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },

  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  detailHero: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  entrySection: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  entryLabel: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  entryCard: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md },
  entryCode: { fontSize: font.xxl, fontWeight: '800', color: colors.primary, fontFamily: font.mono, letterSpacing: 2 },
  entryHint: { fontSize: font.xs, color: colors.textSecondary, marginTop: 4 },
  entryChip: { flex: 1, padding: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderLight },
  entryChipLabel: { fontSize: font.xs, color: colors.textSecondary },
  entryChipValue: { fontSize: font.xs, color: colors.primary, fontWeight: '700', fontFamily: font.mono, marginTop: 2 },
  detailAvatar: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  detailAvatarText: { fontSize: font.xxl, fontWeight: '700', color: colors.primary },
  detailName: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  detailCode: { fontSize: font.sm, fontFamily: font.mono, color: colors.textSecondary, marginTop: 2 },
  detailTags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  tagPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  tagText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },

  quickRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  quickBtn: { flex: 1, alignItems: 'center', gap: 4, padding: spacing.sm },
  quickText: { fontSize: font.xs, color: colors.text },

  // Collapse
  collapse: { backgroundColor: colors.card, borderRadius: radius.lg, marginBottom: spacing.md, overflow: 'hidden' },
  collapseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  collapseTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  collapseBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  detailLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary },
  detailValue: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
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

  remarkText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22 },

  releaseBtn: { height: 48, backgroundColor: colors.warningLight, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.warning, marginTop: spacing.md },
  releaseBtnText: { color: colors.warning, fontSize: font.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
