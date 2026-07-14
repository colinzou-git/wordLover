import {
  getOnlineDictionaryProvider,
  registerOnlineDictionaryProvider,
} from "./online-dictionary-provider.js?v=20260714-3";
import { youdaoProvider } from "./youdao-provider.js?v=20260714-3";

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
  const mode = options.mode === "off" ? "off" : "manual";
  if (mode === "off") return "";
  const provider = getOnlineDictionaryProvider(options.providerId ?? "youdao");
  if (!provider?.supports(term)) return "";
  const context = String(options.context ?? "definition");
  if (options.online === false) {
    return `
      <aside class="online-dictionary-actions" data-online-dictionary-provider="${escapeHtml(provider.id)}" data-online-dictionary-context="${escapeHtml(context)}">
        <span class="online-dictionary-source">Experimental · Source: ${escapeHtml(provider.label)}</span>
        <span class="small muted">Online lookup is unavailable while offline.</span>
      </aside>
    `;
  }
  const url = provider.buildExternalUrl(term);
  if (!url) return "";
  return `
    <aside class="online-dictionary-actions" data-online-dictionary-provider="${escapeHtml(provider.id)}" data-online-dictionary-context="${escapeHtml(context)}">
      <span class="online-dictionary-source">Experimental · Source: ${escapeHtml(provider.label)}</span>
      <a class="online-dictionary-link" href="${escapeHtml(url)}">Open full entry on ${escapeHtml(provider.label)}</a>
    </aside>
  `;
}
