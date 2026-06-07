#!/usr/bin/env python3
"""Generate a compact WordLover symbol map for AI code assistance.

Run from repo root:
    python scripts/generate_code_map.py

Check for staleness (exit 1 if stale):
    python scripts/generate_code_map.py --check

Discovery: all files tracked by git, filtered by suffix and exclusion rules.
New source files are picked up automatically; no manual list updates needed.
"""

from __future__ import annotations

import argparse
import ast
import datetime as dt
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SOURCE_SUFFIXES = {
    ".js", ".mjs", ".ts", ".tsx",
    ".py",
    ".html", ".htm",
    ".css",
    ".json", ".webmanifest",
    ".md",
    ".yml", ".yaml",
    ".ps1", ".sh",
}

# Binary / generated / asset suffixes — never include regardless of directory.
EXCLUDED_SUFFIXES = {
    ".sqlite", ".sqlite3", ".db",
    ".wasm", ".zst", ".zip", ".tar", ".gz",
    ".png", ".jpg", ".jpeg", ".ico", ".svg",
    ".cer", ".pem", ".key",
}

# Directory name fragments that mark a subtree to skip entirely.
EXCLUDED_DIRS = {
    ".git", "__pycache__",
    "node_modules", "vendor",
    "certs", "data",
    "dist", "build", ".vite", ".cache",
    "received-results", "test-results",
}

# Individual filenames to skip.
EXCLUDED_FILENAMES = {
    "dictionary-manifest.json",
    "AUTO_SYMBOL_MAP.md",   # the generated output itself
}

MAX_FILE_BYTES = 512 * 1024   # 512 KB

CSS_SELECTOR_LIMIT = 60       # cap CSS selectors to avoid noise

# ---------------------------------------------------------------------------
# Feature routing hints (human-maintained; kept brief)
# ---------------------------------------------------------------------------

FEATURE_HINTS = {
    "Dictionary search / install": [
        "app.js: loadDictionary, ensureDictionaryLoaded, lookupTerm, lookupChineseTerm, suggestTerms, findFuzzySuggestions",
        "sw.js: dictionary.sqlite and dictionary-manifest.json should bypass shell cache",
        "package_dictionary_web.py: packages dictionary assets for the PWA",
    ],
    "Vocabulary save/edit/archive": [
        "app.js: saveVocabularyItem, resultToVocabularyItem, renderVocabulary, renderVocabularyDetail",
        "index.html: vocabulary panel DOM shell",
    ],
    "Review / study scheduling": [
        "app.js: getDueVocabularyItems, scheduleFromFsrsRating, recordReviewRating, renderStudyStats",
        "study-one-more.js: Study One More word selection and UI",
        "review-state.js: review session state management",
        "automated-tests.js: review and quiz smoke coverage",
    ],
    "Goals / review forecast": [
        "app.js: renderGoalsPanel, renderForecastPanel, currentGoalForecast, openGoalsWizard, saveStudyGoals",
        "goal-forecast.js: pure FSRS review-workload forecast (forecastGoalWorkload, predictRating)",
        "fsrs-scheduler.js: getCardRetrievability, scheduleForecastReview (forecast-only helpers)",
    ],
    "Persistence": [
        "persistence.js: IndexedDB access layer (separated from app.js)",
    ],
    "Spelling": [
        "spelling.js: spelling review logic",
    ],
    "UI preferences": [
        "ui-preferences.js: theme, font-size, and other UI preferences",
    ],
    "Offline shell / update flow": [
        "sw.js: CACHE_NAME, SHELL_ASSETS, install/activate/fetch handlers",
        "app.js: APP_VERSION, SHELL_CACHE_VERSION, update UI handlers",
        "index.html: versioned asset URLs",
    ],
    "Google Drive sync / Gemini AI": [
        "app.js: Google auth, Gemini detail rendering",
        "sync.js: Drive snapshot sync implementation",
        "wordlover-config.js: local configuration placeholders",
    ],
    "Tests / validation": [
        "automated-tests.html/js: in-browser suite",
        "smoke-headless.py: cheap Playwright smoke test",
        "serve-https.py: iPhone HTTPS validation server",
    ],
}

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

