import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { jobApi } from '../../lib/api';

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

  // 执行出库表单
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [truckingCompany, setTruckingCompany] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [queryPhone, setQueryPhone] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNo, setPlateNo] = useState('');
  const [plannedTime, setPlannedTime] = useState('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (params.jobId) loadJob(params.jobId as string);
    else setLoading(false);
  }, [params.jobId]);

  const loadJob = async (id: string) => {
    try {
      const res = await jobApi.get(id);
      setJob(res.data);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '无法加载任务信息');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrder = () => {
    if (!scanInput.trim()) { Alert.alert('请输入运单号或扫码'); return; }
    setAddedOrders((prev) => [...prev, { id: scanInput, no: scanInput, pieces: 1, weight: 10 }]);
    setScanInput('');
  };

  const handleExecuteOut = () => {
    if (!recipientName || !recipientPhone || !recipientAddress) {
      Alert.alert('请填写发往地址'); return;
    }
    if (!truckingCompany || !driverName || !driverPhone || !plateNo) {
      Alert.alert('请填写拖车和司机信息'); return;
    }
    Alert.alert('执行成功', '任务已安排发运', [
      { text: '确定', onPress: () => router.back() },
    ]);
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
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
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

          {/* 模式切换 */}
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeBtn, mode === 'add-order' && styles.modeBtnActive]}
              onPress={() => setMode('add-order')}
            >
              <Text style={[styles.modeText, mode === 'add-order' && styles.modeTextActive]}>📦 添加订单</Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === 'execute-out' && styles.modeBtnActive]}
              onPress={() => setMode('execute-out')}
            >
              <Text style={[styles.modeText, mode === 'execute-out' && styles.modeTextActive]}>🚀 执行出库</Text>
            </Pressable>
          </View>

          {mode === 'add-order' ? (
            <>
              {/* 扫码添加 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>扫码添加订单</Text>
                <View style={styles.scanRow}>
                  <TextInput
                    style={styles.scanInput}
                    placeholder="扫码或手动输入运单号"
                    placeholderTextColor={colors.textTertiary}
                    value={scanInput}
                    onChangeText={setScanInput}
                    onSubmitEditing={handleAddOrder}
                  />
                  <TouchableOpacity style={styles.scanBtn}>
                    <Ionicons name="scan-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addBtn} onPress={handleAddOrder}>
                    <Text style={styles.addBtnText}>添加</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 已装订单列表 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>已装订单 ({addedOrders.length})</Text>
                {addedOrders.length === 0 ? (
                  <Text style={styles.emptyText}>暂无已装订单，请扫码添加</Text>
                ) : (
                  addedOrders.map((o, i) => (
                    <View key={i} style={styles.orderItem}>
                      <Text style={styles.orderNo}>{o.no}</Text>
                      <Text style={styles.orderMeta}>{o.pieces}件 · {o.weight}kg</Text>
                    </View>
                  ))
                )}
              </View>
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
                <Text style={styles.sectionTitle}>拖车公司</Text>
                <FormInput label="拖车公司" value={truckingCompany} onChange={setTruckingCompany} required placeholder="广州顺达拖车" />
                <FormInput label="送货单号" value={trackingNo} onChange={setTrackingNo} placeholder="选填" />
                <FormInput label="查询电话" value={queryPhone} onChange={setQueryPhone} keyboardType="phone-pad" placeholder="拖车公司客服电话" />
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

        {/* 底部按钮 */}
        <View style={styles.bottomBar}>
          {mode === 'add-order' ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={() => setMode('execute-out')}>
              <Text style={styles.btnPrimaryText}>下一步：执行出库</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btnExecute} onPress={handleExecuteOut}>
              <Text style={styles.btnPrimaryText}>确认执行出库</Text>
            </TouchableOpacity>
          )}
        </View>
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

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  btnPrimary: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnExecute: { height: 52, backgroundColor: '#f97316', borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
});
