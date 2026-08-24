import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { browserPool } from "@/worker/browser";
import { BrowserExecutor } from "@/worker/executor";

export async function runExecutorIntegrationTests() {
  console.log("▶ [INTEGRATION] Running Playwright Executor Tests against Local Fixture...");

  const fixtureHtml = await fs.readFile(
    path.join(process.cwd(), "tests", "fixtures", "test-page.html"),
    "utf8"
  );

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fixtureHtml);
  });

  await new Promise<void>((resolve) => server.listen(3998, "127.0.0.1", resolve));
  const fixtureUrl = "http://127.0.0.1:3998";

  try {
    const session = await browserPool.createSession({
      jobId: "executor-integration-test-job",
      headless: true,
    });

    // 1. Tool 1: browser.navigate (With overlay auto-dismissal)
    const navObs = await BrowserExecutor.execute(
      session.page,
      {
        tool: "browser.navigate",
        parameters: { url: fixtureUrl, waitUntil: "domcontentloaded" },
      },
      { jobId: "executor-integration-test-job", stepIndex: 1 }
    );

    if (navObs.status !== "SUCCESS") {
      throw new Error(`Navigation failed: ${navObs.error?.message}`);
    }
    console.log("  ✓ browser.navigate executed and dismissed overlay");

    // 2. Tool 2: browser.fill (value parameter) & Tool 3: browser.press
    await BrowserExecutor.execute(
      session.page,
      {
        tool: "browser.fill",
        parameters: { selector: "#user-name", value: "Alex Developer" },
      },
      { jobId: "executor-integration-test-job", stepIndex: 2 }
    );

    await BrowserExecutor.execute(
      session.page,
      {
        tool: "browser.press",
        parameters: { key: "Tab" },
      },
      { jobId: "executor-integration-test-job", stepIndex: 3 }
    );
    console.log("  ✓ browser.fill & browser.press executed");

    // 3. Tool 4: browser.extractText
    const extractObs = await BrowserExecutor.execute(
      session.page,
      {
        tool: "browser.extractText",
        parameters: { selector: "#pricing-table" },
      },
      { jobId: "executor-integration-test-job", stepIndex: 4 }
    );

    if (!String(extractObs.extractedData).includes("Enterprise")) {
      throw new Error("extractText failed to capture pricing table content!");
    }
    console.log("  ✓ browser.extractText retrieved DOM content");

    // 4. Tool 5: browser.screenshot
    const screenshotObs = await BrowserExecutor.execute(
      session.page,
      {
        tool: "browser.screenshot",
        parameters: { fullPage: false },
      },
      { jobId: "executor-integration-test-job", stepIndex: 5 }
    );

    if (!screenshotObs.screenshotPath) {
      throw new Error("Screenshot path not saved on observation!");
    }
    console.log(`  ✓ browser.screenshot saved artifact to: ${screenshotObs.screenshotPath}`);

    await session.close();
    console.log("✓ [INTEGRATION] Playwright Executor Tests Passed!\n");
  } finally {
    server.close();
  }
}