JS_IMPORT_RE = re.compile(r"""^\s*import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]""")
JS_FUNCTION_RE = re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(")
JS_ARROW_RE = re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>")
JS_CLASS_RE = re.compile(r"^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b")
JS_CONST_RE = re.compile(r"^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=")
JS_EVENT_RE = re.compile(r"""addEventListener\(\s*['"]([^'"]+)['"]""")
QUERY_ID_RE = re.compile(r"""querySelector(?:All)?\(\s*['"]#([A-Za-z0-9_-]+)['"]\s*\)""")
HTML_ID_RE = re.compile(r"""\bid=['"]([^'"]+)['"]""")
HTML_SCRIPT_RE = re.compile(r"""<script[^>]+src=['"]([^'"]+)['"]""", re.IGNORECASE)
JSON_KEY_RE = re.compile(r'"([A-Za-z0-9_-]+)"\s*:')
PS_FUNCTION_RE = re.compile(r"^\s*function\s+([A-Za-z_][\w-]*)\b", re.IGNORECASE)
PS_PARAM_RE = re.compile(r"\[Parameter[^\]]*\]\s*(?:\[[^\]]+\]\s*)?\$([A-Za-z_][\w]*)", re.IGNORECASE)
SH_FUNCTION_RE = re.compile(r"^\s*(?:function\s+)?([A-Za-z_][\w]*)\s*\(\s*\)\s*\{")
CSS_SELECTOR_RE = re.compile(r"^([.#][A-Za-z][A-Za-z0-9_-]*)(?=[\s,{:[\s]|$)")
YAML_TOP_KEY_RE = re.compile(r"^([A-Za-z_][\w-]*):")
MD_HEADING_RE = re.compile(r"^(#{1,3})\s+(.+)")

_SH_KEYWORDS = {"if", "while", "for", "do", "case", "then", "else", "fi", "done"}

# ---------------------------------------------------------------------------
# Symbol dataclass
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Symbol:
    name: str
    line: int | None = None
    note: str = ""

    def render(self) -> str:
        parts = [f"- `{self.name}`"]
        if self.line:
            parts.append(f" (L{self.line})")
        if self.note:
            parts.append(f" — {self.note}")
        return "".join(parts)


def unique(items: list[Symbol]) -> list[Symbol]:
    seen: set[str] = set()
    out: list[Symbol] = []
    for item in items:
        if item.name in seen:
            continue
        seen.add(item.name)
        out.append(item)
    return out


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------


def parse_js(text: str) -> dict[str, list[Symbol]]:
    imports: list[Symbol] = []
    constants: list[Symbol] = []
    classes: list[Symbol] = []
    functions: list[Symbol] = []
    dom_ids: list[Symbol] = []
    events: list[Symbol] = []
    for ln, line in enumerate(text.splitlines(), 1):
        if m := JS_IMPORT_RE.search(line):
            imports.append(Symbol(m.group(1), ln))
        if m := JS_CONST_RE.search(line):
            constants.append(Symbol(m.group(1), ln))
        if m := JS_CLASS_RE.search(line):
            classes.append(Symbol(m.group(1), ln))
        if m := JS_FUNCTION_RE.search(line):
            functions.append(Symbol(m.group(1), ln))
        if m := JS_ARROW_RE.search(line):
            functions.append(Symbol(m.group(1), ln, "arrow"))
        for m in QUERY_ID_RE.finditer(line):
            dom_ids.append(Symbol(m.group(1), ln))
        for m in JS_EVENT_RE.finditer(line):
            events.append(Symbol(m.group(1), ln))
    return {
        "imports": unique(imports),
        "constants": unique(constants),
        "classes": unique(classes),
        "functions": unique(functions),
        "DOM ids referenced": unique(dom_ids),
        "events listened for": unique(events),
    }


def parse_python(path: Path, text: str) -> dict[str, list[Symbol]]:
    try:
        tree = ast.parse(text, filename=str(path))
    except SyntaxError:
        return {"parse errors": [Symbol("Python parse failed")]}
    constants: list[Symbol] = []
    classes: list[Symbol] = []
    functions: list[Symbol] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append(Symbol(node.name, node.lineno))
        elif isinstance(node, ast.ClassDef):
            classes.append(Symbol(node.name, node.lineno))
        elif isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id.isupper():
                    constants.append(Symbol(t.id, node.lineno))
    return {
        "constants": sorted(unique(constants), key=lambda x: x.line or 0),
        "classes": sorted(unique(classes), key=lambda x: x.line or 0),
        "functions": sorted(unique(functions), key=lambda x: x.line or 0),
    }


def parse_html(text: str) -> dict[str, list[Symbol]]:
    ids: list[Symbol] = []
    scripts: list[Symbol] = []
    for ln, line in enumerate(text.splitlines(), 1):
        for m in HTML_ID_RE.finditer(line):
            ids.append(Symbol(m.group(1), ln))
        for m in HTML_SCRIPT_RE.finditer(line):
            scripts.append(Symbol(m.group(1), ln))
    return {"DOM ids declared": unique(ids), "scripts loaded": unique(scripts)}


def parse_css(text: str) -> dict[str, list[Symbol]]:
    selectors: list[Symbol] = []
    seen: set[str] = set()
    for ln, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("//", "/*", "*")):
            continue
        for m in CSS_SELECTOR_RE.finditer(stripped):
            name = m.group(1)
            if name in seen:
                continue
            seen.add(name)
            selectors.append(Symbol(name, ln))
        if len(selectors) >= CSS_SELECTOR_LIMIT:
            selectors.append(Symbol(f"… ({len(seen)}+ selectors; truncated at {CSS_SELECTOR_LIMIT})"))
            return {"selectors": selectors}
    return {"selectors": selectors}


