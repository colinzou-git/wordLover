# ADR: Youdao integrated lookup boundary

Status: Active for the personal-use WordFan deployment

Decision date: 2026-07-14

Scope authority: [`youdao-personal-use-scope.md`](./youdao-personal-use-scope.md)

Two-layer persistence design: [`youdao-two-layer-cache-design.md`](./youdao-two-layer-cache-design.md)

## Scope change

WordFan is a personal, non-commercial learning application used by its owner on the owner's own devices. Earlier versions of this ADR treated commercial licensing, separate provider authorization, contractual caching rights, enterprise security review, and multi-user abuse controls as release blockers. Those blockers are superseded for the current personal-use project by `youdao-personal-use-scope.md`.

If WordFan later becomes a public, multi-user, commercial, or broadly distributed service, the earlier legal, authorization, privacy, rate-control, and redistribution questions must be reopened before that expanded release.

## Decision

WordFan may use a small owner-operated HTTPS gateway to retrieve one normalized English word or short phrase at a time from Youdao, normalize the result to WordFan's versioned provider schema, and return JSON to the PWA.

The current acceptable implementation is the personal VPS service under:

```text
apps/youdao-vps/
```

The implementation may use either:

- the official Youdao API when credentials are available; or
- the current low-volume mobile-page parser maintained for this personal deployment.

The external full-entry Youdao link remains available as a fallback.

## Data flow

```text
WordFan PWA
    -> encrypted local IndexedDB supplement lookup
       -> hit: render locally, no gateway request
       -> miss: personal HTTPS VPS gateway
             -> persistent SQLite lookup
                -> hit: return cached normalized entry
                -> miss: retrieve Youdao entry, parse, normalize, persist SQLite
             -> PWA validates exact term/schema
             -> PWA persists encrypted local supplement
             -> render saved/offline-ready entry
```

This two-layer persistence is required by `youdao-two-layer-cache-design.md` and tracked by issue #104.

## Product behavior

- Local WordFan definitions render first and remain primary.
- Youdao never blocks local lookup, study, FSRS, navigation, or offline startup.
- Off, Manual, and Automatic modes are supported.
- A successful integrated lookup is automatically persisted on the current device after validation.
- A valid local supplement suppresses routine gateway lookup.
- The gateway SQLite cache suppresses routine repeat retrieval from Youdao across the owner's devices.
- Explicit Refresh updates both layers only after a successful validated response.
- Failed Refresh keeps the previous valid copies.
- Removing a local copy does not delete the gateway copy; a later lookup may rehydrate the device.
- Provider data remains additive and never silently replaces ECDICT/Kaikki or user-authored definitions.
- `Source: Youdao` remains visible in normal display, offline use, study reveal, sync, import, and export.

## Persistence, sync, backup, and export

For this personal-use project, normalized Youdao definitions may be:

- stored in the gateway SQLite cache;
- stored in encrypted IndexedDB;
- used offline;
- synchronized through the owner's private Google Drive app-data backup;
- included in user-data backup/import;
- included in a personal enhanced-dictionary export.

Transient failures, stale responses, aborted requests, malformed entries, and no-result responses must not be persisted.

Saved supplements remain separate from the shipped ECDICT/Kaikki package and are not automatically published to `gh-pages` as a shared dictionary artifact.

## Minimal engineering safeguards

These safeguards protect the owner's app and data and therefore remain required:

- one normalized term or short phrase per request;
- bounded upstream and total timeouts;
- versioned normalized success and error contracts;
- exact requested-term validation before local persistence;
- no provider credentials in browser assets or repository files;
- deterministic save, refresh, remove, tombstone, sync, and import behavior;
- atomic replacement so a failed refresh cannot destroy a valid cached copy;
- bounded payload validation;
- local-first failure handling;
- test coverage that does not require the live provider for normal CI.

Enterprise-grade multi-tenant controls, formal compliance sign-off, contractual cost ceilings, and public-service abuse prevention are optional for the current single-owner deployment, not release gates.

## Gateway cache policy

- Cache identity uses provider, normalized term, and entry schema identity.
- Valid gateway records do not expire automatically.
- Ordinary requests read SQLite first.
- Explicit Refresh bypasses the reusable row and atomically replaces it after validation.
- Invalid cache rows are quarantined or removed and repaired through a fresh retrieval.
- Concurrent access must not corrupt SQLite.
- Gateway cache deletion is an owner administrative action, not ordinary client UI.

## Local cache policy

- The dedicated plaintext dictionary supplement store is the device source of truth for cached Youdao entries; vocabulary and learning data remain encrypted separately.
- Every successful validated integrated result is automatically upserted locally.
- A valid local hit makes zero gateway requests.
- Local persistence is idempotent per provider and normalized term.
- Local corruption falls back to the gateway and repairs the device copy after validation.
- A local write failure may still display a transient valid result but must show a retryable save error.

## Rejected designs

- Direct browser retrieval that depends on cross-origin access unsupported by production browsers.
- Storing a provider secret in the PWA.
- Replacing the local WordFan definition with Youdao content.
- Making study questions wait for a live network result.
- Bulk crawling or bundling a complete Youdao-derived dictionary into the shipped app.
- Background periodic refresh of cached entries.

## Implementation order

1. Keep and validate the gateway normalized-entry boundary.
2. Implement issue #104 automatic two-layer persistence.
3. Make gateway SQLite migration, validation, concurrency, and refresh atomicity reliable.
4. Unify local cache invalidation across lookup, refresh, remove, sync, import, and restore.
5. Complete browser/PWA/offline/restart tests.
6. Preserve the external full-entry link as fallback.

## Operational fallback

If the gateway is unavailable, WordFan continues using local definitions and any existing local supplements. The external Youdao link remains available where applicable. Gateway or parser failure must never remove local learning data or existing cached definitions.
