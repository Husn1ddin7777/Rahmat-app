import { fastingReminders } from './fasting';
import { validHijriOffset } from './hijri';
import { isScript, toScript, type Script } from './script';

export type IstighfarAnchor = 'clock' | 'prayer';

/** Calendar reminders use local device time, never reflection text or entry IDs. */
export type ReminderSettings = {
  enabled: boolean;
  dayStart: number;
  dayEnd: number;
  sunnahPerDay: 1 | 2 | 3;
  times: string[];
  /** Optional evening Muhosaba prompt (HH:mm). Not limited to the daytime window. */
  eveningTime?: string | null;
  /** Writing system of the app's own text and of notifications. */
  script?: Script;
  /** Istighfar prompts at chosen clock times, or after the prayers at times the user enters. */
  istighfarAnchor?: IstighfarAnchor;
  /** Bomdod, Peshin, Asr, Shom, Xufton (HH:mm). Empty means no prompt after that prayer. */
  prayerTimes?: Array<string | null>;
  /** A reminder the evening before sourced voluntary fasting days. */
  fastingReminders?: boolean;
  /** Days added to the calculated Hijri date (−2…+2) to match the local announcement. */
  hijriOffset?: number;
};

/** Every field filled in: what the app stores and the server keeps. */
export type NormalizedReminderSettings = Required<ReminderSettings>;

export type ReminderResult = {
  status: 'enabled' | 'disabled' | 'denied' | 'preview' | 'install-required' | 'unavailable';
  scheduled: number;
};

export type SunnahReminder = {
  id: string;
  title: string;
  text: string;
  source: string;
  url: string;
  timeCategory: string;
  contentType: 'paraphrase';
};

export type ReminderScreen = 'istighfar' | 'today' | 'reflections';

export type PlannedReminder = {
  identifier: string;
  title: string;
  body: string;
  screen: ReminderScreen;
  /** The Sunnah reminder shown, so opening the notification shows the same text. */
  contentId?: string;
  /** Allowed after the daytime window (evening, prayer and fasting reminders). */
  outsideWindow?: boolean;
  trigger:
    | { type: 'daily'; hour: number; minute: number }
    | { type: 'weekly'; weekday: number; hour: number; minute: number }
    | { type: 'date'; dateKey: string; hour: number; minute: number };
};

export const MAX_ISTIGHFAR_SLOTS = 5;
export const MAX_FASTING_REMINDERS = 4;
/** Five istighfar prompts, one evening prompt, up to 21 weekly Sunnah reminders and four fasting eves. */
export const MAX_SCHEDULED_REMINDERS = 31;
export const PRAYER_NAMES = ['Bomdod', 'Peshin', 'Asr', 'Shom', 'Xufton'] as const;
export const EMPTY_PRAYER_TIMES: ReadonlyArray<string | null> = [null, null, null, null, null];
/** The evening before a marked fasting day. */
export const FASTING_REMINDER_TIME = 20 * 60;

/** Generic wording only: the user's own reflection text never enters a notification. */
export const EVENING_REMINDER = {
  title: 'Kechki muhosaba',
  body: 'Kun yakunida bir daqiqa: shukr, saboq va ertangi niyat.',
} as const;
export const ISTIGHFAR_REMINDER = {
  title: 'Qalbingizga bir lahza',
  body: 'Bir lahza xotirjamlik. Istig‘for uchun vaqt ajrating.',
} as const;
export const PRAYER_REMINDER_BODY = 'Namozdan so‘ng bir lahza istig‘for uchun vaqt ajrating.';

export function timeToMinutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Vaqtni HH:mm ko‘rinishida kiriting (masalan, 08:00).');
  }
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function normalizePrayerTimes(value: unknown, required: boolean): Array<string | null> {
  if (value === undefined || value === null) {
    if (required) throw new Error('Kamida bitta namoz vaqtini kiriting.');
    return [...EMPTY_PRAYER_TIMES];
  }
  if (!Array.isArray(value) || value.length !== PRAYER_NAMES.length) throw new Error('Beshta namoz uchun vaqt maydoni bo‘lishi kerak.');
  const times = value.map((time: unknown) => {
    if (time === null || time === '') return null;
    if (typeof time !== 'string') throw new Error('Namoz vaqtini HH:mm ko‘rinishida kiriting.');
    timeToMinutes(time);
    return time;
  });
  const minutes = times.flatMap((time) => time === null ? [] : [timeToMinutes(time)]);
  if (required && minutes.length === 0) throw new Error('Kamida bitta namoz vaqtini kiriting.');
  if (minutes.some((minute, index) => index > 0 && minute <= minutes[index - 1]!)) {
    throw new Error('Namoz vaqtlari Bomdoddan Xuftongacha tartib bilan bo‘lishi kerak.');
  }
  return times;
}

