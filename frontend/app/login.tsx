import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import Button from '../src/Button';
import { radii } from '../src/theme';

export default function Login() {
  const { colors, t, lang, setLang } = useApp();

  const signIn = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = window.location.origin + '/';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    } else {
      // On native, open in-app browser
      const redirectUrl = process.env.EXPO_PUBLIC_BACKEND_URL + '/';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const WebBrowser = require('expo-web-browser');
      WebBrowser.openAuthSessionAsync(
        `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`,
        redirectUrl
      );
    }
  };

  const toggleLang = () => setLang(lang === 'en' ? 'ar' : 'en');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.topRow}>
        <Pressable
          testID="toggle-lang"
          onPress={toggleLang}
          style={[styles.langBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="language" size={16} color={colors.textPrimary} />
          <Text style={[styles.langTxt, { color: colors.textPrimary }]}>
            {lang === 'en' ? 'العربية' : 'English'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={[styles.logoBig, { backgroundColor: colors.primary }]}>
          <Ionicons name="navigate" size={56} color="#fff" />
        </View>
        <Text style={[styles.brand, { color: colors.textPrimary }]}>{t('app_name')}</Text>
        <Text style={[styles.tag, { color: colors.textSecondary }]}>{t('tagline')}</Text>
      </View>

      <View style={styles.bottom}>
        <Button
          testID="google-signin"
          label={t('continue_google')}
          onPress={signIn}
          icon={<Ionicons name="logo-google" size={20} color="#fff" />}
        />
        <Text style={[styles.terms, { color: colors.textSecondary }]}>{t('by_continuing')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  topRow: { alignItems: 'flex-end', marginTop: 8 },
  langBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, borderWidth: 1, gap: 6 },
  langTxt: { fontSize: 13, fontWeight: '600', marginStart: 6 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoBig: { width: 120, height: 120, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  brand: { fontSize: 56, fontWeight: '900', letterSpacing: -1.5 },
  tag: { fontSize: 17, marginTop: 10, fontWeight: '500' },
  bottom: { paddingBottom: 24 },
  terms: { fontSize: 12, textAlign: 'center', marginTop: 14 },
});
