import { basename } from "node:path";
import { Readable } from "node:stream";
import Busboy from "busboy";
import { ClientError } from "./client-error.mjs";
import { MAX_ZIP_ENTRIES } from "./zip-ingest.mjs";

const MULTIPART_MAX_PARTS = MAX_ZIP_ENTRIES;
const MULTIPART_MAX_FILES = MAX_ZIP_ENTRIES;

const tooManyPartsError = () =>
  new ClientError(
    413,
    "Cererea conține prea multe părți (fișiere sau câmpuri).",
    `Trimite cel mult ${MULTIPART_MAX_FILES} fișiere .p7b per cerere (opis plus zile), sau folosește un singur ZIP.`,
    "MULTIPART_PARTS_LIMIT",
  );

const tooManyFilesError = () =>
  new ClientError(
    413,
    "Cererea conține prea multe fișiere.",
    `Include doar opisul și zilele din perioadă (maximum ${MULTIPART_MAX_FILES} fișiere .p7b), sau arhivează-le într-un ZIP.`,
    "MULTIPART_FILES_LIMIT",
  );

/**
 * @param {Buffer} body
 * @param {string} contentType
 * @param {number} maxFileBytes
 */
export async function parseMultipartBody(body, contentType, maxFileBytes) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: {
        fileSize: maxFileBytes,
        files: MULTIPART_MAX_FILES,
        parts: MULTIPART_MAX_PARTS,
      },
    });
    const files = [];
    let zipBuf = null;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    busboy.on("partsLimit", () => fail(tooManyPartsError()));
    busboy.on("filesLimit", () => fail(tooManyFilesError()));

    busboy.on("file", (fieldname, file, info) => {
      const chunks = [];
      file.on("data", (d) => chunks.push(d));
      file.on("limit", () =>
        fail(
          new ClientError(
            413,
            "Un fișier din cerere depășește limita permisă.",
            "Reduce dimensiunea arhivei sau încarcă zilele în mai multe trimiteri.",
            "FILE_TOO_LARGE",
          ),
        ),
      );
      file.on("end", () => {
        const buf = Buffer.concat(chunks);
        const name = info.filename || fieldname;
        if (fieldname === "zip" || name.toLowerCase().endsWith(".zip")) {
          zipBuf = buf;
        } else if (name.toLowerCase().endsWith(".p7b")) {
          files.push({ name: basename(name), data: buf });
        }
      });
    });

    busboy.on("error", (e) => fail(e));
    busboy.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve({ files, zipBuf });
    });
    Readable.from(body).pipe(busboy);
  });
}

export { MULTIPART_MAX_FILES, MULTIPART_MAX_PARTS };
