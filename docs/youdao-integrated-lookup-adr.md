# ADR: Youdao integrated lookup boundary

Status: Approved for gateway implementation; permanent provider-data storage is
blocked pending a written Youdao license amendment.

Decision date: 2026-07-14

## Decision

WordFan will use a small server-side gateway for one-term-at-a-time calls to the
official Youdao Dictionary API. Cloudflare Workers is the preferred deployment
target because WordFan has no trusted application server and a Worker can keep
the Youdao application key and secret outside the PWA.

The gateway may be implemented and tested behind a disabled-by-default provider
switch. Production retrieval must remain disabled until the repository owner has
all of the following:

- a Youdao Dictionary API commercial account and credentials;
- the contracted price, quota, and request limits;
- written permission for the intended end-user display and attribution;
- written permission for any caching beyond request processing;
- separate written permission before permanent local save, device sync, backup,
  or personal enhanced-dictionary export is enabled.

Under the public terms available on the decision date, integrated responses may
only be transiently displayed. WordFan must not cache, save, sync, export, reuse,
or bundle returned dictionary data. Issues #86 and #89–#92 therefore remain
policy-blocked where they require those operations. Their code may be prepared
against synthetic fixtures, but those capabilities and Automatic mode must not
be enabled for Youdao data without the permissions above.

External navigation to the full Youdao entry remains available in every mode and
when the provider or gateway is disabled.

## Evidence and policy review

Primary sources checked on 2026-07-14:

- [Official Youdao Dictionary API documentation](https://ai.youdao.com/DOCSIRMA/html/dictionary/api/ydcd/index.html)
  states that access is not self-service and requires contacting Youdao business
  support. It documents `https://openapi.youdao.com/v2/dict`, v3 request signing,
  the supported dictionaries, fields, and error codes. It also explicitly says
  returned data must not be cached, reused, or resold.
- [Youdao Cloud service terms](https://ai.youdao.com/DOCSIRMA/html/agreement/terms/ydzyfwkt/index.html),
  effective 2025-09-16, make product-specific rules part of the agreement and
  allow suspension or termination for violations.
- [Official product page](https://ai.youdao.com/new/product-fanyi-text.s) states
  that dictionary service uses annual pricing and requires a commercial inquiry;
  it does not publish a dictionary free quota or annual price.

The API can return phonetics, UK/US speech links, basic explanations, detailed
dictionary results, word forms, web phrases, synonyms, antonyms, related words,
examples, exam tags, and official deep links. WordFan's first integrated schema
will use only text fields needed for definitions, phonetics, word forms, examples,
and attribution. Pronunciation audio is out of scope.

Because pricing and quotas are contractual rather than public, the current cost
ceiling is zero production requests. After contracting, deployment must set both
a daily request ceiling and an account/billing ceiling no greater than the signed
commercial limit. There is no assumption of a free tier.

## Production-browser CORS test

On 2026-07-14, headless production Chromium first loaded
`https://wordfan.app/?fresh=cors-audit`, then executed:

```js
fetch("https://m.youdao.com/dict?le=eng&q=abandon", {
  mode: "cors",
  cache: "no-store",
});
```

The promise rejected with `TypeError: Failed to fetch`. A separate HTTP request
with `Origin: https://wordfan.app` returned HTML with no
`Access-Control-Allow-Origin` response header. Ordinary navigation succeeds, but
real cross-origin browser retrieval does not. Direct PWA retrieval is rejected.

HTML parsing is also rejected: it would depend on undocumented markup, create
terms and maintenance risk, and invite anti-bot handling. WordFan will not bypass
CAPTCHAs, rotate proxies, impersonate browsers, evade rate controls, or bulk
download Youdao content.

## Data flow and trust boundaries

```text
WordFan PWA -- normalized term --> Cloudflare Worker -- signed request --> Youdao API
     |                                  |                                  |
     | no credentials                  | managed secrets                  | licensed data
     | no learning/user data           | rate/cost ceiling                |
     <-- normalized transient JSON ----|<---------------------------------|
     |
     +--> external m.youdao.com link is always available
```

The PWA sends only one normalized English word or short phrase. It never sends
vocabulary state, learning history, track IDs, local definitions, authentication
data, or other user records. Provider credentials exist only as managed Worker
secrets. Logs contain error category, latency, and coarse counters—not full terms,
signatures, credentials, or upstream payloads.

## Gateway controls

The implementation following this ADR must provide:

- a strict production/development origin allowlist;
- bounded upstream and total timeouts;
- normalized one-term request validation;
- stable JSON success and error schemas;
- per-IP and global request limits;
- daily and monthly hard ceilings;
- a provider kill switch defaulting to disabled;
- short-lived in-process/request deduplication only if the signed contract permits
  it; otherwise no gateway caching;
- no raw provider HTML or unvalidated provider payloads returned to the PWA;
- deterministic mocked tests that require no live credentials.

## Persistence, backup, sync, and export

The public Dictionary API rule prohibiting caching and reuse means these are not
currently permitted for Youdao response data:

- encrypted IndexedDB supplements;
- offline saved definitions;
- cross-device sync;
- user backup/export containing provider content;
- enhanced dictionary export;
- production dictionary or application-shell bundling.

Attribution and a full-entry link do not override that restriction. If Youdao
grants written permission later, the permission must be recorded in this ADR
without including confidential contract text, and the exact allowed retention,
sync, backup, and export scopes must become enforced feature-policy flags.

## Attribution and privacy

Every successful transient result must visibly show `Source: Youdao` and a link to
the official full entry. Product privacy text must disclose that the searched term
is sent to the WordFan gateway and Youdao when integrated lookup is enabled.

## Rejected alternatives

- Direct browser access: rejected by the recorded production-origin CORS test and
  because it would expose signing credentials.
- Parsing `m.youdao.com` HTML: rejected as undocumented, fragile, and higher-risk.
- Client-side official API calls: rejected because the secret is part of the
  request signature and cannot be protected in a local-first static PWA.
- Bulk import into WordFan dictionaries: rejected by scope and the explicit
  caching/reuse restriction.
- Treating translation API output as dictionary content: rejected because it does
  not satisfy the source/field requirements and does not grant dictionary rights.

## Follow-up implementation order

1. #84: gateway boundary, validation, secrets, CORS, limits, kill switch, mocked
   upstream, deployment and rollback documentation.
2. #85: versioned client schema and abortable provider lookup.
3. #87–#88: transient manual lookup orchestration and attributed rendering behind
   the disabled provider switch.
4. #86 and #89–#91: implement only after written persistence rights are recorded;
   do not substitute an unlicensed cache or renamed copy.
5. #92: Automatic may become the default only after the contract, production
   gateway, privacy review, device matrix, rollback, and live verification pass.

## Operational fallback

The server-side kill switch stops all upstream calls and returns a stable disabled
error. The client then retains local definitions and shows the external Youdao
link. Rollback never removes local WordFan dictionaries or user learning data.

## Implementation status

The repository now contains the fail-closed Worker boundary, normalized schema,
abortable client provider, reusable lookup controller, and shared attributed
renderer. The PWA endpoint is empty by default, the Worker kill switch is false,
all cost ceilings are zero, and transient session caching is disabled under this
ADR. These controls permit deterministic development without making an
unlicensed provider request or persisting provider data.