def parse_json_like(text: str) -> dict[str, list[Symbol]]:
    keys: list[Symbol] = []
    for ln, line in enumerate(text.splitlines(), 1):
        for m in JSON_KEY_RE.finditer(line):
            keys.append(Symbol(m.group(1), ln))
    return {"keys": unique(keys)}


def parse_powershell(text: str) -> dict[str, list[Symbol]]:
    functions: list[Symbol] = []
    parameters: list[Symbol] = []
    for ln, line in enumerate(text.splitlines(), 1):
        if m := PS_FUNCTION_RE.search(line):
            functions.append(Symbol(m.group(1), ln))
        for m in PS_PARAM_RE.finditer(line):
            parameters.append(Symbol(m.group(1), ln))
    return {"functions": unique(functions), "parameters": unique(parameters)}


def parse_shell(text: str) -> dict[str, list[Symbol]]:
    functions: list[Symbol] = []
    for ln, line in enumerate(text.splitlines(), 1):
        if m := SH_FUNCTION_RE.search(line):
            name = m.group(1)
            if name not in _SH_KEYWORDS:
                functions.append(Symbol(name, ln))
    return {"functions": unique(functions)}


def parse_yaml(text: str) -> dict[str, list[Symbol]]:
    keys: list[Symbol] = []
    for ln, line in enumerate(text.splitlines(), 1):
        if m := YAML_TOP_KEY_RE.match(line):
            keys.append(Symbol(m.group(1), ln))
    return {"top-level keys": unique(keys)}


def parse_markdown(text: str) -> dict[str, list[Symbol]]:
    headings: list[Symbol] = []
    for ln, line in enumerate(text.splitlines(), 1):
        if m := MD_HEADING_RE.match(line):
            headings.append(Symbol(m.group(2).strip(), ln, f"H{len(m.group(1))}"))
    return {"headings": headings}


def parse_file(path: Path) -> dict[str, list[Symbol]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    suffix = path.suffix.lower()
    if suffix in {".js", ".mjs", ".ts", ".tsx"}:
        return parse_js(text)
    if suffix == ".py":
        return parse_python(path, text)
    if suffix in {".html", ".htm"}:
        return parse_html(text)
    if suffix == ".css":
        return parse_css(text)
    if suffix in {".json", ".webmanifest"}:
        return parse_json_like(text)
    if suffix == ".ps1":
        return parse_powershell(text)
    if suffix == ".sh":
        return parse_shell(text)
    if suffix in {".yml", ".yaml"}:
        return parse_yaml(text)
    if suffix == ".md":
        return parse_markdown(text)
    return {}


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------


def _excluded(path: Path, root: Path) -> bool:
    if path.suffix.lower() in EXCLUDED_SUFFIXES:
        return True
    if path.name in EXCLUDED_FILENAMES:
        return True
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        parts = path.parts
    return any(part in EXCLUDED_DIRS for part in parts)


def discover_source_files(root: Path) -> tuple[list[Path], list[tuple[Path, int]]]:
    """Return (sorted included paths, sorted skipped-large entries)."""
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
        )
        candidates = [root / rel.strip() for rel in result.stdout.splitlines() if rel.strip()]
    except (OSError, subprocess.CalledProcessError):
        # Fall back to filesystem walk when git is unavailable.
        candidates = [p for p in root.rglob("*") if p.is_file()]

    included: list[Path] = []
    skipped: list[tuple[Path, int]] = []

    for path in candidates:
        if not path.exists() or not path.is_file():
            continue
        if path.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        if _excluded(path, root):
            continue
        size = path.stat().st_size
        if size > MAX_FILE_BYTES:
            skipped.append((path, size))
            continue
        included.append(path)

    included.sort(key=lambda p: p.relative_to(root).as_posix())
    skipped.sort(key=lambda t: t[0].relative_to(root).as_posix())
    return included, skipped


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

