#!/usr/bin/env python3
"""Verify that every file in a Pages artifact is actually served unchanged.

Usage: python3 tools/verify-pages.py dist/pages https://example.github.io/game/
No credentials; accepts only an HTTP(S) base URL and compares exact file bytes.
"""
import argparse
import hashlib
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


def verify(directory, base_url):
    parsed = urlsplit(base_url)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError('Expected an HTTP(S) site URL without a query or fragment')
    base_url = base_url.rstrip('/') + '/'
    files = sorted(p for p in directory.rglob('*') if p.is_file())
    if not (directory / 'index.html').is_file():
        raise ValueError('The artifact must contain index.html')
    total = 0
    for path in files:
        relative = path.relative_to(directory).as_posix()
        data = path.read_bytes()
        expected = hashlib.sha256(data).hexdigest()
        # A new deployment can initially meet a stale CDN response. A content-keyed
        # verification query avoids sharing that response with an earlier release.
        url = base_url + quote(relative, safe='/') + '?verify=' + expected[:16]
        for attempt in range(6):
            try:
                request = Request(url, headers={'User-Agent': 'DeadEndCity-Pages-verification'})
                with urlopen(request, timeout=45) as response:
                    served = response.read()
                    if response.status != 200 or hashlib.sha256(served).hexdigest() != expected:
                        raise ValueError('HTTP status or served bytes differ from the artifact')
                break
            except (HTTPError, URLError, TimeoutError, ValueError) as error:
                if attempt == 5:
                    raise RuntimeError(f'{relative}: public verification failed: {error}') from error
                print(f'{relative}: waiting for deployed content ({attempt + 1}/6)', flush=True)
                time.sleep(10)
        total += len(data)
        print(f'PASS {relative}: {len(data)} bytes, SHA-256 {expected}', flush=True)
    print(f'Public game verified: {len(files)} files, {total} bytes at {base_url}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('url')
    args = parser.parse_args()
    verify(args.directory, args.url)
