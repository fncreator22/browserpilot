import { prisma } from "../lib/db/prisma";
import { upsertDiscoveryWatch } from "../lib/db/opportunities";

async function main() {
  const user = await prisma.user.findUnique({ where: { email: "ui_foundation@test.com" } });
  console.log("User:", user?.id, user?.email);
  if (!user) {
    console.error("Test user not found!");
    return;
  }

  console.log("Upserting genuine watch for ui_foundation@test.com...");
  const watch = await upsertDiscoveryWatch(user.id, {
    enabled: true,
    roles: ["Software Engineer", "Frontend Developer"],
    skills: ["React", "TypeScript", "Next.js"],
    locations: ["Remote", "San Francisco, CA", "Bengaluru"],
    companies: ["Stripe", "Adobe", "Perplexity", "NVIDIA"],
    workModes: ["REMOTE", "HYBRID"],
    experienceLevels: ["ENTRY_LEVEL", "MID_LEVEL"],
    opportunityTypes: ["FULL_TIME"],
    preferredSources: ["Ashby", "Greenhouse", "Lever", "Workable", "LinkedIn"],
    minimumMatchScore: 75,
    latestOnly: false,
    freshnessWindowHours: 48,
    scanIntervalHours: 4,
    lastScannedAt: new Date(Date.now() - 3600 * 1000 * 2), // 2 hours ago
    nextScanAt: new Date(Date.now() + 3600 * 1000 * 2), // 2 hours from now
  });
  console.log("Saved Watch:", JSON.stringify(watch, null, 2));

  const eventsCount = await prisma.opportunityDiscoveryEvent.count({ where: { userId: user.id } });
  console.log("Discovery events count for user:", eventsCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
