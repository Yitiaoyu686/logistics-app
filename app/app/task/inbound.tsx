import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, Modal,
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

type InboundMode = 'EXPRESS' | 'TRANSFER' | 'RETURN';

const MODE_LABEL: Record<InboundMode, string> = {
  EXPRESS: '快递入库',
  TRANSFER: '调拨入库',
  RETURN: '退回入库',
};

// 货物类别（与 Web 对齐）
const GOODS_CATEGORIES = [
  '日用百货', '机械/五金/仪表', '食品', '化妆品', '保健品',
  '药品', '电子产品', '服装/纺织品', '文件', '其他',
];

// 费用类型
const FEE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'FREIGHT', label: '运费' },
  { value: 'SURCHARGE_DRUG', label: '药品附加运费' },
  { value: 'CUSTOMS', label: '报关费' },
  { value: 'DOOR_DELIVERY', label: '到门费用' },
  { value: 'PACKAGING', label: '包装费' },
  { value: 'WAREHOUSE', label: '仓储费' },
  { value: 'INSURANCE', label: '保险费' },
  { value: 'DISCOUNT', label: '折扣' },
  { value: 'OTHER', label: '其他' },
];
const FEE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FEE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);
const CURRENCY_OPTIONS = ['USD', 'CNY', 'NGN'];
const FX_RATE: Record<string, number> = { USD: 1, CNY: 7.25, NGN: 1650 };

// 服务类型决定体积系数和单价
// EXPRESS(空运): 体积系数 5000,55 USD/kg,最低 150 USD
// 其它(海运): 6000, 12 USD/kg, 最低 50 USD
const getServiceConfig = (serviceType?: string) => {
  const isAir = (serviceType || '').toUpperCase() === 'EXPRESS' || (serviceType || '').toUpperCase() === 'AIR';
  return {
    divisor: isAir ? 5000 : 6000,
    unitRate: isAir ? 55 : 12,
    minCharge: isAir ? 150 : 50,
  };
};

interface InboundFee {
  id: string;
  feeType: string;
  currency: string;
  unitPrice: number;
  quantity: number;
  exchangeRate: number;
  amount: number;
  remark: string;
  isAutoFreight?: boolean;
}

