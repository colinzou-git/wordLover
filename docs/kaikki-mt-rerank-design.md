# Kaikki MT-assisted overlay reranking

This optional offline step uses machine translation only as a ranking hint for
existing WordFan/ECDICT Chinese candidates. It never adds MT-only Chinese, does
not replace the overlay source, is not called by the browser, and is not part of
normal Kaikki packaging. Normal builds remain offline and require no API key.

## Safety and selection

Run only on generated Kaikki working databases, never production assets. The
script selects rows whose `translationFallback.zhSource` is
`wordfan-full-overlay` or `wordfan-slim-overlay`, which have at least two Chinese
candidates and a usable English sense. Kaikki-native Chinese rows are skipped.

English source priority is the first useful compact meaning, first detailed
definition, then first cleaned legacy definition line. The headword alone is
never translated. Chinese candidates are split on common comma, semicolon,
list, slash, pipe, and newline separators. MT matches exact candidates, adjective
suffix variants, or high-confidence substrings; unmatched candidates retain
their original relative order.

Dry-run is the default. Apply mode updates only `dictionary_entries.translation`
and `detail.translationFallback`. Changed rows preserve `zhOriginal`, record
`zhDisplayOrderSource=mt-reranked-ecdict`, and include provider/match metadata.
The separate SQLite cache makes runs resumable and avoids repeat provider calls.

## Mock dry-run

The deterministic mock provider requires no network:

```bash
python scripts/rerank_ecdict_overlay_with_mt.py \
  --db data/kaikki-build/dictionary-kaikki.sqlite \
  --cache data/kaikki-build/mt-rerank-cache.sqlite \
  --provider mock \
  --rank-max 50000 \
  --limit 5000 \
  --dry-run \
  --report data/kaikki-build/mt-rerank-report.mock.json
```

## Google dry-run and apply

Google Cloud Translation v2 is the first real provider. Set the key only in the
build environment:

```bash
export GOOGLE_TRANSLATE_API_KEY="..."

python scripts/rerank_ecdict_overlay_with_mt.py \
  --db data/kaikki-build/dictionary-kaikki.sqlite \
  --cache data/kaikki-build/mt-rerank-cache.sqlite \
  --provider google \
  --source-lang en \
  --target-lang zh-CN \
  --rank-max 50000 \
  --limit 5000 \
  --batch-size 50 \
  --request-chars-max 5000 \
  --chars-per-minute 100000 \
  --dry-run \
  --report data/kaikki-build/mt-rerank-report.dry-run.json
```

Review the dry-run report before replacing `--dry-run` with `--apply`. Use
`--resume` to document a continuation run and `--force-refresh` only when cached
translations must be replaced. `--continue-on-errors` records provider failures
and continues with successful/cached batches.

The report's Google cost field estimates `$20 / million` characters after
500,000 characters. Actual cost depends on provider pricing, account, monthly
usage, and free-tier eligibility; consult current Google billing information
before a paid run.

## Validation

```bash
python -m unittest scripts.tests.test_mt_rerank_ecdict_overlay
python -m unittest discover -s scripts/tests -p "test_*.py"
npm --prefix apps/wordlover-pwa run validate:shell-assets
```

Cache databases, reports, and modified generated dictionaries remain ignored
build outputs. Do not commit them or copy them to production without the normal
audit and promotion review.
