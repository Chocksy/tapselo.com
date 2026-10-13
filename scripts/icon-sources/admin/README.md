# Tapselo Admin favicon sources

Copied from the live admin app (`https://app.tapselo.com`), which declares:

- `/icons/favicon.png`
- `/icons/apple-touch-icon.png`
- `/icons/icon-192.png` and `/icons/icon-512.png` (via `manifest.webmanifest`)

The public `Chocksy/tapselo-pos` repo is a releases/downloads repo and does not contain these assets.

Refresh from production:

```bash
BASE=https://app.tapselo.com/icons
curl -fsSLO "$BASE/favicon.png"
curl -fsSLO "$BASE/apple-touch-icon.png"
curl -fsSLO "$BASE/icon-192.png"
curl -fsSLO "$BASE/icon-512.png"
```

Then run `python3 scripts/generate-favicons.py` from the repo root.
