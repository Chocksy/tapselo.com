#!/usr/bin/env python3
"""
Generate multiple mockup variations with zoom-focused prompts.
Each screenshot gets a tailored prompt to highlight its best content.
"""

import os
import sys
import urllib.request
from pathlib import Path

import fal_client

SCREENSHOTS_DIR = Path(__file__).parent.parent / "public" / "screenshots"
OUTPUT_DIR = SCREENSHOTS_DIR / "mockup"

# Tailored prompts per screenshot — each focuses on the key content area
VARIATIONS = [
    {
        "input": "pos-cart.png",
        "output": "pos-cart-v2.jpg",
        "prompt": (
            "Take this POS app screenshot and create a clean marketing image. "
            "ZOOM IN on the upper portion showing the product list with green accent bar and cart items. "
            "Crop away the empty space in the middle and the bottom total bar. "
            "Present the zoomed content as a floating UI card with rounded corners, "
            "subtle shadow, on a minimal light background. Slight isometric perspective from the right side. "
            "The app content must stay sharp and readable."
        ),
    },
    {
        "input": "admin-sales-dashboard.png",
        "output": "admin-sales-v2.jpg",
        "prompt": (
            "Take this sales dashboard screenshot and create a polished marketing image. "
            "ZOOM IN tightly on the KPI cards row at the top (showing revenue, transactions, margin numbers). "
            "Crop out most of the whitespace. Show the colorful stat cards prominently. "
            "Present as a floating UI element with rounded corners, soft shadow, "
            "slight perspective tilt from the left. Clean light gradient background. "
            "Keep all text and numbers perfectly sharp and readable."
        ),
    },
    {
        "input": "admin-receptie-ocr.png",
        "output": "admin-receptie-v2.jpg",
        "prompt": (
            "Take this admin app screenshot and create a sleek marketing image. "
            "ZOOM IN on the center area showing the 'Receptie marfa' header with the purple 'Scanare factura' button "
            "and the product table below it. Crop the side whitespace. "
            "Present as a floating card with rounded corners, subtle shadow, "
            "very slight tilt. Clean minimal background. "
            "Keep the purple and green buttons clearly visible and sharp."
        ),
    },
    {
        "input": "admin-devices.png",
        "output": "admin-devices-v2.jpg",
        "prompt": (
            "Take this device management screenshot and create a marketing image. "
            "ZOOM IN on the status cards (showing Vanzari azi, Nesanatoase counts) "
            "and the terminal table below showing the connected POS devices. "
            "Crop the top navigation. Present as a floating UI card "
            "with rounded corners, soft shadow, slight perspective. "
            "Clean light background. Keep status badges readable."
        ),
    },
    {
        "input": "admin-dashboard.png",
        "output": "admin-dashboard-v2.jpg",
        "prompt": (
            "Take this admin dashboard screenshot and create a beautiful marketing image. "
            "ZOOM IN on the module cards grid — the colorful feature cards like Produse, "
            "Rapoarte vanzari, Profitabilitate etc. Crop the nav bar at top. "
            "Present as a floating UI element with rounded corners, soft shadow, "
            "slight isometric perspective. Clean minimal background. "
            "Keep the card icons and text sharp."
        ),
    },
]


def process(var):
    input_path = SCREENSHOTS_DIR / var["input"]
    output_path = OUTPUT_DIR / var["output"]

    if not input_path.exists():
        print(f"  Skipping {var['input']} - not found")
        return

    print(f"  Uploading {var['input']}...")
    url = fal_client.upload_file(input_path)

    print(f"  Generating with zoom prompt...")
    result = fal_client.subscribe(
        "fal-ai/nano-banana-2/edit",
        arguments={
            "image_urls": [url],
            "prompt": var["prompt"],
        },
    )

    if result and "images" in result and result["images"]:
        img_url = result["images"][0]["url"]
        urllib.request.urlretrieve(img_url, str(output_path))
        print(f"  Saved: {var['output']}")
    else:
        print(f"  No image returned")


def main():
    if not os.environ.get("FAL_KEY"):
        print("FAL_KEY not set", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)

    for var in VARIATIONS:
        print(f"\nProcessing {var['input']} → {var['output']}...")
        try:
            process(var)
        except Exception as e:
            print(f"  Error: {e}")

    print("\nDone! V2 mockups saved.")


if __name__ == "__main__":
    main()
