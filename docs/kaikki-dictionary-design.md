# Kaikki dictionary design and preview workflow

## Purpose and implementation order

Kaikki/Wiktextract is WordFan's main English definition/example source in the
preview architecture. The current full WordFan dictionary supplies broad
Chinese fallback, current STEM rows guarantee K-12/AP coverage, and current
WordFan tags/ranks preserve learner filters and Study One More ordering.

All work remains on `feature/kaikki-dictionary-preview` in this order:

```text
#27 -> #17 -> #18 -> #24 -> #25 -> #19 -> #23 -> #20 -> #21 -> #26 -> #22
```

Do not merge or promote until every issue and the final audit pass.

## Input, schema, and outputs

The builder accepts a local English Kaikki JSONL file, plain or gzip-compressed,
and streams it through disk-backed SQLite aggregation. It emits the existing
`dictionary_entries` fields (`word`, `normalized_word`, phonetic/definition/
translation, curated rank/tag fields, `exchange`, `detail`, audio, and source),
metadata, `toefl_entries`, and the compatible FTS5 index.

Generated outputs are never committed:

```text
data/dictionary-kaikki.sqlite
data/dictionary-kaikki-slim.sqlite
data/kaikki-dictionary-report.json
data/kaikki-dictionary-audit.json
apps/wordlover-pwa/public/kaikki-preview/local/
```

The local package contains a slim SQLite core and complete gzip JSON shards.
Full-shard exact rows and aliases carry optional trailing structured `detail`;
old six-field exact and eight-field alias payloads remain supported.
Full-shard overlays are manifest-driven: the builder reads
`dictionary-full/manifest.json`, validates the WordFan full-sharded format, and
loads only the shard files listed there. Stale `shard-*.json.gz` files not in
the manifest are ignored.

## Data overlay and Chinese fallback

Curated `tag`, `is_toefl`, `frq`, `bnc`, `collins`, and `oxford` values are
matched by normalized word. Raw Kaikki tags/topics/categories go only in
`detail.kaikki`, never `dictionary_entries.tag`.

Chinese priority is:

1. safely aligned Kaikki sense translation;
2. Kaikki entry translation;
3. current full WordFan shard translation;
4. current slim/core WordFan translation;
5. empty.

Real builds require the current full WordFan Chinese overlay. Provide either
`--full-translation-source` or a manifest-backed full-shard directory through
`--full-translation-source-shards` / `--tag-source-shards`. Use
`--allow-missing-full-overlay` only for intentional tiny fixtures; the report
then records `full_translation_overlay_available=false` and the missing reason.
Build reports separate selected-source counters from available-source counters:
`selected_rows_with_*` says which source won for the final row, while
`available_rows_with_*` says that source had Chinese available before priority
selection. Legacy `rows_with_*` counters remain aliases for selected rows.

Chinese detection accepts Han-script translations identified by common Kaikki
codes (`zh`, `cmn`, `yue`, `wuu`, `nan`, `hak`, `lzh`, `cdo`, `gan`, `hsn`,
and their documented variants) or language labels including Hokkien, Wu, Gan,
and Xiang. A Chinese-family label alone is insufficient: romanization-only
text is rejected, as are Japanese-labeled Han translations.

Word-level WordFan fallback remains in legacy `translation` for Chinese search
and FTS, and in `detail.translationFallback` with provenance. It is not copied
onto every Kaikki sense. Curated STEM translation deterministically wins for a
STEM-tagged term when the selected Chinese is otherwise a WordFan word-level
fallback.
Unmatched Kaikki entry-level Chinese follows the same general-fallback rule:
it remains in `dictionary_entries.translation` and
`detail.translationFallback` with `zhSource=kaikki-entry`. Only sense-level or
strongly sense-matched entry translations appear inside
`detail.displayMeanings[]`. Their provenance remains `kaikki-entry`; only
Chinese attached directly to a Kaikki sense uses `kaikki-sense`. The selected
source counters follow the same distinction.

## STEM and inflection preservation

