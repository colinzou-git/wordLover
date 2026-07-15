# Dictionary supplements

WordFan stores optional provider supplements in the dedicated `dictionarySupplements`
IndexedDB object store. The store was introduced in database version 8 and is additive:
it does not replace the packaged dictionary or the user-authored dictionary overlay.

## Scope and identity

Supplements are user-global, not learning-track scoped. A personal supplemental
dictionary is therefore visible after switching tracks and is not duplicated into each
track. The stable key is `<provider-id>:<normalized-term>`. This scope is deliberate;
transport through backup, sync, and personal-dictionary export is supported for this
personal-use deployment.

Each value is stored as a validated plaintext record in this dedicated optional store.
Legacy encrypted values are lazily decrypted and replaced with plaintext on read. Invalid
or undecryptable records are isolated so local dictionary lookup continues.
Saving the same provider and normalized term replaces the provider snapshot while retaining
the original `savedAt`; removal affects only the supplement record.

## Provider policy gate

Youdao persistence is enabled in the personal deployment with
`youdaoPersistenceAllowed: true`. Every successful validated automatic lookup is upserted;
turning display off retains existing records.

Failed, malformed, stale, aborted, timed-out, wrong-term, and no-result responses are never
written to this store.

## Lifecycle

There is no normal per-word Add, Remove, or Refresh workflow. Enabled views hydrate
automatically from the local store and then the gateway on a miss. Writes are idempotent,
and save events update eligible open views without changing an active unrevealed question.

Refresh bypasses transient caching and keeps the prior saved value visible while the request
is running. The new validated entry is written with one IndexedDB `put`; no success state is
reported until that write completes. A timeout, malformed response, no-result, cancellation,
or storage error leaves the previous plaintext record unchanged.

## Study snapshots

Study starts lazily read only the saved supplement for the term(s) being queued; WordFan does
not scan the supplement store during app startup. Question construction then uses an immutable
compact snapshot, so a save, refresh, or removal affects later questions but cannot mutate the
active one. Only successfully persisted lookup results enter this cache or a question.

The deterministic study policy prefers up to three Chinese definitions in provider order and
falls back to English only when Chinese is absent. Each meaning is capped at 96 characters;
exact local duplicates, examples, phrases, synonyms, and antonyms are excluded. The local
meaning stays first in quiz labels. Spelling hints mask the target and common inflections, and
the integrated full entry is not hydrated on an unrevealed spelling surface. Source attribution
is rendered from the stable snapshot only after normal review/Study One More reveal points.
FSRS state and grading never inspect provider metadata.
