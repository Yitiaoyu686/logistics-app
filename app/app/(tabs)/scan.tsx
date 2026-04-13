import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Modal, TextInput, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, font } from '../../lib/theme';

// Dynamic import of expo-camera to avoid breaking web preview
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('expo-camera');
    CameraView = mod.CameraView;
    useCameraPermissions = mod.useCameraPermissions;
  } catch {
    // camera module unavailable
  }
}

interface RecentScan {
  code: string;
  type: string;
  route: string;
  time: number;
}

type CodeKind = 'job' | 'dpn' | 'subOrder' | 'order' | 'stock' | 'unknown';

function recognizeCode(code: string): { kind: CodeKind; label: string; route: string; params: Record<string, string> } {
  const c = code.trim().toUpperCase();

  if (/^S-JOB/.test(c)) {
    return { kind: 'job', label: 'JOB 任务', route: '/task/dest-inbound', params: { jobNo: code } };
  }
  if (/^DPN-/.test(c)) {
    return { kind: 'dpn', label: 'DPN 配送单', route: '/task/dpn', params: { dpnNo: code } };
  }
  if (/^[A-Z]-\d{14,}-\d{1,3}$/.test(c) || /^[A-Z]-\d{8,}-\d{1,3}$/.test(c)) {
    return { kind: 'subOrder', label: '子运单号', route: '/task/stock', params: { keyword: code } };
  }
  if (/^[A-Z]-\d{8,}$/.test(c)) {
    return { kind: 'order', label: '运单号', route: '/task/order', params: { keyword: code } };
  }
  if (/^[A-Z]-\d{2}-\d{2}$/.test(c) || /^[A-Z]+-\d+/.test(c)) {
    return { kind: 'stock', label: '库位号', route: '/task/stock', params: { keyword: code } };
  }
  return { kind: 'unknown', label: '未知类型', route: '/task/order', params: { keyword: code } };
}

const KIND_ICON: Record<CodeKind, string> = {
  job: 'cube',
  dpn: 'car',
  subOrder: 'barcode',
  order: 'document-text',
  stock: 'location',
  unknown: 'help-circle',
};

const KIND_COLOR: Record<CodeKind, string> = {
  job: colors.primary,
  dpn: colors.taskDispatch,
  subOrder: colors.info,
  order: colors.primary,
  stock: colors.success,
  unknown: colors.textSecondary,
};

