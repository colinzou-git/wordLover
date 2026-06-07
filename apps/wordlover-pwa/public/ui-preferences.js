// Pure UI preference normalizers. No globals, no DOM.

export const STUDY_ONE_MORE_LEVELS = [
  { id: "very_easy", label: "Top 3k common words" },
  { id: "easy", label: "Top 8k common words" },
  { id: "medium", label: "Top 20k words" },
  { id: "hard", label: "20k–50k less frequent words" },
  { id: "advanced", label: "50k+ rare/advanced words" },
  { id: "toefl", label: "TOEFL tagged words" },
];

export const STUDY_ONE_MORE_TAGS = ["gk", "cet4", "cet6", "ky", "ielts", "toefl", "gre"];

export const DEFAULT_STUDY_ONE_MORE_FILTER = {
  includeFreqMin: null,
  includeFreqMax: null,
  excludeFreqMin: null,
  excludeFreqMax: null,
  includeTags: [],
  excludeTags: [],
  includePhrase: false,
};

export function normalizeStudyOneMoreFilter(raw = {}) {
  const toIntOrNull = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const toTags = (v) => (Array.isArray(v) ? v.filter((t) => STUDY_ONE_MORE_TAGS.includes(t)) : []);
  return {
    includeFreqMin: toIntOrNull(raw?.includeFreqMin),
    includeFreqMax: toIntOrNull(raw?.includeFreqMax),
    excludeFreqMin: toIntOrNull(raw?.excludeFreqMin),
    excludeFreqMax: toIntOrNull(raw?.excludeFreqMax),
    includeTags: toTags(raw?.includeTags),
    excludeTags: toTags(raw?.excludeTags),
    includePhrase: Boolean(raw?.includePhrase),
  };
}

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
    studyOneMoreFilter: normalizeStudyOneMoreFilter(preferences.studyOneMoreFilter ?? fallback.studyOneMoreFilter ?? {}),
  };
}
