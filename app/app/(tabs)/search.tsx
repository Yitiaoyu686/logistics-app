import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
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
}

const MENU_ITEMS: MenuItem[] = [
  { icon: '📋', label: '库存查询', desc: '搜索在库货物', route: '/task/stock' },
  { icon: '👥', label: '客户查询', desc: '我的客户列表', route: '/task/customer' },
  { icon: '📄', label: '订单查询', desc: '按运单号查订单', route: '/task/order' },
  { icon: '💰', label: '运费试算', desc: '即时报价分享', route: '/task/quote' },
  { icon: '📦', label: '扫码入库', desc: '称重量方计费', route: '/task/inbound' },
  { icon: '🏗', label: '装箱出库', desc: '柜内装箱发车', route: '/task/packing' },
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>查询</Text>
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

      <FlatList
        data={MENU_ITEMS}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        keyExtractor={(item) => item.label}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.menuCard}
            activeOpacity={0.7}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuDesc}>{item.desc}</Text>
          </TouchableOpacity>
        )}
      />
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
  grid: { paddingHorizontal: spacing.md },
  gridRow: { gap: spacing.md },
  menuCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 2, elevation: 1 },
  menuIcon: { fontSize: 28, marginBottom: spacing.sm },
  menuLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
  menuDesc: { fontSize: font.xs, color: colors.textTertiary, marginTop: 4 },
});
