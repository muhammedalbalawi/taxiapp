import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';
import MapView from '../../src/MapView';
import Button from '../../src/Button';
import { api } from '../../src/api';
import { radii } from '../../src/theme';

// Mock city coords (Dubai-ish for premium vibe)
const CITY = { lat: 25.2048, lng: 55.2708 };

const RIDE_TYPES = [
  { key: 'economy', icon: 'car', desc: '3 min', multi: 1.0 },
  { key: 'comfort', icon: 'car-sport', desc: '4 min', multi: 1.35 },
  { key: 'premium', icon: 'car-sport-outline', desc: '5 min', multi: 1.9 },
] as const;

type Phase = 'idle' | 'choose' | 'searching' | 'matched' | 'on_trip' | 'done';

export default function CustomerHome() {
  const { colors, t, sessionToken, user } = useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [rideType, setRideType] = useState<string>('economy');
  const [estimate, setEstimate] = useState<any>(null);
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Mock pickup/destination
  const pickup = { lat: CITY.lat, lng: CITY.lng, address: 'Downtown Dubai' };
  const destination = { lat: CITY.lat + 0.03, lng: CITY.lng + 0.04, address: 'Dubai Marina' };

  useEffect(() => {
    if (phase === 'choose') {
      (async () => {
        try {
          const est = await api('/api/rides/estimate', {
            method: 'POST',
            body: { pickup, destination, ride_type: rideType },
          });
          setEstimate(est);
        } catch {}
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideType, phase]);

  const requestRide = async () => {
    setLoading(true);
    try {
      const t1 = await api('/api/rides/request', {
        method: 'POST',
        body: { pickup, destination, ride_type: rideType },
        token: sessionToken,
      });
      setTrip(t1);
      setPhase('searching');
      // Simulate driver match
      setTimeout(async () => {
        try {
          const matched = await api(`/api/rides/${t1.trip_id}/assign`, {
            method: 'POST',
            token: sessionToken,
          });
          setTrip(matched);
          setPhase('matched');
        } catch {}
      }, 2200);
    } finally {
      setLoading(false);
    }
  };

  const startTrip = async () => {
    await api(`/api/rides/${trip.trip_id}/status?status=on_trip`, { method: 'POST', token: sessionToken });
    setPhase('on_trip');
    setTimeout(async () => {
      await api(`/api/rides/${trip.trip_id}/status?status=completed`, { method: 'POST', token: sessionToken });
      setPhase('done');
    }, 2500);
  };

  const rateAndClose = async (rating: number) => {
    await api(`/api/rides/${trip.trip_id}/rate`, { method: 'POST', body: { rating }, token: sessionToken });
    setPhase('idle');
    setTrip(null);
    setEstimate(null);
  };

  const markers = [
    { lat: pickup.lat, lng: pickup.lng, color: '#0066FF', pulse: phase === 'searching' },
    ...(phase !== 'idle' ? [{ lat: destination.lat, lng: destination.lng, color: '#10B981' }] : []),
    ...(trip?.driver ? [{ lat: trip.driver.lat, lng: trip.driver.lng, color: '#F59E0B' }] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <MapView center={pickup} markers={markers} zoom={13} />

      {/* Header glass chip */}
      <View style={[styles.topChip, { backgroundColor: colors.overlay, borderColor: colors.border }]}>
        <Ionicons name="location" size={16} color={colors.primary} />
        <Text style={[styles.topChipTxt, { color: colors.textPrimary }]}>
          {t('welcome')}, {user?.name?.split(' ')[0] || ''}
        </Text>
      </View>

      {/* Bottom sheet */}
      <View
        testID="bottom-sheet"
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceElevated,
            shadowColor: '#000',
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {phase === 'idle' && (
          <View>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('where_to')}</Text>
            <Pressable
              testID="open-destination"
              onPress={() => setPhase('choose')}
              style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.inputTxt, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                {pickup.address}
              </Text>
            </Pressable>
            <View style={{ height: 10 }} />
            <Pressable
              onPress={() => setPhase('choose')}
              style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.inputTxt, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                {destination.address}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}

        {phase === 'choose' && (
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('choose_ride')}</Text>
            {RIDE_TYPES.map((r) => {
              const sel = rideType === r.key;
              const price = estimate ? (estimate.price * (r.multi / RIDE_TYPES.find(x => x.key === rideType)!.multi)).toFixed(2) : '--';
              return (
                <Pressable
                  key={r.key}
                  testID={`ride-${r.key}`}
                  onPress={() => setRideType(r.key)}
                  style={[
                    styles.rideCard,
                    {
                      backgroundColor: sel ? colors.primary + '0D' : colors.surface,
                      borderColor: sel ? colors.primary : colors.border,
                      borderWidth: sel ? 2 : 1,
                    },
                  ]}
                >
                  <View style={[styles.carIcon, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons name={r.icon as any} size={26} color={sel ? colors.primary : colors.textPrimary} />
                  </View>
                  <View style={{ flex: 1, marginStart: 14 }}>
                    <Text style={[styles.rideName, { color: colors.textPrimary }]}>{t(r.key)}</Text>
                    <Text style={[styles.rideDesc, { color: colors.textSecondary }]}>{r.desc} • {t('cash')}</Text>
                  </View>
                  <Text style={[styles.price, { color: colors.textPrimary }]}>${price}</Text>
                </Pressable>
              );
            })}
            <View style={{ height: 14 }} />
            <Button testID="confirm-ride" label={t('confirm')} onPress={requestRide} loading={loading} />
            <Pressable onPress={() => setPhase('idle')} style={{ alignItems: 'center', padding: 14 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('cancel')}</Text>
            </Pressable>
          </ScrollView>
        )}

        {phase === 'searching' && (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 16 }]}>{t('searching_driver')}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('loading')}</Text>
          </View>
        )}

        {phase === 'matched' && trip?.driver && (
          <View>
            <Text style={[styles.h3, { color: colors.textPrimary }]}>{t('driver_on_way')}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary, marginBottom: 16 }]}>
              {t('arriving_in')} {trip.driver.eta_min} {t('min')}
            </Text>
            <View style={[styles.driverCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Ionicons name="person" size={28} color="#fff" />
              </View>
              <View style={{ flex: 1, marginStart: 14 }}>
                <Text style={[styles.driverName, { color: colors.textPrimary }]}>{trip.driver.name}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>{trip.driver.car} • {trip.driver.plate}</Text>
              </View>
              <View style={styles.rating}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={[styles.ratingTxt, { color: colors.textPrimary }]}>{trip.driver.rating}</Text>
              </View>
            </View>
            <View style={{ height: 14 }} />
            <Button testID="start-trip" label={t('on_trip')} onPress={startTrip} />
          </View>
        )}

        {phase === 'on_trip' && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <View style={[styles.chip, { backgroundColor: colors.success + '22' }]}>
              <View style={[styles.chipDot, { backgroundColor: colors.success }]} />
              <Text style={[{ color: colors.success, fontWeight: '700' }]}>{t('on_trip')}</Text>
            </View>
            <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 14 }]}>{destination.address}</Text>
          </View>
        )}

        {phase === 'done' && trip && (
          <View>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('trip_completed')}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {t('total')}: ${trip.price} • {trip.distance_km} {t('km')}
            </Text>
            <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 20 }]}>{t('rate_trip')}</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable
                  key={i}
                  testID={`rate-${i}`}
                  onPress={() => rateAndClose(i)}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="star" size={36} color="#F59E0B" />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topChip: {
    position: 'absolute', top: 60, alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  topChipTxt: { fontSize: 13, fontWeight: '600', marginStart: 6 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 32,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 20,
  },
  handle: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  h2: { fontSize: 24, fontWeight: '800', marginBottom: 16, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  sub: { fontSize: 14, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, gap: 12 },
  inputTxt: { fontSize: 15, fontWeight: '500', marginStart: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rideCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 10 },
  carIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rideName: { fontSize: 16, fontWeight: '700' },
  rideDesc: { fontSize: 13, marginTop: 2 },
  price: { fontSize: 17, fontWeight: '800' },
  driverCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1 },
  avatar: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 16, fontWeight: '700' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingTxt: { fontSize: 14, fontWeight: '700', marginStart: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, gap: 8 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  starRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
});
