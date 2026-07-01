// Study-one-more level rules, candidate scoring, and exclusion logic.
// No globals, no DOM, no IndexedDB.

import {
  STUDY_ONE_MORE_LEVELS,
  STUDY_ONE_MORE_TAGS,
  normalizeStudyOneMoreLevel,
} from "./ui-preferences.js?v=20260701-1";

const NORMAL_DAY_MS = 24 * 60 * 60 * 1000;
export const STUDY_ONE_MORE_SKIP_COOLDOWN_DAYS = 14;

function normalizeTerm(term) {
  return String(term ?? "")
    .trim()
    .replace(/[‘’ʼ`＇]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function localDateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(ts, nowMs) {
  const ms = Date.parse(ts);
  return Number.isFinite(ms) && localDateKey(ms) === localDateKey(nowMs);
}

export function frequencyRankOf(candidate) {
  if (candidate != null && "frequencyRank" in candidate) {
    const r = Number(candidate.frequencyRank);
    return Number.isFinite(r) ? r : Number.POSITIVE_INFINITY;
  }
  const frq = Number(candidate?.frq);
  const bnc = Number(candidate?.bnc);
  const validFrq = Number.isFinite(frq) && frq > 0 ? frq : null;
  const validBnc = Number.isFinite(bnc) && bnc > 0 ? bnc : null;
  if (validFrq !== null && validBnc !== null) return Math.min(validFrq, validBnc);
  return validFrq ?? validBnc ?? Number.POSITIVE_INFINITY;
}

export function hasToeflTag(candidate) {
  if (Number(candidate?.is_toefl ?? candidate?.isToefl) === 1) return true;
  const tags = Array.isArray(candidate?.tags)
    ? candidate.tags
    : String(candidate?.tag ?? "").split(/\s+/).filter(Boolean);
  return tags.some((tag) => tag.toLowerCase() === "toefl");
}

export function fallbackStudyOneMoreLevel(candidate) {
  const rank = frequencyRankOf(candidate);
  const length = normalizeTerm(candidate?.normalized_word ?? candidate?.normalizedTerm ?? candidate?.word ?? candidate?.term ?? "").length;
  if (rank <= 3000 && length <= 8) return "very_easy";
  if (rank <= 8000 && length <= 12) return "easy";
  if (rank <= 20000) return "medium";
  if (rank <= 50000) return "hard";
  return "advanced";
}

export function candidateMatchesStudyOneMoreLevel(candidate, level) {
  const normalizedLevel = normalizeStudyOneMoreLevel(level);
  if (normalizedLevel === "toefl") return hasToeflTag(candidate);
  return fallbackStudyOneMoreLevel(candidate) === normalizedLevel;
}

export function normalizeStudyOneMoreCandidateRow(row, level) {
  const normalizedLevel = normalizeStudyOneMoreLevel(level);
  const normalizedTerm = normalizeTerm(row?.normalized_word ?? row?.normalizedTerm ?? row?.word ?? row?.term ?? "");
  return {
    ...row,
    normalizedTerm,
    frequencyRank: frequencyRankOf(row),
    studyLevel: normalizedLevel === "toefl" ? "toefl" : fallbackStudyOneMoreLevel({ ...row, normalizedTerm }),
  };
}

export function introducedByStudyOneMore(event) {
  return ["study-one-more-introduced", "study-one-more-skipped", "new-word-first-pass"].includes(event?.type);
}

// Only the Today → Spelling → Study one more flow auto-advances into the next new word after a
// completion. Normal spelling review/practice and manual one-word practice must end normally, so the
// decision is gated on both an explicit autoNext flag and the session source.
export function shouldAutoContinueSpellingStudyOneMore(session) {
  return Boolean(session?.autoNext && session.source === "spelling-study-one-more");
}

export function buildStudyOneMoreExclusionSets({
  vocabulary = [],
  spelling = [],
  events = [],
  known = [],
  nowMs = Date.now(),
} = {}) {
  const memorizeTerms = new Set();
  const spellingTerms = new Set();
  const archivedIgnoredOrMastered = new Set();
  for (const item of vocabulary ?? []) {
    const term = normalizeTerm(item?.normalizedTerm ?? item?.term ?? "");
    if (!term) continue;
    if (!item.archivedAt) memorizeTerms.add(term);
    if (item.archivedAt || item.ignoredAt || item.review?.masteredAt) archivedIgnoredOrMastered.add(term);
  }
  for (const item of spelling ?? []) {
    const term = normalizeTerm(item?.normalizedTerm ?? item?.term ?? "");
    if (!term) continue;
    if (!item.archivedAt) spellingTerms.add(term);
    if (item.archivedAt || item.ignoredAt || item.review?.masteredAt) archivedIgnoredOrMastered.add(term);
  }
  const introducedToday = new Set();
  const firstTryPassed = new Set();
  const skippedRecently = new Set();
  const skipCutoffMs = nowMs - STUDY_ONE_MORE_SKIP_COOLDOWN_DAYS * NORMAL_DAY_MS;
  for (const event of events ?? []) {
    const normalizedTerm = normalizeTerm(event?.normalizedTerm ?? event?.term ?? "");
    if (!normalizedTerm) continue;
    if (event.type === "new-word-first-pass") firstTryPassed.add(normalizedTerm);
    if (introducedByStudyOneMore(event) && isSameDay(event.occurredAt, nowMs)) introducedToday.add(normalizedTerm);
    if (event.type === "study-one-more-skipped" && Date.parse(event.occurredAt) >= skipCutoffMs) {
      skippedRecently.add(normalizedTerm);
    }
  }
  const knownTerms = new Set(
    (known ?? [])
      .map((record) => normalizeTerm(record?.normalizedTerm ?? record?.term ?? ""))
      .filter(Boolean)
      .filter((term) => !memorizeTerms.has(term) && !spellingTerms.has(term)),
  );
  return { memorizeTerms, spellingTerms, introducedToday, firstTryPassed, knownTerms, archivedIgnoredOrMastered, skippedRecently };
}

// Spelling Study One More is "new to the spelling list", not "new to all lists": a word can be
// memorized for meaning yet still be unpracticed for spelling. So this builder deliberately omits
// memorizeTerms/knownTerms and blocks only the active spelling list (plus archived/ignored/mastered
// spelling so default discovery prefers genuinely fresh words). The returned shape is a subset of
// buildStudyOneMoreExclusionSets, which is safe because studyOneMoreExclusionReason reads every set
// optionally.
export function buildSpellingStudyOneMoreExclusionSets({ spelling = [] } = {}) {
  const spellingTerms = new Set();
  const archivedIgnoredOrMastered = new Set();
  for (const item of spelling ?? []) {
    const term = normalizeTerm(item?.normalizedTerm ?? item?.term ?? "");
    if (!term) continue;
    if (!item.archivedAt) spellingTerms.add(term);
    if (item.archivedAt || item.ignoredAt || item.review?.masteredAt) archivedIgnoredOrMastered.add(term);
  }
  return { spellingTerms, archivedIgnoredOrMastered };
}

export function studyOneMoreExclusionReason(candidate, exclusions) {
  const term = normalizeTerm(candidate?.normalizedTerm ?? candidate?.term ?? candidate?.word ?? "");
  if (!term) return "invalid";
  if (exclusions.memorizeTerms?.has(term)) return "memorize";
  if (exclusions.spellingTerms?.has(term)) return "spelling";
  if (exclusions.knownTerms?.has(term)) return "known";
  if (exclusions.introducedToday?.has(term)) return "introducedToday";
  if (exclusions.firstTryPassed?.has(term)) return "firstTryPassed";
  if (exclusions.archivedIgnoredOrMastered?.has(term)) return "archivedIgnoredOrMastered";
  if (exclusions.skippedRecently?.has(term)) return "skippedRecently";
  return null;
}

export function studyOneMoreCandidateAllowed(candidate, exclusions) {
  return !studyOneMoreExclusionReason(candidate, exclusions);
}

export function pickStudyOneMoreCandidateFromRows(rows, level, exclusions = buildStudyOneMoreExclusionSets()) {
  const normalizedLevel = normalizeStudyOneMoreLevel(level);
  return [...(rows ?? [])]
    .map((row) => normalizeStudyOneMoreCandidateRow(row, normalizedLevel))
    .filter((row) => row.normalizedTerm)
    .filter((row) => candidateMatchesStudyOneMoreLevel(row, normalizedLevel))
    .filter((row) => !exclusions.memorizeTerms?.has(row.normalizedTerm))
    .filter((row) => !exclusions.spellingTerms?.has(row.normalizedTerm))
    .filter((row) => !exclusions.knownTerms?.has(row.normalizedTerm))
    .filter((row) => !exclusions.introducedToday?.has(row.normalizedTerm))
    .filter((row) => !exclusions.firstTryPassed?.has(row.normalizedTerm))
    .filter((row) => !exclusions.archivedIgnoredOrMastered?.has(row.normalizedTerm))
    .filter((row) => !exclusions.skippedRecently?.has(row.normalizedTerm))
    .sort((left, right) => {
      const leftRank = Number.isFinite(left.frequencyRank) ? left.frequencyRank : Number.MAX_SAFE_INTEGER;
      const rightRank = Number.isFinite(right.frequencyRank) ? right.frequencyRank : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return String(left.word ?? left.term).localeCompare(String(right.word ?? right.term));
    })[0] ?? null;
}

export function pickStudyOneMoreCandidateFromOrderedRows(rows, level, exclusions = buildStudyOneMoreExclusionSets(), stats = null) {
  const normalizedLevel = normalizeStudyOneMoreLevel(level);
  for (const row of rows ?? []) {
    if (stats) {
      stats.rowsScanned = (stats.rowsScanned ?? stats.rowsVisited ?? 0) + 1;
      stats.rowsVisited = stats.rowsScanned;
    }
    const candidate = normalizeStudyOneMoreCandidateRow(row, normalizedLevel);
    if (!candidate.normalizedTerm) continue;
    if (!candidateMatchesStudyOneMoreLevel(candidate, normalizedLevel)) continue;
    const reason = studyOneMoreExclusionReason(candidate, exclusions);
    if (!reason) {
      if (stats) {
        stats.selectedRank = Number.isFinite(candidate.frequencyRank) ? candidate.frequencyRank : null;
        stats.selectedTerm = candidate.normalizedTerm;
      }
      return candidate;
    }
    if (stats) {
      stats.exclusionCounts = stats.exclusionCounts ?? {};
      stats.exclusionCounts[reason] = (stats.exclusionCounts[reason] ?? 0) + 1;
    }
  }
  return null;
}

export function studyOneMoreRankSql() {
  return "CASE WHEN (frq IS NULL OR frq <= 0) AND (bnc IS NULL OR bnc <= 0) THEN NULL WHEN (frq IS NULL OR frq <= 0) THEN bnc WHEN (bnc IS NULL OR bnc <= 0) THEN frq ELSE min(frq, bnc) END";
}

function studyOneMoreTagConditionSql(tag) {
  if (!STUDY_ONE_MORE_TAGS.includes(tag)) return "0";
  if (tag === "toefl") return `(is_toefl = 1 OR tag LIKE '%toefl%')`;
  return `tag LIKE '%${tag}%'`;
}

export function studyOneMoreFilterSql(filter = {}) {
  const rank = studyOneMoreRankSql();
  const parts = [];
  const includeMin = filter.includeFreqMin != null ? Number(filter.includeFreqMin) : null;
  const includeMax = filter.includeFreqMax != null ? Number(filter.includeFreqMax) : null;
  const excludeMin = filter.excludeFreqMin != null ? Number(filter.excludeFreqMin) : null;
  const excludeMax = filter.excludeFreqMax != null ? Number(filter.excludeFreqMax) : null;
  if (includeMin != null) parts.push(`${rank} >= ${includeMin}`);
  if (includeMax != null) parts.push(`(${rank} IS NOT NULL AND ${rank} <= ${includeMax})`);
  if (excludeMin != null || excludeMax != null) {
    const lo = excludeMin ?? 0;
    const hi = excludeMax ?? 999999;
    parts.push(`(${rank} IS NULL OR ${rank} < ${lo} OR ${rank} > ${hi})`);
  }
  if (filter.includeTags?.length > 0) {
    parts.push(`(${filter.includeTags.map(studyOneMoreTagConditionSql).join(" OR ")})`);
  }
  for (const tag of filter.excludeTags ?? []) {
    parts.push(`NOT (${studyOneMoreTagConditionSql(tag)})`);
  }
  return parts.length > 0 ? parts.join(" AND ") : "1=1";
}

export function pickStudyOneMoreCandidateFromFilteredRows(rows, exclusions = buildStudyOneMoreExclusionSets(), stats = null) {
  for (const row of rows ?? []) {
    if (stats) {
      stats.rowsScanned = (stats.rowsScanned ?? 0) + 1;
      stats.rowsVisited = stats.rowsScanned;
    }
    const candidate = normalizeStudyOneMoreCandidateRow(row, "very_easy");
    if (!candidate.normalizedTerm) continue;
    const reason = studyOneMoreExclusionReason(candidate, exclusions);
    if (!reason) {
      if (stats) {
        stats.selectedRank = Number.isFinite(candidate.frequencyRank) ? candidate.frequencyRank : null;
        stats.selectedTerm = candidate.normalizedTerm;
      }
      return candidate;
    }
    if (stats) {
      stats.exclusionCounts = stats.exclusionCounts ?? {};
      stats.exclusionCounts[reason] = (stats.exclusionCounts[reason] ?? 0) + 1;
    }
  }
  return null;
}

export function studyOneMoreLevelSql(level) {
  const rank = studyOneMoreRankSql();
  const wordLength = "length(normalized_word)";
  switch (normalizeStudyOneMoreLevel(level)) {
    case "very_easy":
      return `${rank} <= 3000 AND ${wordLength} <= 8`;
    case "easy":
      return `${rank} <= 8000 AND ${wordLength} <= 12 AND NOT (${rank} <= 3000 AND ${wordLength} <= 8)`;
    case "medium":
      return `${rank} <= 20000 AND NOT (${rank} <= 8000 AND ${wordLength} <= 12)`;
    case "hard":
      return `${rank} > 20000 AND ${rank} <= 50000`;
    case "advanced":
      return `(${rank} IS NULL OR ${rank} > 50000)`;
    case "toefl":
      return `(is_toefl = 1 OR lower(coalesce(tag, '')) LIKE '%toefl%')`;
    default:
      return `${rank} <= 3000 AND ${wordLength} <= 8`;
  }
}
