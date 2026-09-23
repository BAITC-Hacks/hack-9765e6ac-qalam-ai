import importlib.util
import json
import os
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sana_server', ROOT / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
CONTRACT = json.loads((ROOT / 'ai-contract.json').read_text(encoding='utf-8'))


def valid_output():
    card = {k: '' for k in CONTRACT['keys']}
    card['need'] = 'Нужен прототип кафе.'
    return {'card': card, 'questions': [
        {'field': 'context', 'question': 'Как сейчас устроен процесс?'},
        {'field': 'data_description', 'question': 'Какие данные у вас доступны?'},
        {'field': 'users', 'question': 'Кто будет пользоваться решением?'}]}


class QuietHandler(server.Handler):
    def log_message(self, *args):
        pass


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.httpd.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def request(self, path, data=None, headers=None):
        request = Request(self.base + path, data=data, headers=headers or {})
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            return response.status, dict(response.headers), response.read()

    def post(self, data, extra=None):
        return self.request('/api/ai/analyze', json.dumps(data).encode(), {'Content-Type': 'application/json', **(extra or {})})

    def test_health(self):
        status, _, body = self.request('/api/health')
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(body)['modelConnectivityChecked'])

    def test_page_and_module_mime(self):
        self.assertEqual(self.request('/')[0], 200)
        for path in ['/js/index.mjs', '/js/bootstrap.mjs', '/js/ui-model.mjs', '/app.js']:
            status, headers, _ = self.request(path)
            self.assertEqual(status, 200, path)
            self.assertIn('text/javascript', headers['Content-Type'])

    def test_private_files_and_traversal(self):
        for path in ['/server.py', '/start.bat', '/../../server.py', '/%2e%2e/README.md', '/does-not-exist.html']:
            self.assertEqual(self.request(path)[0], 404)

    def test_invalid_json(self):
        self.assertEqual(self.request('/api/ai/analyze', b'{bad', {'Content-Type': 'application/json'})[0], 400)

    def test_invalid_input(self):
        for data in [None, [], {}, {'text': ''}, {'text': 'Описание', 'answers': {'alien': 'x'}}, {'text': 'Описание', 'answers': {'users': []}}]:
            self.assertEqual(self.post(data)[0], 400)

    def test_wrong_content_type(self):
        self.assertEqual(self.request('/api/ai/analyze', b'{}', {'Content-Type': 'text/plain'})[0], 415)

    def test_foreign_origin(self):
        self.assertEqual(self.post({'text': 'Описание'}, {'Origin': 'https://other.example'})[0], 403)

    def test_missing_model_configuration(self):
        with patch.dict(os.environ, {'OLLAMA_MODEL': ''}):
            self.assertEqual(self.post({'text': 'Описание'})[0], 503)

    def test_correct_transport_response(self):
        with patch.object(server, 'ask_ollama', return_value=valid_output()):
            status, _, body = self.post({'text': 'Нужен прототип кафе.'})
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body), valid_output())

    def test_model_error_mapping(self):
        with patch.object(server, 'ask_ollama', side_effect=ValueError('bad model output')):
            self.assertEqual(self.post({'text': 'Описание'})[0], 502)
        with patch.object(server, 'ask_ollama', side_effect=TimeoutError()):
            self.assertEqual(self.post({'text': 'Описание'})[0], 503)

    def test_grounded_output(self):
        data = {'text': 'Нужен прототип кафе.', 'answers': {}}
        self.assertEqual(server.validate_output(valid_output(), data, CONTRACT['keys']), valid_output())
        bad = valid_output()
        bad['card']['contact'] = 'invented@example.org'
        with self.assertRaises(ValueError):
            server.validate_output(bad, data, CONTRACT['keys'])

    def test_duplicate_and_malformed_questions(self):
        data = {'text': 'Нужен прототип кафе.', 'answers': {}}
        bad = valid_output()
        bad['questions'] = [bad['questions'][0]] * 3
        with self.assertRaises(ValueError):
            server.validate_output(bad, data, CONTRACT['keys'])
        bad['questions'][0] = {'field': [], 'question': 'Как сейчас устроен процесс?'}
        with self.assertRaises(ValueError):
            server.validate_output(bad, data, CONTRACT['keys'])

    def test_ollama_payload_and_validation(self):
        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return json.dumps({'message': {'content': json.dumps(valid_output())}}).encode()
        with patch.dict(os.environ, {'OLLAMA_MODEL': 'test-model', 'OLLAMA_URL': 'http://127.0.0.1:11434'}):
            with patch.object(server, 'urlopen', return_value=FakeResponse()) as call:
                result = server.ask_ollama({'text': 'Нужен прототип кафе.', 'answers': {}}, CONTRACT)
                self.assertEqual(result, valid_output())
                payload = json.loads(call.call_args.args[0].data)
                self.assertFalse(payload['stream'])
                self.assertEqual(payload['format'], CONTRACT['schema'])
                self.assertEqual(payload['model'], 'test-model')


if __name__ == '__main__':
    unittest.main()
