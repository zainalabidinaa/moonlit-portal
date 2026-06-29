#!/usr/bin/env python3
"""Moonlit Cover Generator — Flask app with PIL-based cover compositing.

A single rendering pipeline (`_generate_cover`) powers BOTH the live preview and the
download, so what you see is exactly what you get. The preview renders at half
resolution for speed; the download renders at full 1920×1080.

Usage:
    python server.py
    # Opens http://localhost:5050 — drop an image, customize, download.
"""

from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
from PIL import Image, ImageDraw, ImageFilter

# Ensure package dirs are importable
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from card_generator.fonts import available_fonts, ensure_google_fonts, truetype
from card_generator.genre_manifest import GENRES
from card_generator.nuvio_tiles import generate_nuvio_tile
from card_generator.themes import hex_to_rgb

app = Flask(__name__)

COVER_W = 1920
COVER_H = 1080

# Preload fonts on startup
_fonts_loaded = False


def _init_fonts():
    global _fonts_loaded
    if not _fonts_loaded:
        ensure_google_fonts(quiet=True)
        _fonts_loaded = True


# ════════════════════════════════════════════════════════════════════
#  Low-level helpers
# ════════════════════════════════════════════════════════════════════
def _fit_cover(img: Image.Image, w: int, h: int) -> Image.Image:
    """Scale *img* to fill w×h (cover) and centre-crop."""
    iw, ih = img.size
    scale = max(w / iw, h / ih)
    nw, nh = round(iw * scale), round(ih * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return img.crop((left, top, left + w, top + h))


def _tracked_offsets(font, text: str, spacing: float) -> tuple[list[float], float]:
    """Per-glyph x offsets (with letter-spacing) and the total tracked width."""
    offsets: list[float] = []
    cx = 0.0
    for ch in text:
        offsets.append(cx)
        try:
            cx += font.getlength(ch) + spacing
        except Exception:
            cx += font.size * 0.6 + spacing
    total = (cx - spacing) if text else 0.0
    return offsets, total


def _left_scrim_alpha(t: float) -> float:
    """Falloff curve for the cinematic left scrim.

    *t* runs 0.0 (left edge) → 1.0 (right edge of the scrim region); returns a
    0.0–1.0 opacity multiplier. Eased so the title sits on a solid bed of darkness
    that melts away before the right-hand focal point of the image.
    """
    return (1.0 - t) ** 1.8


def _apply_left_scrim(canvas: Image.Image, strength: int) -> Image.Image:
    """Composite a left→right dark scrim so a left-aligned title stays readable."""
    w, h = canvas.size
    scrim = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(scrim)
    region = max(1, int(0.62 * w))
    max_alpha = int(255 * strength / 100 * 0.92)
    for x in range(region):
        a = int(max_alpha * _left_scrim_alpha(x / region))
        if a > 0:
            draw.line([(x, 0), (x, h)], fill=(0, 0, 0, a))
    return Image.alpha_composite(canvas, scrim)


def _render_title(
    canvas: Image.Image,
    text: str,
    font,
    x: int,
    y: int,
    spacing: float,
    mode: str,                       # "white" | "gradient"
    accent_rgb: tuple[int, int, int],
    shadow: list[tuple[int, int, int]],
) -> Image.Image:
    """Draw a tracked title (shadow + fill) at (x, y). Supports letter-spacing and
    an optional white-centre→accent-edge horizontal gradient fill."""
    w, h = canvas.size
    offsets, total_w = _tracked_offsets(font, text, spacing)
    ascent, descent = font.getmetrics()
    text_h = ascent + descent

    # 1. Shadow pass (drawn straight onto a layer under the fill)
    out = canvas
    if shadow:
        sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        for ox, oy, a in shadow:
            for ch, dx in zip(text, offsets):
                sd.text((x + dx + ox, y + oy), ch, font=font, fill=(0, 0, 0, a))
        out = Image.alpha_composite(out, sh)

    # 2. Ink mask (solid white glyphs, tracked) → reused for any fill style
    ink = Image.new("L", (w, h), 0)
    di = ImageDraw.Draw(ink)
    for ch, dx in zip(text, offsets):
        di.text((x + dx, y), ch, font=font, fill=255)

    fill_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if mode == "gradient" and total_w > 0:
        grad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grad)
        r, g, b = accent_rgb
        half = total_w / 2
        for px in range(int(total_w)):
            t = min(abs(px - half) / (half + 1), 1.0)
            te = max(0.0, (t - 0.6) / 0.4) if t > 0.6 else 0.0
            cr = int(255 * (1 - te) + r * te)
            cg = int(255 * (1 - te) + g * te)
            cb = int(255 * (1 - te) + b * te)
            gd.line([(x + px, y - 4), (x + px, y + text_h + 4)], fill=(cr, cg, cb, 255))
        fill_layer.paste(grad, (0, 0), ink)
    else:
        white = Image.new("RGBA", (w, h), (255, 255, 255, 255))
        fill_layer.paste(white, (0, 0), ink)

    return Image.alpha_composite(out, fill_layer)


