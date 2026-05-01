import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';
import { Lang, t as tr } from './i18n';
import { ThemeName, themes, Theme } from './theme';

type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'customer' | 'driver' | 'admin';
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  mode: ThemeName;
  setMode: (m: ThemeName) => Promise<void>;
  colors: Theme;
  t: (k: string) => string;
  user: User | null;
  setUser: (u: User | null) => void;
  sessionToken: string | null;
  setSessionToken: (s: string | null) => Promise<void>;
  isRTL: boolean;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [mode, setModeState] = useState<ThemeName>('light');
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionTokenState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const [storedLang, storedMode, storedTok] = await Promise.all([
        AsyncStorage.getItem('lang'),
        AsyncStorage.getItem('mode'),
        AsyncStorage.getItem('session_token'),
      ]);
      const finalLang: Lang = storedLang === 'ar' || storedLang === 'en'
        ? storedLang
        : 'en';
      const finalMode: ThemeName = storedMode === 'dark' ? 'dark' : 'light';
      setLangState(finalLang);
      setModeState(finalMode);
      if (storedTok) setSessionTokenState(storedTok);
      // RTL setup
      if (Platform.OS !== 'web') {
        const wantRTL = finalLang === 'ar';
        if (I18nManager.isRTL !== wantRTL) {
          I18nManager.allowRTL(wantRTL);
          I18nManager.forceRTL(wantRTL);
        }
      }
      setHydrated(true);
    })();
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem('lang', l);
    if (Platform.OS !== 'web') {
      I18nManager.allowRTL(l === 'ar');
      I18nManager.forceRTL(l === 'ar');
    }
  }, []);

  const setMode = useCallback(async (m: ThemeName) => {
    setModeState(m);
    await AsyncStorage.setItem('mode', m);
  }, []);

  const setSessionToken = useCallback(async (s: string | null) => {
    setSessionTokenState(s);
    if (s) await AsyncStorage.setItem('session_token', s);
    else await AsyncStorage.removeItem('session_token');
  }, []);

  if (!hydrated) return null;

  const value: Ctx = {
    lang, setLang,
    mode, setMode,
    colors: themes[mode],
    t: (k: string) => tr(lang, k),
    user, setUser,
    sessionToken, setSessionToken,
    isRTL: lang === 'ar',
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be within AppProvider');
  return ctx;
}
