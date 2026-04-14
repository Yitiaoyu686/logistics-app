import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';

type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED' | 'CANCELLED';
type StatusFilter = 'ALL' | TransferStatus;

interface TransferItem {
  id: string;
  transfer_no: string;
  business_line: string;
  direction: string;
  from_warehouse_name: string;
  to_warehouse_name: string;
  route_label: string | null;
  job_id: string | null;
  total_pieces: number;
  total_weight_kg: number;
  transfer_status: TransferStatus;
  driver_name: string | null;
  driver_phone: string | null;
  plate_no: string | null;
  dispatch_time: string | null;
  arrival_time: string | null;
  created_at: string;
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待发运' },
  { value: 'IN_TRANSIT', label: '运输中' },
  { value: 'ARRIVED', label: '已到达' },
  { value: 'RECEIVED', label: '已签收' },
];

const STATUS_META: Record<TransferStatus, { label: string; color: string; bg: string }> = {
  PENDING:    { label: '待发运', color: colors.warning,        bg: colors.warningLight },
  IN_TRANSIT: { label: '运输中', color: colors.info,           bg: colors.infoLight },
  ARRIVED:    { label: '已到达', color: colors.primary,        bg: colors.primaryLight },
  RECEIVED:   { label: '已签收', color: colors.success,        bg: colors.successLight },
  CANCELLED:  { label: '已取消', color: colors.textSecondary,  bg: colors.borderLight },
};

type ActionMode = 'dispatch' | 'arrive' | 'receive';

