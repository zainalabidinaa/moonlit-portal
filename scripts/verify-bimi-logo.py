#!/usr/bin/env python3
"""Render the BIMI SVG and score it against the app icon.

Emits an RMSE number plus side-by-side / difference images so the logo is
judged by measurement rather than by assertion. Also checks the SVG Tiny PS
structural constraints BIMI requires.
"""
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw
import numpy as np

ICON = ("/Users/zain/projects/Moonlit/Apps/MoonlitApp/Resources/"
        "Assets.xcassets/AppIcon.appiconset/icon-1024.png")
BANNED = ["clipPath", "<filter", "<script", "<image", "xlink", "href",
          "<animate", "<foreignObject"]


def structural_checks(path):
    svg = open(path).read()
    root = svg[svg.index("<svg"):svg.index(">", svg.index("<svg")) + 1]
    fails = []
    if 'version="1.2"' not in root:
        fails.append('missing version="1.2"')
    if 'baseProfile="tiny-ps"' not in root:
        fails.append('missing baseProfile="tiny-ps"')
    if "<title>" not in svg:
        fails.append("missing <title>")
    if re.search(r'\sx="', root) or re.search(r'\sy="', root):
        fails.append("root <svg> has x/y attribute")
    for b in BANNED:
        if b in svg:
            fails.append(f"contains banned {b}")
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', root)
    if not vb or vb.group(1) != vb.group(2):
        fails.append("viewBox not square")
    size = os.path.getsize(path)
    if size > 32768:
        fails.append(f"size {size} exceeds 32KB")
    return fails, size


def render(path, px):
    out = f"/tmp/bimi_r{px}.png"
    subprocess.run(["rsvg-convert", "-w", str(px), "-h", str(px), path,
                    "-o", out], check=True)
    return Image.open(out).convert("RGB")


def main(path):
    fails, size = structural_checks(path)
    print(f"=== SVG Tiny PS structure ===  ({size} bytes)")
    print("  all checks passed" if not fails
          else "\n".join(f"  FAIL {f}" for f in fails))

    ref = Image.open(ICON).convert("RGB")
    cand = render(path, 1024)
    r = np.array(ref).astype(float)
    c = np.array(cand).astype(float)
    rmse = float(np.sqrt(((r - c) ** 2).mean()))
    mae = float(np.abs(r - c).mean())
    print(f"\n=== fidelity vs app icon ===")
    print(f"  RMSE {rmse:6.2f} / 255   ({rmse/255*100:.1f}%)")
    print(f"  MAE  {mae:6.2f} / 255   ({mae/255*100:.1f}%)")

    # per-region breakdown
    for lbl, sl in (("clapper y<453", slice(0, 453)),
                    ("body   y>453", slice(453, 1024))):
        rr, cc = r[sl], c[sl]
        print(f"  {lbl}: RMSE {np.sqrt(((rr-cc)**2).mean()):.2f}")

    # side-by-side + amplified diff
    sbs = Image.new("RGB", (1024 * 3, 1024))
    sbs.paste(ref, (0, 0))
    sbs.paste(cand, (1024, 0))
    d = np.abs(r - c)
    d = np.clip(d * 3, 0, 255).astype(np.uint8)
    sbs.paste(Image.fromarray(d), (2048, 0))
    sbs.resize((1200, 400)).save("/tmp/bimi_sbs.png")

    # 64px circle crop -- how Gmail actually shows it
    small = render(path, 128)
    m = Image.new("L", (128, 128), 0)
    ImageDraw.Draw(m).ellipse((0, 0, 127, 127), fill=255)
    av = Image.new("RGB", (128, 128), (255, 255, 255))
    av.paste(small, (0, 0), m)
    av.save("/tmp/bimi_avatar.png")
    print("\n  wrote /tmp/bimi_sbs.png (ref | candidate | 3x diff)")
    print("        /tmp/bimi_avatar.png (circle-cropped avatar)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "public/bimi-logo.svg"))
