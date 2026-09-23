"""Local static server with OpenAI and Ollama gateways. Python 3.10+, stdlib only."""
import argparse
import json
import os
import ssl
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from ai_settings import setting

ROOT = Path(__file__).resolve().parent
MAX_BODY = 256 * 1024


def validate_input(data, keys):
    if not isinstance(data, dict) or set(data) - {'text', 'answers'}:
        raise ValueError('Ожидается объект text, answers.')
    text = data.get('text')
    answers = data.get('answers', {})
    if not isinstance(text, str) or not 3 <= len(text.strip()) <= 12000:
        raise ValueError('Описание должно содержать от 3 до 12000 символов.')
    if not isinstance(answers, dict) or set(answers) - set(keys):
        raise ValueError('Некорректные поля ответов.')
    for key, value in answers.items():
        limit = 160 if key in ('title', 'topic') else 4000
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError('Некорректное значение поля.')
    return {'text': text.strip(), 'answers': {k: v.strip() for k, v in answers.items()}}


def validate_output(output, data, keys):
    if not isinstance(output, dict) or set(output) != {'card', 'questions'}:
        raise ValueError('Неправильная структура ответа модели.')
    card, questions = output['card'], output['questions']
    if not isinstance(card, dict) or set(card) != set(keys):
        raise ValueError('Модель вернула неполную карточку.')
    for key, value in card.items():
        limit = 160 if key in ('title', 'topic') else 4000
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError('Модель вернула некорректное поле.')
        answer = data['answers'].get(key)
        if answer and value != answer:
            raise ValueError('Модель изменила введённые сведения.')
        if not answer and value and value not in data['text']:
            raise ValueError('Модель добавила сведения вне исходного текста.')
    if not isinstance(questions, list) or not 3 <= len(questions) <= 10:
        raise ValueError('Нужно от 3 до 10 вопросов.')
    used_fields, used_questions = set(), set()
    for q in questions:
        if not isinstance(q, dict) or set(q) != {'field', 'question'}:
            raise ValueError('Некорректный вопрос.')
        field, question = q['field'], q['question']
        if not isinstance(field, str) or field not in keys or not isinstance(question, str) or not 8 <= len(question.strip()) <= 500:
            raise ValueError('Некорректный вопрос.')
        if field in used_fields or question.strip().lower() in used_questions:
            raise ValueError('Модель повторила вопросы.')
        used_fields.add(field)
        used_questions.add(question.strip().lower())
    return output


