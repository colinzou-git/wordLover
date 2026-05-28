"""Smoke for the spelling review engine (SP-4/5).

Seeds spelling items via the test hook (no dictionary needed), then drives the
review engine to verify:
- strict, case-sensitive checking (no trim);
- 3 consecutive correct required to complete a word;
- wrong answer -> awaitingRetry, reveal, then retry resumes;
- rating derived from retries: 0->easy, 1->good, 2->hard, 3+->again;
- a spelling study event is recorded with the rating + FSRS schedule.
"""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def dismiss_gate(page):
    for _ in range(25):
        cancel = page.locator(".modal-overlay [data-modal-cancel]")
        if cancel.count() > 0:
            try:
                cancel.first.click()
            except Exception:
                pass
            time.sleep(0.2)
            return
        time.sleep(0.1)


def wait_state(page, predicate_js, timeout=6.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if page.evaluate(predicate_js):
            return True
        time.sleep(0.1)
    return False


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.goto(f"{base}/?fresh=spelling-smoke", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        time.sleep(1.5)
        dismiss_gate(page)

        # rating mapping
        mapping = page.evaluate(
            "() => [0,1,2,3,5].map(n => window.WordLoverApp.spelling.ratingFromRetries(n))"
        )
        if mapping != ["easy", "good", "hard", "again", "again"]:
            failures.append(f"ratingFromRetries mapping wrong: {mapping}")

        # Seed two spelling items.
        page.evaluate(
            """async () => {
                await window.WordLoverApp.spelling.addItemForTest('apple', 'a fruit', '苹果');
                await window.WordLoverApp.spelling.addItemForTest('brave', 'bold', '勇敢');
            }"""
        )
        due = page.evaluate("() => window.WordLoverApp.getDueSpellingItems().length")
        if due != 2:
            failures.append(f"expected 2 due spelling items, got {due}")

        # Start the review.
        page.evaluate("() => { window.WordLoverApp.spelling.setTodayTrack('spelling'); window.WordLoverApp.spelling.start(); }")
        st = page.evaluate("() => window.WordLoverApp.spelling.state()")
        print(f"start state: {st}", flush=True)
        if not st or st.get("queueLength") != 2:
            failures.append(f"spelling session did not start with 2 words: {st}")
        first_term = st.get("currentTerm")

        # --- Word 1: one wrong (retry), then 3 correct -> rating 'good' (1 retry) ---
        # --- Word 1: a miss forces 3-in-a-row; also exercise Return-again-as-retry ---
        # strict case-sensitivity: a capitalized version must be WRONG.
        page.evaluate(f"() => window.WordLoverApp.spelling.answer({first_term!r}.toUpperCase())")
        st = page.evaluate("() => window.WordLoverApp.spelling.state()")
        if not st.get("awaitingRetry") or st.get("retries") != 1:
            failures.append(f"case-sensitive wrong answer not registered: {st}")
        # answering while awaiting retry must be ignored
        page.evaluate(f"() => window.WordLoverApp.spelling.answer({first_term!r})")
        st = page.evaluate("() => window.WordLoverApp.spelling.state()")
        if st.get("consecutive") != 0:
            failures.append(f"answer accepted while awaiting retry: {st}")
        # Pressing Return again (in the input) must act like Retry.
        page.evaluate(
            "() => { const i = document.querySelector('#spellingInput'); i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); }"
        )
        st = page.evaluate("() => window.WordLoverApp.spelling.state()")
        if st.get("awaitingRetry"):
            failures.append("pressing Return again did not act like Retry (still awaiting)")

        # After a miss, 3 correct in a row are required to complete -> rating 'good'.
        page.evaluate(f"() => window.WordLoverApp.spelling.answer({first_term!r})")
        st = page.evaluate("() => window.WordLoverApp.spelling.state()")
        if st is None or st.get("currentTerm") != first_term or st.get("consecutive") != 1:
            failures.append(f"after a miss, 1 correct should NOT complete the word: {st}")
        page.evaluate(f"() => window.WordLoverApp.spelling.answer({first_term!r})")
        page.evaluate(f"() => window.WordLoverApp.spelling.answer({first_term!r})")
        wait_state(page, "() => { const s = window.WordLoverApp.spelling.state(); return !s || s.currentTerm !== %r; }" % first_term, 4.0)
        events = page.evaluate("() => window.WordLoverApp.getSpellingEvents()")
        first_event = next((e for e in events if e.get("term") == first_term), None)
        print(f"word1 event: {first_event}", flush=True)
        if not first_event:
            failures.append(f"no spelling event recorded for {first_term}")
        elif first_event.get("rating") != "good":
            failures.append(f"1-retry word should rate 'good', got {first_event.get('rating')}")
        elif first_event.get("retries") != 1:
            failures.append(f"event retries should be 1, got {first_event.get('retries')}")

        # --- Word 2: first-try correct completes immediately (ONE answer) -> rating 'easy' ---
        st = page.evaluate("() => window.WordLoverApp.spelling.state()")
        second_term = st.get("currentTerm") if st else None
        print(f"word2 term: {second_term}", flush=True)
        events_before = page.evaluate("() => window.WordLoverApp.getSpellingEvents().length")
        if second_term:
            page.evaluate(f"() => window.WordLoverApp.spelling.answer({second_term!r})")  # single correct attempt
            wait_state(page, f"() => window.WordLoverApp.getSpellingEvents().length > {events_before}", 4.0)
            events = page.evaluate("() => window.WordLoverApp.getSpellingEvents()")
            second_event = next((e for e in events if e.get("term") == second_term), None)
            print(f"word2 event (one correct attempt): {second_event}", flush=True)
            if not second_event or second_event.get("rating") != "easy":
                failures.append(f"first-try correct should complete immediately as 'easy', got {second_event.get('rating') if second_event else None}")
            if second_event and second_event.get("retries") != 0:
                failures.append(f"first-try word should have 0 retries, got {second_event.get('retries')}")
            # FSRS scheduled a future due date (not mastered on first easy).
            item = page.evaluate(f"() => window.WordLoverApp.getSpelling().find(i => i.term === {second_term!r})")
            if not item or not item.get("review", {}).get("dueAt"):
                failures.append(f"spelling item not FSRS-scheduled after review: {item}")

        # Session finished (both words done).
        final = page.evaluate("() => window.WordLoverApp.spelling.state()")
        if final is not None:
            failures.append(f"session should be finished, state={final}")

        # --- Spelling Practice More: drills all active words even when none are due ---
        practice = page.evaluate(
            """() => {
                const due = window.WordLoverApp.spelling.getDue().length;       // both just reviewed -> not due
                const prac = window.WordLoverApp.spelling.getPractice().length; // all active
                window.WordLoverApp.spelling.startPractice();
                const st = window.WordLoverApp.spelling.state();
                const q = st ? st.queueLength : 0;
                window.WordLoverApp.spelling.close();
                return { due, prac, q };
            }"""
        )
        print(f"practice: {practice}", flush=True)
        if practice.get("due") != 0:
            failures.append(f"both reviewed words should not be due, got due={practice.get('due')}")
        if practice.get("prac") != 2:
            failures.append(f"practice should include all 2 active words, got {practice.get('prac')}")
        if practice.get("q") != 2:
            failures.append(f"practice session should queue 2 words, got {practice.get('q')}")

        # --- Spelling tabs reflect the spelling track, independent of vocabulary ---
        tabs = page.evaluate(
            """() => {
                document.querySelector('[data-vocab-track="spelling"]').click();
                const vocabPanel = document.querySelector('#vocabularyList').textContent;
                document.querySelector('[data-history-track="spelling"]').click();
                document.querySelector('[data-today-track="spelling"]').click();
                return {
                    vocabCount: window.WordLoverApp.getVocabulary().length,
                    spellingCount: window.WordLoverApp.getSpelling().length,
                    vocabPanel,
                    historySummary: document.querySelector('#historyChartSummary').textContent,
                    todayReviewed: document.querySelector('#statReviewed').textContent,
                    todayNew: document.querySelector('#statNewSaved').textContent,
                };
            }"""
        )
        print(f"tabs: {tabs}", flush=True)
        if tabs.get("vocabCount") != 0:
            failures.append(f"vocabulary list should be empty (independent of spelling), got {tabs.get('vocabCount')}")
        if tabs.get("spellingCount") != 2:
            failures.append(f"spelling list should have 2 items, got {tabs.get('spellingCount')}")
        if "Total" not in (tabs.get("vocabPanel") or "") or "2" not in (tabs.get("vocabPanel") or ""):
            failures.append(f"spelling stats tab did not show Total 2: {tabs.get('vocabPanel')!r}")
        if "2 new" not in (tabs.get("historySummary") or "") or "2 reviewed" not in (tabs.get("historySummary") or ""):
            failures.append(f"spelling history summary wrong: {tabs.get('historySummary')!r}")
        if tabs.get("todayReviewed") != "2":
            failures.append(f"today spelling 'reviewed' should be 2, got {tabs.get('todayReviewed')}")
        if tabs.get("todayNew") != "2":
            failures.append(f"today spelling 'new' should be 2, got {tabs.get('todayNew')}")

        browser.close()

    if failures:
        print("\nFAILED:", flush=True)
        for f in failures:
            print(f"  - {f}", flush=True)
        return 1
    print("\nPASS", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
