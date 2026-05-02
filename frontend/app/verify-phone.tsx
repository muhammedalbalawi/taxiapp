import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import Button from '../src/Button';
import { api } from '../src/api';
import { radii } from '../src/theme';

export default function VerifyPhone() {
  const { colors, t, sessionToken, user, setUser } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<'send' | 'verify'>('send');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    try {
      const r = await api('/api/auth/otp/send', { method: 'POST', body: { channel: 'phone' }, token: sessionToken });
      setDevCode(r.dev_code || '');
      setStep('verify');
      setMsg(t('code_sent') + (r.dev_code ? ` (dev: ${r.dev_code})` : ''));
    } finally { setLoading(false); }
  };

  const verify = async () => {
    setLoading(true); setMsg('');
    try {
      await api('/api/auth/otp/verify', { method: 'POST', body: { channel: 'phone', code }, token: sessionToken });
      if (user) setUser({ ...user, phone_verified: true } as any);
      setMsg(t('verified'));
      setTimeout(() => router.back(), 500);
    } catch (e: any) {
      setMsg(e.message);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('verify_phone')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={{ padding: 24 }}>
        {step === 'send' ? (
          <>
            <Text style={[styles.p, { color: colors.textSecondary }]}>
              We'll send a 6-digit code to your phone.
            </Text>
            <View style={{ height: 20 }} />
            <Button testID="send-otp" label={t('send')} onPress={send} loading={loading} />
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('enter_code')}</Text>
            <TextInput
              testID="otp-code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            />
            {!!msg && <Text style={{ color: msg.includes('nvalid') ? colors.error : colors.success, marginTop: 10 }}>{msg}</Text>}
            <View style={{ height: 16 }} />
            <Button testID="verify-otp" label={t('submit')} onPress={verify} loading={loading} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  p: { fontSize: 14, marginTop: 12 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  input: { height: 64, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, fontSize: 28, textAlign: 'center', letterSpacing: 12, fontWeight: '800' },
});
