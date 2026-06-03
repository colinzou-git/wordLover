import { createEmptyCard, fsrs, Rating, State } from "ts-fsrs";

export { Rating, State };

export const fsrsScheduler = fsrs({
  enable_fuzz: false,
});

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
  return {
    ...empty,
    ...raw,
    due,
    stability: numeric(raw.stability, empty.stability),
    difficulty: numeric(raw.difficulty, empty.difficulty),
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
  const shouldMarkMastered =
    rating !== "again" &&
    result.card.state === State.Review &&
    numeric(result.card.scheduled_days, 0) >= 90 &&
    numeric(result.card.reps, 0) >= 3;
  return {
    fsrsCard,
    fsrsLog,
    intervalDays,
    dueAt: fsrsCard.due,
    masteredAt: shouldMarkMastered ? reviewedAt.toISOString() : rating === "again" ? null : (reviewState.masteredAt ?? null),
  };
}
