"""Main card generation orchestrator.

Composites a single 1640×720 PNG from:
  1. Background image (or auto collage + mesh prism)
  2. Title + subtitle text
  3. Optional showcase cards at the bottom
"""

import os
import math
import random

from PIL import Image, ImageDraw, ImageFont

from . import renderer, fonts, themes

# ---------------------------------------------------------------------------
# Canvas spec
# ---------------------------------------------------------------------------
CANVAS_WIDTH = 1640
CANVAS_HEIGHT = 720

# Showcase card sizes
LANDSCAPE_CARD_W = 415
LANDSCAPE_CARD_H = 238
POSTER_CARD_W = 200
POSTER_CARD_H = 300
CARD_SPACING_LANDSCAPE = 92
CARD_SPACING_POSTER = 65

CARD_ROUNDNESS = 12

# Neon border rotation
DEFAULT_BORDER_COLORS = [
    (239, 68, 68),   # Coral/Red
    (6, 182, 212),   # Cyan
    (248, 250, 252), # Silver White
]

SUBTITLE_DEFAULT = "One Click Install"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def generate(
    *,
    title: str,
    subtitle: str | None = None,
    output_path: str = "card.png",
    # Theme
    theme_name: str | None = None,
    accent_color: str | None = None,
    sphere_colors: list[str] | None = None,
    # Background
    background_path: str | None = None,
    background_images: list[str] | None = None,
    # Showcase cards
    showcase_cards: list[dict] | None = None,
    showcase_shape: str = "LANDSCAPE",
    max_showcase: int = 3,
    obfuscate_cards: bool = False,
    # Effects
    vignette: bool = True,
    film_grain: bool = True,
    perforations: bool = True,
    spotlight: bool = True,
    # Font choices
    font_title_name: str = "Montserrat-ExtraBold",
    font_body_name: str = "Inter-Medium",
    font_card_title_name: str = "Inter-Bold",
    # Dimensions
    canvas_width: int = CANVAS_WIDTH,
    canvas_height: int = CANVAS_HEIGHT,
):
    """Generate a single collection-card PNG.  All parameters are keyword-only."""

    # ── Resolve theme ──────────────────────────────────────────────────
    if theme_name and theme_name in themes.THEMES:
        theme = themes.THEMES[theme_name]
    else:
        theme = themes.THEMES["moonlit"]

    line_color = theme.line_color
    if accent_color:
        line_color = themes.hex_to_rgb(accent_color)

    sphere_params: list[tuple[int, int, int, tuple[int, int, int]]] = [
        (s.x, s.y, s.r, s.color) for s in theme.spheres
    ]
    if sphere_colors:
        sphere_params = []
        for i, hex_str in enumerate(sphere_colors[:3]):
            sc = themes.hex_to_rgb(hex_str)
            sx = theme.spheres[i].x if i < len(theme.spheres) else 820
            sy = theme.spheres[i].y if i < len(theme.spheres) else 428
            sr = theme.spheres[i].r if i < len(theme.spheres) else 500
            sphere_params.append((sx, sy, sr, sc))

    sub = subtitle if subtitle is not None else SUBTITLE_DEFAULT

    # ── Preload fonts ─────────────────────────────────────────────────
    fonts.ensure_google_fonts(quiet=True)
    font_title = fonts.truetype(font_title_name, 70)
    font_sub = fonts.truetype(font_body_name, 18)
    font_desc = fonts.truetype(font_body_name, 18)
    font_feat_label = fonts.truetype(font_body_name, 13)
    font_examples = fonts.truetype(font_title_name.replace("ExtraBold", "Bold"), 22)
    font_card_title = fonts.truetype(font_card_title_name, 38)

    # ── 1. Base canvas ────────────────────────────────────────────────
    canvas = Image.new("RGBA", (canvas_width, canvas_height), (8, 8, 10, 255))

    # ── 2. Background ─────────────────────────────────────────────────
    if background_path and os.path.exists(background_path):
        try:
            bg_img = Image.open(background_path).convert("RGBA")
            bg_img = bg_img.resize((canvas_width, canvas_height), Image.Resampling.LANCZOS)
            # Dim the background so text stays readable
            dimmer = Image.new("RGBA", (canvas_width, canvas_height), (8, 8, 10, 180))
            canvas = Image.alpha_composite(canvas, Image.alpha_composite(bg_img, dimmer))
        except Exception as exc:
            print(f"  ⚠ Could not open background image: {exc}")

    elif background_images:
        canvas = renderer.create_backdrop_collage(canvas, background_images, showcase_shape)

    # ── 3. Mesh prism ─────────────────────────────────────────────────
    canvas = renderer.apply_mesh_prism(canvas, sphere_params)

    # ── 4. Vignette ───────────────────────────────────────────────────
    if vignette:
        canvas = renderer.apply_vignette(canvas)

    # ── 5. Film grain ─────────────────────────────────────────────────
    if film_grain:
        canvas = Image.alpha_composite(
            canvas,
            renderer.generate_film_grain(canvas_width, canvas_height, opacity=0.025),
        )

    # ── 6. Perforations ───────────────────────────────────────────────
    if perforations:
        canvas = renderer.draw_film_perforations(canvas, line_color)

    # ── 7. Spotlight ──────────────────────────────────────────────────
    if spotlight:
        canvas = renderer.draw_spotlight(canvas, line_color)

    # ── 8. Title ──────────────────────────────────────────────────────
    canvas = renderer.draw_gradient_text(canvas, title, font_title, y_pos=70, accent_color=line_color)

    # ── 9. Subtitle ───────────────────────────────────────────────────
    draw = ImageDraw.Draw(canvas)
    sub_text = sub.upper()
    sub_bbox = draw.textbbox((0, 0), sub_text, font=font_sub)
    sub_w = sub_bbox[2] - sub_bbox[0]
    sx = (canvas_width - sub_w) / 2
    sy = 154
    draw.text((sx + 2, sy + 2), sub_text, fill=(0, 0, 0, 100), font=font_sub)
    draw.text((sx, sy), sub_text, fill=(100, 116, 139, 195), font=font_sub)

    # ── 10. Separator ─────────────────────────────────────────────────
    canvas = renderer.draw_cinematic_separator(canvas, y=196, line_color=line_color, width=960)
    draw = ImageDraw.Draw(canvas)

    # ── 11. Showcase cards ────────────────────────────────────────────
    if showcase_cards:
        is_poster = showcase_shape.upper() == "POSTER"
        card_w = POSTER_CARD_W if is_poster else LANDSCAPE_CARD_W
        card_h = POSTER_CARD_H if is_poster else LANDSCAPE_CARD_H
        card_spacing = CARD_SPACING_POSTER if is_poster else CARD_SPACING_LANDSCAPE
        n_cards = min(len(showcase_cards), max_showcase)

        # Bottom margin
        card_top_margin = 32
        text_content_bottom = 200  # approximate
        start_y = int(text_content_bottom + card_top_margin)
        max_start_y = canvas_height - card_h - 8
        start_y = min(start_y, max_start_y)

        total_w = n_cards * card_w + (n_cards - 1) * card_spacing
        left_margin = (canvas_width - total_w) // 2

        # Label
        feat_text = "— FEATURED SELECTIONS —"
        r, g, b = line_color
        feat_bbox = draw.textbbox((0, 0), feat_text, font=font_feat_label)
        feat_w = feat_bbox[2] - feat_bbox[0]
        draw.text(
            ((canvas_width - feat_w) / 2, start_y - 30),
            feat_text,
            fill=(r, g, b, 150),
            font=font_feat_label,
        )

        for i, card_info in enumerate(showcase_cards[:n_cards]):
            card_title = card_info.get("title", "CARD")
            card_path = card_info.get("path")
            card_x = left_margin + i * (card_w + card_spacing)
            border_col = DEFAULT_BORDER_COLORS[i % len(DEFAULT_BORDER_COLORS)]

            # Drop shadow
            canvas = renderer.draw_card_shadow(canvas, card_x, start_y, card_w, card_h)

            # Neon glow border
            glow_layer, (gx, gy) = renderer.draw_neon_border(
                card_x, start_y, card_x + card_w, start_y + card_h,
                CARD_ROUNDNESS, border_col, border_width=3,
            )
            canvas.paste(glow_layer, (gx, gy), glow_layer)

            # Card image (or placeholder)
            if obfuscate_cards:
                card_img = renderer.create_obfuscated_card(
                    card_path, card_title, card_w, card_h, font_card_title
                )
            elif card_path and os.path.exists(card_path):
                try:
                    card_img = Image.open(card_path).convert("RGBA")
                    card_img = card_img.resize((card_w, card_h), Image.Resampling.LANCZOS)
                except Exception:
                    card_img = Image.new("RGBA", (card_w, card_h), (20, 20, 25, 255))
            else:
                card_img = Image.new("RGBA", (card_w, card_h), (20, 20, 25, 255))

            # Rounded corners mask
            rmask = renderer.rounded_mask(card_w, card_h, CARD_ROUNDNESS)
            canvas.paste(card_img, (card_x, start_y), rmask)

            # Crisp border
            draw = ImageDraw.Draw(canvas)
            draw.rounded_rectangle(
                [card_x, start_y, card_x + card_w, start_y + card_h],
                CARD_ROUNDNESS,
                outline=border_col + (215,),
                width=2,
            )

    # ── Save ───────────────────────────────────────────────────────────
    canvas.save(output_path, "PNG")
    print(f"  ✓ Saved → {output_path}  ({canvas_width}×{canvas_height})")