# ════════════════════════════════════════════════════════════════════
#  Main compositing pipeline (shared by preview + download)
# ════════════════════════════════════════════════════════════════════
def _generate_cover(
    bg_bytes: bytes,
    *,
    title: str,
    subtitle: str,
    title_size: int,
    title_y: int,
    subtitle_size: int,
    subtitle_color_hex: str,
    accent_hex: str,
    bg_opacity: float,
    font_title: str,
    font_body: str,
    top_grad_strength: int,
    bottom_grad_strength: int,
    side_grad_strength: int,
    vignette: bool,
    pure_white_title: bool,
    layout: str,                 # "centered" | "cinematic"
    letter_spacing: int,
    scrim_strength: int,
    render_scale: float = 1.0,
) -> bytes:
    _init_fonts()
    s = render_scale
    w, h = max(1, round(COVER_W * s)), max(1, round(COVER_H * s))

    def sc(v: float) -> int:
        return max(1, round(v * s))

    cinematic = layout == "cinematic"
    canvas = Image.new("RGBA", (w, h), (8, 8, 10, 255))

    # ── Background (cover-fill + crop) ─────────────────────────────
    bg_img = _fit_cover(Image.open(io.BytesIO(bg_bytes)).convert("RGBA"), w, h)
    if bg_opacity < 1.0:
        alpha = bg_img.split()[3].point(lambda p: int(p * bg_opacity))
        bg_img.putalpha(alpha)
    canvas.paste(bg_img, (0, 0), bg_img)

    # ── Cinematic left scrim (under the edge gradients) ────────────
    if cinematic and scrim_strength > 0:
        canvas = _apply_left_scrim(canvas, scrim_strength)

    # ── Edge gradients (top / bottom / sides) — fractions of canvas ─
    if top_grad_strength > 0 or bottom_grad_strength > 0 or side_grad_strength > 0:
        grad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        gdraw = ImageDraw.Draw(grad)
        if top_grad_strength > 0:
            gh = max(1, int(0.46 * h))
            ma = int(255 * top_grad_strength / 100 * 0.82)
            for y in range(gh):
                a = int(ma * (1 - y / gh))
                if a > 0:
                    gdraw.line([(0, y), (w, y)], fill=(0, 0, 0, a))
        if bottom_grad_strength > 0:
            gh = max(1, int(0.37 * h))
            ma = int(255 * bottom_grad_strength / 100 * 0.82)
            for y in range(gh):
                a = int(ma * (1 - y / gh))
                if a > 0:
                    gdraw.line([(0, h - 1 - y), (w, h - 1 - y)], fill=(0, 0, 0, a))
        if side_grad_strength > 0:
            gw = max(1, int(0.21 * w))
            ma = int(255 * side_grad_strength / 100 * 0.78)
            for x in range(gw):
                a = int(ma * (1 - x / gw))
                if a > 0:
                    gdraw.line([(x, 0), (x, h)], fill=(0, 0, 0, a))
                    gdraw.line([(w - 1 - x, 0), (w - 1 - x, h)], fill=(0, 0, 0, a))
        canvas = Image.alpha_composite(canvas, grad)

    # ── Vignette ───────────────────────────────────────────────────
    if vignette:
        vig = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        vdraw = ImageDraw.Draw(vig)
        cx, cy = w // 2, h // 2
        steps = 40
        for i in range(steps, 0, -1):
            ratio = i / steps
            a = int(200 * (ratio**1.5))
            pad_x = min(int(cx * (1 - ratio) * 1.3), cx - 1)
            pad_y = min(int(cy * (1 - ratio) * 1.3), cy - 1)
            if w - pad_x > pad_x and h - pad_y > pad_y:
                vdraw.ellipse([pad_x, pad_y, w - pad_x, h - pad_y], fill=(0, 0, 0, a))
        canvas = Image.alpha_composite(
            canvas, vig.filter(ImageFilter.GaussianBlur(radius=max(1, int(60 * s))))
        )

    # ── Title ──────────────────────────────────────────────────────
    accent_rgb = hex_to_rgb(accent_hex)
    title_font = truetype(font_title, sc(title_size))
    spacing = letter_spacing * s
    mode = "white" if (pure_white_title or cinematic) else "gradient"

    _, total_w = _tracked_offsets(title_font, title, spacing)
    ascent, descent = title_font.getmetrics()
    text_h = ascent + descent

    if cinematic:
        x = round(0.07 * w)                     # left margin
        y = round(title_y * s) - text_h // 2    # title_y == vertical centre
        shadow = [(sc(2), sc(3), 150), (sc(1), sc(1), 90)]
    else:
        x = (w - int(total_w)) // 2             # horizontally centred
        y = round(title_y * s)                  # title_y == top
        if pure_white_title:
            shadow = [(sc(6), sc(6), 160), (sc(4), sc(4), 200), (sc(2), sc(2), 120)]
        else:
            shadow = [(sc(6), sc(6), 140), (sc(3), sc(3), 180)]

    canvas = _render_title(canvas, title, title_font, x, y, spacing, mode, accent_rgb, shadow)

    # ── Subtitle ───────────────────────────────────────────────────
    if subtitle:
        sub_font = truetype(font_body, sc(subtitle_size))
        sub_rgb = hex_to_rgb(subtitle_color_hex)
        draw = ImageDraw.Draw(canvas)
        if cinematic:
            sx = x
            sy = y + text_h + sc(16)
        else:
            try:
                sub_w = sub_font.getlength(subtitle)
            except Exception:
                sub_w = len(subtitle) * subtitle_size * s * 0.5
            sx = (w - int(sub_w)) // 2
            sy = y + sc(title_size) + sc(20)
        draw.text((sx + sc(2), sy + sc(2)), subtitle, fill=(0, 0, 0, 110), font=sub_font)
        draw.text((sx, sy), subtitle, fill=sub_rgb, font=sub_font)

    out = io.BytesIO()
    canvas.convert("RGB").save(out, "PNG", optimize=(s >= 1.0))
    out.seek(0)
    return out.read()


