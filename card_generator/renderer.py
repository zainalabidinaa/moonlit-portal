"""Visual rendering primitives for the collection card generator.

All functions operate on PIL RGBA images and return a new composited image.
"""

import math
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------------------
# Canvas defaults (override via generator)
# ---------------------------------------------------------------------------
CANVAS_WIDTH = 1640
CANVAS_HEIGHT = 720
CARD_ROUNDNESS = 12


# ---------------------------------------------------------------------------
# Gradient sphere mask
# ---------------------------------------------------------------------------
def _draw_gradient_sphere(radius: int) -> Image.Image:
    """Quadratic radial gradient mask in a (radius*2 × radius*2) square."""
    size = radius * 2
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    for r in range(radius, 0, -4):
        alpha = int(255 * (1 - r / radius) ** 2)
        draw.ellipse([radius - r, radius - r, radius + r, radius + r], fill=alpha)
    return mask


# ---------------------------------------------------------------------------
# Mesh prism (coloured glow spheres)
# ---------------------------------------------------------------------------
def apply_mesh_prism(
    canvas: Image.Image,
    spheres: list[tuple[int, int, int, tuple[int, int, int]]],
    blur_radius: int = 80,
) -> Image.Image:
    """Composite multiple radial gradient spheres onto *canvas*."""
    blend = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    for cx, cy, r, color in spheres:
        sphere_mask = Image.new("L", (canvas.width, canvas.height), 0)
        local = _draw_gradient_sphere(r)
        sphere_mask.paste(local, (cx - r, cy - r))
        solid = Image.new("RGBA", (canvas.width, canvas.height), color + (255,))
        blend = Image.composite(solid, blend, sphere_mask)

    blurred = blend.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    return Image.alpha_composite(canvas, blurred)


# ---------------------------------------------------------------------------
# Film grain
# ---------------------------------------------------------------------------
def generate_film_grain(width: int, height: int, opacity: float = 0.025) -> Image.Image:
    alpha_val = int(255 * opacity)
    grain = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = grain.load()
    rng = random.Random(42)  # deterministic but looks random
    for y in range(height):
        for x in range(width):
            v = rng.randint(0, 255)
            pixels[x, y] = (255, 255, 255, int(v * opacity))
    return grain


# ---------------------------------------------------------------------------
# Cinematic vignette
# ---------------------------------------------------------------------------
def apply_vignette(canvas: Image.Image) -> Image.Image:
    vignette = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette)
    cx, cy = canvas.width // 2, canvas.height // 2
    steps = 50
    for i in range(steps, 0, -1):
        ratio = i / steps
        alpha = int(220 * (ratio**1.8))
        pad_x = min(int(cx * (1 - ratio) * 1.3), cx - 1)
        pad_y = min(int(cy * (1 - ratio) * 1.3), cy - 1)
        if canvas.width - pad_x > pad_x and canvas.height - pad_y > pad_y:
            vdraw.ellipse(
                [pad_x, pad_y, canvas.width - pad_x, canvas.height - pad_y],
                fill=(0, 0, 0, alpha),
            )
    vignette = vignette.filter(ImageFilter.GaussianBlur(radius=70))
    return Image.alpha_composite(canvas, vignette)


# ---------------------------------------------------------------------------
# Film-strip perforations
# ---------------------------------------------------------------------------
def draw_film_perforations(canvas: Image.Image, line_color: tuple[int, int, int]) -> Image.Image:
    perf_layer = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(perf_layer)
    r, g, b = line_color
    pw, ph = 10, 18
    gap = 12
    margin = 16
    y = gap
    while y + ph < canvas.height - gap:
        pdraw.rounded_rectangle(
            [margin, y, margin + pw, y + ph], 3, fill=(r, g, b, 28), outline=(r, g, b, 55), width=1
        )
        pdraw.rounded_rectangle(
            [canvas.width - margin - pw, y, canvas.width - margin, y + ph],
            3,
            fill=(r, g, b, 28),
            outline=(r, g, b, 55),
            width=1,
        )
        y += ph + gap
    return Image.alpha_composite(canvas, perf_layer)


