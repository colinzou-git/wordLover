import assert from "node:assert/strict";
import test from "node:test";
import { createHandler, normalizeTerm, normalizeUpstream, validateTerm } from "../src/worker.js";

const origin = "https://wordfan.app";
const limiter = { limit: async () => ({ success: true }) };
const usage = { idFromName: () => "global", get: () => ({ fetch: async () => new Response("ok") }) };
const env = { YOUDAO_ENABLED: "true", YOUDAO_APP_KEY: "test-key", YOUDAO_APP_SECRET: "test-secret", YOUDAO_DAILY_LIMIT: "20", YOUDAO_MONTHLY_LIMIT: "200", ALLOWED_ORIGINS: `${origin},http://127.0.0.1:4173`, RATE_LIMITER: limiter, USAGE_LIMITER: usage, UPSTREAM_TIMEOUT_MS: "100" };
const request = (path, requestOrigin = origin, method = "GET") => new Request(`https://gateway.example${path}`, { method, headers: { Origin: requestOrigin, "CF-Connecting-IP": "192.0.2.1" } });

test("normalizes and validates supported terms", () => {
  assert.equal(normalizeTerm("  It’s   Fine "), "it's fine");
  for (const term of ["charge", "isosceles", "they're", "well-known", "take off", "charged"]) assert.equal(validateTerm(term).ok, true);
  for (const term of ["", "hello123", "你好", "one two three four five six seven"]) assert.equal(validateTerm(term).ok, false);
});

test("normalizes a partial official response without HTML", () => {
  const entry = normalizeUpstream({ errorCode: "0", query: "charge", basic: { "us-phonetic": "tʃɑrdʒ", explains: ["n. 费用", "v. 指控<script>"] }, web: [{ key: "in charge", value: ["负责"] }] }, "charge", "2026-07-14T00:00:00Z");
  assert.equal(entry.schemaVersion, 1); assert.equal(entry.provider.id, "youdao"); assert.equal(entry.chineseDefinitions.length, 2); assert.doesNotMatch(JSON.stringify(entry), /<script>/); assert.equal(entry.phrases[0].phrase, "in charge");
});

test("enforces CORS, kill switch, input, and stable errors", async () => {
  const handle = createHandler({ fetchImpl: async () => new Response("{}") });
  assert.equal((await handle(request("/v1/dictionary/youdao?term=charge", "https://evil.example"), env)).status, 403);
  const disabled = await handle(request("/v1/dictionary/youdao?term=charge"), { ...env, YOUDAO_ENABLED: "false" }); assert.equal(disabled.status, 503); assert.equal((await disabled.json()).error.code, "configuration_disabled");
  assert.equal((await handle(request("/v1/dictionary/youdao?term=hello123"), env)).status, 400);
  const preflight = await handle(request("/v1/dictionary/youdao", origin, "OPTIONS"), env); assert.equal(preflight.status, 204); assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
});

test("maps success, no-result, malformed, provider, timeout, and rate limits", async () => {
  const success = createHandler({ fetchImpl: async () => Response.json({ errorCode: "0", query: "charge", basic: { explains: ["n. 费用"] } }) });
  assert.equal((await success(request("/v1/dictionary/youdao?term=charge"), env)).status, 200);
  const malformed = createHandler({ fetchImpl: async () => new Response("bad", { status: 200 }) }); assert.equal((await (await malformed(request("/v1/dictionary/youdao?term=charge"), env)).json()).error.code, "parse_failure");
  const upstream = createHandler({ fetchImpl: async () => new Response("bad", { status: 503 }) }); assert.equal((await (await upstream(request("/v1/dictionary/youdao?term=charge"), env)).json()).error.code, "provider_unavailable");
  const timed = createHandler({ fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))) }); assert.equal((await (await timed(request("/v1/dictionary/youdao?term=charge"), { ...env, UPSTREAM_TIMEOUT_MS: "1" })).json()).error.code, "timeout");
  const limited = await success(request("/v1/dictionary/youdao?term=charge"), { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } }); assert.equal((await limited.json()).error.code, "rate_limited");
});

test("error responses and source never expose provider secrets", async () => {
  const handle = createHandler({ fetchImpl: async () => { throw new Error("upstream"); } }); const text = await (await handle(request("/v1/dictionary/youdao?term=charge"), env)).text(); assert.doesNotMatch(text, /test-key|test-secret|charge/);
});
