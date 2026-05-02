import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import { api } from '../src/api';
import { formatPrice } from '../src/format';

export default function PaymentHistory() {
  const { colors, t, lang, sessionToken } = useApp();
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try { setTrips(await api('/api/payments/history', { token: sessionToken })); } catch {}
    })();
  }, [sessionToken]);

  const refund = async (tripId: string) => {
    await api('/api/payments/refund', { method: 'POST', body: { trip_id: tripId, reason: 'requested' }, token: sessionToken });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('payment_history')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <FlatList
        data={trips}
        keyExtractor={(t) => t.trip_id}
        contentContainerStyle={{ padding: 24 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.topRow}>
              <Text style={[styles.method, { color: colors.primary }]}>{item.payment_method || 'cash'}</Text>
              <Text style={[styles.price, { color: colors.textPrimary }]}>{formatPrice(item.price, lang)}</Text>
            </View>
            <Text style={[styles.addr, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.pickup?.address || ''} → {item.destination?.address || ''}
            </Text>
            <View style={styles.actions}>
              <Pressable testID={`invoice-${item.trip_id}`} style={[styles.btn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{t('invoice')}</Text>
              </Pressable>
              <Pressable testID={`refund-${item.trip_id}`} onPress={() => refund(item.trip_id)} style={[styles.btn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>{t('refund')}</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  method: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  price: { fontSize: 18, fontWeight: '800' },
  addr: { fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginEnd: 8 },
});
