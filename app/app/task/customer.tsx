import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, ActivityIndicator, ScrollView, Alert, Linking,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
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
  COMPANY_CN: '🏭 国内企业',
  COMPANY_OS: '🏢 海外企业',
  PERSONAL: '👤 个人客户',
};

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

  const renderListItem = ({ item }: { item: CustomerListItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/task/customer-detail' as any, params: { id: item.id } })}
      activeOpacity={0.7}
    >
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
        <View style={styles.contactRow}>
          <Text style={styles.contactName}>{item.contactName}</Text>
          <Text style={styles.contactDot}>·</Text>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleCall(item.contactPhone); }}>
            <Text style={styles.contactPhone}>📞 {item.contactPhone}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.typeText}>{TYPE_LABEL[item.customerType] || item.customerType}</Text>
          <Text style={styles.orderCount}>📦 订单 {item.orderCount || 0}</Text>
        </View>
      </View>
      {tab === 'PUBLIC' ? (
        <TouchableOpacity
          style={styles.claimBtn}
          onPress={(e) => { e.stopPropagation(); handleClaim(item); }}
          disabled={actionLoading}
        >
          <Text style={styles.claimBtnText}>认领</Text>
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

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
        <Text style={styles.navTitle}>客户中心</Text>
        <TouchableOpacity onPress={() => router.push('/task/customer-create' as any)} style={styles.navBtn}>
          <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab 切换：我的客户 / 公海池 */}
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

      {/* 搜索栏 */}
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

      {/* 状态筛选 */}
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

      {/* 列表 */}
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

  // Pool 切换
  poolTabs: { flexDirection: 'row', backgroundColor: colors.card, paddingTop: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  poolTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  poolTabActive: { borderBottomColor: colors.primary },
  poolTabText: { fontSize: font.md, color: colors.textSecondary, fontWeight: '500' },
  poolTabTextActive: { color: colors.primary, fontWeight: '700' },

  // 搜索
  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 40, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  // 筛选
  filterRow: { paddingVertical: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // 列表
  listContent: { padding: spacing.md, gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.xl, fontWeight: '700', color: colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
  customerName: { flex: 1, fontSize: font.md, fontWeight: '600', color: colors.text },
  codeBadge: { backgroundColor: colors.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  codeText: { fontSize: font.xs, fontFamily: font.mono, color: colors.textSecondary },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  contactName: { fontSize: font.sm, color: colors.text },
  contactDot: { fontSize: font.sm, color: colors.textTertiary },
  contactPhone: { fontSize: font.sm, color: colors.primary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeText: { fontSize: font.xs, color: colors.textSecondary },
  orderCount: { fontSize: font.xs, color: colors.primary, fontWeight: '600' },
  claimBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md },
  claimBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '600' },
});
