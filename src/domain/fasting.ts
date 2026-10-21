import fasting from '../data/fasting.json';
import { dateKeyToJdn, hijriForDateKey, jdnToDateKey, type HijriDate } from './hijri';

export type FastingRule =
  | { type: 'date'; month: number; day: number }
  | { type: 'month'; month: number }
  | { type: 'weekly'; weekday: number }
  | { type: 'monthly' };

export type FastingDay = {
  id: string;
  title: string;
  when: FastingRule;
  text: string;
  source: string;
  url: string;
  contentType: 'paraphrase';
  remind: boolean;
  reminderTitle?: string;
};

export type FastingEvent = {
  /** The local calendar day the event falls on (or, for a month, its first day). */
  dateKey: string;
  hijri: HijriDate;
  day: FastingDay;
  /** A month already under way when the list starts. */
  ongoing: boolean;
};

export const FASTING_DAYS = fasting.days as FastingDay[];

export function addDays(dateKey: string, days: number): string {
  return jdnToDateKey(dateKeyToJdn(dateKey) + days);
}

/**
 * Sourced voluntary fasting days in the next `length` days, by the estimated
 * Hijri calendar. Weekly and "any three days" items are general notes and are
 * not listed by date.
 */
export function upcomingFastingDays(today: string, offset = 0, length = 60): FastingEvent[] {
  const events: FastingEvent[] = [];
  for (let index = 0; index < length; index += 1) {
    const dateKey = addDays(today, index);
    const hijri = hijriForDateKey(dateKey, offset);
    for (const day of FASTING_DAYS) {
      const rule = day.when;
      if (rule.type === 'date' && rule.month === hijri.month && rule.day === hijri.day) {
        events.push({ dateKey, hijri, day, ongoing: false });
      } else if (rule.type === 'month' && rule.month === hijri.month && (hijri.day === 1 || index === 0)) {
        events.push({ dateKey, hijri, day, ongoing: index === 0 && hijri.day !== 1 });
      }
    }
  }
  return events;
}

export type FastingReminder = { day: FastingDay; eveDateKey: string; eventDateKey: string };

/** Reminders for the evening before marked days, from today on. */
export function fastingReminders(today: string, offset = 0, horizon = 400, max = 4): FastingReminder[] {
  const reminders: FastingReminder[] = [];
  // Start from tomorrow's event, so today's evening can still remind about it.
  for (const event of upcomingFastingDays(addDays(today, 1), offset, horizon)) {
    if (!event.day.remind || event.day.when.type !== 'date') continue;
    reminders.push({ day: event.day, eventDateKey: event.dateKey, eveDateKey: addDays(event.dateKey, -1) });
    if (reminders.length >= max) break;
  }
  return reminders;
}

/** Marked days today or tomorrow, for a gentle card on the Today screen. */
export function nearFastingDays(today: string, offset = 0): Array<FastingEvent & { tomorrow: boolean }> {
  return upcomingFastingDays(today, offset, 2)
    .filter((event) => event.day.when.type === 'date')
    .map((event) => ({ ...event, tomorrow: event.dateKey !== today }));
}

export function fastingDay(id: string): FastingDay | undefined {
  return FASTING_DAYS.find((day) => day.id === id);
}
