# Zikrlar ovozi: yozib olish va ilovaga qo‘shish

Rahmatda zikrlar yonida **«Tinglash»** tugmasi bor, lekin u faqat ovozli yozuv qo‘shilgandan keyin ko‘rinadi. Yozuvlarni o‘zingiz (yoki imom, qori) yozib olasiz — internetdan olingan, egasining ruxsati yo‘q yozuvlarni qo‘ymang.

## 1. Kim o‘qiydi

Tajvidni yaxshi biladigan qori yoki imom o‘qisin. Yozuvni ilovaga qo‘yishdan oldin o‘sha kishi (yoki boshqa imom) eshitib, to‘g‘riligini tasdiqlasin.

## 2. Nima o‘qiladi — 5 ta fayl (+1 ixtiyoriy)

Har bir zikr **bir marta**, shoshilmasdan o‘qiladi: ilova sanashni o‘zi bajaradi, yozuv talaffuzni o‘rganish uchun. Arabcha matn ilovadagidek (`src/data/adhkar.json`).

| Fayl nomi | Nima o‘qiladi |
| --- | --- |
| `sayyid-al-istighfar.m4a` | Sayyidul istig‘for, to‘liq: اللَّهُمَّ أَنْتَ رَبِّي، لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَىَّ وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ |
| `tasbih.m4a` | سُبْحَانَ اللَّهِ — Subhanalloh |
| `tahmid.m4a` | الْحَمْدُ لِلَّهِ — Alhamdulillah |
| `takbir.m4a` | اللَّهُ أَكْبَرُ — Allohu akbar |
| `tahlil.m4a` | لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَىْءٍ قَدِيرٌ |
| `astaghfirulloh.m4a` *(ixtiyoriy)* | أَسْتَغْفِرُ اللَّهَ — Istig‘for sanog‘i ustida chiqadi |

Fayl nomi aynan jadvaldagidek bo‘lsin (kichik harflar, chiziqcha bilan). Boshqa nomli fayl qo‘shilsa, ilova yig‘ilmaydi va xato qaysi faylda ekanini aytadi.

## 3. Qanday yozib olish

- Jim xonada, telefonning oddiy diktofon ilovasi bilan. Telefonni og‘izdan 15–20 sm uzoqda ushlang.
- Boshida va oxirida bir soniyadan jimlik qoldiring. Musiqa, aks-sado yoki boshqa effekt qo‘shmang.
- Format: `.m4a` yoki `.mp3` (shuningdek `.aac`, `.wav`), mono, 64–96 kbit/s. Har bir fayl **2 MB dan oshmasin** — bir daqiqalik duo 96 kbit/s da taxminan 0,7 MB.

## 4. Ilovaga qo‘shish

**GitHub orqali (kompyutersiz ham bo‘ladi):**

1. [github.com/Husn1ddin7777/Rahmat-app](https://github.com/Husn1ddin7777/Rahmat-app) da `assets/audio` papkasini oching.
2. **Add file → Upload files** ni bosing, fayllarni tanlang.
3. Pastda **Commit changes** ni bosing (to‘g‘ridan-to‘g‘ri `main` ga).
4. GitHub o‘zi yangi Android ilovani yig‘adi (10–15 daqiqa). Tayyor bo‘lgach, odatdagi havoladan yangisini o‘rnating: <https://github.com/Husn1ddin7777/Rahmat-app/releases/latest/download/Rahmat.apk>. Qaydlar saqlanib qoladi.
5. Web versiyada ham chiqishi uchun keyingi safar `npm run deploy:pwa` ni ishga tushiring.

**Kompyuterda:** fayllarni `assets/audio/` ga qo‘ying, `npm run audio:sync` ni ishga tushiring (u `src/data/audio.generated.ts` ni yangilaydi), so‘ng `npm test` va commit.

Yozuvni olib tashlash uchun faylni o‘chiring — tugma ham yo‘qoladi.
