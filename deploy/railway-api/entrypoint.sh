#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SECRET_KEY:?SECRET_KEY is required}"
: "${OAUTH_TOKEN_ENCRYPTION_KEY:?OAUTH_TOKEN_ENCRYPTION_KEY is required}"

alembic upgrade head
python init_db.py

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
