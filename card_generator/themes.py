"""Preset colour themes for collection card generation.

Each theme defines an accent line colour and three sphere parameters (x, y, r, colour)
that compose the mesh-prism gradient background.
"""

from typing import NamedTuple


class Sphere(NamedTuple):
    x: int
    y: int
    r: int
    color: tuple[int, int, int]


class Theme(NamedTuple):
    name: str
    line_color: tuple[int, int, int]
    border_glow: tuple[int, int, int]
    spheres: list[Sphere]


THEMES: dict[str, Theme] = {
    # ── Default (Moonlit) ─────────────────────────────────────────────────
    "moonlit": Theme(
        name="Moonlit",
        line_color=(99, 102, 241),  # Indigo
        border_glow=(99, 102, 241),
        spheres=[
            Sphere(100, 100, 500, (212, 175, 55)),   # Gold
            Sphere(1540, 756, 550, (79, 70, 229)),    # Deep Indigo
            Sphere(820, 100, 400, (226, 232, 240)),   # Silver
        ],
    ),
    # ── ImKaptain originals ───────────────────────────────────────────────
    "nuvio_mega_collection": Theme(
        name="Mega Collection",
        line_color=(34, 197, 94),  # Green
        border_glow=(34, 197, 94),
        spheres=[
            Sphere(100, 100, 500, (212, 175, 55)),
            Sphere(1540, 756, 550, (30, 64, 175)),
            Sphere(820, 100, 400, (226, 232, 240)),
        ],
    ),
    "trending_new": Theme(
        name="Trending & New",
        line_color=(16, 185, 129),  # Emerald
        border_glow=(16, 185, 129),
        spheres=[
            Sphere(100, 700, 500, (16, 185, 129)),
            Sphere(1540, 100, 500, (29, 78, 216)),
            Sphere(820, 756, 450, (132, 204, 22)),
        ],
    ),
    "streaming_services": Theme(
        name="Streaming Services",
        line_color=(239, 68, 68),  # Red
        border_glow=(239, 68, 68),
        spheres=[
            Sphere(100, 100, 550, (229, 9, 20)),
            Sphere(1540, 756, 500, (0, 168, 225)),
            Sphere(820, 428, 450, (106, 27, 154)),
        ],
    ),
    "networks": Theme(
        name="Networks",
        line_color=(6, 182, 212),  # Cyan
        border_glow=(6, 182, 212),
        spheres=[
            Sphere(100, 756, 500, (6, 182, 212)),
            Sphere(1540, 100, 550, (249, 115, 22)),
            Sphere(820, 100, 400, (79, 70, 229)),
        ],
    ),
    "genres": Theme(
        name="Genres",
        line_color=(217, 70, 239),  # Purple
        border_glow=(217, 70, 239),
        spheres=[
            Sphere(100, 100, 550, (107, 33, 168)),
            Sphere(1540, 756, 500, (236, 72, 153)),
            Sphere(820, 756, 450, (6, 182, 212)),
        ],
    ),
    "film_collections": Theme(
        name="Film Collections",
        line_color=(139, 92, 246),  # Violet
        border_glow=(139, 92, 246),
        spheres=[
            Sphere(100, 756, 500, (185, 28, 28)),
            Sphere(1540, 100, 500, (29, 78, 216)),
            Sphere(820, 428, 500, (109, 40, 217)),
        ],
    ),
    "actors": Theme(
        name="Actors",
        line_color=(167, 139, 250),  # Soft Purple
        border_glow=(167, 139, 250),
        spheres=[
            Sphere(100, 100, 500, (76, 29, 149)),
            Sphere(1540, 756, 500, (244, 63, 94)),
            Sphere(820, 100, 450, (148, 163, 184)),
        ],
    ),
    "legendary_directors": Theme(
        name="Directors",
        line_color=(245, 158, 11),  # Amber
        border_glow=(245, 158, 11),
        spheres=[
            Sphere(100, 756, 500, (180, 83, 9)),
            Sphere(1540, 100, 500, (20, 110, 120)),
            Sphere(820, 756, 450, (217, 119, 6)),
        ],
    ),
    "studios": Theme(
        name="Studios",
        line_color=(234, 179, 8),  # Gold
        border_glow=(234, 179, 8),
        spheres=[
            Sphere(100, 100, 500, (202, 138, 4)),
            Sphere(1540, 756, 500, (15, 23, 42)),
            Sphere(820, 428, 450, (4, 120, 87)),
        ],
    ),
    "by_decade": Theme(
        name="By Decade",
        line_color=(244, 63, 94),  # Rose
        border_glow=(244, 63, 94),
        spheres=[
            Sphere(100, 756, 550, (244, 63, 94)),
            Sphere(1540, 100, 500, (6, 182, 212)),
            Sphere(820, 428, 450, (217, 119, 6)),
        ],
    ),
    "anime": Theme(
        name="Anime",
        line_color=(220, 38, 38),  # Crimson
        border_glow=(220, 38, 38),
        spheres=[
            Sphere(100, 100, 500, (220, 38, 38)),
            Sphere(1540, 756, 500, (234, 179, 8)),
            Sphere(820, 100, 450, (249, 115, 22)),
        ],
    ),
    "awards": Theme(
        name="Awards",
        line_color=(251, 191, 36),  # Gold
        border_glow=(251, 191, 36),
        spheres=[
            Sphere(100, 756, 500, (146, 64, 14)),
            Sphere(1540, 100, 500, (217, 119, 6)),
            Sphere(820, 428, 450, (88, 28, 135)),
        ],
    ),
}

# Quick hex → RGB helper
def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
