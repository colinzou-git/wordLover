# Youdao two-layer persistent cache design

Status: Required implementation design

Scope: Personal-use WordFan deployment

Related scope: `docs/youdao-personal-use-scope.md`

## Goal

Persist every successful normalized Youdao definition in two places:

1. the owner's personal gateway SQLite database; and
2. the current browser/PWA device's encrypted IndexedDB supplement store.

After a definition has been successfully retrieved once on a device, ordinary future displays on that device must not call the gateway. A first lookup on another device should reuse the gateway copy without retrieving the definition from Youdao again, then persist it locally on that device.

## Current main-branch state

### Gateway persistence exists

`apps/youdao-vps/server.py` currently:

- normalizes the request term to a lowercase SQLite key;
- reads table `lookups` before making an upstream request;
- stores a successful normalized payload in SQLite;
- supports `refresh=1` to bypass the SQLite record.

Thus the gateway already avoids repeated upstream requests for an ordinary repeated term.

### Device persistence is manual only

The PWA already has:

- encrypted IndexedDB store `dictionarySupplements`;
- cache-first lookup through `getSaved(...)`;
- offline rendering of a saved supplement;
- saved supplement integration with future study content;
- sync/import/export support.

However, `apps/wordlover-pwa/public/online-dictionary-integration.js` saves only when the user clicks **Add as additional definition**. A successful ordinary lookup is displayed as a transient result and is not automatically written to IndexedDB.

This means the missing behavior is automatic local persistence after a successful validated lookup.

## Required lookup flow

```text
render local WordFan definition immediately
        |
        v
read encrypted local Youdao supplement
        |
        +-- valid local hit --> render saved entry --> stop
        |
        +-- local miss/invalid --> evaluate Off/Manual/Automatic mode
                                  |
                                  v
                             request gateway
                                  |
                                  v
                         read gateway SQLite cache
                                  |
                    +-------------+-------------+
                    |                           |
                  hit                          miss
                    |                           |
                    |                    retrieve from Youdao
                    |                           |
                    |                    parse + validate
                    |                           |
                    |                    persist SQLite
                    +-------------+-------------+
                                  |
                                  v
                         return normalized entry
                                  |
                                  v
                     validate exact requested term
                                  |
                                  v
                    persist encrypted IndexedDB
                                  |
                                  v
                    render saved/offline-ready state
```

## Client behavior

### Automatic persistence trigger

Automatically persist a successful validated integrated lookup produced by:

- Automatic mode;
- an explicit Manual-mode **Check Youdao** action;
- an explicit successful Refresh.

Do not persist:

- unsupported input;
- no-result responses;
- network/provider errors;
- malformed entries;
- entries whose normalized term differs from the request;
- stale results after the displayed term changes;
- aborted/timed-out requests;
- external-link navigation without an integrated response.

### Additive data model

The cached definition remains a provider supplement. It must not replace:

- the ECDICT/Kaikki definition;
- a user-authored dictionary entry;
- vocabulary/review/FSRS state.

The local WordFan definition remains primary. The Youdao section remains visibly attributed.

### Lookup controller changes

Update `online-dictionary-lookup-controller.js` or add a focused orchestration layer with an asynchronous successful-result hook:

```js
onSuccess: async ({ term, entry, forceRefresh }) => finalState
```

Required invariants:

- run only after request-ID, stale-result, and abort checks pass;
- verify the entry belongs to the requested normalized term;
- await the local save before publishing final `saved` state;
- if IndexedDB saving fails, still render the valid transient entry and attach a non-blocking `saveError`;
- shared request deduplication may result in repeated idempotent save calls, but must not corrupt data or produce conflicting timestamps;
- a response for an old view must never be persisted under the new view's term.

### Integration changes

Update `online-dictionary-integration.js` so persistence is not owned only by the Save button.

Normal successful lookup should become:

```text
checking -> success received -> local upsert -> saved
```

The ordinary success UI should not require **Add as additional definition**. That button may be removed, or retained only as **Retry local save** after an IndexedDB failure.

### Supplement repository changes

In `dictionary-supplements.js`, add or adapt an idempotent upsert operation such as:

```js
upsertFromLookup(entry, metadata)
```

Requirements:

- stable ID remains `youdao:<normalizedTerm>`;
- preserve original `savedAt` when updating an existing record;
- update `sourceRetrievedAt` and `updatedAt`;
- retain provider ID, label, source URL, parser version, and entry schema version;
- validate the complete entry before writing;
- identical repeated results must not create duplicate records;
- tombstones continue to prevent unwanted resurrection through sync.

Optional operational metadata:

```js
{
  cacheOrigin: "gateway-hit" | "gateway-miss" | "refresh",
  locallyPersistedAt: ISO_TIMESTAMP,
  gatewayCachedAt: ISO_TIMESTAMP
}
```

These fields are diagnostic only and must not affect record identity.

### Runtime cache invalidation

All local supplement changes, including automatic save, refresh, import, sync, and removal, must update one shared repository/event path that:

- updates or invalidates `savedStudySupplements`;
- refreshes all open Youdao panels for the same normalized term;
- updates future quiz, review, Study One More, and spelling snapshots;
- updates supplement counts and diagnostics.

An active question already shown to the user remains frozen. Only future questions use a newly saved or refreshed entry.

### Renderer changes

Update `online-dictionary-result-renderer.js` so normal completion shows a status such as:

```text
Saved locally for offline use · Source: Youdao
```

Controls:

- Refresh saved entry;
- Remove local copy.

When local persistence fails, render the definition and a retryable message:

```text
Definition loaded, but it could not be saved on this device.
```

The UI should explain that removing the local copy does not remove the gateway copy and that the entry may be restored on a later lookup.

