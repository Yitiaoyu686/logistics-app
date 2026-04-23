import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, Pressable, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { jobApi, systemApi, orderApi, warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface SupplierOption {
  id: string;
  name: string;
  supplier_type: string;
  phone?: string | null;
}

type Mode = 'add-order' | 'execute-out';

export default function PackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string; mode?: Mode }>();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(params.mode || 'add-order');

  // 添加订单扫码
  const [scanInput, setScanInput] = useState('');
  const [addedOrders, setAddedOrders] = useState<any[]>([]);

  // 集装号 - 单个 (海运)
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [unitNo, setUnitNo] = useState('');
  const [containerType, setContainerType] = useState('40HQ');
  const [sealNo, setSealNo] = useState('');
  const [unitMaxWeight, setUnitMaxWeight] = useState('26000');
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const [createdUnit, setCreatedUnit] = useState<{ id: string; unitNo: string } | null>(null);

  // 集装号 - 批量 (空运): 前缀 + 起始号 + 数量
  const [batchPrefix, setBatchPrefix] = useState('AK');
  const [batchStartNo, setBatchStartNo] = useState(1);
  const [batchCount, setBatchCount] = useState(10);
  const [batchShouldPrint, setBatchShouldPrint] = useState(true);

  // 面单预览支持多个 unit
  const [printUnits, setPrintUnits] = useState<Array<{ id?: string; unitNo: string }>>([]);

  // 扫码绑定:当前激活集装号(空运关键交互)
  const [activeUnit, setActiveUnit] = useState<{ id: string; unit_no: string } | null>(null);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [unitSearchKw, setUnitSearchKw] = useState('');
  const [bindingOrder, setBindingOrder] = useState(false);
  // 先扫运单后扫集装号场景:待绑缓冲区
  const [pendingOrders, setPendingOrders] = useState<Array<{ id: string; sub_order_no: string; pieces?: number; actual_weight_kg?: number }>>([]);
  const scanInputRef = useRef<TextInput>(null);
  // 连续扫码:内联 toast 反馈(不打断流程)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warn'; text: string; detail?: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  // 防重扫:短时间同值去重
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  // 展示 toast, 2.5s 自动消失
  const showToast = (type: 'success' | 'error' | 'warn', text: string, detail?: string) => {
    setToast({ type, text, detail });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500) as unknown as number;
  };

  // 执行出库表单
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [truckingCompanyId, setTruckingCompanyId] = useState('');
  const [truckingCompany, setTruckingCompany] = useState('');
  const [shippingNo, setShippingNo] = useState('');
  const [queryPhone, setQueryPhone] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNo, setPlateNo] = useState('');
  const [plannedTime, setPlannedTime] = useState('');
  const [remark, setRemark] = useState('');

  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const unitLabel = job?.business_line === 'AIR' ? '集装号' : '集装箱号';

  useEffect(() => {
    if (params.jobId) loadJob(params.jobId as string);
    else setLoading(false);
  }, [params.jobId]);

  useEffect(() => {
    if (mode !== 'execute-out') return;
    (async () => {
      try {
        const res = await systemApi.suppliers();
        const list = (res.data as SupplierOption[]) || [];
        setSuppliers(list.filter((s) => s.supplier_type === 'CARRIER' || s.supplier_type === 'TRUCKING'));
      } catch {
        setSuppliers([]);
      }
    })();
  }, [mode]);

  const loadJob = async (id: string) => {
    try {
      const res = await jobApi.get(id);
      const jobData: any = res.data;
      setJob(jobData);
      // 海运自动激活唯一集装号(1 JOB = 1 集装箱)
      if (jobData?.business_line === 'SEA') {
        const units = (jobData.units || []) as Array<{ id: string; unit_no: string }>;
        if (units.length > 0 && !activeUnit) {
          setActiveUnit({ id: units[0].id, unit_no: units[0].unit_no });
        }
      }
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '无法加载任务信息');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUnit = async () => {
    if (!job) { Alert.alert('任务信息缺失'); return; }
    if (!unitNo.trim()) { Alert.alert(`请填写${unitLabel}`); return; }
    setCreatingUnit(true);
    try {
      const res = await jobApi.createShippingUnit({
        unitNo,
        businessLine: job.business_line,
        unitType: 'CONTAINER',
        containerType,
        sealNo: sealNo || undefined,
        jobId: job.id,
        routeCode: job.route_code,
        maxWeightKg: Number(unitMaxWeight) || 0,
      });
      setCreatedUnit({ id: res.data?.id, unitNo: res.data?.unitNo });
      setPrintUnits([{ id: res.data?.id, unitNo: res.data?.unitNo || unitNo }]);
      setUnitDialogOpen(false);
      Alert.alert('创建成功', `${unitLabel} ${res.data?.unitNo} 已创建`, [
        { text: '打印面单', onPress: () => setLabelVisible(true) },
        { text: '继续添加', style: 'cancel' },
      ]);
      loadJob(job.job_no || job.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请重试';
      Alert.alert('创建失败', message);
    } finally {
      setCreatingUnit(false);
    }
  };

  // 空运批量创建集装号
  const handleBatchCreateUnits = async () => {
    if (!job) { Alert.alert('任务信息缺失'); return; }
    const prefix = batchPrefix.trim().toUpperCase();
    if (!prefix) { Alert.alert('请输入前缀'); return; }
    if (!Number.isFinite(batchStartNo) || batchStartNo < 0) { Alert.alert('起始号无效'); return; }
    if (!Number.isFinite(batchCount) || batchCount < 1) { Alert.alert('数量至少 1'); return; }

    // 冲突预检
    const existingNos = new Set(
      (job.units || []).map((u: any) => String(u.unit_no || '').toUpperCase())
    );
    const genNos: string[] = [];
    for (let i = 0; i < batchCount; i++) {
      const num = batchStartNo + i;
      const unitNum = `${prefix}-${String(num).padStart(3, '0')}`;
      if (existingNos.has(unitNum.toUpperCase())) {
        Alert.alert('冲突', `${unitNum} 已存在,请调整起始号`);
        return;
      }
      genNos.push(unitNum);
    }

    setCreatingUnit(true);
    const created: Array<{ id: string; unitNo: string }> = [];
    const failed: string[] = [];
    for (const unum of genNos) {
      try {
        const res = await jobApi.createShippingUnit({
          unitNo: unum,
          businessLine: 'AIR',
          unitType: 'PALLET',
          jobId: job.id,
          routeCode: job.route_code,
          maxWeightKg: 1500,
          maxVolumeCbm: 12,
        });
        created.push({ id: res.data?.id, unitNo: res.data?.unitNo || unum });
      } catch (err) {
        failed.push(unum);
      }
    }
    setCreatingUnit(false);

    if (failed.length > 0) {
      Alert.alert('部分失败', `已创建 ${created.length} / 失败 ${failed.length}\n失败: ${failed.join(', ')}`);
    }
    if (created.length > 0) {
      setPrintUnits(created);
      setUnitDialogOpen(false);
      setBatchStartNo(batchStartNo + batchCount); // 下次默认续号
      if (batchShouldPrint) {
        setLabelVisible(true);
      } else {
        Alert.alert('创建成功', `已新增 ${created.length} 个集装号`);
      }
      loadJob(job.job_no || job.id);
    }
  };

  // 打开批量弹窗时自动推算前缀和起始号
  const openUnitDialog = () => {
    const units = (job?.units || []) as any[];
    if (job?.business_line === 'AIR' && units.length > 0) {
      // 取第一个 unit 的字母前缀
      const sample = String(units[0].unit_no || 'AK').toUpperCase();
      const pfxMatch = sample.match(/^([A-Z]+)/);
      const pfx = pfxMatch?.[1] || 'AK';
      // 同前缀的最大数字号 +1
      let maxNum = 0;
      for (const u of units) {
        const m = String(u.unit_no || '').toUpperCase().match(new RegExp(`^${pfx}[-]?(\\d+)$`));
        if (m) maxNum = Math.max(maxNum, Number(m[1]));
      }
      setBatchPrefix(pfx);
      setBatchStartNo(maxNum + 1);
    } else if (job?.business_line === 'AIR') {
      setBatchPrefix('AK');
      setBatchStartNo(1);
    }
    setUnitDialogOpen(true);
  };

  // 智能双向连续扫码:不用 Alert 打断,用顶部 toast
  //   - 匹配本 job 某 unit.unit_no → 激活集装号;若缓冲区有待绑运单,自动全部绑定
  //   - 其他 → 查子单:已激活→直接绑;未激活→进入待绑缓冲区,等扫集装号时一并绑定
  const handleAddOrder = async () => {
    const raw = scanInput.trim();
    // 立刻清空 + 保焦点,让下一次扫码马上可以进行
    setScanInput('');
    scanInputRef.current?.focus();
    if (!raw) return;
    const code = raw.toUpperCase();

    // 防重扫:600ms 内同一个值忽略
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === code && now - lastScanRef.current.at < 600) {
      return;
    }
    lastScanRef.current = { code, at: now };

    const jobUnits = (job?.units || []) as Array<{ id: string; unit_no: string }>;
    const matchedUnit = jobUnits.find((u) => String(u.unit_no || '').toUpperCase() === code);

    if (matchedUnit) {
      // 扫到集装号
      setActiveUnit({ id: matchedUnit.id, unit_no: matchedUnit.unit_no });
      if (pendingOrders.length > 0) {
        setBindingOrder(true);
        try {
          await warehouseApi.loadUnit(matchedUnit.id, pendingOrders.map((o) => o.id));
          const n = pendingOrders.length;
          setPendingOrders([]);
          await loadJob(job.job_no || job.id);
          showToast('success', `${matchedUnit.unit_no} 已激活`, `已绑入缓冲区 ${n} 个运单`);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : '批量绑定失败';
          showToast('error', '批量绑定失败', message);
        } finally {
          setBindingOrder(false);
          scanInputRef.current?.focus();
        }
      } else {
        showToast('success', `${matchedUnit.unit_no} 已激活`, '继续扫运单码');
      }
      return;
    }

    // 非集装号 → 当运单号处理
    setBindingOrder(true);
    try {
      const subRes = await orderApi.getSubByNo(raw);
      const sub = (subRes as any)?.data;
      if (!sub?.id) {
        showToast('error', '运单未找到', `${raw} 不在系统中`);
        return;
      }

      if (activeUnit) {
        // 已激活 → 直接绑
        await warehouseApi.loadUnit(activeUnit.id, [sub.id]);
        await loadJob(job.job_no || job.id);
        showToast('success', `✓ 已绑入 ${activeUnit.unit_no}`, `${sub.sub_order_no} · ${sub.pieces || 0}件 ${(sub.actual_weight_kg || 0).toFixed(1)}kg`);
      } else {
        // 未激活 → 进缓冲区
        if (pendingOrders.some((o) => o.id === sub.id)) {
          showToast('warn', '已在待绑列表', `${sub.sub_order_no} 已扫过`);
        } else {
          setPendingOrders((prev) => [...prev, {
            id: sub.id,
            sub_order_no: sub.sub_order_no,
            pieces: sub.pieces,
            actual_weight_kg: sub.actual_weight_kg,
          }]);
          showToast('success', '已加入待绑', `${sub.sub_order_no} · 扫集装号完成绑定`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '处理失败';
      showToast('error', '处理失败', message);
    } finally {
      setBindingOrder(false);
      scanInputRef.current?.focus();
    }
  };

  // 解绑已绑运单
  const handleUnbind = async (subOrderId: string, subOrderNo: string) => {
    if (!activeUnit) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert('确认移除', `将 ${subOrderNo} 从 ${activeUnit.unit_no} 中移除?`, [
        { text: '取消', style: 'cancel', onPress: () => resolve(false) },
        { text: '移除', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;
    try {
      await warehouseApi.unbindUnitItem(activeUnit.id, subOrderId);
      await loadJob(job.job_no || job.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '移除失败';
      Alert.alert('移除失败', message);
    }
  };

  // 从缓冲区移除
  const handleRemovePending = (orderId: string) => {
    setPendingOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  const handleExecuteOut = async () => {
    if (!recipientName || !recipientPhone || !recipientAddress) {
      Alert.alert('请填写发往地址'); return;
    }
    if (!truckingCompany || !driverName || !driverPhone || !plateNo) {
      Alert.alert('请填写拖车公司/司机信息'); return;
    }
    if (!job) { Alert.alert('任务信息缺失'); return; }

    setSubmitting(true);
    try {
      await jobApi.update(job.job_no || job.id, {
        jobStatus: 'LOADING',
        truckingCompany,
        truckingCompanyId: truckingCompanyId || undefined,
        shippingNo: shippingNo || undefined,
        driverName,
        driverPhone,
        plateNo,
        queryPhone: queryPhone || undefined,
        trackUrl: trackUrl || undefined,
        recipientName,
        recipientPhone,
        recipientAddress,
        remark: remark || undefined,
      });
      // 记录一条跟踪事件
      await jobApi.addEvent({
        jobId: job.id,
        eventScope: 'JOB',
        nodeCode: 'DEPARTED',
        nodeName: '已发车',
        eventType: 'DISPATCH',
        statusCode: 'LOADING',
        remark: `${truckingCompany} ${driverName} ${plateNo}`,
      }).catch(() => null);
      Alert.alert('执行成功', '任务已安排发运', [
        { text: '确定', onPress: () => safeBack(router) },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请重试';
      Alert.alert('执行失败', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><Text style={{ color: colors.textTertiary }}>加载中...</Text></View>
      </SafeAreaView>
    );
  }

  const currentWeight = job?.total_weight_kg || 0;
  const maxWeight = 26000;
  const progress = Math.min(100, (currentWeight / maxWeight) * 100);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Nav */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{mode === 'add-order' ? '装箱 · 添加订单' : '执行出库'}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 任务信息卡 */}
          {job && (
            <View style={styles.jobCard}>
              <Text style={styles.jobNo}>{job.job_no} · {job.container_no || '未创建'}</Text>
              <View style={styles.jobMetaRow}>
                <View style={styles.jobMeta}>
                  <Text style={styles.jobMetaLabel}>线路</Text>
                  <Text style={styles.jobMetaValue}>{job.route_code || '-'}</Text>
                </View>
                <View style={styles.jobMeta}>
                  <Text style={styles.jobMetaLabel}>柜型</Text>
                  <Text style={styles.jobMetaValue}>{job.container_type || '-'}</Text>
                </View>
                <View style={styles.jobMeta}>
                  <Text style={styles.jobMetaLabel}>承运人</Text>
                  <Text style={styles.jobMetaValue}>{job.carrier_name || '-'}</Text>
                </View>
                <View style={styles.jobMeta}>
                  <Text style={styles.jobMetaLabel}>ETD</Text>
                  <Text style={styles.jobMetaValue}>{job.etd || '-'}</Text>
                </View>
              </View>

              <View style={styles.progressBox}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {job.total_pieces || 0} 件 / {currentWeight} kg / {progress.toFixed(0)}%
                </Text>
              </View>
            </View>
          )}

          {mode === 'add-order' ? (
            <>
              {(() => {
                const isAir = job?.business_line === 'AIR';
                const jobUnits = (job?.units || []) as Array<{
                  id: string; unit_no: string; unit_status?: string;
                  current_weight_kg?: number; current_pieces?: number;
                }>;
                const relations = (job?.relations || []) as Array<{
                  sub_order_id: string; shipping_unit_id: string;
                  sub_order_no?: string; pieces?: number; actual_weight_kg?: number;
                }>;

                // 海运:维持原单个展示(兼容)
                if (!isAir) {
                  return (
                    <>
                      <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={styles.sectionTitle}>📦 {unitLabel}</Text>
                          {(!job?.container_no && !createdUnit) && (
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                paddingHorizontal: spacing.md, paddingVertical: 6,
                                backgroundColor: colors.primaryLight, borderRadius: radius.md,
                              }}
                              onPress={openUnitDialog}
                            >
                              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                              <Text style={{ fontSize: font.sm, color: colors.primary, fontWeight: '600' }}>创建{unitLabel}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {(job?.container_no || createdUnit) ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
                            <Ionicons name="cube-outline" size={20} color={colors.primary} />
                            <Text style={{ flex: 1, fontSize: font.md, color: colors.text, fontFamily: font.mono, fontWeight: '600' }}>
                              {createdUnit?.unitNo || job?.container_no}
                            </Text>
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                paddingHorizontal: spacing.md, paddingVertical: 6,
                                backgroundColor: colors.primary, borderRadius: radius.md,
                              }}
                              onPress={() => setLabelVisible(true)}
                            >
                              <Ionicons name="print-outline" size={16} color="#fff" />
                              <Text style={{ fontSize: font.sm, color: '#fff', fontWeight: '600' }}>打印面单</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <Text style={{ fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.sm }}>
                            请先创建{unitLabel}
                          </Text>
                        )}
                      </View>
                    </>
                  );
                }

                // 空运:极简扫码流程
                const activeRelations = activeUnit
                  ? relations.filter((r) => r.shipping_unit_id === activeUnit.id)
                  : [];
                const activeUnitData = activeUnit
                  ? jobUnits.find((u) => u.id === activeUnit.id)
                  : null;

                return (
                  <>
                    {/* 顶部管理入口 + 空状态引导 */}
                    <TouchableOpacity
                      style={styles.manageLink}
                      onPress={() => router.push({ pathname: '/task/shipping-units', params: { jobId: job.id } })}
                    >
                      <Ionicons name="cube-outline" size={16} color={colors.primary} />
                      <Text style={styles.manageLinkText}>
                        管理{unitLabel} ({jobUnits.length})
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    {jobUnits.length === 0 && (
                      <View style={[styles.section, { alignItems: 'center', paddingVertical: spacing.xl }]}>
                        <Ionicons name="cube-outline" size={36} color={colors.textTertiary} />
                        <Text style={{ fontSize: font.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                          还没有{unitLabel},请先批量创建并打印面单贴到货物上
                        </Text>
                        <TouchableOpacity
                          style={[styles.btnPrimary, { marginTop: spacing.md, paddingHorizontal: spacing.lg }]}
                          onPress={() => router.push({ pathname: '/task/shipping-units', params: { jobId: job.id } })}
                        >
                          <Text style={styles.btnPrimaryText}>去创建{unitLabel}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* 激活的集装号卡(大字显示) */}
                    {activeUnit && activeUnitData && (
                      <View style={[styles.section, styles.activeUnitCard]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                          <Text style={{ fontSize: font.xs, color: '#fff', opacity: 0.9 }}>当前{unitLabel}</Text>
                          <TouchableOpacity onPress={() => setActiveUnit(null)} style={{ padding: 4 }}>
                            <Text style={{ fontSize: font.xs, color: '#fff', opacity: 0.9, textDecorationLine: 'underline' }}>完成,换下一个</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.activeUnitNo}>{activeUnit.unit_no}</Text>
                        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, justifyContent: 'center' }}>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: font.xs, color: '#fff', opacity: 0.8 }}>件数</Text>
                            <Text style={{ fontSize: font.lg, color: '#fff', fontWeight: '700' }}>{activeUnitData.current_pieces || 0}</Text>
                          </View>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: font.xs, color: '#fff', opacity: 0.8 }}>重量</Text>
                            <Text style={{ fontSize: font.lg, color: '#fff', fontWeight: '700' }}>{(activeUnitData.current_weight_kg || 0).toFixed(1)} kg</Text>
                          </View>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ fontSize: font.xs, color: '#fff', opacity: 0.8 }}>运单</Text>
                            <Text style={{ fontSize: font.lg, color: '#fff', fontWeight: '700' }}>{activeRelations.length}</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* 待绑缓冲区(先扫运单后扫集装号场景) */}
                    {!activeUnit && pendingOrders.length > 0 && (
                      <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>📋 待绑运单 ({pendingOrders.length})</Text>
                          <Text style={{ fontSize: font.xs, color: colors.warning }}>⏳ 扫集装号绑定</Text>
                        </View>
                        {pendingOrders.map((o) => (
                          <View key={o.id} style={styles.orderItem}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.orderNo}>{o.sub_order_no}</Text>
                              <Text style={styles.orderMeta}>{o.pieces || 0}件 · {(o.actual_weight_kg || 0).toFixed(1)}kg</Text>
                            </View>
                            <TouchableOpacity onPress={() => handleRemovePending(o.id)} style={{ padding: 6 }}>
                              <Ionicons name="close-circle" size={20} color={colors.danger} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* 本箱已绑运单 — 带删除 */}
                    {activeUnit && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>本箱已装运单 ({activeRelations.length})</Text>
                        {activeRelations.length === 0 ? (
                          <Text style={styles.emptyText}>暂无,请扫运单码添加</Text>
                        ) : (
                          activeRelations.map((r) => (
                            <View key={r.sub_order_id} style={styles.orderItem}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.orderNo}>{r.sub_order_no || r.sub_order_id}</Text>
                                <Text style={styles.orderMeta}>{r.pieces || 0}件 · {(r.actual_weight_kg || 0).toFixed(1)}kg</Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => handleUnbind(r.sub_order_id, r.sub_order_no || r.sub_order_id)}
                                style={{ padding: 6 }}
                              >
                                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                              </TouchableOpacity>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <>
              {/* 发往地址 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>发往地址</Text>
                <FormInput label="收货人姓名" value={recipientName} onChange={setRecipientName} required placeholder="如：刘生" />
                <FormInput label="联系电话" value={recipientPhone} onChange={setRecipientPhone} required keyboardType="phone-pad" placeholder="请输入联系电话" />
                <FormInput label="详细地址" value={recipientAddress} onChange={setRecipientAddress} required placeholder="港口/承运人仓库地址" />
              </View>

              {/* 拖车公司 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>拖车 / 物流公司</Text>
                <View style={styles.formItem}>
                  <Text style={styles.formLabel}>公司名称 <Text style={styles.required}>*</Text></Text>
                  <TouchableOpacity
                    style={[styles.input, styles.selectInput]}
                    onPress={() => setSupplierPickerOpen(true)}
                  >
                    <Text style={{
                      fontSize: font.md,
                      color: truckingCompany ? colors.text : colors.textTertiary,
                    }}>
                      {truckingCompany || '请选择承运方'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <FormInput label="送货单号" value={shippingNo} onChange={setShippingNo} placeholder="承运方的送货单号" />
                <FormInput label="查询电话" value={queryPhone} onChange={setQueryPhone} keyboardType="phone-pad" placeholder="拖车公司客服电话" />
                <FormInput label="查询网址" value={trackUrl} onChange={setTrackUrl} placeholder="物流公司跟踪网址" />
              </View>

              {/* 司机与车辆 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>司机与车辆</Text>
                <View style={styles.formRow}>
                  <FormInput label="司机名字" value={driverName} onChange={setDriverName} required placeholder="请输入" compact />
                  <FormInput label="司机电话" value={driverPhone} onChange={setDriverPhone} required keyboardType="phone-pad" placeholder="请输入" compact />
                </View>
                <FormInput label="车牌号码" value={plateNo} onChange={setPlateNo} required placeholder="粤A88888" />
                <FormInput label="预计发货时间" value={plannedTime} onChange={setPlannedTime} placeholder="2026-04-15 09:00" />
                <FormInput label="备注" value={remark} onChange={setRemark} placeholder="发货备注" multiline />
              </View>
            </>
          )}
        </ScrollView>

        {/* 连续扫码 toast (底部浮层) */}
        {mode === 'add-order' && toast && (
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

        {/* 底部:添加订单模式常驻扫码;执行出库模式保留确认按钮 */}
        {mode === 'add-order' ? (
          <View style={styles.scanBottomBar}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' }}>
                🔍 {activeUnit
                  ? `扫运单 → ${activeUnit.unit_no}`
                  : pendingOrders.length > 0
                    ? `已扫 ${pendingOrders.length} 个运单,请扫集装号一并绑定`
                    : '扫集装号或运单码'}
              </Text>
              {job?.business_line === 'AIR' && !activeUnit && (job?.units?.length || 0) > 0 && (
                <TouchableOpacity onPress={() => { setUnitSearchKw(''); setUnitPickerOpen(true); }}>
                  <Text style={{ fontSize: font.xs, color: colors.primary }}>选集装号 ›</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.scanRow}>
              <TextInput
                ref={scanInputRef}
                style={styles.scanInput}
                placeholder="扫码/输入编码"
                placeholderTextColor={colors.textTertiary}
                value={scanInput}
                onChangeText={setScanInput}
                onSubmitEditing={handleAddOrder}
                autoCapitalize="characters"
                returnKeyType="send"
                autoFocus
              />
              <TouchableOpacity style={styles.scanBtn}>
                <Ionicons name="scan-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addBtn, bindingOrder && { opacity: 0.6 }]}
                onPress={handleAddOrder}
                disabled={bindingOrder}
              >
                <Text style={styles.addBtnText}>
                  {bindingOrder ? '...' : '确认'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.btnExecute, submitting && { opacity: 0.6 }]}
              onPress={handleExecuteOut}
              disabled={submitting}
            >
              <Text style={styles.btnPrimaryText}>{submitting ? '处理中...' : '确认执行出库'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 创建集装号 Modal */}
        <Modal
          visible={unitDialogOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setUnitDialogOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              {job?.business_line === 'AIR' ? (
                <>
                  <Text style={styles.modalTitle}>批量创建{unitLabel}</Text>

                  <Text style={styles.formLabel}>前缀 *</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: spacing.md, fontFamily: font.mono, fontWeight: '700' }]}
                    value={batchPrefix}
                    onChangeText={(v) => setBatchPrefix(v.toUpperCase())}
                    placeholder="如：AK / PMC / AKE"
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
                    placeholder="1"
                    placeholderTextColor={colors.textTertiary}
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
                    <Text style={styles.previewTitle}>本次将新增 {batchCount} 个集装号</Text>
                    <Text style={styles.previewRange}>
                      {batchPrefix}-{String(batchStartNo).padStart(3, '0')}
                      {batchCount > 1 ? ` ~ ${batchPrefix}-${String(batchStartNo + batchCount - 1).padStart(3, '0')}` : ''}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.printToggle}
                    onPress={() => setBatchShouldPrint(!batchShouldPrint)}
                  >
                    <Ionicons
                      name={batchShouldPrint ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={batchShouldPrint ? colors.primary : colors.textTertiary}
                    />
                    <Text style={{ fontSize: font.sm, color: colors.text, marginLeft: 6 }}>
                      创建后立即打印面单
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setUnitDialogOpen(false)}>
                      <Text style={{ color: colors.textSecondary, fontSize: font.md }}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnPrimary, { flex: 1, height: 48 }, creatingUnit && { opacity: 0.6 }]}
                      onPress={handleBatchCreateUnits}
                      disabled={creatingUnit}
                    >
                      <Text style={styles.btnPrimaryText}>{creatingUnit ? '创建中...' : `确认创建 ${batchCount} 个`}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>创建{unitLabel}</Text>

                  <Text style={styles.formLabel}>{unitLabel} *</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: spacing.md }]}
                    value={unitNo}
                    onChangeText={setUnitNo}
                    placeholder="如：CSLU2185436"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                  />

                  <Text style={styles.formLabel}>柜型</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
                    {['20GP', '40GP', '40HQ', '45HQ', 'LCL'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={{
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                          borderRadius: radius.full,
                          borderWidth: 1,
                          borderColor: containerType === t ? colors.primary : colors.border,
                          backgroundColor: containerType === t ? colors.primary : colors.card,
                        }}
                        onPress={() => setContainerType(t)}
                      >
                        <Text
                          style={{
                            fontSize: font.sm,
                            color: containerType === t ? '#fff' : colors.textSecondary,
                            fontWeight: containerType === t ? '600' : '400',
                          }}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.formLabel}>封条号</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: spacing.md }]}
                    value={sealNo}
                    onChangeText={setSealNo}
                    placeholder="选填"
                    placeholderTextColor={colors.textTertiary}
                  />

                  <Text style={styles.formLabel}>载重上限 (kg)</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: spacing.lg }]}
                    value={unitMaxWeight}
                    onChangeText={setUnitMaxWeight}
                    keyboardType="numeric"
                    placeholder="26000"
                    placeholderTextColor={colors.textTertiary}
                  />

                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setUnitDialogOpen(false)}>
                      <Text style={{ color: colors.textSecondary, fontSize: font.md }}>取消</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnPrimary, { flex: 1, height: 48 }, creatingUnit && { opacity: 0.6 }]}
                      onPress={handleCreateUnit}
                      disabled={creatingUnit}
                    >
                      <Text style={styles.btnPrimaryText}>{creatingUnit ? '创建中...' : '创建'}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* 面单预览 Modal — 支持批量 */}
        <Modal
          visible={labelVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLabelVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalSheet, { paddingVertical: spacing.xl, maxHeight: '90%' }]}>
              <Text style={styles.modalTitle}>
                📋 面单预览{printUnits.length > 1 ? ` · ${printUnits.length} 张` : ''}
              </Text>

              <ScrollView
                style={{ maxHeight: 520 }}
                contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}
                showsVerticalScrollIndicator
              >
                {(printUnits.length > 0
                  ? printUnits
                  : [{ unitNo: createdUnit?.unitNo || job?.container_no || '-' }]
                ).map((u, idx) => (
                  <View
                    key={u.unitNo + idx}
                    style={{
                      borderWidth: 2,
                      borderColor: colors.text,
                      padding: spacing.lg,
                      backgroundColor: '#fff',
                    }}
                  >
                    <Text style={{ fontSize: font.xxl, fontWeight: '800', textAlign: 'center', marginBottom: spacing.sm }}>
                      {job?.route_code || '-'}
                    </Text>
                    <View style={{ height: 1, backgroundColor: colors.text, marginVertical: spacing.sm }} />
                    <Text
                      style={{
                        fontSize: 32,
                        fontFamily: font.mono,
                        fontWeight: '800',
                        textAlign: 'center',
                        letterSpacing: 1,
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
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setLabelVisible(false)}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: font.md }}>关闭</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, { flex: 1, height: 48 }]}
                  onPress={() => {
                    const count = printUnits.length || 1;
                    Alert.alert('🖨 打印', `${count} 张面单已发送到蓝牙打印机`, [
                      { text: '确定', onPress: () => setLabelVisible(false) },
                    ]);
                  }}
                >
                  <Text style={styles.btnPrimaryText}>
                    打印{printUnits.length > 1 ? ` ${printUnits.length} 张` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 集装号选择器(扫码枪不可用时降级) */}
        <Modal
          visible={unitPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setUnitPickerOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setUnitPickerOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>选择集装号</Text>
              <TextInput
                style={[styles.input, { marginBottom: spacing.sm }]}
                value={unitSearchKw}
                onChangeText={setUnitSearchKw}
                placeholder="搜索集装号"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
              />
              <ScrollView style={{ maxHeight: 480 }}>
                {((job?.units || []) as Array<{ id: string; unit_no: string; unit_status?: string; current_pieces?: number; current_weight_kg?: number }>)
                  .filter((u) => !unitSearchKw || String(u.unit_no || '').toUpperCase().includes(unitSearchKw.toUpperCase()))
                  .map((u) => {
                    const isActive = activeUnit?.id === u.id;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={{
                          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                          paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
                          borderBottomWidth: 0.5, borderBottomColor: colors.borderLight,
                          backgroundColor: isActive ? colors.primaryLight : 'transparent',
                        }}
                        onPress={() => {
                          setActiveUnit({ id: u.id, unit_no: u.unit_no });
                          setUnitPickerOpen(false);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: font.md, fontFamily: font.mono, fontWeight: '700', color: colors.text }}>{u.unit_no}</Text>
                          <Text style={{ fontSize: font.xs, color: colors.textSecondary, marginTop: 2 }}>
                            {u.unit_status || 'EMPTY'} · {u.current_pieces || 0}件 / {(u.current_weight_kg || 0).toFixed(1)}kg
                          </Text>
                        </View>
                        {isActive && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* 承运方选择 */}
        <Modal
          visible={supplierPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setSupplierPickerOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => setSupplierPickerOpen(false)}
          >
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>选择拖车 / 物流公司</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {suppliers.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: colors.textTertiary, paddingVertical: spacing.lg }}>
                    暂无数据
                  </Text>
                ) : (
                  suppliers.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.supplierItem}
                      onPress={() => {
                        setTruckingCompanyId(s.id);
                        setTruckingCompany(s.name);
                        if (s.phone && !queryPhone) setQueryPhone(s.phone);
                        setSupplierPickerOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.supplierName}>{s.name}</Text>
                        <Text style={styles.supplierSub}>
                          {s.supplier_type === 'CARRIER' ? '物流公司' : '拖车公司'}
                          {s.phone ? ` · ${s.phone}` : ''}
                        </Text>
                      </View>
                      {truckingCompanyId === s.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormInput({ label, value, onChange, required, placeholder, keyboardType, compact, multiline }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
  placeholder?: string; keyboardType?: any; compact?: boolean; multiline?: boolean;
}) {
  return (
    <View style={[styles.formItem, compact && { flex: 1 }]}>
      <Text style={styles.formLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={[styles.input, multiline && styles.textarea]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 2 : 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: 120 },

  jobCard: { backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#93c5fd', marginBottom: spacing.md },
  jobNo: { fontSize: font.md, fontWeight: '700', color: colors.primaryDark, marginBottom: spacing.md, fontFamily: font.mono },
  jobMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  jobMeta: { width: '50%', marginBottom: spacing.sm },
  jobMetaLabel: { fontSize: font.xs, color: colors.textSecondary },
  jobMetaValue: { fontSize: font.sm, color: colors.text, fontWeight: '500', marginTop: 2 },
  progressBox: { },
  progressBar: { height: 8, backgroundColor: colors.card, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.xs },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  progressText: { fontSize: font.xs, color: colors.primary, fontWeight: '600', textAlign: 'right' },

  modeSwitch: { flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radius.md, padding: 3, marginBottom: spacing.md },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  modeBtnActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  modeText: { fontSize: font.sm, color: colors.textSecondary },
  modeTextActive: { color: colors.primary, fontWeight: '600' },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md, paddingLeft: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },

  scanRow: { flexDirection: 'row', gap: spacing.sm },
  scanInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text },
  scanBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  addBtn: { height: 44, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },

  emptyText: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  orderNo: { fontSize: font.sm, color: colors.text, fontFamily: font.mono },
  orderMeta: { fontSize: font.sm, color: colors.textSecondary },

  formRow: { flexDirection: 'row', gap: spacing.sm },
  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 4 },
  required: { color: colors.danger },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { height: 64, paddingVertical: spacing.sm, textAlignVertical: 'top' },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },

  // 激活集装号卡(扫码绑定)
  activeUnitCard: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg },
  activeUnitNo: { fontSize: 42, fontFamily: font.mono, fontWeight: '900', color: '#fff', letterSpacing: 3, textAlign: 'center', marginTop: spacing.xs },

  // 管理集装号入口
  manageLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.primaryLight, borderRadius: radius.md, marginBottom: spacing.sm },
  manageLinkText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },

  // 连续扫码 toast
  scanToast: {
    position: 'absolute', left: spacing.md, right: spacing.md, bottom: 104,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  scanToastText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },
  scanToastDetail: { color: '#fff', fontSize: font.xs, opacity: 0.9, marginTop: 1 },

  // 底部常驻扫码栏
  scanBottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 6,
  },

  // 批量创建集装号
  stepperBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  previewBox: { padding: spacing.md, backgroundColor: colors.primaryLight, borderRadius: radius.md, marginBottom: spacing.md, alignItems: 'center' },
  previewTitle: { fontSize: font.sm, color: colors.primaryDark, marginBottom: 4 },
  previewRange: { fontSize: font.md, fontFamily: font.mono, fontWeight: '700', color: colors.primaryDark },
  printToggle: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  cancelBtn: { flex: 1, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  supplierItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  supplierName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  supplierSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  btnPrimary: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnExecute: { height: 52, backgroundColor: '#f97316', borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
});
