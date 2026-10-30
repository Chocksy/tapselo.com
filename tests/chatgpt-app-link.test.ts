// Published ChatGPT app links on marketing pages (run after `npm run build`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHATGPT_APP_URL } from "../src/lib/mcp/links.ts";

const dist = join(process.cwd(), "dist");

const read = (path: string) => readFileSync(join(dist, path), "utf8");

test("CHATGPT_APP_URL is the published plugin directory entry", () => {
  assert.equal(
    CHATGPT_APP_URL,
    "https://chatgpt.com/plugins/plugin_asdk_app_6abe467813cc819183cb64218c65340d",
  );
});

test("/ai: live ChatGPT link, no stale „mai târziu” copy", () => {
  const html = read("ai/index.html");
  assert.match(html, new RegExp(`href="${CHATGPT_APP_URL.replace(/\//g, "\\/")}"`));
  assert.match(html, /Deschideți în ChatGPT/);
  assert.doesNotMatch(html, /ChatGPT conectorul va fi disponibil mai târziu/i);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  );
  const app = blocks.find((b) => b["@type"] === "SoftwareApplication" && b.name === "Tapselo");
  assert.ok(app, "connector SoftwareApplication JSON-LD");
  assert.equal(app.installUrl, CHATGPT_APP_URL);
});

test("footer and homepage resources expose ChatGPT app link", () => {
  for (const file of ["index.html", "privacy/index.html", "comparatie/index.html"]) {
    const html = read(file);
    assert.match(html, /Deschideți în ChatGPT/, file);
    assert.match(html, new RegExp(CHATGPT_APP_URL.replace(/\//g, "\\/")), file);
  }
});

test("llms.txt mentions published ChatGPT app for /ai/", () => {
  const txt = readFileSync(join(dist, "llms.txt"), "utf8");
  assert.match(txt, /\/ai\/\).*publicată în ChatGPT/);
});
