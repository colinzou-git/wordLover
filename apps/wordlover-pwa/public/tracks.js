// Pure learning-track + backup helpers. No DOM, no globals, no IndexedDB.
//
// The live app stores each track's data in the existing per-record IndexedDB stores,
// tagged with `learningTrackId`. This module only shapes the export/import JSON and the
// in-kv track registry (`userDataRoot`). Keeping it pure lets automated-tests.js exercise
// migration, export, validation, and import as plain unit tests (like persistence.js and
// sync.js).

export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_APP = "WordFan";
export const DEFAULT_TRACK_ID = "track_default";
export const DEFAULT_TRACK_NAME = "Default Track";

// Settings that are safe to round-trip in a backup. Anything NOT listed here — Gemini API
// key, Google OAuth tokens/grant/profile, client-id override, backup passphrase, AI-chat
// cache — is intentionally excluded so secrets can never leak into an exported file.
export const GLOBAL_SETTINGS_ALLOWED = ["theme", "fontScale", "onReturnAction", "speakOnReturn", "uiPreferences"];

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
  };
}

function hasTrackMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

// Throws a user-facing Error when the parsed object is not an importable WordFan backup.
export function validateBackup(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Backup file is not a valid WordFan backup object.");
  }
  if (parsed.app !== BACKUP_APP) {
    throw new Error(`This file is not a WordFan backup (app="${parsed.app ?? ""}").`);
  }
  if (!Number.isInteger(parsed.schemaVersion) || parsed.schemaVersion < 1 || parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schemaVersion ${parsed.schemaVersion}. This app supports versions 1 to ${BACKUP_SCHEMA_VERSION}.`);
  }
  if (!hasTrackMap(parsed.tracks)) {
    throw new Error("Backup contains no learning tracks.");
  }
  return parsed;
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
  for (const [srcId, track] of Object.entries(backup.tracks ?? {})) {
    const id = makeId();
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
