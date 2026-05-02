import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import Button from '../src/Button';
import { api } from '../src/api';
import { radii } from '../src/theme';

export default function ChangePin() {
  const { colors, t, sessionToken } = useApp();
  const router = useRouter();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setMsg('');
    if (p1.length < 4) { setMsg('PIN too short'); return; }
    if (p1 !== p2) { setMsg('PINs do not match'); return; }
    setSaving(true);
    try {
      await api('/api/auth/pin/set', { method: 'POST', body: { pin: p1 }, token: sessionToken });
      setMsg(t('pin_updated'));
      setTimeout(() => router.back(), 600);
    } catch (e: any) {
      setMsg(e.message || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('change_pin')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={{ padding: 24 }}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('new_pin')}</Text>
        <TextInput
          testID="pin-1"
          value={p1}
          onChangeText={setP1}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
        />
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('confirm_pin')}</Text>
        <TextInput
          testID="pin-2"
          value={p2}
          onChangeText={setP2}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
        />
        {!!msg && <Text style={{ color: msg.includes('updated') ? colors.success : colors.error, marginTop: 10 }}>{msg}</Text>}
        <View style={{ height: 20 }} />
        <Button testID="save-pin" label={t('save')} onPress={save} loading={saving} />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  input: { height: 56, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, fontSize: 18, textAlign: 'center', letterSpacing: 8 },
});
