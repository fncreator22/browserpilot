import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { browserPool } from "@/worker/browser";
import { BrowserExecutor } from "@/worker/executor";
import { artifactStorage } from "@/lib/storage";

async function runInteractionGuardTest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT RUNTIME INTERACTION GUARD TEST    ");
  console.log("=================================================\n");

  const overlayHtml = await fs.readFile(
    path.join(process.cwd(), "tests", "fixtures", "test-page.html"),
    "utf8"
  );
  const captchaHtml = await fs.readFile(
    path.join(process.cwd(), "tests", "fixtures", "test-page-captcha.html"),
    "utf8"
  );

  // 1. Host local HTTP test server serving /overlay and /captcha
  const server = http.createServer((req, res) => {
    if (req.url === "/captcha") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(captchaHtml);
    } else {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(overlayHtml);
    }
  });

  await new Promise<void>((resolve) => server.listen(3999, "127.0.0.1", resolve));
  console.log("[Test Server] Serving fixtures at http://127.0.0.1:3999\n");

  try {
    // ----------------------------------------------------------------
    // SCENARIO 1: AUTOMATIC DISMISSAL OF MODAL OVERLAY
    // ----------------------------------------------------------------
    console.log("-------------------------------------------------");
    console.log("SCENARIO 1: Automatic Dismissal of Modal Overlay");
    console.log("-------------------------------------------------");

    const session1 = await browserPool.createSession({
      jobId: "test-guard-overlay-1",
      headless: true,
    });

    // Step 1a: Navigate to page with overlay
    console.log("Step 1: Navigating to page with modal overlay...");
    const navObs1 = await BrowserExecutor.execute(
      session1.page,
      {
        tool: "browser.navigate",
        parameters: { url: "http://127.0.0.1:3999/overlay", waitUntil: "domcontentloaded" },
      },
      { jobId: "test-guard-overlay-1", stepIndex: 1 }
    );
    console.log(`Navigation Result: ${navObs1.status} - ${navObs1.pageSummary}`);

    // Step 1b: Execute form fill (Overlay is automatically dismissed by Interaction Guard)
    console.log("Step 2: Dispatching form fill (Guard should detect & dismiss overlay)...");
    const fillObs1 = await BrowserExecutor.execute(
      session1.page,
      {
        tool: "browser.fill",
        parameters: { selector: "#name-input", value: "Interaction Guard Success" },
      },
      { jobId: "test-guard-overlay-1", stepIndex: 2 }
    );
    console.log(`Fill Result: ${fillObs1.status} - ${fillObs1.pageSummary}`);

    if (fillObs1.status !== "SUCCESS") {
      throw new Error(`Expected fill action to succeed after overlay dismissal, got ${fillObs1.status}`);
    }

    console.log("✓ Scenario 1 PASS: Modal overlay was detected and safely dismissed without blocking the step.\n");
    await session1.close();

    // ----------------------------------------------------------------
    // SCENARIO 2: IMMEDIATE SAFE STOP ON VERIFICATION / CAPTCHA
    // ----------------------------------------------------------------
    console.log("-------------------------------------------------");
    console.log("SCENARIO 2: Zero-Bypass Safe Stop on CAPTCHA Challenge");
    console.log("-------------------------------------------------");

    const session2 = await browserPool.createSession({
      jobId: "test-guard-captcha-2",
      headless: true,
    });

    // Step 2a: Navigate to CAPTCHA fixture
    console.log("Step 1: Navigating to page with simulated verification challenge...");
    const navObs2 = await BrowserExecutor.execute(
      session2.page,
      {
        tool: "browser.navigate",
        parameters: { url: "http://127.0.0.1:3999/captcha", waitUntil: "domcontentloaded" },
      },
      { jobId: "test-guard-captcha-2", stepIndex: 1 }
    );

    console.log(`Navigation Status: ${navObs2.status}`);
    console.log(`Error Code: ${navObs2.error?.code}`);
    console.log(`User Message: "${navObs2.error?.userMessage}"`);
    console.log(`Screenshot Saved: ${navObs2.screenshotPath}`);

    // Assertions for §12 and skills/security.md compliance
    const EXPECTED_USER_MSG =
      "The website is asking for a verification step that I can't complete automatically. I stopped safely here.";

    if (navObs2.status !== "BLOCKED") {
      throw new Error(`Expected BLOCKED status on CAPTCHA page, got ${navObs2.status}`);
    }
    if (navObs2.error?.code !== "BLOCKED_VERIFICATION_REQUIRED") {
      throw new Error(`Expected error code BLOCKED_VERIFICATION_REQUIRED, got ${navObs2.error?.code}`);
    }
    if (navObs2.error?.userMessage !== EXPECTED_USER_MSG) {
      throw new Error(`Expected exact §12 user message, got: "${navObs2.error?.userMessage}"`);
    }
    if (!navObs2.screenshotPath) {
      throw new Error("Expected screenshot artifact path to be captured on BLOCKED state.");
    }

    const artifacts = await artifactStorage.listArtifacts("test-guard-captcha-2");
    console.log(`✓ Verified Screenshot in Artifact Storage:`, artifacts);

    console.log("✓ Scenario 2 PASS: CAPTCHA triggered immediate BLOCKED stop with required §12 message and screenshot.\n");
    await session2.close();

    console.log("=================================================");
    console.log("  ALL INTERACTION GUARD SCENARIOS VERIFIED!      ");
    console.log("=================================================\n");

  } finally {
    await browserPool.closeAll();
    server.close();
    console.log("[Teardown] Test server and browser sessions closed.");
  }
}

runInteractionGuardTest().catch((err) => {
  console.error("FATAL INTERACTION GUARD TEST ERROR:", err);
  process.exit(1);
});