# ════════════════════════════════════════════════════════════════════
#  Request → render-params
# ════════════════════════════════════════════════════════════════════
def _params_from_form(form) -> dict:
    return dict(
        title=form.get("title", "Moonlit"),
        subtitle=form.get("subtitle", ""),
        title_size=int(form.get("titleSize", 96)),
        title_y=int(form.get("titleY", 60)),
        subtitle_size=int(form.get("subtitleSize", 28)),
        subtitle_color_hex=form.get("subtitleColor", "#cbd5e1"),
        accent_hex=form.get("accentColor", "#6366f1"),
        bg_opacity=float(form.get("bgOpacity", 1)),
        font_title=form.get("fontTitle", "Montserrat ExtraBold"),
        font_body=form.get("fontBody", "Inter Medium"),
        top_grad_strength=int(form.get("topGradStrength", 60)),
        bottom_grad_strength=int(form.get("bottomGradStrength", 0)),
        side_grad_strength=int(form.get("sideGradStrength", 0)),
        vignette=form.get("vignette", "true") == "true",
        pure_white_title=form.get("pureWhiteTitle", "false") == "true",
        layout=form.get("layout", "centered"),
        letter_spacing=int(form.get("letterSpacing", 0)),
        scrim_strength=int(form.get("scrimStrength", 70)),
    )


