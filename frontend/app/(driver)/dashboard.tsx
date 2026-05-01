import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';
import MapView from '../../src/MapView';
import Button from '../../src/Button';
import { api } from '../../src/api';
import { radii } from '../../src/theme';

const CITY = { lat: 25.2048, lng: 55.2708 };

export default function DriverDashboard() {
  const { colors, t, sessionToken, user } = useApp();
  const [online, setOnline] = useState(false);
  const [incoming, setIncoming] = useState<any>(null);

  const toggleOnline = async (v: boolean) => {
    setOnline(v);
    try {
      await api('/api/driver/status', {
        method: 'POST',
        body: { online: v, lat: CITY.lat, lng: CITY.lng },
        token: sessionToken,
      });
      if (v) {
        // Simulate incoming request after a moment
        setTimeout(() => {
          setIncoming({
            id: 'mock_' + Date.now(),
            customer: 'Sarah M.',
            pickup: 'Downtown Dubai',
            destination: 'Dubai Marina',
            distance: 8.2,
            fare: 18.50,
          });
        }, 2500);
      } else {
        setIncoming(null);
      }
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <MapView center={CITY} markers={[{ lat: CITY.lat, lng: CITY.lng, color: colors.primary, pulse: online }]} zoom={13} />

      <SafeAreaView style={styles.topSafe} edges={['top']}>
        <View style={[styles.statusChip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={[styles.chipDot, { backgroundColor: online ? colors.success : colors.textSecondary }]} />
          <Text style={[styles.statusTxt, { color: colors.textPrimary }]}>
            {online ? t('online') : t('offline')}
          </Text>
          <Switch
            testID="online-switch"
            value={online}
            onValueChange={toggleOnline}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </View>
      </SafeAreaView>

      <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {!incoming ? (
          <View style={{ paddingVertical: 8 }}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>
              {t('welcome')}, {user?.name?.split(' ')[0] || ''}
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {online ? t('searching_driver').replace('driver', 'rides') : t('go_online')}
            </Text>
            <View style={{ height: 16 }} />
            {!online && (
              <Button
                testID="go-online-btn"
                label={t('go_online')}
                onPress={() => toggleOnline(true)}
              />
            )}
          </View>
        ) : (
          <View>
            <Text style={[styles.h2, { color: colors.primary }]}>{t('incoming_request')}</Text>
            <View style={[styles.reqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.reqRow}>
                <Ionicons name="person" size={18} color={colors.textPrimary} />
                <Text style={[styles.reqName, { color: colors.textPrimary }]}>{incoming.customer}</Text>
                <Text style={[styles.reqFare, { color: colors.success }]}>${incoming.fare}</Text>
              </View>
              <View style={[styles.reqRow, { marginTop: 10 }]}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.reqAddr, { color: colors.textPrimary }]}>{incoming.pickup}</Text>
              </View>
              <View style={[styles.reqRow, { marginTop: 6 }]}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text style={[styles.reqAddr, { color: colors.textPrimary }]}>{incoming.destination}</Text>
              </View>
              <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 8 }]}>
                {incoming.distance} {t('km')}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <Pressable
                testID="decline-btn"
                onPress={() => setIncoming(null)}
                style={[styles.declineBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }]}>{t('decline')}</Text>
              </Pressable>
              <Pressable
                testID="accept-btn"
                onPress={() => setIncoming(null)}
                style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{t('accept')}</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 30, borderWidth: 1, marginTop: 12,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 14, fontWeight: '700', marginStart: 6, marginEnd: 4 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 34,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 20,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  h2: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 14, marginTop: 6 },
  reqCard: { marginTop: 14, padding: 16, borderRadius: 18, borderWidth: 1 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reqName: { flex: 1, fontSize: 16, fontWeight: '700', marginStart: 10 },
  reqFare: { fontSize: 18, fontWeight: '800' },
  reqAddr: { flex: 1, fontSize: 14, fontWeight: '500', marginStart: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  declineBtn: { flex: 1, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { flex: 2, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginStart: 12 },
});
