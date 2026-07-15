# Youdao automatic display and two-layer cache design

Status: Required implementation specification

Scope: Personal-use WordFan deployment

Primary tracking issue: #107

Completed persistence foundation: #104

## 1. Final product decision

WordFan must not require a per-word Youdao lookup or save action.

The complete feature is controlled by one global Settings toggle:

```text
Youdao definitions
[ On ] Automatically show Youdao definitions
```

Default: On.

When enabled, WordFan automatically shows a Youdao definition below the local WordFan definition. When disabled, WordFan performs no integrated Youdao lookup and renders no Youdao section. Existing local and gateway cache records remain stored.

The old Off/Manual/Automatic selector and normal per-word Check/Add buttons are obsolete.

## 2. Required runtime flow

```text
render local WordFan definition immediately
        |
        v
read global autoShowYoudaoDefinitions preference
        |
        +-- false --> render no Youdao section; make no request
        |
        v
read device-local Youdao supplement from IndexedDB
        |
        +-- valid hit --> render immediately; zero gateway calls
        |
        +-- miss/corrupt --> if offline, show compact offline state
                            |
                            v
                       request WordFan gateway
                            |
                            v
                    read gateway SQLite cache
                            |
                 +----------+----------+
                 |                     |
                hit                   miss
                 |                     |
                 |               retrieve Youdao
                 |                     |
                 |               parse + validate
                 |                     |
                 |               persist SQLite
                 +----------+----------+
                            |
                            v
                 return normalized entry
                            |
                            v
               validate exact requested term
                            |
                            v
            upsert plaintext IndexedDB supplement
                            |
                            v
                  render Youdao definition
```

## 3. User-visible states

| State | UI |
|---|---|
| Disabled | No Youdao section |
| Local cache hit | Definition and `Source: Youdao` |
| Gateway lookup running | Compact `Checking Youdao…` |
| Success | Definition and optional full-entry link |
| Offline local miss | Compact non-blocking offline message |
| Gateway failure | Compact error; optional failure-only Retry |
| Local save failure | Show transient definition plus compact save warning |

Normal views must not show:

- Check Youdao Online;
- Add as additional definition;
- routine Retry Youdao;
- Manual lookup mode.

`Open full entry on Youdao` may remain as a secondary fallback link.

## 4. Preference model

Add one canonical preference:

```js
autoShowYoudaoDefinitions: boolean
```

Default:

```js
true
```

Migration:

```text
legacy automatic -> true
legacy manual    -> true
legacy off       -> false
missing          -> true
```

Rules:

- persisted boolean overrides the legacy enum;
- runtime code reads only the boolean after normalization;
- legacy `onlineDictionaryMode` may remain temporarily only for old backup/import compatibility;
- explicit legacy Off must never be silently changed to On.

## 5. Context and answer-reveal rules

Automatic Youdao display is allowed only where a definition is already allowed:

- main dictionary result;
- vocabulary detail;
- review after answer/definition reveal;
- Study One More after reveal;
- spelling meaning/reveal surfaces after the answer is permitted.

It must never reveal a quiz, review, Study One More, or spelling answer before the existing local-definition reveal point.

## 6. Device-local persistence

### 6.1 Storage decision

Youdao supplements are stored as plaintext records in the dedicated `dictionarySupplements` IndexedDB object store. Encryption is not required for this personal-use feature.

Existing encryption for vocabulary, learning history, and other WordFan data remains unchanged and is out of scope.

### 6.2 Record shape

```js
{
  recordSchemaVersion: 1,
  id: `youdao:${normalizedTerm}`,
  providerId: "youdao",
  normalizedTerm,
  entry,
  savedAt,
  updatedAt,
  sourceRetrievedAt,
  deleted: false
}
```

Required behavior:

- stable key: provider + normalized term;
- idempotent upsert;
- preserve original `savedAt`;
- update `updatedAt` and provider retrieval metadata;
- validate before write;
- never create duplicate rows;
- local supplement scope is global across learning tracks;
- do not write aborted, stale, malformed, wrong-term, no-result, timeout, or failed responses.

### 6.3 Existing encrypted-row migration

Existing encrypted supplement rows must migrate without data loss.

Preferred lazy migration:

