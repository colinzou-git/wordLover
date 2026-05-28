# Spelling Review & Quiz — PRD

Status: **Implemented in v52** · Owner: Colin · Created: 2026-05-28

This document tracks the requirements for a **Spelling** practice track that runs in
parallel to the existing **Vocabulary memorization** track. Implementation has not
started. Treat the "Status" line here as the source of truth for progress; update the
Requirements table at the bottom as items land.

---

## 1. Goal

Let users build a **separate spelling word list** of dictionary words and practice
spelling them with an **audio-prompted, retry-until-mastered quiz**. Spelling gets its
own Today counts, stats, and history — kept in **separate tabs** so spelling activity
never mixes with vocabulary memorization. The two lists are independent records.

## 2. Current state (context for implementers)

- Vocabulary list uses FSRS scheduling; the Today section shows new / reviewed / mastered;
  the Vocabulary stats browser shows total / again / hard / good / easy; the History chart
  shows new / reviewed / level-up / level-down over time.
- The search box: **Return** runs a lookup + adds to history; a separate **Autosave**
  checkbox saves the looked-up word to vocabulary after a typing pause (dwell).
- Dictionary is a read-only sql.js SQLite (`lookupTerm`). User data is encrypted in
  IndexedDB (`vocabularyRecords`, `studyEventRecords`, `kv`, …), synced to Google Drive
  (`buildUserDataSnapshot` / `mergeSnapshots` / `applyUserDataSnapshot`) and checkpointed.

## 3. Confirmed decisions

| # | Decision |
|---|----------|
| D1 | **Spelling rating = auto from retries, FSRS-scheduled.** Per word per session: 0 retries → **Easy**, 1 → **Good**, 2 → **Hard**, 3+ → **Again**. The derived rating feeds an FSRS schedule so spelling words get due dates and new/reviewed/mastered status, exactly like vocabulary. |
| D2 | **New "On Return" setting replaces the Autosave checkbox.** A 3-way select: **Save to vocabulary** (default) · **Save to spelling list** · **Do nothing**. Return still performs the search and adds to history; only the *save side-effect* is governed by this setting. The dwell-based autosave is removed. |
| D3 | **Spelling review shows a meaning hint.** During input the app speaks the word (with a repeat button) and shows its meaning (English + Chinese) as a prompt. The spelling itself is hidden until the user misses. |
| D4 | **Dictionary words only; lists independent.** Only words present in the dictionary (or the new user dictionary, see D5) can be added to the spelling list. Spelling and vocabulary are independent records — a word can be in either, both, or neither. |
| D5 | **New "Add to dictionary" button.** For a term that is **not** in the dictionary, the user can add it to a **user dictionary** (word + IPA + English + Chinese). It then becomes searchable and eligible for both spelling and vocabulary. Only shown when the term does not already exist in the dictionary. |
| D6 | **Strict spelling check.** The typed answer must **exactly equal** the target word: **case-sensitive**, **no whitespace trimming**, exact hyphens/apostrophes, and multi-word phrases matched verbatim (internal spaces included). No normalization of any kind. |
| D7 | **Keep both** "Add to dictionary" (D5) and the existing "Save anyway with my own meaning" (quick vocab-only save). They are distinct flows. |
| D8 | **On Return = spelling + non-dictionary word:** show the typed term in **red** and do nothing else (no save, no error modal). Plus a new **"Speak word on Return"** setting (default **off**); when on, pressing Return also speaks the looked-up word. |
| D9 | **No spelling-session cap; mastered reuses vocabulary's definition.** A spelling review continues until all words **due today per the FSRS schedule** have been completed. "Mastered" uses the same definition as vocabulary. |

## 4. Functional requirements

### 4.1 Add to spelling list
- In the search result of a dictionary-matched (or user-dictionary) word, add an **"Add to spelling list"** button beside **"Save to vocabulary"**.
- Shows **"In spelling list"** (disabled) when already added.
- Hidden/disabled for terms with no dictionary match (offer **Add to dictionary** instead, per D5).

