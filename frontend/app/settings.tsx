import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import { api } from '../src/api';
import { radii } from '../src/theme';

const CURRENCIES = ['SAR', 'USD', 'EUR', 'AED', 'GBP'];

export default function Settings() {
  const { colors, t, lang, setLang, mode, setMode, sessionToken, user, setUser, setSessionToken } = useApp();
  const router = useRouter();
  const [currency, setCurrency] = useState(user?.currency || 'SAR');
  const [twoFA, setTwoFA] = useState(!!(user as any)?.two_factor);
  const [prefs, setPrefs] = useState<any>((user as any)?.notif_prefs || { rides: true, payments: true, security: true, promos: false });

  const saveCurrency = async (c: string) => {
    setCurrency(c);
    await api('/api/profile/update', { method: 'POST', body: { currency: c }, token: sessionToken });
    if (user) setUser({ ...user, currency: c } as any);
  };

  const toggle2FA = async (v: boolean) => {
    setTwoFA(v);
    await api('/api/auth/2fa', { method: 'POST', body: { enabled: v }, token: sessionToken });
  };

  const togglePref = async (k: string, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    await api('/api/profile/update', { method: 'POST', body: { notif_prefs: next }, token: sessionToken });
  };

  const logoutAll = async () => {
    await api('/api/auth/logout-all', { method: 'POST', token: sessionToken });
    await setSessionToken(null); setUser(null);
    router.replace('/login');
  };

  const Section = ({ title, children }: any) => (
    <View style={{ marginTop: 24 }}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );

  const Row = ({ icon, label, value, onPress, right, testID }: any) => (
    <Pressable testID={testID} onPress={onPress} style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name={icon} size={18} color={colors.textPrimary} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      {right ? right : (
        <>
          {value !== undefined && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
          {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
        </>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable testID="settings-back" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.h1, { color: colors.textPrimary }]}>{t('settings')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 64 }}>
        <Section title={t('account')}>
          <Row testID="edit-profile" icon="person" label={t('edit_profile')} onPress={() => router.push('/profile-edit')} />
          {user?.role === 'driver' && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Row testID="driver-setup" icon="car-sport" label={t('vehicle_docs')} value={(user as any).verified ? t('verified') : ''} onPress={() => router.push('/driver-setup')} />
            </>
          )}
        </Section>

        <Section title={t('preferences')}>
          <Row testID="lang-row" icon="language" label={t('language')} value={lang === 'en' ? t('english') : t('arabic')} onPress={() => setLang(lang === 'en' ? 'ar' : 'en')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row testID="theme-row" icon={mode === 'dark' ? 'moon' : 'sunny'} label={t('theme')} value={mode === 'dark' ? t('dark') : t('light')} onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.rowCol}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary, marginStart: 0 }]}>{t('currency')}</Text>
            <View style={styles.pills}>
              {CURRENCIES.map((c) => (
                <Pressable
                  key={c}
                  testID={`cur-${c}`}
                  onPress={() => saveCurrency(c)}
                  style={[styles.pill, {
                    backgroundColor: currency === c ? colors.primary : colors.surfaceElevated,
                    borderColor: currency === c ? colors.primary : colors.border,
                  }]}
                >
                  <Text style={{ color: currency === c ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Section>

        <Section title={t('security')}>
          <Row icon="shield-checkmark" label={t('two_factor')} right={<Switch testID="toggle-2fa" value={twoFA} onValueChange={toggle2FA} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row testID="change-pin" icon="key" label={t('change_pin')} onPress={() => router.push('/change-pin')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row testID="verify-phone" icon="call" label={t('verify_phone')} value={(user as any)?.phone_verified ? t('verified') : ''} onPress={() => router.push('/verify-phone')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row testID="logout-all" icon="log-out" label={t('logout_all')} onPress={() => {
            if (typeof window !== 'undefined' && window.confirm) { if (window.confirm(t('logout_all') + '?')) logoutAll(); }
            else Alert.alert(t('logout_all'), '', [{ text: t('cancel') }, { text: 'OK', onPress: logoutAll }]);
          }} />
        </Section>

        <Section title={t('notifications')}>
          {(['rides', 'payments', 'security', 'promos'] as const).map((k, i) => (
            <React.Fragment key={k}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <Row
                icon={k === 'rides' ? 'car' : k === 'payments' ? 'card' : k === 'security' ? 'shield' : 'megaphone'}
                label={t('notif_' + k)}
                right={<Switch testID={`pref-${k}`} value={!!prefs[k]} onValueChange={(v) => togglePref(k, v)} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />}
              />
            </React.Fragment>
          ))}
        </Section>

        <Section title={t('payment')}>
          <Row testID="pay-methods" icon="card" label={t('payment_methods')} onPress={() => router.push('/payment-methods')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row testID="pay-history" icon="receipt" label={t('payment_history')} onPress={() => router.push('/payment-history')} />
        </Section>

        <Section title={t('support_help')}>
          <Row testID="help-center" icon="help-circle" label={t('help_center')} onPress={() => router.push('/help')} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row testID="contact-support" icon="chatbubbles" label={t('contact_support')} onPress={() => router.push('/help?tab=support')} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  h1: { fontSize: 22, fontWeight: '800' },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  section: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowCol: { padding: 14 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', marginStart: 12 },
  rowValue: { fontSize: 13, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginEnd: 8, marginBottom: 6 },
});
