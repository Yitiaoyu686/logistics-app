import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { deliveryApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type DeliveryMethod = 'DELIVERY' | 'SELF_PICKUP' | 'SATELLITE_STATION';

const METHODS: { value: DeliveryMethod; label: string; icon: string }[] = [
  { value: 'DELIVERY', label: '送货上门', icon: 'car' },
  { value: 'SELF_PICKUP', label: '客户自提', icon: 'cube' },
  { value: 'SATELLITE_STATION', label: '卫星站点', icon: 'location' },
];

export default function DpnCreateScreen() {
  const router = useRouter();
  const [fromSite, setFromSite] = useState('拉各斯起运站');
  const [toSite, setToSite] = useState('');
  const [method, setMethod] = useState<DeliveryMethod>('DELIVERY');
  const [eta, setEta] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const createHint = !fromSite.trim()
    ? '请填写起运站点'
    : !toSite.trim() ? '请填写目的站点' : null;

  const handleCreate = async () => {
    if (createHint) return;
    setSubmitting(true);
    try {
      const res = await deliveryApi.createDpn({
        businessLine: 'SEA',
        dpnType: 'DELIVERY',
        fromSite,
        toSite,
        deliveryMethod: method,
        eta: eta || undefined,
        remark: remark || undefined,
      });
      const goBind = () =>
        router.replace({
          pathname: '/task/dpn',
          params: {
            dpnId: res.data?.id,
            dpnNo: res.data?.dpnNo,
            dpnStatus: 'PENDING_BIND',
            fromSite,
            toSite,
          },
        });
      if (Platform.OS === 'web') {
        window.alert(`创建成功 DPN: ${res.data?.dpnNo}\n即将跳转绑运单`);
        goBind();
      } else {
        Alert.alert(
          '创建成功',
          `DPN: ${res.data?.dpnNo}\n请继续绑定运单`,
          [
            { text: '去绑运单', onPress: goBind },
            { text: '稍后', onPress: () => safeBack(router) },
          ],
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请重试';
      if (Platform.OS === 'web') window.alert(`创建失败：${message}`);
      else Alert.alert('创建失败', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>新建 DPN</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>站点信息</Text>
            <Field label="起运站点 *" value={fromSite} onChange={setFromSite} placeholder="如：拉各斯起运站" />
            <Field label="目的站点 *" value={toSite} onChange={setToSite} placeholder="如：拉各斯市中心" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>派送方式</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[
                    styles.methodChip,
                    method === m.value && {
                      backgroundColor: colors.primaryLight,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setMethod(m.value)}
                >
                  <Ionicons
                    name={m.icon as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={method === m.value ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.methodText,
                      method === m.value && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>时间</Text>
            <Field label="预计送达" value={eta} onChange={setEta} placeholder="YYYY-MM-DD" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>备注</Text>
            <TextInput
              style={styles.textarea}
              value={remark}
              onChangeText={setRemark}
              placeholder="可选"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          {createHint && (
            <View style={styles.hintBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.hintText}>{createHint}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !!createHint) && { opacity: 0.6 }]}
            onPress={handleCreate}
            disabled={submitting || !!createHint}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{createHint || '创建 DPN 并绑运单'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <View style={styles.formItem}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  scroll: { padding: spacing.md, paddingBottom: 120 },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },

  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.card },

  methodChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  methodText: { fontSize: font.sm, color: colors.textSecondary },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  hintBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginBottom: spacing.sm },
  hintText: { flex: 1, fontSize: font.xs, color: colors.warning, fontWeight: '500' },
});
