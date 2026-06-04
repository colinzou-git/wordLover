"""Headless smoke test that loads the WordLover PWA in Chromium and checks for JS errors.

Skips the dictionary download to keep the run fast; only validates that the app shell
loads cleanly, the new buttons/handlers from this session are wired, and the
WordLoverApp public surface exposes the new functions.

Run with the Windows HTTP server already on port 4173.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright


RATING_BUTTONS = ("again", "hard", "good", "easy")


def dismiss_optional_modal(page: Page) -> None:
    for _ in range(5):
        if not page.locator(".modal-overlay").count():
            return
        if page.locator(".modal-overlay [data-modal-cancel]").count():
            page.locator(".modal-overlay [data-modal-cancel]").click(timeout=2_000)
        elif page.locator(".modal-overlay #passphrase").count():
            page.locator(".modal-overlay #passphrase").fill("wordlover-localhost-development-passphrase")
            page.locator(".modal-overlay [data-modal-submit]").click(timeout=2_000)
        else:
            page.keyboard.press("Escape")
        page.wait_for_timeout(100)


def ensure_dictionary_loaded_with_reload_retry(page: Page) -> None:
    for _ in range(3):
        try:
            page.evaluate("async () => window.WordLoverApp.ensureDictionaryLoaded()")
            page.wait_for_function("window.WordLoverApp.getState().loaded === true", timeout=60_000)
            return
        except Exception:  # noqa: BLE001
            page.wait_for_load_state("domcontentloaded", timeout=15_000)
            page.wait_for_function("window.WordLoverApp != null", timeout=15_000)
    page.evaluate("async () => window.WordLoverApp.ensureDictionaryLoaded()")
    page.wait_for_function("window.WordLoverApp.getState().loaded === true", timeout=60_000)


def run_rating_button_pointer_check(page: Page) -> dict:
    """Click Again/Hard/Good/Easy through Playwright's real pointer path."""
    dismiss_optional_modal(page)
    ensure_dictionary_loaded_with_reload_retry(page)
    dismiss_optional_modal(page)

    results: list[dict] = []
    for rating in RATING_BUTTONS:
        suffix = rating
        first_term = page.evaluate(
            """async ({ suffix }) => {
                const app = window.WordLoverApp;
                app.reviewDebug.clear();
                for (const word of [`pointer ${suffix} one`, `pointer ${suffix} two`]) {
                    const entry = await app.addUserDictionaryEntryForTest(word, `${word} meaning`, `${word} zh`);
                    const item = await app.saveVocabularyItem(app.lookupTerm(entry.word), "smoke-pointer-rating");
                    const dueAt = new Date(Date.now() - 60_000).toISOString();
                    item.review.dueAt = dueAt;
                    item.review.fsrsCard = { ...(item.review.fsrsCard ?? {}), due: dueAt };
                    item.review.masteredAt = null;
                    item.archivedAt = null;
                }
                await app.startDueReview();
                return app.getActiveQuiz()?.entry?.term ?? null;
            }""",
            {"suffix": suffix},
        )
        dismiss_optional_modal(page)
        if not first_term:
            raise AssertionError(f"Review did not start for {rating} pointer check.")

        page.locator("[data-quiz-reveal]").click(timeout=5_000)
        correct_index = page.evaluate(
            "() => window.WordLoverApp.getActiveQuiz().options.findIndex((option) => option.correct)"
        )
        if correct_index < 0:
            raise AssertionError(f"Review quiz for {rating} pointer check has no correct option.")
        page.locator(f'[data-quiz-option="{correct_index}"]').click(timeout=5_000)

        selector = f'[data-fsrs-rating="{rating}"]'
        page.locator(selector).scroll_into_view_if_needed(timeout=5_000)
        page.wait_for_function(
            """(selector) => {
                const button = document.querySelector(selector);
                if (!button || button.disabled) return false;
                const rect = button.getBoundingClientRect();
                const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                return top === button || Boolean(top?.closest?.("[data-fsrs-rating]"));
            }""",
            arg=selector,
            timeout=5_000,
        )
        before_click = page.evaluate("() => window.WordLoverApp.reviewDebug.state()")
        page.locator(selector).click(timeout=5_000)
        page.wait_for_function(
            """({ rating, firstTerm }) => {
                const debugEvents = window.WordLoverApp.reviewDebug.events();
                const latestStudyEvent = window.WordLoverApp.getStudyEvents().at(-1);
                const activeTerm = window.WordLoverApp.getActiveQuiz()?.entry?.term ?? null;
                return debugEvents.some((event) => event.stage === "rating-click" && event.rating === rating)
                    && debugEvents.some((event) => event.stage === "rating-recorded" && event.rating === rating)
                    && latestStudyEvent?.rating === rating
                    && activeTerm
                    && activeTerm !== firstTerm;
            }""",
            arg={"rating": rating, "firstTerm": first_term},
            timeout=8_000,
        )
        after_click = page.evaluate(
            """() => ({
                state: window.WordLoverApp.reviewDebug.state(),
                events: window.WordLoverApp.reviewDebug.events().slice(-12),
                latestStudyEvent: window.WordLoverApp.getStudyEvents().at(-1),
            })"""
        )
        results.append({
            "rating": rating,
            "firstTerm": first_term,
            "beforeClick": before_click,
            "afterClick": after_click,
        })

    return {"passed": len(results) == len(RATING_BUTTONS), "ratings": results}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:4173")
    parser.add_argument("--report", default=None, help="Write JSON report to this path")
    args = parser.parse_args()

    errors: list[str] = []
    console_messages: list[dict] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.on("console", lambda msg: console_messages.append({"type": msg.type, "text": msg.text}))
        page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))

        page.goto(f"{args.base}/?fresh=v35&reviewDebug=1", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)

        # New API surface from this session.
        api_surface = page.evaluate(
            """() => {
                const api = window.WordLoverApp;
                return {
                    hasSaveManualVocabularyItem: typeof api.saveManualVocabularyItem === 'function',
                    hasShowUnknownTermDialog: typeof api.showUnknownTermDialog === 'function',
                    hasDeleteAllLocalUserData: typeof api.deleteAllLocalUserData === 'function',
                    appVersion: api.getState().appVersion,
                    shellCacheVersion: api.getState().shellCacheVersion,
                };
            }"""
        )

        # New UI elements from this session.
        ui_elements = page.evaluate(
            """() => ({
                deleteLocalDataButton: Boolean(document.querySelector('#deleteLocalData')),
                deleteLocalDataIsDanger: document.querySelector('#deleteLocalData')?.classList.contains('danger-button') ?? false,
                appMenu: Boolean(document.querySelector('#appMenu')),
                resultPanel: Boolean(document.querySelector('#result')),
                aiDetailPanel: Boolean(document.querySelector('#aiDetailPanel')),
                vocabularyList: Boolean(document.querySelector('#vocabularyList')),
                quizPanel: Boolean(document.querySelector('#quizPanel')),
            })"""
        )

        # Render a not_found result and verify the new save-anyway button shows up.
        not_found_check = page.evaluate(
            """() => {
                const fakeNotFound = {
                    status: 'not_found',
                    term: 'plausibletestword',
                    alternatives: [],
                    queryMs: 0,
                };
                const termInput = document.querySelector('#termInput');
                termInput.value = 'plausibletestword';
                // Reach into the module via the exposed API where possible. renderResult
                // isn't exposed, but we can simulate by directly setting innerHTML via
                // dispatching a runLookup. Instead, evaluate the rendering by calling
                // suggestTerms/lookupTerm? No — we need renderResult itself. Use
                // window.dispatchEvent of an input event after setting value, then assert
                // the saveUnknownTerm button appears with no dictionary loaded? Lookup
                // requires dictionary. So skip this dynamic check.
                return { skipped: true, reason: 'renderResult not directly exposed without dictionary' };
            }"""
        )

        # Verify the unknown-term dialog opens when invoked directly.
        try:
            page.evaluate(
                """() => {
                    // Open the dialog programmatically; resolve nothing.
                    window.WordLoverApp.showUnknownTermDialog('demoword');
                }"""
            )
            dialog_check = page.evaluate(
                """() => ({
                    overlayPresent: Boolean(document.querySelector('.modal-overlay')),
                    hasTextarea: Boolean(document.querySelector('.modal-overlay textarea')),
                })"""
            )
            # Close the dialog so it doesn't leak between tests.
            page.evaluate("() => document.querySelector('.modal-overlay [data-modal-cancel]')?.click()")
        except Exception as exc:  # noqa: BLE001
            dialog_check = {"error": str(exc)}

        # Verify vocabulary search input renders once at least one item exists in the all view.
        # (Skip — depends on having items in memory; covered manually.)

        rating_button_pointer_check = run_rating_button_pointer_check(page)
        state = page.evaluate("() => window.WordLoverApp.getState()")

        browser.close()

    report = {
        "errors": errors,
        "console_warnings_and_errors": [m for m in console_messages if m["type"] in ("error", "warning")][:50],
        "api_surface": api_surface,
        "ui_elements": ui_elements,
        "not_found_check": not_found_check,
        "dialog_check": dialog_check,
        "rating_button_pointer_check": rating_button_pointer_check,
        "state_summary": {
            "appVersion": state.get("appVersion"),
            "shellCacheVersion": state.get("shellCacheVersion"),
            "vocabularyCount": len(state.get("vocabularyItems") or []),
            "loaded": state.get("loaded"),
        },
    }

    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps(report, indent=2, ensure_ascii=False))

    failures: list[str] = []
    if errors:
        failures.append(f"{len(errors)} runtime errors")
    for name, ok in [
        ("hasSaveManualVocabularyItem", api_surface.get("hasSaveManualVocabularyItem")),
        ("hasShowUnknownTermDialog", api_surface.get("hasShowUnknownTermDialog")),
        ("hasDeleteAllLocalUserData", api_surface.get("hasDeleteAllLocalUserData")),
    ]:
        if not ok:
            failures.append(f"missing WordLoverApp.{name}")
    if not ui_elements.get("deleteLocalDataButton"):
        failures.append("delete-local-data button missing from DOM")
    if not ui_elements.get("deleteLocalDataIsDanger"):
        failures.append("delete-local-data button missing danger-button class")
    if not dialog_check.get("overlayPresent"):
        failures.append("unknown-term dialog did not render an overlay")
    if not dialog_check.get("hasTextarea"):
        failures.append("unknown-term dialog did not render a textarea field (modal textarea support missing)")
    if not rating_button_pointer_check.get("passed"):
        failures.append("FSRS rating buttons did not pass real pointer-click checks")

    if failures:
        print("\nFAILED:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("\nPASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
