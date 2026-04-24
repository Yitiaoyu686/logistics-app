import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { deliveryApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type Mode = 'notify' | 'verify';

export default function PickupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    pickupId?: string; pickupNo?: string; trackingNo?: string;
    recipientName?: string; recipientPhone?: string; pickupStation?: string;
    notifyStatus?: string; mode?: Mode;
  }>();

  const [mode, setMode] = useState<Mode>(params.mode || (params.notifyStatus === 'PENDING' ? 'notify' : 'verify'));
  const [submitting, setSubmitting] = useState(false);

  // Verify form
  const [inputCode, setInputCode] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [codMethod, setCodMethod] = useState<'CASH' | 'TRANSFER'>('CASH');

  const notifyHint = !params.pickupId
    ? '缺少自提单 ID'
    : !params.recipientPhone ? '收件人电话缺失，无法发送短信'
    : null;

  const verifyHint = !inputCode.trim()
    ? '请输入提货码'
    : inputCode.trim().length !== 6 ? '提货码必须为 6 位'
    : null;

  const handleNotify = async () => {
    if (notifyHint) return;
    setSubmitting(true);
    try {
      if (params.pickupId) {
        await deliveryApi.notifyPickup(params.pickupId as string);
      }
      const msg = `短信已发送到 ${params.recipientPhone}\n包含提货码、自提站点地址和营业时间`;
      if (Platform.OS === 'web') {
        window.alert(`通知已发送\n${msg}`);
        safeBack(router);
      } else {
        Alert.alert('通知已发送', msg, [{ text: '确定', onPress: () => safeBack(router) }]);
      }
    } catch (err: any) {
      const m = err?.message || '请重试';
      if (Platform.OS === 'web') window.alert(`发送失败：${m}`);
      else Alert.alert('发送失败', m);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (verifyHint) return;
    setSubmitting(true);
    try {
      if (params.pickupId) {
        await deliveryApi.completePickup(params.pickupId as string);
      }
      if (Platform.OS === 'web') {
        window.alert('核销成功：客户已取货');
        safeBack(router);
      } else {
        Alert.alert('核销成功', '客户已取货', [{ text: '确定', onPress: () => safeBack(router) }]);
      }
    } catch (err: any) {
      const m = err?.message || '请重试';
      if (Platform.OS === 'web') window.alert(`核销失败：${m}`);
      else Alert.alert('核销失败', m);
    } finally {
      setSubmitting(false);
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
          <Text style={styles.navTitle}>{mode === 'notify' ? '通知自提' : '核销自提'}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 自提单信息 */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Text style={styles.pickupNo}>{params.pickupNo || '-'}</Text>
              <View style={styles.stationBadge}>
                <Ionicons name="location-outline" size={14} color={colors.info} />
                <Text style={styles.stationText}>{params.pickupStation || '-'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>运单号</Text>
              <Text style={styles.infoValue}>{params.trackingNo || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>收件人</Text>
              <Text style={styles.infoValue}>{params.recipientName || '-'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>联系电话</Text>
              <Text style={[styles.infoValue, { color: colors.primary }]}>
                {params.recipientPhone || '-'}
              </Text>
            </View>
          </View>

          {mode === 'notify' ? (
            <>
              {/* 通知模式 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📱 发送自提通知</Text>
                <Text style={styles.hint}>
                  短信将包含以下信息：
                </Text>
                <View style={styles.smsPreview}>
                  <Text style={styles.smsText}>
                    【跨境物流】您的货物已到达 <Text style={styles.smsHighlight}>{params.pickupStation || '自提点'}</Text>。
                  </Text>
                  <Text style={styles.smsText}>
                    提货码：<Text style={styles.smsCode}>892345</Text>（随机生成）
                  </Text>
                  <Text style={styles.smsText}>
                    站点地址：Ikeja Station, Lagos
                  </Text>
                  <Text style={styles.smsText}>
                    营业时间：周一至周六 9:00-18:00
                  </Text>
                  <Text style={styles.smsText}>
                    请携带身份证件到站点取货。
                  </Text>
                </View>
              </View>

              <View style={styles.tipCard}>
                <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                <Text style={styles.tipText}>
                  确认发送后，客户会收到短信通知，状态变为"已通知"
                </Text>
              </View>
            </>
          ) : (
            <>
              {/* 核销模式 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔢 验证提货码</Text>
                <View style={styles.codeInputRow}>
                  <TextInput
                    style={styles.codeInput}
                    value={inputCode}
                    onChangeText={setInputCode}
                    placeholder="请输入 6 位提货码"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <TouchableOpacity style={styles.scanBtn}>
                    <Ionicons name="scan-outline" size={20} color={colors.primary} />
                    <Text style={styles.scanBtnText}>扫码</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.hint}>客户出示的提货码（6位数字）</Text>
              </View>

              {/* COD 收款 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>💰 到付收款（如有）</Text>
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
                    { v: 'CASH' as const, label: '💵 现金' },
                    { v: 'TRANSFER' as const, label: '💳 转账' },
                  ].map((m) => (
                    <TouchableOpacity
                      key={m.v}
                      style={[styles.methodBtn, codMethod === m.v && styles.methodBtnActive]}
                      onPress={() => setCodMethod(m.v)}
                    >
                      <Text style={[styles.methodText, codMethod === m.v && styles.methodTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* 底部按钮 */}
        <View style={styles.bottomBar}>
          {mode === 'notify' ? (
            <>
              {notifyHint && (
                <View style={styles.hintBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                  <Text style={styles.hintText}>{notifyHint}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.btnPrimary, (submitting || !!notifyHint) && styles.btnDisabled]}
                onPress={handleNotify}
                disabled={submitting || !!notifyHint}
              >
                <Ionicons name="send-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.btnText}>
                  {submitting ? '发送中...' : (notifyHint || '发送自提通知')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {verifyHint && (
                <View style={styles.hintBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                  <Text style={styles.hintText}>{verifyHint}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.btnSuccess, (submitting || !!verifyHint) && styles.btnDisabled]}
                onPress={handleVerify}
                disabled={submitting || !!verifyHint}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.btnText}>
                  {submitting ? '核销中...' : (verifyHint || '确认核销')}
                </Text>
              </TouchableOpacity>
            </>
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

  scroll: { padding: spacing.md, paddingBottom: 120 },

  infoCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  pickupNo: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono },
  stationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.infoLight, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  stationText: { fontSize: font.xs, color: colors.info, fontWeight: '500' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  infoLabel: { fontSize: font.sm, color: colors.textSecondary },
  infoValue: { fontSize: font.sm, color: colors.text, fontWeight: '500' },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  hint: { fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.sm },
  formLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 4 },

  smsPreview: { backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary, marginTop: spacing.sm },
  smsText: { fontSize: font.sm, color: colors.text, lineHeight: 22 },
  smsHighlight: { fontWeight: '600', color: colors.primary },
  smsCode: { fontWeight: '700', color: colors.danger, fontSize: font.md, fontFamily: font.mono },

  tipCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.infoLight, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info },

  codeInputRow: { flexDirection: 'row', gap: spacing.sm },
  codeInput: { flex: 1, borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 56, fontSize: font.xxl, color: colors.primary, fontWeight: '700', letterSpacing: 4, textAlign: 'center', backgroundColor: colors.card },
  scanBtn: { width: 80, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', gap: 2 },
  scanBtnText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },

  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currencyText: { fontSize: font.md, color: colors.textSecondary, fontWeight: '500' },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  methodBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.card },
  methodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  methodText: { fontSize: font.sm, color: colors.textSecondary },
  methodTextActive: { color: colors.primary, fontWeight: '600' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  btnPrimary: { flexDirection: 'row', height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnSuccess: { flexDirection: 'row', height: 52, backgroundColor: colors.success, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
  hintBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginBottom: spacing.sm },
  hintText: { flex: 1, fontSize: font.xs, color: colors.warning, fontWeight: '500' },
});
