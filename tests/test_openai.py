import io
import json
import os
import ssl
from pathlib import Path
import tempfile
from temp_support import temporary_directory
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

import test_server as fixture
server, CONTRACT, valid_output = fixture.server, fixture.CONTRACT, fixture.valid_output
from ai_settings import read_local, save_openai, setting


def envelope(output=None, status='completed'):
    return {'status': status, 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(output or valid_output())}]}]}


class OpenAITests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'OPENAI_API_KEY': 'FAKE_TEST_KEY', 'OPENAI_MODEL': 'gpt-4.1-mini'})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.input = {'text': 'Нужен прототип кафе.', 'answers': {}}

    def call(self, response):
        with patch.object(server, 'urlopen', return_value=io.BytesIO(json.dumps(response).encode())):
            return server.ask_openai(self.input, CONTRACT)

    def test_responses_payload_and_grounding(self):
        seen = []
        def mock(request, timeout, context):
            seen.append(request)
            self.assertTrue(context.check_hostname)
            self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
            self.assertGreater(len(context.get_ca_certs()), 0)
            return io.BytesIO(json.dumps(envelope()).encode())
        with patch.object(server, 'urlopen', side_effect=mock):
            self.assertEqual(server.ask_openai(self.input, CONTRACT), valid_output())
        request = seen[0]
        self.assertEqual(request.full_url, 'https://api.openai.com/v1/responses')
        self.assertEqual(request.headers['Authorization'], 'Bearer FAKE_TEST_KEY')
        body = json.loads(request.data)
        self.assertFalse(body['store'])
        self.assertEqual(body['model'], 'gpt-4.1-mini')
        self.assertTrue(body['text']['format']['strict'])
        self.assertEqual(body['text']['format']['schema'], CONTRACT['schema'])
        self.assertNotIn('FAKE_TEST_KEY', request.data.decode())

    def test_missing_key_makes_no_network_request(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}), patch.object(server, 'urlopen') as network:
            with self.assertRaises(server.AIServiceError) as error:
                server.ask_openai(self.input, CONTRACT)
            self.assertEqual(error.exception.code, 'AI_NOT_CONFIGURED')
            network.assert_not_called()

    def test_upstream_errors_are_safe_and_distinct(self):
        for status, upstream, expected in [(401, '', 'AI_AUTH'), (403, '', 'AI_ACCESS'), (429, 'insufficient_quota', 'AI_QUOTA'), (429, 'rate_limit_exceeded', 'AI_RATE_LIMIT'), (404, '', 'AI_REQUEST'), (500, '', 'AI_UNAVAILABLE')]:
            body = json.dumps({'error': {'code': upstream, 'message': 'FAKE_TEST_KEY'}}).encode()
            error = HTTPError('https://api.openai.com/v1/responses', status, 'error', {}, io.BytesIO(body))
            with self.subTest(status=status, expected=expected), patch.object(server, 'urlopen', side_effect=error):
                with self.assertRaises(server.AIServiceError) as caught:
                    server.ask_openai(self.input, CONTRACT)
                self.assertEqual(caught.exception.code, expected)
                self.assertNotIn('FAKE_TEST_KEY', str(caught.exception))

    def test_refusal_and_incomplete_are_not_cards(self):
        refused = {'status':'completed', 'output':[{'type':'message','content':[{'type':'refusal','refusal':'Cannot assist'}]}]}
        for response, code in [(refused,'AI_REFUSAL'), (envelope(status='incomplete'),'AI_INCOMPLETE')]:
            with self.subTest(code=code), self.assertRaises(server.AIServiceError) as caught:
                self.call(response)
            self.assertEqual(caught.exception.code, code)

    def test_invented_fields_are_rejected(self):
        bad = valid_output()
        bad['card']['contact'] = 'invented@example.org'
        with self.assertRaises(ValueError):
            self.call(envelope(bad))

    def test_malformed_or_oversized_response(self):
        with self.assertRaises(ValueError):
            self.call({'output':None})
        with patch.object(server,'urlopen',return_value=io.BytesIO(b'x'*(1024*1024+1))):
            with self.assertRaises(ValueError):
                server.ask_openai(self.input,CONTRACT)


