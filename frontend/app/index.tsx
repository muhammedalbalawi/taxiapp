import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/AppContext';
import { api } from '../src/api';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const router = useRouter();
  const { colors, t, sessionToken, setUser, setSessionToken } = useApp();

  useEffect(() => {
    // Handle OAuth callback (session_id in URL fragment) on web
    (async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash || '';
        if (hash.includes('session_id=')) {
          const sid = hash.split('session_id=')[1].split('&')[0];
          try {
            const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/session`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'X-Session-ID': sid, 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (data.session_token) {
              await setSessionToken(data.session_token);
              setUser(data.user);
              window.history.replaceState({}, '', window.location.pathname);
              if (!data.user.role || data.user.role === 'customer') {
                router.replace('/role-select');
              } else if (data.user.role === 'driver') router.replace('/(driver)/dashboard');
              else if (data.user.role === 'admin') router.replace('/(admin)/dashboard');
              return;
            }
          } catch (e) {
            console.log('auth error', e);
          }
        }
      }

      // Check existing session
      if (sessionToken) {
        try {
          const user = await api('/api/auth/me', { token: sessionToken });
          setUser(user);
          if (user.role === 'driver') router.replace('/(driver)/dashboard');
          else if (user.role === 'admin') router.replace('/(admin)/dashboard');
          else router.replace('/(customer)/home');
          return;
        } catch {
          await setSessionToken(null);
        }
      }
      router.replace('/login');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View testID="splash-screen" style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.logoWrap, { backgroundColor: colors.primary }]}>
        <Ionicons name="navigate" size={42} color="#fff" />
      </View>
      <Text style={[styles.brand, { color: colors.textPrimary }]}>{t('app_name')}</Text>
      <Text style={[styles.tag, { color: colors.textSecondary }]}>{t('tagline')}</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  brand: { fontSize: 42, fontWeight: '900', letterSpacing: -1 },
  tag: { fontSize: 16, marginTop: 6, fontWeight: '500' },
});