export default function ScanScreen() {
  const router = useRouter();
  const [manualVisible, setManualVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [torch, setTorch] = useState(false);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, () => {}];
  const [lastScanned, setLastScanned] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleRecognized = (code: string) => {
    if (!code || code === lastScanned) return;
    setLastScanned(code);
    const info = recognizeCode(code);
    const entry: RecentScan = { code, type: info.label, route: info.route, time: Date.now() };
    setRecent((prev) => [entry, ...prev.filter((r) => r.code !== code)].slice(0, 5));

    Alert.alert(
      `识别成功：${info.label}`,
      `${code}\n\n跳转到 ${info.label === '未知类型' ? '订单查询' : info.label}？`,
      [
        { text: '取消', style: 'cancel', onPress: () => setTimeout(() => setLastScanned(''), 800) },
        {
          text: '跳转',
          onPress: () => {
            setManualVisible(false);
            setLastScanned('');
            router.push({ pathname: info.route as any, params: info.params });
          },
        },
      ]
    );
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) { Alert.alert('请输入编号'); return; }
    setManualCode('');
    handleRecognized(code);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    handleRecognized(data);
  };

  const renderCameraArea = () => {
    // Web: show a placeholder since expo-camera does not render on web
    if (Platform.OS === 'web' || !CameraView) {
      return (
        <View style={styles.cameraArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Ionicons name="scan-outline" size={120} color="rgba(255,255,255,0.3)" />
          <Text style={styles.hint}>
            {Platform.OS === 'web' ? 'Web 预览不支持相机，请用「手动输入」测试' : '将条码对准框内自动识别'}
          </Text>
        </View>
      );
    }

    // Native: camera with permission flow
    if (!permission?.granted) {
      return (
        <View style={styles.cameraArea}>
          <Ionicons name="camera-outline" size={80} color="rgba(255,255,255,0.3)" />
          <Text style={styles.hint}>需要相机权限才能扫码</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>授予权限</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraArea}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'pdf417'],
          }}
          onBarcodeScanned={lastScanned ? undefined : handleBarcodeScanned}
        />
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.hint}>将条码对准框内自动识别</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {renderCameraArea()}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn} onPress={() => setTorch((t) => !t)}>
            <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={24} color={torch ? colors.warning : colors.text} />
            <Text style={styles.controlLabel}>闪光灯</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.manualBtn} onPress={() => setManualVisible(true)}>
            <Ionicons name="keypad-outline" size={20} color={colors.primary} />
            <Text style={styles.manualLabel}>手动输入</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn}>
            <Ionicons name="images-outline" size={24} color={colors.text} />
            <Text style={styles.controlLabel}>相册</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Scans */}
        <View style={styles.recent}>
          <Text style={styles.recentTitle}>最近扫描</Text>
          {recent.length === 0 ? (
            <Text style={styles.recentEmpty}>暂无扫描记录</Text>
          ) : (
            recent.map((r) => {
              const info = recognizeCode(r.code);
              return (
                <TouchableOpacity
                  key={r.code + r.time}
                  style={styles.recentItem}
                  onPress={() => router.push({ pathname: r.route as any, params: info.params })}
                >
                  <View style={[styles.recentIconWrap, { backgroundColor: KIND_COLOR[info.kind] + '20' }]}>
                    <Ionicons name={KIND_ICON[info.kind] as any} size={18} color={KIND_COLOR[info.kind]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentCode}>{r.code}</Text>
                    <Text style={styles.recentType}>{r.type}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      {/* Manual Input Modal */}
      <Modal visible={manualVisible} transparent animationType="slide" onRequestClose={() => setManualVisible(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>手动输入编号</Text>
              <TouchableOpacity onPress={() => setManualVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>
              支持：JOB号(S-JOB...) / DPN号(DPN-...) / 运单号 / 子运单号 / 库位号
            </Text>

            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="粘贴或输入编号"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              autoFocus
              onSubmitEditing={handleManualSubmit}
            />

            {/* Quick samples */}
            <Text style={styles.sampleTitle}>快速测试：</Text>
            <View style={styles.sampleRow}>
              {[
                'S-JOB26030001',
                'DPN-20260320-9901',
                'S-20260320990003',
                'S-20260320990003-01',
                'A-01-03',
              ].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.sampleChip}
                  onPress={() => setManualCode(s)}
                >
                  <Text style={styles.sampleChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, !manualCode.trim() && styles.btnDisabled]}
              onPress={handleManualSubmit}
              disabled={!manualCode.trim()}
            >
              <Text style={styles.submitBtnText}>识别并跳转</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  cameraArea: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  scanFrame: { position: 'absolute', width: 250, height: 250 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: colors.primary },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  hint: { position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.6)', fontSize: font.sm, paddingHorizontal: spacing.xl, textAlign: 'center' },
  permBtn: { position: 'absolute', bottom: 100, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: radius.full },
  permBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },

  controls: { flexDirection: 'row', backgroundColor: '#fff', justifyContent: 'space-around', alignItems: 'center', paddingVertical: spacing.lg },
  controlBtn: { alignItems: 'center', gap: 4 },
  controlLabel: { fontSize: font.xs, color: colors.textSecondary },
  manualBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary },
  manualLabel: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },

  recent: { backgroundColor: '#fff', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, maxHeight: 240 },
  recentTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  recentEmpty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl },
  recentItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  recentIconWrap: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  recentCode: { fontSize: font.sm, fontWeight: '600', color: colors.text, fontFamily: font.mono },
  recentType: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  modalHint: { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 16 },
  manualInput: { borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 52, fontSize: font.lg, color: colors.text, fontFamily: font.mono, backgroundColor: colors.bg },
  sampleTitle: { fontSize: font.xs, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
  sampleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  sampleChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  sampleChipText: { fontSize: font.xs, color: colors.textSecondary, fontFamily: font.mono },
  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, marginTop: spacing.xs },
  submitBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.5 },
});
