import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../lib/theme';
import { warehouseApi, orderApi } from '../lib/api';

export interface UnmatchedTargetItem {
  id: string;
  tracking_no: string;
  express_company: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  pieces: number;
  gross_weight_kg: number;
  customer_hint: string | null;
}

interface OrderOption {
  id: string;
  order_no: string;
  customer_name: string;
  route_code: string | null;
  total_declared_pieces: number;
  total_declared_weight_kg: number;
  order_status: string;
}

interface UnmatchedMatchDialogProps {
  visible: boolean;
  target: UnmatchedTargetItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UnmatchedMatchDialog({ visible, target, onClose, onSuccess }: UnmatchedMatchDialogProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [matching, setMatching] = useState(false);
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (visible) {
      setLoading(true);
      // 加载待入库订单作为推荐（因为已入库的不需要匹配）
      orderApi.list({ status: 'PENDING_INBOUND' })
        .then((r) => setOrders(r.data || []))
        .catch(() => setOrders([]))
        .finally(() => setLoading(false));
    } else {
      setKeyword('');
      setRemark('');
    }
  }, [visible]);

  const filtered = useMemo(() => {
    if (!keyword) return orders;
    const k = keyword.toLowerCase();
    return orders.filter((o) =>
      o.order_no?.toLowerCase().includes(k) ||
      o.customer_name?.toLowerCase().includes(k)
    );
  }, [orders, keyword]);

  const handleMatchTo = async (order: OrderOption) => {
    if (!target) return;
    setMatching(true);
    try {
      await warehouseApi.matchUnmatched(target.id, {
        orderId: order.id,
        customerName: order.customer_name,
        createSubOrder: true,
        matchMethod: 'MANUAL',
        remark: remark || undefined,
      });
      Alert.alert(
        '匹配成功',
        `${target.tracking_no} 已关联到订单\n${order.order_no}\n${order.customer_name}\n\n已自动创建子运单`,
        [{ text: '确定', onPress: () => onSuccess() }]
      );
    } catch (err: any) {
      Alert.alert('匹配失败', err.message || '请重试');
    } finally {
      setMatching(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>匹配订单</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {target && (
            <>
              {/* 无单快递信息卡 */}
              <View style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <Text style={styles.infoNo}>{target.tracking_no}</Text>
                  <View style={styles.infoBadge}>
                    <Text style={styles.infoBadgeText}>待匹配</Text>
                  </View>
                </View>
                <Text style={styles.infoLine}>{target.express_company || '-'} · {target.pieces}件 · {target.gross_weight_kg}kg</Text>
                <Text style={styles.infoLine}>发件人：{target.sender_name || '-'}{target.sender_phone ? ` · ${target.sender_phone}` : ''}</Text>
                {target.customer_hint && (
                  <View style={styles.hintBox}>
                    <Ionicons name="bulb-outline" size={14} color={colors.warning} />
                    <Text style={styles.hintText}>客户提示：{target.customer_hint}</Text>
                  </View>
                )}
              </View>

              {/* 创建新订单 — 若匹配不到现有订单，直接为当前快递创建订单 */}
              <TouchableOpacity
                style={styles.createOrderBtn}
                onPress={() => {
                  if (!target) return;
                  onClose();
                  router.push({
                    pathname: '/task/order-create',
                    params: {
                      fromUnmatchedId: target.id,
                      trackingNo: target.tracking_no,
                      senderName: target.sender_name || '',
                      senderPhone: target.sender_phone || '',
                      pieces: String(target.pieces),
                      weightKg: String(target.gross_weight_kg),
                      expressCompany: target.express_company || '',
                    },
                  });
                }}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.createOrderBtnText}>创建新订单并自动关联</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </TouchableOpacity>

              {/* 搜索 */}
              <View style={styles.searchInputWrap}>
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
                <ScrollView style={{ maxHeight: 360 }}>
                  {filtered.length === 0 ? (
                    <Text style={styles.emptyText}>无匹配订单</Text>
                  ) : (
                    filtered.map((o) => (
                      <TouchableOpacity
                        key={o.id}
                        style={styles.orderOption}
                        onPress={() => handleMatchTo(o)}
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
                        {matching ? (
                          <View style={styles.matchingOverlay}>
                            <ActivityIndicator color="#fff" />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}

              <Text style={styles.tipText}>
                点击订单即匹配，自动创建子运单
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '92%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },

  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.warning },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  infoNo: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono },
  infoBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  infoBadgeText: { fontSize: font.xs, color: colors.warning, fontWeight: '600' },
  infoLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  hintBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  hintText: { fontSize: font.xs, color: colors.warning, fontStyle: 'italic' },

  createOrderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: spacing.md, marginBottom: spacing.md },
  createOrderBtnText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, gap: spacing.sm, marginBottom: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  sectionLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.sm, paddingHorizontal: 4 },

  loadingBox: { paddingVertical: spacing.xl, alignItems: 'center' },

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
  tipText: { fontSize: font.xs, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm },
});
