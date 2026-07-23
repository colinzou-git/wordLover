export const DICTIONARY_IDS = Object.freeze({
  ECDICT: "ecdict",
  KAIKKI: "kaikki",
  KAIKKI_PREVIEW: "kaikki-preview",
  KAIKKI_PREVIEW_LOCAL: "kaikki-preview-local",
});

export const DEFAULT_DICTIONARY_ID = DICTIONARY_IDS.ECDICT;

export const DICTIONARY_REGISTRY = Object.freeze({
  [DICTIONARY_IDS.ECDICT]: Object.freeze({
    id: DICTIONARY_IDS.ECDICT,
    label: "ECDICT / WordFan",
    dictionaryManifestUrl: "/dictionary-manifest.json",
    fullDictionaryBaseUrl: "/dictionary-full",
    mode: "production",
    storageScope: "production",
    isDefault: true,
    isPreview: false,
  }),
  [DICTIONARY_IDS.KAIKKI]: Object.freeze({
    id: DICTIONARY_IDS.KAIKKI,
    label: "Kaikki / Wiktextract",
    dictionaryManifestUrl: "/kaikki/dictionary-manifest.json",
    fullDictionaryBaseUrl: "/kaikki/dictionary-full",
    mode: "kaikki",
    storageScope: "kaikki",
    isDefault: false,
    isPreview: false,
  }),
  [DICTIONARY_IDS.KAIKKI_PREVIEW]: Object.freeze({
    id: DICTIONARY_IDS.KAIKKI_PREVIEW,
    label: "Kaikki preview",
    dictionaryManifestUrl: "/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-manifest.json",
    fullDictionaryBaseUrl: "/kaikki-preview/feature-kaikki-dictionary-preview/dictionary-full",
    mode: "kaikki-preview",
    storageScope: "kaikki-preview",
    isDefault: false,
    isPreview: true,
  }),
  [DICTIONARY_IDS.KAIKKI_PREVIEW_LOCAL]: Object.freeze({
    id: DICTIONARY_IDS.KAIKKI_PREVIEW_LOCAL,
    label: "Kaikki local preview",
    dictionaryManifestUrl: "/kaikki-preview/local/dictionary-manifest.json",
    fullDictionaryBaseUrl: "/kaikki-preview/local/dictionary-full",
    mode: "kaikki-preview-local",
    storageScope: "kaikki-preview-local",
    isDefault: false,
    isPreview: true,
  }),
});

export function userSelectableDictionaries() {
  return Object.values(DICTIONARY_REGISTRY).filter((entry) => !entry.isPreview);
}
