import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanTextSnippet, decodeHtmlEntities } from "@/components/result/rich-job-description";

async function runStage5Tests() {
  console.log("> [STAGE 5] Running Front-End Ergonomics & Visual Token Governance Tests...");

  const baseDir = process.cwd();
  const targetFiles = [
    "components/result/job-dossier-deck.tsx",
    "components/navigation/app-sidebar.tsx",
    "components/agent/task-input.tsx",
    "app/app/marketplace/page.tsx",
    "components/result/rich-job-description.tsx",
    "components/connectors/connector-preferences-modal.tsx",
  ];

  // 1. Zero Em-Dash, En-Dash, and Emoji Audit
  console.log("  1. Verifying Zero Em-dash (\\u2014), En-dash (\\u2013), and Emoji directive across all target files...");
  const forbiddenCharsRegex = /[\u2014\u2013\uD800-\uDBFF\uDC00-\uDFFF]/;

  for (const relPath of targetFiles) {
    const fullPath = path.join(baseDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    const content = fs.readFileSync(fullPath, "utf8");

    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      // Allow Unicode escape literals like \u2014 or \u2013 used in sanitizers/regexes
      const strippedOfRegexEscapes = line
        .replace(/\\u2014/g, "")
        .replace(/\\u2013/g, "")
        .replace(/\\uD800-\\uDBFF\\uDC00-\\uDFFF/g, "");

      if (forbiddenCharsRegex.test(strippedOfRegexEscapes)) {
        throw new Error(
          `Forbidden character (em-dash, en-dash, or emoji) found in ${relPath} at line ${idx + 1}: "${line.trim()}"`
        );
      }
    });
  }
  console.log("  [PASS] All 6 UI components strictly adhere to Zero em-dash, en-dash, and emoji directives");

  // 2. Visual Token Governance ("Navy Ink on Cool Marble")
  console.log("  2. Verifying Navy Ink on Cool Marble design tokens and solid backdrop opacities...");
  const forbiddenColorTokens = ["bg-fuchsia", "text-fuchsia", "bg-purple-", "text-purple-", "bg-magenta", "text-magenta"];

  for (const relPath of targetFiles) {
    const fullPath = path.join(baseDir, relPath);
    const content = fs.readFileSync(fullPath, "utf8");

    for (const forbidden of forbiddenColorTokens) {
      assert.ok(
        !content.includes(forbidden),
        `Found forbidden color token "${forbidden}" in ${relPath}. Navy Ink on Cool Marble palette must be preserved.`
      );
    }
  }
  console.log("  [PASS] Zero unauthorized purple, magenta, or fuchsia tokens found across target UI files");

  // 3. Viewport Containment & Zero Horizontal Overflow Defenses
  console.log("  3. Verifying Viewport Containment classes in search cards & recruiter chips...");

  const deckContent = fs.readFileSync(path.join(baseDir, "components/result/job-dossier-deck.tsx"), "utf8");
  assert.ok(
    deckContent.includes("max-w-full overflow-hidden"),
    "job-dossier-deck.tsx must enforce max-w-full overflow-hidden on cards and recruiter chips to prevent horizontal scroll"
  );
  assert.ok(
    deckContent.includes("truncate"),
    "job-dossier-deck.tsx must enforce text truncation on company names and recruiter titles"
  );

  const marketplaceContent = fs.readFileSync(path.join(baseDir, "app/app/marketplace/page.tsx"), "utf8");
  assert.ok(
    marketplaceContent.includes("max-w-full overflow-hidden"),
    "marketplace/page.tsx must enforce max-w-full overflow-hidden on cards and recruiter chips"
  );
  assert.ok(
    marketplaceContent.includes("bg-background/98 backdrop-blur-md"),
    "marketplace/page.tsx sticky header must use high-opacity solid backdrop to prevent background bleed-through"
  );

  const sidebarContent = fs.readFileSync(path.join(baseDir, "components/navigation/app-sidebar.tsx"), "utf8");
  assert.ok(
    sidebarContent.includes("bg-card border border-border"),
    "app-sidebar.tsx context menus and mobile header controls must use standard solid card tokens"
  );

  console.log("  [PASS] Viewport containment and overflow boundaries verified across cards, chips, and headers");

  // 4. HTML Entity Sanitization & Snippet Truncation Integrity
  console.log("  4. Verifying cleanTextSnippet() entity decoding & sanitization...");
  const rawSample = `
    &lt;div class="job-body"&gt;
      &lt;h3&gt;Senior Staff Engineer &amp; Architect&lt;/h3&gt;
      &lt;p&gt;We are seeking a leader &amp;mdash; someone passionate about Next.js &amp;amp; AI pipelines.&lt;/p&gt;
      &lt;script&gt;alert('malicious');&lt;/script&gt;
      &lt;ul&gt;
        &lt;li&gt;5+ years building distributed backends&lt;/li&gt;
        &lt;li&gt;Expertise in PostgreSQL &amp;amp; Redis&lt;/li&gt;
      &lt;/ul&gt;
    &lt;/div&gt;
  `;

  const cleaned = cleanTextSnippet(rawSample);
  assert.ok(!cleaned.includes("&lt;"), "Escaped HTML entities must be decoded");
  assert.ok(!cleaned.includes("<div"), "HTML tags must be stripped");
  assert.ok(!cleaned.includes("alert"), "Script contents must be purged");
  assert.ok(!cleaned.includes("\u2014"), "Em-dashes must be normalized to hyphens");
  assert.ok(cleaned.includes("Senior Staff Engineer & Architect"));
  assert.ok(cleaned.includes("Next.js & AI pipelines"));
  assert.ok(cleaned.includes("5+ years building distributed backends"));
  console.log("  [PASS] cleanTextSnippet() successfully sanitizes, decodes entities, and strips harmful tags");

  // 5. decodeHtmlEntities Verification
  console.log("  5. Verifying decodeHtmlEntities()...");
  assert.equal(decodeHtmlEntities("&amp;"), "&");
  assert.equal(decodeHtmlEntities("&mdash;"), "-");
  assert.equal(decodeHtmlEntities("&ndash;"), "-");
  assert.equal(decodeHtmlEntities("\u2014"), "-");
  assert.equal(decodeHtmlEntities("\u2013"), "-");
  assert.equal(decodeHtmlEntities("&quot;Hello&quot;"), '"Hello"');
  console.log("  [PASS] decodeHtmlEntities() converts entities and dashes to clean ASCII characters");

  console.log("> [STAGE 5] All visual token and viewport containment tests passed successfully!");
}

export { runStage5Tests };

if (process.argv[1]?.includes("stage5-ui-token-and-viewport-governance.test") || require.main === module) {
  runStage5Tests()
    .then(() => {
      console.log("Stage 5 test suite completed with 0 failures.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Stage 5 test suite failed:", err);
      process.exit(1);
    });
}
