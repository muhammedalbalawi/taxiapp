import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../src/AppContext';
import { api } from '../src/api';

export default function Notifications() {
  const { colors, t, sessionToken } = useApp();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api('/api/notifications', { token: sessionToken })); } catch {}
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const markAll = async () => { await api('/api/notifications/read', { method: 'POST', token: sessionToken }); load(); };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable testID="notif-back" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('notifications')}</Text>
        <Pressable onPress={markAll}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('mark_all_read')}</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(x) => x.notif_id}
        contentContainerStyle={{ padding: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={54} color={colors.textSecondary} />
            <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>{t('no_notifs')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: item.read ? colors.surface : colors.primary + '0D', borderColor: colors.border }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginStart: 14 }}>
              <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
              {!!item.body && <Text style={[styles.itemBody, { color: colors.textSecondary }]}>{item.body}</Text>}
            </View>
            {!item.read && <View style={[styles.unread, { backgroundColor: colors.primary }]} />}
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
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTxt: { marginTop: 14, fontSize: 15 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700' },
  itemBody: { fontSize: 13, marginTop: 2 },
  unread: { width: 8, height: 8, borderRadius: 4 },
});
