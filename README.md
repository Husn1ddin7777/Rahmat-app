# Rahmat

**Kichik qadamlar, go‘zal odatlar.** An Uzbek-language mobile app for Sunnah habits, personal reflection, and gentle daytime reminders. React Native + Expo SDK 57, prepared for Android and iPhone.

Live PWA: **https://rahmat.husniddinizzatullayev7777.workers.dev**. Deployed on 2026-09-28 with Web Push credentials configured. See [iPhone installation](./PWA-SETUP.md).

## What it does (version 1.2)

- **Bugun:** three default habits plus up to seven personal habits (optional weekdays), istighfar progress, yesterday's intention for today, a Sunnah reminder with a "try it today" step, and a gentle weekly line. A 30-day calendar marks good days; there is no streak to break and missed days are never owed.
- **Istig‘for — Niyatlarim:** each intention has its own routine, chosen by the user: 1–5 sessions a day of 10, 33 or 100. New intentions start at 1 × 33; intentions from version 1.0 keep 5 × 100. Changing a routine never deletes counts.
- **Istig‘for — Kunlik zikrlar:** Sayyid al-istighfar (Sahih al-Bukhari 6306) with day and night check-offs, and the after-prayer tasbih of Sahih Muslim 597a (33 · 33 · 33 and the tahlil) with a guided counter. Arabic text is taken from the source; Uzbek transliteration and meaning await review.
- **Muhosaba:** private intentions with optional notes, pause/reactivate/delete, and an optional evening reflection of three questions (gratitude, one thing to do better, one intention for tomorrow). No scores. Entries stay on the device and roll off after 30 days.
- **Eslatmalar:** five editable times, a daytime window, 1–3 random Sunnah reminders a day from 47 sourced reminders, an optional evening Muhosaba reminder, a test notification, and the app lock.
- **App lock (optional):** a 4–6 digit PIN, for the whole app or only Muhosaba (which also hides intention names elsewhere). On phones, fingerprint, face or the phone's own passcode can open it. A forgotten PIN can only be reset by deleting all data.

New in 1.2:

- **Uzbek Cyrillic (Lotin / Кирилл):** one switch in Eslatmalar → Ilova sozlamalari. The app's wording, sources, notifications, the Android widget and the fingerprint prompt follow it; text the user typed is never converted. A built-in converter handles o‘/g‘, sh/ch, ё/ю/я/е, э, ъ and month names; Onest replaces DM Sans for Cyrillic (DM Sans has no Cyrillic letters).
- **After-prayer reminders:** istighfar reminders can follow the five prayers instead of clock times. The user types each prayer time (no location is used); session N of a routine follows the N-th prayer with a time, and notifications read "Peshin namozidan so‘ng". Sourced to Sahih Muslim 591.
- **Hijri date and voluntary fasting days:** the Hijri date on Bugun (arithmetic calendar, identical to the Unicode `islamic-civil` calendar, correctable by ±2 days to match the local announcement), a calendar sheet with upcoming sourced fasting days, and an optional reminder the evening before Arafa, Tosuo, Ashuro and the Shavvol fasts.
- **Encrypted backup and transfer:** all data in one file, sealed with XChaCha20-Poly1305 under a key derived from the user's secret phrase by scrypt (N = 8192). Save it to a folder or share it (Telegram, Drive); restore it on another phone, or move browser data into the Android app. Reminders start switched off after a restore.
- **Android home-screen widget:** today's istighfar and habit numbers only, never names; it shows nothing but "Rahmat" while the whole-app lock is on, and starts from zero at midnight.
- **Adhkar audio:** a listen button next to each dhikr, shown only when a recording exists. Recordings are the owner's own (see [AUDIO.md](./AUDIO.md)); none are bundled yet.

Android APK: **https://github.com/Husn1ddin7777/Rahmat-app/releases/latest/download/Rahmat.apk** (built automatically from `main`; see [Android APK](#android-apk)).

The name Rahmat and bundle IDs are working choices. This is an implemented first version, not an App Store or Google Play release.

## Run it

Use a current Node.js LTS release. From this folder:

```sh
npm ci
npm start
```

On a physical iPhone, sign in to the same Expo account in both Expo CLI and Expo Go before scanning. Use `npx expo login --browser` on your computer and the account icon in Expo Go; see the [current iPhone sign-in requirement](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/). Keep Expo online for the initial development-signing certificate.