def _nuvio_params_from_form(form) -> dict:
    has_background = form.get("hasNuvioBackground", "false") == "true"
    show_subject = False if has_background else form.get("showNuvioSubject", "true") == "true"
    return dict(
        title=form.get("title", "GENRE"),
        subject=form.get("nuvioSubject", "runner"),
        palette=form.get("nuvioPalette", "gold"),
        variant=form.get("nuvioVariant", "normal"),
        brush_x=int(form.get("nuvioBrushX", 58)),
        text_x=int(form.get("nuvioTextX", 7)),
        text_size=int(form.get("nuvioTextSize", 58)),
        background_x=int(form.get("nuvioBackgroundX", 50)),
        background_y=int(form.get("nuvioBackgroundY", 50)),
        background_zoom=int(form.get("nuvioBackgroundZoom", 120)),
        background_strength=int(form.get("nuvioBackgroundStrength", 100)),
        show_subject=show_subject,
        top_grad_strength=int(form.get("topGradStrength", 0)),
        bottom_grad_strength=int(form.get("bottomGradStrength", 0)),
    )


def _nuvio_subject_bytes():
    file = request.files.get("subjectImage")
    if not file:
        return None
    return file.read()


def _nuvio_background_bytes():
    file = request.files.get("nuvioBackground")
    if not file:
        return None
    return file.read()


def _download_name(title: str, suffix: str = "png") -> str:
    stem = "_".join((title or "cover").strip().lower().split()) or "cover"
    return f"{stem}.{suffix}"


# ════════════════════════════════════════════════════════════════════
#  Routes
# ════════════════════════════════════════════════════════════════════
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/fonts")
def fonts_route():
    """Font display names available on this machine (for the UI menus)."""
    return jsonify(fonts=available_fonts())


@app.route("/genres")
def genres_route():
    return jsonify(genres=GENRES)


@app.route("/preview", methods=["POST"])
def preview():
    """Render the real pipeline at half-res and return it inline (WYSIWYG preview)."""
    if request.form.get("mode") == "nuvio":
        png = generate_nuvio_tile(
            render_scale=0.5,
            subject_image_bytes=_nuvio_subject_bytes(),
            background_image_bytes=_nuvio_background_bytes(),
            **_nuvio_params_from_form(request.form),
        )
        return send_file(io.BytesIO(png), mimetype="image/png")

    file = request.files.get("image")
    if not file:
        return "No image", 400
    png = _generate_cover(file.read(), render_scale=0.5, **_params_from_form(request.form))
    return send_file(io.BytesIO(png), mimetype="image/png")


@app.route("/generate", methods=["POST"])
def generate():
    """Render at full 1920×1080 and return as a download."""
    if request.form.get("mode") == "nuvio":
        params = _nuvio_params_from_form(request.form)
        subject_image_bytes = _nuvio_subject_bytes()
        background_image_bytes = _nuvio_background_bytes()
        title = params["title"]
        if request.form.get("downloadAll", "false") == "true":
            archive = io.BytesIO()
            with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
                for variant in ("normal", "focused", "dark"):
                    png = generate_nuvio_tile(
                        subject_image_bytes=subject_image_bytes,
                        background_image_bytes=background_image_bytes,
                        **{**params, "variant": variant},
                    )
                    stem = _download_name(f"{title}_{variant}", "png")
                    zf.writestr(stem, png)
            archive.seek(0)
            return send_file(
                archive,
                mimetype="application/zip",
                as_attachment=True,
                download_name=_download_name(f"{title}_variants", "zip"),
            )

        png = generate_nuvio_tile(
            subject_image_bytes=subject_image_bytes,
            background_image_bytes=background_image_bytes,
            **params,
        )
        return send_file(
            io.BytesIO(png),
            mimetype="image/png",
            as_attachment=True,
            download_name=_download_name(title),
        )

    file = request.files.get("image")
    if not file:
        return "No image uploaded", 400
    png = _generate_cover(file.read(), render_scale=1.0, **_params_from_form(request.form))
    return send_file(
        io.BytesIO(png),
        mimetype="image/png",
        as_attachment=True,
        download_name=_download_name(request.form.get("title") or "cover"),
    )


# ════════════════════════════════════════════════════════════════════
#  Main
# ════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("  Moonlit Cover Generator")
    print("  Open http://localhost:5050")
    print("=" * 60)
    _init_fonts()
    app.run(host="127.0.0.1", port=5050, debug=True)
