import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { jobApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type StatusFilter = 'ALL' | 'PACKING' | 'SEALED' | 'CUSTOMS_EXPORT' | 'DEPARTED';

interface JobItem {
  id: string;
  job_no: string;
  business_line: string;
  job_status: string;
  origin_port?: string;
  dest_port?: string;
  carrier_name?: string;
  container_no?: string;
  container_type?: string;
  total_pieces: number;
  loaded_pieces?: number;
  total_weight_kg: number;
  etd?: string;
  eta?: string;
  service_type?: string;
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PACKING', label: '待装箱' },
  { value: 'SEALED', label: '已封箱' },
  { value: 'CUSTOMS_EXPORT', label: '报关中' },
  { value: 'DEPARTED', label: '已发运' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PACKING:         { label: '装箱中', color: colors.warning, bg: colors.warningLight },
  SEALED:          { label: '已封箱', color: colors.info, bg: colors.infoLight },
  CUSTOMS_EXPORT:  { label: '报关中', color: colors.primary, bg: colors.primaryLight },
  DEPARTED:        { label: '已发运', color: colors.success, bg: colors.successLight },
  IN_TRANSIT:      { label: '在途', color: colors.info, bg: colors.infoLight },
  ARRIVED:         { label: '已到港', color: '#8B5CF6', bg: '#EDE9FE' },
};

export default function JobListScreen() {
  const router = useRouter();
  const [list, setList] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await jobApi.list();
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
      items = items.filter((j) => j.job_status === statusFilter);
    }
    if (keyword) {
      const k = keyword.toLowerCase();
      items = items.filter((j) =>
        j.job_no?.toLowerCase().includes(k) ||
        j.container_no?.toLowerCase().includes(k) ||
        j.carrier_name?.toLowerCase().includes(k)
      );
    }
    return items;
  }, [list, statusFilter, keyword]);

  const renderItem = ({ item }: { item: JobItem }) => {
    const meta = STATUS_META[item.job_status] || { label: item.job_status, color: colors.textSecondary, bg: colors.borderLight };
    const isAir = item.business_line === 'AIR';
    const loadedPct = item.total_pieces > 0 ? ((item.loaded_pieces || 0) / item.total_pieces) * 100 : 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push('/task/packing' as any)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.jobNoRow}>
            <Ionicons name={isAir ? 'airplane-outline' : 'boat-outline'} size={18} color={colors.primary} />
            <Text style={styles.jobNo}>{item.job_no}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        <Text style={styles.routeText}>
          {item.origin_port || '-'} → {item.dest_port || '-'}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.carrier_name || '-'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText} numberOfLines={1}>
            {isAir ? (item.container_no || '集装号待分配') : `${item.container_no || '箱号待分配'} ${item.container_type || ''}`}
          </Text>
        </View>

        {item.job_status === 'PACKING' && (
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(loadedPct, 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>{item.loaded_pieces || 0}/{item.total_pieces}件</Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.statText}>{item.total_pieces}件 · {item.total_weight_kg}kg</Text>
          <View style={styles.dateRow}>
            {item.etd && <Text style={styles.dateText}>ETD {item.etd.substring(5, 10)}</Text>}
            {item.eta && <Text style={styles.dateText}>ETA {item.eta.substring(5, 10)}</Text>}
          </View>
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
        <Text style={styles.navTitle}>装箱发货</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索 JOB号 / 箱号 / 船公司"
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
          <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无 JOB 任务</Text>
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

  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg },
  filterChipActive: { backgroundColor: colors.primaryLight },
  filterText: { fontSize: font.xs, color: colors.textSecondary },
  filterTextActive: { color: colors.primary, fontWeight: '600' },

  listContent: { padding: spacing.md, gap: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  jobNoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  jobNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },

  routeText: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  metaText: { fontSize: font.xs, color: colors.textSecondary },
  metaDot: { fontSize: font.xs, color: colors.textTertiary },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  progressBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.borderLight },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  progressText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statText: { fontSize: font.xs, color: colors.text, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateText: { fontSize: font.xs, color: colors.textTertiary, fontFamily: font.mono },
});
