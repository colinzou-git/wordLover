# WordLover iPhone 17 Pro PWA POC

This POC tests the real iPhone Safari/Home Screen PWA risks:

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
- Vendored SQL.js files in `poc\windows-pwa\public\vendor`.

If you already ran the Windows PWA POC, the dictionary and SQL.js files may already be prepared.

## 1. Prepare The POC Files

From the repo root in PowerShell:

```powershell
Copy-Item data\dictionary.sqlite poc\windows-pwa\public\dictionary.sqlite -Force
New-Item -ItemType Directory -Force poc\windows-pwa\public\vendor
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js -OutFile poc\windows-pwa\public\vendor\sql-wasm.js
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm -OutFile poc\windows-pwa\public\vendor\sql-wasm.wasm
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
powershell -ExecutionPolicy Bypass -File poc\iphone-pwa\create-local-ca-and-cert.ps1 -IpAddress 192.168.1.73
```

This creates:

```text
poc\iphone-pwa\certs\wordlover-local-root-ca.cer
poc\iphone-pwa\certs\wordlover-local-root-ca.pem
poc\iphone-pwa\certs\server-cert.pem
poc\iphone-pwa\certs\server-key.pem
```

The `.cer` file is the one to install on the iPhone. The `.pem` copy is only for debugging.

## 4. Send The Root CA Certificate To Your iPhone

Send this file to the iPhone:

```text
poc\iphone-pwa\certs\wordlover-local-root-ca.cer
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
5. Enable full trust for **WordLover Local POC Root CA**.

This trust is only for your local POC certificate. Remove it after testing if you want.

## 5. Start The HTTPS Server On Windows

From the repo root:

```powershell
python poc\iphone-pwa\serve-https.py --host 0.0.0.0 --port 8443
```

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
- Page title: `WordLover local dictionary POC`.
- PWA status eventually says `Offline shell registered`.
- Diagnostics show:
  - `Secure context: yes`
  - `IndexedDB: available`
  - `WebAssembly: available`

## 7. Add To Home Screen

In Safari:

1. Tap Share.
2. Tap **Add to Home Screen**.
3. Name it `WordLover POC`.
4. Open it from the Home Screen icon.

Expected:

- Diagnostics display mode should show `standalone` or `ios-standalone`.

## 8. Load The Dictionary

In the POC app:

1. Tap **Load local SQLite dictionary**.
2. Wait for completion.
3. Record the metrics shown in the Dictionary row:
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
- Search may require dictionary to already be loaded in memory for this POC.
- This POC mainly verifies shell offline behavior; production still needs persistent dictionary package work.

## 12. Record Results

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

## What This POC Does Not Prove Yet

This POC does not yet prove durable local dictionary persistence on iPhone. It fetches and opens the SQLite file. Production still needs either:

- SQLite WASM with OPFS/IndexedDB persistence that survives app restarts, or
- the sharded dictionary fallback.

If full SQLite load fails on iPhone, move directly to the sharded dictionary fallback POC.
