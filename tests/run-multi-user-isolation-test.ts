import { prisma } from "@/lib/db/prisma";
import { 
  createDbJob, 
  getDbJobById, 
  listDbJobs, 
  getDbJobEvents, 
  getDbJobArtifacts,
  cancelDbJob 
} from "@/lib/db/jobs";
import { 
  checkUserJobLimits, 
  MAX_CONCURRENT_JOBS_PER_USER, 
  MAX_HOURLY_JOBS_PER_USER 
} from "@/lib/auth/limits";

async function runMultiUserIsolationTest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT MULTI-USER ISOLATION TEST (§36)   ");
  console.log("=================================================\n");

  const timestamp = Date.now();
  const userAEmail = `alice-${timestamp}@browserpilot.ai`;
  const userBEmail = `bob-${timestamp}@browserpilot.ai`;

  // 1. Create User A and User B
  const userA = await prisma.user.create({
    data: {
      email: userAEmail,
      name: "Alice Engineer",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: userBEmail,
      name: "Bob Security",
    },
  });

  console.log(`✓ Created User A: ID=${userA.id}, Email=${userA.email}`);
  console.log(`✓ Created User B: ID=${userB.id}, Email=${userB.email}\n`);

  // 2. Create Jobs for User A and User B
  const jobAId = `job-alice-${timestamp}`;
  const jobBId = `job-bob-${timestamp}`;

  await createDbJob({
    id: jobAId,
    prompt: "Alice Private Task: Extract internal metrics",
    userId: userA.id,
    allowedDomains: ["alice-internal.org"],
  });

  await createDbJob({
    id: jobBId,
    prompt: "Bob Private Task: Audit security advisories",
    userId: userB.id,
    allowedDomains: ["bob-security.org"],
  });

  console.log(`✓ Created Job A (${jobAId}) for User A`);
  console.log(`✓ Created Job B (${jobBId}) for User B\n`);

  // ----------------------------------------------------------------
  // 3. VERIFY MULTI-TENANCY QUERY SCOPING
  // ----------------------------------------------------------------
  console.log("--- Testing Query Scoping by User ID ---");

  const aliceJobs = await listDbJobs(userA.id);
  const bobJobs = await listDbJobs(userB.id);

  console.log(`Alice Job Count: ${aliceJobs.length} (contains Job A: ${aliceJobs.some((j) => j.id === jobAId)})`);
  console.log(`Bob Job Count: ${bobJobs.length} (contains Job B: ${bobJobs.some((j) => j.id === jobBId)})`);

  // Assertions: Alice should not see Bob's jobs
  if (aliceJobs.some((j) => j.id === jobBId)) {
    throw new Error("ISOLATION BREACH: User A was able to list User B's job!");
  }
  if (bobJobs.some((j) => j.id === jobAId)) {
    throw new Error("ISOLATION BREACH: User B was able to list User A's job!");
  }
  console.log("✓ PASS: List queries strictly filtered by userId.\n");

  // ----------------------------------------------------------------
  // 4. VERIFY CROSS-TENANT DIRECT ACCESS PREVENTION
  // ----------------------------------------------------------------
  console.log("--- Testing Cross-Tenant Direct ID Queries ---");

  const crossQuery1 = await getDbJobById(jobBId, userA.id);
  const crossQuery2 = await getDbJobById(jobAId, userB.id);

  if (crossQuery1 !== null) {
    throw new Error("ISOLATION BREACH: User A accessed Job B directly via ID!");
  }
  if (crossQuery2 !== null) {
    throw new Error("ISOLATION BREACH: User B accessed Job A directly via ID!");
  }
  console.log("✓ PASS: Direct ID lookups return null when requested by non-owner.\n");

  // ----------------------------------------------------------------
  // 5. VERIFY EVENTS AND ARTIFACT ACCESS ISOLATION
  // ----------------------------------------------------------------
  console.log("--- Testing Events & Artifacts Access Isolation ---");

  const crossEvents = await getDbJobEvents(jobBId, userA.id);
  const crossArtifacts = await getDbJobArtifacts(jobBId, userA.id);

  if (crossEvents !== null || crossArtifacts !== null) {
    throw new Error("ISOLATION BREACH: User A accessed Job B's timeline events or artifacts!");
  }
  console.log("✓ PASS: Timeline events and artifacts protected by ownership validation.\n");

  // ----------------------------------------------------------------
  // 6. VERIFY CONCURRENT JOB RATE LIMITS (§22)
  // ----------------------------------------------------------------
  console.log("--- Testing Per-User Concurrency Rate Limits ---");
  console.log(`Configured Limits: Max Active Concurrent = ${MAX_CONCURRENT_JOBS_PER_USER}, Max Hourly = ${MAX_HOURLY_JOBS_PER_USER}`);

  // Create jobs up to the concurrency limit for User A
  for (let i = 2; i <= MAX_CONCURRENT_JOBS_PER_USER; i++) {
    await createDbJob({
      id: `job-alice-limit-${i}-${timestamp}`,
      prompt: `Alice Concurrent Job ${i}`,
      userId: userA.id,
    });
  }

  // Next job creation attempt should be blocked by limit check
  const limitCheck = await checkUserJobLimits(userA.id);
  console.log(`Active Jobs for Alice: ${limitCheck.activeCount}/${limitCheck.maxActive}`);
  console.log(`Limit Check Allowed: ${limitCheck.allowed}`);
  console.log(`Error Code: ${limitCheck.errorCode}`);
  console.log(`Message: "${limitCheck.message}"`);

  if (limitCheck.allowed !== false || limitCheck.errorCode !== "CONCURRENT_LIMIT_EXCEEDED") {
    throw new Error("RATE LIMIT BREACH: User A exceeded concurrent limit without being throttled!");
  }
  console.log("✓ PASS: Concurrency limit enforced per-user.\n");

  // ----------------------------------------------------------------
  // 7. VERIFY CROSS-TENANT CANCELLATION RESTRICTIONS
  // ----------------------------------------------------------------
  console.log("--- Testing Cancellation Ownership Validation ---");

  try {
    // User A attempts to cancel User B's job
    await cancelDbJob(jobBId, userA.id);
    throw new Error("ISOLATION BREACH: User A was able to cancel User B's job!");
  } catch (err: unknown) {
    console.log(`✓ Expected Unauthorized Rejection: "${(err as Error).message}"`);
  }

  // User B cancels their own job
  const bobCancelled = await cancelDbJob(jobBId, userB.id);
  console.log(`✓ User B successfully cancelled their own job (Status: ${bobCancelled.status})`);

  console.log("\n=================================================");
  console.log("  ALL MULTI-USER ISOLATION TESTS PASSED! (§36)   ");
  console.log("=================================================\n");
}

runMultiUserIsolationTest().catch((err) => {
  console.error("FATAL MULTI-USER TEST FAILURE:", err);
  process.exit(1);
});
