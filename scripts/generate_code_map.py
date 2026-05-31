#!/usr/bin/env python3
"""Generate a compact WordLover symbol map for Codex.

Run from repo root:
    python scripts/generate_code_map.py

Output:
    docs/ai/AUTO_SYMBOL_MAP.md

The generator intentionally scans only a curated WordLover file list so it stays
small, deterministic, and token-saving.
"""

from __future__ import annotations

import ast
import datetime as dt
import re
from dataclasses import dataclass
from pathlib import Path

SOURCE_PATHS = [
    "apps/wordlover-pwa/public/app.js",
    "apps/wordlover-pwa/public/sw.js",
    "apps/wordlover-pwa/public/automated-tests.js",
    "apps/wordlover-pwa/public/index.html",
    "apps/wordlover-pwa/public/automated-tests.html",
    "apps/wordlover-pwa/public/manifest.webmanifest",
    "apps/wordlover-pwa/public/wordlover-config.js",
    "scripts/build_dictionary.py",
    "scripts/build_slim_dictionary.py",
    "scripts/package_dictionary_web.py",
    "scripts/lookup_word.py",
    "apps/wordlover-pwa/scripts/smoke-headless.py",
    "apps/wordlover-pwa/scripts/smoke-offline-dictionary.py",
    "apps/wordlover-pwa/scripts/smoke-sync.py",
    "apps/wordlover-pwa/scripts/smoke-ai-chat.py",
    "apps/wordlover-pwa/scripts/smoke-update-flow.py",
    "apps/wordlover-pwa/scripts/serve-https.py",
]

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
        "automated-tests.js: review and quiz smoke coverage",
    ],
    "Offline shell / update flow": [
        "sw.js: CACHE_NAME, SHELL_ASSETS, install/activate/fetch handlers",
        "app.js: APP_VERSION, SHELL_CACHE_VERSION, update UI handlers",
        "index.html: versioned asset URLs",
    ],
    "Google Drive sync / Gemini AI": [
        "app.js: Google auth, Drive snapshot sync, Gemini detail rendering",
        "wordlover-config.js: local configuration placeholders",
    ],
    "Tests / validation": [
        "automated-tests.html/js: in-browser suite",
        "smoke-headless.py: cheap Playwright smoke test",
        "serve-https.py: iPhone HTTPS validation server",
    ],
}

JS_FUNCTION_RE = re.compile(r"^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(")
JS_ARROW_RE = re.compile(r"^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>")
JS_CLASS_RE = re.compile(r"^\s*class\s+([A-Za-z_$][\w$]*)\b")
JS_CONST_RE = re.compile(r"^\s*const\s+([A-Z][A-Z0-9_]*)\s*=")
JS_EVENT_RE = re.compile(r"addEventListener\(\s*['\"]([^'\"]+)['\"]")
QUERY_ID_RE = re.compile(r"querySelector(?:All)?\(\s*['\"]#([A-Za-z0-9_-]+)['\"]\s*\)")
HTML_ID_RE = re.compile(r"\bid=['\"]([^'\"]+)['\"]")
HTML_SCRIPT_RE = re.compile(r"<script[^>]+src=['\"]([^'\"]+)['\"]", re.IGNORECASE)
JSON_KEY_RE = re.compile(r'"([A-Za-z0-9_-]+)"\s*:')


@dataclass(frozen=True)
class Symbol:
    name: str
    line: int | None = None
    note: str = ""

    def render(self) -> str:
        where = f"L{self.line}" if self.line else ""
        note = f" — {self.note}" if self.note else ""
        return f"- `{self.name}`" + (f" ({where})" if where else "") + note


def unique(items: list[Symbol]) -> list[Symbol]:
    seen: set[str] = set()
    out: list[Symbol] = []
    for item in items:
        if item.name in seen:
            continue
        seen.add(item.name)
        out.append(item)
    return out


