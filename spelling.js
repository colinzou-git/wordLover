// Spelling-track helpers.

const APOSTROPHE_VARIANTS_RE = /[‘’ʼ`＇]/g;
const DISALLOWED_SPELLING_CHARS = /[^A-Za-z0-9 '\-]/g;
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

export const SPELLING_ERROR_CATEGORIES = [
  "missing-letter",
  "extra-letter",
  "adjacent-transposition",
  "repeated-letter",
  "vowel-confusion",
  "apostrophe-or-hyphen",
  "letter-substitution",
  "multiple-edits",
];

export function normalizeSpellingComparison(value) {
  return String(value ?? "")
    .trim()
    .replace(APOSTROPHE_VARIANTS_RE, "'")
    .toLocaleLowerCase();
}

export function levenshteinDistance(leftValue, rightValue) {
  const left = [...normalizeSpellingComparison(leftValue)];
  const right = [...normalizeSpellingComparison(rightValue)];
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function isAdjacentTransposition(submitted, expected) {
  if (submitted.length !== expected.length) return false;
  const mismatches = [];
  for (let index = 0; index < submitted.length; index += 1) {
    if (submitted[index] !== expected[index]) mismatches.push(index);
  }
  return mismatches.length === 2
    && mismatches[1] === mismatches[0] + 1
    && submitted[mismatches[0]] === expected[mismatches[1]]
    && submitted[mismatches[1]] === expected[mismatches[0]];
}

function hasRepeatedLetterDifference(submitted, expected) {
  const longer = submitted.length > expected.length ? submitted : expected;
  const shorter = submitted.length > expected.length ? expected : submitted;
  if (longer.length !== shorter.length + 1) return false;
  for (let index = 1; index < longer.length; index += 1) {
    if (longer[index] !== longer[index - 1]) continue;
    if (longer.slice(0, index) + longer.slice(index + 1) === shorter) return true;
  }
  return false;
}

function onlyVowelSubstitutions(submitted, expected) {
  if (submitted.length !== expected.length || submitted === expected) return false;
  let differences = 0;
  for (let index = 0; index < submitted.length; index += 1) {
    if (submitted[index] === expected[index]) continue;
    differences += 1;
    if (!VOWELS.has(submitted[index]) || !VOWELS.has(expected[index])) return false;
  }
  return differences > 0;
}

export function analyzeSpellingAttempt(submittedValue, expectedValue) {
  const normalizedSubmitted = normalizeSpellingComparison(submittedValue);
  const normalizedExpected = normalizeSpellingComparison(expectedValue);
  const correct = normalizedSubmitted === normalizedExpected;
  const editDistance = levenshteinDistance(normalizedSubmitted, normalizedExpected);
  const categories = [];
  if (!correct) {
    if (normalizedSubmitted.length < normalizedExpected.length) categories.push("missing-letter");
    if (normalizedSubmitted.length > normalizedExpected.length) categories.push("extra-letter");
    if (isAdjacentTransposition(normalizedSubmitted, normalizedExpected)) categories.push("adjacent-transposition");
    if (hasRepeatedLetterDifference(normalizedSubmitted, normalizedExpected)) categories.push("repeated-letter");
    if (onlyVowelSubstitutions(normalizedSubmitted, normalizedExpected)) categories.push("vowel-confusion");
    if (normalizedSubmitted.replace(/['-]/g, "") === normalizedExpected.replace(/['-]/g, "")) categories.push("apostrophe-or-hyphen");
    if (editDistance === 1 && normalizedSubmitted.length === normalizedExpected.length && categories.length === 0) categories.push("letter-substitution");
    if (editDistance > 1 && !categories.includes("adjacent-transposition")) categories.push("multiple-edits");
  }
  return {
    submitted: String(submittedValue ?? ""),
    normalizedSubmitted,
    correct,
    editDistance,
    lengthDelta: normalizedSubmitted.length - normalizedExpected.length,
    categories,
  };
}

export function summarizeSpellingAttempts(attempts = []) {
  const incorrect = attempts.filter((attempt) => !attempt?.correct);
  const counts = new Map();
  for (const attempt of incorrect) {
    const value = String(attempt.normalizedSubmitted ?? "");
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return {
    categories: [...new Set(incorrect.flatMap((attempt) => attempt.categories ?? []))],
    repeatedIncorrectForms: [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value),
    maxEditDistance: incorrect.reduce((maximum, attempt) => Math.max(maximum, Number(attempt.editDistance ?? 0)), 0),
  };
}

// FSRS describes the first independent retrieval attempt. Remediation success
// after a miss must not be converted into Hard or Good.
export function firstAttemptCorrectFromRetries(retries) {
  const value = Number(retries);
  return Number.isFinite(value) && value === 0;
}

export function ratingFromRetries(retries) {
  return firstAttemptCorrectFromRetries(retries) ? "easy" : "again";
}

// retriesSoFar is the number of retries already taken for the current item.
export function spellingThreshold(retriesSoFar = 0) {
  return retriesSoFar === 0 ? 1 : 3;
}

export function sanitizeSpellingInputValue(value) {
  return String(value ?? "")
    .replace(APOSTROPHE_VARIANTS_RE, "'")
    .replace(DISALLOWED_SPELLING_CHARS, "");
}

function keepPhraseSafeSpellingInput(event) {
  const input = event.target;
  if (!input || input.id !== "spellingInput" || typeof input.value !== "string") return;
  const desiredValue = sanitizeSpellingInputValue(input.value);
  const desiredCaret = sanitizeSpellingInputValue(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
  queueMicrotask(() => {
    input.value = desiredValue;
    try {
      input.setSelectionRange(desiredCaret, desiredCaret);
    } catch {
      // Ignore transient input states that do not expose a selection range.
    }
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("input", keepPhraseSafeSpellingInput, true);
}
