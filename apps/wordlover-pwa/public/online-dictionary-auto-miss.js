import { resolveOnlineDictionaryEntry } from "./online-dictionary.js?v=20260703-2";

const STATUS_ATTRIBUTE = "data-online-dictionary-auto-status";
const SOURCE_LABELS = {
  wiktionary: "Wiktionary",
  "wiktionary+gemini": "Wiktionary + Gemini translation",
  "gemini-grounded": "Google Search",
  "gemini-plain": "Gemini unverified fallback",
};
const seenTerms = new Set();
let busyTerm = "";
let mutationTimer = 0;

function normalizeTerm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02bc\uff07]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function ui() {
  return {
    input: document.querySelector("#termInput"),
    result: document.querySelector("#result"),
  };
}

function configuredGeminiKey() {
  return String(window.WORDLOVER_CONFIG?.geminiApiKey ?? "").trim();
}

function configuredGeminiModel() {
  return String(window.WORDLOVER_CONFIG?.geminiModel ?? "gemini-2.5-flash").trim() || "gemini-2.5-flash";
}

function sourceLabel(source) {
  return SOURCE_LABELS[source] ?? "the online dictionary";
}

export function shouldAutoSubmit(entry) {
  return entry.status === "found" && entry.confidence !== "low" && entry.source !== "gemini-plain";
}

function setStatus(message, { error = false } = {}) {
  const { result } = ui();
  if (!result) return;
  let node = result.querySelector(`[${STATUS_ATTRIBUTE}]`);
  if (!node) {
    node = document.createElement("div");
    node.setAttribute(STATUS_ATTRIBUTE, "");
    result.prepend(node);
  }
  node.className = error ? "online-dictionary-status error" : "online-dictionary-status muted";
  node.textContent = message;
}

function localMiss() {
  const { input, result } = ui();
  const term = String(input?.value ?? "").trim();
  const normalized = normalizeTerm(term);
  const addButton = result?.querySelector("#addToDictionary");
  if (!term || !normalized || !(addButton instanceof HTMLButtonElement)) return null;
  if (normalizeTerm(input?.value) !== normalized) return null;
  return { term, normalized, addButton };
}

function waitForAddDialog() {
  return new Promise((resolve) => {
    const find = () => {
      const modal = [...document.querySelectorAll(".modal-overlay")]
        .find((overlay) => overlay.querySelector("#modalTitle")?.textContent?.includes("Add a word to the dictionary"));
      if (modal) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(modal);
      }
    };
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, 5000);
    find();
  });
}

export async function openReviewDialog(miss, entry, { autoSubmit = false } = {}) {
  const modalPromise = waitForAddDialog();
  miss.addButton.click();
  const modal = await modalPromise;
  if (!modal) throw new Error("WordFan could not open the Add to dictionary form.");
  const values = {
    term: entry.canonicalWord || miss.term,
    phonetic: entry.phonetic || "",
    english: (entry.englishMeanings || []).join("; "),
    chinese: (entry.chineseMeanings || []).join("; "),
  };
  for (const [field, value] of Object.entries(values)) {
    const control = modal.querySelector(`[data-modal-field="${field}"]`);
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      control.value = value;
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  if (autoSubmit) modal.querySelector("[data-modal-submit]")?.click();
}

async function runAutoMissLookup() {
  const miss = localMiss();
  if (!miss || busyTerm === miss.normalized || seenTerms.has(miss.normalized)) return;
  busyTerm = miss.normalized;
  seenTerms.add(miss.normalized);
  try {
    if (!navigator.onLine) {
      setStatus("This term was not found locally. Connect to the internet to look it up online.", { error: true });
      return;
    }
    setStatus(`Not found locally. Looking up “${miss.term}” online…`);
    const entry = await resolveOnlineDictionaryEntry({
      term: miss.term,
      apiKey: configuredGeminiKey(),
      model: configuredGeminiModel(),
    });
    const latest = localMiss();
    if (!latest || latest.normalized !== miss.normalized) return;
    if (entry.status !== "found") {
      if (entry.suggestedWord) {
        setStatus(`No verified entry for this exact spelling. Did you mean “${entry.suggestedWord}”?`, { error: true });
      } else if (!configuredGeminiKey()) {
        setStatus("Not found locally, and no Gemini API key is configured for online lookup. Add a Gemini key in Settings, or double-check the spelling.", { error: true });
      } else {
        setStatus("No online entry could be created after Wiktionary, Gemini grounding, and Gemini plain fallback. Check the spelling, Gemini key/model, and network, then try again.", { error: true });
      }
      return;
    }
    const autoSubmit = shouldAutoSubmit(entry);
    setStatus(autoSubmit
      ? `Verified via ${sourceLabel(entry.source)}. Adding this entry to WordFan…`
      : `Best-effort entry from ${sourceLabel(entry.source)}. Review the filled details, then save if correct.`);
    await openReviewDialog(latest, entry, { autoSubmit });
  } catch (error) {
    setStatus(`Online dictionary lookup failed: ${error instanceof Error ? error.message : String(error)}`, { error: true });
  } finally {
    busyTerm = "";
  }
}

function scheduleAutoMissLookup() {
  clearTimeout(mutationTimer);
  mutationTimer = window.setTimeout(() => {
    void runAutoMissLookup();
  }, 100);
}

function install() {
  const { input, result } = ui();
  if (!input || !result) return;
  input.addEventListener("input", () => {
    busyTerm = "";
  });
  const observer = new MutationObserver(scheduleAutoMissLookup);
  observer.observe(result, { childList: true, subtree: true, characterData: true });
  scheduleAutoMissLookup();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
}
