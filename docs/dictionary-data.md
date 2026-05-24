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

Current `ecdict.csv` audit:

- total entries: 770,611
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

The importer accepts either a CSV with a `word` column or a plain-text file with one word per line. Existing entries get the new tag; missing entries are inserted with the chosen source label so the app can review them later.

## App Lookup Contract

The first app lookup should behave like `scripts/lookup_word.py`:

```powershell
python scripts/lookup_word.py abandon
```

Input rules:

- one English word only
- letters only
- case-insensitive lookup
- no spaces, punctuation, phrases, or numbers

Returned fields:

- `word`
- `phonetic`
- top English meanings
- top Chinese meanings
- TOEFL tag status
- frequency metadata
- word-form exchange metadata
- optional audio URL

## iPhone Path

For the iPhone app, bundle `dictionary.sqlite` as a read-only resource and query it with SQLite. Keep user vocabulary and quiz progress in a separate user database or synced document so dictionary updates do not risk overwriting user data.
