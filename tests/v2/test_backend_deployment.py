import configparser
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]

class BackendDeploymentTests(unittest.TestCase):
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
