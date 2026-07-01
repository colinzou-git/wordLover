# Kaikki inflection support note

This note exists to document the requirement that the Kaikki dictionary builder must preserve WordFan's existing inflected-form lookup behavior.

Current WordFan behavior:

- Exact lookup first checks `dictionary_entries.normalized_word`.
- If no exact row is found, the app scans `dictionary_entries.exchange` and parses ECDICT-style form codes.
- Full dictionary shards also build alias entries from `exchange` so a query like `running` can resolve to `run` even when only the full sharded package contains the base row.

The Kaikki builder must therefore populate `exchange` for base entries from:

1. Kaikki lemma `forms` arrays.
2. Kaikki form-of-only entries, which should normally be skipped as independent dictionary rows but harvested as alias evidence.

Required examples:

- `running` resolves as present participle of `run`.
- `ran` resolves as past tense of `run`.
- `excited` resolves either as an exact adjective entry or as past tense / past participle of `excite` if no exact row exists.

See GitHub issue #23 for implementation details.
