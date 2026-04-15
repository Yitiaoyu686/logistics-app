import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { deliveryApi, orderApi, systemApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface SupplierOption {
  id: string;
  name: string;
  supplier_type: string;
  phone?: string | null;
}

type DpnStatus = 'DRAFT' | 'PENDING_BIND' | 'PENDING_DISPATCH' | 'IN_TRANSIT' | 'ARRIVED' | 'SIGNED' | 'CANCELLED';

const STATUS_META: Record<DpnStatus, { label: string; color: string; bg: string }> = {
  DRAFT:            { label: '草稿',     color: colors.textSecondary, bg: colors.borderLight },
  PENDING_BIND:     { label: '待绑定',   color: colors.warning,       bg: colors.warningLight },
  PENDING_DISPATCH: { label: '待发运',   color: colors.primary,       bg: colors.primaryLight },
  IN_TRANSIT:       { label: '运输中',   color: colors.info,          bg: colors.infoLight },
  ARRIVED:          { label: '已到达',   color: colors.success,       bg: colors.successLight },
  SIGNED:           { label: '已签收',   color: colors.success,       bg: colors.successLight },
  CANCELLED:        { label: '已取消',   color: colors.danger,        bg: colors.dangerLight },
};

type Mode = 'bind' | 'dispatch' | 'arrive' | 'receive';

interface SubOrderOption {
  id: string;
  sub_order_no: string;
  order_no: string;
  customer_name: string;
  pieces: number;
  actual_weight_kg: number;
  selected: boolean;
}

export default function DpnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    dpnId?: string; dpnNo?: string; dpnStatus?: DpnStatus;
    fromSite?: string; toSite?: string;
  }>();

  const initialMode: Mode = useMemo(() => {
    const s = params.dpnStatus || 'PENDING_BIND';
    if (s === 'PENDING_BIND') return 'bind';
    if (s === 'PENDING_DISPATCH') return 'dispatch';
    if (s === 'IN_TRANSIT') return 'arrive';
    if (s === 'ARRIVED') return 'receive';
    return 'bind';
  }, [params.dpnStatus]);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Bind mode
  const [subOrders, setSubOrders] = useState<SubOrderOption[]>([]);

  // Dispatch mode
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [plateNo, setPlateNo] = useState('');
  const [logisticsCompanyId, setLogisticsCompanyId] = useState('');
  const [logisticsCompany, setLogisticsCompany] = useState('');
  const [shippingNo, setShippingNo] = useState('');
  const [queryPhone, setQueryPhone] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [dispatchRemark, setDispatchRemark] = useState('');
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  // Arrive mode
  const [arrivalRemark, setArrivalRemark] = useState('');

  // Receive mode (scan-by-item)
  const [receiveItems, setReceiveItems] = useState<Array<{
    id: string;
    sub_order_no: string;
    tracking_no?: string;
    customer_name?: string;
    pieces?: number;
    inbound_status: 'PENDING' | 'RECEIVED';
  }>>([]);
  const [receiveScanInput, setReceiveScanInput] = useState('');

  useEffect(() => {
    if (mode === 'bind') loadAvailableSubOrders();
    if (mode === 'dispatch') loadSuppliers();
    if (mode === 'receive') loadReceiveItems();
  }, [mode]);

  const loadReceiveItems = async () => {
    if (!params.dpnId) return;
    try {
      const res = await deliveryApi.getDpnItems(params.dpnId as string);
      setReceiveItems(
        (res.data || []).map((it: any) => ({
          id: it.id,
          sub_order_no: it.sub_order_no || '-',
          tracking_no: it.tracking_no,
          customer_name: it.customer_name,
          pieces: it.pieces,
          inbound_status: it.inbound_status === 'RECEIVED' ? 'RECEIVED' : 'PENDING',
        })),
      );
    } catch {
      setReceiveItems([]);
    }
  };

  const handleReceiveScan = async () => {
    const code = receiveScanInput.trim();
    if (!code) { Alert.alert('请输入运单号'); return; }
    if (!params.dpnId) return;
    try {
      await deliveryApi.scanReceiveDpn(params.dpnId as string, { code, method: 'SCAN' });
      setReceiveScanInput('');
      loadReceiveItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '扫码失败';
      Alert.alert('未匹配', message);
    }
  };

  const handleMarkReceived = async (subOrderNo: string) => {
    if (!params.dpnId) return;
    try {
      await deliveryApi.scanReceiveDpn(params.dpnId as string, {
        code: subOrderNo,
        method: 'MANUAL',
      });
      loadReceiveItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '操作失败';
      Alert.alert('失败', message);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await systemApi.suppliers();
      const list = (res.data as SupplierOption[]) || [];
      setSuppliers(list.filter((s) => s.supplier_type === 'CARRIER' || s.supplier_type === 'TRUCKING'));
    } catch {
      setSuppliers([]);
    }
  };

  const loadAvailableSubOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.list({ status: 'ARRIVED' });
      const opts: SubOrderOption[] = [];
      for (const o of res.data || []) {
        opts.push({
          id: o.id,
          sub_order_no: o.order_no,
          order_no: o.order_no,
          customer_name: o.customer_name,
          pieces: o.total_declared_pieces || 0,
          actual_weight_kg: o.total_declared_weight_kg || 0,
          selected: false,
        });
      }
      setSubOrders(opts);
    } catch (err: any) {
      // Silently fail — list may be empty
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSubOrders((prev) => prev.map((s) => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  const selectedCount = useMemo(() => subOrders.filter((s) => s.selected).length, [subOrders]);

  const handleBind = async () => {
    if (selectedCount === 0) { Alert.alert('请至少选择一条运单'); return; }
    setSubmitting(true);
    try {
      if (params.dpnId) {
        const ids = subOrders.filter((s) => s.selected).map((s) => s.id);
        await deliveryApi.bindSubOrders(params.dpnId as string, ids);
      }
      Alert.alert('绑定成功', `已绑定 ${selectedCount} 条运单`, [
        { text: '确定', onPress: () => safeBack(router) },
      ]);
    } catch (err: any) {
      Alert.alert('绑定失败', err.message || '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async () => {
    if (!logisticsCompany.trim()) { Alert.alert('请选择物流/承运公司'); return; }
    if (!driverName.trim()) { Alert.alert('请填写司机姓名'); return; }
    if (!plateNo.trim()) { Alert.alert('请填写车牌号'); return; }

    setSubmitting(true);
    try {
      if (params.dpnId) {
        await deliveryApi.updateDpn(params.dpnId as string, {
          dpnStatus: 'IN_TRANSIT',
          logisticsCompanyId: logisticsCompanyId || undefined,
          logisticsCompany,
          shippingNo: shippingNo || undefined,
          queryPhone: queryPhone || undefined,
          trackUrl: trackUrl || undefined,
          driverName, driverPhone, plateNo,
          remark: dispatchRemark || undefined,
          dispatchTime: new Date().toISOString(),
        });
      }
      Alert.alert('发车成功', `${driverName} · ${plateNo}\n已进入运输中`, [
        { text: '确定', onPress: () => safeBack(router) },
      ]);
    } catch (err: any) {
      Alert.alert('发车失败', err.message || '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArrive = async () => {
    setSubmitting(true);
    try {
      if (params.dpnId) {
        await deliveryApi.updateDpn(params.dpnId as string, {
          dpnStatus: 'ARRIVED',
          arrivalTime: new Date().toISOString(),
          remark: arrivalRemark || undefined,
        });
      }
      Alert.alert('到达确认', '已标记为已到达', [
        { text: '确定', onPress: () => safeBack(router) },
      ]);
    } catch (err: any) {
      Alert.alert('提交失败', err.message || '请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceive = async () => {
    const pending = receiveItems.filter((i) => i.inbound_status === 'PENDING').length;
    if (pending > 0) {
      Alert.alert('还有未入库', `尚有 ${pending} 条运单未扫码入库，确定结束？`, [
        { text: '继续扫码', style: 'cancel' },
        { text: '强制结束', style: 'destructive', onPress: () => doFinalizeReceive() },
      ]);
      return;
    }
    doFinalizeReceive();
  };

  const doFinalizeReceive = async () => {
    setSubmitting(true);
    try {
      if (params.dpnId) {
        await deliveryApi.updateDpn(params.dpnId as string, {
          dpnStatus: 'INBOUND',
          remark: `入库确认完成 (${receiveItems.filter((i) => i.inbound_status === 'RECEIVED').length}/${receiveItems.length})`,
        });
      }
      Alert.alert('入库完成', '货物已入到达国仓库', [
        { text: '确定', onPress: () => safeBack(router) },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请重试';
      Alert.alert('提交失败', message);
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta = STATUS_META[(params.dpnStatus as DpnStatus) || 'PENDING_BIND'];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Nav */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>DPN 管理</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* DPN 信息 */}
          <View style={styles.dpnCard}>
            <View style={styles.dpnHeader}>
              <Text style={styles.dpnNo}>{params.dpnNo || '-'}</Text>
              <View style={[styles.dpnBadge, { backgroundColor: statusMeta.bg }]}>
                <Text style={[styles.dpnBadgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
              </View>
            </View>
            <View style={styles.dpnRoute}>
              <Text style={styles.dpnRouteText}>{params.fromSite || '-'}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} style={{ marginHorizontal: 8 }} />
              <Text style={styles.dpnRouteText}>{params.toSite || '-'}</Text>
            </View>
          </View>

          {/* Mode Switch (available modes based on status) */}
          <View style={styles.modeRow}>
            {[
              { v: 'bind' as Mode,     label: '绑运单', icon: 'link' },
              { v: 'dispatch' as Mode, label: '发车',   icon: 'car' },
              { v: 'arrive' as Mode,   label: '到达',   icon: 'flag' },
              { v: 'receive' as Mode,  label: '入库',   icon: 'archive' },
            ].map((m) => (
              <TouchableOpacity
                key={m.v}
                style={[styles.modeBtn, mode === m.v && styles.modeBtnActive]}
                onPress={() => setMode(m.v)}
              >
                <Ionicons name={m.icon as any} size={16} color={mode === m.v ? '#fff' : colors.textSecondary} />
                <Text style={[styles.modeText, mode === m.v && styles.modeTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bind Mode */}
          {mode === 'bind' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🔗 选择要绑定的运单</Text>
                {selectedCount > 0 && (
                  <Text style={styles.selectedCount}>已选 {selectedCount}</Text>
                )}
              </View>
              {loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : subOrders.length === 0 ? (
                <Text style={styles.empty}>暂无可绑定运单</Text>
              ) : (
                subOrders.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.subCard, s.selected && styles.subCardSelected]}
                    onPress={() => toggleSelect(s.id)}
                  >
                    <View style={styles.checkBox}>
                      {s.selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subNo}>{s.sub_order_no}</Text>
                      <Text style={styles.subInfo}>{s.customer_name} · {s.pieces}件 · {s.actual_weight_kg}kg</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Dispatch Mode */}
          {mode === 'dispatch' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🚚 执行发车</Text>
              <View style={styles.formItem}>
                <Text style={styles.formLabel}>物流 / 承运公司 *</Text>
                <TouchableOpacity style={styles.selectField} onPress={() => setSupplierPickerOpen(true)}>
                  <Text style={[styles.selectText, !logisticsCompany && { color: colors.textTertiary }]}>
                    {logisticsCompany || '请选择'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
              <FormField label="送货单号" value={shippingNo} onChangeText={setShippingNo} placeholder="承运方的送货单号" />
              <FormField label="司机姓名 *" value={driverName} onChangeText={setDriverName} placeholder="请输入" />
              <FormField label="司机电话" value={driverPhone} onChangeText={setDriverPhone} placeholder="如：+234..." keyboardType="phone-pad" />
              <FormField label="车牌号 *" value={plateNo} onChangeText={setPlateNo} placeholder="如：LAG-1234" />
              <FormField label="查询电话" value={queryPhone} onChangeText={setQueryPhone} placeholder="物流方客服电话" keyboardType="phone-pad" />
              <FormField label="查询网址" value={trackUrl} onChangeText={setTrackUrl} placeholder="物流公司的跟踪网址" />
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
              <View style={styles.tipCard}>
                <Ionicons name="information-circle" size={18} color={colors.info} />
                <Text style={styles.tipText}>发车后 DPN 状态变更为"运输中"，并自动记录发车时间</Text>
              </View>
            </View>
          )}

          {/* Arrive Mode */}
          {mode === 'arrive' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🚩 确认到达</Text>
              <Text style={styles.hint}>司机已抵达目的站点，确认后进入待入库</Text>
              <View style={styles.arriveCard}>
                <Ionicons name="location" size={32} color={colors.success} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.arriveSite}>{params.toSite || '-'}</Text>
                  <Text style={styles.arriveTime}>{new Date().toLocaleString('zh-CN')}</Text>
                </View>
              </View>
              <TextInput
                style={styles.textarea}
                value={arrivalRemark}
                onChangeText={setArrivalRemark}
                placeholder="到达备注（可选）"
                placeholderTextColor={colors.textTertiary}
                multiline
              />
            </View>
          )}

          {/* Receive Mode — 扫码逐件 */}
          {mode === 'receive' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📦 扫码入库</Text>
                <Text style={styles.selectedCount}>
                  {receiveItems.filter((i) => i.inbound_status === 'RECEIVED').length}/{receiveItems.length}
                </Text>
              </View>

              {/* 扫码输入 */}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 48, gap: spacing.sm }}>
                  <Ionicons name="scan" size={20} color={colors.primary} />
                  <TextInput
                    style={{ flex: 1, fontSize: font.md, color: colors.text, fontFamily: font.mono }}
                    value={receiveScanInput}
                    onChangeText={setReceiveScanInput}
                    placeholder="扫描或输入运单号"
                    placeholderTextColor={colors.textTertiary}
                    onSubmitEditing={handleReceiveScan}
                    returnKeyType="done"
                  />
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}
                  onPress={handleReceiveScan}
                >
                  <Text style={{ color: '#fff', fontSize: font.md, fontWeight: '600' }}>入库</Text>
                </TouchableOpacity>
              </View>

              {receiveItems.length === 0 ? (
                <Text style={styles.empty}>该 DPN 未绑定运单</Text>
              ) : (
                receiveItems.map((it) => (
                  <View
                    key={it.id}
                    style={[
                      styles.subCard,
                      it.inbound_status === 'RECEIVED' && { borderColor: colors.success, backgroundColor: colors.successLight },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkBox,
                        {
                          backgroundColor: it.inbound_status === 'RECEIVED' ? colors.success : colors.card,
                          borderColor: it.inbound_status === 'RECEIVED' ? colors.success : colors.border,
                        },
                      ]}
                    >
                      {it.inbound_status === 'RECEIVED' && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subNo}>{it.sub_order_no}</Text>
                      <Text style={styles.subInfo}>{it.customer_name || '-'} · {it.pieces || 0}件</Text>
                    </View>
                    {it.inbound_status === 'PENDING' && (
                      <TouchableOpacity
                        style={{
                          paddingHorizontal: spacing.md,
                          paddingVertical: 6,
                          borderWidth: 1,
                          borderColor: colors.primary,
                          borderRadius: radius.sm,
                        }}
                        onPress={() => handleMarkReceived(it.sub_order_no)}
                      >
                        <Text style={{ fontSize: font.xs, color: colors.primary, fontWeight: '600' }}>手动入库</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>

        {/* Bottom */}
        <View style={styles.bottomBar}>
          {mode === 'bind' && (
            <TouchableOpacity
              style={[styles.btnPrimary, (submitting || selectedCount === 0) && styles.btnDisabled]}
              onPress={handleBind}
              disabled={submitting || selectedCount === 0}
            >
              <Text style={styles.btnText}>{submitting ? '提交中...' : `绑定 ${selectedCount} 条运单`}</Text>
            </TouchableOpacity>
          )}
          {mode === 'dispatch' && (
            <TouchableOpacity
              style={[styles.btnPrimary, submitting && styles.btnDisabled]}
              onPress={handleDispatch}
              disabled={submitting}
            >
              <Ionicons name="car" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.btnText}>{submitting ? '发车中...' : '确认发车'}</Text>
            </TouchableOpacity>
          )}
          {mode === 'arrive' && (
            <TouchableOpacity
              style={[styles.btnSuccess, submitting && styles.btnDisabled]}
              onPress={handleArrive}
              disabled={submitting}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.btnText}>{submitting ? '提交中...' : '确认到达'}</Text>
            </TouchableOpacity>
          )}
          {mode === 'receive' && (
            <TouchableOpacity
              style={[styles.btnSuccess, submitting && styles.btnDisabled]}
              onPress={handleReceive}
              disabled={submitting}
            >
              <Ionicons name="archive" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.btnText}>{submitting ? '提交中...' : '确认入库'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 承运方选择 */}
        <Modal
          visible={supplierPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setSupplierPickerOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => setSupplierPickerOpen(false)}
          >
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>选择物流 / 承运公司</Text>
              <ScrollView style={{ maxHeight: 400 }}>
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
                        setLogisticsCompanyId(s.id);
                        setLogisticsCompany(s.name);
                        if (s.phone && !queryPhone) setQueryPhone(s.phone);
                        setSupplierPickerOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.supplierName}>{s.name}</Text>
                        <Text style={styles.supplierSub}>
                          {s.supplier_type === 'CARRIER' ? '物流公司' : '拖车公司'}
                          {s.phone ? ` · ${s.phone}` : ''}
                        </Text>
                      </View>
                      {logisticsCompanyId === s.id && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string; keyboardType?: any;
}) {
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
  scroll: { padding: spacing.md, paddingBottom: 120 },

  // DPN card
  dpnCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.taskDispatch },
  dpnHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  dpnNo: { fontSize: font.lg, fontWeight: '700', color: colors.primary, fontFamily: font.mono },
  dpnBadge: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.sm },
  dpnBadgeText: { fontSize: font.xs, fontWeight: '600' },
  dpnRoute: { flexDirection: 'row', alignItems: 'center' },
  dpnRouteText: { fontSize: font.sm, color: colors.text, fontWeight: '500' },

  // Mode
  modeRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 4, marginBottom: spacing.md, gap: 4 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm, borderRadius: radius.sm },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { fontSize: font.xs, color: colors.textSecondary },
  modeTextActive: { color: '#fff', fontWeight: '600' },

  // Section
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  selectedCount: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  empty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },
  hint: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.md },

  // Sub-order list
  subCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, marginBottom: spacing.sm },
  subCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  checkBox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  subNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '600', color: colors.primary },
  subInfo: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  // Form
  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  textarea: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.md, color: colors.text, minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.card },

  // Tip
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  tipText: { flex: 1, fontSize: font.xs, color: colors.info },
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningLight, padding: spacing.md, borderRadius: radius.md },
  warningText: { flex: 1, fontSize: font.xs, color: colors.warning },

  // Arrive
  arriveCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.successLight, borderRadius: radius.md, marginBottom: spacing.md },
  arriveSite: { fontSize: font.md, fontWeight: '600', color: colors.text },
  arriveTime: { fontSize: font.xs, color: colors.textSecondary, marginTop: 4 },

  // Bottom
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  btnPrimary: { flexDirection: 'row', height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnSuccess: { flexDirection: 'row', height: 52, backgroundColor: colors.success, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.5 },

  // Select & Modal
  selectField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, backgroundColor: colors.card },
  selectText: { fontSize: font.md, color: colors.text },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  supplierItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  supplierName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  supplierSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
});
