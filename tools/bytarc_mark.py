#!/usr/bin/env python3
"""The BytArc mark (v4) and every icon cut from it.

The mark sits on a 25-unit grid (u = 25): squares 2u, long blocks 3u, corners rounded by u/2 with Figma's 60% corner
smoothing, and where two blocks touch corner to corner a gooey joint reaches 1u along each edge. It is one outline,
walked clockwise from the middle of the top edge, so the logo, the favicon, the hero line art and the loader share it.

    python3 tools/bytarc_mark.py [snippets.json]

rewrites favicon.svg, favicon.ico, assets/bytarc-mark*.svg and the PNG icons, and writes the paths the page uses
(nav logo, hero outline and its exits, loader halves) to snippets.json when a path is given.
"""
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MARK = dict(B=50, L=75, r=12.5, s=0.6, R=25)        # the master, 275 × 175
PIXEL32 = dict(B=5, L=8, r=1.25, s=0.6, R=2.5)       # 32px favicon: every block edge on a whole pixel
PIXEL16 = dict(B=2, L=4, r=0.5, s=0.6, R=1)          # 16px favicon: the closest crisp, centred fit


def corner_parts(r, s):
    """One 90° corner with Figma's corner smoothing (the figma-squircle construction)."""
    p = (1 + s) * r
    arc_deg = 90 * (1 - s)
    arc = math.sin(math.radians(arc_deg / 2)) * r * math.sqrt(2)
    p3p4 = r * math.tan(math.radians((90 - arc_deg) / 4))
    beta = math.radians(45 * s)
    c = p3p4 * math.cos(beta)
    d = c * math.tan(beta)
    b = (p - arc - c - d) / 3
    return dict(p=p, a=2 * b, b=b, c=c, d=d, arc=arc, r=r, theta=math.radians(arc_deg))


class Outline:
    def __init__(self, start):
        self.start = self.cur = start
        self.segs = []   # ("L", end) | ("C", c1, c2, end) | ("A", r, theta, centre, end)

    def line(self, pt):
        if math.dist(pt, self.cur) > 1e-9:
            self.segs.append(("L", pt))
            self.cur = pt

    def curve(self, c1, c2, end):
        self.segs.append(("C", c1, c2, end))
        self.cur = end

    def corner(self, v, din, dout, q):
        """Convex corner at v, arriving along din and leaving along dout (always a right turn: the walk is clockwise)."""
        def go(base, i, o):
            return (base[0] + i * din[0] + o * dout[0], base[1] + i * din[1] + o * dout[1])
        s0 = go(v, -q["p"], 0)
        self.line(s0)
        a, b, c, d, arc = q["a"], q["b"], q["c"], q["d"], q["arc"]
        e1 = go(s0, a + b + c, d)
        self.curve(go(s0, a, 0), go(s0, a + b, 0), e1)
        e2 = go(e1, arc, arc)
        self.segs.append(("A", q["r"], q["theta"], go(v, -q["r"], q["r"]), e2))
        self.cur = e2
        self.curve(go(e2, d, c), go(e2, d, b + c), go(e2, d, a + b + c))

    def joint(self, start, j, end):
        """Concave gooey fillet between two blocks touching at j: both handles sit on the touching corner."""
        self.line(start)
        self.curve(j, j, end)


