import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, FlatList, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

const WAREHOUSE_OPTIONS = [
  '广州总仓', '海珠区站点', '白云一号区', '佛山拼货区', '深圳集货区', '番禺转运区',
];

const REASON_OPTIONS = [
  '集中发货', '卫星仓回仓', '总仓分拨', '库存调整', '紧急补货', '整箱直发', '其他',
];

type ShippingMethod = 'VIA_MAIN' | 'DIRECT';

const inferDirection = (from: string, to: string) => {
  const mainKeywords = ['总仓'];
  return mainKeywords.some((k) => to.includes(k)) ? 'SATELLITE_TO_MAIN' : 'MAIN_TO_SATELLITE';
};

export default function TransferCreateScreen() {
  const router = useRouter();

  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [routeName, setRouteName] = useState('');
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().split('T')[0]);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('VIA_MAIN');
  const [containerNo, setContainerNo] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<'from' | 'to' | 'reason'>('from');

  const pickerTitle = pickerField === 'from' ? '选择源仓库' : pickerField === 'to' ? '选择目标仓库' : '选择调拨原因';
  const pickerOptions = pickerField === 'reason' ? REASON_OPTIONS : WAREHOUSE_OPTIONS;
  const pickerValue = pickerField === 'from' ? fromWarehouse : pickerField === 'to' ? toWarehouse : reason;

  const openPicker = (field: 'from' | 'to' | 'reason') => {
    setPickerField(field);
    setPickerVisible(true);
  };

  const handlePickerSelect = (value: string) => {
    if (pickerField === 'from') setFromWarehouse(value);
    else if (pickerField === 'to') setToWarehouse(value);
    else setReason(value);
    setPickerVisible(false);
  };

  const validationError = !fromWarehouse
    ? '请选择源仓库'
    : !toWarehouse
    ? '请选择目标仓库'
    : fromWarehouse === toWarehouse
    ? '源仓库和目标仓库不能相同'
    : !reason
    ? '请选择调拨原因'
    : null;

  const handleSubmit = async () => {
    if (validationError) return;
    setSubmitting(true);
    try {
      const route = routeName.trim() || `${fromWarehouse}→${toWarehouse}`;
      const meta = JSON.stringify({
        shippingMethod,
        reason,
        executeDate: plannedDate,
        containerNo: containerNo.trim() || undefined,
      });

      await warehouseApi.createTransfer({
        businessLine: 'SEA',
        direction: inferDirection(fromWarehouse, toWarehouse),
        fromWarehouseName: fromWarehouse,
        toWarehouseName: toWarehouse,
        routeLabel: route,
        totalPieces: 0,
        totalWeightKg: 0,
        remark: [meta, remark.trim()].filter(Boolean).join('\n---\n'),
      });

      const msg = '调拨单已创建，请前往调拨管理绑定运单';
      const finish = () => router.replace('/task/transfer' as any);

      if (Platform.OS === 'web') {
        window.alert(msg);
        finish();
      } else {
        Alert.alert('创建成功', msg, [{ text: '去绑定', onPress: finish }]);
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
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>创建调拨单</Text>
        <View style={styles.navBtn} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form}>
          {/* 源仓库 */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>源仓库 <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.select} onPress={() => openPicker('from')}>
                <Text style={fromWarehouse ? styles.selectValue : styles.selectPlaceholder}>
                  {fromWarehouse || '请选择'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>目标仓库 <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity style={styles.select} onPress={() => openPicker('to')}>
                <Text style={toWarehouse ? styles.selectValue : styles.selectPlaceholder}>
                  {toWarehouse || '请选择'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 线路名称 + 计划日期 */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.label}>线路名称</Text>
              <TextInput
                style={styles.input}
                value={routeName}
                onChangeText={setRouteName}
                placeholder="不填自动生成"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>计划执行日期</Text>
              <TextInput
                style={styles.input}
                value={plannedDate}
                onChangeText={setPlannedDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>

          {/* 运输方式 */}
          <View style={styles.field}>
            <Text style={styles.label}>运输方式</Text>
            <View style={styles.radioRow}>
              <TouchableOpacity style={styles.radioItem} onPress={() => setShippingMethod('VIA_MAIN')}>
                <View style={[styles.radioOuter, shippingMethod === 'VIA_MAIN' && styles.radioOuterActive]}>
                  {shippingMethod === 'VIA_MAIN' && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioLabel}>先送总仓</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.radioItem} onPress={() => setShippingMethod('DIRECT')}>
                <View style={[styles.radioOuter, shippingMethod === 'DIRECT' && styles.radioOuterActive]}>
                  {shippingMethod === 'DIRECT' && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioLabel}>直接发运</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 装箱号 */}
          <View style={styles.field}>
            <Text style={styles.label}>装箱号</Text>
            <TextInput
              style={styles.input}
              value={containerNo}
              onChangeText={setContainerNo}
              placeholder="如果已装箱，请输入装箱号（可选）"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          {/* 调拨原因 */}
          <View style={styles.field}>
            <Text style={styles.label}>调拨原因 <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.select} onPress={() => openPicker('reason')}>
              <Text style={reason ? styles.selectValue : styles.selectPlaceholder}>
                {reason || '请选择'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* 备注 */}
          <View style={styles.field}>
            <Text style={styles.label}>备注</Text>
            <TextInput
              style={styles.textarea}
              value={remark}
              onChangeText={(t) => t.length <= 300 && setRemark(t)}
              placeholder="补充这次调拨的说明"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
            <Text style={styles.charCount}>{remark.length} / 300</Text>
          </View>

          {/* 提示信息 */}
          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={16} color={colors.info} />
            <Text style={styles.tipText}>
              物流公司、车牌、司机姓名电话、实际发运时间等信息在点击"执行"时填写，本表单无需重复录入。创建成功后自动进入"绑定运单"环节。
            </Text>
          </View>
        </ScrollView>

        {/* 底部按钮 */}
        <View style={styles.footer}>
          {validationError && (
            <View style={styles.hintBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
              <Text style={styles.hintText}>{validationError}</Text>
            </View>
          )}
          <View style={styles.footerBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => safeBack(router)}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || !!validationError) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !!validationError}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>创建并去绑定</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.pickerMask} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={pickerOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const active = item === pickerValue;
                return (
                  <TouchableOpacity
                    style={[styles.pickerOption, active && styles.pickerOptionActive]}
                    onPress={() => handlePickerSelect(item)}
                  >
                    <Text style={[styles.pickerOptionText, active && styles.pickerOptionTextActive]}>{item}</Text>
                    {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 36 },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  form: { padding: spacing.lg, paddingBottom: 120 },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  halfField: { flex: 1 },
  field: { marginBottom: spacing.md },
  label: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  required: { color: colors.danger },

  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 80, textAlignVertical: 'top', backgroundColor: colors.card },
  charCount: { textAlign: 'right', fontSize: font.xs, color: colors.textTertiary, marginTop: 4 },

  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, backgroundColor: colors.card },
  selectValue: { fontSize: font.md, color: colors.text },
  selectPlaceholder: { fontSize: font.md, color: colors.textTertiary },

  radioRow: { flexDirection: 'row', gap: spacing.xl },
  radioItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  radioLabel: { fontSize: font.md, color: colors.text },

  tipCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: radius.md },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info, lineHeight: 18 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.bg, borderTopWidth: 0.5, borderTopColor: colors.borderLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingBottom: spacing.xl },
  footerBtns: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, height: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  cancelBtnText: { fontSize: font.md, fontWeight: '600', color: colors.textSecondary },
  submitBtn: { flex: 2, height: 48, backgroundColor: colors.primary, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  submitBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  hintBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginBottom: spacing.sm },
  hintText: { flex: 1, fontSize: font.xs, color: colors.warning, fontWeight: '500' },

  pickerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '60%' },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  pickerTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  pickerOptionActive: { backgroundColor: colors.primaryLight },
  pickerOptionText: { fontSize: font.md, color: colors.text },
  pickerOptionTextActive: { color: colors.primary, fontWeight: '600' },
});
