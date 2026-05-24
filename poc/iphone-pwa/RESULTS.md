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

Additional iPhone offline finding: when Wi-Fi is disconnected, the installed app shell can start, but the original POC cannot load the dictionary or search words. This means app-shell offline caching works, but dictionary offline persistence was missing from the original POC.

Follow-up implementation: the POC has been updated so a successful online dictionary load saves `dictionary.sqlite` into IndexedDB. If network fetch fails later, the POC falls back to the saved IndexedDB dictionary. This fallback passed on Windows automation with the local server stopped.

Automated iPhone reports were received on 2026-05-24:

- iPhone user agent: iPhone, iPhone OS 18.7, Safari/WebKit.
- Service worker: registered and controlling `https://192.168.1.73:8443/`.
- Offline shell cache readiness: pass.
- IndexedDB dictionary persistence: pass.
- OPFS dictionary persistence: pass.
- Encrypted export/import POC: pass.
- Mock cloud sync POC: pass.
- Lookup benchmark: 100 local lookups, p95 about `0.04 ms` after the dictionary is open.
- Dictionary network fetch on iPhone: about `7.5-7.8 seconds` for the current `206,606,336` byte SQLite file.
- Dictionary open on iPhone after fetch: about `15 ms`.
- URL search smoke for `take off`: pass, including phrase match and Chinese meanings.

Additional iPhone Home Screen PWA reports after the v13 service-worker update:

- Two full suite runs passed all current verdicts.
- Display mode: `standalone`.
- Persistent storage: granted before and after request.
- Shell cache: `wordlover-poc-shell-v13`.
- Dictionary fetch: about `7.31 s` in both suite runs.
- SQLite init/open: about `8-10 ms` init and `14-17 ms` open.
- Lookup benchmark: 100 lookups, p95 about `0.28 ms`, max under `0.8 ms`.
- IndexedDB restore: about `94-138 ms`.
- OPFS restore: about `277-297 ms`.
- URL search smoke for `take off`: pass; fetch about `8.1-8.9 s`, lookup about `0.3-1.0 ms`.

## Result Summary

| Check | Result |
| --- | --- |
| Local HTTPS setup from Windows | Pass |
| iPhone opens PWA over trusted HTTPS | Pass |
| App shell startup | Pass, user reported fast |
| Full dictionary load | Pass, user reported fast |
| App shell starts without Wi-Fi | Pass, user reported shell starts |
| Offline dictionary load/search in original POC | Fail, dictionary was not persisted locally |
| Offline dictionary load/search after IndexedDB fallback update | IndexedDB persistence passed on iPhone suite; true Wi-Fi-off search still needs manual final confirmation |
| SQLite WASM memory behavior | Pass for this device and current POC scope |
| No-fee iPhone personal-use path | Pass for PWA install approach |
| OPFS availability | Pass on iPhone report |
| URL-driven dictionary search smoke | Pass for `take off` |
| First-time full dictionary download | Needs improvement; current network fetch was about 7.5-7.8 seconds |
| v13 Home Screen suite repeatability | Pass; two standalone runs had matching pass verdicts and p95 lookup about 0.28 ms |

## Measurements Still To Capture

The user-reported result is enough for feasibility direction, but a later timed validation should capture:

- iOS version.
- Safari/Home Screen display mode.
- Storage estimate and quota.
- Service worker status.
- Older-device memory behavior with the full dictionary package.
- Whether search history survives app close/reopen.
- Whether the updated IndexedDB offline dictionary fallback works after Wi-Fi is disconnected.
- Whether the installed Home Screen shell and dictionary lookup work offline after app close/reopen.

## Feasibility Conclusion For iPhone

The iPhone 17 Pro result supports continuing with the PWA-first architecture and SQLite WASM dictionary approach.

Do not activate the sharded dictionary fallback now. Keep it as a contingency only if later timed tests show unacceptable memory, persistence, or latency on older supported phones.

The next production-storage POC should compare the current `sql.js` full-buffer approach with `wa-sqlite` on OPFS. The current app works, but first-time download size and full-buffer memory use are still the largest risks for older iPhones.

## Remaining iPhone-Specific Risks

- Durable dictionary persistence on iPhone still needs validation. The POC now supports IndexedDB fallback, but it must be verified on the real iPhone after Wi-Fi is disconnected and after app close/reopen.
- iOS storage eviction cannot be fully prevented. The product still needs sync, export/import, and recovery guidance.
- Older iPhones may have tighter memory or storage behavior than the iPhone 17 Pro.
- Offline dictionary load and search should be tested after Home Screen installation with Wi-Fi disconnected.
