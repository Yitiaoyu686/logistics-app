import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { jobApi } from '../../lib/api';

type ItemStatus = 'PENDING' | 'CHECKED' | 'MISSING' | 'DAMAGED';

interface CheckItem {
  id: string;
  sub_order_no: string;
  order_no: string;
  customer_name: string;
  pieces: number;
  actual_weight_kg: number;
  status: ItemStatus;
}

const STATUS_META: Record<ItemStatus, { label: string; color: string; bg: string; icon: string }> = {
  PENDING:  { label: '待核对', color: colors.textSecondary, bg: colors.borderLight, icon: 'ellipse-outline' },
  CHECKED:  { label: '已核对', color: colors.success,        bg: colors.successLight, icon: 'checkmark-circle' },
  MISSING:  { label: '少件',   color: colors.danger,         bg: colors.dangerLight,  icon: 'alert-circle' },
  DAMAGED:  { label: '破损',   color: colors.warning,        bg: colors.warningLight, icon: 'warning' },
};

export default function DestInboundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; jobNo?: string }>();

  const [job, setJob] = useState<any>(null);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [remark, setRemark] = useState('');
  const [photoCount, setPhotoCount] = useState(0);

  useEffect(() => {
    if (params.jobNo || params.jobId) {
      loadJob((params.jobNo || params.jobId) as string);
    } else {
      setLoading(false);
    }
  }, [params.jobNo, params.jobId]);

  const loadJob = async (idOrNo: string) => {
    setLoading(true);
    try {
      const res = await jobApi.get(idOrNo);
      setJob(res.data);
      const rels = res.data.relations || [];
      setItems(rels.map((r: any) => ({
        id: r.sub_order_id || r.id,
        sub_order_no: r.sub_order_no || r.sub_order_id,
        order_no: r.order_no || '-',
        customer_name: r.customer_name || '-',
        pieces: r.pieces || 0,
        actual_weight_kg: r.actual_weight_kg || 0,
        status: 'PENDING' as ItemStatus,
      })));
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = items.length;
    const checked = items.filter((i) => i.status === 'CHECKED').length;
    const missing = items.filter((i) => i.status === 'MISSING').length;
    const damaged = items.filter((i) => i.status === 'DAMAGED').length;
    return { total, checked, missing, damaged, progress: total > 0 ? Math.round(checked / total * 100) : 0 };
  }, [items]);

  const handleScan = () => {
    const code = scanInput.trim();
    if (!code) { Alert.alert('请输入运单号'); return; }

    const idx = items.findIndex((i) => i.sub_order_no.includes(code) || i.order_no.includes(code));
    if (idx === -1) {
      Alert.alert('未找到', `运单号 ${code} 不在本次任务清单中`, [
        { text: '无单处理', style: 'default' },
        { text: '取消', style: 'cancel' },
      ]);
      return;
    }
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, status: 'CHECKED' } : it));
    setScanInput('');
  };

  const handleMark = (id: string, status: ItemStatus) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, status } : it));
  };

  const handleTakePhoto = () => {
    setPhotoCount((c) => c + 1);
    Alert.alert('📷 拍照成功', `已保存第 ${photoCount + 1} 张照片`);
  };

  const handleConfirm = async () => {
    if (!job) { Alert.alert('任务信息缺失'); return; }

    const pendingCount = items.filter((i) => i.status === 'PENDING').length;
    if (pendingCount > 0) {
      Alert.alert('还有待核对', `尚有 ${pendingCount} 条运单未核对，确定结束？`, [
        { text: '继续核对', style: 'cancel' },
        { text: '确认结束', style: 'destructive', onPress: () => submit() },
      ]);
      return;
    }
    submit();
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await jobApi.update(job.job_no || job.id, {
        jobStatus: 'ARRIVED',
        currentNode: 'WAREHOUSE_IN',
        remark: remark || `任务入库 ${stats.checked}/${stats.total}, 少件${stats.missing}, 破损${stats.damaged}`,
      });
      Alert.alert('入库完成', `本次入库 ${stats.checked} 条\n少件 ${stats.missing} · 破损 ${stats.damaged}`, [
        { text: '确定', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('提交失败', err.message || '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>任务入库核对</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 任务信息卡 */}
          {job ? (
            <View style={styles.jobCard}>
              <View style={styles.jobHeader}>
                <Text style={styles.jobNo}>{job.job_no}</Text>
                <View style={styles.jobBadge}>
                  <Text style={styles.jobBadgeText}>{job.business_line === 'SEA' ? '🚢 海运' : '✈️ 空运'}</Text>
                </View>
              </View>
              <Text style={styles.jobRoute}>{job.origin_port} → {job.dest_port}</Text>
              <View style={styles.jobMeta}>
                <Text style={styles.jobMetaText}>柜号 {job.container_no || '-'}</Text>
                <Text style={styles.jobMetaText}>·</Text>
                <Text style={styles.jobMetaText}>{job.total_pieces || 0} 件 / {job.total_weight_kg || 0} kg</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noMatchCard}>
              <Text style={styles.noMatchText}>⚠️ 未选择任务，请从任务流进入</Text>
            </View>
          )}

          {/* 进度总览 */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>核对进度</Text>
              <Text style={styles.progressPercent}>{stats.progress}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${stats.progress}%` }]} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{stats.total}</Text>
                <Text style={styles.statLabel}>清单</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: colors.success }]}>{stats.checked}</Text>
                <Text style={styles.statLabel}>已核对</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: colors.danger }]}>{stats.missing}</Text>
                <Text style={styles.statLabel}>少件</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: colors.warning }]}>{stats.damaged}</Text>
                <Text style={styles.statLabel}>破损</Text>
              </View>
            </View>
          </View>

          {/* 扫码核对输入 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📷 扫码核对</Text>
            <View style={styles.scanRow}>
              <View style={styles.scanInputWrap}>
                <Ionicons name="scan" size={20} color={colors.primary} />
                <TextInput
                  style={styles.scanInput}
                  value={scanInput}
                  onChangeText={setScanInput}
                  placeholder="扫描或输入运单号"
                  placeholderTextColor={colors.textTertiary}
                  onSubmitEditing={handleScan}
                  returnKeyType="done"
                />
              </View>
              <TouchableOpacity style={styles.scanBtn} onPress={handleScan}>
                <Text style={styles.scanBtnText}>核对</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 运单清单 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 运单清单 ({items.length})</Text>
            {items.length === 0 ? (
              <Text style={styles.empty}>该任务暂无运单关联</Text>
            ) : (
              items.map((item) => {
                const meta = STATUS_META[item.status];
                return (
                  <View key={item.id} style={[styles.itemCard, { borderLeftColor: meta.color }]}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemNo}>{item.sub_order_no}</Text>
                      <View style={[styles.itemBadge, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.itemBadgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemCustomer}>{item.customer_name}</Text>
                    <Text style={styles.itemInfo}>{item.pieces}件 · {item.actual_weight_kg}kg</Text>
                    {item.status === 'PENDING' && (
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={[styles.markBtn, styles.markBtnCheck]}
                          onPress={() => handleMark(item.id, 'CHECKED')}
                        >
                          <Ionicons name="checkmark" size={14} color="#fff" />
                          <Text style={styles.markBtnText}>已到</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.markBtn, styles.markBtnMissing]}
                          onPress={() => handleMark(item.id, 'MISSING')}
                        >
                          <Text style={[styles.markBtnText, { color: colors.danger }]}>少件</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.markBtn, styles.markBtnDamaged]}
                          onPress={() => handleMark(item.id, 'DAMAGED')}
                        >
                          <Text style={[styles.markBtnText, { color: colors.warning }]}>破损</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {item.status !== 'PENDING' && (
                      <TouchableOpacity
                        style={styles.resetBtn}
                        onPress={() => handleMark(item.id, 'PENDING')}
                      >
                        <Text style={styles.resetBtnText}>重置</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* 拍照 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📸 拍照存证</Text>
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={28} color={colors.primary} />
                <Text style={styles.photoBtnText}>拍照</Text>
              </TouchableOpacity>
              {photoCount > 0 && (
                <View style={styles.photoCountBox}>
                  <Text style={styles.photoCountText}>已拍 {photoCount} 张</Text>
                </View>
              )}
            </View>
          </View>

          {/* 备注 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>备注</Text>
            <TextInput
              style={styles.textarea}
              value={remark}
              onChangeText={setRemark}
              placeholder="入库说明（可选）"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={2}
            />
          </View>
        </ScrollView>

        {/* 底部按钮 */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.confirmBtn, submitting && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={submitting}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.confirmBtnText}>
              {submitting ? '处理中...' : `确认入库 (${stats.checked}/${stats.total})`}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: 120 },
  // Job card
  jobCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.primary },
  jobHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  jobNo: { fontSize: font.lg, fontWeight: '700', color: colors.primary, fontFamily: font.mono },
  jobBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  jobBadgeText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },
  jobRoute: { fontSize: font.md, color: colors.text, marginBottom: 4 },
  jobMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  jobMetaText: { fontSize: font.xs, color: colors.textSecondary },
  noMatchCard: { backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.warning + '40' },
  noMatchText: { fontSize: font.sm, color: colors.warning },
  // Progress
  progressCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  progressTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  progressPercent: { fontSize: font.lg, fontWeight: '700', color: colors.primary },
  progressBarBg: { height: 8, backgroundColor: colors.borderLight, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.md },
  progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statItem: { flex: 1, alignItems: 'center', padding: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.md },
  statNum: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  // Section
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  empty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.md },
  // Scan
  scanRow: { flexDirection: 'row', gap: spacing.sm },
  scanInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, gap: spacing.sm },
  scanInput: { flex: 1, fontSize: font.md, color: colors.text, fontFamily: font.mono },
  scanBtn: { height: 48, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  scanBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
  // Item
  itemCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 3 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  itemBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  itemBadgeText: { fontSize: font.xs, fontWeight: '600' },
  itemCustomer: { fontSize: font.sm, color: colors.text, marginBottom: 2 },
  itemInfo: { fontSize: font.xs, color: colors.textSecondary },
  itemActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  markBtn: { flex: 1, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  markBtnCheck: { backgroundColor: colors.success },
  markBtnMissing: { borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.card },
  markBtnDamaged: { borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.card },
  markBtnText: { fontSize: font.sm, fontWeight: '600', color: '#fff' },
  resetBtn: { marginTop: spacing.sm, alignSelf: 'flex-end' },
  resetBtnText: { fontSize: font.xs, color: colors.textTertiary, textDecorationLine: 'underline' },
  // Photo
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoBtn: { width: 80, height: 80, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.primaryLight },
  photoBtnText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },
  photoCountBox: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.successLight, borderRadius: radius.md },
  photoCountText: { fontSize: font.sm, color: colors.success, fontWeight: '600' },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.card },
  // Bottom
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  confirmBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, shadowColor: colors.primary, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  confirmBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
});
