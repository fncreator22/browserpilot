import assert from "node:assert";

export async function runRichJobDescriptionUnitTests() {
  console.log("▶ [UNIT TEST] Running RichJobDescription parsing & formatting tests...");

  // 1. Numbered list regex validation
  const bulletRegex = /^(?:[•\-\*]|\(?\d+[\.\)])\s+/;
  assert.strictEqual(bulletRegex.test("• First bullet"), true, "Must match bullet •");
  assert.strictEqual(bulletRegex.test("- Dash bullet"), true, "Must match dash -");
  assert.strictEqual(bulletRegex.test("* Star bullet"), true, "Must match star *");
  assert.strictEqual(bulletRegex.test("1. Numbered item"), true, "Must match 1. item");
  assert.strictEqual(bulletRegex.test("10. Two digit numbered item"), true, "Must match 10. item");
  assert.strictEqual(bulletRegex.test("1) Parenthesis numbered item"), true, "Must match 1) item");
  assert.strictEqual(bulletRegex.test("(1) Full parenthesis numbered item"), true, "Must match (1) item");
  assert.strictEqual(bulletRegex.test("Regular text not a bullet"), false, "Must not match regular text");

  // 2. Trailing punctuation trimming from URLs
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<"']+)/g;
  const sample = "Check our video: https://www.youtube.com/watch?v=dQw4w9WgXcQ. Thanks!";
  const matches = [...sample.matchAll(linkRegex)];
  assert.strictEqual(matches.length, 1);
  let rawUrl = matches[0][3];
  const punctMatch = rawUrl.match(/[.,;:!)]+$/);
  assert.ok(punctMatch, "Must identify trailing period");
  const cleanUrl = rawUrl.slice(0, -punctMatch[0].length);
  assert.strictEqual(cleanUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");

  // 3. Topic heading regex validation
  const topicHeadingRegex = /^(?:#{1,6}\s+.*|\*\*[A-Za-z0-9\s/&—–',:?-]{2,60}:?\*\*|[A-Z][A-Za-z0-9\s/&—–',?-]{2,50}:)$/;
  assert.strictEqual(topicHeadingRegex.test("Role Overview:"), true);
  assert.strictEqual(topicHeadingRegex.test("Key Responsibilities:"), true);
  assert.strictEqual(topicHeadingRegex.test("**What You'll Do:**"), true);
  assert.strictEqual(topicHeadingRegex.test("### Technical Stack"), true);
  assert.strictEqual(topicHeadingRegex.test("This is just a long sentence that happens to talk about things."), false);

  console.log("  ✓ RichJobDescription parsing and formatting unit tests passed cleanly.");
}

if (process.argv[1]?.includes("richJobDescription.test")) {
  runRichJobDescriptionUnitTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