def ask_ollama(data, contract):
    model = setting('OLLAMA_MODEL')
    if not model:
        raise AIServiceError('AI_NOT_CONFIGURED', 'Задайте OLLAMA_MODEL и запустите Ollama или выберите демо-режим.')
    base = setting('OLLAMA_URL', 'http://127.0.0.1:11434').rstrip('/')
    url = urlsplit(base)
    if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password:
        raise ConnectionError('Некорректный OLLAMA_URL.')
    payload = {'model': model, 'stream': False, 'format': contract['schema'],
               'options': {'temperature': 0}, 'messages': [
                   {'role': 'system', 'content': contract['prompt'] + '\nJSON schema: ' + json.dumps(contract['schema'], ensure_ascii=False)},
                   {'role': 'user', 'content': json.dumps(data, ensure_ascii=False)}]}
    request = Request(base + '/api/chat', data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
    with urlopen(request, timeout=40) as response:
        raw = response.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024:
        raise ValueError('Ответ модели слишком большой.')
    envelope = json.loads(raw)
    content = envelope['message']['content']
    return validate_output(json.loads(content), data, contract['keys'])


class AIServiceError(Exception):
    def __init__(self, code, message, status=503):
        super().__init__(message)
        self.code, self.status = code, status


def https_context():
    context = ssl.create_default_context()
    # Some Windows/MSYS Python builds have neither a CA file nor Windows-store
    # integration. Use the maintained Mozilla bundle already supplied with pip.
    if not context.get_ca_certs():
        try:
            from certifi import where
        except ImportError:
            try:
                from pip._vendor.certifi import where
            except ImportError:
                raise AIServiceError('AI_TLS', 'Python не находит доверенные сертификаты. Установите certifi: python -m pip install certifi.') from None
        context.load_verify_locations(cafile=where())
    return context


def ask_openai(data, contract):
    key = setting('OPENAI_API_KEY')
    if not key:
        raise AIServiceError('AI_NOT_CONFIGURED', 'OpenAI не настроен. Запустите configure-openai.bat и введите API-ключ на своём компьютере.')
    model = setting('OPENAI_MODEL', 'gpt-4.1-mini')
    payload = {
        'model': model, 'store': False, 'max_output_tokens': 4000,
        'instructions': contract['prompt'],
        'input': [{'role': 'user', 'content': json.dumps(data, ensure_ascii=False)}],
        'text': {'format': {'type': 'json_schema', 'name': 'business_task', 'strict': True, 'schema': contract['schema']}},
    }
    request = Request('https://api.openai.com/v1/responses', data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                      headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}, method='POST')
    try:
        with urlopen(request, timeout=40, context=https_context()) as response:
            raw = response.read(1024 * 1024 + 1)
    except HTTPError as error:
        # Never expose provider response bodies (they may contain request details).
        if error.code == 401:
            raise AIServiceError('AI_AUTH', 'OpenAI отклонил API-ключ. Проверьте его или создайте новый.', 401) from None
        if error.code == 403:
            raise AIServiceError('AI_ACCESS', 'У ключа нет доступа к модели или проекту. Проверьте права и выбранный проект OpenAI.', 403) from None
        if error.code == 429:
            code = ''
            try:
                body = json.loads(error.read(65536))
                code = body.get('error', {}).get('code', '')
            except (ValueError, AttributeError, OSError):
                pass
            if code == 'insufficient_quota':
                raise AIServiceError('AI_QUOTA', 'OpenAI сообщает об отсутствии доступной квоты. Проверьте кредиты и лимиты проекта, которому принадлежит ключ.', 429) from None
            raise AIServiceError('AI_RATE_LIMIT', 'Достигнут лимит запросов OpenAI. Повторите немного позже.', 429) from None
        if error.code in (400, 404):
            raise AIServiceError('AI_REQUEST', 'OpenAI не принял настройки запроса. Проверьте имя модели и её доступность проекту.', 502) from None
        raise AIServiceError('AI_UNAVAILABLE', 'OpenAI временно недоступен. Повторите запрос позже.') from None
    if len(raw) > 1024 * 1024:
        raise ValueError('Ответ модели слишком большой.')
    envelope = json.loads(raw)
    if not isinstance(envelope, dict) or not isinstance(envelope.get('output'), list):
        raise ValueError('Некорректный ответ OpenAI.')
    texts = []
    for item in envelope['output']:
        if isinstance(item, dict) and item.get('type') == 'message':
            for part in item.get('content', []):
                if part.get('type') == 'refusal':
                    raise AIServiceError('AI_REFUSAL', 'Модель не смогла обработать этот запрос. Уточните описание задачи.', 422)
                if part.get('type') == 'output_text':
                    texts.append(part['text'])
    if envelope.get('status') != 'completed' or not texts:
        raise AIServiceError('AI_INCOMPLETE', 'Модель вернула неполный ответ. Сократите описание или повторите запрос.', 502)
    return validate_output(json.loads(''.join(texts)), data, contract['keys'])


