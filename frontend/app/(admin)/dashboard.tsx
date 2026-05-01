import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';
import { api } from '../../src/api';
import { radii } from '../../src/theme';

export default function AdminDashboard() {
  const { colors, t, sessionToken } = useApp();
  const [stats, setStats] = useState<any>({ users: 0, drivers: 0, customers: 0, trips: 0, completed: 0, revenue: 0 });

  useEffect(() => {
    (async () => {
      try { setStats(await api('/api/admin/stats', { token: sessionToken })); } catch {}
    })();
  }, [sessionToken]);

  const Stat = ({ label, value, icon, color }: any) => (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('dashboard')}</Text>

        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroLabel}>{t('total_revenue')}</Text>
          <Text style={styles.heroValue}>${stats.revenue.toFixed(2)}</Text>
          <Text style={styles.heroSub}>{stats.completed} {t('trips_count').toLowerCase()}</Text>
        </View>

        <View style={styles.grid}>
          <Stat label={t('customers_count')} value={stats.customers} icon="people" color={colors.primary} />
          <Stat label={t('active_drivers')} value={stats.drivers} icon="car-sport" color={colors.success} />
        </View>
        <View style={styles.grid}>
          <Stat label={t('trips_count')} value={stats.trips} icon="map" color="#F59E0B" />
          <Stat label="Completed" value={stats.completed} icon="checkmark-circle" color={colors.primary} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginBottom: 20 },
  hero: { padding: 28, borderRadius: radii.xl, marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  heroValue: { color: '#fff', fontSize: 44, fontWeight: '900', marginTop: 6, letterSpacing: -1 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: { flex: 1, padding: 18, borderRadius: radii.lg, borderWidth: 1, marginEnd: 6, marginStart: 6 },
  statIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
