import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { VENDOR_LOGO_EXT, vendorLogoPath } from "../src/lib/kb/vendor-logos.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("every mapped vendor logo exists under public/", () => {
  const ids = Object.keys(VENDOR_LOGO_EXT);
  assert.equal(ids.length, 10, "expected 10 competitor logos");

  for (const id of ids) {
    const webPath = vendorLogoPath(id);
    assert.ok(webPath, id);
    assert.equal(webPath, `/vendors/${id}.${VENDOR_LOGO_EXT[id]}`);

    const abs = join(repoRoot, "public", webPath.slice(1));
    assert.ok(existsSync(abs), `missing file for ${webPath}: ${abs}`);
  }

  assert.equal(VENDOR_LOGO_EXT.vilicorest, "png", "vilicorest must use .png on disk, not .webp");
});
