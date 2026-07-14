import { createOnlineDictionaryLookupController } from "./online-dictionary-lookup-controller.js?v=20260714-5";
import { updateYoudaoSection } from "./online-dictionary-result-renderer.js?v=20260714-5";
import { youdaoProvider } from "./youdao-provider.js?v=20260714-5";

const controllers = new WeakMap();
function hydrate(element) {
  if (controllers.has(element)) return;
  const controller = createOnlineDictionaryLookupController({ provider: youdaoProvider, mode: element.dataset.mode ?? "manual", getSaved: async (term, providerId) => (await globalThis.WordLoverDictionarySupplements?.get(term, providerId))?.entry ?? null, allowSessionCache: false, onState: (state) => { if (element.isConnected) { updateYoudaoSection(element, state); element.querySelector("[data-youdao-check]")?.addEventListener("click", () => void controller.lookup(element.dataset.term)); } } });
  controllers.set(element, controller);
  void controller.display(element.dataset.term);
}
function scan(root = document) { root.querySelectorAll?.(".online-dictionary-actions[data-online-dictionary-provider='youdao']").forEach(hydrate); }
scan();
new MutationObserver((records) => { for (const record of records) { record.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) { if (node.matches?.(".online-dictionary-actions[data-online-dictionary-provider='youdao']")) hydrate(node); scan(node); } }); record.removedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) { controllers.get(node)?.close(); node.querySelectorAll?.(".online-dictionary-actions").forEach((child) => controllers.get(child)?.close()); } }); } }).observe(document.documentElement, { childList: true, subtree: true });
