# Youdao Phase 1 feasibility decision

Checked 2026-07-13 before selecting any integrated retrieval approach.

## Browser and navigation result

`https://m.youdao.com/dict?le=eng&q=charge` returned HTTP 200, server-rendered HTML, the queried headword, and basic-entry markers. A request carrying the WordFan GitHub Pages origin returned no `Access-Control-Allow-Origin` header. Normal browser navigation is therefore viable, while a WordFan frontend `fetch()` cannot reliably read the page under browser CORS enforcement.

Phase 1 consequently uses only a same-page external link. Rendering a definition does not contact Youdao, and the local definition remains independent of network state.

## Later integrated lookup options

1. **Official Youdao Dictionary API:** technically the cleanest structured-data option, but it requires an application ID/secret and manual commercial access. More importantly, the [official Dictionary API documentation](https://ai.youdao.com/DOCSIRMA/html/dictionary/api/ydcd/index.html) currently says returned data may not be cached or reused. That conflicts with WordFan's requested permanent offline supplements and must be resolved through acceptable terms or written permission before implementation.
2. **Small serverless proxy/parser:** a Cloudflare Worker or equivalent could keep credentials/parser logic off the static client and provide CORS, timeouts, and a normalized schema. It must not be built until source terms permit the intended storage/reuse, and it must use low request volume with no anti-bot evasion.
3. **Direct frontend retrieval:** rejected for the current public mobile page because the tested response did not grant CORS access. It may be reconsidered only if a supported endpoint explicitly allows WordFan's origin and intended use.
4. **External link fallback:** feasible now and retained in every future design. It needs no parser, proxy, credential, popup, iframe, or background request.

Decision: ship the external-link-only provider in Phase 1. Do not implement automatic in-app retrieval or permanent Youdao caching until both an authorized technical endpoint and compatible storage/reuse terms are established.
