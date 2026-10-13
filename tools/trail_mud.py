#!/usr/bin/env python3
"""Packs the TRAIL MUD sheet (offroad3d-mud.js, offroad3d-models.js) into assets/trail-mud.webp.

Ready-made CC0 downloads (credited in docs/THIRD_PARTY_CREDITS.txt): Poly Haven's Brown Mud 03 PBR set (1K)
and sprites from Kenney's Particle Pack. The sheet is 1024 x 1024, RGB:

    top-left 512     the mud's colour map (tiling)
    top-right 512    R, G: its normal map's X and Y (OpenGL convention); B: its roughness
    bottom half      eight 256-pixel sprite cells, four across: R the sprite's coverage, G and B the X and Y
                     of a normal from its coverage seen as a height (domed lumps)

Cell order is MUD_SPRITE_CELLS in src/offroad3d-mud.js: keep them in step. Run it with -I on the downloads:

    python3 -I tools/trail_mud.py <folder> [assets/trail-mud.webp]

where the folder holds brown_mud_03_diff_1k.jpg, brown_mud_03_nor_gl_1k.jpg, brown_mud_03_rough_1k.png and
the Kenney PNGs named in CELLS.
"""
import os
import sys

from PIL import Image, ImageChops, ImageFilter

SIZE = 512
CELL = 256
# MUD_SPRITE_CELLS (offroad3d-mud.js): clumps (3), a splash, mist, a soft drop, a burst, a dense clump.
CELLS = ['dirt_01.png', 'dirt_02.png', 'dirt_03.png', 'scorch_02.png', 'smoke_08.png', 'circle_05.png', 'scorch_01.png', 'smoke_04.png']


def tile_resize(image, size):
    """Resize a tiling image without darkening its edges: 3 x 3 copies, scaled, the middle kept."""
    w, h = image.size
    big = Image.new(image.mode, (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            big.paste(image, (i * w, j * h))
    big = big.resize((size * 3, size * 3), Image.LANCZOS)
    return big.crop((size, size, size * 2, size * 2))


def sprite_cell(path):
    """Coverage in R, a domed normal's X and Y in G and B (the coverage, blurred, as a height)."""
    im = Image.open(path).convert('RGBA').resize((CELL, CELL), Image.LANCZOS)
    alpha = im.split()[3]
    lum = im.convert('L')
    # Height: the coverage, with the sprite's own shading (lighter chunk tops) added a little.
    height = ImageChops.multiply(alpha, lum.point(lambda v: 150 + v * 105 // 255))
    height = height.filter(ImageFilter.GaussianBlur(2.2))
    px = height.load()
    nx = Image.new('L', (CELL, CELL), 128)
    ny = Image.new('L', (CELL, CELL), 128)
    pnx, pny = nx.load(), ny.load()
    k = 3.2 / 255
    for y in range(CELL):
        for x in range(CELL):
            dx = (px[min(CELL - 1, x + 1), y] - px[max(0, x - 1), y]) * k
            dy = (px[x, max(0, y - 1)] - px[x, min(CELL - 1, y + 1)]) * k
            inv = 1 / (1 + dx * dx + dy * dy) ** 0.5
            pnx[x, y] = max(0, min(255, round(128 - dx * inv * 127)))
            pny[x, y] = max(0, min(255, round(128 - dy * inv * 127)))
    return Image.merge('RGB', (alpha, nx, ny))


def main():
    source = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'assets/trail-mud.webp'
    sheet = Image.new('RGB', (SIZE * 2, SIZE * 2))
    colour = Image.open(os.path.join(source, 'brown_mud_03_diff_1k.jpg')).convert('RGB')
    sheet.paste(tile_resize(colour, SIZE), (0, 0))
    normal = Image.open(os.path.join(source, 'brown_mud_03_nor_gl_1k.jpg')).convert('RGB')
    rough = Image.open(os.path.join(source, 'brown_mud_03_rough_1k.png')).convert('L')
    nx, ny, _ = tile_resize(normal, SIZE).split()
    sheet.paste(Image.merge('RGB', (nx, ny, tile_resize(rough, SIZE))), (SIZE, 0))
    for i, name in enumerate(CELLS):
        sheet.paste(sprite_cell(os.path.join(source, name)), ((i % 4) * CELL, SIZE + (i // 4) * CELL))
    sheet.save(out, 'WEBP', quality=90, method=6)
    print(out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
