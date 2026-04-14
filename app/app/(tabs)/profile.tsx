import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Platform,
  Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font } from '../../lib/theme';
import { getRoleLabel, getRoleColor, User } from '../../lib/auth';
import { authApi } from '../../lib/api';

interface DemoAccount {
  username: string;
  password: string;
  realName: string;
  role: string;
  desc: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'sales1',         password: '123456', realName: 'AkinGbolahan', role: 'SALES',         desc: '销售：客户/订单/试算' },
  { username: 'warehouse_cn1',  password: '123456', realName: '李仓管',        role: 'WAREHOUSE_CN',  desc: '起运国仓管：扫码入库/装箱' },
  { username: 'warehouse_us1',  password: '123456', realName: '王仓管',        role: 'WAREHOUSE_US',  desc: '到达国仓管：DPN/配送/自提' },
  { username: 'ops_cn1',        password: '123456', realName: '张运营',        role: 'OPS_CN',        desc: '起运国操作：JOB任务管理' },
  { username: 'ops_us1',        password: '123456', realName: '赵运营',        role: 'OPS_US',        desc: '到达国操作：DPN/配送计划' },
  { username: 'finance1',       password: '123456', realName: '钱财务',        role: 'FINANCE',       desc: '财务：费用审批/应收应付' },
  { username: 'boss1',          password: '123456', realName: '孙总',          role: 'BOSS',          desc: '管理层：经营分析' },
  { username: 'driver1',        password: '123456', realName: 'Ibrahim',       role: 'DRIVER',        desc: '司机' },
  { username: 'admin',          password: 'admin123', realName: '系统管理员',  role: 'ADMIN',         desc: '系统管理员（仅 Web）' },
];

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [switching, setSwitching] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setUser(JSON.parse(u));
    });
  }, []);

  const doLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'user', 'readNotifications']);
    if (Platform.OS === 'web') {
      window.location.href = '/(auth)/login';
    } else {
      router.replace('/(auth)/login');
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('确定要退出登录吗？');
      if (ok) doLogout();
    } else {
      Alert.alert('退出登录', '确定要退出登录吗？', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const handleSwitchAccount = async (acc: DemoAccount) => {
    setSwitching(acc.username);
    try {
      const res = await authApi.login(acc.username, acc.password);
      await AsyncStorage.multiRemove(['token', 'user', 'readNotifications']);
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
      setSwitcherVisible(false);
      // 刷新页面让所有 Tab 重新挂载
      if (Platform.OS === 'web') {
        window.location.href = '/(tabs)/tasks';
      } else {
        router.replace('/(tabs)/tasks');
      }
    } catch (err: any) {
      Alert.alert('切换失败', err.message || '请重试');
    } finally {
      setSwitching('');
    }
  };

  if (!user) return <SafeAreaView style={styles.safe} />;

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
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
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

        {/* 切换角色（演示）— 突出显示 */}
        <TouchableOpacity
          style={styles.switchCard}
          onPress={() => setSwitcherVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.switchIconWrap}>
            <Ionicons name="people-circle" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>快速切换角色</Text>
            <Text style={styles.switchDesc}>一键登录其他演示账号</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

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
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={styles.version}>版本 1.0.0</Text>
      </ScrollView>

      {/* 切换角色 Modal */}
      <Modal visible={switcherVisible} transparent animationType="slide" onRequestClose={() => setSwitcherVisible(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择演示账号</Text>
              <TouchableOpacity onPress={() => setSwitcherVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>当前身份：{getRoleLabel(user.role)}（{user.username}）</Text>
            <ScrollView style={{ maxHeight: 540 }}>
              {DEMO_ACCOUNTS.map((acc) => {
                const isCurrent = acc.username === user.username;
                const isLoading = switching === acc.username;
                return (
                  <TouchableOpacity
                    key={acc.username}
                    style={[styles.accountCard, isCurrent && styles.accountCardCurrent]}
                    onPress={() => !isCurrent && !isLoading && handleSwitchAccount(acc)}
                    disabled={isCurrent || !!switching}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.accountAvatar, { backgroundColor: getRoleColor(acc.role) + '20' }]}>
                      <Text style={[styles.accountAvatarText, { color: getRoleColor(acc.role) }]}>
                        {acc.realName.charAt(0)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.accountHeader}>
                        <Text style={styles.accountName}>{acc.realName}</Text>
                        <View style={[styles.roleBadge, { backgroundColor: getRoleColor(acc.role) + '15' }]}>
                          <Text style={[styles.roleText, { color: getRoleColor(acc.role) }]}>
                            {getRoleLabel(acc.role)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.accountDesc}>{acc.desc}</Text>
                      <Text style={styles.accountUsername}>{acc.username} · {acc.password}</Text>
                    </View>
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentText}>当前</Text>
                      </View>
                    ) : isLoading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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

  switchCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    padding: spacing.lg, borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  switchIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  switchTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  switchDesc: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  menu: { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight, gap: spacing.md },
  menuIconBg: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: font.md, color: colors.text },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl, paddingVertical: spacing.lg, backgroundColor: colors.card, borderRadius: radius.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.danger + '30' },
  logoutText: { fontSize: font.md, color: colors.danger, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.lg },

  // Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  modalHint: { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.md },

  accountCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: 'transparent' },
  accountCardCurrent: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  accountAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { fontSize: font.lg, fontWeight: '700' },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  accountName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  accountDesc: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  accountUsername: { fontSize: font.xs, color: colors.textTertiary, fontFamily: font.mono },
  currentBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  currentText: { fontSize: font.xs, color: '#fff', fontWeight: '600' },
});
