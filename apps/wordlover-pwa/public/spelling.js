// Spelling-track helpers.

const APOSTROPHE_VARIANTS_RE = /[‘’ʼ`＇]/g;
const DISALLOWED_SPELLING_CHARS = /[^A-Za-z0-9 '\-]/g;

export function ratingFromRetries(retries) {
  if (retries <= 0) return "easy";
  if (retries === 1) return "good";
  if (retries === 2) return "hard";
  return "again";
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