# ---------------------------------------------------------------------------
# Header spotlight glow
# ---------------------------------------------------------------------------
def draw_spotlight(
    canvas: Image.Image, line_color: tuple[int, int, int]
) -> Image.Image:
    r, g, b = line_color
    spotlight = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    ImageDraw.Draw(spotlight).ellipse(
        [canvas.width // 2 - 520, -80, canvas.width // 2 + 520, 260],
        fill=(r, g, b, 22),
    )
    return Image.alpha_composite(canvas, spotlight.filter(ImageFilter.GaussianBlur(radius=50)))


# ---------------------------------------------------------------------------
# Metallic gradient title
# ---------------------------------------------------------------------------
def draw_gradient_text(
    canvas: Image.Image,
    text: str,
    font: ImageFont.FreeTypeFont,
    y_pos: int,
    accent_color: tuple[int, int, int],
) -> Image.Image:
    tmp = ImageDraw.Draw(canvas)
    bbox = tmp.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (canvas.width - text_w) // 2
    r, g, b = accent_color

    text_layer = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    tdraw = ImageDraw.Draw(text_layer)
    for ox, oy, alpha in [(5, 5, 120), (3, 3, 160), (1, 1, 80)]:
        tdraw.text((x + ox, y_pos + oy), text, fill=(0, 0, 0, alpha), font=font)
    tdraw.text((x, y_pos), text, fill=(255, 255, 255, 255), font=font)

    grad_layer = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(grad_layer)
    half = text_w / 2
    for px in range(text_w):
        dist = abs(px - half)
        t = min(dist / (half + 1), 1.0)
        t_eased = max(0.0, (t - 0.6) / 0.4) if t > 0.6 else 0.0
        cr = int(255 * (1 - t_eased) + r * t_eased)
        cg = int(255 * (1 - t_eased) + g * t_eased)
        cb = int(255 * (1 - t_eased) + b * t_eased)
        gdraw.line(
            [(x + px, y_pos - 4), (x + px, y_pos + text_h + 4)],
            fill=(cr, cg, cb, 255),
        )

    text_alpha = text_layer.split()[3]
    colored = Image.composite(grad_layer, text_layer, text_alpha)
    out = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    out.paste(colored, (0, 0), text_alpha)

    shadow_layer = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_layer)
    for ox, oy, alpha in [(5, 5, 120), (3, 3, 160)]:
        sdraw.text((x + ox, y_pos + oy), text, fill=(0, 0, 0, alpha), font=font)
    combined = Image.alpha_composite(shadow_layer, out)
    return Image.alpha_composite(canvas, combined)


# ---------------------------------------------------------------------------
# Cinematic separator
# ---------------------------------------------------------------------------
def draw_cinematic_separator(
    canvas: Image.Image, y: int, line_color: tuple[int, int, int], width: int = 960
) -> Image.Image:
    sep = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(sep)
    cx = canvas.width // 2
    half = width // 2
    r, g, b = line_color
    for px in range(width):
        dist = abs(px - half)
        t = dist / (half + 1)
        alpha = int(255 * (1 - t**1.3))
        lx = cx - half + px
        sdraw.line([(lx, y), (lx, y + 1)], fill=(r, g, b, alpha))
    bloom = sep.filter(ImageFilter.GaussianBlur(radius=3))
    sep = Image.alpha_composite(bloom, sep)

    d = 6
    diamond = [(cx, y - d), (cx + d, y + 1), (cx, y + 2 + d), (cx - d, y + 1)]
    glow_d = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    ImageDraw.Draw(glow_d).polygon(diamond, fill=(r, g, b, 80))
    glow_d = glow_d.filter(ImageFilter.GaussianBlur(radius=7))
    sep = Image.alpha_composite(sep, glow_d)
    ImageDraw.Draw(sep).polygon(diamond, fill=(r, g, b, 255))
    ImageDraw.Draw(sep).polygon(diamond, outline=(255, 255, 255, 180), width=1)

    return Image.alpha_composite(canvas, sep)


