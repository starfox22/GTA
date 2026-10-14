#!/usr/bin/env python3
"""Apply measured wheel-axis and handlebar-grip hints to an existing DECVM001 pack.

Use when the original downloaded models are unavailable. The full converter emits the
same hints on a future rebuild. Geometry, other metadata and atlas remain unchanged.
Usage: python3 tools/vehicle_wheel_metadata.py PACK [--write]
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

from vehicle_models import MODELS


def annotate(data):
    if data[:8] != b'DECVM001':
        raise ValueError('Not a DECVM001 vehicle pack')
    size = struct.unpack_from('<I', data, 8)[0]
    header = json.loads(data[12:12 + size])
    payload = data[12 + size:]
    changed = []
    for hint in MODELS:
        if 'wheelAxes' not in hint and 'grips' not in hint:
            continue
        model = header['models'].get(hint['type'])
        if not model or model.get('title') != hint['title'] or model.get('kind') != 'moto':
            raise ValueError('Unexpected source model for ' + hint['type'])
        if 'wheelAxes' in hint:
            if len(model['wheels']) != len(hint['wheelAxes']):
                raise ValueError('Wheel count changed for ' + hint['type'])
            for wheel, axis in zip(model['wheels'], hint['wheelAxes']):
                if len(axis) != 3 or not all(math.isfinite(v) for v in axis) or abs(sum(v * v for v in axis) - 1) > 1e-6:
                    raise ValueError('Invalid normalized axle')
                wheel['axle'] = list(axis)
        if 'grips' in hint:
            grips = hint['grips']
            if len(grips) != 2 or any(len(point) != 3 or not all(math.isfinite(v) for v in point) for point in grips):
                raise ValueError('Invalid paired grips for ' + hint['type'])
            if not grips[0][2] < 0 < grips[1][2] or any(point[1] <= 0 for point in grips):
                raise ValueError('Grip side/height changed for ' + hint['type'])
            model['grips'] = [[round(v, 4) for v in point] for point in grips]
            # Legacy readers retain the mean grip position/half span. Detailed
            # and coarse riders use the two original asymmetric contact points.
            model['grip'] = [round(sum(point[axis] for point in grips) / 2, 4) for axis in range(2)] + [round((grips[1][2] - grips[0][2]) / 2, 4)]
        changed.append(hint['type'])
    encoded = json.dumps(header, separators=(',', ':')).encode()
    encoded += b' ' * (-(12 + len(encoded)) % 4)
    output = b'DECVM001' + struct.pack('<I', len(encoded)) + encoded + payload
    # Every array offset is payload-relative; the original bytes must survive exactly.
    assert output[12 + len(encoded):] == payload
    return output, {'models': changed, 'payloadBytes': len(payload),
                    'payloadSHA256': hashlib.sha256(payload).hexdigest(),
                    'beforeBytes': len(data), 'afterBytes': len(output)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pack', type=Path, help='Existing DECVM001 pack')
    parser.add_argument('--write', action='store_true', help='Write the validated header; default is a dry run')
    args = parser.parse_args()
    path = args.pack
    output, report = annotate(path.read_bytes())
    if args.write:
        path.write_bytes(output)
    print(json.dumps(report, indent=2))
