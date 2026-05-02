import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import Button from '../src/Button';
import { api } from '../src/api';
import { radii } from '../src/theme';

export default function Help() {
  const { colors, t, lang, sessionToken } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'faqs' | 'support'>(params.tab === 'support' ? 'support' : 'faqs');
  const [faqs, setFaqs] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<'ride' | 'payment' | 'account' | 'other'>('other');
  const [tickets, setTickets] = useState<any[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try { setFaqs(await api('/api/support/faqs')); } catch {}
      try { setTickets(await api('/api/support/tickets', { token: sessionToken })); } catch {}
    })();
  }, [sessionToken]);

  const submit = async () => {
    if (!subject || !message) return;
    setSending(true);
    try {
      await api('/api/support/ticket', { method: 'POST', body: { subject, message, kind }, token: sessionToken });
      setSubject(''); setMessage('');
      setTickets(await api('/api/support/tickets', { token: sessionToken }));
    } finally { setSending(false); }
  };

  const Tab = ({ k, label }: any) => (
    <Pressable
      testID={`tab-${k}`}
      onPress={() => setTab(k)}
      style={[styles.tab, { backgroundColor: tab === k ? colors.primary : colors.surface, borderColor: tab === k ? colors.primary : colors.border }]}
    >
      <Text style={{ color: tab === k ? '#fff' : colors.textPrimary, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('help_center')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.tabs}>
        <Tab k="faqs" label={t('faqs')} />
        <Tab k="support" label={t('contact_support')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {tab === 'faqs' && faqs.map((f, i) => (
          <Pressable
            key={i}
            testID={`faq-${i}`}
            onPress={() => setExpanded(expanded === i ? null : i)}
            style={[styles.faq, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.faqTop}>
              <Text style={[styles.faqQ, { color: colors.textPrimary, flex: 1 }]}>
                {lang === 'ar' ? f.q_ar : f.q_en}
              </Text>
              <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </View>
            {expanded === i && <Text style={[styles.faqA, { color: colors.textSecondary }]}>{lang === 'ar' ? f.a_ar : f.a_en}</Text>}
          </Pressable>
        ))}

        {tab === 'support' && (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('report_problem')}</Text>
            <View style={styles.pills}>
              {(['ride', 'payment', 'account', 'other'] as const).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[styles.pill, { backgroundColor: kind === k ? colors.primary : colors.surface, borderColor: kind === k ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: kind === k ? '#fff' : colors.textPrimary, fontWeight: '700', fontSize: 12 }}>{k}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              testID="ticket-subject"
              value={subject}
              onChangeText={setSubject}
              placeholder={t('subject')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            />
            <TextInput
              testID="ticket-message"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={5}
              placeholder={t('message')}
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.textarea, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            />
            <View style={{ height: 12 }} />
            <Button testID="send-ticket" label={t('send')} onPress={submit} loading={sending} />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 24 }]}>{t('tickets_mine')}</Text>
            {tickets.length === 0 && <Text style={{ color: colors.textSecondary }}>—</Text>}
            {tickets.map((tk) => (
              <View key={tk.ticket_id} style={[styles.ticket, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.tTop}>
                  <Text style={[styles.tSub, { color: colors.textPrimary }]} numberOfLines={1}>{tk.subject}</Text>
                  <View style={[styles.badge, { backgroundColor: colors.primary + '22' }]}>
                    <Text style={[styles.badgeTxt, { color: colors.primary }]}>{tk.status}</Text>
                  </View>
                </View>
                <Text style={[styles.tMsg, { color: colors.textSecondary }]} numberOfLines={2}>{tk.message}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 0 },
  tab: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginEnd: 6 },
  faq: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  faqTop: { flexDirection: 'row', alignItems: 'center' },
  faqQ: { fontSize: 14, fontWeight: '700' },
  faqA: { fontSize: 13, marginTop: 8, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginEnd: 6 },
  input: { height: 56, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, marginBottom: 10 },
  textarea: { height: 120, paddingTop: 14, textAlignVertical: 'top' },
  ticket: { padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 10 },
  tTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tSub: { fontSize: 14, fontWeight: '700', flex: 1, marginEnd: 10 },
  tMsg: { fontSize: 12, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeTxt: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
