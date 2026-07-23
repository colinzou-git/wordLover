import { createEmptyCard, fsrs, Rating, State } from "ts-fsrs";

export { Rating, State };

export const fsrsScheduler = fsrs({
  enable_fuzz: false,
});

// Minimum stability FSRS will accept for a formed memory state. Mirrors S_MIN in
// the ts-fsrs library (vendor/ts-fsrs/index.mjs); below it the scheduler throws.
const FSRS_S_MIN = 1e-3;

const RATING_BY_LABEL = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const STATE_BY_LABEL = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
  mastered: State.Review,
};

function validDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value ?? fallback);
  return Number.isFinite(date.getTime()) ? date : new Date(fallback);
}

function optionalDate(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function reviveState(value) {
  if (typeof value === "number" && Object.values(State).includes(value)) return value;
  const key = String(value ?? "new").toLowerCase();
  return STATE_BY_LABEL[key] ?? State.New;
}

function iso(date) {
  return validDate(date).toISOString();
}

export function ratingToFsrs(rating) {
  const normalized = String(rating ?? "").toLowerCase();
  const value = RATING_BY_LABEL[normalized];
  if (!value) throw new Error(`Invalid FSRS rating: ${rating}`);
  return value;
}

export function reviveFsrsCard(rawCard, fallbackDueIso) {
  const fallbackDue = validDate(fallbackDueIso);
  const raw = rawCard && typeof rawCard === "object" ? rawCard : {};
  const empty = createEmptyCard(fallbackDue);
  const due = validDate(raw.due ?? raw.dueAt ?? fallbackDue, fallbackDue);
  const lastReview = optionalDate(raw.last_review ?? raw.lastReview);
  const stability = numeric(raw.stability, empty.stability);
  const difficulty = numeric(raw.difficulty, empty.difficulty);
  // FSRS only accepts a brand-new memory state (difficulty 0 + stability 0) or a
  // fully-formed one (difficulty >= 1 and stability >= S_MIN). Legacy/imported cards
  // occasionally carry an inconsistent pair — e.g. difficulty 5 with stability 0 —
  // which makes scheduler.next() throw "Invalid memory state". A single such card
  // would then break saving a review and Drive sync for the whole collection (every
  // render/forecast/rebuild reschedules it). Its memory state is unrecoverable, so
  // treat it as a new card rather than letting the corruption propagate.
  const hasValidMemoryState =
    (stability === 0 && difficulty === 0) || (difficulty >= 1 && stability >= FSRS_S_MIN);
  if (!hasValidMemoryState) {
    return { ...empty, due };
  }
  return {
    ...empty,
    ...raw,
    due,
    stability,
    difficulty,
    elapsed_days: numeric(raw.elapsed_days ?? raw.elapsedDays, empty.elapsed_days),
    scheduled_days: numeric(raw.scheduled_days ?? raw.scheduledDays, empty.scheduled_days),
    learning_steps: numeric(raw.learning_steps ?? raw.learningSteps, empty.learning_steps),
    reps: numeric(raw.reps, empty.reps),
    lapses: numeric(raw.lapses, empty.lapses),
    state: reviveState(raw.state),
    last_review: lastReview,
  };
}

export function serializeFsrsCard(card) {
  const due = validDate(card?.due);
  const lastReview = optionalDate(card?.last_review ?? card?.lastReview);
  const serialized = {
    ...card,
    due: due.toISOString(),
    stability: numeric(card?.stability),
    difficulty: numeric(card?.difficulty),
    elapsed_days: numeric(card?.elapsed_days ?? card?.elapsedDays),
    scheduled_days: numeric(card?.scheduled_days ?? card?.scheduledDays),
    learning_steps: numeric(card?.learning_steps ?? card?.learningSteps),
    reps: numeric(card?.reps),
    lapses: numeric(card?.lapses),
    state: reviveState(card?.state),
    elapsedDays: numeric(card?.elapsed_days ?? card?.elapsedDays),
    scheduledDays: numeric(card?.scheduled_days ?? card?.scheduledDays),
  };
  if (lastReview) {
    serialized.last_review = lastReview.toISOString();
    serialized.lastReview = lastReview.toISOString();
  } else {
    delete serialized.last_review;
    delete serialized.lastReview;
  }
  return serialized;
}

// --- Forecast helpers (read-only, never mutate caller state) ----------------
// The Goals forecast simulates many hypothetical reviews. These helpers reuse
// the production card revive/serialize logic but operate on fresh copies, so a
// forecast can never change a real card's scheduling.

const forecastSchedulerCache = new Map();

function schedulerForRetention(requestRetention) {
  const value = Number(requestRetention);
  const key = Number.isFinite(value) && value > 0 && value <= 1 ? Number(value.toFixed(4)) : 0.9;
  let scheduler = forecastSchedulerCache.get(key);
  if (!scheduler) {
    scheduler = fsrs({ enable_fuzz: false, request_retention: key });
    forecastSchedulerCache.set(key, scheduler);
  }
  return scheduler;
}

// Probability the card is still remembered at `atIso`, in [0,1]. New cards
// (never reviewed) have no meaningful retrievability and return null.
export function getCardRetrievability(reviewState = {}, atIso = new Date().toISOString()) {
  const at = validDate(atIso);
  const card = reviveFsrsCard(reviewState?.fsrsCard, reviewState?.dueAt ?? at.toISOString());
  if (card.state === State.New || numeric(card.reps, 0) <= 0) return null;
  return fsrsScheduler.get_retrievability(card, at, false);
}

// Like scheduleFromFsrsRating but with an explicit target retention and no
// mastery bookkeeping — purely "given this rating now, when is it next due?".
// Returns a serialized clone; the passed reviewState is left untouched.
export function scheduleForecastReview(
  reviewState = {},
  rating = "good",
  reviewedAtIso = new Date().toISOString(),
  requestRetention = 0.9,
) {
  const reviewedAt = validDate(reviewedAtIso);
  const card = reviveFsrsCard(reviewState?.fsrsCard, reviewState?.dueAt ?? reviewedAt.toISOString());
  const scheduler = schedulerForRetention(requestRetention);
  const result = scheduler.next(card, reviewedAt, ratingToFsrs(rating));
  const fsrsCard = serializeFsrsCard(result.card);
  return {
    fsrsCard,
    dueAt: fsrsCard.due,
    intervalDays: numeric(result.card.scheduled_days, 0),
    state: result.card.state,
  };
}

export function serializeFsrsLog(log) {
  if (!log) return null;
  return {
    ...log,
    due: iso(log.due),
    review: iso(log.review),
  };
}

export function scheduleFromFsrsRating(reviewState = {}, rating = "again", reviewedAtIso = new Date().toISOString()) {
  const reviewedAt = validDate(reviewedAtIso);
  const card = reviveFsrsCard(reviewState.fsrsCard, reviewState.dueAt ?? reviewedAt.toISOString());
  const result = fsrsScheduler.next(card, reviewedAt, ratingToFsrs(rating));
  const fsrsCard = serializeFsrsCard(result.card);
  const fsrsLog = serializeFsrsLog(result.log);
  const intervalDays = numeric(result.card.scheduled_days, 0);
  return {
    fsrsCard,
    fsrsLog,
    intervalDays,
    dueAt: fsrsCard.due,
    masteredAt: reviewState.masteredAt ?? null,
  };
}
