import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { deliveryApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type Mode = 'sign' | 'fail';

const FAIL_REASONS = [
  { value: 'NO_RECIPIENT', label: '无人签收', icon: 'person-outline' },
  { value: 'WRONG_ADDRESS', label: '地址错误', icon: 'location-outline' },
  { value: 'REFUSED', label: '客户拒收', icon: 'close-circle-outline' },
  { value: 'DAMAGED', label: '货物破损', icon: 'cube-outline' },
  { value: 'OTHER', label: '其他', icon: 'help-circle-outline' },
];

export default function DeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ taskId?: string; taskNo?: string; dpnNo?: string; recipientName?: string; recipientPhone?: string; mode?: Mode }>();

  const [mode, setMode] = useState<Mode>(params.mode || 'sign');
  const [submitting, setSubmitting] = useState(false);

  // Sign form
  const [signName, setSignName] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [codMethod, setCodMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [signRemark, setSignRemark] = useState('');
  const [signPhoto, setSignPhoto] = useState(false); // 模拟拍照

  // Fail form
  const [failReason, setFailReason] = useState<string>('');
  const [failDetail, setFailDetail] = useState('');
  const [failPhoto, setFailPhoto] = useState(false);

  const handleSign = async () => {
    if (!signName.trim()) { Alert.alert('请填写签收人姓名'); return; }
    if (!signPhoto) { Alert.alert('请先拍照留证'); return; }

    setSubmitting(true);
    try {
      if (params.taskId) {
        await deliveryApi.signDelivery(params.taskId as string, {
          signedBy: signName,
          signPhotoUrls: ['mock-photo-url'],
          remark: signRemark,
        });
      }
      Alert.alert('签收成功', '', [{ text: '确定', onPress: () => safeBack(router) }]);
    } catch (err: any) {
      Alert.alert('签收失败', err.message || '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFail = async () => {
    if (!failReason) { Alert.alert('请选择失败原因'); return; }

    setSubmitting(true);
    try {
      if (params.taskId) {
        await deliveryApi.failDelivery(params.taskId as string, {
          failureReason: failReason,
          remark: failDetail,
        });
      }
      Alert.alert('已提交', '已通知相关人员', [{ text: '确定', onPress: () => safeBack(router) }]);
    } catch (err: any) {
      Alert.alert('提交失败', err.message || '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertPickup = () => {
    Alert.alert('转为自提', '确认将此任务转为自提？', [
      { text: '取消', style: 'cancel' },
      { text: '确认', onPress: () => {
        Alert.alert('已转自提', '任务已出现在自提列表', [{ text: '确定', onPress: () => safeBack(router) }]);
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Nav */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{mode === 'sign' ? '配送签收' : '配送失败'}</Text>
          <TouchableOpacity onPress={handleConvertPickup} style={styles.convertBtn}>
            <Text style={styles.convertText}>转自提</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 任务信息 */}
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>任务号</Text>
            <Text style={styles.infoValue}>{params.taskNo || '-'}</Text>
            <Text style={styles.infoLabel}>DPN编号</Text>
            <Text style={styles.infoValue}>{params.dpnNo || '-'}</Text>
            <Text style={styles.infoLabel}>收货人</Text>
            <Text style={styles.infoValue}>
              {params.recipientName || '-'} · {params.recipientPhone || '-'}
            </Text>
          </View>

          {/* 模式切换 */}
          <View style={styles.modeSwitch}>
            <Pressable
              style={[styles.modeBtn, mode === 'sign' && styles.modeBtnSign]}
              onPress={() => setMode('sign')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="checkmark-circle-outline" size={16} color={mode === 'sign' ? colors.success : colors.textSecondary} />
                <Text style={[styles.modeText, mode === 'sign' && styles.modeTextActive]}>配送完成</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, mode === 'fail' && styles.modeBtnFail]}
              onPress={() => setMode('fail')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="close-circle-outline" size={16} color={mode === 'fail' ? colors.danger : colors.textSecondary} />
                <Text style={[styles.modeText, mode === 'fail' && styles.modeTextActiveFail]}>配送失败</Text>
              </View>
            </Pressable>
          </View>

          {mode === 'sign' ? (
            <>
              {/* 签收表单 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>签收信息</Text>
                <Text style={styles.formLabel}>签收人姓名 <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={signName}
                  onChangeText={setSignName}
                  placeholder="请输入签收人姓名"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>

              {/* 签收照片 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>签收照片 <Text style={styles.required}>*</Text></Text>
                <View style={styles.photoRow}>
                  <TouchableOpacity
                    style={[styles.photoSlot, signPhoto && styles.photoSlotFilled]}
                    onPress={() => setSignPhoto(!signPhoto)}
                  >
                    {signPhoto ? (
                      <>
                        <Ionicons name="checkmark-circle" size={32} color={colors.success} />
                        <Text style={styles.photoFilledText}>已拍照</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={28} color={colors.textTertiary} />
                        <Text style={styles.photoHintText}>拍照</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.photoTip}>建议拍摄：货物 + 签收人/签收单</Text>
              </View>

              {/* COD */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>到付收款（如有）</Text>
                <Text style={styles.formLabel}>收款金额</Text>
                <View style={styles.amountRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={codAmount}
                    onChangeText={setCodAmount}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.currencyText}>NGN</Text>
                </View>

                <Text style={[styles.formLabel, { marginTop: spacing.md }]}>收款方式</Text>
                <View style={styles.methodRow}>
                  {[
                    { v: 'CASH' as const, label: '现金' },
                    { v: 'TRANSFER' as const, label: '转账' },
                  ].map((m) => (
                    <Pressable
                      key={m.v}
                      style={[styles.methodBtn, codMethod === m.v && styles.methodBtnActive]}
                      onPress={() => setCodMethod(m.v)}
                    >
                      <Text style={[styles.methodText, codMethod === m.v && styles.methodTextActive]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* 备注 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>备注</Text>
                <TextInput
                  style={styles.textarea}
                  value={signRemark}
                  onChangeText={setSignRemark}
                  placeholder="可选"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </>
          ) : (
            <>
              {/* 失败原因 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>失败原因 <Text style={styles.required}>*</Text></Text>
                {FAIL_REASONS.map((r) => (
                  <Pressable
                    key={r.value}
                    style={[styles.reasonBtn, failReason === r.value && styles.reasonBtnActive]}
                    onPress={() => setFailReason(r.value)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name={r.icon as any} size={16} color={failReason === r.value ? colors.danger : colors.textSecondary} />
                      <Text style={styles.reasonText}>{r.label}</Text>
                    </View>
                    {failReason === r.value && <Ionicons name="checkmark" size={20} color={colors.danger} />}
                  </Pressable>
                ))}
              </View>

              {/* 现场照片 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>现场照片</Text>
                <View style={styles.photoRow}>
                  <TouchableOpacity
                    style={[styles.photoSlot, failPhoto && styles.photoSlotFilled]}
                    onPress={() => setFailPhoto(!failPhoto)}
                  >
                    {failPhoto ? (
                      <>
                        <Ionicons name="checkmark-circle" size={32} color={colors.success} />
                        <Text style={styles.photoFilledText}>已拍照</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="camera-outline" size={28} color={colors.textTertiary} />
                        <Text style={styles.photoHintText}>拍照</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* 详细说明 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>详细说明</Text>
                <TextInput
                  style={styles.textarea}
                  value={failDetail}
                  onChangeText={setFailDetail}
                  placeholder="请描述失败详情"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </>
          )}
        </ScrollView>

        {/* 底部按钮 */}
        <View style={styles.bottomBar}>
          {mode === 'sign' ? (
            <TouchableOpacity
              style={[styles.btnPrimary, styles.btnSign, submitting && styles.btnDisabled]}
              onPress={handleSign}
              disabled={submitting}
            >
              <Text style={styles.btnText}>
                {submitting ? '处理中...' : '确认签收'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, styles.btnFail, submitting && styles.btnDisabled]}
              onPress={handleFail}
              disabled={submitting}
            >
              <Text style={styles.btnText}>
                {submitting ? '提交中...' : '提交'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  convertBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: colors.borderLight },
  convertText: { fontSize: font.sm, color: colors.textSecondary },

  scroll: { padding: spacing.md, paddingBottom: 120 },

  infoCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  infoLabel: { fontSize: font.xs, color: colors.textSecondary },
  infoValue: { fontSize: font.sm, color: colors.text, fontWeight: '500', marginBottom: spacing.sm, marginTop: 2 },

  modeSwitch: { flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radius.md, padding: 3, marginBottom: spacing.md },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.sm },
  modeBtnSign: { backgroundColor: colors.successLight, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  modeBtnFail: { backgroundColor: colors.dangerLight, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  modeText: { fontSize: font.sm, color: colors.textSecondary },
  modeTextActive: { color: colors.success, fontWeight: '600' },
  modeTextActiveFail: { color: colors.danger, fontWeight: '600' },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },

  formLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 4 },
  required: { color: colors.danger },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.card },

  photoRow: { flexDirection: 'row', gap: spacing.md },
  photoSlot: { width: 88, height: 88, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoSlotFilled: { borderStyle: 'solid', borderColor: colors.success, backgroundColor: colors.successLight },
  photoHintText: { fontSize: font.xs, color: colors.textTertiary },
  photoFilledText: { fontSize: font.xs, color: colors.success, fontWeight: '600' },
  photoTip: { fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.sm },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currencyText: { fontSize: font.md, color: colors.textSecondary, fontWeight: '500' },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  methodBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.card },
  methodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  methodText: { fontSize: font.sm, color: colors.textSecondary },
  methodTextActive: { color: colors.primary, fontWeight: '600' },

  reasonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: colors.card },
  reasonBtnActive: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
  reasonText: { fontSize: font.md, color: colors.text },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  btnPrimary: { height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnSign: { backgroundColor: colors.success },
  btnFail: { backgroundColor: colors.danger },
  btnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
});
