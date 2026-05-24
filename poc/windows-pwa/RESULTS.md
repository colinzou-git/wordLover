# Windows PWA POC Results

Date: 2026-05-24

Environment:

- Windows PC
- Local static server: Python `http.server`
- Browser surface: Codex in-app browser
- Dictionary package: current generated `data/dictionary.sqlite`
- SQLite runtime: vendored `sql.js` 1.13.0

## What This POC Tests

- Static PWA shell can load in a browser.
- Service worker can register.
- Current SQLite dictionary can be fetched and opened in the browser on Windows.
- Exact word and phrase lookup can run locally under the 1-second target after dictionary load.
- Valid search history can persist through IndexedDB after page reload.
- Export button creates a browser download flow for user data.

## Observed Results

| Check | Result |
| --- | --- |
| App shell visible | Pass |
| Service worker registration | Pass, UI showed `Offline shell registered` |
| Dictionary fetch/open | Pass |
| Dictionary rows | 770,611 |
| Dictionary bytes served | 197.0 MB |
| Dictionary fetch time | 661 ms |
| SQL.js init time | 33 ms |
| SQLite open time | 60 ms |
| `abandon` lookup | 3 ms |
| `take off` lookup | 8 ms |
| Invalid punctuation rejection | Pass, `hello, world` rejected |
| IndexedDB history persistence after reload | Pass |
| Export button | Implemented; Codex in-app browser cannot observe downloads directly |

## Issues Found And Fixed

### Service Worker Shell Cache Was Too Small

The first service worker version cached `/`, manifest, and icon only. It did not pre-cache `app.js`, `styles.css`, or SQL.js WASM assets, which would break offline shell execution.

Fix:

- Added `/app.js`
- Added `/styles.css`
- Added `/vendor/sql-wasm.js`
- Added `/vendor/sql-wasm.wasm`

## Feasibility Conclusion For Windows

The Windows browser POC is promising as an automation and stress-test fallback for the iPhone-first product path:

- The full current SQLite dictionary can be loaded in the browser.
- Once loaded, exact local lookups are far below the 1-second requirement.
- IndexedDB persistence for small user state works.
- PWA shell registration works.
- The updated offline dictionary fallback can load the dictionary from IndexedDB when the local server is stopped.

Follow-up iPhone validation:

- The next POC on a real iPhone 17 Pro was reported successful on 2026-05-24.
- The web app starts fast and loads the dictionary fast on iPhone.
- This reduces the biggest SQLite WASM feasibility risk.

The main remaining feasibility risks are now persistence and production hardening:

- `sql.js` loads the full database into memory; this worked in the POCs, but older phones still need timed validation.
- Production must persist the dictionary package in IndexedDB or OPFS, not rely on HTTP cache. The POC now validates IndexedDB fallback on Windows and needs the same iPhone retest.
- The production architecture should still evaluate `wa-sqlite` with OPFS VFS only after the iPhone IndexedDB path is measured, because iPhone is the primary target.
- Keep the sharded fallback described in `docs/architecture-design.md`, but do not activate it unless persistence, memory, or older-device performance fails.

## How To Run

```powershell
Copy-Item data\dictionary.sqlite poc\windows-pwa\public\dictionary.sqlite -Force
New-Item -ItemType Directory -Force poc\windows-pwa\public\vendor
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js -OutFile poc\windows-pwa\public\vendor\sql-wasm.js
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm -OutFile poc\windows-pwa\public\vendor\sql-wasm.wasm
cd poc\windows-pwa\public
python -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173
```
