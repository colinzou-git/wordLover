import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const roots = [resolve("../wordlover-pwa/public"), resolve("src"), resolve("../../docs")];
const failures = [];
function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) walk(target);
    else {
      const source = readFileSync(target, "utf8");
      if (/YOUDAO_APP_(?:KEY|SECRET)\s*[=:]\s*["'][^"']{4,}["']/.test(source)) failures.push(target);
    }
  }
}
roots.forEach(walk);
if (failures.length) {
  console.error(`Possible committed Youdao credentials: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("No committed Youdao credential literals found.");
