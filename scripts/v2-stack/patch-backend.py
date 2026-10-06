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
