import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, createContext, useContext } from 'react';

export interface User {
  id: string;
  username: string;
  realName: string;
  role: string;
  roles: string[];
  email?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuthState(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [savedToken, savedUser] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('user'),
      ]);
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
    })();
  }, []);

  const login = async (newToken: string, newUser: User) => {
    await Promise.all([
      AsyncStorage.setItem('token', newToken),
      AsyncStorage.setItem('user', JSON.stringify(newUser)),
    ]);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await Promise.all([
      AsyncStorage.removeItem('token'),
      AsyncStorage.removeItem('user'),
    ]);
    setToken(null);
    setUser(null);
  };

  return { user, token, loading, login, logout };
}

// Role helpers
export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    ADMIN: '系统管理员',
    SALES: '销售',
    WAREHOUSE_CN: '起运国仓管',
    WAREHOUSE_US: '到达国仓管',
    OPS_CN: '起运国操作',
    OPS_US: '到达国操作',
    FINANCE: '财务',
    BOSS: '管理层',
    DRIVER: '司机',
  };
  return map[role] || role;
}

export function getRoleColor(role: string): string {
  const map: Record<string, string> = {
    ADMIN: '#6366f1',
    SALES: '#0ea5e9',
    WAREHOUSE_CN: '#22c55e',
    WAREHOUSE_US: '#f59e0b',
    OPS_CN: '#8b5cf6',
    OPS_US: '#ec4899',
    FINANCE: '#14b8a6',
    BOSS: '#f43f5e',
  };
  return map[role] || '#6b7280';
}
