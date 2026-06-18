#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps" / "wordlover-pwa" / "public"


def replace(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:100]!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


def main() -> None:
    goal = PUBLIC / "goal-forecast.js"
    replace(
        goal,
        '  const dailyNewWords = clamp(Math.round(Number(input.dailyNewWords)) || DEFAULTS.dailyNewWords, 0, 100);',
        '''  const dailyNewWordsRaw = Number(input.dailyNewWords);
  const hasDailyNewWords = input.dailyNewWords !== "" && input.dailyNewWords != null;
  const dailyNewWords = hasDailyNewWords && Number.isFinite(dailyNewWordsRaw)
    ? clamp(Math.round(dailyNewWordsRaw), 0, 100)
    : DEFAULTS.dailyNewWords;''',
    )
    replace(
        goal,
        '''  const dayZero = new Date(startMs);
  dayZero.setHours(0, 0, 0, 0);
  const startOfTodayMs = dayZero.getTime();''',
        '''  const dayZero = new Date(startMs);
  dayZero.setHours(0, 0, 0, 0);''',
    )
    replace(
        goal,
        '''  for (let dayIndex = 0; dayIndex < forecastDays; dayIndex += 1) {
    const dayStartMs = startOfTodayMs + dayIndex * DAY_MS;
    const dayEndMs = dayStartMs + DAY_MS;''',
        '''  for (let dayIndex = 0; dayIndex < forecastDays; dayIndex += 1) {
    // Advance by local calendar days rather than fixed 24-hour blocks. DST days
    // can be 23 or 25 hours, and fixed arithmetic can duplicate or skip dates.
    const dayStart = new Date(dayZero);
    dayStart.setDate(dayStart.getDate() + dayIndex);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayEnd.getTime();''',
    )
    replace(goal, 'const DAY_MS = 24 * 60 * 60 * 1000;\n', '')

    sync = PUBLIC / "sync.js"
    replace(
        sync,
        '''function normalizeTerm(term) {
  return term.trim().replace(/['`]/g, "'").replace(/\\s+/g, " ").toLowerCase();
}''',
        '''function normalizeTerm(term) {
  return String(term ?? "")
    .trim()
    .replace(/[‘’ʼ`＇]/g, "'")
    .replace(/\\s+/g, " ")
    .toLowerCase();
}''',
    )
    replace(sync, 'const normalizedTerm = event.normalizedTerm ?? normalizeTerm(event.term ?? "");', 'const normalizedTerm = normalizeTerm(event.normalizedTerm ?? event.term ?? "");')
    replace(
        sync,
        '''  for (const item of [...(remoteItems ?? []), ...(localItems ?? [])]) {
    if (!item?.term) continue;
    const at = item.queriedAt ?? item.searchedAt ?? null;
    const normalizedItem = at ? { ...item, queriedAt: item.queriedAt ?? at, searchedAt: item.searchedAt ?? at } : item;
    const existing = byTerm.get(item.term);
    if (!existing) {
      byTerm.set(item.term, normalizedItem);
      continue;
    }
    if (timeOf(normalizedItem) >= timeOf(existing)) byTerm.set(item.term, normalizedItem);
  }''',
        '''  for (const item of [...(remoteItems ?? []), ...(localItems ?? [])]) {
    if (!item?.term && !item?.normalizedTerm) continue;
    const normalizedTerm = normalizeTerm(item.normalizedTerm ?? item.term);
    if (!normalizedTerm) continue;
    const at = item.queriedAt ?? item.searchedAt ?? null;
    const normalizedItem = {
      ...item,
      term: item.term ?? normalizedTerm,
      normalizedTerm,
      ...(at ? { queriedAt: item.queriedAt ?? at, searchedAt: item.searchedAt ?? at } : {}),
    };
    const existing = byTerm.get(normalizedTerm);
    if (!existing) {
      byTerm.set(normalizedTerm, normalizedItem);
      continue;
    }
    if (timeOf(normalizedItem) >= timeOf(existing)) byTerm.set(normalizedTerm, normalizedItem);
  }''',
    )
    replace(sync, 'const normalizedTerm = record.normalizedTerm ?? normalizeTerm(record.term);', 'const normalizedTerm = normalizeTerm(record.normalizedTerm ?? record.term);')
    replace(
        sync,
        '''  for (const item of [...(vocabulary ?? []), ...(spelling ?? [])]) {
    if (item?.normalizedTerm && !item.archivedAt) terms.add(item.normalizedTerm);
  }''',
        '''  for (const item of [...(vocabulary ?? []), ...(spelling ?? [])]) {
    const normalizedTerm = normalizeTerm(item?.normalizedTerm ?? item?.term ?? "");
    if (normalizedTerm && !item?.archivedAt) terms.add(normalizedTerm);
  }''',
    )
    replace(sync, 'const normalizedTerm = item.normalizedTerm ?? normalizeTerm(item.term);', 'const normalizedTerm = normalizeTerm(item.normalizedTerm ?? item.term);')
    replace(sync, 'const normalizedTerm = entry.normalizedTerm ?? normalizeTerm(entry.word);', 'const normalizedTerm = normalizeTerm(entry.normalizedTerm ?? entry.word);')

    review = PUBLIC / "review-state.js"
    replace(
        review,
        '''function normalizeTerm(term) {
  return term.trim().replace(/[’`]/g, "'").replace(/\\s+/g, " ").toLowerCase();
}''',
        '''function normalizeTerm(term) {
  return String(term ?? "")
    .trim()
    .replace(/[‘’ʼ`＇]/g, "'")
    .replace(/\\s+/g, " ")
    .toLowerCase();
}''',
    )
    replace(
        review,
        '.filter((event) => event?.type === "review" && event.normalizedTerm === normalizedTerm && event.rating && event.occurredAt)',
        '.filter((event) => event?.type === "review" && normalizeTerm(event.normalizedTerm ?? event.term ?? "") === normalizedTerm && event.rating && event.occurredAt)',
    )
    replace(
        review,
        '''    const schedule = scheduleWithFsrs(review, event.rating, event.occurredAt);
    review = {
      ...review,
      lastRating: event.rating,''',
        '''    const rating = String(event.rating).toLowerCase();
    const schedule = scheduleWithFsrs(review, rating, event.occurredAt);
    review = {
      ...review,
      lastRating: rating,''',
    )

    study = PUBLIC / "study-one-more.js"
    replace(
        study,
        '''function normalizeTerm(term) {
  return term.trim().replace(/['`]/g, "'").replace(/\\s+/g, " ").toLowerCase();
}''',
        '''function normalizeTerm(term) {
  return String(term ?? "")
    .trim()
    .replace(/[‘’ʼ`＇]/g, "'")
    .replace(/\\s+/g, " ")
    .toLowerCase();
}''',
    )
    replace(study, 'const term = item?.normalizedTerm;', 'const term = normalizeTerm(item?.normalizedTerm ?? item?.term ?? "");')
    replace(
        study,
        '''  for (const event of events ?? []) {
    if (!event?.normalizedTerm) continue;
    if (event.type === "new-word-first-pass") firstTryPassed.add(event.normalizedTerm);
    if (introducedByStudyOneMore(event) && isSameDay(event.occurredAt, nowMs)) introducedToday.add(event.normalizedTerm);
    if (event.type === "study-one-more-skipped" && Date.parse(event.occurredAt) >= skipCutoffMs) {
      skippedRecently.add(event.normalizedTerm);
    }
  }''',
        '''  for (const event of events ?? []) {
    const normalizedTerm = normalizeTerm(event?.normalizedTerm ?? event?.term ?? "");
    if (!normalizedTerm) continue;
    if (event.type === "new-word-first-pass") firstTryPassed.add(normalizedTerm);
    if (introducedByStudyOneMore(event) && isSameDay(event.occurredAt, nowMs)) introducedToday.add(normalizedTerm);
    if (event.type === "study-one-more-skipped" && Date.parse(event.occurredAt) >= skipCutoffMs) {
      skippedRecently.add(normalizedTerm);
    }
  }''',
    )
    replace(
        study,
        '''      .map((record) => record?.normalizedTerm)
      .filter(Boolean)''',
        '''      .map((record) => normalizeTerm(record?.normalizedTerm ?? record?.term ?? ""))
      .filter(Boolean)''',
    )
    replace(study, 'const term = candidate?.normalizedTerm;', 'const term = normalizeTerm(candidate?.normalizedTerm ?? candidate?.term ?? candidate?.word ?? "");')

    tracks = PUBLIC / "tracks.js"
    replace(
        tracks,
        '    .replace(/[’`]/g, "\'")',
        '    .replace(/[‘’ʼ`＇]/g, "\'")',
    )

    print("Applied runtime regression fixes.")


if __name__ == "__main__":
    main()
