import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/AppContext';
import MapView from '../../src/MapView';
import Button from '../../src/Button';
import { api } from '../../src/api';
import { radii } from '../../src/theme';
import { formatPrice } from '../../src/format';

const CITY = { lat: 24.7136, lng: 46.6753 };

export default function DriverDashboard() {
  const { colors, t, lang, sessionToken, user } = useApp();
  const [online, setOnline] = useState(false);
  const [incoming, setIncoming] = useState<any>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [ratingDone, setRatingDone] = useState(false);
  const pollRef = useRef<any>(null);

  const pollIncoming = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const inc = await api('/api/driver/incoming', { token: sessionToken });
        if (inc && !activeTrip) setIncoming(inc);
        else setIncoming(null);
        if (activeTrip) {
          const t1 = await api(`/api/rides/${activeTrip.trip_id}`, { token: sessionToken });
          setActiveTrip(t1);
        }
      } catch {}
    }, 3000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const toggleOnline = async (v: boolean) => {
    setOnline(v);
    try {
      await api('/api/driver/status', {
        method: 'POST',
        body: { online: v, lat: CITY.lat, lng: CITY.lng },
        token: sessionToken,
      });
      if (v) pollIncoming();
      else { if (pollRef.current) clearInterval(pollRef.current); setIncoming(null); }
    } catch {}
  };

  const accept = async () => {
    const t1 = await api(`/api/rides/${incoming.trip_id}/accept`, { method: 'POST', token: sessionToken });
    setActiveTrip(t1); setIncoming(null); setRatingDone(false);
  };
  const decline = async () => {
    await api(`/api/rides/${incoming.trip_id}/reject`, { method: 'POST', token: sessionToken });
    setIncoming(null);
  };

  const setStatus = async (s: string) => {
    const t1 = await api(`/api/rides/${activeTrip.trip_id}/status?status=${s}`, { method: 'POST', token: sessionToken });
    setActiveTrip(t1);
    if (s === 'completed') {
      // leave for rating
    }
  };

  const rateCustomer = async (r: number) => {
    await api(`/api/rides/${activeTrip.trip_id}/rate`, { method: 'POST', body: { rating: r }, token: sessionToken });
    setRatingDone(true); setActiveTrip(null);
  };

  const markers = [{ lat: CITY.lat, lng: CITY.lng, color: colors.primary, pulse: online && !activeTrip }];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <MapView center={CITY} markers={markers} zoom={12} />

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

        {!incoming && !activeTrip && (
          <View style={{ paddingVertical: 8 }}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>
              {t('welcome')}, {user?.name?.split(' ')[0] || ''}
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>
              {online ? t('loading') : t('go_online')}
            </Text>
            <View style={{ height: 16 }} />
            {!online && (
              <Button testID="go-online-btn" label={t('go_online')} onPress={() => toggleOnline(true)} />
            )}
          </View>
        )}

        {incoming && (
          <View>
            <Text style={[styles.h2, { color: colors.primary }]}>{t('incoming_request')}</Text>
            <View style={[styles.reqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.reqRow}>
                <Ionicons name="person" size={18} color={colors.textPrimary} />
                <Text style={[styles.reqName, { color: colors.textPrimary }]}>{incoming.customer_name}</Text>
                <Text style={[styles.reqFare, { color: colors.success }]}>{formatPrice(incoming.price, lang)}</Text>
              </View>
              <View style={[styles.reqRow, { marginTop: 10 }]}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.reqAddr, { color: colors.textPrimary }]} numberOfLines={1}>
                  {incoming.pickup?.address || 'Pickup'}
                </Text>
              </View>
              <View style={[styles.reqRow, { marginTop: 6 }]}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text style={[styles.reqAddr, { color: colors.textPrimary }]} numberOfLines={1}>
                  {incoming.destination?.address || 'Destination'}
                </Text>
              </View>
              <Text style={[styles.sub, { color: colors.textSecondary, marginTop: 8 }]}>
                {incoming.distance_km} {t('km')} • {incoming.payment_method}
              </Text>
            </View>
            <View style={styles.btnRow}>
              <Pressable
                testID="decline-btn"
                onPress={decline}
                style={[styles.declineBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>{t('decline')}</Text>
              </Pressable>
              <Pressable
                testID="accept-btn"
                onPress={accept}
                style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{t('accept')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {activeTrip && !ratingDone && (
          <View>
            {activeTrip.status !== 'completed' ? (
              <>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>{t(activeTrip.status) || activeTrip.status}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>{activeTrip.customer_name}</Text>
                <View style={{ height: 14 }} />
                {activeTrip.status === 'accepted' && (
                  <Button testID="arrive-btn" label={t('start_trip')} onPress={() => setStatus('on_trip')} />
                )}
                {activeTrip.status === 'on_trip' && (
                  <Button testID="end-trip-btn" label={t('end_trip')} onPress={() => setStatus('completed')} />
                )}
              </>
            ) : (
              <>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>{t('rate_customer')}</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Pressable key={i} testID={`drate-${i}`} onPress={() => rateCustomer(i)} style={{ padding: 6 }}>
                      <Ionicons name="star" size={36} color="#F59E0B" />
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 30, borderWidth: 1, marginTop: 12 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 14, fontWeight: '700', marginStart: 6, marginEnd: 4 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 34,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 20,
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
  starRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
});
