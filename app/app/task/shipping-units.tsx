import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { jobApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface UnitRow {
  id: string;
  unit_no: string;
  unit_status?: string;
  unit_type?: string;
  current_pieces?: number;
  current_weight_kg?: number;
  max_weight_kg?: number;
}

export default function ShippingUnitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string }>();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 批量创建
  const [batchVisible, setBatchVisible] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState('AK');
  const [batchStartNo, setBatchStartNo] = useState(1);
  const [batchCount, setBatchCount] = useState(10);
  const [batchShouldPrint, setBatchShouldPrint] = useState(true);
  const [creating, setCreating] = useState(false);

  // 面单预览
  const [labelVisible, setLabelVisible] = useState(false);
  const [printUnits, setPrintUnits] = useState<Array<{ id?: string; unitNo: string }>>([]);

  const unitLabel = job?.business_line === 'AIR' ? '集装号' : '集装箱号';

  useFocusEffect(useCallback(() => {
    if (params.jobId) void loadJob(params.jobId as string);
  }, [params.jobId]));

  async function loadJob(id: string) {
    setLoading(true);
    try {
      const res = await jobApi.get(id);
      setJob(res.data);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setLoading(false);
    }
  }

  const units = (job?.units || []) as UnitRow[];

  const openBatchDialog = () => {
    // 自动推算默认前缀和起始号
    if (units.length > 0) {
      const sample = String(units[0].unit_no || 'AK').toUpperCase();
      const pfxMatch = sample.match(/^([A-Z]+)/);
      const pfx = pfxMatch?.[1] || 'AK';
      let maxNum = 0;
      for (const u of units) {
        const m = String(u.unit_no || '').toUpperCase().match(new RegExp(`^${pfx}[-]?(\\d+)$`));
        if (m) maxNum = Math.max(maxNum, Number(m[1]));
      }
      setBatchPrefix(pfx);
      setBatchStartNo(maxNum + 1);
    } else {
      setBatchPrefix('AK');
      setBatchStartNo(1);
    }
    setBatchCount(10);
    setBatchVisible(true);
  };

  const handleBatchCreate = async () => {
    if (!job) return;
    const prefix = batchPrefix.trim().toUpperCase();
    if (!prefix) { Alert.alert('请输入前缀'); return; }

    const existing = new Set(units.map((u) => String(u.unit_no || '').toUpperCase()));
    const genNos: string[] = [];
    for (let i = 0; i < batchCount; i++) {
      const num = batchStartNo + i;
      const unum = `${prefix}-${String(num).padStart(3, '0')}`;
      if (existing.has(unum.toUpperCase())) {
        Alert.alert('冲突', `${unum} 已存在,请调整起始号`);
        return;
      }
      genNos.push(unum);
    }

    setCreating(true);
    const created: Array<{ id: string; unitNo: string }> = [];
    const failed: string[] = [];
    const isAir = job.business_line === 'AIR';
    for (const unum of genNos) {
      try {
        const res = await jobApi.createShippingUnit({
          unitNo: unum,
          businessLine: job.business_line,
          unitType: isAir ? 'PALLET' : 'CONTAINER',
          jobId: job.id,
          routeCode: job.route_code,
          maxWeightKg: isAir ? 1500 : 26000,
          maxVolumeCbm: isAir ? 12 : 67.5,
        });
        created.push({ id: res.data?.id, unitNo: res.data?.unitNo || unum });
      } catch {
        failed.push(unum);
      }
    }
    setCreating(false);

    if (failed.length > 0) {
      Alert.alert('部分失败', `已创建 ${created.length} / 失败 ${failed.length}`);
    }
    if (created.length > 0) {
      setBatchVisible(false);
      if (batchShouldPrint) {
        setPrintUnits(created);
        setLabelVisible(true);
      } else {
        Alert.alert('创建成功', `已新增 ${created.length} 个${unitLabel}`);
      }
      await loadJob(job.job_no || job.id);
    }
  };

  const handlePrintAll = () => {
    if (units.length === 0) { Alert.alert('暂无可打印的面单'); return; }
    setPrintUnits(units.map((u) => ({ id: u.id, unitNo: u.unit_no })));
    setLabelVisible(true);
  };

  const stats = {
    total: units.length,
    empty: units.filter((u) => u.unit_status === 'EMPTY').length,
    loading: units.filter((u) => u.unit_status === 'LOADING').length,
    sealed: units.filter((u) => u.unit_status === 'SEALED').length,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{unitLabel}管理</Text>
        <TouchableOpacity style={styles.navCreateBtn} onPress={openBatchDialog}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.navCreateText}>批量创建</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : !job ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textTertiary }}>任务信息缺失</Text>
        </View>
      ) : (
        <>
          {/* JOB 卡 */}
          <View style={styles.jobCard}>
            <Text style={styles.jobNo}>{job.job_no}</Text>
            <Text style={styles.jobMeta}>{job.route_code} · {job.carrier_name || '-'}</Text>
          </View>

          {/* 统计 */}
          <View style={styles.statsRow}>
            <Text style={styles.statsTotal}>共 {stats.total} 个</Text>
            {stats.empty > 0 && <StatChip label="空" count={stats.empty} color={colors.textSecondary} bg="#f5f5f5" />}
            {stats.loading > 0 && <StatChip label="装箱中" count={stats.loading} color={colors.primary} bg={colors.primaryLight} />}
            {stats.sealed > 0 && <StatChip label="已封箱" count={stats.sealed} color={colors.success} bg={colors.successLight} />}
            {units.length > 0 && (
              <TouchableOpacity style={styles.printAllBtn} onPress={handlePrintAll}>
                <Ionicons name="print-outline" size={14} color={colors.primary} />
                <Text style={styles.printAllText}>打印全部</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 列表 */}
          {units.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="cube-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>暂无{unitLabel}</Text>
              <TouchableOpacity style={styles.emptyActionBtn} onPress={openBatchDialog}>
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={styles.emptyActionText}>开始批量创建</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent}>
              {units.map((u) => {
                const cfg = {
                  EMPTY: { label: '空', color: colors.textSecondary, bg: '#f5f5f5' },
                  LOADING: { label: '装箱中', color: colors.primary, bg: colors.primaryLight },
                  SEALED: { label: '已封箱', color: colors.success, bg: colors.successLight },
                }[u.unit_status || 'EMPTY'] || { label: u.unit_status || 'EMPTY', color: colors.textSecondary, bg: '#f5f5f5' };
                return (
                  <View key={u.id} style={styles.unitRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.unitNo}>{u.unit_no}</Text>
                      <Text style={styles.unitMeta}>
                        {u.current_pieces || 0}件 · {(u.current_weight_kg || 0).toFixed(1)}kg / 上限{u.max_weight_kg || 0}kg
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.printOne}
                      onPress={() => {
                        setPrintUnits([{ id: u.id, unitNo: u.unit_no }]);
                        setLabelVisible(true);
                      }}
                    >
                      <Ionicons name="print-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}

      {/* 批量创建 Modal */}
      <Modal visible={batchVisible} transparent animationType="slide" onRequestClose={() => setBatchVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>批量创建{unitLabel}</Text>
            <Text style={styles.formLabel}>前缀 *</Text>
            <TextInput
              style={[styles.input, { marginBottom: spacing.md, fontFamily: font.mono, fontWeight: '700' }]}
              value={batchPrefix}
              onChangeText={(v) => setBatchPrefix(v.toUpperCase())}
              placeholder="如:AK / PMC / AKE"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
              maxLength={6}
            />
            <Text style={styles.formLabel}>起始号</Text>
            <TextInput
              style={[styles.input, { marginBottom: spacing.md }]}
              value={String(batchStartNo)}
              onChangeText={(v) => setBatchStartNo(Number(v.replace(/\D/g, '')) || 0)}
              keyboardType="numeric"
            />
            <Text style={styles.formLabel}>数量</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setBatchCount(Math.max(1, batchCount - 1))}
              >
                <Ionicons name="remove" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: '700' }]}
                value={String(batchCount)}
                onChangeText={(v) => setBatchCount(Math.max(1, Number(v.replace(/\D/g, '')) || 1))}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setBatchCount(Math.min(100, batchCount + 1))}
              >
                <Ionicons name="add" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>本次将新增 {batchCount} 个{unitLabel}</Text>
              <Text style={styles.previewRange}>
                {batchPrefix}-{String(batchStartNo).padStart(3, '0')}
                {batchCount > 1 ? ` ~ ${batchPrefix}-${String(batchStartNo + batchCount - 1).padStart(3, '0')}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={styles.printToggle} onPress={() => setBatchShouldPrint(!batchShouldPrint)}>
              <Ionicons
                name={batchShouldPrint ? 'checkbox' : 'square-outline'}
                size={20}
                color={batchShouldPrint ? colors.primary : colors.textTertiary}
              />
              <Text style={{ fontSize: font.sm, color: colors.text, marginLeft: 6 }}>创建后立即打印面单</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setBatchVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: font.md }}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, creating && { opacity: 0.6 }]}
                onPress={handleBatchCreate}
                disabled={creating}
              >
                <Text style={styles.confirmBtnText}>{creating ? '创建中...' : `确认创建 ${batchCount} 个`}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 面单预览 Modal */}
      <Modal visible={labelVisible} transparent animationType="fade" onRequestClose={() => setLabelVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: '90%' }]}>
            <Text style={styles.modalTitle}>面单预览 · {printUnits.length} 张</Text>
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}>
              {printUnits.map((u, idx) => (
                <View
                  key={u.unitNo + idx}
                  style={{
                    borderWidth: 2, borderColor: colors.text,
                    padding: spacing.lg, backgroundColor: '#fff',
                  }}
                >
                  <Text style={{ fontSize: font.xxl, fontWeight: '800', textAlign: 'center', marginBottom: spacing.sm }}>
                    {job?.route_code || '-'}
                  </Text>
                  <View style={{ height: 1, backgroundColor: colors.text, marginVertical: spacing.sm }} />
                  <Text
                    style={{
                      fontSize: 32, fontFamily: font.mono, fontWeight: '800',
                      textAlign: 'center', letterSpacing: 1,
                    }}
                  >
                    {u.unitNo}
                  </Text>
                  <Text style={{ fontSize: font.sm, textAlign: 'center', color: colors.textSecondary, marginTop: 4 }}>
                    JOB: {job?.job_no || '-'}
                  </Text>
                  <View style={{ height: 1, backgroundColor: colors.text, marginVertical: spacing.sm }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontSize: font.xs, color: colors.textSecondary }}>承运人</Text>
                      <Text style={{ fontSize: font.sm, fontWeight: '600' }}>{job?.carrier_name || '-'}</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: font.xs, color: colors.textSecondary }}>ETD</Text>
                      <Text style={{ fontSize: font.sm, fontWeight: '600' }}>{job?.etd || '-'}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLabelVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontSize: font.md }}>关闭</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => {
                  Alert.alert('打印', `${printUnits.length} 张面单已发送到蓝牙打印机`, [
                    { text: '确定', onPress: () => setLabelVisible(false) },
                  ]);
                }}
              >
                <Text style={styles.confirmBtnText}>打印 {printUnits.length} 张</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatChip({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 2, backgroundColor: bg, borderRadius: radius.sm }}>
      <Text style={{ fontSize: font.xs, color, fontWeight: '600' }}>{label} {count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  emptyText: { fontSize: font.sm, color: colors.textTertiary, marginTop: spacing.sm },
  emptyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.md },
  emptyActionText: { color: '#fff', fontSize: font.md, fontWeight: '600' },

  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  navCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md },
  navCreateText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },

  jobCard: { backgroundColor: colors.primaryLight, padding: spacing.md, margin: spacing.md, borderRadius: radius.lg, borderLeftWidth: 3, borderLeftColor: colors.primary },
  jobNo: { fontSize: font.md, fontWeight: '700', fontFamily: font.mono, color: colors.primaryDark },
  jobMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  statsTotal: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '600' },
  printAllBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, backgroundColor: colors.primaryLight, borderRadius: radius.sm },
  printAllText: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },

  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight },
  unitNo: { fontSize: font.md, fontFamily: font.mono, fontWeight: '700', color: colors.text },
  unitMeta: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  printOne: { padding: spacing.sm },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  stepperBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  previewBox: { padding: spacing.md, backgroundColor: colors.primaryLight, borderRadius: radius.md, marginBottom: spacing.md, alignItems: 'center' },
  previewTitle: { fontSize: font.sm, color: colors.primaryDark, marginBottom: 4 },
  previewRange: { fontSize: font.md, fontFamily: font.mono, fontWeight: '700', color: colors.primaryDark },
  printToggle: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  cancelBtn: { flex: 1, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  confirmBtn: { flex: 1, height: 48, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
