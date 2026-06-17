#!/usr/bin/env python3
"""Apply the WordFan full-dictionary runtime integration to the current shell.

This is intentionally strict and idempotent: every expected source anchor must
exist exactly once, otherwise the script stops instead of silently corrupting a
large generated/app file.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/wordlover-pwa/public"
OLD_ASSET = "20260615-1"
NEW_ASSET = "20260615-2"
OLD_CACHE = "wordlover-shell-v130"
NEW_CACHE = "wordlover-shell-v131"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, value: str) -> None:
    path.write_text(value, encoding="utf-8")


def replace_once(value: str, old: str, new: str, *, label: str) -> str:
    count = value.count(old)
    if count == 0 and new in value:
        return value
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return value.replace(old, new, 1)


def append_once(value: str, marker: str, addition: str) -> str:
    if marker in value:
        return value
    return value.rstrip() + "\n\n" + addition.strip() + "\n"


def patch_app() -> None:
    path = PUBLIC / "app.js"
    value = read(path).replace(f"?v={OLD_ASSET}", f"?v={NEW_ASSET}")

    value = replace_once(
        value,
        f'}} from "./tracks.js?v={NEW_ASSET}";\n\nconst loadButton',
        f'}} from "./tracks.js?v={NEW_ASSET}";\n\nimport {{\n  createFullDictionaryClient,\n}} from "./full-dictionary.js?v={NEW_ASSET}";\n\nconst loadButton',
        label="full dictionary import",
    )
    value = replace_once(
        value,
        'const speakOnReturnToggle = document.querySelector("#speakOnReturnToggle");\n',
        'const speakOnReturnToggle = document.querySelector("#speakOnReturnToggle");\n'
        'const fullDictionaryStatus = document.querySelector("#fullDictionaryStatus");\n'
        'const fullDictionaryProgress = document.querySelector("#fullDictionaryProgress");\n'
        'const fullDictionaryInstallButton = document.querySelector("#fullDictionaryInstall");\n'
        'const fullDictionaryRemoveButton = document.querySelector("#fullDictionaryRemove");\n',
        label="full dictionary DOM references",
    )
    value = replace_once(
        value,
        'const APP_VERSION = "0.6.2-product.20260615-1-v130";',
        'const APP_VERSION = "0.6.2-product.20260615-2-v131";',
        label="app version",
    )
    value = replace_once(
        value,
        f'const SHELL_CACHE_VERSION = "{OLD_CACHE}";',
        f'const SHELL_CACHE_VERSION = "{NEW_CACHE}";',
        label="shell cache version",
    )
    value = replace_once(
        value,
        'const DICTIONARY_ENGINE = "Slim 100k-entry dictionary in OPFS; sql.js read engine; wa-sqlite OPFS engine pending bundle install";\n'
        'const MEMORY_TARGET_NOTE =\n'
        '  "Memory target: iPhone normal-use DRAM <= 50 MB. This build ships the slim 100k-entry dictionary (~32 MB) so sql.js can hold it in memory; the wa-sqlite OPFS engine remains the production gate for a fuller dictionary.";\n'
        'const CONFIG = window.WORDLOVER_CONFIG ?? {};',
        'const DICTIONARY_ENGINE = "100k ranked core + 770k sharded exact lookup; gzip shards cached on demand or for complete offline use";\n'
        'const MEMORY_TARGET_NOTE =\n'
        '  "The ranked 100k core remains in sql.js for suggestions and study selection. Exact English lookup can reach all 770k entries by opening one small gzip shard, avoiding a 270 MB in-memory SQLite database.";\n'
        'const CONFIG = window.WORDLOVER_CONFIG ?? {};\n'
        'const fullDictionary = createFullDictionaryClient({\n'
        '  baseUrl: "/dictionary-full",\n'
        '  onStateChange: (state) => renderFullDictionarySettings(state),\n'
        '});',
        label="dictionary engine constants",
    )

    helper_block = r'''
function renderFullDictionarySettings(state = fullDictionary.status()) {
  if (!fullDictionaryStatus) return;
  const count = Number(state.rowCount ?? 0).toLocaleString();
  const size = state.totalBytes ? formatBytes(state.totalBytes) : "";
  if (state.busy && state.progress) {
    fullDictionaryStatus.textContent = `Downloading full dictionary: ${state.progress.completed} / ${state.progress.total} shards (${state.progress.percent}%).`;
  } else if (state.offlineInstalled) {
    fullDictionaryStatus.textContent = `${count} entries are available offline (${size} compressed).`;
  } else if (state.available) {
    fullDictionaryStatus.textContent = `${count} entries are available online. Looked-up shards cache automatically; download ${size} for complete offline lookup.`;
  } else if (state.lastError) {
    fullDictionaryStatus.textContent = `Full dictionary package unavailable: ${state.lastError}`;
  } else {
    fullDictionaryStatus.textContent = "Checking full dictionary package…";
  }
  if (fullDictionaryProgress) {
    fullDictionaryProgress.hidden = !state.busy;
    fullDictionaryProgress.value = Number(state.progress?.percent ?? 0);
  }
  if (fullDictionaryInstallButton) {
    fullDictionaryInstallButton.hidden = !state.available || state.offlineInstalled;
    fullDictionaryInstallButton.disabled = Boolean(state.busy);
  }
  if (fullDictionaryRemoveButton) {
    fullDictionaryRemoveButton.hidden = !state.offlineInstalled;
    fullDictionaryRemoveButton.disabled = Boolean(state.busy);
  }
}

async function refreshFullDictionaryStatus(force = false) {
  await fullDictionary.ensureManifest({ force });
  renderFullDictionarySettings();
  return fullDictionary.status();
}

async function installFullDictionaryOffline() {
  if (fullDictionaryInstallButton) fullDictionaryInstallButton.disabled = true;
  try {
    const state = await fullDictionary.installAll({
      onProgress: (progress) => renderFullDictionarySettings({ ...fullDictionary.status(), busy: true, progress }),
    });
    renderFullDictionarySettings(state);
    if (updateStatus) updateStatus.textContent = "Full dictionary downloaded for offline use.";
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (fullDictionaryStatus) fullDictionaryStatus.textContent = `Full dictionary download failed: ${message}`;
    return fullDictionary.status();
  } finally {
    renderFullDictionarySettings();
  }
}

async function removeFullDictionaryOffline() {
  try {
    const state = await fullDictionary.removeOfflineCopy();
    renderFullDictionarySettings(state);
    if (updateStatus) updateStatus.textContent = "Full dictionary offline copy removed. Online lookup remains available.";
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (fullDictionaryStatus) fullDictionaryStatus.textContent = `Could not remove the offline copy: ${message}`;
    return fullDictionary.status();
  }
}

fullDictionaryInstallButton?.addEventListener("click", () => { void installFullDictionaryOffline(); });
fullDictionaryRemoveButton?.addEventListener("click", () => { void removeFullDictionaryOffline(); });
'''
    value = replace_once(
        value,
        "function renderAppMenu() {",
        helper_block + "\nfunction renderAppMenu() {",
        label="full dictionary settings helpers",
    )
    value = replace_once(
        value,
        "  memoryNote.textContent = MEMORY_TARGET_NOTE;\n",
        "  memoryNote.textContent = MEMORY_TARGET_NOTE;\n  renderFullDictionarySettings();\n",
        label="settings render hook",
    )
    value = replace_once(
        value,
        '      <p class="result-entry-type">${escapeHtml(data.entryType)}</p>\n',
        '      <p class="result-entry-type">${escapeHtml(data.entryType)}</p>\n'
        '      ${data.dictionaryCoverage === "full" ? `<p class="small muted">Full 770,770-entry dictionary</p>` : ""}\n',
        label="full result badge",
    )
    value = replace_once(
        value,
        "    renderMetrics();\n    return true;",
        "    renderMetrics();\n    void refreshFullDictionaryStatus();\n    return true;",
        label="manifest refresh after core load",
    )

    fallback = r'''
async function lookupTermWithFullFallback(input) {
  const primary = lookupTerm(input);
  if (primary.status !== "not_found" || isChineseInput(input)) return primary;
  const full = await fullDictionary.lookup(input);
  if (full?.status === "found") return full;
  if (full?.status === "unavailable") primary.fullDictionaryUnavailable = full.reason;
  return primary;
}

'''
    value = replace_once(
        value,
        "\nfunction parseExchangeForms(exchange) {",
        "\n" + fallback + "function parseExchangeForms(exchange) {",
        label="full dictionary lookup fallback",
    )
    value = replace_once(
        value,
        "  try {\n    const data = lookupTerm(value);\n    renderResult(data);\n    if (commit && data.status === \"found\") {",
        "  try {\n    const data = await lookupTermWithFullFallback(value);\n    renderResult(data);\n    if (commit && data.status === \"found\") {",
        label="async search fallback",
    )

    old_loaded = '''function runLoadedLookupForReturn() {
  const value = termInput.value;
  try {
    const data = lookupTerm(value);
    renderResult(data);
    if (data.status === "found") {
      const at = nowIso();
      void addHistory({ term: data.term, searchedAt: at, queriedAt: at, queryMs: data.queryMs ?? 0 });
    }
    return data;
  } catch (error) {
    result.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    return null;
  }
}
'''
    new_loaded = '''async function runLoadedLookupForReturn() {
  const value = termInput.value;
  try {
    const data = await lookupTermWithFullFallback(value);
    renderResult(data);
    if (data.status === "found") {
      const at = nowIso();
      void addHistory({ term: data.term, searchedAt: at, queriedAt: at, queryMs: data.queryMs ?? 0 });
    }
    return data;
  } catch (error) {
    result.innerHTML = `<p class="error">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    return null;
  }
}
'''
    value = replace_once(value, old_loaded, new_loaded, label="return-key async lookup")
    value = replace_once(
        value,
        "    data = runLoadedLookupForReturn();",
        "    data = await runLoadedLookupForReturn();",
        label="await return-key lookup",
    )
    value = replace_once(
        value,
        "  lookupTerm,\n  suggestTerms,",
        "  lookupTerm,\n  lookupTermWithFullFallback,\n  suggestTerms,",
        label="public fallback API",
    )
    value = replace_once(
        value,
        "  lookupChineseTerm,\n  saveVocabularyItem,",
        "  lookupChineseTerm,\n  fullDictionary: {\n"
        "    status: () => fullDictionary.status(),\n"
        "    refresh: (force = false) => refreshFullDictionaryStatus(force),\n"
        "    lookup: (term) => fullDictionary.lookup(term),\n"
        "    install: () => installFullDictionaryOffline(),\n"
        "    remove: () => removeFullDictionaryOffline(),\n"
        "  },\n"
        "  saveVocabularyItem,",
        label="public full dictionary controls",
    )
    write(path, value)


def patch_index() -> None:
    path = PUBLIC / "index.html"
    value = read(path).replace(f"?v={OLD_ASSET}", f"?v={NEW_ASSET}")
    card = '''
            <section class="settings-card">
              <h3><span class="settings-card-icon" aria-hidden="true">▤</span>Full dictionary</h3>
              <p id="fullDictionaryStatus" class="small" aria-live="polite">Checking full dictionary package…</p>
              <progress id="fullDictionaryProgress" class="full-dictionary-progress" max="100" value="0" hidden></progress>
              <div class="menu-actions">
                <button id="fullDictionaryInstall" type="button" hidden>Download for offline use</button>
                <button id="fullDictionaryRemove" class="secondary-button" type="button" hidden>Remove offline copy</button>
              </div>
              <p class="small muted">Online exact lookup downloads only one small shard. The optional download stores all 770,770 entries for offline use.</p>
            </section>
'''
    anchor = '''            <section class="settings-card">
              <h3><span class="settings-card-icon" aria-hidden="true">⚙</span>Diagnostics & updates</h3>'''
    value = replace_once(value, anchor, card + anchor, label="full dictionary settings card")
    write(path, value)


def patch_styles() -> None:
    path = PUBLIC / "styles.css"
    value = append_once(
        read(path),
        ".full-dictionary-progress",
        '''
.full-dictionary-progress {
  display: block;
  width: 100%;
  height: 0.7rem;
  margin: 0.6rem 0;
}

.full-dictionary-progress[hidden] {
  display: none;
}
''',
    )
    write(path, value)


def patch_service_worker() -> None:
    path = PUBLIC / "sw.js"
    value = read(path).replace(OLD_CACHE, NEW_CACHE).replace(f"?v={OLD_ASSET}", f"?v={NEW_ASSET}")
    value = replace_once(
        value,
        f'  "/app.js?v={NEW_ASSET}",\n',
        f'  "/app.js?v={NEW_ASSET}",\n  "/full-dictionary.js?v={NEW_ASSET}",\n',
        label="full dictionary shell asset",
    )
    value = replace_once(
        value,
        '  if (url.pathname.endsWith("dictionary-manifest.json")) return;\n',
        '  if (url.pathname.endsWith("dictionary-manifest.json")) return;\n'
        '  // Full dictionary shards are integrity-checked and versioned by the app.\n'
        '  if (url.pathname.includes("/dictionary-full/")) return;\n',
        label="full dictionary service-worker bypass",
    )
    write(path, value)


def patch_test_shell_versions() -> None:
    for name in ("automated-tests.js", "automated-tests.html"):
        path = PUBLIC / name
        value = read(path).replace(OLD_CACHE, NEW_CACHE).replace(f"?v={OLD_ASSET}", f"?v={NEW_ASSET}")
        if name == "automated-tests.js":
            value = replace_once(
                value,
                f'  "/app.js?v={NEW_ASSET}",\n',
                f'  "/app.js?v={NEW_ASSET}",\n  "/full-dictionary.js?v={NEW_ASSET}",\n',
                label="automated test shell asset",
            )
        write(path, value)


def patch_ci_fixture() -> None:
    path = ROOT / "apps/wordlover-pwa/scripts/create-ci-dictionary.py"
    value = read(path)
    value = replace_once(
        value,
        "from scripts.package_dictionary_web import compress_zstd, sha256_file  # noqa: E402\n",
        "from scripts.package_dictionary_web import compress_zstd, sha256_file  # noqa: E402\n"
        "from scripts.package_dictionary_shards import package as package_full_dictionary_shards  # noqa: E402\n",
        label="CI full shard import",
    )
    constant = '''
FULL_ONLY_ROW = {
    "word": "fullsizeonlyword",
    "phonetic": "/fʊl/",
    "definition": "a term present only in the full dictionary fixture",
    "definition_source": "CI full fixture",
    "translation": "仅存在于完整词典中的词",
    "pos": "n",
    "tag": "rare",
    "exchange": "s:fullsizeonlywords",
    "detail": "This entry verifies the supplemental full dictionary fallback.",
    "source": "CI full fixture",
}

'''
    value = replace_once(value, "\ndef parse_args() -> argparse.Namespace:\n", "\n" + constant + "def parse_args() -> argparse.Namespace:\n", label="CI full fixture row")
    helper = '''
def build_full_fixture_sqlite(source: Path, target: Path) -> None:
    shutil.copy2(source, target)
    placeholders = ",".join("?" for _ in COLUMNS)
    with sqlite3.connect(target) as conn:
        next_id = int(conn.execute("SELECT COALESCE(max(id), 0) + 1 FROM dictionary_entries").fetchone()[0])
        conn.execute(
            f"INSERT INTO dictionary_entries ({','.join(COLUMNS)}) VALUES ({placeholders})",
            row_values(next_id, FULL_ONLY_ROW),
        )
        conn.commit()


'''
    value = replace_once(value, "\ndef write_manifest(", "\n" + helper + "def write_manifest(", label="CI full fixture builder")
    value = replace_once(
        value,
        "    row_count = build_fixture_sqlite(work_sqlite, args.version)\n\n    sqlite_path = args.output_dir / \"dictionary.sqlite\"",
        "    row_count = build_fixture_sqlite(work_sqlite, args.version)\n"
        "    full_work_sqlite = args.work_dir / \"dictionary-full-ci-fixture.sqlite\"\n"
        "    build_full_fixture_sqlite(work_sqlite, full_work_sqlite)\n"
        "    package_full_dictionary_shards(argparse.Namespace(\n"
        "        input=full_work_sqlite,\n"
        "        output_dir=args.output_dir / \"dictionary-full\",\n"
        "        version=f\"{args.version}.full\",\n"
        "        shard_count=4,\n"
        "        gzip_level=9,\n"
        "        skip_validation=False,\n"
        "    ))\n\n"
        "    sqlite_path = args.output_dir / \"dictionary.sqlite\"",
        label="CI full package generation",
    )
    write(path, value)


def patch_ci_workflow() -> None:
    path = ROOT / ".github/workflows/ci.yml"
    value = read(path)
    value = replace_once(
        value,
        "      - name: Verify cache-version lockstep\n        run: python apps/wordlover-pwa/scripts/check_versions.py\n",
        "      - name: Verify cache-version lockstep\n        run: python apps/wordlover-pwa/scripts/check_versions.py\n\n"
        "      - name: Test full dictionary package and client\n"
        "        run: |\n"
        "          python -m unittest scripts.tests.test_package_dictionary_shards\n"
        "          node apps/wordlover-pwa/scripts/test-full-dictionary.mjs\n",
        label="static full dictionary tests",
    )
    value = replace_once(
        value,
        "      - name: Run browser automated suite\n        run: >\n          python apps/wordlover-pwa/scripts/run-browser-tests.py\n          --base http://127.0.0.1:4173\n          --report apps/wordlover-pwa/test-results/browser-report.json\n",
        "      - name: Run browser automated suite\n        run: >\n          python apps/wordlover-pwa/scripts/run-browser-tests.py\n          --base http://127.0.0.1:4173\n          --report apps/wordlover-pwa/test-results/browser-report.json\n\n"
        "      - name: Run full dictionary browser smoke\n"
        "        run: >\n"
        "          python apps/wordlover-pwa/scripts/smoke-full-dictionary.py\n"
        "          --base http://127.0.0.1:4173\n"
        "          --report apps/wordlover-pwa/test-results/full-dictionary-report.json\n",
        label="full dictionary browser smoke",
    )
    value = replace_once(
        value,
        "          git show origin/gh-pages:dictionary.sqlite.zst > \"$SITE/dictionary.sqlite.zst\"\n\n          # GitHub Pages config.",
        "          git show origin/gh-pages:dictionary.sqlite.zst > \"$SITE/dictionary.sqlite.zst\"\n"
        "          # Preserve the separately-published sharded full dictionary across shell-only deploys.\n"
        "          if git ls-tree -d --name-only origin/gh-pages dictionary-full | grep -q '^dictionary-full$'; then\n"
        "            git archive origin/gh-pages dictionary-full | tar -x -C \"$SITE\"\n"
        "          fi\n\n"
        "          # GitHub Pages config.",
        label="preserve published full shards",
    )
    value = replace_once(
        value,
        "    # PR #5 run 106 proved the clean build. Future full bundles are manual jobs.\n    if: github.event_name == 'workflow_dispatch'\n    runs-on: ubuntu-latest\n    timeout-minutes: 120\n",
        "    # Build on this implementation PR, its merge commit, or a manual refresh.\n"
        "    if: >-\n"
        "      github.event_name == 'workflow_dispatch' ||\n"
        "      (github.event_name == 'pull_request' && github.head_ref == 'feat/full-dictionary-runtime') ||\n"
        "      (github.event_name == 'push' && github.ref == 'refs/heads/main' && contains(github.event.head_commit.message, 'full 770k dictionary runtime'))\n"
        "    runs-on: ubuntu-latest\n"
        "    timeout-minutes: 120\n",
        label="full build trigger",
    )
    value = replace_once(
        value,
        "          sqlite3 data/dictionary.sqlite \"PRAGMA quick_check; SELECT count(*) FROM dictionary_entries;\" \\\n            > full-dictionary/validation.txt\n",
        "          sqlite3 data/dictionary.sqlite \"PRAGMA quick_check; SELECT count(*) FROM dictionary_entries;\" \\\n"
        "            > full-dictionary/validation.txt\n"
        "          python scripts/package_dictionary_shards.py \\\n"
        "            --input data/dictionary.sqlite \\\n"
        "            --output-dir full-dictionary-web \\\n"
        "            --version \"$VERSION.sharded\" \\\n"
        "            --shard-count 128 \\\n"
        "            --gzip-level 9\n",
        label="full shard packaging",
    )
    value = replace_once(
        value,
        "          if-no-files-found: error\n",
        "          if-no-files-found: error\n\n"
        "      - name: Upload deployable sharded dictionary\n"
        "        uses: actions/upload-artifact@v4\n"
        "        with:\n"
        "          name: wordfan-full-dictionary-web-${{ github.run_number }}\n"
        "          path: full-dictionary-web/\n"
        "          compression-level: 0\n"
        "          retention-days: 30\n"
        "          if-no-files-found: error\n",
        label="web shard artifact upload",
    )
    publish_job = '''

  publish-full-dictionary:
    name: Publish sharded full dictionary to GitHub Pages
    needs: [full-dictionary-artifact, deploy]
    if: >-
      always() &&
      needs.full-dictionary-artifact.result == 'success' &&
      needs.deploy.result == 'success' &&
      github.ref == 'refs/heads/main' &&
      (github.event_name == 'push' || github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    permissions:
      contents: write
    concurrency:
      group: deploy-gh-pages
      cancel-in-progress: false
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: wordfan-full-dictionary-web-${{ github.run_number }}
          path: dictionary-full

      - name: Overlay full dictionary onto published site
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          set -euo pipefail
          SITE="$RUNNER_TEMP/site"
          git clone --depth=1 --branch gh-pages \
            "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "$SITE"
          rm -rf "$SITE/dictionary-full"
          cp -a dictionary-full "$SITE/dictionary-full"
          cd "$SITE"
          git add dictionary-full
          git -c user.name='github-actions[bot]' \
              -c user.email='41898282+github-actions[bot]@users.noreply.github.com' \
              commit -m "Publish full dictionary from ${GITHUB_SHA:0:7}"
          git push origin gh-pages
'''
    value = append_once(value, "publish-full-dictionary:", publish_job)
    write(path, value)


def patch_gitignore() -> None:
    path = ROOT / ".gitignore"
    value = append_once(read(path), "apps/wordlover-pwa/public/dictionary-full/", "apps/wordlover-pwa/public/dictionary-full/")
    write(path, value)


def patch_docs() -> None:
    path = ROOT / "CLAUDE.md"
    value = read(path)
    value = replace_once(
        value,
        "Current production path: `sql.js` loads the 32 MB slim SQLite file into WASM memory. The `wa-sqlite` + OPFS engine is vendored at `public/vendor/wa-sqlite/` and tested via a smoke worker (`public/wa-sqlite-opfs-worker.js`) but is not yet the default — it's the production target when iPhone memory validation runs. Route all dictionary access through the abstraction in `app.js` (not directly to `sql.js`) to keep the engine swappable.",
        "Current production path is hybrid: `sql.js` keeps the 32 MB / 100k ranked core for prefix/fuzzy suggestions, Chinese reverse lookup, and Study One More. Exact English lookup falls through to the complete 770k dataset in deterministic gzip JSON shards under `dictionary-full/`; one small shard is opened per lookup and cached on demand, while Settings can download every shard for complete offline use. Rebuild those assets with `scripts/package_dictionary_shards.py`. The vendored `wa-sqlite` worker remains experimental and is not required by the production full-dictionary path.",
        label="CLAUDE dictionary architecture",
    )
    write(path, value)


def main() -> int:
    patch_app()
    patch_index()
    patch_styles()
    patch_service_worker()
    patch_test_shell_versions()
    patch_ci_fixture()
    patch_ci_workflow()
    patch_gitignore()
    patch_docs()
    print("Applied full dictionary runtime integration.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
