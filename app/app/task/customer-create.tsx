import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { customerApi, systemApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type CustomerType = 'COMPANY_CN' | 'COMPANY_OVERSEAS' | 'INDIVIDUAL';
type Transport = 'SEA' | 'AIR' | 'BOTH';

interface Country {
  id: string;
  code: string;
  name_cn: string;
  name_en: string;
}

const TYPE_OPTIONS: { value: CustomerType; label: string }[] = [
  { value: 'COMPANY_CN', label: '🏭 国内企业' },
  { value: 'COMPANY_OVERSEAS', label: '🏢 海外企业' },
  { value: 'INDIVIDUAL', label: '👤 个人客户' },
];

const TRANSPORT_OPTIONS: { value: Transport; label: string }[] = [
  { value: 'SEA', label: '🚢 海运' },
  { value: 'AIR', label: '✈️ 空运' },
  { value: 'BOTH', label: '🚢✈️ 海空运' },
];

const INDUSTRY_OPTIONS = ['电子产品', '服装鞋帽', '日用百货', '机械配件', '美妆个护', '家居家具', '食品饮料', '其他'];

export default function CustomerCreateScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // 表单字段
  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('COMPANY_CN');
  const [country, setCountry] = useState('');
  const [industry, setIndustry] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [preferredTransport, setPreferredTransport] = useState<Transport>('SEA');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setCurrentUserId(JSON.parse(u).id);
    });
    systemApi.countries().then((r) => setCountries(r.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await customerApi.create({
        customerName,
        customerType,
        country,
        industry: industry || undefined,
        contactName,
        contactPhone,
        contactEmail: contactEmail || undefined,
        preferredTransport,
        ownerUserId: currentUserId || 'user-sales1',
        poolType: 'PRIVATE',
        status: 'ACTIVE',
        remark: remark || undefined,
      });
      // 同时弹 Alert 和返回,原生端 Alert 能正常弹出
      Alert.alert('创建成功', `客户编号：${res.data?.customerCode || '-'}`, [
        { text: '完成', onPress: () => safeBack(router) },
      ]);
      // Web 端 Alert 可能不弹,直接返回
      if (Platform.OS === 'web') safeBack(router);
    } catch (err: any) {
      Alert.alert('创建失败', err.message || '请重试');
      if (Platform.OS === 'web') {
        window.alert(`创建失败: ${err.message || '请重试'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>新增客户</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 客户名称 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 基础信息</Text>

            <FormField label="客户名称 *" value={customerName} onChangeText={setCustomerName} placeholder="请输入客户名称" />

            <Text style={styles.formLabel}>客户类型 *</Text>
            <View style={styles.optionRow}>
              {TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionBtn, customerType === opt.value && styles.optionBtnActive]}
                  onPress={() => setCustomerType(opt.value)}
                >
                  <Text style={[styles.optionText, customerType === opt.value && styles.optionTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>所在国家 *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {countries.length === 0 ? (
                ['中国', '尼日利亚', '加纳'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, country === c && styles.chipActive]}
                    onPress={() => setCountry(c)}
                  >
                    <Text style={[styles.chipText, country === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                countries.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, country === c.name_cn && styles.chipActive]}
                    onPress={() => setCountry(c.name_cn)}
                  >
                    <Text style={[styles.chipText, country === c.name_cn && styles.chipTextActive]}>
                      {c.name_cn}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <Text style={styles.formLabel}>所属行业</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {INDUSTRY_OPTIONS.map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chip, industry === i && styles.chipActive]}
                  onPress={() => setIndustry(i)}
                >
                  <Text style={[styles.chipText, industry === i && styles.chipTextActive]}>{i}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* 联系人 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 联系人</Text>
            <FormField label="联系人 *" value={contactName} onChangeText={setContactName} placeholder="联系人姓名" />
            <FormField label="电话 *" value={contactPhone} onChangeText={setContactPhone} placeholder="联系电话" keyboardType="phone-pad" />
            <FormField label="邮箱" value={contactEmail} onChangeText={setContactEmail} placeholder="邮箱（可选）" keyboardType="email-address" />
          </View>

          {/* 物流偏好 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚢 物流偏好</Text>
            <Text style={styles.formLabel}>运输方式偏好</Text>
            <View style={styles.optionRow}>
              {TRANSPORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionBtn, preferredTransport === opt.value && styles.optionBtnActive]}
                  onPress={() => setPreferredTransport(opt.value)}
                >
                  <Text style={[styles.optionText, preferredTransport === opt.value && styles.optionTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 备注 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 备注</Text>
            <TextInput
              style={styles.textarea}
              value={remark}
              onChangeText={setRemark}
              placeholder="客户特点、注意事项等（可选）"
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>

        {(() => {
          const hint = !customerName.trim()
            ? '请填写客户名称'
            : !country
              ? '请选择国家'
              : !contactName.trim()
                ? '请填写联系人'
                : !contactPhone.trim()
                  ? '请填写联系电话'
                  : null;
          const disabled = submitting || !!hint;
          return (
            <View style={styles.bottomBar}>
              {hint && (
                <View style={styles.validationBanner}>
                  <Ionicons name="alert-circle" size={16} color={colors.warning} />
                  <Text style={styles.validationBannerText}>{hint}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.submitBtn, disabled && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={disabled}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>{hint || '创建客户'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric' | 'decimal-pad';
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: FormFieldProps) {
  return (
    <View style={styles.formItem}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  scroll: { padding: spacing.md, paddingBottom: 100 },
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },

  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 80, textAlignVertical: 'top', backgroundColor: colors.card },

  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  optionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  optionBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionText: { fontSize: font.sm, color: colors.textSecondary },
  optionTextActive: { color: colors.primary, fontWeight: '600' },

  chipRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  submitBtn: { flexDirection: 'row', height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, shadowColor: colors.primary, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
  validationBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.md, marginBottom: 6 },
  validationBannerText: { fontSize: font.sm, color: colors.warning, fontWeight: '600' },
});
