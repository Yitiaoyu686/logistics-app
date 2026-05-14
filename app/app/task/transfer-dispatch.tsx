import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi, systemApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface SupplierOption {
  id: string;
  name: string;
  supplier_type: string;
  phone?: string | null;
}

interface TransferInfo {
  id: string;
  transfer_no: string;
  from_warehouse_name: string;
  to_warehouse_name: string;
  total_pieces: number;
  total_weight_kg: number;
}

export default function TransferDispatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<TransferInfo | null>(null);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shippingNo, setShippingNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNo, setPlateNo] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [detailRes, supplierRes] = await Promise.all([
          warehouseApi.getTransferDetail(id),
          systemApi.suppliers(),
        ]);
        const t = detailRes.data;
        setInfo({
          id: t.id, transfer_no: t.transfer_no,
          from_warehouse_name: t.from_warehouse_name || '-',
          to_warehouse_name: t.to_warehouse_name || '-',
          total_pieces: t.total_pieces || 0,
          total_weight_kg: t.total_weight_kg || 0,
        });
        const list = (supplierRes.data as SupplierOption[]) || [];
        setSuppliers(list.filter((s) => s.supplier_type === 'CARRIER' || s.supplier_type === 'TRUCKING'));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '请重试';
        Alert.alert('加载失败', msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async () => {
    if (!info) return;
    if (!supplierName.trim()) { Alert.alert('请选择物流/拖车公司'); return; }
    if (!driverName.trim() || !plateNo.trim()) { Alert.alert('请填写司机姓名和车牌号'); return; }

    setSubmitting(true);
    try {
      await warehouseApi.updateTransfer(info.id, {
        transferStatus: 'IN_TRANSIT',
        logisticsCompanyId: supplierId || undefined,
        logisticsCompany: supplierName,
        shippingNo: shippingNo || undefined,
        driverName,
        driverPhone: driverPhone || undefined,
        plateNo,
        trackPhone: trackPhone || undefined,
        trackUrl: trackUrl || undefined,
        remark: remark || undefined,
        dispatchTime: new Date().toISOString(),
      });
      Alert.alert('操作成功', '已发车', [{ text: '确定', onPress: () => safeBack(router) }]);
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
        <Text style={styles.navTitle}>执行发车</Text>
        <View style={styles.navBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : !info ? (
        <View style={styles.center}><Text style={styles.emptyText}>加载失败</Text></View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{info.transfer_no}</Text>
              <Text style={styles.infoLine}>{info.from_warehouse_name} → {info.to_warehouse_name}</Text>
              <Text style={styles.infoLine}>{info.total_pieces} 件 · {info.total_weight_kg} kg</Text>
            </View>

            <View style={styles.formItem}>
              <Text style={styles.formLabel}>物流/拖车公司 *</Text>
              <TouchableOpacity style={styles.select} onPress={() => setPickerOpen(true)}>
                <Text style={[styles.selectText, !supplierName && { color: colors.textTertiary }]}>
                  {supplierName || '请选择'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <Field label="送货单号" value={shippingNo} onChangeText={setShippingNo} placeholder="承运方的送货单号" />
            <Field label="司机姓名 *" value={driverName} onChangeText={setDriverName} placeholder="必填" />
            <Field label="司机电话" value={driverPhone} onChangeText={setDriverPhone} placeholder="选填" keyboardType="phone-pad" />
            <Field label="车牌号 *" value={plateNo} onChangeText={setPlateNo} placeholder="如：粤A88888" />
            <Field label="查询电话" value={trackPhone} onChangeText={setTrackPhone} placeholder="物流方的客服或跟踪电话" keyboardType="phone-pad" />
            <Field label="查询网址" value={trackUrl} onChangeText={setTrackUrl} placeholder="物流公司的跟踪网址" />
            <View style={styles.formItem}>
              <Text style={styles.formLabel}>备注</Text>
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
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>确认发车</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.mask} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>选择物流/拖车公司</Text>
            <ScrollView style={{ maxHeight: 400, marginTop: spacing.md }}>
              {suppliers.length === 0 ? (
                <Text style={styles.sheetEmpty}>暂无数据</Text>
              ) : (
                suppliers.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.supplierItem}
                    onPress={() => {
                      setSupplierId(s.id);
                      setSupplierName(s.name);
                      if (s.phone && !trackPhone) setTrackPhone(s.phone);
                      setPickerOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.supplierName}>{s.name}</Text>
                      <Text style={styles.supplierSub}>
                        {s.supplier_type === 'CARRIER' ? '物流公司' : s.supplier_type === 'TRUCKING' ? '拖车公司' : s.supplier_type}
                        {s.phone ? ` · ${s.phone}` : ''}
                      </Text>
                    </View>
                    {supplierId === s.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: FieldProps) {
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 40 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: '600', color: colors.text },
  content: { padding: spacing.md, paddingBottom: 40 },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.primary },
  infoTitle: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono, marginBottom: 4 },
  infoLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.card },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, backgroundColor: colors.card },
  selectText: { fontSize: font.md, color: colors.text },
  bottomBar: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.bg, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
  mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  sheetTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  sheetEmpty: { textAlign: 'center', color: colors.textTertiary, paddingVertical: spacing.lg },
  supplierItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  supplierName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  supplierSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
});
