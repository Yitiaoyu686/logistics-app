import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { api } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface Route {
  id: string;
  origin_country: string;
  origin_city: string;
  dest_country: string;
  dest_city: string;
  transport_type: 'SEA' | 'AIR';
  transit_days: string;
  volume_ratio: number;
}

type CargoType = 'GENERAL' | 'SENSITIVE';

// 按规格的报价规则
function calculateQuote(
  weight: number,
  length: number,
  width: number,
  height: number,
  transport: 'SEA' | 'AIR',
  cargoType: CargoType,
) {
  const volumeWeight = transport === 'AIR'
    ? (length * width * height) / 6000
    : (length * width * height) / 5000;
  const chargeable = Math.max(weight, volumeWeight);

  // 按规格示例: 首重 ¥63 + 续重 ¥57/kg
  // 海运普货首续重各 +0; 海运敏感首续重各 +20; 空运首续重 ¥120/¥85
  let firstWeightPrice = 63;
  let extraWeightPrice = 57;
  if (transport === 'AIR') {
    firstWeightPrice = 120;
    extraWeightPrice = 85;
  }
  if (cargoType === 'SENSITIVE') {
    firstWeightPrice += 20;
    extraWeightPrice += 20;
  }

  const extraWeight = Math.max(0, chargeable - 1);
  const freight = firstWeightPrice + extraWeight * extraWeightPrice;

  return {
    volumeWeight: Math.round(volumeWeight * 100) / 100,
    chargeable: Math.round(chargeable * 100) / 100,
    firstWeightPrice,
    extraWeightPrice,
    extraWeight: Math.round(extraWeight * 100) / 100,
    freight: Math.round(freight * 100) / 100,
    total: Math.round(freight * 100) / 100,
  };
}

export default function QuoteScreen() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeId, setRouteId] = useState<string>('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [pieces, setPieces] = useState('1');
  const [cargoType, setCargoType] = useState<CargoType>('GENERAL');
  const [calculated, setCalculated] = useState<ReturnType<typeof calculateQuote> | null>(null);

  useEffect(() => {
    api.get('/system/routes').then((r) => {
      const list = (r.data || []).filter((x: Route) => x.transport_type);
      setRoutes(list);
      if (list[0]) setRouteId(list[0].id);
    }).catch(() => {});
  }, []);

  const selectedRoute = routes.find((r) => r.id === routeId);

  const handleCalculate = () => {
    const w = Number(weight), l = Number(length), wd = Number(width), h = Number(height);
    if (!w || w <= 0) { Alert.alert('请填写实际重量'); return; }
    if (!selectedRoute) { Alert.alert('请选择路线'); return; }

    const q = calculateQuote(w, l, wd, h, selectedRoute.transport_type, cargoType);
    setCalculated(q);
  };

  const quoteText = useMemo(() => {
    if (!calculated || !selectedRoute) return '';
    const transportLabel = selectedRoute.transport_type === 'SEA' ? '海运拼箱' : '空运';
    return `【运费报价】
路线：${selectedRoute.origin_city}→${selectedRoute.dest_city}（${transportLabel}）
计费重量：${calculated.chargeable} kg
首重 ¥${calculated.firstWeightPrice} + 续重 ¥${calculated.extraWeightPrice}×${calculated.extraWeight} = ¥${calculated.total.toFixed(2)}
时效：${selectedRoute.transit_days}`;
  }, [calculated, selectedRoute]);

  const handleCopy = async () => {
    if (!quoteText) return;
    // Web 用 navigator.clipboard，原生用 Share 替代复制
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(quoteText);
        Alert.alert('已复制', '报价内容已复制到剪贴板');
        return;
      } catch {
        // fallthrough
      }
    }
    Alert.alert('报价内容', quoteText);
  };

  const handleShare = async () => {
    if (!quoteText) return;
    try {
      await Share.share({ message: quoteText });
    } catch {
      Alert.alert('分享失败');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Nav */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>运费试算</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 路线选择 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧭 选择路线</Text>
            <View style={styles.routeGrid}>
              {routes.map((r) => {
                const active = r.id === routeId;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.routeCard, active && styles.routeCardActive]}
                    onPress={() => { setRouteId(r.id); setCalculated(null); }}
                  >
                    <Text style={[styles.routeIcon, active && { color: '#fff' }]}>
                      {r.transport_type === 'SEA' ? '🚢' : '✈️'}
                    </Text>
                    <Text style={[styles.routeCity, active && { color: '#fff' }]}>
                      {r.origin_city}→{r.dest_city}
                    </Text>
                    <Text style={[styles.routeDays, active && { color: '#fff' }]}>{r.transit_days}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 货物信息 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 货物信息</Text>
            <View style={styles.formRow}>
              <FormField label="件数" value={pieces} onChangeText={setPieces} unit="件" />
              <FormField label="实际重量 *" value={weight} onChangeText={setWeight} unit="kg" />
            </View>
            <View style={styles.formRow}>
              <FormField label="长" value={length} onChangeText={setLength} unit="cm" />
              <FormField label="宽" value={width} onChangeText={setWidth} unit="cm" />
              <FormField label="高" value={height} onChangeText={setHeight} unit="cm" />
            </View>
            <Text style={styles.cargoLabel}>货物属性</Text>
            <View style={styles.cargoRow}>
              <TouchableOpacity
                style={[styles.cargoBtn, cargoType === 'GENERAL' && styles.cargoBtnActive]}
                onPress={() => { setCargoType('GENERAL'); setCalculated(null); }}
              >
                <Text style={[styles.cargoText, cargoType === 'GENERAL' && styles.cargoTextActive]}>📦 普货</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cargoBtn, cargoType === 'SENSITIVE' && styles.cargoBtnActive]}
                onPress={() => { setCargoType('SENSITIVE'); setCalculated(null); }}
              >
                <Text style={[styles.cargoText, cargoType === 'SENSITIVE' && styles.cargoTextActive]}>⚠️ 敏感</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 计算按钮 */}
          <TouchableOpacity style={styles.calcBtn} onPress={handleCalculate}>
            <Ionicons name="calculator-outline" size={20} color="#fff" />
            <Text style={styles.calcBtnText}>立即计算</Text>
          </TouchableOpacity>

          {/* 计算结果 */}
          {calculated && (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>💰 报价结果</Text>
                <Text style={styles.resultRoute}>
                  {selectedRoute?.origin_city} → {selectedRoute?.dest_city}
                </Text>
              </View>

              <View style={styles.weightRow}>
                <View style={styles.weightBox}>
                  <Text style={styles.weightLabel}>实重</Text>
                  <Text style={styles.weightValue}>{weight} kg</Text>
                </View>
                <View style={styles.weightBox}>
                  <Text style={styles.weightLabel}>体积重</Text>
                  <Text style={styles.weightValue}>{calculated.volumeWeight} kg</Text>
                </View>
                <View style={[styles.weightBox, styles.weightBoxHl]}>
                  <Text style={[styles.weightLabel, { color: '#fff' }]}>计费重</Text>
                  <Text style={[styles.weightValue, { color: '#fff' }]}>{calculated.chargeable} kg</Text>
                </View>
              </View>

              <View style={styles.feeBlock}>
                <FeeRow label={`首重 (≤1kg)`} value={calculated.firstWeightPrice} />
                <FeeRow label={`续重 ¥${calculated.extraWeightPrice}/kg × ${calculated.extraWeight}kg`} value={Math.round(calculated.extraWeight * calculated.extraWeightPrice * 100) / 100} />
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>预估总价</Text>
                <Text style={styles.totalValue}>¥ {calculated.total.toFixed(2)}</Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                  <Text style={styles.actionText}>复制报价</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleShare}>
                  <Ionicons name="share-social-outline" size={18} color="#fff" />
                  <Text style={[styles.actionText, { color: '#fff' }]}>分享</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.disclaimer}>
                * 报价仅供参考，最终以实际称重和当日汇率为准
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({ label, value, onChangeText, unit }: {
  label: string; value: string; onChangeText: (v: string) => void; unit?: string;
}) {
  return (
    <View style={styles.formItem}>
      <Text style={styles.formLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textTertiary}
        />
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
    </View>
  );
}

function FeeRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.feeRow}>
      <Text style={styles.feeLabel}>{label}</Text>
      <Text style={styles.feeValue}>¥ {value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  cargoLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm },
  cargoRow: { flexDirection: 'row', gap: spacing.sm },
  cargoBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.card },
  cargoBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  cargoText: { fontSize: font.sm, color: colors.textSecondary },
  cargoTextActive: { color: colors.primary, fontWeight: '600' },
  routeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  routeCard: { width: '48%', padding: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center' },
  routeCardActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  routeIcon: { fontSize: 24, marginBottom: 4 },
  routeCity: { fontSize: font.sm, color: colors.text, fontWeight: '600' },
  routeDays: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  formRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  formItem: { flex: 1 },
  formLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, backgroundColor: colors.card },
  input: { flex: 1, fontSize: font.md, color: colors.text },
  unit: { fontSize: font.xs, color: colors.textTertiary },

  calcBtn: { flexDirection: 'row', height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md, shadowColor: colors.primary, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  calcBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },

  resultCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderTopWidth: 4, borderTopColor: colors.success },
  resultHeader: { marginBottom: spacing.md },
  resultTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  resultRoute: { fontSize: font.sm, color: colors.textSecondary, marginTop: 4 },

  weightRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  weightBox: { flex: 1, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md, alignItems: 'center' },
  weightBoxHl: { backgroundColor: colors.primary },
  weightLabel: { fontSize: font.xs, color: colors.textSecondary },
  weightValue: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginTop: 4 },

  feeBlock: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  feeLabel: { fontSize: font.sm, color: colors.textSecondary },
  feeValue: { fontSize: font.sm, color: colors.text, fontWeight: '600' },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 2, borderTopColor: colors.primary, marginBottom: spacing.md },
  totalLabel: { fontSize: font.lg, fontWeight: '600', color: colors.text },
  totalValue: { fontSize: font.xxl, fontWeight: '700', color: colors.primary },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  actionBtn: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: colors.card },
  actionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { fontSize: font.sm, fontWeight: '600', color: colors.primary },
  disclaimer: { fontSize: font.xs, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm },
});
