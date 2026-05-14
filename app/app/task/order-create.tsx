import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { customerApi, orderApi, systemApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type ServiceType = 'EXPRESS' | 'STANDARD';
type ExportMode = 'BUYER_EXPORT' | 'SELF_EXPORT';
type PaymentMethod = 'PREPAID' | 'COD';

interface CustomerOption {
  id: string;
  customerCode: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
}

interface PackageItem {
  expressCompany: string;
  trackingNo: string;
  goodsName: string;
  goodsCategory: string;
  pieces: number;
  weight: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

interface CustomerDetail {
  senders: Array<{
    id: string;
    sender_name: string;
    sender_phone: string;
    sender_address: string;
    sender_city: string;
    sender_country: string;
    is_default: number;
  }>;
  recipients: Array<{
    id: string;
    recipient_name: string;
    recipient_phone: string;
    country: string;
    city: string;
    detail_address: string;
    is_default: number;
  }>;
}

const SERVICE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: 'EXPRESS', label: '特快' },
  { value: 'STANDARD', label: '普快' },
];

const EXPORT_OPTIONS: { value: ExportMode; label: string }[] = [
  { value: 'BUYER_EXPORT', label: '买单出口' },
  { value: 'SELF_EXPORT', label: '自备单证' },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'PREPAID', label: '预付' },
  { value: 'COD', label: '到付' },
];

const EXPRESS_COMPANIES = ['顺丰', '韵达', '圆通', '中通', '申通', '京东', '邮政', '德邦'];
const GOODS_CATEGORIES = ['ELECTRONICS', 'APPAREL', 'DAILY_USE', 'BEAUTY', 'MACHINE_PARTS', 'FOOD', 'OTHER'];

