import { browserPool } from "@/worker/browser";
import { BrowserExecutor } from "@/worker/executor";

async function runManualExternalSmokeTest() {
  console.log("=================================================");
  console.log("  MANUAL PASS: REAL EXTERNAL SITE SMOKE TEST     ");
  console.log("  Target: https://playwright.dev (§36 Test 1)    ");
  console.log("=================================================\n");

  const session = await browserPool.createSession({
    jobId: "smoke-test-playwright-dev",
    headless: true,
    allowedDomains: ["playwright.dev"],
  });

  try {
    // Step 1: Navigate to playwright.dev
    console.log("1. Navigating to https://playwright.dev...");
    const navObs = await BrowserExecutor.execute(
      session.page,
      {
        tool: "browser.navigate",
        parameters: { url: "https://playwright.dev", waitUntil: "domcontentloaded", timeout: 20000 },
      },
      { jobId: "smoke-test-playwright-dev", stepIndex: 1 }
    );

    console.log(`   Status: ${navObs.status} | Title: "${navObs.title}" | URL: ${navObs.currentUrl}`);
    if (navObs.status !== "SUCCESS") {
      throw new Error(`Navigation failed: ${navObs.error?.message}`);
    }

    // Step 2: Extract Heading
    console.log("\n2. Extracting hero title and description...");
    const extractObs = await BrowserExecutor.execute(
      session.page,
      {
        tool: "browser.extractText",
        parameters: { selector: "h1", extractMultiple: false, maxChars: 500 },
      },
      { jobId: "smoke-test-playwright-dev", stepIndex: 2 }
    );
    console.log(`   Hero Heading Extracted: "${extractObs.extractedData}"`);

    // Step 3: Capture Screenshot
    console.log("\n3. Capturing viewport screenshot...");
    const screenshotObs = await BrowserExecutor.execute(
      session.page,
      {
        tool: "browser.screenshot",
        parameters: { fullPage: false, filename: "playwright_hero_smoke.png" },
      },
      { jobId: "smoke-test-playwright-dev", stepIndex: 3 }
    );
    console.log(`   Screenshot Saved: ${screenshotObs.screenshotPath}`);

    console.log("\n=================================================");
    console.log("  EXTERNAL SITE SMOKE TEST PASSED! (§36 Test 1) ");
    console.log("=================================================\n");
  } finally {
    await session.close();
    await browserPool.closeAll();
  }
}

runManualExternalSmokeTest().catch((err) => {
  console.error("External smoke test failed:", err);
  process.exit(1);
});
