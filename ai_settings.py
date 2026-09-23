"""Small local configuration reader; values are never returned by HTTP endpoints."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ALLOWED = {'OPENAI_API_KEY', 'OPENAI_MODEL', 'OLLAMA_MODEL', 'OLLAMA_URL'}


def read_local(path=None):
    path = Path(path) if path is not None else ROOT / '.env'
    if not path.is_file():
        return {}
    settings = {}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key, value = key.strip(), value.strip()
        if key in ALLOWED:
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            settings[key] = value
    return settings


def setting(key, default=''):
    # Explicit process variables (including empty values) take precedence.
    value = os.environ.get(key)
    return (value if value is not None else read_local().get(key, default)).strip()


def save_openai(key, model='gpt-4.1-mini', path=None):
    if not key or any(c.isspace() for c in key):
        raise ValueError('Ключ пустой или содержит пробелы. Скопируйте API-ключ целиком.')
    if not model or any(c.isspace() for c in model):
        raise ValueError('Некорректное имя модели.')
    path = Path(path) if path is not None else ROOT / '.env'
    previous = path.read_text(encoding='utf-8-sig').splitlines() if path.is_file() else []
    lines = [line for line in previous if line.split('=', 1)[0].strip() not in {'OPENAI_API_KEY', 'OPENAI_MODEL'}]
    lines += ['OPENAI_API_KEY=' + key, 'OPENAI_MODEL=' + model]
    temp = path.with_name(path.name + '.tmp')
    try:
        temp.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()