def mark_outline(B, L, r, s, R):
    q = corner_parts(r, s)
    W, H = 4 * B + L, 2 * B + L
    j1, j2, j3, j4 = (2 * B, B), (2 * B + L, B), (B, 2 * B), (3 * B + L, 2 * B)
    right, down, left, up = (1, 0), (0, 1), (-1, 0), (0, -1)
    o = Outline((W / 2, 0))
    o.corner((2 * B + L, 0), right, down, q)                       # top bar, top right
    o.joint((2 * B + L, B - R), j2, (2 * B + L + R, B))
    o.corner((3 * B + L, B), right, down, q)                       # right square, top right
    o.joint((3 * B + L, 2 * B - R), j4, (3 * B + L + R, 2 * B))
    o.corner((W, 2 * B), right, down, q)                           # right leg, top right
    o.line((W, 2 * B + L / 2))
    marks = {"R": len(o.segs)}                                     # right exit: middle of the leg's outer side
    o.corner((W, H), down, left, q)
    o.corner((3 * B + L, H), left, up, q)
    o.joint((3 * B + L, 2 * B + R), j4, (3 * B + L - R, 2 * B))
    o.corner((2 * B + L, 2 * B), left, up, q)                      # right square, under the arch
    o.joint((2 * B + L, B + R), j2, (2 * B + L - R, B))
    o.line((W / 2, B))
    marks["mid"] = len(o.segs)                                     # middle of the arch's underside
    o.joint((2 * B + R, B), j1, (2 * B, B + R))
    o.corner((2 * B, 2 * B), down, left, q)                        # left square, under the arch
    o.joint((B + R, 2 * B), j3, (B, 2 * B + R))
    o.corner((B, H), down, left, q)
    o.corner((0, H), left, up, q)
    o.line((0, 2 * B + L / 2))
    marks["L"] = len(o.segs)                                       # left exit
    o.corner((0, 2 * B), up, right, q)
    o.joint((B - R, 2 * B), j3, (B, 2 * B - R))
    o.corner((B, B), up, right, q)                                 # left square, top left
    o.joint((2 * B - R, B), j1, (2 * B, B - R))
    o.corner((2 * B, 0), up, right, q)                             # top bar, top left
    o.line((W / 2, 0))
    return o, marks, (W, H)


def bezier(p0, p1, p2, p3, n):
    pts = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        pts.append(tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3)))
    return pts


def flatten(o, n=48, upto=None):
    pts, cur = [o.start], o.start
    for seg in o.segs[:upto]:
        if seg[0] == "L":
            pts.append(seg[1])
        elif seg[0] == "C":
            pts += bezier(cur, seg[1], seg[2], seg[3], n)
        else:
            r, theta, c, _ = seg[1:]
            a0 = math.atan2(cur[1] - c[1], cur[0] - c[0])   # y points down, so a growing angle turns clockwise
            pts += [(c[0] + r * math.cos(a0 + theta * i / n), c[1] + r * math.sin(a0 + theta * i / n)) for i in range(1, n + 1)]
        cur = seg[-1]
    return pts


def length(o, upto=None):
    pts = flatten(o, 400, upto)
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))


def num(v):
    s = f"{v:.3f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def to_d(o, k=1.0, ox=0.0, oy=0.0, upto=None, mirror_w=None):
    """SVG path data. A full outline is closed; with upto it stops at that segment (open), mirror_w flips it left-right."""
    def T(pt):
        x = mirror_w - pt[0] if mirror_w is not None else pt[0]
        return f"{num(ox + k * x)} {num(oy + k * pt[1])}"
    segs = o.segs if upto is not None else o.segs[:-1]          # the closing line back to the start becomes Z
    out, cur = ["M" + T(o.start)], o.start
    for seg in segs[:upto]:
        if seg[0] == "L":
            out.append("L" + T(seg[1]))
        elif seg[0] == "C":
            out.append("C" + " ".join(T(p) for p in seg[1:4]))
        else:
            # the corner's arc as one cubic, as Figma exports it: browsers measure a dashed arc a little short
            r, theta, c, end = seg[1:]
            a0 = math.atan2(cur[1] - c[1], cur[0] - c[0])
            a1, h = a0 + theta, 4 / 3 * math.tan(theta / 4) * r
            c1 = (cur[0] - h * math.sin(a0), cur[1] + h * math.cos(a0))
            c2 = (end[0] + h * math.sin(a1), end[1] - h * math.cos(a1))
            out.append("C" + " ".join(T(p) for p in (c1, c2, end)))
        cur = seg[-1]
    if upto is None:
        out.append("Z")
    return "".join(out)


def mask(o, size, k, ox, oy, ss=16):
    """Coverage of the mark on a size × size canvas, supersampled and box-filtered (exact area coverage)."""
    S = size * ss
    img = Image.new("L", (S, S), 0)
    ImageDraw.Draw(img).polygon([((ox + k * x) * ss, (oy + k * y) * ss) for x, y in flatten(o)], fill=255)
    return img.reduce(ss)


