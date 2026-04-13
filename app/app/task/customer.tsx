import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, Modal, ScrollView, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { customerApi } from '../../lib/api';

interface CustomerListItem {
  id: string;
  customerCode: string;
  customerName: string;
  customerType: string;
  contactName: string;
  contactPhone: string;
  poolType: string;
  status: string;
  orderCount: number;
}

interface RecipientAddress {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  country: string;
  city: string;
  detail_address: string;
  is_default: number;
}

interface CustomerDetail {
  id: string;
  customer_code: string;
  customer_name: string;
  customer_type: string;
  country: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  pool_type: string;
  status: string;
  remark: string | null;
  recipients: RecipientAddress[];
}

const TYPE_LABEL: Record<string, string> = {
  COMPANY_CN: '🏭 国内企业',
  COMPANY_OS: '🏢 海外企业',
  PERSONAL: '👤 个人客户',
};

export default function CustomerScreen() {
  const router = useRouter();
  const [list, setList] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerApi.list();
      setList(res.data || []);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await customerApi.get(id);
      setDetail(res.data);
    } catch (err: any) {
      Alert.alert('加载失败', err.message || '请重试');
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!keyword) return list;
    const k = keyword.toLowerCase();
    return list.filter((c) =>
      c.customerName?.toLowerCase().includes(k) ||
      c.customerCode?.toLowerCase().includes(k) ||
      c.contactName?.toLowerCase().includes(k) ||
      c.contactPhone?.includes(k)
    );
  }, [list, keyword]);

  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('拨号失败'));
  };

  const renderItem = ({ item }: { item: CustomerListItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item.id)} activeOpacity={0.7}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.customerName || '?')[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardHeader}>
          <Text style={styles.customerName} numberOfLines={1}>{item.customerName}</Text>
          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>{item.customerCode}</Text>
          </View>
        </View>
        <Text style={styles.contactLine} numberOfLines={1}>
          {item.contactName} · {item.contactPhone}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.typeText}>{TYPE_LABEL[item.customerType] || item.customerType}</Text>
          <Text style={styles.orderCount}>📦 {item.orderCount || 0} 单</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>我的客户</Text>
        <Text style={styles.navExtra}>{list.length} 家</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索客户名 / 客户编号 / 联系人 / 电话"
            placeholderTextColor={colors.textTertiary}
            value={keyword}
            onChangeText={setKeyword}
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => setKeyword('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无客户</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedId} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>客户详情</Text>
              <TouchableOpacity onPress={() => setSelectedId(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {detailLoading ? (
              <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
            ) : detail ? (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
                {/* Header card */}
                <View style={styles.detailHero}>
                  <View style={styles.detailAvatar}>
                    <Text style={styles.detailAvatarText}>{(detail.customer_name || '?')[0]}</Text>
                  </View>
                  <Text style={styles.detailName}>{detail.customer_name}</Text>
                  <Text style={styles.detailCode}>{detail.customer_code}</Text>
                  <View style={styles.detailTags}>
                    <View style={styles.tagPill}>
                      <Text style={styles.tagText}>{TYPE_LABEL[detail.customer_type] || detail.customer_type}</Text>
                    </View>
                    <View style={[styles.tagPill, { backgroundColor: colors.successLight }]}>
                      <Text style={[styles.tagText, { color: colors.success }]}>{detail.status === 'ACTIVE' ? '✓ 正常' : detail.status}</Text>
                    </View>
                  </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickRow}>
                  <TouchableOpacity style={styles.quickBtn} onPress={() => handleCall(detail.contact_phone)}>
                    <Ionicons name="call" size={20} color={colors.primary} />
                    <Text style={styles.quickText}>拨打</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn}>
                    <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
                    <Text style={styles.quickText}>短信</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn}>
                    <Ionicons name="document-text" size={20} color={colors.primary} />
                    <Text style={styles.quickText}>下单</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickBtn}>
                    <Ionicons name="calculator" size={20} color={colors.primary} />
                    <Text style={styles.quickText}>试算</Text>
                  </TouchableOpacity>
                </View>

                {/* 联系人 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>👤 联系人</Text>
                  <DetailLine label="联系人" value={detail.contact_name} />
                  <DetailLine label="电话" value={detail.contact_phone} highlight />
                  <DetailLine label="邮箱" value={detail.contact_email || '-'} />
                  <DetailLine label="国家" value={detail.country} />
                </View>

                {/* 收件地址 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📍 收件地址 ({detail.recipients?.length || 0})</Text>
                  {(detail.recipients || []).length === 0 ? (
                    <Text style={styles.empty}>暂无收件地址</Text>
                  ) : (
                    (detail.recipients || []).map((r) => (
                      <View key={r.id} style={styles.addrCard}>
                        <View style={styles.addrHeader}>
                          <Text style={styles.addrName}>{r.recipient_name}</Text>
                          {r.is_default === 1 && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultText}>默认</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.addrPhone}>📱 {r.recipient_phone}</Text>
                        <Text style={styles.addrText}>📍 {r.country} · {r.city}</Text>
                        <Text style={styles.addrText}>{r.detail_address}</Text>
                      </View>
                    ))
                  )}
                </View>

                {/* 备注 */}
                {detail.remark && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📝 备注</Text>
                    <Text style={styles.remarkText}>{detail.remark}</Text>
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: colors.primary, fontWeight: '600' }]}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  // Nav
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  navExtra: { fontSize: font.sm, color: colors.textSecondary },
  // Search
  searchRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },
  // List
  listContent: { padding: spacing.md, gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.xl, fontWeight: '700', color: colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  customerName: { flex: 1, fontSize: font.md, fontWeight: '600', color: colors.text },
  codeBadge: { backgroundColor: colors.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  codeText: { fontSize: font.xs, fontFamily: font.mono, color: colors.textSecondary },
  contactLine: { fontSize: font.sm, color: colors.textSecondary, marginBottom: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeText: { fontSize: font.xs, color: colors.textSecondary },
  orderCount: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },
  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  detailHero: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  detailAvatar: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  detailAvatarText: { fontSize: font.xxl, fontWeight: '700', color: colors.primary },
  detailName: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  detailCode: { fontSize: font.sm, fontFamily: font.mono, color: colors.textSecondary, marginTop: 2 },
  detailTags: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  tagPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.primaryLight },
  tagText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },
  quickRow: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  quickBtn: { flex: 1, alignItems: 'center', gap: 4, padding: spacing.sm },
  quickText: { fontSize: font.xs, color: colors.text },
  section: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  detailLabel: { fontSize: font.sm, color: colors.textSecondary },
  detailValue: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
  empty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.lg },
  addrCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary },
  addrHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  addrName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  defaultBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  defaultText: { fontSize: font.xs, color: colors.warning, fontWeight: '600' },
  addrPhone: { fontSize: font.sm, color: colors.primary, marginBottom: 2 },
  addrText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
  remarkText: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 22 },
});
