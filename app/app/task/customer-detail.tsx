import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
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
  COMPANY_CN: '🏭 国内企业',
  COMPANY_OS: '🏢 海外企业',
  PERSONAL: '👤 个人客户',
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_INBOUND: '待入库', INBOUND: '已入库', PACKED: '已装箱',
  DEPARTED: '已发车', IN_TRANSIT: '运输中', ARRIVED: '已到达', DELIVERED: '已签收',
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
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setLoading(false);
    }
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
          } catch (err: any) {
            Alert.alert('释放失败', err.message || '请重试');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.safe}>
      {/* Nav */}
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
        <ScrollView contentContainerStyle={styles.content}>
          {/* Hero */}
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
                  {detail.status === 'ACTIVE' ? '✓ 活跃' : detail.status}
                </Text>
              </View>
            </View>
          </View>

          {/* 快捷操作 */}
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

          {/* 入仓号 */}
          <View style={styles.entrySection}>
            <Text style={styles.entryLabel}>🏷️ 入仓号</Text>
            <View style={styles.entryCard}>
              <Text style={styles.entryCode}>{detail.customerCode}</Text>
              <Text style={styles.entryHint}>客户包裹填写此入仓号可自动关联订单</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              {['广州总仓', '深圳分仓', 'LOS 到达仓'].map((wh, i) => (
                <View key={i} style={styles.entryChip}>
                  <Text style={styles.entryChipLabel}>{wh}</Text>
                  <Text style={styles.entryChipValue}>{detail.customerCode}-{['GZ', 'SZ', 'LOS'][i]}</Text>
                </View>
              ))}
            </View>
          </View>

          <CollapseSection title="📋 基本信息" defaultOpen>
            <DetailLine label="客户编号" value={detail.customerCode} />
            <DetailLine label="客户名称" value={detail.customerName} />
            <DetailLine label="客户类型" value={TYPE_LABEL[detail.customerType] || detail.customerType} />
            <DetailLine label="所在国家" value={detail.country} />
            <DetailLine label="行业" value={detail.industry || '-'} />
            <DetailLine label="状态" value={detail.status === 'ACTIVE' ? '活跃' : detail.status} />
            <DetailLine label="池类型" value={detail.poolType === 'PRIVATE' ? '我的客户' : '公海池'} />
          </CollapseSection>

          <CollapseSection title="👤 联系人" defaultOpen>
            <DetailLine label="联系人" value={detail.contactName} />
            <DetailLine label="电话" value={detail.contactPhone} highlight />
            <DetailLine label="邮箱" value={detail.contactEmail || '-'} />
          </CollapseSection>

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

          <CollapseSection title="🚢 物流偏好">
            <DetailLine label="运输方式" value={detail.preferredTransport || '未设置'} />
            <DetailLine label="付款方式" value={detail.preferredPayment || '未设置'} />
          </CollapseSection>

          <CollapseSection title={`📦 客户订单 (${orders.length})`}>
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
          </CollapseSection>

          {detail.remark && (
            <CollapseSection title="📝 备注">
              <Text style={styles.remarkText}>{detail.remark}</Text>
            </CollapseSection>
          )}

          {detail.poolType === 'PRIVATE' && (
            <TouchableOpacity
              style={[styles.releaseBtn, actionLoading && styles.btnDisabled]}
              onPress={handleRelease}
              disabled={actionLoading}
            >
              <Text style={styles.releaseBtnText}>释放回公海池</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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
  detailHero: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
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
  entrySection: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  entryLabel: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  entryCard: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md },
  entryCode: { fontSize: font.xxl, fontWeight: '800', color: colors.primary, fontFamily: font.mono, letterSpacing: 2 },
  entryHint: { fontSize: font.xs, color: colors.textSecondary, marginTop: 4 },
  entryChip: { flex: 1, padding: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderLight },
  entryChipLabel: { fontSize: font.xs, color: colors.textSecondary },
  entryChipValue: { fontSize: font.xs, color: colors.primary, fontWeight: '700', fontFamily: font.mono, marginTop: 2 },
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
