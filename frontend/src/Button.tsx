import React from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useApp } from './AppContext';
import { radii } from './theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
};

export default function Button({ label, onPress, variant = 'primary', loading, disabled, testID, icon, fullWidth = true }: Props) {
  const { colors } = useApp();
  const bg =
    variant === 'primary' ? colors.primary :
    variant === 'secondary' ? colors.surfaceElevated :
    'transparent';
  const textColor = variant === 'primary' ? '#FFFFFF' : colors.textPrimary;
  const border = variant === 'secondary' ? colors.border : 'transparent';

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'secondary' ? 1 : 0,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          width: fullWidth ? '100%' : undefined,
          shadowColor: variant === 'primary' ? colors.primary : '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: variant === 'primary' ? 0.3 : 0.06,
          shadowRadius: 16,
          elevation: variant === 'primary' ? 6 : 2,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.txt, { color: textColor, marginStart: icon ? 10 : 0 }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  txt: { fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
});
