#!/usr/bin/env node
// Builds src/lib/kb/datecs-errors.json from the Datecs error code tables in the pos repo.
//
//   node scripts/build-datecs-kb.mjs [path/to/pos]
//
// Inputs (semicolon CSV: code;;English;Romanian;):
//   <pos>/docs/dude-docs/ErrorCodes/fiscalDevice_ErrorCodes_2017-Table 1.csv
//   <pos>/docs/dude-docs/ErrorCodes/COMServer_ErrorCodes_2017-Table 1.csv  (English only)
// The hints below are hand-written from pos/docs/dude-docs/FP_Protocol_EN.md (status bits, commands),
// pos/docs/fiscal-printer-architecture.md (stuck receipt recovery), pos/docs/fiscal-printer-research/
// (syntax errors) and pos/docs/dude-docs/protocol/cmd-50-vat-rates.md (VAT groups).
// Output is deterministic: running the script twice gives the same file.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const posDir = resolve(process.argv[2] ?? process.env.POS_DIR ?? join(root, "..", "pos"));
const csvDir = join(posDir, "docs", "dude-docs", "ErrorCodes");
const outFile = join(root, "src", "lib", "kb", "datecs-errors.json");

const FILES = [
  { file: "fiscalDevice_ErrorCodes_2017-Table 1.csv", source: "fiscal_device" },
  { file: "COMServer_ErrorCodes_2017-Table 1.csv", source: "com_server" },
];

