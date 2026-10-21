# Rahmat — diniy matnlarni tekshirish ro‘yxati

Bu fayl `npm run content:review` buyrug‘i bilan `src/data/` dagi fayllardan yaratiladi. Qo‘lda tahrirlamang.

Manbalar 2026-10-21 sanasida hadis matniga solishtirildi (Sahih al-Buxoriy va Sahih Muslim, sunnah.com raqamlari).
O‘zbekcha matnlar **mazmunan bayon** (parafraz) — so‘zma-so‘z tarjima emas. Har bir bandni manba bilan solishtirib, belgilang:

- [ ] — tasdiqlandi; o‘zgartirish kerak bo‘lsa, «Izoh» qatoriga yozing.
- Barchasi tasdiqlangach, har bir fayldagi `scholarReview.status` qiymatini `approved` ga o‘zgartiring.

| Bo‘lim | Holat | Bandlar |
| --- | --- | --- |
| Sunnat eslatmalari (`sunnah.json`) | tekshiruv kutilmoqda | 47 |
| Zikrlar (`adhkar.json`) | tekshiruv kutilmoqda | 2 |
| Kechki muhosaba savollari (`muhosaba.json`) | tekshiruv kutilmoqda | 3 |
| Nafl ro‘za kunlari va hijriy taqvim (`fasting.json`) | tekshiruv kutilmoqda | 8 |
| Namozdan so‘ng istig‘for (`prayer.json`) | tekshiruv kutilmoqda | 1 |

## Ochiq savollar

1. Namozdan keyingi tasbih: ilovada Sahih Muslim 597a dagi 33 · 33 · 33 va tahlil varianti ishlatilgan. 34 marta takbir varianti (Sahih Muslim 596a) ham bor — qaysi biri asosiy bo‘lsin?
2. Sayyidul istig‘forning arabcha matni manbadagidek «عَلَىَّ» yozilgan; «عَلَيَّ» shaklida ko‘rsatilsinmi?
3. Talaffuz yozuvi: cho‘ziq unlilar «aa», «ii», «uu» bilan berilgan. Shu uslub ma’qulmi?
4. Zikr ma’no tarjimalari kimning tarjimasiga tayanishi kerak (masalan, rasmiy nashr)?
5. Oyning 13–15-kunlari («Ayyomul biyz») Sunan at-Tirmiziy 761 rivoyatiga tayanadi — Buxoriy va Muslimda yo‘q. Hozir ilova faqat «har oyda istalgan uch kun» (Sahih Muslim 1160) deydi. 13–15-kunlarni ham ko‘rsataylikmi?
6. Ikki hayit kuni ro‘za tutilmasligi (Sahih al-Buxoriy 1991, Sahih Muslim 1138) taqvimda alohida eslatilsinmi? Hijriy sana taxminiy bo‘lgani uchun hozircha ko‘rsatilmagan.
7. Hijriy sana arifmetik jadval bilan hisoblanadi va foydalanuvchi uni ±2 kunga to‘g‘rilay oladi. Taqvimdagi ogohlantirish matni yetarlimi?
8. «Tosuo» (Muharramning 9-kuni) nomi va matni: hadisdagi «to‘qqizinchi kuni ro‘za tutish» niyati Ashuro bilan birga deb tushuntirilsinmi yoki hozirgidek betaraf qolsinmi?
9. Namozdan so‘ng keladigan eslatma matni: «Namozdan so‘ng bir lahza istig‘for uchun vaqt ajrating.» Ma’qulmi?
10. Kirill yozuvidagi diniy atamalar (masalan, «Расулуллоҳ ﷺ», «Саййидул истиғфор», «Шаъбон») avtomatik o‘giriladi — namunalarni pastdagi «Kirill yozuvi» bo‘limida tekshiring.
11. Zikrlar ovozi: yozuvlarni kim o‘qiydi va tajvid bo‘yicha kim tekshiradi? (Qarang: AUDIO.md)

## Istig‘for izohi

