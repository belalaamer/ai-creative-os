import importlib.util
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location(
    'container_smoke', Path(__file__).with_name('smoke_api_container.py'))
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class ContainerHttpTests(unittest.TestCase):
    def test_plain_text_cors_response(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.status = 200
        response.headers = {'Access-Control-Allow-Origin': 'https://ads.example.com'}
        response.read.return_value = b'OK'
        with patch.object(smoke, 'urlopen', return_value=response):
            status, headers, body = smoke.request('http://localhost', '/login', method='OPTIONS')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'https://ads.example.com')
        self.assertIsNone(body)
