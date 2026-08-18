#!/usr/bin/env python3
"""Generate the Moonlit BIMI logo (SVG Tiny PS) from measured app-icon geometry.

Every constant below was derived from the 1024px app icon by tracing it with
potrace and fitting the background glow numerically -- see verify-bimi-logo.py
for the render-and-diff loop that validates the output.

BIMI requires SVG Tiny PS, which forbids <filter>, blur, clipPath, <image>,
scripts and external references. The icon's gloss and soft falloff come from
exactly those, so this is a flat reinterpretation, not a reproduction.
Rounded corners are handled by baking the clip into the path geometry
(Sutherland-Hodgman against the convex rounded-rect) rather than clipPath.
"""
import math

SRC = 1024.0          # app icon master size
VB = 200.0            # output viewBox
S = VB / SRC          # scale factor

# --- measured geometry (px in the 1024 master) --------------------------
CORNER_R = 241.0      # fitted to the traced corner arc
ROW1_TOP, ROW1_BOT = 0.0, 234.0
SEAM_BOT = 246.0
ROW2_BOT = 453.0
BAND_W = 153.0        # horizontal width of a cream band
PITCH = 319.5         # centre-to-centre spacing
ROW1_SLOPE = 0.750    # dx/dy, leans right going down
ROW2_SLOPE = -0.716   # leans left going down
ROW1_X0 = 289.75      # left edge of a reference band at y=0
ROW2_X0 = 467.0       # left edge of a reference band at y=248
ROW2_REF_Y = 248.0

SEAM = "#0C0A09"
OUTSIDE = "#000000"

# The icon's cream bands and dark gaps both carry a vertical falloff from the
# 3D lighting. Blur is illegal in Tiny PS but a plain linearGradient is not,
# so the falloff is recovered as measured stops over the clapper zone.
CREAM_STOPS = [
    (0.066, "#FAF5E6"), (0.199, "#F7EFDC"), (0.331, "#F6ECD5"),
    (0.464, "#F4E9CE"), (0.596, "#F4E8CC"), (0.728, "#EFE1C2"),
    (0.861, "#E9D7B3"), (0.993, "#E4D0A9"),
]
CLAPPER_STOPS = [
    (0.066, "#252322"), (0.199, "#1E1C1B"), (0.331, "#191716"),
    (0.464, "#131111"), (0.596, "#151312"), (0.728, "#110F0E"),
    (0.861, "#0E0C0A"), (0.993, "#0E0A08"),
]

# --- fitted radial glow (centre is below the canvas) --------------------
GLOW_CX, GLOW_CY, GLOW_R = 800.0, 1250.0, 1124.0
GLOW_STOPS = [
    (0.224, "#FCA704"), (0.269, "#F18102"), (0.313, "#E87402"),
    (0.358, "#DE6602"), (0.402, "#CE5802"), (0.447, "#B94902"),
    (0.491, "#A03902"), (0.536, "#852C02"), (0.580, "#6B2202"),
    (0.625, "#521902"), (0.669, "#3C1405"), (0.714, "#2C1008"),
    (0.758, "#210F0A"), (0.803, "#1B100D"), (0.847, "#181211"),
    (0.892, "#1A1716"), (0.936, "#211E1E"), (0.981, "#231E1D"),
]


def rounded_rect_polygon(w, h, r, seg=24):
    """Convex polygon approximation of the rounded rect, for clipping."""
    pts = []
    for cx, cy, a0 in ((w - r, h - r, 0.0), (r, h - r, 90.0),
                       (r, r, 180.0), (w - r, r, 270.0)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90.0 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def clip(subject, clipper):
    """Sutherland-Hodgman. clipper must be convex and counter-clockwise."""
    def inside(p, a, b):
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0

    def isect(p, q, a, b):
        x1, y1, x2, y2 = p[0], p[1], q[0], q[1]
        x3, y3, x4, y4 = a[0], a[1], b[0], b[1]
        d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if abs(d) < 1e-12:
            return q
        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))

    out = list(subject)
    for i in range(len(clipper)):
        a, b = clipper[i], clipper[(i + 1) % len(clipper)]
        inp, out = out, []
        if not inp:
            break
        prev = inp[-1]
        for cur in inp:
            if inside(cur, a, b):
                if not inside(prev, a, b):
                    out.append(isect(prev, cur, a, b))
                out.append(cur)
            elif inside(prev, a, b):
                out.append(isect(prev, cur, a, b))
            prev = cur
    return out


