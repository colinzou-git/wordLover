# WordLover Document Gap Review

Reviewed files:

- `prd.md`
- `docs/architecture-design.md`
- `docs/wordlover-review.md`

`docs/wordlover-review.md` was treated as read-only and was not modified.

## Summary

The PRD and architecture have been updated to address the review's major findings. The documents are now broadly aligned around a PWA-first, local-first architecture with explicit setup, storage, sync, diagnostics, and FSRS-compatible review behavior.

No blocking document contradiction remains, but several implementation decisions intentionally remain open because they require Phase 0 technical validation on real devices.

Update, 2026-05-24: iPhone is now the explicit primary use case. Windows is the automation and stress-test fallback. Android remains in scope but is deferred until the end and must not block iPhone or Windows progress. The Windows PWA dictionary POC passed, and the real iPhone 17 Pro PWA POC was reported to work well with fast startup and fast dictionary loading while online. A later iPhone offline test found that the shell opens offline but dictionary load/search do not work in the original POC. The POC has now been updated to persist the dictionary to IndexedDB and fall back to that copy offline; this passed in Windows fallback automation and needs real iPhone retest. These results support continuing with the PWA-first, SQLite WASM-first plan.

## Review Items Addressed

| Review item | Status | Resolution |
| --- | --- | --- |
| PRD-1 empty status columns | Resolved | All PRD requirements now use `open` status. |
| PRD-2 Req 2 vs Req 28 conflict | Resolved | Req 2 now applies to exact-match vocabulary-save input; Req 28 applies to closest-match dictionary search. |
| PRD-3 autosave trigger | Resolved | Req 33 now defines autosave conditions and 2-3 second dwell behavior. |
| PRD-4 FSRS vs 1-5 grade conflict | Resolved | PRD now uses FSRS-compatible ratings: Again, Hard, Good, Easy. Mastery is separate from FSRS rating. |
| PRD-5 proactive frequency source | Resolved | Req 51 names ECDICT frequency rank fields; Req 168 adds bundled high-frequency fallback list. |
| PRD-6 Git diagnostic upload | Resolved | Req 84 makes platform share/browser download primary; Git upload is advanced optional. |
| PRD-7 first-time dictionary setup UX | Resolved | Req 160-163 define setup, progress, resume, storage warning, and dictionary update notification. |
| PRD-8 dictionary update behavior | Resolved | Req 164-165 define side-by-side validated dictionary updates and protection of user data. |
| ARCH-1 SQLite WASM on iPhone Safari risk | Resolved in design | Architecture now has Phase 0 pass/fail criteria, `wa-sqlite` evaluation, and sharded dictionary fallback. |
| ARCH-2 encryption key management | Resolved in design | Architecture now chooses local generated DEK plus recovery export, with optional Google Drive key-wrap. |
| ARCH-3 PWA storage eviction risk | Resolved in design | Architecture now includes persistent storage request, quota checks, backup prompts, local validation, and iOS storage warning. |
| ARCH-4 full-copy sync scaling | Resolved in design | Architecture now defines Tier 1 full snapshot sync and future Tier 2 event-log sync. |
| ARCH-5 autosave dwell only in architecture | Resolved | Dwell behavior moved into PRD Req 33; architecture references PRD and uses a named constant. |
| ARCH-6 FSRS integration detail | Resolved | Architecture now recommends `ts-fsrs`, stores serialized FSRS card fields, and separates mastery from FSRS ratings. |
| ARCH-7 ChatGPT ambiguity | Resolved with provider abstraction | PRD and architecture now use AI provider abstraction, with Gemini via Google as default no-additional-fee provider and ChatGPT/OpenAI optional. |
| ARCH-8 Git diagnostic mechanism | Resolved | Architecture now makes Web Share/browser download primary and Git REST API advanced optional. |
| ARCH-9 meaning ordering | Resolved | Architecture replaces `isUserPreferred` with `displayOrder` and `userRank`. |
| ARCH-10 study event retention | Resolved | Architecture now defines active event retention and yearly compressed summaries. |
| CROSS-1 decision log | Resolved | Architecture now includes ADR-001 through ADR-003. |
| CROSS-2 supported platform baseline | Resolved | Architecture now defines minimum browser/OS baseline and PRD Req 166 adds compatibility warning. |
| CROSS-3 Phase 0 validation report | Resolved | PRD Req 167 and architecture Phase 0 require a written validation report. |

## Remaining Open Decisions

These are not gaps between the documents; they are technical decisions that need Phase 0 validation or implementation spikes.

