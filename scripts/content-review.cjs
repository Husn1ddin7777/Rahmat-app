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
  '- Barchasi tasdiqlangach, uchala fayldagi `scholarReview.status` qiymatini `approved` ga o‘zgartiring.',
  '',
  '| Bo‘lim | Holat | Bandlar |',
  '| --- | --- | --- |',
  `| Sunnat eslatmalari (\`sunnah.json\`) | ${status(sunnah.scholarReview.status)} | ${sunnah.reminders.length} |`,
  `| Zikrlar (\`adhkar.json\`) | ${status(adhkar.scholarReview.status)} | ${adhkar.items.length} |`,
  `| Kechki muhosaba savollari (\`muhosaba.json\`) | ${status(muhosaba.scholarReview.status)} | ${muhosaba.prompts.length} |`,
  '',
  '## Ochiq savollar',
  '',
  '1. Namozdan keyingi tasbih: ilovada Sahih Muslim 597a dagi 33 · 33 · 33 va tahlil varianti ishlatilgan. 34 marta takbir varianti (Sahih Muslim 596a) ham bor — qaysi biri asosiy bo‘lsin?',
  '2. Sayyidul istig‘forning arabcha matni manbadagidek «عَلَىَّ» yozilgan; «عَلَيَّ» shaklida ko‘rsatilsinmi?',
  '3. Talaffuz yozuvi: cho‘ziq unlilar «aa», «ii», «uu» bilan berilgan. Shu uslub ma’qulmi?',
  '4. Zikr ma’no tarjimalari kimning tarjimasiga tayanishi kerak (masalan, rasmiy nashr)?',
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

fs.writeFileSync(path.join(root, 'CONTENT-REVIEW.md'), lines.join('\n'));
console.log(`CONTENT-REVIEW.md: ${sunnah.reminders.length} reminders, ${adhkar.items.length} adhkar, ${muhosaba.prompts.length} prompts.`);
