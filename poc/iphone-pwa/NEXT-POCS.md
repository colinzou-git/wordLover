# Next iPhone-First POCs

Android work is deferred until the end. For now, POCs should focus on iPhone. Windows is used only as the automation and stress-test fallback when a test cannot be fully automated on iPhone.

## Priority 1: iPhone Offline Dictionary Persistence

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
6. Tap **Load local SQLite dictionary**.
7. Confirm the Dictionary row shows `source network`.
8. Search `abandon` and confirm a result.
9. Turn off Wi-Fi and Cellular.
10. Close and reopen the Home Screen PWA.
11. Tap **Load local SQLite dictionary**.
12. Confirm the Dictionary row shows `source indexedDB offline copy`.
13. Search `take off` and confirm a phrase result.

Record:

```text
iOS version:
Online source shown:
Offline source shown:
Offline load time:
Offline search term:
Offline search time:
Worked after app close/reopen:
Any Safari reload/crash:
```

## Priority 2: iPhone Automated Timed Suite

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

## Priority 3: iPhone Persistence After Restart

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

## Priority 4: Real Google Drive OAuth Sync

Question: can the PWA use Google OAuth to upload/download an encrypted user-data snapshot?

This cannot be fully automated without user account authorization. It should wait until OAuth client configuration exists.

Manual actions required later:

- Sign in with Google.
- Approve the requested Drive scope.
- Trigger upload of a small encrypted snapshot.
- Trigger download/restore of the same snapshot.
- Confirm sync status transitions: `pending`, `synced`, and `offline` when network is disabled.

## Deferred: Android

Do not spend POC time on Android now. Android should be validated after iPhone offline dictionary, iPhone timed suite, iPhone persistence after restart, and real Google Drive sync are stable.
