import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../lib/theme';
import { warehouseApi, systemApi } from '../lib/api';

export type TransferActionMode = 'dispatch' | 'arrive' | 'receive';

export interface TransferTargetItem {
  id: string;
  transfer_no: string;
  from_warehouse_name: string;
  to_warehouse_name: string;
  total_pieces: number;
  total_weight_kg: number;
}

interface TransferActionDialogProps {
  visible: boolean;
  target: TransferTargetItem | null;
  mode: TransferActionMode | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface SupplierOption {
  id: string;
  name: string;
  supplier_type: string;
  phone?: string | null;
}

export function TransferActionDialog({ visible, target, mode, onClose, onSuccess }: TransferActionDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  // Dispatch fields
  const [supplierId, setSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [shippingNo, setShippingNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNo, setPlateNo] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [dispatchRemark, setDispatchRemark] = useState('');

  const [arrivalRemark, setArrivalRemark] = useState('');

  useEffect(() => {
    if (!visible || mode !== 'dispatch') return;
    (async () => {
      try {
        const res = await systemApi.suppliers();
        const list = (res.data as SupplierOption[]) || [];
        // 发车场景：显示物流公司(CARRIER)+拖车公司(TRUCKING)
        setSuppliers(list.filter((s) => s.supplier_type === 'CARRIER' || s.supplier_type === 'TRUCKING'));
      } catch {
        setSuppliers([]);
      }
    })();
  }, [visible, mode]);

  const reset = () => {
    setSupplierId(''); setSupplierName('');
    setShippingNo(''); setDriverName(''); setDriverPhone('');
    setPlateNo(''); setTrackPhone(''); setTrackUrl('');
    setDispatchRemark(''); setArrivalRemark('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!target || !mode) return;

    if (mode === 'dispatch') {
      if (!supplierName.trim()) { Alert.alert('请选择物流/拖车公司'); return; }
      if (!driverName.trim() || !plateNo.trim()) { Alert.alert('请填写司机姓名和车牌号'); return; }
    }

    setSubmitting(true);
    try {
      const update: Record<string, unknown> = {};
      if (mode === 'dispatch') {
        update.transferStatus = 'IN_TRANSIT';
        update.logisticsCompanyId = supplierId || undefined;
        update.logisticsCompany = supplierName;
        update.shippingNo = shippingNo || undefined;
        update.driverName = driverName;
        update.driverPhone = driverPhone || undefined;
        update.plateNo = plateNo;
        update.trackPhone = trackPhone || undefined;
        update.trackUrl = trackUrl || undefined;
        update.remark = dispatchRemark || undefined;
        update.dispatchTime = new Date().toISOString();
      } else if (mode === 'arrive') {
        update.transferStatus = 'ARRIVED';
        update.arrivalTime = new Date().toISOString();
        update.remark = arrivalRemark || undefined;
      } else if (mode === 'receive') {
        update.transferStatus = 'RECEIVED';
        update.receiveTime = new Date().toISOString();
      }

      await warehouseApi.updateTransfer(target.id, update);
      Alert.alert(
        '操作成功',
        mode === 'dispatch' ? '已发车' : mode === 'arrive' ? '已确认到达' : '已确认入库',
        [{ text: '确定', onPress: () => { reset(); onSuccess(); } }]
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请重试';
      Alert.alert('操作失败', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.mask}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {mode === 'dispatch' && '🚚 执行发车'}
                {mode === 'arrive' && '🚩 确认到达'}
                {mode === 'receive' && '📦 确认入库'}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {target && (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>{target.transfer_no}</Text>
                  <Text style={styles.infoLine}>{target.from_warehouse_name} → {target.to_warehouse_name}</Text>
                  <Text style={styles.infoLine}>{target.total_pieces} 件 · {target.total_weight_kg} kg</Text>
                </View>

                {mode === 'dispatch' && (
                  <>
                    <View style={styles.formItem}>
                      <Text style={styles.formLabel}>物流/拖车公司 *</Text>
                      <TouchableOpacity style={styles.select} onPress={() => setSupplierPickerOpen(true)}>
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
                        value={dispatchRemark}
                        onChangeText={setDispatchRemark}
                        placeholder="可选"
                        placeholderTextColor={colors.textTertiary}
                        multiline
                      />
                    </View>
                  </>
                )}

                {mode === 'arrive' && (
                  <>
                    <View style={styles.tipCard}>
                      <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                      <Text style={styles.tipText}>司机已抵达目标仓库，确认后调拨单状态变为"已到达"</Text>
                    </View>
                    <View style={styles.formItem}>
                      <Text style={styles.formLabel}>到达备注</Text>
                      <TextInput
                        style={styles.textarea}
                        value={arrivalRemark}
                        onChangeText={setArrivalRemark}
                        placeholder="可选"
                        placeholderTextColor={colors.textTertiary}
                        multiline
                      />
                    </View>
                  </>
                )}

                {mode === 'receive' && (
                  <View style={styles.tipCard}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                    <Text style={styles.tipText}>确认所有货物已收到入库，调拨单完成</Text>
                  </View>
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'dispatch' && '确认发车'}
                  {mode === 'arrive' && '确认到达'}
                  {mode === 'receive' && '确认入库'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 供应商选择 */}
        <Modal
          visible={supplierPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setSupplierPickerOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.mask}
            onPress={() => setSupplierPickerOpen(false)}
          >
            <View style={styles.sheet}>
              <Text style={styles.title}>选择物流/拖车公司</Text>
              <ScrollView style={{ maxHeight: 400, marginTop: spacing.md }}>
                {suppliers.length === 0 ? (
                  <Text style={{ textAlign: 'center', color: colors.textTertiary, paddingVertical: spacing.lg }}>
                    暂无数据
                  </Text>
                ) : (
                  suppliers.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.supplierItem}
                      onPress={() => {
                        setSupplierId(s.id);
                        setSupplierName(s.name);
                        if (s.phone && !trackPhone) setTrackPhone(s.phone);
                        setSupplierPickerOpen(false);
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'decimal-pad';
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
  mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  infoTitle: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono, marginBottom: 4 },
  infoLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.card },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, backgroundColor: colors.card },
  selectText: { fontSize: font.md, color: colors.text },
  supplierItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  supplierName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  supplierSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info },
  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
});