Matching Kaikki rows inherit all existing K-12/AP/linear-algebra tags. Current
STEM rows absent from Kaikki are appended with `supplement` provenance. The slim
builder always retains these rows, even without frequency signals.

Lookup precedence remains:

```text
normalized exact row
-> exchange-based core SQLite alias
-> full-shard alias generated from exchange
```

The builder fills ECDICT-compatible `exchange` codes from Kaikki lemma `forms`
and skipped form-of-only entries: `p` past, `d` past participle, `i` present
participle/gerund, `3` third-person singular, and `s` plural. Exact rows such as
an adjective `excited` always beat aliases.

## Structured display

`detail.displayMeanings` stores compact meanings in learner/source order without
POS grouping. `detail.detailedDefinitions` groups full English senses/examples
by POS. The target is:

```text
charge [tʃɑːrdʒ]

v. 收费 | ask someone to pay
n. 费用 | amount of money paid
n. 电荷 | physical property of matter (Physics)

Noun:
1. an impetuous rush toward someone or something;
   "the wrestler's charge carried him past his adversary"

Verb:
1. demand payment;
   "Will I get charged for this service?"
```

When only word-level Chinese exists, the UI shows one “Chinese meanings” block,
then English meanings. Malformed/missing detail falls back to the old ECDICT UI.
All source strings are escaped as text, and examples wrap at iPhone width.

## Ubuntu build and package

```bash
export WORDFAN_REPO="$HOME/wordLover"
export KAIIKI_SOURCE="$HOME/Downloads/kaikki.wordfan_lean_mandarin.merged.jsonl"
cd "$WORDFAN_REPO"

python scripts/build_kaikki_dictionary.py \
  --source "$KAIIKI_SOURCE" \
  --output data/dictionary-kaikki.sqlite \
  --report data/kaikki-dictionary-report.json \
  --tag-source "$HOME/dictBackup/dictionary.sqlite" \
  --full-translation-source "$HOME/dictBackup/dictionary.sqlite" \
  --tag-source-shards apps/wordlover-pwa/public/dictionary-full

python scripts/package_kaikki_dictionary.py \
  --source "$KAIIKI_SOURCE" \
  --tag-source "$HOME/dictBackup/dictionary.sqlite" \
  --full-translation-source "$HOME/dictBackup/dictionary.sqlite" \
  --tag-source-shards apps/wordlover-pwa/public/dictionary-full \
  --work-dir data/kaikki-build \
  --public-dir apps/wordlover-pwa/public \
  --version 2026.07.01.kaikki \
  --target-rows 50000 \
  --shard-count 128
```

The Kaikki core omits duplicated structured `detail` and requests 50,000 rows;
mandatory ranked/STEM rows may raise the final count. Exact core results fetch
their structured detail from the corresponding full shard when online/cached,
while the legacy core fields remain usable offline. This keeps sql.js near the
iPhone memory envelope; real iPhone DRAM still requires Instruments validation.
This is the explicit package policy, recorded in
`kaikki-package-summary.json` as
`slimDetailPolicy=none-with-full-shard-enrichment`. Full-shard exact and alias
results carry the optional structured detail; unavailable/malformed detail uses
the existing legacy renderer.

The wrapper can write only
`apps/wordlover-pwa/public/kaikki-preview/local/`. It cannot target production
root assets. It snapshots each protected production file plus every file under
`dictionary-full/` before and after packaging using relative paths, sizes, and
SHA-256 checksums. The summary's `productionPathsChanged` value is therefore a
verified comparison, and any change fails the packaging command after writing
the diagnostic summary.
If you deliberately build a fixture without the full WordFan overlay, add
`--allow-missing-full-overlay`; do not use that flag for the real promotion
candidate.

If the current full WordFan source is available as manifest-backed shards
instead of SQLite, use:

```bash
python scripts/package_kaikki_dictionary.py \
  --source "$KAIIKI_SOURCE" \
  --tag-source "$HOME/dictBackup/dictionary.sqlite" \
  --full-translation-source-shards apps/wordlover-pwa/public/dictionary-full \
  --work-dir data/kaikki-build \
  --public-dir apps/wordlover-pwa/public
```

