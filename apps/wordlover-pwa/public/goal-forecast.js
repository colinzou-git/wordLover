// Goals review-workload forecast. Pure, deterministic, side-effect-free.
// No DOM, no globals, no app state. Given a daily new-word goal plus the
// learner's current FSRS cards, it simulates the next N days to estimate how
// many reviews FSRS will surface each day, the study time that implies, and
// whether the goal is sustainable.
//
// It NEVER mutates the cards it is given: every card is deep-cloned before the
// simulation touches it, and scheduling runs through scheduleForecastReview,
// which returns fresh serialized copies. The real user data is untouched.

import {
  getCardRetrievability,
  scheduleForecastReview,
} from "./fsrs-scheduler.js?v=20260715-2";

// Per-item study-time estimates (seconds). New words cost more than reviews.
const NEW_WORD_SECONDS = { low: 30, high: 60 };
const REVIEW_SECONDS = { low: 8, high: 15 };
// Candidate daily new-word goals we test when looking for a sustainable value.
const SUGGEST_CANDIDATES = [1, 2, 3, 5, 8, 10, 15, 20, 30];

const DEFAULTS = {
  dailyNewWords: 5,
  desiredRetention: 0.9,
  forecastDays: 30,
  maxStudyMinutesPerDay: undefined,
  goalMode: "new_words_first",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// Local YYYY-MM-DD for a timestamp (matches how the rest of the app keys days).
function localDateKey(ms) {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeForecastInput(input = {}) {
  const dailyNewWordsRaw = Number(input.dailyNewWords);
  const hasDailyNewWords = input.dailyNewWords !== "" && input.dailyNewWords != null;
  const dailyNewWords = hasDailyNewWords && Number.isFinite(dailyNewWordsRaw)
    ? clamp(Math.round(dailyNewWordsRaw), 0, 100)
    : DEFAULTS.dailyNewWords;
  const desiredRetentionRaw = Number(input.desiredRetention);
  const desiredRetention = Number.isFinite(desiredRetentionRaw) && desiredRetentionRaw > 0 && desiredRetentionRaw <= 1
    ? clamp(desiredRetentionRaw, 0.7, 0.99)
    : DEFAULTS.desiredRetention;
  const forecastDays = clamp(Math.round(Number(input.forecastDays)) || DEFAULTS.forecastDays, 7, 90);
  const maxRaw = Number(input.maxStudyMinutesPerDay);
  const maxStudyMinutesPerDay = Number.isFinite(maxRaw) && maxRaw > 0 ? clamp(maxRaw, 1, 600) : undefined;
  const goalMode = input.goalMode === "time_first" ? "time_first" : "new_words_first";
  const startMs = Number.isFinite(Number(input.startMs)) ? Number(input.startMs) : Date.now();
  return { dailyNewWords, desiredRetention, forecastDays, maxStudyMinutesPerDay, goalMode, startMs };
}

// Future ratings are unknown, so predict from current retrievability. Kept
// isolated so it can be improved later (e.g. per-card difficulty models).
export function predictRating(card, retrievability, userStats) {
  if (retrievability == null) return "good";
  // Learners who press "Again" a lot get slightly more conservative predictions.
  const lapseRate = clamp(Number(userStats?.lapseRate) || 0, 0, 1);
  const adjusted = retrievability - lapseRate * 0.08;
  if (adjusted >= 0.93) return "easy";
  if (adjusted >= 0.8) return "good";
  if (adjusted >= 0.6) return "hard";
  return "again";
}

// A card the simulation owns and may freely advance. Deep-cloned from the
// caller's review state so the original is never touched.
function cloneSimCard(reviewState) {
  const fsrsCard = reviewState?.fsrsCard ? JSON.parse(JSON.stringify(reviewState.fsrsCard)) : null;
  const reps = Number(fsrsCard?.reps ?? reviewState?.reviewCount ?? 0);
  const dueAt = reviewState?.dueAt ?? fsrsCard?.due ?? null;
  return {
    fsrsCard,
    dueAt,
    isNew: !(reps > 0),
  };
}

function sustainabilityLabel(avgHighMinutes, peakReviews, dailyNewWords, maxStudyMinutesPerDay) {
  const peakHighMinutes = (peakReviews * REVIEW_SECONDS.high + dailyNewWords * NEW_WORD_SECONDS.high) / 60;
  if (maxStudyMinutesPerDay) {
    if (peakHighMinutes > maxStudyMinutesPerDay * 1.8) return "too_heavy";
    const ratio = avgHighMinutes / maxStudyMinutesPerDay;
    if (ratio <= 0.8) return "easy";
    if (ratio <= 1.0) return "good";
    if (ratio <= 1.3) return "heavy";
    return "too_heavy";
  }
  if (peakReviews > 120) return "too_heavy";
  if (avgHighMinutes <= 8) return "easy";
  if (avgHighMinutes <= 15) return "good";
  if (avgHighMinutes <= 30) return "heavy";
  return "too_heavy";
}

// Core deterministic simulation. Returns daily counts plus aggregates. Does not
// compute suggestions/insights (those re-run this, so keeping it lean matters).
function simulate(input, existingCards, userStats) {
  const { dailyNewWords, desiredRetention, forecastDays, maxStudyMinutesPerDay, startMs } = input;
  const dayZero = new Date(startMs);
  dayZero.setHours(0, 0, 0, 0);

  const cards = (existingCards ?? []).map(cloneSimCard);
  const daily = [];
  let todayDueReviews = 0;

  for (let dayIndex = 0; dayIndex < forecastDays; dayIndex += 1) {
    // Advance by local calendar days rather than fixed 24-hour blocks. DST days
    // can be 23 or 25 hours, and fixed arithmetic can duplicate or skip dates.
    const dayStart = new Date(dayZero);
    dayStart.setDate(dayStart.getDate() + dayIndex);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();
    let reviews = 0;

    for (const card of cards) {
      if (!card.dueAt) continue;
      const dueMs = Date.parse(card.dueAt);
      if (!Number.isFinite(dueMs) || dueMs >= dayEndMs) continue;
      // Review at the later of "when due" and "start of this simulated day".
      const reviewedAtMs = Math.max(dueMs, dayStartMs);
      const reviewedAtIso = new Date(reviewedAtMs).toISOString();
      const retrievability = card.isNew ? null : getCardRetrievability(card, reviewedAtIso);
      const rating = predictRating(card, retrievability, userStats);
      const scheduled = scheduleForecastReview(card, rating, reviewedAtIso, desiredRetention);
      card.fsrsCard = scheduled.fsrsCard;
      card.dueAt = scheduled.dueAt;
      card.isNew = false;
      reviews += 1;
      // Learning-step intervals can be minutes; clamp the next due to the next
      // day so a single card cannot loop forever inside one simulated day.
      if (Date.parse(card.dueAt) < dayEndMs) {
        card.dueAt = new Date(dayEndMs).toISOString();
      }
    }

    if (dayIndex === 0) todayDueReviews = reviews;

    // Hypothetical new words studied today become future review cards.
    for (let n = 0; n < dailyNewWords; n += 1) {
      const scheduled = scheduleForecastReview({ fsrsCard: null, dueAt: new Date(dayStartMs).toISOString() }, "good", new Date(dayStartMs).toISOString(), desiredRetention);
      cards.push({ fsrsCard: scheduled.fsrsCard, dueAt: scheduled.dueAt, isNew: false });
    }

    const lowMinutes = (dailyNewWords * NEW_WORD_SECONDS.low + reviews * REVIEW_SECONDS.low) / 60;
    const highMinutes = (dailyNewWords * NEW_WORD_SECONDS.high + reviews * REVIEW_SECONDS.high) / 60;
    daily.push({
      date: localDateKey(dayStartMs),
      newWords: dailyNewWords,
      reviews,
      low: lowMinutes,
      high: highMinutes,
      estimatedMinutes: round1((lowMinutes + highMinutes) / 2),
    });
  }

  const reviewsByDay = daily.map((day) => day.reviews);
  const avgReviews7Days = Math.round(mean(reviewsByDay.slice(0, Math.min(7, reviewsByDay.length))));
  const avgReviews30Days = Math.round(mean(reviewsByDay));
  const peakReviews30Days = reviewsByDay.length ? Math.max(...reviewsByDay) : 0;
  const lowPerDay = round1(mean(daily.map((day) => day.low)));
  const highPerDay = round1(mean(daily.map((day) => day.high)));
  const sustainability = sustainabilityLabel(highPerDay, peakReviews30Days, dailyNewWords, maxStudyMinutesPerDay);

  return {
    daily,
    todayDueReviews,
    avgReviews7Days,
    avgReviews30Days,
    peakReviews30Days,
    estimatedMinutesPerDay: { low: lowPerDay, high: highPerDay },
    sustainability,
  };
}

const HEAVY_LABELS = new Set(["heavy", "too_heavy"]);

// Highest candidate new-word goal whose forecast stays easy/good. Re-runs the
// bare simulation (no nested suggestions) for each candidate.
function bestSustainableNewWords(input, existingCards, userStats) {
  let best = null;
  for (const candidate of SUGGEST_CANDIDATES) {
    const result = simulate({ ...input, dailyNewWords: candidate }, existingCards, userStats);
    if (!HEAVY_LABELS.has(result.sustainability)) best = candidate;
  }
  return best;
}

export function forecastGoalWorkload(input, existingCards = [], userStats = {}) {
  const normalized = normalizeForecastInput(input);
  const sim = simulate(normalized, existingCards, userStats);

  let suggestedDailyNewWords;
  if (HEAVY_LABELS.has(sim.sustainability)) {
    // Suggest the highest sustainable goal below the current one (fall back to
    // the smallest candidate so we never suggest a heavier load).
    const best = bestSustainableNewWords(normalized, existingCards, userStats);
    suggestedDailyNewWords = best != null && best < normalized.dailyNewWords ? best : Math.min(SUGGEST_CANDIDATES[0], normalized.dailyNewWords);
  }

  // Headroom: when the load is light, how many new words/day could the learner
  // add and still stay within a "good" load? Drives encouraging insights.
  let headroomDailyNewWords;
  if (!HEAVY_LABELS.has(sim.sustainability)) {
    const best = bestSustainableNewWords(normalized, existingCards, userStats);
    if (best != null && best > normalized.dailyNewWords) headroomDailyNewWords = best;
  }

  return {
    dailyNewWords: normalized.dailyNewWords,
    desiredRetention: normalized.desiredRetention,
    forecastDays: normalized.forecastDays,
    todayDueReviews: sim.todayDueReviews,
    avgReviews7Days: sim.avgReviews7Days,
    avgReviews30Days: sim.avgReviews30Days,
    peakReviews30Days: sim.peakReviews30Days,
    estimatedMinutesPerDay: sim.estimatedMinutesPerDay,
    sustainability: sim.sustainability,
    suggestedDailyNewWords,
    headroomDailyNewWords,
    dailyBreakdown: sim.daily.map((day) => ({
      date: day.date,
      newWords: day.newWords,
      reviews: day.reviews,
      estimatedMinutes: day.estimatedMinutes,
    })),
  };
}
