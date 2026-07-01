# Kaikki Dictionary Progress

- Current issue: #41–#44 — implemented and validated
- Current branch: `feature/kaikki-dictionary-preview`
- Latest implementation commit: `bb3a018 Fix Kaikki preview isolation and audit bugs`
- Files changed: Chinese variant detection and entry-level provenance; full-shard integrity audit; verified production-path packaging snapshots; docs/tests
- Tests added: CDO/Gan/Xiang/Hokkien/Wu/Han detection; aligned entry provenance and counters; shard size/checksum/count/byte/path/missing-file corruption; production manifest/full-shard snapshot mutation and packaging failure
- Tests run: builder (18), shard packager (5), audit (12), full Python discovery (55); npm build/static/unit (23 JS regression tests); Playwright browser CI; strict real audit; code-map regenerate/check; py_compile; production asset diff
- Result: PASS. Strict audit checked 824,747 DB/FTS rows and 128 shards containing 824,747 entries, 510,864 aliases, and 152,173,911 compressed bytes. Browser CI passed all required gates; wa-sqlite OPFS remains investigatory and Android deferred by policy. Production dictionary paths have no diff.
- Remaining work: commit/push and close #41–#44. Promotion remains prohibited until reviewed and real iPhone DRAM is measured with Safari simulator/Instruments; Android remains deferred.
- Exact resume step: commit current changes, push feature branch, comment/close #41–#44, verify clean worktree/open issue list
