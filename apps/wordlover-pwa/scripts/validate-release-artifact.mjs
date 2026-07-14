#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const site = resolve(process.argv[2] || "public");
const args = Object.fromEntries(process.argv.slice(3).map((arg) => arg.split(/=(.*)/s).slice(0, 2)));
const read = (name) => readFileSync(join(site, name), "utf8");
const one = (text, re, label) => {
  const values = [...text.matchAll(re)].map((match) => match[1]);
  assert.equal(values.length, 1, `${label}: expected exactly one value, found ${values.length}`);
  return values[0];
};

let appText = read("app.js");
let swText = read("sw.js");
const appVersion = one(appText, /const APP_VERSION = "([^"]+)"/g, "app.js APP_VERSION");
const shellCache = one(swText, /const CACHE_NAME = "([^"]+)"/g, "sw.js CACHE_NAME");
const userDataFormatVersion = one(appText, /const USER_DATA_FORMAT_VERSION = "([^"]+)"/g, "app.js USER_DATA_FORMAT_VERSION");

if (args.commit) {
  assert.match(args.commit, /^[0-9a-f]{40}$/i, "commit must be a full SHA");
  assert.ok(args.buildId, "buildId is required when stamping");
  assert.ok(args.publishedAt && Number.isFinite(Date.parse(args.publishedAt)), "publishedAt must be ISO-8601");
  appText = appText.replace(/const BUILD_STAMP = "[^"]*";/, `const BUILD_STAMP = "${args.buildId}";`);
  swText = swText.replace(/const BUILD_STAMP = "[^"]*";/, `const BUILD_STAMP = "${args.buildId}";`);
  writeFileSync(join(site, "app.js"), appText);
  writeFileSync(join(site, "sw.js"), swText);
  writeFileSync(join(site, "release.json"), `${JSON.stringify({ schemaVersion: 1, appVersion, buildId: args.buildId, commit: args.commit, shellCache, userDataFormatVersion, publishedAt: args.publishedAt }, null, 2)}\n`);
}

const release = JSON.parse(read("release.json"));
assert.equal(release.schemaVersion, 1);
assert.equal(release.appVersion, appVersion);
assert.equal(release.buildId, one(read("app.js"), /const BUILD_STAMP = "([^"]+)"/g, "app.js BUILD_STAMP"));
assert.equal(release.buildId, one(read("sw.js"), /const BUILD_STAMP = "([^"]+)"/g, "sw.js BUILD_STAMP"));
assert.equal(release.shellCache, shellCache);
assert.equal(release.appVersion, one(read("sw.js"), /const APP_VERSION = "([^"]+)"/g, "sw.js APP_VERSION"));
assert.equal(release.userDataFormatVersion, userDataFormatVersion);
if (args.commit) assert.equal(release.commit, args.commit);

const requiredBody = one(swText, /const REQUIRED_SHELL_ASSETS = \[([\s\S]*?)\];/g, "REQUIRED_SHELL_ASSETS");
const assets = [...requiredBody.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
assert.ok(!assets.some((asset) => asset.split("?")[0] === "/release.json"), "release.json must be network-only, not precached");
for (const asset of assets) {
  const pathname = asset.split("?")[0];
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  assert.ok(existsSync(join(site, file)), `required shell asset missing: ${asset}`);
}
const versions = new Set();
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const versionedSources = walk(site).filter((path) => [".js", ".html"].some((suffix) => path.endsWith(suffix)));
for (const path of versionedSources) {
  const name = path.slice(site.length + 1);
  for (const match of read(name).matchAll(/\?v=([0-9]{8}-[0-9]+)/g)) versions.add(match[1]);
}
assert.equal(versions.size, 1, `shell asset versions disagree: ${[...versions].join(", ")}`);
const requiredPaths = new Set(assets.map((asset) => asset.split("?")[0]));
for (const path of versionedSources.filter((candidate) => requiredPaths.has(`/${candidate.slice(site.length + 1)}`))) {
  const source = readFileSync(path, "utf8");
  for (const match of source.matchAll(/(?:from\s*|import\s*\()?['"](\.\/?[^'"]+\.js)\?v=[^'"]+['"]/g)) {
    const imported = new URL(match[1], `https://fixture/${path.slice(site.length + 1)}`).pathname;
    assert.ok(requiredPaths.has(imported), `required executable asset omitted from service-worker shell: ${imported}`);
  }
}
const executableHandler = swText.slice(swText.indexOf("async function handleScriptOrStyle"), swText.indexOf("async function handleStaticAsset"));
assert.ok(!executableHandler.includes("ignoreSearch"), "executable asset fallback must not ignore query strings");
console.log(JSON.stringify({ appVersion, buildId: release.buildId, commit: release.commit, shellCache, assetVersion: [...versions][0], requiredAssets: assets.length }));
