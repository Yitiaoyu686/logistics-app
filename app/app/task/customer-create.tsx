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
import { useBusinessLine } from '../../lib/business-line';

type CustomerType = 'COMPANY_CN' | 'COMPANY_OVERSEAS' | 'INDIVIDUAL';
type Transport = 'SEA' | 'AIR' | 'BOTH';

interface Country {
  id: string;
  code: string;
  name_cn: string;
  name_en: string;
}

const TYPE_OPTIONS: { value: CustomerType; label: string }[] = [
  { value: 'COMPANY_CN', label: '国内企业' },
  { value: 'COMPANY_OVERSEAS', label: '海外企业' },
  { value: 'INDIVIDUAL', label: '个人客户' },
];

const TRANSPORT_OPTIONS: { value: Transport; label: string }[] = [
  { value: 'SEA', label: '海运' },
  { value: 'AIR', label: '空运' },
  { value: 'BOTH', label: '海空运' },
];

const INDUSTRY_OPTIONS = ['电子产品', '服装鞋帽', '日用百货', '机械配件', '美妆个护', '家居家具', '食品饮料', '其他'];

export default function CustomerCreateScreen() {
  const router = useRouter();
  const { businessLine } = useBusinessLine();
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
  const [preferredTransport, setPreferredTransport] = useState<Transport>(businessLine === 'AIR' ? 'AIR' : 'SEA');
  const [remark, setRemark] = useState('');

  // 企业资质信息
  const [companyFullName, setCompanyFullName] = useState('');
  const [creditCode, setCreditCode] = useState('');
  const [legalPerson, setLegalPerson] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [invoiceAddress, setInvoiceAddress] = useState('');
  const [invoicePhone, setInvoicePhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [overseasRegNo, setOverseasRegNo] = useState('');
  const [overseasTin, setOverseasTin] = useState('');
  const [overseasPrincipal, setOverseasPrincipal] = useState('');
  const [idType, setIdType] = useState<'ID_CARD' | 'PASSPORT'>('ID_CARD');
  const [idNumber, setIdNumber] = useState('');
  const [enterpriseCollapsed, setEnterpriseCollapsed] = useState(true);

  // 拍照上传
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);

  const handleTakePhoto = (type: 'biz_license' | 'id_card') => {
    if (Platform.OS === 'web') {
      // Web: 模拟拍照（添加占位图）
      const url = `https://picsum.photos/seed/${Date.now()}/400/300`;
      if (type === 'biz_license') setPhotoUrl(url);
      else setIdPhotoUrl(url);
      // 模拟 OCR
      setOcrLoading(true);
      setTimeout(() => {
        if (type === 'biz_license') {
          setCompanyFullName('广州市喵喵国际贸易有限公司');
          setCreditCode('91440101MA5CXXXXX');
          setLegalPerson('张三');
          setRegAddress('广州市白云区XX路XX号');
        } else {
          setCompanyFullName('张三');
          setIdNumber('440101199001011234');
        }
        setOcrLoading(false);
        Alert.alert('识别完成', '已自动填充部分信息，请核对确认');
      }, 1500);
    } else {
      Alert.alert('拍照', '原生拍照将在打包后启用', [
        { text: '添加模拟图片', onPress: () => {
          const url = `https://picsum.photos/seed/${Date.now()}/400/300`;
          if (type === 'biz_license') setPhotoUrl(url);
          else setIdPhotoUrl(url);
        }},
        { text: '取消', style: 'cancel' },
      ]);
    }
  };

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
        // 企业资质
        companyFullName: companyFullName || undefined,
        creditCode: creditCode || undefined,
        legalPerson: legalPerson || undefined,
        regAddress: regAddress || undefined,
        taxId: taxId || undefined,
        invoiceAddress: invoiceAddress || undefined,
        invoicePhone: invoicePhone || undefined,
        bankName: bankName || undefined,
        bankAccount: bankAccount || undefined,
        overseasRegNo: overseasRegNo || undefined,
        overseasTin: overseasTin || undefined,
        overseasPrincipal: overseasPrincipal || undefined,
        idType: customerType === 'INDIVIDUAL' ? idType : undefined,
        idNumber: idNumber || undefined,
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
            <Text style={styles.sectionTitle}>基础信息</Text>

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
            <Text style={styles.sectionTitle}>联系人</Text>
            <FormField label="联系人 *" value={contactName} onChangeText={setContactName} placeholder="联系人姓名" />
            <FormField label="电话 *" value={contactPhone} onChangeText={setContactPhone} placeholder="联系电话" keyboardType="phone-pad" />
            <FormField label="邮箱" value={contactEmail} onChangeText={setContactEmail} placeholder="邮箱（可选）" keyboardType="email-address" />
          </View>

          {/* 企业资质信息 */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.collapseHeader} onPress={() => setEnterpriseCollapsed(!enterpriseCollapsed)}>
              <Ionicons name={enterpriseCollapsed ? 'chevron-forward-outline' : 'chevron-down-outline'} size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>企业资质信息</Text>
              <Text style={styles.collapseHint}>{enterpriseCollapsed ? '展开填写' : '收起'}</Text>
            </TouchableOpacity>

            {!enterpriseCollapsed && (
              <>
                {customerType === 'COMPANY_CN' && (
                  <>
                    <FormField label="公司全称" value={companyFullName} onChangeText={setCompanyFullName} placeholder="营业执照上的公司全称" />
                    <View style={styles.formRow}>
                      <View style={styles.formHalf}>
                        <FormField label="信用代码" value={creditCode} onChangeText={setCreditCode} placeholder="18位统一社会信用代码" />
                      </View>
                      <View style={styles.formHalf}>
                        <FormField label="法定代表人" value={legalPerson} onChangeText={setLegalPerson} placeholder="法人姓名" />
                      </View>
                    </View>
                    <FormField label="注册地址" value={regAddress} onChangeText={setRegAddress} placeholder="营业执照注册地址" />
                    <View style={styles.formRow}>
                      <View style={styles.formHalf}>
                        <FormField label="纳税人识别号" value={taxId} onChangeText={setTaxId} placeholder="税号" />
                      </View>
                      <View style={styles.formHalf}>
                        <FormField label="开票电话" value={invoicePhone} onChangeText={setInvoicePhone} placeholder="开票电话" keyboardType="phone-pad" />
                      </View>
                    </View>
                    <FormField label="开票地址" value={invoiceAddress} onChangeText={setInvoiceAddress} placeholder="开票地址" />
                    {/* 拍照上传营业执照 */}
                    <TouchableOpacity style={styles.photoBtn} onPress={() => handleTakePhoto('biz_license')}>
                      <Ionicons name="camera-outline" size={22} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.photoBtnTitle}>拍照上传营业执照</Text>
                        <Text style={styles.photoBtnDesc}>自动识别填充公司信息</Text>
                      </View>
                      {photoUrl ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                    {ocrLoading && (
                      <View style={styles.ocrBanner}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.ocrText}>正在识别营业执照...</Text>
                      </View>
                    )}
                  </>
                )}

                {customerType === 'COMPANY_OVERSEAS' && (
                  <>
                    <FormField label="公司名称" value={companyFullName} onChangeText={setCompanyFullName} placeholder="海外公司注册名称" />
                    <FormField label="注册国家" value={regAddress} onChangeText={setRegAddress} placeholder="如：尼日利亚、加纳" />
                    <View style={styles.formRow}>
                      <View style={styles.formHalf}>
                        <FormField label="注册号" value={overseasRegNo} onChangeText={setOverseasRegNo} placeholder="公司注册号" />
                      </View>
                      <View style={styles.formHalf}>
                        <FormField label="税号 TIN" value={overseasTin} onChangeText={setOverseasTin} placeholder="税务识别号" />
                      </View>
                    </View>
                    <FormField label="负责人" value={overseasPrincipal} onChangeText={setOverseasPrincipal} placeholder="公司负责人" />
                  </>
                )}

                {customerType === 'INDIVIDUAL' && (
                  <>
                    <FormField label="姓名" value={companyFullName} onChangeText={setCompanyFullName} placeholder="证件姓名" />
                    <Text style={styles.formLabel}>证件类型</Text>
                    <View style={styles.optionRow}>
                      {(['ID_CARD', 'PASSPORT'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.optionBtn, idType === t && styles.optionBtnActive]}
                          onPress={() => setIdType(t)}
                        >
                          <Text style={[styles.optionText, idType === t && styles.optionTextActive]}>
                            {t === 'ID_CARD' ? '身份证' : '护照'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <FormField label="证件号码" value={idNumber} onChangeText={setIdNumber} placeholder="证件号码" />
                    {/* 拍照上传证件 */}
                    <TouchableOpacity style={styles.photoBtn} onPress={() => handleTakePhoto('id_card')}>
                      <Ionicons name="camera-outline" size={22} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.photoBtnTitle}>拍照上传{idType === 'ID_CARD' ? '身份证' : '护照'}</Text>
                        <Text style={styles.photoBtnDesc}>自动识别填充证件信息</Text>
                      </View>
                      {idPhotoUrl ? (
                        <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                    {ocrLoading && (
                      <View style={styles.ocrBanner}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.ocrText}>正在识别证件信息...</Text>
                      </View>
                    )}
                  </>
                )}

                {/* 银行信息 — 所有类型共用 */}
                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <FormField label="开户银行" value={bankName} onChangeText={setBankName} placeholder="开户银行" />
                  </View>
                  <View style={styles.formHalf}>
                    <FormField label="银行账号" value={bankAccount} onChangeText={setBankAccount} placeholder="银行账号" />
                  </View>
                </View>
              </>
            )}
          </View>

          {/* 物流偏好 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>物流偏好</Text>
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
            <Text style={styles.sectionTitle}>备注</Text>
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

  collapseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  collapseHint: { fontSize: font.xs, color: colors.textTertiary, marginLeft: 'auto' as const },
  formRow: { flexDirection: 'row', gap: spacing.md },
  formHalf: { flex: 1 },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.primaryLight, marginTop: spacing.md },
  photoBtnTitle: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  photoBtnDesc: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },
  ocrBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.infoLight, padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.sm },
  ocrText: { fontSize: font.xs, color: colors.info },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  submitBtn: { flexDirection: 'row', height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, shadowColor: colors.primary, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
  validationBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.md, marginBottom: 6 },
  validationBannerText: { fontSize: font.sm, color: colors.warning, fontWeight: '600' },
});
