import React from 'react';
import { Text, View } from 'react-native';
import { DAILY_SESSIONS, SESSION_TARGETS } from '../domain/model';
import { s } from '../theme';
import { Choice } from './controls';

/** The user's own daily routine for one intention: how many sessions and how many in each. */
export function GoalPicker({ sessions, target, onChange, disabled = false }: {
  sessions: number; target: number; onChange: (sessions: number, target: number) => void; disabled?: boolean;
}) {
  const targets: number[] = [...SESSION_TARGETS];
  if (!targets.includes(target)) targets.push(target);
  return <View style={{ gap: 10 }}>
    <Text style={s.medium}>Kuniga necha mahal?</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {Array.from({ length: DAILY_SESSIONS }, (_, index) => index + 1).map((count) =>
        <Choice key={count} label={`${count}`} accessibilityLabel={`Kuniga ${count} mahal`} selected={sessions === count} disabled={disabled} onPress={() => onChange(count, target)} />)}
    </View>
    <Text style={s.medium}>Har mahalda nechta?</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {targets.map((count) =>
        <Choice key={count} wide label={`${count} ta`} accessibilityLabel={`Har mahalda ${count} ta`} selected={target === count} disabled={disabled} onPress={() => onChange(sessions, count)} />)}
    </View>
    <Text style={s.muted}>Kuniga jami {sessions * target} ta. Kichikdan boshlang — istalgan payt o‘zgartirishingiz mumkin.</Text>
  </View>;
}
