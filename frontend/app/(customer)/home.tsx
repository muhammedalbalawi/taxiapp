import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';
import MapView from '../../src/MapView';
import Button from '../../src/Button';
import { api } from '../../src/api';
import { radii } from '../../src/theme';
import { formatPrice } from '../../src/format';

const CITY = { lat: 24.7136, lng: 46.6753 }; // Riyadh

const RIDE_TYPES = [
  { key: 'economy', icon: 'car', desc: '3 min' },
  { key: 'comfort', icon: 'car-sport', desc: '4 min' },
  { key: 'premium', icon: 'car-sport-outline', desc: '5 min' },
] as const;

const PAY_METHODS = [
  { key: 'cash', icon: 'cash' },
  { key: 'card', icon: 'card' },
  { key: 'apple_pay', icon: 'logo-apple' },
] as const;

type Phase = 'idle' | 'choose' | 'searching' | 'offered' | 'accepted' | 'on_trip' | 'done' | 'no_driver';

export default function CustomerHome() {
  const { colors, t, lang, sessionToken, user } = useApp();
  const [phase, setPhase] = useState<Phase>('idle');
  const [rideType, setRideType] = useState<string>('economy');
  const [payment, setPayment] = useState<string>('cash');
  const [estimate, setEstimate] = useState<any>(null);
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pickup, setPickup] = useState({ lat: CITY.lat, lng: CITY.lng, address: 'Riyadh Downtown' });
  const [destination, setDestination] = useState({ lat: CITY.lat + 0.03, lng: CITY.lng + 0.04, address: 'Kingdom Centre' });
  const [picking, setPicking] = useState<'pickup' | 'destination' | null>(null);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const est = await api('/api/rides/estimate', {
          method: 'POST',
          body: { pickup, destination, ride_type: rideType },
        });
        setEstimate(est);
      } catch {}
    })();
  }, [rideType, pickup.lat, pickup.lng, destination.lat, destination.lng]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const pollTrip = (tripId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const t1 = await api(`/api/rides/${tripId}`, { token: sessionToken });
        setTrip(t1);
        if (t1.status === 'accepted' || t1.status === 'arriving') setPhase('accepted');
        else if (t1.status === 'on_trip') setPhase('on_trip');
        else if (t1.status === 'completed') { setPhase('done'); clearInterval(pollRef.current); }
        else if (t1.status === 'no_driver') { setPhase('no_driver'); clearInterval(pollRef.current); }
        else if (t1.status === 'offered') setPhase('offered');
      } catch {}
    }, 2500);
  };

  const requestRide = async () => {
    setLoading(true);
    try {
      const created = await api('/api/rides/request', {
        method: 'POST',
        body: { pickup, destination, ride_type: rideType, payment_method: payment },
        token: sessionToken,
      });
      setTrip(created);
      setPhase(created.status === 'offered' ? 'offered' : created.status === 'no_driver' ? 'no_driver' : 'searching');
      pollTrip(created.trip_id);
    } catch (e) {
      console.log(e);
    } finally { setLoading(false); }
  };

  const cancelTrip = async () => {
    if (trip) {
      try { await api(`/api/rides/${trip.trip_id}/status?status=cancelled`, { method: 'POST', token: sessionToken }); } catch {}
    }
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase('idle'); setTrip(null);
  };

  const rateAndClose = async (rating: number) => {
    await api(`/api/rides/${trip.trip_id}/rate`, { method: 'POST', body: { rating }, token: sessionToken });
    setPhase('idle'); setTrip(null);
  };

  const handlePick = (loc: { lat: number; lng: number }) => {
    if (!picking) return;
    if (picking === 'pickup') setPickup({ ...pickup, lat: loc.lat, lng: loc.lng, address: `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}` });
    else setDestination({ ...destination, lat: loc.lat, lng: loc.lng, address: `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}` });
    setPicking(null);
  };

  const markers = [
    { lat: pickup.lat, lng: pickup.lng, color: '#0066FF', pulse: phase === 'searching' || phase === 'offered' },
    { lat: destination.lat, lng: destination.lng, color: '#10B981' },
    ...(trip?.driver && phase !== 'idle' && phase !== 'done' ? [{ lat: trip.driver.lat, lng: trip.driver.lng, color: '#F59E0B' }] : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <MapView
        center={pickup}
        markers={markers}
        zoom={13}
        onPickLocation={picking ? handlePick : undefined}
      />

      <View style={[styles.topChip, { backgroundColor: colors.overlay, borderColor: colors.border }]}>
        <Ionicons name="location" size={16} color={colors.primary} />
        <Text style={[styles.topChipTxt, { color: colors.textPrimary }]}>
          {t('welcome')}, {user?.name?.split(' ')[0] || ''}
        </Text>
      </View>

      {picking && (
        <View style={[styles.pickBanner, { backgroundColor: colors.primary }]} testID="picking-banner">
          <Ionicons name="hand-right" size={16} color="#fff" />
          <Text style={styles.pickTxt}>{t('tap_to_set')} {picking === 'pickup' ? t('pickup') : t('destination')}</Text>
          <Pressable onPress={() => setPicking(null)}><Ionicons name="close" size={18} color="#fff" /></Pressable>
        </View>
      )}

      <View testID="bottom-sheet" style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {phase === 'idle' && (
          <View>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('where_to')}</Text>
            <Pressable
              testID="set-pickup"
              onPress={() => setPicking('pickup')}
              style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.inputTxt, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{pickup.address}</Text>
              <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            </Pressable>
            <View style={{ height: 10 }} />
            <Pressable
              testID="set-destination"
              onPress={() => setPicking('destination')}
              style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.inputTxt, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{destination.address}</Text>
              <Ionicons name="pencil" size={14} color={colors.textSecondary} />
            </Pressable>
            <View style={{ height: 16 }} />
            <Button testID="continue-choose" label={t('continue')} onPress={() => setPhase('choose')} />
          </View>
        )}

        {phase === 'choose' && (
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('choose_ride')}</Text>
            {RIDE_TYPES.map((r) => {
              const sel = rideType === r.key;
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
                    <Text style={[styles.rideDesc, { color: colors.textSecondary }]}>{r.desc}</Text>
                  </View>
                  <Text style={[styles.price, { color: colors.textPrimary }]}>
                    {estimate && sel ? formatPrice(estimate.price, lang) : ''}
                  </Text>
                </Pressable>
              );
            })}

            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('payment')}</Text>
            <View style={styles.payRow}>
              {PAY_METHODS.map((p) => {
                const sel = payment === p.key;
                return (
                  <Pressable
                    key={p.key}
                    testID={`pay-${p.key}`}
                    onPress={() => setPayment(p.key)}
                    style={[
                      styles.payChip,
                      {
                        backgroundColor: sel ? colors.primary + '14' : colors.surface,
                        borderColor: sel ? colors.primary : colors.border,
                        borderWidth: sel ? 2 : 1,
                      },
                    ]}
                  >
                    <Ionicons name={p.icon as any} size={18} color={sel ? colors.primary : colors.textPrimary} />
                    <Text style={[styles.payTxt, { color: sel ? colors.primary : colors.textPrimary }]}>{t(p.key)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {estimate && (
              <View style={[styles.breakdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.breakTitle, { color: colors.textSecondary }]}>{t('price_breakdown')}</Text>
                <View style={styles.breakRow}>
                  <Text style={[styles.breakLabel, { color: colors.textPrimary }]}>{t('base_fare')}</Text>
                  <Text style={[styles.breakVal, { color: colors.textPrimary }]}>{formatPrice(estimate.breakdown.base, lang)}</Text>
                </View>
                <View style={styles.breakRow}>
                  <Text style={[styles.breakLabel, { color: colors.textPrimary }]}>{t('distance_fare')} • {estimate.distance_km} {t('km')}</Text>
                  <Text style={[styles.breakVal, { color: colors.textPrimary }]}>{formatPrice(estimate.breakdown.distance, lang)}</Text>
                </View>
                <View style={styles.breakRow}>
                  <Text style={[styles.breakLabel, { color: colors.textPrimary }]}>{t('time_fare')} • {estimate.duration_min} {t('min')}</Text>
                  <Text style={[styles.breakVal, { color: colors.textPrimary }]}>{formatPrice(estimate.breakdown.time, lang)}</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.breakRow}>
                  <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>{t('total')}</Text>
                  <Text style={[styles.totalVal, { color: colors.primary }]}>{formatPrice(estimate.price, lang)}</Text>
                </View>
              </View>
            )}

            <View style={{ height: 14 }} />
            <Button testID="confirm-ride" label={t('confirm')} onPress={requestRide} loading={loading} />
            <Pressable onPress={() => setPhase('idle')} style={{ alignItems: 'center', padding: 14 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('cancel')}</Text>
            </Pressable>
          </ScrollView>
        )}

        {(phase === 'searching' || phase === 'offered') && (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 16 }]}>{t('searching_driver')}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('loading')}</Text>
            <View style={{ height: 16 }} />
            <Pressable testID="cancel-search" onPress={cancelTrip}>
              <Text style={{ color: colors.error, fontWeight: '700' }}>{t('cancel')}</Text>
            </Pressable>
          </View>
        )}

        {phase === 'no_driver' && (
          <View style={{ paddingVertical: 16 }}>
            <Text style={[styles.h3, { color: colors.error }]}>{t('no_driver')}</Text>
            <View style={{ height: 16 }} />
            <Button testID="try-again" label={t('try_again')} onPress={() => { setPhase('idle'); setTrip(null); }} />
          </View>
        )}

        {phase === 'accepted' && trip?.driver && (
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
          </View>
        )}

        {phase === 'on_trip' && (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <View style={[styles.chip, { backgroundColor: colors.success + '22' }]}>
              <View style={[styles.chipDot, { backgroundColor: colors.success }]} />
              <Text style={{ color: colors.success, fontWeight: '700' }}>{t('on_trip')}</Text>
            </View>
            <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 14 }]}>{destination.address}</Text>
          </View>
        )}

        {phase === 'done' && trip && (
          <View>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('trip_completed')}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {t('total')}: {formatPrice(trip.price, lang)} • {trip.distance_km} {t('km')}
            </Text>
            <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 20 }]}>{t('rate_trip')}</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Pressable key={i} testID={`rate-${i}`} onPress={() => rateAndClose(i)} style={{ padding: 6 }}>
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
  topChip: { position: 'absolute', top: 60, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  topChipTxt: { fontSize: 13, fontWeight: '600', marginStart: 6 },
  pickBanner: { position: 'absolute', top: 110, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, gap: 8 },
  pickTxt: { color: '#fff', fontWeight: '700', marginHorizontal: 10 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 32,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 20,
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
  price: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 10 },
  payRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  payChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, gap: 6, marginEnd: 4 },
  payTxt: { fontWeight: '700', fontSize: 13, marginStart: 6 },
  breakdown: { padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 4 },
  breakTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  breakRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  breakLabel: { fontSize: 13, fontWeight: '500' },
  breakVal: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, marginVertical: 8 },
  totalLabel: { fontSize: 15, fontWeight: '800' },
  totalVal: { fontSize: 18, fontWeight: '900' },
  driverCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1 },
  avatar: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  driverName: { fontSize: 16, fontWeight: '700' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingTxt: { fontSize: 14, fontWeight: '700', marginStart: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, gap: 8 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  starRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
});
