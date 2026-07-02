# Kaikki Dictionary Progress

- Current issue: #46/#47 complete; expanded #48 implemented, rebuilt, and validated
- Current branch: `feature/kaikki-dictionary-preview`
- Latest implementation commit: `19f592f Add Kaikki POS-specific pronunciations`
- Files changed: pending sense deduplication, Chinese-only compact filtering, renderer hardening, and WordFan phonetic priority
- Tests added: structured bilingual ordering, general fallback, POS definitions/examples, escaping, malformed/legacy detail, slim-to-full exact enrichment, full-shard alias enrichment, iPhone-width layout
- Tests run: builder (21), full Python discovery (58), JS unit/build/static (26 regressions), Playwright browser CI, real rebuild/package, Chromium 390px `record` smoke, strict audit
- Result: PASS. Real `record` stores normalized/raw noun/adjective/verb Kaikki pronunciations and renders three POS/speaker pairs without duplicate title IPA or overflow. Kaikki primary is `/ˈrɛk.ɚd/`; overlay is fallback only. Strict audit passes 824,747 rows/128 shards; production snapshot unchanged.
- Remaining work: no open GitHub issues. Promotion remains prohibited pending review and real iPhone DRAM measurement.
- Exact resume step: manually validate v149/preview 2026.07.02.4 through the fresh port-4178 SSH tunnel; do not merge to main
