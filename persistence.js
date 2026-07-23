// Pure crypto/encoding utilities for WordFan user data encryption.
// No globals, no DOM, no IndexedDB connections — only Web Crypto and base64.

export function isEncryptedRecord(value) {
  return Boolean(value && value.__encrypted === true && value.iv && value.ciphertext);
}

export function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function checksumText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function derivePassphraseAesKey(passphrase, salt, usages) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export async function deriveKek(passphrase, salt) {
  return derivePassphraseAesKey(passphrase, salt, ["wrapKey", "unwrapKey"]);
}

export async function encryptJsonWithPassphrase(value, passphrase, usages = ["encrypt"]) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derivePassphraseAesKey(passphrase, salt, usages);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return {
    kdf: "PBKDF2-SHA256",
    iterations: 200000,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext),
  };
}

export async function decryptJsonWithPassphrase(envelope, passphrase) {
  const salt = base64ToBytes(envelope.salt);
  const key = await derivePassphraseAesKey(passphrase, salt, ["decrypt"]);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.data);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}
