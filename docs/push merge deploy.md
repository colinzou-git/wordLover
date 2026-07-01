# Deploy

## How it works now (automatic)

**Push to `main` → it deploys.** The `deploy` job in `.github/workflows/ci.yml`
runs after the `static-checks` and `smoke` jobs pass, publishes the app shell from
`apps/wordlover-pwa/public/` to the `gh-pages` branch, and GitHub Pages serves it at
https://wordfan.app/.

This means you can edit code, commit, and push from anywhere (including the iPhone
Claude app driving this machine remotely) and the live site updates with no manual
step on the Windows box.

## Version numbers bump themselves

You no longer hand-edit version strings. `.githooks/pre-commit` (enable once with
`git config core.hooksPath .githooks`) runs `bump-shell-version.py` whenever a
`public/` shell asset is part of the commit, advancing `APP_VERSION`, the cache
name, and every `?v=` cache-buster together, and regenerating the symbol map. So
each deploy that changes the shell carries a new, fully-lockstepped version with no
manual step, and the menu's version number moves on every real deploy.

A code-only push that does **not** touch the shell intentionally keeps the same
version — there is nothing new to cache-bust. If you ever commit on a box without
the hook and the markers drift, CI's `check_versions.py` goes red and the deploy is
skipped; run `npm run bump` (in `apps/wordlover-pwa/`) and push to fix it.

## Confirming the *exact* commit that is live (BUILD_STAMP)

`APP_VERSION` identifies the shell (and drives the "Apply update" prompt), but it
only moves when the shell changes. To verify a specific commit actually deployed,
the **deploy job stamps `BUILD_STAMP`** in the published `app.js` with
`<YYYYMMDD>-<HHMM>-<shortsha>` (UTC; the commit SHA only exists after the commit, so
this can only happen at deploy time, not in the pre-commit hook). The menu shows it
next to the version (`… · 20260623-1807-50a32ac`), and **Check for update** prints
`Device: … build <stamp>` vs `Server: … build <stamp>` — the *Server* line is
fetched live (cache-bypassing), so its short SHA is the commit currently on
`wordfan.app`. Match it against `git rev-parse --short HEAD` on `main` to confirm
the latest push is live.

Locally `BUILD_STAMP` stays `"dev"` and is hidden, so a dev build is never mistaken
for a deployed one. The manual `deploy-github-pages.ps1` stamps the same way (local
time) for dictionary deploys.

What the job does:

1. Copies the web shell from `public/` (excludes dev launchers `*.ps1`, build
   scripts `*.py`, docs `*.md`, certs).
2. **Carries `dictionary.sqlite` + `.zst` forward from the existing `gh-pages`
   branch.** The ~32 MB dictionary is gitignored on `main` and CI has no source to
   rebuild the full 100k-entry set, so it is never rebuilt for a code-only deploy.
3. Verifies the carried dictionary's sha256 matches `dictionary-manifest.json` on
   `main`. If they differ, the deploy **fails loudly** rather than shipping a broken
   manifest/binary pair.
4. Force-pushes a single orphan commit to `gh-pages` (keeps the branch from
   accumulating 32 MB blobs in history).

Re-deploy without a new commit: GitHub → Actions → CI → **Run workflow** on `main`
(the job also accepts `workflow_dispatch`).

## The one case that still needs the Windows box: changing the dictionary

The dictionary content rarely changes. When it does, CI can't rebuild it, so the
auto-deploy guard will fail on purpose. Publish the new binary once locally:

```powershell
# Rebuild the dictionary (see CLAUDE.md "Dictionary data pipeline"), which updates
# apps/wordlover-pwa/public/dictionary-manifest.json, then commit that manifest to main.
git add apps/wordlover-pwa/public/dictionary-manifest.json
git commit -m "Bump dictionary to <version>"

# Publish the new binary + manifest to gh-pages directly.
powershell -NoProfile -ExecutionPolicy Bypass -File apps\wordlover-pwa\scripts\deploy-github-pages.ps1
```

After that, the dictionary on `gh-pages` matches the manifest on `main` again, and
subsequent code-only pushes auto-deploy as normal.

## Verify a deploy

```powershell
gh api repos/colinzou-git/wordLover/pages --jq "{status: .status, html_url: .html_url, source: .source}"
gh api repos/colinzou-git/wordLover/pages/builds --jq ".[0] | {status: .status, error: .error, updated_at: .updated_at}"
```

## One-time GitHub setup (already done, for reference)

GitHub repo → Settings → Pages → Source = **Deploy from a branch**, branch =
`gh-pages` / `(root)`, custom domain = `wordfan.app`, **Enforce HTTPS** on.

## Kaikki preview deployment

Kaikki work remains on `feature/kaikki-dictionary-preview`. Its manual
`.github/workflows/kaikki-preview.yml` workflow uploads an artifact and never
writes to `gh-pages`; production deployment and root dictionary URLs remain
unchanged. See `docs/kaikki-dictionary-design.md` for local and Actions preview
instructions and the post-audit promotion gate.
