import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
  shouldAutoContinueSpellingStudyOneMore,
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
const {
  dictionaryStorageKeys,
  resolveDictionaryAssetUrl,
  resolveDictionaryConfig,
} = await import("../public/dictionary-config.js");
const {
  DEFAULT_DICTIONARY_ID,
  DICTIONARY_REGISTRY,
  userSelectableDictionaries,
} = await import("../public/dictionary-registry.js");
const {
  dictionaryRecordMetadata,
  readSelectedDictionaryId,
  saveSelectedDictionaryId,
} = await import("../public/dictionary-selection.js");
const {
  fullDictionaryStorageConfig,
} = await import("../public/full-dictionary.js");
const {
  canonicalPronunciationKey,
  groupPronunciationsByIpa,
  hasStructuredDictionaryDetail,
  parseDictionaryDetail,
  renderPronunciationLine,
  renderStructuredDictionaryResult,
} = await import("../public/dictionary-rendering.js");

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("Dictionary configuration keeps production URLs by default", () => {
  const config = resolveDictionaryConfig("?fresh=test");
  assert.equal(config.dictionaryManifestUrl, "/dictionary-manifest.json");
  assert.equal(config.fullDictionaryBaseUrl, "/dictionary-full");
  assert.equal(config.mode, "production");
  assert.equal(config.id, "ecdict");
  assert.equal(DEFAULT_DICTIONARY_ID, "ecdict");
});

test("Kaikki release config and resolver priorities are stable", () => {
  const kaikki = resolveDictionaryConfig("", { savedDictionaryId: "kaikki" });
  assert.equal(kaikki.id, "kaikki");
  assert.equal(kaikki.dictionaryManifestUrl, "/kaikki/dictionary-manifest.json");
  assert.equal(kaikki.fullDictionaryBaseUrl, "/kaikki/dictionary-full");
  assert.equal(kaikki.storageScope, "kaikki");
  assert.equal(resolveDictionaryConfig("?dictionary=kaikki", { savedDictionaryId: "ecdict" }).id, "kaikki");
  assert.equal(resolveDictionaryConfig("?dictionary=kaikki", {
    dictionaryId: "ecdict", savedDictionaryId: "kaikki",
  }).id, "ecdict");
  assert.equal(resolveDictionaryConfig("?dictionary=unknown", { savedDictionaryId: "kaikki" }).id, "ecdict");
  assert.deepEqual(userSelectableDictionaries().map((entry) => entry.id), ["ecdict", "kaikki"]);
  assert.equal(DICTIONARY_REGISTRY["kaikki-preview"].isPreview, true);
});

test("Dictionary selection persists normal ids without letting preview queries overwrite it", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readSelectedDictionaryId(storage), "ecdict");
  assert.equal(saveSelectedDictionaryId("kaikki", storage), "kaikki");
  assert.equal(readSelectedDictionaryId(storage), "kaikki");
  assert.equal(resolveDictionaryConfig("?dictionary=kaikki-preview-local", {
    savedDictionaryId: readSelectedDictionaryId(storage),
  }).id, "kaikki-preview-local");
  assert.equal(readSelectedDictionaryId(storage), "kaikki");
  assert.equal(saveSelectedDictionaryId("kaikki-preview", storage), "ecdict");
});

test("Dictionary record metadata is additive and legacy records remain valid", () => {
  const legacy = { term: "charge", normalizedTerm: "charge" };
  assert.equal(legacy.dictionaryId, undefined);
  assert.deepEqual(dictionaryRecordMetadata(DICTIONARY_REGISTRY.kaikki, "v2"), {
    dictionaryId: "kaikki",
    dictionaryLabel: "Kaikki / Wiktextract",
    dictionaryDataVersion: "v2",
  });
  const sameTermAcrossDictionaries = [
    { ...legacy, dictionaryId: "ecdict" },
    { ...legacy, dictionaryId: "kaikki" },
  ];
  assert.equal(new Set(sameTermAcrossDictionaries.map((item) => item.normalizedTerm)).size, 1);
});

test("Production dictionary storage keys remain backward compatible", () => {
  assert.deepEqual(dictionaryStorageKeys("production"), {
    dictionaryKey: "dictionary.sqlite",
    progressKey: "dictionary.sqlite.downloadProgress",
    chunkPrefix: "dictionary.sqlite.chunk.",
    versionKey: "dictionaryDataVersion",
    installedKey: "dictionaryInstalled",
  });
});

test("Kaikki preview configuration uses only isolated URLs", () => {
  const config = resolveDictionaryConfig("?dictionary=kaikki-preview");
  assert.equal(
    config.dictionaryManifestUrl,
    "/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-manifest.json",
  );
  assert.equal(
    config.fullDictionaryBaseUrl,
    "/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-full",
  );
  assert.equal(config.mode, "kaikki-preview");
});

