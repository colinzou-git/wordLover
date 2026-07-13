/**
 * @typedef {Object} OnlineDictionaryProvider
 * @property {string} id
 * @property {string} label
 * @property {(term: string) => boolean} supports
 * @property {(term: string) => string} buildExternalUrl
 * @property {boolean} canLookupInApp
 * @property {(args: object) => Promise<object>=} lookup
 */

const providers = new Map();

function assertProvider(provider) {
  if (!provider || typeof provider !== "object") throw new TypeError("Online dictionary provider must be an object.");
  if (!/^[a-z][a-z0-9-]*$/.test(provider.id ?? "")) throw new TypeError("Online dictionary provider id is invalid.");
  if (!String(provider.label ?? "").trim()) throw new TypeError("Online dictionary provider label is required.");
  if (typeof provider.supports !== "function") throw new TypeError("Online dictionary provider supports() is required.");
  if (typeof provider.buildExternalUrl !== "function") throw new TypeError("Online dictionary provider buildExternalUrl() is required.");
  if (typeof provider.canLookupInApp !== "boolean") throw new TypeError("Online dictionary provider canLookupInApp must be boolean.");
  if (provider.lookup !== undefined && typeof provider.lookup !== "function") throw new TypeError("Online dictionary provider lookup must be a function.");
}

/** @param {OnlineDictionaryProvider} provider */
export function registerOnlineDictionaryProvider(provider) {
  assertProvider(provider);
  const registered = Object.freeze({ ...provider });
  providers.set(registered.id, registered);
  return registered;
}

export function getOnlineDictionaryProvider(id) {
  return providers.get(String(id ?? "")) ?? null;
}

export function listOnlineDictionaryProviders() {
  return [...providers.values()];
}

export function clearOnlineDictionaryProvidersForTest() {
  providers.clear();
}
