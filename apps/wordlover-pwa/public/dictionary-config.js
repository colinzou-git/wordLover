import {
  DEFAULT_DICTIONARY_ID,
  DICTIONARY_REGISTRY,
} from "./dictionary-registry.js";

export const PRODUCTION_DICTIONARY_CONFIG = DICTIONARY_REGISTRY.ecdict;
export const KAIKKI_DICTIONARY_CONFIG = DICTIONARY_REGISTRY.kaikki;
export const KAIKKI_PREVIEW_DICTIONARY_CONFIG = DICTIONARY_REGISTRY["kaikki-preview"];
export const KAIKKI_LOCAL_PREVIEW_DICTIONARY_CONFIG = DICTIONARY_REGISTRY["kaikki-preview-local"];

export function normalizeDictionaryId(value) {
  const id = String(value ?? "").trim().toLowerCase();
  return DICTIONARY_REGISTRY[id] ? id : DEFAULT_DICTIONARY_ID;
}

export function resolveDictionaryConfig(search = "", explicitConfig = {}) {
  const queryId = new URLSearchParams(search).get("dictionary");
  const selectedId = explicitConfig.dictionaryId != null
    ? normalizeDictionaryId(explicitConfig.dictionaryId)
    : queryId != null
      ? normalizeDictionaryId(queryId)
      : normalizeDictionaryId(explicitConfig.savedDictionaryId);
  const base = DICTIONARY_REGISTRY[selectedId];
  return Object.freeze({
    ...base,
    dictionaryManifestUrl: explicitConfig.dictionaryManifestUrl ?? base.dictionaryManifestUrl,
    fullDictionaryBaseUrl: explicitConfig.fullDictionaryBaseUrl ?? base.fullDictionaryBaseUrl,
  });
}

export function dictionaryStorageKeys(mode = "production") {
  const normalizedMode = String(mode || "production");
  const prefix = normalizedMode === "production" ? "" : `${normalizedMode}.`;
  return Object.freeze({
    dictionaryKey: `${prefix}dictionary.sqlite`,
    progressKey: `${prefix}dictionary.sqlite.downloadProgress`,
    chunkPrefix: `${prefix}dictionary.sqlite.chunk.`,
    versionKey: `${prefix}dictionaryDataVersion`,
    installedKey: `${prefix}dictionaryInstalled`,
  });
}

export function resolveDictionaryAssetUrl(manifestUrl, assetPath = "dictionary.sqlite") {
  const manifest = String(manifestUrl || PRODUCTION_DICTIONARY_CONFIG.dictionaryManifestUrl);
  const asset = String(assetPath || "dictionary.sqlite").replace(/^\/+/, "");
  const slash = manifest.lastIndexOf("/");
  return `${slash >= 0 ? manifest.slice(0, slash + 1) : "/"}${asset}`;
}