export default function OrderCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    customerId?: string;
    customerName?: string;
    fromUnmatchedId?: string;
    trackingNo?: string;
    senderName?: string;
    senderPhone?: string;
    pieces?: string;
    weightKg?: string;
    expressCompany?: string;
  }>();
  const fromUnmatchedId = params.fromUnmatchedId as string | undefined;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [senderPickerVisible, setSenderPickerVisible] = useState(false);
  const [recipientPickerVisible, setRecipientPickerVisible] = useState(false);

  // Step 1: 客户与基础信息
  const [customerId, setCustomerId] = useState<string>(params.customerId as string || '');
  const [customerName, setCustomerName] = useState<string>(params.customerName as string || '');
  const [customerCode, setCustomerCode] = useState<string>('');
  const [serviceType, setServiceType] = useState<ServiceType>('EXPRESS');
  const [exportMode, setExportMode] = useState<ExportMode>('BUYER_EXPORT');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PREPAID');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerKeyword, setCustomerKeyword] = useState('');

  // Step 2: 包裹列表 — 如果从无订单快递过来，预填一条
  const [packages, setPackages] = useState<PackageItem[]>(() => {
    if (params.trackingNo) {
      return [{
        expressCompany: (params.expressCompany as string) || '顺丰',
        trackingNo: params.trackingNo as string,
        goodsName: '',
        goodsCategory: 'OTHER',
        pieces: Number(params.pieces) || 1,
        weight: Number(params.weightKg) || 0,
      }];
    }
    return [{ expressCompany: '顺丰', trackingNo: '', goodsName: '', goodsCategory: 'OTHER', pieces: 1, weight: 0 }];
  });

  // Step 3: 发货 + 收货信息
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');
  const [senderName, setSenderName] = useState<string>((params.senderName as string) || '');
  const [senderPhone, setSenderPhone] = useState<string>((params.senderPhone as string) || '');
  const [senderAddress, setSenderAddress] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [consigneeName, setConsigneeName] = useState('');
  const [consigneePhone, setConsigneePhone] = useState('');
  const [consigneeAddress, setConsigneeAddress] = useState('');
  const [consigneeCountry, setConsigneeCountry] = useState('');
  const [consigneeCity, setConsigneeCity] = useState('');

  // 路线（用于预估运费）
  const [routeCode, setRouteCode] = useState('GZ.CN→LOS.NGA');

  useEffect(() => {
    customerApi.list({ poolType: 'PRIVATE' }).then((r) => setCustomers(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (customerId) {
      customerApi.get(customerId).then((r) => {
        setCustomerDetail(r.data);
        if (r.data?.customerCode || r.data?.shortCode) {
          setCustomerCode(r.data.customerCode || r.data.shortCode);
        }
        const defSender = (r.data?.senders || []).find((x: any) => x.is_default === 1) || (r.data?.senders || [])[0];
        if (defSender) {
          setSelectedSenderId(defSender.id);
          // 无订单快递跳入时,URL 带了发件人姓名/电话,优先保留,但仍带出地址作为参考
          setSenderName((prev) => prev || defSender.sender_name || '');
          setSenderPhone((prev) => prev || defSender.sender_phone || '');
          setSenderAddress(defSender.sender_address || '');
        }
        const defRecipient = (r.data?.recipients || []).find((x: any) => x.is_default === 1) || (r.data?.recipients || [])[0];
        if (defRecipient) {
          setSelectedRecipientId(defRecipient.id);
          setConsigneeName(defRecipient.recipient_name || '');
          setConsigneePhone(defRecipient.recipient_phone || '');
          setConsigneeAddress(defRecipient.detail_address || '');
          setConsigneeCountry(defRecipient.country || '');
          setConsigneeCity(defRecipient.city || '');
        }
      }).catch(() => {});
    }
  }, [customerId]);

  const filteredCustomers = useMemo(() => {
    if (!customerKeyword) return customers;
    const k = customerKeyword.toLowerCase();
    return customers.filter((c) =>
      c.customerName?.toLowerCase().includes(k) ||
      c.customerCode?.toLowerCase().includes(k)
    );
  }, [customers, customerKeyword]);

  const totalPieces = packages.reduce((sum, p) => sum + (Number(p.pieces) || 0), 0);
  const totalWeight = packages.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
  const estimatedFee = totalWeight > 0 ? (totalWeight <= 1 ? 63 : 63 + (totalWeight - 1) * 57) : 0;

  const addPackage = () => {
    setPackages([...packages, { expressCompany: '顺丰', trackingNo: '', goodsName: '', goodsCategory: 'OTHER', pieces: 1, weight: 0 }]);
  };

  const removePackage = (idx: number) => {
    setPackages(packages.filter((_, i) => i !== idx));
  };

  const updatePackage = (idx: number, patch: Partial<PackageItem>) => {
    setPackages(packages.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!customerId) { Alert.alert('请选择客户'); return; }
    }
    if (step === 2) {
      if (packages.length === 0) { Alert.alert('请至少添加一个包裹'); return; }
      const invalid = packages.find((p) => !p.goodsName || !p.pieces);
      if (invalid) { Alert.alert('请填写所有包裹的品名和件数'); return; }
    }
    if (step === 3) {
      if (!senderName || !senderPhone || !senderAddress) {
        Alert.alert('请填写完整的发货信息'); return;
      }
      if (!consigneeName || !consigneePhone || !consigneeAddress) {
        Alert.alert('请填写完整的收货信息'); return;
      }
    }
    setStep(step + 1);
  };

  const submitHint = !customerId
    ? '请先选择客户'
    : packages.length === 0
      ? '请至少添加一个包裹'
      : !senderName || !senderPhone || !senderAddress
        ? '发货信息不完整'
        : !consigneeName || !consigneePhone || !consigneeAddress
          ? '收货信息不完整'
          : null;

  const handleSubmit = async () => {
    if (submitHint) return;
    setSubmitting(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : {};
      // 入仓号规则（对齐 Web OrderCreate）:客户编号 + 3 位流水(100-999)
      const entryCode = customerCode || customerId.slice(-3).toUpperCase();
      const entrySeq = String(Math.floor(Math.random() * 900) + 100);
      const warehouseEntryNo = `${entryCode}${entrySeq}`;

      const res = await orderApi.create({
        businessLine: 'SEA',
        serviceType,
        customerId,
        customerName,
        customerCode,
        warehouseEntryNo,
        salesUserId: user.id || 'user-sales1',
        routeCode,
        exportMode,
        paymentMethod,
        senderName,
        senderPhone,
        senderAddress,
        consigneeName,
        consigneePhone,
        consigneeAddress,
        consigneeCountry,
        consigneeCity,
        totalPieces,
        totalWeight,
        items: packages.map((p) => ({
          expressCompany: p.expressCompany,
          trackingNo: p.trackingNo,
          goodsName: p.goodsName,
          goodsCategory: p.goodsCategory,
          pieces: p.pieces,
          weight: p.weight,
          lengthCm: p.lengthCm,
          widthCm: p.widthCm,
          heightCm: p.heightCm,
        })),
      });
      // 如果是从无订单快递跳过来的，创建订单后立即匹配
      if (fromUnmatchedId && res.data?.id) {
        try {
          const { warehouseApi } = await import('../../lib/api');
          await warehouseApi.matchUnmatched(fromUnmatchedId, {
            orderId: res.data.id,
            customerName,
            createSubOrder: true,
            matchMethod: 'CREATE_NEW',
          });
        } catch {
          // 非致命：订单已创建
        }
      }
      const successTitle = '订单创建成功';
      const successMsg = `运单号:${res.data?.orderNo}\n入仓号:${res.data?.warehouseEntryNo}${fromUnmatchedId ? '\n已自动关联无单快递' : ''}`;
      const resetForm = () => {
        setStep(1);
        setPackages([{ expressCompany: '顺丰', trackingNo: '', goodsName: '', goodsCategory: 'OTHER', pieces: 1, weight: 0 }]);
      };
      if (Platform.OS === 'web') {
        window.alert(`${successTitle}\n${successMsg}`);
        safeBack(router);
      } else {
        Alert.alert(successTitle, successMsg, [
          { text: '继续创建', onPress: resetForm },
          { text: '完成', onPress: () => safeBack(router) },
        ]);
      }
    } catch (err: any) {
      const msg = err?.message || '请重试';
      if (Platform.OS === 'web') window.alert(`创建失败:${msg}`);
      else Alert.alert('创建失败', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>选择客户</Text>
        <TouchableOpacity style={styles.customerSelector} onPress={() => setShowCustomerPicker(true)}>
          {customerId ? (
            <>
              <Text style={styles.customerSelectedName}>{customerName}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </>
          ) : (
            <>
              <Text style={styles.customerPlaceholder}>请选择客户</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服务信息</Text>

        <Text style={styles.formLabel}>服务类型</Text>
        <View style={styles.optionRow}>
          {SERVICE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionBtn, serviceType === opt.value && styles.optionBtnActive]}
              onPress={() => setServiceType(opt.value)}
            >
              <Text style={[styles.optionText, serviceType === opt.value && styles.optionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formLabel}>出口方式</Text>
        <View style={styles.optionRow}>
          {EXPORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionBtn, exportMode === opt.value && styles.optionBtnActive]}
              onPress={() => setExportMode(opt.value)}
            >
              <Text style={[styles.optionText, exportMode === opt.value && styles.optionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.formLabel}>付款方式</Text>
        <View style={styles.optionRow}>
          {PAYMENT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.optionBtn, paymentMethod === opt.value && styles.optionBtnActive]}
              onPress={() => setPaymentMethod(opt.value)}
            >
              <Text style={[styles.optionText, paymentMethod === opt.value && styles.optionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>
          共 {packages.length} 个包裹 · {totalPieces} 件 · {totalWeight.toFixed(1)} kg
        </Text>
      </View>

      {packages.map((pkg, idx) => (
        <View key={idx} style={styles.section}>
          <View style={styles.pkgHeader}>
            <Text style={styles.sectionTitle}>包裹 #{idx + 1}</Text>
            {packages.length > 1 && (
              <TouchableOpacity onPress={() => removePackage(idx)}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.formLabel}>快递公司</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EXPRESS_COMPANIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, pkg.expressCompany === c && styles.chipActive]}
                onPress={() => updatePackage(idx, { expressCompany: c })}
              >
                <Text style={[styles.chipText, pkg.expressCompany === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FormField label="快递单号" value={pkg.trackingNo} onChangeText={(v) => updatePackage(idx, { trackingNo: v })} placeholder="可扫码自动填入" />

          <FormField label="品名 *" value={pkg.goodsName} onChangeText={(v) => updatePackage(idx, { goodsName: v })} placeholder="货物名称" />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <FormField label="件数 *" value={String(pkg.pieces || '')} onChangeText={(v) => updatePackage(idx, { pieces: Number(v) || 0 })} placeholder="0" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="重量(kg)" value={String(pkg.weight || '')} onChangeText={(v) => updatePackage(idx, { weight: Number(v) || 0 })} placeholder="0" keyboardType="decimal-pad" />
            </View>
          </View>

          <View style={styles.row3}>
            <View style={{ flex: 1 }}>
              <FormField label="长(cm)" value={String(pkg.lengthCm || '')} onChangeText={(v) => updatePackage(idx, { lengthCm: Number(v) || undefined })} placeholder="0" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="宽(cm)" value={String(pkg.widthCm || '')} onChangeText={(v) => updatePackage(idx, { widthCm: Number(v) || undefined })} placeholder="0" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="高(cm)" value={String(pkg.heightCm || '')} onChangeText={(v) => updatePackage(idx, { heightCm: Number(v) || undefined })} placeholder="0" keyboardType="numeric" />
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.addPkgBtn} onPress={addPackage}>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.addPkgBtnText}>添加更多包裹</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStep3 = () => {
    const senderCount = customerDetail?.senders?.length || 0;
    const recipientCount = customerDetail?.recipients?.length || 0;
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 发货信息 */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>发货信息</Text>
            {senderCount > 0 && (
              <TouchableOpacity onPress={() => setSenderPickerVisible(true)} style={styles.linkBtn}>
                <Ionicons name="book-outline" size={14} color={colors.primary} />
                <Text style={styles.linkBtnText}>从地址簿选择（{senderCount}）</Text>
              </TouchableOpacity>
            )}
          </View>
          <FormField label="发件人 *" value={senderName} onChangeText={setSenderName} placeholder="发件人姓名" />
          <FormField label="联系电话 *" value={senderPhone} onChangeText={setSenderPhone} placeholder="发件电话" keyboardType="phone-pad" />
          <FormField label="详细地址 *" value={senderAddress} onChangeText={setSenderAddress} placeholder="发货详细地址" />
          {senderCount === 0 && (
            <Text style={styles.emptyHint}>该客户暂无发货人档案,直接填写即可</Text>
          )}
        </View>

        {/* 收货信息 */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>收货信息</Text>
            {recipientCount > 0 && (
              <TouchableOpacity onPress={() => setRecipientPickerVisible(true)} style={styles.linkBtn}>
                <Ionicons name="book-outline" size={14} color={colors.primary} />
                <Text style={styles.linkBtnText}>从地址簿选择（{recipientCount}）</Text>
              </TouchableOpacity>
            )}
          </View>
          <FormField label="收件人 *" value={consigneeName} onChangeText={setConsigneeName} placeholder="收件人姓名" />
          <FormField label="联系电话 *" value={consigneePhone} onChangeText={setConsigneePhone} placeholder="收件电话" keyboardType="phone-pad" />
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <FormField label="国家" value={consigneeCountry} onChangeText={setConsigneeCountry} placeholder="国家" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="城市" value={consigneeCity} onChangeText={setConsigneeCity} placeholder="城市" />
            </View>
          </View>
          <FormField label="详细地址 *" value={consigneeAddress} onChangeText={setConsigneeAddress} placeholder="街道门牌等" />
          {recipientCount === 0 && (
            <Text style={styles.emptyHint}>该客户暂无收货人档案,直接填写即可</Text>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderStep4 = () => (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>订单确认</Text>

        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>客户</Text>
          <Text style={styles.confirmValue}>{customerName}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>路线</Text>
          <Text style={styles.confirmValue}>{routeCode}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>服务类型</Text>
          <Text style={styles.confirmValue}>{SERVICE_OPTIONS.find((o) => o.value === serviceType)?.label}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>付款方式</Text>
          <Text style={styles.confirmValue}>{PAYMENT_OPTIONS.find((o) => o.value === paymentMethod)?.label}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>包裹数</Text>
          <Text style={styles.confirmValue}>{packages.length} 个</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>总件数</Text>
          <Text style={styles.confirmValue}>{totalPieces} 件</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>总重量</Text>
          <Text style={styles.confirmValue}>{totalWeight.toFixed(1)} kg</Text>
        </View>
        <View style={styles.confirmDivider} />
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>发件人</Text>
          <Text style={styles.confirmValue}>{senderName}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>发件电话</Text>
          <Text style={styles.confirmValue}>{senderPhone}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>发货地址</Text>
          <Text style={[styles.confirmValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{senderAddress || '-'}</Text>
        </View>
        <View style={styles.confirmDivider} />
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>收件人</Text>
          <Text style={styles.confirmValue}>{consigneeName}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>收件电话</Text>
          <Text style={styles.confirmValue}>{consigneePhone}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>收货地址</Text>
          <Text style={[styles.confirmValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{consigneeAddress || '-'}</Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.primaryLight }]}>
        <Text style={styles.feeLabel}>预估运费（仅供参考）</Text>
        <Text style={styles.feeValue}>¥ {estimatedFee.toFixed(2)}</Text>
        <Text style={styles.feeHint}>* 最终以实际称重为准</Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>新建订单</Text>
        </View>

        {/* 步骤指示器 */}
        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                <Text style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</Text>
              </View>
              <Text style={[styles.stepLabel, step >= s && styles.stepLabelActive]}>
                {['客户', '包裹', '收货', '确认'][s - 1]}
              </Text>
              {s < 4 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
            </View>
          ))}
        </View>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        <View style={styles.bottomBar}>
          {step < 4 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>下一步</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <>
              {submitHint && (
                <View style={styles.hintBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                  <Text style={styles.hintText}>{submitHint}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.submitBtn, (submitting || !!submitHint) && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={submitting || !!submitHint}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.submitBtnText}>{submitHint || '确认提交'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* 客户选择弹窗 */}
        <Modal visible={showCustomerPicker} transparent animationType="slide" onRequestClose={() => setShowCustomerPicker(false)}>
          <View style={styles.modalMask}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>选择客户</Text>
                <TouchableOpacity onPress={() => setShowCustomerPicker(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="搜索客户名/编号"
                  placeholderTextColor={colors.textTertiary}
                  value={customerKeyword}
                  onChangeText={setCustomerKeyword}
                />
              </View>
              <ScrollView style={{ maxHeight: 480 }}>
                {filteredCustomers.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.customerOption}
                    onPress={() => {
                      setCustomerId(c.id);
                      setCustomerName(c.customerName);
                      setCustomerCode(c.customerCode || '');
                      setShowCustomerPicker(false);
                    }}
                  >
                    <View style={styles.customerOptAvatar}>
                      <Text style={styles.customerOptAvatarText}>{c.customerName?.[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerOptName}>{c.customerName}</Text>
                      <Text style={styles.customerOptCode}>{c.customerCode} · {c.contactName} · {c.contactPhone}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 发货人选择弹窗 */}
        <Modal visible={senderPickerVisible} transparent animationType="slide" onRequestClose={() => setSenderPickerVisible(false)}>
          <View style={styles.modalMask}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>从地址簿选择发货人</Text>
                <TouchableOpacity onPress={() => setSenderPickerVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 480 }}>
                {(customerDetail?.senders || []).length === 0 ? (
                  <Text style={styles.emptyHint}>暂无发货人档案</Text>
                ) : (
                  (customerDetail?.senders || []).map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.recipientCard, selectedSenderId === s.id && styles.recipientCardActive]}
                      onPress={() => {
                        setSelectedSenderId(s.id);
                        setSenderName(s.sender_name || '');
                        setSenderPhone(s.sender_phone || '');
                        setSenderAddress(s.sender_address || '');
                        setSenderPickerVisible(false);
                      }}
                    >
                      <View style={styles.recipientHeader}>
                        <Text style={styles.recipientName}>{s.sender_name}</Text>
                        {s.is_default === 1 && (
                          <View style={styles.defaultBadge}><Text style={styles.defaultText}>默认</Text></View>
                        )}
                      </View>
                      <Text style={styles.recipientText}>{s.sender_phone}</Text>
                      <Text style={styles.recipientText}>{[s.sender_country, s.sender_city, s.sender_address].filter(Boolean).join(' · ') || '-'}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 收件人选择弹窗 */}
        <Modal visible={recipientPickerVisible} transparent animationType="slide" onRequestClose={() => setRecipientPickerVisible(false)}>
          <View style={styles.modalMask}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>从地址簿选择收件人</Text>
                <TouchableOpacity onPress={() => setRecipientPickerVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 480 }}>
                {(customerDetail?.recipients || []).length === 0 ? (
                  <Text style={styles.emptyHint}>暂无收件人档案</Text>
                ) : (
                  (customerDetail?.recipients || []).map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.recipientCard, selectedRecipientId === r.id && styles.recipientCardActive]}
                      onPress={() => {
                        setSelectedRecipientId(r.id);
                        setConsigneeName(r.recipient_name || '');
                        setConsigneePhone(r.recipient_phone || '');
                        setConsigneeAddress(r.detail_address || '');
                        setConsigneeCountry(r.country || '');
                        setConsigneeCity(r.city || '');
                        setRecipientPickerVisible(false);
                      }}
                    >
                      <View style={styles.recipientHeader}>
                        <Text style={styles.recipientName}>{r.recipient_name}</Text>
                        {r.is_default === 1 && (
                          <View style={styles.defaultBadge}><Text style={styles.defaultText}>默认</Text></View>
                        )}
                      </View>
                      <Text style={styles.recipientText}>{r.recipient_phone}</Text>
                      <Text style={styles.recipientText}>{[r.country, r.city, r.detail_address].filter(Boolean).join(' · ') || '-'}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
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

  stepIndicator: { flexDirection: 'row', backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight, alignItems: 'center' },
  stepItem: { flex: 1, alignItems: 'center', flexDirection: 'row' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.primary },
  stepNum: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '600' },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: font.xs, color: colors.textSecondary, marginLeft: 4 },
  stepLabelActive: { color: colors.primary, fontWeight: '600' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.borderLight, marginHorizontal: spacing.sm },
  stepLineActive: { backgroundColor: colors.primary },

  scroll: { padding: spacing.md, paddingBottom: 100 },
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  linkBtnText: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },
  emptyHint: { fontSize: font.xs, color: colors.textTertiary, paddingVertical: spacing.md, textAlign: 'center' },

  customerSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.bg },
  customerSelectedName: { fontSize: font.md, color: colors.text, fontWeight: '500' },
  customerPlaceholder: { fontSize: font.md, color: colors.textTertiary },

  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },

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

  summaryBar: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  summaryText: { fontSize: font.sm, color: colors.primary, fontWeight: '600', textAlign: 'center' },

  pkgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  row2: { flexDirection: 'row', gap: spacing.md },
  row3: { flexDirection: 'row', gap: spacing.sm },

  addPkgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  addPkgBtnText: { fontSize: font.md, color: colors.primary, fontWeight: '600' },

  recipientCard: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  recipientCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  recipientHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  recipientName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  defaultBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  defaultText: { fontSize: font.xs, color: colors.warning, fontWeight: '600' },
  recipientText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },

  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight, gap: spacing.md },
  confirmLabel: { fontSize: font.sm, color: colors.textSecondary },
  confirmValue: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
  confirmDivider: { height: spacing.sm },

  feeLabel: { fontSize: font.sm, color: colors.textSecondary, textAlign: 'center' },
  feeValue: { fontSize: 32, fontWeight: '700', color: colors.primary, textAlign: 'center', marginVertical: spacing.sm },
  feeHint: { fontSize: font.xs, color: colors.textTertiary, textAlign: 'center' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  nextBtn: { flexDirection: 'row', height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  nextBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  submitBtn: { flexDirection: 'row', height: 52, backgroundColor: colors.success, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
  hintBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginBottom: spacing.sm },
  hintText: { flex: 1, fontSize: font.xs, color: colors.warning, fontWeight: '500' },

  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, gap: spacing.sm, marginBottom: spacing.md },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  customerOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, marginBottom: spacing.sm },
  customerOptAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  customerOptAvatarText: { fontSize: font.lg, color: colors.primary, fontWeight: '700' },
  customerOptName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  customerOptCode: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
});
