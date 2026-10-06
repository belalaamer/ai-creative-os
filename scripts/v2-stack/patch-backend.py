"""Apply deployment compatibility fixes to the pinned Nalarin backend."""
from pathlib import Path
import sys

root = Path(sys.argv[1]) / "backend"
env = root / "alembic/env.py"
source = env.read_text()
source = source.replace(
    'config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)',
    'config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))',
)
env.write_text(source)

# The pinned baseline uses current models, so a fresh database already has
# token_hash. Preserve the legacy token -> token_hash upgrade for older DBs.
refresh_migration = root / "alembic/versions/a1d2e3f4b5c6_hash_refresh_tokens.py"
if refresh_migration.exists():
    source = refresh_migration.read_text()
    marker = "    # Creative OS: the current-model baseline already stores token hashes.\n"
    if marker not in source:
        source = source.replace(
            "def upgrade() -> None:\n",
            "def upgrade() -> None:\n"
            + marker
            + '    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("refresh_tokens")}\n'
            + '    if "token_hash" in columns and "token" not in columns:\n'
            + "        return\n\n",
            1,
        )
    refresh_migration.write_text(source)
