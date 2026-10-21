import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetView } from '../domain/widget';

// The app's own palette and fonts (copied into the APK by the widget plugin).
const PAPER = '#F7F5EF';
const FOREST = '#244D40';
const INK = '#203D34';
const MUTED = '#667060';
const SAND = '#EEE8DC';
const PADDING = 16;
type Fonts = { medium: string; bold: string };
// DM Sans has no Cyrillic letters; Onest is its Cyrillic twin, as in the app.
const FONTS: Record<WidgetView['script'], Fonts> = {
  latin: { medium: 'DMSans_500Medium', bold: 'DMSans_600SemiBold' },
  cyrillic: { medium: 'Onest_500Medium', bold: 'Onest_600SemiBold' },
};

function Row({ label, value, fonts }: { label: string; value: string; fonts: Fonts }) {
  return <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: 'match_parent' }}>
    <TextWidget text={label} style={{ fontSize: 13, fontFamily: fonts.medium, color: INK }} />
    <TextWidget text={value} style={{ fontSize: 16, fontFamily: fonts.bold, color: FOREST }} />
  </FlexWidget>;
}

function Bar({ fraction, width }: { fraction: number; width: number }) {
  const inner = Math.round(Math.max(0, Math.min(1, fraction)) * width);
  return <FlexWidget style={{ width: 'match_parent', height: 4, borderRadius: 2, backgroundColor: SAND, flexDirection: 'row' }}>
    {inner > 0 ? <FlexWidget style={{ width: inner, height: 4, borderRadius: 2, backgroundColor: FOREST }} /> : null}
  </FlexWidget>;
}

/** Numbers only. Tapping anywhere opens the app (and its lock, if one is set). */
export function RahmatWidget({ view, width }: { view: WidgetView; width: number }) {
  const inner = Math.max(40, width - PADDING * 2);
  const fonts = FONTS[view.script];
  if (view.hidden) {
    return <FlexWidget clickAction="OPEN_APP" accessibilityLabel={`${view.title}. ${view.line}`}
      style={{ width: 'match_parent', height: 'match_parent', backgroundColor: PAPER, borderRadius: 22, padding: PADDING, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGap: 6 }}>
      <FlexWidget style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: FOREST }} />
      <TextWidget text={view.title} style={{ fontSize: 12, fontFamily: fonts.bold, color: INK, letterSpacing: 0.25 }} />
      <TextWidget text={view.line} style={{ fontSize: 11, fontFamily: fonts.medium, color: MUTED }} />
    </FlexWidget>;
  }
  const { istighfar, habits } = view;
  return <FlexWidget clickAction="OPEN_APP" accessibilityLabel={`${view.istighfarLabel} ${istighfar.done} / ${istighfar.target}. ${view.habitsLabel} ${habits.done} / ${habits.total}`}
    style={{ width: 'match_parent', height: 'match_parent', backgroundColor: PAPER, borderRadius: 22, padding: PADDING, flexDirection: 'column', justifyContent: 'space-between' }}>
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 7 }}>
      <FlexWidget style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: FOREST }} />
      <TextWidget text={view.title} style={{ fontSize: 10, fontFamily: fonts.bold, color: MUTED, letterSpacing: 0.18 }} />
    </FlexWidget>
    <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 6 }}>
      <Row label={view.istighfarLabel} value={`${istighfar.done} / ${istighfar.target}`} fonts={fonts} />
      <Bar fraction={istighfar.target ? istighfar.done / istighfar.target : 0} width={inner} />
    </FlexWidget>
    <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', flexGap: 6 }}>
      <Row label={view.habitsLabel} value={`${habits.done} / ${habits.total}`} fonts={fonts} />
      <Bar fraction={habits.total ? habits.done / habits.total : 0} width={inner} />
    </FlexWidget>
  </FlexWidget>;
}
