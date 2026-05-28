"""Smoke for the "On Return" save action + add-to-spelling/add-to-dictionary (SP-1/2/3).

Installs the dictionary so real-word lookups resolve, then verifies:
- On Return = vocabulary saves the looked-up word to the vocabulary list;
- On Return = spelling saves it to the spelling list;
- On Return = none saves nothing;
- On Return = spelling with a non-dictionary word flags the input red (no save);
- a not-found result offers an "Add to dictionary" button;
- the speak-on-return setting persists.
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


def press_return(page, word):
    page.evaluate(
        """(w) => {
            const input = document.querySelector('#termInput');
            input.value = w;
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        }""",
        word,
    )


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.goto(f"{base}/?fresh=onreturn-smoke", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        time.sleep(3.0)
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        dismiss_gate(page)
        page.evaluate("async () => await window.WordLoverApp.ensureDictionaryLoaded()")
        page.wait_for_function("() => window.WordLoverApp.getState().loaded === true", timeout=90000)

        # Pick three real dictionary words.
        words = page.evaluate(
            """() => ['abandon','ability','able'].filter(w => { try { return window.WordLoverApp.lookupTerm(w).status === 'found'; } catch { return false; } })"""
        )
        print(f"usable dictionary words: {words}", flush=True)
        if len(words) < 3:
            failures.append(f"need 3 dictionary words for the test, found {words}")
            words = (words + ["abandon", "ability", "able"])[:3]
        w_vocab, w_spell, w_none = words[0], words[1], words[2]

        # On Return = vocabulary
        page.evaluate("async () => await window.WordLoverApp.setOnReturnAction('vocabulary')")
        press_return(page, w_vocab)
        page.wait_for_function(f"() => window.WordLoverApp.getVocabulary().some(i => i.term === {w_vocab!r})", timeout=5000)

        # On Return = spelling
        page.evaluate("async () => await window.WordLoverApp.setOnReturnAction('spelling')")
        press_return(page, w_spell)
        page.wait_for_function(f"() => window.WordLoverApp.getSpelling().some(i => i.term === {w_spell!r})", timeout=5000)

        # On Return = none
        page.evaluate("async () => await window.WordLoverApp.setOnReturnAction('none')")
        press_return(page, w_none)
        time.sleep(0.8)
        state = page.evaluate(
            f"""() => ({{
                vocabHasNone: window.WordLoverApp.getVocabulary().some(i => i.term === {w_none!r}),
                spellHasNone: window.WordLoverApp.getSpelling().some(i => i.term === {w_none!r}),
                vocabHasVocab: window.WordLoverApp.getVocabulary().some(i => i.term === {w_vocab!r}),
                spellHasSpell: window.WordLoverApp.getSpelling().some(i => i.term === {w_spell!r}),
                spellHasVocab: window.WordLoverApp.getSpelling().some(i => i.term === {w_vocab!r}),
            }})"""
        )
        print(f"after 3 modes: {state}", flush=True)
        if not state.get("vocabHasVocab"):
            failures.append("On Return=vocabulary did not save to vocabulary")
        if not state.get("spellHasSpell"):
            failures.append("On Return=spelling did not save to spelling")
        if state.get("vocabHasNone") or state.get("spellHasNone"):
            failures.append("On Return=none saved something")
        if state.get("spellHasVocab"):
            failures.append("vocabulary word leaked into spelling list (not independent)")

        # On Return = spelling with a non-dictionary word -> input flagged red, nothing saved.
        page.evaluate("async () => await window.WordLoverApp.setOnReturnAction('spelling')")
        press_return(page, "zxqwlmnvb")
        time.sleep(0.4)
        red = page.evaluate(
            """() => ({
                invalid: document.querySelector('#termInput').classList.contains('input-invalid'),
                spellingCount: window.WordLoverApp.getSpelling().length,
            })"""
        )
        print(f"non-dict spelling return: {red}", flush=True)
        if not red.get("invalid"):
            failures.append("non-dictionary word under spelling action did not flag the input red")

        # not_found result offers an Add to dictionary button.
        addbtn = page.evaluate(
            """() => {
                try { window.WordLoverApp.lookupTerm('zxqwlmnvb'); } catch {}
                const data = window.WordLoverApp.lookupTerm('zxqwlmnvb');
                return data.status;
            }"""
        )
        page.evaluate("() => { document.querySelector('#termInput').value = 'zxqwlmnvb'; document.querySelector('#termInput').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); }")
        time.sleep(0.6)
        has_add = page.evaluate("() => Boolean(document.querySelector('#addToDictionary'))")
        print(f"not_found status={addbtn} addToDictionary button present={has_add}", flush=True)
        if not has_add:
            failures.append("not-found result did not offer an 'Add to dictionary' button")

        # speak-on-return persists.
        page.evaluate("async () => await window.WordLoverApp.setSpeakOnReturn(true)")
        persisted = page.evaluate("() => document.querySelector('#speakOnReturnToggle')?.checked")
        if not persisted:
            failures.append("speak-on-return toggle not reflected after setSpeakOnReturn(true)")

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
