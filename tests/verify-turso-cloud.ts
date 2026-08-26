import { createClient } from "@libsql/client";
import { prisma, getTursoConfig } from "@/lib/db/prisma";

async function verifyTursoLiveConnection() {
  console.log("=================================================");
  console.log("  TURSO LIVE CLOUD DATABASE COMPREHENSIVE AUDIT  ");
  console.log("=================================================\n");

  const turso = getTursoConfig();
  console.log("Turso Config Detected:", {
    url: turso?.url,
    hasToken: !!turso?.authToken,
  });

  if (!turso) {
    throw new Error("Turso configuration (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) is missing!");
  }

  // 1. Direct libSQL client connection
  console.log("\n[1] Testing direct @libsql/client connection to Turso Cloud...");
  const client = createClient(turso);

  const tablesResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
  );
  const tableNames = tablesResult.rows.map((r) => r.name as string);
  console.log("Tables in Turso database:", tableNames);

  const expectedTables = ["users", "jobs", "job_steps", "observations", "artifacts"];
  for (const table of expectedTables) {
    if (!tableNames.includes(table)) {
      throw new Error(`Missing expected table: ${table}`);
    }
    console.log(`  ✓ Table exists: ${table}`);
  }

  // 2. Check table schemas and columns
  console.log("\n[2] Inspecting table column definitions...");
  for (const table of expectedTables) {
    const tableInfo = await client.execute(`PRAGMA table_info(${table});`);
    const columns = tableInfo.rows.map((r) => `${r.name} (${r.type}${r.notnull ? " NOT NULL" : ""}${r.pk ? " PK" : ""})`);
    console.log(`  - ${table} columns (${columns.length}): ${columns.join(", ")}`);
  }

  // 3. Inspect indexes
  console.log("\n[3] Inspecting table indexes...");
  const indexesResult = await client.execute(
    "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex%';"
  );
  for (const row of indexesResult.rows) {
    console.log(`  - Index: ${row.name} on table ${row.tbl_name}`);
  }

  // 4. Test Prisma Client operations against Turso Cloud
  console.log("\n[4] Testing live Prisma CRUD lifecycle against Turso Cloud...");
  const testUserId = `turso-user-${Date.now()}`;
  const testUserEmail = `test-turso-${Date.now()}@browserpilot.ai`;
  const testJobId = `turso-job-${Date.now()}`;

  // 4a. Create User with BYOK key
  const user = await prisma.user.create({
    data: {
      id: testUserId,
      email: testUserEmail,
      name: "Turso Cloud Test User",
      passwordHash: "dummyHashForAudit123",
      geminiApiKey: "AQ.TursoTestKeySecret12345",
    },
  });
  console.log(`  ✓ User created in Turso: ID=${user.id}, email=${user.email}, geminiApiKey=${user.geminiApiKey ? "PERSISTED" : "NULL"}`);

  // 4b. Create Job attached to User
  const job = await prisma.job.create({
    data: {
      id: testJobId,
      userId: user.id,
      prompt: "Turso Cloud Live Verification Prompt",
      status: "QUEUED",
      progress: 0,
      allowedDomains: JSON.stringify(["example.org"]),
      maxStepsBudget: 15,
      maxDurationMs: 60000,
    },
  });
  console.log(`  ✓ Job created in Turso: ID=${job.id}, status=${job.status}, userId=${job.userId}`);

  // 4c. Create JobStep
  const step = await prisma.jobStep.create({
    data: {
      jobId: job.id,
      stepNumber: 1,
      tool: "browser.navigate",
      actionPayload: JSON.stringify({ tool: "browser.navigate", parameters: { url: "https://example.org" } }),
      rationale: "Verifying live Turso step insertion",
      status: "EXECUTED",
    },
  });
  console.log(`  ✓ JobStep created in Turso: ID=${step.id}, stepNumber=${step.stepNumber}`);

  // 4d. Create ObservationRecord
  const observation = await prisma.observationRecord.create({
    data: {
      jobId: job.id,
      stepIndex: 1,
      tool: "browser.navigate",
      status: "SUCCESS",
      currentUrl: "https://example.org",
      title: "Example Domain",
      pageSummary: "Turso live observation test",
      extractedData: JSON.stringify({ sample: "verified" }),
      screenshotPath: "storage/artifacts/turso-test/shot.png",
      elapsedMs: 312,
    },
  });
  console.log(`  ✓ ObservationRecord created in Turso: ID=${observation.id}, currentUrl=${observation.currentUrl}`);

  // 4e. Create ArtifactRecord
  const artifact = await prisma.artifactRecord.create({
    data: {
      jobId: job.id,
      filename: "shot.png",
      storageKey: "storage/artifacts/turso-test/shot.png",
      mimeType: "image/png",
      sizeBytes: 45120,
    },
  });
  console.log(`  ✓ ArtifactRecord created in Turso: ID=${artifact.id}, filename=${artifact.filename}`);

  // 4f. Verify full relation load across all 5 tables in Turso
  const loadedFullJob = await prisma.job.findUnique({
    where: { id: testJobId },
    include: {
      user: true,
      steps: true,
      observations: true,
      artifacts: true,
    },
  });

  if (!loadedFullJob) throw new Error("Failed to query back loaded job from Turso!");
  if (!loadedFullJob.user || loadedFullJob.user.id !== testUserId) throw new Error("User relation failed in Turso!");
  if (loadedFullJob.steps.length !== 1) throw new Error("Steps relation failed in Turso!");
  if (loadedFullJob.observations.length !== 1) throw new Error("Observations relation failed in Turso!");
  if (loadedFullJob.artifacts.length !== 1) throw new Error("Artifacts relation failed in Turso!");

  console.log("\n[5] Verified all 5 table relations in Turso:");
  console.log(`  - Job: ${loadedFullJob.id} (${loadedFullJob.prompt})`);
  console.log(`  - User: ${loadedFullJob.user.email} (ID: ${loadedFullJob.user.id})`);
  console.log(`  - Steps: ${loadedFullJob.steps.length} record(s)`);
  console.log(`  - Observations: ${loadedFullJob.observations.length} record(s)`);
  console.log(`  - Artifacts: ${loadedFullJob.artifacts.length} record(s)`);

  // 4g. Test Cascade Deletion & Cleanup
  console.log("\n[6] Testing cascade deletion in Turso Cloud...");
  await prisma.job.delete({ where: { id: testJobId } });
  
  // Verify cascade deleted dependent records
  const remainingSteps = await prisma.jobStep.count({ where: { jobId: testJobId } });
  const remainingObs = await prisma.observationRecord.count({ where: { jobId: testJobId } });
  const remainingArtifacts = await prisma.artifactRecord.count({ where: { jobId: testJobId } });

  if (remainingSteps !== 0 || remainingObs !== 0 || remainingArtifacts !== 0) {
    throw new Error(`Cascade deletion failed! Remaining steps: ${remainingSteps}, obs: ${remainingObs}, artifacts: ${remainingArtifacts}`);
  }
  console.log("  ✓ Cascade deletion verified (steps, observations, artifacts wiped on job delete)");

  await prisma.user.delete({ where: { id: testUserId } });
  console.log("  ✓ Test user deleted cleanly");

  client.close();
  console.log("\n=================================================");
  console.log("  TURSO CLOUD DB AUDIT COMPLETE: 100% HEALTHY ✅ ");
  console.log("=================================================\n");
}

verifyTursoLiveConnection().catch((err) => {
  console.error("TURSO LIVE VERIFICATION ERROR:", err);
  process.exit(1);
});