test("Kaikki preview storage keys are isolated from production", () => {
  assert.deepEqual(dictionaryStorageKeys("kaikki-preview"), {
    dictionaryKey: "kaikki-preview.dictionary.sqlite",
    progressKey: "kaikki-preview.dictionary.sqlite.downloadProgress",
    chunkPrefix: "kaikki-preview.dictionary.sqlite.chunk.",
    versionKey: "kaikki-preview.dictionaryDataVersion",
    installedKey: "kaikki-preview.dictionaryInstalled",
  });
  assert.deepEqual(dictionaryStorageKeys("kaikki-preview-local"), {
    dictionaryKey: "kaikki-preview-local.dictionary.sqlite",
    progressKey: "kaikki-preview-local.dictionary.sqlite.downloadProgress",
    chunkPrefix: "kaikki-preview-local.dictionary.sqlite.chunk.",
    versionKey: "kaikki-preview-local.dictionaryDataVersion",
    installedKey: "kaikki-preview-local.dictionaryInstalled",
  });
});

test("Kaikki release SQLite and full-shard storage keys are isolated", () => {
  assert.deepEqual(dictionaryStorageKeys("kaikki"), {
    dictionaryKey: "kaikki.dictionary.sqlite",
    progressKey: "kaikki.dictionary.sqlite.downloadProgress",
    chunkPrefix: "kaikki.dictionary.sqlite.chunk.",
    versionKey: "kaikki.dictionaryDataVersion",
    installedKey: "kaikki.dictionaryInstalled",
  });
  assert.equal(fullDictionaryStorageConfig("kaikki").manifestKey, "wordfan.fullDictionary.kaikki.manifest.v1");
  assert.equal(fullDictionaryStorageConfig("kaikki").cachePrefix, "wordfan-full-dictionary-kaikki-v1-");
});

test("Service worker bypasses cache for release and preview dictionary packages", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /path\.startsWith\("\/kaikki\/"\)/);
  assert.match(source, /path\.startsWith\("\/kaikki-preview\/"\)/);
  assert.match(source, /path\.startsWith\("\/dictionary-full\/"\)/);
  assert.match(source, /isDictionaryAssetPath\(url\.pathname\)/);
});

test("Full dictionary shard storage follows dictionary mode", () => {
  assert.equal(fullDictionaryStorageConfig("production").manifestKey, "wordfan.fullDictionary.manifest.v1");
  assert.equal(fullDictionaryStorageConfig("production").cachePrefix, "wordfan-full-dictionary-v1-");
  assert.equal(
    fullDictionaryStorageConfig("kaikki-preview").manifestKey,
    "wordfan.fullDictionary.kaikki-preview.manifest.v1",
  );
  assert.equal(
    fullDictionaryStorageConfig("kaikki-preview-local").installedVersionKey,
    "wordfan.fullDictionary.kaikki-preview-local.installedVersion.v1",
  );
  assert.equal(
    fullDictionaryStorageConfig("kaikki-preview").cachePrefix,
    "wordfan-full-dictionary-kaikki-preview-v1-",
  );
});

test("Local Kaikki preview configuration uses the isolated local package", () => {
  const config = resolveDictionaryConfig("?dictionary=kaikki-preview-local");
  assert.equal(config.dictionaryManifestUrl, "/kaikki-preview/local/dictionary-manifest.json");
  assert.equal(config.fullDictionaryBaseUrl, "/kaikki-preview/local/dictionary-full");
  assert.equal(config.mode, "kaikki-preview-local");
});

test("Dictionary assets resolve beside the selected manifest", () => {
  assert.equal(resolveDictionaryAssetUrl("/dictionary-manifest.json", "dictionary.sqlite"), "/dictionary.sqlite");
  assert.equal(
    resolveDictionaryAssetUrl("/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-manifest.json", "dictionary.sqlite"),
    "/kaikki-preview/feature-kaikki-dictionary-preview/dictionary.sqlite",
  );
  assert.equal(
    resolveDictionaryAssetUrl("/kaikki-preview/local/dictionary-manifest.json", "dictionary.sqlite"),
    "/kaikki-preview/local/dictionary.sqlite",
  );
});

test("Structured dictionary detail renders bilingual lines, fallback, definitions, and safe HTML", () => {
  const detail = parseDictionaryDetail(JSON.stringify({
    displayMeanings: [
      { pos: "v.", zh: "收费", en: "ask <someone> to pay", domain: null },
      { pos: "n.", zh: null, en: "an <unsafe> charge", domain: "Law" },
      { pos: "n.", zh: "中文而已", en: "", domain: null },
    ],
    translationFallback: { zh: "通用译文", zhSource: "wordfan-full-overlay" },
    detailedDefinitions: [{
      pos: "Noun",
      senses: [{ definition: "an accusation", domain: "Law", examples: ["a <quoted> example"] }],
    }],
  }));
  assert.equal(hasStructuredDictionaryDetail(detail), true);
  const html = renderStructuredDictionaryResult({}, detail);
  assert.equal((html.match(/structured-meaning-line/g) ?? []).length, 2);
  assert.match(html, /收费.*\|.*ask &lt;someone&gt; to pay/);
  assert.match(html, /中文而已/);
  assert.doesNotMatch(html, /中文而已.*\|/);
  assert.doesNotMatch(html, /an &lt;unsafe&gt; charge/);
  assert.match(html, /Other Chinese meanings:<\/strong> 通用译文/);
  assert.ok(html.indexOf("structured-meaning-line") < html.indexOf("structured-translation-fallback"));
  assert.ok(html.indexOf("structured-translation-fallback") < html.indexOf("detailed-definitions"));
  assert.match(html, /<h4>Noun:<\/h4><ol><li>/);
  assert.match(html, /a &lt;quoted&gt; example/);
  assert.doesNotMatch(html, /<unsafe>|<quoted>/);
});