def bare(o, size, width_frac=0.8333, lift=0.02):
    """Mark alone, centred, lifted a little for optical centring."""
    k = size * width_frac / 275
    return mask(o, size, k, (size - 275 * k) / 2, (size - 175 * k) / 2 - lift * size, ss=16 if size <= 96 else 8)


def black_on_clear(m):
    return Image.merge("LA", (Image.new("L", m.size, 0), m))


def main():
    big, marks, _ = mark_outline(**MARK)
    px32, _, _ = mark_outline(**PIXEL32)
    px16, _, _ = mark_outline(**PIXEL16)
    a = ROOT / "assets"

    # logo files
    d = to_d(big)
    for name, fill in (("bytarc-mark.svg", "#000"), ("bytarc-mark-white.svg", "#fff")):
        (a / name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 275 175" width="275" height="175"><path fill="{fill}" d="{d}"/></svg>\n')

    # tab icon: black on light tabs, white on dark ones
    (ROOT / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        '<style>path{fill:#000}@media (prefers-color-scheme:dark){path{fill:#fff}}</style>'
        f'<path d="{to_d(px32, 1, 2, 6)}"/></svg>\n')

    # PNG and ICO: black on transparent (Google shows them on a light background)
    m16 = mask(px16, 16, 1, 2, 3)
    m32 = mask(px32, 32, 1, 2, 6)
    m48 = bare(big, 48)
    black_on_clear(m48).save(a / "favicon-48.png", optimize=True)
    black_on_clear(bare(big, 96)).save(a / "favicon-96.png", optimize=True)
    black_on_clear(bare(big, 192)).save(a / "icon-192.png", optimize=True)
    black_on_clear(bare(big, 512)).save(a / "icon-512.png", optimize=True)
    with tempfile.TemporaryDirectory() as t:
        parts = []
        for size, m in ((16, m16), (32, m32), (48, m48)):
            p = Path(t) / f"{size}.png"
            black_on_clear(m).convert("RGBA").save(p)
            parts.append(str(p))
        subprocess.run(["magick", *parts, str(ROOT / "favicon.ico")], check=True)

    # iPhone home screen: white mark on a full black tile (iOS rounds the corners itself), laid out like the Figma icon
    k = 180 / 345
    m = mask(big, 180, k, 35 * k, 77 * k)
    Image.merge("RGB", (m, m, m)).save(a / "apple-touch-icon.png", optimize=True)

    if len(sys.argv) > 1:
        # hero line art in the old monogram's 100 × 100 box: 92 wide, centred, lifted 2
        hk, sw = 92 / 275, 1.2
        hx, hy = 4.0, (100 - 175 * hk) / 2 - 2
        total = length(big)
        eR, eL = length(big, marks["R"]) / total, length(big, marks["L"]) / total
        sa, sb, sd = eR, eL - eR, 1 - eL                     # the stretches U→R, R→L (round the bottom), L→U
        T = total * hk
        snippets = {
            "nav_d": d,
            "hero": {
                "d": to_d(big, hk, hx, hy), "stroke": sw,
                "exit": {"R": round(eR, 5), "L": round(eL, 5)},
                "len": {"U": round((sd + sa) / 2 * T, 2), "R": round((sa + sb) / 2 * T, 2), "L": round((sb + sd) / 2 * T, 2)},
                "xL": round(hx - sw / 2, 3), "xR": round(hx + 275 * hk + sw / 2, 3), "yU": round(hy - sw / 2, 3),
                "xU": round(50 - sw / 2, 3), "yLR": round(hy + (100 + 37.5) * hk - sw / 2, 3),
            },
            "loader": {
                "right": to_d(big, upto=marks["mid"]),
                "left": to_d(big, upto=marks["mid"], mirror_w=275),
            },
        }
        Path(sys.argv[1]).write_text(json.dumps(snippets, indent=1))


if __name__ == "__main__":
    main()
