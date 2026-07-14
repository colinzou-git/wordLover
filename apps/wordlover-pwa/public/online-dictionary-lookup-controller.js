const DEFAULT_TIMEOUT_MS = 8000;
const sharedRequests = new Map();

function errorState(error) {
  if (error?.name === "AbortError") return { status: "cancelled", error: null };
  const category = error?.category ?? "unknown";
  const status = ({ timeout: "timed-out", rate_limited: "rate-limited", provider_unavailable: "provider-unavailable", network: "provider-unavailable", configuration_disabled: "disabled", no_result: "no-result", malformed_response: "malformed" })[category] ?? "error";
  return { status, error: { category, message: error instanceof Error ? error.message : String(error), retryable: Boolean(error?.retryable) } };
}

function acquireShared(provider, term) {
  const key = `${provider.id}:${term}`;
  let record = sharedRequests.get(key);
  if (!record) {
    const controller = new AbortController();
    record = { controller, refs: 0, promise: provider.lookup({ term, signal: controller.signal }).finally(() => sharedRequests.delete(key)) };
    sharedRequests.set(key, record);
  }
  record.refs += 1;
  return { promise: record.promise, release: () => { record.refs -= 1; if (record.refs <= 0 && sharedRequests.get(key) === record) record.controller.abort("No active lookup consumers."); } };
}

export function createOnlineDictionaryLookupController(options) {
  const { provider, mode = "manual", online = () => navigator.onLine, getSaved = async () => null, onState = () => {}, timeoutMs = DEFAULT_TIMEOUT_MS, allowSessionCache = false, cacheMaxEntries = 20, cacheTtlMs = 5 * 60 * 1000 } = options;
  let current = null, requestId = 0, closed = false;
  const cache = new Map();
  const emit = (state) => { if (!closed) onState(Object.freeze({ providerId: provider.id, term: current?.term ?? null, ...state })); return state; };
  const stop = () => { requestId += 1; current?.controller?.abort("Superseded."); current = null; };
  const cached = (term) => {
    if (!allowSessionCache) return null;
    const key = `${provider.id}:${term}:1`, value = cache.get(key);
    if (!value || Date.now() - value.savedAt > cacheTtlMs) { cache.delete(key); return null; }
    cache.delete(key); cache.set(key, value); return value.state;
  };
  const remember = (term, state) => {
    if (!allowSessionCache || !["success", "no-result"].includes(state.status)) return;
    cache.set(`${provider.id}:${term}:1`, { state, savedAt: Date.now() });
    while (cache.size > cacheMaxEntries) cache.delete(cache.keys().next().value);
  };

  async function lookup(term, { forceRefresh = false } = {}) {
    if (closed) return { status: "cancelled" };
    stop();
    const normalized = String(term ?? "").trim();
    const id = ++requestId, controller = new AbortController(); current = { id, term: normalized, controller };
    if (!provider.supports(normalized)) return emit({ status: "hidden" });
    if (mode === "off") return emit({ status: "hidden" });
    const saved = await getSaved(normalized, provider.id).catch(() => null);
    if (id !== requestId || closed) return { status: "cancelled" };
    if (saved) return emit({ status: "saved", entry: saved });
    if (!online()) return emit({ status: "offline" });
    if (!provider.canLookupInApp) return emit({ status: "disabled" });
    const hit = !forceRefresh && cached(normalized);
    if (hit) return emit(hit);
    emit({ status: "checking" });
    const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "AbortError")), timeoutMs);
    let shared = null;
    try {
      let promise;
      if (forceRefresh) promise = provider.lookup({ term: normalized, signal: controller.signal, forceRefresh: true });
      else { shared = acquireShared(provider, normalized); promise = shared.promise; }
      const entry = await Promise.race([promise, new Promise((_resolve, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true }))]);
      if (id !== requestId || closed) return { status: "cancelled" };
      const state = { status: "success", entry }; remember(normalized, state); return emit(state);
    } catch (error) {
      if (id !== requestId || closed) return { status: "cancelled" };
      const timedOut = controller.signal.aborted && controller.signal.reason?.name === "AbortError" && controller.signal.reason?.message === "Timed out";
      const state = timedOut ? { status: "timed-out", error: { category: "timeout", message: "Youdao lookup timed out.", retryable: true } } : errorState(error);
      remember(normalized, state); return state.status === "cancelled" ? state : emit(state);
    } finally { clearTimeout(timer); shared?.release(); }
  }

  async function display(term) {
    if (mode === "automatic") return lookup(term);
    stop(); current = { id: ++requestId, term: String(term ?? "").trim(), controller: null };
    if (mode === "off" || !provider.supports(current.term)) return emit({ status: "hidden" });
    const saved = await getSaved(current.term, provider.id).catch(() => null);
    if (saved) return emit({ status: "saved", entry: saved });
    if (!online()) return emit({ status: "offline" });
    return emit({ status: provider.canLookupInApp ? "manual-ready" : "disabled" });
  }

  return { display, lookup, refresh: (term) => lookup(term, { forceRefresh: true }), cancel: stop, close: () => { closed = true; stop(); }, cacheSize: () => cache.size };
}

export function clearOnlineDictionaryRequestsForTest() { for (const record of sharedRequests.values()) record.controller.abort(); sharedRequests.clear(); }
