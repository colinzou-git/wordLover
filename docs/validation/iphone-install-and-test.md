# WordLover iPhone 17 Pro PWA validation

Current result: pass. On 2026-05-24, the real iPhone 17 Pro validation was reported to work well: the web app starts fast and loads the dictionary fast. See `RESULTS.md` for the recorded outcome and remaining measurements to capture later.

For exact timed results on iPhone, open `/automated-tests.html` from Safari or the Home Screen PWA and tap **Run automated tests**. The same suite used on Windows will record dictionary persistence, lookup timing, service worker cache readiness, export/import, and device diagnostics on the phone.

Offline update: the first iPhone offline test showed that the app shell starts without Wi-Fi, but dictionary load/search did not work because the original validation fetched the dictionary from the Windows server each time. The validation now saves the dictionary to IndexedDB after an online load and falls back to that offline copy when network fetch fails.

Memory update: the current local app does not prove the <= 50 MB iPhone DRAM target. It still uses `sql.js`, which loads the full 206 MB SQLite file into JS/WASM memory. The app now stores the dictionary package in OPFS when available before falling back to IndexedDB, but production must replace the query engine with `wa-sqlite`+OPFS or a sharded dictionary package and validate memory with Safari Web Inspector or Xcode Instruments before accepting the dictionary engine.

Product install target: the production iPhone install must not use the local certificate workflow. It should be one step where possible and at most two steps: open the trusted HTTPS WordLover URL, then Add to Home Screen/open the app. The certificate steps below are only for local Windows-hosted development.

This validation tests the real iPhone Safari/Home Screen PWA risks:

- HTTPS install path from a Windows PC.
- Service worker registration.
- Home Screen PWA launch.
- Browser storage availability and quota.
- IndexedDB persistence.
- Full SQLite dictionary load on iPhone.
- Local lookup latency after dictionary load.
- Offline shell behavior after setup.

There is no official iPhone simulator on Windows. Use the real iPhone 17 Pro for this test.

## What You Need

- Windows PC and iPhone 17 Pro on the same Wi-Fi network.
- The generated dictionary at `data\dictionary.sqlite`.
- Vendored SQL.js files in `apps\wordlover-pwa\public\vendor`.

If you already ran the Windows PWA validation, the dictionary and SQL.js files may already be prepared.

## 1. Prepare The Product Files

From the repo root in PowerShell:

```powershell
Copy-Item data\dictionary.sqlite apps\wordlover-pwa\public\dictionary.sqlite -Force
New-Item -ItemType Directory -Force apps\wordlover-pwa\public\vendor
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js -OutFile apps\wordlover-pwa\public\vendor\sql-wasm.js
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm -OutFile apps\wordlover-pwa\public\vendor\sql-wasm.wasm
```

## 2. Find Your Windows PC IP Address

