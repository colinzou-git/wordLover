// FSRS review state helpers. No globals, no DOM.
// Functions accept an explicit nowMs parameter (default Date.now()) so callers
// that use a debug clock can pass appNowMs() without coupling this module to globals.

import {
  reviveFsrsCard,
  scheduleFromFsrsRating as scheduleWithFsrs,
  serializeFsrsCard,
} from "./fsrs-scheduler.js?v=20260718-3";

const NORMAL_DAY_MS = 24 * 60 * 60 * 1000;
const FSRS_RATINGS = ["again", "hard", "good", "easy"];
export const MASTERY_POLICY_VERSION = 1;
export const MASTERY_MIN_SCHEDULED_REVIEWS = 3;
export const MASTERY_MIN_CONFIRMATION_GAP_DAYS = 14;
export const MASTERY_MIN_STABILITY_DAYS = 90;
export const MASTERY_MIN_INTERVAL_DAYS = 90;

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
    masteryPolicyVersion: Number(review.masteryPolicyVersion ?? 0),
    fsrsCard,
  };
}

function eventTrack(event = {}) {
  if (event.track === "spelling" || event.track === "vocabulary") return event.track;
  return Number.isFinite(Number(event.retries)) || String(event.id ?? "").startsWith("spelling-")
    ? "spelling"
    : "vocabulary";
}

function eventFirstAttemptCorrect(event, track) {
  if (typeof event?.firstAttemptCorrect === "boolean") return event.firstAttemptCorrect;
  if (track === "spelling" && Number.isFinite(Number(event?.retries))) return Number(event.retries) === 0;
  if (event?.quizResult === "pass") return true;
  if (event?.quizResult === "miss") return false;
  return false;
}

function isRelevantReview(event, track, normalizedTerm) {
  return event?.type === "review"
    && eventTrack(event) === track
    && normalizeTerm(event.normalizedTerm ?? event.term ?? "") === normalizedTerm
    && isValidFsrsRating(event.rating)
    && Number.isFinite(Date.parse(event.occurredAt ?? ""));
}

function isScheduledReview(event) {
  if (event.schedulingPolicy) return event.schedulingPolicy === "scheduled-review-full";
  return event.practiceMode !== "practice";
}

function isFailedRetrieval(event, track) {
  return String(event.rating ?? "").toLowerCase() === "again"
    || !eventFirstAttemptCorrect(event, track);
}

export function evaluateMasteryEvidence({
  track = "vocabulary",
  normalizedTerm,
  events = [],
  reviewState = {},
  nowMs = Date.now(),
} = {}) {
  const term = normalizeTerm(normalizedTerm);
  const review = normalizeReviewState(reviewState, nowMs);
  const relevant = (events ?? [])
    .filter((event) => isRelevantReview(event, track, term))
    .slice()
    .sort((left, right) => String(left.occurredAt).localeCompare(String(right.occurredAt)));
  const lastFailure = relevant.filter((event) => isFailedRetrieval(event, track)).at(-1) ?? null;
  const lastFailureAt = lastFailure?.occurredAt ?? null;
  const scheduled = relevant.filter((event) =>
    isScheduledReview(event)
    && (!lastFailureAt || Date.parse(event.occurredAt) > Date.parse(lastFailureAt))
  );
  const latest = scheduled.at(-1) ?? null;
  const previous = scheduled.at(-2) ?? null;
  const gapMs = previous && latest ? Date.parse(latest.occurredAt) - Date.parse(previous.occurredAt) : 0;
  const confirmationGapDays = Number.isFinite(gapMs) ? Math.max(0, gapMs / NORMAL_DAY_MS) : 0;
  const stability = Number(review.fsrsCard?.stability ?? 0);
  const interval = Number(review.fsrsCard?.scheduled_days ?? review.fsrsCard?.scheduledDays ?? review.intervalDays ?? 0);
  const reasons = [];
  if (scheduled.length < MASTERY_MIN_SCHEDULED_REVIEWS) reasons.push("scheduled-review-count-after-failure");
  if (!previous || !latest) reasons.push("missing-confirmations");
  if (previous && !eventFirstAttemptCorrect(previous, track)) reasons.push("previous-not-first-try-correct");
  if (latest && !eventFirstAttemptCorrect(latest, track)) reasons.push("latest-not-first-try-correct");
  if (previous?.answerRevealed === true || latest?.answerRevealed === true) reasons.push("answer-revealed");
  if (confirmationGapDays < MASTERY_MIN_CONFIRMATION_GAP_DAYS) reasons.push("confirmation-gap");
  if (stability < MASTERY_MIN_STABILITY_DAYS) reasons.push("stability");
  if (interval < MASTERY_MIN_INTERVAL_DAYS) reasons.push("interval");
  const qualified = reasons.length === 0;
  const recordedMasteryEvent = relevant.find((event) =>
    event.mastered === true
    && event.masteryEvidence?.policyVersion === MASTERY_POLICY_VERSION
    && (!lastFailureAt || Date.parse(event.occurredAt) > Date.parse(lastFailureAt))
  ) ?? null;
  const recordedMasteredAt = recordedMasteryEvent?.masteryEvidence?.masteredAt
    ?? recordedMasteryEvent?.occurredAt
    ?? null;
  const existingMasteredAt = review.masteryPolicyVersion === MASTERY_POLICY_VERSION
    && review.masteredAt
    && Number.isFinite(Date.parse(review.masteredAt))
    && (!lastFailureAt || Date.parse(review.masteredAt) > Date.parse(lastFailureAt))
    && (!latest || Date.parse(review.masteredAt) <= Date.parse(latest.occurredAt))
      ? review.masteredAt
      : recordedMasteredAt
        && Number.isFinite(Date.parse(recordedMasteredAt))
        && (!latest || Date.parse(recordedMasteredAt) <= Date.parse(latest.occurredAt))
          ? recordedMasteredAt
          : null;
  return {
    policyVersion: MASTERY_POLICY_VERSION,
    qualified,
    masteredAt: qualified ? (existingMasteredAt ?? latest.occurredAt) : null,
    scheduledReviewCount: scheduled.length,
    confirmationGapDays,
    lastFailureAt,
    reasons,
  };
}

