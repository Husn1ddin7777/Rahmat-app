'use strict';

// Writes CONTENT-REVIEW.md: every religious text in the app, with its source,
// as one checklist for the scholar who reviews the Uzbek wording.
// Run after any content change: npm run content:review
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, 'src/data', file), 'utf8'));
const sunnah = read('sunnah.json');
const adhkar = read('adhkar.json');
const muhosaba = read('muhosaba.json');
const fasting = read('fasting.json');
const prayer = read('prayer.json');
// The app's own Latin → Cyrillic converter, loaded from its TypeScript source (it has no imports).
const ts = require('typescript');
function loadTs(file) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, require);
  return module.exports;
}
const { toCyrillic } = loadTs(path.join(root, 'src/domain/script.ts'));

const categories = {
  morning: 'Tong', daytime: 'Kun davomida', mealtime: 'Taom paytida', evening: 'Kechqurun', anytime: 'Istalgan payt',
};
const status = (value) => value === 'approved' ? 'tasdiqlangan' : 'tekshiruv kutilmoqda';
const lines = [];
const add = (...items) => lines.push(...items);

add(
  '# Rahmat — diniy matnlarni tekshirish ro‘yxati',
  '',
  `Bu fayl \`npm run content:review\` buyrug‘i bilan \`src/data/\` dagi fayllardan yaratiladi. Qo‘lda tahrirlamang.`,
  '',
  `Manbalar ${sunnah.verifiedOn} sanasida hadis matniga solishtirildi (Sahih al-Buxoriy va Sahih Muslim, sunnah.com raqamlari).`,
  'O‘zbekcha matnlar **mazmunan bayon** (parafraz) — so‘zma-so‘z tarjima emas. Har bir bandni manba bilan solishtirib, belgilang:',
  '',
  '- [ ] — tasdiqlandi; o‘zgartirish kerak bo‘lsa, «Izoh» qatoriga yozing.',
  '- Barchasi tasdiqlangach, har bir fayldagi `scholarReview.status` qiymatini `approved` ga o‘zgartiring.',
  '',
  '| Bo‘lim | Holat | Bandlar |',
  '| --- | --- | --- |',
  `| Sunnat eslatmalari (\`sunnah.json\`) | ${status(sunnah.scholarReview.status)} | ${sunnah.reminders.length} |`,
  `| Zikrlar (\`adhkar.json\`) | ${status(adhkar.scholarReview.status)} | ${adhkar.items.length} |`,
  `| Kechki muhosaba savollari (\`muhosaba.json\`) | ${status(muhosaba.scholarReview.status)} | ${muhosaba.prompts.length} |`,
  `| Nafl ro‘za kunlari va hijriy taqvim (\`fasting.json\`) | ${status(fasting.scholarReview.status)} | ${fasting.days.length} |`,
  `| Namozdan so‘ng istig‘for (\`prayer.json\`) | ${status(prayer.scholarReview.status)} | 1 |`,
  '',
  '## Ochiq savollar',
  '',
  '1. Namozdan keyingi tasbih: ilovada Sahih Muslim 597a dagi 33 · 33 · 33 va tahlil varianti ishlatilgan. 34 marta takbir varianti (Sahih Muslim 596a) ham bor — qaysi biri asosiy bo‘lsin?',
  '2. Sayyidul istig‘forning arabcha matni manbadagidek «عَلَىَّ» yozilgan; «عَلَيَّ» shaklida ko‘rsatilsinmi?',
  '3. Talaffuz yozuvi: cho‘ziq unlilar «aa», «ii», «uu» bilan berilgan. Shu uslub ma’qulmi?',
  '4. Zikr ma’no tarjimalari kimning tarjimasiga tayanishi kerak (masalan, rasmiy nashr)?',
  '5. Oyning 13–15-kunlari («Ayyomul biyz») Sunan at-Tirmiziy 761 rivoyatiga tayanadi — Buxoriy va Muslimda yo‘q. Hozir ilova faqat «har oyda istalgan uch kun» (Sahih Muslim 1160) deydi. 13–15-kunlarni ham ko‘rsataylikmi?',
  '6. Ikki hayit kuni ro‘za tutilmasligi (Sahih al-Buxoriy 1991, Sahih Muslim 1138) taqvimda alohida eslatilsinmi? Hijriy sana taxminiy bo‘lgani uchun hozircha ko‘rsatilmagan.',
  '7. Hijriy sana arifmetik jadval bilan hisoblanadi va foydalanuvchi uni ±2 kunga to‘g‘rilay oladi. Taqvimdagi ogohlantirish matni yetarlimi?',
  '8. «Tosuo» (Muharramning 9-kuni) nomi va matni: hadisdagi «to‘qqizinchi kuni ro‘za tutish» niyati Ashuro bilan birga deb tushuntirilsinmi yoki hozirgidek betaraf qolsinmi?',
  '9. Namozdan so‘ng keladigan eslatma matni: «Namozdan so‘ng bir lahza istig‘for uchun vaqt ajrating.» Ma’qulmi?',
  '10. Kirill yozuvidagi diniy atamalar (masalan, «Расулуллоҳ ﷺ», «Саййидул истиғфор», «Шаъбон») avtomatik o‘giriladi — namunalarni pastdagi «Kirill yozuvi» bo‘limida tekshiring.',
  '11. Zikrlar ovozi: yozuvlarni kim o‘qiydi va tajvid bo‘yicha kim tekshiradi? (Qarang: AUDIO.md)',
  '',
  '## Istig‘for izohi',
  '',
  `- **Manba:** [${sunnah.istighfarNote.source}](${sunnah.istighfarNote.url})`,
  `- **Matn:** ${sunnah.istighfarNote.text}`,
  `- **Sanoq haqida:** ${sunnah.istighfarNote.progressNotice}`,
  '- [ ] Tasdiqlandi · Izoh:',
  '',
  `## Sunnat eslatmalari (${sunnah.reminders.length})`,
  '',
);
for (const [key, label] of Object.entries(categories)) {
  const items = sunnah.reminders.filter((item) => item.timeCategory === key);
  if (!items.length) continue;
  add(`### ${label} (${items.length})`, '');
  for (const item of items) {
    add(
      `#### ${item.title} · \`${item.id}\``,
      '',
      `- **Manba:** [${item.source}](${item.url})`,
      `- **Matn:** ${item.text}`,
      `- **Bugun sinab ko‘ring:** ${item.tryToday}`,
      '- [ ] Tasdiqlandi · Izoh:',
      '',
    );
  }
}
add('## Zikrlar', '');
for (const item of adhkar.items) {
  add(`### ${item.title} · \`${item.id}\``, '', `- **Manba:** [${item.source}](${item.url})`, `- **Izoh matni:** ${item.note}`);
  if (item.arabic) add(`- **Arabcha:** ${item.arabic}`, `- **Talaffuz:** ${item.transliteration}`, `- **Ma’nosi:** ${item.meaning}`);
  if (item.parts) add(`- **Belgilash:** ${item.parts.map((part) => part.label).join(', ')}`);
  for (const step of item.steps ?? []) {
    add(`- **${step.count} marta:** ${step.arabic} — ${step.transliteration} — ${step.meaning}`);
  }
  add('- [ ] Tasdiqlandi · Izoh:', '');
}
add('## Kechki muhosaba savollari', '', `- **Kirish:** ${muhosaba.intro}`, `- **Maxfiylik:** ${muhosaba.privacy}`);
for (const prompt of muhosaba.prompts) add(`- **Savol:** ${prompt.label} _(namuna: ${prompt.placeholder})_`);
add('- [ ] Tasdiqlandi · Izoh:', '');

