# Dictionary sources and attribution

## Current WordFan dictionary

- ECDICT
- WordNet 3.0
- OPTED/Webster 1913
- WordFan K-12/AP STEM enrichment

The existing build documentation and generated metadata record source-specific
details. Preserve those attributions when rebuilding or redistributing current
WordFan data.

## Kaikki preview dictionary

- Kaikki/Wiktextract data extracted from Wiktionary
- Wiktextract: *Wiktionary as Machine-Readable Structured Data*, Tatu Ylonen,
  LREC 2022
- Kaikki: https://kaikki.org

Kaikki provides the main English definitions/examples. Current WordFan data is
used for curated learner tags/ranks, broad Chinese fallback, and guaranteed
K-12/AP STEM coverage. Builder reports and manifests must retain this composite
provenance.

The GitHub Actions Kaikki preview artifact is a fixture preview generated from
the CI dictionary, not a redistribution of the full Kaikki source. Full local
validation requires the downloaded Kaikki JSONL plus the current full WordFan
SQLite/full-shard overlay so Chinese fallback coverage is measured correctly.

Before public distribution, verify the current attribution and license
requirements directly against every upstream source. This document intentionally
does not make additional license claims.
