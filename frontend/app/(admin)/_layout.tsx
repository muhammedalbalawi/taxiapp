import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';

export default function AdminLayout() {
  const { colors, t } = useApp();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surfaceElevated,
          borderTopColor: colors.border, borderTopWidth: 1,
          height: 72, paddingTop: 8, paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const name =
            route.name === 'dashboard' ? 'stats-chart'
            : route.name === 'users' ? 'people'
            : route.name === 'drivers' ? 'car-sport'
            : route.name === 'trips' ? 'car'
            : 'person-circle';
          return <Ionicons name={name as any} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: t('dashboard') }} />
      <Tabs.Screen name="drivers" options={{ title: t('drivers') }} />
      <Tabs.Screen name="users" options={{ title: t('users') }} />
      <Tabs.Screen name="trips" options={{ title: t('trips') }} />
      <Tabs.Screen name="profile" options={{ title: t('profile') }} />
    </Tabs>
  );
}
