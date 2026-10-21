import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors as c, s } from '../theme';

export function Button({ children, onPress, secondary = false, disabled = false, label }: {
  children: React.ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean; label?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (pressed || disabled) && s.pressed]}><Text style={[s.buttonText, secondary && { color: c.forest }]}>{children}</Text></Pressable>;
}

export function IconButton({ label, onPress, children, disabled = false }: { label: string; onPress: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.iconButton, (pressed || disabled) && s.pressed]}>{children}</Pressable>;
}

/** A pill choice used for routines, weekdays and lock modes. */
export function Choice({ label, selected, onPress, disabled = false, accessibilityLabel, wide = false, compact = false, multiple = false }: {
  label: string; selected: boolean; onPress: () => void; disabled?: boolean; accessibilityLabel?: string; wide?: boolean; compact?: boolean;
  /** Several can be on at once (weekdays): announced as checkboxes instead of radio buttons. */
  multiple?: boolean;
}) {
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={multiple ? { checked: selected, disabled } : { selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.chip, { alignItems: 'center', paddingHorizontal: wide ? (compact ? 12 : 16) : 0, minWidth: wide ? undefined : (compact ? 44 : 48), marginBottom: 8 },
      compact && { minHeight: 44, borderRadius: 22, marginRight: 4 }, selected && s.chipOn, (pressed || disabled) && s.pressed]}>
    <Text style={[s.medium, compact && { fontSize: 13 }, selected && { color: c.paper }]}>{label}</Text>
  </Pressable>;
}

/** Two or three equal tabs inside one screen. */
export function Segmented<T extends string>({ options, value, onChange }: {
  options: readonly { key: T; label: string }[]; value: T; onChange: (key: T) => void;
}) {
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.sage, borderRadius: 16, padding: 4, gap: 4 }}>
    {options.map((option) => {
      const selected = value === option.key;
      return <Pressable key={option.key} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.key)}
        style={({ pressed }) => [{ flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, selected && { backgroundColor: c.white }, pressed && s.pressed]}>
        <Text style={[s.medium, !selected && { color: c.muted }]}>{option.label}</Text>
      </Pressable>;
    })}
  </View>;
}

/** A small notice that religious wording still awaits a scholar's review. */
export function ReviewNotice({ text }: { text: string }) {
  return <View accessibilityRole="text" style={{ borderRadius: 14, borderWidth: 1, borderColor: '#E5D7B5', backgroundColor: '#FBF6EA', paddingHorizontal: 14, paddingVertical: 10 }}>
    <Text style={[s.muted, { color: '#6E5A2E' }]}>{text}</Text>
  </View>;
}
