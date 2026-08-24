import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { browserPool } from "@/worker/browser";
import { BrowserExecutor } from "@/worker/executor";
import { type BrowserAction, ObservationSchema } from "@/schemas/actions";
import { artifactStorage } from "@/lib/storage";

async function runPlaywrightExecutorTest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT PLAYWRIGHT EXECUTOR TEST RUNNER   ");
  console.log("=================================================\n");

  const jobId = "test-job-playwright-1";
  const fixturePath = path.join(process.cwd(), "tests", "fixtures", "test-page.html");
  const fixtureHtml = await fs.readFile(fixturePath, "utf8");

  // 1. Spin up a lightweight local test HTTP server
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fixtureHtml);
  });

  await new Promise<void>((resolve) => server.listen(3999, "127.0.0.1", resolve));
  const targetUrl = "http://127.0.0.1:3999";
  console.log(`[Test Server] Running fixture at ${targetUrl}`);

  // 2. Create isolated BrowserSession
  console.log(`[BrowserPool] Creating ephemeral incognito session for job ${jobId}...`);
  const session = await browserPool.createSession({
    jobId,
    headless: true,
    viewport: { width: 1280, height: 800 },
  });

  const toolSequence: BrowserAction[] = [
    // 1. browser.navigate
    {
      tool: "browser.navigate",
      parameters: {
        url: targetUrl,
        waitUntil: "domcontentloaded",
        timeout: 10000,
      },
      rationale: "Navigate to local test fixture page",
    },
    // 2. browser.getState
    {
      tool: "browser.getState",
      parameters: {},
      rationale: "Check initial page title and interactive element counts",
    },
    // 3. browser.inspect
    {
      tool: "browser.inspect",
      parameters: {
        selector: "#promo-modal",
        depth: 2,
        maxElements: 5,
      },
      rationale: "Inspect modal overlay structure before interaction",
    },
    // 4. browser.click
    {
      tool: "browser.click",
      parameters: {
        selector: "#close-modal-btn",
        button: "left",
        clickCount: 1,
        timeout: 5000,
      },
      rationale: "Dismiss the modal overlay by clicking close button",
    },
    // 5. browser.fill
    {
      tool: "browser.fill",
      parameters: {
        selector: "#name-input",
        value: "Autonomous Agent v1",
        clearExisting: true,
        timeout: 5000,
      },
      rationale: "Fill the name field in the test form",
    },
    // 6. browser.press
    {
      tool: "browser.press",
      parameters: {
        key: "Tab",
        selector: "#name-input",
        delayMs: 50,
      },
      rationale: "Press Tab to advance focus to next input element",
    },
    // 7. browser.extractText
    {
      tool: "browser.extractText",
      parameters: {
        selector: "#pricing-table",
        extractMultiple: false,
        maxChars: 5000,
      },
      rationale: "Extract structured pricing table content",
    },
    // 8. browser.screenshot
    {
      tool: "browser.screenshot",
      parameters: {
        fullPage: false,
        filename: "test_final_state.png",
        saveArtifact: true,
      },
      rationale: "Capture visual artifact of the completed form state",
    },
  ];

  const observations = [];

  try {
    for (let i = 0; i < toolSequence.length; i++) {
      const action = toolSequence[i];
      console.log(`\n--- [Step ${i + 1}/8] Executing: ${action.tool} ---`);
      
      const observation = await BrowserExecutor.execute(session.page, action, {
        jobId,
        stepIndex: i + 1,
        captureScreenshot: false, // caller-controlled
      });

      // Validate against ObservationSchema
      ObservationSchema.parse(observation);
      observations.push(observation);

      console.log(`Status: ${observation.status} (${observation.elapsedMs}ms)`);
      console.log(`Summary: ${observation.pageSummary}`);
      if (observation.extractedData) {
        console.log(`Extracted:`, typeof observation.extractedData === "string" ? observation.extractedData.slice(0, 100) + "..." : observation.extractedData);
      }
      if (observation.screenshotPath) {
        console.log(`Saved Screenshot Artifact: ${observation.screenshotPath}`);
      }
    }

    console.log("\n=================================================");
    console.log("  ALL 8 BROWSER TOOLS EXECUTED SUCCESSFULLY!     ");
    console.log("=================================================\n");

    // 4. Verify artifact on disk
    const savedFiles = await artifactStorage.listArtifacts(jobId);
    console.log(`Artifact storage files for ${jobId}:`, savedFiles);

    if (savedFiles.includes("test_final_state.png")) {
      console.log("✓ Screenshot artifact verified on disk!");
    } else {
      throw new Error("Expected test_final_state.png to exist in artifact storage.");
    }

    // 5. Output exact observation shape for Prompt 13 reference
    console.log("\n--- CANONICAL OBSERVATION OBJECT SHAPE ---");
    console.log(JSON.stringify(observations[observations.length - 1], null, 2));

  } finally {
    // 6. Clean teardown
    await session.close();
    await browserPool.closeAll();
    server.close();
    console.log("\n[Teardown] Browser context and test HTTP server closed cleanly.");
  }
}

runPlaywrightExecutorTest().catch((err) => {
  console.error("FATAL TEST ERROR:", err);
  process.exit(1);
});
