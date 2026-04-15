import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { orderApi } from '../../lib/api';

interface OrderItem {
  id: string;
  order_no: string;
  warehouse_entry_no: string;
  business_line: string;
  customer_name: string;
  route_code: string;
  order_status: string;
  payment_status: string;
  total_declared_pieces: number;
  total_declared_weight_kg: number;
  consignee_name: string;
  consignee_phone: string;
  created_at: string;
  sub_order_count: number;
}

interface SubOrder {
  id: string;
  sub_order_no: string;
  sub_status: string;
  pieces: number;
  actual_weight_kg: number;
  container_no: string | null;
  job_id: string | null;
}

interface PackageItem {
  id: string;
  express_company: string;
  tracking_no: string;
  goods_name: string;
  pieces: number;
  declared_weight_kg: number;
}

interface RelatedJob {
  id: string;
  job_no: string;
  job_status: string;
  route_code?: string;
  container_no?: string;
  etd?: string;
  eta?: string;
}

interface RelatedDpn {
  id: string;
  dpn_no: string;
  dpn_status: string;
  from_site?: string;
  to_site?: string;
}

interface OrderDetail extends OrderItem {
  subOrders: SubOrder[];
  packages: PackageItem[];
  fees: any[];
  remark: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  relatedJobs?: RelatedJob[];
  relatedDpns?: RelatedDpn[];
}

const STATUS_FILTERS = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING_INBOUND', label: '待入库' },
  { value: 'INBOUND', label: '已入库' },
  { value: 'DEPARTED', label: '已发车' },
  { value: 'IN_TRANSIT', label: '运输中' },
  { value: 'ARRIVED', label: '已到达' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_INBOUND: { label: '待入库', color: colors.warning,        bg: colors.warningLight },
  INBOUND:         { label: '已入库', color: colors.success,        bg: colors.successLight },
  DEPARTED:        { label: '已发车', color: colors.info,           bg: colors.infoLight },
  IN_TRANSIT:      { label: '运输中', color: colors.primary,        bg: colors.primaryLight },
  ARRIVED:         { label: '已到达', color: colors.taskDelivery,   bg: '#fce7f3' },
  DELIVERED:       { label: '已签收', color: colors.textSecondary,  bg: colors.borderLight },
};

// 物流时间线节点（按规格 10 节点）
const TIMELINE_NODES = [
  { key: 'CREATED',         label: '已下单',   icon: 'document-text-outline' },
  { key: 'INBOUND',         label: '已入库',   icon: 'archive-outline' },
  { key: 'PACKED',          label: '已装箱',   icon: 'cube-outline' },
  { key: 'CUSTOMS_EXPORT',  label: '出口报关', icon: 'reader-outline' },
  { key: 'DEPARTED',        label: '已发车',   icon: 'car-outline' },
  { key: 'IN_TRANSIT',      label: '运输中',   icon: 'boat-outline' },
  { key: 'ARRIVED',         label: '已到港',   icon: 'flag-outline' },
  { key: 'CUSTOMS_IMPORT',  label: '清关中',   icon: 'shield-checkmark-outline' },
  { key: 'DELIVERING',      label: '派送中',   icon: 'bicycle-outline' },
  { key: 'DELIVERED',       label: '已签收',   icon: 'checkmark-circle-outline' },
];

function getProgressIndex(status: string): number {
  const order = ['PENDING_INBOUND', 'INBOUND', 'PACKED', 'CUSTOMS_EXPORT', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'CUSTOMS_IMPORT', 'DELIVERING', 'DELIVERED'];
  return order.indexOf(status);
}

interface OrderScreenProps {
  embedded?: boolean;
}

