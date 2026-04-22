import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface ReturnItem {
  id: string;
  return_no?: string;
  customer_name?: string;
  original_order_no?: string;
  reason?: string;
  total_amount?: number;
  return_status?: string;
  created_at?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:    { label: '待处理',  color: colors.warning, bg: colors.warningLight },
  APPROVING:  { label: '审批中',  color: colors.info,    bg: colors.infoLight },
  APPROVED:   { label: '已批准',  color: colors.primary, bg: colors.primaryLight },
  REJECTED:   { label: '已驳回',  color: colors.danger,  bg: colors.dangerLight },
  COMPLETED:  { label: '已完成',  color: colors.success, bg: colors.successLight },
};

export default function ReturnProcessScreen() {
  const router = useRouter();
  const [list, setList] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getReturns();
      setList(res.data || []);
    } catch (err: any) {
      // silent fail — empty state shows
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
    if (!keyword) return list;
    const k = keyword.toLowerCase();
    return list.filter((r) =>
      r.return_no?.toLowerCase().includes(k) ||
      r.customer_name?.toLowerCase().includes(k) ||
      r.original_order_no?.toLowerCase().includes(k)
    );
  }, [list, keyword]);

  const renderItem = ({ item }: { item: ReturnItem }) => {
    const meta = STATUS_LABELS[item.return_status || 'PENDING'] || STATUS_LABELS.PENDING;
    return (
      <View style={[styles.card, { borderLeftColor: meta.color }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.returnNo}>{item.return_no || '-'}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.customerLine}>客户：{item.customer_name || '-'}</Text>
        <Text style={styles.orderLine}>原运单：{item.original_order_no || '-'}</Text>
        {item.reason && (
          <Text style={styles.reasonLine}>退运原因：{item.reason}</Text>
        )}
        {item.total_amount !== undefined && (
          <Text style={styles.amountLine}>金额：¥ {item.total_amount.toFixed(2)}</Text>
        )}
        <Text style={styles.timeLine}>{item.created_at?.substring(0, 16)}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>退运处理</Text>
        <TouchableOpacity
          onPress={() => router.push('/task/return-create')}
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
            placeholder="搜索退运号 / 客户 / 原运单"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
      </View>

      <View style={styles.tipBar}>
        <Ionicons name="information-circle-outline" size={16} color={colors.info} />
        <Text style={styles.tipText}>发现库存异常或客户取消时可直接新建退运单</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="arrow-undo-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无退运任务</Text>
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
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  navCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md },
  navCreateText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },

  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  tipBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.infoLight, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info },

  listContent: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  returnNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  customerLine: { fontSize: font.sm, color: colors.text, marginBottom: 2 },
  orderLine: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  reasonLine: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  amountLine: { fontSize: font.sm, color: colors.danger, fontWeight: '600', marginTop: 4 },
  timeLine: { fontSize: font.xs, color: colors.textTertiary, marginTop: 4 },
});
