import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, RefreshControl, Alert, Modal, ScrollView,
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
  SETTLING:   { label: '结算中',  color: '#8B5CF6',      bg: '#F5F3FF' },
  SETTLED:    { label: '已结算',  color: '#059669',      bg: '#ECFDF5' },
  EXECUTING:  { label: '执行中',  color: colors.taskDispatch, bg: '#FFF7ED' },
  COMPLETED:  { label: '已完成',  color: colors.success, bg: colors.successLight },
};

// 每个状态对应的操作按钮
const STATUS_ACTIONS: Record<string, { label: string; color: string; nextStatus: string }[]> = {
  PENDING: [
    { label: '通过', color: colors.success, nextStatus: 'APPROVED' },
    { label: '驳回', color: colors.danger, nextStatus: 'REJECTED' },
  ],
  APPROVED: [
    { label: '费用结算', color: '#8B5CF6', nextStatus: 'SETTLING' },
  ],
  SETTLING: [
    { label: '确认结算', color: '#059669', nextStatus: 'SETTLED' },
  ],
  SETTLED: [
    { label: '执行退运', color: colors.taskDispatch, nextStatus: 'EXECUTING' },
  ],
  EXECUTING: [
    { label: '确认完成', color: colors.success, nextStatus: 'COMPLETED' },
  ],
};

export default function ReturnProcessScreen() {
  const router = useRouter();
  const [list, setList] = useState<ReturnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [actionTarget, setActionTarget] = useState<ReturnItem | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // 结算表单
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getReturns();
      setList(res.data || []);
    } catch (err: any) {
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

  const handleStatusChange = (item: ReturnItem, nextStatus: string) => {
    if (nextStatus === 'SETTLING') {
      setActionTarget(item);
      setSettleAmount(String(item.total_amount || 0));
      setSettleNote('');
    } else {
      confirmAction(item, nextStatus);
    }
  };

  const confirmAction = (item: ReturnItem, nextStatus: string, extra?: Record<string, any>) => {
    const labels: Record<string, string> = {
      APPROVED: '通过退运申请', REJECTED: '驳回退运申请',
      SETTLING: '进入费用结算', SETTLED: '确认费用结算',
      EXECUTING: '开始执行退运', COMPLETED: '标记退运完成',
    };
    const actionLabel = labels[nextStatus] || nextStatus;

    Alert.alert('确认操作', `确定要「${actionLabel}」吗？\n${item.return_no}`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: () => executeAction(item, nextStatus, extra),
      },
    ]);
  };

  const executeAction = (item: ReturnItem, nextStatus: string, extra?: Record<string, any>) => {
    setActionSubmitting(true);
    setList((prev) => prev.map((r) => r.id === item.id ? { ...r, return_status: nextStatus, ...(extra || {}) } : r));
    // Demo: 本地更新即可
    setTimeout(() => {
      setActionSubmitting(false);
      setActionTarget(null);
    }, 300);
  };

  const handleSettleSubmit = () => {
    if (!actionTarget) return;
    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) { Alert.alert('请输入有效结算金额'); return; }
    confirmAction(actionTarget, 'SETTLING', { total_amount: amt });
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
    const actions = STATUS_ACTIONS[item.return_status || ''] || [];
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
        {typeof item.total_amount === 'number' && item.total_amount > 0 && (
          <Text style={styles.amountLine}>金额：¥ {item.total_amount.toFixed(2)}</Text>
        )}
        <Text style={styles.timeLine}>{item.created_at?.substring(0, 16)}</Text>
        {actions.length > 0 && (
          <View style={styles.actionRow}>
            {actions.map((a) => (
              <TouchableOpacity
                key={a.nextStatus}
                style={[styles.inlineBtn, { borderColor: a.color, backgroundColor: a.color + '10' }]}
                onPress={() => handleStatusChange(item, a.nextStatus)}
              >
                <Text style={[styles.inlineBtnText, { color: a.color }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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

      {/* 结算 Modal */}
      <Modal visible={!!actionTarget} transparent animationType="slide" onRequestClose={() => setActionTarget(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>费用结算</Text>
              <TouchableOpacity onPress={() => setActionTarget(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {actionTarget && (
              <ScrollView>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalReturnNo}>{actionTarget.return_no}</Text>
                  <Text style={styles.modalCust}>{actionTarget.customer_name} · {actionTarget.original_order_no}</Text>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>结算金额 *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={settleAmount}
                    onChangeText={setSettleAmount}
                    keyboardType="decimal-pad"
                    placeholder="输入金额"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>结算备注</Text>
                  <TextInput
                    style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={settleNote}
                    onChangeText={setSettleNote}
                    placeholder="结算说明（可选）"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalSubmit, actionSubmitting && { opacity: 0.6 }]}
                  onPress={handleSettleSubmit}
                  disabled={actionSubmitting}
                >
                  <Text style={styles.modalSubmitText}>
                    {actionSubmitting ? '提交中...' : '确认进入结算'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  inlineBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  inlineBtnText: { fontSize: font.xs, fontWeight: '600' },
  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  modalInfo: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  modalReturnNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  modalCust: { fontSize: font.xs, color: colors.textSecondary, marginTop: 4 },
  modalField: { marginBottom: spacing.md },
  modalLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.bg },
  modalSubmit: { height: 52, backgroundColor: '#8B5CF6', borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  modalSubmitText: { color: '#fff', fontSize: font.lg, fontWeight: '600' },
});
