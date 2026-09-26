#!/usr/bin/env python3
"""Generate docs/FILEMAP.md: one line per source file, grouped by include tree.

    python3 tools/filemap.py           rewrite docs/FILEMAP.md
    python3 tools/filemap.py --check   exit 1 if the map is stale (files added,
                                       removed, moved or re-described); line
                                       counts are ignored so small edits never
                                       make it stale

Each line is `path  lines  purpose`. The purpose is taken, in order, from:
  1. the file's own `// BEGIN SUBSYSTEM: src/x.js — Title` banner,
  2. the comment the file opens with (its header: 1-3 lines saying what it
     holds and its main entry points),
  3. the comment directly above its `// @include` line in the parent,
  4. the names it declares at top level ("defines a, b, c"),
with OVERRIDES (below) consulted right after step 1. Improve a description by
editing the file's header comment (and dropping any override), then rerun.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'FILEMAP.md')
INCLUDE_RX = re.compile(r'^\s*// @include (src/[\w.-]+\.js)\s*$')
BANNER_RX = re.compile(r'//\s*BEGIN SUBSYSTEM: src/[\w.-]+\.js\s*[—-]+\s*(.+)$')
DECL_RX = re.compile(r'^\s*(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))')
UI_CSS_RX = re.compile(r'^\s*/\* @include (src/[\w./-]+\.css) \*/\s*$')
UI_HTML_RX = re.compile(r'^\s*<!-- @include (src/[\w./-]+\.html) -->\s*$')
INCLUDE_ANY_RX = re.compile(r'^\s*(/\*|<!--) @include')
SHELL_TEXT = ('HTML page skeleton: its src/ui/*.css and *.html fragments (in include order) and '
              'build.py\'s `<!-- @include-* -->` slots (game, three.js, media, credits)')
MAX = 150

# Descriptions for files whose source does not (yet) open with a describing
# comment. A file's own `BEGIN SUBSYSTEM` banner still wins; better still, add
# a header comment to the source and delete the entry here.
OVERRIDES = {
    'src/game-menus.js': 'resize, begin/newGame, pause, help, big map toggle',
    'src/game-console.js': 'window.DeadEndCity developer console, part 1 of 3 (one object literal across game-console*.js; only valid together)',
    'src/game-console-world.js': 'DeadEndCity console part 2 of 3: ride, simulate, bikes, world/vehicle probes',
    'src/game-console-graphics.js': 'DeadEndCity console part 3 of 3: damage tests, lineups, graphics, settings, radio',
    'src/render3d-statics.js': 'static building batches, static cells and culling (staticInView), shared materials',
    'src/render3d-terrain.js': 'mesh/box/rod helpers, wall textures, the ground mesh and kerbs',
    'src/render3d-streetprops.js': 'street lamps and their glow halos, vehicle halos, blossom, sign() boards',
    'src/render3d-vehicle-models.js': 'makeVehicle()/buildVehicleModel(), modelScale, car rims, sniper sights',
    'src/render3d-effects.js': 'player/objective rings, arrows, muzzle and head lights, smoke and flame sprites',
    'src/render3d-resources.js': 'GPU resource lifecycle: shared geometries, model pruning and disposal',
    'src/render3d-api.js': 'the object the renderer returns (city3D.*): draw API and debug/info hooks',
    'src/render3d-frame.js': 'render(): the per-frame 3D draw, split CPU timings for DeadEndCity.stats()',
}


def lines_of(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read().rstrip('\n').split('\n')


def clean(text):
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'^[-=*#\s]+|[-=*#\s]+$', '', text)  # ---- rulers ----
    return text


def first_sentence(text):
    m = re.match(r'(.+?[.!?])(\s|$)', text)
    return m.group(1) if m and len(m.group(1)) > 25 else text


def summarise(comment_lines):
    """A title plus the first sentence after it, or the first sentence."""
    body = []
    for raw in comment_lines:
        s = raw.strip()
        s = re.sub(r'^(/\*\*?|\*/|\*|//+)', '', s)
        s = re.sub(r'\*/$', '', s).strip()
        if s.startswith('Source:') or s.startswith('Scope:'):
            continue
        body.append(clean(s) if re.fullmatch(r'[-=*#\s]*', s) is None else '')
    while body and not body[0]:
        body.pop(0)
    if not body:
        return ''
    head, tail = body[0], body[1:]
    para = []
    for s in tail:
        if not s:
            if para:
                break
            continue
        para.append(s)
    nxt = para[0] if para else ''
    title = None
    if head.isupper() and len(head) < 60:
        title = head.capitalize()
    elif not re.search(r'[.:;,!?]$', head) and nxt[:1].isupper() and len(head) < 70:
        title = head  # a title line above a paragraph
    if title:
        rest = first_sentence(' '.join(para))
        text = title + (': ' + rest if rest else '')
    else:
        text = first_sentence(' '.join([head] + para))
    m = re.match(r"([A-Z0-9][A-Z0-9 &'/-]{3,}):(.*)", text)
    if m and m.group(1).strip().isupper():
        text = m.group(1).capitalize() + ':' + m.group(2)
    if len(text) > MAX:
        text = text[:MAX].rsplit(' ', 1)[0].rstrip(',;:') + ' …'
    return text


def comment_above(parent_lines, idx):
    """The comment block that ends on the line right above parent_lines[idx]."""
    i = idx - 1
    if i < 0:
        return []
    s = parent_lines[i].strip()
    if s.endswith('*/'):
        j = i
        while j >= 0 and '/*' not in parent_lines[j]:
            j -= 1
        return parent_lines[max(j, 0):i + 1]
    if s.startswith('//') and not INCLUDE_RX.match(parent_lines[i]):
        j = i
        while j - 1 >= 0 and parent_lines[j - 1].strip().startswith('//') \
                and not INCLUDE_RX.match(parent_lines[j - 1]):
            j -= 1
        return parent_lines[j:i + 1]
    return []


def first_comment(lines):
    for i, line in enumerate(lines[:40]):
        s = line.strip()
        if s.startswith('/*'):
            j = i
            while j < len(lines) and '*/' not in lines[j]:
                j += 1
            return lines[i:j + 1]
        if s.startswith('//') and not INCLUDE_RX.match(line):
            j = i
            while j + 1 < len(lines) and lines[j + 1].strip().startswith('//') \
                    and not INCLUDE_RX.match(lines[j + 1]):
                j += 1
            return lines[i:j + 1]
    return []


def declared_names(lines):
    indents = [len(l) - len(l.lstrip()) for l in lines if l.strip()]
    base = min(indents) if indents else 0
    names = []
    for line in lines:
        if len(line) - len(line.lstrip()) != base:
            continue
        m = DECL_RX.match(line)
        if m:
            name = m.group(1) or m.group(2)
            if name not in names:
                names.append(name)
    return names


def purpose(rel, lines, above):
    for line in lines[:3]:
        m = BANNER_RX.search(line)
        if m:
            return clean(m.group(1))
    if rel in OVERRIDES:
        return OVERRIDES[rel]
    names = declared_names(lines)
    defines = ('defines ' + ', '.join(names[:4]) + (', …' if len(names) > 4 else '')) if names else ''
    top = next((l for l in lines if l.strip()), '')
    text = summarise(first_comment(lines))
    if len(text) > 8 and top.strip().startswith(('/*', '//')):
        return text  # the file opens with a comment: its own description
    above_text = summarise(above) if above else ''
    if len(above_text) > 8 and not above_text[:1].islower() and not above_text.startswith('('):
        return above_text
    if len(text) > 8 and defines:
        return defines + ' · ' + text
    return defines or text


def walk():
    """(rel, depth, parent, lines, above) for every file in include order."""
    out = []

    def visit(rel, depth, parent, above):
        lines = lines_of(rel)
        out.append((rel, depth, parent, lines, above))
        for i, line in enumerate(lines):
            m = INCLUDE_RX.match(line)
            if m:
                visit(m.group(1), depth + 1, rel, comment_above(lines, i))

    visit('src/main.js', 0, None, [])
    return out


def ui_purpose(rel, lines, above):
    """A src/ui fragment: its opening comment (/* */ or <!-- -->), the comment
    above its include line, or the first selectors / element ids it holds."""
    def strip_html(block):
        return [re.sub(r'<!--|-->', '', l) for l in block]

    def opening(ls):
        for i, line in enumerate(ls[:40]):
            s = line.strip()
            if not s:
                continue
            for start, end in (('/*', '*/'), ('<!--', '-->')):
                if s.startswith(start):
                    j = i
                    while j < len(ls) and end not in ls[j]:
                        j += 1
                    return strip_html(ls[i:j + 1])
            return []
        return []

    text = summarise(opening(lines))
    if len(text) > 8:
        return text
    text = summarise(strip_html(above))
    if len(text) > 8 and not INCLUDE_ANY_RX.match(above[-1] if above else ''):
        return text
    if rel.endswith('.css'):
        sels = []
        for line in lines:
            m = re.match(r'^\s{0,6}([^\s{}/*@][^{}]*?)\s*\{\s*$', line)
            if m and m.group(1) not in sels:
                sels.append(m.group(1))
        return 'styles: ' + ', '.join(sels[:4]) + (', …' if len(sels) > 4 else '') if sels else 'styles'
    ids = []
    for line in lines:
        ids += ['#' + i for i in re.findall(r'\bid="([\w-]+)"', line)]
    return 'markup: ' + ', '.join(ids[:5]) + (', …' if len(ids) > 5 else '') if ids else 'markup'


def walk_ui():
    """(rel, parent, lines, above) for src/shell.html's CSS/HTML fragments, in order."""
    out = []
    if not os.path.isfile(os.path.join(ROOT, 'src', 'shell.html')):
        return out

    def visit(rel, parent, seen):
        lines = lines_of(rel)
        for i, line in enumerate(lines):
            m = UI_CSS_RX.match(line) or UI_HTML_RX.match(line)
            if not m or m.group(1) in seen:
                continue
            child = m.group(1)
            seen.add(child)
            if not os.path.isfile(os.path.join(ROOT, child)):
                continue
            j, above = i - 1, []
            while j >= 0 and re.match(r'^\s*(<!--|/\*|\*|-->)', lines[j]) and not INCLUDE_ANY_RX.match(lines[j]):
                above.insert(0, lines[j])
                j -= 1
            child_lines = lines_of(child)
            out.append((child, rel, child_lines, above))
            visit(child, child, seen)

    visit('src/shell.html', None, set())
    return out


