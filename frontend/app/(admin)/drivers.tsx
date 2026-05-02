import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../src/AppContext';
import { api } from '../../src/api';

export default function AdminDrivers() {
  const { colors, t, sessionToken } = useApp();
  const [drivers, setDrivers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try { setDrivers(await api('/api/admin/drivers', { token: sessionToken })); } catch {}
    })();
  }, [sessionToken]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('drivers')}</Text>
      <FlatList
        data={drivers}
        keyExtractor={(u) => u.user_id}
        contentContainerStyle={{ padding: 24, paddingTop: 8 }}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarTxt}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginStart: 14 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>{item.email}</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: (item.online ? colors.success : colors.textSecondary) + '22' }]}>
              <View style={[styles.dot, { backgroundColor: item.online ? colors.success : colors.textSecondary }]} />
              <Text style={[styles.statusTxt, { color: item.online ? colors.success : colors.textSecondary }]}>
                {item.online ? t('online') : t('offline')}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5, paddingHorizontal: 24, paddingTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '800', fontSize: 18 },
  name: { fontSize: 15, fontWeight: '700' },
  email: { fontSize: 12, marginTop: 2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginStart: 4 },
});
