import { DEFAULT_DICTIONARY_ID, DICTIONARY_REGISTRY } from "./dictionary-registry.js";

export const SELECTED_DICTIONARY_ID_KEY = "selectedDictionaryId";

export function readSelectedDictionaryId(storage = globalThis.localStorage) {
  try {
    const value = String(storage?.getItem?.(SELECTED_DICTIONARY_ID_KEY) ?? "").trim().toLowerCase();
    return DICTIONARY_REGISTRY[value] && !DICTIONARY_REGISTRY[value].isPreview
      ? value
      : DEFAULT_DICTIONARY_ID;
  } catch {
    return DEFAULT_DICTIONARY_ID;
  }
}

export function saveSelectedDictionaryId(value, storage = globalThis.localStorage) {
  const id = String(value ?? "").trim().toLowerCase();
  const selected = DICTIONARY_REGISTRY[id] && !DICTIONARY_REGISTRY[id].isPreview
    ? id
    : DEFAULT_DICTIONARY_ID;
  try {
    storage?.setItem?.(SELECTED_DICTIONARY_ID_KEY, selected);
  } catch {
    /* Restricted/private storage must not prevent dictionary use. */
  }
  return selected;
}

export function dictionaryRecordMetadata(config, dictionaryDataVersion = null) {
  return Object.freeze({
    dictionaryId: config?.id ?? DEFAULT_DICTIONARY_ID,
    dictionaryLabel: config?.label ?? DICTIONARY_REGISTRY[DEFAULT_DICTIONARY_ID].label,
    dictionaryDataVersion: dictionaryDataVersion ?? null,
  });
}
