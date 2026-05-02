import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import Button from '../src/Button';
import { api } from '../src/api';
import { radii } from '../src/theme';

export default function ProfileEdit() {
  const { colors, t, user, setUser, sessionToken } = useApp();
  const router = useRouter();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState((user as any)?.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api('/api/profile/update', { method: 'POST', body: { name, phone }, token: sessionToken });
      if (user) setUser({ ...user, name, phone } as any);
      router.back();
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('edit_profile')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarTxt}>{(name || '?').charAt(0).toUpperCase()}</Text>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('name') || 'Name'}</Text>
        <TextInput
          testID="input-name"
          value={name}
          onChangeText={setName}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('phone_number')}</Text>
        <TextInput
          testID="input-phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+966 5X XXX XXXX"
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
        <View style={[styles.input, styles.readonly, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 15 }}>{user?.email}</Text>
        </View>

        <View style={{ height: 20 }} />
        <Button testID="save-profile" label={t('save')} onPress={save} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  avatar: { width: 100, height: 100, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: 20 },
  avatarTxt: { color: '#fff', fontSize: 42, fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  input: { height: 56, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
  readonly: { justifyContent: 'center' },
});
