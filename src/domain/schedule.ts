/** Calendar reminders use local device time, never reflection text or entry IDs. */
export type ReminderSettings = {
  enabled: boolean;
  dayStart: number;
  dayEnd: number;
  sunnahPerDay: 1 | 2 | 3;
  times: string[];
  /** Optional evening Muhosaba prompt (HH:mm). Not limited to the daytime window. */
  eveningTime?: string | null;
};

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
  trigger:
    | { type: 'daily'; hour: number; minute: number }
    | { type: 'weekly'; weekday: number; hour: number; minute: number };
};

/** Five istighfar prompts, one evening prompt and up to 21 weekly Sunnah reminders. */
export const MAX_SCHEDULED_REMINDERS = 27;
export const MAX_ISTIGHFAR_SLOTS = 5;

/** Generic wording only: the user's own reflection text never enters a notification. */
export const EVENING_REMINDER = {
  title: 'Kechki muhosaba',
  body: 'Kun yakunida bir daqiqa: shukr, saboq va ertangi niyat.',
} as const;

export function timeToMinutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Vaqtni HH:mm ko‘rinishida kiriting (masalan, 08:00).');
  }
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** Validate instead of moving a time the user explicitly chose. */
export function normalizeReminderSettings(settings: ReminderSettings): ReminderSettings {
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
  if (settings.times.length !== 5) {
    throw new Error('Istig‘for uchun beshta vaqtni belgilang.');
  }
  const minutes = settings.times.map(timeToMinutes);
  if (new Set(minutes).size !== 5) {
    throw new Error('Istig‘for uchun beshta alohida vaqtni belgilang.');
  }
  if (minutes.some((minute) => minute < settings.dayStart * 60 || minute >= settings.dayEnd * 60)) {
    throw new Error('Barcha eslatmalar tanlangan kunduzgi oraliqda bo‘lishi kerak.');
  }
  const eveningTime = settings.eveningTime ?? null;
  if (eveningTime !== null) {
    if (typeof eveningTime !== 'string') throw new Error('Kechki muhosaba vaqtini HH:mm ko‘rinishida kiriting.');
    timeToMinutes(eveningTime);
  }
  return {
    enabled: settings.enabled,
    dayStart: settings.dayStart,
    dayEnd: settings.dayEnd,
    sunnahPerDay: settings.sunnahPerDay,
    times: [...settings.times],
    eveningTime,
  };
}

/** Old clients and stored server records only knew whether any intention was active. */
export function normalizeIstighfarSlots(value: unknown): number {
  if (typeof value === 'boolean') return value ? MAX_ISTIGHFAR_SLOTS : 0;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_ISTIGHFAR_SLOTS) return value;
  throw new Error('Istig‘for eslatmalari soni 0 dan 5 gacha bo‘lishi kerak.');
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

/**
 * Daily istighfar prompts are shared by all active reflections: one per session
 * of the largest active routine, using the first chosen times in order.
 * Sunnah reminders repeat by weekday until the app next refreshes the plan.
 * A local-day seed makes the plan stable across rerenders and app restarts.
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
  const dailyMinutes = settings.times.slice(0, slots).map(timeToMinutes);
  dailyMinutes.forEach((minute, slot) => {
    plan.push({
      identifier: `rahmah.istighfar.${slot}`,
      title: 'Qalbingizga bir lahza',
      body: 'Bir lahza xotirjamlik. Istig‘for uchun vaqt ajrating.',
      screen: 'istighfar',
      trigger: { type: 'daily', hour: Math.floor(minute / 60), minute: minute % 60 },
    });
  });
  const reservedMinutes = [...dailyMinutes];
  if (settings.eveningTime) {
    const minute = timeToMinutes(settings.eveningTime);
    reservedMinutes.push(minute);
    plan.push({
      identifier: 'rahmah.evening',
      title: EVENING_REMINDER.title,
      body: EVENING_REMINDER.body,
      screen: 'reflections',
      trigger: { type: 'daily', hour: Math.floor(minute / 60), minute: minute % 60 },
    });
  }

  // Only vetted paraphrases from the bundled public content enter notifications.
  const publicReminders = reminders.filter((reminder) => reminder.contentType === 'paraphrase');
  if (publicReminders.length === 0) return plan;
  const start = settings.dayStart * 60;
  const end = settings.dayEnd * 60;
  const seed = `${localScheduleDay(now)}:${JSON.stringify(settings)}`;

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
        trigger: { type: 'weekly', weekday, hour: Math.floor(minute / 60), minute: minute % 60 },
      });
    }
  }
  return plan;
}

/** Changes on a local day, timezone offset, setting, or bundled-content update. */
export function reminderPlanKey(plan: readonly PlannedReminder[], now = new Date()): string {
  return `v1:${localScheduleDay(now)}:${now.getTimezoneOffset()}:${hash(JSON.stringify(plan)).toString(36)}`;
}
