// Pure snapshot merge helpers for Google Drive sync.
// No globals, no DOM, no IndexedDB. All time-sensitive helpers accept nowMs.

import { normalizeReviewState, rebuildItemsReviewStateFromEvents } from "./review-state.js?v=20260606-2";
import { normalizeTrack } from "./ui-preferences.js?v=20260606-2";

function normalizeTerm(term) {
  return term.trim().replace(/['`]/g, "'").replace(/\s+/g, " ").toLowerCase();
}

export function studyEventTrack(event = {}) {
  if (event.track) return event.track;
  return String(event.id ?? "").startsWith("spelling-") || Number.isFinite(Number(event.retries)) ? "spelling" : "vocabulary";
}

export function computeStudyEventKey(event = {}) {
  const track = normalizeTrack(studyEventTrack(event));
  const type = event.type ?? "event";
  const normalizedTerm = event.normalizedTerm ?? normalizeTerm(event.term ?? "");
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
    const normalizedTerm = event.normalizedTerm ?? normalizeTerm(event.term ?? "");
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
    if (!item?.term) continue;
    const at = item.queriedAt ?? item.searchedAt ?? null;
    const normalizedItem = at ? { ...item, queriedAt: item.queriedAt ?? at, searchedAt: item.searchedAt ?? at } : item;
    const existing = byTerm.get(item.term);
    if (!existing) {
      byTerm.set(item.term, normalizedItem);
      continue;
    }
    if (timeOf(normalizedItem) >= timeOf(existing)) byTerm.set(item.term, normalizedItem);
  }
  return [...byTerm.values()]
    .sort((left, right) => timeOf(right) - timeOf(left))
    .slice(0, 10);
}

export function mergeKnownSources(localKnown, remoteKnown, activeTerms = new Set()) {
  const byTerm = new Map();
  for (const record of [...(remoteKnown ?? []), ...(localKnown ?? [])]) {
    if (!record?.term && !record?.normalizedTerm) continue;
    const normalizedTerm = record.normalizedTerm ?? normalizeTerm(record.term);
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
    if (item?.normalizedTerm && !item.archivedAt) terms.add(item.normalizedTerm);
  }
  return terms;
}

export function mergeVocabularySources(recordItems, legacyItems, nowMs = Date.now()) {
  const byTerm = new Map();
  for (const item of [...(legacyItems ?? []), ...(recordItems ?? [])]) {
    if (!item?.term) continue;
    const normalizedTerm = item.normalizedTerm ?? normalizeTerm(item.term);
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
    const normalizedTerm = entry.normalizedTerm ?? normalizeTerm(entry.word);
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

export { rebuildItemsReviewStateFromEvents };