export default function TransferScreen() {
  const router = useRouter();
  const [list, setList] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [selected, setSelected] = useState<TransferItem | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 执行表单
  const [logisticsCompany, setLogisticsCompany] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNo, setPlateNo] = useState('');
  const [arrivalRemark, setArrivalRemark] = useState('');

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getTransfers();
      setList(res.data || []);
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
    if (filter === 'ALL') return list;
    return list.filter((t) => t.transfer_status === filter);
  }, [list, filter]);

  const openAction = (item: TransferItem, mode: ActionMode) => {
    setSelected(item);
    setActionMode(mode);
    setLogisticsCompany('');
    setTrackingNo('');
    setDriverName('');
    setDriverPhone('');
    setPlateNo('');
    setArrivalRemark('');
  };

  const handleSubmit = async () => {
    if (!selected || !actionMode) return;

    if (actionMode === 'dispatch') {
      if (!driverName.trim() || !plateNo.trim()) {
        Alert.alert('请填写司机姓名和车牌号');
        return;
      }
    }

    setSubmitting(true);
    try {
      const update: any = {};
      if (actionMode === 'dispatch') {
        update.transferStatus = 'IN_TRANSIT';
        update.logisticsCompany = logisticsCompany || undefined;
        update.trackingNo = trackingNo || undefined;
        update.driverName = driverName;
        update.driverPhone = driverPhone || undefined;
        update.plateNo = plateNo;
        update.dispatchTime = new Date().toISOString();
      } else if (actionMode === 'arrive') {
        update.transferStatus = 'ARRIVED';
        update.arrivalTime = new Date().toISOString();
        update.remark = arrivalRemark || undefined;
      } else if (actionMode === 'receive') {
        update.transferStatus = 'RECEIVED';
        update.receiveTime = new Date().toISOString();
      }

      await warehouseApi.updateTransfer(selected.id, update);
      Alert.alert(
        '操作成功',
        actionMode === 'dispatch' ? '已发车' : actionMode === 'arrive' ? '已确认到达' : '已确认入库',
        [{ text: '确定', onPress: () => { setSelected(null); setActionMode(null); load(); } }]
      );
    } catch (err: any) {
      Alert.alert('操作失败', err.message || '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: TransferItem }) => {
    const meta = STATUS_META[item.transfer_status];
    return (
      <View style={[styles.card, { borderLeftColor: meta.color }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.transferNo}>{item.transfer_no}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <View style={styles.routeRow}>
          <Text style={styles.routeText}>{item.from_warehouse_name}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} style={{ marginHorizontal: 6 }} />
          <Text style={styles.routeText}>{item.to_warehouse_name}</Text>
        </View>
        <Text style={styles.detailLine}>
          {item.total_pieces} 件 · {item.total_weight_kg} kg
          {item.job_id ? ` · JOB: ${item.job_id}` : ''}
        </Text>
        {item.driver_name && (
          <Text style={styles.detailLine}>司机: {item.driver_name} · 车牌: {item.plate_no}</Text>
        )}

        <View style={styles.cardActions}>
          {item.transfer_status === 'PENDING' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => openAction(item, 'dispatch')}
            >
              <Text style={styles.actionBtnText}>执行发车</Text>
            </TouchableOpacity>
          )}
          {item.transfer_status === 'IN_TRANSIT' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              onPress={() => openAction(item, 'arrive')}
            >
              <Text style={styles.actionBtnText}>确认到达</Text>
            </TouchableOpacity>
          )}
          {item.transfer_status === 'ARRIVED' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSuccess]}
              onPress={() => openAction(item, 'receive')}
            >
              <Text style={styles.actionBtnText}>确认入库</Text>
            </TouchableOpacity>
          )}
          {item.transfer_status === 'RECEIVED' && (
            <Text style={styles.completedText}>✓ 已完成</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>调拨管理</Text>
        <TouchableOpacity onPress={load} style={styles.navBtn}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => {
            const active = filter === f.value;
            const count = f.value === 'ALL' ? list.length : list.filter((t) => t.transfer_status === f.value).length;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label} {count > 0 && `(${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="git-network-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无调拨任务</Text>
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

      {/* Action Modal */}
      <Modal visible={!!selected && !!actionMode} transparent animationType="slide" onRequestClose={() => { setSelected(null); setActionMode(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalMask}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {actionMode === 'dispatch' && '🚚 执行发车'}
                  {actionMode === 'arrive' && '🚩 确认到达'}
                  {actionMode === 'receive' && '📦 确认入库'}
                </Text>
                <TouchableOpacity onPress={() => { setSelected(null); setActionMode(null); }}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {selected && (
                <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
                  {/* 调拨信息 */}
                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>{selected.transfer_no}</Text>
                    <Text style={styles.infoLine}>{selected.from_warehouse_name} → {selected.to_warehouse_name}</Text>
                    <Text style={styles.infoLine}>{selected.total_pieces} 件 · {selected.total_weight_kg} kg</Text>
                  </View>

                  {actionMode === 'dispatch' && (
                    <>
                      <FormField label="承运公司" value={logisticsCompany} onChangeText={setLogisticsCompany} placeholder="选填" />
                      <FormField label="送货单号" value={trackingNo} onChangeText={setTrackingNo} placeholder="选填" />
                      <FormField label="司机姓名 *" value={driverName} onChangeText={setDriverName} placeholder="必填" />
                      <FormField label="司机电话" value={driverPhone} onChangeText={setDriverPhone} placeholder="选填" keyboardType="phone-pad" />
                      <FormField label="车牌号 *" value={plateNo} onChangeText={setPlateNo} placeholder="如：粤A88888" />
                    </>
                  )}

                  {actionMode === 'arrive' && (
                    <>
                      <View style={styles.tipCard}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                        <Text style={styles.tipText}>司机已抵达目标仓库，确认后调拨单状态变为"已到达"</Text>
                      </View>
                      <View style={styles.formItem}>
                        <Text style={styles.formLabel}>到达备注</Text>
                        <TextInput
                          style={styles.textarea}
                          value={arrivalRemark}
                          onChangeText={setArrivalRemark}
                          placeholder="可选"
                          placeholderTextColor={colors.textTertiary}
                          multiline
                        />
                      </View>
                    </>
                  )}

                  {actionMode === 'receive' && (
                    <View style={styles.tipCard}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                      <Text style={styles.tipText}>确认所有货物已收到入库，调拨单完成</Text>
                    </View>
                  )}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {actionMode === 'dispatch' && '确认发车'}
                    {actionMode === 'arrive' && '确认到达'}
                    {actionMode === 'receive' && '确认入库'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'decimal-pad';
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: FormFieldProps) {
  return (
    <View style={styles.formItem}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },

  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  filterRow: { paddingVertical: spacing.md, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  listContent: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  transferNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  routeText: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
  detailLine: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnSuccess: { backgroundColor: colors.success },
  actionBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
  completedText: { fontSize: font.sm, color: colors.success, fontWeight: '600' },

  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },

  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  infoTitle: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono, marginBottom: 4 },
  infoLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },

  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.card },

  tipCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info },

  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
});
