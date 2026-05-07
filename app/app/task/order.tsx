import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { orderApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

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

const STATUS_FILTERS = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING_INBOUND', label: '待入库' },
  { value: 'INBOUND', label: '已入库' },
  { value: 'DEPARTED', label: '已发车' },
  { value: 'IN_TRANSIT', label: '运输中' },
  { value: 'ARRIVED', label: '已到达' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_INBOUND: { label: '待入库', color: colors.warning,       bg: colors.warningLight },
  INBOUND:         { label: '已入库', color: colors.success,       bg: colors.successLight },
  DEPARTED:        { label: '已发车', color: colors.info,          bg: colors.infoLight },
  IN_TRANSIT:      { label: '运输中', color: colors.primary,       bg: colors.primaryLight },
  ARRIVED:         { label: '已到达', color: colors.taskDelivery,  bg: '#fce7f3' },
  DELIVERED:       { label: '已签收', color: colors.textSecondary, bg: colors.borderLight },
};

interface OrderScreenProps {
  embedded?: boolean;
}

export default function OrderScreen({ embedded = false }: OrderScreenProps = {}) {
  const router = useRouter();
  const [list, setList] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('ALL');

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
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push({ pathname: '/task/order-detail' as any, params: { id: item.id } })}
        activeOpacity={0.7}
      >
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
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
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
  navExtra: { fontSize: font.sm, color: colors.textSecondary },
  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },
  filterRow: { paddingVertical: spacing.md, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
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
});
