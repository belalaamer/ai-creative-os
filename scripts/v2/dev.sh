#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
bash "$ROOT/scripts/v2/bootstrap.sh"
cd "$ROOT/.v2/openadkit"
npm install --no-audit --no-fund
npm run dev
