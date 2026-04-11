import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';

const MENU_ITEMS = [
  { icon: '📋', label: '库存查询', desc: '搜索在库货物' },
  { icon: '📦', label: '入库记录', desc: '历史入库数据' },
  { icon: '🏗', label: '装箱任务', desc: '集装箱装箱列表' },
  { icon: '📄', label: '订单查询', desc: '按运单号查订单' },
  { icon: '🔄', label: '调拨记录', desc: '调拨单历史' },
  { icon: '🚚', label: '配送记录', desc: 'DPN配送历史' },
];

export default function SearchScreen() {
  const [keyword, setKeyword] = useState('');

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
          <TouchableOpacity style={styles.menuCard} activeOpacity={0.7}>
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