Run:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object IPAddress,InterfaceAlias
```

Current observed IP during setup:

```text
192.168.1.73
```

If your IP changes, use the new IP in the commands below.

## 3. Create A Local HTTPS Certificate

iPhone Safari needs HTTPS for real service worker/PWA testing. Run:

```powershell
powershell -ExecutionPolicy Bypass -File apps\wordlover-pwa\scripts\create-local-ca-and-cert.ps1 -IpAddress 192.168.1.73
```

This creates:

```text
apps\wordlover-pwa\certs\wordlover-local-root-ca.cer
apps\wordlover-pwa\certs\wordlover-local-root-ca.pem
apps\wordlover-pwa\certs\server-cert.pem
apps\wordlover-pwa\certs\server-key.pem
```

The `.cer` file is the one to install on the iPhone. The `.pem` copy is only for debugging.

## 4. Send The Root CA Certificate To Your iPhone

Send this file to the iPhone:

```text
apps\wordlover-pwa\certs\wordlover-local-root-ca.cer
```

Easy options:

- Email it to yourself and open it on the iPhone.
- Upload it to iCloud Drive/Google Drive and open it on the iPhone.
- Use any file transfer method you trust.

On iPhone:

1. Open the `.cer` file.
2. Install the profile when prompted.
3. Go to **Settings > General > VPN & Device Management** and install the profile if needed.
4. Go to **Settings > General > About > Certificate Trust Settings**.
5. Enable full trust for **WordLover Local Root CA**.

This trust is only for your local validation certificate. Remove it after testing if you want.

## 5. Start The HTTPS Server On Windows

Recommended from the repo root:

```powershell
.\start-iphone-https.ps1
```

If you are currently in `apps\wordlover-pwa\public`, run:

```powershell
.\start-iphone-https.ps1
```

You can also run the Python server directly from the repo root:

```powershell
python apps\wordlover-pwa\scripts\serve-https.py --host 0.0.0.0 --port 8443
```

Do not run `python apps\wordlover-pwa\scripts\serve-https.py` from `apps\wordlover-pwa\public`; from that folder the relative path points to the wrong place.

If Windows Firewall asks, allow Python on your private Wi-Fi network.

Optional Windows smoke test before using the iPhone:

```powershell
curl.exe -k -I https://127.0.0.1:8443/
curl.exe -k -I https://127.0.0.1:8443/dictionary.sqlite
```

Expected:

- `/` returns `HTTP/1.0 200 OK`.
- `dictionary.sqlite` returns `HTTP/1.0 200 OK`.
- `dictionary.sqlite` content length is about `206606336` bytes.

## 6. Open On iPhone Safari

On the iPhone, open Safari, not Chrome or another browser, and visit:

```text
https://192.168.1.73:8443
```

Expected:

- No certificate error after the root CA is trusted.
- Page title: `WordLover`.
- PWA status eventually says `Offline shell registered`.
- Diagnostics show:
  - `Secure context: yes`
  - `IndexedDB: available`
  - `WebAssembly: available`

## 7. Add To Home Screen

In Safari:

1. Tap Share.
2. Tap **Add to Home Screen**.
3. Name it `WordLover`.
4. Open it from the Home Screen icon.

Expected:

- Diagnostics display mode should show `standalone` or `ios-standalone`.

## 7B. Install On Another iPhone

Use these steps for each additional personal iPhone while using the local Windows-hosted validation.

1. Put the Windows PC and the new iPhone on the same Wi-Fi network.
2. Confirm the Windows PC IP address. The examples below use `192.168.1.73`; replace it if your IP changed.
3. If the IP changed, recreate the local certificate:

```powershell
powershell -ExecutionPolicy Bypass -File apps\wordlover-pwa\scripts\create-local-ca-and-cert.ps1 -IpAddress 192.168.1.73
```

4. Send `apps\wordlover-pwa\certs\wordlover-local-root-ca.cer` to the new iPhone.
5. On the iPhone, open the `.cer` file and install the profile.
6. Go to **Settings > General > VPN & Device Management** and finish installing the profile if iOS asks.
7. Go to **Settings > General > About > Certificate Trust Settings** and enable full trust for **WordLover Local Root CA**.
8. Start the HTTPS server on Windows:

```powershell
.\start-iphone-https.ps1
```

9. On the iPhone, open Safari and visit:

```text
https://192.168.1.73:8443
```

10. Wait for the page to load without a certificate warning.
11. Tap Share, then **Add to Home Screen**.
12. Open WordLover from the Home Screen icon.
13. Keep the iPhone online and let the dictionary install/load once. The current local package is about `206606336` bytes.
14. Search `abandon` and `take off` while online.
15. Turn off Wi-Fi and cellular data.
16. Reopen the Home Screen app and search `take off` again.

Pass criteria:

- The app opens from the Home Screen.
- The local dictionary loads from `indexedDB offline copy` after first setup.
- Search works without Wi-Fi/cellular data.
- Vocabulary, quizzes, export, and local recovery are available offline after setup.
- Only Google Drive sync and AI provider calls require internet.

For a production hosted HTTPS site, the local certificate steps disappear. The user would open the production HTTPS URL in Safari, add it to the Home Screen, complete dictionary setup, and verify offline search.

## 7C. Google Login, Drive Sync, And Gemini

The current validation does not include real Google OAuth yet. The planned flow is:

1. First launch shows the local app shell.
2. The app prompts the user to **Sign in with Google** or **Skip for offline use**.
3. If the user signs in, the PWA uses browser-safe Google OAuth with PKCE.
4. The app requests the minimum Drive scope needed to store encrypted WordLover user data.
5. Local user data remains encrypted before sync.
6. Google Drive stores the encrypted snapshot, version metadata, checkpoints, and optional key-wrap file.
7. Gemini-powered examples and follow-up questions reuse the signed-in Google account when feasible.
8. If the user skips sign-in, dictionary search, vocabulary, quizzes, export, and local checkpoints still work offline. Sync and AI stay unavailable until sign-in.

Implementation note: real Google login requires a configured Google Cloud OAuth client and consent configuration. It cannot be fully automated or silently tested without that account setup.

## 7D. App Version And Upgrade Test

The current PWA includes a compact menu for version and update controls.

1. Open the Home Screen PWA.
2. Tap **Menu**.
3. Confirm the menu shows:
   - app version
   - user-data format version
   - dictionary engine
   - sync status
   - memory-target note
4. Tap **Check update**.
5. If the app says an update is ready, tap **Apply update**.
6. The app reloads into the new service-worker version.
7. Open **Menu** again and confirm the version changed.

If the iPhone keeps an old cached shell:

1. Close the Home Screen app.
2. Open the cache-busting URL in Safari while online:

```text
https://192.168.1.73:8443/?fresh=v30
```

3. Tap **Menu > Check update > Apply update**.
4. Reopen the Home Screen app.
5. If the Home Screen icon still shows the old version, delete only the Home Screen icon and add it again from the cache-busting Safari page. This does not delete the local browser data unless Safari website data is cleared.

Dictionary data updates are separate from app-shell updates. A future dictionary update must download or import the new dictionary alongside the current package, validate it, and switch only after validation succeeds.

## 7A. Run The Automated iPhone Suite

Open this URL on the iPhone while the Windows HTTPS server is running:

```text
https://192.168.1.73:8443/automated-tests.html?autorun=1
```

Expected:

- The suite starts automatically.
- It runs dictionary load, persistence, lookup timing, service worker, export/import, and diagnostics checks.
- When complete, it sends a JSON result back to Windows.

On Windows, received iPhone/browser reports are saved here:

```text
apps\wordlover-pwa\received-results\
```

This folder is ignored by git because it contains generated local test results.

To inspect received results from Windows:

```powershell
curl.exe -k https://127.0.0.1:8443/__test_results
curl.exe -k https://127.0.0.1:8443/__test_results/latest
```

For a smaller automated dictionary search smoke test, open:

```text
https://192.168.1.73:8443/?q=take%20off&report=1
```

This loads the dictionary, searches `take off`, and sends a JSON result back to Windows.

## 8. Load The Dictionary

In the validation app:

1. Search `abandon`, or tap **Install/load dictionary** if that button is visible.
2. Wait for the local dictionary to open. The current compact UI may hide developer metrics, so use the automated suite for exact timing.
3. In `/automated-tests.html`, record:
   - row count
   - size
   - fetch time
   - SQL init time
   - open time

Pass criteria:

- The page does not crash or reload.
- Dictionary row count shows `770,611`.
- Dictionary load completes.

If the app crashes, Safari reloads, or iOS kills the page, record that as a SQLite/WASM feasibility failure.

## 9. Run Lookup Tests

Search each term:

```text
abandon
take off
in terms of
hello, world
```

Expected:

- `abandon` returns a word result.
- `take off` returns a phrase result.
- `in terms of` returns a phrase result, even if English definition is missing.
- `hello, world` is rejected as invalid input.
- Valid lookup times should be under 1 second after dictionary load.

## 10. Test History Persistence

1. Search `abandon`.
2. Search `take off`.
3. Refresh the page or close and reopen the Home Screen app.
4. Check **Recent valid searches**.

Expected:

- `abandon` and `take off` remain listed.

## 11. Test Offline Shell

After the page has loaded at least once:

1. Keep the HTTPS server running.
2. Open the Home Screen PWA once.
3. Turn off Wi-Fi and Cellular on the iPhone.
4. Reopen the Home Screen PWA.

Expected:

- App shell opens.
- This only proves the shell is cached.
- In the original validation, dictionary load/search failed offline. That is a known finding.

## 12. Test Offline Dictionary Load And Search

Use this test after updating to the latest validation files.

1. Turn Wi-Fi and Cellular back on.
2. Open the validation from the Home Screen while the Windows HTTPS server is running.
3. Reload the page once while online so Safari picks up the latest service worker and JavaScript.
4. Search `abandon`, or tap **Install/load dictionary** if that button is visible.
5. Confirm the search result appears while online.
6. Search `abandon`.
7. Confirm a result appears.
8. Turn off Wi-Fi and Cellular on the iPhone.
9. Close the Home Screen PWA.
10. Reopen the Home Screen PWA.
11. Search `take off`, or tap **Install/load dictionary** if that button is visible.
12. Confirm the dictionary opens from the local offline copy by seeing a search result with Wi-Fi/cellular still disabled.
13. Search `take off`.
14. Confirm a phrase result appears.

Pass criteria:

- The app shell opens without Wi-Fi.
- Dictionary load completes without Wi-Fi.
- Search works while Wi-Fi/cellular is off, proving the local offline dictionary copy is usable.
- Searching `take off` returns a phrase result without Wi-Fi.

If dictionary load/search still fails offline:

- Reconnect Wi-Fi.
- Open the validation.
- Reload the page twice while online.
- Search `abandon` again and wait for completion.
- Disconnect Wi-Fi and repeat the offline test.

## 13. Record Results

Create notes with:

```text
iPhone model:
iOS version:
URL used:
Secure context yes/no:
Display mode:
Storage estimate:
Service worker status:
Dictionary load completed yes/no:
Dictionary fetch time:
SQL init time:
SQLite open time:
abandon lookup time:
take off lookup time:
in terms of lookup time:
History persisted after reload yes/no:
Offline shell opened yes/no:
Offline dictionary source:
Offline search worked yes/no:
Any crash/reload/OOM:
```

## Troubleshooting

If Safari says the site is not trusted:

- Confirm the `.cer` profile is installed under **Settings > General > VPN & Device Management**.
- Confirm full trust is enabled under **Settings > General > About > Certificate Trust Settings**.
- Confirm the IP in the URL exactly matches the IP used in `create-local-ca-and-cert.ps1`.

If Safari cannot open the page:

- Confirm the Windows HTTPS server is still running.
- Confirm Windows and iPhone are on the same Wi-Fi network.
- Allow Python through Windows Firewall for private networks.
- Try the Windows smoke test commands above.

If dictionary load is slow or fails:

- Keep the iPhone screen awake during the first load.
- Make sure Low Power Mode is off for the test.
- Record whether Safari reloads, shows an error, or silently returns to the start screen.

To stop the HTTPS server on Windows, press `Ctrl+C` in the PowerShell window running it.

## How To Remove The Test Certificate Later

On iPhone:

1. Go to **Settings > General > VPN & Device Management**.
2. Remove the WordLover local profile.
3. Go to **Settings > General > About > Certificate Trust Settings** and confirm it is gone.

## What This validation Does Not Prove Yet

This validation does not yet prove durable local dictionary persistence on iPhone. It fetches and opens the SQLite file. Production still needs either:

- SQLite WASM with OPFS/IndexedDB persistence that survives app restarts, or
- the sharded dictionary fallback.

If full SQLite load fails on iPhone, move directly to the sharded dictionary fallback validation.
