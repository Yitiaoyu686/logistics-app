import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, Modal,
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
  created_at?: string;
  updated_at?: string;
  etd?: string;
  eta?: string;
  actual_departure?: string;
  actual_arrival?: string;
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

interface TrackingNode {
  nodeCode: string;
  nodeName: string;
  statusCode: string;
  eventTime: string;
}

interface TrackingSite {
  siteCode: string;
  siteName: string;
  nodes: TrackingNode[];
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
  packages: any[];
  fees: any[];
  relatedJobs?: RelatedJob[];
  relatedDpns?: RelatedDpn[];
  trackingBySubOrder?: Record<string, TrackingSite[]>;
  jobBindingBySubOrder?: Record<string, any[]>;
  dpnBySubOrder?: Record<string, any[]>;
  deliveryTaskBySubOrder?: Record<string, any[]>;
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
type TabKey = 'overview' | 'info' | 'fees';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'info', label: '信息' },
  { key: 'fees', label: '费用' },
];

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

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${M}/${D} ${h}:${m}`;
  };

  const STATUS_ORDER = ['PENDING_INBOUND', 'INBOUND', 'PACKED', 'CUSTOMS_EXPORT', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'CUSTOMS_IMPORT', 'DELIVERING', 'DELIVERED'];

  const renderOverview = (d: OrderDetail) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>子运单 ({(d.subOrders || []).length})</Text>
      {(d.subOrders || []).length === 0 ? (
        <Text style={styles.emptyHint}>暂无子运单</Text>
      ) : (
        (d.subOrders || []).map((sub) => {
          const subMeta = STATUS_META[sub.sub_status] || { label: sub.sub_status, color: colors.textSecondary, bg: colors.borderLight };
          const currentIdx = STATUS_ORDER.indexOf(sub.sub_status);
          const currentLabel = d.business_line === 'AIR'
            ? ['待入库', '已入库', '已装板', '出口报关', '已发车', '空运中', '已落地', '清关中', '派送中', '已签收'][currentIdx]
            : ['待入库', '已入库', '已装柜', '出口报关', '已发车', '海运中', '已到港', '清关中', '派送中', '已签收'][currentIdx];
          return (
            <TouchableOpacity
              key={sub.id}
              style={styles.subCardLarge}
              activeOpacity={0.7}
              onPress={() => router.push({
                pathname: '/task/sub-order-detail' as any,
                params: {
                  subOrderId: sub.id,
                  subOrderNo: sub.sub_order_no,
                  subStatus: sub.sub_status,
                  businessLine: d.business_line,
                  parentOrderId: d.id,
                },
              })}
            >
              <View style={styles.subCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subCardNo}>{sub.sub_order_no}</Text>
                  <Text style={styles.subCardMeta}>
                    {sub.pieces || 0}件 · {sub.actual_weight_kg || 0}kg
                    {sub.container_no ? ` · ${d.business_line === 'SEA' ? '柜号' : '集装号'} ${sub.container_no}` : ''}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: subMeta.bg }]}>
                  <Text style={[styles.statusText, { color: subMeta.color }]}>{subMeta.label}</Text>
                </View>
              </View>

              <View style={styles.subCardProgress}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.max(5, currentIdx >= 0 ? (currentIdx / 9) * 100 : 0)}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{currentIdx >= 0 ? `当前：${currentLabel}` : sub.sub_status}</Text>
              </View>

              <View style={styles.subCardTimes}>
                {sub.created_at ? <Text style={styles.timeTag}>创建 {formatTime(sub.created_at)}</Text> : null}
                {sub.updated_at ? <Text style={styles.timeTag}>更新 {formatTime(sub.updated_at!)}</Text> : null}
              </View>

              <View style={styles.subCardFooter}>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                <Text style={styles.viewDetailHint}>查看物流详情</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

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
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => detail && router.push({ pathname: '/task/label-print' as any, params: { id: detail.id } })}
        >
          <Ionicons name="print-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => detail && router.push({ pathname: '/task/order-edit' as any, params: { id: detail.id } })}
        >
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
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
            {detail.warehouse_entry_no ? (
              <View style={styles.heroEntryTag}>
                <Ionicons name="pricetag-outline" size={12} color="#7C3AED" />
                <Text style={styles.heroEntryTagText}>入仓号：{detail.warehouse_entry_no}</Text>
              </View>
            ) : null}
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
  heroEntryTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F3FF', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: '#EDE9FE' },
  heroEntryTagText: { fontSize: font.xs, fontFamily: font.mono, fontWeight: '700', color: '#7C3AED' },
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
  emptyHint: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },

  subTrackingCard: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  subTrackingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  subTrackingNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary, flex: 1 },
  subTrackingMeta: { fontSize: font.xs, color: colors.textSecondary },
  subTrackingStatus: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  subTrackingStatusText: { fontSize: font.xs, fontWeight: '600' },
  subTrackingTime: { fontSize: font.xs, fontFamily: font.mono, color: colors.textTertiary },
  siteBlock: { marginTop: spacing.sm, paddingLeft: spacing.xs },
  siteName: { fontSize: font.xs, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  nodeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  nodeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  nodeDot: { width: 6, height: 6, borderRadius: 3 },
  nodeLabel: { fontSize: 12, color: colors.text, fontWeight: '500' },
  nodeTime: { fontSize: 11, fontFamily: font.mono, color: colors.textTertiary },
  noTrackingHint: { fontSize: font.xs, color: colors.textTertiary, paddingLeft: spacing.xs, paddingVertical: spacing.sm },
  extraTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs, paddingLeft: spacing.xs },
  extraTagText: { fontSize: font.xs, fontWeight: '600' },
  inlineTimeline: { paddingLeft: spacing.xs, paddingVertical: spacing.sm },
  inlineTimelineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 6 },
  inlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderLight, marginRight: 4 },
  inlineDotPassed: { backgroundColor: colors.success },
  inlineDotCurrent: { backgroundColor: colors.primary },
  inlineLine: { width: 1, height: 20, backgroundColor: colors.borderLight, position: 'absolute', left: 7, top: 14 },
  inlineLinePassed: { backgroundColor: colors.success },
  inlineLabel: { fontSize: 11, color: colors.textTertiary, width: 55 },
  inlineLabelActive: { color: colors.text, fontWeight: '600' },
  inlineTime: { fontSize: 11, fontFamily: font.mono, color: colors.primary },
  timeSummary: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.xs, paddingLeft: spacing.xs, flexWrap: 'wrap' },
  timeSummaryItem: { fontSize: 10, fontFamily: font.mono, color: colors.textTertiary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary },
  detailValue: { fontSize: font.sm, color: colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  subCardLarge: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  subCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  subCardNo: { fontSize: font.md, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  subCardMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  subCardProgress: { marginBottom: spacing.sm },
  progressBar: { height: 4, backgroundColor: colors.borderLight, borderRadius: 2, marginBottom: spacing.xs },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  progressLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  subCardTimes: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, flexWrap: 'wrap' },
  timeTag: { fontSize: 11, fontFamily: font.mono, color: colors.textTertiary },
  subCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  viewDetailHint: { fontSize: font.xs, color: colors.primary },
  relCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, marginBottom: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.primary },
  relNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  relSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.md, marginTop: spacing.md },
  payBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
  payHint: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.infoLight, padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm },
  payHintText: { flex: 1, fontSize: font.xs, color: colors.info },
});
