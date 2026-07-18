// Pure learning-track + backup helpers. No DOM, no globals, no IndexedDB.
//
// The live app stores each track's data in the existing per-record IndexedDB stores,
// tagged with `learningTrackId`. This module only shapes the export/import JSON and the
// in-kv track registry (`userDataRoot`). Keeping it pure lets automated-tests.js exercise
// migration, export, validation, and import as plain unit tests (like persistence.js and
// sync.js).

export const BACKUP_SCHEMA_VERSION = 2;
export const BACKUP_APP = "WordFan";
export const DEFAULT_TRACK_ID = "track_default";
export const DEFAULT_TRACK_NAME = "Default Track";

// Settings that are safe to round-trip in a backup. Anything NOT listed here — Gemini API
// key, Google OAuth tokens/grant/profile, client-id override, backup passphrase, AI-chat
// cache — is intentionally excluded so secrets can never leak into an exported file.
export const GLOBAL_SETTINGS_ALLOWED = ["theme", "fontScale", "onReturnAction", "speakOnReturn", "uiPreferences"];
const FSRS_RATINGS = new Set(["again", "hard", "good", "easy"]);
const SPELLING_ERROR_CATEGORIES = new Set([
  "missing-letter", "extra-letter", "adjacent-transposition", "repeated-letter",
  "vowel-confusion", "apostrophe-or-hyphen", "letter-substitution", "multiple-edits",
]);

export function newTrackId(rng) {
  const random = typeof rng === "function" ? rng : Math.random;
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `track_${crypto.randomUUID()}`;
  return `track_${Date.now().toString(16)}-${Math.floor(random() * 1e9).toString(16)}`;
}

// Keep only the allow-listed global settings; never copy secrets through.
export function pickGlobalSettings(raw = {}) {
  const out = {};
  for (const key of GLOBAL_SETTINGS_ALLOWED) {
    if (raw && raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}

// Build the minimal registry written to the `userDataRoot` kv key when local data is still
// in the old single-track shape. The record re-keying itself happens in app.js.
export function migrateLegacyToRoot(now) {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    activeTrackId: DEFAULT_TRACK_ID,
    tracks: {
      [DEFAULT_TRACK_ID]: { id: DEFAULT_TRACK_ID, name: DEFAULT_TRACK_NAME, createdAt: now, updatedAt: now },
    },
  };
}

function fsrsCardsFromItems(items) {
  const map = {};
  for (const item of items ?? []) {
    if (item && item.normalizedTerm) map[item.normalizedTerm] = item?.review?.fsrsCard ?? null;
  }
  return map;
}

function ignoredFromItems(items) {
  return (items ?? []).filter((item) => item && item.ignoredAt).map((item) => item.normalizedTerm);
}

// Serialize one track's grouped record data into the LearningTrack export shape. Vocabulary
// and spelling records are carried verbatim (so review.fsrsCard / due dates survive a
// round-trip exactly); fsrsCards/ignoredWords are derived, human-readable projections.
export function serializeTrack(meta = {}, data = {}) {
  const vocabulary = data.vocabulary ?? [];
  const spelling = data.spelling ?? [];
  return {
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt ?? null,
    updatedAt: meta.updatedAt ?? null,
    goals: data.goals ?? null,
    studyOneMoreState: { filter: data.studyOneMoreFilter ?? null },
    wordLists: { vocabulary },
    spellingLists: { spelling },
    ignoredWords: ignoredFromItems(vocabulary),
    customWords: data.userDictionary ?? [],
    memorizedWords: data.known ?? [],
    searchHistory: data.history ?? [],
    fsrsCards: fsrsCardsFromItems(vocabulary),
    reviewLogs: data.studyEvents ?? [],
    spellingReviewLogs: data.spellingEvents ?? [],
    stats: {
      vocabularyCount: vocabulary.filter((item) => item && !item.archivedAt).length,
      spellingCount: spelling.length,
      memorizedCount: (data.known ?? []).length,
    },
  };
}

// Inverse of serializeTrack: extract the writable record arrays from a serialized track.
export function trackRecords(track = {}) {
  return {
    vocabulary: track.wordLists?.vocabulary ?? [],
    spelling: track.spellingLists?.spelling ?? [],
    userDictionary: track.customWords ?? [],
    known: track.memorizedWords ?? [],
    history: track.searchHistory ?? [],
    studyEvents: track.reviewLogs ?? [],
    spellingEvents: track.spellingReviewLogs ?? [],
    goals: track.goals ?? null,
    studyOneMoreFilter: track.studyOneMoreState?.filter ?? null,
  };
}

// input: { activeTrackId, tracks: {id: meta}, globalSettings: rawSettings, trackData: {id: groupedData} }
export function buildBackup(input = {}, now) {
  const tracks = {};
  for (const [id, meta] of Object.entries(input.tracks ?? {})) {
    tracks[id] = serializeTrack(meta, input.trackData?.[id] ?? {});
  }
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP,
    exportedAt: now,
    activeTrackId: input.activeTrackId ?? DEFAULT_TRACK_ID,
    globalSettings: pickGlobalSettings(input.globalSettings ?? {}),
    tracks,
    ...(Array.isArray(input.dictionarySupplements) ? { dictionarySupplements: cloneJson(input.dictionarySupplements) } : {}),
  };
}

function hasTrackMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function cloneJson(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeBackupTerm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[‘’ʼ`＇]/g, "'")
    .replace(/\s+/g, " ");
}

function validOptionalDate(value) {
  return value === null || value === undefined || value === "" || Number.isFinite(Date.parse(value));
}

function assertArray(value, path) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`Backup ${path} must be an array.`);
  return value;
}

function assertValidDate(value, path) {
  if (!validOptionalDate(value)) throw new Error(`Backup ${path} has an invalid date.`);
}

function assertValidRating(value, path) {
  if (value !== undefined && value !== null && value !== "" && !FSRS_RATINGS.has(String(value).toLowerCase())) {
    throw new Error(`Backup ${path} has an invalid FSRS rating.`);
  }
}

function normalizeTermRecord(record, path, termKey = "term") {
  if (!isPlainObject(record)) throw new Error(`Backup ${path} must be an object.`);
  const term = record[termKey] ?? record.term ?? record.word ?? record.normalizedTerm;
  const normalizedTerm = normalizeBackupTerm(record.normalizedTerm ?? term);
  if (!normalizedTerm) throw new Error(`Backup ${path} is missing a term/normalizedTerm.`);
  return { ...record, normalizedTerm };
}

function validateFsrsCard(card, path) {
  if (card === undefined || card === null) return;
  if (!isPlainObject(card)) throw new Error(`Backup ${path} must be an object.`);
  for (const key of ["due", "last_review"]) assertValidDate(card[key], `${path}.${key}`);
  for (const key of ["stability", "difficulty", "elapsed_days", "scheduled_days", "reps", "lapses"]) {
    if (card[key] !== undefined && card[key] !== null && !Number.isFinite(Number(card[key]))) {
      throw new Error(`Backup ${path}.${key} must be numeric.`);
    }
  }
}

function validateReviewState(review, path) {
  if (review === undefined || review === null) return null;
  if (!isPlainObject(review)) throw new Error(`Backup ${path} must be an object.`);
  assertValidDate(review.dueAt, `${path}.dueAt`);
  assertValidDate(review.lastReviewedAt, `${path}.lastReviewedAt`);
  assertValidDate(review.masteredAt, `${path}.masteredAt`);
  assertValidRating(review.lastRating, `${path}.lastRating`);
  validateFsrsCard(review.fsrsCard, `${path}.fsrsCard`);
  return { ...review };
}

function validateItemRecord(record, path) {
  const normalized = normalizeTermRecord(record, path);
  for (const key of ["savedAt", "updatedAt", "archivedAt", "ignoredAt"]) assertValidDate(normalized[key], `${path}.${key}`);
  const review = validateReviewState(normalized.review, `${path}.review`);
  return review ? { ...normalized, review } : normalized;
}

function validateSpellingAttempt(attempt, path) {
  if (!isPlainObject(attempt)) throw new Error(`Backup ${path} must be an object.`);
  if (typeof attempt.submitted !== "string") throw new Error(`Backup ${path}.submitted must be a string.`);
  if (typeof attempt.normalizedSubmitted !== "string") throw new Error(`Backup ${path}.normalizedSubmitted must be a string.`);
  if (typeof attempt.correct !== "boolean") throw new Error(`Backup ${path}.correct must be boolean.`);
  if (!Number.isInteger(attempt.sequence) || attempt.sequence < 1) throw new Error(`Backup ${path}.sequence must be a positive integer.`);
  if (!Number.isFinite(Number(attempt.responseMs)) || Number(attempt.responseMs) < 0) throw new Error(`Backup ${path}.responseMs must be non-negative.`);
  if (!Number.isInteger(attempt.editDistance) || attempt.editDistance < 0) throw new Error(`Backup ${path}.editDistance must be a non-negative integer.`);
  if (!Number.isInteger(attempt.lengthDelta)) throw new Error(`Backup ${path}.lengthDelta must be an integer.`);
  const categories = assertArray(attempt.categories, `${path}.categories`);
  for (const category of categories) {
    if (!SPELLING_ERROR_CATEGORIES.has(category)) throw new Error(`Backup ${path}.categories contains an unsupported value.`);
  }
  return { ...attempt, categories: [...categories] };
}

function validateSpellingDiagnostics(event, path) {
  if (event.attempts === undefined) return event;
  const attempts = assertArray(event.attempts, `${path}.attempts`)
    .map((attempt, index) => validateSpellingAttempt(attempt, `${path}.attempts[${index}]`));
  if (!Number.isInteger(event.attemptCount) || event.attemptCount !== attempts.length) throw new Error(`Backup ${path}.attemptCount must equal attempts.length.`);
  for (const key of ["firstAttemptCorrect", "remediationCompleted", "answerRevealed"]) {
    if (event[key] !== undefined && typeof event[key] !== "boolean") throw new Error(`Backup ${path}.${key} must be boolean.`);
  }
  if (!isPlainObject(event.errorProfile)) throw new Error(`Backup ${path}.errorProfile must be an object.`);
  const profileCategories = assertArray(event.errorProfile.categories, `${path}.errorProfile.categories`);
  if (profileCategories.some((category) => !SPELLING_ERROR_CATEGORIES.has(category))) throw new Error(`Backup ${path}.errorProfile.categories contains an unsupported value.`);
  const repeated = assertArray(event.errorProfile.repeatedIncorrectForms, `${path}.errorProfile.repeatedIncorrectForms`);
  if (repeated.some((value) => typeof value !== "string")) throw new Error(`Backup ${path}.errorProfile.repeatedIncorrectForms must contain strings.`);
  if (!Number.isFinite(Number(event.errorProfile.maxEditDistance)) || Number(event.errorProfile.maxEditDistance) < 0) throw new Error(`Backup ${path}.errorProfile.maxEditDistance must be non-negative.`);
  return { ...event, attempts };
}

function validateEventRecord(record, path) {
  const normalized = normalizeTermRecord(record, path);
  if (!normalized.id && !normalized.eventKey) throw new Error(`Backup ${path} is missing id/eventKey.`);
  if (!normalized.type) throw new Error(`Backup ${path} is missing type.`);
  if (!normalized.occurredAt || !validOptionalDate(normalized.occurredAt)) throw new Error(`Backup ${path}.occurredAt has an invalid date.`);
  if (normalized.rating !== undefined || normalized.type === "review" || normalized.type === "practice") {
    assertValidRating(normalized.rating, `${path}.rating`);
  }
  return validateSpellingDiagnostics(normalized, path);
}

function validateUserDictionaryRecord(record, path) {
  if (!isPlainObject(record)) throw new Error(`Backup ${path} must be an object.`);
  const normalizedTerm = normalizeBackupTerm(record.normalizedTerm ?? record.word);
  if (!normalizedTerm) throw new Error(`Backup ${path} is missing word/normalizedTerm.`);
  if (record.englishMeanings !== undefined && !Array.isArray(record.englishMeanings)) throw new Error(`Backup ${path}.englishMeanings must be an array.`);
  if (record.chineseMeanings !== undefined && !Array.isArray(record.chineseMeanings)) throw new Error(`Backup ${path}.chineseMeanings must be an array.`);
  return { ...record, normalizedTerm, word: record.word ?? normalizedTerm };
}

function validateKnownRecord(record, path) {
  const normalized = normalizeTermRecord(record, path);
  assertValidDate(normalized.knownAt, `${path}.knownAt`);
  assertValidDate(normalized.updatedAt, `${path}.updatedAt`);
  return normalized;
}

function validateHistoryRecord(record, path) {
  if (!isPlainObject(record)) throw new Error(`Backup ${path} must be an object.`);
  if (!record.term) throw new Error(`Backup ${path} is missing term.`);
  assertValidDate(record.queriedAt ?? record.searchedAt, `${path}.queriedAt`);
  return { ...record };
}

function validateTrack(track, id) {
  if (!isPlainObject(track)) throw new Error(`Backup track ${id} must be an object.`);
  if (track.wordLists !== undefined && !isPlainObject(track.wordLists)) throw new Error(`Backup tracks.${id}.wordLists must be an object.`);
  if (track.spellingLists !== undefined && !isPlainObject(track.spellingLists)) throw new Error(`Backup tracks.${id}.spellingLists must be an object.`);
  if (track.studyOneMoreState !== undefined && !isPlainObject(track.studyOneMoreState)) throw new Error(`Backup tracks.${id}.studyOneMoreState must be an object.`);
  const name = String(track.name ?? "").trim() || "Imported Track";
  const vocabulary = assertArray(track.wordLists?.vocabulary, `tracks.${id}.wordLists.vocabulary`)
    .map((record, index) => validateItemRecord(record, `tracks.${id}.wordLists.vocabulary[${index}]`));
  const spelling = assertArray(track.spellingLists?.spelling, `tracks.${id}.spellingLists.spelling`)
    .map((record, index) => validateItemRecord(record, `tracks.${id}.spellingLists.spelling[${index}]`));
  const reviewLogs = assertArray(track.reviewLogs, `tracks.${id}.reviewLogs`)
    .map((record, index) => validateEventRecord(record, `tracks.${id}.reviewLogs[${index}]`));
  const spellingReviewLogs = assertArray(track.spellingReviewLogs, `tracks.${id}.spellingReviewLogs`)
    .map((record, index) => validateEventRecord(record, `tracks.${id}.spellingReviewLogs[${index}]`));
  const customWords = assertArray(track.customWords, `tracks.${id}.customWords`)
    .map((record, index) => validateUserDictionaryRecord(record, `tracks.${id}.customWords[${index}]`));
  const memorizedWords = assertArray(track.memorizedWords, `tracks.${id}.memorizedWords`)
    .map((record, index) => validateKnownRecord(record, `tracks.${id}.memorizedWords[${index}]`));
  const searchHistory = assertArray(track.searchHistory, `tracks.${id}.searchHistory`)
    .map((record, index) => validateHistoryRecord(record, `tracks.${id}.searchHistory[${index}]`));
  return {
    ...track,
    id: track.id ?? id,
    name,
    wordLists: { ...(track.wordLists ?? {}), vocabulary },
    spellingLists: { ...(track.spellingLists ?? {}), spelling },
    reviewLogs,
    spellingReviewLogs,
    customWords,
    memorizedWords,
    searchHistory,
  };
}

function legacyTrackName(snapshot) {
  const rawDate = snapshot?.exportedAt ?? snapshot?.lastOpenedAt ?? snapshot?.createdAt;
  const parsed = rawDate && Number.isFinite(Date.parse(rawDate)) ? new Date(rawDate) : new Date();
  const date = parsed.toISOString().slice(0, 10);
  return `Imported legacy snapshot - ${date}`;
}

function legacySnapshotToBackup(snapshot) {
  const trackId = "legacy_snapshot";
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP,
    exportedAt: snapshot.exportedAt ?? new Date().toISOString(),
    activeTrackId: trackId,
    importNote: "legacy-wordlover-snapshot",
    globalSettings: pickGlobalSettings({
      theme: snapshot.theme,
      fontScale: snapshot.fontScale,
      onReturnAction: snapshot.onReturnAction,
      speakOnReturn: snapshot.speakOnReturn,
      uiPreferences: snapshot.uiPreferences,
    }),
    tracks: {
      [trackId]: {
        id: trackId,
        name: legacyTrackName(snapshot),
        createdAt: snapshot.createdAt ?? snapshot.exportedAt ?? null,
        updatedAt: snapshot.updatedAt ?? snapshot.exportedAt ?? null,
        goals: snapshot.studyGoals ?? null,
        studyOneMoreState: { filter: snapshot.studyOneMoreFilter ?? snapshot.uiPreferences?.studyOneMoreFilter ?? null },
        wordLists: { vocabulary: snapshot.vocabularyItems ?? [] },
        spellingLists: { spelling: snapshot.spellingItems ?? [] },
        customWords: snapshot.userDictionary ?? [],
        memorizedWords: snapshot.knownWords ?? [],
        searchHistory: snapshot.historyItems ?? [],
        reviewLogs: snapshot.studyEvents ?? [],
        spellingReviewLogs: snapshot.spellingEvents ?? [],
      },
    },
  };
}

// Throws a user-facing Error when the parsed object is not an importable WordFan backup.
export function validateBackup(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Backup file is not a valid WordFan backup object.");
  }
  const candidate = parsed.app === "wordlover" ? legacySnapshotToBackup(parsed) : cloneJson(parsed);
  if (candidate.app !== BACKUP_APP) {
    throw new Error(`This file is not a WordFan backup (app="${candidate.app ?? ""}").`);
  }
  if (!Number.isInteger(candidate.schemaVersion) || candidate.schemaVersion < 1 || candidate.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schemaVersion ${candidate.schemaVersion}. This app supports versions 1 to ${BACKUP_SCHEMA_VERSION}.`);
  }
  if (!hasTrackMap(candidate.tracks)) {
    throw new Error("Backup contains no learning tracks.");
  }
  const tracks = {};
  for (const [id, track] of Object.entries(candidate.tracks)) {
    tracks[id] = validateTrack(track, id);
  }
  const activeTrackId = tracks[candidate.activeTrackId] ? candidate.activeTrackId : Object.keys(tracks)[0];
  const dictionarySupplements = Array.isArray(candidate.dictionarySupplements) ? candidate.dictionarySupplements : [];
  return { ...candidate, activeTrackId, globalSettings: pickGlobalSettings(candidate.globalSettings ?? {}), tracks, dictionarySupplements };
}

