import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dist404 = resolve("dist/404.html");

test("dist/404.html exists for Cloudflare Pages real 404 responses", { skip: !existsSync(dist404) }, () => {
  const html = readFileSync(dist404, "utf8");
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /Pagina nu a fost găsită/);
  assert.match(html, /href="\/unelte\/"/);
  assert.match(html, /href="\/"/);
});
