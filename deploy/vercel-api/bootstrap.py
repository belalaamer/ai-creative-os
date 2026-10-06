"""Serialize migrations and seeding across concurrent container cold starts."""
import os
import subprocess

from app.core import token_encryption  # Validate before any database changes.
from app.database import engine
from sqlalchemy import text


def bootstrap():
    # Use a session-pooler or direct PostgreSQL URL; transaction pooling cannot
    # preserve this session advisory lock. Use a dedicated Nalarin database.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        connection.execute(text("SET statement_timeout = '120s'"))
        connection.execute(text("SELECT pg_advisory_lock(7410260311)"))
        try:
            subprocess.run(["alembic", "upgrade", "head"], check=True)
            from init_db import seed_roles_and_permissions, create_superuser
            seed_roles_and_permissions()
            email, password = os.getenv("ADMIN_EMAIL"), os.getenv("ADMIN_PASSWORD")
            if bool(email) != bool(password):
                raise RuntimeError("Configure ADMIN_EMAIL and ADMIN_PASSWORD together")
            if email and password:
                create_superuser(email, password)
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(7410260311)"))


if __name__ == "__main__":
    bootstrap()
