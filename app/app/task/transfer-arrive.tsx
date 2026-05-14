import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

export default function TransferArriveScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<{
    transfer_no: string;
    from_warehouse_name: string;
    to_warehouse_name: string;
    total_pieces: number;
    total_weight_kg: number;
    driver_name?: string;
    plate_no?: string;
    logistics_company?: string;
  } | null>(null);
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await warehouseApi.getTransferDetail(id);
        const t = res.data;
        setInfo({
          transfer_no: t.transfer_no,
          from_warehouse_name: t.from_warehouse_name || '-',
          to_warehouse_name: t.to_warehouse_name || '-',
          total_pieces: t.total_pieces || 0,
          total_weight_kg: t.total_weight_kg || 0,
          driver_name: t.driver_name,
          plate_no: t.plate_no,
          logistics_company: t.logistics_company,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '请重试';
        Alert.alert('加载失败', msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    try {
      await warehouseApi.updateTransfer(id, {
        transferStatus: 'ARRIVED',
        arrivalTime: new Date().toISOString(),
        remark: remark || undefined,
      });
      Alert.alert('操作成功', '已确认到达', [{ text: '确定', onPress: () => safeBack(router) }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '请重试';
      Alert.alert('操作失败', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>确认到达</Text>
        <View style={styles.navBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : !info ? (
        <View style={styles.center}><Text style={styles.emptyText}>加载失败</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{info.transfer_no}</Text>
            <Text style={styles.infoLine}>{info.from_warehouse_name} → {info.to_warehouse_name}</Text>
            <Text style={styles.infoLine}>{info.total_pieces} 件 · {info.total_weight_kg} kg</Text>
            {info.logistics_company && (
              <Text style={styles.infoLine}>物流：{info.logistics_company}</Text>
            )}
            {info.driver_name && (
              <Text style={styles.infoLine}>司机：{info.driver_name} · {info.plate_no || '-'}</Text>
            )}
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.info} />
            <Text style={styles.tipText}>司机已抵达目标仓库，确认后调拨单状态变为"已到达"</Text>
          </View>

          <View style={styles.formItem}>
            <Text style={styles.formLabel}>到达备注</Text>
            <TextInput
              style={styles.textarea}
              value={remark}
              onChangeText={setRemark}
              placeholder="可选"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>确认到达</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 40 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: '600', color: colors.text },
  content: { padding: spacing.md, paddingBottom: 40 },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  infoTitle: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono, marginBottom: 4 },
  infoLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info },
  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 80, textAlignVertical: 'top', backgroundColor: colors.card },
  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
});
