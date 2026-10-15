#!/usr/bin/env python3
"""Fetch and hash-check the pinned, asset-licensed jet sources.

python3 tools/jet_models_source.py /tmp/jet-source [--verify-only]
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(Path(__file__).with_suffix('.json').read_text())
    for entry in manifest['files']:
        path = args.destination / entry['path']
        if not path.is_file() and not args.verify_only:
            with urlopen(entry['url'], timeout=60) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != entry['sha256']:
                raise ValueError('Downloaded source hash mismatch: ' + entry['path'])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        data = path.read_bytes()
        if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise ValueError('Source hash mismatch: ' + entry['path'])
    print(json.dumps({'verifiedFiles': len(manifest['files']),
                      'verifiedBytes': sum(e['bytes'] for e in manifest['files']),
                      'verificationLimit': manifest['verificationLimit']}, indent=2))


if __name__ == '__main__':
    main()