export function rebuildReviewStateFromEvents(item, events = [], nowMs = Date.now(), track = null) {
  const normalizedTerm = item?.normalizedTerm ?? normalizeTerm(item?.term ?? "");
  const resolvedTrack = track === "spelling" || track === "vocabulary"
    ? track
    : ((events ?? []).some((event) => eventTrack(event) === "spelling") ? "spelling" : "vocabulary");
  if (!normalizedTerm) return normalizeReviewState(item?.review ?? { dueAt: item?.savedAt ?? new Date(nowMs).toISOString() }, nowMs);
  const reviewEvents = (events ?? [])
    .filter((event) => isRelevantReview(event, resolvedTrack, normalizedTerm))
    .slice()
    .sort((left, right) => (left.occurredAt ?? "").localeCompare(right.occurredAt ?? ""));
  if (!reviewEvents.length) {
    const review = normalizeReviewState(item?.review ?? { dueAt: item?.savedAt ?? new Date(nowMs).toISOString() }, nowMs);
    const mastery = evaluateMasteryEvidence({ track: resolvedTrack, normalizedTerm, events, reviewState: review, nowMs });
    return { ...review, masteredAt: mastery.masteredAt, masteryPolicyVersion: mastery.policyVersion };
  }

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
    const policyDueAt = event.appliedDueAt && Number.isFinite(Date.parse(event.appliedDueAt))
      ? event.appliedDueAt
      : schedule.dueAt;
    const policyIntervalDays = policyDueAt === schedule.dueAt
      ? schedule.intervalDays
      : Math.max(0, Math.round((Date.parse(policyDueAt) - Date.parse(event.occurredAt)) / NORMAL_DAY_MS));
    const policyFsrsCard = policyDueAt === schedule.dueAt
      ? schedule.fsrsCard
      : {
          ...schedule.fsrsCard,
          due: policyDueAt,
          scheduled_days: policyIntervalDays,
          scheduledDays: policyIntervalDays,
        };
    review = {
      ...review,
      lastRating: rating,
      intervalDays: policyIntervalDays,
      dueAt: policyDueAt,
      lastReviewedAt: event.occurredAt,
      reviewCount: (review.reviewCount ?? 0) + 1,
      fsrsCard: policyFsrsCard,
    };
  }
  review = normalizeReviewState(review, nowMs);
  const mastery = evaluateMasteryEvidence({ track: resolvedTrack, normalizedTerm, events, reviewState: review, nowMs });
  return { ...review, masteredAt: mastery.masteredAt, masteryPolicyVersion: mastery.policyVersion };
}

export function rebuildItemsReviewStateFromEvents(items = [], events = [], nowMs = Date.now(), track = null) {
  return (items ?? []).map((item) => ({
    ...item,
    review: rebuildReviewStateFromEvents(item, events, nowMs, track),
  }));
}
