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
- Latest implementation commit: `abc3756`
- Remaining work: none for #53-#59; all seven issues are closed with validation evidence
- Exact resume step: wait for new bug reports; do not rebuild generated Kaikki assets unless explicitly requested

# Selectable dictionary run (2026-07-03)

- Current issues: #60, #61, #62, #63, #64, #65, #66, #67
- Current branch: `feature/kaikki-dictionary-preview`
- Starting commit: `393f6f0`
- Files changed: dictionary registry/config/selection; app Settings/runtime/save metadata; service worker; Kaikki packager; docs; JS/Python tests; shell version assets
- Tests added: config priority/default/preview, selection persistence, storage isolation, service-worker bypass, record provenance, release/preview packaging, unsafe output rejection
- Tests run: focused JS/Python; full Python discovery (76); PWA build/unit/shell validation; Playwright browser CI
- Result: all required gates passed; browser `waSqliteOpfs` retains its pre-existing `investigate` verdict
- Latest implementation commit: `a7180b0`
- Remaining work: none for #60-#67; all issues are closed with validation evidence
- Exact resume step: wait for new issues; generate release assets only when explicitly requested after audit

# Runtime packaging hardening (2026-07-04)

- Current issue: #68
- Current branch: `feature/kaikki-dictionary-preview`
- Starting commit: `12039f2`
- User-owned untracked files: seven root rerank/Google helper scripts; preserve and exclude
- Files changed: Kaikki packager/tests; app runtime/index/browser regressions; full-dictionary tests; design docs; shell version files
- Tests added: extra/oversize SQLite guards, manifest/summary metrics, release asset URLs, Kaikki cache scope, dynamic labels, real missing-package rollback and learning-data preservation
- Tests run: focused package/shard/audit and JS tests; full Python discovery (78); PWA build/unit/shell validation; Playwright browser CI including rollback path
- Result: all required gates passed; browser `waSqliteOpfs` retains its pre-existing `investigate` verdict
- Latest implementation commit: `118a1d4`
- Remaining work: none for #68; issue closed with validation evidence
- Exact resume step: wait for new issues; preserve user-owned untracked rerank scripts and do not use MT output

# Pre-merge blockers (2026-07-04)

- Current issues: #69, #70, #71, #72, #73
- Current branch: `feature/kaikki-dictionary-preview`
- Starting commit: `311f103`
- User-owned untracked files: seven root rerank/Google helper scripts; preserve and exclude
- Verified already complete: #70 rollback safety, #71 SQLite guard, #72 dynamic labels
- Files changed: CI deploy workflow, deploy/Kaikki docs, JS deploy/SW/gitignore regression coverage
- Tests run: workflow shell syntax; focused package/full-dictionary/JS; full Python discovery (78); PWA build/unit/shell validation (35 JS regressions)
- Result: local gates passed
- Latest commits: `e36f8a7` deploy preservation; `d39bef1` deterministic visible browser flow
- GitHub Actions: run `28697410436` passed static and Chromium/WebKit browser jobs
- Remaining work: none for #69-#73; all blockers closed with validation evidence
- Exact resume step: wait for new issues; preserve user-owned untracked rerank scripts and do not commit generated dictionary assets

# Ambiguous inflection aliases (2026-07-04)

- Current issue: #74
- Current branch: `feature/kaikki-dictionary-preview`
- Starting commit: `dc3aa25`
- User-owned untracked files: seven root rerank/Google helper scripts; preserve and exclude
- Files changed: shard packager/tests; local SQLite lookup; full-dictionary/JS/browser regressions; CI fixture; shell version assets
- Tests added: combined same-base labels, exact-entry precedence, deterministic different-base ranking, browser alias decoding, real `apples → plural of apple` app lookup
- Tests run: full Python discovery (82); PWA build/unit/shell validation (36 JS regressions); Playwright browser CI
- Result: all local gates passed
- Remaining work: regenerate/check code map, production diff, commit/push, verify GitHub Actions, close #74
- Exact resume step: final checks and commit tracked issue files without rebuilding generated dictionaries
