# WordFan Youdao personal-use scope

Status: Active project scope

Effective date: 2026-07-14

This document defines the controlling scope for WordFan's Youdao integration. It supersedes older Youdao issue text and design notes where they treated commercial licensing, provider authorization, enterprise security review, or multi-user abuse controls as release blockers.

## Product scope

WordFan is a personal, non-commercial learning application operated by its owner for use on the owner's own devices.

The Youdao integration is designed for:

- one owner;
- personal vocabulary study;
- low request volume;
- the owner's own browser/PWA installations;
- the owner's own VPS and private Google Drive app-data backup;
- no paid public service;
- no resale of provider data;
- no bulk downloadable Youdao-derived dictionary distributed with WordFan.

## Project decisions

For this personal-use project:

- commercial Youdao licensing review is not an implementation blocker;
- separate provider authorization for local persistence, sync, backup, or personal export is not an implementation blocker;
- a formal legal/compliance gate is not required before enabling integrated lookup;
- either the official API or a small personal HTML parser/gateway may be used;
- parsed definitions may be staged, cached, saved in encrypted IndexedDB, synchronized through the owner's private backup, imported, and exported for the owner's personal use;
- Automatic lookup may be enabled and may be the default;
- Cloudflare Workers, commercial API credentials, contractual quota evidence, and written permission records are optional rather than required;
- enterprise-grade origin restrictions, public-service abuse prevention, billing ceilings, and formal security review are out of scope unless the app later becomes a shared or commercial service.

## Engineering safeguards that still apply

The following remain engineering requirements because they protect the owner's app and data rather than serving as external compliance gates:

- WordFan stays local-first; Youdao never blocks local definitions, study, FSRS, or offline startup.
- Local and user-authored definitions are never silently replaced.
- Saved Youdao definitions remain additive and source-attributed.
- Provider credentials, if any are introduced, must not be embedded in browser assets or committed to the repository.
- The gateway accepts one normalized term or short phrase per request; bulk crawling is not part of the feature.
- Save, refresh, remove, sync, import, export, and tombstone behavior must be deterministic and data-loss resistant.
- A failed lookup or unavailable gateway must leave the local WordFan experience usable.
- Basic timeouts, bounded payloads, and diagnostics are retained where they improve reliability.
- Existing explicit Off or Manual preferences should not be overwritten unintentionally.

## Personal two-layer persistence model

Every successfully normalized Youdao definition should be reusable through two persistent layers:

```text
WordFan PWA
    -> read encrypted local IndexedDB supplement
       -> hit: render immediately; no gateway request
       -> miss: request personal HTTPS gateway
             -> gateway reads persistent SQLite cache
                -> hit: return cached normalized entry; no Youdao request
                -> miss: fetch/parse Youdao, normalize, persist in SQLite, return
             -> PWA validates response, persists it in encrypted IndexedDB, renders it
```

Required behavior:

- gateway cache is global to the owner's WordFan devices and keyed by normalized term plus provider/schema identity;
- device cache is local to each browser profile and stored in the dedicated encrypted dictionary supplement store;
- a successful ordinary lookup automatically persists to the local device; a separate Save click is not required for cache reuse;
- subsequent views on that device use the local copy and make no network request;
- another device first reuses the gateway copy, then persists it locally;
- explicit Refresh bypasses both reusable copies, fetches a fresh upstream result, and atomically replaces the valid gateway and local records;
- Remove local copy removes only the device record/tombstone according to sync policy; it does not erase the shared gateway cache;
- local cache corruption or schema mismatch falls back to the gateway and repairs the local record after validation;
- gateway failure never removes or invalidates a usable local copy;
- ordinary cache persistence remains separate from the local WordFan primary definition and user-authored dictionary overlay.

## Scope-change rule

If WordFan later becomes public, multi-user, commercial, or broadly distributed, reopen the legal, provider-authorization, privacy, origin-control, rate-limit, and abuse-prevention decisions before that expanded release.