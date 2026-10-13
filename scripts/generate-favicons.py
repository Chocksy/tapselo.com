#!/usr/bin/env python3
"""Regenerate marketing-site favicons from Tapselo Admin icon sources.

Canonical sources (deployed admin app, not in public tapselo-pos repo):
  https://app.tapselo.com/icons/favicon.png          (64×64)
  https://app.tapselo.com/icons/apple-touch-icon.png (180×180)
  https://app.tapselo.com/icons/icon-192.png
  https://app.tapselo.com/icons/icon-512.png

Cached copies live under scripts/icon-sources/admin/ for reproducible builds.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ADMIN = ROOT / "scripts" / "icon-sources" / "admin"
PUBLIC = ROOT / "public"

FAVICON_64 = ADMIN / "favicon.png"
ICON_192 = ADMIN / "icon-192.png"
APPLE_180 = ADMIN / "apple-touch-icon.png"
ICON_512 = ADMIN / "icon-512.png"


def _open(path: Path) -> Image.Image:
    if not path.is_file():
        raise SystemExit(f"Missing admin icon source: {path}")
    return Image.open(path)


def write_png_from(img: Image.Image, size: int, name: str) -> None:
    out = img.convert("RGBA")
    if out.size != (size, size):
        out = out.resize((size, size), Image.Resampling.LANCZOS)
    out.save(PUBLIC / name, format="PNG", optimize=True)


def write_ico() -> None:
    # Admin has no .ico; derive 16/32/48 from the 64px admin favicon (opaque background).
    fav = _open(FAVICON_64).convert("RGBA")
    fav.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


def main() -> None:
    fav64 = _open(FAVICON_64)
    icon192 = _open(ICON_192)
    apple = _open(APPLE_180)
    icon512 = _open(ICON_512)

    # Exact copies (or same pixels at native size)
    write_png_from(icon192, 192, "favicon.png")
    write_png_from(icon192, 192, "icon-192.png")
    write_png_from(apple, 180, "apple-touch-icon.png")
    write_png_from(icon512, 512, "icon-512.png")
    write_png_from(icon512, 512, "connector-icon-512.png")

    # Sizes not shipped by admin — resize only
    write_png_from(fav64, 32, "favicon-32.png")
    write_png_from(fav64, 48, "favicon-48x48.png")

    write_ico()

    # Admin does not publish favicon.svg; remove stale marketing copy if present.
    stale_svg = PUBLIC / "favicon.svg"
    if stale_svg.is_file():
        stale_svg.unlink()

    print("Favicons written from admin sources in", ADMIN)


if __name__ == "__main__":
    main()
