"""Targeted smoke for the v44 AI Chat features:
- Explain tab renders morphology (Word parts) and Chinese translations.
- Examples and Synonyms tabs render Chinese translations.
- Tab buttons highlight the active tab (the `--accent` regression that made the
  selected tab text vanish is fixed: active background differs from inactive).
- Clear button also clears the Gemini details panel.

Runs against the local HTTP dev server (no Gemini key required: the payload is
injected through the WordLoverApp.aiChat test hook).
"""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright

FAKE_PAYLOAD = {
    "definition": "To give up completely.",
    "definitionZh": "彻底放弃。",
    "origin": "From Old French abandoner.",
    "originZh": "源自古法语 abandoner。",
    "morphology": {
        "prefix": "a-",
        "prefixMeaning": "to / toward",
        "root": "bandon",
        "rootMeaning": "control",
        "suffix": "",
        "suffixMeaning": "",
        "breakdown": "A root carries the core meaning; a prefix attaches before it.",
        "breakdownZh": "词根承载核心意义；前缀加在它前面。",
    },
    "examples": ["They abandoned the plan.", "Do not abandon hope."],
    "examplesZh": ["他们放弃了计划。", "不要放弃希望。"],
    "synonyms": [
        {"word": "desert", "comparison": "stresses leaving duty behind", "comparisonZh": "强调抛下责任"},
        {"word": "forsake", "comparison": "more literary", "comparisonZh": "更具文学色彩"},
    ],
    "antonyms": ["keep", "retain"],
    "chineseMeaning": "放弃",
}


def dismiss_gate(page):
    for _ in range(20):
        cancel = page.locator(".modal-overlay [data-modal-cancel]")
        if cancel.count() > 0:
            cancel.first.click()
            time.sleep(0.2)
            return
        time.sleep(0.1)


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.goto(f"{base}/?fresh=ai-chat-smoke", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)
        time.sleep(2.0)
        dismiss_gate(page)

        # Render the explain tab with an injected payload (no network/Gemini key needed).
        page.evaluate("(payload) => window.WordLoverApp.aiChat.renderExplain('abandon', payload)", FAKE_PAYLOAD)
        time.sleep(0.2)

        explain_text = page.evaluate("() => document.querySelector('#aiChatContent').textContent")
        if "中文：" not in explain_text:
            failures.append("Explain tab missing Chinese translation (中文：)")
        if "Word parts" not in explain_text:
            failures.append("Explain tab missing morphology 'Word parts' section")
        if "a-" not in explain_text or "bandon" not in explain_text:
            failures.append("Explain tab missing prefix/root morphemes")

        # Tab highlight: the active tab must visibly differ from an inactive tab.
        highlight = page.evaluate(
            """() => {
                const tabs = Array.from(document.querySelectorAll('.ai-chat-tabs [data-ai-tab]'));
                const active = tabs.find(t => t.getAttribute('aria-selected') === 'true');
                const inactive = tabs.find(t => t.getAttribute('aria-selected') === 'false');
                if (!active || !inactive) return { error: 'tabs not found' };
                const activeBg = getComputedStyle(active).backgroundColor;
                const inactiveBg = getComputedStyle(inactive).backgroundColor;
                const activeColor = getComputedStyle(active).color;
                return { activeBg, inactiveBg, activeColor, same: activeBg === inactiveBg };
            }"""
        )
        print(f"tab highlight: {highlight}", flush=True)
        if highlight.get("error"):
            failures.append(f"tab highlight check failed: {highlight['error']}")
        else:
            if highlight.get("same"):
                failures.append("active tab background equals inactive tab (not highlighted)")
            if highlight.get("activeBg") in ("rgba(0, 0, 0, 0)", "transparent"):
                failures.append("active tab background is transparent (the --accent regression)")
            # The disappearing-text bug: white text on a light/transparent background.
            if highlight.get("activeColor") == highlight.get("activeBg"):
                failures.append("active tab text color equals its background (invisible)")

        # Examples tab shows Chinese per example.
        page.evaluate("() => window.WordLoverApp.aiChat.setTab('examples')")
        time.sleep(0.15)
        examples_text = page.evaluate("() => document.querySelector('#aiChatContent').textContent")
        if "放弃了计划" not in examples_text:
            failures.append("Examples tab missing per-example Chinese translation")

        # Synonyms tab shows Chinese comparison.
        page.evaluate("() => window.WordLoverApp.aiChat.setTab('synonyms')")
        time.sleep(0.15)
        synonyms_text = page.evaluate("() => document.querySelector('#aiChatContent').textContent")
        if "强调抛下责任" not in synonyms_text:
            failures.append("Synonyms tab missing comparison Chinese translation")

        page.evaluate("() => window.WordLoverApp.aiChat.close()")

        # Gemini details cards: Chinese appears under each English paragraph.
        detail_text = page.evaluate(
            """() => {
                const detail = {
                    model: 'gemini-2.5-flash',
                    generatedAt: '2026-05-27T00:00:00Z',
                    structured: {
                        meanings: [
                            { definition: 'to give up completely', definitionZh: '彻底放弃',
                              examples: ['They abandoned the plan.'], examplesZh: ['他们放弃了计划。'] },
                        ],
                        commonUsage: 'Often used with hope or plans.', commonUsageZh: '常与希望或计划搭配。',
                        wordHistory: 'From Old French.', wordHistoryZh: '源自古法语。',
                        learnerNotes: 'Stronger than quit.', learnerNotesZh: '比 quit 更强烈。',
                    },
                };
                window.WordLoverApp.aiChat.renderDetails(detail);
                return document.querySelector('#aiDetailPanel').textContent;
            }"""
        )
        for needed in ("彻底放弃", "他们放弃了计划", "常与希望或计划搭配", "源自古法语", "比 quit 更强烈"):
            if needed not in detail_text:
                failures.append(f"Gemini details missing Chinese paragraph: {needed}")

        # Clear button also clears the Gemini details panel.
        clear_result = page.evaluate(
            """() => {
                const panel = document.querySelector('#aiDetailPanel');
                panel.hidden = false;
                panel.innerHTML = '<p>gemini details here</p>';
                document.querySelector('#clearSearch').click();
                return { hidden: panel.hidden, html: panel.innerHTML };
            }"""
        )
        print(f"clear result: {clear_result}", flush=True)
        if not clear_result.get("hidden") or clear_result.get("html"):
            failures.append(f"Clear did not clear the Gemini details panel: {clear_result}")

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
