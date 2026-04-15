import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type InboundMode = 'SCAN' | 'MANUAL';
type ItemStatus = 'PENDING' | 'RECEIVED';

interface TransferItem {
  id: string;
  sub_order_no: string;
  tracking_no: string | null;
  customer_name: string | null;
  pieces: number;
  weight_kg: number;
  volume_cbm: number;
  route: string | null;
  inbound_status: ItemStatus;
  inbound_method: 'SCAN' | 'MANUAL' | null;
  inbound_time: string | null;
}

interface TransferDetail {
  id: string;
  transfer_no: string;
  from_warehouse_name: string;
  to_warehouse_name: string;
  route_label: string | null;
  shipping_unit_no: string | null;
  total_pieces: number;
  total_weight_kg: number;
  transfer_status: string;
  items: TransferItem[];
}

export default function TransferInboundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; transferNo?: string; type?: 'TRANSFER' | 'RETURN' }>();
  const transferId = (params.id || params.transferNo) as string | undefined;
  const inboundType = (params.type as string) || 'TRANSFER';
  const pageTitle = inboundType === 'RETURN' ? '退回入库' : '调拨到仓入库';

  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<InboundMode>('SCAN');
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // 手动添加表单
  const [manualVisible, setManualVisible] = useState(false);
  const [mSubOrderNo, setMSubOrderNo] = useState('');
  const [mTrackingNo, setMTrackingNo] = useState('');
  const [mCustomerName, setMCustomerName] = useState('');
  const [mPieces, setMPieces] = useState('1');
  const [mWeight, setMWeight] = useState('');
  const [adding, setAdding] = useState(false);

  useFocusEffect(useCallback(() => {
    if (transferId) load();
  }, [transferId]));

  const load = async () => {
    if (!transferId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await warehouseApi.getTransferDetail(transferId);
      setDetail(res.data);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    if (!detail) return { total: 0, received: 0, pending: 0 };
    const total = detail.items.length;
    const received = detail.items.filter((i) => i.inbound_status === 'RECEIVED').length;
    return { total, received, pending: total - received };
  }, [detail]);

  const handleScan = async () => {
    const keyword = scanInput.trim();
    if (!keyword || !detail) {
      Alert.alert('请扫描或输入集装号/运单号');
      return;
    }
    setScanning(true);
    try {
      const res = await warehouseApi.scanInboundTransfer(detail.id, { keyword, method: 'SCAN' });
      const updated = res.data?.updated || 0;
      const hits = res.data?.hits || [];
      if (updated === 0) {
        Alert.alert('未匹配', `运单号 ${keyword} 不在本调拨单中或已入库`);
      } else {
        if (hits[0]) setHighlightedId(hits[0]);
        setScanInput('');
        await load();
      }
    } catch (err: any) {
      Alert.alert('扫码失败', err.message || '请重试');
    } finally {
      setScanning(false);
    }
  };

  // 点击列表项手动切换状态（手动模式）
  const handleToggleItem = async (item: TransferItem) => {
    if (mode !== 'MANUAL') return;
    if (item.inbound_status === 'RECEIVED') return; // 已入库的不切换回去
    if (!detail) return;
    try {
      await warehouseApi.scanInboundTransfer(detail.id, {
        keyword: item.sub_order_no,
        method: 'MANUAL',
      });
      setHighlightedId(item.id);
      await load();
    } catch (err: any) {
      Alert.alert('入库失败', err.message || '请重试');
    }
  };

  const handleAddManual = async () => {
    if (!mSubOrderNo.trim()) { Alert.alert('请填写运单号'); return; }
    if (!detail) return;
    setAdding(true);
    try {
      await warehouseApi.addTransferItem(detail.id, {
        subOrderNo: mSubOrderNo,
        trackingNo: mTrackingNo || undefined,
        customerName: mCustomerName || undefined,
        pieces: Number(mPieces) || 1,
        weightKg: Number(mWeight) || 0,
        autoInbound: true,
      });
      Alert.alert('已添加并入库', `${mSubOrderNo}`, [
        { text: '继续添加', onPress: () => { resetManual(); load(); } },
        { text: '完成', onPress: () => { resetManual(); setManualVisible(false); load(); } },
      ]);
    } catch (err: any) {
      Alert.alert('添加失败', err.message || '请重试');
    } finally {
      setAdding(false);
    }
  };

  const resetManual = () => {
    setMSubOrderNo(''); setMTrackingNo(''); setMCustomerName(''); setMPieces('1'); setMWeight('');
  };

  const handleFinalConfirm = () => {
    if (!detail) return;
    if (Platform.OS === 'web') {
      const ok = window.confirm(`确定 ${detail.transfer_no} 完成入库吗？\n所有未入库运单将一并标记为已入库。`);
      if (ok) doConfirm();
    } else {
      Alert.alert(
        '最终确认入库',
        `确定 ${detail.transfer_no} 完成入库吗？\n所有未入库运单将一并标记为已入库。`,
        [
          { text: '取消', style: 'cancel' },
          { text: '确认', style: 'destructive', onPress: doConfirm },
        ]
      );
    }
  };

  const doConfirm = async () => {
    if (!detail) return;
    setConfirming(true);
    try {
      await warehouseApi.confirmTransferInbound(detail.id);
      Alert.alert('入库完成', `${detail.transfer_no} 已最终确认`, [
        { text: '完成', onPress: () => safeBack(router) },
      ]);
    } catch (err: any) {
      Alert.alert('提交失败', err.message || '请重试');
    } finally {
      setConfirming(false);
    }
  };

  const renderItem = ({ item }: { item: TransferItem }) => {
    const isReceived = item.inbound_status === 'RECEIVED';
    const isHighlighted = highlightedId === item.id;
    return (
      <TouchableOpacity
        style={[
          styles.itemCard,
          isReceived && styles.itemCardReceived,
          !isReceived && mode === 'MANUAL' && styles.itemCardClickable,
          isHighlighted && styles.itemCardHighlight,
        ]}
        onPress={() => handleToggleItem(item)}
        activeOpacity={mode === 'MANUAL' && !isReceived ? 0.7 : 1}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.itemNo}>{item.sub_order_no}</Text>
          <View style={[
            styles.statusBadge,
            isReceived ? styles.statusBadgeReceived : styles.statusBadgePending,
          ]}>
            <Ionicons
              name={isReceived ? 'checkmark-circle' : 'ellipse-outline'}
              size={14}
              color={isReceived ? colors.success : colors.warning}
            />
            <Text style={[styles.statusBadgeText, isReceived ? { color: colors.success } : { color: colors.warning }]}>
              {isReceived ? '已入库' : '待入库'}
            </Text>
          </View>
        </View>
        {item.tracking_no && <Text style={styles.itemSubLine}>第三方：{item.tracking_no}</Text>}
        {item.customer_name && <Text style={styles.itemSubLine}>{item.customer_name}</Text>}
        <View style={styles.itemFooter}>
          <Text style={styles.itemMeta}>{item.pieces}件 · {item.weight_kg}kg</Text>
          {isReceived && item.inbound_method && (
            <Text style={styles.itemMethodTag}>{item.inbound_method === 'SCAN' ? '🔍 扫码' : '✏️ 手动'}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>调拨入库</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>未找到调拨单</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Nav */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{pageTitle}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 调拨信息卡 */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoNo}>{detail.transfer_no}</Text>
              <View style={styles.infoBadge}>
                <Text style={styles.infoBadgeText}>{detail.transfer_status === 'ARRIVED' ? '待入库' : detail.transfer_status}</Text>
              </View>
            </View>
            <View style={styles.routeRow}>
              <Text style={styles.routeText}>{detail.from_warehouse_name}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} style={{ marginHorizontal: 6 }} />
              <Text style={styles.routeText}>{detail.to_warehouse_name}</Text>
            </View>
            {detail.shipping_unit_no && (
              <View style={styles.unitRow}>
                <Ionicons name="cube" size={14} color={colors.primary} />
                <Text style={styles.unitText}>集装号：{detail.shipping_unit_no}</Text>
              </View>
            )}
          </View>

          {/* 进度统计 */}
          <View style={styles.statsCard}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>总运单</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxSuccess]}>
              <Text style={[styles.statValue, { color: colors.success }]}>{stats.received}</Text>
              <Text style={styles.statLabel}>已入库</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxWarning]}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>待入库</Text>
            </View>
          </View>

          {/* 模式切换 */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'SCAN' && styles.modeBtnActive]}
              onPress={() => setMode('SCAN')}
            >
              <Ionicons name="scan" size={18} color={mode === 'SCAN' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.modeText, mode === 'SCAN' && styles.modeTextActive]}>扫码入库</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'MANUAL' && styles.modeBtnActive]}
              onPress={() => setMode('MANUAL')}
            >
              <Ionicons name="create" size={18} color={mode === 'MANUAL' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.modeText, mode === 'MANUAL' && styles.modeTextActive]}>手动入库</Text>
            </TouchableOpacity>
          </View>

          {/* 扫码输入区 */}
          {mode === 'SCAN' && (
            <View style={styles.scanCard}>
              <Text style={styles.scanLabel}>📷 扫描集装号或运单号</Text>
              <View style={styles.scanInputRow}>
                <TextInput
                  style={styles.scanInput}
                  value={scanInput}
                  onChangeText={setScanInput}
                  placeholder="扫描后回车 / 输入运单号"
                  placeholderTextColor={colors.textTertiary}
                  onSubmitEditing={handleScan}
                  returnKeyType="done"
                  autoFocus
                />
                <TouchableOpacity style={styles.scanIconBtn}>
                  <Ionicons name="scan-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.recordBtn, scanning && styles.btnDisabled]}
                onPress={handleScan}
                disabled={scanning}
              >
                {scanning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.recordBtnText}>记录入库</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.scanHint}>
                💡 扫集装号 = 整箱完成入库；扫运单号 = 逐票登记
              </Text>
            </View>
          )}

          {/* 手动模式提示 */}
          {mode === 'MANUAL' && (
            <View style={styles.manualCard}>
              <Text style={styles.manualLabel}>✏️ 手动入库</Text>
              <Text style={styles.manualHint}>
                点击下方运单卡片即可标记入库；如需添加新运单点下方按钮
              </Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => setManualVisible(true)}>
                <Ionicons name="add-circle" size={20} color={colors.primary} />
                <Text style={styles.addBtnText}>添加新运单</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 运单列表 */}
          <View style={styles.listSection}>
            <Text style={styles.listTitle}>运单清单 ({detail.items.length})</Text>
            {detail.items.length === 0 ? (
              <Text style={styles.empty}>暂无运单</Text>
            ) : (
              detail.items.map((item) => (
                <View key={item.id}>{renderItem({ item })}</View>
              ))
            )}
          </View>
        </ScrollView>

        {/* 底部最终确认 */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomStats}>
            <Text style={styles.bottomStatsText}>
              已入库 <Text style={styles.bottomStatsHi}>{stats.received}</Text> / {stats.total}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmBtn, confirming && styles.btnDisabled]}
            onPress={handleFinalConfirm}
            disabled={confirming}
          >
            {confirming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.confirmBtnText}>最终确认入库</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 手动添加 Modal */}
        <Modal visible={manualVisible} transparent animationType="slide" onRequestClose={() => setManualVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={styles.modalMask}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>✏️ 手动添加运单</Text>
                  <TouchableOpacity onPress={() => setManualVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView>
                  <ManualField label="运单号 *" value={mSubOrderNo} onChangeText={setMSubOrderNo} placeholder="必填" />
                  <ManualField label="第三方运单号" value={mTrackingNo} onChangeText={setMTrackingNo} placeholder="选填" />
                  <ManualField label="客户" value={mCustomerName} onChangeText={setMCustomerName} placeholder="选填" />
                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <ManualField label="件数 *" value={mPieces} onChangeText={setMPieces} placeholder="1" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ManualField label="重量(kg)" value={mWeight} onChangeText={setMWeight} placeholder="0" keyboardType="decimal-pad" />
                    </View>
                  </View>
                </ScrollView>
                <TouchableOpacity
                  style={[styles.submitBtn, adding && styles.btnDisabled]}
                  onPress={handleAddManual}
                  disabled={adding}
                >
                  {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>添加并入库</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface ManualFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad';
}

function ManualField({ label, value, onChangeText, placeholder, keyboardType }: ManualFieldProps) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.formInput}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },

  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  scroll: { padding: spacing.md, paddingBottom: 140 },

  // 调拨信息卡
  infoCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.primary },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  infoNo: { fontSize: font.lg, fontWeight: '700', color: colors.primary, fontFamily: font.mono },
  infoBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  infoBadgeText: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  routeText: { fontSize: font.md, color: colors.text, fontWeight: '500' },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  unitText: { fontSize: font.sm, color: colors.primary, fontWeight: '500' },

  // 进度统计
  statsCard: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  statBox: { flex: 1, alignItems: 'center', padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md },
  statBoxSuccess: { backgroundColor: colors.successLight },
  statBoxWarning: { backgroundColor: colors.warningLight },
  statValue: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  // 模式切换
  modeRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4, marginBottom: spacing.md, gap: 4 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.sm },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { fontSize: font.md, color: colors.textSecondary, fontWeight: '500' },
  modeTextActive: { color: '#fff', fontWeight: '700' },

  // 扫码区
  scanCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  scanLabel: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  scanInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  scanInput: { flex: 1, height: 52, borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: font.lg, color: colors.text, fontFamily: font.mono, backgroundColor: colors.bg },
  scanIconBtn: { width: 52, height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  recordBtn: { flexDirection: 'row', height: 52, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  recordBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  scanHint: { fontSize: font.xs, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm },

  // 手动模式
  manualCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  manualLabel: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  manualHint: { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.md },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  addBtnText: { color: colors.primary, fontSize: font.md, fontWeight: '600' },

  // 列表
  listSection: { marginBottom: spacing.md },
  listTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  empty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },

  itemCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 4, borderLeftColor: colors.warning },
  itemCardReceived: { borderLeftColor: colors.success, backgroundColor: '#f0fdf4' },
  itemCardClickable: { borderColor: colors.primary, borderWidth: 1, borderLeftWidth: 4 },
  itemCardHighlight: { borderLeftColor: colors.info, backgroundColor: colors.infoLight },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  statusBadgePending: { backgroundColor: colors.warningLight },
  statusBadgeReceived: { backgroundColor: colors.successLight },
  statusBadgeText: { fontSize: font.xs, fontWeight: '600' },
  itemSubLine: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  itemMeta: { fontSize: font.xs, color: colors.textSecondary },
  itemMethodTag: { fontSize: font.xs, color: colors.success, fontWeight: '600' },

  // 底部
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight, gap: spacing.sm },
  bottomStats: { alignItems: 'center' },
  bottomStatsText: { fontSize: font.sm, color: colors.textSecondary },
  bottomStatsHi: { color: colors.success, fontWeight: '700', fontSize: font.md },
  confirmBtn: { flexDirection: 'row', height: 56, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, shadowColor: colors.primary, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  confirmBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '700', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },

  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },

  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  row2: { flexDirection: 'row', gap: spacing.md },
  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
});
