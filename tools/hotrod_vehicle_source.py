#!/usr/bin/env python3
"""Fetch/verify the exact licensed Coupe33 source without GitHub API or cached meshes.

python3 tools/hotrod_vehicle_source.py /tmp/hotrod-source
python3 tools/hotrod_vehicle_source.py /tmp/hotrod-source --verify-only
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
    receipt = json.loads(Path(__file__).with_suffix('.json').read_text())
    total = 0
    for file in receipt['files']:
        destination = args.destination / file['path']
        if not destination.is_file() and not args.verify_only:
            destination.parent.mkdir(parents=True, exist_ok=True)
            # URLs are pinned to a complete commit; TLS verification stays on.
            with urlopen(file['url'], timeout=60) as response:
                data = response.read()
            if hashlib.sha256(data).hexdigest() != file['sha256']:
                raise RuntimeError('Downloaded source hash mismatch: ' + file['path'])
            destination.write_bytes(data)
        data = destination.read_bytes()
        if len(data) != file['bytes'] or hashlib.sha256(data).hexdigest() != file['sha256']:
            raise RuntimeError('Source hash mismatch: ' + file['path'])
        total += len(data)
    print(json.dumps({'verifiedFiles': len(receipt['files']), 'verifiedBytes': total, 'source': receipt['sourceGeometry']['extras'], 'licenceEvidenceLimitation': receipt['verificationLimit']}, indent=2))


if __name__ == '__main__':
    main()