class Handler(BaseHTTPRequestHandler):
    server_version = 'AISanaLocal/1.0'

    def valid_host(self):
        # The server is loopback-only. Reject DNS rebinding and foreign Host values.
        return self.headers.get('Host', '') in {
            f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'
        }

    def respond(self, status, body, content_type='application/json; charset=utf-8'):
        if not isinstance(body, bytes):
            body = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def do_GET(self):
        if not self.valid_host():
            self.respond(403, {'error': 'HOST_DENIED'})
            return
        path = unquote(urlsplit(self.path).path)
        if path == '/api/health':
            self.respond(200, {'ok': True, 'storage': 'browser-localStorage', 'ollamaConfigured': bool(setting('OLLAMA_MODEL')), 'openaiConfigured': bool(setting('OPENAI_API_KEY')), 'modelConnectivityChecked': False})
            return
        if path == '/':
            path = '/index.html'
        target = (ROOT / path.lstrip('/')).resolve()
        allowed = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8'}
        if not target.is_relative_to(ROOT) or any(part.startswith('.') for part in target.relative_to(ROOT).parts) or target.suffix not in allowed or not target.is_file():
            self.respond(404, {'error': 'NOT_FOUND', 'message': 'Ресурс не найден.'})
            return
        self.respond(200, target.read_bytes(), allowed[target.suffix])

    def do_POST(self):
        if not self.valid_host():
            self.respond(403, {'error': 'HOST_DENIED'})
            return
        if self.path != '/api/ai/analyze':
            self.respond(404, {'error': 'NOT_FOUND'})
            return
        # Browser UI is served from this same origin; no wildcard CORS.
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            self.respond(403, {'error': 'ORIGIN_DENIED'})
            return
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            self.respond(415, {'error': 'JSON_REQUIRED'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_BODY:
                raise ValueError('Неправильный размер запроса.')
            contract = json.loads((ROOT / 'ai-contract.json').read_text(encoding='utf-8'))
            request_data = json.loads(self.rfile.read(length))
            if not isinstance(request_data, dict):
                raise ValueError('Нужен JSON-объект.')
            provider = request_data.pop('provider', 'ollama')
            if provider not in ('ollama', 'openai'):
                raise ValueError('Неизвестный провайдер.')
            data = validate_input(request_data, contract['keys'])
        except (ValueError, UnicodeError):
            self.respond(400, {'error': 'VALIDATION', 'message': 'Ожидается корректный JSON с описанием и полями ответов.'})
            return
        try:
            result = ask_openai(data, contract) if provider == 'openai' else ask_ollama(data, contract)
        except AIServiceError as error:
            self.respond(error.status, {'error': error.code, 'message': str(error)})
            return
        except (ConnectionError, URLError, HTTPError, TimeoutError, OSError) as error:
            reason = getattr(error, 'reason', error)
            if isinstance(reason, ssl.SSLCertVerificationError):
                self.respond(503, {'error': 'AI_TLS', 'message': 'Python не смог проверить сертификат HTTPS. Проверьте доверенные сертификаты Python; отключать проверку HTTPS не нужно.'})
                return
            if isinstance(reason, PermissionError):
                self.respond(503, {'error': 'AI_NETWORK_ACCESS', 'message': 'Среда запуска запретила серверу доступ в интернет. Разрешите сеть или запустите start.bat в обычном окне Windows после остановки текущего сервера.'})
                return
            message = 'Не удалось связаться с OpenAI. Проверьте интернет. Данные не изменены.' if provider == 'openai' else 'Ollama не подключена. Проверьте сервис и OLLAMA_MODEL. Данные не изменены.'
            self.respond(503, {'error': 'AI_UNAVAILABLE', 'message': message})
            return
        except (ValueError, KeyError, TypeError, AttributeError):
            self.respond(502, {'error': 'AI_INVALID', 'message': 'Ответ модели не прошёл проверку. Данные не изменены.'})
            return
        self.respond(200, result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--open', action='store_true', help='Open the site in the default browser')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('Port must be between 0 and 65535.')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError:
        parser.exit(1, 'Cannot start the server. Close the previous server or use --port 8001.\n')
    address = f'http://127.0.0.1:{server.server_port}/'
    print(f'AI Sana: {address}', flush=True)
    if args.open:
        import webbrowser
        webbrowser.open(address)
    print('Demo mode is available without a model. Ctrl+C to stop.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
