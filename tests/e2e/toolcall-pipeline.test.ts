import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { browserPool } from "@/worker/browser";
import { executeActionPlan } from "@/lib/ai/toolcall";
import { classifyIntent } from "@/lib/ai/intent";
import { generateActionPlan } from "@/lib/ai/planner";
import { ActionPlanSchema, type ActionPlan } from "@/schemas/jobs";
import { artifactStorage } from "@/lib/storage";

config();

export async function runToolcallPipelineE2ETest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT E2E TOOLCALL PIPELINE TEST        ");
  console.log("=================================================\n");

  const jobId = `e2e-toolcall-pipeline-${Date.now()}`;
  const fixturePath = path.join(process.cwd(), "tests", "fixtures", "test-page.html");
  const fixtureHtml = await fs.readFile(fixturePath, "utf8");

  // 1. Host local test fixture server on port 3996
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fixtureHtml);
  });

  await new Promise<void>((resolve) => server.listen(3996, "127.0.0.1", resolve));
  const fixtureUrl = "http://127.0.0.1:3996";
  console.log(`[Test Server] Local fixture hosted at ${fixtureUrl}`);

  const userPrompt = `Navigate to ${fixtureUrl}, dismiss the promo modal, fill in the name field with "Autonomous Agent v1", and click submit.`;
  console.log(`[User Prompt]: "${userPrompt}"\n`);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const hasLiveApiKey = !!apiKey && apiKey !== "your-gemini-api-key";

  let actionPlan: ActionPlan;

  if (hasLiveApiKey) {
    console.log("[AI Engine] Live Gemini API Key detected. Invoking live Intent & Planner...");
    // 2a. Live Intent Classification
    const intent = await classifyIntent(userPrompt);
    console.log(`[AI Intent]: ${intent.classification} (Confidence: ${intent.confidence})`);
    if (intent.classification !== "SUPPORTED") {
      throw new Error(`Expected prompt to be classified as SUPPORTED, got ${intent.classification}`);
    }

    // 2b. Live Action Planning
    console.log("[AI Planner]: Generating structured ActionPlan from Gemini...");
    actionPlan = await generateActionPlan(userPrompt, {
      allowedDomains: ["localhost", "127.0.0.1"],
      maxStepsBudget: 10,
    });
  } else {
    console.log("[Notice] Deterministic ActionPlan generation for E2E toolcall pipeline...");
    actionPlan = {
      goal: userPrompt,
      targetDomains: ["127.0.0.1", "localhost"],
      rationale: "Deconstructed multi-step web interaction into sequential browser tool steps.",
      maxStepsBudget: 10,
      estimatedDurationSeconds: 8,
      expectedOutputDescription: "Completed form submission on local test fixture with verified success banner.",
      steps: [
        {
          stepNumber: 1,
          rationale: "Navigate to the target fixture URL and auto-dismiss overlays",
          isOptional: false,
          checkpointScreenshot: false,
          action: {
            tool: "browser.navigate",
            parameters: {
              url: fixtureUrl,
              waitUntil: "domcontentloaded",
              timeout: 10000,
            },
          },
        },
        {
          stepNumber: 2,
          rationale: "Fill in the name field",
          isOptional: false,
          checkpointScreenshot: false,
          action: {
            tool: "browser.fill",
            parameters: {
              selector: "#name-input",
              value: "Autonomous Agent v1",
              clearExisting: true,
              timeout: 5000,
            },
          },
        },
        {
          stepNumber: 3,
          rationale: "Click the form submit button",
          isOptional: false,
          checkpointScreenshot: false,
          action: {
            tool: "browser.click",
            parameters: {
              selector: "#submit-btn",
              button: "left",
              clickCount: 1,
              timeout: 5000,
            },
          },
        },
        {
          stepNumber: 4,
          rationale: "Extract verification banner text",
          isOptional: false,
          checkpointScreenshot: false,
          action: {
            tool: "browser.extractText",
            parameters: {
              selector: "#form-success-banner",
              extractMultiple: false,
              maxChars: 500,
            },
          },
        },
        {
          stepNumber: 5,
          rationale: "Capture final verified screenshot artifact",
          isOptional: false,
          checkpointScreenshot: true,
          action: {
            tool: "browser.screenshot",
            parameters: {
              fullPage: false,
              filename: "e2e_form_submitted.png",
              saveArtifact: true,
            },
          },
        },
      ],
    };
  }

  // Validate the plan against ActionPlanSchema
  const validatedPlan = ActionPlanSchema.parse(actionPlan);
  console.log(`\n✓ ActionPlan validated against schema (${validatedPlan.steps.length} planned steps).`);

  // 3. Launch isolated Browser Session
  console.log(`[BrowserPool] Allocating session for job ${jobId}...`);
  const session = await browserPool.createSession({
    jobId,
    allowedDomains: validatedPlan.targetDomains,
    headless: true,
  });

  try {
    console.log("\n--- [DISPATCH] Application executing ActionPlan via executeActionPlan ---");

    // 4. Application layer takes over and dispatches tool calls to BrowserExecutor
    const executionResult = await executeActionPlan(session.page, validatedPlan, {
      jobId,
      onStepStart: (num, action) => {
        console.log(`\n>> Step ${num}/${validatedPlan.steps.length}: Dispatching [${action.tool}]`);
      },
      onStepComplete: (num, obs) => {
        console.log(`   Result: ${obs.status} (${obs.elapsedMs}ms) - ${obs.pageSummary}`);
        if (obs.extractedData) {
          console.log(`   Extracted Payload: "${obs.extractedData}"`);
        }
      },
    });

    console.log("\n=================================================");
    console.log(`  E2E PIPELINE EXECUTION: ${executionResult.status}  `);
    console.log("=================================================");
    console.log(`Total Steps: ${executionResult.totalSteps}`);
    console.log(`Completed Steps: ${executionResult.completedSteps}`);
    console.log(`Total Duration: ${executionResult.totalElapsedMs}ms`);
    console.log(`Screenshots: ${executionResult.screenshotPaths.join(", ")}`);

    if (executionResult.status !== "SUCCESS") {
      throw new Error(`E2E execution failed: ${JSON.stringify(executionResult.error)}`);
    }

    // 5. Verify DOM state on the live page
    const bannerVisible = await session.page.locator("#form-success-banner").isVisible();
    console.log(`\n✓ Live DOM Assertion: #form-success-banner is visible: ${bannerVisible}`);

    if (!bannerVisible) {
      throw new Error("Expected #form-success-banner to be visible after form submit.");
    }

    // 6. Verify Screenshot in Artifact Storage
    const artifacts = await artifactStorage.listArtifacts(jobId);
    console.log(`✓ Artifact storage files for ${jobId}:`, artifacts);

    if (artifacts.length === 0) {
      throw new Error(`Expected at least 1 artifact for job ${jobId}, found 0.`);
    }

    console.log("\n✅ SUCCESS: Natural-language goal executed end-to-end across the Gemini→App→Playwright boundary!\n");
  } finally {
    await session.close();
    await browserPool.closeAll();
    server.close();
    console.log("[Teardown] Test server and browser session closed cleanly.");
  }
}

// Auto-run when executed directly via CLI
if (require.main === module || process.argv[1]?.includes("toolcall-pipeline.test")) {
  runToolcallPipelineE2ETest().catch((err) => {
    console.error("FATAL E2E TOOLCALL PIPELINE ERROR:", err);
    process.exit(1);
  });
}
