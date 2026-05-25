# WordLover Full Product Gaps

Date: 2026-05-25

This file lists the remaining gaps between the current local-first web app and a full product.

## Install And Distribution

- Host WordLover from a stable HTTPS domain so iPhone install is one or two steps: open URL, then Add to Home Screen/open app.
- Replace the local Windows certificate workflow with a production TLS certificate.
- Add an install landing/check page that verifies Safari, storage, service worker, Web Crypto, OPFS, and dictionary package readiness before the user starts.
- Provide a production dictionary package download/import path that resumes safely and shows storage size before install.

## Dictionary Memory

- Replace the current full-buffer `sql.js` runtime for production dictionary search.
- Implement and benchmark a real `wa-sqlite` OPFS VFS engine or equivalent SQLite OPFS engine behind the dictionary repository interface.
- Validate that normal iPhone memory stays at or below 50 MB during dictionary install, open, lookup, background, and relaunch.
- Keep a sharded dictionary package fallback if OPFS SQLite cannot meet memory or persistence requirements.

## Google Account, Drive, And Gemini

- Create a Google Cloud OAuth client for the production HTTPS origin.
- Complete Google Drive app-data sync with encrypted snapshots, conflict handling, and restore-on-new-device flow.
- Confirm the exact Gemini OAuth/API path and quota model for a user-account-based no-additional-fee flow.
- Add graceful fallback text when Gemini is unavailable, over quota, blocked by consent, or offline.

## Product Data Safety

- Replace JSON export with encrypted tar export/import UI.
- Add checkpoints and rollback UI.
- Add redacted diagnostics bundle generation.
- Add delete-local-data and delete-cloud-data flows.
- Migrate user records from the current single IndexedDB key-value store to a typed repository with migrations.

## Learning Depth

- Replace the simple scheduler with `ts-fsrs` or equivalent FSRS implementation.
- Add typed meaning, cloze, and sentence-creation quiz modes.
- Add fast encoding mode with examples, cloze sentences, common phrases, and personal sentence input.
- Add difficult-word mode.

## Automation

- Add iPhone repeat-run instructions for app update activation, offline search, debug-speed review testing, and Google login.
- Add browser automation coverage for theme selection, Google-auth-not-configured state, Gemini error handling, debug data cleanup, and review due acceleration.
- Add a production build pipeline with Vite/TypeScript/Workbox so service-worker cache versions are generated instead of manually edited.

## UI Polish

- Replace prompt-based editing with proper forms.
- Add compact vocabulary detail view and archived-term filters.
- Add accessibility pass for Dynamic Type, screen reader labels, focus order, contrast, and touch target sizing.
- Add localization-ready copy for English and Chinese UI strings.
