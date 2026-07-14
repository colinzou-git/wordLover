import { createOnlineDictionaryLookupController } from "./online-dictionary-lookup-controller.js?v=20260714-9";
import { updateYoudaoSection } from "./online-dictionary-result-renderer.js?v=20260714-9";
import { youdaoProvider } from "./youdao-provider.js?v=20260714-9";
import { createOnlineDictionarySupplementLifecycle } from "./online-dictionary-supplement-lifecycle.js?v=20260714-9";
import { normalizeSupplementTerm } from "./dictionary-supplements.js?v=20260714-9";

const controllers = new WeakMap();
function hydrate(element) {
  if (controllers.has(element)) return;
  if (element.dataset.onlineDictionaryContext === "spelling-hint") return;
  const supplements = {
    get: (...args) => globalThis.WordLoverDictionarySupplements?.get(...args) ?? null,
    save: (...args) => globalThis.WordLoverDictionarySupplements?.save(...args) ?? Promise.reject(new Error("Supplement storage is unavailable.")),
    upsertFromLookup: (...args) => globalThis.WordLoverDictionarySupplements?.upsertFromLookup(...args) ?? globalThis.WordLoverDictionarySupplements?.save(...args) ?? Promise.reject(new Error("Supplement storage is unavailable.")),
    remove: (...args) => globalThis.WordLoverDictionarySupplements?.remove(...args) ?? Promise.reject(new Error("Supplement storage is unavailable.")),
    canPersist: (...args) => Boolean(globalThis.WordLoverDictionarySupplements?.canPersist(...args)),
  };
  let lifecycle;
  const render = (state) => {
    if (!element.isConnected) return;
    if (lifecycle?.activeAction() === "refresh" && !state.refreshing && state.status !== "saved") return;
    const persistenceAllowed = supplements.canPersist("youdao");
    const decorated = { ...state, canSave: state.status === "success" && persistenceAllowed, canRefresh: state.status === "saved" && persistenceAllowed && youdaoProvider.canLookupInApp };
    updateYoudaoSection(element, decorated);
    element.querySelector("[data-youdao-check]")?.addEventListener("click", () => void controller.lookup(element.dataset.term));
    element.querySelector("[data-youdao-save]")?.addEventListener("click", () => void lifecycle.save(element.dataset.term, state.entry));
    element.querySelector("[data-youdao-remove]")?.addEventListener("click", () => { if (globalThis.confirm("Remove this saved Youdao definition? The local WordFan definition and learning history will remain.")) void lifecycle.remove(element.dataset.term); });
    element.querySelector("[data-youdao-refresh]")?.addEventListener("click", () => void lifecycle.refresh(element.dataset.term));
  };
  const controller = createOnlineDictionaryLookupController({
    provider: youdaoProvider,
    mode: element.dataset.mode ?? "manual",
    normalizeTerm: normalizeSupplementTerm,
    getSaved: async (term, providerId) => (await supplements?.get(term, providerId))?.entry ?? null,
    onSuccess: async ({ entry }) => {
      if (!supplements.canPersist("youdao")) return { status: "success", entry };
      const record = await supplements.upsertFromLookup(entry, { locallyPersistedAt: new Date().toISOString() });
      return { status: "saved", entry: record.entry, automaticallyPersisted: true };
    },
    allowSessionCache: false,
    onState: render,
  });
  lifecycle = createOnlineDictionarySupplementLifecycle({ providerId: "youdao", supplements, controller, render });
  controllers.set(element, { controller, lifecycle });
  void lifecycle.display(element.dataset.term);
}
function scan(root = document) { root.querySelectorAll?.(".online-dictionary-actions[data-online-dictionary-provider='youdao']").forEach(hydrate); }
scan();
new MutationObserver((records) => { for (const record of records) { record.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) { if (node.matches?.(".online-dictionary-actions[data-online-dictionary-provider='youdao']")) hydrate(node); scan(node); } }); record.removedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) { controllers.get(node)?.controller.close(); node.querySelectorAll?.(".online-dictionary-actions").forEach((child) => controllers.get(child)?.controller.close()); } }); } }).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("wordlover:supplement-changed", (event) => {
  const { action, normalizedTerm, providerId } = event.detail ?? {};
  if (providerId !== "youdao" || !normalizedTerm) return;
  document.querySelectorAll(".online-dictionary-actions[data-online-dictionary-provider='youdao']").forEach((element) => {
    if (normalizeSupplementTerm(element.dataset.term) === normalizedTerm) {
      const mounted = controllers.get(element);
      if (action === "removed") void mounted?.controller.display(element.dataset.term, { skipLookup: true });
      else void mounted?.lifecycle.display(element.dataset.term);
    }
  });
});
