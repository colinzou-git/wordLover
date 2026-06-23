import { lookupWiktionary } from "./wiktionary-lookup.js?v=20260622-1";

const STATUS_ATTRIBUTE = "data-online-dictionary-auto-status";
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

async function openReviewDialog(miss, wik) {
  const modalPromise = waitForAddDialog();
  miss.addButton.click();
  const modal = await modalPromise;
  if (!modal) throw new Error("WordFan could not open the Add to dictionary form.");
  const values = {
    term: wik.canonicalWord || miss.term,
    phonetic: wik.phonetic || "",
    english: (wik.englishMeanings || []).join("; "),
    chinese: (wik.chineseMeanings || []).join("; "),
  };
  for (const [field, value] of Object.entries(values)) {
    const control = modal.querySelector(`[data-modal-field="${field}"]`);
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      control.value = value;
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}

async function runAutoMissLookup() {
  const miss = localMiss();
  if (!miss || busyTerm === miss.normalized || seenTerms.has(miss.normalized)) return;
  busyTerm = miss.normalized;
  seenTerms.add(miss.normalized);
  try {
    setStatus(`Not found locally. Checking Wiktionary for “${miss.term}”…`);
    const wik = await lookupWiktionary(miss.term);
    const latest = localMiss();
    if (!latest || latest.normalized !== miss.normalized) return;
    if (!wik.found) {
      setStatus("No Wiktionary entry was found for this spelling.", { error: true });
      return;
    }
    setStatus("Found in Wiktionary. Review the filled details, then save if correct.");
    await openReviewDialog(latest, wik);
  } catch (error) {
    setStatus(`Wiktionary lookup failed: ${error instanceof Error ? error.message : String(error)}`, { error: true });
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
