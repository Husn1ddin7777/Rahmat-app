import test from 'node:test';
import assert from 'node:assert/strict';
import sunnah from '../src/data/sunnah.json';
import adhkar from '../src/data/adhkar.json';
import muhosaba from '../src/data/muhosaba.json';
import fasting from '../src/data/fasting.json';
import prayer from '../src/data/prayer.json';
import { isScript, toCyrillic, toScript } from '../src/domain/script';
import { HIJRI_MONTHS } from '../src/domain/hijri';
import { PRAYER_NAMES } from '../src/domain/schedule';

test('Uzbek Latin letters and digraphs map to the Cyrillic alphabet', () => {
  const cases: Array<[string, string]> = [
    ['Yaxshilik sari, har kuni.', 'Яхшилик сари, ҳар куни.'],
    ['O‘ZINGIZ UCHUN', 'ЎЗИНГИЗ УЧУН'],
    ['Istig‘for', 'Истиғфор'],
    ['Shoshilmang', 'Шошилманг'],
    ['Choshgoh', 'Чошгоҳ'],
    ['Allohdan mag‘firat so‘rayman', 'Аллоҳдан мағфират сўрайман'],
    ['Xufton', 'Хуфтон'],
    ['Qur’on', 'Қуръон'],
    ['ma’lumotlar', 'маълумотлар'],
    ['MA’LUMOT', 'МАЪЛУМОТ'],
  ];
  for (const [latin, cyrillic] of cases) assert.equal(toCyrillic(latin), cyrillic, latin);
});

test('y-vowel pairs, the э rule and separated sounds follow Uzbek Cyrillic spelling', () => {
  const cases: Array<[string, string]> = [
    ['yangi', 'янги'], ['yurak', 'юрак'], ['yordam', 'ёрдам'], ['yetarli', 'етарли'], ['dunyo', 'дунё'],
    ['tayyor', 'тайёр'], ['Sayyidul', 'Саййидул'], ['Qayyum', 'Қайюм'], ['kuyov', 'куёв'],
    // y before o‘ stays й: yo‘l → йўл.
    ['yo‘q', 'йўқ'], ['Yo‘l', 'Йўл'], ['YO‘L', 'ЙЎЛ'],
    ['ertaga', 'эртага'], ['Eslatma', 'Эслатма'], ['e’tibor', 'эътибор'], ['poema', 'поэма'], ['telefon', 'телефон'],
    ['Is’hoq', 'Исҳоқ'], ['o‘tsa', 'ўтса'], ['tong', 'тонг'],
  ];
  for (const [latin, cyrillic] of cases) assert.equal(toCyrillic(latin), cyrillic, latin);
});

test('months keep their soft sign, weekday labels stay readable and Hijri months convert', () => {
  assert.equal(toCyrillic('22-oktabr, payshanba'), '22-октябрь, пайшанба');
  assert.equal(toCyrillic('1-SENTABR — 30-OKTABR'), '1-СЕНТЯБРЬ — 30-ОКТЯБРЬ');
  assert.equal(toCyrillic('yanvar fevral mart aprel may iyun iyul avgust sentabr oktabr noyabr dekabr'),
    'январь февраль март апрель май июнь июль август сентябрь октябрь ноябрь декабрь');
  assert.equal(toCyrillic('Du Se Ch Pa Ju Sh Ya'), 'Ду Се Чо Па Жу Ша Як');
  assert.deepEqual(HIJRI_MONTHS.map(toCyrillic), ['Муҳаррам', 'Сафар', 'Рабиул аввал', 'Рабиул охир', 'Жумодул аввал', 'Жумодул охир', 'Ражаб', 'Шаъбон', 'Рамазон', 'Шаввол', 'Зулқаъда', 'Зулҳижжа']);
  assert.deepEqual(PRAYER_NAMES.map(toCyrillic), ['Бомдод', 'Пешин', 'Аср', 'Шом', 'Хуфтон']);
});

test('Arabic, links, hadith references and product names are left as they are', () => {
  assert.equal(toCyrillic('أَسْتَغْفِرُ اللّٰهَ'), 'أَسْتَغْفِرُ اللّٰهَ');
  assert.equal(toCyrillic('Rasululloh ﷺ'), 'Расулуллоҳ ﷺ');
  assert.equal(toCyrillic('Sahih Muslim 1162b'), 'Саҳиҳ Муслим 1162b');
  assert.equal(toCyrillic('Sahih al-Buxoriy, 6306'), 'Саҳиҳ ал-Бухорий, 6306');
  assert.equal(toCyrillic('https://sunnah.com/muslim:597a'), 'https://sunnah.com/muslim:597a');
  assert.equal(toCyrillic('Fayl: rahmat-zaxira-2026-10-22.json'), 'Файл: rahmat-zaxira-2026-10-22.json');
  assert.equal(toCyrillic('iPhone eslatmalari uchun iOS 16.4'), 'iPhone эслатмалари учун iOS 16.4');
  assert.equal(toCyrillic('PIN kod va Face ID'), 'PIN код ва Face ID');
  assert.equal(toCyrillic('Telegram yoki Google Drive'), 'Telegram ёки Google Drive');
  assert.equal(toCyrillic('«Kun yakunida bir daqiqa»'), '«Кун якунида бир дақиқа»');
  assert.equal(toCyrillic('SS:DD · 5 × 100'), 'СС:ДД · 5 × 100');
});

test('the script choice is explicit: Latin text is returned untouched', () => {
  const text = 'Bir lahza, bir istig‘for.';
  assert.equal(toScript(text, 'latin'), text);
  assert.equal(toScript(text, undefined), text);
  assert.equal(toScript(text, 'cyrillic'), 'Бир лаҳза, бир истиғфор.');
  assert.equal(toCyrillic(toCyrillic(text)), toCyrillic(text), 'converting twice changes nothing');
  assert.ok(isScript('latin') && isScript('cyrillic') && !isScript('arabic') && !isScript(undefined));
});

/** Latin letters may remain only in names kept on purpose, references and links. */
function leftovers(text: string): string[] {
  const allowed = /(https?:\/\/\S+|\d+[a-z]\b|iPhone|iOS|Android|Face ID|PIN|HTTPS|Telegram|Google)/g;
  return toCyrillic(text).replace(allowed, '').match(/[A-Za-z]+/g) ?? [];
}

test('every reviewed text converts completely, so a Cyrillic reader sees no stray Latin words', () => {
  const texts: string[] = [
    sunnah.contentNotice, sunnah.scholarReview.notice, sunnah.istighfarNote.text, sunnah.istighfarNote.source,
    ...sunnah.reminders.flatMap((item) => [item.title, item.text, item.tryToday, item.source]),
    adhkar.scholarReview.notice,
    ...adhkar.items.flatMap((item) => [item.title, item.subtitle ?? '', item.note, item.meaning ?? '', item.transliteration ?? '', item.source,
      ...(item.parts ?? []).map((part) => part.label), ...(item.steps ?? []).flatMap((step) => [step.transliteration, step.meaning])]),
    muhosaba.title, muhosaba.intro, muhosaba.privacy, ...muhosaba.prompts.flatMap((prompt) => [prompt.label, prompt.placeholder]),
    fasting.calendarNotice, fasting.intro, fasting.scholarReview.notice,
    ...fasting.days.flatMap((day) => [day.title, day.text, day.source, day.reminderTitle ?? '']),
    prayer.afterPrayer.title, prayer.afterPrayer.text, prayer.afterPrayer.source, prayer.timesNotice,
  ];
  for (const text of texts) assert.deepEqual(leftovers(text), [], text);
});
