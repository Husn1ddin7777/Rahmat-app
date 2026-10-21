import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKeyToJdn, formatHijri, HIJRI_MONTHS, hijriForDateKey, hijriToJdn, jdnToDateKey, jdnToHijri, monthLength, validHijriOffset,
} from '../src/domain/hijri';

const civil = new Intl.DateTimeFormat('en-u-ca-islamic-civil', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });

function reference(dateKey: string) {
  const parts = Object.fromEntries(civil.formatToParts(Date.parse(`${dateKey}T12:00:00Z`)).map((part) => [part.type, part.value]));
  return { year: Number(String(parts.year).replace(/\D/g, '')), month: Number(parts.month), day: Number(parts.day) };
}

test('the arithmetic calendar matches the Unicode islamic-civil calendar day by day', () => {
  // Every third day from 1990 to 2080 covers each weekday, month length and leap-year position.
  for (let jdn = dateKeyToJdn('1990-01-01'); jdn < dateKeyToJdn('2080-01-01'); jdn += 3) {
    const dateKey = jdnToDateKey(jdn);
    assert.deepEqual(jdnToHijri(jdn), reference(dateKey), dateKey);
  }
});

test('Gregorian and Hijri conversions round-trip', () => {
  for (let jdn = dateKeyToJdn('2020-01-01'); jdn < dateKeyToJdn('2040-01-01'); jdn += 1) {
    assert.equal(dateKeyToJdn(jdnToDateKey(jdn)), jdn);
    const hijri = jdnToHijri(jdn);
    assert.equal(hijriToJdn(hijri.year, hijri.month, hijri.day), jdn);
  }
  assert.equal(jdnToDateKey(dateKeyToJdn('2024-02-29')), '2024-02-29');
});

test('months alternate 30 and 29 days; Zulhijja has 30 in leap years only', () => {
  for (let year = 1440; year <= 1470; year += 1) {
    const lengths = Array.from({ length: 12 }, (_, index) => monthLength(year, index + 1));
    lengths.slice(0, 11).forEach((length, index) => assert.equal(length, index % 2 === 0 ? 30 : 29));
    const leap = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29].includes(year % 30);
    assert.equal(lengths[11], leap ? 30 : 29, `${year}`);
    assert.equal(lengths.reduce((sum, length) => sum + length, 0), leap ? 355 : 354);
  }
});

test('the user correction moves the date by whole days, within two days either way', () => {
  const base = hijriForDateKey('2026-10-22');
  assert.equal(formatHijri(base), '10 Jumodul avval 1448');
  assert.equal(formatHijri(hijriForDateKey('2026-10-22', 1)), '11 Jumodul avval 1448');
  assert.equal(formatHijri(hijriForDateKey('2026-10-22', -2)), '8 Jumodul avval 1448');
  for (const offset of [-2, -1, 0, 1, 2]) assert.ok(validHijriOffset(offset));
  for (const offset of [3, -3, 0.5, NaN, '1']) {
    assert.ok(!validHijriOffset(offset));
    assert.throws(() => hijriForDateKey('2026-10-22', offset as unknown as number));
  }
  assert.throws(() => hijriForDateKey('22.10.2026'));
  assert.equal(HIJRI_MONTHS.length, 12);
});
