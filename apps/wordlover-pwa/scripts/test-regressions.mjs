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
  studyOneMoreExclusionReason,
} = await import("../public/study-one-more.js");
const {
  rebuildReviewStateFromEvents,
} = await import("../public/review-state.js");
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

test("Review replay normalizes apostrophe variants and uppercase ratings", () => {
  const occurredAt = "2026-06-18T10:00:00.000Z";
  const review = rebuildReviewStateFromEvents(
    { term: "don't", savedAt: "2026-06-17T10:00:00.000Z" },
    [{
      id: "review-1",
      type: "review",
      term: "DONʼT",
      normalizedTerm: "donʼt",
      rating: "GOOD",
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
