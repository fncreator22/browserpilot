/**
 * Adversarial Stress & Verification Test Suite for Milestone 1 - Challenger M1_2
 * Targets:
 * 1. Import integrity & dead file absence (serverlessPipeline.ts, CLAUDE.md, starter SVGs)
 * 2. Direct serverless execution & SSE event streaming via pipelineEngine across route handlers
 * 3. High concurrency, dual-channel races (SSE + POST on same job), abort signal stress, and input fuzzing
 */

import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config();

// Ensure test harness flags
process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { GET as handleEventsGet } from "@/app/api/jobs/[id]/events/route";
import { POST as handleExecutePost } from "@/app/api/jobs/[id]/execute/route";
import { GET as handleJobGet, POST as handleJobPost } from "@/app/api/jobs/[id]/route";
import { POST as handleJobsPost, GET as handleJobsGet } from "@/app/api/jobs/route";
import { enqueueBrowserJob } from "@/lib/queue/jobQueue";
import { executeJobPipeline } from "@/lib/ai/pipelineEngine";
import { createDbJob, getDbJobById, updateDbJob } from "@/lib/db/jobs";
import { jobEventBus } from "@/lib/events/jobEvents";
import { prisma } from "@/lib/db/prisma";

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function recordPass(category: string, name: string, durationMs: number, details?: string) {
  results.push({ category, name, passed: true, durationMs, details });
  console.log(`  ✅ [PASS] ${name} (${durationMs.toFixed(1)}ms)${details ? ` - ${details}` : ""}`);
}

function recordFail(category: string, name: string, durationMs: number, error: unknown) {
  const errMsg = error instanceof Error ? error.message : String(error);
  results.push({ category, name, passed: false, durationMs, details: errMsg });
  console.error(`  ❌ [FAIL] ${name} (${durationMs.toFixed(1)}ms): ${errMsg}`);
}

async function runSection(category: string, name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  try {
    await fn();
    const duration = performance.now() - start;
    recordPass(category, name, duration);
  } catch (err) {
    const duration = performance.now() - start;
    recordFail(category, name, duration, err);
  }
}

// Helper to parse SSE stream chunks
async function readSseEvents(readable: ReadableStream<Uint8Array>, maxEvents = 10, timeoutMs = 5000): Promise<Array<{ event: string; data: any }>> {
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  const events: Array<{ event: string; data: any }> = [];
  let buffer = "";

  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error("SSE read timeout")), timeoutMs);
  });

  const readLoop = async () => {
    while (events.length < maxEvents) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const block of lines) {
        if (!block.trim()) continue;
        let eventName = "message";
        let eventData: any = null;

        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              eventData = JSON.parse(line.slice(6).trim());
            } catch {
              eventData = line.slice(6).trim();
            }
          }
        }
        events.push({ event: eventName, data: eventData });
        if (eventName === "complete" || eventName === "error") {
          reader.cancel().catch(() => {});
          return;
        }
      }
    }
  };

  try {
    await Promise.race([readLoop(), timeoutPromise]);
  } catch (e: any) {
    if (e.message !== "SSE read timeout" || events.length === 0) {
      reader.cancel().catch(() => {});
      throw e;
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  return events;
}

// ============================================================================
// PART 1: Filesystem & Import Integrity Verification
// ============================================================================
async function testImportAndAssetIntegrity() {
  console.log("\n=================================================");
  console.log("  PART 1: FILESYSTEM & IMPORT INTEGRITY VERIFICATION ");
  console.log("=================================================");

  const rootDir = process.cwd();

  await runSection("Integrity", "Absence of Dead Files on Disk", () => {
    const deadFiles = [
      path.join(rootDir, "CLAUDE.md"),
      path.join(rootDir, "lib", "serverlessPipeline.ts"),
      path.join(rootDir, "public", "file.svg"),
      path.join(rootDir, "public", "globe.svg"),
      path.join(rootDir, "public", "window.svg"),
      path.join(rootDir, "public", "vercel.svg"),
      path.join(rootDir, "public", "next.svg"),
    ];

    for (const filePath of deadFiles) {
      const exists = fs.existsSync(filePath);
      assert(!exists, `Dead file still exists on disk: ${filePath}`);
    }
  });

  await runSection("Integrity", "Zero Dangling References to serverlessPipeline in Source Files", () => {
    const searchDirs = ["app", "lib", "worker", "components", "schemas", "tests"];
    const pattern = /serverlessPipeline/i;
    const violations: string[] = [];

    function scanDir(dirPath: string) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".git" && entry.name !== ".next") {
            scanDir(fullPath);
          }
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|md)$/.test(entry.name)) {
          // Skip stress challenger files that mention the string as part of test assertions
          if (entry.name.includes("stress-challenger-m1-2")) continue;
          const content = fs.readFileSync(fullPath, "utf-8");
          if (pattern.test(content)) {
            violations.push(fullPath);
          }
        }
      }
    }

    for (const dir of searchDirs) {
      const dirPath = path.join(rootDir, dir);
      if (fs.existsSync(dirPath)) {
        scanDir(dirPath);
      }
    }

    assert(violations.length === 0, `Found dangling references to serverlessPipeline in: ${violations.join(", ")}`);
  });

  await runSection("Integrity", "Verification of Direct pipelineEngine Exports", async () => {
    const pipelineEngineModule = await import("@/lib/ai/pipelineEngine");
    assert(typeof pipelineEngineModule.executeJobPipeline === "function", "executeJobPipeline must be exported function");
  });
}

