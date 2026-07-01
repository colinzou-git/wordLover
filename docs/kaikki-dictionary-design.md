# Kaikki dictionary preview design

Kaikki dictionary development is isolated on
`feature/kaikki-dictionary-preview`. Do not merge this branch to `main` until
issues #17, #18, #24, #25, #19, #23, #20, #21, #26, and #22 are complete and
the final audit passes.

## Safety boundary

Production continues to use `/dictionary-manifest.json` and `/dictionary-full`.
The Kaikki preview is selected explicitly with `?dictionary=kaikki-preview` and
uses only:

```text
/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-manifest.json
/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-full
```

Generated preview files live under
`apps/wordlover-pwa/public/kaikki-preview/feature-kaikki-dictionary-preview/`
and are gitignored. The guarded packager rejects every other output directory,
including the production public root.

## Local Ubuntu preview

Prepare dictionary assets in a temporary directory, package them, and serve the
normal public directory:

```bash
python apps/wordlover-pwa/scripts/create-ci-dictionary.py \
  --output-dir /tmp/wordfan-kaikki-prepared \
  --work-dir /tmp/wordfan-kaikki-work \
  --version kaikki-preview-local
python scripts/build_kaikki_preview.py \
  --source-dir /tmp/wordfan-kaikki-prepared
python -m http.server 4173 --directory apps/wordlover-pwa/public
```

Open
`http://127.0.0.1:4173/?dictionary=kaikki-preview&fresh=latest`. The CI fixture
is used only to prove the isolation pipeline for issue #27; subsequent Kaikki
builder issues will supply the real prepared assets through the same interface.

## Manual GitHub Actions preview

In GitHub Actions, choose **Build Kaikki dictionary preview artifact**, select
**Run workflow**, and run it from the feature branch. The workflow has only a
`workflow_dispatch` trigger. Download the named artifact from the completed run,
extract it, and serve its `public` directory with:

```bash
python -m http.server 4173 --directory public
```

The workflow uploads an artifact only. It never pushes to `gh-pages`, because the
production deploy force-replaces that branch and a separately written preview
subdirectory would be unreliable.

## Confirm production is unaffected

Run the test suites, then verify that the production assets have no diff:

```bash
cd apps/wordlover-pwa && npm test && cd ../..
python -m unittest discover -s scripts/tests -p 'test_*.py'
git diff -- apps/wordlover-pwa/public/dictionary.sqlite \
  apps/wordlover-pwa/public/dictionary.sqlite.zst \
  apps/wordlover-pwa/public/dictionary-manifest.json \
  apps/wordlover-pwa/public/dictionary-full/
```

Loading the app without `?dictionary=kaikki-preview` must still request the two
production URLs above.

## Promotion after audit

Promotion is a separate, reviewed release operation after every dependent issue
and the audit pass. Rebuild production assets from the approved Kaikki source,
review manifest/version/source metadata and lookup regressions, then use the
existing production dictionary publication process. Do not copy preview output
to production paths or merge this branch as a shortcut.
