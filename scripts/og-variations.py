#!/usr/bin/env python3
"""Generate multiple OG image variations using fal.ai Nano Banana 2."""

import os
import sys
import urllib.request
from pathlib import Path

import fal_client

LOGO = Path(__file__).parent.parent / "public" / "logo.png"
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "og-candidates"

VARIATIONS = [
    {
        "name": "og-hero-dark.jpg",
        "prompt": (
            "Create a professional social media share card (1200x630 landscape). "
            "Use this receipt-T logo prominently on the left side. "
            "Dark navy blue (#0f172a) background with subtle grid pattern. "
            "Large bold white text 'Tapselo POS' on the right. "
            "Below it: 'Vinzi non-stop, cu sau fara net' in lighter text. "
            "A green (#10b981) accent line or dot before the subtitle. "
            "Clean, modern SaaS marketing style. Premium feel."
        ),
    },
    {
        "name": "og-gradient.jpg",
        "prompt": (
            "Create a social media share card (1200x630 landscape). "
            "Use this receipt-T logo as a large centered hero element. "
            "Background: smooth gradient from dark navy (#0f172a) on left to blue (#2563eb) on right. "
            "Text 'Tapselo POS' in bold white below the logo. "
            "Subtitle 'Casa de marcat pentru magazine alimentare' in light gray. "
            "Elegant, minimal, high-end tech product feel. No clutter."
        ),
    },
    {
        "name": "og-split.jpg",
        "prompt": (
            "Create a social media share card (1200x630 landscape). "
            "Split design: left half is dark navy (#0f172a) with the receipt-T logo and 'Tapselo POS' text in white. "
            "Right half shows a blurred, soft view of a grocery store counter or POS terminal. "
            "Clean dividing line between the two halves. Professional, trustworthy."
        ),
    },
    {
        "name": "og-floating.jpg",
        "prompt": (
            "Create a social media share card (1200x630 landscape). "
            "Light gray (#f1f5f9) background. This receipt-T logo floats in the center with a soft shadow. "
            "Below it: 'Tapselo POS' in dark navy (#0f172a) bold text. "
            "Subtitle: 'Casa de marcat inteligenta' in gray. "
            "Subtle blue (#2563eb) and green (#10b981) accent dots or lines. "
            "Apple-style clean minimalism."
        ),
    },
]


def process(var):
    output_path = OUTPUT_DIR / var["name"]
    print(f"  Uploading logo...")
    url = fal_client.upload_file(LOGO)

    print(f"  Generating: {var['name']}...")
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
        print(f"  Saved: {var['name']}")
        return True
    print("  No image returned")
    return False


def main():
    if not os.environ.get("FAL_KEY"):
        print("FAL_KEY not set", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(exist_ok=True)

    for var in VARIATIONS:
        print(f"\nVariation: {var['name']}")
        try:
            process(var)
        except Exception as e:
            print(f"  Error: {e}")

    print(f"\nDone! Check {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
