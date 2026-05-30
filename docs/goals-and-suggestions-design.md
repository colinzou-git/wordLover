# Goals & Suggestions — design spec

Status: **implemented in v64** (Goals panel, wizard, suggestions, sync). This
doc is the design of record; see the "Why deferred" note at the end for the
history. Vocabulary (Memorize) track only for v1; data model leaves room for
Spelling. Verified headless (Chromium): panel renders, `getGoals`/`setGoals`/
`openGoalsWizard` work, wizard opens with 4 number fields, day/week/month
targets recompute, suggestions are specific and numeric, and the panel sits in
the right column at iPad-landscape width / full width on iPhone. Real-iPhone
visual pass still pending.

## What the user asked for

- Let the user set **quantified goals**, guided by a **wizard**: how many words
  to master per day / week / month (plus the input pace that feeds it).
- Provide **suggestions on how to do better**: how many more new words and how
  many more reviews per day / week / month to stay on target, and **what time of
  day** to do more reviews or add more new words.

## Targets the user sets (all editable, smart-prefilled)

- New words per day
- Reviews per day
- Words mastered per week
- Words mastered per month

Daily is the primary planning unit; week/month roll up from daily activity, and
the mastery targets are tracked week-to-date / month-to-date.

## Smart defaults (prefilled in the wizard)

Behaviour-derived when history exists, else gentle starters:

| Target | Default rule | Starter |
|---|---|---|
| New words/day | round(median daily new, last 14 active days), clamp 3–20 | 5 |
| Reviews/day | round(median daily reviews, last 14 active days), clamp 5–40 | 15 |
| Mastered/week | new-words/day × 5 active days × ~0.7 mastery, clamp ≥3 | 5 |
| Mastered/month | mastered/week × 4 (independently editable) | 20 |

Every field is prefilled and editable; a **"Use suggested"** affordance accepts
all. The wizard never blocks — soft-flag inconsistencies (e.g. month < week×4)
without preventing save.

## Wizard

Single guided modal built on the existing `showModal({ title, body, fields })`
helper (it already supports `type`, `value`, `inputmode`, `placeholder`, `key`
and resolves to a values object). Four number fields (`type:"number"`,
`inputmode:"numeric"`), each with the suggested value prefilled and a hint in the
body text ("You've averaged ~6 new words/day over the last 2 weeks"). Launched
from a **"Set goals"** button in the Goals panel, and auto-offered once
(non-modally) after ≥7 days of activity with no goals set.

(A multi-step wizard is a nice-to-have; the single guided form is the robust v1
and still "guides" via prefilled, behaviour-derived suggestions.)

## Goals panel (main page, directly under "Today")

