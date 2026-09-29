import { normalizeReminderSettings, type ReminderSettings } from './schedule';

export type Reflection = {
  id: string;
  label: string;
  note: string;
  createdAt: string;
  archived: boolean;
};

export type DayProgress = {
  counts: Record<string, number[]>;
  habits: string[];
};

export type AppState = {
  version: 1;
  reflections: Reflection[];
  days: Record<string, DayProgress>;
  settings: ReminderSettings;
};

export const MAX_REFLECTIONS = 20;
export const MAX_HISTORY_DAYS = 30;
export const MAX_LABEL_LENGTH = 48;
export const MAX_NOTE_LENGTH = 120;
export const DAILY_SESSIONS = 5;
export const SESSION_TARGET = 100;

export class StateValidationError extends Error {
  readonly code = 'INVALID_STATE';

  constructor(detail: string) {
    super(`Saqlangan ma’lumotlar formati yaroqsiz (${detail}). Ma’lumotlar o‘chirilmagan.`);
    this.name = 'StateValidationError';
  }
}

export function createInitialState(): AppState {
  return {
    version: 1,
    reflections: [],
    days: {},
    settings: {
      enabled: false,
      dayStart: 7,
      dayEnd: 21,
      sunnahPerDay: 2,
      times: ['08:00', '11:00', '14:00', '17:00', '20:00'],
    },
  };
}

/** Local calendar date: UTC serialization would move the boundary in Uzbekistan. */
export function localDateKey(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Sana yaroqsiz.');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDateKey(date) === value;
}

function assertDateKey(value: string): void {
  if (!validDateKey(value)) throw new Error('Kun sanasi YYYY-MM-DD ko‘rinishida bo‘lishi kerak.');
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    && !['__proto__', 'prototype', 'constructor'].includes(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function demand(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new StateValidationError(detail);
}

/** Strict validation also returns fresh objects, so external input cannot mutate saved state. */
export function validateState(value: unknown): AppState {
  demand(record(value) && value.version === 1, 'versiya');
  demand(Array.isArray(value.reflections) && value.reflections.length <= MAX_REFLECTIONS, 'qaydlar');
  const ids = new Set<string>();
  const reflections: Reflection[] = value.reflections.map((entry: unknown) => {
    demand(record(entry), 'qayd');
    demand(safeId(entry.id) && !ids.has(entry.id), 'qayd identifikatori');
    demand(typeof entry.label === 'string' && entry.label.trim().length > 0
      && entry.label.length <= MAX_LABEL_LENGTH, 'qayd nomi');
    demand(typeof entry.note === 'string' && entry.note.length <= MAX_NOTE_LENGTH, 'izoh');
    demand(typeof entry.createdAt === 'string' && entry.createdAt.length <= 40
      && /^\d{4}-\d{2}-\d{2}T/.test(entry.createdAt)
      && validDateKey(entry.createdAt.slice(0, 10))
      && Number.isFinite(Date.parse(entry.createdAt)), 'qayd sanasi');
    demand(typeof entry.archived === 'boolean', 'qayd holati');
    ids.add(entry.id);
    return { id: entry.id, label: entry.label, note: entry.note, createdAt: entry.createdAt, archived: entry.archived };
  });

  demand(record(value.days) && Object.keys(value.days).length <= MAX_HISTORY_DAYS, 'kunlar');
  const days: Record<string, DayProgress> = {};
  for (const [key, rawDay] of Object.entries(value.days)) {
    demand(validDateKey(key) && record(rawDay), 'kun sanasi');
    demand(record(rawDay.counts), 'sanoqlar');
    const counts: Record<string, number[]> = {};
    for (const [id, rawCounts] of Object.entries(rawDay.counts)) {
      demand(ids.has(id) && Array.isArray(rawCounts) && rawCounts.length === DAILY_SESSIONS
        && rawCounts.every((count: unknown) => Number.isInteger(count) && typeof count === 'number'
          && count >= 0 && count <= SESSION_TARGET), 'istig‘for sanog‘i');
      counts[id] = [...rawCounts] as number[];
    }
    demand(Array.isArray(rawDay.habits) && rawDay.habits.length <= 100
      && rawDay.habits.every(safeId) && new Set(rawDay.habits).size === rawDay.habits.length, 'odatlar');
    days[key] = { counts, habits: [...rawDay.habits] as string[] };
  }

  demand(record(value.settings) && typeof value.settings.enabled === 'boolean'
    && Array.isArray(value.settings.times) && value.settings.times.every((time: unknown) => typeof time === 'string'), 'eslatmalar');
  let settings: ReminderSettings;
  try {
    settings = normalizeReminderSettings(value.settings as ReminderSettings);
  } catch {
    throw new StateValidationError('eslatma vaqtlari');
  }
  return { version: 1, reflections, days, settings: {
    enabled: settings.enabled, dayStart: settings.dayStart, dayEnd: settings.dayEnd,
    sunnahPerDay: settings.sunnahPerDay, times: [...settings.times],
  } };
}

export function getCounts(state: AppState, id: string, dateKey = localDateKey()): number[] {
  const day = hasOwn(state.days, dateKey) ? state.days[dateKey] : undefined;
  const counts = day && hasOwn(day.counts, id) ? day.counts[id] : undefined;
  return counts ? [...counts] : Array<number>(DAILY_SESSIONS).fill(0);
}

export function getDayTotal(state: AppState, dateKey = localDateKey()): number {
  return state.reflections.filter((reflection) => !reflection.archived)
    .reduce((total, reflection) => total + getCounts(state, reflection.id, dateKey)
      .reduce((sum, count) => sum + count, 0), 0);
}

/** Retain the newest 30 local-day records, regardless of gaps between visits. */
export function pruneHistory(state: AppState): AppState {
  const keys = Object.keys(state.days).sort();
  if (keys.length <= MAX_HISTORY_DAYS) return state;
  const days: Record<string, DayProgress> = {};
  for (const key of keys.slice(-MAX_HISTORY_DAYS)) days[key] = state.days[key]!;
  return { ...state, days };
}

export function incrementCount(
  state: AppState, id: string, slot: number, delta = 1, dateKey = localDateKey(),
): AppState {
  assertDateKey(dateKey);
  if (!Number.isInteger(slot) || slot < 0 || slot >= DAILY_SESSIONS || !Number.isInteger(delta)) return state;
  if (!state.reflections.some((reflection) => reflection.id === id && !reflection.archived)) return state;
  const previous = getCounts(state, id, dateKey);
  const next = Math.max(0, Math.min(SESSION_TARGET, previous[slot]! + delta));
  if (next === previous[slot]) return state;
  previous[slot] = next;
  const day = state.days[dateKey] ?? { counts: {}, habits: [] };
  return pruneHistory({
    ...state,
    days: { ...state.days, [dateKey]: { counts: { ...day.counts, [id]: previous }, habits: [...day.habits] } },
  });
}

export function toggleHabit(state: AppState, id: string, dateKey = localDateKey()): AppState {
  assertDateKey(dateKey);
  if (!safeId(id)) return state;
  const day = state.days[dateKey] ?? { counts: {}, habits: [] };
  const exists = day.habits.includes(id);
  if (!exists && day.habits.length >= 100) return state;
  const habits = exists ? day.habits.filter((habit) => habit !== id) : [...day.habits, id];
  return pruneHistory({ ...state, days: { ...state.days, [dateKey]: { counts: { ...day.counts }, habits } } });
}
