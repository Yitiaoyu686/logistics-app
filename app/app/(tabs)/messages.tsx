import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font } from '../../lib/theme';
import { notificationApi } from '../../lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  target: string;
  routePath?: string;
  routeParams?: Record<string, any>;
  time: string;
  read: boolean;
}

type FilterTab = 'all' | 'unread' | 'business' | 'alert';

const COLOR_MAP: Record<string, string> = {
  primary: colors.primary,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
};

const BG_MAP: Record<string, string> = {
  primary: colors.primaryLight,
  success: colors.successLight,
  warning: colors.warningLight,
  danger: colors.dangerLight,
  info: colors.infoLight,
};

export default function MessagesScreen() {
  const router = useRouter();
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setUserRole(JSON.parse(u).role || '');
    });
    AsyncStorage.getItem('readNotifications').then((v) => {
      if (v) setReadIds(new Set(JSON.parse(v)));
    });
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []));

  const load = async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list();
      setList(res.data || []);
    } catch (err: any) {
      // silent fail — empty state shows
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Apply read state + role filter
  const withReadState = useMemo(() => {
    return list
      .filter((n) => !userRole || !n.target || n.target === userRole)
      .map((n) => ({ ...n, read: readIds.has(n.id) }));
  }, [list, readIds, userRole]);

  const filtered = useMemo(() => {
    if (filter === 'all') return withReadState;
    if (filter === 'unread') return withReadState.filter((n) => !n.read);
    if (filter === 'business') return withReadState.filter((n) => ['ORDER_PENDING', 'JOB_ARRIVED', 'JOB_DEPARTING', 'DPN_UPDATE', 'PICKUP_PENDING'].includes(n.type));
    if (filter === 'alert') return withReadState.filter((n) => ['UNMATCHED_PACKAGE'].includes(n.type) || n.color === 'danger' || n.color === 'warning');
    return withReadState;
  }, [withReadState, filter]);

  const unreadCount = useMemo(() => withReadState.filter((n) => !n.read).length, [withReadState]);

  const markAllRead = async () => {
    const allIds = new Set(withReadState.map((n) => n.id));
    setReadIds(allIds);
    await AsyncStorage.setItem('readNotifications', JSON.stringify(Array.from(allIds)));
  };

  const handleOpen = async (item: Notification) => {
    const next = new Set(readIds);
    next.add(item.id);
    setReadIds(next);
    await AsyncStorage.setItem('readNotifications', JSON.stringify(Array.from(next)));
    if (item.routePath) {
      router.push({ pathname: item.routePath as any, params: (item.routeParams || {}) as any });
    }
  };

  const formatTime = (t: string) => {
    if (!t) return '';
    const diff = Date.now() - new Date(t).getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${Math.floor(diff / 86400000)}天前`;
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const mainColor = COLOR_MAP[item.color] || colors.primary;
    const bg = BG_MAP[item.color] || colors.primaryLight;
    return (
      <TouchableOpacity
        style={[styles.msgCard, !item.read && { borderLeftWidth: 3, borderLeftColor: mainColor }]}
        onPress={() => handleOpen(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.msgIcon, { backgroundColor: bg }]}>
          <Text style={styles.msgIconText}>{item.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.msgHeader}>
            <View style={styles.msgTitleRow}>
              {!item.read && <View style={[styles.dot, { backgroundColor: mainColor }]} />}
              <Text style={styles.msgTitle}>{item.title}</Text>
            </View>
            <Text style={styles.msgTime}>{formatTime(item.time)}</Text>
          </View>
          <Text style={styles.msgBody} numberOfLines={2}>{item.content}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  const tabs: { value: FilterTab; label: string; count: number }[] = [
    { value: 'all',      label: '全部',  count: withReadState.length },
    { value: 'unread',   label: '未读',  count: unreadCount },
    { value: 'business', label: '业务',  count: withReadState.filter((n) => ['ORDER_PENDING', 'JOB_ARRIVED', 'JOB_DEPARTING', 'DPN_UPDATE', 'PICKUP_PENDING'].includes(n.type)).length },
    { value: 'alert',    label: '预警',  count: withReadState.filter((n) => n.type === 'UNMATCHED_PACKAGE' || n.color === 'danger' || n.color === 'warning').length },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>消息{unreadCount > 0 ? <Text style={styles.unreadBadge}> {unreadCount}</Text> : null}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.allRead}>全部已读</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabRow}>
        {tabs.map((t) => {
          const active = filter === t.value;
          return (
            <TouchableOpacity
              key={t.value}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setFilter(t.value)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label} {t.count > 0 && `(${t.count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && list.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="mail-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>暂无消息</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  unreadBadge: { fontSize: font.sm, color: colors.danger, fontWeight: '600' },
  allRead: { fontSize: font.sm, color: colors.primary },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  tab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.bg },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: font.xs, color: colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  listContent: { padding: spacing.md },
  msgCard: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, alignItems: 'center', gap: spacing.md },
  msgIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  msgIconText: { fontSize: 20 },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  msgTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  msgTitle: { fontSize: font.md, fontWeight: '600', color: colors.text, flex: 1 },
  msgTime: { fontSize: font.xs, color: colors.textTertiary },
  msgBody: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
});
