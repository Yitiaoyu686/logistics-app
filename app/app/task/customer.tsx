import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, ScrollView, Alert, Linking,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font, shadow } from '../../lib/theme';
import { customerApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

type PoolType = 'PRIVATE' | 'PUBLIC';
type StatusFilter = 'ALL' | 'ACTIVE' | 'SLEEP' | 'FROZEN';

interface CustomerListItem {
  id: string;
  customerCode: string;
  customerName: string;
  customerType: string;
  country: string | null;
  industry: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  ownerUserId: string | null;
  poolType: PoolType;
  status: string;
  preferredTransport: string | null;
  preferredPayment: string | null;
  remark: string | null;
  orderCount: number;
}

const TYPE_LABEL: Record<string, string> = {
  COMPANY_CN: '国内企业',
  COMPANY_OS: '海外企业',
  COMPANY_OVERSEAS: '海外企业',
  INDIVIDUAL: '个人客户',
  PERSONAL: '个人客户',
};

const AVATAR_COLORS = [
  { bg: '#EFF6FF', text: '#2563EB' },
  { bg: '#F0FDF4', text: '#059669' },
  { bg: '#FFF7ED', text: '#D97706' },
  { bg: '#FDF4FF', text: '#9333EA' },
  { bg: '#FFF1F2', text: '#E11D48' },
  { bg: '#F0FDFA', text: '#0D9488' },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'ACTIVE', label: '活跃' },
  { value: 'SLEEP', label: '沉睡' },
  { value: 'FROZEN', label: '冻结' },
];

interface CustomerScreenProps {
  embedded?: boolean;
}

