import { decodeDukErrTxt } from "./duk-decoder.mjs";

export function formatDuk422Payload(errText) {
  const lines = decodeDukErrTxt(errText);
  const primary = lines.find((l) => l.explained) ?? lines[0];
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
    lines: lines.map((l) => ({
      raw: l.raw,
      title: l.title,
      ceInseamna: l.ceInseamna,
      ceFaci: l.ceFaci,
      explained: l.explained,
    })),
  };
}
