# WordLover Phase 0 Automated POC Suite

This suite automates the Phase 0 feasibility checks that can run from a browser without private account access or physical mobile-device control. Its main purpose is to support the iPhone-first effort: run as much as possible directly on iPhone Safari/Home Screen, and use Windows when a test needs automation, repeatability, or stress-test coverage that is difficult on iPhone.

Run from the repo root:

```powershell
cd poc\windows-pwa\public
python -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/poc-suite.html
```

Click **Run all automated POCs**.

## Automated Checks

- SQLite WASM dictionary load and lookup benchmark.
- Dictionary package persistence to IndexedDB.
- Dictionary package persistence to OPFS when the browser supports it.
- Service worker shell cache readiness.
- Encrypted tar export/import round trip with Web Crypto.
- Mock Google Drive-style encrypted full-snapshot sync.
- Device capability reporting for Windows and iPhone/iPad. Android fields may appear in raw diagnostics, but Android validation is deferred until the end.

## Not Fully Silent By Design

Some POCs require user/device authorization and cannot be completed silently:

- Real Google Drive sync requires Google OAuth sign-in and explicit user authorization.
- Real iPhone/iPad timed validation must be run on Safari/Home Screen PWA.
- Android validation is intentionally deferred and should not block iPhone/Windows decisions.

The same suite page can be opened on iPhone Safari to collect mobile results automatically after the user opens the page and taps the run button. Windows is the fallback surface for automation and stress tests.

## Current Result File

The latest Windows automated result is saved at:

```text
poc\phase0-automation\windows-browser-results-2026-05-24.json
```

The human-readable summary is in:

```text
poc\phase0-automation\RESULTS.md
```

The Windows fallback result for offline dictionary load/search is saved at:

```text
poc\phase0-automation\offline-dictionary-fallback-windows-2026-05-24.json
```