## Audit and validation

```bash
python -m unittest scripts.tests.test_build_kaikki_dictionary
python -m unittest scripts.tests.test_package_dictionary_shards
python -m unittest scripts.tests.test_audit_kaikki_dictionary
python -m unittest discover -s scripts/tests -p 'test_*.py'

python scripts/audit_kaikki_dictionary.py \
  --kaikki-db data/dictionary-kaikki.sqlite \
  --current-slim-db data/dictionary.sqlite \
  --current-full-shards apps/wordlover-pwa/public/dictionary-full \
  --preview-package apps/wordlover-pwa/public/kaikki-preview/local \
  --strict \
  --report data/kaikki-dictionary-audit.json

sqlite3 data/dictionary-kaikki.sqlite "PRAGMA quick_check;"
sqlite3 data/dictionary-kaikki.sqlite "SELECT count(*) FROM dictionary_entries;"
sqlite3 data/dictionary-kaikki.sqlite "SELECT count(*) FROM dictionary_search_fts;"
sqlite3 data/dictionary-kaikki.sqlite \
  "SELECT word, exchange FROM dictionary_entries WHERE normalized_word IN ('run','excite');"
python scripts/generate_code_map.py --check
npm --prefix apps/wordlover-pwa run validate:shell-assets
```

When `--current-full-shards` is supplied, the audit verifies manifest format,
shard count and ordering, safe listed paths, file sizes and SHA-256 checksums,
payload version and maps, per-shard entry/alias counts, and manifest-wide row,
alias, and compressed-byte totals. Any stale, corrupt, or mismatched package is
a failing audit result.

Browser/manual checks: `charge` renders both layers; `running` and `ran` resolve
through `run`; an exact `excited` adjective wins. Full local builds are manual
because the 1.47M-line source is not available in normal CI.

## Local and Actions preview safety

Serve the generated local package:

```bash
python -m http.server 4173 --directory apps/wordlover-pwa/public
```

Open
`http://127.0.0.1:4173/?dictionary=kaikki-preview-local&fresh=latest`. Production
without the query continues to use `/dictionary-manifest.json` and
`/dictionary-full`; the preview uses only
`/kaikki-preview/feature-kaikki-dictionary-preview/`.
The app also namespaces installed dictionary storage by dictionary mode:
production keeps the existing `dictionary.sqlite` / `dictionaryDataVersion`
keys, while preview modes use `kaikki-preview.*` or `kaikki-preview-local.*`.
Preview invalidation therefore cannot delete a user's production offline
dictionary copy.
The full-shard client follows the same rule. Production retains the legacy
`wordfan.fullDictionary.*` localStorage keys and
`wordfan-full-dictionary-v1-*` cache names. Preview manifests, installed-version
markers, and Cache Storage names include the preview mode, so preview cleanup
cannot remove production shards.

The **Build Kaikki fixture preview artifact** workflow is manual-only
(`workflow_dispatch`) and uploads an artifact. It uses the tiny CI fixture to
validate preview packaging and UI wiring; it is not a full Kaikki validation.
It never writes `gh-pages`. Download/extract the artifact, then run
`python -m http.server 4173 --directory public`.

Confirm production remains untouched:

```bash
git diff -- apps/wordlover-pwa/public/dictionary.sqlite \
  apps/wordlover-pwa/public/dictionary.sqlite.zst \
  apps/wordlover-pwa/public/dictionary-manifest.json \
  apps/wordlover-pwa/public/dictionary-full/
```

## Promotion, attribution, and limitations

Do not use Git LFS for GitHub Pages runtime assets and do not commit generated
SQLite, zstd, shards, or reports. After the audit passes, promotion requires a
separate reviewed release that verifies source attribution, manifest hashes,
real iPhone behavior/memory, Chinese coverage, STEM samples, and production
rollback. Never copy preview files into production as an implicit promotion.

Known limitations: full builds require substantial local disk/time; current CI
uses tiny fixtures; word-level Chinese fallback is deliberately not sense
aligned; iPhone DRAM must be measured with the Mac simulator/Instruments.
