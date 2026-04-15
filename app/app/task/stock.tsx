import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, FlatList, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';

type StockStatus = 'IN_STOCK' | 'ALLOCATED' | 'PACKED' | 'OUTBOUND' | 'RETURNED' | 'DAMAGED';

interface StockItem {
  id: string;
  order_no: string;
  customer_name: string;
  route_code: string;
  consignee_name: string;
  sub_order_no: string;
  stock_status: StockStatus;
  pieces: number;
  gross_weight_kg: number;
  volume_cbm: number;
  location_code: string;
  warehouse_id: string;
  created_at: string;
}

const STATUS_FILTERS: { value: StockStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'IN_STOCK', label: '在库' },
  { value: 'ALLOCATED', label: '已分配' },
  { value: 'PACKED', label: '已装箱' },
  { value: 'OUTBOUND', label: '已出库' },
];

const STATUS_META: Record<StockStatus, { label: string; color: string; bg: string }> = {
  IN_STOCK:  { label: '在库',   color: colors.success, bg: colors.successLight },
  ALLOCATED: { label: '已分配', color: colors.info,    bg: colors.infoLight },
  PACKED:    { label: '已装箱', color: colors.primary, bg: colors.primaryLight },
  OUTBOUND:  { label: '已出库', color: colors.textSecondary, bg: colors.borderLight },
  RETURNED:  { label: '已退回', color: colors.warning, bg: colors.warningLight },
  DAMAGED:   { label: '损坏',   color: colors.danger,  bg: colors.dangerLight },
};

