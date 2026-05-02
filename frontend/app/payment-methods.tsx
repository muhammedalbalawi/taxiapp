import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import Button from '../src/Button';
import { api } from '../src/api';
import { radii } from '../src/theme';

const KIND_ICONS: any = { cash: 'cash', card: 'card', apple_pay: 'logo-apple', stc_pay: 'wallet' };

export default function PaymentMethods() {
  const { colors, t, sessionToken } = useApp();
  const router = useRouter();
  const [methods, setMethods] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [kind, setKind] = useState<'card' | 'apple_pay' | 'stc_pay'>('card');
  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');

  const load = useCallback(async () => {
    try { setMethods(await api('/api/payments/methods', { token: sessionToken })); } catch {}
  }, [sessionToken]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    await api('/api/payments/methods', {
      method: 'POST',
      body: { kind, label: label || kind.toUpperCase(), last4: last4 || undefined, brand: kind === 'card' ? 'Visa' : undefined },
      token: sessionToken,
    });
    setShow(false); setLabel(''); setLast4('');
    load();
  };

  const remove = async (id: string) => {
    await api(`/api/payments/methods/${id}`, { method: 'DELETE', token: sessionToken });
    load();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('payment_methods')}</Text>
        <Pressable testID="add-method" onPress={() => setShow(true)}><Ionicons name="add" size={28} color={colors.primary} /></Pressable>
      </View>
      <FlatList
        data={methods}
        keyExtractor={(m) => m.method_id}
        contentContainerStyle={{ padding: 24 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 80 }}>
            <Ionicons name="card-outline" size={54} color={colors.textSecondary} />
            <Text style={{ marginTop: 12, color: colors.textSecondary }}>{t('no_methods')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.ico, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name={KIND_ICONS[item.kind] || 'card'} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginStart: 14 }}>
              <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>{item.label}</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                {item.brand ? `${item.brand} • ` : ''}{item.last4 ? `•••• ${item.last4}` : item.kind}
              </Text>
            </View>
            <Pressable onPress={() => remove(item.method_id)}><Ionicons name="trash" size={20} color={colors.error} /></Pressable>
          </View>
        )}
      />

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modal, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.mTitle, { color: colors.textPrimary }]}>{t('add_method')}</Text>
            <View style={styles.pills}>
              {(['card', 'apple_pay', 'stc_pay'] as const).map((k) => (
                <Pressable
                  key={k}
                  testID={`pm-kind-${k}`}
                  onPress={() => setKind(k)}
                  style={[styles.pill, { backgroundColor: kind === k ? colors.primary : colors.surface, borderColor: kind === k ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: kind === k ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>{t(k)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              testID="pm-label"
              value={label}
              onChangeText={setLabel}
              placeholder="Label (e.g. Personal Visa)"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            />
            {kind === 'card' && (
              <TextInput
                testID="pm-last4"
                value={last4}
                onChangeText={setLast4}
                placeholder="Last 4 digits"
                placeholderTextColor={colors.textSecondary}
                maxLength={4}
                keyboardType="number-pad"
                style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
              />
            )}
            <View style={{ height: 12 }} />
            <Button testID="pm-save" label={t('save')} onPress={add} />
            <Pressable onPress={() => setShow(false)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary }}>{t('cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  ico: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { padding: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 32 },
  mTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginEnd: 6 },
  input: { height: 52, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, marginBottom: 10 },
});