test("Malformed or legacy dictionary detail does not activate structured rendering", () => {
  assert.equal(parseDictionaryDetail("{bad"), null);
  assert.equal(parseDictionaryDetail(null), null);
  assert.equal(hasStructuredDictionaryDetail(parseDictionaryDetail('{"unrelated":true}')), false);
});

test("POS-specific pronunciations render inline with one speaker per pronunciation", () => {
  const detail = {
    pronunciations: [
      { pos: "n.", ipa: "/ˈrɛkɔrd/", source: "kaikki" },
      { pos: "v.", ipa: "/rɪˈkɔrd/", source: "kaikki" },
      { pos: "n.", ipa: "/ˈrɛkɔrd/", source: "kaikki" },
    ],
  };
  const html = renderPronunciationLine("record", detail);
  assert.match(html, /n\..*\/ˈrɛkɔrd\/.*\|.*v\..*\/rɪˈkɔrd\//);
  assert.equal((html.match(/pronunciation-speaker/g) ?? []).length, 2);
  assert.equal((html.match(/data-speak-term="record"/g) ?? []).length, 2);
  assert.equal(renderPronunciationLine("free", { pronunciations: [{ pos: "adj.", ipa: "/fri/" }] }), "");
  assert.equal(renderPronunciationLine("legacy", null), "");
});

test("Identical cross-POS pronunciations collapse and mixed IPA groups combine POS labels", () => {
  assert.equal(canonicalPronunciationKey("ˈsame/"), "/ˈsame/");
  assert.equal(canonicalPronunciationKey("/ˈsame"), "/ˈsame/");
  assert.equal(canonicalPronunciationKey("[ˈsame]"), "/ˈsame/");
  const same = { pronunciations: [{ pos: "n.", ipa: "ˈsame/" }, { pos: "v.", ipa: "/ˈsame" }] };
  assert.equal(renderPronunciationLine("dictionary", same), "");
  const grouped = groupPronunciationsByIpa([
    { pos: "n.", ipa: "/A/" }, { pos: "adj.", ipa: "[A]" }, { pos: "v.", ipa: "/B/" },
  ]);
  assert.deepEqual(grouped, [
    { ipa: "/A/", positions: ["n.", "adj."] },
    { ipa: "/B/", positions: ["v."] },
  ]);
  const html = renderPronunciationLine("record", { pronunciations: [
    { pos: "n.", ipa: "/A/" }, { pos: "adj.", ipa: "A/" }, { pos: "v.", ipa: "/B" },
  ] });
  assert.match(html, /n\., adj\..*\/A\/.*\|.*v\..*\/B\//);
  assert.equal((html.match(/pronunciation-speaker/g) ?? []).length, 2);
});

test("Entry translation sense labels render as compact bilingual meanings", () => {
  const html = renderStructuredDictionaryResult({}, {
    displayMeanings: [{
      pos: "n.", zh: "字典, 词典, 辞典, 辞林",
      en: "publication that explains the meanings of an ordered list of words",
    }],
  });
  assert.match(html, /字典, 词典, 辞典, 辞林.*\|.*publication that explains/);
});

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

test("Spelling Study One More auto-continues only for autoNext spelling-study-one-more sessions", () => {
  assert.equal(
    shouldAutoContinueSpellingStudyOneMore({ autoNext: true, source: "spelling-study-one-more" }),
    true,
  );
  // autoNext off → ends normally even from the same source.
  assert.equal(
    shouldAutoContinueSpellingStudyOneMore({ autoNext: false, source: "spelling-study-one-more" }),
    false,
  );
  // Review/practice/manual sources never auto-continue, even if some caller sets autoNext.
  assert.equal(
    shouldAutoContinueSpellingStudyOneMore({ autoNext: true, source: "practice" }),
    false,
  );
  assert.equal(
    shouldAutoContinueSpellingStudyOneMore({ autoNext: true, source: "review" }),
    false,
  );
  assert.equal(
    shouldAutoContinueSpellingStudyOneMore({ autoNext: true, source: "manual" }),
    false,
  );
  assert.equal(shouldAutoContinueSpellingStudyOneMore(null), false);
  assert.equal(shouldAutoContinueSpellingStudyOneMore(undefined), false);
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
