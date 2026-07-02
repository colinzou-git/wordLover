# Kaikki Dictionary Progress

- Current issue: #49 -> #51 — implemented, rebuilt, and validated
- Current branch: `feature/kaikki-dictionary-preview`
- Latest implementation commit: `fa9c54a Refine Kaikki pronunciation and translation senses`
- Files changed: pending sense deduplication, Chinese-only compact filtering, renderer hardening, and WordFan phonetic priority
- Tests added: structured bilingual ordering, general fallback, POS definitions/examples, escaping, malformed/legacy detail, slim-to-full exact enrichment, full-shard alias enrichment, iPhone-width layout
- Tests run: builder (24), full Python discovery (61), JS unit/build/static (28 regressions), Playwright browser CI, real rebuild/package, Chromium 390px `dictionary`/`record` smoke, strict audit
- Result: PASS. `dictionary` renders one title IPA/speaker path and the promoted `字典... | publication...` compact line; `record` groups `n., adj.` on one IPA and `v.` on another with two speakers. Strict audit passes 824,747 rows/128 shards. A concurrent protected production-path change correctly failed the initial packaging safety check; its report was preserved, and a subsequent unchanged-baseline validation passed without modifying production.
- Remaining work: no open GitHub issues. Promotion remains prohibited pending review and real iPhone DRAM measurement. Note: an external concurrent change left the ignored production `dictionary.sqlite` empty and `.zst` absent during packaging; Codex did not restore or modify those paths.
- Exact resume step: manually validate v150/preview 2026.07.02.5 through the fresh port-4179 SSH tunnel; do not merge to main
