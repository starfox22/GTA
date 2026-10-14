#!/usr/bin/env python3
"""Audit packed motorcycle tyre axles; emit measured hints, never alter a media pack.

Usage: python3 tools/motorcycle_axles.py [assets/vehicle-models.bin] [--out report.json]
Requires numpy and scipy for this offline audit only. The converter consumes explicit
wheelAxes hints, so building or playing the game has no scipy dependency.
"""
import argparse
import hashlib
import json
import struct

import numpy as np
from scipy.optimize import least_squares


def fit_axle(position, indices, radius, width):
    """Area-weighted elliptical torus fit; tyre tread deviations use a robust loss.

    A neutral-axis fit optimizes the same centre and cross-section first, so the
    reported improvement measures axle orientation rather than guessed tyre sizes.
    """
    triangles = position[indices]
    area = np.linalg.norm(np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]), axis=1)
    weights = np.zeros(len(position))
    np.add.at(weights, indices, area[:, None] / 3)
    weights = np.sqrt(weights / weights.mean())

    def residual(values):
        axis = np.array([values[3], values[4], 1.0])
        axis /= np.linalg.norm(axis)
        points = position - values[:3]
        axial = points @ axis
        radial = np.sqrt(np.maximum(1e-9, (points * points).sum(1) - axial * axial))
        return ((radial - values[5]) ** 2 / values[6] ** 2 + axial ** 2 / values[7] ** 2 - 1) * weights

    initial = np.array([0, 0, 0, 0, 0, radius * .86, radius * .14, width * .5])
    lower = np.array([-.05, -.05, -.05, -.2, -.2, radius * .65, radius * .06, width * .3])
    upper = np.array([.05, .05, .05, .2, .2, radius * .97, radius * .3, width * .9])
    neutral_parameters = np.array([0, 1, 2, 5, 6, 7])

    def neutral_residual(values):
        full = initial.copy()
        full[neutral_parameters] = values
        return residual(full)

    neutral = least_squares(neutral_residual, initial[neutral_parameters],
                            bounds=(lower[neutral_parameters], upper[neutral_parameters]),
                            loss='soft_l1', f_scale=.2, max_nfev=500)
    initial[neutral_parameters] = neutral.x
    fitted = least_squares(residual, initial, bounds=(lower, upper), loss='soft_l1', f_scale=.2, max_nfev=500)
    axis = np.array([fitted.x[3], fitted.x[4], 1.0])
    axis /= np.linalg.norm(axis)
    return dict(axle=axis.tolist(), degrees=float(np.degrees(np.arccos(axis[2]))),
                center=fitted.x[:3].tolist(), neutralRms=float(np.sqrt(np.mean(residual(initial) ** 2))),
                fittedRms=float(np.sqrt(np.mean(residual(fitted.x) ** 2))), converged=bool(fitted.success))


def audit(path):
    blob = open(path, 'rb').read()
    if blob[:8] != b'DECVM001':
        raise ValueError('not a DECVM001 vehicle pack')
    header_size = struct.unpack_from('<I', blob, 8)[0]
    header = json.loads(blob[12:12 + header_size])
    base = 12 + header_size
    report = dict(packSha256=hashlib.sha256(blob).hexdigest(), models={})
    for name, model in header['models'].items():
        if model.get('kind') != 'moto':
            continue
        rows = []
        for index, wheel in enumerate(model['wheels']):
            key = f'{name}.wheel{index}.tyre'
            dtype, offset, count = header['arrays'][key + '.p']
            if dtype != 'i2':
                raise ValueError('unexpected position encoding')
            position = np.frombuffer(blob, '<i2', count, base + offset).reshape(-1, 3).astype(float)
            quant = model['quant']
            position = (position + 32767) / 65534 * quant[3:] + quant[:3] - [wheel['x'], wheel['y'], wheel['z']]
            dtype, offset, count = header['arrays'][key + '.i']
            if dtype != 'u2':
                raise ValueError('unexpected index encoding')
            indices = np.frombuffer(blob, '<u2', count, base + offset).reshape(-1, 3)
            rows.append(dict(front=bool(wheel['front']), **fit_axle(position, indices, wheel['r'], wheel['width'])))
        report['models'][name] = rows
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pack', nargs='?', default='assets/vehicle-models.bin')
    parser.add_argument('--out')
    arguments = parser.parse_args()
    text = json.dumps(audit(arguments.pack), indent=2) + '\n'
    if arguments.out:
        with open(arguments.out, 'w') as target:
            target.write(text)
    else:
        print(text, end='')
