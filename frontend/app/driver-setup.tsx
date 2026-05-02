import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/AppContext';
import Button from '../src/Button';
import { api } from '../src/api';
import { radii } from '../src/theme';

export default function DriverSetup() {
  const { colors, t, user, sessionToken } = useApp();
  const router = useRouter();
  const [make, setMake] = useState((user as any)?.car_make || '');
  const [model, setModel] = useState((user as any)?.car_model || '');
  const [plate, setPlate] = useState((user as any)?.plate || '');
  const [license, setLicense] = useState(!!(user as any)?.license_image);
  const [idDoc, setIdDoc] = useState(!!(user as any)?.id_image);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api('/api/profile/driver', {
        method: 'POST',
        body: {
          car_make: make, car_model: model, plate,
          license_image: license ? 'base64_placeholder' : undefined,
          id_image: idDoc ? 'base64_placeholder' : undefined,
        },
        token: sessionToken,
      });
      router.back();
    } finally { setSaving(false); }
  };

  const Field = ({ label, value, setValue, placeholder }: any) => (
    <>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
      />
    </>
  );

  const Upload = ({ label, checked, setChecked, testID }: any) => (
    <Pressable
      testID={testID}
      onPress={() => setChecked(!checked)}
      style={[styles.upload, { backgroundColor: colors.surface, borderColor: checked ? colors.primary : colors.border, borderWidth: checked ? 2 : 1 }]}
    >
      <Ionicons name={checked ? 'checkmark-circle' : 'cloud-upload-outline'} size={28} color={checked ? colors.success : colors.textPrimary} />
      <Text style={[styles.uploadTxt, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.uploadSub, { color: colors.textSecondary }]}>{checked ? t('picked') : 'Tap to upload'}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={28} color={colors.textPrimary} /></Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('vehicle_docs')}</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Field label={t('car_make')} value={make} setValue={setMake} placeholder="Toyota" />
        <Field label={t('car_model')} value={model} setValue={setModel} placeholder="Camry 2023" />
        <Field label={t('plate_number')} value={plate} setValue={setPlate} placeholder="ريـ 1234" />

        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>Documents</Text>
        <View style={{ gap: 12 }}>
          <Upload testID="upload-license" label={t('upload_license')} checked={license} setChecked={setLicense} />
          <Upload testID="upload-id" label={t('upload_id')} checked={idDoc} setChecked={setIdDoc} />
        </View>

        <View style={{ height: 24 }} />
        <Button testID="save-driver" label={t('save')} onPress={save} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 8 },
  input: { height: 56, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
  upload: { padding: 18, borderRadius: radii.md, alignItems: 'center', gap: 8, marginBottom: 8 },
  uploadTxt: { fontSize: 15, fontWeight: '700', marginTop: 6 },
  uploadSub: { fontSize: 12, marginTop: 2 },
});
