# Deploy

## How it works now (automatic)

**Push to `main` → it deploys.** The `deploy` job in `.github/workflows/ci.yml`
runs after the `static-checks` and `smoke` jobs pass, publishes the app shell from
`apps/wordlover-pwa/public/` to the `gh-pages` branch, and GitHub Pages serves it at
https://wordfan.app/.

This means you can edit code, commit, and push from anywhere (including the iPhone
Claude app driving this machine remotely) and the live site updates with no manual
step on the Windows box.

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
