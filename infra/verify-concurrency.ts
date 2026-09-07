import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { execSync } from "child_process";

async function main() {
  console.log("[Verification] Starting verification pass on Aurora Serverless v2 PostgreSQL...");

  const host = "browserpilot-prod-aurora.cluster-cxeiuyo66ysk.ap-south-2.rds.amazonaws.com";
  const user = "postgres";
  const port = 5432;
  const database = "postgres";

  console.log("[Verification] Generating IAM database authentication token...");
  const awsCli = "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe";
  const token = execSync(`"${awsCli}" rds generate-db-auth-token --hostname ${host} --port ${port} --region ap-south-2 --username ${user}`, { encoding: "utf8" }).trim();

  const connectionString = `postgresql://${user}:${encodeURIComponent(token)}@${host}:${port}/${database}?sslmode=no-verify`;

  console.log("[Verification] Connecting via Prisma Client (using @prisma/adapter-pg)...");
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Connect via Prisma & query version
    const versionRes = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
    console.log("[Verification] Prisma connection confirmed. PostgreSQL Version:", versionRes[0]?.version?.substring(0, 60));

    // 2. Create temporary test table
    console.log("[Verification] Creating temporary table _concurrency_test...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS _concurrency_test (
        id SERIAL PRIMARY KEY,
        worker_id INT NOT NULL,
        payload TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure table is clean
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE _concurrency_test;`);

    // 3. Run exactly 20 concurrent write operations
    console.log("[Verification] Executing 20 concurrent write operations against _concurrency_test...");
    const startTime = Date.now();
    const workers = Array.from({ length: 20 }, (_, idx) => idx + 1);

    const writeResults = await Promise.all(
      workers.map((workerId) =>
        prisma.$executeRawUnsafe(
          `INSERT INTO _concurrency_test (worker_id, payload, created_at) VALUES ($1, $2, NOW());`,
          workerId,
          `concurrent_payload_batch_${workerId}_${Date.now()}`
        )
      )
    );

    const durationMs = Date.now() - startTime;
    console.log(`[Verification] 20 concurrent writes completed in ${durationMs}ms. Operations executed: ${writeResults.length}`);

    // 4. Verify row count
    const countRes = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM _concurrency_test;
    `;
    const totalCount = Number(countRes[0]?.count ?? 0);
    console.log(`[Verification] Verified row count in _concurrency_test: ${totalCount}`);

    if (totalCount !== 20) {
      throw new Error(`Concurrency count mismatch: expected 20 rows, received ${totalCount}`);
    }

    console.log("[Verification] Concurrency verification PASSED (20/20 concurrent writes verified).");

    // 5. Delete temporary test table (cleanup constraint)
    console.log("[Verification] Deleting temporary test table _concurrency_test...");
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _concurrency_test;`);
    console.log("[Verification] Temporary test table deleted. Verification pass SUCCESSFUL.");

    process.exit(0);
  } catch (error) {
    console.error("[Verification] Verification pass FAILED:", error);
    try {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _concurrency_test;`);
    } catch {}
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