- **Day / Week / Month** toggle (mirrors the History panel's granularity control).
- Progress bars for the active period: New, Reviews, Mastered.
- A **streak** indicator (consecutive days meeting the daily pace) — derived, no
  new storage.
- **Suggestions block** (below).
- **Set goals / Edit goals** button → opens the wizard prefilled.
- Before goals exist: one friendly CTA card.

## Suggestions engine (derived at render time; NO new persisted data)

Inputs already in the code:
- `studyEvents[]`: `{ type, term, normalizedTerm, rating, responseMs, occurredAt }`
  — review events are `type === "review"`; `occurredAt` is ISO → day + hour.
- `vocabularyItems[].review`: `{ reviewCount, lastReviewedAt, masteredAt, dueAt, fsrsCard }`.
- Reusable helpers: `studyStatsForRange(events, items, startMs, endMs)` →
  `{ newSaved, reviewed, mastered }`; `getDueVocabularyItems()`;
  `startOfDayMs()`, `dayLengthMs()`, `appNowMs()` (keeps debug time-scaling working).

Suggestions (show only those that apply, ranked by impact; each one short, specific, numeric):
1. **Pace gap this period** — `target − done` for the active period, and the
   per-remaining-day rate for week/month ("3 more reviews today" / "~4 new
   words/day for the next 5 days").
2. **Mastery trajectory** — mastered-to-date vs a linear target line; "on track"
   or "behind by N", with the catch-up rate.
3. **Best time of day** — bucket past reviews by hour-of-day from `occurredAt`;
   if a window has clearly higher volume/accuracy (rating ≥ good), suggest "You
   review best around 8–9am — do reviews then." Require a minimum sample
   (~20 reviews) before showing.
4. **Due backlog** — if `getDueVocabularyItems()` keeps growing, suggest the
   reviews/day (or lower new-words/day) that stabilises it.
5. **Auto-tune** — beat targets 7+ days running → offer to raise; miss 5+ days →
   offer to lower to a sustainable number.

## Data model & persistence

Encrypted KV record in the existing user store:

```js
// key: "studyGoals"
{
  version: 1,
  track: "vocabulary",
  newPerDay: 5,
  reviewsPerDay: 15,
  masteredPerWeek: 5,
  masteredPerMonth: 20,
  createdAt: ISO,
  updatedAt: ISO,
  source: "wizard" | "suggested-bump",
}
```

- Persist with `saveValue("studyGoals", …)`, load with
  `loadValue("studyGoals", null)` at startup (same pattern as `aiChatCache`,
  `history`, `geminiApiKeyOverride`).
- **Add to the sync snapshot**: include `studyGoals` in `buildUserDataSnapshot()`
  and carry it in `mergeUserDataSnapshots()` (newest `updatedAt` wins, mirroring
  how `autosaveEnabled` / `onReturnAction` / `themePreference` are merged via
  `pickNewerSnapshot`). This is the only sync touch-point.
- Expose `getGoals` / `setGoals` and `studyGoals` in `getState()` on
  `window.WordLoverApp` so the headless smoke test can assert it.

## Code touch-points

- `index.html`: `<section class="panel goals-panel" id="goalsPanel">` after the
  study panel.
- `styles.css`: `.goals-panel`, progress bars, `.goals-suggestions`; it
  participates in the ≥980px two-column grid automatically as a normal `.panel`.
- `app.js`:
  - DOM refs + `let studyGoals = null; let goalsPeriod = "day";`
  - load `studyGoals` at startup (where other `loadValue` calls run).
  - `goalDefaults()`, `studyStatsForPeriod(period)` (wrap `studyStatsForRange`),
    `openGoalsWizard()`, `saveStudyGoals()`, `bestReviewHour()`,
    `computeGoalSuggestions()`, `renderGoalsPanel()`.
  - call `renderGoalsPanel()` everywhere `renderStudyStats()` is already called,
    plus on init and after restore.
  - period-tab + "Set goals" event handlers.
  - snapshot build + merge: include `studyGoals`.
  - `WordLoverApp`: add `getGoals`, `setGoals`, `studyGoals` in `getState()`.
- Version bump in lockstep (v63 → v64) across app.js / sw.js / index.html /
  automated-tests.{html,js}; `scripts/check_versions.py` enforces it.
- `prd.md`: add the new requirement rows with Status.
- Tests: extend `smoke-headless.py` (or add `smoke-goals.py`) to assert the
  panel renders, `getGoals/setGoals` work, the wizard opens, and suggestions
  compute with and without history.

## Verification plan

1. `node --check app.js` + `check_versions.py` (both in CI).
2. Headless smoke: panel present, `WordLoverApp.getGoals/setGoals` work, wizard
   overlay opens, suggestions compute with/without history.
3. Responsive: Goals panel sits in the right column at iPad-landscape width,
   full-width single column on iPhone.
4. Real-iPhone visual pass — the only place ring/bar rendering and tap targets
   are truly confirmed; treat as unverified until done on device.

## Why deferred

Drafted during a session where the Read/Bash tool output intermittently returned
corrupted line numbers and content. Safely Editing a 6,300-line `app.js` requires
trustworthy exact-string reads; making precise multi-site edits under garbled
output risks corrupting the file. This spec captures the full design so the
feature can be implemented in one clean pass once tooling is stable.
