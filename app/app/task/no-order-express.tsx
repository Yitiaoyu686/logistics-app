import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { warehouseApi, customerApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface UnmatchedPackage {
  id: string;
  business_line: string;
  warehouse_id: string;
  tracking_no: string;
  express_company: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  pieces: number;
  gross_weight_kg: number;
  customer_hint: string | null;
  goods_name: string | null;
  location_code: string | null;
  status: 'PENDING' | 'MATCHED' | 'CANCELLED';
  remark: string | null;
  created_at: string;
}

interface CustomerOption {
  id: string;
  customerCode: string;
  customerName: string;
  contactPhone: string;
}

const STATUS_FILTERS = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待匹配' },
  { value: 'MATCHED', label: '已匹配' },
];

const EXPRESS_COMPANIES = ['顺丰', '韵达', '圆通', '中通', '申通', '京东', '邮政', '德邦'];

export default function NoOrderExpressScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; action?: string }>();
  const [list, setList] = useState<UnmatchedPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');

  // 创建 modal
  const [createVisible, setCreateVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trackingNo, setTrackingNo] = useState('');
  const [expressCompany, setExpressCompany] = useState('顺丰');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [pieces, setPieces] = useState('1');
  const [weight, setWeight] = useState('');
  const [customerHint, setCustomerHint] = useState('');

  // 匹配 modal
  const [matchTarget, setMatchTarget] = useState<UnmatchedPackage | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [matchKeyword, setMatchKeyword] = useState('');
  const [matching, setMatching] = useState(false);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  // 从任务流跳进来：直接打开匹配弹窗
  useEffect(() => {
    if (params.id && params.action === 'match' && list.length > 0) {
      const target = list.find((u) => u.id === params.id);
      if (target) openMatch(target);
    }
  }, [params.id, params.action, list]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await warehouseApi.getUnmatched();
      setList(res.data || []);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    let result = list;
    if (filter !== 'ALL') {
      result = result.filter((u) => u.status === filter);
    }
    if (keyword) {
      const k = keyword.toLowerCase();
      result = result.filter((u) =>
        u.tracking_no?.toLowerCase().includes(k) ||
        u.sender_name?.toLowerCase().includes(k) ||
        u.sender_phone?.includes(k)
      );
    }
    return result;
  }, [list, filter, keyword]);

  const createHint = !trackingNo.trim()
    ? '请填写快递单号'
    : !expressCompany ? '请选择快递公司'
    : null;

  const handleCreate = async () => {
    if (createHint) return;
    setSubmitting(true);
    try {
      await warehouseApi.createUnmatched({
        businessLine: 'SEA',
        warehouseId: 'wh-gz',
        trackingNo,
        expressCompany,
        senderName: senderName || undefined,
        senderPhone: senderPhone || undefined,
        pieces: Number(pieces) || 1,
        grossWeightKg: Number(weight) || 0,
        customerHint: customerHint || undefined,
      });
      const finish = () => { setCreateVisible(false); resetCreateForm(); load(); };
      if (Platform.OS === 'web') {
        window.alert(`${trackingNo} 已加入待匹配队列`);
        finish();
      } else {
        Alert.alert('登记成功', `${trackingNo} 已加入待匹配队列`, [
          { text: '确定', onPress: finish },
        ]);
      }
    } catch (err: any) {
      const msg = err?.message || '请重试';
      if (Platform.OS === 'web') window.alert(`登记失败：${msg}`);
      else Alert.alert('登记失败', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setTrackingNo(''); setExpressCompany('顺丰'); setSenderName(''); setSenderPhone('');
    setPieces('1'); setWeight(''); setCustomerHint('');
  };

  const openMatch = async (item: UnmatchedPackage) => {
    setMatchTarget(item);
    setMatchKeyword('');
    try {
      const res = await customerApi.list({ poolType: 'PRIVATE' });
      setCustomers(res.data || []);
    } catch {}
  };

  const filteredCustomers = useMemo(() => {
    if (!matchKeyword) return customers;
    const k = matchKeyword.toLowerCase();
    return customers.filter((c) =>
      c.customerName?.toLowerCase().includes(k) ||
      c.customerCode?.toLowerCase().includes(k) ||
      c.contactPhone?.includes(k)
    );
  }, [customers, matchKeyword]);

  const handleMatchTo = async (cust: CustomerOption) => {
    if (!matchTarget) return;
    setMatching(true);
    try {
      await warehouseApi.matchUnmatched(matchTarget.id, {
        customerId: cust.id,
        customerName: cust.customerName,
      });
      const finish = () => { setMatchTarget(null); load(); };
      if (Platform.OS === 'web') {
        window.alert(`${matchTarget.tracking_no} 已关联到 ${cust.customerName}`);
        finish();
      } else {
        Alert.alert('匹配成功', `${matchTarget.tracking_no} 已关联到 ${cust.customerName}`, [
          { text: '确定', onPress: finish },
        ]);
      }
    } catch (err: any) {
      const msg = err?.message || '请重试';
      if (Platform.OS === 'web') window.alert(`匹配失败：${msg}`);
      else Alert.alert('匹配失败', msg);
    } finally {
      setMatching(false);
    }
  };

  const renderItem = ({ item }: { item: UnmatchedPackage }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.trackingNo}>{item.tracking_no}</Text>
        <View style={[styles.statusBadge, item.status === 'PENDING' ? styles.statusPending : styles.statusMatched]}>
          <Text style={[styles.statusText, item.status === 'PENDING' ? { color: colors.warning } : { color: colors.success }]}>
            {item.status === 'PENDING' ? '待匹配' : '已匹配'}
          </Text>
        </View>
      </View>
      <Text style={styles.detailLine}>{item.express_company || '-'} · {item.pieces} 件 · {item.gross_weight_kg} kg</Text>
      <Text style={styles.detailLine}>
        发件人：{item.sender_name || '-'} {item.sender_phone || ''}
      </Text>
      {item.customer_hint && (
        <Text style={styles.hintLine}>客户提示：{item.customer_hint}</Text>
      )}
      {item.status === 'PENDING' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => openMatch(item)}
          >
            <Ionicons name="link" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>匹配订单</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>无订单快递</Text>
        <TouchableOpacity onPress={() => setCreateVisible(true)} style={styles.navBtn}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索快递单号 / 发件人"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
        </View>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <TouchableOpacity key={f.value} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(f.value)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="help-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无无单快递</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}

      {/* Create Modal */}
      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalMask}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>登记无单快递</Text>
                <TouchableOpacity onPress={() => setCreateVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
                <FormField label="快递单号 *" value={trackingNo} onChangeText={setTrackingNo} placeholder="必填" />
                <Text style={styles.formLabel}>快递公司</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
                  {EXPRESS_COMPANIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, expressCompany === c && styles.chipActive]}
                      onPress={() => setExpressCompany(c)}
                    >
                      <Text style={[styles.chipText, expressCompany === c && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <FormField label="发件人姓名" value={senderName} onChangeText={setSenderName} placeholder="选填" />
                <FormField label="发件人电话" value={senderPhone} onChangeText={setSenderPhone} placeholder="选填" keyboardType="phone-pad" />
                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <FormField label="件数" value={pieces} onChangeText={setPieces} placeholder="1" keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FormField label="重量(kg)" value={weight} onChangeText={setWeight} placeholder="0" keyboardType="decimal-pad" />
                  </View>
                </View>
                <FormField label="客户提示" value={customerHint} onChangeText={setCustomerHint} placeholder="如：可能是XXX的货" />
              </ScrollView>

              {createHint && (
                <View style={styles.hintBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                  <Text style={styles.hintText}>{createHint}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.submitBtn, (submitting || !!createHint) && styles.btnDisabled]}
                onPress={handleCreate}
                disabled={submitting || !!createHint}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>{createHint || '登记'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Match Modal */}
      <Modal visible={!!matchTarget} transparent animationType="slide" onRequestClose={() => setMatchTarget(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>匹配到客户</Text>
              <TouchableOpacity onPress={() => setMatchTarget(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {matchTarget && (
              <>
                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>{matchTarget.tracking_no}</Text>
                  <Text style={styles.infoLine}>{matchTarget.express_company || '-'} · {matchTarget.pieces}件 · {matchTarget.gross_weight_kg}kg</Text>
                  <Text style={styles.infoLine}>发件人：{matchTarget.sender_name || '-'}</Text>
                  {matchTarget.customer_hint && (
                    <Text style={styles.hintInModal}>{matchTarget.customer_hint}</Text>
                  )}
                </View>

                <View style={styles.searchInputWrap}>
                  <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="搜索客户名/编号/电话"
                    placeholderTextColor={colors.textTertiary}
                    value={matchKeyword}
                    onChangeText={setMatchKeyword}
                  />
                </View>

                <ScrollView style={{ maxHeight: 400, marginTop: spacing.md }}>
                  {filteredCustomers.length === 0 ? (
                    <Text style={styles.emptyText}>无匹配客户</Text>
                  ) : (
                    filteredCustomers.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.custOption}
                        onPress={() => handleMatchTo(c)}
                        disabled={matching}
                      >
                        <View style={styles.custAvatar}>
                          <Text style={styles.custAvatarText}>{c.customerName?.[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.custName}>{c.customerName}</Text>
                          <Text style={styles.custCode}>{c.customerCode} · {c.contactPhone}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'numeric' | 'decimal-pad';
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: FormFieldProps) {
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyText: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },

  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  filterRow: { paddingVertical: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  listContent: { padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.warning },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  trackingNo: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusPending: { backgroundColor: colors.warningLight },
  statusMatched: { backgroundColor: colors.successLight },
  statusText: { fontSize: font.xs, fontWeight: '600' },
  detailLine: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  hintLine: { fontSize: font.xs, color: colors.warning, marginTop: 4, fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  actionBtnPrimary: { backgroundColor: colors.primary },
  actionBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },

  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },

  formItem: { marginBottom: spacing.md },
  formLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, fontSize: font.md, color: colors.text, backgroundColor: colors.card },
  row2: { flexDirection: 'row', gap: spacing.md },

  submitBtn: { height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  submitBtnText: { color: '#fff', fontSize: font.lg, fontWeight: '600', letterSpacing: 2 },
  btnDisabled: { opacity: 0.6 },
  hintBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.warningLight, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm },
  hintText: { flex: 1, fontSize: font.xs, color: colors.warning, fontWeight: '500' },

  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.warning },
  infoTitle: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono, marginBottom: 4 },
  infoLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  hintInModal: { fontSize: font.xs, color: colors.warning, marginTop: 4, fontStyle: 'italic' },

  custOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, marginBottom: spacing.sm },
  custAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  custAvatarText: { fontSize: font.lg, color: colors.primary, fontWeight: '700' },
  custName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  custCode: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
});
