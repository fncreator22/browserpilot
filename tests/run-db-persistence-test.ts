import { 
  createDbJob, 
  getDbJobById, 
  updateDbJob, 
  recordDbJobStep, 
  recordDbObservation, 
  recordDbArtifact,
  listDbJobs,
  getDbJobEvents,
  getDbJobArtifacts
} from "@/lib/db/jobs";
import { createPrismaClient } from "@/lib/db/prisma";
import { type Observation } from "@/schemas/actions";

async function runDatabasePersistenceTest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT PRISMA DATABASE PERSISTENCE TEST  ");
  console.log("=================================================\n");

  const testJobId = `job-persistence-test-${Date.now()}`;
  console.log(`[Test] Creating job in database: ${testJobId}`);

  // 1. Create Job in DB
  const createdJob = await createDbJob({
    id: testJobId,
    prompt: "Navigate to news.ycombinator.com and extract top stories",
    allowedDomains: ["news.ycombinator.com"],
    maxStepsBudget: 10,
  });

  console.log(`✓ Job created: ID=${createdJob.id}, status=${createdJob.status}`);

  // 2. Record Planned Step
  await recordDbJobStep(testJobId, {
    stepNumber: 1,
    action: {
      tool: "browser.navigate",
      parameters: { url: "https://news.ycombinator.com", waitUntil: "domcontentloaded", timeout: 15000 },
      rationale: "Initial navigation step",
    },
    rationale: "Navigate to target site",
    isOptional: false,
    checkpointScreenshot: false,
  });
  console.log("✓ Recorded Planned Step 1 in job_steps table");

  // 3. Record Execution Observation
  const mockObs: Observation = {
    stepIndex: 1,
    action: {
      tool: "browser.navigate",
      parameters: { url: "https://news.ycombinator.com", waitUntil: "domcontentloaded", timeout: 15000 },
      rationale: "Initial navigation step",
    },
    status: "SUCCESS",
    currentUrl: "https://news.ycombinator.com",
    title: "Hacker News",
    pageSummary: "Navigated to Hacker News homepage.",
    extractedData: { topStory: "Show HN: BrowserPilot Autonomous Agent" },
    screenshotPath: "storage/artifacts/test-job/final_screenshot.png",
    error: null,
    elapsedMs: 245,
    timestamp: new Date().toISOString(),
  };

  await recordDbObservation(testJobId, mockObs);
  console.log("✓ Recorded Observation in observations table");

  // 4. Record Artifact Reference (Filesystem storage key)
  await recordDbArtifact(testJobId, {
    filename: "final_screenshot.png",
    storageKey: "storage/artifacts/test-job/final_screenshot.png",
    mimeType: "image/png",
    sizeBytes: 104250,
  });
  console.log("✓ Recorded Artifact reference in artifacts table");

  // 5. Update Job to COMPLETED
  await updateDbJob(testJobId, {
    status: "COMPLETED",
    progress: 100,
    summary: "Successfully extracted top stories from Hacker News.",
    result: { itemsCount: 30 },
    totalDurationMs: 1450,
  });
  console.log("✓ Updated Job to COMPLETED in database");

  // ----------------------------------------------------------------
  // 6. SIMULATE PROCESS RESTART (Fresh Prisma Connection & Client)
  // ----------------------------------------------------------------
  console.log("\n--- Simulating Full Process & Server Restart ---");
  const freshPrisma = createPrismaClient();
  await freshPrisma.$connect();
  console.log("[DB] Fresh Prisma client connected to database.");

  // Query back job from fresh connection
  const loadedJob = await freshPrisma.job.findUnique({
    where: { id: testJobId },
    include: {
      steps: true,
      observations: true,
      artifacts: true,
    },
  });

  if (!loadedJob) {
    throw new Error(`Job ${testJobId} not found after simulated restart!`);
  }

  console.log("\n=================================================");
  console.log("  PERSISTED DATA RETRIEVED AFTER RESTART         ");
  console.log("=================================================");
  console.log(`Job ID: ${loadedJob.id}`);
  console.log(`Status: ${loadedJob.status}`);
  console.log(`Progress: ${loadedJob.progress}%`);
  console.log(`Summary: "${loadedJob.summary}"`);
  console.log(`Steps Persisted: ${loadedJob.steps.length}`);
  console.log(`Observations Persisted: ${loadedJob.observations.length}`);
  console.log(`Artifacts Persisted: ${loadedJob.artifacts.length}`);
  console.log(`Artifact Storage Key: ${loadedJob.artifacts[0]?.storageKey}`);

  // Assertions
  if (loadedJob.status !== "COMPLETED") {
    throw new Error(`Expected status COMPLETED, got ${loadedJob.status}`);
  }
  if (loadedJob.steps.length !== 1) {
    throw new Error(`Expected 1 step, got ${loadedJob.steps.length}`);
  }
  if (loadedJob.observations.length !== 1) {
    throw new Error(`Expected 1 observation, got ${loadedJob.observations.length}`);
  }
  if (loadedJob.artifacts.length !== 1) {
    throw new Error(`Expected 1 artifact, got ${loadedJob.artifacts.length}`);
  }
  if (loadedJob.artifacts[0].storageKey !== "storage/artifacts/test-job/final_screenshot.png") {
    throw new Error(`Expected storageKey to match filesystem reference`);
  }

  // 7. Verify API Helpers (Events & Artifacts)
  const events = await getDbJobEvents(testJobId);
  const artifacts = await getDbJobArtifacts(testJobId);
  const allJobs = await listDbJobs(null, 5);

  console.log(`\n✓ Events Helper: ${events?.steps.length || 0} step(s), ${events?.observations.length || 0} observation(s)`);
  console.log(`✓ Artifacts Helper: ${artifacts?.length || 0} artifact(s)`);
  console.log(`✓ List Jobs Helper: Found ${allJobs.length} recent job(s) in database`);

  await freshPrisma.$disconnect();

  console.log("\n✅ SUCCESS: All Prisma PostgreSQL/SQLite data persisted and survived process restart!\n");
}

runDatabasePersistenceTest().catch((err) => {
  console.error("FATAL DATABASE PERSISTENCE TEST ERROR:", err);
  process.exit(1);
});