### 4.2 "On Return" setting
- Settings → a labelled select **On Return**: `Save to vocabulary` (default) · `Save to spelling list` · `Do nothing`.
- Replaces the **Autosave** checkbox (and its dwell timer).
- Behaviour on Return: always run the lookup + add history; then, **only if the term is a dictionary/user-dictionary word**, apply the configured save (to vocabulary or spelling).
- **On Return = "spelling" but the typed term is not a dictionary word:** render the term in **red** as feedback and do nothing else (no save, no modal). The user can use **Add to dictionary** (D5) to make it eligible.
- New independent setting **"Speak word on Return"** (toggle, default **off**): when enabled, pressing Return also speaks the looked-up word via `speakTerm`.
- Persisted in `kv`, included in the synced snapshot, migrated from the old `autosaveEnabled` flag.

### 4.3 Add to dictionary (D5)
- On a `not_found` result, show an **"Add to dictionary"** button.
- Modal fields: **Term** (prefilled), **Pronunciation / IPA** (optional), **English meaning** (≥1), **Chinese meaning** (optional but recommended). At least one meaning required.
- Reject if the term already exists in the shipped dictionary (must be a genuinely new word).
- Stored in a new **user dictionary** store; lookups + suggestions overlay it on top of the sql.js results so the word behaves like any dictionary entry.
- Synced + checkpointed.
- **Coexists with** the existing "Save anyway with my own meaning" button (D7): "Save anyway" is a quick vocab-only save with personal meanings; "Add to dictionary" promotes the word to a first-class, searchable, spelling-eligible dictionary entry. Both appear on a `not_found` result.

### 4.4 Spelling review flow
- Entry: **"Spelling Review"** button in the Today section's **Spelling** tab (enabled when there are due or new spelling words).
- On start: render an input field, **move focus to it**, **speak the word** (Web Speech `speakTerm`), and show the **meaning hint** (English + Chinese). The target spelling is hidden. Provide a **repeat-audio** (speaker) button.
- User types and presses **Return** → check the answer with a **strict exact match** (D6): `input === targetWord` — case-sensitive, no trimming, exact hyphens/apostrophes, phrases matched verbatim including internal spaces.
  - **Correct:** turn the feedback word **dark green for ~1s**, clear the input, increment the consecutive-correct counter, then **auto-advance** (next prompt for the same word until 3-in-a-row, then next word).
  - **Wrong:** show the **correct word in a larger font, dark green, below the input**; show a **Retry** button; reset the consecutive-correct counter to 0; count a miss for this word's rating.
  - **Retry:** clear the input and the revealed word, **speak the word again**, await input.
- A word is **completed only after 3 consecutive correct spellings within the session**.
- On completion, record a **spelling study event** with the rating derived from the session's miss count (D1) → FSRS schedules the next due date.
- Session word selection: **no cap** (D9) — continue until every spelling word **due today per the FSRS schedule** has been completed; new words follow the same due logic as vocabulary. End-of-session summary like the vocabulary review.

### 4.5 Today section — Spelling tab
- Add a tab switch: **Memorize** (existing vocabulary) | **Spelling** (new).
- Spelling tab shows today's **new / reviewed / mastered** counts for the spelling list and the **Spelling Review** action (and optionally "Spell one more").
- The two tabs never share counts.

### 4.6 Vocabulary stats section — Spelling tab
- Add a tab switch: **Vocabulary** (existing) | **Spelling**.
- Spelling tab shows **total / again / hard / good / easy** using the same browser UI, driven by each spelling item's latest derived rating.

### 4.7 History section — Spelling tab
- Add a tab switch: **Vocabulary** | **Spelling**.
- Spelling chart mirrors the vocabulary chart (new / reviewed / level-up / level-down or mastered) over the same day/week/month ranges.

## 5. Data model

New encrypted IndexedDB stores (mirroring the existing shapes):

- `spellingRecords` — `{ term, normalizedTerm, original: {word, phonetic, englishMeanings, chineseMeanings}, review: <FSRS state>, savedAt, updatedAt, archivedAt, syncVersion, isSynced }`.
- `spellingEventRecords` — immutable spelling study events: `{ id, term, rating, retries, reviewedAt, syncVersion, debugSessionId? }`.
- `userDictionary` — `{ normalizedTerm, word, phonetic, englishMeanings, chineseMeanings, createdAt, updatedAt, syncVersion }`.

