#!/usr/bin/env python3
"""Stage hash-pinned Monarch sources and emit the converter's aggregate recipe.

Run from any directory. Native downloads stay in ignored work/; accepted source
attributions, file pins and editable source-specific recipes are checked in.
"""
import argparse
import hashlib
import json
import shutil
import struct
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'tools/monarch_vehicle_sources.json'


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def checked_path(name):
    path = (ROOT / name).resolve()
    if Path(name).is_absolute() or not path.is_relative_to(ROOT):
        raise ValueError('Expected a repository-relative path: ' + name)
    return path


def check_file(path, pin):
    if not path.is_file():
        raise FileNotFoundError(path)
    if 'bytes' in pin and path.stat().st_size != pin['bytes']:
        raise ValueError('Unexpected byte count: ' + str(path))
    if sha(path) != pin['sha256']:
        raise ValueError('Unexpected SHA-256: ' + str(path))


def stage_file(target, pin, imported, offline):
    if target.exists():
        check_file(target, pin)
        return 'verified-existing'
    if offline and imported is None:
        raise FileNotFoundError('Offline source is missing: ' + str(target))
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            if imported is not None:
                check_file(imported, pin)
                with imported.open('rb') as source:
                    shutil.copyfileobj(source, stream)
            else:
                request = urllib.request.Request(pin['url'], headers={'User-Agent': 'DeadEndCity-source-builder/1'})
                with urllib.request.urlopen(request, timeout=90) as response:
                    total = 0
                    for block in iter(lambda: response.read(1024 * 1024), b''):
                        total += len(block)
                        if 'bytes' in pin and total > pin['bytes']:
                            raise ValueError('Download exceeds pinned byte count: ' + pin['url'])
                        stream.write(block)
            stream.flush()
            check_file(temporary, pin)
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
    return 'imported' if imported is not None else 'downloaded'


def gltf_asset(path):
    if path.suffix == '.gltf':
        document = json.loads(path.read_text())
    else:
        with path.open('rb') as stream:
            header = stream.read(20)
            if len(header) != 20 or header[:4] != b'glTF' or header[16:20] != b'JSON':
                raise ValueError('Expected a GLB 2 JSON first chunk: ' + str(path))
            document = json.loads(stream.read(struct.unpack_from('<I', header, 12)[0]))
    return document


def source_recipes(path):
    config = json.loads(path.read_text())
    models = config.get('models', [config]) if isinstance(config, dict) else config
    return {model['key']: model for model in models}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='Comma-separated source keys; default is all ten')
    parser.add_argument('--offline', action='store_true', help='Never download; permit verified local imports')
    parser.add_argument('--check-only', action='store_true', help='Validate existing staged inputs without downloading, copying or decoding')
    parser.add_argument('--import-recipes', type=Path, help='Reuse native files from a previous aggregate recipe, checked by the canonical pins')
    parser.add_argument('--decoder', type=Path, help='Reuse an existing official decoder, checked by its pinned SHA-256')
    parser.add_argument('--out', type=Path, default=ROOT / 'work/monarch-recipes.json')
    parser.add_argument('--receipt', type=Path, default=ROOT / 'work/monarch-source-receipt.json')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    selected = set(args.only.split(',')) if args.only else {m['key'] for m in manifest['models']}
    unknown = selected - {m['key'] for m in manifest['models']}
    if unknown:
        parser.error('Unknown source keys: ' + ', '.join(sorted(unknown)))
    models = [m for m in manifest['models'] if m['key'] in selected]
    imported = source_recipes(args.import_recipes) if args.import_recipes else {}
    recipes, results = [], {}
    decoder = manifest['decoder']
    decoder_path = checked_path(decoder['path'])
    if any(m.get('preparation') for m in models):
        if args.check_only:
            check_file(decoder_path, decoder)
        else:
            stage_file(decoder_path, decoder, args.decoder, args.offline)
    for model in models:
        recipe_path = checked_path(model['recipe'])
        recipe = json.loads(recipe_path.read_text())
        if recipe['key'] != model['key'] or recipe['source'] != model['source']:
            raise ValueError('Recipe identity differs from source manifest: ' + model['key'])
        native = checked_path(model['source'])
        result = dict(recipeSHA256=sha(recipe_path), files=[])
        for entry in model['files']:
            target = (native.parent / entry['path']).resolve()
            if not target.is_relative_to(native.parent):
                raise ValueError('Companion escapes source directory: ' + entry['path'])
            candidate = None
            if model['key'] in imported:
                candidate = Path(imported[model['key']]['source']).parent / entry['path']
                if not candidate.is_absolute():
                    candidate = ROOT / candidate
            if args.check_only:
                check_file(target, entry)
                action = 'verified-existing'
            else:
                action = stage_file(target, entry, candidate, args.offline)
            result['files'].append(dict(path=str(target.relative_to(ROOT)), sha256=entry['sha256'], bytes=target.stat().st_size, action=action))
        document = gltf_asset(native)
        if document.get('asset') != model['embeddedAsset']:
            raise ValueError('Asset-specific attribution differs: ' + model['key'])
        companions = {e['uri'] for e in document.get('buffers', []) + document.get('images', []) if e.get('uri') and not e['uri'].startswith('data:')}
        pins = {entry['path']: entry['sha256'] for entry in model['files']}
        if any(uri not in pins for uri in companions):
            raise ValueError('Unpinned external glTF companion: ' + model['key'])
        if recipe['sourceSHA256'] != pins[native.name] or any(recipe.get('sourceFilesSHA256', {}).get(uri) != pins[uri] for uri in companions):
            raise ValueError('Recipe pins differ from source manifest: ' + model['key'])
        for evidence in model['licenseEvidence']:
            check_file(checked_path(evidence['path']), evidence)
        preparation = model.get('preparation')
        if preparation:
            decoded = checked_path(preparation['output'])
            if not decoded.exists() and not args.check_only:
                subprocess.run(['node', str(ROOT / 'tools/monarch_vehicle_decode.cjs'), str(native), str(decoded), str(decoder_path.parent)], check=True, stdout=subprocess.PIPE, text=True)
            check_file(decoded, preparation)
            if recipe.get('preparedSource') != preparation['output'] or recipe.get('preparedSHA256') != preparation['sha256']:
                raise ValueError('Prepared source pin differs from recipe: ' + model['key'])
            decode_receipt = Path(str(decoded) + '.decode-receipt.json')
            proof = json.loads(decode_receipt.read_text())
            if proof['input']['sha256'] != recipe['sourceSHA256'] or proof['output']['sha256'] != preparation['sha256'] or proof['decoder']['sha256'] != decoder['sha256']:
                raise ValueError('Meshopt preparation receipt differs: ' + model['key'])
            check_file(native, dict(sha256=recipe['sourceSHA256']))
            result['preparation'] = dict(path=preparation['output'], sha256=preparation['sha256'], decoderSHA256=decoder['sha256'], receiptSHA256=sha(decode_receipt))
        recipes.append(recipe)
        results[model['key']] = result
    if not args.check_only:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(dict(models=recipes), indent=2) + '\n')
    receipt = dict(manifestSHA256=sha(MANIFEST), stagerSHA256=sha(Path(__file__)), checkOnly=args.check_only, models=results)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'pass': True, 'models': len(models), 'nativeFiles': sum(len(m['files']) for m in models), 'recipe': str(args.out) if not args.check_only else None, 'receipt': str(args.receipt)}))


if __name__ == '__main__':
    main()
