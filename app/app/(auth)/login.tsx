import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../lib/api';
import { colors, spacing, radius, font, shadow } from '../../lib/theme';

const DEMO_ACCOUNTS = [
  {
    username: 'sales1', password: '123456', role: 'SALES',
    label: '销售', sub: '客户跟进 / 订单管理',
    icon: 'briefcase-outline' as const, color: '#3B82F6',
  },
  {
    username: 'warehouse_cn1', password: '123456', role: 'WAREHOUSE_CN',
    label: '起运国仓管', sub: '扫码入库 / 装箱发车',
    icon: 'cube-outline' as const, color: '#10B981',
  },
  {
    username: 'warehouse_us1', password: '123456', role: 'WAREHOUSE_US',
    label: '到达国仓管', sub: 'DPN管理 / 配送签收',
    icon: 'home-outline' as const, color: '#F59E0B',
  },
];

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (user?: string, pass?: string) => {
    const u = user || username;
    const p = pass || password;
    if (!u || !p) { Alert.alert('提示', '请输入用户名和密码'); return; }

    setLoading(true);
    try {
      const res = await authApi.login(u, p);
      const { token, user: userData } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      if (typeof window !== 'undefined') {
        window.location.href = '/(tabs)/tasks';
      } else {
        router.replace('/(tabs)/tasks');
      }
    } catch (err: any) {
      Alert.alert('登录失败', err.message || '网络连接失败，请检查后端服务是否启动');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>

        {/* 顶部品牌区 */}
        <View style={styles.brandArea}>
          {/* 装饰圆圈 */}
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>MM</Text>
          </View>
          <Text style={styles.brandName}>喵喵国际物流</Text>
          <View style={styles.brandSubRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandSub}>MiaoMiao Logistics</Text>
            <View style={styles.brandDot} />
            <Text style={styles.brandSub}>全球跨境配送</Text>
            <View style={styles.brandDot} />
          </View>
        </View>

        {/* 表单卡片 */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>账号登录</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="用户名"
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="密码"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={() => handleLogin()}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.loginBtnText}>{loading ? '登录中...' : '登 录'}</Text>
          </TouchableOpacity>
        </View>

        {/* 快捷登录 */}
        <View style={styles.quickArea}>
          <View style={styles.quickHeader}>
            <View style={styles.quickLine} />
            <Text style={styles.quickTitle}>演示账号快捷登录</Text>
            <View style={styles.quickLine} />
          </View>
          <View style={styles.quickList}>
            {DEMO_ACCOUNTS.map((acc) => (
              <TouchableOpacity
                key={acc.username}
                style={styles.quickItem}
                onPress={() => handleLogin(acc.username, acc.password)}
                activeOpacity={0.75}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: acc.color + '18' }]}>
                  <Ionicons name={acc.icon} size={20} color={acc.color} />
                </View>
                <View style={styles.quickInfo}>
                  <Text style={styles.quickLabel}>{acc.label}</Text>
                  <Text style={styles.quickSub}>{acc.sub}</Text>
                </View>
                <View style={styles.quickRight}>
                  <View style={[styles.quickBadge, { backgroundColor: acc.color + '12' }]}>
                    <Text style={[styles.quickBadgeText, { color: acc.color }]}>{acc.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.headerStart,
  },
  inner: {
    flex: 1,
  },

  // 品牌区
  brandArea: {
    alignItems: 'center',
    paddingTop: 44,
    paddingBottom: 36,
    backgroundColor: colors.headerStart,
    overflow: 'hidden',
    position: 'relative',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.04)',
    top: -60,
    right: -40,
  },
  decorCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: 10,
    left: -30,
  },
  logoWrap: {
    width: 84,
    height: 84,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    ...shadow.md,
  },
  logoEmoji: {
    fontSize: 42,
  },
  brandName: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: 8,
  },
  brandSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  brandSub: {
    fontSize: font.xs,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },

  // 表单卡片
  formCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.xxl,
    paddingTop: 28,
    paddingBottom: 24,
  },
  formTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  inputGroup: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: spacing.lg,
  },
  inputIcon: {
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: font.md,
    color: colors.text,
  },
  eyeBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  loginBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: font.lg,
    fontWeight: '700',
    letterSpacing: 3,
  },

  // 快捷登录
  quickArea: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xxl,
    paddingTop: 24,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: spacing.md,
  },
  quickLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  quickTitle: {
    fontSize: font.xs,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  quickList: {
    gap: spacing.sm,
  },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.sm,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickInfo: {
    flex: 1,
  },
  quickLabel: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text,
  },
  quickSub: {
    fontSize: font.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
  quickRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  quickBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
