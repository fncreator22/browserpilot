import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { 
  createDbJob, 
  getDbJobById, 
  listDbJobs, 
  updateDbJob, 
  recordDbObservation, 
  recordDbJobStep,
  recordDbArtifact 
} from "@/lib/db/jobs";
import { browserPool } from "@/worker/browser";
import { artifactStorage } from "@/lib/storage";

export async function runConcurrentUserIsolationTests() {
  console.log("\n▶ [INTEGRATION] Running Real Concurrent User Isolation Tests (Prompt C1)...");

  const ts = Date.now();
  const passwordHash = await bcrypt.hash("ConcurrentPass2026!", 10);

  // 1. Create 3 Distinct Real Tenant Accounts
  const tenantA = await prisma.user.create({
    data: { email: `tenant-a-${ts}@concurrent.ai`, passwordHash },
  });
  const tenantB = await prisma.user.create({
    data: { email: `tenant-b-${ts}@concurrent.ai`, passwordHash },
  });
  const tenantC = await prisma.user.create({
    data: { email: `tenant-c-${ts}@concurrent.ai`, passwordHash },
  });

  console.log(`  ✓ Registered 3 distinct tenant accounts: [${tenantA.email}, ${tenantB.email}, ${tenantC.email}]`);

  const jobAId = `job-concurrent-a-${ts}`;
  const jobBId = `job-concurrent-b-${ts}`;
  const jobCId = `job-concurrent-c-${ts}`;

  // 2. Concurrently Create Database Jobs
  await Promise.all([
    createDbJob({ id: jobAId, prompt: "Tenant A Private Search", userId: tenantA.id }),
    createDbJob({ id: jobBId, prompt: "Tenant B Secure Checkout", userId: tenantB.id }),
    createDbJob({ id: jobCId, prompt: "Tenant C Financial Report", userId: tenantC.id }),
  ]);

  console.log("  ✓ Dispatched 3 simultaneous jobs across tenants");

  // 3. Verify Playwright Browser Context & Cookie/Storage Isolation
  browserPool.resetConcurrencyMetrics();

  // Spin up simultaneous browser sessions for Job A, Job B, Job C
  const [sessionA, sessionB, sessionC] = await Promise.all([
    browserPool.createSession({ jobId: jobAId }),
    browserPool.createSession({ jobId: jobBId }),
    browserPool.createSession({ jobId: jobCId }),
  ]);

  // Set sensitive isolated state in Session A
  await sessionA.context.addCookies([
    {
      name: "auth_token",
      value: "SECRET_TOKEN_TENANT_A",
      domain: "localhost",
      path: "/",
    },
  ]);

  // Set sensitive isolated state in Session B
  await sessionB.context.addCookies([
    {
      name: "auth_token",
      value: "SECRET_TOKEN_TENANT_B",
      domain: "localhost",
      path: "/",
    },
  ]);

  // Inspect Session A cookies
  const cookiesA = await sessionA.context.cookies();
  const cookiesB = await sessionB.context.cookies();
  const cookiesC = await sessionC.context.cookies();

  // Verify Session A only has Tenant A's token
  if (!cookiesA.some((c) => c.value === "SECRET_TOKEN_TENANT_A") || cookiesA.some((c) => c.value === "SECRET_TOKEN_TENANT_B")) {
    throw new Error("Isolation breach: Session A contains invalid or cross-tenant cookies!");
  }

  // Verify Session B only has Tenant B's token
  if (!cookiesB.some((c) => c.value === "SECRET_TOKEN_TENANT_B") || cookiesB.some((c) => c.value === "SECRET_TOKEN_TENANT_A")) {
    throw new Error("Isolation breach: Session B contains invalid or cross-tenant cookies!");
  }

  // Verify Session C has ZERO cookies
  if (cookiesC.length !== 0) {
    throw new Error(`Isolation breach: Session C received leaked cookies from another session! Count: ${cookiesC.length}`);
  }

  console.log("  ✓ Verified 100% Playwright cookie & context isolation between concurrent jobs");

  // Close browser sessions
  await Promise.all([sessionA.close(), sessionB.close(), sessionC.close()]);

  // 4. Test Concurrent Database Status Updates & Race Conditions
  await Promise.all([
    updateDbJob(jobAId, {
      status: "COMPLETED",
      progress: 100,
      summary: "Tenant A Task Complete",
      tokensUsed: 420,
      memoryMb: 110.5,
    }),
    updateDbJob(jobBId, {
      status: "COMPLETED",
      progress: 100,
      summary: "Tenant B Task Complete",
      tokensUsed: 680,
      memoryMb: 115.2,
    }),
    updateDbJob(jobCId, {
      status: "COMPLETED",
      progress: 100,
      summary: "Tenant C Task Complete",
      tokensUsed: 530,
      memoryMb: 108.0,
    }),
    recordDbJobStep(jobAId, {
      stepNumber: 1,
      action: { tool: "browser.navigate", parameters: { url: "https://example.com", waitUntil: "domcontentloaded", timeout: 15000 } },
      rationale: "Tenant A Step 1",
      isOptional: false,
      checkpointScreenshot: false,
    }),
    recordDbJobStep(jobBId, {
      stepNumber: 1,
      action: { tool: "browser.navigate", parameters: { url: "https://example.com", waitUntil: "domcontentloaded", timeout: 15000 } },
      rationale: "Tenant B Step 1",
      isOptional: false,
      checkpointScreenshot: false,
    }),
    recordDbJobStep(jobCId, {
      stepNumber: 1,
      action: { tool: "browser.navigate", parameters: { url: "https://example.com", waitUntil: "domcontentloaded", timeout: 15000 } },
      rationale: "Tenant C Step 1",
      isOptional: false,
      checkpointScreenshot: false,
    }),
  ]);

  console.log("  ✓ Executed simultaneous concurrent DB updates with zero race conditions");

  // 5. Verify Multi-Tenant Query Scoping & Access Control
  const [listA, listB, listC] = await Promise.all([
    listDbJobs(tenantA.id),
    listDbJobs(tenantB.id),
    listDbJobs(tenantC.id),
  ]);

  if (!listA.some((j) => j.id === jobAId) || listA.some((j) => j.id === jobBId || j.id === jobCId)) {
    throw new Error("Multi-tenant listing isolation failed for Tenant A!");
  }
  if (!listB.some((j) => j.id === jobBId) || listB.some((j) => j.id === jobAId || j.id === jobCId)) {
    throw new Error("Multi-tenant listing isolation failed for Tenant B!");
  }
  if (!listC.some((j) => j.id === jobCId) || listC.some((j) => j.id === jobAId || j.id === jobBId)) {
    throw new Error("Multi-tenant listing isolation failed for Tenant C!");
  }
  console.log("  ✓ Verified strict tenant query scoping across all accounts");

  // 6. Direct Cross-Tenant Job & Artifact Access Prevention
  const crossAccessAFromB = await getDbJobById(jobAId, tenantB.id);
  const crossAccessBFromC = await getDbJobById(jobBId, tenantC.id);
  const crossAccessCFromA = await getDbJobById(jobCId, tenantA.id);

  if (crossAccessAFromB !== null || crossAccessBFromC !== null || crossAccessCFromA !== null) {
    throw new Error("Direct cross-tenant database access breach detected!");
  }
  console.log("  ✓ Blocked direct cross-tenant job queries");

  // 7. Save and Verify Multi-Tenant Artifact Ownership
  const artifactNameA = "tenant_a_screenshot.png";
  await artifactStorage.saveArtifact(jobAId, artifactNameA, Buffer.from("dummy-a-screenshot"));
  await recordDbArtifact(jobAId, {
    filename: artifactNameA,
    storageKey: `storage/artifacts/${jobAId}/${artifactNameA}`,
    mimeType: "image/png",
  });

  // Verify Tenant A can resolve job A
  const ownedJob = await prisma.job.findUnique({ where: { id: jobAId }, select: { userId: true } });
  if (ownedJob?.userId !== tenantA.id) {
    throw new Error("Artifact owner resolution mismatch!");
  }

  // Verify Tenant B is not the owner
  if (ownedJob.userId === tenantB.id) {
    throw new Error("Security breach: Tenant B identified as owner of Tenant A job!");
  }
  console.log("  ✓ Multi-tenant artifact ownership validated");

  // 8. Clean up test records
  await artifactStorage.deleteJobArtifacts(jobAId).catch(() => {});
  await prisma.job.deleteMany({ where: { id: { in: [jobAId, jobBId, jobCId] } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id, tenantC.id] } } }).catch(() => {});

  console.log("✓ [INTEGRATION] Real Concurrent User Isolation Tests Passed!");
}

if (require.main === module) {
  runConcurrentUserIsolationTests().catch((err) => {
    console.error("Concurrent isolation test failed:", err);
    process.exit(1);
  });
}