def render(with_counts=True):
    entries = walk()
    children = {}
    for rel, depth, parent, lines, above in entries:
        children.setdefault(parent, []).append(rel)
    info = {rel: (len(lines), purpose(rel, lines, above)) for rel, _, _, lines, above in entries}
    parents = [rel for rel, *_ in entries if rel in children]
    ui = walk_ui()
    included = set(info) | {rel for rel, *_ in ui}
    loose = sorted(f for f in os.listdir(os.path.join(ROOT, 'src'))
                   if 'src/' + f not in included and os.path.isfile(os.path.join(ROOT, 'src', f)))
    ui_dir = os.path.join(ROOT, 'src', 'ui')
    if os.path.isdir(ui_dir):
        loose += sorted('ui/' + f for f in os.listdir(ui_dir)
                        if 'src/ui/' + f not in included and os.path.isfile(os.path.join(ui_dir, f)))

    def row(rel, count, text):
        num = f'{count:>5}' if with_counts else '    -'
        return f'- `{rel}` {num} — {text}'

    out = [
        '# File map',
        '',
        'Generated by `python3 tools/filemap.py` — do not edit by hand. Each line: path,',
        'line count, purpose (from the file\'s banner, the comment above its `// @include`',
        'line, or its first comment). Better purpose? Edit that comment in the source and',
        'rerun. Merge conflict here? Take either side and rerun the tool.',
        '',
        'Grep this file first: `grep -i crowd docs/FILEMAP.md`. Sections follow the include',
        'tree from src/main.js; a file that is itself an include list has its own section',
        '(marked ▸). Files are listed in build order, so order matters (a `const` must be',
        'included before code that runs at load time and reads it). The CSS/HTML fragments',
        'src/shell.html includes (src/ui/) have their own section after the scripts.',
        '',
        f'{len(entries)} files in the include tree, '
        f'{sum(c for c, _ in info.values()):,} lines.' if with_counts else
        f'{len(entries)} files in the include tree.',
    ]
    for parent in parents:
        count, text = info[parent]
        out += ['', f'## {parent} ▸ {text}', '']
        for rel in children[parent]:
            c, t = info[rel]
            if rel in children:
                t = '▸ ' + t
            out.append(row(rel, c, t))
    if ui:
        out += ['', f'## src/shell.html ▸ {SHELL_TEXT}', '']
        for rel, parent, lines, above in ui:
            prefix = f'(in {parent[4:]}) ' if parent != 'src/shell.html' else ''
            out.append(row(rel, len(lines), prefix + ui_purpose(rel, lines, above)))
    out += ['', '## Outside the include tree', '']
    for f in loose:
        rel = 'src/' + f
        lines = lines_of(rel)
        if f == 'shell.html':
            text = SHELL_TEXT
        elif f == 'asset-loader.js':
            text = 'decodes the embedded/streamed media into ASSETS before the game starts'
        elif f.startswith('ui/'):
            text = 'NOT INCLUDED by src/shell.html — dead fragment? ' + ui_purpose(rel, lines, [])
        else:
            text = purpose(rel, lines, []) or 'NOT INCLUDED ANYWHERE — dead file?'
        out.append(row(rel, len(lines), text))
    return '\n'.join(out) + '\n'


def strip_counts(text):
    text = re.sub(r'^\d+ files in the include tree.*$', '', text, flags=re.M)
    return re.sub(r'^(- `[^`]+`) +[\d-]+ —', r'\1 —', text, flags=re.M)


def main():
    fresh = render()
    if '--check' in sys.argv:
        try:
            with open(OUT, encoding='utf-8') as fh:
                current = fh.read()
        except FileNotFoundError:
            current = ''
        if strip_counts(current) != strip_counts(fresh):
            print('docs/FILEMAP.md is stale: run python3 tools/filemap.py', file=sys.stderr)
            sys.exit(1)
        print('FILEMAP up to date')
        return
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write(fresh)
    print(f'wrote docs/FILEMAP.md ({fresh.count(chr(10))} lines)')


if __name__ == '__main__':
    main()
