#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
TMP="/tmp/creative-os-studio-preview"

rm -rf "$TMP"
mkdir -p "$TMP"
cp -R "$ROOT/apps/studio-preview/." "$TMP/"

cd "$TMP"
npm install --no-audit --no-fund --include=dev
npm run build

rm -rf "$HERE/dist"
mkdir -p "$HERE/dist"
cp -R "$TMP/out/." "$HERE/dist/"
