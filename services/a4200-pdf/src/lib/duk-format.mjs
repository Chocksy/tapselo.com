import { decodeDukErrTxt } from "./duk-decoder.mjs";

const DUK_SECTION_HEADER_RE = /^[EF]:\s*validari globale/i;

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
    title: l.title,
    ceInseamna: l.ceInseamna,
    ceFaci: l.ceFaci,
    explained: l.explained,
    kind: "error",
  };
}

export function formatDuk422Payload(errText) {
  const decoded = decodeDukErrTxt(errText);
  const lines = decoded.map(mapLineForResponse);
  const primary =
    lines.find((l) => l.kind === "error" && l.explained) ??
    lines.find((l) => l.kind === "error") ??
    lines[0];
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
