"""Font downloader, registry & resolver.

Sources:
  Google Fonts : Montserrat ExtraBold/Bold, Inter Bold/Medium (downloaded to fonts/).
  Apple system : SF Pro Display, SF Pro Rounded, SF Compact, New York (macOS only,
                 from /Library/Fonts and /System/Library/Fonts).

`available_fonts()` returns the display names the UI should offer (only fonts that
actually exist on this machine). `truetype(name, size)` resolves a display name to a
PIL font, applying a named variation when one is recorded (e.g. New York weights).

Falls back gracefully to PIL defaults when a font is unavailable.
"""

import os
import platform
import re

import requests
from PIL import ImageFont

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

# Stable GitHub URLs for Montserrat
_MONTSERRAT_URLS = {
    "Montserrat-ExtraBold.ttf": (
        "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/"
        "Montserrat-ExtraBold.ttf"
    ),
    "Montserrat-Bold.ttf": (
        "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/"
        "Montserrat-Bold.ttf"
    ),
}

# Inter fonts are served by Google Fonts CSS API (returns TTF format)
_INTER_WEIGHT_MAP = {
    "Inter-Medium.ttf": 500,
    "Inter-Bold.ttf": 700,
}


def _is_macos() -> bool:
    return platform.system() == "Darwin"


# ---------------------------------------------------------------------------
# Google fonts download (unchanged behaviour)
# ---------------------------------------------------------------------------
def _fetch_inter_ttf_urls() -> dict[str, str]:
    """Query Google Fonts CSS API for Inter static TTF download URLs.

    Returns {font_name: download_url} for Medium (500) and Bold (700).
    """
    result: dict[str, str] = {}
    try:
        css_url = (
            "https://fonts.googleapis.com/css2"
            "?family=Inter:opsz,wght@14..32,500;14..32,700"
        )
        r = requests.get(
            css_url,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
            timeout=10,
        )
        r.raise_for_status()
        # The CSS returns two @font-face blocks in order: 500 then 700
        ttf_urls = re.findall(r"url\((https://[^)]+\.ttf)\)", r.text)
        if len(ttf_urls) >= 1:
            result["Inter-Medium.ttf"] = ttf_urls[0]
        if len(ttf_urls) >= 2:
            result["Inter-Bold.ttf"] = ttf_urls[1]
    except Exception as exc:
        print(f"  ✗ Could not resolve Inter font URLs: {exc}")
    return result


def ensure_google_fonts(quiet: bool = False) -> dict[str, str]:
    """Download Google Fonts if missing; return {font_name: local_path}."""
    os.makedirs(FONTS_DIR, exist_ok=True)
    loaded: dict[str, str] = {}

    # Montserrat from GitHub
    for font_name, url in _MONTSERRAT_URLS.items():
        local_path = os.path.join(FONTS_DIR, font_name)
        if not os.path.exists(local_path):
            if not quiet:
                print(f"  Downloading {font_name} …")
            try:
                r = requests.get(url, timeout=15)
                r.raise_for_status()
                with open(local_path, "wb") as f:
                    f.write(r.content)
            except Exception as exc:
                if not quiet:
                    print(f"  ✗ Could not download {font_name}: {exc}")
                continue
        loaded[font_name] = local_path

    # Inter from Google Fonts CSS API (dynamic TTF URLs)
    inter_urls = _fetch_inter_ttf_urls()
    for font_name, url in inter_urls.items():
        local_path = os.path.join(FONTS_DIR, font_name)
        if not os.path.exists(local_path):
            if not quiet:
                print(f"  Downloading {font_name} …")
            try:
                r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
                r.raise_for_status()
                with open(local_path, "wb") as f:
                    f.write(r.content)
            except Exception as exc:
                if not quiet:
                    print(f"  ✗ Could not download {font_name}: {exc}")
                continue
        loaded[font_name] = local_path

    return loaded


# ---------------------------------------------------------------------------
# Font registry  (display name → (file path, optional named variation))
# ---------------------------------------------------------------------------
_LIBRARY_DIR = "/Library/Fonts"
_SYSTEM_DIR = "/System/Library/Fonts"

# Apple ships these as discrete weight files in /Library/Fonts (no variable-font
# fiddling required). Order = light → heavy, so the menu reads naturally.
_SF_WEIGHTS = [
    "Ultralight", "Thin", "Light", "Regular",
    "Medium", "Semibold", "Bold", "Heavy", "Black",
]


