#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?Set DATABASE_URL in Vercel before starting the API}"
: "${SECRET_KEY:?SECRET_KEY is required}"
: "${OAUTH_TOKEN_ENCRYPTION_KEY:?OAUTH_TOKEN_ENCRYPTION_KEY is required}"
: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID is required for persistent media}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${R2_BUCKET_NAME:?R2_BUCKET_NAME is required}"
: "${R2_PUBLIC_URL:?R2_PUBLIC_URL is required}"

python /app/creative_os_bootstrap.py
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-80}"
