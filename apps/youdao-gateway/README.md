# WordFan Youdao gateway

Cloudflare Worker boundary approved by `docs/youdao-integrated-lookup-adr.md`.
It accepts one normalized term, signs the official Dictionary API request with
managed secrets, enforces origin/rate/cost controls, and returns normalized JSON.

Production is deliberately disabled in `wrangler.toml`. Do not enable it until a
Youdao commercial agreement permits the intended display. Public terms currently
prohibit caching/reuse, so the Worker sends `Cache-Control: no-store` and WordFan
must not persist responses.

## Local test

```bash
cd apps/youdao-gateway
npm install
npm test
```

Use Wrangler local secrets for live development; never place values in vars or
committed files:

```bash
npx wrangler secret put YOUDAO_APP_KEY
npx wrangler secret put YOUDAO_APP_SECRET
npx wrangler dev
```

## Production deployment

1. Obtain the commercial endpoint rights and record allowed retention in the ADR.
2. Create the Worker, Durable Object, and rate-limit binding from `wrangler.toml`.
3. Store `YOUDAO_APP_KEY` and `YOUDAO_APP_SECRET` with `wrangler secret put`.
4. Set non-zero daily/monthly limits no higher than the contract and billing cap.
5. Deploy while `YOUDAO_ENABLED=false`; verify `/health`, allowed/disallowed CORS,
   structured disabled errors, logs, and counters.
6. Change the managed production variable to `true` only after privacy review and
   a successful one-term smoke test.

Rollback is immediate: set `YOUDAO_ENABLED=false` or roll back the Worker version.
The PWA continues showing local definitions and its external Youdao link.

Health and errors never include terms, credentials, signatures, or upstream
payloads. Cloudflare request logs must be configured to redact query strings.
