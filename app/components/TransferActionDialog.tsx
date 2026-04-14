import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../lib/theme';
import { warehouseApi } from '../lib/api';

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

export function TransferActionDialog({ visible, target, mode, onClose, onSuccess }: TransferActionDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [logisticsCompany, setLogisticsCompany] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNo, setPlateNo] = useState('');
  const [arrivalRemark, setArrivalRemark] = useState('');

  const reset = () => {
    setLogisticsCompany('');
    setTrackingNo('');
    setDriverName('');
    setDriverPhone('');
    setPlateNo('');
    setArrivalRemark('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!target || !mode) return;

    if (mode === 'dispatch') {
      if (!driverName.trim() || !plateNo.trim()) {
        Alert.alert('请填写司机姓名和车牌号');
        return;
      }
    }

    setSubmitting(true);
    try {
      const update: any = {};
      if (mode === 'dispatch') {
        update.transferStatus = 'IN_TRANSIT';
        update.logisticsCompany = logisticsCompany || undefined;
        update.trackingNo = trackingNo || undefined;
        update.driverName = driverName;
        update.driverPhone = driverPhone || undefined;
        update.plateNo = plateNo;
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
    } catch (err: any) {
      Alert.alert('操作失败', err.message || '请重试');
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
                    <Field label="承运公司" value={logisticsCompany} onChangeText={setLogisticsCompany} placeholder="选填" />
                    <Field label="送货单号" value={trackingNo} onChangeText={setTrackingNo} placeholder="选填" />
                    <Field label="司机姓名 *" value={driverName} onChangeText={setDriverName} placeholder="必填" />
                    <Field label="司机电话" value={driverPhone} onChangeText={setDriverPhone} placeholder="选填" keyboardType="phone-pad" />
                    <Field label="车牌号 *" value={plateNo} onChangeText={setPlateNo} placeholder="如：粤A88888" />
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
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info },
  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
});
