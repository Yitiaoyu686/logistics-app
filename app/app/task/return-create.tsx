import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type ReturnType = 'CUSTOMER_CANCEL' | 'GOODS_ISSUE' | 'ADDRESS_ERROR' | 'OTHER';
type DisposalMethod = 'RETURN_TO_CUSTOMER' | 'RETURN_TO_STOCK' | 'DESTROY';

const REASON_OPTIONS: { value: ReturnType; label: string }[] = [
  { value: 'CUSTOMER_CANCEL', label: '客户取消' },
  { value: 'GOODS_ISSUE', label: '货物问题' },
  { value: 'ADDRESS_ERROR', label: '地址错误' },
  { value: 'OTHER', label: '其他' },
];

const DISPOSAL_OPTIONS: { value: DisposalMethod; label: string; hint: string }[] = [
  { value: 'RETURN_TO_CUSTOMER', label: '退回客户', hint: '寄回客户，需填写收件信息' },
  { value: 'RETURN_TO_STOCK', label: '退回入库', hint: '留仓待处理' },
  { value: 'DESTROY', label: '销毁', hint: '就地销毁' },
];

interface StockHit {
  id: string;
  order_no?: string;
  sub_order_no?: string;
  customer_name?: string;
  pieces?: number;
  gross_weight_kg?: number;
  stock_status?: string;
  location_code?: string;
}

