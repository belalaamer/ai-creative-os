#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

cd "$ROOT"
bash scripts/v2-stack/prepare.sh
node deploy/pages-ads/patch-preview-data.mjs "$ROOT/.v2-stack/nalarin"
cd "$ROOT/.v2-stack/nalarin/frontend"
npm install --no-audit --no-fund
npm run build

rm -rf "$HERE/dist"
mkdir -p "$HERE/dist"
cp -R dist/. "$HERE/dist/"
