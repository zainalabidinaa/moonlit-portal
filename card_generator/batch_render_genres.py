#!/usr/bin/env python3
"""Batch render Nuvio-style genre tiles from the shared genre manifest."""

from __future__ import annotations

import argparse
from pathlib import Path

from card_generator.genre_manifest import GENRES, VARIANTS
from card_generator.nuvio_tiles import generate_nuvio_tile


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="card_generator/generated_tiles")
    parser.add_argument("--palette", default="gold", choices=("gold", "white", "moonlit"))
    parser.add_argument("--variants", default="normal,focused,dark")
    parser.add_argument("--background-x", type=int, default=50)
    parser.add_argument("--background-y", type=int, default=50)
    parser.add_argument("--background-zoom", type=int, default=120)
    parser.add_argument("--background-strength", type=int, default=100)
    parser.add_argument("--text-size", type=int, default=58)
    parser.add_argument("--top-grad", type=int, default=0)
    parser.add_argument("--bottom-grad", type=int, default=0)
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    requested_variants = tuple(v.strip() for v in args.variants.split(",") if v.strip())
    subject_dir = Path(__file__).resolve().parent / "subject_assets"
    background_dir = Path(__file__).resolve().parent / "background_assets"
    missing_subjects: list[str] = []
    missing_backgrounds: list[str] = []

    for genre in GENRES:
        subject = genre["subject"]
        if not (subject_dir / f"{subject}.png").exists():
            missing_subjects.append(subject)
        background_bytes = _background_bytes(background_dir, genre["slug"])
        if background_bytes is None:
            missing_backgrounds.append(genre["slug"])
        for variant in requested_variants:
            if variant not in VARIANTS:
                raise SystemExit(f"Unsupported variant: {variant}")
            png = generate_nuvio_tile(
                title=genre["title"],
                subject=subject,
                palette=args.palette,
                variant=variant,
                brush_x=58,
                text_x=7,
                text_size=args.text_size,
                background_image_bytes=background_bytes,
                background_x=args.background_x,
                background_y=args.background_y,
                background_zoom=args.background_zoom,
                background_strength=args.background_strength,
                top_grad_strength=args.top_grad,
                bottom_grad_strength=args.bottom_grad,
            )
            suffix = "" if variant == "normal" else f"-{variant}"
            path = out_dir / f"{genre['slug']}{suffix}.png"
            path.write_bytes(png)
            print(path)

    if missing_subjects:
        unique = sorted(set(missing_subjects))
        report = out_dir / "missing-subject-assets.txt"
        report.write_text("\n".join(unique) + "\n")
        print(f"Missing subject assets: {len(unique)}. See {report}")
    if missing_backgrounds:
        unique = sorted(set(missing_backgrounds))
        report = out_dir / "missing-background-assets.txt"
        report.write_text("\n".join(unique) + "\n")
        print(f"Missing background assets: {len(unique)}. See {report}")


def _background_bytes(background_dir: Path, slug: str) -> bytes | None:
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        path = background_dir / f"{slug}{ext}"
        if path.exists():
            return path.read_bytes()
    return None


if __name__ == "__main__":
    main()
