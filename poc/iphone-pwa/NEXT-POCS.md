# Next iPhone-First POCs

Android work is deferred until the end. For now, POCs should focus on iPhone. Windows is used only as the automation and stress-test fallback when a test cannot be fully automated on iPhone.

## Priority 1: iPhone Memory And Production Dictionary Engine

Question: can the production dictionary engine keep normal-use iPhone memory <= 50 MB while preserving offline lookup speed?

Current status:

- Current `sql.js` POC is fast but loads the full 206 MB SQLite file into JS/WASM memory.
- Browser JavaScript cannot reliably report iPhone PWA DRAM.
- This is not production-accepted until measured or replaced.

Next POC:

- Implement a `wa-sqlite`+OPFS dictionary engine behind the same lookup interface.
- Run the same exact, phrase, Chinese, fuzzy, and benchmark searches.
- Measure memory on iPhone using Safari Web Inspector Timelines or Xcode Instruments from a Mac if available.
- Keep the sharded dictionary package fallback ready if `wa-sqlite`+OPFS cannot meet the target.

Pass criteria:

- Search p95 stays under 1 second after dictionary open.
- Normal-use incremental memory is <= 50 MB where measurable.
- The dictionary does not require a persistent full-file JS/WASM allocation.
- Offline search still works after first setup.

## Priority 2: iPhone Offline Dictionary Persistence

Question: after the dictionary is loaded once online, can the iPhone Home Screen PWA load the dictionary and search while Wi-Fi and Cellular are off?

Current status:

- Original iPhone POC: shell starts offline, but dictionary load/search fails.
- Updated POC: online dictionary load stores `dictionary.sqlite` in IndexedDB and falls back to `source indexedDB offline copy` when network fetch fails.
- Windows fallback automation: passed with server stopped.
- Real iPhone: pending retest.

Manual iPhone steps:

1. Connect iPhone and Windows PC to the same Wi-Fi.
2. Start the HTTPS server on Windows:

```powershell
.\start-iphone-https.ps1
```

3. On iPhone Safari, open the HTTPS POC URL, for example:

```text
https://192.168.1.73:8443
```

4. Reload the page twice while online so Safari gets the latest service worker and JavaScript.
5. Open from the Home Screen icon.
6. Search `abandon`, or tap **Install/load dictionary** if that button is visible.
7. Confirm a dictionary result appears while online.
8. Search `abandon` and confirm a result.
9. Turn off Wi-Fi and Cellular.
10. Close and reopen the Home Screen PWA.
11. Search `take off`, or tap **Install/load dictionary** if that button is visible.
12. Confirm a dictionary result appears while Wi-Fi/cellular is still disabled.
13. Search `take off` and confirm a phrase result.

Record:

```text
iOS version:
Online search worked:
Offline search worked:
Offline load time:
Offline search term:
Offline search time:
Worked after app close/reopen:
Any Safari reload/crash:
```

More automated variant while online:

```text
https://192.168.1.73:8443/?q=take%20off&report=1
```

This opens the dictionary app, loads the dictionary, searches `take off`, and posts a JSON result back to Windows. It cannot toggle iPhone Wi-Fi, so the true offline part still needs the manual Wi-Fi/Cellular toggle.

## Priority 3: iPhone Automated Timed Suite

Question: what are the real iPhone p50/p95 numbers for dictionary load, persistence, and lookup?

Manual iPhone steps:

1. Make sure the Windows HTTPS server is running.
2. Open this autorun URL on iPhone Safari or the Home Screen PWA:

```text
https://192.168.1.73:8443/poc-suite.html?autorun=1
```

3. Wait for completion.
4. Confirm the status shows `Sent`.
5. On Windows, check:

```text
poc\iphone-pwa\received-results\
```

If the status does not show `Sent`, tap **Send results to Windows**.

On Windows, inspect received results:

```powershell
curl.exe -k https://127.0.0.1:8443/__poc_results
curl.exe -k https://127.0.0.1:8443/__poc_results/latest
```

Record:

```text
Dictionary fetch time:
SQLite open time:
Lookup median:
Lookup p95:
IndexedDB save/load result:
OPFS supported yes/no:
Storage estimate/quota:
Service worker status:
```

## Priority 4: iPhone Persistence After Restart

Question: does the offline dictionary copy survive normal Home Screen app close/reopen and iPhone restart?

Manual iPhone steps:

1. Complete Priority 1 successfully.
2. Close the Home Screen PWA.
3. Reopen it while still offline.
4. Load dictionary and search `abandon`.
5. Restart the iPhone.
6. Keep Wi-Fi and Cellular off.
7. Reopen the Home Screen PWA.
8. Load dictionary and search `take off`.

Pass criteria:

- Dictionary still loads from `source indexedDB offline copy`.
- Search still works.
- No re-download is required.

## Priority 5: App Version And Upgrade Menu

Question: can the iPhone Home Screen PWA show the current version and let the user choose when to apply an app-shell update?

Current status:

- The PWA menu now shows app version, user-data format version, dictionary engine, sync status, memory-target note, export state, and update controls.
- Real iPhone service-worker update activation still needs manual confirmation.

Manual iPhone steps:

1. Start the Windows HTTPS server.
2. Open the Home Screen PWA online.
3. Tap **Menu**.
4. Confirm the app version and data format version are visible.
5. Tap **Check update**.
6. If an update is ready, tap **Apply update**.
7. Reopen **Menu** and confirm the version changed.

Pass criteria:

- The user can see the installed app version.
- The user chooses whether to apply the update.
- The app reloads successfully after update activation.
- Dictionary and vocabulary data remain available after the update.

## Priority 6: Real Google Drive OAuth Sync

Question: can the PWA use Google OAuth to upload/download an encrypted user-data snapshot?

This cannot be fully automated without user account authorization. It should wait until OAuth client configuration exists.

Manual actions required later:

- Sign in with Google.
- Approve the requested Drive scope.
- Trigger upload of a small encrypted snapshot.
- Trigger download/restore of the same snapshot.
- Confirm sync status transitions: `pending`, `synced`, and `offline` when network is disabled.

## Deferred: Android

Do not spend POC time on Android now. Android should be validated after iPhone memory/dictionary-engine validation, iPhone offline dictionary, iPhone timed suite, iPhone persistence after restart, app update UX, and real Google Drive sync are stable.
