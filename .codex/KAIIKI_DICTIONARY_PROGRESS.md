# Kaikki Dictionary Progress

- Current issue: #22 — complete; promotion remains gated
- Current branch: `feature/kaikki-dictionary-preview`
- Latest implementation commit: `98b58e5 Validate full Kaikki preview pipeline`
- Files changed: real-shape builder/overlay fixes; layered slim core/package/audit; preview asset routing; browser fixture/layout checks; docs/progress/symbol map
- Tests added: builder/overlay/Chinese/STEM/detail/inflection; isolated packaging/shard compatibility; structured UI/XSS/layout smoke; audit health/coverage/failure/report tests
- Tests run: required targeted Python modules; full discovery (37 tests); npm test/build (20 regression tests); full-dictionary Node tests; Chromium full browser suite; WebKit smoke; real-package Chromium and WebKit at 390px; code-map check; production asset diff
- Result: PASS. Full build: 824,747 rows; 549,478 form aliases attached; 46,925 Kaikki Chinese rows; 277,187 final Chinese rows (33.6087%); 947 STEM rows. Package: 55,642-row/39,960,576-byte layered core plus 824,747 exact/510,864 alias full shards. Real audit PASS including 50 MiB core gate. Chromium/WebKit real preview renders layered `charge`; `ran` resolves through `run`; exact `running`/`excited` win; no errors/390px overflow.
- Remaining work: no implementation work; issues #16, #17, #18, #19, #20, #21, #22, #23, #24, #25, #26, and #27 are closed. Promotion remains prohibited until reviewed and real iPhone DRAM is measured with Safari simulator/Instruments; Android remains deferred.
- Exact resume step: on Mac, run the isolated preview on iPhone simulator/device and record Instruments DRAM; only then consider a separate audited promotion PR
