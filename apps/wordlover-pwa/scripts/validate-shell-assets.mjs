import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const swText = readFileSync(join(publicDir, "sw.js"), "utf8");
const dictionaryAssets = new Set(["/dictionary.sqlite", "/dictionary.sqlite.zst", "/dictionary-manifest.json"]);

function readArray(name) {
  const match = swText.match(new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`Missing ${name} in sw.js`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function fileForAsset(asset) {
  const path = asset.split("?")[0];
  if (path === "/") return join(publicDir, "index.html");
  return join(publicDir, path.replace(/^\//, ""));
}

const required = readArray("REQUIRED_SHELL_ASSETS");
const optional = readArray("OPTIONAL_SHELL_ASSETS");
const failures = [];

for (const asset of [...required, ...optional]) {
  if (dictionaryAssets.has(asset.split("?")[0])) failures.push(`Dictionary asset must not be shell cached: ${asset}`);
}
for (const asset of required) {
  if (!existsSync(fileForAsset(asset))) failures.push(`Required shell asset is missing: ${asset}`);
}

if (failures.length) {
  console.error("Shell asset validation FAILED:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Shell asset validation PASSED (${required.length} required, ${optional.length} optional).`);
