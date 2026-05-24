# WordLover Phase 0 Automated POC Suite

This suite automates the Phase 0 feasibility checks that can run from a browser without private account access or physical mobile-device control.

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
- Device capability reporting for Windows, iPhone/iPad, and Android.

## Not Fully Silent By Design

Some POCs require user/device authorization and cannot be completed silently:

- Real Google Drive sync requires Google OAuth sign-in and explicit user authorization.
- Real Android PWA validation requires an Android phone or emulator with browser access.
- Real iPhone/iPad timed validation must be run on Safari/Home Screen PWA.

The same suite page can be opened on Android Chrome and iPhone Safari to collect mobile results automatically after the user opens the page and taps the run button.

## Current Result File

The latest Windows automated result is saved at:

```text
poc\phase0-automation\windows-browser-results-2026-05-24.json
```

The human-readable summary is in:

```text
poc\phase0-automation\RESULTS.md
```
