import React, { useState } from 'react';
import { View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { MAX_CUSTOM_HABITS, MAX_HABIT_TITLE_LENGTH, type CustomHabit } from '../domain/model';
import { colors as c, s } from '../theme';
import { Button, Choice, IconButton } from './controls';
import { Text, TextInput, useT } from './text';

/** Monday first, as in the rest of the app. Values are JavaScript weekdays (0 = Sunday). */
export const WEEKDAYS = [
  { day: 1, short: 'Du' }, { day: 2, short: 'Se' }, { day: 3, short: 'Ch' }, { day: 4, short: 'Pa' },
  { day: 5, short: 'Ju' }, { day: 6, short: 'Sh' }, { day: 0, short: 'Ya' },
] as const;

// Plain suggestions that make no religious claim of their own.
const TEMPLATES = ['Qur’ondan bir sahifa o‘qish', 'Ota-onaga qo‘ng‘iroq qilish', 'Kichik sadaqa berish', 'Bir yangi duo yodlash', 'Salomni birinchi berish'];

export function weekdaySummary(weekdays: number[]): string {
  if (!weekdays.length || weekdays.length === 7) return 'Har kuni';
  return WEEKDAYS.filter((item) => weekdays.includes(item.day)).map((item) => item.short).join(', ');
}

export function HabitEditor({ habits, defaults, onAdd, onRemove }: {
  habits: CustomHabit[]; defaults: readonly { id: string; title: string }[];
  onAdd: (title: string, weekdays: number[]) => void; onRemove: (id: string) => void;
}) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const full = habits.length >= MAX_CUSTOM_HABITS;
  const toggleDay = (day: number) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  const add = () => { if (!title.trim() || full) return; onAdd(title, days); setTitle(''); setDays([]); };
  return <View style={{ gap: 16 }}>
    <Text style={s.muted}>Odat nomlari faqat shu telefonda saqlanadi va bildirishnomalarda ko‘rinmaydi.</Text>
    <View style={{ gap: 6 }}>
      <Text style={s.medium}>Doimiy odatlar</Text>
      {defaults.map((habit) => <Text key={habit.id} style={s.muted}>• {habit.title}</Text>)}
    </View>
    <View style={{ gap: 8 }}>
      <Text style={s.medium}>Shaxsiy odatlaringiz · {habits.length}/{MAX_CUSTOM_HABITS}</Text>
      {habits.length === 0 && <Text style={s.muted}>Hozircha yo‘q. Quyida o‘zingizga mos odatni qo‘shing.</Text>}
      {habits.map((habit) => <View key={habit.id} style={[s.between, { borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 4 }]}>
        <View style={{ flex: 1, gap: 2 }}><Text raw style={s.text}>{habit.title}</Text><Text style={s.tiny}>{weekdaySummary(habit.weekdays)}</Text></View>
        <IconButton raw label={`${habit.title} — ${t('odatni o‘chirish')}`} onPress={() => onRemove(habit.id)}><Trash2 size={17} color={c.danger} /></IconButton>
      </View>)}
    </View>
    {full ? <Text style={s.muted}>{MAX_CUSTOM_HABITS} ta shaxsiy odat — chegaraga yetdingiz. Yangisini qo‘shish uchun avval birini o‘chiring.</Text> : <View style={{ gap: 10 }}>
      <Text style={s.medium}>Yangi odat</Text>
      <TextInput accessibilityLabel={t('Yangi odat nomi')} value={title} onChangeText={setTitle} maxLength={MAX_HABIT_TITLE_LENGTH} placeholder={t('Masalan, kechqurun kitob o‘qish')} placeholderTextColor={c.muted} style={s.input} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {TEMPLATES.map((template) => <Choice key={template} wide compact label={template} selected={title === t(template)} onPress={() => setTitle(t(template))} />)}
      </View>
      <Text style={s.muted}>Qaysi kunlari? Hech biri tanlanmasa — har kuni.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {WEEKDAYS.map((item) => <Choice key={item.day} compact multiple label={item.short} selected={days.includes(item.day)} onPress={() => toggleDay(item.day)} />)}
      </View>
      <Button disabled={!title.trim()} onPress={add}>Odatni qo‘shish</Button>
    </View>}
  </View>;
}
