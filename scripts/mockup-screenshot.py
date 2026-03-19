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
    "Take this app screenshot and create a modern, clean marketing presentation. "
    "Crop away any excess whitespace on the sides to tightly frame the content. "
    "Present the screenshot as a floating UI element with rounded corners (12px radius), "
    "a subtle soft shadow underneath, and a very slight 3D perspective tilt. "
    "DO NOT add any device frame, monitor, laptop, or physical hardware around it. "
    "Just the floating interface hovering over a clean, minimal white/light gray gradient background. "
    "Modern SaaS marketing style — like how Linear, Vercel, or Stripe present their product screenshots. "
    "CRITICAL: The app interface content must remain EXACTLY as-is, perfectly sharp and fully readable."
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
