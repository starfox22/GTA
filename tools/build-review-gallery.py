#!/usr/bin/env python3
"""Copy the checked-in native review evidence into a static Pages gallery."""
import html
import hashlib
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
CURRENT_AUDIT = ROOT / 'docs/audit/m4-utility-review-2026-10-17'
HISTORY = [
    ('svj-handling', ROOT / 'docs/audit/svj-handling-review-2026-10-17', 'Brutini SVJ and earlier motorcycle handling'),
    ('wheelie-rider', ROOT / 'docs/audit/wheelie-rider-review-2026-10-16', 'Wheelie controls, achievements and rider motion'),
    ('impact-motorcycle', ROOT / 'docs/audit/impact-motorcycle-review-2026-10-16', 'Vehicle impacts and motorcycles'),
    ('police-aviation', ROOT / 'docs/audit/police-aviation-review-2026-10-15', 'Police and aviation'),
]


def build_gallery(audit, target, play_version, game_path):
    data = json.loads((audit / 'gallery.json').read_text())
    native = json.loads((audit / 'verification/gallery-image-manifest.json').read_text())
    native = {row['file']: row for row in native['files']}
    expected_images = {row[phase] for row in data['comparisons'] for phase in ('before', 'after')}
    expected_images.update(row['file'] for row in data.get('screenshots', []))
    if set(native) != expected_images:
        raise ValueError('Native screenshot receipt does not cover the complete gallery')
    target.mkdir(parents=True, exist_ok=True)
    copied = set()

    def asset(name):
        source = (audit / name).resolve()
        if not source.is_relative_to(audit.resolve()) or not source.is_file():
            raise ValueError('Missing or invalid review evidence: ' + name)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if name in expected_images and native[name]['sha256'] != digest:
            raise ValueError('Native screenshot digest differs from its capture receipt: ' + name)
        if name not in copied:
            destination = target / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
            # Preserve image/audio links from the preceding review messages.
            if audit != CURRENT_AUDIT:
                legacy = target.parent / name
                legacy.parent.mkdir(parents=True, exist_ok=True)
                if legacy.exists() and legacy.read_bytes() != source.read_bytes():
                    raise ValueError('Review history asset collision: ' + name)
                shutil.copyfile(source, legacy)
            copied.add(name)
        return html.escape(name, quote=True) + '?sha=' + digest

    sections = []
    for number, row in enumerate(data['comparisons'], 1):
        pictures = []
        for label in ('before', 'after'):
            url = asset(row[label])
            pictures.append(f'<figure><figcaption>{label.title()}</figcaption>'
                            f'<a href="{url}"><img loading="lazy" src="{url}" '
                            f'alt="{html.escape(row["title"])} — {label}" width="740" height="500"></a></figure>')
        sections.append(f'<section id="comparison-{number}"><h2>{html.escape(row["title"])}</h2><p>{html.escape(row["description"])}</p>'
                        f'<div class="comparison">{"".join(pictures)}</div></section>')
    for number, row in enumerate(data.get('screenshots', []), 1):
        url = asset(row['file'])
        sections.append(f'<section id="screenshot-{number}"><h2>{html.escape(row["title"])}</h2><p>{html.escape(row["description"])}</p>'
                        f'<figure class="single"><a href="{url}"><img loading="lazy" src="{url}" '
                        f'alt="{html.escape(row["title"])}"></a></figure></section>')
    sounds = []
    for row in data.get('sounds', []):
        sounds.append(f'<li>{html.escape(row["title"])}<audio controls preload="none" src="{asset(row["file"])}"></audio></li>')
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dead End City — police and aviation review</title><style>
:root{color-scheme:dark;font:16px/1.5 system-ui,sans-serif;background:#111820;color:#eaf0f5}body{max-width:1520px;margin:auto;padding:24px}
a{color:#9cd9ff}h1{font-size:1.8rem}h2{margin-bottom:8px}section{margin:40px 0}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px}
figure{margin:0;background:#1c2733;border-radius:8px;overflow:hidden}.single{max-width:1000px}figcaption{padding:8px 12px;font-weight:600}img{display:block;width:100%;height:auto}
audio{display:block;max-width:100%;margin:8px 0 20px}ul{padding-left:24px}@media(max-width:800px){body{padding:16px}.comparison{grid-template-columns:1fr}}
</style><h1>Dead End City — police and aviation review</h1>
<p><a href="../">Play the game</a> · <a href="https://github.com/starfox22/GTA/tree/codex-reviews/docs/audit/police-aviation-review-2026-10-15">Full change list, licences and verification</a></p>
<nav aria-label="Review sections"><a href="#comparison-1">Police</a> · <a href="#comparison-10">Hot rod</a> · <a href="#comparison-12">Jets</a> · <a href="#comparison-14">Airport parking</a> · <a href="#comparison-16">Trail</a> · <a href="#screenshot-1">Cabin and controls</a> · <a href="#engine-sounds">Sounds</a></nav>
<p>Original game screenshots at matched camera positions, clear weather and 13:00. Click any image to open its full native size.
Before is the previous published build (d75acc1). Detailed comparisons use the game's inspection camera.
Additional runtime screenshots retain their recorded gameplay states. Technical limits and capture inputs are recorded in the linked audit.</p>'''
    title = data.get('title', 'Dead End City — police and aviation review')
    intro = data.get('introduction')
    if intro:
        begin = page.index('<nav aria-label=')
        page = page[:begin] + '<p>' + html.escape(intro) + '</p>'
    page = page.replace('Dead End City — police and aviation review', html.escape(title))
    page = page.replace('docs/audit/police-aviation-review-2026-10-15', audit.relative_to(ROOT).as_posix())
    page = page.replace('href="../"', f'href="{game_path}?review={play_version}"', 1)
    prefix = '' if audit == CURRENT_AUDIT else '../'
    links = [f'<a href="{prefix}{folder}/">{html.escape(label)}</a>'
             for folder, prior, label in HISTORY if prior != audit]
    if audit != CURRENT_AUDIT:
        links.insert(0, '<a href="../">Latest game review</a>')
    page += '<p>' + ' · '.join(links) + '</p>'
    page += ''.join(sections)
    if sounds:
        sound_description = data.get('soundDescription', 'Offline renders of the actual production Web Audio graph: idle, spool up, full power and cutoff. These are sound demonstrations, not recordings of a play session.')
        page += '<section id="engine-sounds"><h2>Engine sound samples</h2><p>' + html.escape(sound_description) + '</p><ul>' + ''.join(sounds) + '</ul></section>'
    page += '</html>\n'
    (target / 'index.html').write_text(page)
    print(f'{audit.name} gallery: {len(data["comparisons"])} comparisons, {len(data.get("screenshots", []))} additional screenshots, {len(sounds)} sounds, {len(copied)} evidence files')


def main():
    game = Path(sys.argv[1])
    version = hashlib.sha256((game / 'index.html').read_bytes()).hexdigest()[:16]
    build_gallery(CURRENT_AUDIT, game / 'review', version, '../')
    for folder, audit, _ in HISTORY:
        build_gallery(audit, game / 'review' / folder, version, '../../')


if __name__ == '__main__':
    main()