// ============================================================================
// PART 2: Route Handlers & Serverless Pipeline Execution
// ============================================================================
async function testServerlessRouteExecution() {
  console.log("\n=================================================");
  console.log("  PART 2: SERVERLESS ROUTE HANDLERS & SSE PIPELINE ");
  console.log("=================================================");

  // 1. GET /api/jobs/[id]/events (SSE streaming)
  await runSection("SSE Stream", "GET /api/jobs/[id]/events returns valid SSE and snapshot", async () => {
    const testJobId = `sse-test-${Date.now()}`;
    await createDbJob({
      id: testJobId,
      prompt: "Extract product pricing from example.com",
      allowedDomains: ["example.com"],
      maxStepsBudget: 5,
    });

    const req = new Request(`http://localhost:3000/api/jobs/${testJobId}/events?stream=true`, {
      headers: {
        Accept: "text/event-stream",
      },
    });

    const response = await handleEventsGet(req, {
      params: Promise.resolve({ id: testJobId }),
    });

    assert(response.status === 200, `Expected 200 status, got ${response.status}`);
    assert(response.headers.get("Content-Type")?.includes("text/event-stream") || false, "Expected Content-Type text/event-stream");
    assert(response.headers.get("Cache-Control")?.includes("no-cache") || false, "Expected Cache-Control no-cache");
    assert(response.body !== null, "Expected readable response body");

    const events = await readSseEvents(response.body!, 2, 4000);
    assert(events.length >= 1, `Expected at least 1 SSE event, received ${events.length}`);
    const snapshotEvent = events.find((e) => e.event === "snapshot");
    assert(!!snapshotEvent, "Expected snapshot event to be emitted initially");
    assert(snapshotEvent!.data?.id === testJobId, `Snapshot data ID mismatch: ${snapshotEvent?.data?.id}`);
  });

  // 2. AbortSignal listener cleanup in SSE stream
  await runSection("SSE Stream", "GET /api/jobs/[id]/events cleans up safely on AbortController abort", async () => {
    const testJobId = `sse-abort-${Date.now()}`;
    await createDbJob({
      id: testJobId,
      prompt: "Search docs on test.com",
      allowedDomains: ["test.com"],
      maxStepsBudget: 5,
    });

    const abortController = new AbortController();
    const req = new Request(`http://localhost:3000/api/jobs/${testJobId}/events?stream=true`, {
      headers: { Accept: "text/event-stream" },
      signal: abortController.signal,
    });

    const response = await handleEventsGet(req, {
      params: Promise.resolve({ id: testJobId }),
    });

    assert(response.status === 200, "Expected 200 status");
    // Trigger abort immediately
    abortController.abort();
    // Verify no unhandled throw occurs
  });

  // 3. POST /api/jobs/[id]/execute (Active Serverless Execution Endpoint)
  await runSection("Execute Route", "POST /api/jobs/[id]/execute executes pipeline and returns full job status", async () => {
    const testJobId = `exec-route-${Date.now()}`;
    await createDbJob({
      id: testJobId,
      prompt: "Navigate to example.com and extract header",
      allowedDomains: ["example.com"],
      maxStepsBudget: 5,
    });

    const req = new Request(`http://localhost:3000/api/jobs/${testJobId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await handleExecutePost(req, {
      params: Promise.resolve({ id: testJobId }),
    });

    assert(response.status === 200, `Expected 200 status, got ${response.status}`);
    const data = await response.json();
    assert(data.success !== undefined, "Response must contain success field");
    assert(data.status !== undefined, "Response must contain status field");
    assert(data.job !== undefined, "Response must contain job object");
    assert(typeof data.elapsedMs === "number", "Response must contain elapsedMs number");
  });

  // 4. POST /api/jobs/[id]/execute Idempotency on terminal jobs
  await runSection("Execute Route", "POST /api/jobs/[id]/execute returns fast cached response on COMPLETED jobs", async () => {
    const testJobId = `exec-terminal-${Date.now()}`;
    await createDbJob({
      id: testJobId,
      prompt: "Extract data",
      allowedDomains: ["example.com"],
    });
    await updateDbJob(testJobId, {
      status: "COMPLETED",
      progress: 100,
      summary: "Already completed job summary",
    });

    const start = performance.now();
    const req = new Request(`http://localhost:3000/api/jobs/${testJobId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const response = await handleExecutePost(req, {
      params: Promise.resolve({ id: testJobId }),
    });

    const duration = performance.now() - start;
    assert(response.status === 200, "Expected 200 status");
    const data = await response.json();
    assert(data.success === true, "Expected success: true");
    assert(data.status === "COMPLETED", "Expected status: COMPLETED");
    assert(duration < 500, `Expected fast response (<500ms), took ${duration.toFixed(1)}ms`);
  });

  // 5. POST /api/jobs/[id]/execute Rehydration when job missing
  await runSection("Execute Route", "POST /api/jobs/[id]/execute auto-rehydrates job if prompt is provided in body", async () => {
    const testJobId = `exec-rehydrate-${Date.now()}`;
    const req = new Request(`http://localhost:3000/api/jobs/${testJobId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Rehydrated task on example.org",
        allowedDomains: ["example.org"],
        maxStepsBudget: 5,
      }),
    });

    const response = await handleExecutePost(req, {
      params: Promise.resolve({ id: testJobId }),
    });

    assert(response.status === 200, `Expected 200 status, got ${response.status}`);
    const data = await response.json();
    assert(data.job?.id === testJobId, "Expected rehydrated job in DB");
  });

  // 6. POST /api/jobs/[id] (Sync / Rehydration Route)
  await runSection("Job Sync Route", "POST /api/jobs/[id] synchronizes job across stateless containers", async () => {
    const testJobId = `sync-route-${Date.now()}`;
    const req = new Request(`http://localhost:3000/api/jobs/${testJobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Synchronized task on test.org",
        allowedDomains: ["test.org"],
        maxStepsBudget: 5,
      }),
    });

    const response = await handleJobPost(req, {
      params: Promise.resolve({ id: testJobId }),
    });

    assert(response.status === 200, `Expected 200 status, got ${response.status}`);
    const data = await response.json();
    assert(data.success === true, "Expected success: true");
    assert(data.job?.id === testJobId, "Expected job with matching ID");
  });

  // 7. enqueueBrowserJob in lib/queue/jobQueue.ts
  await runSection("Job Queue", "enqueueBrowserJob saves to DB and triggers asynchronous pipeline", async () => {
    const testJobId = `queue-test-${Date.now()}`;
    const result = await enqueueBrowserJob({
      jobId: testJobId,
      prompt: "Queue asynchronous task",
      allowedDomains: ["example.com"],
      maxStepsBudget: 5,
    });

    assert(result.jobId === testJobId, "Expected matching jobId");
    assert(result.status === "PLANNING", "Expected PLANNING initial status");
    const dbJob = await getDbJobById(testJobId);
    assert(dbJob !== null, "Job must be persisted in database");
  });
}

