# Main branch audit — 2026-07-05

Requested scope: review the current `main` branch for bugs after the Kaikki and review-local-dictionary merges.

## Finding 1 — AI Chat quiz fill-in-the-blank builds an unescaped regular expression

In `apps/wordlover-pwa/public/app.js`, `renderAiQuizCard()` builds the Fill-in-the-blank prompt with:

```js
(payload.examples ?? [])[0]?.replace(new RegExp(term, "i"), "____")
```

This is unsafe for any valid or user-entered term that contains regular-expression metacharacters. Today most dictionary terms are letters/spaces/hyphens/apostrophes, but user dictionary entries and future terminology can include characters such as `+`, `.`, `?`, `(`, `)`, `[`, `]`, etc. When that happens, the quiz may throw or replace the wrong substring.

### Required fix

Add a local helper near `shuffle()` or other AI quiz helpers:

```js
function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

Then change the fill prompt generation to use:

```js
const termPattern = new RegExp(escapeRegExp(term), "i");
const sentence = payload.fillBlankSentence
  || (payload.examples ?? [])[0]?.replace(termPattern, "____")
  || `She used ____ in a sentence.`;
```

### Tests

Add a JavaScript regression test that verifies an AI quiz can render a fill-in-the-blank card for a term containing regex metacharacters without throwing, for example `c++`, `end-to-end`, or `a.b`.

## Finding 2 — production update-check network failures can show local-server wording

Recent live debugging showed the app displayed a message telling the user to keep the Windows server running even when the user was on `https://wordfan.app/`. That wording is misleading in production. It should be conditional on origin.

### Required fix

Find the `checkForAppUpdate()` failure branch in `apps/wordlover-pwa/public/app.js` and make the fallback environment-aware:

- For localhost / `127.0.0.1`: mention the local dev server and `/?fresh=latest`.
- For `https://wordfan.app`: mention the live WordFan site/network/custom-domain reachability and `https://wordfan.app/?fresh=latest`.
- Do not mention Windows when `window.location.hostname` is not localhost.

### Tests

Add static or browser regression coverage for the generated user-facing update-check error message in production origin vs localhost origin.

## Finding 3 — current production outage is not a source-code bug

The user’s Windows checks showed `wordfan.app` DNS resolves to GitHub Pages IPs, but HTTPS requests reset the connection:

```text
curl: (35) Recv failure: Connection was reset
```

That points to GitHub Pages custom-domain/HTTPS/network filtering, not the app shell code. Fix this through GitHub Pages custom-domain settings, DNS/HTTPS certificate, or network filtering diagnostics, not an app code patch.

## Notes

No generated dictionary assets should be changed during these fixes.
