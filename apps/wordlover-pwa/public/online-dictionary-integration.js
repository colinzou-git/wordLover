import { createOnlineDictionaryLookupController } from "./online-dictionary-lookup-controller.js?v=20260715-2";
import { updateYoudaoSection } from "./online-dictionary-result-renderer.js?v=20260715-2";
import { youdaoProvider } from "./youdao-provider.js?v=20260715-2";
import { normalizeSupplementTerm } from "./dictionary-supplements.js?v=20260715-2";

const controllers = new WeakMap();
const mountedElements = new Set();
function hydrate(element) {
  if (controllers.has(element)) return;
  const mounted = { controller: null, persisting: false };
  const supplements = {
    get: (...args) => globalThis.WordLoverDictionarySupplements?.get(...args) ?? null,
    upsertFromLookup: (...args) => globalThis.WordLoverDictionarySupplements?.upsertFromLookup(...args) ?? globalThis.WordLoverDictionarySupplements?.save(...args) ?? Promise.reject(new Error("Supplement storage is unavailable.")),
    canPersist: (...args) => Boolean(globalThis.WordLoverDictionarySupplements?.canPersist(...args)),
  };
  const render = (state) => {
    if (!element.isConnected) return;
    updateYoudaoSection(element, state);
    element.querySelector("[data-youdao-retry]")?.addEventListener("click", () => void controller.lookup(element.dataset.term));
  };
  const controller = createOnlineDictionaryLookupController({
    provider: youdaoProvider,
    enabled: true,
    normalizeTerm: normalizeSupplementTerm,
    getSaved: async (term, providerId) => (await supplements?.get(term, providerId))?.entry ?? null,
    onSuccess: async ({ entry }) => {
      if (!supplements.canPersist("youdao")) return { status: "success", entry };
      mounted.persisting = true;
      try {
        const record = await supplements.upsertFromLookup(entry, { locallyPersistedAt: new Date().toISOString() });
        return { status: "saved", entry: record.entry, automaticallyPersisted: true };
      } finally {
        mounted.persisting = false;
      }
    },
    allowSessionCache: false,
    onState: render,
  });
  mounted.controller = controller;
  controllers.set(element, mounted);
  mountedElements.add(element);
  void controller.display(element.dataset.term);
}
function scan(root = document) { root.querySelectorAll?.(".online-dictionary-actions[data-online-dictionary-provider='youdao']").forEach(hydrate); }
scan();
new MutationObserver((records) => { for (const record of records) { record.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) { if (node.matches?.(".online-dictionary-actions[data-online-dictionary-provider='youdao']")) hydrate(node); scan(node); } }); record.removedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) { const close = (element) => { controllers.get(element)?.controller.close(); mountedElements.delete(element); }; close(node); node.querySelectorAll?.(".online-dictionary-actions").forEach(close); } }); } }).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("wordlover:supplement-changed", (event) => {
  const { action, normalizedTerm, providerId } = event.detail ?? {};
  if (providerId !== "youdao" || !normalizedTerm) return;
  document.querySelectorAll(".online-dictionary-actions[data-online-dictionary-provider='youdao']").forEach((element) => {
    if (normalizeSupplementTerm(element.dataset.term) === normalizedTerm) {
      const mounted = controllers.get(element);
      if (!mounted?.persisting && ["saved", "removed", "restored"].includes(action)) {
        void mounted?.controller.display(element.dataset.term, { allowNetwork: false });
      }
    }
  });
});
window.addEventListener("wordlover:youdao-setting-changed", (event) => {
  if (event.detail?.enabled !== false) return;
  for (const element of mountedElements) controllers.get(element)?.controller.close();
});
