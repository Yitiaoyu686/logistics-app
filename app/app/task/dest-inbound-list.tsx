import { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { jobApi, deliveryApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type ActiveTab = 'JOB' | 'DPN';

interface JobInbound {
  kind: 'JOB';
  id: string;
  job_no: string;
  business_line: string;
  origin_port?: string;
  dest_port?: string;
  carrier_name?: string;
  container_no?: string;
  container_type?: string;
  total_pieces: number;
  total_weight_kg: number;
  job_status: string;
  eta?: string;
}

interface DpnInbound {
  kind: 'DPN';
  id: string;
  dpn_no: string;
  from_station?: string;
  to_station?: string;
  total_pieces: number;
  status: string;
  created_at?: string;
}

type ListItem = JobInbound | DpnInbound;

const JOB_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  IN_TRANSIT:      { label: '在途', color: colors.info, bg: colors.infoLight },
  ARRIVED:         { label: '已到港', color: colors.warning, bg: colors.warningLight },
  CUSTOMS_IMPORT:  { label: '清关中', color: colors.primary, bg: colors.primaryLight },
  DELIVERED:       { label: '已入库', color: colors.success, bg: colors.successLight },
};

const DPN_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ARRIVED:    { label: '待收货', color: colors.warning, bg: colors.warningLight },
  RECEIVING:  { label: '收货中', color: colors.info, bg: colors.infoLight },
  RECEIVED:   { label: '已收货', color: colors.success, bg: colors.successLight },
};

export default function DestInboundListScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<ActiveTab>('JOB');
  const [jobs, setJobs] = useState<JobInbound[]>([]);
  const [dpns, setDpns] = useState<DpnInbound[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    try {
      const [jobRes, dpnRes] = await Promise.all([
        jobApi.list({ status: 'IN_TRANSIT' }),
        deliveryApi.getDpns(),
      ]);
      setJobs((jobRes.data || []).map((j: any) => ({ ...j, kind: 'JOB' as const })));
      setDpns((dpnRes.data || [])
        .filter((d: any) => ['ARRIVED', 'RECEIVING', 'RECEIVED'].includes(d.status))
        .map((d: any) => ({ ...d, kind: 'DPN' as const })));
    } catch {
      setJobs([]);
      setDpns([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const data = useMemo(() => {
    const items: ListItem[] = tab === 'JOB' ? jobs : dpns;
    if (!keyword) return items;
    const k = keyword.toLowerCase();
    return items.filter((item) => {
      if (item.kind === 'JOB') {
        return item.job_no?.toLowerCase().includes(k) || item.container_no?.toLowerCase().includes(k);
      }
      return item.dpn_no?.toLowerCase().includes(k);
    });
  }, [tab, jobs, dpns, keyword]);

  const renderJobItem = (item: JobInbound) => {
    const meta = JOB_STATUS_META[item.job_status] || { label: item.job_status, color: colors.textSecondary, bg: colors.borderLight };
    const isAir = item.business_line === 'AIR';
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push('/task/dest-inbound' as any)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.noRow}>
            <Ionicons name={isAir ? 'airplane-outline' : 'boat-outline'} size={18} color={colors.primary} />
            <Text style={styles.noText}>{item.job_no}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.routeText}>{item.origin_port || '-'} → {item.dest_port || '-'}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.carrier_name || '-'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText} numberOfLines={1}>
            {isAir ? (item.container_no || '集装号待分配') : `${item.container_no || '箱号待分配'} ${item.container_type || ''}`}
          </Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.statText}>{item.total_pieces}件 · {item.total_weight_kg}kg</Text>
          {item.eta && <Text style={styles.dateText}>ETA {item.eta.substring(5, 10)}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderDpnItem = (item: DpnInbound) => {
    const meta = DPN_STATUS_META[item.status] || { label: item.status, color: colors.textSecondary, bg: colors.borderLight };
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/task/dpn' as any, params: { mode: 'receive' } })}
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
        <View style={styles.cardFooter}>
          <Text style={styles.statText}>{item.total_pieces}件</Text>
          {item.created_at && <Text style={styles.dateText}>{item.created_at.substring(0, 10)}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: ListItem }) => {
    return item.kind === 'JOB' ? renderJobItem(item) : renderDpnItem(item);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>到仓入库</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabItem, tab === 'JOB' && styles.tabItemActive]}
          onPress={() => setTab('JOB')}
        >
          <Ionicons name="boat-outline" size={16} color={tab === 'JOB' ? colors.primary : colors.textTertiary} />
          <Text style={[styles.tabLabel, tab === 'JOB' && styles.tabLabelActive]}>JOB 入库</Text>
          <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{jobs.length}</Text></View>
        </Pressable>
        <Pressable
          style={[styles.tabItem, tab === 'DPN' && styles.tabItemActive]}
          onPress={() => setTab('DPN')}
        >
          <Ionicons name="car-outline" size={16} color={tab === 'DPN' ? colors.primary : colors.textTertiary} />
          <Text style={[styles.tabLabel, tab === 'DPN' && styles.tabLabelActive]}>DPN 入库</Text>
          <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{dpns.length}</Text></View>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder={tab === 'JOB' ? '搜索 JOB号 / 箱号' : '搜索 DPN号'}
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="log-in-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{tab === 'JOB' ? '暂无待入库 JOB' : '暂无待收货 DPN'}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
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

  tabRow: { flexDirection: 'row', backgroundColor: colors.card, paddingHorizontal: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.primary },
  tabLabel: { fontSize: font.sm, color: colors.textTertiary, fontWeight: '500' },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
  tabBadge: { backgroundColor: colors.bg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  tabBadgeText: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },

  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  listContent: { padding: spacing.md, gap: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  noRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noText: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  routeText: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  metaText: { fontSize: font.xs, color: colors.textSecondary },
  metaDot: { fontSize: font.xs, color: colors.textTertiary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statText: { fontSize: font.xs, color: colors.text, fontWeight: '600' },
  dateText: { fontSize: font.xs, color: colors.textTertiary, fontFamily: font.mono },
});