Open the QR code in a version of Expo Go compatible with SDK 57 on your phone. The phone and computer normally need to share a network. If Expo Go does not support the installed SDK, use an EAS preview build instead. Local notifications remain available in compatible Expo Go; remote push support has different restrictions. See the [Expo notifications documentation](https://docs.expo.dev/versions/latest/sdk/notifications/).

```sh
npm run web          # Interactive browser preview
npm run typecheck    # TypeScript validation
npm test            # Domain, storage failure, and notification mock tests
npm run export:web  # Static browser bundle
npm run export:native # Android and iOS JavaScript/Hermes bundles
```

The web version is now an installable PWA with durable local IndexedDB state, an offline app shell, and a Web Push service. See [PWA-SETUP.md](./PWA-SETUP.md) for iPhone installation and the one-time Cloudflare deployment. It requires a live HTTPS origin and configured VAPID secrets before background notifications work. Browser storage is not app-encrypted.

## Android APK

The [Android APK workflow](./.github/workflows/android-apk.yml) runs on GitHub's servers; no Expo account or local Android setup is needed. It typechecks and tests the project, generates the native Android project with `expo prebuild`, and runs a Gradle release build for ARM phones (`armeabi-v7a`, `arm64-v8a`).

- **Pull requests:** the APK is attached to the workflow run as an artifact for checking.
- **`main`:** the APK is also published as a GitHub Release named `Rahmat.apk`. The link above always serves the newest one.
- **Version code:** each build uses the workflow run number, so a newer APK installs as an update and keeps the app's data.
- **Signing:** builds are signed with the standard React Native debug key from the Expo template. That is fine for sideloading test builds, but the key is public. Switch to a private release key (stored as a GitHub secret) before wide distribution or Google Play; that switch requires one uninstall and reinstall.

To install: open the link on the Android phone, download `Rahmat.apk`, open it, and allow installs from that source when Android asks.

## Other installable builds (EAS)

The preview profile is configured in `eas.json`. Creating a native binary requires your Expo account and, for iOS physical devices, the relevant Apple signing setup. Before distribution, choose your own unique bundle identifiers in `app.json`; `uz.rahmat.habits` is a placeholder.

```sh
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios
```

No paid build was submitted. Native signing/store release and the PWA production deployment are separate steps. Work through [DEVICE-CHECKLIST.md](./DEVICE-CHECKLIST.md) on physical devices before distributing it.

## Reminders and privacy

Istighfar reminders follow the largest active routine: an intention of 2 sessions a day gets reminders at the first two chosen times (or after the first two prayers that have a time). The optional evening Muhosaba reminder and the fasting-eve reminders use generic wording only, never the user's answers.

The native Expo version uses **local scheduled phone notifications**. The PWA uses a Cloudflare Worker with one scheduled Durable Object per anonymous device to send standard Web Push. There is no analytics feature yet.

The five daily istighfar notifications are combined reminders for all active entries; the counters remain separate per entry. Notifications never contain private entry names, notes, or entry counts. When there are no active entries, only Sunnah reminders are scheduled.

Native Sunnah reminders use a weekday-specific randomized schedule, restricted to the chosen daytime interval. Five daily istighfar prompts, one evening prompt, at most 21 weekly Sunnah reminders and at most four dated fasting reminders keep the total at 31. Reopening the app on a later day refreshes the selection; otherwise the existing weekday timing and content repeats each week. Device Focus modes, notification permissions, timezone changes, and battery policies can affect delivery. Reopen after changing timezone to refresh the plan. Notification timestamps are scheduled intentions, not guarantees of exact delivery. The PWA server generates each day’s Sunnah plan even while the app is closed; it sends 1–3 Sunnah reminders plus five shared istighfar prompts when entries are active.

On native devices, the state is stored in encrypted Expo SecureStore chunks with serialized writes and an atomic manifest. No reflection content is sent to a server. The home-screen widget reads a separate snapshot of two pairs of numbers. Backups leave the phone only when the user saves or shares the encrypted file; without the secret phrase it cannot be opened, and there is no way to recover a forgotten phrase. Changes save after a short debounce and are flushed when the app backgrounds. OS interruption can still affect a just-entered change. The app reports save failures instead of silently discarding previously saved records. iOS Keychain data may survive uninstall; use the in-app delete-all action to erase records.

## Religious content

**Status: sources checked on 2026-10-21 and 2026-10-22; scholar review pending.** Every reminder links to Sahih al-Bukhari or Sahih Muslim on sunnah.com and is labelled as a paraphrase. [CONTENT-REVIEW.md](./CONTENT-REVIEW.md) lists every religious text in the app as a checklist for the reviewer, with eleven open questions and Cyrillic samples (`npm run content:review` regenerates it). After approval, set `scholarReview.status` to `approved` in `src/data/sunnah.json`, `adhkar.json`, `muhosaba.json`, `fasting.json` and `prayer.json`; the in-app "awaiting review" notices then disappear.

The fasting days (`src/data/fasting.json`) were checked against the hadith text: Arafa and Ashuro (Sahih Muslim 1162a), Monday (1162e), Tosuo (1134b), six days of Shavvol (1164a), Muharram (1163a), three days a month on any days (1160) and Sha’bon (Sahih al-Bukhari 1969). The Hijri date is an estimate; the calendar tells users to follow the announcement of the Muslim Board of Uzbekistan. The 13th–15th ("white days") are not shown, because their source is outside Bukhari and Muslim; that is an open question for the reviewer.

The 47 Uzbek reminders are paraphrases, labelled as such and linked to their hadith references in `src/data/sunnah.json`. Each routine is the user's own choice; the app does not describe it as a religious prescription, and counts are never presented as forgiveness, reward or rank. [Sahih Muslim 2702a](https://sunnah.com/muslim:2702a) supports the separately described practice of seeking forgiveness 100 times daily. The app gives no rulings.

Have the Uzbek wording, transliteration and religious framing reviewed before public release. The library is a reviewed-source set, not a comprehensive hadith collection.

## Verification completed

Version 1.2 (2026-10-22):

- 128 automated tests pass (plus 11 PWA and push-runtime tests), adding: the Cyrillic converter on every bundled religious text (no stray Latin left), the Hijri calendar against ICU `islamic-civil` day by day for 1990–2080, fasting days and their reminder eves under every correction, prayer-linked prompts on phone and server (outside the daytime window, Sunnah reminders kept apart), Cyrillic notifications and the server's test notice, backups (exact round trip, wrong phrase, a changed byte or header, oversized or memory-heavy files), the widget snapshot (numbers only, hidden under the whole-app lock, zero on a new day), and compatibility with 1.1 web apps and stored 1.1 data.
- A browser run-through of the exported web app passed: the Hijri line and calendar with ±1 correction, prayer-linked times and session labels, the script switch on every tab (typed intentions, notes and habits stayed as typed), playing and finishing a test recording, creating an encrypted backup, deleting all data, refusing a wrong phrase, and restoring everything (back in Cyrillic, reminders off).
- Not yet checked on a physical phone: the home-screen widget, saving a backup to a folder and the share sheet, dated fasting notifications, and Onest in the widget.

Version 1.1 (2026-10-21):

- 102 automated tests pass, including: upgrade of version 1.0 records with nothing lost, routines and capped counts, personal habits by weekday, evening entries (blank saves delete; deleted days leave no record), adhkar bounds, the 30-day calendar across month ends and daylight saving, PIN hashing and lock rules, reminder slots and the evening prompt on phone, web and server, compatibility with older installed web apps and stored server records, and content checks (every reminder links to a matching Bukhari or Muslim reference; the tasbih completes 100).
- A browser run-through of the exported web app passed 45 checks: upgrading a 1.0 record, adding and changing a routine, counting to a target, both adhkar, personal habits, the 30-day view, the evening reflection and yesterday's intention, deleting a past entry, the evening reminder setting, Muhosaba-only and whole-app locks (wrong and right PIN, the pause after five wrong PINs, and "forgot PIN"), the sources sheet, and persistence after reload.
- Not yet checked on a physical phone: fingerprint/face unlock, phone notifications for the new schedule, and Android back-button behaviour in the new sheets.

Version 1.0:

- TypeScript validation passes.
- Automated tests cover native behavior, durable browser storage, Web Push permission/lifecycle handling, server scheduling/time zones, payload encryption, and error paths. Native checks also cover counter isolation, local midnight rollover, bounds, archive behavior, storage corruption and interrupted writes, explicit deletion, permission denial, cancellation, and notification routing.
- Web, Android, and iOS production JavaScript/Hermes bundles export successfully.
- Browser checks cover adding an entry, counting, undo, switching sessions, and invalid/valid time settings.
- Safari recovery: static HTML is served without redirects, followed-redirect navigation responses are sanitized, and `/repair.html` activates the fixed worker without deleting private data or push subscriptions.
- The production Web Push sender is exercised in Cloudflare's workerd runtime. Outbound requests use `redirect: 'manual'` and reject 3xx responses; workerd does not support `redirect: 'error'`. Time-sensitive notices request high urgency. Authenticated test diagnostics distinguish provider acceptance from actual phone display.

Cloudflare production deployment, HTTPS app rendering, installation manifest, service worker, icons, and the public push configuration endpoint have been verified. Physical-device Web Push delivery, native persistence, signing, and store distribution remain to be verified. Browser reload persistence and offline reload have been checked locally. The native notification and SecureStore unit tests use adapters/mocks and do not replace phone testing.