export default function ReturnCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ stockId?: string; subOrderNo?: string }>();

  const [keyword, setKeyword] = useState(params.subOrderNo || '');
  const [hit, setHit] = useState<StockHit | null>(null);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState<ReturnType | null>(null);
  const [disposal, setDisposal] = useState<DisposalMethod>('RETURN_TO_STOCK');
  const [detail, setDetail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 如果进来时带了 stockId，直接预加载
  if (params.stockId && !hit && !searching) {
    void handleDirectLoad(params.stockId as string);
  }

  async function handleDirectLoad(stockId: string): Promise<void> {
    setSearching(true);
    try {
      const res = await warehouseApi.getStock({ keyword: stockId });
      const rows = (res.data as StockHit[]) || [];
      const match = rows.find((r) => r.id === stockId) || rows[0];
      if (match) setHit(match);
    } catch {
      // 忽略
    } finally {
      setSearching(false);
    }
  }

  const handleSearch = async () => {
    const kw = keyword.trim();
    if (!kw) { Alert.alert('请输入子单号或运单号'); return; }
    setSearching(true);
    setHit(null);
    try {
      const res = await warehouseApi.getStock({ keyword: kw });
      const rows = (res.data as StockHit[]) || [];
      if (rows.length === 0) {
        Alert.alert('未找到', `没有匹配"${kw}"的库存记录`);
      } else if (rows.length === 1) {
        setHit(rows[0]);
      } else {
        // 多条：默认取第一条，让用户知道
        setHit(rows[0]);
        Alert.alert('找到多条库存', `匹配 ${rows.length} 条，已显示第一条，请精确输入子单号`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '查询失败';
      Alert.alert('查询失败', message);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!hit) { Alert.alert('请先选择要退运的库存'); return; }
    if (!reason) { Alert.alert('请选择退运原因'); return; }
    if (disposal === 'RETURN_TO_CUSTOMER') {
      if (!recipientName || !recipientPhone || !recipientAddress) {
        Alert.alert('退回客户需填写收件信息（姓名/电话/地址）');
        return;
      }
    }

    setSubmitting(true);
    try {
      const reasonLabel = REASON_OPTIONS.find((o) => o.value === reason)?.label || reason;
      const disposalLabel = DISPOSAL_OPTIONS.find((o) => o.value === disposal)?.label || disposal;
      const fullReason = [reasonLabel, detail].filter(Boolean).join(' · ');

      await warehouseApi.applyReturn(hit.id, {
        reason: fullReason,
        disposalMethod: disposal,
        recipientName: disposal === 'RETURN_TO_CUSTOMER' ? recipientName : undefined,
        recipientPhone: disposal === 'RETURN_TO_CUSTOMER' ? recipientPhone : undefined,
        recipientAddress: disposal === 'RETURN_TO_CUSTOMER' ? recipientAddress : undefined,
      });

      Alert.alert(
        '退运已提交',
        `库存 ${hit.sub_order_no || hit.id} 已申请退运\n处置：${disposalLabel}\n原因：${reasonLabel}`,
        [{ text: '确定', onPress: () => safeBack(router) }],
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请重试';
      Alert.alert('提交失败', message);
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
          <Text style={styles.navTitle}>新建退运</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* 1. 查库存 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔍 选择要退运的库存</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="扫码或输入子单号 / 运单号"
                placeholderTextColor={colors.textTertiary}
                value={keyword}
                onChangeText={setKeyword}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
                {searching
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.searchBtnText}>查询</Text>}
              </TouchableOpacity>
            </View>

            {hit && (
              <View style={styles.hitCard}>
                <View style={styles.hitHeader}>
                  <Text style={styles.hitSubNo}>{hit.sub_order_no || hit.id}</Text>
                  {hit.stock_status && (
                    <View style={styles.hitStatusBadge}>
                      <Text style={styles.hitStatusText}>{hit.stock_status}</Text>
                    </View>
                  )}
                </View>
                {hit.order_no && <Text style={styles.hitLine}>主单：{hit.order_no}</Text>}
                {hit.customer_name && <Text style={styles.hitLine}>客户：{hit.customer_name}</Text>}
                <Text style={styles.hitLine}>
                  货物：{hit.pieces || 0}件 · {(hit.gross_weight_kg || 0).toFixed(2)}kg
                </Text>
                {hit.location_code && <Text style={styles.hitLine}>库位：{hit.location_code}</Text>}
              </View>
            )}
          </View>

          {/* 2. 退运原因 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>❓ 退运原因</Text>
            <View style={styles.chipWrap}>
              {REASON_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.chip, reason === o.value && styles.chipActive]}
                  onPress={() => setReason(o.value)}
                >
                  <Text style={[styles.chipText, reason === o.value && styles.chipTextActive]}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.textarea}
              value={detail}
              onChangeText={setDetail}
              placeholder="补充说明（可选）"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </View>

          {/* 3. 货物处置 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 货物处置方式</Text>
            {DISPOSAL_OPTIONS.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={[styles.disposalRow, disposal === o.value && styles.disposalRowActive]}
                onPress={() => setDisposal(o.value)}
              >
                <Ionicons
                  name={disposal === o.value ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={disposal === o.value ? colors.primary : colors.textTertiary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.disposalLabel, disposal === o.value && { color: colors.primary }]}>
                    {o.label}
                  </Text>
                  <Text style={styles.disposalHint}>{o.hint}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 4. 收件信息（仅退回客户） */}
          {disposal === 'RETURN_TO_CUSTOMER' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📮 收件信息</Text>
              <Field label="收件人姓名 *" value={recipientName} onChange={setRecipientName} placeholder="如：张先生" />
              <Field label="联系电话 *" value={recipientPhone} onChange={setRecipientPhone} placeholder="请输入联系电话" />
              <Field label="详细地址 *" value={recipientAddress} onChange={setRecipientAddress} placeholder="省/市/区/街道" />
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !hit || !reason) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={submitting || !hit || !reason}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>提交退运申请</Text>}
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
  scroll: { padding: spacing.md, paddingBottom: 140 },

  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },

  searchRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  searchInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text },
  searchBtn: { paddingHorizontal: spacing.lg, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minWidth: 76 },
  searchBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },

  hitCard: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.primaryLight, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  hitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  hitSubNo: { fontSize: font.md, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  hitStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, backgroundColor: colors.card, borderRadius: radius.sm },
  hitStatusText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },
  hitLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '600' },

  disposalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: spacing.sm, backgroundColor: colors.card },
  disposalRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  disposalLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
  disposalHint: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },

  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.card },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, backgroundColor: colors.card, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  submitBtn: { height: 48, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