export default function InboundScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; orderNo?: string; mode?: InboundMode }>();
  const mode: InboundMode = (params.mode as InboundMode) || 'EXPRESS';

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
  const [goodsCategory, setGoodsCategory] = useState<string | undefined>(undefined);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [fees, setFees] = useState<InboundFee[]>([]);
  const [feeEditorOpen, setFeeEditorOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<InboundFee | null>(null);

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

  // 自动计算体积重和计费重量（根据服务类型选择体积系数）
  const serviceConfig = useMemo(() => getServiceConfig(order?.service_type), [order?.service_type]);
  const { volumeWeight, chargeableWeight } = useMemo(() => {
    const l = Number(length) || 0, w = Number(width) || 0, h = Number(height) || 0;
    const aw = Number(weight) || 0;
    const vw = (l * w * h) / serviceConfig.divisor;
    const cw = Math.max(aw, vw);
    return { volumeWeight: vw, chargeableWeight: cw };
  }, [length, width, height, weight, serviceConfig.divisor]);

  // 自动运费(USD) — 与 Web 保持一致
  useEffect(() => {
    const { unitRate, minCharge } = serviceConfig;
    if (chargeableWeight <= 0) {
      setFees((prev) => prev.filter((f) => !f.isAutoFreight));
      return;
    }
    const amount = Math.max(chargeableWeight * unitRate, minCharge);
    const autoRow: InboundFee = {
      id: 'AUTO_FREIGHT',
      feeType: 'FREIGHT',
      currency: 'USD',
      unitPrice: unitRate,
      quantity: Number(chargeableWeight.toFixed(2)),
      exchangeRate: 1,
      amount: Number(amount.toFixed(2)),
      remark: `实重${(Number(weight) || 0).toFixed(2)}kg｜体积重${volumeWeight.toFixed(2)}kg｜计费重${chargeableWeight.toFixed(2)}kg`,
      isAutoFreight: true,
    };
    setFees((prev) => {
      const manual = prev.filter((f) => !f.isAutoFreight);
      return [autoRow, ...manual];
    });
  }, [chargeableWeight, volumeWeight, weight, serviceConfig]);

  // 合计(USD) — 币种按当前汇率折算
  const feeTotalUSD = useMemo(() => {
    return fees.reduce((sum, f) => {
      const rate = f.currency === 'USD' ? 1 : (FX_RATE[f.currency] || 1);
      return sum + (f.amount || 0) / rate;
    }, 0);
  }, [fees]);

  const openAddFee = () => {
    setEditingFee({
      id: `FEE-${Date.now()}`,
      feeType: '',
      currency: 'USD',
      unitPrice: 0,
      quantity: 1,
      exchangeRate: 1,
      amount: 0,
      remark: '',
    });
    setFeeEditorOpen(true);
  };

  const saveFee = () => {
    if (!editingFee) return;
    if (!editingFee.feeType) {
      Alert.alert('请选择费用类型'); return;
    }
    setFees((prev) => {
      const idx = prev.findIndex((f) => f.id === editingFee.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = editingFee;
        return next;
      }
      return [...prev, editingFee];
    });
    setFeeEditorOpen(false);
    setEditingFee(null);
  };

  const removeFee = (id: string) => {
    setFees((prev) => prev.filter((f) => f.id !== id));
  };

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
        sourceType: mode === 'TRANSFER' ? 'TRANSFER' : mode === 'RETURN' ? 'RETURN' : 'THIRD_PARTY',
        trackingNo: pkg?.tracking_no || '',
        pieces: Number(pieces),
        grossWeightKg: Number(weight),
        lengthCm: Number(length) || null,
        widthCm: Number(width) || null,
        heightCm: Number(height) || null,
        packageCondition: condition,
        locationCode: location,
        goodsCategory: goodsCategory || null,
        fees: fees.map((f) => ({
          feeType: f.feeType,
          currency: f.currency,
          unitPrice: f.unitPrice,
          quantity: f.quantity,
          exchangeRate: f.exchangeRate,
          amount: f.amount,
          remark: f.remark,
        })),
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
          <Text style={styles.navTitle}>{MODE_LABEL[mode]}</Text>
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

          {/* 货物类别 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏷️ 货物类别</Text>
            <TouchableOpacity
              style={styles.selectField}
              onPress={() => setCategoryPickerOpen(true)}
            >
              <Text style={[styles.selectText, !goodsCategory && { color: colors.textTertiary }]}>
                {goodsCategory || '请选择货物类别'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* 费用明细 */}
          <View style={styles.section}>
            <View style={styles.feeHeader}>
              <Text style={styles.sectionTitle}>💰 费用明细</Text>
              <TouchableOpacity style={styles.addFeeBtn} onPress={openAddFee}>
                <Ionicons name="add-circle" size={18} color={colors.primary} />
                <Text style={styles.addFeeText}>添加费用</Text>
              </TouchableOpacity>
            </View>

            {fees.length === 0 ? (
              <Text style={styles.feeEmpty}>请先称重量方以生成自动运费</Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {fees.map((f) => (
                  <View
                    key={f.id}
                    style={[
                      styles.feeItem,
                      f.isAutoFreight && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feeItemTitle}>
                        {FEE_TYPE_LABEL[f.feeType] || f.feeType}
                        {f.isAutoFreight && <Text style={styles.feeAutoBadge}> 自动</Text>}
                      </Text>
                      <Text style={styles.feeItemSub}>
                        {f.currency} {f.unitPrice.toFixed(2)} × {f.quantity}{f.exchangeRate !== 1 ? `  汇率${f.exchangeRate}` : ''}
                      </Text>
                      {!!f.remark && <Text style={styles.feeItemRemark} numberOfLines={1}>{f.remark}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.feeItemAmount, f.isAutoFreight && { color: colors.primary }]}>
                        {f.currency} {f.amount.toFixed(2)}
                      </Text>
                      {!f.isAutoFreight && (
                        <TouchableOpacity onPress={() => removeFee(f.id)} style={{ padding: 4, marginTop: 4 }}>
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                <View style={styles.feeTotalRow}>
                  <Text style={styles.feeTotalLabel}>合计</Text>
                  <Text style={styles.feeTotalValue}>USD {feeTotalUSD.toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>

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

        {/* 货物类别选择器 */}
        <Modal
          visible={categoryPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setCategoryPickerOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => setCategoryPickerOpen(false)}
          >
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>选择货物类别</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {GOODS_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={styles.modalOption}
                    onPress={() => {
                      setGoodsCategory(c);
                      setCategoryPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.modalOptionText, goodsCategory === c && { color: colors.primary, fontWeight: '600' }]}>
                      {c}
                    </Text>
                    {goodsCategory === c && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 费用编辑器 */}
        <Modal
          visible={feeEditorOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setFeeEditorOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>添加费用</Text>

              {/* 费用类型 */}
              <Text style={styles.feeFieldLabel}>费用类型 *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.xs, paddingRight: spacing.md }}>
                  {FEE_TYPE_OPTIONS.filter((o) => o.value !== 'FREIGHT').map((o) => (
                    <TouchableOpacity
                      key={o.value}
                      style={[
                        styles.chip,
                        editingFee?.feeType === o.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() =>
                        setEditingFee((prev) => (prev ? { ...prev, feeType: o.value } : prev))
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          editingFee?.feeType === o.value && { color: '#fff' },
                        ]}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* 币种 */}
              <Text style={styles.feeFieldLabel}>币种</Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
                {CURRENCY_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.chip,
                      editingFee?.currency === c && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() =>
                      setEditingFee((prev) =>
                        prev ? { ...prev, currency: c, exchangeRate: FX_RATE[c] || 1 } : prev,
                      )
                    }
                  >
                    <Text style={[styles.chipText, editingFee?.currency === c && { color: '#fff' }]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 单价 / 数量 */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeFieldLabel}>单价</Text>
                  <TextInput
                    style={styles.feeInput}
                    keyboardType="decimal-pad"
                    value={String(editingFee?.unitPrice ?? '')}
                    onChangeText={(v) =>
                      setEditingFee((prev) => {
                        if (!prev) return prev;
                        const up = Number(v) || 0;
                        return { ...prev, unitPrice: up, amount: Number((up * prev.quantity).toFixed(2)) };
                      })
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeFieldLabel}>数量</Text>
                  <TextInput
                    style={styles.feeInput}
                    keyboardType="decimal-pad"
                    value={String(editingFee?.quantity ?? '')}
                    onChangeText={(v) =>
                      setEditingFee((prev) => {
                        if (!prev) return prev;
                        const q = Number(v) || 0;
                        return { ...prev, quantity: q, amount: Number((prev.unitPrice * q).toFixed(2)) };
                      })
                    }
                  />
                </View>
              </View>

              {/* 金额（可覆盖） */}
              <Text style={styles.feeFieldLabel}>金额</Text>
              <TextInput
                style={[styles.feeInput, { marginBottom: spacing.md }]}
                keyboardType="decimal-pad"
                value={String(editingFee?.amount ?? '')}
                onChangeText={(v) =>
                  setEditingFee((prev) => (prev ? { ...prev, amount: Number(v) || 0 } : prev))
                }
              />

              {/* 备注 */}
              <Text style={styles.feeFieldLabel}>备注</Text>
              <TextInput
                style={[styles.feeInput, { marginBottom: spacing.lg }]}
                value={editingFee?.remark ?? ''}
                onChangeText={(v) =>
                  setEditingFee((prev) => (prev ? { ...prev, remark: v } : prev))
                }
                placeholder="可选"
                placeholderTextColor={colors.textTertiary}
              />

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  style={[styles.btnSecondary, { flex: 1, height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }]}
                  onPress={() => {
                    setFeeEditorOpen(false);
                    setEditingFee(null);
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: font.md }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, { flex: 1, height: 48 }]}
                  onPress={saveFee}
                >
                  <Text style={styles.btnPrimaryText}>保存</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
  // Fee reference (legacy, still used by old blocks if any)
  feeRef: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff7ed', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#fed7aa' },
  feeRefLabel: { fontSize: font.xs, color: colors.textSecondary, flex: 1 },
  feeRefValue: { fontSize: font.lg, color: '#ea580c', fontWeight: '700' },
  // Select field
  selectField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: spacing.md, height: 48 },
  selectText: { fontSize: font.md, color: colors.text },
  // Fee section
  feeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  addFeeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  addFeeText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  feeEmpty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.md },
  feeItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.card },
  feeItemTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  feeAutoBadge: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },
  feeItemSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  feeItemRemark: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },
  feeItemAmount: { fontSize: font.md, fontWeight: '700', color: colors.text },
  feeTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderLight },
  feeTotalLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
  feeTotalValue: { fontSize: font.lg, fontWeight: '700', color: colors.primary },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  modalOptionText: { fontSize: font.md, color: colors.text },
  // Chips
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, backgroundColor: colors.card },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  // Fee editor inputs
  feeFieldLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 6 },
  feeInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
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
