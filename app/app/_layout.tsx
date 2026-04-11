import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthState, User } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const { user, loading } = useAuthState();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)/tasks');
    }
  }, [user, loading, segments]);

  if (loading) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </>
  );
}
