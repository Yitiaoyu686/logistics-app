import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl, Pressable, Modal, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { jobApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';
import { useBusinessLine } from '../../lib/business-line';

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
  const [createVisible, setCreateVisible] = useState(false);
  const [routeText, setRouteText] = useState('');
  const [containerNo, setContainerNo] = useState('');
  const [serviceType, setServiceType] = useState('特快');
  const [cargoType, setCargoType] = useState('普货');
  const [station, setStation] = useState('');
  const [creating, setCreating] = useState(false);
  const { isSea } = useBusinessLine();

  const handleCreateRoute = async () => {
    if (!routeText) { Alert.alert('请填写线路'); return; }
    setCreating(true);
    try {
      await jobApi.create({ route: routeText, containerNo, serviceType, cargoType, station, businessLine: isSea ? 'SEA' : 'AIR' });
      Alert.alert('创建成功', '线路已创建', [{ text: '确定', onPress: () => { setCreateVisible(false); setRouteText(''); setContainerNo(''); setStation(''); load(); } }]);
    } catch {
      Alert.alert('创建失败', '请重试');
    } finally { setCreating(false); }
  };

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
        <TouchableOpacity style={styles.navBtn} onPress={() => setCreateVisible(true)}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
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

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{list.filter((j) => j.job_status !== 'DEPARTED').length}</Text>
          <Text style={styles.statLabel}>待执行</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{list.filter((j) => j.job_status === 'DEPARTED').length}</Text>
          <Text style={styles.statLabel}>已执行</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.statWarn]}>{list.filter((j) => !j.container_no).length}</Text>
          <Text style={styles.statLabel}>未建{list.find((j) => j.business_line === 'AIR') ? '集装号' : '箱号'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{new Set(list.map((j) => `${j.origin_port || ''}→${j.dest_port || ''}`).filter(Boolean)).size}</Text>
          <Text style={styles.statLabel}>总线路</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{new Set(list.map((j) => j.container_no).filter(Boolean)).size}</Text>
          <Text style={styles.statLabel}>总{list.find((j) => j.business_line === 'AIR') ? '集装号' : '集装箱'}</Text>
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
      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>创建线路</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>线路 *</Text>
              <TextInput style={styles.fieldInput} placeholder="如 CAN.CHN→LOS.NGN" placeholderTextColor={colors.textTertiary} value={routeText} onChangeText={setRouteText} />
              {isSea && (
                <>
                  <Text style={styles.fieldLabel}>集装箱号</Text>
                  <TextInput style={styles.fieldInput} placeholder="如 MSKU1234567" placeholderTextColor={colors.textTertiary} value={containerNo} onChangeText={setContainerNo} />
                </>
              )}
              <Text style={styles.fieldLabel}>服务类型</Text>
              <View style={styles.chipRow}>
                {['特快', '普快'].map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, serviceType === t && styles.chipActive]} onPress={() => setServiceType(t)}>
                    <Text style={[styles.chipText, serviceType === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>货物类型</Text>
              <View style={styles.chipRow}>
                {['普货', '非普货'].map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, cargoType === t && styles.chipActive]} onPress={() => setCargoType(t)}>
                    <Text style={[styles.chipText, cargoType === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabel}>站点</Text>
              <TextInput style={styles.fieldInput} placeholder="如 IKEJ STA" placeholderTextColor={colors.textTertiary} value={station} onChangeText={setStation} />
              <TouchableOpacity style={[styles.modalSubmit, (!routeText || creating) && styles.btnDisabled]} onPress={handleCreateRoute} disabled={!routeText || creating}>
                <Text style={styles.modalSubmitText}>{creating ? '创建中...' : '确认创建'}</Text>
              </TouchableOpacity>
            </View>
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
  navBtn: { padding: spacing.xs, width: 36 },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card, gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: spacing.sm },
  statValue: { fontSize: font.lg, fontWeight: '700', color: colors.primary },
  statWarn: { color: colors.warning },
  statLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

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

  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.lg, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  modalBody: { gap: spacing.sm },
  fieldLabel: { fontSize: font.sm, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.sm },
  fieldInput: { backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: font.md, color: colors.text, borderWidth: 0.5, borderColor: colors.borderLight },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.borderLight },
  chipActive: { backgroundColor: colors.primaryLight },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '600' },
  modalSubmit: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg },
  modalSubmitText: { fontSize: font.md, color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
});