1. read raw row;
2. if plaintext, validate and return;
3. if encrypted, decrypt using the existing helper;
4. validate the supplement;
5. rewrite the same key as plaintext;
6. return the migrated record;
7. if decrypt/validation fails, quarantine or skip only that optional row.

A corrupt optional Youdao row must not globally block WordFan vocabulary saves, checkpoints, import, or sync.

## 7. Gateway persistence

The personal VPS remains cache-first.

Required SQLite behavior:

- normalized key shared across case, whitespace, and apostrophe variants;
- first miss retrieves and stores;
- later request returns SQLite copy without Youdao retrieval;
- cache survives process restart;
- definitions do not expire automatically;
- explicit refresh replaces only after successful validation;
- refresh failure preserves the old row;
- invalid cached rows are repaired;
- concurrent same-term requests do not corrupt SQLite or multiply upstream retrievals.

Recommended cache metadata:

```text
X-WordFan-Cache: HIT | MISS | REFRESH
X-WordFan-Gateway-Cached-At: <ISO timestamp>
```

## 8. Exact code changes

### `apps/wordlover-pwa/public/index.html`

- replace `#onlineDictionaryMode` select with checkbox `#autoShowYoudaoDefinitions`;
- remove Off/Manual/Automatic options;
- remove planned/Phase-1 copy;
- add accurate short explanatory text.

### `apps/wordlover-pwa/public/ui-preferences.js`

Add:

```js
export const DEFAULT_AUTO_SHOW_YOUDAO_DEFINITIONS = true;
export function normalizeAutoShowYoudaoDefinitions(value, legacyMode) { ... }
```

Include the boolean in `normalizeUiPreferences()`.

Keep legacy enum normalization only for migration/import compatibility tests.

### `apps/wordlover-pwa/public/app.js`

- replace runtime `onlineDictionaryMode` decisions with `autoShowYoudaoDefinitions`;
- migrate and persist the boolean once;
- bind and synchronize the Settings checkbox;
- Off: cancel active requests and rerender current views without Youdao mount points;
- On: rerender the current eligible view and hydrate automatically;
- preserve all answer-reveal timing;
- expose the boolean in diagnostics/export where appropriate.

### `apps/wordlover-pwa/public/online-dictionary-actions.js`

Change the renderer contract from mode-based to enabled-based:

```js
renderOnlineDictionaryActions(term, { enabled, context })
```

- disabled returns empty string;
- enabled returns a passive source-attributed mount point;
- do not render a normal lookup button.

### `apps/wordlover-pwa/public/online-dictionary-integration.js`

- hydrate enabled mount points immediately;
- local hit renders saved state;
- local miss automatically starts provider lookup;
- remove normal listeners for `[data-youdao-check]` and `[data-youdao-save]`;
- successful lookup automatically calls `upsertFromLookup()`;
- cancel on node removal, term change, toggle Off, superseding request, and timeout;
- shared in-flight requests remain deduplicated;
- persistence remains idempotent.

### `apps/wordlover-pwa/public/online-dictionary-lookup-controller.js`

Replace public mode branching with automatic-only enabled behavior, for example:

```js
display(term, { enabled = true, allowNetwork = true } = {})
```

State flow:

```text
unsupported/disabled -> hidden
saved local entry -> saved
local miss + offline -> offline
local miss + online -> checking -> lookup -> onSuccess upsert -> saved
```

Retain request IDs, AbortController, timeout, stale-response checks, and shared request deduplication. Persistence must run only after stale/abort validation.

### `apps/wordlover-pwa/public/dictionary-supplements.js`

- provide idempotent `upsertFromLookup(entry, metadata)`;
- preserve stable key and original `savedAt`;
- validate complete provider entry;
- support plaintext records;
- keep deterministic merge/tombstone behavior if sync uses tombstones.

### `apps/wordlover-pwa/public/app.js` storage adapter

- use raw IndexedDB read/write/list/remove for `dictionarySupplements`;
- detect and lazily migrate encrypted rows;
- isolate corrupt optional rows;
- ensure import, restore, sync, and rollback invalidate runtime supplement caches and notify open views.

### `apps/wordlover-pwa/public/online-dictionary-result-renderer.js`

