#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
bash "$ROOT/scripts/v2-stack/bootstrap.sh"
python3 "$ROOT/scripts/v2-stack/patch-backend.py" "$ROOT/.v2-stack/nalarin"
node "$ROOT/scripts/v2-stack/patch-nalarin.mjs" "$ROOT/.v2-stack/nalarin"
node "$ROOT/scripts/v2-stack/patch-studio.mjs" "$ROOT/.v2-stack/studio271"
echo "Creative OS V2 ready-made stack prepared."
