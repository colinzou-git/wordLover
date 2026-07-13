// FSRS review state helpers. No globals, no DOM.
// Functions accept an explicit nowMs parameter (default Date.now()) so callers
// that use a debug clock can pass appNowMs() without coupling this module to globals.

import {
  reviveFsrsCard,
  scheduleFromFsrsRating as scheduleWithFsrs,
  serializeFsrsCard,
} from "./fsrs-scheduler.js?v=20260713-1";

const NORMAL_DAY_MS = 24 * 60 * 60 * 1000;
const FSRS_RATINGS = ["again", "hard", "good", "easy"];

function normalizeTerm(term) {
  return String(term ?? "")
    .trim()
    .replace(/[‘’ʼ`＇]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isValidFsrsRating(rating) {
  return FSRS_RATINGS.includes(String(rating ?? "").toLowerCase());
}

export function createFsrsCard(nowIso = new Date().toISOString()) {
  return serializeFsrsCard(reviveFsrsCard(null, nowIso));
}

export function fallbackReviewDueAt(review = {}, nowMs = Date.now()) {
  const existingDue = review.dueAt ?? review.fsrsCard?.due;
  if (existingDue && Number.isFinite(Date.parse(existingDue))) return existingDue;
  if (review.masteredAt || review.fsrsCard?.state === "mastered") {
    const basis = Date.parse(review.lastReviewedAt ?? review.masteredAt ?? new Date(nowMs).toISOString());
    const preferred = Number.isFinite(basis) ? basis + 90 * NORMAL_DAY_MS : 0;
    const future = Math.max(preferred, nowMs + NORMAL_DAY_MS);
    return new Date(future).toISOString();
  }
  return new Date(nowMs).toISOString();
}

export function normalizeReviewState(review = {}, nowMs = Date.now()) {
  const rawCard = review.fsrsCard && typeof review.fsrsCard === "object" ? { ...review.fsrsCard } : review.fsrsCard;
  if (rawCard && review.dueAt) rawCard.due = review.dueAt;
  const fsrsCard = serializeFsrsCard(reviveFsrsCard(rawCard, fallbackReviewDueAt(review, nowMs)));
  return {
    ...review,
    lastRating: review.lastRating ?? "again",
    intervalDays: review.intervalDays ?? fsrsCard.scheduled_days ?? 0,
    dueAt: fsrsCard.due,
    reviewCount: review.reviewCount ?? 0,
    lastReviewedAt: review.lastReviewedAt ?? null,
    masteredAt: review.masteredAt ?? null,
    fsrsCard,
  };
}

export function rebuildReviewStateFromEvents(item, events = [], nowMs = Date.now()) {
  const normalizedTerm = item?.normalizedTerm ?? normalizeTerm(item?.term ?? "");
  if (!normalizedTerm) return normalizeReviewState(item?.review ?? { dueAt: item?.savedAt ?? new Date(nowMs).toISOString() }, nowMs);
  const reviewEvents = (events ?? [])
    .filter((event) => event?.type === "review" && normalizeTerm(event.normalizedTerm ?? event.term ?? "") === normalizedTerm && event.rating && event.occurredAt)
    .slice()
    .sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? ""));
  if (!reviewEvents.length) return normalizeReviewState(item?.review ?? { dueAt: item?.savedAt ?? new Date(nowMs).toISOString() }, nowMs);

  const createdAt = item?.savedAt ?? reviewEvents[0].occurredAt ?? new Date(nowMs).toISOString();
  let review = normalizeReviewState({
    dueAt: createdAt,
    fsrsCard: createFsrsCard(createdAt),
  }, nowMs);
  for (const event of reviewEvents) {
    if (!isValidFsrsRating(event.rating)) {
      console.warn(`Skipping invalid FSRS review rating for "${normalizedTerm}": ${event.rating}`);
      continue;
    }
    const rating = String(event.rating).toLowerCase();
    const schedule = scheduleWithFsrs(review, rating, event.occurredAt);
    review = {
      ...review,
      lastRating: rating,
      intervalDays: schedule.intervalDays,
      dueAt: schedule.dueAt,
      masteredAt: schedule.masteredAt,
      lastReviewedAt: event.occurredAt,
      reviewCount: (review.reviewCount ?? 0) + 1,
      fsrsCard: schedule.fsrsCard,
    };
  }
  return normalizeReviewState(review, nowMs);
}

export function rebuildItemsReviewStateFromEvents(items = [], events = [], nowMs = Date.now()) {
  return (items ?? []).map((item) => ({
    ...item,
    review: rebuildReviewStateFromEvents(item, events, nowMs),
  }));
}
