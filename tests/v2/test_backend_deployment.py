import configparser
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]

class BackendDeploymentTests(unittest.TestCase):
    def test_refresh_token_migration_fresh_and_legacy_schemas(self):
        from unittest.mock import Mock
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'backend/alembic'
            (root / 'versions').mkdir(parents=True)
            (root / 'env.py').write_text('config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)\n')
            migration = root / 'versions/a1d2e3f4b5c6_hash_refresh_tokens.py'
            migration.write_text('def upgrade() -> None:\n'
                                 '    op.execute("DELETE FROM refresh_tokens")\n'
                                 '    op.drop_column("refresh_tokens", "token")\n')
            command = ['python3', str(ROOT / 'scripts/v2-stack/patch-backend.py'), folder]
            subprocess.run(command, check=True)
            patched = migration.read_text()
            subprocess.run(command, check=True)
            self.assertEqual(patched, migration.read_text())
            for columns, should_migrate in [(['token_hash'], False), (['token'], True)]:
                op, sa = Mock(), Mock()
                sa.inspect.return_value.get_columns.return_value = [{'name': c} for c in columns]
                namespace = {'op': op, 'sa': sa}
                exec(patched, namespace)
                namespace['upgrade']()
                self.assertEqual(op.execute.called, should_migrate)
                self.assertEqual(op.drop_column.called, should_migrate)

    def test_encoded_database_password_and_idempotent_patch(self):
        with tempfile.TemporaryDirectory() as folder:
            env = Path(folder) / 'backend/alembic/env.py'
            env.parent.mkdir(parents=True)
            env.write_text('config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)\n')
            command = ['python3', str(ROOT / 'scripts/v2-stack/patch-backend.py'), folder]
            subprocess.run(command, check=True)
            patched = env.read_text()
            subprocess.run(command, check=True)
            self.assertEqual(patched, env.read_text())
            config = configparser.ConfigParser()
            config.add_section('alembic')
            class Settings:
                DATABASE_URL = 'postgresql://user:p%40ss%25word@localhost/db'
            exec(patched, {'config': type('Config', (), {
                'set_main_option': lambda self, key, value: config.set('alembic', key, value)
            })(), 'settings': Settings})
            self.assertEqual(config.get('alembic', 'sqlalchemy.url'), Settings.DATABASE_URL)

    def test_invalid_encryption_stops_before_database_changes(self):
        import os
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            package = path / 'app/core'
            package.mkdir(parents=True)
            (path / 'app/__init__.py').write_text('')
            (package / '__init__.py').write_text('')
            (package / 'token_encryption.py').write_text('raise ValueError("invalid encryption key")')
            alembic = path / 'alembic'
            alembic.write_text('#!/bin/sh\ntouch migrated\n')
            alembic.chmod(0o755)
            env = dict(os.environ, DATABASE_URL='postgresql://test/db', SECRET_KEY='test',
                       OAUTH_TOKEN_ENCRYPTION_KEY='invalid', PATH=folder + ':' + os.environ['PATH'])
            result = subprocess.run(['sh', str(ROOT / 'deploy/railway-api/entrypoint.sh')],
                                    cwd=folder, env=env, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((path / 'migrated').exists())

if __name__ == '__main__':
    unittest.main()
