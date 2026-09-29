# Rahmat

**Kichik qadamlar, go‘zal odatlar.** An Uzbek-language mobile app for Sunnah habits, personal reflection, and gentle daytime reminders. React Native + Expo SDK 57, prepared for Android and iPhone.

Live PWA: **https://rahmat.husniddinizzatullayev7777.workers.dev**. Deployed on 2026-09-28 with Web Push credentials configured. See [iPhone installation](./PWA-SETUP.md).

## The first version

- **Bugun:** daily habit checkoffs, istighfar progress, a sourced Sunnah reminder, and real weekly activity.
- **Istig‘for:** five independent counters of 100 for each active reflection; tap to count and undo the last tap. A new local calendar day starts fresh, without carrying a missed target forward.
- **Muhosaba:** optional names and notes, pause/reactivate entries, and delete an entry. Maximum 20 entries, including archived entries. Keeps the latest 30 recorded days of progress.
- **Eslatmalar:** five editable times, a daytime window, 1–3 random Sunnah reminders per day, permission handling, and a test notification.

The name Rahmat and bundle IDs are working choices. This is an implemented first version, not an App Store release or an installable APK/IPA.

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

## Try an installable build

The preview profile is configured in `eas.json`. Creating a native binary requires your Expo account and, for iOS physical devices, the relevant Apple signing setup. Before distribution, choose your own unique bundle identifiers in `app.json`; `uz.rahmat.habits` is a placeholder.

```sh
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios
```

No paid build was submitted. Native signing/store release and the PWA production deployment are separate steps. Work through [DEVICE-CHECKLIST.md](./DEVICE-CHECKLIST.md) on physical devices before distributing it.

## Reminders and privacy

The native Expo version uses **local scheduled phone notifications**. The PWA uses a Cloudflare Worker with one scheduled Durable Object per anonymous device to send standard Web Push. There is no analytics feature yet.

The five daily istighfar notifications are combined reminders for all active entries; the counters remain separate per entry. Notifications never contain private entry names, notes, or entry counts. When there are no active entries, only Sunnah reminders are scheduled.

Native Sunnah reminders use a weekday-specific randomized schedule, restricted to the chosen daytime interval. Five daily notifications plus at most 21 weekly notifications keep the total at 26. Reopening the app on a later day refreshes the selection; otherwise the existing weekday timing and content repeats each week. Device Focus modes, notification permissions, timezone changes, and battery policies can affect delivery. Reopen after changing timezone to refresh the plan. Notification timestamps are scheduled intentions, not guarantees of exact delivery. The PWA server generates each day’s Sunnah plan even while the app is closed; it sends 1–3 Sunnah reminders plus five shared istighfar prompts when entries are active.

On native devices, the state is stored in encrypted Expo SecureStore chunks with serialized writes and an atomic manifest. No reflection content is sent to a server. There is no in-app biometric lock; protect the device with its normal lock. Changes save after a short debounce and are flushed when the app backgrounds. OS interruption can still affect a just-entered change. The app reports save failures instead of silently discarding previously saved records. iOS Keychain data may survive uninstall; use the in-app delete-all action to erase records.

## Religious content

Eight Uzbek reminders are paraphrases, labeled as such and linked to their hadith references in `src/data/sunnah.json`. The 5 × 100 goal per entry is the user's chosen personal routine; the app does not describe it as a religious prescription or a measure of forgiveness. [Sahih Muslim 2702a](https://sunnah.com/muslim:2702a) supports the separately described practice of seeking forgiveness 100 times daily.

Have the final Uzbek wording and religious framing reviewed before public release. The current content is a small reviewed source set, not a comprehensive hadith library.

## Verification completed

- TypeScript validation passes.
- Automated tests cover native behavior, durable browser storage, Web Push permission/lifecycle handling, server scheduling/time zones, payload encryption, and error paths. Native checks also cover counter isolation, local midnight rollover, bounds, archive behavior, storage corruption and interrupted writes, explicit deletion, permission denial, cancellation, and notification routing.
- Web, Android, and iOS production JavaScript/Hermes bundles export successfully.
- Browser checks cover adding an entry, counting, undo, switching sessions, and invalid/valid time settings.
- Safari recovery: static HTML is served without redirects, followed-redirect navigation responses are sanitized, and `/repair.html` activates the fixed worker without deleting private data or push subscriptions.
- The production Web Push sender is exercised in Cloudflare's workerd runtime. Outbound requests use `redirect: 'manual'` and reject 3xx responses; workerd does not support `redirect: 'error'`. Time-sensitive notices request high urgency. Authenticated test diagnostics distinguish provider acceptance from actual phone display.

Cloudflare production deployment, HTTPS app rendering, installation manifest, service worker, icons, and the public push configuration endpoint have been verified. Physical-device Web Push delivery, native persistence, signing, and store distribution remain to be verified. Browser reload persistence and offline reload have been checked locally. The native notification and SecureStore unit tests use adapters/mocks and do not replace phone testing.
