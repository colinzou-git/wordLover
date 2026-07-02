// Pure snapshot merge helpers for Google Drive sync.
// No globals, no DOM, no IndexedDB. All time-sensitive helpers accept nowMs.

import { normalizeReviewState, rebuildItemsReviewStateFromEvents } from "./review-state.js?v=20260702-3";
import { normalizeTrack } from "./ui-preferences.js?v=20260702-3";
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_APP,
  DEFAULT_TRACK_ID,
  serializeTrack,
  trackRecords,
} from "./tracks.js?v=20260702-3";

function normalizeTerm(term) {
  return String(term ?? "")
    .trim()
    .replace(/[‘’ʼ`＇]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function studyEventTrack(event = {}) {
  if (event.track) return event.track;
  return String(event.id ?? "").startsWith("spelling-") || Number.isFinite(Number(event.retries)) ? "spelling" : "vocabulary";
}

export function computeStudyEventKey(event = {}) {
  const track = normalizeTrack(studyEventTrack(event));
  const type = event.type ?? "event";
  const normalizedTerm = normalizeTerm(event.normalizedTerm ?? event.term ?? "");
  const occurredAt = event.occurredAt ?? "";
  const rating = event.rating ?? "";
  const source = event.source ?? event.practiceMode ?? "";
  if (!normalizedTerm || !occurredAt) return event.id ?? `${track}:${type}:${normalizedTerm || "unknown"}:${Date.now()}`;
  return [track, type, normalizedTerm, occurredAt, rating, source].map((part) => encodeURIComponent(String(part ?? ""))).join("|");
}

export function mergeStudyEventSources(recordEvents, legacyEvents) {
  const byKey = new Map();
  for (const event of [...(legacyEvents ?? []), ...(recordEvents ?? [])]) {
    if (!event) continue;
    const id = event.id ?? `${event.type ?? "event"}-${event.normalizedTerm ?? event.term ?? "unknown"}-${event.occurredAt ?? new Date().toISOString()}`;
    const normalizedTerm = normalizeTerm(event.normalizedTerm ?? event.term ?? "");
    const normalized = {
      ...event,
      id,
      normalizedTerm,
      eventKey: event.eventKey ?? computeStudyEventKey({ ...event, id, normalizedTerm }),
    };
    byKey.set(normalized.eventKey, normalized);
  }
  return [...byKey.values()].sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? ""));
}

export function mergeHistoryItems(localItems, remoteItems) {
  const byTerm = new Map();
  const timeOf = (item) => Date.parse(item?.queriedAt ?? item?.searchedAt ?? 0) || 0;
  for (const item of [...(remoteItems ?? []), ...(localItems ?? [])]) {
    if (!item?.term && !item?.normalizedTerm) continue;
    const normalizedTerm = normalizeTerm(item.normalizedTerm ?? item.term);
    if (!normalizedTerm) continue;
    const at = item.queriedAt ?? item.searchedAt ?? null;
    const normalizedItem = {
      ...item,
      term: item.term ?? normalizedTerm,
      normalizedTerm,
      ...(at ? { queriedAt: item.queriedAt ?? at, searchedAt: item.searchedAt ?? at } : {}),
    };
    const existing = byTerm.get(normalizedTerm);
    if (!existing) {
      byTerm.set(normalizedTerm, normalizedItem);
      continue;
    }
    if (timeOf(normalizedItem) >= timeOf(existing)) byTerm.set(normalizedTerm, normalizedItem);
  }
  return [...byTerm.values()]
    .sort((left, right) => timeOf(right) - timeOf(left))
    .slice(0, 10);
}

export function mergeKnownSources(localKnown, remoteKnown, activeTerms = new Set()) {
  const byTerm = new Map();
  for (const record of [...(remoteKnown ?? []), ...(localKnown ?? [])]) {
    if (!record?.term && !record?.normalizedTerm) continue;
    const normalizedTerm = normalizeTerm(record.normalizedTerm ?? record.term);
    if (!normalizedTerm || activeTerms.has(normalizedTerm)) continue;
    const knownAt = record.knownAt ?? record.updatedAt ?? new Date().toISOString();
    const incoming = {
      ...record,
      term: record.term ?? normalizedTerm,
      normalizedTerm,
      knownAt,
      updatedAt: record.updatedAt ?? knownAt,
      source: record.source ?? "study-one-more",
    };
    const existing = byTerm.get(normalizedTerm);
    if (!existing) {
      byTerm.set(normalizedTerm, incoming);
      continue;
    }
    const existingUpdated = Date.parse(existing.updatedAt ?? existing.knownAt ?? 0) || 0;
    const incomingUpdated = Date.parse(incoming.updatedAt ?? incoming.knownAt ?? 0) || 0;
    byTerm.set(normalizedTerm, incomingUpdated >= existingUpdated ? { ...existing, ...incoming } : { ...incoming, ...existing });
  }
  return [...byTerm.values()].sort((left, right) => (right.knownAt ?? "").localeCompare(left.knownAt ?? ""));
}

export function activeStudyTermsFromItems(vocabulary = [], spelling = []) {
  const terms = new Set();
  for (const item of [...(vocabulary ?? []), ...(spelling ?? [])]) {
    const normalizedTerm = normalizeTerm(item?.normalizedTerm ?? item?.term ?? "");
    if (normalizedTerm && !item?.archivedAt) terms.add(normalizedTerm);
  }
  return terms;
}

export function mergeVocabularySources(recordItems, legacyItems, nowMs = Date.now()) {
  const byTerm = new Map();
  for (const item of [...(legacyItems ?? []), ...(recordItems ?? [])]) {
    if (!item?.term) continue;
    const normalizedTerm = normalizeTerm(item.normalizedTerm ?? item.term);
    const normalizedItem = {
      ...item,
      normalizedTerm,
      review: normalizeReviewState(item.review ?? { dueAt: item.savedAt ?? new Date(nowMs).toISOString() }, nowMs),
    };
    const existing = byTerm.get(normalizedTerm);
    if (!existing) {
      byTerm.set(normalizedTerm, normalizedItem);
      continue;
    }
    const existingUpdated = Date.parse(existing.updatedAt ?? existing.savedAt ?? 0) || 0;
    const incomingUpdated = Date.parse(normalizedItem.updatedAt ?? normalizedItem.savedAt ?? 0) || 0;
    byTerm.set(normalizedTerm, incomingUpdated >= existingUpdated ? { ...existing, ...normalizedItem } : { ...normalizedItem, ...existing });
  }
  return [...byTerm.values()].sort((left, right) => (right.savedAt ?? "").localeCompare(left.savedAt ?? ""));
}

export function mergeUserDictionarySources(localEntries, remoteEntries) {
  const byTerm = new Map();
  for (const entry of [...(remoteEntries ?? []), ...(localEntries ?? [])]) {
    if (!entry?.normalizedTerm && !entry?.word) continue;
    const normalizedTerm = normalizeTerm(entry.normalizedTerm ?? entry.word);
    const incoming = { ...entry, normalizedTerm };
    const existing = byTerm.get(normalizedTerm);
    if (!existing) {
      byTerm.set(normalizedTerm, incoming);
      continue;
    }
    const existingUpdated = Date.parse(existing.updatedAt ?? existing.createdAt ?? 0) || 0;
    const incomingUpdated = Date.parse(incoming.updatedAt ?? incoming.createdAt ?? 0) || 0;
    byTerm.set(normalizedTerm, incomingUpdated >= existingUpdated ? incoming : existing);
  }
  return [...byTerm.values()];
}

// Pick the goals object with the newer updatedAt; fall back to whichever track was updated
// most recently, then to the local track. Pure (no normalization — that happens in app.js).
function chooseNewerGoals(localTrack = {}, remoteTrack = {}) {
  const localGoals = localTrack.goals ?? null;
  const remoteGoals = remoteTrack.goals ?? null;
  if (!localGoals) return remoteGoals;
  if (!remoteGoals) return localGoals;
  const localUpdated = Date.parse(localGoals.updatedAt ?? localTrack.updatedAt ?? "") || 0;
  const remoteUpdated = Date.parse(remoteGoals.updatedAt ?? remoteTrack.updatedAt ?? "") || 0;
  return remoteUpdated > localUpdated ? remoteGoals : localGoals;
}

// Choose track metadata (name/createdAt) for a track present on both sides: keep the earliest
// createdAt, and prefer the name from the most recently updated side so a rename propagates.
function mergeTrackMeta(id, localTrack = {}, remoteTrack = {}, nowIso) {
  const localUpdated = Date.parse(localTrack.updatedAt ?? "") || 0;
  const remoteUpdated = Date.parse(remoteTrack.updatedAt ?? "") || 0;
  const name = (remoteUpdated > localUpdated ? remoteTrack.name : localTrack.name) ?? localTrack.name ?? remoteTrack.name;
  const createdAtCandidates = [localTrack.createdAt, remoteTrack.createdAt].filter(Boolean).sort();
  return {
    id,
    name,
    createdAt: createdAtCandidates[0] ?? nowIso,
    updatedAt: (remoteUpdated > localUpdated ? remoteTrack.updatedAt : localTrack.updatedAt) ?? nowIso,
  };
}

// Merge the records of one track that exists on both sides, reusing the per-list mergers so
// review state, study events, known words, dictionary entries, and history all converge.
function mergeOneTrack(id, localTrack, remoteTrack, nowMs, nowIso) {
  const local = trackRecords(localTrack);
  const remote = trackRecords(remoteTrack);
  const studyEvents = mergeStudyEventSources(local.studyEvents, remote.studyEvents);
  const spellingEvents = mergeStudyEventSources(local.spellingEvents, remote.spellingEvents);
  const vocabulary = rebuildItemsReviewStateFromEvents(
    mergeVocabularySources(local.vocabulary, remote.vocabulary, nowMs),
    studyEvents,
  );
  const spelling = rebuildItemsReviewStateFromEvents(
    mergeVocabularySources(local.spelling, remote.spelling, nowMs),
    spellingEvents,
  );
  const known = mergeKnownSources(local.known, remote.known, activeStudyTermsFromItems(vocabulary, spelling));
  const userDictionary = mergeUserDictionarySources(local.userDictionary, remote.userDictionary);
  const history = mergeHistoryItems(local.history, remote.history);
  const meta = mergeTrackMeta(id, localTrack, remoteTrack, nowIso);
  return serializeTrack(meta, {
    vocabulary,
    spelling,
    userDictionary,
    known,
    history,
    studyEvents,
    spellingEvents,
    goals: chooseNewerGoals(localTrack, remoteTrack),
    studyOneMoreFilter: local.studyOneMoreFilter ?? remote.studyOneMoreFilter ?? null,
  });
}

// Merge two learning-track backups (each shaped like tracks.js buildBackup output) into one.
// Tracks are matched by stable id: shared ids merge record-by-record; ids unique to one side
// are carried through untouched, so no track is ever dropped or duplicated. The active track
// prefers the local choice (so syncing does not yank the user off their current track) and
// local global settings win.
export function mergeLearningTracksBackups(localBackup = {}, remoteBackup = {}, nowMs = Date.now()) {
  const nowIso = new Date(nowMs).toISOString();
  const localTracks = localBackup.tracks ?? {};
  const remoteTracks = remoteBackup.tracks ?? {};
  const ids = new Set([...Object.keys(localTracks), ...Object.keys(remoteTracks)]);
  const tracks = {};
  for (const id of ids) {
    const localTrack = localTracks[id];
    const remoteTrack = remoteTracks[id];
    if (localTrack && remoteTrack) tracks[id] = mergeOneTrack(id, localTrack, remoteTrack, nowMs, nowIso);
    else tracks[id] = { ...(localTrack ?? remoteTrack), id };
  }
  let activeTrackId = localBackup.activeTrackId;
  if (!activeTrackId || !tracks[activeTrackId]) activeTrackId = remoteBackup.activeTrackId;
  if (!activeTrackId || !tracks[activeTrackId]) activeTrackId = Object.keys(tracks)[0] ?? DEFAULT_TRACK_ID;
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: BACKUP_APP,
    exportedAt: nowIso,
    activeTrackId,
    globalSettings: { ...(remoteBackup.globalSettings ?? {}), ...(localBackup.globalSettings ?? {}) },
    tracks,
  };
}

export { rebuildItemsReviewStateFromEvents };
