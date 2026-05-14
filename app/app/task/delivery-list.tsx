import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { deliveryApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type StatusFilter = 'ALL' | 'PENDING' | 'IN_DELIVERY' | 'DELIVERED' | 'SIGNED' | 'FAILED';

interface DeliveryTask {
  id: string;
  dpn_no?: string;
  recipient_name?: string;
  recipient_phone?: string;
  address?: string;
  delivery_method?: string;
  total_pieces: number;
  status: string;
  driver_name?: string;
  scheduled_date?: string;
  created_at?: string;
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待接单' },
  { value: 'IN_DELIVERY', label: '配送中' },
  { value: 'DELIVERED', label: '已送达' },
  { value: 'SIGNED', label: '已签收' },
  { value: 'FAILED', label: '失败' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:      { label: '待接单', color: colors.warning, bg: colors.warningLight, icon: 'time-outline' },
  IN_DELIVERY:  { label: '配送中', color: colors.info, bg: colors.infoLight, icon: 'navigate-outline' },
  DELIVERED:    { label: '已送达', color: '#8B5CF6', bg: '#EDE9FE', icon: 'checkmark-circle-outline' },
  SIGNED:       { label: '已签收', color: colors.success, bg: colors.successLight, icon: 'checkmark-done-outline' },
  FAILED:       { label: '失败', color: colors.danger, bg: colors.dangerLight, icon: 'close-circle-outline' },
};

export default function DeliveryListScreen() {
  const router = useRouter();
  const [list, setList] = useState<DeliveryTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await deliveryApi.getDeliveryTasks();
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

  const filtered = useMemo(() => {
    let items = list;
    if (statusFilter !== 'ALL') {
      items = items.filter((d) => d.status === statusFilter);
    }
    if (keyword) {
      const k = keyword.toLowerCase();
      items = items.filter((d) =>
        d.dpn_no?.toLowerCase().includes(k) ||
        d.recipient_name?.toLowerCase().includes(k) ||
        d.address?.toLowerCase().includes(k)
      );
    }
    return items;
  }, [list, statusFilter, keyword]);

  const renderItem = ({ item }: { item: DeliveryTask }) => {
    const meta = STATUS_META[item.status] || { label: item.status, color: colors.textSecondary, bg: colors.borderLight, icon: 'ellipse-outline' };
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/task/delivery' as any, params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.noRow}>
            <Ionicons name={meta.icon as any} size={18} color={meta.color} />
            <Text style={styles.noText}>{item.dpn_no || `TASK-${item.id.substring(0, 8)}`}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {item.recipient_name && (
          <View style={styles.recipientRow}>
            <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.recipientText}>{item.recipient_name}</Text>
            {item.recipient_phone && <Text style={styles.phoneText}>{item.recipient_phone}</Text>}
          </View>
        )}

        {item.address && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.addressText} numberOfLines={2}>{item.address}</Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.statText}>{item.total_pieces}件</Text>
          {item.driver_name && <Text style={styles.driverText}>{item.driver_name}</Text>}
          {item.scheduled_date && <Text style={styles.dateText}>{item.scheduled_date.substring(0, 10)}</Text>}
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
        <Text style={styles.navTitle}>配送管理</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索 DPN号 / 收件人 / 地址"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
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
          <Ionicons name="navigate-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无配送任务</Text>
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

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg },
  filterChipActive: { backgroundColor: colors.primaryLight },
  filterText: { fontSize: font.xs, color: colors.textSecondary },
  filterTextActive: { color: colors.primary, fontWeight: '600' },

  listContent: { padding: spacing.md, gap: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  noRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noText: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },

  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  recipientText: { fontSize: font.sm, color: colors.text },
  phoneText: { fontSize: font.xs, color: colors.textSecondary, marginLeft: spacing.sm },

  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: spacing.sm },
  addressText: { flex: 1, fontSize: font.xs, color: colors.textSecondary, lineHeight: 18 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statText: { fontSize: font.xs, color: colors.text, fontWeight: '600' },
  driverText: { fontSize: font.xs, color: colors.textSecondary },
  dateText: { fontSize: font.xs, color: colors.textTertiary, fontFamily: font.mono, marginLeft: 'auto' },
});
