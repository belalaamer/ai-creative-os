#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$ROOT/.v2"
OPENADKIT_REPO="https://github.com/IamRamgarhia/OpenAdKit-Open-Source-AI-Marketing-Tool.git"
OPENADKIT_SHA="22786a9ca2f73bb07c0d4b2e7e4954049e0e6d02"
SOBE_REPO="https://github.com/themagicmkt/sobe-tudo.git"
SOBE_SHA="30ce40d148c7c00c017a37059a4ed14213ede8fb"

rm -rf "$WORK"
mkdir -p "$WORK"

git clone --filter=blob:none --no-checkout "$OPENADKIT_REPO" "$WORK/openadkit"
git -C "$WORK/openadkit" checkout "$OPENADKIT_SHA"

git clone --filter=blob:none --no-checkout "$SOBE_REPO" "$WORK/sobe-tudo"
git -C "$WORK/sobe-tudo" checkout "$SOBE_SHA"

# Merge the ready-made Meta launcher into the OpenAdKit Next app.
mkdir -p "$WORK/openadkit/pages/api"
cp "$WORK/sobe-tudo"/api/*.js "$WORK/openadkit/pages/api/"
cp "$WORK/sobe-tudo/lib/meta.js" "$WORK/openadkit/lib/meta-launch.js"
cp "$WORK/sobe-tudo/index.html" "$WORK/openadkit/public/meta-launch.html"

# The original Sobe Tudo handlers live one directory shallower. Rewrite only
# their local helper import after moving them under pages/api.
for f in "$WORK/openadkit"/pages/api/*.js; do
  sed -i "s#'../lib/meta.js'#'../../lib/meta-launch.js'#g" "$f"
done

node "$ROOT/scripts/v2/patch-openadkit.mjs" "$WORK/openadkit"

echo "V2 sources ready:"
echo "  $WORK/openadkit"
echo "  $WORK/sobe-tudo"
