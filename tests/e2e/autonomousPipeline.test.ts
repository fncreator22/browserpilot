import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { runAutonomousPipeline } from "@/lib/ai/pipeline";
import { createDbJob, getDbJobById } from "@/lib/db/jobs";

export async function runEndToEndPipelineTest() {
  console.log("▶ [E2E] Running Autonomous Pipeline End-to-End Test...");

  const fixtureHtml = await fs.readFile(
    path.join(process.cwd(), "tests", "fixtures", "test-page.html"),
    "utf8"
  );

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fixtureHtml);
  });

  await new Promise<void>((resolve) => server.listen(3997, "127.0.0.1", resolve));
  const fixtureUrl = "http://127.0.0.1:3997";
  const e2eJobId = `e2e-test-job-${Date.now()}`;

  try {
    const prompt = `Navigate to ${fixtureUrl}, extract the pricing table with tiers and monthly prices into a structured summary.`;

    console.log(`  Natural Language Prompt: "${prompt}"`);

    // 1. Persist initial Job
    await createDbJob({
      id: e2eJobId,
      prompt,
      allowedDomains: ["127.0.0.1", "localhost"],
      maxStepsBudget: 10,
    });

    // 2. Run Full Autonomous Pipeline
    const pipelineResult = await runAutonomousPipeline(prompt, {
      jobId: e2eJobId,
      allowedDomains: ["127.0.0.1", "localhost"],
      maxStepsBudget: 10,
    });

    console.log(`  Pipeline Success: ${pipelineResult.success}`);
    console.log(`  Classification: ${pipelineResult.intent.classification}`);
    console.log(`  Capability Guard: ${pipelineResult.guard.allowed ? "ALLOWED" : "BLOCKED"}`);
    console.log(`  Plan Steps: ${pipelineResult.plan?.steps.length || 0}`);
    console.log(`  Execution Status: ${pipelineResult.execution?.status}`);
    console.log(`  Total Duration: ${pipelineResult.durationMs}ms`);

    // Assertions
    if (!pipelineResult.success) {
      throw new Error(`E2E pipeline failed: ${pipelineResult.error?.message}`);
    }
    if (pipelineResult.intent.classification !== "SUPPORTED") {
      throw new Error(`Expected SUPPORTED intent, got ${pipelineResult.intent.classification}`);
    }
    if (!pipelineResult.execution || pipelineResult.execution.status !== "SUCCESS") {
      throw new Error(`Expected execution status SUCCESS, got ${pipelineResult.execution?.status}`);
    }

    console.log("✓ [E2E] True End-to-End Autonomous Pipeline Test Passed!\n");
  } finally {
    server.close();
  }
}
