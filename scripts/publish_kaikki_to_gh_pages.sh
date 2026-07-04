#!/usr/bin/env bash
set -euo pipefail

# Publish the generated Kaikki runtime package without replacing the Pages shell
# or the production ECDICT assets at the root of gh-pages.

REPO_ROOT=$(git rev-parse --show-toplevel)
SOURCE="$REPO_ROOT/apps/wordlover-pwa/public/kaikki"
REMOTE=origin
PAGES_BRANCH=gh-pages
ALLOW_DIRTY=0
DRY_RUN=0

usage() {
  echo "Usage: $0 [--source DIR] [--remote NAME] [--allow-dirty] [--dry-run]"
}

while (($#)); do
  case "$1" in
    --source) SOURCE=$(realpath "$2"); shift 2 ;;
    --remote) REMOTE=$2; shift 2 ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

cd "$REPO_ROOT"
if [[ $ALLOW_DIRTY -eq 0 ]] && [[ -n $(git status --porcelain --untracked-files=no) ]]; then
  echo "Refusing to publish from a tracked dirty worktree. Commit changes or pass --allow-dirty." >&2
  exit 1
fi

required=(
  dictionary.sqlite
  dictionary.sqlite.zst
  dictionary-manifest.json
  dictionary-full/manifest.json
)
for relative in "${required[@]}"; do
  [[ -f "$SOURCE/$relative" ]] || { echo "Missing required Kaikki runtime file: $SOURCE/$relative" >&2; exit 1; }
done

# Reuse the package guard: only the slim SQLite is public and it is <= 200 MiB.
python3 - "$SOURCE" "$REPO_ROOT" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
sys.path.insert(0, sys.argv[2])
from scripts.package_kaikki_dictionary import validate_public_sqlite_assets

validate_public_sqlite_assets(source)
manifest = json.loads((source / "dictionary-manifest.json").read_text(encoding="utf-8"))
if manifest.get("dictionaryId") != "kaikki":
    raise SystemExit("Slim manifest dictionaryId must be 'kaikki'")
if manifest.get("dictionaryLabel") != "Kaikki / Wiktextract":
    raise SystemExit("Slim manifest dictionaryLabel is invalid")
for key in ("sqlite", "zstd"):
    item = manifest.get(key) or {}
    relative = item.get("path")
    if not relative or Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise SystemExit(f"Invalid {key} manifest path: {relative!r}")
    path = source / relative
    if not path.is_file():
        raise SystemExit(f"Manifest file is missing: {path}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != item.get("sha256"):
        raise SystemExit(f"SHA-256 mismatch for {relative}")
    if path.stat().st_size != item.get("bytes"):
        raise SystemExit(f"Byte-size mismatch for {relative}")
full = json.loads((source / "dictionary-full/manifest.json").read_text(encoding="utf-8"))
if full.get("dictionaryId") != "kaikki":
    raise SystemExit("Full manifest dictionaryId must be 'kaikki'")
if full.get("dictionaryLabel") != "Kaikki / Wiktextract":
    raise SystemExit("Full manifest dictionaryLabel is invalid")
PY
python3 scripts/validate_dictionary_shards.py "$SOURCE/dictionary-full"

git fetch "$REMOTE" "$PAGES_BRANCH:refs/remotes/$REMOTE/$PAGES_BRANCH"
WORKTREE=$(mktemp -d "${TMPDIR:-/tmp}/wordfan-kaikki-pages.XXXXXX")
cleanup() {
  git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  rm -rf "$WORKTREE"
}
trap cleanup EXIT
git worktree add --detach "$WORKTREE" "$REMOTE/$PAGES_BRANCH" >/dev/null

rm -rf "$WORKTREE/kaikki"
mkdir -p "$WORKTREE/kaikki"
cp -a "$SOURCE/." "$WORKTREE/kaikki/"

cd "$WORKTREE"
git add -A -- kaikki
mapfile -t CHANGED < <(git diff --cached --name-only)
if ((${#CHANGED[@]} == 0)); then
  echo "The live gh-pages Kaikki package already matches the local package."
elif printf '%s\n' "${CHANGED[@]}" | grep -Ev '^kaikki/' >/dev/null; then
  echo "Refusing publish: staged changes escaped the kaikki/ directory." >&2
  exit 1
elif [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run passed. Only ${#CHANGED[@]} file(s) under kaikki/ would change."
else
  git commit -m "Publish Kaikki runtime dictionary"
  git push "$REMOTE" "HEAD:$PAGES_BRANCH"
fi

cat <<'EOF'
Live verification (allow GitHub Pages a short propagation delay):
  curl -fsSI https://wordfan.app/kaikki/dictionary-manifest.json
  curl -fsSI https://wordfan.app/kaikki/dictionary.sqlite.zst
  curl -fsSI https://wordfan.app/kaikki/dictionary-full/manifest.json
EOF
