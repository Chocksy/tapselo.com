// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml, inlineMd } from "../src/lib/markdown.ts";

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

test("markdown: escapes HTML and refuses unsafe links", () => {
  assert.equal(inlineMd('<script>alert(1)</script> "x"'), "&lt;script&gt;alert(1)&lt;/script&gt; &quot;x&quot;");
  assert.doesNotMatch(inlineMd("[click](javascript:alert(1))"), /href|javascript:alert\(1\)\)/);
  assert.equal(inlineMd("[click](javascript:void)"), "click");
  assert.equal(inlineMd("[<b>](https://a.ro)"), '<a href="https://a.ro" rel="noopener" target="_blank">&lt;b&gt;</a>');
  assert.equal(inlineMd("[ghid](/ghid/x)"), '<a href="/ghid/x">ghid</a>');
  assert.equal(inlineMd("`<i>`"), "<code>&lt;i&gt;</code>");
});
