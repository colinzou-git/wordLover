const SCHEMA_VERSION = 1;
const PROVIDER = Object.freeze({ id: "youdao", label: "Youdao" });
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;
const APOSTROPHES = /[\u2018\u2019\u02bc`\uff07]/g;
const DEFAULT_ORIGINS = ["https://wordfan.app"];

export function normalizeTerm(value) {
  return String(value ?? "").replace(APOSTROPHES, "'").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function validateTerm(value) {
  const term = normalizeTerm(value);
  if (!term) return { ok: false, code: "invalid_term", message: "A term is required." };
  if (term.length > 80) return { ok: false, code: "invalid_term", message: "The term is too long." };
  if (!TERM_RE.test(term)) return { ok: false, code: "unsupported_term", message: "Only one English word or short phrase is supported." };
  return { ok: true, term };
}

function plain(value) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim() : "";
}

function strings(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(plain).filter(Boolean))];
}

function definitionsFromBasic(basic) {
  return strings(basic?.explains).map((text) => {
    const match = text.match(/^([a-z]+\.)\s*(.*)$/i);
    return { text: match ? match[2] : text, ...(match ? { partOfSpeech: match[1] } : {}) };
  }).filter((item) => item.text);
}

function detailedDefinitions(result) {
  const values = [];
  for (const dictionary of Object.values(result ?? {})) {
    for (const group of Array.isArray(dictionary?.word?.trs) ? dictionary.word.trs : []) {
      const pos = plain(group?.pos);
      for (const translation of Array.isArray(group?.tr) ? group.tr : []) {
        const text = plain(translation?.l?.i?.join?.("; ") ?? translation?.l?.i ?? translation?.tran);
        if (text) values.push({ text, ...(pos ? { partOfSpeech: pos } : {}) });
      }
    }
  }
  return values;
}

export function normalizeUpstream(payload, term, retrievedAt = new Date().toISOString()) {
  if (!payload || typeof payload !== "object") throw new Error("parse_failure");
  if (String(payload.errorCode ?? "0") !== "0") {
    const error = new Error("provider_error"); error.providerCode = String(payload.errorCode); throw error;
  }
  const chineseDefinitions = [...definitionsFromBasic(payload.basic), ...detailedDefinitions(payload.result)];
  const englishDefinitions = strings(payload.basic?.['explains-en'] ?? payload.basic?.englishExplains).map((text) => ({ text }));
  if (!chineseDefinitions.length && !englishDefinitions.length) {
    const error = new Error("no_result"); throw error;
  }
  const phrases = (Array.isArray(payload.web) ? payload.web : []).map((item) => ({ phrase: plain(item.key ?? item.phrase), meanings: strings(item.value ?? item.meaning) })).filter((item) => item.phrase && item.meanings.length);
  const examples = (Array.isArray(payload.sentenceSample) ? payload.sentenceSample : []).map((item) => ({ sentence: plain(item.sentence ?? item.sentenceBold), ...(plain(item.translation) ? { translation: plain(item.translation) } : {}) })).filter((item) => item.sentence);
  const entry = {
    schemaVersion: SCHEMA_VERSION,
    provider: PROVIDER,
    normalizedTerm: term,
    headword: plain(payload.query) || term,
    sourceUrl: plain(payload.webdict?.url ?? payload.webDict ?? payload.dict?.url) || `https://m.youdao.com/dict?le=eng&q=${encodeURIComponent(term)}`,
    retrievedAt,
    parserVersion: "youdao-official-v1",
    phonetics: { ...(plain(payload.basic?.['us-phonetic']) ? { us: plain(payload.basic['us-phonetic']) } : {}), ...(plain(payload.basic?.['uk-phonetic']) ? { uk: plain(payload.basic['uk-phonetic']) } : {}) },
    chineseDefinitions,
    englishDefinitions,
    wordForms: (Array.isArray(payload.basic?.wfs) ? payload.basic.wfs : []).map((item) => ({ name: plain(item.wf?.name ?? item.name), value: plain(item.wf?.value ?? item.value) })).filter((item) => item.name && item.value),
    phrases,
    examples,
    synonyms: strings(payload.synonyms?.words ?? payload.synonyms),
    antonyms: strings(payload.antonyms?.words ?? payload.antonyms),
    domains: strings(payload.basic?.exam_type ?? payload.domains),
  };
  return entry;
}

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS.join(",")).split(",").map((item) => item.trim()).filter(Boolean));
}

function corsHeaders(origin, env) {
  return allowedOrigins(env).has(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : {};
}

function json(body, status, origin, env, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(origin, env), ...extra } });
}

