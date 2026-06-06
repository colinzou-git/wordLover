// Pure UI preference normalizers. No globals, no DOM.

export const STUDY_ONE_MORE_LEVELS = [
  { id: "very_easy", label: "Very Easy" },
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "advanced", label: "Advanced" },
  { id: "toefl", label: "TOEFL" },
];

export const DEFAULT_FONT_SCALE = 1;
export const FONT_SCALE_MIN = 0.9;
export const FONT_SCALE_MAX = 2;
export const FONT_SCALE_STEP = 0.1;

export function normalizeTrack(value) {
  return value === "spelling" ? "spelling" : "vocabulary";
}

export function normalizeHistoryGranularity(value) {
  return ["days", "weeks", "months"].includes(value) ? value : "days";
}

export function normalizeGoalsPeriod(value) {
  return ["day", "week", "month"].includes(value) ? value : "day";
}

export function normalizeStudyOneMoreLevel(level) {
  return STUDY_ONE_MORE_LEVELS.some((item) => item.id === level) ? level : "very_easy";
}

export function normalizeFontScale(nextScale) {
  const numeric = Number(nextScale);
  if (!Number.isFinite(numeric)) return DEFAULT_FONT_SCALE;
  return Math.round(Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, numeric)) * 10) / 10;
}

export function normalizeUiPreferences(preferences = {}, fallback = {}) {
  return {
    todayTrack: normalizeTrack(preferences.todayTrack ?? fallback.todayTrack),
    vocabularyTrack: normalizeTrack(preferences.vocabularyTrack ?? fallback.vocabularyTrack),
    historyTrack: normalizeTrack(preferences.historyTrack ?? fallback.historyTrack),
    historyGranularity: normalizeHistoryGranularity(preferences.historyGranularity ?? fallback.historyGranularity),
    fontScale: normalizeFontScale(preferences.fontScale ?? fallback.fontScale ?? DEFAULT_FONT_SCALE),
    goalsPeriod: normalizeGoalsPeriod(preferences.goalsPeriod ?? fallback.goalsPeriod ?? "day"),
    studyOneMoreLevel: normalizeStudyOneMoreLevel(preferences.studyOneMoreLevel ?? fallback.studyOneMoreLevel ?? "very_easy"),
  };
}