- no normal Check or Add button;
- checking, saved, offline, failure, and save-warning states only;
- Retry control only after a real failure;
- escape all provider text;
- retain `Source: Youdao` and optional external link.

### `apps/youdao-vps/server.py`

- preserve persistent SQLite cache-first behavior;
- validate cached entries before return;
- use safe concurrent SQLite access;
- deduplicate same-term misses if practical;
- preserve old row on refresh failure;
- expose cache hit/miss metadata.

### Release/version files

Use the repository bump script and update in lockstep:

- HTML asset query versions;
- service-worker shell cache/assets;
- release manifest;
- automated test asset list;
- generated symbol map.

Never edit `gh-pages` directly.

## 9. Failure matrix

| Condition | Required behavior |
|---|---|
| Toggle Off | No section and zero gateway requests |
| Local plaintext hit | Immediate render, zero gateway requests |
| Legacy encrypted hit | Migrate to plaintext and render |
| Corrupt local row | Skip/quarantine, use gateway, repair local row |
| Offline local hit | Render cached definition |
| Offline local miss | Keep local WordFan definition usable |
| Gateway SQLite hit | Return cached gateway copy and persist locally |
| Gateway miss | Retrieve, validate, store gateway + local |
| Gateway error | Non-blocking error; no local success record |
| Local write failure | Render transient valid entry with warning |
| Term changes | Old result never rendered or persisted |
| Toggle turns Off during lookup | Abort/ignore completion |
| Refresh failure | Preserve old local and gateway copies |

## 10. Required tests

### Preference tests

- missing -> enabled;
- automatic -> enabled;
- manual -> enabled;
- off -> disabled;
- boolean overrides legacy enum;
- export/import round-trip preserves boolean.

### Controller tests

- disabled makes zero provider calls;
- local hit makes zero provider calls;
- local miss automatically calls provider;
- success persists once and returns saved state;
- shared requests persist idempotently;
- stale, aborted, timeout, malformed, wrong-term, and no-result responses are not persisted;
- Off during request cancels and suppresses completion;
- offline miss is non-blocking.

### Supplement-store tests

- plaintext create/read/update/remove;
- stable key and idempotent upsert;
- preserve `savedAt`, update `updatedAt`;
- lazy migration from encrypted row;
- corrupt optional row does not block core WordFan writes;
- sync/import/export round-trip remains correct;
- deterministic tombstone behavior if retained.

### Renderer tests

- no Check or Add button in normal states;
- disabled renders nothing;
- checking/saved/offline/failure states are correct;
- Retry exists only after failure;
- provider HTML is escaped;
- source link is valid.

### Gateway tests

- first miss retrieves and stores;
- second request does not retrieve upstream;
- process restart reuses SQLite;
- normalization variants share one key;
- invalid cached row is repaired;
- refresh succeeds atomically;
- refresh failure preserves old row;
- concurrent same-term requests are safe.

### Browser/PWA tests in Chromium and WebKit

1. fresh profile defaults On;
2. local definition appears before Youdao;
3. Youdao appears without clicking;
4. one gateway call and one local row are created;
5. reload/reopen makes zero additional gateway calls;
6. offline cached display works;
7. turning Off removes the section and prevents requests;
8. turning On restores cached definition immediately;
9. rapid term changes produce no stale result;
10. review/Study One More/spelling reveal timing remains correct;
11. legacy Manual/Automatic/Off preferences migrate correctly;
12. encrypted supplement rows migrate to plaintext;
13. installed-PWA update succeeds through the current update flow.

## 11. Acceptance criteria

- one global toggle controls all integrated Youdao behavior;
- default On, explicit legacy Off preserved;
- no normal per-word Check or Add button;
- enabled mode automatically displays local-cache or gateway definitions;
- successful definitions persist automatically in plaintext IndexedDB;
- same-device repeat display makes zero gateway requests;
- gateway repeat lookup makes no additional Youdao retrieval;
- disabled mode hides the section and makes zero requests without deleting cache;
- existing encrypted supplement data migrates without loss;
- local definitions never wait for Youdao;
- review/study/spelling reveal timing is unchanged;
- all unit, migration, gateway, browser, offline, sync/import/export, and PWA-upgrade tests pass.
