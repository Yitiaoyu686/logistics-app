import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl, Pressable, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type SourceTab = 'EXPRESS' | 'TRANSFER' | 'RETURN';

interface InboundRecord {
  id: string;
  inbound_no: string;
  source_type: string;
  inbound_status: string;
  customer_name?: string;
  sub_order_no?: string;
  tracking_no?: string;
  total_pieces: number;
  total_weight_kg: number;
  inbound_at?: string;
  created_at?: string;
  transfer_no?: string;
  from_warehouse?: string;
  to_warehouse?: string;
  return_no?: string;
  return_reason?: string;
}

const TABS: { value: SourceTab; label: string; icon: string }[] = [
  { value: 'EXPRESS', label: '快递入库', icon: 'mail-outline' },
  { value: 'TRANSFER', label: '调拨入库', icon: 'swap-horizontal-outline' },
  { value: 'RETURN', label: '退回入库', icon: 'return-down-back-outline' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:   { label: '待入库', color: colors.warning, bg: colors.warningLight },
  PARTIAL:   { label: '部分入库', color: colors.info, bg: colors.infoLight },
  COMPLETED: { label: '已完成', color: colors.success, bg: colors.successLight },
  ABNORMAL:  { label: '异常', color: colors.danger, bg: colors.dangerLight },
};

export default function InboundListScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<SourceTab>('EXPRESS');
  const [list, setList] = useState<InboundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getInbound();
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
    let items = list.filter((r) => {
      if (tab === 'EXPRESS') return !r.source_type || r.source_type === 'EXPRESS';
      if (tab === 'TRANSFER') return r.source_type === 'TRANSFER';
      return r.source_type === 'RETURN';
    });
    if (keyword) {
      const k = keyword.toLowerCase();
      items = items.filter((r) =>
        r.inbound_no?.toLowerCase().includes(k) ||
        r.sub_order_no?.toLowerCase().includes(k) ||
        r.tracking_no?.toLowerCase().includes(k) ||
        r.customer_name?.toLowerCase().includes(k)
      );
    }
    return items;
  }, [list, tab, keyword]);

  const stats = useMemo(() => {
    const today = list.filter((r) => {
      const d = r.inbound_at || r.created_at || '';
      return d.startsWith(new Date().toISOString().slice(0, 10));
    });
    const total = filtered.reduce((s, r) => s + (r.total_pieces || 0), 0);
    const totalWt = filtered.reduce((s, r) => s + (r.total_weight_kg || 0), 0);
    const abnormal = filtered.filter((r) => r.inbound_status === 'ABNORMAL').length;
    return { todayCount: today.length, totalPieces: total, totalWeight: totalWt, abnormal };
  }, [list, filtered]);

  const handlePress = (item: InboundRecord) => {
    if (tab === 'TRANSFER') {
      router.push('/task/transfer-inbound' as any);
    } else if (tab === 'RETURN') {
      router.push({ pathname: '/task/transfer-inbound' as any, params: { type: 'RETURN' } });
    } else {
      router.push('/task/inbound' as any);
    }
  };

  const renderItem = ({ item }: { item: InboundRecord }) => {
    const meta = STATUS_META[item.inbound_status] || STATUS_META.PENDING;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => handlePress(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.inboundNo}>{item.inbound_no || '-'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {tab === 'EXPRESS' && (
          <>
            {item.customer_name && <Text style={styles.metaLine}>客户：{item.customer_name}</Text>}
            {item.tracking_no && <Text style={styles.metaLine}>快递单号：{item.tracking_no}</Text>}
          </>
        )}
        {tab === 'TRANSFER' && (
          <>
            {item.transfer_no && <Text style={styles.metaLine}>调拨单号：{item.transfer_no}</Text>}
            {(item.from_warehouse || item.to_warehouse) && (
              <Text style={styles.metaLine}>{item.from_warehouse || '-'} → {item.to_warehouse || '-'}</Text>
            )}
          </>
        )}
        {tab === 'RETURN' && (
          <>
            {item.return_no && <Text style={styles.metaLine}>退运单号：{item.return_no}</Text>}
            {item.return_reason && <Text style={styles.metaLine}>原因：{item.return_reason}</Text>}
          </>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.statText}>{item.total_pieces || 0}件 · {item.total_weight_kg || 0}kg</Text>
          <View style={styles.footerRight}>
            {item.inbound_status === 'ABNORMAL' && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => {
                  Alert.alert('确认删除', `确定要删除入库记录 ${item.inbound_no || ''} 吗？`, [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '删除', style: 'destructive',
                      onPress: async () => {
                        try {
                          await warehouseApi.deleteInbound(item.id);
                          load();
                        } catch { Alert.alert('删除失败', '请重试'); }
                      },
                    },
                  ]);
                }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            )}
            <Text style={styles.timeText}>{(item.inbound_at || item.created_at || '').substring(0, 16)}</Text>
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
        <Text style={styles.navTitle}>入库管理</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.tabItem, tab === t.value && styles.tabItemActive]}
            onPress={() => setTab(t.value)}
          >
            <Ionicons name={t.icon as any} size={16} color={tab === t.value ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabLabel, tab === t.value && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索入库号 / 运单号 / 快递号"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.todayCount}</Text>
          <Text style={styles.statLabel}>今日入库</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalPieces}</Text>
          <Text style={styles.statLabel}>总件数</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.totalWeight.toFixed(1)}</Text>
          <Text style={styles.statLabel}>总重量 kg</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.statWarn]}>{stats.abnormal}</Text>
          <Text style={styles.statLabel}>异常</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="log-in-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无入库记录</Text>
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

  tabRow: { flexDirection: 'row', backgroundColor: colors.card, paddingHorizontal: spacing.md, gap: spacing.xs, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.primary },
  tabLabel: { fontSize: font.sm, color: colors.textTertiary, fontWeight: '500' },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },

  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.sm },
  statValue: { fontSize: font.lg, fontWeight: '700', color: colors.primary },
  statWarn: { color: colors.warning },
  statLabel: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  listContent: { padding: spacing.md, gap: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  inboundNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  metaLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statText: { fontSize: font.xs, color: colors.text, fontWeight: '600' },
  timeText: { fontSize: font.xs, color: colors.textTertiary },
  deleteBtn: { padding: spacing.xs },
});
