# Kaikki Dictionary Progress

- Current issue: #49 -> #51 — implemented, rebuilt, and validated
- Current branch: `feature/kaikki-dictionary-preview`
- Latest implementation commit: `7ce8736 Record Kaikki issue validation`
- Files changed: pending sense deduplication, Chinese-only compact filtering, renderer hardening, and WordFan phonetic priority
- Tests added: structured bilingual ordering, general fallback, POS definitions/examples, escaping, malformed/legacy detail, slim-to-full exact enrichment, full-shard alias enrichment, iPhone-width layout
- Tests run: builder (24), full Python discovery (61), JS unit/build/static (28 regressions), Playwright browser CI, real rebuild/package, Chromium 390px `dictionary`/`record` smoke, strict audit
- Result: PASS. `dictionary` renders one title IPA/speaker path and the promoted `字典... | publication...` compact line; `record` groups `n., adj.` on one IPA and `v.` on another with two speakers. Strict audit passes 824,747 rows/128 shards. A concurrent protected production-path change correctly failed the initial packaging safety check; its report was preserved, and a subsequent unchanged-baseline validation passed without modifying production.
- Remaining work: code-map/tracked production diff, commit/push, close #49/#51. Promotion remains prohibited pending review and real iPhone DRAM measurement.
- Exact resume step: regenerate/check code map, verify tracked production diff, commit/push, then close issues with real-data evidence
