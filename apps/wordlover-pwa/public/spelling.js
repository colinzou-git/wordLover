// Pure spelling-track helpers. No globals, no DOM.

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