function failure(code, message, status, origin, env, retryable = false) {
  return json({ schemaVersion: SCHEMA_VERSION, error: { code, message, retryable } }, status, origin, env);
}

async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function signInput(term) { return term.length <= 20 ? term : `${term.slice(0, 10)}${term.length}${term.slice(-10)}`; }

async function upstreamUrl(term, env) {
  const salt = crypto.randomUUID(); const curtime = String(Math.floor(Date.now() / 1000));
  const sign = await sha256(`${env.YOUDAO_APP_KEY}${signInput(term)}${salt}${curtime}${env.YOUDAO_APP_SECRET}`);
  const query = new URLSearchParams({ q: term, langType: "en", appKey: env.YOUDAO_APP_KEY, dicts: "ec,ee", salt, sign, signType: "v3", curtime, docType: "json" });
  return `https://openapi.youdao.com/v2/dict?${query}`;
}

async function consumeLimits(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({ key: ip })).success) return "rate_limited";
  if (!env.USAGE_LIMITER) return "configuration_disabled";
  const id = env.USAGE_LIMITER.idFromName("global");
  const response = await env.USAGE_LIMITER.get(id).fetch("https://limits.internal/consume", { method: "POST", body: JSON.stringify({ daily: Number(env.YOUDAO_DAILY_LIMIT), monthly: Number(env.YOUDAO_MONTHLY_LIMIT) }) });
  if (!response.ok) return "cost_ceiling";
  return null;
}

export function createHandler({ fetchImpl = fetch } = {}) {
  return async function handle(request, env) {
    const url = new URL(request.url); const origin = request.headers.get("Origin") ?? "";
    if (origin && !allowedOrigins(env).has(origin)) return failure("origin_denied", "This origin is not allowed.", 403, origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    if (url.pathname === "/health") return json({ schemaVersion: 1, service: "youdao-gateway", enabled: env.YOUDAO_ENABLED === "true" }, 200, origin, env);
    if (url.pathname !== "/v1/dictionary/youdao" || request.method !== "GET") return failure("not_found", "Endpoint not found.", 404, origin, env);
    if (env.YOUDAO_ENABLED !== "true") return failure("configuration_disabled", "Integrated Youdao lookup is disabled.", 503, origin, env);
    if (!env.YOUDAO_APP_KEY || !env.YOUDAO_APP_SECRET) return failure("configuration_disabled", "Provider credentials are unavailable.", 503, origin, env);
    const validation = validateTerm(url.searchParams.get("term"));
    if (!validation.ok) return failure(validation.code, validation.message, 400, origin, env);
    const limited = await consumeLimits(request, env);
    if (limited) return failure(limited, limited === "rate_limited" ? "Too many requests." : "The provider request ceiling is closed.", 429, origin, env, true);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), Math.max(250, Number(env.UPSTREAM_TIMEOUT_MS) || 5000));
    try {
      const response = await fetchImpl(await upstreamUrl(validation.term, env), { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) return failure("provider_unavailable", "Youdao is temporarily unavailable.", 502, origin, env, true);
      let payload; try { payload = await response.json(); } catch { return failure("parse_failure", "The provider response was invalid.", 502, origin, env); }
      try { return json(normalizeUpstream(payload, validation.term), 200, origin, env); }
      catch (error) {
        if (error.message === "no_result") return failure("no_result", "No Youdao entry was found.", 404, origin, env);
        return failure(error.message === "parse_failure" ? "parse_failure" : "provider_unavailable", "The provider response could not be used.", 502, origin, env, true);
      }
    } catch (error) {
      return failure(error?.name === "AbortError" ? "timeout" : "provider_unavailable", error?.name === "AbortError" ? "The provider request timed out." : "Youdao is temporarily unavailable.", 504, origin, env, true);
    } finally { clearTimeout(timeout); }
  };
}

export class UsageLimiter {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const { daily, monthly } = await request.json();
    if (!Number.isInteger(daily) || !Number.isInteger(monthly) || daily <= 0 || monthly <= 0) return new Response("disabled", { status: 429 });
    const now = new Date(); const day = now.toISOString().slice(0, 10); const month = day.slice(0, 7);
    return this.state.storage.transaction(async (tx) => {
      const dayKey = `day:${day}`, monthKey = `month:${month}`;
      const dayCount = Number(await tx.get(dayKey) ?? 0), monthCount = Number(await tx.get(monthKey) ?? 0);
      if (dayCount >= daily || monthCount >= monthly) return new Response("ceiling", { status: 429 });
      await tx.put({ [dayKey]: dayCount + 1, [monthKey]: monthCount + 1 });
      return new Response("ok");
    });
  }
}

export default { fetch: createHandler() };
