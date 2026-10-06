#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
TMP="/tmp/creative-os-studio-preview"

cd "$ROOT"
bash scripts/v2-stack/prepare.sh

rm -rf "$TMP"
mkdir -p "$TMP/vendor"
cp -R "$ROOT/apps/studio-preview/." "$TMP/"
cp -R "$ROOT/.v2-stack/studio271/packages/studio" "$TMP/vendor/studio"

cd "$TMP"
npm install --no-audit --no-fund --include=dev
npm run build

rm -rf "$HERE/dist"
mkdir -p "$HERE/dist"
cp -R "$TMP/out/." "$HERE/dist/"
