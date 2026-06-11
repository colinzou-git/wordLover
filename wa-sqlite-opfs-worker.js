import SQLiteAsyncESMFactory from "./vendor/wa-sqlite/dist/wa-sqlite-async.mjs";
import * as SQLite from "./vendor/wa-sqlite/src/sqlite-api.js";
import { OriginPrivateFileSystemVFS } from "./vendor/wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js";

let sqlite3 = null;
let vfs = null;
let db = null;

function escapeSql(value) {
  return String(value ?? "").replace(/'/g, "''");
}

async function openDictionary() {
  if (db) return;
  const module = await SQLiteAsyncESMFactory({
    locateFile: (file) => `./vendor/wa-sqlite/dist/${file}`,
  });
  sqlite3 = SQLite.Factory(module);
  vfs = new OriginPrivateFileSystemVFS();
  sqlite3.vfs_register(vfs, false);
  db = await sqlite3.open_v2("/dictionary.sqlite?immutable=1", 1, vfs.name);
}

async function lookup(term) {
  await openDictionary();
  const rows = [];
  const normalized = escapeSql(term.trim().replace(/\s+/g, " ").toLowerCase());
  const startedAt = performance.now();
  await sqlite3.exec(
    db,
    `
      SELECT word, phonetic, definition, definition_source, translation, tag
      FROM dictionary_entries
      WHERE normalized_word = '${normalized}'
      ORDER BY frq IS NULL, frq, bnc IS NULL, bnc, word
      LIMIT 1
    `,
    (row, columns) => {
      rows.push(Object.fromEntries(columns.map((column, index) => [column, row[index]])));
    },
  );
  return {
    status: rows.length ? "found" : "not_found",
    row: rows[0] ?? null,
    queryMs: performance.now() - startedAt,
  };
}

self.addEventListener("message", (event) => {
  const id = event.data?.id;
  const type = event.data?.type;
  (async () => {
    if (type === "open") {
      await openDictionary();
      return { status: "opened" };
    }
    if (type === "lookup") {
      return lookup(event.data.term ?? "");
    }
    throw new Error(`Unknown wa-sqlite worker command: ${type}`);
  })()
    .then((result) => self.postMessage({ id, ok: true, result }))
    .catch((error) => self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) }));
});
