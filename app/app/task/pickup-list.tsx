import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl, Pressable, Alert, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { deliveryApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type StatusFilter = 'ALL' | 'PENDING_NOTIFY' | 'NOTIFIED' | 'COMPLETED';

interface PickupItem {
  id: string;
  tracking_no?: string;
  customer_name?: string;
  station_name?: string;
  total_pieces: number;
  payment_status?: string;
  notify_status?: string;
  pickup_status: string;
  notified_at?: string;
  completed_at?: string;
  created_at?: string;
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING_NOTIFY', label: '待通知' },
  { value: 'NOTIFIED', label: '已通知' },
  { value: 'COMPLETED', label: '已自提' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_NOTIFY: { label: '待通知', color: colors.warning, bg: colors.warningLight },
  NOTIFIED:       { label: '已通知', color: colors.info, bg: colors.infoLight },
  COMPLETED:      { label: '已自提', color: colors.success, bg: colors.successLight },
};

const PAY_META: Record<string, { label: string; color: string }> = {
  PAID:     { label: '已付款', color: colors.success },
  UNPAID:   { label: '未付款', color: colors.danger },
  PARTIAL:  { label: '部分付款', color: colors.warning },
};

export default function PickupListScreen() {
  const router = useRouter();
  const [list, setList] = useState<PickupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await deliveryApi.getPickups();
      setList(res.data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = useMemo(() => ({
    total: list.length,
    notified: list.filter((p) => p.notify_status === 'NOTIFIED' || p.notify_status === 'PICKED_UP' || p.pickup_status === 'NOTIFIED').length,
    pickedUp: list.filter((p) => p.pickup_status === 'COMPLETED' || p.notify_status === 'PICKED_UP').length,
  }), [list]);

  const handleNotify = async (item: PickupItem) => {
    try {
      await deliveryApi.notifyPickup(item.id);
      const msg = '取件通知已发送';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('成功', msg);
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请重试';
      if (Platform.OS === 'web') window.alert(`通知失败：${message}`);
      else Alert.alert('通知失败', message);
    }
  };

  const filtered = useMemo(() => {
    let items = list;
    if (statusFilter !== 'ALL') {
      items = items.filter((p) => p.pickup_status === statusFilter);
    }
    if (keyword) {
      const k = keyword.toLowerCase();
      items = items.filter((p) =>
        p.tracking_no?.toLowerCase().includes(k) ||
        p.customer_name?.toLowerCase().includes(k) ||
        p.station_name?.toLowerCase().includes(k)
      );
    }
    return items;
  }, [list, statusFilter, keyword]);

  const renderItem = ({ item }: { item: PickupItem }) => {
    const meta = STATUS_META[item.pickup_status] || { label: item.pickup_status, color: colors.textSecondary, bg: colors.borderLight };
    const pay = PAY_META[item.payment_status || ''] || null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/task/pickup' as any, params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.noRow}>
            <Ionicons name="hand-left-outline" size={16} color="#8B5CF6" />
            <Text style={styles.noText}>{item.tracking_no || '-'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.infoText}>{item.customer_name || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.infoText}>{item.station_name || '-'}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.statText}>{item.total_pieces}件</Text>
          {pay && <Text style={[styles.payText, { color: pay.color }]}>{pay.label}</Text>}
          {item.pickup_status === 'PENDING_NOTIFY' && (
            <TouchableOpacity
              style={styles.notifyBtn}
              onPress={(e) => { e.stopPropagation(); handleNotify(item); }}
            >
              <Ionicons name="notifications-outline" size={14} color="#fff" />
              <Text style={styles.notifyBtnText}>发送通知</Text>
            </TouchableOpacity>
          )}
          {item.pickup_status === 'NOTIFIED' && item.notified_at && (
            <Text style={styles.timeText}>通知于 {item.notified_at.substring(5, 16)}</Text>
          )}
          {item.pickup_status === 'COMPLETED' && item.completed_at && (
            <Text style={styles.timeText}>提取于 {item.completed_at.substring(5, 16)}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>自提管理</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索运单号 / 客户 / 站点"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.statLabel}>总数</Text></View>
        <View style={styles.statCard}><Text style={styles.statValue}>{stats.notified}</Text><Text style={styles.statLabel}>已通知</Text></View>
        <View style={styles.statCard}><Text style={[styles.statValue, { color: colors.success }]}>{stats.pickedUp}</Text><Text style={styles.statLabel}>已核销</Text></View>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text style={[styles.filterText, statusFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="hand-left-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无自提记录</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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
  navBtn: { padding: spacing.xs, width: 36 },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.card, gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: spacing.sm },
  statValue: { fontSize: font.lg, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg },
  filterChipActive: { backgroundColor: colors.primaryLight },
  filterText: { fontSize: font.xs, color: colors.textSecondary },
  filterTextActive: { color: colors.primary, fontWeight: '600' },

  listContent: { padding: spacing.md, gap: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  noRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noText: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: '#8B5CF6' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },

  infoRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { fontSize: font.sm, color: colors.textSecondary },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statText: { fontSize: font.xs, color: colors.text, fontWeight: '600' },
  payText: { fontSize: font.xs, fontWeight: '600' },
  timeText: { fontSize: font.xs, color: colors.textTertiary, marginLeft: 'auto' },

  notifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, marginLeft: 'auto' },
  notifyBtnText: { color: '#fff', fontSize: font.xs, fontWeight: '600' },
});