export default function StockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ destination?: string }>();
  const isDestination = params.destination === '1';
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<StockItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StockStatus | 'ALL'>('ALL');
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [editingLocation, setEditingLocation] = useState('');
  // 退运
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnRecipient, setReturnRecipient] = useState('');
  const [returnPhone, setReturnPhone] = useState('');
  const [returnAddress, setReturnAddress] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 15000);
    return () => clearInterval(timer);
  }, []);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 到达国筛选 wh-los/wh-abv/wh-acc 仓库；起运国筛选 wh-gz/wh-sz
      const warehouseIds = isDestination ? ['wh-los', 'wh-abv', 'wh-acc'] : ['wh-gz', 'wh-sz'];
      const res = await warehouseApi.getStock();
      const filtered = (res.data || []).filter((s: StockItem) =>
        !s.warehouse_id || warehouseIds.includes(s.warehouse_id)
      );
      setList(filtered);
    } catch (err: any) {
      if (!silent) Alert.alert('加载失败', err.message || '请重试');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return list.filter((s) => {
      if (status !== 'ALL' && s.stock_status !== status) return false;
      if (keyword) {
        const k = keyword.toLowerCase();
        return (
          s.order_no?.toLowerCase().includes(k) ||
          s.sub_order_no?.toLowerCase().includes(k) ||
          s.customer_name?.toLowerCase().includes(k) ||
          s.location_code?.toLowerCase().includes(k)
        );
      }
      return true;
    });
  }, [list, status, keyword]);

  const stats = useMemo(() => {
    const total = list.length;
    const inStock = list.filter((s) => s.stock_status === 'IN_STOCK').length;
    const totalWeight = list.reduce((sum, s) => sum + (s.gross_weight_kg || 0), 0);
    return { total, inStock, totalWeight };
  }, [list]);

  const handleOpenDetail = (item: StockItem) => {
    setSelected(item);
    setEditingLocation(item.location_code || '');
  };

  const handleSaveLocation = () => {
    if (!selected) return;
    // Demo: 仅本地更新
    setList((prev) => prev.map((s) => s.id === selected.id ? { ...s, location_code: editingLocation } : s));
    Alert.alert('库位已更新', `${selected.sub_order_no} → ${editingLocation}`);
    setSelected(null);
  };

  const handleReprint = () => {
    if (!selected) return;
    Alert.alert('打印中', `正在补打面单：${selected.sub_order_no}\n已发送到蓝牙打印机`);
    setSelected(null);
  };

  const openReturnDialog = () => {
    setReturnReason('');
    setReturnRecipient('');
    setReturnPhone('');
    setReturnAddress('');
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!selected) return;
    if (!returnReason.trim()) { Alert.alert('请填写退运原因'); return; }
    setReturnSubmitting(true);
    try {
      await warehouseApi.applyReturn(selected.id, {
        reason: returnReason,
        recipientName: returnRecipient || undefined,
        recipientPhone: returnPhone || undefined,
        recipientAddress: returnAddress || undefined,
      });
      Alert.alert('已提交退运', `${selected.sub_order_no} 已进入退运流程`, [
        { text: '确定', onPress: () => {
          setReturnOpen(false);
          setSelected(null);
          load();
        }},
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请重试';
      Alert.alert('提交失败', message);
    } finally {
      setReturnSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: StockItem }) => {
    const meta = STATUS_META[item.stock_status] || STATUS_META.IN_STOCK;
    return (
      <TouchableOpacity style={styles.card} onPress={() => handleOpenDetail(item)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.subOrderNo}>{item.sub_order_no}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        <Text style={styles.customerLine} numberOfLines={1}>
          {item.customer_name} · {item.route_code}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.footerText}>{item.pieces}件 · {item.gross_weight_kg}kg</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={[styles.footerText, { color: colors.primary, fontWeight: '600' }]}>
              {item.location_code || '未上架'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{isDestination ? '到达国库存查询' : '库存管理'}</Text>
        <TouchableOpacity onPress={() => load()} style={styles.navBtn}>
          <Ionicons name="refresh" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search + Scan */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索运单号 / 客户 / 库位"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => setKeyword('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.scanBtn}>
          <Ionicons name="scan-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>总库存</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.success }]}>{stats.inStock}</Text>
          <Text style={styles.statLabel}>在库件</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalWeight.toFixed(1)}</Text>
          <Text style={styles.statLabel}>总重(kg)</Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => {
            const active = status === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatus(f.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无库存数据</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>库存详情</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
                {/* Tag bar */}
                <View style={styles.detailTagRow}>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_META[selected.stock_status].bg }]}>
                    <Text style={[styles.statusText, { color: STATUS_META[selected.stock_status].color }]}>
                      {STATUS_META[selected.stock_status].label}
                    </Text>
                  </View>
                  <Text style={styles.warehouseTag}>📦 {selected.warehouse_id === 'wh-gz' ? '广州总仓' : selected.warehouse_id === 'wh-sz' ? '深圳分仓' : selected.warehouse_id}</Text>
                </View>

                {/* Info rows */}
                <DetailRow label="子运单号" value={selected.sub_order_no} mono />
                <DetailRow label="主单号" value={selected.order_no} mono />
                <DetailRow label="客户" value={selected.customer_name} />
                <DetailRow label="路线" value={selected.route_code} />
                <DetailRow label="收件人" value={selected.consignee_name} />
                <DetailRow label="件数" value={`${selected.pieces} 件`} />
                <DetailRow label="重量" value={`${selected.gross_weight_kg} kg`} />
                <DetailRow label="体积" value={`${selected.volume_cbm} m³`} />
                <DetailRow label="入库时间" value={selected.created_at} />

                {/* Location editor */}
                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>📍 库位号</Text>
                  <View style={styles.editRow}>
                    <TextInput
                      style={styles.editInput}
                      value={editingLocation}
                      onChangeText={setEditingLocation}
                      placeholder="输入或扫描新库位"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <TouchableOpacity style={styles.editScanBtn}>
                      <Ionicons name="scan-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleReprint}>
                    <Ionicons name="print-outline" size={18} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>补打面单</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleSaveLocation}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={[styles.actionText, { color: '#fff' }]}>保存库位</Text>
                  </TouchableOpacity>
                </View>
                {selected.stock_status === 'IN_STOCK' && !isDestination && (
                  <TouchableOpacity
                    style={{
                      marginTop: spacing.md,
                      height: 44,
                      borderWidth: 1,
                      borderColor: colors.warning,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 6,
                      backgroundColor: colors.warningLight,
                    }}
                    onPress={openReturnDialog}
                  >
                    <Ionicons name="return-down-back-outline" size={18} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontSize: font.md, fontWeight: '600' }}>申请退运</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 退运 Modal */}
      <Modal
        visible={returnOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReturnOpen(false)}
      >
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>↩️ 申请退运</Text>
              <TouchableOpacity onPress={() => setReturnOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView>
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    marginBottom: spacing.md,
                    borderLeftWidth: 3,
                    borderLeftColor: colors.warning,
                  }}
                >
                  <Text style={{ fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary }}>
                    {selected.sub_order_no}
                  </Text>
                  <Text style={{ fontSize: font.xs, color: colors.textSecondary, marginTop: 2 }}>
                    {selected.customer_name} · {selected.pieces}件 · {selected.gross_weight_kg}kg
                  </Text>
                </View>

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 }}>退运原因 *</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      minHeight: 72,
                      fontSize: font.md,
                      color: colors.text,
                      backgroundColor: colors.card,
                      textAlignVertical: 'top',
                    }}
                    value={returnReason}
                    onChangeText={setReturnReason}
                    placeholder="如：客户取消、货物损坏、地址错误..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                </View>

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 }}>退回收件人</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      height: 44,
                      fontSize: font.md,
                      color: colors.text,
                      backgroundColor: colors.card,
                    }}
                    value={returnRecipient}
                    onChangeText={setReturnRecipient}
                    placeholder="默认为原发件人"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 }}>联系电话</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      height: 44,
                      fontSize: font.md,
                      color: colors.text,
                      backgroundColor: colors.card,
                    }}
                    value={returnPhone}
                    onChangeText={setReturnPhone}
                    placeholder="选填"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={{ marginBottom: spacing.lg }}>
                  <Text style={{ fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 }}>退回地址</Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      minHeight: 60,
                      fontSize: font.md,
                      color: colors.text,
                      backgroundColor: colors.card,
                      textAlignVertical: 'top',
                    }}
                    value={returnAddress}
                    onChangeText={setReturnAddress}
                    placeholder="选填"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                {
                  height: 52,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.warning,
                  marginTop: spacing.sm,
                },
                returnSubmitting && { opacity: 0.6 },
              ]}
              onPress={submitReturn}
              disabled={returnSubmitting}
            >
              <Text style={{ color: '#fff', fontSize: font.lg, fontWeight: '600' }}>
                {returnSubmitting ? '提交中...' : '提交退运申请'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && { fontFamily: font.mono, color: colors.primary }]} numberOfLines={2}>
        {value || '-'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  // Nav
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  // Search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },
  scanBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  // Stats
  statsRow: { flexDirection: 'row', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.md },
  statValue: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  // Filter
  filterRow: { paddingVertical: spacing.md, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  // List
  listContent: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  subOrderNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary, flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  customerLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: font.xs, color: colors.textSecondary },
  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  detailTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  warehouseTag: { fontSize: font.xs, color: colors.textSecondary, backgroundColor: colors.bg, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight, gap: spacing.md },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary, width: 80 },
  detailValue: { flex: 1, fontSize: font.sm, color: colors.text, textAlign: 'right', fontWeight: '500' },
  editSection: { marginTop: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md },
  editLabel: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  editRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  editInput: { flex: 1, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: font.md, backgroundColor: colors.card, color: colors.text },
  editScanBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  actionBtnSecondary: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.card },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionText: { fontSize: font.md, fontWeight: '600' },
});
