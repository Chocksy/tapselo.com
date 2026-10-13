// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml, inlineMd, markdownH2Toc, slugifyHeading } from "../src/lib/markdown.ts";

test("markdown: paragraphs, bold, lists, links, code", () => {
  const html = markdownToHtml("Din **1 august**\nlinia 2\n\n- unu\n- **doi**\n\n1. a\n2. b [ANAF](https://anaf.ro/x?a=1&b=2)\n\n`28CCCCC`");
  assert.equal(
    html,
    [
      "<p>Din <strong>1 august</strong> linia 2</p>",
      "<ul><li>unu</li><li><strong>doi</strong></li></ul>",
      '<ol><li>a</li><li>b <a href="https://anaf.ro/x?a=1&amp;b=2" rel="noopener" target="_blank">ANAF</a></li></ol>',
      "<p><code>28CCCCC</code></p>",
    ].join("\n"),
  );
});

test("markdown: h2/h3 headings with ids and tables", () => {
  const md = "## Prima secțiune\n\nText.\n\n### Sub\n\n| A | B |\n| --- | --- |\n| unu | **doi** |";
  const html = markdownToHtml(md);
  assert.match(html, /<h2 id="prima-sectiune" class="kb-h2">Prima secțiune<\/h2>/);
  assert.match(html, /<h3 id="sub" class="kb-h3">Sub<\/h3>/);
  assert.match(html, /<table class="kb-table">/);
  assert.match(html, /<strong>doi<\/strong>/);
  assert.deepEqual(markdownH2Toc(md), [{ id: "prima-sectiune", title: "Prima secțiune" }]);
  assert.equal(slugifyHeading("Cine trebuie să țină registrul"), "cine-trebuie-sa-tina-registrul");
});

test("markdown: email_off passes through for Cloudflare", () => {
  assert.equal(
    inlineMd("Contact: <!--email_off-->suport@example.ro<!--/email_off-->"),
    "Contact: <!--email_off-->suport@example.ro<!--/email_off-->",
  );
});

test("markdown: escapes HTML and refuses unsafe links", () => {
  assert.equal(inlineMd('<script>alert(1)</script> "x"'), "&lt;script&gt;alert(1)&lt;/script&gt; &quot;x&quot;");
  assert.doesNotMatch(inlineMd("[click](javascript:alert(1))"), /href|javascript:alert\(1\)\)/);
  assert.equal(inlineMd("[click](javascript:void)"), "click");
  assert.equal(inlineMd("[<b>](https://a.ro)"), '<a href="https://a.ro" rel="noopener" target="_blank">&lt;b&gt;</a>');
  assert.equal(inlineMd("[ghid](/ghid/x)"), '<a href="/ghid/x/">ghid</a>');
  assert.equal(inlineMd("`<i>`"), "<code>&lt;i&gt;</code>");
});
