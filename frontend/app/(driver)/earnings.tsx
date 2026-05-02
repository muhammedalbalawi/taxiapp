import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';
import { api } from '../../src/api';
import { radii } from '../../src/theme';
import { formatPrice, formatNumber } from '../../src/format';

export default function Earnings() {
  const { colors, t, lang, sessionToken } = useApp();
  const [data, setData] = useState<any>({ total_earnings: 0, total_trips: 0, today_earnings: 0, today_trips: 0 });

  useEffect(() => {
    (async () => {
      try { setData(await api('/api/driver/earnings', { token: sessionToken })); } catch {}
    })();
  }, [sessionToken]);

  const Stat = ({ label, value, icon }: any) => (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: colors.primary + '22' }]}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('earnings')}</Text>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroLabel}>{t('today_earnings')}</Text>
          <Text style={styles.heroValue}>{formatPrice(data.today_earnings, lang)}</Text>
          <Text style={styles.heroSub}>{formatNumber(data.today_trips, lang)} {t('trips_count').toLowerCase()}</Text>
        </View>
        <View style={styles.grid}>
          <Stat label={t('total_earnings')} value={formatPrice(data.total_earnings, lang)} icon="wallet" />
          <Stat label={t('trips_count')} value={formatNumber(data.total_trips, lang)} icon="car" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginBottom: 20 },
  hero: { padding: 28, borderRadius: radii.xl, marginBottom: 20 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  heroValue: { color: '#fff', fontSize: 44, fontWeight: '900', marginTop: 8, letterSpacing: -1 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  grid: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, padding: 18, borderRadius: radii.lg, borderWidth: 1, marginEnd: 6, marginStart: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
});
