import { customHabitsFor, DEFAULT_HABIT_IDS, getDayTarget, getDayTotal, type AppState } from './model';
import { isScript, toScript, type Script } from './script';

/**
 * What the home-screen widget may show: two pairs of numbers. No intention
 * names, habit titles or Muhosaba text ever leave the app for the widget.
 */
export type WidgetSnapshot = {
  version: 1;
  dateKey: string;
  istighfar: { done: number; target: number };
  /** Habits ticked on `dateKey`, and how many habits each weekday has (0 = Sunday). */
  habits: { done: number; totals: number[] };
  /** The whole-app lock is on: the widget shows no numbers at all. */
  hidden: boolean;
  script: Script;
};

export type WidgetView =
  | { hidden: true; script: Script; title: string; line: string }
  | { hidden: false; script: Script; title: string; istighfarLabel: string; istighfar: { done: number; target: number }; habitsLabel: string; habits: { done: number; total: number } };

function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00`).getDay();
}

export function widgetSnapshot(state: AppState, dateKey: string): WidgetSnapshot {
  const today = new Set([...DEFAULT_HABIT_IDS, ...customHabitsFor(state, dateKey).map((habit) => habit.id)]);
  const done = (state.days[dateKey]?.habits ?? []).filter((id) => today.has(id)).length;
  const totals = Array.from({ length: 7 }, (_, weekday) => DEFAULT_HABIT_IDS.length
    + state.habits.filter((habit) => habit.weekdays.length === 0 || habit.weekdays.includes(weekday)).length);
  return {
    version: 1,
    dateKey,
    istighfar: { done: getDayTotal(state, dateKey), target: getDayTarget(state) },
    habits: { done, totals },
    hidden: state.lock.mode === 'app',
    script: state.settings.script,
  };
}

function count(value: unknown, max = 100_000): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

export function parseWidgetSnapshot(raw: string | null): WidgetSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<WidgetSnapshot>;
    if (value.version !== 1 || typeof value.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateKey)
      || !value.istighfar || !count(value.istighfar.done) || !count(value.istighfar.target)
      || !value.habits || !count(value.habits.done) || !Array.isArray(value.habits.totals) || value.habits.totals.length !== 7
      || !value.habits.totals.every((total) => count(total, 100)) || typeof value.hidden !== 'boolean' || !isScript(value.script)) return null;
    return value as WidgetSnapshot;
  } catch { return null; }
}

/** A new day starts from zero even before the app is opened again. */
export function widgetView(snapshot: WidgetSnapshot | null, today: string): WidgetView {
  const script = snapshot?.script ?? 'latin';
  const t = (text: string) => toScript(text, script);
  if (!snapshot || snapshot.hidden) return { hidden: true, script, title: t('RAHMAT'), line: t('Ochish uchun bosing') };
  const sameDay = snapshot.dateKey === today;
  return {
    hidden: false,
    script,
    title: t('RAHMAT · BUGUN'),
    istighfarLabel: t('Istig‘for'),
    istighfar: { done: sameDay ? snapshot.istighfar.done : 0, target: snapshot.istighfar.target },
    habitsLabel: t('Odatlar'),
    habits: { done: sameDay ? snapshot.habits.done : 0, total: snapshot.habits.totals[weekdayOf(today)] ?? 0 },
  };
}
