# Kaikki Dictionary Progress

- Current issue: #52 — implementation in progress
- Current branch: `feature/kaikki-dictionary-preview`
- Latest implementation commit: `2c1b0b7 Add MT-assisted overlay reranking`
- Files changed: pending sense deduplication, Chinese-only compact filtering, renderer hardening, and WordFan phonetic priority
- Tests added: structured bilingual ordering, general fallback, POS definitions/examples, escaping, malformed/legacy detail, slim-to-full exact enrichment, full-shard alias enrichment, iPhone-width layout
- Tests run: focused MT suite (7), full Python discovery (68), app build/unit/static validation (28 JS regressions), real 100-row mock dry-run and cache-resume validation
- Result: PASS. Dry-run left the 1.1 GB dictionary size/mtime unchanged, selected 100 overlay rows after filtering, translated 79 multi-candidate rows in four mock batches, and resume used cache with zero provider requests. Normal builds/runtime remain unchanged and network-free.
- Remaining work: no open GitHub issues. MT remains optional/manual and must not be enabled in normal packaging without explicit review. Production promotion remains prohibited pending audit/review and real iPhone DRAM measurement.
- Exact resume step: review a Google dry-run report with a configured API key before any optional MT apply; do not merge to main
# Current bug-fix run (2026-07-03)

- Current issues: #53, #54, #55, #56, #57, #58, #59
- Current branch: `feature/kaikki-dictionary-preview`
- Starting commit: `485dd99`
- Files changed: MT reranker/tests/docs; Kaikki package wrapper/tests; dictionary renderer/app/tests; shell version files; generated symbol map
- Tests added: conservative matching, zero-score rejection, rate/batch guards, atomic apply failure, explicit partial mode, resume/cache reporting, decision audit keys, slim detail policy, rendering order
- Tests run: focused MT/package tests; full Python discovery (74); PWA unit/build/shell validation; Playwright browser CI; code-map check
- Result: all passed; browser `waSqliteOpfs` remains the suite's pre-existing `investigate` verdict and all required gates passed
- Remaining work: commit, push, close #53-#59 with validation evidence
- Exact resume step: inspect final status, commit and push feature branch, close issues #53 through #59
