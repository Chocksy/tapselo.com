# A4200 PDF service (DUKIntegrator)

Small HTTP service for generating **A4200** PDFs with ANAF **DUKIntegrator** (`-p A4200`), intended for a separate **Coolify** deployment. The main Tapselo site calls it only when `PUBLIC_A4200_PDF_URL` is set.

## Privacy

- Each request uses a fresh temporary directory; it is deleted when the handler finishes.
- Logs contain no file names from uploads and no file contents.

## API

- `GET /health` — liveness
- `POST /a4200` — body:
  - `multipart/form-data` with field `zip` (archive of `.p7b` files), or
  - `multipart/form-data` with one or more `.p7b` parts, or
  - raw `application/zip`

Success: `200` + `application/pdf` (`Content-Disposition`: `A4200_<NUI>_Z<start>-Z<end>.pdf`). Validation failure: `422` + JSON (`message`, `nextStep`, `details` with raw `.err.txt`, `lines` decoded like the site checker). Client mistakes: `4xx` JSON with `message` and `nextStep`.

## Limits (env)

| Variable | Default |
|----------|---------|
| `MAX_BODY_BYTES` | 26214400 (25 MiB) |
| `REQUEST_TIMEOUT_MS` | 120000 |
| `JAVA_TIMEOUT_MS` | 90000 |
| `RATE_LIMIT_MAX` | 20 per window |
| `RATE_LIMIT_WINDOW_MS` | 60000 |
| `CORS_ORIGINS` | `https://tapselo.com,https://www.tapselo.com` |
| `TRUST_PROXY` | unset — ignore `X-Forwarded-For`; set `1` behind Coolify to rate-limit by the last proxy hop |
| `MAX_ZIP_ENTRIES` | 64 |
| `MAX_UNZIPPED_BYTES` | 83886080 (80 MiB) |

## Build

JARs and the integrator `config/` files (`cc2` from versiuni.xml) are fetched from [versiuni.xml](https://static.anaf.ro/static/10/Anaf/update5/versiuni.xml) (integrator `iJars` / `sJars` / `zJars` / `cFisiere`, plus A4200–A4203 validator/PDF jars). Nothing from ANAF is stored in git.

```bash
cd services/a4200-pdf
docker build -t a4200-pdf .
docker run --rm -p 8787:8787 a4200-pdf
```

Local JAR download without Docker:

```bash
npm install
npm run download-duk
```

## Coolify deploy

1. Create a new **Dockerfile** application in Coolify pointing at this repo, build context `services/a4200-pdf`, Dockerfile `Dockerfile`.
2. Expose container port **8787**; set your public hostname (e.g. `https://a4200-pdf.tapselo.com`).
3. Optional env overrides: limits and `CORS_ORIGINS` if you use staging domains.
4. On the **Astro site** (separate app), set `PUBLIC_A4200_PDF_URL` to the public base URL (no trailing slash), e.g. `https://a4200-pdf.tapselo.com`.
5. Redeploy the static site so the “Generează PDF A4200” button appears after checks pass.

Health check path: `/health`.

## Frontend

The checker at `/ghid/verificare-a4200` posts a ZIP of the loaded `.p7b` files to `${PUBLIC_A4200_PDF_URL}/a4200` only when local checks pass and the env var is defined.