add('## Namozdan so‘ng istig‘for', '',
  `- **Manba:** [${prayer.afterPrayer.source}](${prayer.afterPrayer.url})`,
  `- **Matn:** ${prayer.afterPrayer.text}`,
  `- **Vaqtlar haqida:** ${prayer.timesNotice}`,
  '- [ ] Tasdiqlandi · Izoh:', '');
add(`## Nafl ro‘za kunlari (${fasting.days.length})`, '',
  `- **Kirish:** ${fasting.intro}`,
  `- **Taqvim haqida:** ${fasting.calendarNotice}`,
  '- [ ] Tasdiqlandi · Izoh:', '');
const when = (rule) => rule.type === 'date' ? `hijriy ${rule.day}-kun, ${rule.month}-oy` : rule.type === 'month' ? `hijriy ${rule.month}-oy davomida` : rule.type === 'weekly' ? 'har hafta' : 'har oyda';
for (const day of fasting.days) {
  add(`### ${day.title} · \`${day.id}\``, '',
    `- **Qachon:** ${when(day.when)}${day.remind ? ' · bir kun oldin kechqurun eslatma (ixtiyoriy)' : ''}`,
    `- **Manba:** [${day.source}](${day.url})`,
    `- **Matn:** ${day.text}`);
  if (day.reminderTitle) add(`- **Eslatma sarlavhasi:** ${day.reminderTitle}`);
  add('- [ ] Tasdiqlandi · Izoh:', '');
}
add('## Kirill yozuvi (namunalar)', '',
  'Kirill yozuvi tanlanganda ilova matnlari avtomatik o‘giriladi. Diniy atamalar to‘g‘ri chiqayotganini tekshiring:', '');
const samples = [sunnah.istighfarNote.text, ...adhkar.items.map((item) => item.title), prayer.afterPrayer.text, ...fasting.days.slice(0, 4).map((day) => day.text)];
for (const sample of samples) add(`- ${sample}`, `  - ${toCyrillic(sample)}`);
add('- [ ] Tasdiqlandi · Izoh:', '');

fs.writeFileSync(path.join(root, 'CONTENT-REVIEW.md'), lines.join('\n'));
console.log(`CONTENT-REVIEW.md: ${sunnah.reminders.length} reminders, ${adhkar.items.length} adhkar, ${muhosaba.prompts.length} prompts, ${fasting.days.length} fasting days.`);
