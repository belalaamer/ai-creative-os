#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/v2-stack/.env"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ROOT/v2-stack/.env.example" "$ENV_FILE"
  echo "Created $ENV_FILE"
  echo "Fill the required secrets, then run this command again."
  exit 1
fi

bash "$ROOT/scripts/v2-stack/prepare.sh"
docker compose --env-file "$ENV_FILE" -f "$ROOT/deploy/v2/docker-compose.yml" up --build
