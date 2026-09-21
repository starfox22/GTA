#!/bin/sh
# Fast syntax gate: assemble the game script and parse it with Node.
# Usage: sh tools/check.sh [tag]   (tag keeps parallel runs from colliding)
set -e
cd "$(dirname "$0")/.."
TAG="${1:-default}"
mkdir -p dist/check
python3 tools/build.py --out "dist/check/$TAG.html" --js-out "dist/check/$TAG.js" >/dev/null
node --check "dist/check/$TAG.js" && echo "syntax OK ($(wc -l < "dist/check/$TAG.js") lines)"
