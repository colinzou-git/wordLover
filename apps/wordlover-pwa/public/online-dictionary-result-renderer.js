import { buildYoudaoLookupUrl } from "./youdao-provider.js?v=20260714-8";

function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
const list = (items, render) => items?.length ? `<ul>${items.map(render).join("")}</ul>` : "";

export function renderYoudaoState(term, state) {
  const link = `<a class="online-dictionary-link" href="${escapeHtml(buildYoudaoLookupUrl(term))}">Open full entry on Youdao</a>`;
  const source = `<span class="online-dictionary-source">Source: Youdao</span>`;
  const status = state?.status ?? "manual-ready";
  if (status === "hidden") return "";
  if (status === "checking") return `${source}<span class="small muted" role="status">Checking Youdao…</span>${link}`;
  if (["success", "saved"].includes(status) && state.entry) {
    const entry = state.entry, phonetics = [entry.phonetics?.us ? `US /${entry.phonetics.us}/` : "", entry.phonetics?.uk ? `UK /${entry.phonetics.uk}/` : ""].filter(Boolean).join(" · ");
    const definitions = [...(entry.chineseDefinitions ?? []), ...(entry.englishDefinitions ?? [])];
    const lifecycleError = state.refreshError ?? state.saveError ?? state.removeError;
    const controls = status === "saved" && state.showLifecycleControls !== false
      ? `<span class="youdao-lifecycle-actions">${state.canRefresh ? `<button type="button" class="secondary-button" data-youdao-refresh>Refresh saved entry</button>` : ""}<button type="button" class="secondary-button" data-youdao-remove>Remove saved definition</button></span>`
      : state.canSave ? `<button type="button" class="secondary-button" data-youdao-save>Add as additional definition</button>` : "";
    return `${source}<strong class="youdao-headword">${escapeHtml(entry.headword)}</strong>${phonetics ? `<span>${escapeHtml(phonetics)}</span>` : ""}${list(definitions, (item) => `<li>${item.partOfSpeech ? `<span class="youdao-pos">${escapeHtml(item.partOfSpeech)}</span> ` : ""}${escapeHtml(item.text)}${item.domain ? ` <span class="youdao-domain">${escapeHtml(item.domain)}</span>` : ""}</li>`)}${entry.domains?.length ? `<p>Domains: ${escapeHtml(entry.domains.join(", "))}</p>` : ""}${list(entry.wordForms, (item) => `<li>${escapeHtml(item.name)}: ${escapeHtml(item.value)}</li>`)}${list(entry.phrases, (item) => `<li>${escapeHtml(item.phrase)} — ${escapeHtml(item.meanings.join("; "))}</li>`)}${list(entry.examples, (item) => `<li>${escapeHtml(item.sentence)}${item.translation ? ` — ${escapeHtml(item.translation)}` : ""}</li>`)}${entry.synonyms?.length ? `<p>Synonyms: ${escapeHtml(entry.synonyms.join(", "))}</p>` : ""}${entry.antonyms?.length ? `<p>Antonyms: ${escapeHtml(entry.antonyms.join(", "))}</p>` : ""}<span class="small muted">${state.refreshing ? "Refreshing saved entry…" : status === "saved" ? "Saved for offline use" : "Online result"}</span>${lifecycleError ? `<span class="small error-text" role="status">${escapeHtml(lifecycleError.message ?? "The saved entry was kept.")}</span>` : ""}${controls}${link}`;
  }
  const messages = { "manual-ready": "Check Youdao without changing the local definition.", offline: "Online lookup is unavailable while offline.", "no-result": "No Youdao result was found.", "timed-out": "Youdao lookup timed out.", "rate-limited": "Youdao lookup is temporarily rate limited.", "provider-unavailable": "Youdao is temporarily unavailable.", disabled: "Integrated lookup is disabled.", malformed: "The Youdao response could not be used.", error: "Youdao lookup failed." };
  const retry = ["no-result", "timed-out", "rate-limited", "provider-unavailable", "malformed", "error"].includes(status);
  const button = status === "manual-ready" ? `<button type="button" data-youdao-check>Check Youdao Online</button>` : retry ? `<button type="button" class="secondary-button" data-youdao-check>Retry Youdao</button>` : "";
  return `${source}<span class="small muted" role="status">${escapeHtml(messages[status] ?? messages.error)}</span>${button}${link}`;
}

export function updateYoudaoSection(element, state) {
  element.dataset.youdaoState = state.status;
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-busy", state.status === "checking" ? "true" : "false");
  element.innerHTML = renderYoudaoState(element.dataset.term ?? "", state);
}