/** Splits one CSV line on `;`, honouring "quoted;fields" with "" escapes. */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ";") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function clean(s) {
  return String(s ?? "")
    .replace(/ŚūūÓū/g, "error") // mojibake in the 2017 table ("Crypto module ŚūūÓū: ...")
    .replace(/::/g, ":")
    .replace(/\s+/g, " ")
    .replace(/\s+([:;,.)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .trim();
}

const codes = {};
for (const { file, source } of FILES) {
  const text = readFileSync(join(csvDir, file), "utf8").replace(/^﻿/, "");
  let group = source === "com_server" ? "COM Server (driver PC)" : null;
  for (const line of text.split(/\r?\n/)) {
    const cols = splitCsvLine(line);
    const first = clean(cols[0]);
    if (!first) continue;
    // Group header rows look like "(111000 - 111499) REGMODE ERRORS".
    if (/^\(\d+\s*-\s*\d+\)/.test(first)) {
      group = first.replace(/"+$/, "");
      continue;
    }
    if (!/^-?\d+$/.test(first)) continue;
    const en = clean(cols[2]);
    const ro = clean(cols[3]) || null;
    if (!en || /^_ERR_/.test(en)) continue; // range markers, not real errors
    codes[String(Number(first))] = { en, ro, group, source };
  }
}

// ---------------------------------------------------------------------------
// Practical fix steps for the most common errors. Romanian, no diacritics.
// ---------------------------------------------------------------------------
const H = {
  paper: {
    title: "Lipsa hartie",
    status_bit: "2.0 (End of paper)",
    steps: [
      "Deschide capacul imprimantei si scoate miezul rolei goale.",
      "Pune o rola termica noua cu partea lucioasa (cea care se inegreste la zgariat) spre capul de printare.",
      "Lasa 2-3 cm de hartie afara si inchide capacul pana se aude clic.",
      "Verifica in programul POS daca bonul s-a inchis. Daca bonul a ramas deschis, finalizeaza-l sau anuleaza-l inainte de unul nou; nu emite din nou un bon care s-a tiparit deja.",
    ],
  },
  nearPaper: {
    title: "Se termina hartia",
    status_bit: "2.1 (Near paper end)",
    steps: [
      "Este doar un avertisment, poti vinde in continuare.",
      "Pregateste o rola noua si schimb-o la prima pauza, inainte sa se termine in mijlocul unui bon.",
    ],
  },
  cover: {
    title: "Capac deschis",
    status_bit: "0.6 (Cover is open)",
    steps: [
      "Apasa capacul imprimantei pana se inchide cu clic pe ambele parti.",
      "Verifica sa nu fie hartie prinsa in margine; hartia trebuie sa iasa drept prin fanta.",
      "Daca eroarea ramane cu capacul inchis, senzorul de capac poate fi defect: cheama service-ul autorizat.",
    ],
  },
  overheat: {
    title: "Cap de printare supraincalzit",
    steps: [
      "Opreste tiparirea cateva minute (de exemplu dupa rapoarte lungi).",
      "Asigura ventilatie in jurul casei, fara obiecte peste ea.",
      "Daca apare des la bonuri scurte, cheama service-ul autorizat.",
    ],
  },
  cutter: {
    title: "Eroare cutter sau mecanism de printare",
    status_bit: "0.4 (Failure in printing mechanism)",
    steps: [
      "Opreste casa, deschide capacul si scoate hartia blocata sau bucatile rupte din zona cutterului.",
      "Repune rola corect si porneste casa.",
      "Daca eroarea revine, nu forta cutterul: cheama service-ul autorizat.",
    ],
  },
  z24: {
    title: "Au trecut 24 de ore fara raport Z",
    status_bit: "1.2 (More than 24 hours after day opening)",
    steps: [
      "Casa blocheaza vanzarile daca ziua fiscala este deschisa de peste 24 de ore.",
      "Inchide bonul deschis, daca exista, apoi tipareste raportul Z (inchidere de zi) din programul POS sau din meniul casei.",
      "Dupa raportul Z poti vinde din nou.",
      "Fa raportul Z in fiecare zi la inchidere ca sa nu se repete.",
    ],
  },
  zNeeded: {
    title: "Este nevoie de raport Z inainte de operatie",
    steps: [
      "Operatia ceruta (de exemplu schimbarea cotelor TVA sau a datei) se poate face doar cu ziua fiscala inchisa.",
      "Tipareste raportul Z, apoi repeta operatia.",
    ],
  },
  dateTime: {
    title: "Data sau ora gresita",
    status_bit: "0.2 (The real time clock is not synchronized)",
    steps: [
      "Verifica data si ora afisate de casa.",
      "Seteaza data si ora corecte din meniul casei sau din programul POS (comanda 61, format DD-MM-YY hh:mm:ss).",
      "Casa nu accepta o data mai veche decat ultima inregistrare fiscala; daca ceasul a sarit inainte, cheama service-ul autorizat.",
      "Daca ceasul se reseteaza dupa oprire, bateria interna poate fi descarcata: service autorizat.",
    ],
  },
  vatGroup: {
    title: "Grupa de TVA nu este in domeniu sau nu este permisa",
    steps: [
      "Produsul este trimis pe o grupa de TVA (A, B, C, D, E...) care nu este programata in casa.",
      "Tipareste sau citeste cotele TVA programate (comanda 50 / raport de cote) si noteaza ce litera are 21%, ce litera are 11% si ce litera e scutita.",
      "In programul POS, pune fiecare produs pe litera care are cota lui (de exemplu paine si alimente pe litera cu 11%).",
      "Firmele neplatitoare de TVA pot vinde doar pe grupa E (scutit); verifica setarea in program.",
      "Daca lipseste o cota (de exemplu dupa schimbarea cotelor din 2025), cotele se programeaza de service, dupa un raport Z.",
    ],
  },
  vatNotSet: {
    title: "Cotele TVA nu sunt setate",
    steps: [
      "Casa nu are cote TVA programate si nu poate emite bonuri fiscale.",
      "Programarea cotelor se face dupa raportul Z, de regula de service-ul autorizat (comanda 83).",
    ],
  },
  syntax: {
    title: "Eroare de sintaxa in comanda trimisa de programul POS",
    status_bit: "0.0 (Syntax error)",
    steps: [
      "Eroarea vine din programul care trimite comanda, nu de la casierie.",
      "Verifica sa nu existe caractere speciale sau texte prea lungi in numele produsului.",
      "Actualizeaza programul POS; protocolul Datecs cere toate separatoarele (TAB) chiar si pentru campurile goale.",
      "Daca apare la un singur produs, verifica pretul, cantitatea si grupa TVA ale lui.",
      "Daca apare la orice bon, anunta furnizorul programului POS si spune-i codul exact.",
    ],
  },
  invalidCmd: {
    title: "Comanda invalida sau nepermisa acum",
    status_bit: "0.1 (Command code is invalid) / 1.1 (Command is not permitted)",
    steps: [
      "Comanda nu este suportata de modelul sau firmware-ul casei, sau nu este permisa in starea curenta (de exemplu un bon este deja deschis).",
      "Verifica daca exista un bon fiscal sau nefiscal deschis si inchide-l sau anuleaza-l.",
      "Daca eroarea ramane, spune furnizorului POS modelul casei si versiunea de firmware.",
    ],
  },
  receiptOpen: {
    title: "Bon deja deschis",
    status_bit: "2.3 (Fiscal receipt is open) / 2.5 (Nonfiscal receipt is open)",
    steps: [
      "A ramas un bon deschis, de obicei dupa o eroare sau o oprire a programului in timpul vanzarii.",
      "Inchide bonul (plata) sau anuleaza-l din programul POS sau din meniul casei.",
      "Inainte sa repeti vanzarea, verifica daca bonul nu a fost deja tiparit, ca sa nu emiti doua bonuri pentru aceeasi vanzare.",
    ],
  },
  receiptClosed: {
    title: "Bonul este inchis",
    steps: [
      "Programul a trimis un produs sau o plata fara un bon deschis.",
      "Reia vanzarea de la inceput (deschide bon nou).",
      "Daca se repeta, anunta furnizorul programului POS.",
    ],
  },
  fmFull: {
    title: "Memoria fiscala este plina",
    status_bit: "4.4 (Fiscal memory is full) / 4.3 (sub 60 de rapoarte ramase)",
    steps: [
      "Casa nu mai poate salva rapoarte Z, deci nu mai poate vinde fiscal.",
      "Cheama service-ul autorizat: memoria fiscala se inlocuieste sau se trece la alt aparat, cu procedura ANAF.",
      "Pastreaza rapoartele si jurnalul electronic, sunt documente fiscale.",
      "Avertismentul de sub 60 de rapoarte apare inainte; programeaza service-ul atunci.",
    ],
  },
  fmError: {
    title: "Eroare la memoria fiscala",
    steps: [
      "Opreste si porneste casa o data.",
      "Daca eroarea ramane, nu mai incerca operatii fiscale: cheama service-ul autorizat.",
    ],
  },
  ejFull: {
    title: "Jurnalul electronic este plin sau aproape plin",
    status_bit: "2.2 (EJ is full) / 2.4 (EJ nearly full)",
    steps: [
      "La avertismentul de jurnal aproape plin, programeaza service-ul pentru schimbarea jurnalului electronic.",
      "Cand jurnalul este plin, casa nu mai emite bonuri fiscale pana la interventia service-ului.",
      "Exporta datele (fisierele .p7b / rapoartele Z) inainte, daca programul tau permite.",
    ],
  },
  notConnected: {
    title: "Casa nu raspunde (conexiune)",
    steps: [
      "Verifica daca casa este pornita si nu arata o eroare pe ecran.",
      "Verifica cablul USB sau serial (sau reteaua, la conexiune LAN) intre calculator si casa.",
      "In programul POS verifica portul (COM) si viteza de comunicatie.",
      "Reporneste casa, apoi programul POS.",
    ],
  },
  service: {
    title: "Este nevoie de service autorizat",
    steps: [
      "Eroarea nu se poate rezolva din meniul casei sau din programul POS.",
      "Noteaza codul exact si cheama service-ul autorizat care a fiscalizat casa.",
    ],
  },
  wrongMode: {
    title: "Casa nu este in modul potrivit",
    steps: [
      "Pentru lucrul cu programul POS casa trebuie sa fie in mod PC / imprimanta fiscala.",
      "Schimba modul din meniul casei, apoi reporneste programul POS.",
    ],
  },
  noCash: {
    title: "Nu este destul numerar in casa",
    steps: [
      "Suma scoasa sau restul depaseste numerarul inregistrat in casa.",
      "Verifica suma; daca ai pus bani in sertar fara document, inregistreaza un aport (intrare numerar) inainte.",
    ],
  },
};

const HINTS = [
  [["-100403", "-112006", "-111548"], "paper"],
  [["-100405"], "nearPaper"],
  [["-100404", "-112007"], "cover"],
  [["-100402"], "overheat"],
  [["-100407", "-112008"], "cutter"],
  [["-111024", "-110811"], "z24"],
  [["-104000"], "zNeeded"],
  [["-112004", "-101008", "-100508"], "dateTime"],
  [["-111008", "-111005"], "vatGroup"],
  [["-102009"], "vatNotSet"],
  [["-111002", "-112001", "-112101", "-112102", "-112103", "-112104", "-112105", "-101004"], "syntax"],
  [["-112000", "-112002", "-111003"], "invalidCmd"],
  [["-111015", "-111047", "-111046", "-111067"], "receiptOpen"],
  [["-111016"], "receiptClosed"],
  [["-100114"], "fmFull"],
  [["-100101", "-100105", "-100116", "-100505"], "fmError"],
  [["-105010", "-105009"], "ejFull"],
  [["-6", "-33022", "-102006", "-110100", "-10525"], "notConnected"],
  [["-104004", "-110104", "-110107"], "service"],
  [["-112005"], "wrongMode"],
  [["-111017"], "noCash"],
];

const hints = {};
for (const [list, key] of HINTS) {
  for (const code of list) {
    if (!codes[code]) throw new Error(`hint for unknown code ${code}`);
    hints[code] = { key, ...H[key] };
  }
}

const out = {
  generated_by: "scripts/build-datecs-kb.mjs",
  source_files: FILES.map((f) => `pos/docs/dude-docs/ErrorCodes/${f.file}`),
  source_title: "Datecs, lista codurilor de eroare (2017): aparate fiscale si COM Server",
  count: Object.keys(codes).length,
  codes,
  hints,
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${outFile}: ${out.count} codes, ${Object.keys(hints).length} hinted codes`);
