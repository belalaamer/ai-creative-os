#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

cd "$ROOT/apps/studio-preview"
npm install --no-audit --no-fund
npm run build

rm -rf "$HERE/dist"
mkdir -p "$HERE/dist"
cp -R out/. "$HERE/dist/"
