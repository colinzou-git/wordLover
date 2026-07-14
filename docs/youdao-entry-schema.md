# Normalized Youdao entry schema

Schema version 1 is the JSON contract between the WordFan gateway and PWA. The
gateway converts official provider output to this shape; the client validates it
again and treats unknown fields as forward-compatible. Provider HTML is never
included or rendered.

```json
{
  "schemaVersion": 1,
  "provider": { "id": "youdao", "label": "Youdao" },
  "normalizedTerm": "charge",
  "headword": "charge",
  "sourceUrl": "https://m.youdao.com/dict?le=eng&q=charge",
  "retrievedAt": "2026-07-14T00:00:00Z",
  "parserVersion": "youdao-official-v1",
  "phonetics": { "us": "tʃɑrdʒ", "uk": "tʃɑːdʒ" },
  "chineseDefinitions": [
    { "text": "费用", "partOfSpeech": "n.", "domain": "finance" }
  ],
  "englishDefinitions": [{ "text": "to ask a price" }],
  "wordForms": [{ "name": "past", "value": "charged" }],
  "phrases": [{ "phrase": "in charge", "meanings": ["负责"] }],
  "examples": [{ "sentence": "They charge a fee.", "translation": "他们收取费用。" }],
  "synonyms": ["cost"],
  "antonyms": [],
  "domains": ["law", "finance"],
  "providerRecordId": "optional"
}
```

`schemaVersion`, provider identity, normalized term, headword, source URL,
retrieval timestamp, parser version, and at least one Chinese or English
definition are required. All other groups may be empty or absent. Missing values
are not fabricated. Sense order is provider order; only exact duplicate scalar
strings are removed. Markup is stripped at both trust boundaries.

The schema is structurally suitable for a future saved supplement, but current
Youdao public rules prohibit caching and reuse. It is transient-only until the
permission gate in `docs/youdao-integrated-lookup-adr.md` is satisfied.
