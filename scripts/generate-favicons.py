#!/usr/bin/env python3
"""Regenerate site favicons from public/logo.png (header/nav brand mark)."""
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "public" / "logo.png"
PUBLIC = ROOT / "public"


def resize_logo(size: int) -> Image.Image:
    logo = Image.open(LOGO).convert("RGBA")
    return logo.resize((size, size), Image.Resampling.LANCZOS)


def write_png(size: int, name: str) -> None:
    resize_logo(size).save(PUBLIC / name, format="PNG", optimize=True)


def write_ico() -> None:
    """Embed 16, 32, and 48 px variants (PIL derives them from the source image)."""
    logo = Image.open(LOGO).convert("RGBA")
    logo.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


def write_svg() -> None:
    buf = io.BytesIO()
    resize_logo(512).save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <image width="512" height="512" href="data:image/png;base64,{b64}"/>
</svg>
"""
    (PUBLIC / "favicon.svg").write_text(svg, encoding="utf-8")


def main() -> None:
    if not LOGO.is_file():
        raise SystemExit(f"Missing brand logo: {LOGO}")

    write_png(192, "favicon.png")
    write_png(32, "favicon-32.png")
    write_png(48, "favicon-48x48.png")
    write_png(180, "apple-touch-icon.png")
    write_png(192, "icon-192.png")
    write_ico()
    write_svg()
    print(f"Favicons regenerated from {LOGO}")


if __name__ == "__main__":
    main()
