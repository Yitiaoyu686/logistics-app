import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../lib/api';
import { colors, spacing, radius, font } from '../../lib/theme';
import { getRoleLabel, getRoleColor } from '../../lib/auth';

const DEMO_ACCOUNTS = [
  { username: 'sales1', password: '123456', role: 'SALES', label: '销售' },
  { username: 'warehouse_cn1', password: '123456', role: 'WAREHOUSE_CN', label: '起运国仓管' },
  { username: 'warehouse_us1', password: '123456', role: 'WAREHOUSE_US', label: '到达国仓管' },
];

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
      // Force page reload on web to re-trigger auth check
      if (typeof window !== 'undefined') {
        window.location.href = '/(tabs)/tasks';
      } else {
        router.replace('/(tabs)/tasks');
      }
    } catch (err: any) {
      Alert.alert('登录失败', err.message || '请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>🌐</Text>
          </View>
          <Text style={styles.title}>跨境物流管理系统</Text>
          <Text style={styles.subtitle}>Logistics Management</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>👤</Text>
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

          <View style={styles.inputWrapper}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="密码"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={() => handleLogin()}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.loginBtnText}>{loading ? '登录中...' : '登 录'}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Login */}
        <View style={styles.quickArea}>
          <Text style={styles.quickTitle}>快捷登录（演示账号）</Text>
          <View style={styles.quickRow}>
            {DEMO_ACCOUNTS.map((acc) => (
              <TouchableOpacity
                key={acc.username}
                style={[styles.quickBtn, { borderColor: getRoleColor(acc.role) }]}
                onPress={() => handleLogin(acc.username, acc.password)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickBtnText, { color: getRoleColor(acc.role) }]}>{acc.label}</Text>
                <Text style={styles.quickBtnSub}>{acc.username}</Text>
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
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: font.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    letterSpacing: 2,
  },
  form: {
    gap: spacing.md,
    marginBottom: 32,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 52,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: font.md,
    color: colors.text,
  },
  loginBtn: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: font.lg,
    fontWeight: '600',
    letterSpacing: 4,
  },
  quickArea: {
    alignItems: 'center',
  },
  quickTitle: {
    fontSize: font.xs,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  quickBtnText: {
    fontSize: font.sm,
    fontWeight: '600',
  },
  quickBtnSub: {
    fontSize: font.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
