import { requestOnlineDictionaryEntry } from "./online-dictionary.js?v=20260618-1";

const STATUS_ATTRIBUTE = "data-online-dictionary-status";
const WAIT_FOR_LOCAL_MS = 30000;
let generation = 0;
let busyTerm = "";
let sessionApiKey = String(window.WORDLOVER_CONFIG?.geminiApiKey ?? "").trim();
let sessionModel = String(window.WORDLOVER_CONFIG?.geminiModel ?? "gemini-2.5-flash").trim();
let settingsWaiter = null;

function normalizeTerm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02bc\uff07]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ui() {
  return {
    input: document.querySelector("#termInput"),
    result: document.querySelector("#result"),
    keyButton: document.querySelector("#geminiApiKeyConfig"),
  };
}

function setStatus(message, { error = false, html = "" } = {}) {
  const { result } = ui();
  if (!result) return;
  let node = result.querySelector(`[${STATUS_ATTRIBUTE}]`);
  if (!node) {
    node = document.createElement("div");
    node.setAttribute(STATUS_ATTRIBUTE, "");
    result.prepend(node);
  }
  node.className = error ? "online-dictionary-status error" : "online-dictionary-status muted";
  if (html) node.innerHTML = html;
  else node.textContent = message;
}

function localMissVisible(term) {
  const { input, result } = ui();
  return Boolean(
    input
    && result
    && normalizeTerm(input.value) === normalizeTerm(term)
    && result.querySelector("#addToDictionary"),
  );
}

function waitForLocalMiss(term, token) {
  return new Promise((resolve) => {
    if (localMissVisible(term)) {
      resolve(true);
      return;
    }
    const { result } = ui();
    if (!result) {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(value);
    };
    const observer = new MutationObserver(() => {
      if (token !== generation || normalizeTerm(ui().input?.value) !== normalizeTerm(term)) {
        finish(false);
      } else if (localMissVisible(term)) {
        finish(true);
      }
    });
    observer.observe(result, { childList: true, subtree: true, characterData: true });
    const timer = setTimeout(() => finish(false), WAIT_FOR_LOCAL_MS);
  });
}

function currentGeminiModal() {
  const overlays = [...document.querySelectorAll(".modal-overlay")];
  return overlays.find((overlay) => overlay.querySelector("#modalTitle")?.textContent?.includes("Gemini API key")) ?? null;
}

function captureGeminiSettings() {
  const modal = currentGeminiModal();
  if (!modal) return false;
  const key = String(modal.querySelector('[data-modal-field="apiKey"]')?.value ?? "").trim();
  const model = String(modal.querySelector('[data-modal-field="model"]')?.value ?? "").trim();
  if (!key) return false;
  sessionApiKey = key;
  sessionModel = model || "gemini-2.5-flash";
  settingsWaiter?.({ apiKey: sessionApiKey, model: sessionModel });
  settingsWaiter = null;
  return true;
}

document.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("[data-modal-submit]")) {
    captureGeminiSettings();
  }
  if (event.target instanceof Element && event.target.closest("[data-modal-cancel]")) {
    settingsWaiter?.(null);
    settingsWaiter = null;
  }
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && currentGeminiModal()) captureGeminiSettings();
}, true);

async function ensureGeminiSettings() {
  if (sessionApiKey) return { apiKey: sessionApiKey, model: supportedGroundingModel(sessionModel) };
  const { keyButton } = ui();
  if (!keyButton) return null;
  setStatus("Confirm your saved Gemini key to search Google for this missing word.");
  keyButton.click();
  return new Promise((resolve) => {
    settingsWaiter = (settings) => resolve(
      settings
        ? { apiKey: settings.apiKey, model: supportedGroundingModel(settings.model) }
        : null,
    );
  });
}

function supportedGroundingModel(model) {
  return /^gemini-(?:2(?:\.0|\.5)|3(?:\.|$))/i.test(model)
    ? model
    : "gemini-2.5-flash";
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

async function addThroughNativeDialog(term, online) {
  const addButton = ui().result?.querySelector("#addToDictionary");
  if (!(addButton instanceof HTMLButtonElement)) {
    throw new Error("WordFan's Add to dictionary action is unavailable.");
  }
  const modalPromise = waitForAddDialog();
  addButton.click();
  const modal = await modalPromise;
  if (!modal) throw new Error("WordFan could not open the Add to dictionary form.");

  const values = {
    term: online.canonicalWord || term,
    phonetic: online.phonetic || "",
    english: (online.englishMeanings || []).join("; "),
    chinese: (online.chineseMeanings || []).join("; "),
  };
  for (const [field, value] of Object.entries(values)) {
    const control = modal.querySelector(`[data-modal-field="${field}"]`);
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      control.value = value;
      control.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  modal.querySelector("[data-modal-submit]")?.click();
}

function renderCorrection(term, suggestedWord) {
  setStatus("", {
    html: `Google did not verify <strong>${escapeHtml(term)}</strong> as an exact dictionary term. Did you mean <button type="button" class="result-option" data-term="${escapeHtml(suggestedWord)}"><strong>${escapeHtml(suggestedWord)}</strong></button>?`,
  });
}

async function runFallback(term, token) {
  const cleanTerm = String(term ?? "").trim();
  if (!cleanTerm || busyTerm === normalizeTerm(cleanTerm)) return;
  const missed = await waitForLocalMiss(cleanTerm, token);
  if (!missed || token !== generation) return;

  busyTerm = normalizeTerm(cleanTerm);
  try {
    if (!navigator.onLine) {
      setStatus("This term was not found locally. Connect to the internet to search Google.", { error: true });
      return;
    }
    const settings = await ensureGeminiSettings();
    if (!settings || token !== generation) return;

    setStatus(`Not found locally. Searching Google for “${cleanTerm}”…`);
    const online = await requestOnlineDictionaryEntry({
      term: cleanTerm,
      apiKey: settings.apiKey,
      model: settings.model,
    });
    if (token !== generation || normalizeTerm(ui().input?.value) !== normalizeTerm(cleanTerm)) return;

    if (online.status === "correction" && online.suggestedWord) {
      renderCorrection(cleanTerm, online.suggestedWord);
      return;
    }
    if (online.status !== "found") {
      setStatus("Google Search did not find enough reliable evidence to add this term automatically.", { error: true });
      return;
    }

    setStatus("Verified online. Adding this entry to WordFan…");
    await addThroughNativeDialog(cleanTerm, online);
  } catch (error) {
    setStatus(`Online dictionary lookup failed: ${error instanceof Error ? error.message : String(error)}`, { error: true });
  } finally {
    busyTerm = "";
  }
}

function install() {
  const { input } = ui();
  if (!input) return;
  input.addEventListener("input", () => {
    generation += 1;
    busyTerm = "";
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const term = input.value.trim();
    if (!term) return;
    const token = ++generation;
    queueMicrotask(() => void runFallback(term, token));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", install, { once: true });
} else {
  install();
}
