#!/usr/bin/env python3
"""Changelog fragments: one small file per change, folded in at release.

Every change adds docs/changes/<yyyy-mm-dd>-<topic>.md instead of editing
docs/CHANGELOG.md (which every agent used to append to, and conflict on):

    # Sea life: dolphins, gulls and a great white
    - Dolphin pods follow boats in open water (sealife.js); gulls ...
    - Console: DeadEndCity.sealife() ...

A title line, then a few bullets (what a player notices first, then notable
internals and console/tool changes). Keep it under ~15 lines.

    python3 tools/changelog.py                     preview the next release section
    python3 tools/changelog.py --new TOPIC "Title" start a fragment for today
    python3 tools/changelog.py --release 31.0.0 "Title"
        fold the `## Unreleased` notes and every fragment into a new
        `## 31.0.0 — Title` section at the top of docs/CHANGELOG.md, move the
        previous release section to docs/archive/CHANGELOG-archive.md (so the
        changelog only ever holds the latest release) and delete the fragments.
"""
import argparse
import datetime
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHANGES = os.path.join(ROOT, 'docs', 'changes')
LOG = os.path.join(ROOT, 'docs', 'CHANGELOG.md')
ARCHIVE = os.path.join(ROOT, 'docs', 'archive', 'CHANGELOG-archive.md')
SECTION_RX = re.compile(r'^## ', re.M)


def fragments():
    if not os.path.isdir(CHANGES):
        return []
    return sorted(os.path.join(CHANGES, f) for f in os.listdir(CHANGES)
                  if f.endswith('.md') and f != 'README.md')


def fragment_block(path):
    text = open(path, encoding='utf-8').read().strip()
    lines = text.split('\n')
    title = re.sub(r'^#+\s*', '', lines[0]).strip() if lines else os.path.basename(path)
    body = '\n'.join(lines[1:]).strip()
    return f'### {title}\n\n{body}\n' if body else f'### {title}\n'


def split_log(text):
    """(head, [sections]) where each section starts with '## '."""
    starts = [m.start() for m in SECTION_RX.finditer(text)]
    if not starts:
        return text, []
    head = text[:starts[0]]
    sections = [text[a:b] for a, b in zip(starts, starts[1:] + [len(text)])]
    return head, sections


def next_section(version=None, title=None):
    text = open(LOG, encoding='utf-8').read()
    _, sections = split_log(text)
    unreleased = [s for s in sections if s.startswith('## Unreleased')]
    parts = []
    for s in unreleased:
        body = s.split('\n', 1)[1].strip() if '\n' in s else ''
        if body:
            parts.append(body + '\n')
    parts += [fragment_block(f) for f in fragments()]
    date = datetime.date.today().isoformat()
    heading = f'## {version} — {title} ({date})' if version else '## Unreleased (preview)'
    return heading + '\n\n' + '\n'.join(parts)


def release(version, title):
    text = open(LOG, encoding='utf-8').read()
    head, sections = split_log(text)
    kept = [s for s in sections if not s.startswith('## Unreleased')]
    new = next_section(version, title).rstrip('\n') + '\n\n'
    os.makedirs(os.path.dirname(ARCHIVE), exist_ok=True)
    archive = open(ARCHIVE, encoding='utf-8').read() if os.path.exists(ARCHIVE) else '# Changelog archive\n\n'
    a_head, a_sections = split_log(archive)
    archive = a_head + ''.join(s.rstrip('\n') + '\n\n' for s in kept + a_sections)
    with open(ARCHIVE, 'w', encoding='utf-8') as fh:
        fh.write(archive.rstrip('\n') + '\n')
    with open(LOG, 'w', encoding='utf-8') as fh:
        fh.write(head + new.rstrip('\n') + '\n')
    for f in fragments():
        os.remove(f)
    print(f'released {version}: {LOG} rewritten, {len(kept)} section(s) archived, fragments removed')


def new_fragment(topic, title):
    os.makedirs(CHANGES, exist_ok=True)
    slug = re.sub(r'[^a-z0-9]+', '-', topic.lower()).strip('-')
    path = os.path.join(CHANGES, f'{datetime.date.today().isoformat()}-{slug}.md')
    if os.path.exists(path):
        sys.exit(path + ' already exists')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(f'# {title}\n- \n')
    print(os.path.relpath(path, ROOT))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--release', nargs=2, metavar=('VERSION', 'TITLE'))
    ap.add_argument('--new', nargs=2, metavar=('TOPIC', 'TITLE'))
    args = ap.parse_args()
    if args.release:
        release(*args.release)
    elif args.new:
        new_fragment(*args.new)
    else:
        sys.stdout.write(next_section())
