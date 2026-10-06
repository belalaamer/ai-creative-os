import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock, patch

ROOT = Path(__file__).resolve().parents[2]


class VercelBootstrapTests(unittest.TestCase):
    def run_bootstrap(self, migration_fails=False):
        source = (ROOT / 'deploy/vercel-api/bootstrap.py').read_text()
        function = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef))
        connection = Mock()
        context = MagicMock()
        context.__enter__.return_value = connection
        engine = Mock()
        engine.connect.return_value.execution_options.return_value = context
        events = []
        connection.execute.side_effect = lambda sql: events.append(sql)
        seed = Mock(side_effect=lambda: events.append('seed'))
        admin = Mock(side_effect=lambda *args: events.append('admin'))

        def migrate(*args, **kwargs):
            events.append('migrate')
            if migration_fails:
                raise RuntimeError('migration failed')

        namespace = {'engine': engine, 'text': lambda value: value,
                     'subprocess': SimpleNamespace(run=migrate),
                     'os': SimpleNamespace(getenv=lambda key: {'ADMIN_EMAIL': 'test@example.com',
                                                              'ADMIN_PASSWORD': 'test-only'}.get(key))}
        exec(compile(ast.Module(body=[function], type_ignores=[]), '<bootstrap>', 'exec'), namespace)
        fake_init = SimpleNamespace(seed_roles_and_permissions=seed, create_superuser=admin)
        with patch.dict('sys.modules', {'init_db': fake_init}):
            if migration_fails:
                with self.assertRaisesRegex(RuntimeError, 'migration failed'):
                    namespace['bootstrap']()
            else:
                namespace['bootstrap']()
        return events, seed, admin

    def test_lock_covers_migration_and_seeding(self):
        events, _, _ = self.run_bootstrap()
        self.assertEqual(events[1:], ['SELECT pg_advisory_lock(7410260311)', 'migrate',
                                     'seed', 'admin', 'SELECT pg_advisory_unlock(7410260311)'])

    def test_failed_migration_unlocks_and_does_not_seed(self):
        events, seed, admin = self.run_bootstrap(migration_fails=True)
        self.assertEqual(events[-1], 'SELECT pg_advisory_unlock(7410260311)')
        seed.assert_not_called()
        admin.assert_not_called()
