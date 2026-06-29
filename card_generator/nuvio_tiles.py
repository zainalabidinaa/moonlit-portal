"""Deterministic Nuvio-style genre tile rendering.

The source Nuvio assets use a repeatable high-contrast language: a dark/bright
split field, rough brush divider, tracked uppercase title, and a simple genre
silhouette. This module recreates that system without copying source artwork.
"""

from __future__ import annotations

import io
import math
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from card_generator.fonts import ensure_google_fonts, truetype

NUVIO_TILE_W = 1672
NUVIO_TILE_H = 941
HERE = Path(__file__).resolve().parent


@dataclass(frozen=True)
class Palette:
    left: tuple[int, int, int]
    right: tuple[int, int, int]
    text: tuple[int, int, int]
    silhouette: tuple[int, int, int]
    grain: tuple[int, int, int]


PALETTES = {
    "gold": Palette(
        left=(2, 2, 2),
        right=(213, 184, 132),
        text=(230, 202, 153),
        silhouette=(8, 8, 8),
        grain=(250, 232, 185),
    ),
    "white": Palette(
        left=(3, 3, 3),
        right=(245, 245, 242),
        text=(245, 245, 242),
        silhouette=(5, 5, 5),
        grain=(255, 255, 255),
    ),
    "moonlit": Palette(
        left=(3, 4, 8),
        right=(136, 162, 176),
        text=(224, 236, 238),
        silhouette=(2, 4, 7),
        grain=(185, 218, 225),
    ),
}

SUBJECTS = {
    "action": "Action",
    "adventure": "Adventure",
    "anime": "Anime",
    "biography": "Biography",
    "christmas": "Christmas",
    "comedy": "Comedy",
    "crime": "Crime",
    "documentaries": "Documentaries",
    "drama": "Drama",
    "fantasy": "Fantasy",
    "food": "Food & Cooking",
    "game-shows": "Game Shows",
    "history": "History",
    "horror": "Horror",
    "independent": "Independent",
    "kids": "Kids & Family",
    "mafia": "Mafia",
    "martial-arts": "Martial Arts",
    "music": "Music",
    "musicals": "Musicals",
    "mystery": "Mystery",
    "nature": "Nature",
    "news": "News",
    "reality": "Reality TV",
    "romance": "Romance",
    "romcom": "Rom-Com",
    "sci-fi": "Sci-Fi",
    "short-films": "Short Films",
    "sports": "Sports",
    "stand-up": "Stand-up Comedy",
    "thriller": "Thriller",
    "travel": "Travel",
    "war": "War & Military",
    "western": "Western",
}


def generate_nuvio_tile(
    *,
    title: str,
    subject: str,
    palette: str,
    variant: str,
    brush_x: int,
    text_x: int,
    text_size: int = 58,
    subject_image_bytes: bytes | None = None,
    background_image_bytes: bytes | None = None,
    background_x: int = 50,
    background_y: int = 50,
    background_zoom: int = 120,
    background_strength: int = 100,
    show_subject: bool = True,
    top_grad_strength: int = 0,
    bottom_grad_strength: int = 0,
    render_scale: float = 1.0,
) -> bytes:
    """Return a PNG tile matching the Nuvio-inspired genre tile system."""

    ensure_google_fonts(quiet=True)
    scale = max(0.1, float(render_scale))
    w = max(1, round(NUVIO_TILE_W * scale))
    h = max(1, round(NUVIO_TILE_H * scale))
    pal = _palette_for(palette, variant)
    brush_center = int(w * max(20, min(82, brush_x)) / 100)

    canvas = _split_background(
        w,
        h,
        pal,
        brush_center,
        variant,
        background_image_bytes,
        background_x,
        background_y,
        background_zoom,
        background_strength,
    )
    canvas = _paint_brush(canvas, brush_center, pal, variant, bool(background_image_bytes))
    if show_subject:
        if subject_image_bytes is None:
            subject_image_bytes = _bundled_subject_bytes(subject)

        if subject_image_bytes:
            canvas = _draw_subject_image(canvas, subject_image_bytes, pal, variant)
        else:
            canvas = _draw_subject(canvas, subject, pal, variant)
    canvas = _draw_title(canvas, title, pal, text_x, text_size, scale)
    canvas = _apply_surface_texture(canvas, pal, variant)
    canvas = _apply_edge_gradients(canvas, top_grad_strength, bottom_grad_strength, brush_center)

    out = io.BytesIO()
    canvas.convert("RGB").save(out, "PNG", optimize=(scale >= 1.0))
    out.seek(0)
    return out.read()


def _bundled_subject_bytes(subject: str) -> bytes | None:
    safe = "".join(ch for ch in (subject or "").lower() if ch.isalnum() or ch in ("-", "_"))
    if not safe:
        return None
    path = HERE / "subject_assets" / f"{safe}.png"
    if not path.exists():
        return None
    return path.read_bytes()


def _palette_for(name: str, variant: str) -> Palette:
    pal = PALETTES.get(name, PALETTES["gold"])
    if variant == "focused":
        return Palette(
            left=pal.right,
            right=(250, 250, 247),
            text=(5, 5, 5),
            silhouette=pal.left,
            grain=pal.left,
        )
    if variant == "dark":
        return Palette(
            left=(0, 0, 0),
            right=tuple(max(0, int(c * 0.68)) for c in pal.right),
            text=pal.text,
            silhouette=(3, 3, 3),
            grain=pal.grain,
        )
    return pal


def _split_background(
    w: int,
    h: int,
    pal: Palette,
    brush_center: int,
    variant: str,
    background_image_bytes: bytes | None,
    background_x: int,
    background_y: int,
    background_zoom: int,
    background_strength: int,
) -> Image.Image:
    canvas = Image.new("RGBA", (w, h), pal.left + (255,))
    has_photo = bool(background_image_bytes)
    gold = _right_field(
        w,
        h,
        pal,
        variant,
        background_image_bytes,
        background_x,
        background_y,
        background_zoom,
        background_strength,
    )

    if has_photo:
        mask = _photo_reveal_mask(w, h, brush_center)
        canvas.paste(gold, (0, 0), mask)
        return canvas

    mask = Image.new("L", (w, h), 0)
    pixels = mask.load()
    rng = random.Random(8807)
    lean = int(w * 0.18)
    edge_width = max(44, int(w * 0.075))
    spray_width = max(24, int(w * 0.042))
    top_boundary = brush_center + int(w * 0.05)
    for y in range(h):
        boundary = top_boundary - int(lean * (y / max(1, h - 1)))
        wave = math.sin(y * 0.027) * 9 + math.sin(y * 0.083) * 4
        b = boundary + wave
        for x in range(max(0, int(b - edge_width - spray_width)), w):
            d = x - b
            if d >= edge_width:
                a = 255
            elif d <= -spray_width:
                a = 0
            else:
                t = (d + spray_width) / (edge_width + spray_width)
                threshold = t ** 1.55
                grain = rng.random()
                streak = 0.18 * math.sin((x + y * 2.7) * 0.075)
                a = 255 if grain < threshold + streak else 0
                if d > 0:
                    a = max(a, int(255 * min(1, (d / edge_width) ** 0.8)))
            pixels[x, y] = max(pixels[x, y], a)

    mask = mask.filter(ImageFilter.GaussianBlur(radius=max(0.35, w / 3600)))
    canvas.paste(gold, (0, 0), mask)
    return canvas


