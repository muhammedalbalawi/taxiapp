import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';
import { api } from '../../src/api';
import { radii } from '../../src/theme';

export default function Profile() {
  const { colors, t, user, lang, setLang, mode, setMode, setUser, setSessionToken, sessionToken } = useApp();
  const router = useRouter();

  const logout = async () => {
    try { await api('/api/auth/logout', { method: 'POST', token: sessionToken }); } catch {}
    await setSessionToken(null);
    setUser(null);
    router.replace('/login');
  };

  const Section = ({ title, children }: any) => (
    <View style={{ marginTop: 24 }}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );

  const Row = ({ icon, label, value, onPress, testID }: any) => (
    <Pressable testID={testID} onPress={onPress} style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name={icon} size={18} color={colors.textPrimary} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('profile')}</Text>

        <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarTxt}>{(user?.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginStart: 16 }}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.primary + '22' }]}>
              <Text style={[styles.roleTxt, { color: colors.primary }]}>{user?.role}</Text>
            </View>
          </View>
        </View>

        <Section title={t('notifications')}>
          <Row
            testID="open-notifs"
            icon="notifications"
            label={t('notifications')}
            value=""
            onPress={() => router.push('/notifications')}
          />
        </Section>

        <Section title={t('settings')}>
          <Row
            testID="switch-lang"
            icon="language"
            label={t('language')}
            value={lang === 'en' ? t('english') : t('arabic')}
            onPress={() => setLang(lang === 'en' ? 'ar' : 'en')}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row
            testID="switch-theme"
            icon={mode === 'dark' ? 'moon' : 'sunny'}
            label={t('theme')}
            value={mode === 'dark' ? t('dark') : t('light')}
            onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          />
        </Section>

        <Section title={t('payment')}>
          <Row icon="cash" label={t('cash')} value="USD" />
        </Section>

        <Pressable
          testID="logout-btn"
          onPress={logout}
          style={[styles.logout, { backgroundColor: colors.error + '15', borderColor: colors.error + '44' }]}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={[styles.logoutTxt, { color: colors.error }]}>{t('logout')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginBottom: 24 },
  userCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: radii.lg, borderWidth: 1 },
  avatar: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 28, fontWeight: '800' },
  userName: { fontSize: 20, fontWeight: '800' },
  userEmail: { fontSize: 13, marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  roleTxt: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  section: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600', marginStart: 12 },
  rowValue: { fontSize: 14, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: 16 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 32, padding: 16, borderRadius: radii.md, borderWidth: 1 },
  logoutTxt: { fontSize: 15, fontWeight: '700', marginStart: 8 },
});