| Topic | Current document state | Next action |
| --- | --- | --- |
| SQLite WASM implementation | Windows PWA, real iPhone 17 Pro online testing, and automated Windows persistence POCs support SQLite WASM-first. Architecture still requires iPhone offline persistence validation. | Run the updated offline dictionary persistence test on iPhone Safari/Home Screen, then choose the production persistence mode. |
| Dictionary fallback format | Architecture defines sharded dictionary fallback, but exact binary schema is not finalized. | Design only if SQLite WASM fails Phase 0 criteria or is too slow/heavy. |
| Browser encryption recovery UX | Architecture selects DEK + recovery export + optional Google key-wrap. The automated suite proved Web Crypto encrypted export/import round trip. | Decide user-facing passphrase and recovery-file UX before product UI implementation. |
| Export encryption mode | Architecture leaves open whether normal tar exports are always encrypted or can be plain. | Decide product policy before implementing export/import UI. |
| Advanced Git diagnostic upload | PRD/architecture make it optional. | Defer until Web Share/browser download diagnostics are working. |
| Android PWA validation | Android remains a future portability requirement but is lowest priority. | Defer until the end, after iPhone and Windows are stable. |
| Native wrappers | Architecture makes wrappers optional. | Revisit only after PWA core works well. |

## Residual Risks

### PWA Storage Durability

The PRD requires local-first offline use, and architecture mitigates browser storage eviction. However, no PWA can fully guarantee that iOS will never evict local storage. The documents now handle this by requiring cloud sync/export warnings and recovery, but the product should be honest in install documentation.

### Large Dictionary Package On iPhone

The local SQLite dictionary is large. The iPhone 17 Pro POC passed for startup and online dictionary loading, so this is no longer the top feasibility blocker. The current top risk is whether the updated persisted dictionary flow works on iPhone after Wi-Fi is disconnected, app restarts, and normal Home Screen PWA use.

### AI Provider Requirement Shift

Earlier PRD language was ChatGPT-specific. The review recommended Gemini because the app already uses Google Drive and wants no extra fees. The PRD and architecture now use an AI provider abstraction with Gemini as default and ChatGPT/OpenAI optional. This is aligned internally, but it is a product decision worth confirming before implementation.

### Security Limits Of PWA Key Storage

The architecture explicitly documents that browser storage is not equivalent to native secure enclave/keychain. Encryption is still required, but local key protection is constrained by the web platform. The recovery/export model must be carefully explained to users.

## Consistency Check

| Area | PRD | Architecture | Review alignment |
| --- | --- | --- | --- |
| PWA-first no-fee install | Req 157-159 | PWA-first platform and distribution sections | Aligned |
| First-time setup | Req 160-163 | Browser capability, dictionary package, Phase 0 | Aligned |
| Dictionary updates | Req 164-165 | Side-by-side dictionary update handling | Aligned |
| Compatibility warning | Req 166 | Supported platform baseline | Aligned |
| Phase 0 report | Req 167 | Phase 0 validation criteria and report contents | Aligned |
| Proactive word frequency | Req 51, 168 | Proactive new-word flow uses ECDICT and fallback list | Aligned |
| Autosave timing | Req 33 | Search and Autosave Service references Req 33 | Aligned |
| FSRS ratings | Req 126, 147-148 | `ts-fsrs` mapping and mastery separation | Aligned |
| Diagnostics | Req 80-86 | Web Share primary, Git optional advanced | Aligned |
| AI details | Req 70-79 | Provider abstraction, Gemini default, ChatGPT optional | Aligned |
| Meaning source/order | Req 136-137 | `Meaning.source`, `displayOrder`, `userRank` | Aligned |
| Study event retention | Req 133 plus sync/backup requirements | Study Event Retention Policy | Aligned |

## Suggested Next Documentation Step

Before full implementation planning, finish the remaining Phase 0 validation notes for iPhone offline dictionary persistence/search, iPhone timed benchmarks, and real Google Drive OAuth sync. Android validation is deferred until the end. The SQLite WASM direction is now strong enough to use for the first implementation plan, while the sharded dictionary package remains a contingency.

## Additional Review Follow-up

After the initial self-review, `docs/germini-review.md` was also scanned. Most of its concerns were already covered by the PWA-first architecture:

- It warns against `localStorage`; the architecture uses encrypted IndexedDB/OPFS instead.
- It recommends offline/PWA support; the architecture is PWA-first.
- It discusses cloud persistence alternatives such as Firestore; the PRD currently requires Google Drive full-copy sync, so Firestore is not adopted.
- It mentions dynamic AI challenge latency; the PRD's proactive study flow uses local dictionary/frequency data first, not AI-generated first-load challenges.

Two useful additions were made:

- PRD Req 169 and architecture review scheduling now define a review backlog grace window.
- PRD Req 170 and architecture AI service now require structured AI output validation before display or save.
