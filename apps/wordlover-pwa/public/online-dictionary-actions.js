import {
  getOnlineDictionaryProvider,
  registerOnlineDictionaryProvider,
} from "./online-dictionary-provider.js?v=20260718-3";
import { youdaoProvider } from "./youdao-provider.js?v=20260718-3";

if (!getOnlineDictionaryProvider(youdaoProvider.id)) registerOnlineDictionaryProvider(youdaoProvider);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function onlineDictionaryExternalUrl(providerId, term) {
  const provider = getOnlineDictionaryProvider(providerId);
  if (!provider?.supports(term)) return "";
  return provider.buildExternalUrl(term);
}

export function renderOnlineDictionaryActions(term, options = {}) {
  if (options.enabled !== true) return "";
  const provider = getOnlineDictionaryProvider(options.providerId ?? "youdao");
  if (!provider?.supports(term)) return "";
  const context = String(options.context ?? "definition");
  return `
    <aside class="online-dictionary-actions" data-online-dictionary-provider="${escapeHtml(provider.id)}" data-online-dictionary-context="${escapeHtml(context)}" data-term="${escapeHtml(term)}"></aside>
  `;
}
