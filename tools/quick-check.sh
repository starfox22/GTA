#!/bin/sh
# Pre-commit check, no browser (a few seconds): syntax gate + full build + FILEMAP freshness
# + no merge-conflict markers. Also run tools/smoke.mjs when a change touches
# boot, rendering, input or anything you cannot prove from the console.
# Usage: sh tools/quick-check.sh [tag]   (tag keeps parallel worktrees apart)
set -e
cd "$(dirname "$0")/.."
TAG="${1:-quick}"
mkdir -p dist/check
python3 tools/build.py --out "dist/check/$TAG.html" --js-out "dist/check/$TAG.js" >/dev/null
node --check "dist/check/$TAG.js"
echo "syntax OK ($(wc -l < "dist/check/$TAG.js") lines), build OK ($(wc -c < "dist/check/$TAG.html") bytes)"
if ! python3 tools/filemap.py --check; then
  echo "FAIL: run python3 tools/filemap.py and commit docs/FILEMAP.md" >&2
  exit 1
fi
if grep -rlE '^(<<<<<<<|>>>>>>>)( |$)' src tools docs README.md CLAUDE.md 2>/dev/null; then
  echo "FAIL: merge-conflict markers in the files above" >&2
  exit 1
fi
echo "quick-check OK"
