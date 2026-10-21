# Physical-device acceptance checks

These are pending checks, not completed test results. Run on both Android and iPhone using an appropriate signed build or compatible Expo Go.

1. Start with no records. Add two Muhosaba entries. Both must show separate five-part goals of 500 per day. Count on one, switch to the other, and verify its counters are unchanged.
2. Complete a 100-count session. Additional taps must not exceed 100. Undo must reduce it to 99. Switch sessions and verify each retains its own count.
3. Background and reopen the app; then restart it. Check saved names, notes, counts, habit checkoffs, and settings. Repeat while offline.
4. Cross local midnight. Today should start at zero, while the previous activity day remains visible. Repeat in a timezone with a different UTC offset.
5. Pause an entry. It should leave today's active target and keep its previous history. Reactivate it and confirm its current-day progress returns.
6. Turn notifications on and allow permission. Send the five-second test reminder while the app is backgrounded. Tap it and verify it opens Today.
7. On a clean permission state, deny the notification prompt. Verify the settings screen offers a route to phone settings. Grant permission there, return, and explicitly enable reminders again.
8. Set a valid near-future istighfar reminder within the daytime interval. Close/background the app and check delivery. Tap it to open Istig‘for. Repeat with the device locked; private names and notes must never appear.
9. Verify Sunnah reminders include public, sourced content. Check randomized times fit within the daytime window and that the current weekday has the selected reminder count.
10. Try duplicate times, invalid text, reversed order, and times outside the daytime interval. Save must be refused without corrupting previously saved settings.
11. Turn reminders off; verify pending reminders are canceled. Pause all active entries and confirm only Sunnah reminders remain when notifications are enabled.
12. Change timezone, reopen, and verify the plan refreshes for local time. Check behavior with Focus/Do Not Disturb and battery restrictions; delivery may be delayed or suppressed by the OS.
13. Delete a disposable test entry and verify its counts disappear without changing other entries. Delete all disposable test data and verify records and reminders are gone after restarting.
14. Check a small phone, large system text, screen reader labels, keyboard overlap, safe areas, and the Arabic text. Core controls should remain accessible without horizontal page overflow.

## Version 1.1 checks

15. Install 1.1 over a phone or browser that has 1.0 data. Every intention, note, count and habit must remain; old intentions show "Kuniga 5 × 100".
16. Add an intention with the default 1 × 33. Count to 33; further taps must not count. Change it to 3 × 10 and confirm today's counts are capped, not deleted; change back and confirm they return.
17. With only a 2-session routine active, turn reminders on. Only the first two istighfar times should arrive. Pause it and confirm istighfar reminders stop while Sunnah reminders continue.
18. Turn on the evening Muhosaba reminder at a time after the daytime window. It must arrive with generic text only and open Muhosaba when tapped.
19. Add personal habits with and without weekdays; confirm each appears only on its days and never in a notification. Remove one and confirm past days stay marked.
20. Mark Sayyid al-istighfar day and night, and finish one after-prayer tasbih (100). Confirm the day is marked in "So‘nggi 30 kun" and nothing shows a score.
21. Write, edit and delete an evening Muhosaba entry. Confirm yesterday's intention appears on Bugun the next day (not while Muhosaba is locked), and that entries older than 30 days disappear.
22. Set a PIN for Muhosaba only: intention names show as "Niyat 1…" on the Istig‘for tab, and Muhosaba asks for the PIN each time it is opened. Switch to the whole-app lock; background the app and confirm it locks again. Five wrong PINs must pause entry.
23. On a phone with fingerprint or face unlock, enable it and confirm it opens the lock; cancel it and confirm the PIN still works. Confirm "PIN kodni unutdingizmi?" deletes everything and leaves the app unlocked and empty.
24. Use the Android back button inside every new sheet; it must close the sheet without losing saved data.

## Version 1.2 checks

25. Install 1.2 over 1.1. Every intention, count, habit, evening entry, reminder setting and the lock must remain; the app opens in Latin.
26. Switch Eslatmalar → Ilova sozlamalari → Yozuv to **Кирилл**. Check every tab and sheet: app text is Cyrillic, nothing shows boxes or a different-looking font, and intention names, notes, habits and Muhosaba answers stay exactly as typed. Send a test notification: it must be Cyrillic. Switch back to Lotin.
27. Choose «Namozdan so‘ng», type times for two prayers only and save. With a 2-session routine both reminders arrive at those times — including one before the daytime window — titled "Bomdod namozidan so‘ng" etc. The counter shows the prayer names under the sessions. Try times out of prayer order: saving must be refused.
28. On Bugun the Hijri date matches the calendar sheet. Use + and − in the sheet: the date moves by one day each step, never beyond ±2, and the setting survives a restart.
29. Turn on «Nafl ro‘za kunlari». Temporarily set the phone's date to the day before a listed day (or correct the Hijri date so tomorrow is one) and confirm the evening reminder at 20:00 and the card on Bugun. Restore the date.
30. Create a backup with a short phrase (refused), then with a good phrase. Save it to a folder (Downloads) and share it to Telegram «Saqlangan xabarlar». The file must not contain readable names or notes.
31. Restore that backup on a second phone (or after «Barcha ma’lumotlarni o‘chirish»): a wrong phrase is refused; the right one shows the summary and restores everything. Reminders stay off until turned on; a lock set in the backup asks for its PIN on the next start.
32. In the browser version create a backup with «Yuklab olish» and restore it in the Android app.
33. Add the «Rahmat — bugun» widget to the home screen. Count istighfar and tick a habit: the widget updates after a moment. Tap it: the app (and its lock) opens. Turn on the whole-app lock: the widget shows only "Rahmat". After midnight it shows zeros even if the app was not opened.
34. In Cyrillic, the widget is Cyrillic with proper letters.
35. Upload a test recording to `assets/audio` (see AUDIO.md). In the new APK the «Tinglash» button appears only for that dhikr, plays with the phone on silent, stops when tapped again and plays again from the start. No microphone permission is requested at any point.
36. Large system text and a screen reader on the new screens: the script switch, prayer rows, calendar stepper and backup steps are readable and labelled.

For release: review the Uzbek religious content (see CONTENT-REVIEW.md), confirm bundle identifiers, supply final brand/store assets and privacy disclosure, and complete account/signing and distribution setup.