class ConfigurationTests(unittest.TestCase):
    def test_save_and_reload_without_erasing_other_settings(self):
        with temporary_directory() as directory:
            path = Path(directory)/'.env'
            path.write_text('# Local config\nOLLAMA_MODEL=keep-me\nOPENAI_API_KEY=OLD_TEST_KEY\n', encoding='utf-8')
            save_openai('NEW_TEST_KEY', path=path)
            values = read_local(path)
            self.assertEqual(values['OPENAI_API_KEY'],'NEW_TEST_KEY')
            self.assertEqual(values['OPENAI_MODEL'],'gpt-4.1-mini')
            self.assertEqual(values['OLLAMA_MODEL'],'keep-me')
            self.assertEqual(path.read_text().count('OPENAI_API_KEY='),1)
            self.assertFalse(path.with_name('.env.tmp').exists())

    def test_env_precedence_and_missing_file(self):
        with patch('ai_settings.read_local', return_value={'OPENAI_API_KEY':'FILE_TEST_KEY'}):
            with patch.dict(os.environ, {'OPENAI_API_KEY':'ENV_TEST_KEY'}):
                self.assertEqual(setting('OPENAI_API_KEY'),'ENV_TEST_KEY')
            with patch.dict(os.environ, {}, clear=True):
                self.assertEqual(setting('OPENAI_API_KEY'),'FILE_TEST_KEY')
                self.assertEqual(setting('OPENAI_MODEL','gpt-4.1-mini'),'gpt-4.1-mini')
        with temporary_directory() as directory:
            self.assertEqual(read_local(Path(directory)/'missing'),{})

    def test_bad_input_does_not_replace_existing_settings(self):
        with temporary_directory() as directory:
            path=Path(directory)/'.env'; path.write_text('unchanged')
            for key in ['', 'contains space', 'line\nbreak']:
                with self.assertRaises(ValueError): save_openai(key,path=path)
                self.assertEqual(path.read_text(),'unchanged')


class OpenAIHttpTests(unittest.TestCase):
    # Reuse the HTTP fixture without inheriting and rerunning its 13 core cases.
    setUpClass = classmethod(fixture.ServerTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ServerTests.tearDownClass.__func__)
    request = fixture.ServerTests.request
    post = fixture.ServerTests.post

    def test_provider_routing_and_invalid_provider(self):
        with patch.object(server, 'ask_openai', return_value=valid_output()) as cloud, patch.object(server,'ask_ollama') as local:
            self.assertEqual(self.post({'provider':'openai','text':'Нужен прототип кафе.'})[0],200)
            cloud.assert_called_once(); local.assert_not_called()
            self.assertEqual(self.post({'provider':'unknown','text':'Нужен прототип кафе.'})[0],400)

    def test_missing_configuration_message(self):
        with patch.dict(os.environ,{'OPENAI_API_KEY':''}):
            status,_,raw=self.post({'provider':'openai','text':'Нужен прототип кафе.'})
            self.assertEqual(status,503)
            self.assertEqual(json.loads(raw)['error'],'AI_NOT_CONFIGURED')

    def test_network_permissions_and_tls_have_actionable_messages(self):
        for reason, code in [(PermissionError(13, 'blocked'), 'AI_NETWORK_ACCESS'), (ssl.SSLCertVerificationError('untrusted'), 'AI_TLS')]:
            with patch.object(server, 'ask_openai', side_effect=URLError(reason)):
                status,_,raw=self.post({'provider':'openai','text':'Нужен прототип кафе.'})
                self.assertEqual(status,503)
                self.assertEqual(json.loads(raw)['error'],code)

    def test_health_does_not_disclose_key(self):
        with patch.dict(os.environ,{'OPENAI_API_KEY':'FAKE_TEST_KEY'}):
            status,_,raw=self.request('/api/health')
            self.assertEqual(status,200)
            self.assertTrue(json.loads(raw)['openaiConfigured'])
            self.assertNotIn(b'FAKE_TEST_KEY',raw)

    def test_secret_files_cannot_be_served(self):
        with temporary_directory() as directory:
            root=Path(directory)
            for name in ['.env','.env.tmp','.hidden.json']:
                (root/name).write_text('FAKE_TEST_KEY')
            with patch.object(server,'ROOT',root):
                for name in ['.env','.env.tmp','.hidden.json']:
                    status,_,raw=self.request('/'+name)
                    self.assertEqual(status,404)
                    self.assertNotIn(b'FAKE_TEST_KEY',raw)


if __name__ == '__main__': unittest.main()
