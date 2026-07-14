const SCHEMA_VERSION = 1;
const TERM_RE = /^[a-z]+(?:[ '-][a-z]+){0,5}$/;

export class SupplementPolicyError extends Error {
  constructor(message = "Saving this provider's content is disabled by policy.") {
    super(message);
    this.name = "SupplementPolicyError";
    this.category = "persistence_not_permitted";
  }
}

export function normalizeSupplementTerm(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function dictionarySupplementKey(term, providerId) {
  const normalizedTerm = normalizeSupplementTerm(term);
  const normalizedProvider = String(providerId ?? "").trim().toLowerCase();
  if (!TERM_RE.test(normalizedTerm)) throw new TypeError("Dictionary supplement term is invalid.");
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(normalizedProvider)) throw new TypeError("Dictionary supplement provider is invalid.");
  return `${normalizedProvider}:${normalizedTerm}`;
}

export function validateDictionarySupplement(value, { validateEntry } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Dictionary supplement must be an object.");
  if (value.recordSchemaVersion !== SCHEMA_VERSION) throw new TypeError(`Unsupported dictionary supplement schema: ${value.recordSchemaVersion ?? "missing"}.`);
  const providerId = String(value.providerId ?? "").trim().toLowerCase();
  const normalizedTerm = normalizeSupplementTerm(value.normalizedTerm);
  const id = dictionarySupplementKey(normalizedTerm, providerId);
  if (value.id !== id) throw new TypeError("Dictionary supplement identity does not match its term and provider.");
  const providerLabel = String(value.providerLabel ?? "").trim();
  const sourceUrl = String(value.sourceUrl ?? "").trim();
  if (!providerLabel) throw new TypeError("Dictionary supplement provider label is required.");
  let parsedUrl;
  try { parsedUrl = new URL(sourceUrl); } catch { throw new TypeError("Dictionary supplement source URL is invalid."); }
  if (parsedUrl.protocol !== "https:") throw new TypeError("Dictionary supplement source URL must use HTTPS.");
  const dates = ["savedAt", "sourceRetrievedAt", "updatedAt"];
  for (const field of dates) if (!Number.isFinite(Date.parse(value[field]))) throw new TypeError(`Dictionary supplement ${field} is invalid.`);
  const entry = validateEntry ? validateEntry(value.entry) : value.entry;
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError("Dictionary supplement entry is invalid.");
  if (normalizeSupplementTerm(entry.normalizedTerm) !== normalizedTerm) throw new TypeError("Dictionary supplement entry term does not match its record.");
  if (String(entry.provider?.id ?? "").toLowerCase() !== providerId) throw new TypeError("Dictionary supplement entry provider does not match its record.");
  if (String(entry.provider?.label ?? "").trim() !== providerLabel) throw new TypeError("Dictionary supplement entry attribution does not match its record.");
  if (String(entry.sourceUrl ?? "").trim() !== sourceUrl) throw new TypeError("Dictionary supplement entry source URL does not match its record.");
  return Object.freeze({
    recordSchemaVersion: SCHEMA_VERSION,
    id,
    normalizedTerm,
    headword: String(value.headword ?? entry.headword ?? normalizedTerm).trim(),
    providerId,
    providerLabel,
    sourceUrl,
    entrySchemaVersion: Number(value.entrySchemaVersion ?? entry.schemaVersion),
    entry,
    savedAt: new Date(value.savedAt).toISOString(),
    sourceRetrievedAt: new Date(value.sourceRetrievedAt).toISOString(),
    updatedAt: new Date(value.updatedAt).toISOString(),
    ...(value.userFields && typeof value.userFields === "object" && !Array.isArray(value.userFields) ? { userFields: structuredClone(value.userFields) } : {}),
  });
}

export function createDictionarySupplementRecord(entry, { now = () => new Date().toISOString() } = {}) {
  if (!entry || typeof entry !== "object") throw new TypeError("A normalized provider entry is required.");
  const providerId = String(entry.provider?.id ?? "").trim().toLowerCase();
  const normalizedTerm = normalizeSupplementTerm(entry.normalizedTerm);
  const timestamp = now();
  return {
    recordSchemaVersion: SCHEMA_VERSION,
    id: dictionarySupplementKey(normalizedTerm, providerId),
    normalizedTerm,
    headword: String(entry.headword ?? normalizedTerm).trim(),
    providerId,
    providerLabel: String(entry.provider?.label ?? "").trim(),
    sourceUrl: String(entry.sourceUrl ?? "").trim(),
    entrySchemaVersion: Number(entry.schemaVersion),
    entry,
    savedAt: timestamp,
    sourceRetrievedAt: entry.retrievedAt,
    updatedAt: timestamp,
  };
}

export function createDictionarySupplementStore({ read, write, remove, list, validateEntry, canPersistProvider = () => false }) {
  if (![read, write, remove, list].every((fn) => typeof fn === "function")) throw new TypeError("Dictionary supplement storage adapters are required.");
  const validate = (record) => validateDictionarySupplement(record, { validateEntry });
  const permitted = (providerId) => Boolean(canPersistProvider(String(providerId ?? "").toLowerCase()));
  const assertPermitted = (providerId) => { if (!permitted(providerId)) throw new SupplementPolicyError(); };
  return Object.freeze({
    async get(term, providerId) {
      const key = dictionarySupplementKey(term, providerId);
      try { const value = await read(key); return value ? validate(value) : null; } catch (error) { if (error instanceof SupplementPolicyError) throw error; return null; }
    },
    async save(entry) {
      const providerId = String(entry?.provider?.id ?? "").toLowerCase();
      assertPermitted(providerId);
      const record = validate(createDictionarySupplementRecord(entry), { validateEntry });
      const existing = await read(record.id).catch(() => null);
      const saved = validate({ ...record, savedAt: existing?.savedAt ?? record.savedAt, updatedAt: new Date().toISOString() });
      await write(saved.id, saved);
      return saved;
    },
    async remove(term, providerId) { await remove(dictionarySupplementKey(term, providerId)); },
    async list() {
      const values = await list();
      const valid = [];
      for (const value of values ?? []) { try { valid.push(validate(value)); } catch { /* Isolate corrupt records. */ } }
      return valid;
    },
    canPersist: permitted,
  });
}

export const DICTIONARY_SUPPLEMENT_SCHEMA_VERSION = SCHEMA_VERSION;
