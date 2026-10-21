/**
 * The tabular (arithmetic) Islamic calendar with the civil epoch, the same rule as
 * `islamic-civil` in Unicode CLDR. It is an estimate: real months begin with the
 * sighting of the new moon, so the user can shift the result by up to two days to
 * match the local announcement.
 */
export type HijriDate = { year: number; month: number; day: number };

export const HIJRI_OFFSET_LIMIT = 2;
/** 1 Muharram 1 AH (civil epoch), as a Julian Day Number. */
const EPOCH = 1948440;

export const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabiul avval', 'Rabiul oxir', 'Jumodul avval', 'Jumodul oxir',
  'Rajab', 'Sha’bon', 'Ramazon', 'Shavvol', 'Zulqa’da', 'Zulhijja',
] as const;

export function validHijriOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && Math.abs(value) <= HIJRI_OFFSET_LIMIT;
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error('Sana YYYY-MM-DD ko‘rinishida bo‘lishi kerak.');
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Julian Day Number of a proleptic Gregorian date. */
export function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function jdnToDateKey(jdn: number): string {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor(1461 * d / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dateKeyToJdn(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  return gregorianToJdn(year, month, day);
}

/** Leap years (30 days in Zulhijja) are 2, 5, 7, 10, 13, 16, 18, 21, 24, 26 and 29 of each 30-year cycle. */
export function hijriToJdn(year: number, month: number, day: number): number {
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + EPOCH - 1;
}

export function jdnToHijri(jdn: number): HijriDate {
  const year = Math.floor((30 * (jdn - EPOCH) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((jdn - 29 - hijriToJdn(year, 1, 1)) / 29.5) + 1);
  const day = jdn - hijriToJdn(year, month, 1) + 1;
  return { year, month, day };
}

/** The Hijri date for a local calendar day, shifted by the user's correction. */
export function hijriForDateKey(dateKey: string, offset = 0): HijriDate {
  if (!validHijriOffset(offset)) throw new Error('Hijriy sana tuzatmasi −2 dan +2 kungacha bo‘lishi kerak.');
  return jdnToHijri(dateKeyToJdn(dateKey) + offset);
}

export function monthLength(year: number, month: number): number {
  return hijriToJdn(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1) - hijriToJdn(year, month, 1);
}

export function formatHijri(date: HijriDate): string {
  return `${date.day} ${HIJRI_MONTHS[date.month - 1]} ${date.year}`;
}