def _sf_family(file_prefix: str, label: str) -> list[tuple[str, str, str | None]]:
    """Build (display, path, variation) entries for an SF weight family."""
    entries: list[tuple[str, str, str | None]] = []
    for weight in _SF_WEIGHTS:
        path = os.path.join(_LIBRARY_DIR, f"{file_prefix}-{weight}.otf")
        entries.append((f"{label} {weight}", path, None))
    return entries


def _registry_entries() -> list[tuple[str, str, str | None]]:
    """Ordered registry of every font we *might* offer (existence checked later)."""
    entries: list[tuple[str, str, str | None]] = [
        # Google fonts (downloaded into fonts/)
        ("Montserrat ExtraBold", os.path.join(FONTS_DIR, "Montserrat-ExtraBold.ttf"), None),
        ("Montserrat Bold", os.path.join(FONTS_DIR, "Montserrat-Bold.ttf"), None),
        ("Inter Bold", os.path.join(FONTS_DIR, "Inter-Bold.ttf"), None),
        ("Inter Medium", os.path.join(FONTS_DIR, "Inter-Medium.ttf"), None),
    ]
    if _is_macos():
        entries += _sf_family("SF-Pro-Display", "SF Pro Display")
        entries += _sf_family("SF-Pro-Rounded", "SF Pro Rounded")
        entries += _sf_family("SF-Compact-Display", "SF Compact")
        ny = os.path.join(_SYSTEM_DIR, "NewYork.ttf")
        entries += [
            ("New York", ny, "Regular"),
            ("New York Medium", ny, "Medium"),
            ("New York Semibold", ny, "Semibold"),
            ("New York Bold", ny, "Bold"),
        ]
    return entries


# display name → (path, variation)
FONT_LIBRARY: dict[str, tuple[str, str | None]] = {
    name: (path, var) for name, path, var in _registry_entries()
}


def _norm(name: str) -> str:
    """Normalise a font name for tolerant lookup (handles hyphens / casing)."""
    return " ".join(name.lower().replace("-", " ").split())


# normalised display name → canonical display name
_NORM_INDEX: dict[str, str] = {_norm(name): name for name in FONT_LIBRARY}


def _lookup_entry(name: str) -> tuple[str, str | None] | None:
    """Resolve *name* (display name, hyphenated alias, …) to a registry entry."""
    if name in FONT_LIBRARY:
        return FONT_LIBRARY[name]
    canonical = _NORM_INDEX.get(_norm(name))
    if canonical:
        return FONT_LIBRARY[canonical]
    return None


def available_fonts() -> list[str]:
    """Display names whose font files actually exist on this machine, in menu order."""
    ensure_google_fonts(quiet=True)
    return [
        name for name, (path, _var) in FONT_LIBRARY.items() if os.path.exists(path)
    ]


# ---------------------------------------------------------------------------
# Resolver  (kept for legacy callers: cli.py / generator.py / server.py)
# ---------------------------------------------------------------------------
_RESOLVED: dict[str, str] = {}
"""Cache of name → path so we only scan once."""


def resolve(name: str) -> str:
    """Return a PIL-safe font file path for *name*, or '' to fall back to default."""
    key = name.lower()
    if key in _RESOLVED:
        return _RESOLVED[key]

    entry = _lookup_entry(name)
    if entry and os.path.exists(entry[0]):
        _RESOLVED[key] = entry[0]
        return entry[0]

    # Direct file path
    if os.path.exists(name):
        _RESOLVED[key] = name
        return name

    # Any .ttf/.otf sitting in fonts/
    for ext in (name, name + ".ttf", name + ".otf"):
        candidate = os.path.join(FONTS_DIR, ext)
        if os.path.exists(candidate):
            _RESOLVED[key] = candidate
            return candidate

    print(f"  ⚠ Font '{name}' not found; falling back to PIL default.")
    _RESOLVED[key] = ""
    return ""


def truetype(name: str, size: int) -> ImageFont.FreeTypeFont:
    """Return a PIL ImageFont for *name* at *size*, applying any named variation."""
    entry = _lookup_entry(name)
    if entry:
        path, variation = entry
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, size)
                if variation:
                    try:
                        font.set_variation_by_name(variation)
                    except Exception:
                        pass  # not a variable font / variation absent → keep default face
                return font
            except Exception:
                pass

    path = resolve(name)
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()