/** Validate instead of moving a time the user explicitly chose. Missing newer fields get their defaults. */
export function normalizeReminderSettings(settings: ReminderSettings): NormalizedReminderSettings {
  if (
    !Number.isInteger(settings.dayStart) ||
    !Number.isInteger(settings.dayEnd) ||
    settings.dayStart < 0 ||
    settings.dayStart > 23 ||
    settings.dayEnd < 1 ||
    settings.dayEnd > 24 ||
    settings.dayEnd <= settings.dayStart
  ) {
    throw new Error('Kun boshlanishi tugashidan oldin bo‘lishi kerak.');
  }
  if (![1, 2, 3].includes(settings.sunnahPerDay)) {
    throw new Error('Kunlik sunnat eslatmalari soni 1, 2 yoki 3 bo‘lishi kerak.');
  }
  if (!Array.isArray(settings.times) || settings.times.length !== 5) {
    throw new Error('Istig‘for uchun beshta vaqtni belgilang.');
  }
  const istighfarAnchor = settings.istighfarAnchor ?? 'clock';
  if (istighfarAnchor !== 'clock' && istighfarAnchor !== 'prayer') throw new Error('Istig‘for eslatmasi turi noto‘g‘ri.');
  const minutes = settings.times.map(timeToMinutes);
  if (new Set(minutes).size !== 5) {
    throw new Error('Istig‘for uchun beshta alohida vaqtni belgilang.');
  }
  // Clock times are only used, and so only bound to the daytime window, in clock mode.
  if (istighfarAnchor === 'clock' && minutes.some((minute) => minute < settings.dayStart * 60 || minute >= settings.dayEnd * 60)) {
    throw new Error('Barcha eslatmalar tanlangan kunduzgi oraliqda bo‘lishi kerak.');
  }
  const eveningTime = settings.eveningTime ?? null;
  if (eveningTime !== null) {
    if (typeof eveningTime !== 'string') throw new Error('Kechki muhosaba vaqtini HH:mm ko‘rinishida kiriting.');
    timeToMinutes(eveningTime);
  }
  const script = settings.script ?? 'latin';
  if (!isScript(script)) throw new Error('Yozuv turi noto‘g‘ri.');
  const fasting = settings.fastingReminders ?? false;
  if (typeof fasting !== 'boolean') throw new Error('Ro‘za eslatmasi sozlamasi noto‘g‘ri.');
  const hijriOffset = settings.hijriOffset ?? 0;
  if (!validHijriOffset(hijriOffset)) throw new Error('Hijriy sana tuzatmasi −2 dan +2 kungacha bo‘lishi kerak.');
  return {
    enabled: settings.enabled,
    dayStart: settings.dayStart,
    dayEnd: settings.dayEnd,
    sunnahPerDay: settings.sunnahPerDay,
    times: [...settings.times],
    eveningTime,
    script,
    istighfarAnchor,
    prayerTimes: normalizePrayerTimes(settings.prayerTimes, istighfarAnchor === 'prayer'),
    fastingReminders: fasting,
    hijriOffset,
  };
}

/** Old clients and stored server records only knew whether any intention was active. */
export function normalizeIstighfarSlots(value: unknown): number {
  if (typeof value === 'boolean') return value ? MAX_ISTIGHFAR_SLOTS : 0;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_ISTIGHFAR_SLOTS) return value;
  throw new Error('Istig‘for eslatmalari soni 0 dan 5 gacha bo‘lishi kerak.');
}

/**
 * The prompts used by the day's sessions: the first `slots` clock times, or the
 * first `slots` prayers that have a time. Session N on the counter matches prompt N.
 */
export function istighfarPrompts(settings: NormalizedReminderSettings, slots: number): Array<{ index: number; minute: number; prayer: string | null }> {
  if (settings.istighfarAnchor === 'prayer') {
    return settings.prayerTimes
      .flatMap((time, index) => time === null ? [] : [{ index, minute: timeToMinutes(time), prayer: PRAYER_NAMES[index]! as string }])
      .slice(0, slots);
  }
  return settings.times.slice(0, slots).map((time, index) => ({ index, minute: timeToMinutes(time), prayer: null }));
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  }
  return result >>> 0;
}

function pick<T>(values: readonly T[], seed: string): T {
  const value = values[hash(seed) % values.length];
  if (value === undefined) throw new Error('Eslatma jadvalini tuzib bo‘lmadi.');
  return value;
}

export function localScheduleDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fitsTime(reminder: SunnahReminder, minute: number): boolean {
  return fitsTimeCategory(reminder.timeCategory, minute);
}

/** Whether content tagged for a time of day suits a local clock minute. */
export function fitsTimeCategory(category: string, minute: number): boolean {
  const hour = minute / 60;
  switch (category) {
    case 'morning': return hour >= 5 && hour < 11;
    case 'mealtime': return (hour >= 7 && hour < 9) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20);
    case 'evening': return hour >= 17;
    case 'daytime': return hour >= 8 && hour < 18;
    default: return true;
  }
}

function clock(minute: number) {
  return { hour: Math.floor(minute / 60), minute: minute % 60 };
}