def band(x_at_ref, ref_y, slope, y_top, y_bot):
    """Parallelogram band: leading edge slides by `slope` per unit y."""
    def lx(y):
        return x_at_ref + slope * (y - ref_y)
    return [(lx(y_top), y_top), (lx(y_top) + BAND_W, y_top),
            (lx(y_bot) + BAND_W, y_bot), (lx(y_bot), y_bot)]


def to_path(poly, scale=S, prec=2):
    if len(poly) < 3:
        return None
    d = []
    for i, (x, y) in enumerate(poly):
        d.append(f"{'M' if i == 0 else 'L'}{x*scale:.{prec}f},{y*scale:.{prec}f}")
    return "".join(d) + "Z"


def build():
    clipper = rounded_rect_polygon(SRC, SRC, CORNER_R)

    # The icon carries exactly three bands per row -- a finite design, not a
    # repeating pattern. Generating more produces a spurious sliver bottom-right.
    bands = []
    for n in range(-1, 2):
        bands.append(("row1", band(ROW1_X0 + n * PITCH, 0.0, ROW1_SLOPE,
                                   ROW1_TOP, ROW1_BOT)))
    for n in range(-1, 2):
        bands.append(("row2", band(ROW2_X0 + n * PITCH, ROW2_REF_Y, ROW2_SLOPE,
                                   SEAM_BOT, ROW2_BOT)))

    paths = []
    for _, poly in bands:
        c = clip(poly, clipper)
        p = to_path(c)
        if p:
            paths.append(p)

    # clapper backing + seam, both clipped to the rounded rect
    backing = clip([(0, 0), (SRC, 0), (SRC, ROW2_BOT), (0, ROW2_BOT)], clipper)
    seam = clip([(0, ROW1_BOT), (SRC, ROW1_BOT), (SRC, SEAM_BOT), (0, SEAM_BOT)],
                clipper)
    body = clip([(0, ROW2_BOT), (SRC, ROW2_BOT), (SRC, SRC), (0, SRC)], clipper)

    def mkstops(lst):
        return "".join(
            f'<stop offset="{o:.3f}" stop-color="{c}"/>' for o, c in lst)

    clapper_y = ROW2_BOT * S

    out = []
    out.append('<?xml version="1.0" encoding="UTF-8"?>')
    out.append(f'<svg xmlns="http://www.w3.org/2000/svg" version="1.2" '
               f'baseProfile="tiny-ps" viewBox="0 0 {VB:.0f} {VB:.0f}">')
    out.append("<title>Moonlit</title>")
    out.append(
        f'<defs>'
        f'<radialGradient id="glow" gradientUnits="userSpaceOnUse" '
        f'cx="{GLOW_CX*S:.2f}" cy="{GLOW_CY*S:.2f}" r="{GLOW_R*S:.2f}">'
        f'{mkstops(GLOW_STOPS)}</radialGradient>'
        f'<linearGradient id="cream" gradientUnits="userSpaceOnUse" '
        f'x1="0" y1="0" x2="0" y2="{clapper_y:.2f}">'
        f'{mkstops(CREAM_STOPS)}</linearGradient>'
        f'<linearGradient id="clap" gradientUnits="userSpaceOnUse" '
        f'x1="0" y1="0" x2="0" y2="{clapper_y:.2f}">'
        f'{mkstops(CLAPPER_STOPS)}</linearGradient>'
        f'</defs>')
    out.append(f'<rect x="0" y="0" width="{VB:.0f}" height="{VB:.0f}" '
               f'fill="{OUTSIDE}"/>')
    out.append(f'<path d="{to_path(body)}" fill="url(#glow)"/>')
    out.append(f'<path d="{to_path(backing)}" fill="url(#clap)"/>')
    out.append('<g fill="url(#cream)">')
    for p in paths:
        out.append(f'<path d="{p}"/>')
    out.append("</g>")
    out.append(f'<path d="{to_path(seam)}" fill="{SEAM}"/>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    import sys
    dest = sys.argv[1] if len(sys.argv) > 1 else "public/bimi-logo.svg"
    svg = build()
    with open(dest, "w") as f:
        f.write(svg)
    print(f"wrote {dest}  ({len(svg)} bytes)")
