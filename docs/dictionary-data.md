# Dictionary Data Foundation

WordLover uses ECDICT as the primary offline dictionary source.

## Source

- Dataset: ECDICT
- Repository: https://github.com/skywind3000/ECDICT
- License: MIT
- Default import file: `ecdict.csv`

`ecdict.csv` is the default because it is much smaller than `stardict.csv` and is a better first bundle candidate for an iPhone app. The builder can import a different CSV with `--csv-name stardict.csv` if we later decide the larger data set is worth the app size.

## Build

From the repo root:

```powershell
python scripts/build_dictionary.py
```

This reads:

```text
C:\Users\colin\Downloads\ECDICT-master.zip
```

and creates:

```text
data/dictionary.sqlite
data/dictionary-report.json
```

The SQLite database is generated output and is ignored by git. Rebuild it whenever the source data or schema changes.

## Slim Dictionary For PWA Delivery

The product PWA ships a slimmed dictionary of approximately 100,000 entries instead of the full ~770k. The full SQLite at `data/dictionary.sqlite` remains the build-time source of truth; the slim file at `data/dictionary-slim.sqlite` is what gets packaged and delivered.

To build the slim copy from the full dictionary:

```powershell
python scripts/build_slim_dictionary.py
```

This writes `data/dictionary-slim.sqlite` (~32 MB) containing:

- All TOEFL-tagged entries (~7k).
- All single words with any frequency signal (`frq`, `bnc`, Collins, or Oxford) — ~57k.
- Phrases whose constituent words are all in the slim set, ranked by average constituent frequency until the target row count is hit — ~42k.

Compose the slim set with PRD-required test phrases (`abandon`, `take off`, `in terms of`, etc.). The slim dictionary carries a fresh FTS5 search table (`dictionary_search_fts`) built only over the slim rows.

To package the slim dictionary for PWA delivery with zstd compression:

```powershell
python -m pip install zstandard
python scripts/package_dictionary_web.py --copy-sqlite
```

This writes `apps/wordlover-pwa/public/dictionary-manifest.json`, `apps/wordlover-pwa/public/dictionary.sqlite` (~32 MB raw SQLite for the current `sql.js` engine), and `apps/wordlover-pwa/public/dictionary.sqlite.zst` (~15 MB compressed for the upcoming `wa-sqlite` installer path). The manifest's `dictionaryDataVersion` field is the trigger for upgrade-time replacement on already-installed devices — see the next section.

To package the full ~770k-entry dictionary instead (rare; for memory benchmarking or research builds), pass `--input data/dictionary.sqlite`.

## K-12 / AP STEM Expansion

WordFan supplements ECDICT with a curated K-12 and AP STEM term list
(`data/sources/wordfan_k12_ap_stem_ecdict_style.csv`) so school-curriculum
vocabulary is searchable and reviewable. Import it into the full dictionary
**after** `build_dictionary.py` (and any augmentation) and **before**
`build_slim_dictionary.py`:

```powershell
python scripts/import_ap_stem_dictionary.py
```

**Full ECDICT stays the metadata source of truth.** For any word that already
exists in `dictionary_entries`, the import changes only three columns:

- `definition` — appends the CSV definition (deduplicated, `;`-joined).
- `translation` — appends the CSV translation (deduplicated, `;`-joined).
- `tag` — appends the CSV tags (deduplicated, space-joined).

Every other ECDICT-derived column is left exactly as it was: `phonetic`, `pos`,
`collins`, `oxford`, `bnc`, `frq`, `exchange`, `detail`, `audio`, `source`,
`definition_source`, `is_toefl`, `id`, `normalized_word`. The CSV never
overrides ECDICT frequency, ranking, or phonetic data for existing words.

Words **not** present in ECDICT are inserted from the CSV with `source` and
`definition_source` set to `WordFan_AP_STEM`. No frequency/ranking metadata
(`frq`, `bnc`, `collins`, `oxford`, `phonetic`) is invented for these rows —
those columns are populated only from what the CSV provides (usually blank).
`is_toefl` is set to 1 only when the final tag list contains `toefl`.

After updating the content table the script rebuilds the external-content
`dictionary_search_fts` index so the new and merged terms are searchable by
English word, definition, and Chinese translation.

`build_slim_dictionary.py` always retains entries carrying any K-12/AP STEM
coverage tag (`k12_stem`, `k12_math`, `k12_science`, `ap_biology`,
`ap_chemistry`, `ap_calculus_ab`, `ap_calculus_bc`, `ap_statistics`,
`ap_precalculus`, `ap_physics*`, `ap_environmental_science`,
`ap_computer_science*`, `linear_algebra_extension`), even when they have no
`frq`/`bnc` signal — so curriculum terms are never dropped during slimming.
Existing TOEFL/frequency/phrase selection behavior is unchanged.

Full rebuild flow including the AP STEM step:

