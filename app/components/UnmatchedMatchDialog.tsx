import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../lib/theme';
import { warehouseApi, customerApi } from '../lib/api';

export interface UnmatchedTargetItem {
  id: string;
  tracking_no: string;
  express_company: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  pieces: number;
  gross_weight_kg: number;
  customer_hint: string | null;
}

interface CustomerOption {
  id: string;
  customerCode: string;
  customerName: string;
  contactPhone: string;
}

interface UnmatchedMatchDialogProps {
  visible: boolean;
  target: UnmatchedTargetItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UnmatchedMatchDialog({ visible, target, onClose, onSuccess }: UnmatchedMatchDialogProps) {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [keyword, setKeyword] = useState('');
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    if (visible) {
      customerApi.list({ poolType: 'PRIVATE' }).then((r) => setCustomers(r.data || [])).catch(() => {});
    } else {
      setKeyword('');
    }
  }, [visible]);

  const filtered = useMemo(() => {
    if (!keyword) return customers;
    const k = keyword.toLowerCase();
    return customers.filter((c) =>
      c.customerName?.toLowerCase().includes(k) ||
      c.customerCode?.toLowerCase().includes(k) ||
      c.contactPhone?.includes(k)
    );
  }, [customers, keyword]);

  const handleMatchTo = async (cust: CustomerOption) => {
    if (!target) return;
    setMatching(true);
    try {
      await warehouseApi.matchUnmatched(target.id, {
        customerId: cust.id,
        customerName: cust.customerName,
      });
      Alert.alert('匹配成功', `${target.tracking_no} 已关联到 ${cust.customerName}`, [
        { text: '确定', onPress: () => onSuccess() },
      ]);
    } catch (err: any) {
      Alert.alert('匹配失败', err.message || '请重试');
    } finally {
      setMatching(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mask}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>🔗 匹配到客户</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {target && (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{target.tracking_no}</Text>
                <Text style={styles.infoLine}>{target.express_company || '-'} · {target.pieces}件 · {target.gross_weight_kg}kg</Text>
                <Text style={styles.infoLine}>发件人：{target.sender_name || '-'}</Text>
                {target.customer_hint && (
                  <Text style={styles.hintInModal}>💡 {target.customer_hint}</Text>
                )}
              </View>

              <View style={styles.searchInputWrap}>
                <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="搜索客户名/编号/电话"
                  placeholderTextColor={colors.textTertiary}
                  value={keyword}
                  onChangeText={setKeyword}
                />
              </View>

              <ScrollView style={{ maxHeight: 400, marginTop: spacing.md }}>
                {filtered.length === 0 ? (
                  <Text style={styles.emptyText}>无匹配客户</Text>
                ) : (
                  filtered.map((c) => (
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
                      {matching ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.warning },
  infoTitle: { fontSize: font.md, fontWeight: '700', color: colors.primary, fontFamily: font.mono, marginBottom: 4 },
  infoLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 2 },
  hintInModal: { fontSize: font.xs, color: colors.warning, marginTop: 4, fontStyle: 'italic' },

  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  custOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, marginBottom: spacing.sm },
  custAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  custAvatarText: { fontSize: font.lg, color: colors.primary, fontWeight: '700' },
  custName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  custCode: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  emptyText: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },
});
