#!/usr/bin/env python3
"""Packs the WALL SKIN texture layers (cityscape3d-wallskin.js) into assets/wall-skin.webp.

The layers are ready-made CC0 PBR sets (ambientCG, credited in docs/THIRD_PARTY_CREDITS.txt), downloaded at
1K. Each layer is one 512-pixel row of the sheet: the colour map (its ambient occlusion multiplied in) on the
left, and on the right the normal map's X and Y (OpenGL convention) in R and G with the roughness in B.
Rows are flipped so the shader's v runs up the wall. Run it with -I on untrusted downloads:

    python3 -I tools/wall_skin.py <folder holding the sets> [assets/wall-skin.webp]

where the folder holds one sub-folder per set (any of color/albedo, normal/normalgl, roughness, ao files).
"""
import os
import sys

from PIL import Image, ImageChops

SIZE = 512
# Layer order is the shader's (WALL_SKIN_LAYERS in src/cityscape3d-wallskin.js): keep them in step.
LAYERS = [
    ('Bricks059', 'bricks_red'),
    ('Concrete034', 'concrete'),
    ('CorrugatedSteel005', 'corrugatedsteel005'),
    ('Plaster003', 'plaster_rough'),
    ('RoofingTiles014A', 'roof_tiles_clay_b'),
]


def find(folder, *prefixes):
    for name in sorted(os.listdir(folder)):
        low = name.lower()
        if low.endswith(('.jpg', '.png')) and low.startswith(prefixes):
            return os.path.join(folder, name)
    return None


def tile_resize(image):
    """Resize a tiling image to SIZE square without darkening its edges: 3 x 3 copies, scaled, the middle kept."""
    w, h = image.size
    big = Image.new(image.mode, (w * 3, h * 3))
    for i in range(3):
        for j in range(3):
            big.paste(image, (i * w, j * h))
    big = big.resize((SIZE * 3, SIZE * 3), Image.LANCZOS)
    return big.crop((SIZE, SIZE, SIZE * 2, SIZE * 2))


def main():
    source = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'assets/wall-skin.webp'
    sheet = Image.new('RGB', (SIZE * 2, SIZE * len(LAYERS)))
    for row, (set_id, folder_name) in enumerate(LAYERS):
        folder = os.path.join(source, folder_name)
        colour = Image.open(find(folder, 'color', 'albedo', 'diffuse')).convert('RGB')
        ao_path = find(folder, 'ao', 'ambientocclusion')
        if ao_path:
            colour = ImageChops.multiply(colour, Image.open(ao_path).convert('RGB').resize(colour.size))
        normal = Image.open(find(folder, 'normalgl', 'normal')).convert('RGB').resize(colour.size)
        rough = Image.open(find(folder, 'roughness')).convert('L').resize(colour.size)
        nx, ny, _ = normal.split()
        packed = Image.merge('RGB', (nx, ny, rough))
        flip = Image.FLIP_TOP_BOTTOM
        sheet.paste(tile_resize(colour).transpose(flip), (0, row * SIZE))
        sheet.paste(tile_resize(packed).transpose(flip), (SIZE, row * SIZE))
        print(row, set_id, folder_name)
    sheet.save(out, 'WEBP', quality=86, method=6)
    print(out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
