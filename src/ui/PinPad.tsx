import React from 'react';
import { Pressable, View } from 'react-native';
import { Delete, Fingerprint } from 'lucide-react-native';
import { colors as c, fonts, s } from '../theme';
import { Text, useT } from './text';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * Digits only, 4–6 long. With a known `length` the pad submits by itself on the
 * last digit; while choosing a new PIN the caller shows its own continue button.
 */
export function PinPad({ value, onChange, length, disabled = false, onBiometric }: {
  value: string; onChange: (value: string) => void; length?: number; disabled?: boolean; onBiometric?: () => void;
}) {
  const t = useT();
  const max = length ?? 6;
  const press = (digit: string) => { if (!disabled && value.length < max) onChange(value + digit); };
  const key = (label: string, onPress: () => void, content: React.ReactNode, a11y: string) =>
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={t(a11y)} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: c.white, borderWidth: 1, borderColor: c.line }, (pressed || disabled) && s.pressed]}>
      {content}
    </Pressable>;
  const digit = (d: string) => key(d, () => press(d), <Text style={{ fontFamily: fonts.medium, fontSize: 26, color: c.ink }}>{d}</Text>, d);
  return <View style={{ alignItems: 'center', gap: 22 }}>
    <View accessibilityLabel={t(`${value.length} ta raqam kiritildi`)} style={{ flexDirection: 'row', gap: 14, minHeight: 16 }}>
      {Array.from({ length: length ?? Math.max(4, value.length) }, (_, index) =>
        <View key={index} style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: c.forest, backgroundColor: index < value.length ? c.forest : 'transparent' }} />)}
    </View>
    <View style={{ gap: 14 }}>
      {[0, 1, 2].map((row) => <View key={row} style={{ flexDirection: 'row', gap: 18 }}>{KEYS.slice(row * 3, row * 3 + 3).map(digit)}</View>)}
      <View style={{ flexDirection: 'row', gap: 18 }}>
        {onBiometric
          ? key('bio', onBiometric, <Fingerprint size={26} color={c.forest} strokeWidth={1.6} />, 'Telefon qulfi bilan ochish')
          : <View style={{ width: 72, height: 72 }} />}
        {digit('0')}
        {key('del', () => onChange(value.slice(0, -1)), <Delete size={24} color={c.muted} strokeWidth={1.6} />, 'Oxirgi raqamni o‘chirish')}
      </View>
    </View>
  </View>;
}
