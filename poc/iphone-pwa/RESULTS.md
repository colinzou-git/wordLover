# iPhone 17 Pro PWA POC Results

Date: 2026-05-24

Environment:

- Real iPhone 17 Pro
- Browser surface: Safari / Home Screen PWA path
- Server: Windows PC HTTPS server on local Wi-Fi
- Dictionary package: current generated `data/dictionary.sqlite`
- SQLite runtime: vendored `sql.js` 1.13.0
- Dictionary bytes served by Windows smoke test: `206,606,336`

## What This POC Tests

- No-fee iPhone install path through Safari Add to Home Screen.
- Local HTTPS serving from Windows to iPhone for realistic PWA/service-worker behavior.
- Real iPhone startup behavior for the PWA shell.
- Full SQLite dictionary load behavior on iPhone Safari.
- Basic feasibility of the SQLite WASM dictionary approach on iPhone.

## Reported Result

The real-device POC works well. The web app starts fast and loads the dictionary fast on the iPhone 17 Pro.

This validates the largest Phase 0 concern enough to continue with a PWA-first + SQLite WASM-first implementation path.

## Result Summary

| Check | Result |
| --- | --- |
| Local HTTPS setup from Windows | Pass |
| iPhone opens PWA over trusted HTTPS | Pass |
| App shell startup | Pass, user reported fast |
| Full dictionary load | Pass, user reported fast |
| SQLite WASM memory behavior | Pass for this device and current POC scope |
| No-fee iPhone personal-use path | Pass for PWA install approach |

## Measurements Still To Capture

The user-reported result is enough for feasibility direction, but a later timed validation should capture:

- iOS version.
- Safari/Home Screen display mode.
- Storage estimate and quota.
- Service worker status.
- Exact dictionary fetch time.
- Exact SQL.js init time.
- Exact SQLite open time.
- Exact lookup times for `abandon`, `take off`, and `in terms of`.
- Whether search history survives app close/reopen.
- Whether the installed Home Screen shell opens offline.

## Feasibility Conclusion For iPhone

The iPhone 17 Pro result supports continuing with the PWA-first architecture and SQLite WASM dictionary approach.

Do not activate the sharded dictionary fallback now. Keep it as a contingency only if later timed tests show unacceptable memory, persistence, or latency on older supported phones.

## Remaining iPhone-Specific Risks

- Durable dictionary persistence still needs validation. This POC fetched and opened the SQLite file, but production must store the dictionary package in IndexedDB or OPFS and survive app restarts.
- iOS storage eviction cannot be fully prevented. The product still needs sync, export/import, and recovery guidance.
- Older iPhones may have tighter memory or storage behavior than the iPhone 17 Pro.
- Offline launch should be tested after Home Screen installation with the local server disconnected.