// ============================================================================
// PART 3: Concurrency, Dual-Channel Races, & Stress Scenarios
// ============================================================================
async function testConcurrencyAndDualChannelRaces() {
  console.log("\n=================================================");
  console.log("  PART 3: CONCURRENCY & DUAL-CHANNEL STRESS RACES ");
  console.log("=================================================");

  // 1. 10 Concurrent SSE Streams
  await runSection("Concurrency", "10 Concurrent SSE Streams open and receive initial snapshots without collision", async () => {
    const count = 10;
    const jobs = await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const jobId = `concurrent-sse-${Date.now()}-${i}`;
        await createDbJob({
          id: jobId,
          prompt: `Concurrent SSE task ${i} on example.com`,
          allowedDomains: ["example.com"],
          maxStepsBudget: 5,
        });
        return jobId;
      })
    );

    const streamResults = await Promise.all(
      jobs.map(async (jobId) => {
        const req = new Request(`http://localhost:3000/api/jobs/${jobId}/events?stream=true`, {
          headers: { Accept: "text/event-stream" },
        });
        const res = await handleEventsGet(req, {
          params: Promise.resolve({ id: jobId }),
        });
        assert(res.status === 200, `Expected 200 status for job ${jobId}`);
        assert(res.body !== null, `Expected non-null body for job ${jobId}`);
        const events = await readSseEvents(res.body!, 1, 3000);
        return { jobId, eventCount: events.length, snapshot: events[0] };
      })
    );

    for (const sr of streamResults) {
      assert(sr.eventCount >= 1, `Stream for ${sr.jobId} received 0 events`);
      assert(sr.snapshot?.data?.id === sr.jobId, `Snapshot ID mismatch for ${sr.jobId}`);
    }
  });

  // 2. 10 Concurrent POST /api/jobs/[id]/execute Requests
  await runSection("Concurrency", "10 Concurrent POST /api/jobs/[id]/execute requests execute cleanly", async () => {
    const count = 10;
    const jobs = await Promise.all(
      Array.from({ length: count }, async (_, i) => {
        const jobId = `concurrent-exec-${Date.now()}-${i}`;
        await createDbJob({
          id: jobId,
          prompt: `Concurrent execute task ${i} on example.com`,
          allowedDomains: ["example.com"],
          maxStepsBudget: 5,
        });
        return jobId;
      })
    );

    const execResults = await Promise.all(
      jobs.map(async (jobId) => {
        const req = new Request(`http://localhost:3000/api/jobs/${jobId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const res = await handleExecutePost(req, {
          params: Promise.resolve({ id: jobId }),
        });
        assert(res.status === 200, `Expected 200 for job ${jobId}`);
        const data = await res.json();
        return { jobId, data };
      })
    );

    for (const er of execResults) {
      assert(er.data.status !== undefined, `Job ${er.jobId} missing status in response`);
      const finalDbJob = await getDbJobById(er.jobId);
      assert(finalDbJob !== null, `Job ${er.jobId} missing in DB`);
    }
  });

  // 3. Dual-Channel Stress Race: SSE Stream + POST /execute simultaneously on the EXACT same job
  await runSection("Concurrency", "Simultaneous SSE Stream (GET) + Active Execute (POST) on same job", async () => {
    const raceJobId = `race-dual-${Date.now()}`;
    await createDbJob({
      id: raceJobId,
      prompt: "Simultaneous SSE and POST execution race test on example.com",
      allowedDomains: ["example.com"],
      maxStepsBudget: 5,
    });

    // Start SSE stream listener
    const sseReq = new Request(`http://localhost:3000/api/jobs/${raceJobId}/events?stream=true`, {
      headers: { Accept: "text/event-stream" },
    });
    const ssePromise = handleEventsGet(sseReq, {
      params: Promise.resolve({ id: raceJobId }),
    }).then(async (res) => {
      assert(res.status === 200, "SSE response status must be 200");
      const events = await readSseEvents(res.body!, 5, 5000);
      return events;
    });

    // Simultaneously trigger POST execute
    const execReq = new Request(`http://localhost:3000/api/jobs/${raceJobId}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const execPromise = handleExecutePost(execReq, {
      params: Promise.resolve({ id: raceJobId }),
    }).then(async (res) => {
      assert(res.status === 200, "POST response status must be 200");
      return res.json();
    });

    const [events, execData] = await Promise.all([ssePromise, execPromise]);

    assert(events.length > 0, "SSE stream must receive at least 1 event during execution");
    assert(execData.job?.id === raceJobId, "POST execute must return target job");
    const terminalDbJob = await getDbJobById(raceJobId);
    assert(terminalDbJob !== null, "Job must exist in DB");
    assert(["COMPLETED", "FAILED", "BLOCKED"].includes(terminalDbJob.status), `Expected terminal state, got ${terminalDbJob.status}`);
  });

  // 4. Adversarial Input Fuzzing & Malformed Requests
  await runSection("Adversarial Fuzzing", "Robust handling of hostile params, SQL injections, and malformed bodies", async () => {
    const hostileParams = [
      "../../etc/passwd",
      "' OR '1'='1",
      "<script>alert(1)</script>",
      "job_%00_nullbyte",
      "job_" + "A".repeat(2000),
      "🦀-unicode-emoji-job-id-🚀",
    ];

    for (const hostileId of hostileParams) {
      // Test GET /api/jobs/[id]
      const getReq = new Request(`http://localhost:3000/api/jobs/${encodeURIComponent(hostileId)}`);
      const getRes = await handleJobGet(getReq, {
        params: Promise.resolve({ id: hostileId }),
      });
      assert(getRes.status === 404 || getRes.status === 200, `GET unexpected status ${getRes.status} for id ${hostileId}`);

      // Test POST /api/jobs/[id]/execute with invalid non-JSON body
      const postReq = new Request(`http://localhost:3000/api/jobs/${encodeURIComponent(hostileId)}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "NOT_VALID_JSON{:::}",
      });
      const postRes = await handleExecutePost(postReq, {
        params: Promise.resolve({ id: hostileId }),
      });
      // Should handle gracefully with 404 or 400 or handled response without uncaught crash
      assert(postRes.status >= 200 && postRes.status < 600, `POST crashed with ${postRes.status}`);
    }
  });
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function main() {
  const overallStart = performance.now();
  console.log("=================================================");
  console.log("  CHALLENGER M1_2: EMPIRICAL STRESS & AUDIT SUITE ");
  console.log("=================================================");

  await testImportAndAssetIntegrity();
  await testServerlessRouteExecution();
  await testConcurrencyAndDualChannelRaces();

  const totalDuration = performance.now() - overallStart;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log("\n=================================================");
  console.log("  CHALLENGER M1_2 TEST SUMMARY MATRIX             ");
  console.log("=================================================");
  console.log(`Total Checks Executed : ${total}`);
  console.log(`Passed Checks         : ${passed}`);
  console.log(`Failed Checks         : ${failed}`);
  console.log(`Total Duration        : ${totalDuration.toFixed(1)}ms`);
  console.log("=================================================");

  if (failed > 0) {
    console.error(`\n❌ VERDICT: FAIL — ${failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log("\n✅ VERDICT: APPROVE — All tests and stress scenarios passed with 0 errors!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal runner crash:", err);
  process.exit(1);
});
