import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { orderApi, warehouseApi } from '../../lib/api';

type PackageCondition = 'GOOD' | 'DAMAGED' | 'WET' | 'OPENED' | 'INCOMPLETE';

const CONDITIONS: { value: PackageCondition; label: string; emoji: string; color: string }[] = [
  { value: 'GOOD', label: '正常', emoji: '✅', color: colors.success },
  { value: 'DAMAGED', label: '破损', emoji: '⚠️', color: colors.danger },
  { value: 'WET', label: '受潮', emoji: '💧', color: colors.info },
  { value: 'OPENED', label: '拆封', emoji: '📦', color: colors.warning },
  { value: 'INCOMPLETE', label: '少件', emoji: '❌', color: colors.danger },
];

export default function InboundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; orderNo?: string }>();

  const [order, setOrder] = useState<any>(null);
  const [pkg, setPkg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [pieces, setPieces] = useState('1');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [condition, setCondition] = useState<PackageCondition>('GOOD');
  const [location, setLocation] = useState('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (params.orderId) loadOrder(params.orderId as string);
    else setLoading(false);
  }, [params.orderId]);

  const loadOrder = async (id: string) => {
    try {
      const res = await orderApi.get(id);
      setOrder(res.data);
      // Pick first package with no actual pkg yet
      const firstPkg = (res.data.packages || [])[0];
      if (firstPkg) {
        setPkg(firstPkg);
        setPieces(String(firstPkg.pieces || 1));
      }
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '无法加载订单信息');
    } finally {
      setLoading(false);
    }
  };

  // 自动计算体积重和计费重量
  const { volumeWeight, chargeableWeight } = useMemo(() => {
    const l = Number(length) || 0, w = Number(width) || 0, h = Number(height) || 0;
    const aw = Number(weight) || 0;
    const vw = (l * w * h) / 6000;
    const cw = Math.max(aw, vw);
    return { volumeWeight: vw, chargeableWeight: cw };
  }, [length, width, height, weight]);

  // 预估运费（首重 63 + 续重 57/kg）
  const estimatedFee = useMemo(() => {
    if (chargeableWeight <= 0) return 0;
    if (chargeableWeight <= 1) return 63;
    return 63 + (chargeableWeight - 1) * 57;
  }, [chargeableWeight]);

  const isAbnormal = condition !== 'GOOD';

  const handleSubmit = async (andPrint: boolean) => {
    if (!weight || Number(weight) <= 0) {
      Alert.alert('请填写实际重量'); return;
    }
    if (!order) { Alert.alert('订单信息缺失'); return; }

    setSubmitting(true);
    try {
      const subOrderId = (order.subOrders || [])[0]?.id;
      await warehouseApi.createInbound({
        orderId: order.id,
        subOrderId,
        businessLine: order.business_line,
        warehouseId: 'wh-gz',
        sourceType: 'THIRD_PARTY',
        trackingNo: pkg?.tracking_no || '',
        pieces: Number(pieces),
        grossWeightKg: Number(weight),
        lengthCm: Number(length) || null,
        widthCm: Number(width) || null,
        heightCm: Number(height) || null,
        packageCondition: condition,
        locationCode: location,
        remark,
      });

      if (andPrint) {
        Alert.alert('入库成功', '面单已发送到蓝牙打印机', [
          { text: '继续扫下一单', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('入库成功', '', [{ text: '确定', onPress: () => router.back() }]);
      }
    } catch (err: any) {
      Alert.alert('入库失败', err.message || '请重试');
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* 顶部导航 */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>扫码入库</Text>
          <Text style={styles.navExtra}>今日 12件</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 匹配信息卡 */}
          {order ? (
            <View style={styles.matchCard}>
              <Text style={styles.matchTitle}>✅ 匹配成功</Text>
              <View style={styles.matchGrid}>
                <View style={styles.matchItem}>
                  <Text style={styles.matchLabel}>运单号</Text>
                  <Text style={styles.matchValueMono}>{order.order_no}</Text>
                </View>
                <View style={styles.matchItem}>
                  <Text style={styles.matchLabel}>客户</Text>
                  <Text style={styles.matchValue}>{order.customer_name}</Text>
                </View>
                <View style={styles.matchItem}>
                  <Text style={styles.matchLabel}>路线</Text>
                  <Text style={styles.matchValue}>{order.route_code || '-'}</Text>
                </View>
                <View style={styles.matchItem}>
                  <Text style={styles.matchLabel}>收件人</Text>
                  <Text style={styles.matchValue}>{order.consignee_name || '-'}</Text>
                </View>
                <View style={styles.matchItem}>
                  <Text style={styles.matchLabel}>申报品名</Text>
                  <Text style={styles.matchValue}>{pkg?.goods_name || '-'}</Text>
                </View>
                <View style={styles.matchItem}>
                  <Text style={styles.matchLabel}>应收件数</Text>
                  <Text style={styles.matchValue}>{order.total_declared_pieces || 0} 件</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noMatchCard}>
              <Text style={styles.noMatchText}>⚠️ 无订单信息，请从任务流选择一个待入库任务</Text>
            </View>
          )}

          {/* 称重量方 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚖️ 称重量方 <Text style={styles.required}>*</Text></Text>

            <View style={styles.formRow}>
              <FormField label="实际件数" value={pieces} onChangeText={setPieces} keyboardType="numeric" />
              <FormField label="实际重量 *" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" unit="kg" />
            </View>

            <View style={styles.formRow}>
              <FormField label="长" value={length} onChangeText={setLength} keyboardType="decimal-pad" unit="cm" compact />
              <FormField label="宽" value={width} onChangeText={setWidth} keyboardType="decimal-pad" unit="cm" compact />
              <FormField label="高" value={height} onChangeText={setHeight} keyboardType="decimal-pad" unit="cm" compact />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>体积重</Text>
                <View style={styles.readonly}>
                  <Text style={styles.readonlyText}>{volumeWeight.toFixed(2)} kg</Text>
                </View>
              </View>
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>计费重量</Text>
                <View style={styles.highlight}>
                  <Text style={styles.highlightText}>{chargeableWeight.toFixed(2)} kg</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 运费参考 */}
          {chargeableWeight > 0 && (
            <View style={styles.feeRef}>
              <Text style={styles.feeRefLabel}>
                运费参考：首重 ¥63 + 续重 ¥57×{Math.max(0, chargeableWeight - 1).toFixed(2)}
              </Text>
              <Text style={styles.feeRefValue}>¥ {estimatedFee.toFixed(2)}</Text>
            </View>
          )}

          {/* 包裹状况 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 包裹状况</Text>
            <View style={styles.conditionRow}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[
                    styles.conditionBtn,
                    condition === c.value && { backgroundColor: c.color + '15', borderColor: c.color },
                  ]}
                  onPress={() => setCondition(c.value)}
                >
                  <Text style={[styles.conditionText, condition === c.value && { color: c.color, fontWeight: '600' }]}>
                    {c.emoji} {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {isAbnormal && (
              <View style={styles.photoHint}>
                <Text style={styles.photoHintText}>⚠️ 异常包裹必须拍照记录</Text>
                <TouchableOpacity style={styles.photoBtn}>
                  <Ionicons name="camera-outline" size={18} color={colors.danger} />
                  <Text style={styles.photoBtnText}>拍照</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 库位号 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 库位号</Text>
            <View style={styles.locationRow}>
              <TextInput
                style={styles.locationInput}
                placeholder="输入或扫描库位码"
                placeholderTextColor={colors.textTertiary}
                value={location}
                onChangeText={setLocation}
              />
              <TouchableOpacity style={styles.locationScan}>
                <Ionicons name="scan-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 备注 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>备注</Text>
            <TextInput
              style={styles.textarea}
              placeholder="可选"
              placeholderTextColor={colors.textTertiary}
              value={remark}
              onChangeText={setRemark}
              multiline
              numberOfLines={2}
            />
          </View>
        </ScrollView>

        {/* 底部操作按钮 */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.btnPrimary, submitting && styles.btnDisabled]}
            onPress={() => handleSubmit(true)}
            disabled={submitting}
          >
            <Text style={styles.btnPrimaryText}>
              {submitting ? '处理中...' : '确认入库并打印面单'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => handleSubmit(false)}
            disabled={submitting}
          >
            <Text style={styles.btnSecondaryText}>仅入库不打印</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({ label, value, onChangeText, keyboardType, unit, compact }: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: any; unit?: string; compact?: boolean;
}) {
  return (
    <View style={[styles.formItem, compact && { flex: 1 }]}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType || 'default'}
          placeholderTextColor={colors.textTertiary}
        />
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Navigation bar
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  navExtra: { fontSize: font.sm, color: colors.primary },
  // Scroll
  scroll: { padding: spacing.md, paddingBottom: 140 },
  // Match card
  matchCard: { backgroundColor: colors.successLight, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#86efac', marginBottom: spacing.md },
  matchTitle: { fontSize: font.lg, fontWeight: '700', color: colors.success, marginBottom: spacing.md },
  matchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  matchItem: { width: '48%' },
  matchLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  matchValue: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
  matchValueMono: { fontSize: font.sm, color: colors.primary, fontWeight: '600', fontFamily: font.mono },
  noMatchCard: { backgroundColor: colors.warningLight, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.warning + '40', marginBottom: spacing.md },
  noMatchText: { fontSize: font.sm, color: colors.warning },
  // Section
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  required: { color: colors.danger, fontSize: font.sm },
  // Form
  formRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  formItem: { flex: 1 },
  formLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: spacing.md, height: 44 },
  input: { flex: 1, fontSize: font.md, color: colors.text },
  unit: { fontSize: font.xs, color: colors.textTertiary, marginLeft: spacing.xs },
  readonly: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.borderLight, paddingHorizontal: spacing.md, height: 44, justifyContent: 'center' },
  readonlyText: { fontSize: font.md, color: colors.textSecondary },
  highlight: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.md, height: 44, justifyContent: 'center', alignItems: 'center' },
  highlightText: { fontSize: font.xl, color: colors.primary, fontWeight: '700' },
  // Fee reference
  feeRef: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff7ed', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#fed7aa' },
  feeRefLabel: { fontSize: font.xs, color: colors.textSecondary, flex: 1 },
  feeRefValue: { fontSize: font.lg, color: '#ea580c', fontWeight: '700' },
  // Conditions
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  conditionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  conditionText: { fontSize: font.sm, color: colors.textSecondary },
  photoHint: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.danger + '30' },
  photoHintText: { fontSize: font.sm, color: colors.danger, flex: 1 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger },
  photoBtnText: { fontSize: font.sm, color: colors.danger, fontWeight: '600' },
  // Location
  locationRow: { flexDirection: 'row', gap: spacing.sm },
  locationInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text },
  locationScan: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  // Textarea
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top' },
  // Bottom bar
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight, gap: spacing.sm },
  btnPrimary: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  btnPrimaryText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnSecondary: { height: 36, alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText: { color: colors.textTertiary, fontSize: font.sm },
  btnDisabled: { opacity: 0.6 },
});
