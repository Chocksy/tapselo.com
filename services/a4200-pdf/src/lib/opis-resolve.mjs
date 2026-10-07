import { join } from "node:path";
import { ClientError } from "./client-error.mjs";

const DAY_FILE_RE = /_Z\d{1,4}\.p7b$/i;

/**
 * Pick the opis .p7b basename in a flat folder (already extracted).
 * @param {string[]} names — basenames only
 */
export function resolveOpisBasename(names) {
  const p7b = names.filter((n) => n.toLowerCase().endsWith(".p7b"));
  if (p7b.length === 0) {
    throw new ClientError(
      400,
      "Nu am găsit fișiere .p7b în cerere.",
      "Încarcă opisul Perioada_raportare.p7b și toate zilele NUI_Zxxxx.p7b din interval.",
      "NO_P7B",
    );
  }

  const preferred = p7b.filter((n) => /^perioada_raportare\.p7b$/i.test(n));
  if (preferred.length > 1) {
    throw new ClientError(
      400,
      "Există mai multe fișiere Perioada_raportare.p7b.",
      "Păstrează un singur opis pentru perioada declarată și șterge duplicatele.",
      "MULTIPLE_OPIS",
    );
  }
  if (preferred.length === 1) return preferred[0];

  const opisLike = p7b.filter((n) => /perioada|raportare/i.test(n));
  if (opisLike.length > 1) {
    throw new ClientError(
      400,
      "Există mai multe fișiere opis în arhivă.",
      "Lasă un singur Perioada_raportare.p7b și doar zilele fiscale din același folder.",
      "MULTIPLE_OPIS",
    );
  }
  if (opisLike.length === 1) return opisLike[0];

  const dayOnly = p7b.filter((n) => DAY_FILE_RE.test(n));
  if (dayOnly.length > 0) {
    throw new ClientError(
      400,
      "Lipsește opisul perioadei (Perioada_raportare.p7b).",
      "Exportă din casă opisul lunii și adaugă-l la aceleași fișiere .p7b înainte de generare.",
      "NO_OPIS",
    );
  }

  throw new ClientError(
    400,
    "Nu am identificat opisul A4200 în fișierele încărcate.",
    "Include Perioada_raportare.p7b (sau un fișier opis cu «perioada» în nume) împreună cu zilele Z.",
    "NO_OPIS",
  );
}

export function opisPathInDir(workDir, names) {
  const base = resolveOpisBasename(names);
  return join(workDir, base);
}