def _photo_reveal_mask(w: int, h: int, brush_center: int) -> Image.Image:
    mask = Image.new("L", (w, h), 0)
    pixels = mask.load()
    rng = random.Random(9917)
    lean = int(w * 0.14)
    feather = max(56, int(w * 0.065))
    top_boundary = brush_center + int(w * 0.035)
    for y in range(h):
        boundary = top_boundary - int(lean * (y / max(1, h - 1)))
        wave = math.sin(y * 0.018) * 10 + math.sin(y * 0.061) * 5
        b = boundary + wave + rng.uniform(-2.5, 2.5)
        for x in range(max(0, int(b - feather * 1.15)), w):
            t = (x - (b - feather * 0.65)) / feather
            if t <= 0:
                a = 0
            elif t >= 1:
                a = 255
            else:
                eased = t * t * (3 - 2 * t)
                noise = (rng.random() - 0.5) * 28
                a = max(0, min(255, int(eased * 255 + noise)))
            pixels[x, y] = max(pixels[x, y], a)

    return mask.filter(ImageFilter.GaussianBlur(radius=max(1.0, w / 1200)))


def _right_field(
    w: int,
    h: int,
    pal: Palette,
    variant: str,
    background_image_bytes: bytes | None,
    background_x: int,
    background_y: int,
    background_zoom: int,
    background_strength: int,
) -> Image.Image:
    if background_image_bytes:
        try:
            img = Image.open(io.BytesIO(background_image_bytes)).convert("RGBA")
            img = _fit_cover(img, w, h, background_x, background_y, background_zoom)
            return _grade_background_image(img, pal, variant, background_strength)
        except Exception:
            pass

    gold = Image.new("RGBA", (w, h), pal.right + (255,))
    return _texture_gold_field(gold, pal, variant)


