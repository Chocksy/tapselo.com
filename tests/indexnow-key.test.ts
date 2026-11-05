// IndexNow key file at site root (OpenSEO / IndexNow verification).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const KEY = "43d41a3b6602489aa300d4379db93c45";
const PATH = `/${KEY}.txt`;

test("IndexNow key: public and dist copies match key exactly (no trailing newline)", () => {
  for (const root of ["public", "dist"] as const) {
    const buf = readFileSync(join(process.cwd(), root, `${KEY}.txt`));
    assert.equal(buf.toString("utf8"), KEY, root);
    assert.equal(buf.length, KEY.length, root);
  }
});

test("IndexNow key: served as text/plain via Cloudflare Pages _headers", () => {
  assert.match(
    readFileSync("public/_headers", "utf8"),
    new RegExp(`${PATH.replace(/\./g, "\\.")}\\n\\s+Content-Type: text/plain; charset=utf-8`),
  );
});
