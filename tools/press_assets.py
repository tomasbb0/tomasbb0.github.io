#!/usr/bin/env python3
"""The press kit's logo files: the BytArc mark in every colour and shape people need, at full size.

    python3 tools/press_assets.py

writes press/bytarc-*.png and copies the SVG logos next to them. The mark is the same outline as the site's icons
(tools/bytarc_mark.py)."""
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

from bytarc_mark import MARK, mark_outline, mask

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
    for name, img in files.items():
        img.save(OUT / name, optimize=True)
    shutil.copy(ROOT / "assets" / "bytarc-mark-white.svg", OUT / "bytarc-logo-white.svg")
    shutil.copy(ROOT / "assets" / "bytarc-mark.svg", OUT / "bytarc-logo-black.svg")


if __name__ == "__main__":
    main()
