import React from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { ActivityDay } from '../domain/model';
import { colors as c, fonts, s } from '../theme';
import { Text, useT } from './text';

const HEADERS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function parts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return { day: date.getDate(), month: date.getMonth(), column: (date.getDay() + 6) % 7 };
}

/** A gentle 30-day calendar: good days are filled, other days stay plain — never red, never owed. */
export function ConsistencyView({ days }: { days: ActivityDay[] }) {
  const t = useT();
  if (!days.length) return null;
  const lead = parts(days[0]!.dateKey).column;
  const cells: Array<ActivityDay | null> = [...Array<null>(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
  const first = parts(days[0]!.dateKey);
  const last = parts(days.at(-1)!.dateKey);
  const range = `${first.day}-${MONTHS[first.month]} — ${last.day}-${MONTHS[last.month]}`;
  return <View style={{ gap: 10 }}>
    <Text style={s.tiny}>{range.toUpperCase()}</Text>
    <View style={{ flexDirection: 'row' }}>{HEADERS.map((name) => <Text key={name} style={[s.tiny, { flex: 1, textAlign: 'center' }]}>{name}</Text>)}</View>
    {rows.map((row, index) => <View key={index} style={{ flexDirection: 'row' }}>
      {row.map((cell, column) => <View key={column} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
        {cell && <View accessibilityLabel={t(`${parts(cell.dateKey).day}-${MONTHS[parts(cell.dateKey).month]}${cell.active ? ', yaxshi amal qayd etilgan' : ''}${cell.today ? ', bugun' : ''}`)}
          style={[{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line },
            cell.active && s.checkOn, cell.today && !cell.active && { borderColor: c.forest, borderWidth: 1.5 }]}>
          {cell.active
            ? <Check size={15} color={c.white} />
            : <Text style={{ fontFamily: cell.today ? fonts.bold : fonts.regular, fontSize: 12, color: cell.today ? c.forest : c.muted }}>{parts(cell.dateKey).day}</Text>}
        </View>}
      </View>)}
    </View>)}
  </View>;
}
