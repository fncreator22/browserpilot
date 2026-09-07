import { prisma, getDatabaseTarget } from "@/lib/db/prisma";

async function main() {
  console.log("=================================================");
  console.log("  BROWSERPILOT DATABASE CONNECTIVITY TEST       ");
  console.log("=================================================\n");

  try {
    const target = getDatabaseTarget();
    console.log(`[Config] Target Engine  : ${target.engine}`);
    console.log(`[Config] Target Provider: ${target.provider}`);
    console.log(`[Config] Target Host    : ${target.host}`);
    console.log(`[Config] Target Database: ${target.database}`);
    console.log(`[Config] Is Pooler Mode : ${target.isPooler}\n`);

    if (target.host.includes("[") || target.host.includes("YOUR-")) {
      console.log("⚠️  Placeholder detected in DATABASE_URL.");
      console.log("Please replace the placeholder values in .env.development or .env with your real connection string.");
      process.exit(0);
    }

    console.log("[Query] Executing baseline health query (SELECT 1)...");
    const result = await prisma.$queryRaw<Array<{
      connected: number;
      current_user: string;
      current_database: string;
      version: string;
    }>>`SELECT 1 as connected, current_user, current_database(), version();`;

    console.log("✓ Health query succeeded!");
    console.log("Result:", result[0]);
    process.exit(0);
  } catch (error) {
    console.error("❌ Database query failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
