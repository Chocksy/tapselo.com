// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCtaClickProperties,
  classifyCtaHref,
  normalizePagePath,
} from "../src/lib/cta-click.ts";

const BASE = "https://tapselo.com/ghid/articole/casa-de-marcat-fara-internet/";

test("normalizePagePath adds trailing slash", () => {
  assert.equal(normalizePagePath("/ghid/foo"), "/ghid/foo/");
  assert.equal(normalizePagePath("/"), "/");
  assert.equal(normalizePagePath("/unelte/calculator-reducere"), "/unelte/calculator-reducere/");
});

test("classifyCtaHref: marketing /demo/, app demo, plain app", () => {
  assert.deepEqual(classifyCtaHref("/demo/", BASE)?.target, "demo");
  assert.deepEqual(classifyCtaHref("https://tapselo.com/demo/?x=1", BASE)?.target, "demo");
  assert.deepEqual(classifyCtaHref("https://tapselo.com/demo/", BASE)?.targetUrl, "https://tapselo.com/demo/");
  assert.deepEqual(classifyCtaHref("https://app.tapselo.com/?demo=1", BASE)?.target, "app-demo");
  assert.deepEqual(classifyCtaHref("https://app.tapselo.com", BASE)?.target, "app");
  assert.equal(classifyCtaHref("https://app.tapselo.com/signup", BASE)?.target, "app");
  assert.equal(classifyCtaHref("/ghid/", BASE), null);
  assert.equal(classifyCtaHref("https://evil.example/demo/", BASE), null);
});

test("buildCtaClickProperties sets core fields and utm from page", () => {
  const anchor = {
    getAttribute: (name: string) => (name === "data-tapselo-cta" ? "header" : null),
    href: "https://app.tapselo.com/?demo=1",
  };
  const page = {
    pathname: "/",
    search: "?utm_source=newsletter&utm_medium=email&utm_campaign=spring&fbclid=x",
    href: "https://tapselo.com/?utm_source=newsletter&utm_medium=email&utm_campaign=spring",
  };
  const props = buildCtaClickProperties(anchor, page);
  assert.deepEqual(props, {
    location: "header",
    page_path: "/",
    target: "app-demo",
    target_url: "https://app.tapselo.com/",
    utm_source: "newsletter",
    utm_medium: "email",
    utm_campaign: "spring",
  });
});

test("buildCtaClickProperties: untagged location", () => {
  const anchor = {
    getAttribute: () => null,
    href: "https://tapselo.com/demo/",
  };
  const props = buildCtaClickProperties(anchor, {
    pathname: "/ghid/articole/foo/",
    search: "",
    href: "https://tapselo.com/ghid/articole/foo/",
  });
  assert.equal(props?.location, "untagged");
  assert.equal(props?.page_path, "/ghid/articole/foo/");
  assert.equal(props?.target, "demo");
});