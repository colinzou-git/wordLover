export const PRODUCTION_DICTIONARY_CONFIG = Object.freeze({
  dictionaryManifestUrl: "/dictionary-manifest.json",
  fullDictionaryBaseUrl: "/dictionary-full",
  mode: "production",
});

export const KAIKKI_PREVIEW_DICTIONARY_CONFIG = Object.freeze({
  dictionaryManifestUrl: "/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-manifest.json",
  fullDictionaryBaseUrl: "/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-full",
  mode: "kaikki-preview",
});

export function resolveDictionaryConfig(search = "", explicitConfig = {}) {
  const selected = new URLSearchParams(search).get("dictionary");
  const defaults = selected === "kaikki-preview"
    ? KAIKKI_PREVIEW_DICTIONARY_CONFIG
    : PRODUCTION_DICTIONARY_CONFIG;
  return Object.freeze({
    ...defaults,
    ...(explicitConfig.dictionaryManifestUrl
      ? { dictionaryManifestUrl: explicitConfig.dictionaryManifestUrl }
      : {}),
    ...(explicitConfig.fullDictionaryBaseUrl
      ? { fullDictionaryBaseUrl: explicitConfig.fullDictionaryBaseUrl }
      : {}),
  });
}
