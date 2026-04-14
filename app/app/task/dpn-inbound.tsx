import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { deliveryApi } from '../../lib/api';

interface DpnItem {
  id: string;
  dpn_no: string;
  business_line: string;
  dpn_type: string;
  from_site: string;
  to_site: string;
  dpn_status: string;
  total_orders: number;
  total_pieces: number;
  total_weight_kg: number;
  arrival_time: string | null;
  created_at: string;
}

export default function DpnInboundScreen() {
  const router = useRouter();
  const [list, setList] = useState<DpnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [submitting, setSubmitting] = useState<string>('');

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await deliveryApi.getDpns();
      // 只显示 ARRIVED 待入库的 DPN
      const arrived = (res.data || []).filter((d: DpnItem) => d.dpn_status === 'ARRIVED');
      setList(arrived);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
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
    if (!keyword) return list;
    const k = keyword.toLowerCase();
    return list.filter((d) =>
      d.dpn_no?.toLowerCase().includes(k) ||
      d.from_site?.toLowerCase().includes(k) ||
      d.to_site?.toLowerCase().includes(k)
    );
  }, [list, keyword]);

  const handleConfirmInbound = async (item: DpnItem) => {
    setSubmitting(item.id);
    try {
      await deliveryApi.updateDpn(item.id, {
        dpnStatus: 'SIGNED',
        remark: 'DPN 入库确认完成',
      });
      Alert.alert('入库完成', `${item.dpn_no} 已入库`, [
        { text: '确定', onPress: () => load() },
      ]);
    } catch (err: any) {
      Alert.alert('提交失败', err.message || '请重试');
    } finally {
      setSubmitting('');
    }
  };

  const renderItem = ({ item }: { item: DpnItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.dpnNo}>{item.dpn_no}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>已到达 · 待入库</Text>
        </View>
      </View>

      <View style={styles.routeRow}>
        <Text style={styles.routeText}>{item.from_site}</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} style={{ marginHorizontal: 6 }} />
        <Text style={styles.routeText}>{item.to_site}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.total_orders}</Text>
          <Text style={styles.statLabel}>运单数</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.total_pieces}</Text>
          <Text style={styles.statLabel}>件数</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.total_weight_kg}</Text>
          <Text style={styles.statLabel}>重量(kg)</Text>
        </View>
      </View>

      {item.arrival_time && (
        <Text style={styles.timeText}>到达时间：{item.arrival_time}</Text>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => router.push({
            pathname: '/task/dpn' as any,
            params: { dpnId: item.id, dpnNo: item.dpn_no, dpnStatus: item.dpn_status, fromSite: item.from_site, toSite: item.to_site },
          })}
        >
          <Ionicons name="scan" size={14} color="#fff" />
          <Text style={styles.actionBtnText}>扫码核对</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSuccess, submitting === item.id && styles.btnDisabled]}
          onPress={() => handleConfirmInbound(item)}
          disabled={submitting === item.id}
        >
          {submitting === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>一键入库</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>DPN 入库</Text>
        <Text style={styles.navExtra}>{filtered.length} 单</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索 DPN 号 / 站点"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="archive-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无待入库 DPN</Text>
          <Text style={styles.emptyHint}>等待 DPN 到达后即可入库</Text>
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
  emptyHint: { fontSize: font.xs, color: colors.textTertiary },

  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  navExtra: { fontSize: font.sm, color: colors.textSecondary },

  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  listContent: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  dpnNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { backgroundColor: colors.successLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, color: colors.success, fontWeight: '600' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  routeText: { fontSize: font.sm, color: colors.text, fontWeight: '500' },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, alignItems: 'center', padding: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.md },
  statValue: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  timeText: { fontSize: font.xs, color: colors.textTertiary, marginBottom: spacing.sm },

  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.md },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnSuccess: { backgroundColor: colors.success },
  actionBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
