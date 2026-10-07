import { decodeDukErrTxt } from "./duk-decoder.mjs";

const DUK_SECTION_HEADER_RE = /^[EF]:\s*validari globale/i;

/** Prefer specific DUK KB codes over broad NUI / Z matches when picking the 422 headline. */
const DUK_PRIMARY_CODE_PRIORITY = [
  "DUK_NUI_CHECK",
  "DUK_CUI_INVALID",
  "DUK_SIGNATURE",
  "P7B_EXTRACT_FAILED",
  "DUK_ZIP_CORRUPT",
  "Z_COUNT_MISMATCH",
  "MISSING_Z",
  "NUI_MISMATCH",
];

export function isDukValidationSectionHeader(raw) {
  return DUK_SECTION_HEADER_RE.test(raw.trim());
}

function mapLineForResponse(l) {
  if (isDukValidationSectionHeader(l.raw)) {
    return {
      raw: l.raw,
      title: "Antet validare DUKIntegrator",
      ceInseamna:
        "Marcaj din fișierul .err.txt; nu este o eroare în sine. Citește liniile de dedesubt pentru cauza reală.",
      ceFaci: "Urmează pașii indicați la prima eroare concretă de mai jos.",
      explained: true,
      kind: "section",
    };
  }
  return {
    raw: l.raw,
    code: l.code,
    title: l.title,
    ceInseamna: l.ceInseamna,
    ceFaci: l.ceFaci,
    explained: l.explained,
    kind: "error",
  };
}

function pickPrimaryLine(lines) {
  for (const code of DUK_PRIMARY_CODE_PRIORITY) {
    const hit = lines.find((l) => l.kind === "error" && l.code === code && l.explained);
    if (hit) return hit;
  }
  return (
    lines.find((l) => l.kind === "error" && l.explained) ??
    lines.find((l) => l.kind === "error") ??
    lines[0]
  );
}

export function formatDuk422Payload(errText) {
  const decoded = decodeDukErrTxt(errText);
  const lines = decoded.map(mapLineForResponse);
  const primary = pickPrimaryLine(lines);
  const message = primary?.title ?? "Validarea ANAF a eșuat.";
  const nextStep =
    primary?.ceFaci ??
    "Corectează fișierele la sursă (reexport din casă) și rulează din nou verificarea în browser.";
  const summary = primary?.ceInseamna ?? message;

  return {
    message,
    nextStep,
    summary,
    details: errText,
    lines,
  };
}
