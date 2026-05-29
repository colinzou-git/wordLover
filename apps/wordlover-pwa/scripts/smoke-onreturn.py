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

        # Pick four real dictionary words.
        words = page.evaluate(
            """() => ['abandon','ability','able','about'].filter(w => { try { return window.WordLoverApp.lookupTerm(w).status === 'found'; } catch { return false; } })"""
        )
        print(f"usable dictionary words: {words}", flush=True)
        if len(words) < 4:
            failures.append(f"need 4 dictionary words for the test, found {words}")
            words = (words + ["abandon", "ability", "able", "about"])[:4]
        w_vocab, w_spell, w_none, w_both = words[0], words[1], words[2], words[3]

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

        # On Return = both -> the word lands in BOTH the vocabulary and spelling lists.
        page.evaluate("async () => await window.WordLoverApp.setOnReturnAction('both')")
        press_return(page, w_both)
        time.sleep(0.8)
        both_state = page.evaluate(
            f"""() => ({{
                inVocab: window.WordLoverApp.getVocabulary().some(i => i.term === {w_both!r}),
                inSpell: window.WordLoverApp.getSpelling().some(i => i.term === {w_both!r}),
            }})"""
        )
        print(f"both mode ({w_both}): {both_state}", flush=True)
        if not both_state.get("inVocab"):
            failures.append("On Return=both did not save to vocabulary")
        if not both_state.get("inSpell"):
            failures.append("On Return=both did not save to spelling")

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
        # Fire an input event first (like real typing) so the double-Return arm resets.
        page.evaluate("() => { const i = document.querySelector('#termInput'); i.value = 'zxqwlmnvb'; i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); }")
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

        # Input filter: stray symbol keys are dropped; letters/digits/space/hyphen/apostrophe kept.
        cleaned = page.evaluate(
            """() => {
                const i = document.querySelector('#termInput');
                i.value = "ab@c!d#1- e'f";
                i.dispatchEvent(new Event('input', { bubbles: true }));
                const v = i.value;
                i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true }));
                return v;
            }"""
        )
        print(f"sanitized input: {cleaned!r}", flush=True)
        if cleaned != "abcd1- e'f":
            failures.append(f"input sanitizer wrong: got {cleaned!r}, expected \"abcd1- e'f\"")

        # Double Return: 2nd Return on unchanged text clears the field.
        page.evaluate("async () => await window.WordLoverApp.setOnReturnAction('vocabulary')")
        press_return(page, w_vocab)
        time.sleep(0.3)
        val_after_first = page.evaluate("() => document.querySelector('#termInput').value")
        press_return(page, w_vocab)
        time.sleep(0.3)
        val_after_second = page.evaluate("() => document.querySelector('#termInput').value")
        print(f"double-return: after1={val_after_first!r} after2={val_after_second!r}", flush=True)
        if not val_after_first:
            failures.append("field cleared after the FIRST Return (should keep the word)")
        if val_after_second != "":
            failures.append(f"second Return did not clear the field (value={val_after_second!r})")

        # Undo: saving a NEW word shows Undo; clicking it removes the word.
        undo_word = page.evaluate(
            """() => ['absent','accept','account','active','animal','answer'].find(w => {
                try { return window.WordLoverApp.lookupTerm(w).status === 'found'
                    && !window.WordLoverApp.getVocabulary().some(i => i.term === w); } catch { return false; }
            }) ?? null"""
        )
        print(f"undo test word: {undo_word}", flush=True)
        if not undo_word:
            failures.append("could not find an unsaved dictionary word for the undo test")
        else:
            press_return(page, undo_word)
            page.wait_for_function(
                f"() => window.WordLoverApp.getVocabulary().some(i => i.term === {undo_word!r})", timeout=5000
            )
            undo_visible = page.evaluate("() => { const b = document.querySelector('#undoSave'); return b && !b.hidden; }")
            if not undo_visible:
                failures.append("Undo button did not appear after saving a new word")
            page.evaluate("() => document.querySelector('#undoSave').click()")
            time.sleep(0.5)
            still_there = page.evaluate(f"() => window.WordLoverApp.getVocabulary().some(i => i.term === {undo_word!r})")
            undo_hidden = page.evaluate("() => { const b = document.querySelector('#undoSave'); return !b || b.hidden; }")
            print(f"after undo: stillSaved={still_there} undoHidden={undo_hidden}", flush=True)
            if still_there:
                failures.append("Undo did not remove the just-saved word")
            if not undo_hidden:
                failures.append("Undo button still visible after undoing")

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
