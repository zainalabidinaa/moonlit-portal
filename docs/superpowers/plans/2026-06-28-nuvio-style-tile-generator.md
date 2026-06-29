# Nuvio-Style Tile Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Nuvio-style genre tile mode to the existing Moonlit Cover Generator.

**Architecture:** Keep the current Flask app and WYSIWYG preview/download flow. Add a focused Pillow renderer for deterministic 1672x941 tiles, then route preview/download requests to that renderer when `mode=nuvio`. The UI exposes title, subject, palette, variant, brush position, and batch download controls.

**Tech Stack:** Python 3, Flask, Pillow, vanilla HTML/CSS/JS.

## Global Constraints

- Do not require a background upload for Nuvio-style tiles.
- Export primary tiles at 1672x941 PNG to match the referenced Nuvio assets.
- Support `normal`, `focused`, and `dark` visual variants.
- Keep all generated genre text deterministic; no AI-rendered text inside final tiles.
- Avoid changing unrelated Moonlit portal/app files.

---

### Task 1: Renderer Module

**Files:**
- Create: `/Users/zain/projects/Moonlit/moonlit-portal/card_generator/nuvio_tiles.py`
- Test: `/Users/zain/projects/Moonlit/moonlit-portal/card_generator/test_nuvio_tiles.py`

**Interfaces:**
- Produces: `generate_nuvio_tile(title: str, subject: str, palette: str, variant: str, brush_x: int, text_x: int, render_scale: float = 1.0) -> bytes`
- Produces: `NUVIO_TILE_W = 1672`, `NUVIO_TILE_H = 941`

- [x] **Step 1: Write renderer tests**

```python
def test_generate_nuvio_tile_returns_png_at_expected_size():
    png = generate_nuvio_tile(title="FOOD", subject="chef", palette="gold", variant="normal", brush_x=58, text_x=7)
    image = Image.open(io.BytesIO(png))
    assert image.size == (1672, 941)
    assert image.format == "PNG"

def test_generate_nuvio_tile_half_scale_preview():
    png = generate_nuvio_tile(title="MARTIAL ARTS", subject="fighter", palette="white", variant="focused", brush_x=54, text_x=7, render_scale=0.5)
    image = Image.open(io.BytesIO(png))
    assert image.size == (836, 470)
```

- [x] **Step 2: Implement deterministic renderer**

Use Pillow to draw the split background, rough brush divider, left title, and right subject silhouette. Build subject silhouettes from simple reusable shape recipes so missing genres can be generated without sourcing copyrighted imagery.

- [x] **Step 3: Run tests**

Run: `python3 -m pytest card_generator/test_nuvio_tiles.py -v`

### Task 2: Flask Routes

**Files:**
- Modify: `/Users/zain/projects/Moonlit/moonlit-portal/card_generator/server.py`

**Interfaces:**
- Consumes: `generate_nuvio_tile(...) -> bytes`
- Preserves: existing `/preview`, `/generate`, `/fonts`

- [x] **Step 1: Route by form mode**

If `request.form["mode"] == "nuvio"`, call `generate_nuvio_tile` instead of requiring `request.files["image"]`.

- [x] **Step 2: Add focused batch endpoint**

If `request.form["downloadAll"] == "true"`, return a zip containing normal, focused, and dark variants.

- [x] **Step 3: Verify existing cover mode still requires image upload**

Run a curl smoke check against both modes.

### Task 3: Browser UI

**Files:**
- Modify: `/Users/zain/projects/Moonlit/moonlit-portal/card_generator/templates/index.html`

**Interfaces:**
- Produces form fields: `mode`, `nuvioSubject`, `nuvioPalette`, `nuvioVariant`, `nuvioBrushX`, `nuvioTextX`, `downloadAll`
- Preserves current centered/cinematic controls for cover mode.

- [x] **Step 1: Add mode switch**

Add `Cover` and `Nuvio Tile` buttons. When `Nuvio Tile` is active, hide background-only controls and render immediately.

- [x] **Step 2: Add Nuvio controls**

Add controls for subject, palette, variant, brush position, text position, and “Download all variants”.

- [x] **Step 3: Verify in browser**

Open `http://127.0.0.1:5050/`, switch to `Nuvio Tile`, and confirm preview renders without uploading an image.
