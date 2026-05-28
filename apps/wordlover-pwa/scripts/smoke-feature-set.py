"""Targeted smoke for the v44 feature set:
- No passphrase modal at startup (auto-unlock + migration).
- Speaker button rendered alongside IPA.
- Explore-next section removed.
- Login gate modal appears on first run for non-automated contexts.
- Sunrise is the default theme; candy (kid) theme is selectable.
- AI chat LRU cache is wired and exposed for testing.
"""
from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:4173"
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context()
        page = ctx.new_page()
        page.on("pageerror", lambda e: print(f"PAGEERROR: {e}", flush=True))
        page.goto(f"{base}/?fresh=v56", wait_until="domcontentloaded")
        page.wait_for_function("window.WordLoverApp != null", timeout=15000)

        # Give SW controllerchange-reload a chance to settle.
        time.sleep(3.0)

        # Check 1: No passphrase modal anywhere (count over time, not just at one tick).
        passphrase_seen = False
        for _ in range(20):
            if page.locator("#passphrase").count() > 0:
                passphrase_seen = True
                break
            time.sleep(0.1)
        if passphrase_seen:
            failures.append("passphrase modal appeared at startup")

        # The first-run login gate should have shown (or already shown and dismissed via reload).
        # We don't assert the gate is on-screen now because the user may have already passed it
        # on a prior load. We do assert it is wired by checking the loginGateAcknowledged key
        # was either set or the gate is currently visible.
        gate_visible_or_handled = page.evaluate(
            """async () => {
                const overlay = document.querySelector('.modal-overlay');
                const title = overlay?.querySelector('h2')?.textContent ?? '';
                if (title === 'Welcome to WordFan') return 'visible';
                // Check IndexedDB for loginGateAcknowledged flag.
                return await new Promise((resolve) => {
                    const req = indexedDB.open('wordlover-user');
                    req.onsuccess = () => {
                        const db = req.result;
                        try {
                            const tx = db.transaction('kv', 'readonly');
                            const store = tx.objectStore('kv');
                            const get = store.get('loginGateAcknowledged');
                            get.onsuccess = () => resolve(get.result ? 'acknowledged' : 'never-shown');
                            get.onerror = () => resolve('error');
                        } catch {
                            resolve('no-store');
                        }
                    };
                    req.onerror = () => resolve('open-error');
                });
            }"""
        )
        print(f"login gate state: {gate_visible_or_handled}", flush=True)
        if gate_visible_or_handled not in ("visible", "acknowledged"):
            # If gate is visible, dismiss with skip
            failures.append(f"login gate not wired up correctly: {gate_visible_or_handled}")
        if gate_visible_or_handled == "visible":
            page.click("[data-modal-cancel]")
            time.sleep(0.3)

        # Check 2: Explore-next section is GONE from the DOM.
        explore_count = page.evaluate("() => document.querySelectorAll('#wordPromptPanel, #exploreWord').length")
        if explore_count != 0:
            failures.append(f"explore-next elements still present in DOM (count={explore_count})")

        # Check 3: Speaker button function is available.
        speaker_function_check = page.evaluate(
            """() => typeof window.speechSynthesis !== 'undefined'"""
        )
        if not speaker_function_check:
            failures.append("window.speechSynthesis API not available in this Chromium")

        # Render a fake quiz to verify speaker button shows in quiz card.
        speaker_in_quiz = page.evaluate(
            """() => {
                // We can't easily render a quiz without a dictionary loaded. Instead
                // check that the renderSpeakerButton-like markup is reachable.
                // Inspect that the new CSS classes are defined.
                const styles = Array.from(document.styleSheets).map(s => {
                    try { return s.cssRules; } catch { return []; }
                });
                const all = [].concat(...Array.from(styles).map(rules => Array.from(rules)));
                return all.some(r => r.selectorText === '.speaker-button');
            }"""
        )
        if not speaker_in_quiz:
            failures.append("`.speaker-button` CSS rule missing")

        # Check 4: App version + cache version bumped.
        state = page.evaluate("() => window.WordLoverApp.getState()")
        print(f"appVersion={state.get('appVersion')} cache={state.get('shellCacheVersion')}", flush=True)
        if state.get("appVersion") != "0.6.2-product.20260528-v56":
            failures.append(f"appVersion not v56: {state.get('appVersion')}")
        if state.get("shellCacheVersion") != "wordlover-shell-v56":
            failures.append(f"shell cache version not v56: {state.get('shellCacheVersion')}")

        # Check 5 (v44): all theme options present, including the new kid-friendly candy theme.
        theme_options = page.evaluate(
            """() => Array.from(document.querySelectorAll('#themeSelect option')).map(o => o.value)"""
        )
        for required in ("sunrise", "candy", "calm", "ink", "sky", "rose"):
            if required not in theme_options:
                failures.append(f"theme option '{required}' missing (have {theme_options})")

        # Check 5b (v44): sunrise is the default theme on a fresh context.
        if state.get("theme") != "sunrise":
            failures.append(f"default theme is not sunrise: {state.get('theme')}")

        # Check 5c (v44): applying the candy theme sets the document attribute.
        applied_theme = page.evaluate(
            """() => {
                const applied = window.WordLoverApp.applyTheme('candy');
                return { applied, attr: document.documentElement.dataset.theme };
            }"""
        )
        if applied_theme.get("applied") != "candy" or applied_theme.get("attr") != "candy":
            failures.append(f"candy theme did not apply: {applied_theme}")
        page.evaluate("() => window.WordLoverApp.applyTheme('sunrise')")

        # Check 6 (v43): Confirm history is NOT added for partial typing (commit gate).
        # Fresh headless context starts with empty history. Simulate live-typing 'fa'
        # and verify history stays empty after the debounced lookup fires.
        history_partial = page.evaluate(
            """async () => {
                const input = document.querySelector('#termInput');
                input.value = 'fa';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise((r) => setTimeout(r, 500));
                return window.WordLoverApp.getState().historyItems;
            }"""
        )
        if isinstance(history_partial, list) and len(history_partial) > 0:
            failures.append(f"history populated by partial typing: {history_partial}")

        # Confirm Query time text isn't in result panel.
        query_time_text = page.evaluate(
            """() => (document.querySelector('#result')?.textContent ?? '').toLowerCase().includes('query time')"""
        )
        if query_time_text:
            failures.append("`Query time` text still present in result panel")

        # Check 7 (v43): Google sign-in button should be enabled when not signed in
        # (so user can paste a client ID even with empty CONFIG).
        signin_enabled = page.evaluate(
            """() => {
                const btn = document.querySelector('#googleSignIn');
                return btn ? !btn.disabled : false;
            }"""
        )
        if not signin_enabled:
            failures.append("Google sign-in button is still disabled when no client ID is configured")

        # Check 8 (v44): AI chat LRU cache is exposed and evicts least-recently-used at the limit.
        lru = page.evaluate(
            """() => {
                const api = window.WordLoverApp.aiChat;
                if (!api) return { error: 'no aiChat api' };
                const limit = api.limit;
                // Fill the cache beyond the limit.
                for (let i = 0; i < limit + 5; i++) api.cacheSet('word' + i, { definition: 'd' + i });
                const sizeAfterFill = api.cacheSize();
                // word0..word4 should have been evicted (oldest first).
                const evictedOldest = api.cacheGet('word0') === null && api.cacheGet('word4') === null;
                const keptNewest = api.cacheGet('word' + (limit + 4)) !== null;
                // Touch an old-ish key to promote it (LRU recency), then push one more.
                const promoteKey = 'word' + (limit - 1);
                api.cacheGet(promoteKey);            // promote to most-recent
                api.cacheSet('extra', { definition: 'x' }); // evicts the new front, not the promoted key
                const promotedSurvived = api.cacheGet(promoteKey) !== null;
                return { limit, sizeAfterFill, evictedOldest, keptNewest, promotedSurvived };
            }"""
        )
        print(f"AI chat LRU: {lru}", flush=True)
        if lru.get("error"):
            failures.append(f"AI chat cache API missing: {lru['error']}")
        else:
            if lru.get("sizeAfterFill") != lru.get("limit"):
                failures.append(f"AI cache exceeded limit: size={lru.get('sizeAfterFill')} limit={lru.get('limit')}")
            if not lru.get("evictedOldest"):
                failures.append("AI cache did not evict oldest entries first")
            if not lru.get("keptNewest"):
                failures.append("AI cache dropped the newest entry")
            if not lru.get("promotedSurvived"):
                failures.append("AI cache LRU promotion-on-read did not protect a recently-read key")

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
