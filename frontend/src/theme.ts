import { useColorScheme } from 'react-native';

export type ThemeName = 'light' | 'dark';

export const themes = {
  light: {
    bg: '#FFFFFF',
    surface: '#F7F8FA',
    surfaceElevated: '#FFFFFF',
    primary: '#0066FF',
    primaryActive: '#0052CC',
    textPrimary: '#0A0A0A',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    success: '#10B981',
    error: '#EF4444',
    overlay: 'rgba(255,255,255,0.85)',
    shadow: 'rgba(0,0,0,0.08)',
  },
  dark: {
    bg: '#050505',
    surface: '#121212',
    surfaceElevated: '#1C1C1E',
    primary: '#2563EB',
    primaryActive: '#3B82F6',
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA',
    border: '#27272A',
    success: '#10B981',
    error: '#F87171',
    overlay: 'rgba(10,10,10,0.85)',
    shadow: 'rgba(0,0,0,0.4)',
  },
};

export type Theme = typeof themes.light;

export function useThemeColors(mode: ThemeName): Theme {
  return themes[mode];
}

export function useSystemTheme(): ThemeName {
  const scheme = useColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

export const radii = { sm: 10, md: 16, lg: 24, xl: 32, full: 9999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
