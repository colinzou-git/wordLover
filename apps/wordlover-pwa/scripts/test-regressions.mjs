import assert from "node:assert/strict";

process.env.TZ = "America/Los_Angeles";

const {
  forecastGoalWorkload,
  normalizeForecastInput,
} = await import("../public/goal-forecast.js");
const {
  activeStudyTermsFromItems,
  mergeHistoryItems,
  mergeVocabularySources,
} = await import("../public/sync.js");
const {
  buildStudyOneMoreExclusionSets,
  buildSpellingStudyOneMoreExclusionSets,
  studyOneMoreExclusionReason,
} = await import("../public/study-one-more.js");
const {
  rebuildReviewStateFromEvents,
  normalizeReviewState,
} = await import("../public/review-state.js");
const {
  reviveFsrsCard,
  scheduleFromFsrsRating: scheduleFsrs,
} = await import("../public/fsrs-scheduler.js");
const {
  validateBackup,
} = await import("../public/tracks.js");

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("Goals preserve an explicit zero-new-word target", () => {
  const normalized = normalizeForecastInput({ dailyNewWords: 0 });
  assert.equal(normalized.dailyNewWords, 0);

  const forecast = forecastGoalWorkload({
    dailyNewWords: 0,
    forecastDays: 7,
    startMs: new Date("2026-06-18T12:00:00-07:00").getTime(),
  });
  assert.equal(forecast.dailyNewWords, 0);
  assert.ok(forecast.dailyBreakdown.every((day) => day.newWords === 0));
});

test("Goal forecast advances local calendar dates across daylight-saving changes", () => {
  const forecast = forecastGoalWorkload({
    dailyNewWords: 0,
    forecastDays: 7,
    startMs: new Date("2026-10-31T12:00:00-07:00").getTime(),
  });
  assert.deepEqual(
    forecast.dailyBreakdown.slice(0, 4).map((day) => day.date),
    ["2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"],
  );
});

test("Sync history deduplicates case and smart-apostrophe variants", () => {
  const merged = mergeHistoryItems(
    [{ term: "DON'T", queriedAt: "2026-06-18T10:00:00.000Z" }],
    [{ term: "don’t", queriedAt: "2026-06-17T10:00:00.000Z" }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].term, "DON'T");
});

test("Vocabulary sync normalizes legacy modifier-apostrophe keys before merging", () => {
  const merged = mergeVocabularySources(
    [{ term: "don't", normalizedTerm: "don't", updatedAt: "2026-06-18T10:00:00.000Z" }],
    [{ term: "donʼt", normalizedTerm: "donʼt", updatedAt: "2026-06-17T10:00:00.000Z" }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].normalizedTerm, "don't");
});

test("Active-study terms normalize term-only legacy records", () => {
  const terms = activeStudyTermsFromItems([{ term: "DON’T" }], []);
  assert.deepEqual([...terms], ["don't"]);
});

test("Study One More exclusions match full-width apostrophe variants", () => {
  const exclusions = buildStudyOneMoreExclusionSets({
    vocabulary: [{ term: "DON＇T", normalizedTerm: "don＇t" }],
  });
  assert.equal(
    studyOneMoreExclusionReason({ normalizedTerm: "don't" }, exclusions),
    "memorize",
  );
});

test("Memorize Study One More still blocks words on the Memorize list", () => {
  const exclusions = buildStudyOneMoreExclusionSets({
    vocabulary: [{ term: "alpha", normalizedTerm: "alpha" }],
    spelling: [{ term: "bravo", normalizedTerm: "bravo" }],
  });
  assert.equal(studyOneMoreExclusionReason({ normalizedTerm: "alpha" }, exclusions), "memorize");
  assert.equal(studyOneMoreExclusionReason({ normalizedTerm: "bravo" }, exclusions), "spelling");
});

test("Spelling Study One More blocks active spelling but allows memorize-only terms", () => {
  const exclusions = buildSpellingStudyOneMoreExclusionSets({
    spelling: [{ term: "alpha", normalizedTerm: "alpha" }],
  });
  // The active spelling word is blocked...
  assert.equal(studyOneMoreExclusionReason({ normalizedTerm: "alpha" }, exclusions), "spelling");
  // ...but a word only in Memorize (not in this set) stays eligible, and the builder omits memorize.
  assert.equal(studyOneMoreExclusionReason({ normalizedTerm: "bravo" }, exclusions), null);
  assert.equal(exclusions.memorizeTerms, undefined);
  assert.equal(exclusions.knownTerms, undefined);
});

