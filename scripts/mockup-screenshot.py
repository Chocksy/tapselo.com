#!/usr/bin/env python3
"""
Process screenshots with fal.ai Flux to add polished mockup presentation.

Usage:
    FAL_KEY=xxx python3 scripts/mockup-screenshot.py
"""

import os
import sys
import urllib.request
from pathlib import Path

import fal_client

PROMPT = (
    "Take this app screenshot and present it as a polished marketing image. "
    "Trim the excess whitespace on the sides. "
    "Place the screenshot on a clean, slightly angled modern laptop or monitor screen mockup "
    "with a subtle 3D perspective. Add a soft shadow below. "
    "Use a clean light gradient background. "
    "IMPORTANT: Keep the screenshot content exactly as-is, sharp and readable. "
    "Only change the surrounding presentation and framing."
)

SCREENSHOTS_DIR = Path(__file__).parent.parent / "public" / "screenshots"
OUTPUT_DIR = SCREENSHOTS_DIR / "mockup"


def upload_and_process(input_path: Path, output_path: Path):
    """Upload image to fal and process with img2img."""
    print(f"  Uploading {input_path.name}...")
    url = fal_client.upload_file(input_path)
    print(f"  Uploaded: {url[:60]}...")

    print(f"  Processing with Nano Banana 2 (edit)...")
    result = fal_client.subscribe(
        "fal-ai/nano-banana-2/edit",
        arguments={
            "image_urls": [url],
            "prompt": PROMPT,
        },
    )

    if result and "images" in result and result["images"]:
        img_url = result["images"][0]["url"]
        print(f"  Downloading result...")
        urllib.request.urlretrieve(img_url, str(output_path))
        print(f"  Saved: {output_path.name}")
        return True
    else:
        print(f"  No image returned: {result}")
        return False


def main():
    if not os.environ.get("FAL_KEY"):
        print("FAL_KEY not set", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)

    targets = [
        "admin-sales-dashboard.png",
        "admin-receptie-ocr.png",
        "pos-cart.png",
        "admin-devices.png",
        "admin-dashboard.png",
    ]

    for filename in targets:
        input_path = SCREENSHOTS_DIR / filename
        if not input_path.exists():
            print(f"Skipping {filename} - not found")
            continue

        output_path = OUTPUT_DIR / filename.replace(".png", ".jpg")
        print(f"\nProcessing {filename}...")
        try:
            upload_and_process(input_path, output_path)
        except Exception as e:
            print(f"  Error: {e}")

    print("\nDone!")


if __name__ == "__main__":
    main()