def parse_js(text: str) -> dict[str, list[Symbol]]:
    constants: list[Symbol] = []
    classes: list[Symbol] = []
    functions: list[Symbol] = []
    dom_ids: list[Symbol] = []
    events: list[Symbol] = []
    for line_no, line in enumerate(text.splitlines(), 1):
        if m := JS_CONST_RE.search(line):
            constants.append(Symbol(m.group(1), line_no))
        if m := JS_CLASS_RE.search(line):
            classes.append(Symbol(m.group(1), line_no))
        if m := JS_FUNCTION_RE.search(line):
            functions.append(Symbol(m.group(1), line_no))
        if m := JS_ARROW_RE.search(line):
            functions.append(Symbol(m.group(1), line_no, "arrow function"))
        for m in QUERY_ID_RE.finditer(line):
            dom_ids.append(Symbol(m.group(1), line_no))
        for m in JS_EVENT_RE.finditer(line):
            events.append(Symbol(m.group(1), line_no))
    return {
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
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id.isupper():
                    constants.append(Symbol(target.id, node.lineno))
    return {
        "constants": sorted(unique(constants), key=lambda x: x.line or 0),
        "classes": sorted(unique(classes), key=lambda x: x.line or 0),
        "functions": sorted(unique(functions), key=lambda x: x.line or 0),
    }


def parse_html(text: str) -> dict[str, list[Symbol]]:
    ids: list[Symbol] = []
    scripts: list[Symbol] = []
    for line_no, line in enumerate(text.splitlines(), 1):
        for m in HTML_ID_RE.finditer(line):
            ids.append(Symbol(m.group(1), line_no))
        for m in HTML_SCRIPT_RE.finditer(line):
            scripts.append(Symbol(m.group(1), line_no))
    return {"DOM ids declared": unique(ids), "scripts loaded": unique(scripts)}


def parse_json_like(text: str) -> dict[str, list[Symbol]]:
    keys: list[Symbol] = []
    for line_no, line in enumerate(text.splitlines(), 1):
        for m in JSON_KEY_RE.finditer(line):
            keys.append(Symbol(m.group(1), line_no))
    return {"keys": unique(keys)}


def parse_file(path: Path) -> dict[str, list[Symbol]]:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    if path.suffix == ".js":
        return parse_js(text)
    if path.suffix == ".py":
        return parse_python(path, text)
    if path.suffix in {".html", ".htm"}:
        return parse_html(text)
    if path.suffix in {".json", ".webmanifest"}:
        return parse_json_like(text)
    return {}


def render_map(root: Path, files: list[Path]) -> str:
    generated_at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# WordLover Auto Symbol Map",
        "",
        f"Generated by `scripts/generate_code_map.py` on {generated_at}.",
        "",
        "Purpose: give Codex a cheap first-pass map before it opens source files.",
        "",
        "Regenerate from repo root:",
        "",
        "```powershell",
        "python scripts\\generate_code_map.py",
        "```",
        "",
        "## Feature routing hints",
        "",
    ]
    for feature, hints in FEATURE_HINTS.items():
        lines.append(f"### {feature}")
        lines.append("")
        lines.extend(f"- {hint}" for hint in hints)
        lines.append("")

    lines.append("## File symbols")
    lines.append("")
    for path in files:
        rel = path.relative_to(root).as_posix()
        lines.append(f"### `{rel}`")
        lines.append("")
        sections = parse_file(path)
        if not sections:
            lines.append("- No symbols extracted by this parser.")
            lines.append("")
            continue
        for section, symbols in sections.items():
            if not symbols:
                continue
            lines.append(f"#### {section}")
            lines.append("")
            lines.extend(sym.render() for sym in symbols)
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    root = Path.cwd()
    files = [root / rel for rel in SOURCE_PATHS if (root / rel).exists()]
    output = root / "docs/ai/AUTO_SYMBOL_MAP.md"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render_map(root, files), encoding="utf-8")
    print(f"Wrote {output.as_posix()} from {len(files)} source files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