_DATESTAMP_PREFIX = "Generated by `scripts/generate_code_map.py` on "


def render_map(root: Path, files: list[Path], skipped: list[tuple[Path, int]]) -> str:
    generated_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = [
        "# WordLover Auto Symbol Map",
        "",
        f"{_DATESTAMP_PREFIX}{generated_at}.",
        "",
        "Purpose: give Codex a cheap first-pass map before it opens source files.",
        "",
        "Regenerate from repo root:",
        "",
        "```powershell",
        "python scripts\\generate_code_map.py",
        "```",
        "",
        "Check for staleness (exit 1 if stale):",
        "",
        "```powershell",
        "python scripts\\generate_code_map.py --check",
        "```",
        "",
        "## Feature routing hints",
        "",
    ]
    for feature, hints in FEATURE_HINTS.items():
        lines += [f"### {feature}", ""]
        lines += [f"- {h}" for h in hints]
        lines.append("")

    if skipped:
        lines += ["## Skipped large files", ""]
        lines.append("The following files exceeded the 512 KB size limit and were omitted:")
        lines.append("")
        for path, size in skipped:
            lines.append(f"- `{path.relative_to(root).as_posix()}` ({size // 1024} KB)")
        lines.append("")

    lines += ["## File symbols", ""]
    for path in files:
        rel = path.relative_to(root).as_posix()
        lines += [f"### `{rel}`", ""]
        sections = parse_file(path)
        has_content = any(syms for syms in sections.values())
        if not has_content:
            lines += ["- No symbols extracted by this parser.", ""]
            continue
        for section, syms in sections.items():
            if not syms:
                continue
            lines += [f"#### {section}", ""]
            lines += [s.render() for s in syms]
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


# ---------------------------------------------------------------------------
# Staleness check helper
# ---------------------------------------------------------------------------


def _normalize(content: str) -> str:
    """Strip the datestamp line so --check compares content, not timestamp."""
    return "\n".join(
        line for line in content.splitlines()
        if not line.startswith(_DATESTAMP_PREFIX)
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate or staleness-check AUTO_SYMBOL_MAP.md")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Regenerate in memory; exit 1 if docs/ai/AUTO_SYMBOL_MAP.md is stale.",
    )
    args = parser.parse_args()

    root = Path.cwd()
    files, skipped = discover_source_files(root)
    fresh = render_map(root, files, skipped)
    output = root / "docs/ai/AUTO_SYMBOL_MAP.md"

    if args.check:
        if not output.exists():
            print("ERROR: docs/ai/AUTO_SYMBOL_MAP.md is missing. Run the generator first.")
            return 1
        existing = output.read_text(encoding="utf-8")
        if _normalize(existing) != _normalize(fresh):
            print("STALE: docs/ai/AUTO_SYMBOL_MAP.md is out of date. Run:")
            print("  python scripts/generate_code_map.py")
            return 1
        print(f"OK: docs/ai/AUTO_SYMBOL_MAP.md is up to date ({len(files)} source files).")
        return 0

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(fresh, encoding="utf-8")
    print(f"Wrote {output.as_posix()} ({len(files)} source files).")
    if skipped:
        print(f"Skipped {len(skipped)} large file(s):")
        for path, size in skipped:
            print(f"  {path.relative_to(root).as_posix()} ({size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
