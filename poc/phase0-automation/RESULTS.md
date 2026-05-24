# Phase 0 Automated POC Results

Date: 2026-05-24

Environment:

- Windows PC
- Browser surface: Codex in-app browser, Chromium/Electron
- URL: `http://127.0.0.1:4173/poc-suite.html`
- Dictionary package: current generated `dictionary.sqlite`
- SQLite runtime: vendored `sql.js` 1.13.0
- Result JSON: `poc/phase0-automation/windows-browser-results-2026-05-24.json`

## Summary

| POC | Result | Notes |
| --- | --- | --- |
| Durable dictionary persistence - IndexedDB | Pass | Stored and restored the 197.0 MB dictionary package, reopened SQLite, verified 770,611 rows, and looked up `abandon`. |
| Durable dictionary persistence - OPFS | Pass | Browser supported OPFS. Stored and restored 197.0 MB with matching sample checksum. |
| Offline launch | Pass on Windows shell | Service worker shell cache had all required assets. The HTTP server was stopped and the POC suite page still reloaded from the cached shell. |
| Export/import + encryption recovery | Pass | Created an encrypted tar-style archive, parsed it, decrypted it with the recovery passphrase, and verified round-trip user data. |
| Google Drive sync | Mock pass, real OAuth not run | Mock encrypted full-snapshot sync moved through `pending` to `synced`. Real Google OAuth/upload requires user account authorization. |
| Android PWA | Deferred | Android work is lowest priority and intentionally deferred until iPhone and Windows are stable. |
| Timed benchmark | Pass | 100 local lookups across 5 terms had p95 below 1 second. |
| Offline persisted dictionary fallback | Pass on Windows fallback | After the main POC stored the dictionary in IndexedDB, the server was stopped, the shell reloaded, the dictionary opened from `indexedDB offline copy`, and phrase search worked. |
| iPhone-friendly dictionary UI smoke | Pass on Windows fallback | Search-first UI, dictionary status cards, versioned assets, URL search smoke, and local lookup were verified through browser automation. |

## Key Metrics

| Metric | Value |
| --- | --- |
| Dictionary bytes | 206,606,336 |
| Dictionary rows | 770,611 |
| Dictionary fetch time | 1006.5 ms |
| SQL.js init time | 31.9 ms |
| SQLite open time | 77.8 ms |
| Lookup count | 100 |
| Lookup median | 0.2 ms |
| Lookup p95 | 0.5 ms |
| Lookup max | 7.5 ms |
| IndexedDB save | 999.6 ms |
| IndexedDB load | 601.5 ms |
| OPFS save | 757.3 ms |
| OPFS load | 321.5 ms |
| Encrypted export archive | 3,072 bytes |

## Terms Benchmarked

- `abandon`
- `take off`
- `in terms of`
- `abundant`
- `accurate`

All benchmark terms were found in the local dictionary.

## Production Implications

The SQLite WASM-first direction is still supported. IndexedDB and OPFS both look feasible for storing the dictionary package on this Windows browser. OPFS was faster in this run, but iPhone Safari should still be measured before locking the production persistence layer. Android measurement is deferred until the end.

The first implementation slice should stay focused on the iPhone dictionary path: fast visible search UI, explicit dictionary install/load state, offline dictionary fallback, and reliable service-worker asset updates.

The sharded dictionary fallback should remain a contingency, not the default path.

## Remaining Manual Or Account-Gated Checks

- Run the updated offline dictionary test on iPhone Safari/Home Screen PWA to confirm dictionary load/search works after Wi-Fi is disconnected.
- Run this same suite page on iPhone Safari/Home Screen PWA to capture exact p50/p95 and persistence numbers from the iPhone 17 Pro.
- Run a real Google Drive OAuth upload/download POC after OAuth client configuration exists.
