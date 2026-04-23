import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import CustomerScreen from '../task/customer';

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  route: string;
  params?: Record<string, string>;
  roles?: string[]; // 不写表示所有角色可见
  tint?: string; // 创建类用暖色,查询类用冷色
}

// 查询入口(通用或按角色过滤)
const QUERY_ITEMS: MenuItem[] = [
  { icon: '📋', label: '库存查询', desc: '搜索在库货物', route: '/task/stock' },
  { icon: '📄', label: '订单查询', desc: '按运单号查订单', route: '/task/order' },
  { icon: '👥', label: '客户查询', desc: '我的客户列表', route: '/task/customer', roles: ['SALES'] },
  { icon: '💰', label: '运费试算', desc: '即时报价分享', route: '/task/quote', roles: ['SALES'] },
];

// 创建入口(按角色分配)
const CREATE_ITEMS: MenuItem[] = [
  // 销售
  { icon: '📝', label: '新建订单', desc: '4 步快速创建', route: '/task/order-create', roles: ['SALES'], tint: colors.primary },
  { icon: '➕', label: '新增客户', desc: '录入新客户', route: '/task/customer-create', roles: ['SALES'], tint: colors.success },
  // 起运国仓管
  { icon: '📦', label: '新增无单快递', desc: '登记无单收件', route: '/task/no-order-express', roles: ['WAREHOUSE_CN'], tint: colors.warning },
  { icon: '🔄', label: '新建调拨', desc: '仓间货物调拨', route: '/task/transfer', roles: ['WAREHOUSE_CN'], tint: colors.info },
  { icon: '↩️', label: '新建退运', desc: '异常货物退回', route: '/task/return-create', roles: ['WAREHOUSE_CN'], tint: colors.danger },
  // 到达国仓管
  { icon: '🚚', label: '新建 DPN', desc: '创建派送运单', route: '/task/dpn-create', roles: ['WAREHOUSE_US'], tint: colors.primary },
];

export default function SearchScreen() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setRole(JSON.parse(u).role);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return <SafeAreaView style={styles.safe} />;
  }

  // 销售角色：客户 Tab 直接渲染客户中心内容
  if (role === 'SALES') {
    return <CustomerScreen embedded />;
  }

  const visibleQuery = QUERY_ITEMS.filter((m) => !m.roles || m.roles.includes(role));
  const visibleCreate = CREATE_ITEMS.filter((m) => !m.roles || m.roles.includes(role));

  const renderGrid = (items: MenuItem[], isCreate = false) => (
    <View style={styles.grid}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.label}
          style={[styles.menuCard, isCreate && item.tint ? { borderTopWidth: 3, borderTopColor: item.tint } : null]}
          activeOpacity={0.7}
          onPress={() => router.push({ pathname: item.route as any, params: item.params || {} })}
        >
          <Text style={styles.menuIcon}>{item.icon}</Text>
          <Text style={styles.menuLabel}>{item.label}</Text>
          <Text style={styles.menuDesc}>{item.desc}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>办理</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="运单号 / 快递单号 / 客户名"
          placeholderTextColor={colors.textTertiary}
          value={keyword}
          onChangeText={setKeyword}
        />
        <TouchableOpacity style={styles.scanIcon}>
          <Ionicons name="scan-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {visibleCreate.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionTitle}>新建业务</Text>
            </View>
            {renderGrid(visibleCreate, true)}
          </View>
        )}
        {visibleQuery.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: colors.textSecondary }]} />
              <Text style={styles.sectionTitle}>查询</Text>
            </View>
            {renderGrid(visibleQuery)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 44, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.sm, color: colors.text },
  scanIcon: { padding: spacing.xs },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionDot: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.primary },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  menuCard: { width: '47%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  menuIcon: { fontSize: 28, marginBottom: spacing.sm },
  menuLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
  menuDesc: { fontSize: font.xs, color: colors.textTertiary, marginTop: 4 },
});
