import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import Button from '../src/Button';
import { api } from '../src/api';
import { radii } from '../src/theme';

export default function RoleSelect() {
  const router = useRouter();
  const { colors, t, sessionToken, setUser } = useApp();
  const [selected, setSelected] = useState<'customer' | 'driver'>('customer');
  const [loading, setLoading] = useState(false);

  const proceed = async () => {
    setLoading(true);
    try {
      const user = await api('/api/auth/role', { method: 'POST', body: { role: selected }, token: sessionToken });
      setUser(user);
      if (selected === 'driver') router.replace('/(driver)/dashboard');
      else router.replace('/(customer)/home');
    } finally {
      setLoading(false);
    }
  };

  const Card = ({ value, icon, title, desc }: any) => {
    const isSel = selected === value;
    return (
      <Pressable
        testID={`role-${value}`}
        onPress={() => setSelected(value)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isSel ? colors.primary + '0D' : colors.surface,
            borderColor: isSel ? colors.primary : colors.border,
            borderWidth: isSel ? 2 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: isSel ? colors.primary : colors.surfaceElevated }]}>
          <Ionicons name={icon} size={28} color={isSel ? '#fff' : colors.textPrimary} />
        </View>
        <View style={{ flex: 1, marginStart: 16 }}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{desc}</Text>
        </View>
        <Ionicons
          name={isSel ? 'radio-button-on' : 'radio-button-off'}
          size={24}
          color={isSel ? colors.primary : colors.border}
        />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.h1, { color: colors.textPrimary }]}>{t('welcome')}</Text>
        <Text style={[styles.h2, { color: colors.textSecondary }]}>{t('pick_role')}</Text>
      </View>
      <View style={styles.cards}>
        <Card value="customer" icon="person" title={t('customer')} desc={t('customer_desc')} />
        <View style={{ height: 16 }} />
        <Card value="driver" icon="car-sport" title={t('driver')} desc={t('driver_desc')} />
      </View>
      <View style={{ paddingBottom: 24 }}>
        <Button testID="role-continue" label={t('continue')} onPress={proceed} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: { marginTop: 32, marginBottom: 40 },
  h1: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  h2: { fontSize: 18, marginTop: 8, fontWeight: '500' },
  cards: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: radii.lg },
  iconCircle: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardDesc: { fontSize: 14, marginTop: 4 },
});
