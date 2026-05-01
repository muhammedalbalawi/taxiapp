import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';
import { api } from '../../src/api';

export default function Rides() {
  const { colors, t, sessionToken } = useApp();
  const [trips, setTrips] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/rides/mine', { token: sessionToken });
      setTrips(data);
    } catch {}
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('rides')}</Text>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.trip_id}
        contentContainerStyle={{ padding: 24, paddingTop: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={54} color={colors.textSecondary} />
            <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>{t('no_trips')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardTop}>
              <Text style={[styles.cardType, { color: colors.primary }]}>
                {t(item.ride_type)} • {item.status}
              </Text>
              <Text style={[styles.cardPrice, { color: colors.textPrimary }]}>${item.price}</Text>
            </View>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.addr, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.pickup?.address || `${item.pickup?.lat?.toFixed(3)}, ${item.pickup?.lng?.toFixed(3)}`}
              </Text>
            </View>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.addr, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.destination?.address || `${item.destination?.lat?.toFixed(3)}, ${item.destination?.lng?.toFixed(3)}`}
              </Text>
            </View>
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              {item.distance_km} {t('km')} • {item.duration_min} {t('min')}
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
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { marginTop: 14, fontSize: 15 },
  card: { borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardType: { fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
  cardPrice: { fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  addr: { fontSize: 14, fontWeight: '500', flex: 1, marginStart: 10 },
  date: { fontSize: 12, marginTop: 8 },
});
