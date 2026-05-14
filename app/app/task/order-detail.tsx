import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { orderApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface SubOrder {
  id: string;
  sub_order_no: string;
  sub_status: string;
  pieces: number;
  actual_weight_kg: number;
  container_no: string | null;
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
}

interface RelatedDpn {
  id: string;
  dpn_no: string;
  dpn_status: string;
  from_site?: string;
  to_site?: string;
}

interface OrderDetail {
  id: string;
  order_no: string;
  warehouse_entry_no: string;
  business_line: string;
  customer_name: string;
  customer_code: string | null;
  route_code: string;
  order_status: string;
  payment_status: string;
  total_declared_pieces: number;
  total_declared_weight_kg: number;
  consignee_name: string;
  consignee_phone: string;
  consignee_email: string | null;
  consignee_address: string | null;
  consignee_country: string | null;
  consignee_city: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  sender_address: string | null;
  service_type: string | null;
  payment_method: string | null;
  estimated_freight: number | null;
  actual_freight: number | null;
  remark: string | null;
  created_at: string;
  subOrders: SubOrder[];
  packages: PackageItem[];
  fees: any[];
  relatedJobs?: RelatedJob[];
  relatedDpns?: RelatedDpn[];
}

const SERVICE_TYPE_LABEL: Record<string, string> = {
  EXPRESS: '特快', STANDARD: '普快', ECONOMY: '经济',
};
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PREPAID: '预付', COD: '到付', MONTHLY: '月结',
};
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_INBOUND: { label: '待入库', color: colors.warning,       bg: colors.warningLight },
  INBOUND:         { label: '已入库', color: colors.success,       bg: colors.successLight },
  DEPARTED:        { label: '已发车', color: colors.info,          bg: colors.infoLight },
  IN_TRANSIT:      { label: '运输中', color: colors.primary,       bg: colors.primaryLight },
  ARRIVED:         { label: '已到达', color: colors.taskDelivery,  bg: '#fce7f3' },
  DELIVERED:       { label: '已签收', color: colors.textSecondary, bg: colors.borderLight },
};
const TIMELINE_NODES = [
  { key: 'CREATED',        label: '已下单',   icon: 'document-text-outline' },
  { key: 'INBOUND',        label: '已入库',   icon: 'archive-outline' },
  { key: 'PACKED',         label: '已装箱',   icon: 'cube-outline' },
  { key: 'CUSTOMS_EXPORT', label: '出口报关', icon: 'reader-outline' },
  { key: 'DEPARTED',       label: '已发车',   icon: 'car-outline' },
  { key: 'IN_TRANSIT',     label: '运输中',   icon: 'boat-outline' },
  { key: 'ARRIVED',        label: '已到港',   icon: 'flag-outline' },
  { key: 'CUSTOMS_IMPORT', label: '清关中',   icon: 'shield-checkmark-outline' },
  { key: 'DELIVERING',     label: '派送中',   icon: 'bicycle-outline' },
  { key: 'DELIVERED',      label: '已签收',   icon: 'checkmark-circle-outline' },
];

type TabKey = 'overview' | 'info' | 'cargo' | 'fees';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'info', label: '信息' },
  { key: 'cargo', label: '货物' },
  { key: 'fees', label: '费用' },
];