export default function CustomerScreen({ embedded = false }: CustomerScreenProps = {}) {
  const router = useRouter();
  const [tab, setTab] = useState<PoolType>('PRIVATE');
  const [list, setList] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setCurrentUserId(JSON.parse(u).id);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [tab]));

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerApi.list({ poolType: tab });
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
    if (statusFilter !== 'ALL') {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (keyword) {
      const k = keyword.toLowerCase();
      result = result.filter((c) =>
        c.customerName?.toLowerCase().includes(k) ||
        c.customerCode?.toLowerCase().includes(k) ||
        c.contactName?.toLowerCase().includes(k) ||
        c.contactPhone?.includes(k)
      );
    }
    return result;
  }, [list, keyword, statusFilter]);

  const handleCall = (phone: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('拨号失败'));
  };

  const handleClaim = async (item: CustomerListItem) => {
    Alert.alert('认领客户', `确认认领 "${item.customerName}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认认领',
        onPress: async () => {
          setActionLoading(true);
          try {
            await customerApi.claim(item.id, currentUserId || 'user-sales1');
            Alert.alert('认领成功', `${item.customerName} 已加入您的客户列表`);
            await load();
          } catch (err: any) {
            Alert.alert('认领失败', err.message || '请重试');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleTransfer = (item: CustomerListItem) => {
    Alert.alert('转移跟进', `将 "${item.customerName}" 转移给其他同事跟进？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认转移',
        onPress: () => {
          Alert.alert('转移成功', `${item.customerName} 已转移到公海池`, [
            { text: '确定', onPress: () => load() },
          ]);
        },
      },
    ]);
  };

  const renderListItem = ({ item }: { item: CustomerListItem }) => {
    const avatarColor = getAvatarColor(item.customerName || '?');
    const typeLabel = TYPE_LABEL[item.customerType] || item.customerType;
    const statusColor =
      item.status === 'ACTIVE' ? colors.success :
      item.status === 'SLEEP' ? colors.warning :
      item.status === 'FROZEN' ? colors.danger : colors.textTertiary;
    const isOverseas = item.customerType === 'COMPANY_OS' || item.customerType === 'COMPANY_OVERSEAS';
    return (
      <View style={styles.cardOuter}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push({ pathname: '/task/customer-detail' as any, params: { id: item.id } })}
          activeOpacity={0.7}
        >
          <View style={[styles.statusStripe, { backgroundColor: statusColor }]} />
          <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
            <Text style={[styles.avatarText, { color: avatarColor.text }]}>{(item.customerName || '?')[0]}</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.topRow}>
              <Text style={styles.customerName} numberOfLines={1}>{item.customerName}</Text>
              {isOverseas && (
                <View style={styles.overseasBadge}>
                  <Text style={styles.overseasBadgeText}>海外</Text>
                </View>
              )}
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.customerCode}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="business-outline" size={12} color={colors.textTertiary} />
                <Text style={styles.metaText}>{typeLabel}</Text>
              </View>
              {item.industry ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaSeparator}>·</Text>
                  <Ionicons name="layers-outline" size={12} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{item.industry}</Text>
                </View>
              ) : null}
              {item.country ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaSeparator}>·</Text>
                  <Ionicons name="globe-outline" size={12} color={colors.textTertiary} />
                  <Text style={styles.metaText}>{item.country}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.contactGroup}>
                {item.contactName ? (
                  <View style={styles.contactChip}>
                    <Ionicons name="person-outline" size={12} color={colors.primary} />
                    <Text style={styles.contactChipText}>{item.contactName}</Text>
                  </View>
                ) : null}
                {item.contactPhone ? (
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleCall(item.contactPhone); }}>
                    <View style={styles.phoneChip}>
                      <Ionicons name="call-outline" size={12} color={colors.info} />
                      <Text style={styles.phoneChipText}>{item.contactPhone}</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.rightMeta}>
                <View style={styles.orderCountBadge}>
                  <Ionicons name="document-text-outline" size={11} color={colors.primary} />
                  <Text style={styles.orderCount}>{item.orderCount || 0} 单</Text>
                </View>
              </View>
            </View>

            {/* 卡片内操作按钮 */}
            {tab === 'PUBLIC' ? (
              <TouchableOpacity
                style={styles.claimBtn}
                onPress={(e) => { e.stopPropagation(); handleClaim(item); }}
                disabled={actionLoading}
              >
                <Ionicons name="hand-left-outline" size={15} color="#fff" />
                <Text style={styles.claimBtnText}>认领</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.cardActionBtn, { flex: 1 }]}
                  onPress={(e) => { e.stopPropagation(); handleTransfer(item); }}
                >
                  <Ionicons name="swap-horizontal-outline" size={15} color={colors.primary} />
                  <Text style={styles.cardActionText}>转移</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        {embedded ? (
          <View style={styles.navBtn} />
        ) : (
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.poolTabs}>
        <TouchableOpacity
          style={[styles.poolTab, tab === 'PRIVATE' && styles.poolTabActive]}
          onPress={() => setTab('PRIVATE')}
        >
          <Text style={[styles.poolTabText, tab === 'PRIVATE' && styles.poolTabTextActive]}>
            我的客户
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.poolTab, tab === 'PUBLIC' && styles.poolTabActive]}
          onPress={() => setTab('PUBLIC')}
        >
          <Text style={[styles.poolTabText, tab === 'PUBLIC' && styles.poolTabTextActive]}>
            公海池
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索客户名 / 编号 / 联系人 / 电话"
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

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <TouchableOpacity
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatusFilter(f.value)}
              >
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
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{tab === 'PUBLIC' ? '公海池暂无客户' : '暂无客户'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderListItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },

  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },

  poolTabs: { flexDirection: 'row', backgroundColor: colors.card, paddingTop: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  poolTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  poolTabActive: { borderBottomColor: colors.primary },
  poolTabText: { fontSize: font.md, color: colors.textSecondary, fontWeight: '500' },
  poolTabTextActive: { color: colors.primary, fontWeight: '700' },

  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  filterRow: { paddingVertical: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  listContent: { padding: spacing.md, gap: spacing.sm },

  // ── 卡片 ──
  cardOuter: { borderRadius: radius.lg, overflow: 'hidden', ...shadow.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  statusStripe: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginVertical: spacing.sm,
    marginLeft: spacing.xs,
  },

  // 头像
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: spacing.md,
  },
  avatarText: { fontSize: font.lg, fontWeight: '800' },

  // 主信息区
  cardBody: { flex: 1, paddingVertical: spacing.md, paddingLeft: spacing.md, paddingRight: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 5 },
  customerName: { fontSize: font.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  overseasBadge: { backgroundColor: colors.infoLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  overseasBadgeText: { fontSize: 10, fontWeight: '700', color: colors.info },
  codeBadge: { backgroundColor: colors.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  codeText: { fontSize: font.xs, fontFamily: font.mono, color: colors.textSecondary },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2, marginBottom: 7 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: font.xs, color: colors.textSecondary },
  metaSeparator: { fontSize: font.xs, color: colors.textTertiary, marginHorizontal: 2 },

  // 联系人行
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  contactGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, flexWrap: 'wrap' },
  contactChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  contactChipText: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },
  phoneChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.infoLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  phoneChipText: { fontSize: font.xs, color: colors.info, fontWeight: '600' },
  rightMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orderCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  orderCount: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },

  // 卡片内操作按钮
  claimBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.sm, marginTop: 2,
    ...shadow.sm,
  },
  claimBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },
  cardActions: {
    flexDirection: 'row', gap: spacing.sm,
    paddingTop: spacing.sm, marginTop: 2,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  cardActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: spacing.sm, borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  cardActionBtnDanger: { backgroundColor: colors.dangerLight },
  cardActionText: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  cardActionTextDanger: { fontSize: font.sm, color: colors.danger, fontWeight: '600' },
});
