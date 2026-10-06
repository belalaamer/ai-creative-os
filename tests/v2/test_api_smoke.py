import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'smoke_api', Path(__file__).resolve().parents[2] / 'scripts/v2-stack/smoke-api.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SmokeContractTests(unittest.TestCase):
    def responses(self):
        origin = 'https://ai-creative-os-v2-ads.pages.dev'
        return [
            (200, {}, {'status': 'healthy'}),
            (401, {}, {}), (401, {}, {}), (401, {}, {}),
            (200, {'Access-Control-Allow-Origin': origin}, {}),
            (400, {}, {}),
            (200, {}, {'access_token': 'test-token'}),
            (200, {'Access-Control-Allow-Origin': origin}, {'email': 'smoke@example.com'}),
            (200, {}, {'brands_count': 0}),
        ]

    def verify(self):
        smoke.verify('http://localhost:8000', 'https://ai-creative-os-v2-ads.pages.dev',
                     'smoke@example.com', 'test-password')

    def test_valid_contract_and_no_ad_mutations(self):
        with patch.object(smoke, 'request', side_effect=self.responses()) as request:
            self.verify()
        writes = [call for call in request.call_args_list if call.kwargs.get('method') == 'POST']
        self.assertEqual(len(writes), 1)
        self.assertEqual(writes[0].args[1], '/api/v1/auth/login/json')

    def test_html_health_is_not_a_live_api(self):
        with patch.object(smoke, 'request', return_value=(200, {}, None)):
            with self.assertRaisesRegex(AssertionError, 'health'):
                self.verify()

    def test_anonymous_dashboard_fails_gate(self):
        responses = self.responses()
        responses[2] = (200, {}, {'brands_count': 9})
        with patch.object(smoke, 'request', side_effect=responses):
            with self.assertRaisesRegex(AssertionError, 'anonymous'):
                self.verify()

    def test_wrong_identity_fails_gate(self):
        responses = self.responses()
        responses[7][2]['email'] = 'someone-else@example.com'
        with patch.object(smoke, 'request', side_effect=responses):
            with self.assertRaisesRegex(AssertionError, 'identity'):
                self.verify()
