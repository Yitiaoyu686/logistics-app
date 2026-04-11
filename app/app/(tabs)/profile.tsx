import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font } from '../../lib/theme';
import { getRoleLabel, getRoleColor, User } from '../../lib/auth';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setUser(JSON.parse(u));
    });
  }, []);

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['token', 'user']);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (!user) return null;

  const menuItems = [
    { icon: 'person-outline', label: '个人信息', color: colors.primary },
    ...(user.role.includes('WAREHOUSE_CN') ? [{ icon: 'print-outline', label: '打印机设置', color: colors.success }] : []),
    { icon: 'swap-horizontal-outline', label: '切换仓库', color: colors.info },
    { icon: 'lock-closed-outline', label: '修改密码', color: colors.warning },
    { icon: 'language-outline', label: '语言 / Language', color: colors.textSecondary },
    { icon: 'notifications-outline', label: '通知设置', color: colors.danger },
    { icon: 'information-circle-outline', label: '关于', color: colors.textTertiary },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: getRoleColor(user.role) + '20' }]}>
          <Text style={[styles.avatarText, { color: getRoleColor(user.role) }]}>
            {user.realName.charAt(0)}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user.realName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.role) + '15' }]}>
            <Text style={[styles.roleText, { color: getRoleColor(user.role) }]}>{getRoleLabel(user.role)}</Text>
          </View>
          <Text style={styles.profileEmail}>{user.email || user.username}</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menu}>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={styles.menuItem} activeOpacity={0.6}>
            <View style={[styles.menuIconBg, { backgroundColor: item.color + '10' }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.disabled} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>

      <Text style={styles.version}>版本 1.0.0</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, margin: spacing.lg, marginTop: spacing.md, padding: spacing.xl, borderRadius: radius.xl, gap: spacing.lg },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: font.xxl, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  roleBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, marginTop: spacing.xs, alignSelf: 'flex-start' },
  roleText: { fontSize: font.xs, fontWeight: '600' },
  profileEmail: { fontSize: font.sm, color: colors.textTertiary, marginTop: spacing.xs },
  menu: { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight, gap: spacing.md },
  menuIconBg: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: font.md, color: colors.text },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl, paddingVertical: spacing.lg, backgroundColor: colors.card, borderRadius: radius.xl, gap: spacing.sm },
  logoutText: { fontSize: font.md, color: colors.danger, fontWeight: '500' },
  version: { textAlign: 'center', fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.lg },
});
