import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, Platform,
  Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, font, shadow } from '../../lib/theme';
import { getRoleLabel, getRoleColor, User } from '../../lib/auth';
import { authApi } from '../../lib/api';
import { useBusinessLine, type BusinessLine } from '../../lib/business-line';

interface DemoAccount {
  username: string;
  password: string;
  realName: string;
  role: string;
  desc: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'sales1',        password: '123456', realName: 'AkinGbolahan', role: 'SALES',        desc: '客户跟进 / 订单管理 / 运费试算' },
  { username: 'warehouse_cn1', password: '123456', realName: '李仓管',        role: 'WAREHOUSE_CN', desc: '扫码入库 / 称重量方 / 装箱发车' },
  { username: 'warehouse_us1', password: '123456', realName: '王仓管',        role: 'WAREHOUSE_US', desc: '任务入库 / DPN 管理 / 配送签收 / 自提' },
];

const ROLE_ICON_MAP: Record<string, string> = {
  SALES: 'briefcase-outline',
  WAREHOUSE_CN: 'cube-outline',
  WAREHOUSE_US: 'home-outline',
};

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [switching, setSwitching] = useState<string>('');
  const router = useRouter();
  const { businessLine, setBusinessLine } = useBusinessLine();

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

  const roleColor = getRoleColor(user.role);

  // 菜单分组
  const accountMenus = [
    { icon: 'person-outline', label: '个人信息', color: colors.primary },
    ...(user.role.includes('WAREHOUSE_CN') ? [{ icon: 'print-outline', label: '打印机设置', color: colors.success }] : []),
    { icon: 'swap-horizontal-outline', label: '切换仓库', color: colors.info },
    { icon: 'lock-closed-outline', label: '修改密码', color: colors.warning },
  ];
  const settingMenus = [
    { icon: 'language-outline', label: '语言 / Language', color: colors.textSecondary },
    { icon: 'notifications-outline', label: '通知设置', color: colors.danger },
    { icon: 'information-circle-outline', label: '关于喵喵物流', color: colors.textTertiary },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── 顶部品牌 Header */}
        <View style={styles.headerBg}>
          <Text style={styles.headerBrand}>喵喵国际物流</Text>

          {/* 头像卡片 */}
          <View style={styles.avatarCard}>
            <View style={[styles.avatarWrap, { backgroundColor: roleColor + '25', borderColor: roleColor + '50' }]}>
              <Text style={[styles.avatarText, { color: roleColor }]}>
                {user.realName.charAt(0)}
              </Text>
            </View>
            <View style={styles.avatarInfo}>
              <Text style={styles.profileName}>{user.realName}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
                <Ionicons name={ROLE_ICON_MAP[user.role] as any || 'person-outline'} size={11} color={roleColor} />
                <Text style={[styles.roleText, { color: roleColor }]}>{getRoleLabel(user.role)}</Text>
              </View>
              <Text style={styles.profileEmail}>{user.email || user.username + '@logistics.com'}</Text>
            </View>
          </View>
        </View>

        {/* ── 业务线切换 */}
        <View style={styles.section}>
          <View style={styles.modeCard}>
            <View style={styles.modeHeader}>
              <Ionicons name="git-branch-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.modeTitle}>业务模式</Text>
              <Text style={styles.modeHint}>
                {businessLine === 'SEA' ? '海运部门操作' : '空运部门操作'}
              </Text>
            </View>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, businessLine === 'SEA' && styles.modeBtnSea]}
                onPress={() => setBusinessLine('SEA')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="boat-outline"
                  size={22}
                  color={businessLine === 'SEA' ? '#fff' : colors.textSecondary}
                />
                <Text style={[styles.modeBtnLabel, businessLine === 'SEA' && styles.modeBtnLabelActive]}>
                  海运
                </Text>
                <Text style={[styles.modeBtnDesc, businessLine === 'SEA' && { color: 'rgba(255,255,255,0.7)' }]}>
                  整柜·拼箱·普运
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, businessLine === 'AIR' && styles.modeBtnAir]}
                onPress={() => setBusinessLine('AIR')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="airplane-outline"
                  size={22}
                  color={businessLine === 'AIR' ? '#fff' : colors.textSecondary}
                />
                <Text style={[styles.modeBtnLabel, businessLine === 'AIR' && styles.modeBtnLabelActive]}>
                  空运
                </Text>
                <Text style={[styles.modeBtnDesc, businessLine === 'AIR' && { color: 'rgba(255,255,255,0.7)' }]}>
                  特快·普快
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── 切换角色（演示）*/}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.switchCard}
            onPress={() => setSwitcherVisible(true)}
            activeOpacity={0.75}
          >
            <View style={styles.switchIconWrap}>
              <Ionicons name="people-circle" size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>快速切换角色</Text>
              <Text style={styles.switchDesc}>一键登录其他演示账号</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* ── 账户设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>账户</Text>
          <View style={styles.menuCard}>
            {accountMenus.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.menuItem, i < accountMenus.length - 1 && styles.menuItemBorder]}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIconBg, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.disabled} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── 系统设置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设置</Text>
          <View style={styles.menuCard}>
            {settingMenus.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.menuItem, i < settingMenus.length - 1 && styles.menuItemBorder]}
                activeOpacity={0.6}
              >
                <View style={[styles.menuIconBg, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.disabled} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── 退出登录 */}
        <View style={[styles.section, { marginTop: spacing.sm }]}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>喵喵国际物流 v1.0.0</Text>
      </ScrollView>

      {/* ── 切换角色 Modal */}
      <Modal visible={switcherVisible} transparent animationType="slide" onRequestClose={() => setSwitcherVisible(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择演示账号</Text>
              <TouchableOpacity onPress={() => setSwitcherVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              当前身份：{getRoleLabel(user.role)}（{user.username}）
              {'\n'}App 端覆盖 3 个角色，其他角色请在 Web 端使用
            </Text>
            <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
              {DEMO_ACCOUNTS.map((acc) => {
                const isCurrent = acc.username === user.username;
                const isLoading = switching === acc.username;
                const accRoleColor = getRoleColor(acc.role);
                return (
                  <TouchableOpacity
                    key={acc.username}
                    style={[styles.accountCard, isCurrent && styles.accountCardCurrent]}
                    onPress={() => !isCurrent && !isLoading && handleSwitchAccount(acc)}
                    disabled={isCurrent || !!switching}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.accountAvatar, { backgroundColor: accRoleColor + '20' }]}>
                      <Text style={[styles.accountAvatarText, { color: accRoleColor }]}>
                        {acc.realName.charAt(0)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.accountHeader}>
                        <Text style={styles.accountName}>{acc.realName}</Text>
                        <View style={[styles.roleBadge, { backgroundColor: accRoleColor + '15' }]}>
                          <Text style={[styles.roleText, { color: accRoleColor }]}>
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
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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

  // ── Header
  headerBg: {
    backgroundColor: colors.headerStart,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  headerBrand: {
    fontSize: font.xs,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: { fontSize: font.xxxl, fontWeight: '800' },
  avatarInfo: { flex: 1 },
  profileName: { fontSize: font.xl, fontWeight: '800', color: '#fff', marginBottom: 6 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: 6,
  },
  roleText: { fontSize: font.xs, fontWeight: '600' },
  profileEmail: { fontSize: font.xs, color: 'rgba(255,255,255,0.55)' },

  // ── Sections
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { fontSize: font.xs, color: colors.textTertiary, fontWeight: '600', letterSpacing: 0.5, marginBottom: spacing.sm, textTransform: 'uppercase' },

  // ── Mode Toggle
  modeCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadow.sm },
  modeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  modeTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, flex: 1 },
  modeHint: { fontSize: font.xs, color: colors.textTertiary },
  modeToggle: { flexDirection: 'row', gap: spacing.md },
  modeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.lg,
    borderRadius: radius.lg, backgroundColor: colors.bg,
    borderWidth: 1.5, borderColor: colors.border,
  },
  modeBtnSea: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  modeBtnAir: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  modeBtnLabel: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginTop: 6 },
  modeBtnLabelActive: { color: '#fff' },
  modeBtnDesc: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },

  // ── Switch Card
  switchCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, padding: spacing.lg, borderRadius: radius.xl,
    borderWidth: 1.5, borderColor: colors.primary + '40',
    ...shadow.sm,
  },
  switchIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  switchTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  switchDesc: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  // ── Menu Card
  menuCard: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', ...shadow.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.lg, gap: spacing.md },
  menuItemBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  menuIconBg: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: font.md, color: colors.text, fontWeight: '500' },

  // ── Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.lg, backgroundColor: colors.dangerLight,
    borderRadius: radius.xl, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.danger + '25',
  },
  logoutText: { fontSize: font.md, color: colors.danger, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: font.xs, color: colors.textTertiary, marginTop: spacing.xl },

  // ── Modal
  modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl, padding: spacing.lg, maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  modalHint: { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },

  accountCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.card,
    borderRadius: radius.lg, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: 'transparent',
    ...shadow.sm,
  },
  accountCardCurrent: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  accountAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { fontSize: font.lg, fontWeight: '800' },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  accountName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  accountDesc: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 2 },
  accountUsername: { fontSize: font.xs, color: colors.textTertiary, fontFamily: font.mono },
  currentBadge: { backgroundColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  currentText: { fontSize: font.xs, color: '#fff', fontWeight: '700' },
});