def _fit_cover(
    img: Image.Image,
    w: int,
    h: int,
    background_x: int = 50,
    background_y: int = 50,
    background_zoom: int = 100,
) -> Image.Image:
    iw, ih = img.size
    zoom = max(50, min(250, int(background_zoom))) / 100
    scale = max(w / iw, h / ih) * zoom * 1.05
    nw, nh = round(iw * scale), round(ih * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    x_pct = max(-800, min(800, int(background_x))) / 100
    y_pct = max(-800, min(800, int(background_y))) / 100
    left = round((nw - w) * x_pct)
    top = round((nh - h) * y_pct)
    return img.crop((left, top, left + w, top + h))


def _grade_background_image(
    img: Image.Image, pal: Palette, variant: str, background_strength: int
) -> Image.Image:
    w, h = img.size
    is_white_palette = sum(pal.right) / 3 > 232
    if variant == "focused":
        opacity = 0.98
        contrast = 1.18 if is_white_palette else 1.14
        color = 1.03 if is_white_palette else 0.98
        tint = 0.02 if is_white_palette else 0.08
    elif variant == "dark":
        opacity = 0.88
        contrast = 1.22
        color = 0.72
        tint = 0.12 if is_white_palette else 0.34
    else:
        opacity = 0.98
        contrast = 1.18 if is_white_palette else 1.12
        color = 1.0 if is_white_palette else 0.84
        tint = 0.03 if is_white_palette else 0.2
    strength = max(0, min(100, int(background_strength))) / 100
    opacity *= strength

    photo = img.convert("RGB")
    photo = ImageEnhance.Contrast(photo).enhance(contrast)
    photo = ImageEnhance.Color(photo).enhance(color)
    photo = Image.blend(photo, Image.new("RGB", (w, h), pal.right), tint)
    if variant == "dark":
        photo = Image.blend(photo, Image.new("RGB", (w, h), (0, 0, 0)), 0.18)
    texture = _texture_gold_field(Image.new("RGBA", (w, h), pal.right + (255,)), pal, variant)
    return Image.blend(texture, photo.convert("RGBA"), opacity)


def _texture_gold_field(canvas: Image.Image, pal: Palette, variant: str) -> Image.Image:
    w, h = canvas.size
    rng = random.Random(4312)
    texture = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(texture)

    for _ in range(max(1600, int(w * h / 640))):
        x = rng.randrange(w)
        y = rng.randrange(h)
        r = rng.randint(1, max(2, w // 300))
        light = rng.random() > 0.48
        if light:
            color = tuple(min(255, int(c * rng.uniform(1.04, 1.18))) for c in pal.right)
            alpha = rng.randint(10, 34)
        else:
            color = tuple(max(0, int(c * rng.uniform(0.55, 0.82))) for c in pal.right)
            alpha = rng.randint(8, 30)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color + (alpha,))

    for _ in range(max(70, int(w * h / 22000))):
        x = rng.randrange(w)
        y = rng.randrange(h)
        rx = rng.randint(max(12, w // 80), max(26, w // 28))
        ry = rng.randint(max(8, h // 90), max(18, h // 36))
        color = tuple(max(0, int(c * rng.uniform(0.62, 0.88))) for c in pal.right)
        draw.ellipse([x - rx, y - ry, x + rx, y + ry], fill=color + (rng.randint(8, 24),))

    texture = texture.filter(ImageFilter.GaussianBlur(radius=max(0.5, w / 2600)))
    out = Image.alpha_composite(canvas, texture)
    if variant == "dark":
        out = Image.alpha_composite(out, Image.new("RGBA", (w, h), (0, 0, 0, 42)))
    return out


def _paint_brush(
    canvas: Image.Image, brush_center: int, pal: Palette, variant: str, has_photo: bool = False
) -> Image.Image:
    w, h = canvas.size
    rng = random.Random(2718)
    brush = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(brush)
    stroke_color = pal.right if variant != "focused" else pal.left
    if has_photo:
        stroke_color = tuple(int(pal.text[i] * 0.55 + pal.right[i] * 0.45) for i in range(3))
    lean = int(w * (0.14 if has_photo else 0.18))
    top_boundary = brush_center + int(w * (0.035 if has_photo else 0.05))
    step = max(6, h // 90) if has_photo else max(3, h // 150)
    chance = 0.12 if has_photo else 0.55
    alpha_range = (6, 18) if has_photo else (40, 130)
    width_range = (
        (max(1, w // 980), max(2, w // 520))
        if has_photo
        else (max(1, w // 620), max(3, w // 300))
    )
    for y in range(-20, h + 60, step):
        boundary = top_boundary - int(lean * (y / max(1, h)))
        x = int(boundary + math.sin(y * 0.04) * 8 + rng.randint(-10, 22))
        if rng.random() < chance:
            draw.line(
                [(x, y), (x + rng.randint(8, 34), y + rng.randint(10, 46))],
                fill=stroke_color + (rng.randint(*alpha_range),),
                width=rng.randint(*width_range),
            )

    blur = max(0.4, w / 3300) if has_photo else max(0.15, w / 6400)
    brush = brush.filter(ImageFilter.GaussianBlur(radius=blur))
    return Image.alpha_composite(canvas, brush)


def _draw_title(
    canvas: Image.Image, title: str, pal: Palette, text_x: int, text_size: int, scale: float
) -> Image.Image:
    w, h = canvas.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    text = (title or "GENRE").upper()
    requested_size = max(28, min(124, int(text_size)))
    font_size = max(16, round(requested_size * scale))
    spacing = max(1, round(requested_size * 0.31 * scale))
    max_text_w = int(w * 0.34)
    font = truetype("Montserrat Bold", font_size)
    min_font_size = max(14, round(min(34, requested_size) * scale))
    while _tracked_width(font, text, spacing) > max_text_w and font_size > min_font_size:
        font_size -= max(1, round(2 * scale))
        spacing = max(1, spacing - max(1, round(1 * scale)))
        font = truetype("Montserrat Bold", font_size)
    x = int(w * max(2, min(32, text_x)) / 100)
    y = int(h * 0.49 - font_size * 0.58)
    shadow = (0, 0, 0, 110) if sum(pal.text) > 300 else (255, 255, 255, 70)

    for offset in [(max(1, round(2 * scale)), max(1, round(3 * scale)))]:
        _draw_tracked(draw, (x + offset[0], y + offset[1]), text, font, spacing, shadow)
    _draw_tracked(draw, (x, y), text, font, spacing, pal.text + (255,))
    return Image.alpha_composite(canvas, layer)


def _draw_tracked(draw, xy, text: str, font, spacing: int, fill) -> None:
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        try:
            x += font.getlength(ch) + spacing
        except Exception:
            x += font.size * 0.62 + spacing


def _tracked_width(font, text: str, spacing: int) -> float:
    width = 0.0
    for index, ch in enumerate(text):
        try:
            width += font.getlength(ch)
        except Exception:
            width += font.size * 0.62
        if index < len(text) - 1:
            width += spacing
    return width


def _draw_subject(canvas: Image.Image, subject: str, pal: Palette, variant: str) -> Image.Image:
    w, h = canvas.size
    subject_key = (subject or "action").lower()
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    color = pal.silhouette + (248,)
    cx = int(w * 0.76)
    base = int(h * 0.64)
    u = min(w, h) / 145

    genre = _GENRE_CONFIG.get(subject_key)
    if genre is None:
        genre = _GENRE_CONFIG["action"]

    pose = genre.get("pose", "standing")
    props = genre.get("props", [])
    head_wear = genre.get("head_wear", None)
    scale = genre.get("scale", 1.0)

    _draw_human_figure(draw, cx, base, u * scale, color, pose, head_wear)
    for prop in props:
        _draw_prop(draw, cx, base, u * scale, color, prop)

    if variant == "dark":
        glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        glow.paste(layer, (0, 0), layer)
        glow = glow.filter(ImageFilter.GaussianBlur(radius=max(4, int(u * scale * 1.4))))
        tint = Image.new("RGBA", (w, h), pal.grain + (55,))
        glow = Image.composite(tint, Image.new("RGBA", (w, h)), glow.split()[3])
        layer = Image.alpha_composite(glow, layer)

    return Image.alpha_composite(canvas, layer)


_GENRE_CONFIG = {
    "action": {"pose": "fighting", "props": ["speed_lines", "explosion"]},
    "adventure": {"pose": "running", "props": ["compass", "mountain"]},
    "anime": {"pose": "heroic", "props": ["sparkles", "sword"]},
    "biography": {"pose": "standing", "props": ["book"]},
    "christmas": {"pose": "standing", "props": ["gift", "tree_pine"], "head_wear": "santa_hat"},
    "comedy": {"pose": "relaxed", "props": ["microphone", "laugh_lines"]},
    "crime": {"pose": "standing", "props": ["handcuffs", "badge"]},
    "documentaries": {"pose": "standing", "props": ["camera", "globe"]},
    "drama": {"pose": "standing", "props": ["masks"]},
    "fantasy": {"pose": "heroic", "props": ["sword", "magic_orb"]},
    "food": {"pose": "standing", "props": ["chef_hat", "cloche_platter"]},
    "game-shows": {"pose": "celebrating", "props": ["trophy", "confetti"]},
    "history": {"pose": "standing", "props": ["scroll", "crown"]},
    "horror": {"pose": "creeping", "props": ["ghost_shape", "scream_shape"]},
    "independent": {"pose": "standing", "props": ["clapperboard", "beret"]},
    "kids": {"pose": "celebrating", "props": ["balloon", "star"]},
    "mafia": {"pose": "standing", "head_wear": "fedora_hat", "props": ["gun", "cigar"]},
    "martial-arts": {"pose": "fighting", "props": ["nunchaku", "speed_lines"]},
    "music": {"pose": "grooving", "props": ["guitar"]},
    "musicals": {"pose": "dancing", "props": ["music_note", "masks"]},
    "mystery": {"pose": "standing", "head_wear": "fedora_hat", "props": ["magnifying_glass"]},
    "nature": {"pose": "none", "props": ["tree_pine", "mountain", "bird"]},
    "news": {"pose": "standing", "props": ["desk", "microphone"]},
    "reality": {"pose": "standing", "props": ["camera", "heart"]},
    "romance": {"pose": "embrace", "props": ["heart", "rose"]},
    "romcom": {"pose": "embrace", "props": ["heart", "laugh_lines"]},
    "sci-fi": {"pose": "heroic", "props": ["rocket", "planet"]},
    "short-films": {"pose": "standing", "props": ["clapperboard", "film_strip"]},
    "sports": {"pose": "running", "props": ["trophy", "ball"]},
    "stand-up": {"pose": "relaxed", "props": ["microphone_stand", "laugh_lines"]},
    "thriller": {"pose": "fighting", "props": ["gun", "speed_lines"]},
    "travel": {"pose": "walking", "props": ["suitcase", "globe"]},
    "war": {"pose": "fighting", "props": ["gun", "helmet_military"]},
    "western": {"pose": "standing", "head_wear": "cowboy_hat", "props": ["gun", "horse_shoe"]},
}


def _draw_human_figure(draw, cx, base, u, fill, pose, head_wear):
    if pose == "none":
        return
    if pose == "embrace":
        _draw_double_figure(draw, cx, base, u, fill, head_wear)
        return

    body = _POSE_BODIES.get(pose, _POSE_BODIES["standing"])

    head_y = base - 52 * u
    neck_y = base - 44 * u
    shoulder_y = base - 42 * u
    hip_y = base - 12 * u

    _draw_rounded_ellipse(draw, cx, head_y, 7.5 * u, 9 * u, fill)
    _draw_pill(draw, cx, head_y + 1 * u, cx, neck_y, 4.5 * u, fill)
    _draw_torso(draw, cx, shoulder_y, hip_y, 14 * u, 12 * u, fill)

    lshoulder = (cx - 14 * u, shoulder_y + 2 * u)
    rshoulder = (cx + 14 * u, shoulder_y + 2 * u)

    left_arm_offsets = body["left_arm"]
    right_arm_offsets = body["right_arm"]
    left_leg_offsets = body["left_leg"]
    right_leg_offsets = body["right_leg"]

    l_elbow = (lshoulder[0] + left_arm_offsets[0][0] * u, lshoulder[1] + left_arm_offsets[0][1] * u)
    l_hand = (lshoulder[0] + left_arm_offsets[1][0] * u, lshoulder[1] + left_arm_offsets[1][1] * u)
    r_elbow = (rshoulder[0] + right_arm_offsets[0][0] * u, rshoulder[1] + right_arm_offsets[0][1] * u)
    r_hand = (rshoulder[0] + right_arm_offsets[1][0] * u, rshoulder[1] + right_arm_offsets[1][1] * u)

    _draw_limb(draw, lshoulder, l_elbow, l_hand, 6 * u, fill)
    _draw_limb(draw, rshoulder, r_elbow, r_hand, 6 * u, fill)

    lhip = (cx - 10 * u, hip_y)
    rhip = (cx + 10 * u, hip_y)

    l_knee = (lhip[0] + left_leg_offsets[0][0] * u, lhip[1] + left_leg_offsets[0][1] * u)
    l_foot = (lhip[0] + left_leg_offsets[1][0] * u, lhip[1] + left_leg_offsets[1][1] * u)
    r_knee = (rhip[0] + right_leg_offsets[0][0] * u, rhip[1] + right_leg_offsets[0][1] * u)
    r_foot = (rhip[0] + right_leg_offsets[1][0] * u, rhip[1] + right_leg_offsets[1][1] * u)

    _draw_limb(draw, lhip, l_knee, l_foot, 7.5 * u, fill)
    _draw_limb(draw, rhip, r_knee, r_foot, 7.5 * u, fill)

    for joint in [l_elbow, r_elbow, l_hand, r_hand, l_knee, r_knee]:
        draw.ellipse([joint[0] - 2.5 * u, joint[1] - 2.5 * u, joint[0] + 2.5 * u, joint[1] + 2.5 * u], fill=fill)
    for end in [l_hand, r_hand, l_foot, r_foot]:
        draw.ellipse([end[0] - 3 * u, end[1] - 3 * u, end[0] + 3 * u, end[1] + 3 * u], fill=fill)

    if head_wear:
        _draw_head_wear(draw, cx, head_y, u, fill, head_wear)


def _draw_double_figure(draw, cx, base, u, fill, head_wear):
    sep = 18 * u
    for ox in [-sep / 2, sep / 2]:
        hx = cx + ox
        head_y = base - 52 * u
        neck_y = base - 43 * u
        shoulder_y = base - 41 * u
        hip_y = base - 14 * u
        _draw_rounded_ellipse(draw, hx, head_y, 6 * u, 7.5 * u, fill)
        _draw_pill(draw, hx, head_y + 1 * u, hx, neck_y, 3.5 * u, fill)
        _draw_torso(draw, hx, shoulder_y, hip_y, 9 * u, 7 * u, fill)

        lean = 15 * u if ox < cx else -15 * u
        inner = 1 if ox < cx else -1

        lshoulder = (hx - 9 * u, shoulder_y + 2 * u)
        rshoulder = (hx + 9 * u, shoulder_y + 2 * u)
        lhip = (hx - 5 * u, hip_y)
        rhip = (hx + 5 * u, hip_y)

        elbow_y = shoulder_y + 16 * u

        elbow_out = (hx + lean, elbow_y)
        hand_out = (hx + lean * 0.7, elbow_y + 14 * u)
        _draw_limb(draw, lshoulder, elbow_out, hand_out, 4 * u, fill)

        _draw_limb(draw, rshoulder, (hx + inner * 20 * u, elbow_y), (hx + inner * 26 * u, elbow_y + 12 * u), 4 * u, fill)
        _draw_limb(draw, lhip, (hx - 8 * u, hip_y + 26 * u), (hx - 6 * u, hip_y + 48 * u), 6 * u, fill)
        _draw_limb(draw, rhip, (hx + 8 * u, hip_y + 26 * u), (hx + 6 * u, hip_y + 48 * u), 6 * u, fill)

    if head_wear:
        for ox in [-sep / 2, sep / 2]:
            _draw_head_wear(draw, cx + ox, base - 52 * u, u, fill, head_wear)


_POSE_BODIES = {
    "running": {
        "left_arm": ((28, -22), (34, -38)),
        "right_arm": ((-30, -16), (-42, -32)),
        "left_leg": ((-18, 24), (-30, 48)),
        "right_leg": ((24, 26), (42, 52)),
    },
    "fighting": {
        "left_arm": ((-26, -20), (-40, -6)),
        "right_arm": ((24, -26), (46, -14)),
        "left_leg": ((-16, 24), (-26, 52)),
        "right_leg": ((18, 24), (32, 48)),
    },
    "dancing": {
        "left_arm": ((-14, -30), (-26, -14)),
        "right_arm": ((20, -34), (44, -18)),
        "left_leg": ((-14, 22), (-28, 40)),
        "right_leg": ((22, 28), (38, 36)),
    },
    "relaxed": {
        "left_arm": ((-20, 8), (-28, 20)),
        "right_arm": ((24, 6), (38, 16)),
        "left_leg": ((-6, 48), (-8, 74)),
        "right_leg": ((6, 48), (8, 74)),
    },
    "heroic": {
        "left_arm": ((-20, -28), (-36, -42)),
        "right_arm": ((34, -34), (52, -28)),
        "left_leg": ((-10, 24), (-14, 52)),
        "right_leg": ((14, 24), (22, 50)),
    },
    "grooving": {
        "left_arm": ((-30, 0), (-16, 18)),
        "right_arm": ((28, -8), (42, -4)),
        "left_leg": ((-12, 24), (-20, 52)),
        "right_leg": ((10, 28), (18, 54)),
    },
    "celebrating": {
        "left_arm": ((-24, -34), (-38, -50)),
        "right_arm": ((26, -36), (42, -52)),
        "left_leg": ((-8, 24), (-10, 52)),
        "right_leg": ((12, 24), (16, 50)),
    },
    "creeping": {
        "left_arm": ((-13, -24), (-8, -34)),
        "right_arm": ((16, -20), (26, -32)),
        "left_leg": ((-10, 28), (-18, 56)),
        "right_leg": ((10, 28), (18, 56)),
    },
    "walking": {
        "left_arm": ((20, 12), (30, 26)),
        "right_arm": ((-24, 10), (-36, 24)),
        "left_leg": ((-12, 24), (-22, 52)),
        "right_leg": ((16, 22), (28, 46)),
    },
    "standing": {
        "left_arm": ((-18, 8), (-26, 20)),
        "right_arm": ((20, 8), (28, 20)),
        "left_leg": ((-6, 48), (-8, 74)),
        "right_leg": ((6, 48), (8, 74)),
    },
}


def _draw_limb(draw, origin, elbow, endpoint, width, fill):
    w2 = width / 2
    ox, oy = origin
    ex, ey = elbow
    px, py = endpoint

    dx1 = ex - ox
    dy1 = ey - oy
    d1 = max(0.01, math.sqrt(dx1 * dx1 + dy1 * dy1))
    nx1 = -dy1 / d1 * w2
    ny1 = dx1 / d1 * w2

    dx2 = px - ex
    dy2 = py - ey
    d2 = max(0.01, math.sqrt(dx2 * dx2 + dy2 * dy2))
    nx2 = -dy2 / d2 * w2
    ny2 = dx2 / d2 * w2

    poly_points = [
        (ox + nx1, oy + ny1),
        (ex + nx1, ey + ny1),
        (ex + nx2, ey + ny2),
        (px + nx2, py + ny2),
        (px - nx2, py - ny2),
        (ex - nx2, ey - ny2),
        (ex - nx1, ey - ny1),
        (ox - nx1, oy - ny1),
    ]
    draw.polygon(poly_points, fill=fill)
    draw.ellipse([ox - w2, oy - w2, ox + w2, oy + w2], fill=fill)


def _draw_torso(draw, cx, top_y, bottom_y, top_w, bottom_w, fill):
    hw_top = top_w / 2
    hw_bot = bottom_w / 2
    steps = 6
    poly_points = []
    for i in range(steps):
        t = i / (steps - 1)
        x = cx - (hw_top + (hw_bot - hw_top) * t)
        y = top_y + (bottom_y - top_y) * t
        poly_points.append((x, y))
    for i in range(steps):
        t = 1 - i / (steps - 1)
        x = cx + (hw_top + (hw_bot - hw_top) * t)
        y = top_y + (bottom_y - top_y) * t
        poly_points.append((x, y))
    draw.polygon(poly_points, fill=fill)


def _draw_rounded_ellipse(draw, cx, cy, rx, ry, fill):
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill)


def _draw_pill(draw, x1, y1, x2, y2, width, fill):
    w2 = width / 2
    dx = x2 - x1
    dy = y2 - y1
    d = max(0.001, math.sqrt(dx * dx + dy * dy))
    nx = -dy / d * w2
    ny = dx / d * w2
    poly_points = [
        (x1 + nx, y1 + ny),
        (x2 + nx, y2 + ny),
        (x2 - nx, y2 - ny),
        (x1 - nx, y1 - ny),
    ]
    draw.polygon(poly_points, fill=fill)
    draw.ellipse([x1 - w2, y1 - w2, x1 + w2, y1 + w2], fill=fill)
    draw.ellipse([x2 - w2, y2 - w2, x2 + w2, y2 + w2], fill=fill)


def _draw_head_wear(draw, cx, head_y, u, fill, kind):
    if kind == "fedora_hat":
        draw.ellipse([cx - 20 * u, head_y - 14 * u, cx + 20 * u, head_y + 0 * u], fill=fill)
        draw.rectangle([cx - 9 * u, head_y - 24 * u, cx + 9 * u, head_y - 10 * u], fill=fill)
    elif kind == "cowboy_hat":
        draw.ellipse([cx - 22 * u, head_y - 12 * u, cx + 22 * u, head_y + 2 * u], fill=fill)
        draw.rectangle([cx - 8 * u, head_y - 26 * u, cx + 8 * u, head_y - 8 * u], fill=fill)
        draw.polygon([(cx - 26 * u, head_y - 10 * u), (cx - 16 * u, head_y - 18 * u), (cx - 17 * u, head_y - 4 * u)], fill=fill)
        draw.polygon([(cx + 26 * u, head_y - 10 * u), (cx + 16 * u, head_y - 18 * u), (cx + 17 * u, head_y - 4 * u)], fill=fill)
    elif kind == "santa_hat":
        draw.polygon([(cx - 10 * u, head_y - 10 * u), (cx + 14 * u, head_y - 28 * u), (cx + 10 * u, head_y - 10 * u)], fill=fill)
        draw.ellipse([cx + 10 * u, head_y - 30 * u, cx + 18 * u, head_y - 22 * u], fill=fill)
        draw.ellipse([cx - 12 * u, head_y - 8 * u, cx + 14 * u, head_y + 2 * u], fill=fill)
    elif kind == "helmet_military":
        draw.arc([cx - 13 * u, head_y - 16 * u, cx + 13 * u, head_y + 10 * u], 180, 360, fill=fill, width=max(2, int(3 * u)))
        draw.rectangle([cx - 13 * u, head_y - 6 * u, cx - 11 * u, head_y + 4 * u], fill=fill)
        draw.rectangle([cx + 11 * u, head_y - 6 * u, cx + 13 * u, head_y + 4 * u], fill=fill)
    elif kind == "beret":
        draw.ellipse([cx - 12 * u, head_y - 14 * u, cx + 12 * u, head_y - 2 * u], fill=fill)
        draw.ellipse([cx - 6 * u, head_y - 18 * u, cx + 4 * u, head_y - 12 * u], fill=fill)


def _draw_prop(draw, cx, base, u, fill, prop):
    fn = _PROP_DRAWERS.get(prop)
    if fn:
        fn(draw, cx, base, u, fill)


def _prop_sword(draw, cx, base, u, fill):
    draw.rectangle([cx + 30 * u, base - 46 * u, cx + 34 * u, base - 8 * u], fill=fill)
    draw.rectangle([cx + 22 * u, base - 10 * u, cx + 42 * u, base - 2 * u], fill=fill)

def _prop_guitar(draw, cx, base, u, fill):
    draw.ellipse([cx + 18 * u, base - 36 * u, cx + 42 * u, base - 4 * u], fill=fill)
    draw.ellipse([cx + 24 * u, base - 32 * u, cx + 36 * u, base - 8 * u], fill=(255, 255, 255, 0))
    draw.rectangle([cx + 28 * u, base - 4 * u, cx + 32 * u, base + 22 * u], fill=fill)
    draw.rectangle([cx + 44 * u, base + 8 * u, cx + 50 * u, base + 18 * u], fill=fill)

def _prop_camera(draw, cx, base, u, fill):
    draw.rounded_rectangle([cx + 16 * u, base - 32 * u, cx + 48 * u, base + 4 * u], radius=5 * u, fill=fill)
    draw.ellipse([cx + 24 * u, base - 24 * u, cx + 38 * u, base - 4 * u], fill=(255, 255, 255, 0))
    draw.rectangle([cx + 20 * u, base - 40 * u, cx + 32 * u, base - 32 * u], fill=fill)

def _prop_microphone(draw, cx, base, u, fill):
    draw.ellipse([cx + 26 * u, base - 48 * u, cx + 38 * u, base - 34 * u], fill=fill)
    draw.rectangle([cx + 30 * u, base - 34 * u, cx + 34 * u, base - 14 * u], fill=fill)

def _prop_microphone_stand(draw, cx, base, u, fill):
    draw.ellipse([cx + 36 * u, base - 52 * u, cx + 52 * u, base - 32 * u], fill=fill)
    draw.rectangle([cx + 42 * u, base - 32 * u, cx + 46 * u, base + 12 * u], fill=fill)
    draw.polygon([(cx + 32 * u, base + 12 * u), (cx + 56 * u, base + 12 * u), (cx + 44 * u, base + 24 * u)], fill=fill)

def _prop_cloche_platter(draw, cx, base, u, fill):
    draw.pieslice([cx + 8 * u, base - 20 * u, cx + 52 * u, base + 18 * u], 180, 360, fill=fill)
    draw.ellipse([cx + 24 * u, base + 18 * u, cx + 36 * u, base + 24 * u], fill=fill)
    draw.ellipse([cx + 12 * u, base - 24 * u, cx + 24 * u, base - 16 * u], fill=fill)

def _prop_chef_hat(draw, cx, base, u, fill):
    draw.polygon([
        (cx - 14 * u, base + 4 * u), (cx + 14 * u, base + 4 * u),
        (cx + 12 * u, base - 6 * u), (cx + 18 * u, base - 12 * u),
        (cx + 8 * u, base - 18 * u), (cx + 14 * u, base - 26 * u),
        (cx - 4 * u, base - 22 * u), (cx - 10 * u, base - 30 * u),
        (cx - 18 * u, base - 18 * u), (cx - 10 * u, base - 8 * u),
        (cx - 14 * u, base + 2 * u),
    ], fill=fill)

def _prop_book(draw, cx, base, u, fill):
    draw.rectangle([cx + 20 * u, base - 26 * u, cx + 28 * u, base + 6 * u], fill=fill)
    draw.rectangle([cx + 28 * u, base - 30 * u, cx + 48 * u, base + 2 * u], fill=fill)
    draw.polygon([(cx + 20 * u, base - 6 * u), (cx + 28 * u, base - 10 * u), (cx + 28 * u, base + 6 * u), (cx + 20 * u, base + 10 * u)], fill=fill)

def _prop_magnifying_glass(draw, cx, base, u, fill):
    draw.ellipse([cx + 22 * u, base - 44 * u, cx + 42 * u, base - 22 * u], fill=(255, 255, 255, 0))
    draw.arc([cx + 22 * u, base - 44 * u, cx + 42 * u, base - 22 * u], 0, 360, fill=fill, width=max(2, int(4 * u)))
    draw.rectangle([cx + 38 * u, base - 22 * u, cx + 44 * u, base + 14 * u], fill=fill)

def _prop_ghost_shape(draw, cx, base, u, fill):
    draw.ellipse([cx + 14 * u, base - 40 * u, cx + 46 * u, base + 8 * u], fill=fill)
    draw.polygon([(cx + 14 * u, base - 2 * u), (cx + 20 * u, base + 10 * u), (cx + 28 * u, base), (cx + 36 * u, base + 10 * u), (cx + 46 * u, base - 2 * u)], fill=fill)

def _prop_scream_shape(draw, cx, base, u, fill):
    draw.ellipse([cx + 20 * u, base - 42 * u, cx + 40 * u, base - 20 * u], fill=fill)
    draw.ellipse([cx + 14 * u, base - 28 * u, cx + 24 * u, base - 24 * u], fill=(0, 0, 0, 0))
    draw.ellipse([cx + 38 * u, base - 28 * u, cx + 48 * u, base - 24 * u], fill=(0, 0, 0, 0))
    draw.ellipse([cx + 24 * u, base - 14 * u, cx + 36 * u, base - 6 * u], fill=(0, 0, 0, 0))

def _prop_masks(draw, cx, base, u, fill):
    draw.ellipse([cx + 14 * u, base - 28 * u, cx + 30 * u, base - 2 * u], fill=fill)
    draw.ellipse([cx + 18 * u, base - 20 * u, cx + 22 * u, base - 14 * u], fill=(255, 255, 255, 0))
    draw.ellipse([cx + 24 * u, base - 20 * u, cx + 28 * u, base - 14 * u], fill=(255, 255, 255, 0))
    draw.arc([cx + 18 * u, base - 14 * u, cx + 26 * u, base - 4 * u], 0, 180, fill=fill, width=max(1, int(2 * u)))
    draw.ellipse([cx + 38 * u, base - 26 * u, cx + 54 * u, base + 0 * u], fill=fill)
    draw.ellipse([cx + 42 * u, base - 18 * u, cx + 46 * u, base - 12 * u], fill=(255, 255, 255, 0))
    draw.ellipse([cx + 48 * u, base - 18 * u, cx + 52 * u, base - 12 * u], fill=(255, 255, 255, 0))
    draw.arc([cx + 42 * u, base - 8 * u, cx + 50 * u, base + 2 * u], 180, 360, fill=fill, width=max(1, int(2 * u)))

def _prop_heart(draw, cx, base, u, fill):
    heart_cx = cx + 34 * u
    heart_cy = base - 16 * u
    r = 8 * u
    draw.ellipse([heart_cx - r, heart_cy - r - 4 * u, heart_cx, heart_cy + 4 * u], fill=fill)
    draw.ellipse([heart_cx, heart_cy - r - 4 * u, heart_cx + r, heart_cy + 4 * u], fill=fill)
    draw.polygon([(heart_cx - r + 2 * u, heart_cy), (heart_cx + r - 2 * u, heart_cy), (heart_cx, heart_cy + r + 6 * u)], fill=fill)

def _prop_rose(draw, cx, base, u, fill):
    draw.ellipse([cx + 36 * u, base - 22 * u, cx + 48 * u, base - 8 * u], fill=fill)
    draw.ellipse([cx + 32 * u, base - 18 * u, cx + 44 * u, base - 4 * u], fill=fill)
    draw.rectangle([cx + 38 * u, base - 8 * u, cx + 42 * u, base + 12 * u], fill=fill)

def _prop_trophy(draw, cx, base, u, fill):
    draw.ellipse([cx + 22 * u, base - 36 * u, cx + 42 * u, base - 14 * u], fill=fill)
    draw.ellipse([cx + 26 * u, base - 30 * u, cx + 38 * u, base - 20 * u], fill=(255, 255, 255, 0))
    draw.rectangle([cx + 28 * u, base - 14 * u, cx + 36 * u, base - 2 * u], fill=fill)
    draw.rectangle([cx + 22 * u, base - 2 * u, cx + 42 * u, base + 6 * u], fill=fill)

def _prop_ball(draw, cx, base, u, fill):
    draw.ellipse([cx + 26 * u, base - 20 * u, cx + 46 * u, base + 2 * u], fill=fill)
    draw.line([(cx + 34 * u, base - 20 * u), (cx + 34 * u, base + 2 * u)], fill=(255, 255, 255, 0), width=max(1, int(2 * u)))
    draw.line([(cx + 26 * u, base - 8 * u), (cx + 46 * u, base - 8 * u)], fill=(255, 255, 255, 0), width=max(1, int(2 * u)))

def _prop_gun(draw, cx, base, u, fill):
    draw.rectangle([cx + 22 * u, base - 18 * u, cx + 46 * u, base - 5 * u], fill=fill)
    draw.rectangle([cx + 38 * u, base - 22 * u, cx + 44 * u, base - 5 * u], fill=fill)
    draw.rectangle([cx + 14 * u, base - 14 * u, cx + 22 * u, base - 8 * u], fill=fill)

def _prop_speed_lines(draw, cx, base, u, fill):
    for i in range(5):
        ly = base - 50 * u + i * 18 * u
        lx = cx + 48 * u + i * 6 * u
        draw.line([(lx, ly), (lx + 18 * u, ly)], fill=fill, width=max(1, int(2.5 * u)))

def _prop_explosion(draw, cx, base, u, fill):
    pts = []
    for i in range(14):
        angle = i * math.pi * 2 / 14
        r = 16 * u if i % 2 == 0 else 10 * u
        pts.append((cx + 40 * u + math.cos(angle) * r, base - 50 * u + math.sin(angle) * r))
    draw.polygon(pts, fill=fill)

def _prop_sparkles(draw, cx, base, u, fill):
    for ox, oy, s in [(30, -42, 6), (42, -50, 4), (48, -34, 5), (34, -52, 3)]:
        pts = []
        for i in range(8):
            angle = i * math.pi / 4
            r = s * u if i % 2 == 0 else s * u * 0.4
            pts.append((cx + ox * u + math.cos(angle) * r, base + oy * u + math.sin(angle) * r))
        draw.polygon(pts, fill=fill)

def _prop_compass(draw, cx, base, u, fill):
    draw.ellipse([cx + 24 * u, base - 36 * u, cx + 46 * u, base - 14 * u], fill=(255, 255, 255, 0))
    draw.arc([cx + 24 * u, base - 36 * u, cx + 46 * u, base - 14 * u], 0, 360, fill=fill, width=max(1, int(3 * u)))
    draw.polygon([(cx + 35 * u, base - 38 * u), (cx + 32 * u, base - 24 * u), (cx + 38 * u, base - 24 * u)], fill=fill)
    draw.polygon([(cx + 35 * u, base - 12 * u), (cx + 32 * u, base - 24 * u), (cx + 38 * u, base - 24 * u)], fill=fill)

def _prop_mountain(draw, cx, base, u, fill):
    draw.polygon([(cx + 14 * u, base + 16 * u), (cx + 32 * u, base - 28 * u), (cx + 50 * u, base + 16 * u)], fill=fill)
    draw.polygon([(cx + 6 * u, base + 16 * u), (cx + 20 * u, base - 10 * u), (cx + 36 * u, base + 16 * u)], fill=fill)
    draw.line([(cx + 30 * u, base - 14 * u), (cx + 32 * u, base - 28 * u)], fill=(255, 255, 255, 0), width=max(1, int(2 * u)))

def _prop_tree_pine(draw, cx, base, u, fill):
    for layer_y, layer_w, layer_h in [(-20, 16, 14), (-30, 12, 10), (-38, 8, 8)]:
        draw.polygon([
            (cx + 30 * u, base + layer_y * u),
            (cx + 30 * u - layer_w * u, base + (layer_y + layer_h) * u),
            (cx + 30 * u + layer_w * u, base + (layer_y + layer_h) * u),
        ], fill=fill)
    draw.rectangle([cx + 28 * u, base - 4 * u, cx + 32 * u, base + 8 * u], fill=fill)

def _prop_gift(draw, cx, base, u, fill):
    draw.rectangle([cx + 22 * u, base - 26 * u, cx + 44 * u, base + 0 * u], fill=fill)
    draw.rectangle([cx + 30 * u, base - 34 * u, cx + 36 * u, base + 0 * u], fill=fill)
    draw.rectangle([cx + 22 * u, base - 8 * u, cx + 44 * u, base + 0 * u], fill=fill)

def _prop_clapperboard(draw, cx, base, u, fill):
    draw.rectangle([cx + 16 * u, base - 26 * u, cx + 48 * u, base + 6 * u], fill=fill)
    draw.rectangle([cx + 16 * u, base - 34 * u, cx + 48 * u, base - 26 * u], fill=fill)
    draw.rectangle([cx + 16 * u, base - 34 * u, cx + 48 * u, base - 28 * u], fill=(255, 255, 255, 0))

def _prop_film_strip(draw, cx, base, u, fill):
    draw.rectangle([cx + 50 * u, base - 20 * u, cx + 62 * u, base + 26 * u], fill=fill)
    for i in range(5):
        by = base - 16 * u + i * 10 * u
        draw.rectangle([cx + 48 * u, by, cx + 64 * u, by + 4 * u], fill=(255, 255, 255, 0))

def _prop_nunchaku(draw, cx, base, u, fill):
    draw.line([(cx + 26 * u, base - 30 * u), (cx + 46 * u, base - 6 * u)], fill=fill, width=max(1, int(3 * u)))
    draw.line([(cx + 44 * u, base - 8 * u), (cx + 58 * u, base + 6 * u)], fill=fill, width=max(1, int(3 * u)))

def _prop_handcuffs(draw, cx, base, u, fill):
    draw.ellipse([cx + 18 * u, base - 20 * u, cx + 30 * u, base - 6 * u], fill=(255, 255, 255, 0))
    draw.arc([cx + 18 * u, base - 20 * u, cx + 30 * u, base - 6 * u], 0, 360, fill=fill, width=max(1, int(3 * u)))
    draw.ellipse([cx + 34 * u, base - 20 * u, cx + 46 * u, base - 6 * u], fill=(255, 255, 255, 0))
    draw.arc([cx + 34 * u, base - 20 * u, cx + 46 * u, base - 6 * u], 0, 360, fill=fill, width=max(1, int(3 * u)))
    draw.line([(cx + 30 * u, base - 13 * u), (cx + 34 * u, base - 13 * u)], fill=fill, width=max(1, int(2 * u)))

def _prop_badge(draw, cx, base, u, fill):
    pts = []
    for i in range(10):
        angle = i * math.pi * 2 / 10 - math.pi / 2
        r = 10 * u if i % 2 == 0 else 6 * u
        pts.append((cx + 42 * u + math.cos(angle) * r, base - 26 * u + math.sin(angle) * r))
    draw.polygon(pts, fill=fill)

def _prop_globe(draw, cx, base, u, fill):
    draw.ellipse([cx + 22 * u, base - 28 * u, cx + 46 * u, base - 4 * u], fill=(255, 255, 255, 0))
    draw.arc([cx + 22 * u, base - 28 * u, cx + 46 * u, base - 4 * u], 0, 360, fill=fill, width=max(1, int(3 * u)))
    draw.ellipse([cx + 28 * u, base - 28 * u, cx + 38 * u, base + 4 * u], fill=(255, 255, 255, 0))
    draw.ellipse([cx + 20 * u, base - 18 * u, cx + 48 * u, base - 14 * u], fill=(255, 255, 255, 0))
    draw.line([(cx + 22 * u, base - 16 * u), (cx + 46 * u, base - 16 * u)], fill=fill, width=max(1, int(2 * u)))

def _prop_rocket(draw, cx, base, u, fill):
    draw.polygon([(cx + 38 * u, base - 46 * u), (cx + 28 * u, base - 4 * u), (cx + 48 * u, base - 4 * u)], fill=fill)
    draw.ellipse([cx + 32 * u, base - 10 * u, cx + 44 * u, base + 4 * u], fill=fill)
    draw.polygon([(cx + 30 * u, base + 2 * u), (cx + 34 * u, base - 2 * u), (cx + 34 * u, base + 8 * u)], fill=fill)
    draw.polygon([(cx + 46 * u, base + 2 * u), (cx + 42 * u, base - 2 * u), (cx + 42 * u, base + 8 * u)], fill=fill)

def _prop_planet(draw, cx, base, u, fill):
    draw.ellipse([cx + 14 * u, base - 26 * u, cx + 34 * u, base - 6 * u], fill=fill)
    draw.ellipse([cx + 20 * u, base - 12 * u, cx + 24 * u, base - 8 * u], fill=(255, 255, 255, 0))

def _prop_balloon(draw, cx, base, u, fill):
    draw.ellipse([cx + 24 * u, base - 40 * u, cx + 42 * u, base - 14 * u], fill=fill)
    draw.polygon([(cx + 33 * u, base - 14 * u), (cx + 30 * u, base - 2 * u), (cx + 36 * u, base - 2 * u)], fill=fill)

def _prop_star(draw, cx, base, u, fill):
    pts = []
    for i in range(10):
        angle = i * math.pi * 2 / 10 - math.pi / 2
        r = 12 * u if i % 2 == 0 else 5 * u
        pts.append((cx + 40 * u + math.cos(angle) * r, base - 36 * u + math.sin(angle) * r))
    draw.polygon(pts, fill=fill)

def _prop_confetti(draw, cx, base, u, fill):
    rng = random.Random(42)
    for _ in range(12):
        px = cx + rng.uniform(18, 52) * u
        py = base + rng.uniform(-44, 10) * u
        w = rng.uniform(2, 5) * u
        h = rng.uniform(1.5, 3) * u
        draw.rectangle([px, py, px + w, py + h], fill=fill)

def _prop_music_note(draw, cx, base, u, fill):
    draw.ellipse([cx + 36 * u, base - 14 * u, cx + 46 * u, base - 2 * u], fill=fill)
    draw.rectangle([cx + 44 * u, base - 40 * u, cx + 48 * u, base - 4 * u], fill=fill)
    draw.polygon([(cx + 48 * u, base - 40 * u), (cx + 56 * u, base - 34 * u), (cx + 48 * u, base - 30 * u)], fill=fill)

def _prop_laugh_lines(draw, cx, base, u, fill):
    for i in range(3):
        ly = base - 38 * u + i * 10 * u
        draw.arc([cx + 44 * u, ly, cx + 60 * u, ly + 10 * u], 300, 60, fill=fill, width=max(1, int(2 * u)))

def _prop_magic_orb(draw, cx, base, u, fill):
    draw.ellipse([cx + 36 * u, base - 36 * u, cx + 52 * u, base - 18 * u], fill=(255, 255, 255, 0))
    draw.arc([cx + 36 * u, base - 36 * u, cx + 52 * u, base - 18 * u], 0, 360, fill=fill, width=max(1, int(2 * u)))
    draw.ellipse([cx + 40 * u, base - 30 * u, cx + 48 * u, base - 22 * u], fill=fill)

def _prop_scroll(draw, cx, base, u, fill):
    draw.rectangle([cx + 20 * u, base - 18 * u, cx + 44 * u, base + 8 * u], fill=fill)
    draw.ellipse([cx + 16 * u, base - 18 * u, cx + 24 * u, base + 8 * u], fill=fill)
    draw.ellipse([cx + 40 * u, base - 18 * u, cx + 48 * u, base + 8 * u], fill=fill)

def _prop_crown(draw, cx, base, u, fill):
    draw.rectangle([cx + 18 * u, base - 26 * u, cx + 46 * u, base - 14 * u], fill=fill)
    for i in range(5):
        px = cx + 18 * u + i * 7 * u
        py = base - 32 * u if i % 2 == 0 else base - 26 * u
        draw.ellipse([px - 3 * u, py - 2 * u, px + 3 * u, py + 4 * u], fill=(255, 255, 255, 0))

def _prop_suitcase(draw, cx, base, u, fill):
    draw.rounded_rectangle([cx + 18 * u, base - 18 * u, cx + 44 * u, base + 4 * u], radius=3 * u, fill=fill)
    draw.rectangle([cx + 26 * u, base - 24 * u, cx + 36 * u, base - 18 * u], fill=fill)

def _prop_desk(draw, cx, base, u, fill):
    draw.rectangle([cx + 14 * u, base - 4 * u, cx + 48 * u, base + 12 * u], fill=fill)
    draw.rectangle([cx + 12 * u, base + 12 * u, cx + 18 * u, base + 26 * u], fill=fill)
    draw.rectangle([cx + 44 * u, base + 12 * u, cx + 50 * u, base + 26 * u], fill=fill)

def _prop_horse_shoe(draw, cx, base, u, fill):
    draw.arc([cx + 20 * u, base - 20 * u, cx + 46 * u, base + 6 * u], 0, 180, fill=fill, width=max(1, int(4 * u)))

def _prop_cigar(draw, cx, base, u, fill):
    draw.line([(cx + 14 * u, base - 19 * u), (cx + 26 * u, base - 22 * u)], fill=fill, width=max(1, int(3 * u)))
    draw.ellipse([cx + 12 * u, base - 21 * u, cx + 16 * u, base - 17 * u], fill=(255, 100, 20, 255))

def _prop_bird(draw, cx, base, u, fill):
    for i in range(3):
        draw.line([(cx + 38 * u + i * 6 * u, base - 30 * u - i * 4 * u), (cx + 46 * u + i * 6 * u, base - 36 * u - i * 4 * u)], fill=fill, width=max(1, int(2 * u)))
        draw.line([(cx + 38 * u + i * 6 * u, base - 30 * u - i * 4 * u), (cx + 46 * u + i * 6 * u, base - 24 * u - i * 4 * u)], fill=fill, width=max(1, int(2 * u)))


_PROP_DRAWERS = {
    "sword": _prop_sword,
    "guitar": _prop_guitar,
    "camera": _prop_camera,
    "microphone": _prop_microphone,
    "microphone_stand": _prop_microphone_stand,
    "cloche_platter": _prop_cloche_platter,
    "chef_hat": _prop_chef_hat,
    "book": _prop_book,
    "magnifying_glass": _prop_magnifying_glass,
    "ghost_shape": _prop_ghost_shape,
    "scream_shape": _prop_scream_shape,
    "masks": _prop_masks,
    "heart": _prop_heart,
    "rose": _prop_rose,
    "trophy": _prop_trophy,
    "ball": _prop_ball,
    "gun": _prop_gun,
    "speed_lines": _prop_speed_lines,
    "explosion": _prop_explosion,
    "sparkles": _prop_sparkles,
    "compass": _prop_compass,
    "mountain": _prop_mountain,
    "tree_pine": _prop_tree_pine,
    "gift": _prop_gift,
    "clapperboard": _prop_clapperboard,
    "film_strip": _prop_film_strip,
    "nunchaku": _prop_nunchaku,
    "handcuffs": _prop_handcuffs,
    "badge": _prop_badge,
    "globe": _prop_globe,
    "rocket": _prop_rocket,
    "planet": _prop_planet,
    "balloon": _prop_balloon,
    "star": _prop_star,
    "confetti": _prop_confetti,
    "music_note": _prop_music_note,
    "laugh_lines": _prop_laugh_lines,
    "magic_orb": _prop_magic_orb,
    "scroll": _prop_scroll,
    "crown": _prop_crown,
    "suitcase": _prop_suitcase,
    "desk": _prop_desk,
    "horse_shoe": _prop_horse_shoe,
    "bird": _prop_bird,
    "cigar": _prop_cigar,
}


def _draw_subject_image(
    canvas: Image.Image, subject_image_bytes: bytes, pal: Palette, variant: str
) -> Image.Image:
    w, h = canvas.size
    try:
        source = Image.open(io.BytesIO(subject_image_bytes)).convert("RGBA")
    except Exception:
        return canvas

    mask = _subject_mask_from_image(source)
    if mask.getbbox() is None:
        return canvas

    bbox = mask.getbbox()
    source = source.crop(bbox)
    mask = mask.crop(bbox)

    max_w = int(w * 0.34)
    max_h = int(h * 0.76)
    scale = min(max_w / source.width, max_h / source.height)
    new_size = (max(1, int(source.width * scale)), max(1, int(source.height * scale)))
    mask = mask.resize(new_size, Image.Resampling.LANCZOS)

    x = int(w * 0.76 - new_size[0] / 2)
    y = int(h * 0.52 - new_size[1] / 2)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    solid = Image.new("RGBA", new_size, pal.silhouette + (248,))
    layer.paste(solid, (x, y), mask)

    if variant == "dark":
        glow = layer.filter(ImageFilter.GaussianBlur(radius=max(4, int(min(w, h) / 96))))
        tint = Image.new("RGBA", (w, h), pal.grain + (46,))
        glow = Image.composite(tint, Image.new("RGBA", (w, h)), glow.split()[3])
        layer = Image.alpha_composite(glow, layer)

    return Image.alpha_composite(canvas, layer)


def _subject_mask_from_image(source: Image.Image) -> Image.Image:
    alpha = source.split()[3]
    if alpha.getextrema()[0] < 245:
        return alpha.point(lambda p: 255 if p > 24 else 0).filter(ImageFilter.GaussianBlur(radius=0.3))

    rgb = source.convert("RGB")
    lum = rgb.convert("L")
    corners = [
        lum.getpixel((0, 0)),
        lum.getpixel((lum.width - 1, 0)),
        lum.getpixel((0, lum.height - 1)),
        lum.getpixel((lum.width - 1, lum.height - 1)),
    ]
    bright_background = sum(corners) / len(corners) > 180
    if bright_background:
        mask = lum.point(lambda p: 0 if p > 226 else 255)
    else:
        mask = lum.point(lambda p: 255 if p > 36 else 0)
    return mask.filter(ImageFilter.MedianFilter(size=5)).filter(ImageFilter.GaussianBlur(radius=0.35))


def _apply_edge_gradients(
    canvas: Image.Image, top_grad_strength: int, bottom_grad_strength: int, brush_center: int
) -> Image.Image:
    w, h = canvas.size
    if top_grad_strength <= 0 and bottom_grad_strength <= 0:
        return canvas

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

    feather = max(1, int(w * 0.06))
    mask = Image.new("L", (w, h), 0)
    mdraw = ImageDraw.Draw(mask)
    for x in range(brush_center - feather, w):
        t = (x - (brush_center - feather)) / feather
        a = 255 if t >= 1.0 else int(255 * max(0.0, t))
        if a > 0:
            mdraw.line([(x, 0), (x, h)], fill=a)

    return Image.alpha_composite(canvas, Image.composite(grad, Image.new("RGBA", (w, h)), mask))


def _apply_surface_texture(canvas: Image.Image, pal: Palette, variant: str) -> Image.Image:
    w, h = canvas.size
    rng = random.Random(99)
    texture = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(texture)
    count = max(250, int(w * h / 2500))
    alpha = 18 if variant == "focused" else 24
    for _ in range(count):
        x = rng.randrange(w)
        y = rng.randrange(h)
        draw.point((x, y), fill=pal.grain + (rng.randint(4, alpha),))
    return Image.alpha_composite(canvas, texture)