```powershell
python scripts/build_dictionary.py
python scripts/import_ap_stem_dictionary.py
python scripts/build_slim_dictionary.py --data-version 2026.06.08.ap-stem
python scripts/package_dictionary_web.py --copy-sqlite
```

## Upgrade Behavior For Already-Installed Devices

When a device already has an older dictionary in OPFS/IndexedDB, the new app shell detects the version mismatch on the next online dictionary load. The flow is:

1. App fetches `/dictionary-manifest.json` (the service worker bypasses cache for this file).
2. It compares the manifest's `dictionaryDataVersion` against the locally-stored version under the `dictionaryDataVersion` KV key.
3. If they differ and we're online, the app deletes the local IndexedDB and OPFS dictionary copies, then downloads the new one and stores the new version.
4. If we're offline, the existing local copy continues to serve lookups; the upgrade happens the next time the app is online.

This means devices that previously installed the full 200 MB dictionary will automatically drop down to the slim 32 MB version on their next online launch with this build.

The builder now creates a `dictionary_search_fts` FTS5 table by default so rebuilt dictionaries can support ranked prefix, phrase, and future fuzzy search in SQLite instead of JavaScript-only filtering. For quick experiments that do not need the FTS index:

```powershell
python scripts/build_dictionary.py --skip-fts
```

Current `ecdict.csv` audit:

- total entries: 770,611
- short English term entries: 758,320
- entries containing spaces: 366,599
- phrase entries with Chinese translations: 365,726
- phrase entries with English definitions after augmentation: 63,892
- TOEFL-tagged entries: 6,974
- TOEFL-tagged single English words: 6,951
- TOEFL entries missing phonetic text: 109
- TOEFL entries missing English definitions: 22
- TOEFL entries missing Chinese translations: 0

I also checked `stardict.csv` from the same archive. It has many more total entries, but the same TOEFL-tagged coverage, so `ecdict.csv` is the better first iPhone bundle.

## English Definition Completion

ECDICT has strong Chinese coverage, but many entries do not include English definitions. Use Princeton WordNet as a supplemental definition source:

```powershell
python scripts/augment_dictionary_wordnet.py
```

This downloads the official WordNet 3.0 database archive into `data/sources/`, parses the WordNet glosses, and fills only rows where ECDICT's English `definition` is missing. Filled rows keep their Chinese translation and pronunciation fields, and are marked with:

```text
definition_source = WordNet 3.0
```

This keeps the data lineage clear for the future iPhone app.

If more coverage is needed after WordNet, use the OPTED/Webster fallback:

```powershell
python scripts/augment_dictionary_opted.py
```

The OPTED/Webster fallback is older English, so it is useful for broad coverage but should rank below ECDICT and WordNet in user-facing display.

Current augmentation result:

- WordNet unique terms parsed: 147,806
- definitions filled from WordNet: 72,418
- definitions filled from OPTED/Webster: 428
- missing English definitions after augmentation: 536,881
- missing single-word English definitions after augmentation: 208,598
- TOEFL entries still missing English definitions: 19

Many remaining missing rows are obscure proper nouns, phrases, inflected forms, or entries not covered by WordNet/OPTED. For a learner app, the better next quality move is to prioritize the study lists users actually see, not to blindly fill every long-tail ECDICT row.

## Expanding TOEFL Coverage

There is no single official public TOEFL vocabulary list that should be treated as complete. To expand coverage safely, import licensed TOEFL or academic word lists as supplemental tags:

```powershell
python scripts/import_word_list.py path\to\toefl-extra.csv --tag toefl_custom
python scripts/augment_dictionary_wordnet.py
python scripts/augment_dictionary_opted.py
```

The importer accepts either a CSV with a `word` column or a plain-text file with one term per line. Existing entries get the new tag; missing entries are inserted with the chosen source label so the app can review them later.

## App Lookup Contract

The first app lookup should behave like `scripts/lookup_word.py`:

```powershell
python scripts/lookup_word.py abandon
python scripts/lookup_word.py "in terms of"
```

Input rules:

- one English word or short phrase
- up to 6 words
- case-insensitive lookup
- letters, spaces, hyphens, and apostrophes are allowed
- numbers and other punctuation are rejected for user-entered study terms

Returned fields:

- `term`
- `entry_type`
- `phonetic`
- top English meanings
- top Chinese meanings
- TOEFL tag status
- frequency metadata
- word-form exchange metadata
- optional audio URL

## iPhone Path

For the iPhone-first PWA path, install `dictionary.sqlite` into durable browser storage such as IndexedDB or OPFS and query it with SQLite WASM. The app shell alone is not enough for offline use; after first setup, dictionary lookup must work when Wi-Fi and Cellular are off. Keep user vocabulary and quiz progress in a separate encrypted user database or synced document so dictionary updates do not risk overwriting user data.

Windows remains the automation and stress-test fallback for the dictionary pipeline. Android dictionary packaging is deferred until the iPhone and Windows paths are stable.
