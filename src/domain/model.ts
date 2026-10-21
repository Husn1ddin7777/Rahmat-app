import { normalizeReminderSettings, type ReminderSettings } from './schedule';

/** A private intention. Its routine is the user's own choice, not a prescribed schedule. */
export type Reflection = {
  id: string;
  label: string;
  note: string;
  createdAt: string;
  archived: boolean;
  /** How many sessions a day this intention uses (1–5). */
  sessions: number;
  /** The count the user chose for each session (1–100). */
  target: number;
};

/** A personal habit. Its title stays on the device and never enters a notification. */
export type CustomHabit = {
  id: string;
  title: string;
  /** Local weekdays (0 = Sunday … 6 = Saturday). Empty means every day. */
  weekdays: number[];
  createdAt: string;
};

/** The three evening Muhosaba answers. Private, on-device, never scored. */
export type EveningEntry = {
  gratitude: string;
  improve: string;
  intention: string;
  updatedAt: string;
};

export type DayProgress = {
  counts: Record<string, number[]>;
  habits: string[];
  /** Completed adhkar for the day, by content id (for example a finished tasbih round). */
  adhkar: Record<string, number>;
  evening?: EveningEntry;
};

export type PinRecord = { salt: string; hash: string; iterations: number; length: number };
export type LockMode = 'off' | 'app' | 'muhosaba';
export type LockSettings = { mode: LockMode; pin: PinRecord | null; biometrics: boolean };

export type AppState = {
  version: 2;
  reflections: Reflection[];
  habits: CustomHabit[];
  days: Record<string, DayProgress>;
  settings: ReminderSettings;
  lock: LockSettings;
};

export const MAX_REFLECTIONS = 20;
export const MAX_HISTORY_DAYS = 30;
export const MAX_LABEL_LENGTH = 48;
export const MAX_NOTE_LENGTH = 120;
/** Stored counter slots per intention; a routine uses the first `sessions` of them. */
export const DAILY_SESSIONS = 5;
/** The largest count a single session can hold. */
export const SESSION_TARGET = 100;
/** Counts offered in the app. Validation accepts any whole number from 1 to 100. */
export const SESSION_TARGETS = [10, 33, 100] as const;
/** Existing intentions keep the original 5 × 100 routine when they are migrated. */
export const LEGACY_ROUTINE = { sessions: 5, target: 100 } as const;
/** New intentions start small; the user can change this at any time. */
export const STARTER_ROUTINE = { sessions: 1, target: 33 } as const;
export const DEFAULT_HABIT_IDS = ['meal', 'kindness', 'family'] as const;
export const MAX_CUSTOM_HABITS = 7;
export const MAX_HABIT_TITLE_LENGTH = 40;
export const MAX_EVENING_LENGTH = 200;
export const MAX_ADHKAR_PER_DAY = 50;

export class StateValidationError extends Error {
  readonly code = 'INVALID_STATE';

  constructor(detail: string) {
    super(`Saqlangan ma’lumotlar formati yaroqsiz (${detail}). Ma’lumotlar o‘chirilmagan.`);
    this.name = 'StateValidationError';
  }
}