## Gateway behavior

### Persistent cache schema

Migrate the current payload-only SQLite table to an explicit versioned record, for example:

```sql
CREATE TABLE lookups (
  provider_id TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  entry_schema_version INTEGER NOT NULL,
  parser_version TEXT NOT NULL,
  payload TEXT NOT NULL,
  source_retrieved_at TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (provider_id, normalized_term, entry_schema_version)
);
```

Provide an idempotent migration from the existing table and retain valid rows where possible.

### Cache-hit validation

Before returning a cached row:

- parse payload JSON;
- validate provider and schema version;
- verify `normalizedTerm` exactly matches the normalized request;
- require at least one usable definition;
- verify required retrieval/parser metadata;
- if invalid, quarantine or remove the row and perform a fresh upstream retrieval.

### Atomic refresh

Explicit Refresh must:

1. retain the existing valid SQLite row;
2. retrieve and parse a fresh upstream result;
3. validate and serialize it;
4. replace the row within a transaction;
5. return the new entry.

A refresh failure leaves the old row untouched and usable.

### SQLite concurrency

The current server uses `ThreadingHTTPServer` with one SQLite connection and `check_same_thread=False`. Replace this with either:

- one SQLite connection per repository operation/request; or
- serialized access through a lock and a configured busy timeout.

Add concurrent same-term tests. Prefer deduplicating simultaneous cache misses so they perform one upstream retrieval.

### Cache lifetime

For this personal app, valid gateway definitions do not expire automatically. They remain until:

- explicit Refresh replaces them;
- invalid-record repair removes them;
- a future schema migration invalidates them.

Do not add periodic or background refresh.

### Gateway cache metadata

Expose cache status for diagnostics using response headers or a versioned envelope, for example:

```text
X-WordFan-Cache: HIT | MISS | REFRESH
X-WordFan-Gateway-Cached-At: <ISO timestamp>
```

Normal UI does not need to display cache status.

## Removal behavior

### Remove local copy

The normal PWA removal action:

- removes or tombstones the encrypted local supplement;
- clears the in-memory study supplement cache;
- updates open views;
- does not delete the gateway SQLite row.

A later online lookup can rehydrate the device from the gateway without another upstream retrieval.

### Gateway removal

Deleting a gateway record is an owner administrative/debug operation and is not exposed through ordinary WordFan UI.

## Sync, backup, and export

Automatically persisted local entries are ordinary saved supplements and must participate in:

- encrypted local persistence;
- owner-only Google Drive app-data sync;
- user-data backup/import;
- personal enhanced-dictionary export;
- deterministic tombstone/conflict handling.

Transient failures and no-result responses create no supplement record.

Bump backup or user-data schema versions if necessary so an older client cannot silently remove the supplement collection when it rewrites a backup.

## Failure matrix

| Condition | Required behavior |
|---|---|
| Valid local IndexedDB hit | Render locally and make zero gateway requests |
| Corrupt local record | Ignore/quarantine it, use gateway, then repair local copy |
| Offline with local hit | Render saved Youdao definition |
| Offline with local miss | Keep local WordFan definition usable and show a non-blocking offline state |
| Gateway SQLite hit | Return without upstream retrieval and persist on the device |
| Invalid gateway row | Retrieve a fresh entry and repair SQLite |
| Upstream failure on gateway miss | Keep local WordFan result; create no local supplement |
| Local IndexedDB write failure | Display transient result and show retryable save error |
| Refresh failure | Preserve old local and gateway copies |
| Stale or aborted response | Never render or persist it |

## Tests

### Gateway tests

- first request retrieves upstream and persists SQLite;
- second request returns SQLite with upstream call count still one;
- process restart still reuses SQLite;
- case, whitespace, and smart-apostrophe variants resolve to one key;
- Refresh atomically replaces the row;
- Refresh failure preserves the old row;
- invalid JSON, wrong schema, and wrong-term rows are repaired;
- concurrent requests do not corrupt SQLite;
- existing schema migration retains valid entries;
- failed/no-result responses are not stored as successful definitions.

### Client unit tests

- local hit results in zero provider calls;
- successful Automatic lookup saves locally exactly once;
- successful Manual check saves locally;
- shared lookup from multiple views remains idempotent;
- stale, aborted, malformed, and wrong-term responses are not saved;
- persistence failure displays the entry with `saveError`;
- second display after persistence makes zero gateway calls;
- Refresh success replaces the local record;
- Refresh failure keeps the old record;
- removal allows later gateway rehydration.

### Browser/PWA scenario

Use gateway and upstream request counters:

1. fresh device searches `charge`;
2. one gateway request occurs and local IndexedDB record is created;
3. reload and search again;
4. gateway request count does not increase;
5. switch offline and reload;
6. saved Youdao definition still renders;
7. remove only the local copy, reconnect, and search again;
8. gateway request count increases but upstream count does not;
9. explicit Refresh increases upstream count and updates both copies.

Run in Chromium and WebKit where supported.

## Acceptance criteria

- Gateway persistence survives process restart.
- An ordinary repeated gateway request does not retrieve the same term from Youdao again.
- Every successful validated integrated result is automatically stored in encrypted local IndexedDB.
- Repeated display on the same device makes zero gateway requests.
- A first lookup on another device reuses the gateway copy and stores it locally.
- The definition remains available offline after the first successful lookup on that device.
- Refresh updates both layers only after successful validation and preserves old data on failure.
- Invalid, stale, aborted, and error responses are never persisted.
- Removing the local copy does not delete gateway data and later lookup rehydrates the device.
- Sync, import, export, existing dictionary behavior, study, FSRS, and offline startup remain correct.
- Unit, gateway, restart, browser, and PWA tests pass.