# ---------------------------------------------------------------------------
# Rounded corners mask
# ---------------------------------------------------------------------------
def rounded_mask(width: int, height: int, radius: int) -> Image.Image:
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, width, height], radius, fill=255)
    return mask


# ---------------------------------------------------------------------------
# Neon border + glow
# ---------------------------------------------------------------------------
def draw_neon_border(
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    radius: int,
    color: tuple[int, int, int],
    border_width: int = 4,
) -> tuple[Image.Image, tuple[int, int]]:
    glow_pad = 15
    glow_w = (x1 - x0) + glow_pad * 2
    glow_h = (y1 - y0) + glow_pad * 2
    glow = Image.new("RGBA", (glow_w, glow_h), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.rounded_rectangle(
        [glow_pad, glow_pad, glow_w - glow_pad, glow_h - glow_pad],
        radius,
        outline=color + (180,),
        width=border_width + 6,
    )
    return glow.filter(ImageFilter.GaussianBlur(radius=6)), (
        x0 - glow_pad,
        y0 - glow_pad,
    )


# ---------------------------------------------------------------------------
# Card drop shadow
# ---------------------------------------------------------------------------
def draw_card_shadow(
    canvas: Image.Image, x: int, y: int, w: int, h: int, radius: int = 14
) -> Image.Image:
    shadow = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [x + 8, y + 10, x + w + 8, y + h + 10], radius, fill=(0, 0, 0, 180)
    )
    return Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(radius=14)))


# ---------------------------------------------------------------------------
# Censored / blurred showcase card (hide copyrighted logos)
# ---------------------------------------------------------------------------
def create_obfuscated_card(
    image_path: str | None,
    title: str,
    card_w: int,
    card_h: int,
    title_font: ImageFont.FreeTypeFont,
) -> Image.Image:
    if image_path:
        try:
            base = Image.open(image_path).convert("RGBA")
        except Exception:
            base = Image.new("RGBA", (card_w, card_h), (15, 15, 18, 255))
    else:
        base = Image.new("RGBA", (card_w, card_h), (15, 15, 18, 255))

    base = base.resize((card_w, card_h), Image.Resampling.LANCZOS)
    blurred = base.filter(ImageFilter.GaussianBlur(radius=22))
    tint = Image.new("RGBA", (card_w, card_h), (8, 8, 10, 170))
    composite = Image.alpha_composite(blurred, tint)

    draw = ImageDraw.Draw(composite)
    text = title.upper()
    tbbox = draw.textbbox((0, 0), text, font=title_font)
    tw = tbbox[2] - tbbox[0]
    th = tbbox[3] - tbbox[1]
    tx = (card_w - tw) / 2
    ty = (card_h - th) / 2 - 5
    draw.text((tx + 3, ty + 3), text, fill=(0, 0, 0, 230), font=title_font)
    draw.text((tx, ty), text, fill=(255, 255, 255, 255), font=title_font)
    return composite


# ---------------------------------------------------------------------------
# Backdrop collage
# ---------------------------------------------------------------------------
def create_backdrop_collage(
    canvas: Image.Image,
    image_paths: list[str],
    tile_shape: str = "LANDSCAPE",
) -> Image.Image:
    if not image_paths:
        return canvas

    if tile_shape.upper() == "POSTER":
        tw, th, cols, rows = 164, 246, 10, 4
    else:
        tw, th, cols, rows = 280, 160, 6, 6

    grid = Image.new("RGBA", (canvas.width, canvas.height), (0, 0, 0, 0))
    idx = 0
    for row in range(rows):
        for col in range(cols):
            path = image_paths[idx % len(image_paths)]
            idx += 1
            try:
                img = Image.open(path).convert("RGBA").resize((tw, th), Image.Resampling.LANCZOS)
                grid.paste(img, (col * tw, row * th))
            except Exception:
                pass

    grid_blurred = grid.filter(ImageFilter.GaussianBlur(radius=18))
    dimmer = Image.new("RGBA", (canvas.width, canvas.height), (8, 8, 10, 232))
    return Image.alpha_composite(canvas, Image.alpha_composite(grid_blurred, dimmer))
