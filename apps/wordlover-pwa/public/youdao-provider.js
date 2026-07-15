import { validateYoudaoEntry } from "./youdao-entry-schema.js?v=20260715-2";

const YOUDAO_ENTRY_URL = "https://m.youdao.com/dict";
const APOSTROPHE_VARIANTS_RE = /[\u2018\u2019\u02bc`\uff07]/g;
const YOUDAO_TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;

export function normalizeYoudaoTerm(term) {
  return String(term ?? "")
    .replace(APOSTROPHE_VARIANTS_RE, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function canLookupYoudaoTerm(term) {
  return YOUDAO_TERM_RE.test(normalizeYoudaoTerm(term));
}

export function buildYoudaoLookupUrl(term) {
  const normalized = normalizeYoudaoTerm(term);
  if (!YOUDAO_TERM_RE.test(normalized)) return "";
  return `${YOUDAO_ENTRY_URL}?le=eng&q=${encodeURIComponent(normalized)}`;
}

export class YoudaoProviderError extends Error {
  constructor(category, message, { retryable = false, status = null } = {}) {
    super(message); this.name = "YoudaoProviderError"; this.category = category; this.retryable = retryable; this.status = status;
  }
}

export function createYoudaoProvider({ endpoint = "", fetchImpl = fetch } = {}) {
  const integratedEndpoint = String(endpoint ?? "").trim().replace(/\/$/, "");
  return Object.freeze({
    id: "youdao", label: "Youdao", supports: canLookupYoudaoTerm, buildExternalUrl: buildYoudaoLookupUrl,
    canLookupInApp: Boolean(integratedEndpoint),
    async lookup({ term, signal, forceRefresh = false } = {}) {
      const normalized = normalizeYoudaoTerm(term);
      if (!integratedEndpoint) throw new YoudaoProviderError("configuration_disabled", "Integrated Youdao lookup is not configured.");
      if (!canLookupYoudaoTerm(normalized)) throw new YoudaoProviderError("unsupported_term", "This term is not supported.");
      const url = new URL("/v1/dictionary/youdao", integratedEndpoint); url.searchParams.set("term", normalized); if (forceRefresh) url.searchParams.set("refresh", "1");
      let response;
      try { response = await fetchImpl(url, { method: "GET", cache: "no-store", signal, headers: { Accept: "application/json" } }); }
      catch (error) { if (error?.name === "AbortError") throw error; throw new YoudaoProviderError("network", "Could not contact the Youdao lookup gateway.", { retryable: true }); }
      let payload; try { payload = await response.json(); } catch { throw new YoudaoProviderError("malformed_response", "The Youdao gateway returned invalid JSON.", { status: response.status }); }
      if (!response.ok) throw new YoudaoProviderError(typeof payload?.error?.code === "string" ? payload.error.code : "provider_unavailable", String(payload?.error?.message || "Youdao lookup failed."), { retryable: Boolean(payload?.error?.retryable), status: response.status });
      try { return validateYoudaoEntry(payload); } catch (error) { throw new YoudaoProviderError("malformed_response", error instanceof Error ? error.message : "The Youdao entry is invalid.", { status: response.status }); }
    },
  });
}

export const youdaoProvider = createYoudaoProvider({ endpoint: globalThis.WORDLOVER_CONFIG?.youdaoGatewayUrl ?? "" });