test("Spelling Study One More exclusions normalize apostrophe variants", () => {
  const exclusions = buildSpellingStudyOneMoreExclusionSets({
    spelling: [{ term: "IT＇S", normalizedTerm: "it＇s" }],
  });
  assert.equal(studyOneMoreExclusionReason({ normalizedTerm: "it's" }, exclusions), "spelling");
});

test("Spelling Study One More keeps archived spelling out of default discovery", () => {
  const exclusions = buildSpellingStudyOneMoreExclusionSets({
    spelling: [{ term: "gone", normalizedTerm: "gone", archivedAt: "2026-06-01T00:00:00.000Z" }],
  });
  assert.equal(exclusions.spellingTerms.has("gone"), false);
  assert.equal(studyOneMoreExclusionReason({ normalizedTerm: "gone" }, exclusions), "archivedIgnoredOrMastered");
});

test("Review replay matches normalized apostrophe variants", () => {
  const occurredAt = "2026-06-18T10:00:00.000Z";
  const review = rebuildReviewStateFromEvents(
    { term: "don't", savedAt: "2026-06-17T10:00:00.000Z" },
    [{
      id: "review-1",
      type: "review",
      term: "DONʼT",
      normalizedTerm: "donʼt",
      rating: "good",
      occurredAt,
    }],
    Date.parse(occurredAt),
  );
  assert.equal(review.reviewCount, 1);
  assert.equal(review.lastRating, "good");
});

test("Backup validation normalizes full-width apostrophes", () => {
  const backup = validateBackup({
    schemaVersion: 1,
    app: "WordFan",
    exportedAt: "2026-06-18T10:00:00.000Z",
    activeTrackId: "track_test",
    globalSettings: {},
    tracks: {
      track_test: {
        id: "track_test",
        name: "Test",
        wordLists: {
          vocabulary: [{ term: "DON＇T", savedAt: "2026-06-18T10:00:00.000Z" }],
        },
        spellingLists: { spelling: [] },
        reviewLogs: [],
        spellingReviewLogs: [],
        customWords: [],
        memorizedWords: [],
        searchHistory: [],
      },
    },
  });
  assert.equal(
    backup.tracks.track_test.wordLists.vocabulary[0].normalizedTerm,
    "don't",
  );
});

test("FSRS revives an inconsistent card (difficulty 5, stability 0) as new", () => {
  // Repro of the production crash: a legacy/imported card whose memory state FSRS
  // rejects with "Invalid memory state { difficulty: 5, stability: 0 }". One such
  // card broke saving a spelling review and Drive sync for the whole collection.
  const revived = reviveFsrsCard(
    { difficulty: 5, stability: 0, state: "review", due: "2026-06-23T00:00:00.000Z" },
    "2026-06-23T00:00:00.000Z",
  );
  assert.equal(revived.difficulty, 0);
  assert.equal(revived.stability, 0);

  // Scheduling it must now succeed instead of throwing.
  const schedule = scheduleFsrs(
    { fsrsCard: { difficulty: 5, stability: 0, state: "review" }, dueAt: "2026-06-23T00:00:00.000Z" },
    "good",
    "2026-06-23T01:00:00.000Z",
  );
  assert.ok(Number.isFinite(Date.parse(schedule.dueAt)));
  assert.ok(schedule.fsrsCard.difficulty >= 1 && schedule.fsrsCard.stability >= 1e-3);
});

test("FSRS preserves a valid reviewed card", () => {
  // Guard against over-sanitizing: a well-formed reviewed card must pass through.
  const revived = reviveFsrsCard(
    { difficulty: 6.3, stability: 12.5, state: "review", reps: 4, due: "2026-07-01T00:00:00.000Z" },
    "2026-06-23T00:00:00.000Z",
  );
  assert.equal(revived.difficulty, 6.3);
  assert.equal(revived.stability, 12.5);
});

test("normalizeReviewState sanitizes a corrupt card so render/sync cannot throw", () => {
  // normalizeReviewState is on the render + Drive-sync rebuild path; it must hand
  // back a schedulable card even when the stored fsrsCard is inconsistent.
  const normalized = normalizeReviewState({
    fsrsCard: { difficulty: 5, stability: 0, state: "review" },
    dueAt: "2026-06-23T00:00:00.000Z",
  });
  assert.equal(normalized.fsrsCard.difficulty, 0);
  assert.equal(normalized.fsrsCard.stability, 0);
  const schedule = scheduleFsrs(normalized, "again", "2026-06-23T02:00:00.000Z");
  assert.ok(Number.isFinite(Date.parse(schedule.dueAt)));
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`\n${failed} regression test(s) failed.`);
  process.exit(1);
}

console.log(`\n${tests.length} regression tests passed.`);