export function createInitialState(): AppState {
  return {
    version: 2,
    reflections: [],
    habits: [],
    days: {},
    settings: {
      enabled: false,
      dayStart: 7,
      dayEnd: 21,
      sunnahPerDay: 2,
      times: ['08:00', '11:00', '14:00', '17:00', '20:00'],
      eveningTime: null,
    },
    lock: { mode: 'off', pin: null, biometrics: false },
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

/** A date key a number of local calendar days away; noon avoids daylight-saving edges. */
export function shiftDateKey(dateKey: string, days: number): string {
  assertDateKey(dateKey);
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00`).getDay();
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

function isoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value)
    && validDateKey(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
}

function wholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function validRoutine(sessions: unknown, target: unknown): boolean {
  return wholeNumber(sessions, 1, DAILY_SESSIONS) && wholeNumber(target, 1, SESSION_TARGET);
}

/** Version 1 records are upgraded in memory; nothing is lost and old routines stay 5 × 100. */
function upgrade(value: Record<string, unknown>): Record<string, unknown> {
  if (value.version !== 1) return value;
  const reflections = Array.isArray(value.reflections)
    ? value.reflections.map((entry: unknown) => record(entry) ? { ...entry, ...LEGACY_ROUTINE } : entry)
    : value.reflections;
  const days = record(value.days)
    ? Object.fromEntries(Object.entries(value.days).map(([key, day]) => [key, record(day) ? { ...day, adhkar: {} } : day]))
    : value.days;
  const settings = record(value.settings) ? { ...value.settings, eveningTime: null } : value.settings;
  return { ...value, version: 2, reflections, habits: [], days, settings, lock: { mode: 'off', pin: null, biometrics: false } };
}

function validateEvening(value: unknown): EveningEntry {
  demand(record(value), 'kechki muhosaba');
  const fields = ['gratitude', 'improve', 'intention'] as const;
  demand(fields.every((field) => typeof value[field] === 'string' && (value[field] as string).length <= MAX_EVENING_LENGTH)
    && fields.some((field) => (value[field] as string).trim().length > 0), 'kechki muhosaba matni');
  demand(isoTimestamp(value.updatedAt), 'kechki muhosaba sanasi');
  return {
    gratitude: value.gratitude as string,
    improve: value.improve as string,
    intention: value.intention as string,
    updatedAt: value.updatedAt as string,
  };
}

function validateLock(value: unknown): LockSettings {
  demand(record(value) && ['off', 'app', 'muhosaba'].includes(value.mode as string)
    && typeof value.biometrics === 'boolean', 'qulf');
  let pin: PinRecord | null = null;
  if (value.pin !== null) {
    const raw = value.pin;
    demand(record(raw) && typeof raw.salt === 'string' && /^[a-f0-9]{32}$/.test(raw.salt)
      && typeof raw.hash === 'string' && /^[a-f0-9]{64}$/.test(raw.hash)
      && wholeNumber(raw.iterations, 1, 1_000_000) && wholeNumber(raw.length, 4, 6), 'qulf kodi');
    pin = { salt: raw.salt, hash: raw.hash, iterations: raw.iterations as number, length: raw.length as number };
  }
  // A lock without a PIN could not be opened again; biometrics always need the PIN as a fallback.
  demand(value.mode === 'off' || pin !== null, 'qulf kodi yo‘q');
  return { mode: value.mode as LockMode, pin, biometrics: value.biometrics as boolean };
}

/** Strict validation also returns fresh objects, so external input cannot mutate saved state. */
export function validateState(input: unknown): AppState {
  demand(record(input) && (input.version === 1 || input.version === 2), 'versiya');
  const value = upgrade(input);
  demand(Array.isArray(value.reflections) && value.reflections.length <= MAX_REFLECTIONS, 'qaydlar');
  const ids = new Set<string>();
  const reflections: Reflection[] = value.reflections.map((entry: unknown) => {
    demand(record(entry), 'qayd');
    demand(safeId(entry.id) && !ids.has(entry.id), 'qayd identifikatori');
    demand(typeof entry.label === 'string' && entry.label.trim().length > 0
      && entry.label.length <= MAX_LABEL_LENGTH, 'qayd nomi');
    demand(typeof entry.note === 'string' && entry.note.length <= MAX_NOTE_LENGTH, 'izoh');
    demand(isoTimestamp(entry.createdAt), 'qayd sanasi');
    demand(typeof entry.archived === 'boolean', 'qayd holati');
    demand(validRoutine(entry.sessions, entry.target), 'kunlik reja');
    ids.add(entry.id);
    return {
      id: entry.id, label: entry.label, note: entry.note, createdAt: entry.createdAt, archived: entry.archived,
      sessions: entry.sessions as number, target: entry.target as number,
    };
  });

  demand(Array.isArray(value.habits) && value.habits.length <= MAX_CUSTOM_HABITS, 'shaxsiy odatlar');
  const habitIds = new Set<string>(DEFAULT_HABIT_IDS);
  const habits: CustomHabit[] = value.habits.map((entry: unknown) => {
    demand(record(entry) && safeId(entry.id) && !habitIds.has(entry.id), 'odat identifikatori');
    demand(typeof entry.title === 'string' && entry.title.trim().length > 0
      && entry.title.length <= MAX_HABIT_TITLE_LENGTH, 'odat nomi');
    demand(Array.isArray(entry.weekdays) && entry.weekdays.every((day: unknown) => wholeNumber(day, 0, 6))
      && new Set(entry.weekdays).size === entry.weekdays.length, 'odat kunlari');
    demand(isoTimestamp(entry.createdAt), 'odat sanasi');
    habitIds.add(entry.id);
    return {
      id: entry.id, title: entry.title, createdAt: entry.createdAt,
      weekdays: [...(entry.weekdays as number[])].sort((a, b) => a - b),
    };
  });

  demand(record(value.days) && Object.keys(value.days).length <= MAX_HISTORY_DAYS, 'kunlar');
  const days: Record<string, DayProgress> = {};
  for (const [key, rawDay] of Object.entries(value.days)) {
    demand(validDateKey(key) && record(rawDay), 'kun sanasi');
    demand(record(rawDay.counts), 'sanoqlar');
    const counts: Record<string, number[]> = {};
    for (const [id, rawCounts] of Object.entries(rawDay.counts)) {
      demand(ids.has(id) && Array.isArray(rawCounts) && rawCounts.length === DAILY_SESSIONS
        && rawCounts.every((count: unknown) => wholeNumber(count, 0, SESSION_TARGET)), 'istig‘for sanog‘i');
      counts[id] = [...rawCounts] as number[];
    }
    demand(Array.isArray(rawDay.habits) && rawDay.habits.length <= 100
      && rawDay.habits.every(safeId) && new Set(rawDay.habits).size === rawDay.habits.length, 'odatlar');
    demand(record(rawDay.adhkar) && Object.keys(rawDay.adhkar).length <= 20, 'zikrlar');
    const adhkar: Record<string, number> = {};
    for (const [id, count] of Object.entries(rawDay.adhkar)) {
      demand(safeId(id) && wholeNumber(count, 0, MAX_ADHKAR_PER_DAY), 'zikr sanog‘i');
      if (count > 0) adhkar[id] = count;
    }
    const day: DayProgress = { counts, habits: [...rawDay.habits] as string[], adhkar };
    if (rawDay.evening !== undefined) day.evening = validateEvening(rawDay.evening);
    days[key] = day;
  }

  demand(record(value.settings) && typeof value.settings.enabled === 'boolean'
    && Array.isArray(value.settings.times) && value.settings.times.every((time: unknown) => typeof time === 'string'), 'eslatmalar');
  let settings: ReminderSettings;
  try {
    settings = normalizeReminderSettings(value.settings as ReminderSettings);
  } catch {
    throw new StateValidationError('eslatma vaqtlari');
  }
  return {
    version: 2, reflections, habits, days, lock: validateLock(value.lock),
    settings: {
      enabled: settings.enabled, dayStart: settings.dayStart, dayEnd: settings.dayEnd,
      sunnahPerDay: settings.sunnahPerDay, times: [...settings.times], eveningTime: settings.eveningTime ?? null,
    },
  };
}

function emptyDay(): DayProgress {
  return { counts: {}, habits: [], adhkar: {} };
}

function copyDay(day: DayProgress | undefined): DayProgress {
  if (!day) return emptyDay();
  const copy: DayProgress = { counts: { ...day.counts }, habits: [...day.habits], adhkar: { ...day.adhkar } };
  if (day.evening) copy.evening = { ...day.evening };
  return copy;
}

function dayOf(state: AppState, dateKey: string): DayProgress | undefined {
  return hasOwn(state.days, dateKey) ? state.days[dateKey] : undefined;
}

function withDay(state: AppState, dateKey: string, day: DayProgress): AppState {
  return pruneHistory({ ...state, days: { ...state.days, [dateKey]: day } });
}

/** All five stored slots, unclamped. Most screens want `getSessionCounts` instead. */
export function getCounts(state: AppState, id: string, dateKey = localDateKey()): number[] {
  const day = dayOf(state, dateKey);
  const counts = day && hasOwn(day.counts, id) ? day.counts[id] : undefined;
  return counts ? [...counts] : Array<number>(DAILY_SESSIONS).fill(0);
}

/** The sessions this intention uses today, each capped at its chosen count. */
export function getSessionCounts(state: AppState, reflection: Reflection, dateKey = localDateKey()): number[] {
  return getCounts(state, reflection.id, dateKey).slice(0, reflection.sessions)
    .map((count) => Math.min(count, reflection.target));
}

export function reflectionTarget(reflection: Reflection): number {
  return reflection.sessions * reflection.target;
}

export function getReflectionTotal(state: AppState, reflection: Reflection, dateKey = localDateKey()): number {
  return getSessionCounts(state, reflection, dateKey).reduce((sum, count) => sum + count, 0);
}

export function getDayTotal(state: AppState, dateKey = localDateKey()): number {
  return state.reflections.filter((reflection) => !reflection.archived)
    .reduce((total, reflection) => total + getReflectionTotal(state, reflection, dateKey), 0);
}

export function getDayTarget(state: AppState): number {
  return state.reflections.filter((reflection) => !reflection.archived)
    .reduce((total, reflection) => total + reflectionTarget(reflection), 0);
}

/** Istighfar reminders follow the largest active routine: one reminder per session in use. */
export function istighfarSlots(state: AppState): number {
  return state.reflections.filter((reflection) => !reflection.archived)
    .reduce((slots, reflection) => Math.max(slots, reflection.sessions), 0);
}

/** Retain the newest 30 local-day records, regardless of gaps between visits. */
export function pruneHistory(state: AppState): AppState {
  const keys = Object.keys(state.days).sort();
  if (keys.length <= MAX_HISTORY_DAYS) return state;
  const days: Record<string, DayProgress> = {};
  for (const key of keys.slice(-MAX_HISTORY_DAYS)) days[key] = state.days[key]!;
  return { ...state, days };
}

export function createReflection(
  state: AppState,
  input: { label: string; note: string; sessions: number; target: number },
  now = new Date(),
): { state: AppState; id: string } | null {
  if (state.reflections.length >= MAX_REFLECTIONS || !validRoutine(input.sessions, input.target)) return null;
  const label = input.label.trim().slice(0, MAX_LABEL_LENGTH) || `Niyat ${state.reflections.length + 1}`;
  const id = `r${now.getTime()}${Math.random().toString(36).slice(2, 8)}`;
  const reflection: Reflection = {
    id, label, note: input.note.trim().slice(0, MAX_NOTE_LENGTH), createdAt: now.toISOString(),
    archived: false, sessions: input.sessions, target: input.target,
  };
  return { state: { ...state, reflections: [...state.reflections, reflection] }, id };
}

/** Changing a routine never deletes counts; a lower target simply caps what is shown. */
export function setRoutine(state: AppState, id: string, sessions: number, target: number): AppState {
  if (!validRoutine(sessions, target)) return state;
  let changed = false;
  const reflections = state.reflections.map((reflection) => {
    if (reflection.id !== id || (reflection.sessions === sessions && reflection.target === target)) return reflection;
    changed = true;
    return { ...reflection, sessions, target };
  });
  return changed ? { ...state, reflections } : state;
}

export function incrementCount(
  state: AppState, id: string, slot: number, delta = 1, dateKey = localDateKey(),
): AppState {
  assertDateKey(dateKey);
  if (!Number.isInteger(slot) || slot < 0 || !Number.isInteger(delta)) return state;
  const reflection = state.reflections.find((entry) => entry.id === id && !entry.archived);
  if (!reflection || slot >= reflection.sessions) return state;
  const previous = getCounts(state, id, dateKey);
  const current = Math.min(previous[slot]!, reflection.target);
  const next = Math.max(0, Math.min(reflection.target, current + delta));
  if (next === previous[slot]) return state;
  previous[slot] = next;
  const day = copyDay(dayOf(state, dateKey));
  day.counts[id] = previous;
  return withDay(state, dateKey, day);
}

export function toggleHabit(state: AppState, id: string, dateKey = localDateKey()): AppState {
  assertDateKey(dateKey);
  if (!safeId(id)) return state;
  const day = copyDay(dayOf(state, dateKey));
  const exists = day.habits.includes(id);
  if (!exists && day.habits.length >= 100) return state;
  day.habits = exists ? day.habits.filter((habit) => habit !== id) : [...day.habits, id];
  return withDay(state, dateKey, day);
}

export function addCustomHabit(
  state: AppState, input: { title: string; weekdays: number[] }, now = new Date(),
): AppState {
  const title = input.title.trim().slice(0, MAX_HABIT_TITLE_LENGTH);
  const weekdays = [...new Set(input.weekdays)].filter((day) => wholeNumber(day, 0, 6)).sort((a, b) => a - b);
  if (!title || state.habits.length >= MAX_CUSTOM_HABITS) return state;
  const habit: CustomHabit = {
    id: `h${now.getTime()}${Math.random().toString(36).slice(2, 8)}`, title, weekdays, createdAt: now.toISOString(),
  };
  return { ...state, habits: [...state.habits, habit] };
}

/** Past check-offs stay in history; only the habit leaves today's list. */
export function removeCustomHabit(state: AppState, id: string): AppState {
  const habits = state.habits.filter((habit) => habit.id !== id);
  return habits.length === state.habits.length ? state : { ...state, habits };
}

export function customHabitsFor(state: AppState, dateKey = localDateKey()): CustomHabit[] {
  const weekday = weekdayOf(dateKey);
  return state.habits.filter((habit) => habit.weekdays.length === 0 || habit.weekdays.includes(weekday));
}

export function getAdhkarCount(state: AppState, id: string, dateKey = localDateKey()): number {
  const day = dayOf(state, dateKey);
  return day && hasOwn(day.adhkar, id) ? day.adhkar[id]! : 0;
}

export function setAdhkarCount(state: AppState, id: string, count: number, dateKey = localDateKey()): AppState {
  assertDateKey(dateKey);
  if (!safeId(id) || !Number.isInteger(count)) return state;
  const next = Math.max(0, Math.min(MAX_ADHKAR_PER_DAY, count));
  if (next === getAdhkarCount(state, id, dateKey)) return state;
  const day = copyDay(dayOf(state, dateKey));
  if (next === 0) delete day.adhkar[id];
  else if (Object.keys(day.adhkar).length >= 20 && !hasOwn(day.adhkar, id)) return state;
  else day.adhkar[id] = next;
  return withDay(state, dateKey, day);
}

export function getEvening(state: AppState, dateKey = localDateKey()): EveningEntry | undefined {
  const entry = dayOf(state, dateKey)?.evening;
  return entry ? { ...entry } : undefined;
}

/** Saving three empty answers removes the entry instead of keeping a blank record. */
export function saveEvening(
  state: AppState,
  input: { gratitude: string; improve: string; intention: string },
  dateKey = localDateKey(),
  now = new Date(),
): AppState {
  assertDateKey(dateKey);
  const clean = (text: string) => text.trim().slice(0, MAX_EVENING_LENGTH);
  const entry = { gratitude: clean(input.gratitude), improve: clean(input.improve), intention: clean(input.intention) };
  if (!entry.gratitude && !entry.improve && !entry.intention) return deleteEvening(state, dateKey);
  const day = copyDay(dayOf(state, dateKey));
  day.evening = { ...entry, updatedAt: now.toISOString() };
  return withDay(state, dateKey, day);
}

/** A deleted reflection leaves no dated empty record behind. */
export function deleteEvening(state: AppState, dateKey: string): AppState {
  const existing = dayOf(state, dateKey);
  if (!existing?.evening) return state;
  const day = copyDay(existing);
  delete day.evening;
  const days = { ...state.days };
  const empty = Object.keys(day.counts).length === 0 && day.habits.length === 0 && Object.keys(day.adhkar).length === 0;
  if (empty) delete days[dateKey];
  else days[dateKey] = day;
  return { ...state, days };
}

/** Newest first. Only days that still hold an entry within the retained history. */
export function eveningHistory(state: AppState): Array<{ dateKey: string; entry: EveningEntry }> {
  return Object.keys(state.days).sort().reverse()
    .flatMap((dateKey) => {
      const entry = state.days[dateKey]?.evening;
      return entry ? [{ dateKey, entry: { ...entry } }] : [];
    });
}

/** Any small good step counts: a habit, a count, a finished dhikr or an evening reflection. */
export function dayHasActivity(state: AppState, dateKey: string): boolean {
  const day = dayOf(state, dateKey);
  if (!day) return false;
  return day.habits.length > 0
    || Object.values(day.counts).some((counts) => counts.some((count) => count > 0))
    || Object.values(day.adhkar).some((count) => count > 0)
    || !!day.evening;
}

export type ActivityDay = { dateKey: string; active: boolean; today: boolean };

/** The last `length` days ending today, oldest first. There is no streak and nothing is owed. */
export function activityCalendar(state: AppState, today = localDateKey(), length = MAX_HISTORY_DAYS): ActivityDay[] {
  return Array.from({ length }, (_, index) => {
    const dateKey = shiftDateKey(today, index - length + 1);
    return { dateKey, active: dayHasActivity(state, dateKey), today: dateKey === today };
  });
}

export function consistencySummary(state: AppState, today = localDateKey(), length = 7): { active: number; total: number } {
  const days = activityCalendar(state, today, length);
  return { active: days.filter((day) => day.active).length, total: days.length };
}
