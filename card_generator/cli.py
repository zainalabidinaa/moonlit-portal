#!/usr/bin/env python3
"""Kaptain-style cinematic collection card generator — CLI entry point.

Examples
--------
  # Quick: use a preset theme
  python card_generator.py --title "Moonlit Originals" --theme actors --output out.png

  # Custom accent colour
  python card_generator.py --title "Sci-Fi Vault" --accent-color "#06b6d4" --output out.png

  # Drop a background image
  python card_generator.py --title "My Collection" --background ./bg.jpg --output out.png

  # Showcase cards with your own art
  python card_generator.py --title "Top Picks" --card ./card1.png --card ./card2.png --output out.png

  # Toggle effects off
  python card_generator.py --title "Clean" --no-vignette --no-grain --no-perforations --output out.png

  # Apple font
  python card_generator.py --title "SF Style" --font-title "SF Pro" --output out.png

  # Use a TOML config file (all flags available as keys)
  python card_generator.py --config ./card.toml
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any


def _parse_color(s: str) -> str:
    """Validate hex colour string."""
    s = s.strip().lstrip("#")
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    if len(s) != 6:
        raise argparse.ArgumentTypeError(f"expected hex colour like #ff00cc, got {s!r}")
    try:
        int(s, 16)
    except ValueError:
        raise argparse.ArgumentTypeError(f"invalid hex: {s!r}")
    return f"#{s}"


def _load_config(path: str) -> dict[str, Any]:
    import toml

    with open(path) as fh:
        return toml.load(fh)


def _cfg_bool(cfg: dict[str, Any], key: str, default: bool) -> bool:
    """Read a bool from config dict, falling back to *default*."""
    val = cfg.get(key)
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    return str(val).lower() in ("1", "true", "yes", "on")


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(
        description="Generate a cinematic collection card (1640×720 PNG).",
    )

    # ── Core ───────────────────────────────────────────────────────────
    p.add_argument("--title", type=str, help="Main title text")
    p.add_argument("--subtitle", type=str, default=None, help="Subtitle (default: 'One Click Install')")
    p.add_argument("--output", "-o", type=str, default="card.png", help="Output PNG path")

    # ── Theme ──────────────────────────────────────────────────────────
    p.add_argument("--theme", "-t", type=str, default=None,
                   help="Preset theme name (moonlit, actors, anime, genres, …)")
    p.add_argument("--accent-color", type=_parse_color, default=None,
                   help="Override accent colour (hex, e.g. #a78bfa)")
    p.add_argument("--sphere-colors", type=_parse_color, nargs="*", default=None,
                   help="Override mesh-prism sphere colours (up to 3 hex values)")

    # ── Background ─────────────────────────────────────────────────────
    p.add_argument("--background", "-b", type=str, default=None,
                   help="Path to a background image (covers entire canvas, dimmed)")

    # ── Showcase cards ─────────────────────────────────────────────────
    p.add_argument("--card", type=str, action="append", default=None, dest="showcase_paths",
                   help="Path to a showcase card image (repeatable, up to 5)")
    p.add_argument("--card-title", type=str, action="append", default=None, dest="showcase_titles",
                   help="Title for each showcase card (repeatable, matches --card order)")
    p.add_argument("--showcase-shape", type=str, default="LANDSCAPE",
                   choices=["LANDSCAPE", "POSTER"],
                   help="Showcase card aspect ratio")
    p.add_argument("--max-showcase", type=int, default=3,
                   help="Maximum number of showcase cards to display")
    p.add_argument("--obfuscate-cards", action="store_true", default=False,
                   help="Blur showcase cards (hide copyrighted logos)")

    # ── Effects toggles ────────────────────────────────────────────────
    p.add_argument("--no-vignette", action="store_true", default=False)
    p.add_argument("--no-grain", action="store_true", default=False)
    p.add_argument("--no-perforations", action="store_true", default=False)
    p.add_argument("--no-spotlight", action="store_true", default=False)

    # ── Fonts ──────────────────────────────────────────────────────────
    p.add_argument("--font-title", type=str, default="Montserrat-ExtraBold",
                   help="Font for main title (Montserrat-ExtraBold, Inter-Bold, SF Pro, …)")
    p.add_argument("--font-body", type=str, default="Inter-Medium",
                   help="Font for body/subtitle text")
    p.add_argument("--font-card-title", type=str, default="Inter-Bold",
                   help="Font for obfuscated card title text")

    # ── Config file ────────────────────────────────────────────────────
    p.add_argument("--config", "-c", type=str, default=None,
                   help="TOML config file (all CLI flags available as keys)")

    # ── List themes ────────────────────────────────────────────────────
    p.add_argument("--list-themes", action="store_true", default=False,
                   help="Print available preset theme names and exit")

    args = p.parse_args(argv)

    # ── List themes ────────────────────────────────────────────────────
    if args.list_themes:
        from . import themes as tmod
        print("Available themes:")
        for slug, theme in tmod.THEMES.items():
            r, g, b = theme.line_color
            print(f"  {slug:30s}  #{r:02x}{g:02x}{b:02x}  –  {theme.name}")
        return

    # ── Merge config file ──────────────────────────────────────────────
    if args.config:
        cfg = _load_config(args.config)
        args.title = cfg.get("title", args.title)
        args.subtitle = cfg.get("subtitle", args.subtitle)
        args.output = cfg.get("output", args.output)
        args.theme = cfg.get("theme", args.theme)
        if "accent_color" in cfg:
            args.accent_color = _parse_color(cfg["accent_color"])
        if "sphere_colors" in cfg:
            args.sphere_colors = [_parse_color(c) for c in cfg["sphere_colors"]]
        args.background = cfg.get("background", args.background)
        if "showcase" in cfg:
            sc = cfg["showcase"]
            if isinstance(sc, list):
                args.showcase_paths = [item.get("path") for item in sc]
                args.showcase_titles = [item.get("title", "") for item in sc]
            elif isinstance(sc, dict):
                if "paths" in sc:
                    args.showcase_paths = sc["paths"]
                if "titles" in sc:
                    args.showcase_titles = sc["titles"]
        if "showcase_shape" in cfg:
            args.showcase_shape = cfg["showcase_shape"]
        if "max_showcase" in cfg:
            args.max_showcase = cfg["max_showcase"]
        args.no_vignette = _cfg_bool(cfg, "no_vignette", args.no_vignette)
        args.no_grain = _cfg_bool(cfg, "no_grain", args.no_grain)
        args.no_perforations = _cfg_bool(cfg, "no_perforations", args.no_perforations)
        args.no_spotlight = _cfg_bool(cfg, "no_spotlight", args.no_spotlight)
        if "obfuscate_cards" in cfg:
            args.obfuscate_cards = _cfg_bool(cfg, "obfuscate_cards", False)
        args.font_title = cfg.get("font_title", args.font_title)
        args.font_body = cfg.get("font_body", args.font_body)
        args.font_card_title = cfg.get("font_card_title", args.font_card_title)

    # ── Validate ───────────────────────────────────────────────────────
    if not args.title:
        p.error("--title is required (unless provided via --config)")

    # ── Build showcase cards list ──────────────────────────────────────
    showcase_cards: list[dict] = []
    paths = args.showcase_paths or []
    titles = args.showcase_titles or []
    for i, path in enumerate(paths):
        title = titles[i] if i < len(titles) else f"Card {i+1}"
        showcase_cards.append({"path": path, "title": title})

    # ── Generate ───────────────────────────────────────────────────────
    from . import generator as gen

    # Build sphere_colors list
    sphere_colors = args.sphere_colors if args.sphere_colors else None

    gen.generate(
        title=args.title,
        subtitle=args.subtitle,
        output_path=args.output,
        theme_name=args.theme,
        accent_color=args.accent_color,
        sphere_colors=sphere_colors,
        background_path=args.background,
        showcase_cards=showcase_cards or None,
        showcase_shape=args.showcase_shape,
        max_showcase=args.max_showcase,
        obfuscate_cards=args.obfuscate_cards,
        vignette=not args.no_vignette,
        film_grain=not args.no_grain,
        perforations=not args.no_perforations,
        spotlight=not args.no_spotlight,
        font_title_name=args.font_title,
        font_body_name=args.font_body,
        font_card_title_name=args.font_card_title,
    )


if __name__ == "__main__":
    main()
