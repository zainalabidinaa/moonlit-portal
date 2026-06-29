"""Kaptain-style cinematic collection card generator.

Generates richly styled 1640×720 PNG collection covers with:
  - Mesh-prism gradient backdrops
  - Metallic gradient titles
  - Cinematic vignette, film grain, film-strip perforations
  - Neon-bordered showcase cards with drop shadows
  - Google Fonts (Montserrat, Inter) + Apple system fonts (SF Pro, SF Mono, New York)

Usage:
    python -m card_generator --title "My Collection" --theme actors --output out.png

Requires: Pillow, requests, toml
"""
