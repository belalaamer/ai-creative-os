#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${SECRET_KEY:?SECRET_KEY is required}"
: "${OAUTH_TOKEN_ENCRYPTION_KEY:?OAUTH_TOKEN_ENCRYPTION_KEY is required}"

# Validate encryption before migrations or seeding write to the database.
python -c 'from app.core import token_encryption'
alembic upgrade head
# Alembic owns the schema; do not call upstream create_all on production startup.
python - <<'PYTHON'
import os
from init_db import seed_roles_and_permissions, create_superuser
seed_roles_and_permissions()
email, password = os.getenv("ADMIN_EMAIL"), os.getenv("ADMIN_PASSWORD")
if email and password:
    create_superuser(email, password)
PYTHON

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