export default function OrderScreen({ embedded = false }: OrderScreenProps = {}) {
  const router = useRouter();
  const [list, setList] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await orderApi.list();
      setList(res.data || []);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await orderApi.get(id);
      setDetail(res.data);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return list.filter((o) => {
      if (status !== 'ALL' && o.order_status !== status) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        return (
          o.order_no?.toLowerCase().includes(k) ||
          o.warehouse_entry_no?.toLowerCase().includes(k) ||
          o.customer_name?.toLowerCase().includes(k) ||
          o.consignee_name?.toLowerCase().includes(k)
        );
      }
      return true;
    });
  }, [list, keyword, status]);

  const renderItem = ({ item }: { item: OrderItem }) => {
    const meta = STATUS_META[item.order_status] || { label: item.order_status, color: colors.textSecondary, bg: colors.borderLight };
    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item.id)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNo}>{item.order_no}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.customerLine} numberOfLines={1}>
          {item.customer_name} · {item.warehouse_entry_no}
        </Text>
        <View style={styles.routeRow}>
          <Ionicons name="navigate-outline" size={14} color={colors.primary} />
          <Text style={styles.routeText} numberOfLines={1}>{item.route_code}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            {item.total_declared_pieces}件 · {item.total_declared_weight_kg}kg · {item.sub_order_count}子单
          </Text>
          <Text style={styles.consigneeText} numberOfLines={1}>→ {item.consignee_name}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.navBar}>
        {embedded ? (
          <View style={styles.navBtn} />
        ) : (
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.navTitle}>订单查询</Text>
        <Text style={styles.navExtra}>{filtered.length} 单</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索运单号 / 入仓号 / 客户 / 收件人"
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

      {/* Filter */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatus(f.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无订单</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedId} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>订单详情</Text>
              <TouchableOpacity onPress={() => setSelectedId(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : detail ? (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
                {/* 基础信息 */}
                <View style={styles.heroCard}>
                  <Text style={styles.heroOrderNo}>{detail.order_no}</Text>
                  <Text style={styles.heroEntry}>入仓号：{detail.warehouse_entry_no}</Text>
                  <View style={styles.heroTags}>
                    {(() => {
                      const meta = STATUS_META[detail.order_status] || { label: detail.order_status, color: colors.textSecondary, bg: colors.borderLight };
                      return (
                        <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                      );
                    })()}
                    <View style={[styles.statusBadge, { backgroundColor: colors.warningLight }]}>
                      <Text style={[styles.statusText, { color: colors.warning }]}>
                        {detail.payment_status === 'PAID' ? '已付款' : '未付款'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                        {detail.business_line === 'SEA' ? '🚢 海运' : '✈️ 空运'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 物流时间线 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📍 物流轨迹</Text>
                  <View style={styles.timeline}>
                    {TIMELINE_NODES.map((node, idx) => {
                      const currentIdx = getProgressIndex(detail.order_status);
                      const passed = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <View key={node.key} style={styles.timelineRow}>
                          <View style={styles.timelineLeft}>
                            <View style={[
                              styles.timelineDot,
                              passed && styles.timelineDotActive,
                              isCurrent && styles.timelineDotCurrent,
                            ]}>
                              <Ionicons name={node.icon as any} size={14} color={passed ? '#fff' : colors.textTertiary} />
                            </View>
                            {idx < TIMELINE_NODES.length - 1 && (
                              <View style={[styles.timelineLine, passed && styles.timelineLineActive]} />
                            )}
                          </View>
                          <View style={styles.timelineRight}>
                            <Text style={[styles.timelineLabel, passed && { color: colors.text, fontWeight: '600' }]}>
                              {node.label}
                            </Text>
                            {isCurrent && <Text style={styles.timelineNote}>当前节点</Text>}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* 客户和收件人 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>👥 双方信息</Text>
                  <DetailRow label="客户" value={detail.customer_name} />
                  <DetailRow label="路线" value={detail.route_code} />
                  <DetailRow label="收件人" value={detail.consignee_name} />
                  <DetailRow label="收件电话" value={detail.consignee_phone} highlight />
                </View>

                {/* 子运单 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📦 子运单 ({detail.subOrders?.length || 0})</Text>
                  {(detail.subOrders || []).map((sub) => (
                    <View key={sub.id} style={styles.subCard}>
                      <View style={styles.subHeader}>
                        <Text style={styles.subNo}>{sub.sub_order_no}</Text>
                        <Text style={styles.subStatus}>{STATUS_META[sub.sub_status]?.label || sub.sub_status}</Text>
                      </View>
                      <Text style={styles.subInfo}>
                        {sub.pieces}件 · {sub.actual_weight_kg}kg
                        {sub.container_no ? ` · 柜号 ${sub.container_no}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* 包裹清单 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📋 包裹清单 ({detail.packages?.length || 0})</Text>
                  {(detail.packages || []).map((p) => (
                    <View key={p.id} style={styles.pkgRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pkgGoods}>{p.goods_name}</Text>
                        <Text style={styles.pkgTracking}>{p.express_company} · {p.tracking_no}</Text>
                      </View>
                      <Text style={styles.pkgWeight}>{p.declared_weight_kg}kg</Text>
                    </View>
                  ))}
                </View>

                {/* 关联任务 */}
                {((detail.relatedJobs?.length || 0) > 0 || (detail.relatedDpns?.length || 0) > 0) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔗 关联任务</Text>
                    {(detail.relatedJobs || []).map((j: any) => (
                      <TouchableOpacity
                        key={j.id}
                        style={styles.relCard}
                        onPress={() => {
                          setSelectedId(null);
                          router.push({
                            pathname: '/task/packing',
                            params: { jobId: j.id, mode: 'add-order' },
                          });
                        }}
                      >
                        <Ionicons name="cube-outline" size={18} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.relNo}>{j.job_no}</Text>
                          <Text style={styles.relSub}>
                            JOB · {j.job_status} · {j.route_code || '-'} {j.container_no ? `· ${j.container_no}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                    {(detail.relatedDpns || []).map((d: any) => (
                      <TouchableOpacity
                        key={d.id}
                        style={styles.relCard}
                        onPress={() => {
                          setSelectedId(null);
                          router.push({
                            pathname: '/task/dpn',
                            params: {
                              dpnId: d.id,
                              dpnNo: d.dpn_no,
                              dpnStatus: d.dpn_status,
                              fromSite: d.from_site,
                              toSite: d.to_site,
                            },
                          });
                        }}
                      >
                        <Ionicons name="document-text-outline" size={18} color={colors.taskDispatch} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.relNo}>{d.dpn_no}</Text>
                          <Text style={styles.relSub}>
                            DPN · {d.dpn_status} · {d.from_site || '-'} → {d.to_site || '-'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* 费用 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>💰 费用明细</Text>
                  {(detail.fees || []).length === 0 ? (
                    <Text style={styles.empty}>暂无费用记录</Text>
                  ) : (
                    detail.fees.map((f: any, i: number) => (
                      <DetailRow key={i} label={f.fee_name} value={`¥ ${f.amount}`} />
                    ))
                  )}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: colors.primary, fontWeight: '600' }]}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  // Nav
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  navExtra: { fontSize: font.sm, color: colors.textSecondary },
  // Search
  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },
  filterRow: { paddingVertical: spacing.md, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  // List
  listContent: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  orderNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary, flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  customerLine: { fontSize: font.sm, color: colors.text, marginBottom: 4 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  routeText: { flex: 1, fontSize: font.xs, color: colors.primary, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  footerText: { fontSize: font.xs, color: colors.textSecondary },
  consigneeText: { fontSize: font.xs, color: colors.textSecondary, maxWidth: '50%' },
  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  heroCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  heroOrderNo: { fontSize: font.lg, fontWeight: '700', color: colors.primary, fontFamily: font.mono },
  heroEntry: { fontSize: font.sm, color: colors.textSecondary, marginTop: 4 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  // Timeline
  timeline: { paddingLeft: spacing.sm },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineLeft: { alignItems: 'center', marginRight: spacing.md },
  timelineDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  timelineDotActive: { backgroundColor: colors.success },
  timelineDotCurrent: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 0 }, shadowRadius: 6 },
  timelineLine: { width: 2, height: 24, backgroundColor: colors.borderLight, marginVertical: 2 },
  timelineLineActive: { backgroundColor: colors.success },
  timelineRight: { flex: 1, paddingTop: 4, paddingBottom: spacing.md },
  timelineLabel: { fontSize: font.sm, color: colors.textTertiary },
  timelineNote: { fontSize: font.xs, color: colors.primary, marginTop: 2 },
  relCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, marginBottom: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.primary },
  relNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  relSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  // Detail rows
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary },
  detailValue: { fontSize: font.sm, color: colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  // Sub
  subCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '600', color: colors.primary },
  subStatus: { fontSize: font.xs, color: colors.textSecondary },
  subInfo: { fontSize: font.xs, color: colors.textSecondary },
  // Pkg
  pkgRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  pkgGoods: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
  pkgTracking: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  pkgWeight: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  empty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.md },
});
