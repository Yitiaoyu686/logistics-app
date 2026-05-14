import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabLayout() {
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) setRole(JSON.parse(u).role);
    });
  }, []);

  const isSales = role === 'SALES';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: '任务',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: isSales ? '客户' : '办理',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={isSales ? 'people-outline' : 'apps-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.scanBtn}>
              <Ionicons name={isSales ? 'add' : 'scan-outline'} size={28} color="#fff" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: isSales ? '订单' : '消息',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={isSales ? 'document-text-outline' : 'notifications-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 84,
    paddingTop: 6,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  scanBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});