- **Manba:** [Sahih Muslim 2702a](https://sunnah.com/muslim:2702a)
- **Matn:** Rasululloh ﷺ bir kunda Allohdan 100 marta mag‘firat so‘rashlarini aytganlar. Har bir niyat uchun kunlik reja — necha mahal va har mahalda nechta — o‘zingiz tanlagan va istalgan payt o‘zgartirishingiz mumkin bo‘lgan maqsad; keltirilgan hadisda aynan shunday jadval belgilanmagan.
- **Sanoq haqida:** Sanoq aytgan istig‘forlaringizni qayd etadi; u mag‘firatning o‘lchovi yoki kafolati emas.
- [ ] Tasdiqlandi · Izoh:

## Sunnat eslatmalari (47)

### Tong (6)

#### Kichik, ammo davomli qadam · `small-and-steady`

- **Manba:** [Sahih al-Buxoriy, 6465](https://sunnah.com/bukhari:6465)
- **Matn:** Rasululloh ﷺ o‘rgatganlaridek, kuchingiz yetadigan kichik bir yaxshi amalni tanlab, uni davomli bajaring.
- **Bugun sinab ko‘ring:** Bugun bitta kichik amal tanlang va uni ertaga ham takrorlang.
- [ ] Tasdiqlandi · Izoh:

#### Niyatni yangilang · `renew-intention`

- **Manba:** [Sahih al-Buxoriy, 1](https://sunnah.com/bukhari:1)
- **Matn:** Rasululloh ﷺ amallar niyatga ko‘ra ekanini va har kimga niyat qilgan narsasi bo‘lishini aytganlar.
- **Bugun sinab ko‘ring:** Bugungi ishingizni boshlashdan oldin niyatingizni Alloh rizosi uchun yangilang.
- [ ] Tasdiqlandi · Izoh:

#### Uyg‘onganda hamd · `wake-with-praise`

- **Manba:** [Sahih al-Buxoriy, 6312](https://sunnah.com/bukhari:6312)
- **Matn:** Rasululloh ﷺ yotganlarida «Bismika amutu va ahya» der, uyg‘onganlarida esa uyqudan keyin bizni tiriltirgan Allohga hamd aytar edilar.
- **Bugun sinab ko‘ring:** Ertalab ko‘zingizni ochganingizda birinchi so‘zingiz Allohga hamd bo‘lsin.
- [ ] Tasdiqlandi · Izoh:

#### Har bo‘g‘im uchun sadaqa · `charity-of-joints`

- **Manba:** [Sahih Muslim 720](https://sunnah.com/muslim:720)
- **Matn:** Rasululloh ﷺ har tong har bir bo‘g‘im uchun sadaqa lozimligini aytganlar: har bir tasbih, hamd va yaxshilikka chaqiruv ham sadaqadir, choshgohda o‘qilgan ikki rakat namoz esa bularning o‘rniga kifoya qiladi.
- **Bugun sinab ko‘ring:** Bugun choshgohda ikki rakat nafl namoz o‘qib ko‘ring.
- [ ] Tasdiqlandi · Izoh:

#### Foydali ishga intiling · `strive-for-benefit`

- **Manba:** [Sahih Muslim 2664](https://sunnah.com/muslim:2664)
- **Matn:** Rasululloh ﷺ kuchli mo‘min Allohga sevimliroq ekanini aytib, foyda beradigan ishga intilishni, Allohdan yordam so‘rashni va ojiz bo‘lib qolmaslikni buyurganlar.
- **Bugun sinab ko‘ring:** Bugun kechiktirib kelayotgan bitta foydali ishni boshlang va Allohdan yordam so‘rang.
- [ ] Tasdiqlandi · Izoh:

#### O‘ngdan boshlash · `start-from-the-right`

- **Manba:** [Sahih al-Buxoriy, 168](https://sunnah.com/bukhari:168)
- **Matn:** Rasululloh ﷺ poyabzal kiyish, soch tarash, poklanish va boshqa ishlarni o‘ng tomondan boshlashni yaxshi ko‘rar edilar.
- **Bugun sinab ko‘ring:** Bugun kiyinish va poyabzal kiyishni o‘ngdan boshlang.
- [ ] Tasdiqlandi · Izoh:

### Kun davomida (12)

#### Yo‘ldagi bir yaxshilik · `clear-the-way`

- **Manba:** [Sahih al-Buxoriy, 2989](https://sunnah.com/bukhari:2989)
- **Matn:** Imkon bo‘lsa, yo‘ldagi zararli narsani xavfsiz olib tashlang: Rasululloh ﷺ buni ham sadaqa deb ta’riflaganlar.
- **Bugun sinab ko‘ring:** Bugun yo‘lingizdagi bitta to‘siqni xavfsiz chetga oling.
- [ ] Tasdiqlandi · Izoh:

#### Taom va salom · `feed-and-greet`

- **Manba:** [Sahih al-Buxoriy, 12](https://sunnah.com/bukhari:12)
- **Matn:** Rasululloh ﷺ Islomdagi yaxshi amallardan biri sifatida taom ulashishni, tanigan va tanimagan kishiga salom berishni aytganlar.
- **Bugun sinab ko‘ring:** Bugun kimgadir taom ulashing yoki notanish qo‘shningizga salom bering.
- [ ] Tasdiqlandi · Izoh:

#### Bemorni yo‘qlang · `visit-the-sick`

- **Manba:** [Sahih al-Buxoriy, 5649](https://sunnah.com/bukhari:5649)
- **Matn:** Rasululloh ﷺ ochni to‘yg‘azishni, bemorni ziyorat qilishni va asirni ozod qilishni buyurganlar.
- **Bugun sinab ko‘ring:** Bugun betob bo‘lgan bir tanishingizdan hol so‘rang.
- [ ] Tasdiqlandi · Izoh:

#### Ona haqqi · `mother-first`

- **Manba:** [Sahih al-Buxoriy, 5971](https://sunnah.com/bukhari:5971)
- **Matn:** Rasululloh ﷺ yaxshi muomalaga eng haqli kishi uch marta onang, so‘ngra otang ekanini aytganlar.
- **Bugun sinab ko‘ring:** Bugun onangizga qo‘ng‘iroq qiling yoki uning bir ishiga yordam bering.
- [ ] Tasdiqlandi · Izoh:

#### Qarindoshlik rishtasi · `keep-family-ties`

- **Manba:** [Sahih al-Buxoriy, 5991](https://sunnah.com/bukhari:5991)
- **Matn:** Rasululloh ﷺ qarindoshlik aloqasini haqiqiy bog‘lovchi yaxshilikka yaxshilik qaytaruvchi emas, balki aloqani uzganlar bilan ham uni tiklovchi kishi ekanini aytganlar.
- **Bugun sinab ko‘ring:** Bugun ancha vaqt gaplashmagan bir qarindoshingizga xabar yuboring.
- [ ] Tasdiqlandi · Izoh:

#### Qo‘shni haqqi · `honor-the-neighbor`

- **Manba:** [Sahih al-Buxoriy, 6019](https://sunnah.com/bukhari:6019)
- **Matn:** Rasululloh ﷺ Allohga va oxirat kuniga iymon keltirgan kishi qo‘shnisini hurmat qilishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun qo‘shningizga salom bering yoki kichik bir yordam taklif qiling.
- [ ] Tasdiqlandi · Izoh:

#### Yengillashtiring · `make-it-easy`

- **Manba:** [Sahih al-Buxoriy, 69](https://sunnah.com/bukhari:69)
- **Matn:** Rasululloh ﷺ odamlarga yengillik qilishni, qiyinlashtirmaslikni, xushxabar berib, nafratlantirmaslikni buyurganlar.
- **Bugun sinab ko‘ring:** Bugun kimningdir ishini yengillashtiring yoki unga dalda bering.
- [ ] Tasdiqlandi · Izoh:

#### Azonga javob · `answer-the-adhan`

- **Manba:** [Sahih al-Buxoriy, 611](https://sunnah.com/bukhari:611)
- **Matn:** Rasululloh ﷺ azonni eshitganda muazzin aytgan so‘zlarni takrorlashni buyurganlar.
- **Bugun sinab ko‘ring:** Bugungi azonlardan birida muazzinning so‘zlarini sekin takrorlang.
- [ ] Tasdiqlandi · Izoh:

#### Sadaqa molni kamaytirmaydi · `charity-does-not-decrease`

- **Manba:** [Sahih Muslim 2588](https://sunnah.com/muslim:2588)
- **Matn:** Rasululloh ﷺ sadaqa molni kamaytirmasligini, kechirimli kishining izzati ortishini va Alloh uchun kamtar bo‘lganni Alloh yuksaltirishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun kichik bo‘lsa ham sadaqa bering yoki birovni kechiring.
- [ ] Tasdiqlandi · Izoh:

#### Birodarga yordam · `help-your-brother`

- **Manba:** [Sahih Muslim 2699a](https://sunnah.com/muslim:2699a)
- **Matn:** Rasululloh ﷺ banda birodariga yordam berib tursa, Alloh ham unga yordam berishini va mo‘minning dunyodagi qiyinchiligini yengillatgan kishining qiyomatdagi qiyinchiligi yengillashishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun yordamga muhtoj bir kishiga qo‘lingizdan kelgancha ko‘mak bering.
- [ ] Tasdiqlandi · Izoh:

#### Hayvonlarga mehr · `mercy-to-animals`

- **Manba:** [Sahih al-Buxoriy, 2363](https://sunnah.com/bukhari:2363)
- **Matn:** Rasululloh ﷺ chanqagan itga suv bergan kishini Alloh mag‘firat qilganini va har bir tirik jonga qilingan yaxshilikda ajr borligini aytganlar.
- **Bugun sinab ko‘ring:** Bugun qushlar yoki hayvonlar uchun suv qo‘yib qo‘ying.
- [ ] Tasdiqlandi · Izoh:

#### Daraxt eking · `plant-a-tree`

- **Manba:** [Sahih al-Buxoriy, 2320](https://sunnah.com/bukhari:2320)
- **Matn:** Rasululloh ﷺ musulmon ekkan daraxt yoki ekindan qush, inson yoki hayvon yesa, bu uning uchun sadaqa bo‘lishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun bir o‘simlikni suvlang yoki ko‘chat ekishni rejalashtiring.
- [ ] Tasdiqlandi · Izoh:

### Taom paytida (4)

#### Allohning nomi bilan boshlang · `mindful-meal`

- **Manba:** [Sahih al-Buxoriy, 5376](https://sunnah.com/bukhari:5376)
- **Matn:** Taomni Allohning nomi bilan boshlang, o‘ng qo‘lingiz bilan va oldingizdan yeng — Rasululloh ﷺ shunday o‘rgatganlar.
- **Bugun sinab ko‘ring:** Bugungi taomni «Bismillah» bilan boshlang.
- [ ] Tasdiqlandi · Izoh:

#### Taomni ayblamang · `no-food-criticism`

- **Manba:** [Sahih al-Buxoriy, 5409](https://sunnah.com/bukhari:5409)
- **Matn:** Rasululloh ﷺ hech qachon taomni ayblamas edilar: yoqsa yer, yoqmasa qoldirar edilar.
- **Bugun sinab ko‘ring:** Bugun dasturxondagi taomga minnatdorlik bilan qarang, kamchilik izlamang.
- [ ] Tasdiqlandi · Izoh:

#### Taomni baham ko‘ring · `share-your-food`

- **Manba:** [Sahih al-Buxoriy, 5392](https://sunnah.com/bukhari:5392)
- **Matn:** Rasululloh ﷺ ikki kishilik taom uch kishiga, uch kishilik taom to‘rt kishiga yetishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun taomingizni yana bir kishi bilan baham ko‘ring.
- [ ] Tasdiqlandi · Izoh:

#### Taomdan so‘ng hamd · `praise-after-eating`

- **Manba:** [Sahih Muslim 2734a](https://sunnah.com/muslim:2734a)
- **Matn:** Rasululloh ﷺ Alloh taom yeb yoki suv ichib, buning uchun Unga hamd aytgan bandasidan rozi bo‘lishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun har taomdan keyin «Alhamdulillah» deng.
- [ ] Tasdiqlandi · Izoh:

### Kechqurun (6)

#### Yaxshilik uydan boshlanadi · `help-at-home`

- **Manba:** [Sahih al-Buxoriy, 676](https://sunnah.com/bukhari:676)
- **Matn:** Bugun uy ishlaridan biriga yordam bering: Rasululloh ﷺ ham o‘z oilalarining xizmatida bo‘lganlar.
- **Bugun sinab ko‘ring:** Bugun uyda bitta ishni so‘ralmasdan bajaring.
- [ ] Tasdiqlandi · Izoh:

#### Uyquga tayyorgarlik · `before-sleep`

- **Manba:** [Sahih al-Buxoriy, 6311](https://sunnah.com/bukhari:6311)
- **Matn:** Rasululloh ﷺ uxlashdan oldin namozdagidek tahorat qilib, o‘ng yonboshga yotishni va ishini Allohga topshirib duo qilishni o‘rgatganlar.
- **Bugun sinab ko‘ring:** Bugun kechasi tahorat bilan, o‘ng yonboshingizga yotib uxlang.
- [ ] Tasdiqlandi · Izoh:

#### Uyga Bismillah bilan · `enter-with-bismillah`

- **Manba:** [Sahih Muslim 2018a](https://sunnah.com/muslim:2018a)
- **Matn:** Rasululloh ﷺ uyga kirishda va taom yeyishda Allohning nomini zikr qilgan kishining uyida shaytonga na tunash, na kechki taom joyi qolmasligini aytganlar.
- **Bugun sinab ko‘ring:** Bugun uyga kirganingizda «Bismillah» deng.
- [ ] Tasdiqlandi · Izoh:

#### Bolalarga mehr · `mercy-to-children`

- **Manba:** [Sahih al-Buxoriy, 5997](https://sunnah.com/bukhari:5997)
- **Matn:** Rasululloh ﷺ nabiralari Hasanni o‘pib, rahm qilmagan kishiga rahm qilinmasligini aytganlar.
- **Bugun sinab ko‘ring:** Bugun farzandingiz yoki yaqin bir bolaga mehringizni so‘z va amal bilan ko‘rsating.
- [ ] Tasdiqlandi · Izoh:

#### Mo‘minning ishi · `gratitude-and-patience`

- **Manba:** [Sahih Muslim 2999](https://sunnah.com/muslim:2999)
- **Matn:** Rasululloh ﷺ mo‘minning har bir ishi xayr ekanini aytganlar: quvonch yetsa shukr qiladi, qiyinchilik yetsa sabr qiladi va ikkalasi ham uning uchun yaxshilik bo‘ladi.
- **Bugun sinab ko‘ring:** Bugun bitta quvonch uchun shukr qiling va bitta qiyinchilikka sabr bilan qarang.
- [ ] Tasdiqlandi · Izoh:

#### Kechqurun Bismillah · `close-the-door-with-bismillah`

- **Manba:** [Sahih al-Buxoriy, 3280](https://sunnah.com/bukhari:3280)
- **Matn:** Rasululloh ﷺ kech kirganda bolalarni uyda olib qolishni, eshik va idishlarni yopib, har birida Allohning nomini zikr qilishni o‘rgatganlar.
- **Bugun sinab ko‘ring:** Bugun kechqurun eshikni yopayotganda «Bismillah» deng.
- [ ] Tasdiqlandi · Izoh:

### Istalgan payt (19)

#### Ochiq chehra bilan · `cheerful-face`

- **Manba:** [Sahih Muslim 2626](https://sunnah.com/muslim:2626)
- **Matn:** Bugun birovni ochiq chehra bilan kutib oling: Rasululloh ﷺ bu kichik yaxshilikni ham arzimas sanamaslikni o‘rgatganlar.
- **Bugun sinab ko‘ring:** Bugun uchragan birinchi tanishingizga tabassum bilan salom bering.
- [ ] Tasdiqlandi · Izoh:

#### Yaxshi so‘z ayting · `good-words`

- **Manba:** [Sahih al-Buxoriy, 6018](https://sunnah.com/bukhari:6018)
- **Matn:** Gapirishdan oldin o‘ylab ko‘ring: Rasululloh ﷺ o‘rgatganlaridek, yaxshi so‘z ayting yoki sukut saqlang.
- **Bugun sinab ko‘ring:** Bugun bir marta gapirishdan oldin to‘xtab, so‘zingizni tanlang.
- [ ] Tasdiqlandi · Izoh:

#### Muloyimlikni tanlang · `choose-gentleness`

- **Manba:** [Sahih Muslim 2593](https://sunnah.com/muslim:2593)
- **Matn:** Keyingi suhbatingizda muloyim bo‘ling: Rasululloh ﷺ Alloh muloyimlikni sevishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun bir bahsda ovozingizni pasaytirib, muloyim javob bering.
- [ ] Tasdiqlandi · Izoh:

#### Istig‘for uchun bir lahza · `moment-of-istighfar`

- **Manba:** [Sahih Muslim 2702a](https://sunnah.com/muslim:2702a)
- **Matn:** Bir lahza to‘xtab, Allohdan mag‘firat so‘rang: Rasululloh ﷺ bir kunda 100 marta istig‘for aytishlarini bildirganlar.
- **Bugun sinab ko‘ring:** Bugun bir lahza to‘xtab, «Astag‘firulloh» deng.
- [ ] Tasdiqlandi · Izoh:

#### O‘rtacha va davomli · `keep-it-balanced`

- **Manba:** [Sahih al-Buxoriy, 39](https://sunnah.com/bukhari:39)
- **Matn:** Rasululloh ﷺ din oson ekanini, o‘ziga haddan ortiq og‘ir qilgan kishi uni davom ettira olmasligini aytib, mo‘tadil bo‘lishga va xushxabarga chaqirganlar.
- **Bugun sinab ko‘ring:** Bugun o‘zingizga og‘ir kelmaydigan, lekin har kuni qila oladigan bitta amalni tanlang.
- [ ] Tasdiqlandi · Izoh:

#### Salomni keng yoying · `spread-salam`

- **Manba:** [Sahih Muslim 54a](https://sunnah.com/muslim:54a)
- **Matn:** Rasululloh ﷺ o‘zaro mehrni ziyoda qiladigan amal sifatida orangizda salomni keng yoyishni tavsiya qilganlar.
- **Bugun sinab ko‘ring:** Bugun salomni birinchi bo‘lib bering.
- [ ] Tasdiqlandi · Izoh:

#### O‘zingizga ravo ko‘rganingizni · `wish-for-others`

- **Manba:** [Sahih al-Buxoriy, 13](https://sunnah.com/bukhari:13)
- **Matn:** Rasululloh ﷺ kishi o‘zi uchun yaxshi ko‘rgan narsani birodari uchun ham yaxshi ko‘rishi iymondan ekanini o‘rgatganlar.
- **Bugun sinab ko‘ring:** Bugun bir do‘stingiz uchun o‘zingizga istagan yaxshilikni tilang.
- [ ] Tasdiqlandi · Izoh:

#### Tilingiz va qo‘lingiz · `harmless-tongue-and-hand`

- **Manba:** [Sahih al-Buxoriy, 10](https://sunnah.com/bukhari:10)
- **Matn:** Rasululloh ﷺ musulmon — boshqalar uning tili va qo‘lidan ozor ko‘rmaydigan kishi ekanini aytganlar.
- **Bugun sinab ko‘ring:** Bugun hech kimni so‘z bilan ham, ish bilan ham ranjitmaslikka harakat qiling.
- [ ] Tasdiqlandi · Izoh:

#### Aksa urganda · `after-sneezing`

- **Manba:** [Sahih al-Buxoriy, 6224](https://sunnah.com/bukhari:6224)
- **Matn:** Rasululloh ﷺ aksa urgan kishi «Alhamdulillah» deyishini, uni eshitgan kishi esa «Yarhamukalloh» deb javob qaytarishini o‘rgatganlar.
- **Bugun sinab ko‘ring:** Bugun aksa urganingizda «Alhamdulillah» deyishni unutmang.
- [ ] Tasdiqlandi · Izoh:

#### Haqiqiy kuch · `true-strength`

- **Manba:** [Sahih al-Buxoriy, 6114](https://sunnah.com/bukhari:6114)
- **Matn:** Rasululloh ﷺ kuchli kishi kurashda yenguvchi emas, balki g‘azab paytida o‘zini tuta oladigan kishi ekanini aytganlar.
- **Bugun sinab ko‘ring:** Bugun jahlingiz chiqsa, javob berishdan oldin bir lahza jim turing.
- [ ] Tasdiqlandi · Izoh:

#### Har yaxshilik — sadaqa · `every-kindness`

- **Manba:** [Sahih al-Buxoriy, 6021](https://sunnah.com/bukhari:6021)
- **Matn:** Rasululloh ﷺ har bir yaxshilik sadaqa ekanini aytganlar.
- **Bugun sinab ko‘ring:** Bugun kimgadir kichik bir yaxshilik qiling — bir yordam yoki bir iliq so‘z.
- [ ] Tasdiqlandi · Izoh:

#### Pinhona duo · `pray-in-secret`

- **Manba:** [Sahih Muslim 2732a](https://sunnah.com/muslim:2732a)
- **Matn:** Rasululloh ﷺ birodari uchun uning yo‘qligida duo qilgan kishiga farishta ham xuddi shuni tilashini aytganlar.
- **Bugun sinab ko‘ring:** Bugun bir do‘stingiz uchun uning xabarisiz duo qiling.
- [ ] Tasdiqlandi · Izoh:

#### Ne’matni qadrlang · `look-at-those-below`

- **Manba:** [Sahih Muslim 2963c](https://sunnah.com/muslim:2963c)
- **Matn:** Rasululloh ﷺ dunyo ishida o‘zingizdan pastroqdagilarga qarashni, yuqoridagilarga qaramaslikni tavsiya qilganlar: bu Allohning ne’matini kamsitmaslikka yaqinroqdir.
- **Bugun sinab ko‘ring:** Bugun sizda bor bo‘lgan uchta ne’matni sanab, ular uchun shukr qiling.
- [ ] Tasdiqlandi · Izoh:

#### Rostgo‘ylik · `truthfulness`

- **Manba:** [Sahih al-Buxoriy, 6094](https://sunnah.com/bukhari:6094)
- **Matn:** Rasululloh ﷺ rostgo‘ylik yaxshilikka, yaxshilik esa jannatga yetaklashini va kishi rost so‘zlayverib, rostgo‘ylardan bo‘lishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun har bir va’dangiz va so‘zingizda rostgo‘y bo‘ling.
- [ ] Tasdiqlandi · Izoh:

#### Tilga yengil ikki kalima · `two-light-words`

- **Manba:** [Sahih al-Buxoriy, 6406](https://sunnah.com/bukhari:6406)
- **Matn:** Rasululloh ﷺ tilga yengil, tarozida og‘ir va Rahmonga suyukli ikki kalimani aytganlar: «Subhanallohil ‘aziym» va «Subhanallohi va bihamdihi».
- **Bugun sinab ko‘ring:** Bugun yo‘lda ketayotganingizda shu ikki kalimani bir necha bor ayting.
- [ ] Tasdiqlandi · Izoh:

#### Jannat xazinasi · `treasure-of-paradise`

- **Manba:** [Sahih al-Buxoriy, 6384](https://sunnah.com/bukhari:6384)
- **Matn:** Rasululloh ﷺ «La havla va la quvvata illa billah» kalimasi jannat xazinalaridan biri ekanini aytganlar.
- **Bugun sinab ko‘ring:** Bugun qiyin ishga kirishganingizda «La havla va la quvvata illa billah» deng.
- [ ] Tasdiqlandi · Izoh:

#### Salavot · `send-salawat`

- **Manba:** [Sahih Muslim 408](https://sunnah.com/muslim:408)
- **Matn:** Rasululloh ﷺ kim u zotga bir marta salavot aytsa, Alloh unga o‘n marta rahmat yog‘dirishini aytganlar.
- **Bugun sinab ko‘ring:** Bugun Rasululloh ﷺ ga bir necha bor salavot ayting.
- [ ] Tasdiqlandi · Izoh:

#### Qalb va amal · `heart-and-deeds`

- **Manba:** [Sahih Muslim 2564c](https://sunnah.com/muslim:2564c)
- **Matn:** Rasululloh ﷺ Alloh suratlaringiz va mollaringizga emas, qalblaringiz va amallaringizga qarashini aytganlar.
- **Bugun sinab ko‘ring:** Bugun bir yaxshi ishni faqat Alloh uchun, hech kimga aytmasdan qiling.
- [ ] Tasdiqlandi · Izoh:

#### G‘iybatdan saqlaning · `avoid-backbiting`

- **Manba:** [Sahih Muslim 2589](https://sunnah.com/muslim:2589)
- **Matn:** Rasululloh ﷺ g‘iybat birodaringizni u yoqtirmaydigan tarzda eslash ekanini, aytilgan narsa unda bo‘lmasa, bu bo‘hton ekanini tushuntirganlar.
- **Bugun sinab ko‘ring:** Bugun suhbatda kimdir haqida g‘iybat boshlansa, gapni yaxshilikka buring.
- [ ] Tasdiqlandi · Izoh:

## Zikrlar

### Sayyidul istig‘for · `sayyid-al-istighfar`

- **Manba:** [Sahih al-Buxoriy, 6306](https://sunnah.com/bukhari:6306)
- **Izoh matni:** Rasululloh ﷺ bu duoni «sayyidul istig‘for» — istig‘forning eng afzali deb atadilar va uni kunduzi hamda kechasi ishonch bilan aytishning fazilatini bayon qildilar.
- **Arabcha:** اللَّهُمَّ أَنْتَ رَبِّي، لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَىَّ وَأَبُوءُ لَكَ بِذَنْبِي، فَاغْفِرْ لِي، فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ
- **Talaffuz:** Allohumma anta Robbiy, laa ilaaha illaa anta, xolaqtaniy va ana ‘abduka, va ana ‘alaa ‘ahdika va va’dika mastata’tu, a’uuzu bika min sharri maa sona’tu, abuu’u laka bini’matika ‘alayya, va abuu’u laka bizanbiy, fag‘firliy, fa innahu laa yag‘firuz-zunuuba illaa anta.
- **Ma’nosi:** Allohim, Sen mening Robbimsan, Sendan o‘zga iloh yo‘q. Meni Sen yaratding, men Sening bandangman. Kuchim yetgancha Senga bergan ahdim va va’dang ustidaman. Qilgan ishlarimning yomonligidan Sendan panoh so‘rayman. Menga bergan ne’matingni e’tirof etaman va gunohimni ham e’tirof etaman. Meni mag‘firat qil, chunki gunohlarni Sendan o‘zga hech kim mag‘firat qilmaydi.
- **Belgilash:** Kunduzi, Kechasi
- [ ] Tasdiqlandi · Izoh:

### Namozdan keyingi tasbih · `after-prayer-tasbih`

- **Manba:** [Sahih Muslim 597a](https://sunnah.com/muslim:597a)
- **Izoh matni:** Rasululloh ﷺ har namozdan keyin 33 marta tasbih, 33 marta tahmid, 33 marta takbir aytib, yuzinchisini tahlil bilan to‘ldirishni o‘rgatdilar.
- **33 marta:** سُبْحَانَ اللَّهِ — Subhanalloh — Alloh barcha nuqsonlardan pokdir
- **33 marta:** الْحَمْدُ لِلَّهِ — Alhamdulillah — Barcha hamd Allohgadir
- **33 marta:** اللَّهُ أَكْبَرُ — Allohu akbar — Alloh eng buyukdir
- **1 marta:** لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَىْءٍ قَدِيرٌ — Laa ilaaha illallohu vahdahu laa shariyka lah, lahul-mulku va lahul-hamdu va huva ‘alaa kulli shay’in qodiyr — Allohdan o‘zga iloh yo‘q, U yagona, Uning sherigi yo‘q. Mulk Unikidir, hamd Ungadir va U har narsaga qodirdir.
- [ ] Tasdiqlandi · Izoh:

## Kechki muhosaba savollari

- **Kirish:** Kun yakunida o‘zingiz bilan bir daqiqa. Bu yerda baho ham, hisob ham yo‘q — faqat shukr, saboq va ertangi niyat.
- **Maxfiylik:** Javoblaringiz faqat shu qurilmada saqlanadi, hech qayerga yuborilmaydi va 30 kundan keyin o‘chib ketadi.
- **Savol:** Bugun qaysi ne’mat uchun shukr qilasiz? _(namuna: Masalan, sog‘lik, oila, bir yaxshi suhbat…)_
- **Savol:** Nimani yaxshiroq qilishni istaysiz? _(namuna: O‘zingizga muloyim bo‘ling: bitta kichik narsa yetarli.)_
- **Savol:** Ertangi kun uchun bitta kichik niyat _(namuna: Masalan, onamga qo‘ng‘iroq qilish.)_
- [ ] Tasdiqlandi · Izoh:

## Namozdan so‘ng istig‘for

- **Manba:** [Sahih Muslim 591](https://sunnah.com/muslim:591)
- **Matn:** Rasululloh ﷺ namozni tugatgach, uch marta istig‘for aytar edilar.
- **Vaqtlar haqida:** Namoz vaqtlarini masjid yoki rasmiy taqvimdan oling — ular yil davomida o‘zgaradi, vaqti-vaqti bilan yangilab turing. Eslatma aynan siz yozgan vaqtda keladi: odatda namozdan 10–15 daqiqa keyingi vaqtni yozing.
- [ ] Tasdiqlandi · Izoh:

## Nafl ro‘za kunlari (8)

- **Kirish:** Rasululloh ﷺ tutgan yoki tavsiya qilgan nafl ro‘zalar. Bu eslatma — majburiyat emas, imkon.
- **Taqvim haqida:** Hijriy sana jadval (arifmetik) hisob bilan topiladi va taxminiy: oy boshi hilolni ko‘rishga qarab bir kunga farq qilishi mumkin. Ro‘za va hayit kunlarini O‘zbekiston musulmonlari idorasi e’loniga qarab belgilang. Kerak bo‘lsa, sanani ±1–2 kunga to‘g‘rilang.
- [ ] Tasdiqlandi · Izoh:

### Arafa kuni · `arafah`

- **Qachon:** hijriy 9-kun, 12-oy · bir kun oldin kechqurun eslatma (ixtiyoriy)
- **Manba:** [Sahih Muslim 1162a](https://sunnah.com/muslim:1162a)
- **Matn:** Rasululloh ﷺ Arafa kuni ro‘zasi o‘tgan va keyingi yil gunohlariga kafforat bo‘lishini Allohdan umid qilishlarini aytganlar.
- **Eslatma sarlavhasi:** Ertaga — Arafa kuni
- [ ] Tasdiqlandi · Izoh:

### Tosuo kuni · `tasua`

- **Qachon:** hijriy 9-kun, 1-oy · bir kun oldin kechqurun eslatma (ixtiyoriy)
- **Manba:** [Sahih Muslim 1134b](https://sunnah.com/muslim:1134b)
- **Matn:** Rasululloh ﷺ Ashuro ro‘zasini tutganlarida, kelasi yilga yetsalar, Muharramning to‘qqizinchi kuni ro‘za tutishlarini aytganlar.
- **Eslatma sarlavhasi:** Ertaga — Tosuo kuni
- [ ] Tasdiqlandi · Izoh:

### Ashuro kuni · `ashura`

- **Qachon:** hijriy 10-kun, 1-oy · bir kun oldin kechqurun eslatma (ixtiyoriy)
- **Manba:** [Sahih Muslim 1162a](https://sunnah.com/muslim:1162a)
- **Matn:** Rasululloh ﷺ Ashuro kuni ro‘zasi o‘tgan bir yil gunohlariga kafforat bo‘lishini Allohdan umid qilishlarini aytganlar.
- **Eslatma sarlavhasi:** Ertaga — Ashuro kuni
- [ ] Tasdiqlandi · Izoh:

### Shavvoldan olti kun · `shawwal`

- **Qachon:** hijriy 2-kun, 10-oy · bir kun oldin kechqurun eslatma (ixtiyoriy)
- **Manba:** [Sahih Muslim 1164a](https://sunnah.com/muslim:1164a)
- **Matn:** Rasululloh ﷺ Ramazon ro‘zasidan so‘ng Shavvoldan olti kun ro‘za tutgan kishi go‘yo doimiy ro‘za tutgandek bo‘lishini aytganlar.
- **Eslatma sarlavhasi:** Hayitdan so‘ng — Shavvol ro‘zalari
- [ ] Tasdiqlandi · Izoh:

### Muharram oyi · `muharram`

- **Qachon:** hijriy 1-oy davomida
- **Manba:** [Sahih Muslim 1163a](https://sunnah.com/muslim:1163a)
- **Matn:** Rasululloh ﷺ Ramazondan keyingi eng afzal ro‘za — Allohning oyi Muharramdagi ro‘za ekanini aytganlar.
- [ ] Tasdiqlandi · Izoh:

### Sha’bon oyi · `shaban`

- **Qachon:** hijriy 8-oy davomida
- **Manba:** [Sahih al-Buxoriy, 1969](https://sunnah.com/bukhari:1969)
- **Matn:** Oisha (r.a.) Rasululloh ﷺ Ramazondan boshqa oyni to‘liq tutmaganlarini va boshqa biror oyda Sha’bondagidan ko‘p ro‘za tutganlarini ko‘rmaganini aytgan.
- [ ] Tasdiqlandi · Izoh:

### Har dushanba · `monday`

- **Qachon:** har hafta
- **Manba:** [Sahih Muslim 1162e](https://sunnah.com/muslim:1162e)
- **Matn:** Rasululloh ﷺ dushanba ro‘zasi haqida so‘ralganda, o‘sha kuni tug‘ilganlarini va o‘sha kuni o‘zlariga vahiy tushirilganini aytganlar.
- [ ] Tasdiqlandi · Izoh:

### Har oyda uch kun · `three-days`

- **Qachon:** har oyda
- **Manba:** [Sahih Muslim 1160](https://sunnah.com/muslim:1160)
- **Matn:** Oisha (r.a.) Rasululloh ﷺ har oyda uch kun ro‘za tutganlarini va bu kunlarni oyning qaysi qismiga to‘g‘ri kelishiga qaramaganlarini aytgan.
- [ ] Tasdiqlandi · Izoh:

## Kirill yozuvi (namunalar)

Kirill yozuvi tanlanganda ilova matnlari avtomatik o‘giriladi. Diniy atamalar to‘g‘ri chiqayotganini tekshiring:

- Rasululloh ﷺ bir kunda Allohdan 100 marta mag‘firat so‘rashlarini aytganlar. Har bir niyat uchun kunlik reja — necha mahal va har mahalda nechta — o‘zingiz tanlagan va istalgan payt o‘zgartirishingiz mumkin bo‘lgan maqsad; keltirilgan hadisda aynan shunday jadval belgilanmagan.
  - Расулуллоҳ ﷺ бир кунда Аллоҳдан 100 марта мағфират сўрашларини айтганлар. Ҳар бир ният учун кунлик режа — неча маҳал ва ҳар маҳалда нечта — ўзингиз танлаган ва исталган пайт ўзгартиришингиз мумкин бўлган мақсад; келтирилган ҳадисда айнан шундай жадвал белгиланмаган.
- Sayyidul istig‘for
  - Саййидул истиғфор
- Namozdan keyingi tasbih
  - Намоздан кейинги тасбиҳ
- Rasululloh ﷺ namozni tugatgach, uch marta istig‘for aytar edilar.
  - Расулуллоҳ ﷺ намозни тугатгач, уч марта истиғфор айтар эдилар.
- Rasululloh ﷺ Arafa kuni ro‘zasi o‘tgan va keyingi yil gunohlariga kafforat bo‘lishini Allohdan umid qilishlarini aytganlar.
  - Расулуллоҳ ﷺ Арафа куни рўзаси ўтган ва кейинги йил гуноҳларига каффорат бўлишини Аллоҳдан умид қилишларини айтганлар.
- Rasululloh ﷺ Ashuro ro‘zasini tutganlarida, kelasi yilga yetsalar, Muharramning to‘qqizinchi kuni ro‘za tutishlarini aytganlar.
  - Расулуллоҳ ﷺ Ашуро рўзасини тутганларида, келаси йилга етсалар, Муҳаррамнинг тўққизинчи куни рўза тутишларини айтганлар.
- Rasululloh ﷺ Ashuro kuni ro‘zasi o‘tgan bir yil gunohlariga kafforat bo‘lishini Allohdan umid qilishlarini aytganlar.
  - Расулуллоҳ ﷺ Ашуро куни рўзаси ўтган бир йил гуноҳларига каффорат бўлишини Аллоҳдан умид қилишларини айтганлар.
- Rasululloh ﷺ Ramazon ro‘zasidan so‘ng Shavvoldan olti kun ro‘za tutgan kishi go‘yo doimiy ro‘za tutgandek bo‘lishini aytganlar.
  - Расулуллоҳ ﷺ Рамазон рўзасидан сўнг Шавволдан олти кун рўза тутган киши гўё доимий рўза тутгандек бўлишини айтганлар.
- [ ] Tasdiqlandi · Izoh:
