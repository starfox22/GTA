"""Repainting downloaded avatars for tools/npc_models.py: texture edits of the Rocketbox colour maps (MIT), no new art.

Every edit works in 3D through a bake of the body page (each texel's bind position and part, from the mesh), like the
player's restyle (tools/player_model.py): a hi-vis or tactical vest painted over the torso with reflective bands, a
patch's lettering replaced (POLICE -> FED), letters across the back, and the tint mask: the share of each texel that
is the top garment (shirt, hoodie, jacket, kit), which the game recolours per person (gang colours, kits) in the
shader. The mask rides in the atlas' alpha (255 none, 128 all; hair cards keep their own alpha in their own cells).
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
BAKE = 512


def bake(entry, mi, size=BAKE):
    """Per texel of material mi's page: bind position (metres; -9 where no surface) and part (-1 none)."""
    pos = np.full((size, size, 3), -9.0, np.float32)
    part = np.full((size, size), -1, np.int16)
    P, uv, vmat = entry['P'], entry['uv'], entry['vmat']
    parts = entry['skin'][:, 3].astype(np.int16)
    X = uv[:, 0] * size - 0.5
    Y = (1 - uv[:, 1]) * size - 0.5
    for a, b, c in entry['index'].reshape(-1, 3):
        if vmat[a] != mi:
            continue
        xs, ys = X[[a, b, c]], Y[[a, b, c]]
        x0, x1 = max(0, int(np.floor(xs.min()))), min(size - 1, int(np.ceil(xs.max())))
        y0, y1 = max(0, int(np.floor(ys.min()))), min(size - 1, int(np.ceil(ys.max())))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(d) < 1e-12:
            continue
        l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
        l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
        l2 = 1 - l0 - l1
        m = (l0 > -0.03) & (l1 > -0.03) & (l2 > -0.03)
        if not m.any():
            continue
        L = np.stack([l0, l1, l2], -1)[m]
        pos[gy[m], gx[m]] = L @ P[[a, b, c]]
        part[gy[m], gx[m]] = parts[[a, b, c]][np.argmax(L, 1)]
    # Grow into the gutters so filtering never reads an unpainted texel.
    for _ in range(6):
        empty = part < 0
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            src = np.roll(np.roll(part, dy, 0), dx, 1)
            take = empty & (src >= 0)
            if take.any():
                part[take] = src[take]
                pos[take] = np.roll(np.roll(pos, dy, 0), dx, 1)[take]
            empty = part < 0
    return pos, part


def blur(x, r):
    """A small box blur (r texels) of a 2D float map."""
    out = x.astype(np.float64)
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for k in range(-r, r + 1):
            acc += np.roll(out, k, axis)
        out = acc / (2 * r + 1)
    return out


def up(x, size):
    """A bake-sized map to the page's size (bilinear)."""
    return np.asarray(Image.fromarray(x.astype(np.float32), 'F').resize((size, size), Image.BILINEAR), dtype=np.float64)


