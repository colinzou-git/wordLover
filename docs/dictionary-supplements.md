# Dictionary supplements

WordFan stores optional provider supplements in the dedicated `dictionarySupplements`
IndexedDB object store. The store was introduced in database version 8 and is additive:
it does not replace the packaged dictionary or the user-authored dictionary overlay.

## Scope and identity

Supplements are user-global, not learning-track scoped. A personal supplemental
dictionary is therefore visible after switching tracks and is not duplicated into each
track. The stable key is `<provider-id>:<normalized-term>`. This scope is deliberate;
transport through backup and sync remains disabled until the provider policy permits it
and the separate portability design is implemented.

Each value is encrypted through the same per-device AES-GCM data-encryption key as other
WordFan record stores. Reads validate both the supplement envelope and normalized provider
entry. Invalid or undecryptable records are isolated so local dictionary lookup continues.
Saving the same provider and normalized term replaces the provider snapshot while retaining
the original `savedAt`; removal affects only the supplement record.

## Provider policy gate

Youdao persistence is disabled by default with `youdaoPersistenceAllowed: false`.
The lookup controller may read an already-saved supplement even when live lookup or future
persistence is disabled, but it cannot create or update Youdao records unless this flag is
set in the deployed configuration after written permission is obtained. Removal remains
available so disabling a provider never traps user data.

Transient lookup results, session caches, packaged dictionaries, learning records, and
user-authored definitions are never written to this store automatically.

## Lifecycle

A transient integrated result exposes `Add as additional definition` only when provider
persistence is permitted. Saved entries expose removal and, when live lookup is available,
explicit refresh. Actions are single-flight so rapid repeated taps cannot create duplicate
writes. Save/remove events re-render every open supplement section for the same normalized
term; this keeps search, vocabulary, revealed review, Study One More, and spelling views in
sync without changing an active unrevealed question.

Refresh bypasses transient caching and keeps the prior saved value visible while the request
is running. The new validated entry is written with one IndexedDB `put`; no success state is
reported until that write completes. A timeout, malformed response, no-result, cancellation,
or storage error leaves the previous encrypted record unchanged. Removing a record requires
confirmation and deletes only its provider/term key.
