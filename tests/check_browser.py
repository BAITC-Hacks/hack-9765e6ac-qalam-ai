"""HTTP smoke check and link to browser tests; no browser automation or profile changes."""
import argparse
import json
from urllib.request import urlopen

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:8000')
    args = parser.parse_args()
    base = args.url.rstrip('/')
    for path in ['/', '/app.js', '/js/bootstrap.mjs', '/api/health', '/tests.html']:
        with urlopen(base + path, timeout=5) as response:
            assert response.status == 200
            print('PASS', path, response.headers.get('Content-Type'))
    print('Open browser tests:', base + '/tests.html')
    print('HTTP success alone does not verify UI interactions.')
