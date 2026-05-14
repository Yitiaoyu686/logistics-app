import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi, orderApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface OrderOption {
  id: string;
  order_no: string;
  customer_name: string;
  route_code: string | null;
  total_declared_pieces: number;
  total_declared_weight_kg: number;
  order_status: string;
}

export default function UnmatchedMatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    trackingNo: string;
    expressCompany: string;
    senderName: string;
    senderPhone: string;
    pieces: string;
    weightKg: string;
    customerHint: string;
  }>();

  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    orderApi.list({ status: 'PENDING_INBOUND' })
      .then((r) => setOrders(r.data || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!keyword) return orders;
    const k = keyword.toLowerCase();
    return orders.filter((o) =>
      o.order_no?.toLowerCase().includes(k) ||
      o.customer_name?.toLowerCase().includes(k)
    );
  }, [orders, keyword]);

  const handleMatch = async (order: OrderOption) => {
    if (!params.id) return;
    setMatching(true);
    try {
      await warehouseApi.matchUnmatched(params.id, {
        orderId: order.id,
        customerName: order.customer_name,
        createSubOrder: true,
        matchMethod: 'MANUAL',
      });
      Alert.alert(
        '匹配成功',
        `${params.trackingNo} 已关联到订单\n${order.order_no}\n${order.customer_name}\n\n已自动创建子运单`,
        [{ text: '确定', onPress: () => safeBack(router) }]
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      Alert.alert('匹配失败', msg);
    } finally {
      setMatching(false);
    }
  };

  const handleCreateOrder = () => {
    router.push({
      pathname: '/task/order-create',
      params: {
        fromUnmatchedId: params.id,
        trackingNo: params.trackingNo || '',
        senderName: params.senderName || '',
        senderPhone: params.senderPhone || '',
        pieces: params.pieces || '',
        weightKg: params.weightKg || '',
        expressCompany: params.expressCompany || '',
      },
    });
  };

  return (
    <View style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>匹配订单</Text>
        <View style={styles.navBtn} />
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Text style={styles.infoNo}>{params.trackingNo || '-'}</Text>
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeText}>待匹配</Text>
          </View>
        </View>
        <Text style={styles.infoLine}>{params.expressCompany || '-'} · {params.pieces || 0}件 · {params.weightKg || 0}kg</Text>
        <Text style={styles.infoLine}>发件人：{params.senderName || '-'}{params.senderPhone ? ` · ${params.senderPhone}` : ''}</Text>
        {params.customerHint ? (
          <View style={styles.hintBox}>
            <Ionicons name="bulb-outline" size={14} color={colors.warning} />
            <Text style={styles.hintText}>客户提示：{params.customerHint}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={styles.createOrderBtn} onPress={handleCreateOrder}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.createOrderBtnText}>创建新订单并自动关联</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </TouchableOpacity>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索运单号 / 客户名"
          placeholderTextColor={colors.textTertiary}
          value={keyword}
          onChangeText={setKeyword}
        />
      </View>

      <Text style={styles.sectionLabel}>
        {keyword ? '匹配结果' : `推荐订单 (待入库 ${filtered.length})`}
      </Text>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>无匹配订单</Text>
          ) : (
            filtered.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={styles.orderOption}
                onPress={() => handleMatch(o)}
                disabled={matching}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderNo}>{o.order_no}</Text>
                  <Text style={styles.orderStatus}>待入库</Text>
                </View>
                <Text style={styles.orderCustomer}>{o.customer_name}</Text>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderMeta}>{o.total_declared_pieces}件 · {o.total_declared_weight_kg}kg</Text>
                  <Text style={styles.orderRoute}>{o.route_code || '-'}</Text>
                </View>
                {matching && (
                  <View style={styles.matchingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <Text style={styles.tipText}>点击订单即匹配，自动创建子运单</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 40 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: '600', color: colors.text },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.warning },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  infoNo: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono },
  infoBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  infoBadgeText: { fontSize: font.xs, color: colors.warning, fontWeight: '600' },
  infoLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  hintText: { fontSize: font.xs, color: colors.warning, fontStyle: 'italic' },
  createOrderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.md },
  createOrderBtnText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, gap: spacing.sm, marginHorizontal: spacing.md, marginTop: spacing.md },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },
  sectionLabel: { fontSize: font.xs, color: colors.textSecondary, marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm },
  loadingBox: { paddingVertical: spacing.xl, alignItems: 'center' },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  orderOption: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary, position: 'relative' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  orderNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  orderStatus: { fontSize: font.xs, color: colors.warning, paddingHorizontal: spacing.sm, paddingVertical: 2, backgroundColor: colors.warningLight, borderRadius: radius.sm },
  orderCustomer: { fontSize: font.sm, color: colors.text, fontWeight: '500', marginBottom: 4 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  orderMeta: { fontSize: font.xs, color: colors.textSecondary },
  orderRoute: { fontSize: font.xs, color: colors.textSecondary },
  matchingOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },
  tipText: { fontSize: font.xs, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.sm },
});
