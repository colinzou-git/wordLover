import { resolveOnlineDictionaryEntry } from "./online-dictionary.js?v=20260718-3";

window.WordFanTieredLookupForTest = (term) => resolveOnlineDictionaryEntry({ term, apiKey: "", model: "gemini-2.5-flash" });
