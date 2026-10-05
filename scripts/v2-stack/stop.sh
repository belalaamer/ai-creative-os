#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
docker compose -f "$ROOT/deploy/v2/docker-compose.yml" down
