import { buildReminderPlan, type SunnahReminder } from '../src/domain/schedule';
import sunnah from '../src/data/sunnah.json';
import type { Delivery, Registration } from './types';

const MINUTE = 60_000;
const DAY = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    // Keep the shared isolate cache bounded when different devices use many zones.
    if (formatters.size >= 64) formatters.clear();
    formatters.set(timeZone, value);
  }
  return value;
}

function parts(timestamp: number, timeZone: string) {
  const values = Object.fromEntries(formatter(timeZone).formatToParts(timestamp).map((part) => [part.type, part.value]));
  return {
    day: `${values.year}-${values.month}-${values.day}`,
    year: Number(values.year), month: Number(values.month), date: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute),
  };
}

export function zonedDay(timestamp: number, timeZone: string): string { return parts(timestamp, timeZone).day; }

function dayEpoch(day: string): number { return Date.parse(`${day}T00:00:00Z`); }
function plusDays(day: string, count: number): string { return new Date(dayEpoch(day) + count * DAY).toISOString().slice(0, 10); }

/**
 * Resolve an actual local clock minute, including half-hour and DST offsets.
 * Skip nonexistent spring-forward times; use the first fall-back occurrence.
 * We never move a chosen time to a different wall-clock minute.
 */
export function wallTimeToEpoch(day: string, minute: number, timeZone: string): number | null {
  const wall = dayEpoch(day) + minute * MINUTE;
  const target = new Date(wall);
  const targetDay = target.toISOString().slice(0, 10);
  const targetMinute = target.getUTCHours() * 60 + target.getUTCMinutes();
  const offsets = new Set<number>();
  for (const delta of [-36, 0, 36]) {
    const sample = wall + delta * 3_600_000;
    const local = parts(sample, timeZone);
    offsets.add(Date.UTC(local.year, local.month - 1, local.date, local.hour, local.minute) - sample);
  }
  const matches: number[] = [];
  for (const offset of offsets) {
    const candidate = wall - offset;
    const local = parts(candidate, timeZone);
    if (local.day === targetDay && local.hour * 60 + local.minute === targetMinute) matches.push(candidate);
  }
  return matches.length ? Math.min(...matches) : null;
}

export function deliveriesForDay(registration: Registration, day: string): Delivery[] {
  const calendar = new Date(`${day}T12:00:00Z`);
  // buildReminderPlan seeds using local fields, so construct those fields explicitly.
  const seed = new Date(calendar.getUTCFullYear(), calendar.getUTCMonth(), calendar.getUTCDate(), 12);
  const weekday = calendar.getUTCDay() + 1;
  const plan = buildReminderPlan(registration.settings, registration.hasActiveReflections,
    sunnah.reminders as SunnahReminder[], seed);
  return plan.filter((item) => item.trigger.type === 'daily' || item.trigger.weekday === weekday)
    .flatMap((item): Delivery[] => {
      const dueAt = wallTimeToEpoch(day, item.trigger.hour * 60 + item.trigger.minute, registration.timeZone);
      if (dueAt === null) return [];
      const end = wallTimeToEpoch(day, registration.settings.dayEnd * 60, registration.timeZone);
      const id = `${day}-${item.identifier}`;
      const quoteId = item.screen === 'today' ? sunnah.reminders.find((content) =>
        content.title === item.title && item.body.startsWith(content.text))?.id : undefined;
      return [{
        notice: {
          id, title: item.title, body: item.body, screen: item.screen,
          ...(quoteId ? { quoteId } : {}),
          url: `/?screen=${item.screen}${quoteId ? `&quoteId=${encodeURIComponent(quoteId)}` : ''}`,
          tag: `rahmat-${id.replace(/\./g, '-')}`,
        },
        dueAt, expiresAt: Math.min(dueAt + 5 * MINUTE, end ?? dueAt + 5 * MINUTE),
        attemptAt: dueAt, attempts: 0,
      }];
    }).sort((a, b) => a.dueAt - b.dueAt);
}

export function nextDelivery(registration: Registration, after: number, handled: readonly string[] = []): Delivery | null {
  if (!registration.settings.enabled) return null;
  const day = zonedDay(after, registration.timeZone);
  for (let index = 0; index < 4; index += 1) {
    const next = deliveriesForDay(registration, plusDays(day, index))
      .find((delivery) => delivery.dueAt > after && !handled.includes(delivery.notice.id));
    if (next) return next;
  }
  throw new Error('No future reminder could be scheduled.');
}
