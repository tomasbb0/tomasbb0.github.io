#!/usr/bin/env python3
"""The press kit's logo files: the BytArc mark in every colour and shape people need, at full size.

    python3 tools/press_assets.py

writes press/bytarc-*.png and copies the SVG logos next to them. The mark is the same outline as the site's icons
(tools/bytarc_mark.py)."""
import shutil
from pathlib import Path

import math

from PIL import Image, ImageChops, ImageDraw, ImageFilter

from bytarc_mark import MARK, flatten, mark_outline, mask

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "press"
BLACK, WHITE, LIGHT = (0, 0, 0), (255, 255, 255), (244, 244, 246)


def coverage(o, w, h, width_frac):
    """The mark's coverage on a w × h canvas: centred, width_frac of the width (or less, to fit the height)."""
    side = max(w, h)
    k = min(w * width_frac, h * 0.8 * 275 / 175) / 275
    ox, oy = (side - 275 * k) / 2, (side - 175 * k) / 2 - 0.01 * h
    m = mask(o, side, k, ox, oy, ss=4)
    return m.crop(((side - w) // 2, (side - h) // 2, (side - w) // 2 + w, (side - h) // 2 + h))


def flat(m, fg, bg):
    return Image.composite(Image.new("RGB", m.size, fg), Image.new("RGB", m.size, bg), m)


def clear(m, fg):
    img = Image.new("RGBA", m.size, fg + (0,))
    img.putalpha(m)
    return img


def silver(size):
    """The site's brand gradient (120°, grey to white)."""
    w, h = size
    g = Image.new("RGB", size)
    px = g.load()
    stops = [(0, (142, 142, 150)), (0.5, (212, 212, 216)), (1, (255, 255, 255))]
    for y in range(h):
        for x in range(w):
            t = min(1, max(0, (x * 0.5 + (h - y) * 0.866) / (w * 0.5 + h * 0.866)))
            (a, ca), (b, cb) = (stops[0], stops[1]) if t < 0.5 else (stops[1], stops[2])
            u = (t - a) / (b - a)
            px[x, y] = tuple(round(ca[i] + (cb[i] - ca[i]) * u) for i in range(3))
    return g


def shaped(m, fg, bg, shape):
    """The mark on a rounded square or a circle, transparent outside it."""
    img = flat(m, fg, bg).convert("RGBA")
    cut = Image.new("L", m.size, 0)
    d = ImageDraw.Draw(cut)
    if shape == "circle":
        d.ellipse((0, 0, m.size[0] - 1, m.size[1] - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, m.size[0] - 1, m.size[1] - 1), radius=m.size[0] // 4.5, fill=255)
    img.putalpha(cut)
    return img


def construction(o, w=1600, h=1018):
    """The mark on its 25-unit construction grid (11 x 7 squares), for the concept page."""
    m = coverage(o, w, h, 0.9)
    k = min(w * 0.9, h * 0.8 * 275 / 175) / 275
    x0, y0 = (w - 275 * k) / 2, (h - 175 * k) / 2 - 0.01 * h
    img = Image.new("RGB", (w, h), (5, 5, 6))
    d = ImageDraw.Draw(img)
    for i in range(12):
        d.line((x0 + i * 25 * k, y0 - 25 * k, x0 + i * 25 * k, y0 + 200 * k), fill=(48, 48, 54), width=2)
    for j in range(-1, 9):
        d.line((x0 - 25 * k, y0 + j * 25 * k, x0 + 300 * k, y0 + j * 25 * k), fill=(48, 48, 54), width=2)
    return Image.composite(Image.new("RGB", (w, h), WHITE), img, m)


def render3d(o, w, h, rx, ry, depth=34, fill=0.62, light_bg=False, ss=3):
    """The mark as a solid block, turned in 3D and lit from the top left like the site's hero blocks: white front, silver
    sides, a soft shadow and a faint reflection on the floor. Rendered ss times larger and scaled down for smooth edges."""
    W, H = w * ss, h * ss
    pts = [(x - 137.5, y - 87.5) for x, y in flatten(o, 12)]
    area = sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))
    out_sign = 1 if area < 0 else -1                                   # which side of each edge faces out
    a, b, c, d = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry)
    R = [c, d * b, d * a, 0, a, -b, -d, c * b, c * a]                  # Ry * Rx
    s = W * fill / 275
    F = 2.6 * W
    L = (-0.45, -0.65, 0.62)
    ln = math.sqrt(sum(v * v for v in L))
    L = tuple(v / ln for v in L)

    def rot(x, y, z):
        return (R[0] * x + R[1] * y + R[2] * z, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z)

    def proj(x, y, z, cy):
        X, Y, Z = rot(x * s, y * s, z * s)
        k = F / (F - Z)
        return (W / 2 + X * k, cy + Y * k), Z

    def scene(cy):
        img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dr = ImageDraw.Draw(img)
        front = [proj(x, y, depth / 2, cy) for x, y in pts]
        back = [proj(x, y, -depth / 2, cy) for x, y in pts]
        quads = []
        for i in range(len(pts)):
            j = (i + 1) % len(pts)
            ex, ey = pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]
            el = math.hypot(ex, ey) or 1
            nx, ny = out_sign * ey / el, -out_sign * ex / el
            N = rot(nx, ny, 0)
            mz = (front[i][1] + front[j][1] + back[i][1] + back[j][1]) / 4
            mid = rot((pts[i][0] + pts[j][0]) / 2 * s, (pts[i][1] + pts[j][1]) / 2 * s, 0)
            if N[0] * (0 - mid[0]) + N[1] * (0 - mid[1]) + N[2] * (F - mid[2]) <= 0:
                continue
            lit = max(0.0, N[0] * L[0] + N[1] * L[1] + N[2] * L[2])
            v = round(110 + 115 * lit)
            quads.append((mz, [front[i][0], front[j][0], back[j][0], back[i][0]], (v, v, v + 4, 255)))
        for _, q, col in sorted(quads, key=lambda t: t[0]):
            dr.polygon(q, fill=col, outline=col)
        fn = rot(0, 0, 1)
        lit = max(0.0, fn[0] * L[0] + fn[1] * L[1] + fn[2] * L[2])
        v = round(205 + 50 * lit)
        dr.polygon([p for p, _ in front], fill=(v, v, v + 2, 255))
        return img

    top, bot = ((236, 236, 240), (250, 250, 252)) if light_bg else ((14, 14, 18), (2, 2, 3))
    bg = Image.new("RGB", (W, H))
    bd = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / (H - 1)
        bd.line((0, y, W, y), fill=tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W * 0.2, H * 0.05, W * 0.8, H * 0.75), fill=60 if not light_bg else 0)
    bg = Image.composite(Image.new("RGB", (W, H), (40, 40, 48)), bg, glow.filter(ImageFilter.GaussianBlur(W / 10)))
    cy = H * 0.46
    obj = scene(cy)
    floor = H * 0.46 + 175 * s * 0.62
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).ellipse((W * 0.22, floor - H * 0.03, W * 0.78, floor + H * 0.05), fill=150 if light_bg else 200)
    bg = Image.composite(Image.new("RGB", (W, H), (0, 0, 0) if not light_bg else (150, 150, 158)), bg, shadow.filter(ImageFilter.GaussianBlur(W / 40)))
    shift = round(2 * floor - H)                                       # the floor mirrors the block
    fade = Image.new("L", (W, H), 0)
    fd = ImageDraw.Draw(fade)
    for y in range(round(floor), H):
        fd.line((0, y, W, y), fill=round(max(0, 1 - (y - floor) / (H * 0.22)) * (26 if light_bg else 34)))
    refl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    refl.paste(obj.transpose(Image.FLIP_TOP_BOTTOM), (0, shift))
    refl.putalpha(ImageChops.multiply(refl.getchannel("A"), fade))
    out = Image.alpha_composite(bg.convert("RGBA"), refl)
    out = Image.alpha_composite(out, obj)
    return out.convert("RGB").resize((w, h), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    big, _, _ = mark_outline(**MARK)
    sq = coverage(big, 1024, 1024, 0.62)
    wide = coverage(big, 1600, 1018, 0.9)
    files = {
        "bytarc-logo-white-on-black.png": flat(sq, WHITE, BLACK),
        "bytarc-logo-black-on-white.png": flat(sq, BLACK, WHITE),
        "bytarc-logo-black-on-light.png": flat(sq, BLACK, LIGHT),
        "bytarc-logo-white.png": clear(wide, WHITE),
        "bytarc-logo-black.png": clear(wide, BLACK),
        "bytarc-icon-rounded.png": shaped(sq, WHITE, BLACK, "rounded"),
        "bytarc-icon-circle.png": shaped(sq, WHITE, BLACK, "circle"),
        "bytarc-logo-silver-on-black.png": Image.composite(silver(sq.size), Image.new("RGB", sq.size, BLACK), sq),
        "bytarc-banner-1584x396.png": flat(coverage(big, 1584, 396, 0.16), WHITE, BLACK),
    }
    files["bytarc-logo-construction.png"] = construction(big)
    files["bytarc-logo-3d.png"] = render3d(big, 1600, 1000, 0.32, -0.55)
    files["bytarc-logo-3d-front.png"] = render3d(big, 1200, 1200, 0.18, 0.4, fill=0.56)
    files["bytarc-logo-3d-light.png"] = render3d(big, 1600, 1000, 0.3, 0.6, light_bg=True)
    for name, img in files.items():
        img.save(OUT / name, optimize=True)
    shutil.copy(ROOT / "assets" / "bytarc-mark-white.svg", OUT / "bytarc-logo-white.svg")
    shutil.copy(ROOT / "assets" / "bytarc-mark.svg", OUT / "bytarc-logo-black.svg")


if __name__ == "__main__":
    main()