def srgb_lin(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lum(c):
    return c[..., 0] * 0.2126 + c[..., 1] * 0.7152 + c[..., 2] * 0.0722


def joints(entry):
    """Heights (metres) the painters use: hip, shoulder, and the shoulders' half width."""
    B = entry['frames']
    hip = B[0]['o'][1]
    sh = (B[3]['o'][1] + B[4]['o'][1]) / 2
    half = abs(B[4]['o'][2] - B[3]['o'][2]) / 2
    return hip, sh, half


def tint_mask(entry, mi, hood=False, kit=False):
    """The top garment's share of each texel of the body page (0..1, page size) and its mean linear luminance. A `kit`
    (a striped football shirt) is the whole shirt whatever its colours: its stripes come out light and dark of the tint."""
    im = entry['pages'][mi]
    size = im.size[0]
    pos, part = bake(entry, mi)
    col = np.asarray(im.convert('RGB').resize((BAKE, BAKE), Image.BILINEAR), np.float64) / 255
    hip, sh, half = joints(entry)
    top_parts = [1, 3, 4, 5, 6] + ([2] if hood else [])
    cand = np.isin(part, top_parts)
    chest = (part == 1) & (pos[..., 1] > hip + 0.3 * (sh - hip)) & (pos[..., 1] < hip + 0.85 * (sh - hip))
    ref = np.median(col[chest], axis=0)
    skin = np.asarray([int(entry['palette']['skin'][i:i + 2], 16) for i in (1, 3, 5)], np.float64) / 255

    def chroma(c):
        return np.stack([c[..., 0] - c[..., 1], (c[..., 0] + c[..., 1]) / 2 - c[..., 2]], -1)

    L = lum(col) + 1e-3
    Lr = lum(ref) + 1e-3
    dc = np.linalg.norm(chroma(col) - chroma(ref), axis=-1)
    ratio = L / Lr
    w = np.exp(-((dc / 0.07) ** 2)) * np.clip(1.6 - np.abs(np.log(ratio)) / 1.2, 0, 1)
    ds = np.linalg.norm(col - skin, axis=-1)
    if kit:
        w = np.ones_like(w)
    w *= np.clip((ds - 0.08) / 0.1, 0, 1)
    mask = blur(np.where(cand, np.clip(w * 1.4, 0, 1), 0), 1)
    big = np.clip(up(mask, size), 0, 1)
    sel = big > 0.5
    ref_lin = float(np.mean(lum(srgb_lin(np.asarray(im.convert('RGB'), np.float64)[sel] / 255)))) if sel.any() else 0.2
    return big, max(ref_lin, 0.01)


def vest(entry, mi, color, bands=None, tintable=False, letters=None, letter_color='#f2f2ee'):
    """Paint a vest over the torso (between the hips and the shoulders), reflective bands round it, letters across
    the back. Returns the vest's tint mask (page size) when `tintable` (the bands and letters stay untinted)."""
    im = entry['pages'][mi]
    size = im.size[0]
    pos, part = bake(entry, mi)
    hip, sh, half = joints(entry)
    y = pos[..., 1]
    region = (part == 1) & (y > hip + 0.07) & (y < sh + 0.03)
    # Not the neck's collar: inside a cylinder round the neck above the shoulders' line less 6 cm.
    nx, nz = entry['frames'][2]['o'][0], entry['frames'][2]['o'][2]
    r = np.hypot(pos[..., 0] - nx, pos[..., 2] - nz)
    region &= ~((y > sh - 0.06) & (r < 0.085))
    soft = blur(region.astype(np.float64), 1)
    page = np.asarray(im.convert('RGB'), np.float64) / 255
    shade = lum(page)
    S = up(soft, size)
    sel = S > 0.5
    ref = np.median(shade[sel]) if sel.any() else 0.5
    k = np.clip(0.55 + 0.45 * shade / max(ref, 1e-3), 0.55, 1.2)[..., None]
    base = np.asarray([int(color[i:i + 2], 16) for i in (1, 3, 5)], np.float64) / 255
    painted = base * k
    bandmask = np.zeros((size, size))
    if bands:
        band = np.zeros((BAKE, BAKE))
        for h, wdt in bands:
            yy = hip + h * (sh - hip)
            band = np.maximum(band, (np.abs(y - yy) < wdt / 2) & region)
        bandmask = np.clip(up(blur(band, 1), size), 0, 1)
        silver = np.asarray([0.80, 0.82, 0.83]) * np.clip(0.75 + 0.25 * shade / max(ref, 1e-3), 0.7, 1.1)[..., None]
        painted = painted * (1 - bandmask[..., None]) + silver * bandmask[..., None]
    lettermask = np.zeros((size, size))
    if letters:
        lettermask = back_letters(pos, part, hip, sh, letters, size)
        lc = np.asarray([int(letter_color[i:i + 2], 16) for i in (1, 3, 5)], np.float64) / 255
        painted = painted * (1 - lettermask[..., None]) + lc * lettermask[..., None]
    out = page * (1 - S[..., None]) + painted * S[..., None]
    rgba = np.asarray(im, np.uint8).copy()
    rgba[..., :3] = np.clip(np.round(out * 255), 0, 255).astype(np.uint8)
    entry['pages'][mi] = Image.fromarray(rgba, 'RGBA')
    if not tintable:
        return None
    return np.clip(S * (1 - bandmask) * (1 - lettermask), 0, 1)


def back_letters(pos, part, hip, sh, text, size, height=0.075, top=0.09):
    """Letters across the upper back (bind space: x forward, so the back is x < 0), as a page-size coverage map."""
    W, H = 512, 160
    canvas = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT, 132) if os.path.exists(FONT) else ImageFont.load_default()
    box = d.textbbox((0, 0), text, font=font)
    d.text(((W - (box[2] - box[0])) / 2 - box[0], (H - (box[3] - box[1])) / 2 - box[1]), text, fill=255, font=font)
    glyph = np.asarray(canvas, np.float64) / 255
    width = height * W / H * 0.85
    y = pos[..., 1]
    z = pos[..., 2]
    on = (part == 1) & (pos[..., 0] < 0)
    v = (sh - top - y) / height + 0.5
    u = z / width + 0.5
    inside = on & (u >= 0) & (u < 1) & (v >= 0) & (v < 1)
    cov = np.zeros(part.shape)
    iu = np.clip((u * (W - 1)).astype(int), 0, W - 1)
    iv = np.clip((v * (H - 1)).astype(int), 0, H - 1)
    cov[inside] = glyph[iv[inside], iu[inside]]
    return np.clip(up(cov, size), 0, 1)


def relabel(entry, mi, boxes):
    """Replace a patch's lettering: each box (x0, y0, x1, y1 in page pixels, text, rotate, ink, ground) is refilled
    with its ground colour (the patch's own: its median outside the letters) and lettered anew."""
    im = entry['pages'][mi].copy()
    rgb = np.asarray(im.convert('RGB'), np.float64)
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1, text, rotate, light_ink in boxes:
        patch = rgb[y0:y1, x0:x1]
        L = lum(patch / 255)
        ground = np.median(patch[(L < 0.5) if light_ink else (L > 0.5)], axis=0)
        ink = np.median(patch[(L >= 0.5) if light_ink else (L <= 0.5)], axis=0)
        d.rectangle((x0, y0, x1, y1), fill=tuple(int(v) for v in ground) + (255,))
        w, h = x1 - x0, y1 - y0
        canvas = Image.new('L', (w, h), 0)
        cd = ImageDraw.Draw(canvas)
        font = ImageFont.truetype(FONT, int(h * 0.8)) if os.path.exists(FONT) else ImageFont.load_default()
        box = cd.textbbox((0, 0), text, font=font)
        cd.text(((w - (box[2] - box[0])) / 2 - box[0], (h - (box[3] - box[1])) / 2 - box[1]), text, fill=255, font=font)
        if rotate:
            canvas = canvas.rotate(rotate)
        im.paste(Image.new('RGBA', (w, h), tuple(int(v) for v in ink) + (255,)), (x0, y0), canvas)
    entry['pages'][mi] = im
