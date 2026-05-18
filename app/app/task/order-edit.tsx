import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { orderApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type ServiceType = 'EXPRESS' | 'STANDARD';
type PaymentMethod = 'PREPAID' | 'COD' | 'MONTHLY';

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'EXPRESS', label: '特快' },
  { value: 'STANDARD', label: '普快' },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'PREPAID', label: '预付' },
  { value: 'COD', label: '到付' },
  { value: 'MONTHLY', label: '月结' },
];

export default function OrderEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [orderNo, setOrderNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [businessLine, setBusinessLine] = useState<'SEA' | 'AIR'>('SEA');
  const [routeCode, setRouteCode] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PREPAID');

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [senderAddress, setSenderAddress] = useState('');

  const [consigneeName, setConsigneeName] = useState('');
  const [consigneePhone, setConsigneePhone] = useState('');
  const [consigneeEmail, setConsigneeEmail] = useState('');
  const [consigneeCountry, setConsigneeCountry] = useState('');
  const [consigneeCity, setConsigneeCity] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');

  const [totalPieces, setTotalPieces] = useState('1');
  const [totalWeight, setTotalWeight] = useState('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await orderApi.get(id);
      const d = res.data;
      setOrderNo(d.order_no || '');
      setCustomerName(d.customer_name || '');
      setBusinessLine(d.business_line || 'SEA');
      setRouteCode(d.route_code || '');
      setServiceType(d.service_type || 'STANDARD');
      setPaymentMethod(d.payment_method || 'PREPAID');
      setSenderName(d.sender_name || '');
      setSenderPhone(d.sender_phone || '');
      setSenderAddress(d.sender_address || '');
      setConsigneeName(d.consignee_name || '');
      setConsigneePhone(d.consignee_phone || '');
      setConsigneeEmail(d.consignee_email || '');
      setConsigneeCountry(d.consignee_country || '');
      setConsigneeCity(d.consignee_city || '');
      setConsigneeAddress(d.consignee_address || '');
      setTotalPieces(String(d.total_declared_pieces || 1));
      setTotalWeight(String(d.total_declared_weight_kg || ''));
      setRemark(d.remark || '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      Alert.alert('加载失败', msg);
      safeBack(router);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!consigneeName.trim()) { Alert.alert('请填写收件人姓名'); return; }
    if (!consigneePhone.trim()) { Alert.alert('请填写收件人电话'); return; }
    setSubmitting(true);
    try {
      await orderApi.update(id as string, {
        customer_name: customerName,
        business_line: businessLine,
        route_code: routeCode,
        service_type: serviceType,
        payment_method: paymentMethod,
        sender_name: senderName,
        sender_phone: senderPhone,
        sender_address: senderAddress,
        consignee_name: consigneeName,
        consignee_phone: consigneePhone,
        consignee_email: consigneeEmail,
        consignee_country: consigneeCountry,
        consignee_city: consigneeCity,
        consignee_address: consigneeAddress,
        total_declared_pieces: parseInt(totalPieces, 10) || 1,
        total_declared_weight_kg: parseFloat(totalWeight) || 0,
        remark,
      });
      Alert.alert('保存成功', `订单 ${orderNo} 已更新`, [
        { text: '返回', onPress: () => safeBack(router) },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      Alert.alert('保存失败', msg);
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
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>编辑订单</Text>
        <TouchableOpacity
          style={[styles.navSaveBtn, submitting && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.navSaveText}>{submitting ? '保存中' : '保存'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form}>
          {/* 订单号 (readonly) */}
          <Text style={styles.orderNoLabel}>订单号（不可修改）</Text>
          <Text style={styles.orderNoValue}>{orderNo}</Text>

          {/* 客户 + 运输方式 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基本信息</Text>
            <Field label="客户名称" value={customerName} onChange={setCustomerName} />
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>运输方式</Text>
                <View style={styles.segRow}>
                  {(['SEA', 'AIR'] as const).map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.segBtn, businessLine === v && styles.segBtnActive]}
                      onPress={() => setBusinessLine(v)}
                    >
                      <Ionicons name={v === 'SEA' ? 'boat-outline' : 'airplane-outline'} size={14} color={businessLine === v ? '#fff' : colors.textSecondary} />
                      <Text style={[styles.segText, businessLine === v && styles.segTextActive]}>
                        {v === 'SEA' ? '海运' : '空运'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>服务类型</Text>
                <View style={styles.segRow}>
                  {SERVICE_OPTIONS.map((o) => (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.segBtn, serviceType === o.value && styles.segBtnActive]}
                      onPress={() => setServiceType(o.value)}
                    >
                      <Text style={[styles.segText, serviceType === o.value && styles.segTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>付款方式</Text>
                <View style={styles.segRow}>
                  {PAYMENT_OPTIONS.map((o) => (
                    <TouchableOpacity
                      key={o.value}
                      style={[styles.segBtnSm, paymentMethod === o.value && styles.segBtnActive]}
                      onPress={() => setPaymentMethod(o.value)}
                    >
                      <Text style={[styles.segTextSm, paymentMethod === o.value && styles.segTextActive]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Field label="线路" value={routeCode} onChange={setRouteCode} placeholder="如 route-gz-los-sea" />
          </View>

          {/* 发货人 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>发货人</Text>
            <Field label="姓名" value={senderName} onChange={setSenderName} />
            <Field label="电话" value={senderPhone} onChange={setSenderPhone} keyboardType="phone-pad" />
            <Field label="地址" value={senderAddress} onChange={setSenderAddress} />
          </View>

          {/* 收货人 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>收货人</Text>
            <Field label="姓名 *" value={consigneeName} onChange={setConsigneeName} required />
            <Field label="电话 *" value={consigneePhone} onChange={setConsigneePhone} required keyboardType="phone-pad" />
            <Field label="邮箱" value={consigneeEmail} onChange={setConsigneeEmail} keyboardType="email-address" />
            <View style={styles.row}>
              <View style={styles.half}>
                <Field label="国家" value={consigneeCountry} onChange={setConsigneeCountry} />
              </View>
              <View style={styles.half}>
                <Field label="城市" value={consigneeCity} onChange={setConsigneeCity} />
              </View>
            </View>
            <Field label="详细地址" value={consigneeAddress} onChange={setConsigneeAddress} />
          </View>

          {/* 货物 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>货物信息</Text>
            <View style={styles.row}>
              <View style={styles.half}>
                <Field label="总件数" value={totalPieces} onChange={setTotalPieces} keyboardType="number-pad" />
              </View>
              <View style={styles.half}>
                <Field label="总重量(kg)" value={totalWeight} onChange={setTotalWeight} keyboardType="decimal-pad" />
              </View>
            </View>
            <Field label="备注" value={remark} onChange={setRemark} placeholder="订单备注（选填）" />
          </View>

          {/* 底部保存 */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.submitText}>{submitting ? '保存中...' : '保存修改'}</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={styles.req}> *</Text> : null}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 40 },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  navSaveBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  navSaveText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },

  form: { padding: spacing.lg, paddingBottom: 40 },
  orderNoLabel: { fontSize: font.xs, color: colors.textTertiary },
  orderNoValue: { fontSize: font.lg, fontFamily: font.mono, fontWeight: '700', color: colors.primary, marginTop: 4, marginBottom: spacing.md },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  req: { color: colors.danger },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.bg },

  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  half: { flex: 1 },

  segRow: { flexDirection: 'row', gap: 4, backgroundColor: colors.bg, borderRadius: radius.md, padding: 3 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm, borderRadius: radius.sm },
  segBtnActive: { backgroundColor: colors.primary },
  segText: { fontSize: font.xs, color: colors.textSecondary },
  segTextActive: { color: '#fff', fontWeight: '600' },

  segBtnSm: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  segTextSm: { fontSize: font.xs, color: colors.textSecondary },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.lg, height: 52, marginTop: spacing.md },
  submitText: { color: '#fff', fontSize: font.lg, fontWeight: '600' },
});