Settings:
- `onReturnAction`: `"vocabulary" | "spelling" | "none"` (replaces `autosaveEnabled`).
- `speakOnReturn`: boolean, default `false` (D8).

Snapshot / sync (`buildUserDataSnapshot`, `mergeSnapshots`, `applyUserDataSnapshot`):
- Add `spellingItems`, `spellingEvents`, `userDictionary`, `onReturnAction` to the snapshot.
- Merge with the same timestamp/last-write-wins helpers used for vocabulary/study events.
- Restore atomically inside the existing replace transaction; service-worker cache replacement must never touch these stores.
- DB version bump in `openUserDb` to create the new object stores.

## 6. Migration

- `autosaveEnabled` → `onReturnAction`: `true` → `"vocabulary"`, `false` → `"none"` (default for new installs: `"vocabulary"`). Keep reading the legacy flag once for migration, then write `onReturnAction`.

## 7. Sync / persistence requirements

- All new stores are user-authoritative: encrypted, included in Drive snapshots + checkpoints, restored atomically, and must survive shell updates.
- `syncVersion` on every spelling event (Tier-2 event-log sync ready).
- API keys / tokens remain excluded from the snapshot (unchanged).

## 8. Out of scope (for now)

- Partial-credit / fuzzy spelling acceptance, typing-speed analytics, per-letter hints.
- Editing/merging shipped dictionary entries (user dictionary is additive only).
- Importing external spelling lists.

## 9. Resolved questions

1. **Add to dictionary vs. "Save anyway with my own meaning":** keep **both** (D7).
2. **"Mastered" for spelling:** reuse the vocabulary definition (D9).
3. **Session cap:** none — review all words due today per FSRS (D9).
4. **Spelling check normalization:** strict exact match, case-sensitive, no trim, exact hyphens/apostrophes, phrases verbatim (D6).
5. **On Return = "spelling" with a non-dictionary word:** show the term in red, do nothing else (D8).

Remaining minor decision:
- **Audio voice/locale:** default to the existing `speakTerm` behaviour unless an en-US voice is requested later.

## 10. Test plan (automation, when implemented)

Headless Playwright smokes to add (mirroring existing patterns):
- Add-to-spelling button: adds a dictionary word; idempotent; hidden for non-dictionary terms.
- `onReturnAction` setting: each of the 3 modes does the right save on Return; migration from `autosaveEnabled`.
- Spelling review engine: correct → green + auto-advance; wrong → reveal + Retry; 3-in-a-row required to advance; rating derived from miss count (0/1/2/3+ → easy/good/hard/again).
- Today / stats / history **Spelling tabs** render independent counts.
- Add-to-dictionary: new word becomes searchable via overlay; rejected if it already exists.
- Sync: spelling stores + user dictionary round-trip through the two-device mock-Drive test.

## 11. Versioning note

Implementation will bump the shell version (`APP_VERSION`, `SHELL_CACHE_VERSION`, `?v=` query
strings, `automated-tests` cache name) in lockstep, per CLAUDE.md. No version change is made
by this PRD.

---

## Requirements tracker

| ID | Requirement | Status |
|----|-------------|--------|
| SP-1 | "Add to spelling list" button on dictionary results | done (v52) |
| SP-2 | "On Return" 3-way setting (replaces Autosave) + migration; non-dictionary word shows red | done (v52) |
| SP-2b | "Speak word on Return" setting (default off) | done (v52) |
| SP-3 | "Add to dictionary" + user-dictionary overlay | done (v52) |
| SP-4 | Spelling review engine (audio, hint, retry, 3-in-a-row, auto-advance) | done (v52) |
| SP-5 | Rating derivation (retries → easy/good/hard/again) + FSRS scheduling | done (v52) |
| SP-6 | Today section Spelling tab (new/reviewed/mastered) | done (v52) |
| SP-7 | Vocabulary stats Spelling tab (total/again/hard/good/easy) | done (v52) |
| SP-8 | History Spelling tab | done (v52) |
| SP-9 | Data stores + snapshot/merge/restore + sync + checkpoints | done (v52) |
| SP-10 | Automated smoke coverage (smoke-spelling, smoke-onreturn, sync round-trip) | done (v52) |