function getProgressIndex(status: string): number {
  const order = ['PENDING_INBOUND', 'INBOUND', 'PACKED', 'CUSTOMS_EXPORT', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'CUSTOMS_IMPORT', 'DELIVERING', 'DELIVERED'];
  return order.indexOf(status);
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: colors.primary, fontWeight: '600' }]}>{value || '-'}</Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await orderApi.get(id);
      setDetail(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      Alert.alert('加载失败', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = (d: OrderDetail) => {
    const currentIdx = getProgressIndex(d.order_status);
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>物流轨迹</Text>
        <View style={styles.timeline}>
          {TIMELINE_NODES.map((node, idx) => {
            const passed = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <View key={node.key} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, passed && styles.timelineDotActive, isCurrent && styles.timelineDotCurrent]}>
                    <Ionicons name={node.icon as any} size={14} color={passed ? '#fff' : colors.textTertiary} />
                  </View>
                  {idx < TIMELINE_NODES.length - 1 && (
                    <View style={[styles.timelineLine, passed && styles.timelineLineActive]} />
                  )}
                </View>
                <View style={styles.timelineRight}>
                  <Text style={[styles.timelineLabel, passed && { color: colors.text, fontWeight: '600' }]}>{node.label}</Text>
                  {isCurrent && <Text style={styles.timelineNote}>当前节点</Text>}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderInfo = (d: OrderDetail) => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        <DetailRow label="客户" value={d.customer_name} />
        <DetailRow label="客户编号" value={d.customer_code || '-'} />
        <DetailRow label="下单时间" value={d.created_at?.slice(0, 16) || '-'} />
        <DetailRow label="运输方式" value={d.business_line === 'SEA' ? '海运' : '空运'} />
        <DetailRow label="首选线路" value={d.route_code} />
        <DetailRow label="服务类型" value={SERVICE_TYPE_LABEL[d.service_type || ''] || d.service_type || '-'} />
        <DetailRow label="付款方式" value={PAYMENT_METHOD_LABEL[d.payment_method || ''] || d.payment_method || '-'} />
        <DetailRow label="总件数" value={`${d.total_declared_pieces || 0} 件`} />
        <DetailRow label="总重量" value={`${Number(d.total_declared_weight_kg || 0).toFixed(1)} kg`} />
        {d.remark && <DetailRow label="备注" value={d.remark} />}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>发货人</Text>
        <DetailRow label="姓名" value={d.sender_name || '-'} />
        <DetailRow label="电话" value={d.sender_phone || '-'} highlight />
        <DetailRow label="地址" value={d.sender_address || '-'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>收货人</Text>
        <DetailRow label="姓名" value={d.consignee_name || '-'} />
        <DetailRow label="电话" value={d.consignee_phone || '-'} highlight />
        {d.consignee_email && <DetailRow label="邮箱" value={d.consignee_email} />}
        <DetailRow label="国家 / 城市" value={[d.consignee_country, d.consignee_city].filter(Boolean).join(' · ') || '-'} />
        <DetailRow label="地址" value={d.consignee_address || '-'} />
      </View>
    </>
  );

  const renderCargo = (d: OrderDetail) => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>子运单 ({d.subOrders?.length || 0})</Text>
        {(d.subOrders || []).map((sub) => (
          <View key={sub.id} style={styles.subCard}>
            <View style={styles.subHeader}>
              <Text style={styles.subNo}>{sub.sub_order_no}</Text>
              <Text style={styles.subStatus}>{STATUS_META[sub.sub_status]?.label || sub.sub_status}</Text>
            </View>
            <Text style={styles.subInfo}>
              {sub.pieces}件 · {sub.actual_weight_kg}kg{sub.container_no ? ` · 柜号 ${sub.container_no}` : ''}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>包裹清单 ({d.packages?.length || 0})</Text>
        {(d.packages || []).map((p) => (
          <View key={p.id} style={styles.pkgRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pkgGoods}>{p.goods_name}</Text>
              <Text style={styles.pkgTracking}>{p.express_company} · {p.tracking_no}</Text>
            </View>
            <Text style={styles.pkgWeight}>{p.declared_weight_kg}kg</Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderFees = (d: OrderDetail) => (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>运费</Text>
        <DetailRow label="预估运费" value={d.estimated_freight ? `¥ ${Number(d.estimated_freight).toFixed(2)}` : '-'} />
        <DetailRow label="实际运费" value={d.actual_freight ? `¥ ${Number(d.actual_freight).toFixed(2)}` : '待入库称重后生成'} highlight={!!d.actual_freight} />
        <DetailRow label="付款状态" value={d.payment_status === 'PAID' ? '已付款' : '未付款'} />
        {d.payment_status !== 'PAID' && Number(d.actual_freight) > 0 && (
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => Alert.alert('登记收款', `订单 ${d.order_no}\n待收款：¥${Number(d.actual_freight).toFixed(2)}`, [
              { text: '取消', style: 'cancel' },
              { text: '上传凭证', onPress: () => Alert.alert('提示', '请在 Web 端登记收款并上传凭证') },
              { text: '提醒客户', onPress: () => Alert.alert('发送成功', '已通过短信/微信提醒客户支付') },
            ])}
          >
            <Ionicons name="card-outline" size={18} color="#fff" />
            <Text style={styles.payBtnText}>登记收款 ¥{Number(d.actual_freight).toFixed(2)}</Text>
          </TouchableOpacity>
        )}
        {d.payment_status !== 'PAID' && !d.actual_freight && (
          <View style={styles.payHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.info} />
            <Text style={styles.payHintText}>入库称重完成后自动生成实际运费，即可支付</Text>
          </View>
        )}
        {(d.fees || []).length > 0 && (
          <>
            <Text style={[styles.detailLabel, { marginTop: spacing.md, marginBottom: 4 }]}>其他费用</Text>
            {d.fees.map((f: any, i: number) => (
              <DetailRow key={i} label={f.fee_name || f.fee_item_code || '其他'} value={`¥ ${Number(f.amount || 0).toFixed(2)}`} />
            ))}
          </>
        )}
      </View>

      {((d.relatedJobs?.length || 0) > 0 || (d.relatedDpns?.length || 0) > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关联任务</Text>
          {(d.relatedJobs || []).map((j) => (
            <TouchableOpacity
              key={j.id}
              style={styles.relCard}
              onPress={() => router.push({ pathname: '/task/packing', params: { jobId: j.id, mode: 'add-order' } })}
            >
              <Ionicons name="cube-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.relNo}>{j.job_no}</Text>
                <Text style={styles.relSub}>JOB · {j.job_status} · {j.route_code || '-'} {j.container_no ? `· ${j.container_no}` : ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
          {(d.relatedDpns || []).map((dpn) => (
            <TouchableOpacity
              key={dpn.id}
              style={styles.relCard}
              onPress={() => router.push({ pathname: '/task/dpn', params: { dpnId: dpn.id, dpnNo: dpn.dpn_no, dpnStatus: dpn.dpn_status, fromSite: dpn.from_site, toSite: dpn.to_site } })}
            >
              <Ionicons name="document-text-outline" size={18} color={colors.taskDispatch} />
              <View style={{ flex: 1 }}>
                <Text style={styles.relNo}>{dpn.dpn_no}</Text>
                <Text style={styles.relSub}>DPN · {dpn.dpn_status} · {dpn.from_site || '-'} → {dpn.to_site || '-'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>订单详情</Text>
        <View style={styles.navBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : !detail ? (
        <View style={styles.center}><Text style={styles.emptyText}>加载失败</Text></View>
      ) : (
        <>
          {/* Hero - always visible */}
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
                  {detail.business_line === 'SEA' ? '海运' : '空运'}
                </Text>
              </View>
            </View>
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
            {activeTab === 'cargo' && renderCargo(detail)}
            {activeTab === 'fees' && renderFees(detail)}
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

  heroCard: { backgroundColor: colors.card, padding: spacing.lg, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.lg },
  heroOrderNo: { fontSize: font.lg, fontWeight: '700', color: colors.primary, fontFamily: font.mono },
  heroEntry: { fontSize: font.sm, color: colors.textSecondary, marginTop: 4 },
  heroTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },

  tabRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4, marginHorizontal: spacing.md, marginTop: spacing.md, gap: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontSize: font.xs, color: colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
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
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary },
  detailValue: { fontSize: font.sm, color: colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  subCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '600', color: colors.primary },
  subStatus: { fontSize: font.xs, color: colors.textSecondary },
  subInfo: { fontSize: font.xs, color: colors.textSecondary },
  pkgRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  pkgGoods: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
  pkgTracking: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  pkgWeight: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  relCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, marginBottom: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.primary },
  relNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  relSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.md },
  payBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
  payHint: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.infoLight, padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm },
  payHintText: { flex: 1, fontSize: font.xs, color: colors.info },
});
