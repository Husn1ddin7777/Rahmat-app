# Rahmat — iPhone bosh ekraniga o‘rnatish

Doimiy havola: **https://rahmat.husniddinizzatullayev7777.workers.dev**

Ilova Cloudflare’ga joylandi va Web Push xizmati ulandi (2026-09-28). iPhone’da:

1. Havolani iPhone’da **Safari** bilan oching.
2. **Ulashish → Bosh ekranga qo‘shish → Qo‘shish** ni bosing.
3. Bosh ekrandagi **Rahmat** belgisidan ilovani oching.
4. **Eslatmalar → Bildirishnomalar** ni yoqing, so‘ralganda **Ruxsat berish** ni tanlang.
5. **Sinov eslatmasi** ni bosing. Ilovani yoping va bir necha soniya kuting.

Bildirishnomalar uchun iOS 16.4 yoki yangiroq versiya va internet kerak. Rahmat ochilishi, niyatlar va sanoqlar birinchi yuklanishdan keyin internetsiz ham ishlaydi. Telefoningizdagi Focus rejimi va bildirishnoma sozlamalari yetkazilishga ta’sir qilishi mumkin.

Qaydlar faqat o‘sha brauzer/ilovada saqlanadi; Expo Go’dagi qaydlar avtomatik ko‘chmaydi. Safari, bosh ekrandagi ilova va boshqa qurilmalar alohida saqlash joyiga ega bo‘lishi mumkin. Brauzer ma’lumotlarini yoki ilovani o‘chirsangiz, qaydlar yo‘qolishi mumkin. Muhosaba matnlari serverga yuborilmaydi.

## Serverni bir marta ulash (Windows)

Apple Developer a’zoligi yoki Mac kerak emas. Cloudflare hisobiga kirish kerak; ushbu loyiha Workers Free va SQLite Durable Objects uchun sozlangan. Pullik tarifga o‘tish shart emas; bepul kvotalar tugasa xizmat cheklanishi mumkin.

Node.js 22+ bilan loyiha katalogida:

```powershell
npm ci
npx wrangler login
npm run typecheck
npm test
npm run export:web
npx wrangler deploy
```

`deploy` qaytargan **haqiqiy HTTPS havolani** quyida ishlating. Maxfiy kalit zaxirasi loyiha katalogidan tashqarida bo‘lsin:

```powershell
node scripts/setup-push.cjs https://YOUR-LIVE-APP-URL C:/your-private-folder/rahmat-vapid.json
```

Bu buyruq VAPID kalitlarini yaratadi va Cloudflare secrets xizmatiga yuboradi. Mavjud zaxirani qayta ishlatadi. Kalitlarni almashtirmang: ularni almashtirish mavjud bildirishnoma obunalarini qayta yoqishni talab qiladi. Maxfiy faylni manba arxiviga yoki chatga qo‘shmang.

`/api/push/config` faqat ochiq VAPID kalitini qaytarishi kerak. Maxfiy sozlamalar ulanmasa xizmat 503 qaytaradi va interfeys eslatmalar yoqilganini bildirmaydi.

## Yangilash va tekshirish

Safari’da “Response served by service worker has redirections” xatosi chiqsa, boshqa Rahmat oynalarini yoping, [tiklash sahifasini](https://rahmat.husniddinizzatullayev7777.workers.dev/repair.html) Safari’da oching va **Rahmatni tiklash** ni bosing. Bu niyatlar, sanoqlar, mahalliy saqlash yoki bildirishnoma ruxsatini o‘chirmaydi. Keyin bosh ekrandagi ilovani yopib, qayta oching. Ilova va Safari ma’lumotlarini tozalash shart emas.

**Sinov holatini tekshirish** tugmasi xabar hali navbatdaligini, xizmat qabul qilganini yoki rad etganini ko‘rsatadi. Xizmat qabul qilishi telefon xabarni ko‘rsatganini anglatmaydi. Ekran qulflanganda haqiqiy kelishini telefonda tekshiring.

- `npm run deploy:pwa` — yangi web bundle va Worker’ni joylaydi.
- Yangilanish o‘rnatilishi uchun ochiq Rahmat oynalarini yopib, qayta oching. Faol sanoq paytida majburiy qayta yuklash yo‘q.
- `npm run preview:pwa` — mahalliy Worker ko‘rish. Haqiqiy telefon eslatmalari uchun doimiy HTTPS manzil kerak.
- Bosh ekrandagi ilovadan bildirishnomani o‘chiring; qayta kelmasligini tekshiring.
- Sinov: ekran qulflanganda xabar kelishi, xabar bosilganda kerakli bo‘lim va Sunnat matni ochilishi, ertangi vaqtlar, vaqt mintaqasi va Focus holati.

Server faqat bildirishnoma obunasi, vaqtlar, vaqt mintaqasi va faol niyat bor-yo‘qligini saqlaydi. Niyat nomi, izohi, identifikatori va sanoqlari yuborilmaydi. Server yozuvi 90 kun ilova ochilmasa eskiradi; ilovani ochish muddatni yangilaydi. Eski xabarlar 5 daqiqalik yetkazish oynasidan keyin tashlab yuboriladi.

Cloudflare joylashuvi, HTTPS sahifa, o‘rnatish manifesti, service worker, ikonka va bildirishnoma xizmati sozlamalari tekshirildi. Haqiqiy iPhone’da o‘rnatish va ekran qulflangan paytda sinov xabarining kelishi hali telefonda tekshirilishi kerak.
