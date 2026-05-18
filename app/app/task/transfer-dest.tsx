import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, Alert, ActivityIndicator, Modal, Platform,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

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

const DEST_WAREHOUSES = ['LOS 总仓', 'ABV 分仓', 'ACC 分仓', 'IKEJ 站点', 'VI 站点'];

export default function TransferDestScreen() {
  const router = useRouter();
  const [list, setList] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [selected, setSelected] = useState<TransferItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 执行表单
  const [logisticsCompany, setLogisticsCompany] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNo, setPlateNo] = useState('');
  const [arrivalRemark, setArrivalRemark] = useState('');
  const [actionMode, setActionMode] = useState<'dispatch' | 'arrive' | null>(null);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getTransfers();
      // 到达国仓管只显示到达国仓库间的调拨
      const destList = (res.data || []).filter((t: TransferItem) =>
        DEST_WAREHOUSES.some((w) =>
          t.from_warehouse_name?.includes(w) || t.to_warehouse_name?.includes(w)
        )
      );
      setList(destList.length > 0 ? destList : res.data || []);
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

  const filtered = useMemo(() => {
    if (filter === 'ALL') return list;
    return list.filter((t) => t.transfer_status === filter);
  }, [list, filter]);

  const openAction = (item: TransferItem, mode: 'dispatch' | 'arrive') => {
    setSelected(item);
    setActionMode(mode);
    setLogisticsCompany('');
    setTrackingNo('');
    setDriverName('');
    setDriverPhone('');
    setPlateNo('');
    setArrivalRemark('');
  };

  const handleDispatch = async () => {
    if (!selected) return;
    if (!driverName.trim()) { Alert.alert('请填写司机姓名'); return; }
    setSubmitting(true);
    try {
      await warehouseApi.updateTransfer(selected.id, {
        driver_name: driverName,
        driver_phone: driverPhone,
        plate_no: plateNo,
        dispatch_time: new Date().toISOString(),
      });
      Alert.alert('发运成功', `${selected.transfer_no} 已出发`);
      setSelected(null); setActionMode(null);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      Alert.alert('发运失败', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArrive = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await warehouseApi.updateTransfer(selected.id, {
        arrival_time: new Date().toISOString(),
        remark: arrivalRemark || undefined,
      });
      Alert.alert('到达确认', `${selected.transfer_no} 已标记为到达`);
      setSelected(null); setActionMode(null);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      Alert.alert('确认失败', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: TransferItem }) => {
    const meta = STATUS_META[item.transfer_status] || STATUS_META.PENDING;
    return (
      <View style={[styles.card, { borderLeftColor: meta.color }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.transferNo}>{item.transfer_no}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.routeLine}>{item.from_warehouse_name} → {item.to_warehouse_name}</Text>
        <Text style={styles.infoLine}>
          {item.total_pieces}件 · {item.total_weight_kg}kg
          {item.route_label ? ` · ${item.route_label}` : ''}
        </Text>
        {item.driver_name && (
          <Text style={styles.driverLine}>司机：{item.driver_name} · {item.plate_no || '-'}</Text>
        )}
        <Text style={styles.timeLine}>{item.created_at?.substring(0, 16)}</Text>

        {/* Inline actions per status */}
        <View style={styles.actionRow}>
          {item.transfer_status === 'PENDING' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => openAction(item, 'dispatch')}>
              <Ionicons name="car-outline" size={16} color={colors.primary} />
              <Text style={styles.actionBtnText}>执行发车</Text>
            </TouchableOpacity>
          )}
          {item.transfer_status === 'IN_TRANSIT' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => openAction(item, 'arrive')}>
              <Ionicons name="flag-outline" size={16} color={colors.success} />
              <Text style={[styles.actionBtnText, { color: colors.success }]}>确认到达</Text>
            </TouchableOpacity>
          )}
          {item.transfer_status === 'ARRIVED' && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => router.push({ pathname: '/task/transfer-inbound' as any, params: { transferId: item.id, type: 'TRANSFER' } })}
            >
              <Ionicons name="scan-outline" size={16} color={colors.taskDispatch} />
              <Text style={[styles.actionBtnText, { color: colors.taskDispatch }]}>扫码入库</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>到达国调拨</Text>
        <TouchableOpacity
          onPress={() => router.push('/task/transfer-dest-create' as any)}
          style={styles.navCreateBtn}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.navCreateText}>新建</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tip */}
      <View style={styles.tipBar}>
        <Ionicons name="information-circle-outline" size={16} color={colors.info} />
        <Text style={styles.tipText}>到达国站点间库存调拨，支持总仓↔分仓↔站点</Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="swap-horizontal-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无到达国调拨记录</Text>
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

      {/* Dispatch Modal */}
      <Modal visible={actionMode === 'dispatch' && !!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>执行发车</Text>
              <TouchableOpacity onPress={() => { setSelected(null); setActionMode(null); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selected && (
              <ScrollView>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalTransferNo}>{selected.transfer_no}</Text>
                  <Text style={styles.modalRoute}>{selected.from_warehouse_name} → {selected.to_warehouse_name}</Text>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>司机姓名 *</Text>
                  <TextInput style={styles.modalInput} value={driverName} onChangeText={setDriverName} placeholder="必填" placeholderTextColor={colors.textTertiary} />
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>联系电话</Text>
                  <TextInput style={styles.modalInput} value={driverPhone} onChangeText={setDriverPhone} placeholder="选填" placeholderTextColor={colors.textTertiary} keyboardType="phone-pad" />
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>车牌号</Text>
                  <TextInput style={styles.modalInput} value={plateNo} onChangeText={setPlateNo} placeholder="选填" placeholderTextColor={colors.textTertiary} />
                </View>
                <TouchableOpacity
                  style={[styles.modalSubmit, submitting && { opacity: 0.6 }]}
                  onPress={handleDispatch}
                  disabled={submitting}
                >
                  <Text style={styles.modalSubmitText}>{submitting ? '提交中...' : '确认发车'}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Arrive Modal */}
      <Modal visible={actionMode === 'arrive' && !!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>确认到达</Text>
              <TouchableOpacity onPress={() => { setSelected(null); setActionMode(null); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {selected && (
              <ScrollView>
                <View style={styles.modalInfo}>
                  <Text style={styles.modalTransferNo}>{selected.transfer_no}</Text>
                  <Text style={styles.modalRoute}>{selected.from_warehouse_name} → {selected.to_warehouse_name}</Text>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>到达备注</Text>
                  <TextInput
                    style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={arrivalRemark}
                    onChangeText={setArrivalRemark}
                    placeholder="选填，如：货物完好、包装无损"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalSubmit, { backgroundColor: colors.success }, submitting && { opacity: 0.6 }]}
                  onPress={handleArrive}
                  disabled={submitting}
                >
                  <Text style={styles.modalSubmitText}>{submitting ? '提交中...' : '确认到达'}</Text>
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
  filterRow: { paddingVertical: spacing.md, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  tipBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.infoLight, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info },
  listContent: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderLeftWidth: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  transferNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  routeLine: { fontSize: font.md, color: colors.text, fontWeight: '600', marginBottom: 4 },
  infoLine: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  driverLine: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  timeLine: { fontSize: font.xs, color: colors.textTertiary, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryLight },
  actionBtnText: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },
  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  modalInfo: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  modalTransferNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  modalRoute: { fontSize: font.sm, color: colors.textSecondary, marginTop: 4 },
  modalField: { marginBottom: spacing.md },
  modalLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.bg },
  modalSubmit: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  modalSubmitText: { color: '#fff', fontSize: font.lg, fontWeight: '600' },
});
