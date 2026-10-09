/**
 * One-shot generator for synthetic signed PDF test fixtures (throwaway self-signed cert).
 * Run: node scripts/build-a4200-pdf-fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../tests/fixtures/a4200/pdf");
const tmpDir = path.join(outDir, ".tmp");

function pad10(n) {
  return String(n).padStart(10, "0");
}

function minimalPdfBuffer() {
  const parts = [];
  const offsets = [];
  const push = (s) => {
    offsets.push(Buffer.byteLength(parts.join(""), "latin1"));
    parts.push(s);
  };
  push("%PDF-1.4\n");
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  push("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] >>\nendobj\n");
  const xrefPos = Buffer.byteLength(parts.join(""), "latin1");
  const xref =
    "xref\n0 4\n" +
    `${pad10(0)} 65535 f \n` +
    `${pad10(offsets[1])} 00000 n \n` +
    `${pad10(offsets[2])} 00000 n \n` +
    `${pad10(offsets[3])} 00000 n \n`;
  parts.push(xref);
  parts.push("trailer\n<< /Size 4 /Root 1 0 R >>\n");
  parts.push(`startxref\n${xrefPos}\n`);
  parts.push("%%EOF\n");
  return Buffer.from(parts.join(""), "latin1");
}

function ensureCert() {
  fs.mkdirSync(tmpDir, { recursive: true });
  const key = path.join(tmpDir, "test-key.pem");
  const cert = path.join(tmpDir, "test-cert.pem");
  const p12 = path.join(tmpDir, "test.p12");
  if (!fs.existsSync(p12)) {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${key}" -out "${cert}" -days 1 -nodes -subj "/CN=A4200 Synthetic Fixture/O=Tapselo Test"`,
      { stdio: "pipe" },
    );
    execSync(
      `openssl pkcs12 -export -out "${p12}" -inkey "${key}" -in "${cert}" -passout pass:synthetic`,
      { stdio: "pipe" },
    );
  }
  return { signer: new P12Signer(fs.readFileSync(p12), { passphrase: "synthetic" }) };
}

async function signPdf(pdfSigner, pdfBuffer, signer) {
  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: "Synthetic test signature",
    contactInfo: "fixture@example.invalid",
    name: "Synthetic Test",
    location: "RO",
    signatureLength: 12000,
  });
  return await pdfSigner.sign(withPlaceholder, signer);
}

function appendLtvTail(pdfBuffer) {
  const tail = Buffer.from(
    "\n% Synthetic LTV/DSS incremental update (webSIGN-style)\n1 0 obj<< /Type /DSS /Certs [] /OCSPs [] /CRLs [] >>endobj\n%%EOF\n",
    "latin1",
  );
  return Buffer.concat([pdfBuffer, tail]);
}

fs.mkdirSync(outDir, { recursive: true });
const { signer } = ensureCert();
const pdfSigner = new SignPdf();

const unsigned = minimalPdfBuffer();
fs.writeFileSync(path.join(outDir, "unsigned.pdf"), unsigned);

const signed = await signPdf(pdfSigner, unsigned, signer);
fs.writeFileSync(path.join(outDir, "signed-clean.pdf"), signed);

const signedLtv = appendLtvTail(signed);
fs.writeFileSync(path.join(outDir, "signed-with-ltv-tail.pdf"), signedLtv);

let tamperedText = signed.toString("latin1");
const brIdx = tamperedText.lastIndexOf("/ByteRange");
if (brIdx >= 0) {
  tamperedText =
    tamperedText.slice(0, brIdx) +
    tamperedText.slice(brIdx).replace(
      /(\d+)\s*\]/,
      (m, n) => `${Number.parseInt(n, 10) + 9_999_999} ]`,
    );
}
fs.writeFileSync(path.join(outDir, "signed-tampered.pdf"), Buffer.from(tamperedText, "latin1"));

console.log("Wrote fixtures to", outDir);