/**
 * Daily istighfar prompts are shared by all active reflections: one per session
 * of the largest active routine. Sunnah reminders repeat by weekday until the
 * app next refreshes the plan; fasting reminders are dated. A local-day seed
 * makes the plan stable across rerenders and app restarts.
 */
export function buildReminderPlan(
  input: ReminderSettings,
  istighfarSlots: number,
  reminders: readonly SunnahReminder[],
  now = new Date(),
): PlannedReminder[] {
  if (!input.enabled) return [];
  const settings = normalizeReminderSettings(input);
  const slots = normalizeIstighfarSlots(istighfarSlots);
  const plan: PlannedReminder[] = [];
  const prompts = istighfarPrompts(settings, slots);
  for (const prompt of prompts) {
    plan.push({
      identifier: `rahmah.istighfar.${prompt.index}`,
      title: prompt.prayer ? `${prompt.prayer} namozidan so‘ng` : ISTIGHFAR_REMINDER.title,
      body: prompt.prayer ? PRAYER_REMINDER_BODY : ISTIGHFAR_REMINDER.body,
      screen: 'istighfar',
      ...(prompt.prayer ? { outsideWindow: true } : {}),
      trigger: { type: 'daily', ...clock(prompt.minute) },
    });
  }
  const reservedMinutes = prompts.map((prompt) => prompt.minute);
  if (settings.eveningTime) {
    const minute = timeToMinutes(settings.eveningTime);
    reservedMinutes.push(minute);
    plan.push({
      identifier: 'rahmah.evening',
      title: EVENING_REMINDER.title,
      body: EVENING_REMINDER.body,
      screen: 'reflections',
      outsideWindow: true,
      trigger: { type: 'daily', ...clock(minute) },
    });
  }

  const today = localScheduleDay(now);
  if (settings.fastingReminders) {
    let minute = FASTING_REMINDER_TIME;
    while (reservedMinutes.includes(minute)) minute += 5;
    for (const reminder of fastingReminders(today, settings.hijriOffset, 400, MAX_FASTING_REMINDERS)) {
      plan.push({
        identifier: `rahmah.fasting.${reminder.day.id}.${reminder.eventDateKey}`,
        title: reminder.day.reminderTitle ?? reminder.day.title,
        body: `${reminder.day.text}\n${reminder.day.source} · Mazmunan · Sana taxminiy`,
        screen: 'today',
        outsideWindow: true,
        trigger: { type: 'date', dateKey: reminder.eveDateKey, ...clock(minute) },
      });
    }
  }

  // Only vetted paraphrases from the bundled public content enter notifications.
  const publicReminders = reminders.filter((reminder) => reminder.contentType === 'paraphrase');
  if (publicReminders.length > 0) {
    const start = settings.dayStart * 60;
    const end = settings.dayEnd * 60;
    // Script, Hijri and fasting choices do not move Sunnah reminders: switching script only re-words them.
    const { script: _script, fastingReminders: _fasting, hijriOffset: _offset, ...timing } = settings;
    const seed = `${today}:${JSON.stringify(timing)}`;

    for (let weekday = 1; weekday <= 7; weekday += 1) {
      const usedMinutes = [...reservedMinutes];
      const usedContent = new Set<string>();
      for (let slot = 0; slot < settings.sunnahPerDay; slot += 1) {
        const segmentStart = start + Math.floor((end - start) * slot / settings.sunnahPerDay);
        const segmentEnd = start + Math.floor((end - start) * (slot + 1) / settings.sunnahPerDay);
        const available = Array.from({ length: segmentEnd - segmentStart }, (_, i) => segmentStart + i)
          .filter((minute) => !usedMinutes.includes(minute));
        const spaced = available.filter((minute) => usedMinutes.every((used) => Math.abs(used - minute) >= 10));
        const candidates = spaced.length ? spaced : available;
        const minute = pick(candidates, `${seed}:${weekday}:${slot}:time`);
        usedMinutes.push(minute);

        const timely = publicReminders.filter((reminder) => fitsTime(reminder, minute));
        const pool = timely.length ? timely : publicReminders;
        const fresh = pool.filter((reminder) => !usedContent.has(reminder.id));
        const contentCandidates = fresh.length ? fresh : pool;
        const content = pick(contentCandidates, `${seed}:${weekday}:${slot}:content`);
        usedContent.add(content.id);
        plan.push({
          identifier: `rahmah.sunnah.${weekday}.${slot}`,
          title: content.title,
          body: `${content.text}\n${content.source} · Mazmunan`,
          screen: 'today',
          contentId: content.id,
          trigger: { type: 'weekly', weekday, ...clock(minute) },
        });
      }
    }
  }
  return settings.script === 'latin' ? plan
    : plan.map((item) => ({ ...item, title: toScript(item.title, settings.script), body: toScript(item.body, settings.script) }));
}

/** Changes on a local day, timezone offset, setting, or bundled-content update. */
export function reminderPlanKey(plan: readonly PlannedReminder[], now = new Date()): string {
  return `v1:${localScheduleDay(now)}:${now.getTimezoneOffset()}:${hash(JSON.stringify(plan)).toString(36)}`;
}
