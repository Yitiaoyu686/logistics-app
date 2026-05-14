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

type StatusFilter = 'ALL' | 'DRAFT' | 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'SIGNED';

interface DpnItem {
  id: string;
  dpn_no: string;
  from_station?: string;
  to_station?: string;
  delivery_method?: string;
  total_pieces: number;
  total_weight_kg?: number;
  status: string;
  driver_name?: string;
  created_at?: string;
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'PENDING', label: '待分配' },
  { value: 'ASSIGNED', label: '已分配' },
  { value: 'IN_TRANSIT', label: '运输中' },
  { value: 'DELIVERED', label: '已送达' },
  { value: 'SIGNED', label: '已签收' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:      { label: '草稿', color: colors.textSecondary, bg: colors.borderLight },
  PENDING:    { label: '待分配', color: colors.warning, bg: colors.warningLight },
  ASSIGNED:   { label: '已分配', color: colors.info, bg: colors.infoLight },
  IN_TRANSIT: { label: '运输中', color: colors.primary, bg: colors.primaryLight },
  DELIVERED:  { label: '已送达', color: '#8B5CF6', bg: '#EDE9FE' },
  SIGNED:     { label: '已签收', color: colors.success, bg: colors.successLight },
};

const METHOD_LABELS: Record<string, string> = {
  SELF_PICKUP: '自提',
  LOCAL_DELIVERY: '本地配送',
  THIRD_PARTY: '第三方配送',
  TRANSFER: '转运',
};

export default function DpnListScreen() {
  const router = useRouter();
  const [list, setList] = useState<DpnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await deliveryApi.getDpns();
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
        d.from_station?.toLowerCase().includes(k) ||
        d.to_station?.toLowerCase().includes(k)
      );
    }
    return items;
  }, [list, statusFilter, keyword]);

  const renderItem = ({ item }: { item: DpnItem }) => {
    const meta = STATUS_META[item.status] || { label: item.status, color: colors.textSecondary, bg: colors.borderLight };
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/task/dpn' as any, params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.noRow}>
            <Ionicons name="car-outline" size={18} color={colors.info} />
            <Text style={styles.noText}>{item.dpn_no}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {(item.from_station || item.to_station) && (
          <Text style={styles.routeText}>{item.from_station || '-'} → {item.to_station || '-'}</Text>
        )}

        <View style={styles.metaRow}>
          {item.delivery_method && (
            <View style={styles.methodBadge}>
              <Text style={styles.methodText}>{METHOD_LABELS[item.delivery_method] || item.delivery_method}</Text>
            </View>
          )}
          <Text style={styles.statText}>{item.total_pieces}件</Text>
          {item.driver_name && <Text style={styles.driverText}>{item.driver_name}</Text>}
        </View>

        <Text style={styles.timeText}>{(item.created_at || '').substring(0, 16)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>DPN 管理</Text>
        <TouchableOpacity
          onPress={() => router.push('/task/dpn-create' as any)}
          style={styles.navCreateBtn}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.navCreateText}>新建</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索 DPN号 / 站点"
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
          <Ionicons name="car-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无 DPN 记录</Text>
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
  navCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md },
  navCreateText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },

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
  noText: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.info },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  routeText: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  methodBadge: { backgroundColor: colors.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  methodText: { fontSize: font.xs, color: colors.textSecondary },
  statText: { fontSize: font.xs, color: colors.text, fontWeight: '600' },
  driverText: { fontSize: font.xs, color: colors.textSecondary },
  timeText: { fontSize: font.xs, color: colors.textTertiary },
});
