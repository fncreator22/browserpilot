import { prisma } from "@/lib/db/prisma";
import { 
  createDbJob, 
  getDbJobById, 
  listDbJobs, 
  cancelDbJob 
} from "@/lib/db/jobs";
import { checkUserJobLimits, MAX_CONCURRENT_JOBS_PER_USER } from "@/lib/auth/limits";

export async function runMultiUserIntegrationTests() {
  console.log("▶ [INTEGRATION] Running Multi-User Isolation & Limits Tests (§36 Test 6)...");

  const ts = Date.now();
  const user1 = await prisma.user.create({ data: { email: `u1-${ts}@test.ai`, passwordHash: "testHash123" } });
  const user2 = await prisma.user.create({ data: { email: `u2-${ts}@test.ai`, passwordHash: "testHash123" } });

  const job1Id = `job-tenant-1-${ts}`;
  const job2Id = `job-tenant-2-${ts}`;

  await createDbJob({ id: job1Id, prompt: "Tenant 1 Task", userId: user1.id });
  await createDbJob({ id: job2Id, prompt: "Tenant 2 Task", userId: user2.id });

  // 1. Scoped query check
  const list1 = await listDbJobs(user1.id);
  if (list1.some((j) => j.id === job2Id)) {
    throw new Error("Tenant isolation breach on list query!");
  }
  console.log("  ✓ Multi-tenancy job list isolation verified");

  // 2. Cross-tenant access check
  const crossAccess = await getDbJobById(job2Id, user1.id);
  if (crossAccess !== null) {
    throw new Error("Tenant isolation breach on direct ID query!");
  }
  console.log("  ✓ Direct cross-tenant access blocked");

  // 3. Concurrency limit check
  for (let i = 2; i <= MAX_CONCURRENT_JOBS_PER_USER; i++) {
    await createDbJob({ id: `job-limit-${i}-${ts}`, prompt: `Limit Task ${i}`, userId: user1.id });
  }

  const limitCheck = await checkUserJobLimits(user1.id);
  if (limitCheck.allowed || limitCheck.errorCode !== "CONCURRENT_LIMIT_EXCEEDED") {
    throw new Error("Concurrency rate limit failed to throttle excessive jobs!");
  }
  console.log(`  ✓ Concurrency throttled at ${limitCheck.activeCount} active jobs`);

  // 4. Unauthorized cancel check
  try {
    await cancelDbJob(job2Id, user1.id);
    throw new Error("Unauthorized cancellation succeeded!");
  } catch (err: unknown) {
    console.log("  ✓ Unauthorized cancellation prevented");
  }

  console.log("✓ [INTEGRATION] Multi-User Isolation Tests Passed!\n");
}
