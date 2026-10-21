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

For release: review the Uzbek religious content (see CONTENT-REVIEW.md), confirm bundle identifiers, supply final brand/store assets and privacy disclosure, and complete account/signing and distribution setup.
