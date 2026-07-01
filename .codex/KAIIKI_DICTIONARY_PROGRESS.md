# Kaikki Dictionary Progress

- Current issue: #28–#34 — real full package validation running
- Current branch: `feature/kaikki-dictionary-preview`
- Latest implementation commit: `dbd6de0 Record completed Kaikki validation`
- Files changed: Kaikki builder hardening; manifest-driven shard overlay reads; explicit missing-full-overlay handling; selected/available report counters; preview dictionary storage namespacing; fixture preview wording; docs/progress/symbol map
- Tests added: Chinese code/name variant detection; romanization/non-Chinese rejection; manifest-driven shard loading; stale shard ignore; missing manifest/listed shard failure; missing full overlay failure + report; selected/available counters; preview storage key isolation; fixture opt-in coverage
- Tests run: targeted builder/package tests; package shard tests; audit tests; full Python discovery (41 tests); npm unit/build; shell-asset validation; code-map regenerate/check
- Result: PASS for current targeted and full local unit/static validation after fixes. `python` is absent on Ubuntu, so npm scripts were run with `/tmp/python -> /usr/bin/python3` in PATH.
- Remaining work: optionally rerun real full Kaikki build/package/audit with `~/dictBackup/` inputs and browser CI smoke; close/comment #28–#34 after final validation. Promotion remains prohibited until reviewed and real iPhone DRAM is measured with Safari simulator/Instruments; Android remains deferred.
- Exact resume step: wait for `scripts/package_kaikki_dictionary.py` real build/package with `~/dictBackup` inputs, then run audit and browser/static validation
