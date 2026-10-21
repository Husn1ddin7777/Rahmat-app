import test from 'node:test';
import assert from 'node:assert/strict';
import sunnah from '../src/data/sunnah.json';
import adhkar from '../src/data/adhkar.json';
import muhosaba from '../src/data/muhosaba.json';

const CATEGORIES = new Set(['morning', 'daytime', 'mealtime', 'evening', 'anytime']);
const REVIEW = new Set(['pending', 'approved']);
const ASCII_APOSTROPHE_IN_WORD = /[A-Za-z]'[A-Za-z]/;
const ARABIC_ONLY = /^[؀-ۿ\s]+$/;

function sourceMatchesUrl(source: string, url: string): boolean {
  const bukhari = /^Sahih al-Buxoriy, (\d+)$/.exec(source);
  if (bukhari) return url === `https://sunnah.com/bukhari:${bukhari[1]}`;
  const muslim = /^Sahih Muslim (\d+[a-z]?)$/.exec(source);
  return !!muslim && url === `https://sunnah.com/muslim:${muslim[1]}`;
}

test('every Sunnah reminder is a labelled paraphrase from Sahih al-Bukhari or Sahih Muslim with a matching link', () => {
  assert.ok(sunnah.reminders.length >= 40, 'the reviewed library has at least 40 reminders');
  assert.ok(REVIEW.has(sunnah.scholarReview.status));
  assert.match(sunnah.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
  for (const item of sunnah.reminders) {
    assert.match(item.id, /^[a-z0-9-]{3,48}$/, item.id);
    assert.equal(item.contentType, 'paraphrase', item.id);
    assert.ok(CATEGORIES.has(item.timeCategory), item.id);
    assert.ok(sourceMatchesUrl(item.source, item.url), `${item.id}: ${item.source} ↔ ${item.url}`);
    assert.ok(item.title.length > 0 && item.title.length <= 40, item.id);
    assert.ok(item.text.length > 0 && item.text.length <= 260, `${item.id} text fits a notification`);
    assert.ok(item.tryToday.length > 0 && item.tryToday.length <= 110, `${item.id} try-today line is short`);
    assert.ok(item.text.includes('Rasululloh ﷺ'), `${item.id} names whose teaching it is`);
    for (const text of [item.title, item.text, item.tryToday]) {
      assert.ok(!ASCII_APOSTROPHE_IN_WORD.test(text), `${item.id} uses typographic o‘/g‘ and ’`);
      assert.ok(!/["“”]/.test(text), `${item.id} quotes only exact phrases, with « »`);
    }
  }
});

test('Sunnah ids and titles are unique, because notification links look content up by them', () => {
  const ids = sunnah.reminders.map((item) => item.id);
  const titles = sunnah.reminders.map((item) => item.title);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(titles).size, titles.length);
  for (const category of CATEGORIES) {
    assert.ok(sunnah.reminders.some((item) => item.timeCategory === category), `${category} has content`);
  }
});

test('adhkar carry exact Arabic, a source link, and a tasbih that completes one hundred', () => {
  assert.ok(REVIEW.has(adhkar.scholarReview.status));
  const sayyid = adhkar.items.find((item) => item.id === 'sayyid-al-istighfar')!;
  const tasbih = adhkar.items.find((item) => item.id === 'after-prayer-tasbih')!;
  assert.ok(sourceMatchesUrl(sayyid.source, sayyid.url));
  assert.ok(sourceMatchesUrl(tasbih.source, tasbih.url));
  assert.match(sayyid.arabic!, ARABIC_ONLY);
  assert.ok(sayyid.arabic!.startsWith('اللَّهُمَّ'));
  assert.deepEqual(sayyid.parts!.map((part) => part.id), ['sayyid-al-istighfar-day', 'sayyid-al-istighfar-night']);
  const steps = tasbih.steps!;
  assert.deepEqual(steps.map((step) => step.count), [33, 33, 33, 1]);
  assert.equal(steps.reduce((sum, step) => sum + step.count, 0), 100);
  for (const step of steps) {
    assert.match(step.arabic, ARABIC_ONLY);
    assert.ok(step.transliteration && step.meaning);
  }
  for (const item of adhkar.items) {
    for (const text of [item.title, item.note, item.meaning ?? '', item.transliteration ?? '']) {
      assert.ok(!ASCII_APOSTROPHE_IN_WORD.test(text), item.id);
    }
  }
});

test('evening prompts are three gentle questions with no scores', () => {
  assert.ok(REVIEW.has(muhosaba.scholarReview.status));
  assert.deepEqual(muhosaba.prompts.map((prompt) => prompt.id), ['gratitude', 'improve', 'intention']);
  const all = JSON.stringify(muhosaba);
  assert.ok(!/ball|baho ber|gunoh|jazo|jazola/i.test(all.replace('baho ham', '')));
});
