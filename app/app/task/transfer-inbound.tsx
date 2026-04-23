import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

// 动态引入 expo-camera,Web 预览降级
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('expo-camera');
    CameraView = mod.CameraView;
    useCameraPermissions = mod.useCameraPermissions;
  } catch {/* */}
}

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
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // 连续扫码 toast + 相机
  const scanInputRef = useRef<TextInput>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warn'; text: string; detail?: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, () => {}];
  const showToast = (type: 'success' | 'error' | 'warn', text: string, d?: string) => {
    setToast({ type, text, detail: d });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500) as unknown as number;
  };

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

  const handleScan = async (override?: string) => {
    const keyword = (override || scanInput).trim();
    // 立即清空 + 保焦点,准备下一次扫码
    setScanInput('');
    scanInputRef.current?.focus();
    if (!keyword || !detail) return;

    // 600ms 同值去重
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === keyword && now - lastScanRef.current.at < 600) return;
    lastScanRef.current = { code: keyword, at: now };

    setScanning(true);
    try {
      const res = await warehouseApi.scanInboundTransfer(detail.id, { keyword, method: 'SCAN' });
      const updated = res.data?.updated || 0;
      const hits = res.data?.hits || [];
      if (updated === 0) {
        showToast('warn', '未匹配', `${keyword} 不在本调拨单或已入库`);
      } else {
        if (hits[0]) setHighlightedId(hits[0]);
        showToast('success', `✓ 已入库 ${updated} 件`, keyword);
        await load();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      showToast('error', '扫码失败', msg);
    } finally {
      setScanning(false);
      scanInputRef.current?.focus();
    }
  };

  // 相机扫码回调
  const handleBarcodeScanned = (event: { data: string }) => {
    if (!event?.data) return;
    void handleScan(String(event.data));
  };

  // 页面挂载时主动请求相机权限
  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // 点击列表项手动入库(已入库的不可撤销)
  const handleToggleItem = async (item: TransferItem) => {
    if (item.inbound_status === 'RECEIVED' || !detail) return;
    try {
      await warehouseApi.scanInboundTransfer(detail.id, {
        keyword: item.sub_order_no,
        method: 'MANUAL',
      });
      setHighlightedId(item.id);
      showToast('success', `✓ 手动入库 ${item.sub_order_no}`);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      showToast('error', '入库失败', msg);
    }
  };

  // 扫码区:原生相机,Web 方形占位
  const renderScanner = () => {
    if (Platform.OS === 'web' || !CameraView) {
      return (
        <View style={styles.scannerWebArea}>
          <View style={styles.scannerStatusBar}>
            <Text style={styles.scannerStatusText}>
              ● {scanning ? '处理中...' : '就绪 · 对准条码自动识别'}
            </Text>
          </View>
          <View style={styles.scanFrame}>
            <View style={[styles.scanCorner, styles.cornerTL]} />
            <View style={[styles.scanCorner, styles.cornerTR]} />
            <View style={[styles.scanCorner, styles.cornerBL]} />
            <View style={[styles.scanCorner, styles.cornerBR]} />
            <Ionicons name="scan-outline" size={72} color="rgba(96,165,250,0.4)" />
          </View>
          <View style={styles.scannerWebInputWrap}>
            <TextInput
              ref={scanInputRef}
              style={styles.scannerWebInput}
              placeholder="Web 预览:手动输入集装号/运单号"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={scanInput}
              onChangeText={setScanInput}
              onSubmitEditing={() => { void handleScan(); }}
              autoCapitalize="characters"
              returnKeyType="send"
              autoFocus
              blurOnSubmit={false}
            />
            {scanning ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : scanInput.length > 0 ? (
              <TouchableOpacity onPress={() => { void handleScan(); }} style={styles.scanGoBtn}>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      );
    }
    if (!permission?.granted) {
      return (
        <View style={styles.scannerPermArea}>
          <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.4)" />
          <Text style={styles.scannerPermText}>需要相机权限才能扫码</Text>
          <TouchableOpacity style={styles.scannerPermBtn} onPress={requestPermission}>
            <Text style={styles.scannerPermBtnText}>授予权限</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.scannerCameraArea}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'pdf417'],
          }}
          onBarcodeScanned={scanning ? undefined : handleBarcodeScanned}
        />
        <View style={styles.scanFrame}>
          <View style={[styles.scanCorner, styles.cornerTL]} />
          <View style={[styles.scanCorner, styles.cornerTR]} />
          <View style={[styles.scanCorner, styles.cornerBL]} />
          <View style={[styles.scanCorner, styles.cornerBR]} />
        </View>
        <View style={styles.scannerStatusBar}>
          <Text style={styles.scannerStatusText}>
            ● {scanning ? '处理中...' : '就绪 · 对准条码自动识别'}
          </Text>
        </View>
      </View>
    );
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
          !isReceived && styles.itemCardClickable,
          isHighlighted && styles.itemCardHighlight,
        ]}
        onPress={() => handleToggleItem(item)}
        activeOpacity={!isReceived ? 0.7 : 1}
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

          {/* 相机扫码区(原生)/ Web 方形占位 */}
          {renderScanner()}

          {/* 手动入库提示 + 添加新运单 */}
          <View style={styles.manualHintRow}>
            <Text style={styles.manualHintText}>点击下方卡片也可手动入库</Text>
            <TouchableOpacity style={styles.addInlineBtn} onPress={() => setManualVisible(true)}>
              <Ionicons name="add-circle" size={18} color={colors.primary} />
              <Text style={styles.addInlineBtnText}>添加新运单</Text>
            </TouchableOpacity>
          </View>

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

        {/* 连续扫码 toast */}
        {toast && (
          <View
            style={[
              styles.scanToast,
              toast.type === 'success' && { backgroundColor: colors.success },
              toast.type === 'error' && { backgroundColor: colors.danger },
              toast.type === 'warn' && { backgroundColor: colors.warning },
            ]}
            pointerEvents="none"
          >
            <Ionicons
              name={toast.type === 'success' ? 'checkmark-circle' : toast.type === 'error' ? 'close-circle' : 'alert-circle'}
              size={20}
              color="#fff"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.scanToastText}>{toast.text}</Text>
              {toast.detail && <Text style={styles.scanToastDetail}>{toast.detail}</Text>}
            </View>
          </View>
        )}

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
  // 相机扫码区
  scannerCameraArea: { height: 320, backgroundColor: '#000', borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  scannerWebArea: { height: 340, backgroundColor: '#1a1a2e', borderRadius: radius.lg, marginBottom: spacing.md, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scannerWebInputWrap: { position: 'absolute', bottom: spacing.md, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: 'rgba(96,165,250,0.5)' },
  scannerWebInput: { flex: 1, height: 40, fontSize: font.md, color: '#fff', fontFamily: font.mono, fontWeight: '700', paddingHorizontal: spacing.sm },
  scannerPermArea: { height: 240, backgroundColor: '#1a1a2e', borderRadius: radius.lg, marginBottom: spacing.md, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  scannerPermText: { color: 'rgba(255,255,255,0.7)', fontSize: font.sm },
  scannerPermBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: radius.full },
  scannerPermBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
  scannerStatusBar: { position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.full, alignItems: 'center' },
  scannerStatusText: { color: colors.success, fontSize: font.sm, fontWeight: '700' },
  scanFrame: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  scanCorner: { position: 'absolute', width: 22, height: 22, borderColor: colors.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanGoBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  // 手动提示
  manualHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  manualHintText: { fontSize: font.xs, color: colors.textSecondary },
  addInlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.primaryLight, borderRadius: radius.md },
  addInlineBtnText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },

  // 扫码 toast
  scanToast: {
    position: 'absolute', left: spacing.md, right: spacing.md, bottom: 104,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  scanToastText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },
  scanToastDetail: { color: '#fff', fontSize: font.xs, opacity: 0.9, marginTop: 1 },

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
