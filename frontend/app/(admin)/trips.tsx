import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../src/AppContext';
import { api } from '../../src/api';

export default function AdminTrips() {
  const { colors, t, sessionToken } = useApp();
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try { setTrips(await api('/api/admin/trips', { token: sessionToken })); } catch {}
    })();
  }, [sessionToken]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('trips')}</Text>
      <FlatList
        data={trips}
        keyExtractor={(x) => x.trip_id}
        contentContainerStyle={{ padding: 24, paddingTop: 8 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.topRow}>
              <Text style={[styles.type, { color: colors.primary }]}>{t(item.ride_type)}</Text>
              <Text style={[styles.price, { color: colors.textPrimary }]}>${item.price}</Text>
            </View>
            <Text style={[styles.status, { color: colors.textSecondary }]}>
              {item.status} • {item.distance_km} {t('km')}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5, paddingHorizontal: 24, paddingTop: 24 },
  card: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between' },
  type: { fontWeight: '700', fontSize: 14, textTransform: 'capitalize' },
  price: { fontSize: 18, fontWeight: '800' },
  status: { fontSize: 13, marginTop: 6, textTransform: 'capitalize' },
});
