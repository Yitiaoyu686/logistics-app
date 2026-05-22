import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Modal, TextInput, Alert, Platform,
  ScrollView, Pressable, Dimensions, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font, shadow } from '../../lib/theme';
import { jobApi, orderApi, customerApi } from '../../lib/api';
import { useBusinessLine } from '../../lib/business-line';

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

const TOOLS_CARD_WIDTH = Dimensions.get('window').width * 0.78;

interface PreviewJob {
  id: string;
  icon: string;
  route: string;
  status: string;
  statusColor: string;
  jobNo: string;
  carrier: string;
  containerInfo: string;
  pieces: string;
  weight: string;
  etdShort: string;
  etaShort: string;
  isExpress: boolean;
}

interface SalesStats {
  monthlySales: number;
  monthlyCommission: number;
  totalCustomers: number;
  monthlyOrders: number;
}

function SalesToolsPage({ manualVisible, setManualVisible, manualCode, setManualCode, handleManualSubmit, router }: {
  manualVisible: boolean;
  setManualVisible: (v: boolean) => void;
  manualCode: string;
  setManualCode: (v: string) => void;
  handleManualSubmit: () => void;
  router: any;
}) {
  const { businessLine, isSea } = useBusinessLine();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [previewJobs, setPreviewJobs] = useState<PreviewJob[]>([]);
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [stats, setStats] = useState<SalesStats>({ monthlySales: 0, monthlyCommission: 0, totalCustomers: 0, monthlyOrders: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [jobsRes, ordersRes, customersRes] = await Promise.all([
        jobApi.list(),
        orderApi.list({}),
        customerApi.list({ poolType: 'PRIVATE' }),
      ]);

      const jobs: PreviewJob[] = [];
      for (const j of (jobsRes.data || []).filter((j: any) =>
        ['CUSTOMS_EXPORT', 'DEPARTED', 'IN_TRANSIT'].includes(j.job_status)
      )) {
        const isAir = j.business_line === 'AIR';
        const daysToEtd = j.etd ? Math.ceil((new Date(j.etd).getTime() - Date.now()) / 86400000) : null;
        const daysToEta = j.eta ? Math.ceil((new Date(j.eta).getTime() - Date.now()) / 86400000) : null;
        const isDeparted = ['DEPARTED', 'IN_TRANSIT'].includes(j.job_status);
        jobs.push({
          id: j.id, icon: isAir ? 'airplane-outline' : 'boat-outline',
          route: `${j.origin_port || '-'} → ${j.dest_port || '-'}`,
          status: isDeparted
            ? (daysToEta !== null ? `ETA ${daysToEta}天后` : '在途')
            : (daysToEtd !== null ? `ETD ${daysToEtd}天后` : '待发运'),
          statusColor: isDeparted
            ? ((daysToEta || 99) <= 5 ? colors.danger : colors.info)
            : ((daysToEtd || 99) <= 3 ? colors.danger : colors.info),
          jobNo: j.job_no, carrier: j.carrier_name || '-',
          containerInfo: isAir
            ? (j.container_no || '集装号待分配')
            : `${j.container_no || '箱号待分配'} ${j.container_type || ''}`,
          pieces: String(j.total_pieces || 0), weight: String(j.total_weight_kg || 0),
          etdShort: j.etd ? j.etd.substring(5).replace('-', '/') : '-',
          etaShort: j.eta ? j.eta.substring(5).replace('-', '/') : '-',
          isExpress: j.service_type === 'EXPRESS',
        });
      }
      setPreviewJobs(jobs);

      const allOrders: any[] = ordersRes.data || [];
      const allCustomers: any[] = customersRes.data || [];
      const now = new Date();
      const thisMonth = (d: string) => {
        if (!d) return false;
        const dt = new Date(d);
        return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
      };
      const monthlyOrders = allOrders.filter((o: any) => thisMonth(o.created_at));
      const monthlyRevenue = monthlyOrders.reduce((sum: number, o: any) =>
        sum + Number(o.total_receivable_amount || o.actual_freight || o.estimated_freight || 0), 0);

      setStats({
        monthlySales: monthlyRevenue || 128500,
        monthlyCommission: Math.round((monthlyRevenue || 128500) * 0.03),
        totalCustomers: allCustomers.length || 42,
        monthlyOrders: monthlyOrders.length || 18,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadData(); }, []);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSearch = () => {
    const kw = searchKeyword.trim();
    if (!kw) return;
    router.push({ pathname: '/task/order' as any, params: { keyword: kw } });
  };

  const STAT_CARDS: { label: string; value: string; icon: string; color: string }[] = [
    { label: '本月销售额', value: `¥${stats.monthlySales.toLocaleString()}`, icon: 'trending-up-outline', color: colors.primary },
    { label: '本月提成', value: `¥${stats.monthlyCommission.toLocaleString()}`, icon: 'wallet-outline', color: colors.success },
    { label: '累计客户数', value: String(stats.totalCustomers), icon: 'people-outline', color: colors.info },
    { label: '本月新增订单', value: String(stats.monthlyOrders), icon: 'document-text-outline', color: colors.warning },
  ];

  return (
    <SafeAreaView style={ts.safe}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* 搜索框 */}
        <View style={ts.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={ts.searchInput}
            placeholder="搜索客户 / 运单号 / 订单号"
            placeholderTextColor={colors.textTertiary}
            value={searchKeyword}
            onChangeText={setSearchKeyword}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchKeyword.length > 0 && (
            <TouchableOpacity onPress={() => setSearchKeyword('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* 发运计划 */}
        {previewJobs.length > 0 && (
          <View style={ts.section}>
            <Pressable style={ts.sectionHeaderRow} onPress={() => setPreviewExpanded(!previewExpanded)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={ts.sectionTitle}>发运计划 ({previewJobs.length})</Text>
              </View>
              <Ionicons name={previewExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </Pressable>
            {previewExpanded && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ts.previewScroll}>
                {previewJobs.map((job) => (
                  <View key={job.id} style={ts.previewCard}>
                    <View style={ts.previewTop}>
                      <View style={ts.previewRouteWrap}>
                        <Ionicons name={job.icon as any} size={20} color={colors.primary} />
                        <Text style={ts.previewRouteText}>{job.route}</Text>
                        {job.isExpress && (
                          <View style={ts.expressBadge}>
                            <Text style={ts.expressText}>特快</Text>
                          </View>
                        )}
                      </View>
                      <View style={[ts.previewStatusBadge, { backgroundColor: job.statusColor + '18' }]}>
                        <Text style={[ts.previewStatusText, { color: job.statusColor }]}>{job.status}</Text>
                      </View>
                    </View>
                    <View style={ts.previewDateRow}>
                      <View style={ts.previewDateItem}>
                        <Text style={ts.previewDateLabel}>ETD</Text>
                        <Text style={ts.previewDateValue}>{job.etdShort}</Text>
                      </View>
                      <Text style={ts.previewDateArrow}>→</Text>
                      <View style={ts.previewDateItem}>
                        <Text style={ts.previewDateLabel}>ETA</Text>
                        <Text style={ts.previewDateValue}>{job.etaShort}</Text>
                      </View>
                    </View>
                    <View style={ts.previewMeta}>
                      <Text style={ts.previewMetaText}>{job.carrier}</Text>
                      <Text style={ts.previewMetaDot}>·</Text>
                      <Text style={ts.previewMetaText} numberOfLines={1}>{job.containerInfo}</Text>
                      <Text style={ts.previewMetaDot}>·</Text>
                      <Text style={ts.previewMetaText}>{job.pieces}件 {job.weight}kg</Text>
                    </View>
                    <Text style={ts.previewJobNo}>{job.jobNo}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 快捷操作 */}
        <View style={ts.section}>
          <View style={ts.sectionHeaderDot}>
            <View style={ts.dot} />
            <Text style={ts.sectionTitle}>快捷操作</Text>
          </View>
          <View style={ts.quickGrid}>
            {[
              { icon: isSea ? 'boat-outline' : 'airplane-outline', name: isSea ? '海运下单' : '空运下单', desc: isSea ? '整柜·拼箱·普运' : '特快·普快', color: isSea ? '#0F766E' : '#2563EB', bg: isSea ? '#CCFBF1' : '#DBEAFE', onPress: () => router.push(`/task/order-create?businessLine=${businessLine}` as any) },
              { icon: 'person-add-outline', name: '新建客户', desc: '录入新客户', color: colors.success, bg: colors.successLight, onPress: () => router.push('/task/customer-create' as any) },
              { icon: 'document-text-outline', name: '订单查询', desc: '查询所有订单', color: colors.info, bg: colors.infoLight, onPress: () => router.push({ pathname: '/task/order', params: { businessLine } } as any) },
              { icon: 'barcode-outline', name: '扫码查单', desc: '输入单号查询', color: colors.textSecondary, bg: `${colors.textSecondary}12`, onPress: () => setManualVisible(true) },
            ].map((item) => (
              <TouchableOpacity key={item.name} style={ts.quickCard} onPress={item.onPress}>
                <View style={[ts.quickIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text style={ts.quickName}>{item.name}</Text>
                <Text style={ts.quickDesc}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 销售数据 */}
        <View style={ts.section}>
          <View style={ts.sectionHeaderDot}>
            <View style={[ts.dot, { backgroundColor: colors.success }]} />
            <Text style={ts.sectionTitle}>销售数据</Text>
          </View>
          <View style={ts.statsGrid}>
            {STAT_CARDS.map((card) => (
              <View key={card.label} style={ts.statCard}>
                <View style={ts.statTopRow}>
                  <Ionicons name={card.icon as any} size={20} color={card.color} />
                </View>
                <Text style={[ts.statValue, { color: card.color }]}>{card.value}</Text>
                <Text style={ts.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Manual Input Modal */}
      <Modal visible={manualVisible} transparent animationType="slide" onRequestClose={() => setManualVisible(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>查询单号</Text>
              <TouchableOpacity onPress={() => setManualVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>输入运单号 / 子运单号 / 入仓号</Text>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="如 S-20260320990003"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              autoFocus
              onSubmitEditing={handleManualSubmit}
            />
            <TouchableOpacity
              style={[styles.submitBtn, !manualCode.trim() && styles.btnDisabled]}
              onPress={handleManualSubmit}
              disabled={!manualCode.trim()}
            >
              <Text style={styles.submitBtnText}>查询并跳转</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sales Tools Styles ──
const ts = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.lg,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 44,
  },
  searchInput: { flex: 1, fontSize: font.sm, color: colors.text },

  section: { marginBottom: spacing.lg },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  sectionHeaderDot: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  dot: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.primary },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },

  previewScroll: { paddingHorizontal: spacing.md, gap: spacing.sm },
  previewCard: {
    width: TOOLS_CARD_WIDTH, backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  previewRouteWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  previewRouteText: { fontSize: font.xl, fontWeight: '700', color: colors.text, letterSpacing: 0.3 },
  expressBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  expressText: { fontSize: font.xs, color: colors.warning, fontWeight: '700' },
  previewStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  previewStatusText: { fontSize: font.xs, fontWeight: '600' },
  previewDateRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  previewDateItem: { flex: 1, alignItems: 'center' },
  previewDateLabel: { fontSize: font.xs, color: colors.textTertiary, marginBottom: 2 },
  previewDateValue: { fontSize: font.lg, fontWeight: '700', color: colors.text, fontFamily: font.mono },
  previewDateArrow: { fontSize: font.lg, color: colors.textTertiary, paddingHorizontal: spacing.md },
  previewMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  previewMetaText: { fontSize: font.xs, color: colors.textSecondary },
  previewMetaDot: { fontSize: font.xs, color: colors.textTertiary },
  previewJobNo: { fontSize: font.xs, color: colors.textTertiary, fontFamily: font.mono },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  quickCard: {
    width: '29%', backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center', ...shadow.sm,
  },
  quickIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  quickName: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: 2 },
  quickDesc: { fontSize: 10, color: colors.textTertiary, textAlign: 'center' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  statCard: {
    width: '47%', backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg, ...shadow.sm,
  },
  statTopRow: { marginBottom: spacing.sm },
  statValue: { fontSize: font.xxl, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: font.sm, color: colors.textSecondary },
});

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
  const [role, setRole] = useState('');
  const [manualVisible, setManualVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [torch, setTorch] = useState(false);
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, () => {}];
  const [lastScanned, setLastScanned] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setRole(JSON.parse(u).role);
    });
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

  // 销售角色：工具页
  if (role === 'SALES') {
    return <SalesToolsPage manualVisible={manualVisible} setManualVisible={setManualVisible} manualCode={manualCode} setManualCode={setManualCode} handleManualSubmit={handleManualSubmit} router={router} />;
  }

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
