#!/usr/bin/env python3
"""Rebuild the KUZUKI600R's CC0 Japanese inline-four loops (ffmpeg + numpy).
Pinned public mirrors, with SHA-256 verification; source recordings stay in work/.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'work' / 'sportbike-source'
RATE = 44100
SOURCES = [
    ('zx6r.mp3', 'https://raw.githubusercontent.com/alfredr/thirty-phantom/83cdeea54cf2d1c5da96e80e85d772037bae0c61/public/audio/engine-bike.mp3', '76b6bce2b73d0b2406c8f6562e466a0f24541bda79abb9f0ae55b276c66f3f20'),
    ('suzuki-high-clean.wav', 'https://raw.githubusercontent.com/web3-engineer/zaeon-os/07d3a67215bd3814436994bcbb38816f80ef65ef/public/assets/sounds/cyber/moto-motor-alto.wav', 'ba830b92d3a93edff0ba78149a3d1ad1d946a7b624d12649eec32f6df4ec5f9c'),
]

def source(name, url, sha):
    path = WORK / name
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    if hashlib.sha256(path.read_bytes()).hexdigest() != sha:
        raise ValueError('Source checksum differs: ' + name)
    return path

def loop(name, src, start, seconds, crossfade, root, rms):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(src), '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-'])
    x = np.frombuffer(raw, dtype='<f4').astype(np.float64)
    x = x[round(start * RATE):round((start + seconds + crossfade) * RATE)]
    n = round(seconds * RATE)
    if len(x) < n:
        raise ValueError('Source too short: ' + name)
    # Remove DC and gently remove subsonic rumble with an FFT-domain roll-off.
    f = np.fft.rfftfreq(len(x), 1 / RATE)
    x = np.fft.irfft(np.fft.rfft(x - x.mean()) * f * f / (f * f + 28 ** 2), n=len(x))
    if crossfade:
        m = min(round(crossfade * RATE), len(x) - n)
        w = np.linspace(0, 1, m, endpoint=False)
        x[:m] = x[n:n + m] * (1 - w) + x[:m] * w
    x = x[:n]
    x *= rms / np.sqrt(np.mean(x * x))
    # Headroom is checked before encoding. Append 0.2 s of its own beginning;
    # LOOP_SECONDS keeps decoder padding outside the actual circular loop.
    if abs(x).max() > 0.8:
        raise ValueError('Loop peak too high: ' + name)
    pcm = np.concatenate([x, np.resize(x, round(0.2 * RATE))]).astype('<f4')
    out = ROOT / 'assets' / (name + '.ogg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-c:a', 'libvorbis', '-q:a', '5', '-map_metadata', '-1', str(out)], input=pcm.tobytes(), check=True)
    return dict(file=str(out.relative_to(ROOT)), rootRpm=root, loopSeconds=seconds, rms=float(np.std(x)), peak=float(abs(x).max()), sha256=hashlib.sha256(out.read_bytes()).hexdigest())

def main():
    WORK.mkdir(parents=True, exist_ok=True)
    idle, high = [source(*s) for s in SOURCES]
    # ZX6R: settled warm idle ~38 Hz firing (4 cylinders / 2 revolutions).
    # Suzuki: mirror stabilized its apparent firing pitch to 300 Hz. Roots are
    # spectral equivalents, not an unsupported measurement of the bikes' tachos.
    result = [loop('engine-inline4-idle', idle, 7.05, 2.0, 0.08, 1140, 0.12),
              loop('engine-inline4-high', high, 0, 1.25, 0, 9000, 0.12)]
    (WORK / 'conversion-receipt.json').write_text(json.dumps(dict(sources=[dict(file=n, url=u, sha256=h) for n,u,h in SOURCES], loops=result), indent=2) + '\n')
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
