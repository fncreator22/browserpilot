import fs from "node:fs/promises";
import { prisma } from "@/lib/db/prisma";
import { createDbJob, getDbJobById, purgeExpiredTerminalJobs } from "@/lib/db/jobs";
import { artifactStorage } from "@/lib/storage";

export async function runCleanupUnitTests() {
  console.log("\n▶ [UNIT] Running 24-Hour Auto-Purge & Retention Tests (Prompt B2)...");

  const ts = Date.now();
  const expiredJobId = `job-expired-25h-${ts}`;
  const recentJobId = `job-recent-1h-${ts}`;
  const activeOldJobId = `job-active-old-${ts}`;

  // 1. Create Job A: Completed 25 hours ago (Must be purged)
  await createDbJob({
    id: expiredJobId,
    prompt: "Expired 25-Hour Task",
  });
  const expiredArtifactPath = await artifactStorage.saveArtifact(
    expiredJobId,
    "expired_screenshot.png",
    Buffer.from("dummy-png-data")
  );

  await prisma.job.update({
    where: { id: expiredJobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
    },
  });

  // 2. Create Job B: Completed 1 hour ago (Must be preserved)
  await createDbJob({
    id: recentJobId,
    prompt: "Recent 1-Hour Task",
  });
  const recentArtifactPath = await artifactStorage.saveArtifact(
    recentJobId,
    "recent_screenshot.png",
    Buffer.from("dummy-png-data")
  );

  await prisma.job.update({
    where: { id: recentJobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    },
  });

  // 3. Create Job C: Non-terminal active job started 30 hours ago (Must never be purged)
  await createDbJob({
    id: activeOldJobId,
    prompt: "Active In-Flight Task",
  });
  await prisma.job.update({
    where: { id: activeOldJobId },
    data: {
      status: "WORKING",
      completedAt: null,
    },
  });

  // Verify initial setup on disk
  const expiredFileExistsBefore = await fs.access(expiredArtifactPath).then(() => true).catch(() => false);
  const recentFileExistsBefore = await fs.access(recentArtifactPath).then(() => true).catch(() => false);

  if (!expiredFileExistsBefore || !recentFileExistsBefore) {
    throw new Error("Failed to create initial test artifact files on disk.");
  }

  // 4. Run Auto-Purge Cycle for 24h threshold
  const purgeResult = await purgeExpiredTerminalJobs(24 * 60 * 60 * 1000);

  if (!purgeResult.purgedJobIds.includes(expiredJobId)) {
    throw new Error("Auto-purge failed to identify and purge 25-hour expired job.");
  }
  console.log("  ✓ Auto-purge identified and purged 25-hour expired job");

  // 5. Verify Database Records
  const expiredDbJob = await getDbJobById(expiredJobId);
  if (expiredDbJob !== null) {
    throw new Error("Expired job row still exists in database after purge!");
  }
  console.log("  ✓ Expired job database row completely removed");

  const recentDbJob = await getDbJobById(recentJobId);
  if (!recentDbJob) {
    throw new Error("Recent (1-hour) job was incorrectly purged!");
  }
  console.log("  ✓ Recent (1-hour) job was preserved in database");

  const activeOldDbJob = await getDbJobById(activeOldJobId);
  if (!activeOldDbJob) {
    throw new Error("Active (non-terminal) job was incorrectly purged!");
  }
  console.log("  ✓ Active non-terminal job was preserved in database");

  // 6. Verify Filesystem Artifacts
  const expiredFileExistsAfter = await fs.access(expiredArtifactPath).then(() => true).catch(() => false);
  if (expiredFileExistsAfter) {
    throw new Error("Expired artifact file still exists on disk after purge!");
  }
  console.log("  ✓ Expired artifact files on disk successfully deleted");

  const recentFileExistsAfter = await fs.access(recentArtifactPath).then(() => true).catch(() => false);
  if (!recentFileExistsAfter) {
    throw new Error("Recent artifact file was incorrectly deleted from disk!");
  }
  console.log("  ✓ Recent artifact files on disk preserved");

  // 7. Cleanup remaining test records
  await artifactStorage.deleteJobArtifacts(recentJobId).catch(() => {});
  await prisma.job.delete({ where: { id: recentJobId } }).catch(() => {});
  await prisma.job.delete({ where: { id: activeOldJobId } }).catch(() => {});

  console.log("✓ [UNIT] 24-Hour Auto-Purge & Retention Tests Passed!");
}

if (require.main === module) {
  runCleanupUnitTests().catch((err) => {
    console.error("Cleanup test failed:", err);
    process.exit(1);
  });
}