// A track may be deleted only if it exists, is not the active track, and is not the last
// remaining track. Pure so both the UI guard and tests share one rule.
export function canDeleteTrack(root, id, activeId) {
  const tracks = root?.tracks ?? {};
  return Boolean(tracks[id]) && id !== activeId && Object.keys(tracks).length > 1;
}

// On collision, rename per spec: "Name (Imported - YYYY-MM-DD)", then "... (2)", "... (3)".
export function dedupeTrackName(existingNames, name, today) {
  const taken = new Set(existingNames ?? []);
  const base = name && String(name).trim() ? String(name) : "Imported Track";
  if (!taken.has(base)) return base;
  const stamped = `${base} (Imported - ${today})`;
  if (!taken.has(stamped)) return stamped;
  let n = 2;
  while (taken.has(`${stamped} (${n})`)) n += 1;
  return `${stamped} (${n})`;
}

// Plan a non-destructive import: assign new ids, dedupe names against existing tracks, and
// pick the new active track (mapped from the backup's activeTrackId). Returns the updated
// registry plus the list of tracks to write. Existing tracks in `root` are never modified.
export function planImport(root = {}, backup = {}, today, makeId = newTrackId) {
  const existing = root.tracks ?? {};
  const usedNames = new Set(Object.values(existing).map((track) => track.name));
  const registry = { ...root, schemaVersion: BACKUP_SCHEMA_VERSION, tracks: { ...existing } };
  const imported = [];
  let newActiveTrackId = root.activeTrackId ?? DEFAULT_TRACK_ID;
  const srcActive = backup.activeTrackId;
  const usedIds = new Set(Object.keys(existing));
  for (const [srcId, track] of Object.entries(backup.tracks ?? {})) {
    let id = makeId();
    let attempts = 0;
    while (usedIds.has(id)) {
      attempts += 1;
      if (attempts > 100) throw new Error("Could not create a unique imported learning track id.");
      id = makeId();
    }
    usedIds.add(id);
    const name = dedupeTrackName([...usedNames], track.name, today);
    usedNames.add(name);
    const meta = {
      id,
      name,
      createdAt: track.createdAt ?? today,
      updatedAt: today,
      importedAt: today,
      importedFrom: srcId,
    };
    registry.tracks[id] = meta;
    imported.push({ id, meta, track });
    if (srcId === srcActive) newActiveTrackId = id;
  }
  // If the backup's activeTrackId didn't match any imported track, switch to the first one.
  if (imported.length && !imported.some((entry) => entry.id === newActiveTrackId)) {
    newActiveTrackId = imported[0].id;
  }
  registry.activeTrackId = newActiveTrackId;
  return { registry, imported, newActiveTrackId };
}
