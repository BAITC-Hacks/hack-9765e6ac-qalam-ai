"""Writable test fixtures on Windows and POSIX; no user files are touched."""
from contextlib import contextmanager
from pathlib import Path
import shutil
import uuid

@contextmanager
def temporary_directory():
    root = (Path(__file__).resolve().parents[1] / 'work' / 'test-temp').resolve()
    root.mkdir(parents=True, exist_ok=True)
    target = root / ('fixture-' + uuid.uuid4().hex)
    target.mkdir()
    try:
        yield str(target)
    finally:
        if target.resolve().parent != root:
            raise RuntimeError('Test directory escaped its workspace')
        shutil.rmtree(target)
