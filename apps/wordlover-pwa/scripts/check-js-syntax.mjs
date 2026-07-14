#!/usr/bin/env node
/**
 * Syntax-check shell JavaScript files.
 * Required files: fail if missing or invalid.
 * Optional files: skip if absent; fail only if present and invalid.
 *
 * Run from apps/wordlover-pwa/ (package.json build script) or from public/.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dir, "../public");

const REQUIRED = [
  "app.js", "sw.js", "automated-tests.js", "wordlover-config.js", "dictionary-config.js",
  "dictionary-registry.js", "dictionary-selection.js", "tracks.js",
  "online-dictionary-actions.js", "online-dictionary-provider.js", "youdao-provider.js", "youdao-entry-schema.js",
  "online-dictionary-lookup-controller.js", "online-dictionary-result-renderer.js", "online-dictionary-integration.js",
];
const OPTIONAL = ["wa-sqlite-opfs-worker.js"];

let failed = false;

for (const file of REQUIRED) {
  const abs = path.join(publicDir, file);
  if (!existsSync(abs)) {
    console.error(`FAIL: required file missing: ${file}`);
    failed = true;
    continue;
  }
  try {
    execSync(`node --check "${abs}"`, { stdio: "inherit" });
    console.log(`ok: ${file}`);
  } catch {
    failed = true;
  }
}

for (const file of OPTIONAL) {
  const abs = path.join(publicDir, file);
  if (!existsSync(abs)) {
    console.log(`skip: ${file} (optional, not present)`);
    continue;
  }
  try {
    execSync(`node --check "${abs}"`, { stdio: "inherit" });
    console.log(`ok: ${file} (optional)`);
  } catch {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
