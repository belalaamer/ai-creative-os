#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$ROOT/.v2-stack"
NALARIN_REPO="https://github.com/masgant99/nalarin-agentic-ads-studio.git"
NALARIN_SHA="c500cc5a132142ff3de815bf6d15c50d490ea522"
STUDIO_REPO="https://github.com/two-71/studio.git"
STUDIO_SHA="e2f24f414f0cc6401e269dd98c7f6e07be8d0d98"

rm -rf "$WORK"
mkdir -p "$WORK"

git clone --filter=blob:none --no-checkout "$NALARIN_REPO" "$WORK/nalarin"
git -C "$WORK/nalarin" checkout "$NALARIN_SHA"

git clone --filter=blob:none --no-checkout "$STUDIO_REPO" "$WORK/studio271"
git -C "$WORK/studio271" checkout "$STUDIO_SHA"

echo "Pinned upstreams ready:"
echo "  $WORK/nalarin"
echo "  $WORK/studio271"
