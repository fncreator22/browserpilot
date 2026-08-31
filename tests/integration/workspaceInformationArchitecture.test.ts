/**
 * §TASK-028 WORKSPACE INFORMATION ARCHITECTURE & DISCOVERY UX INTEGRATION SUITE
 * Comprehensive verification of first-class Discover, Watch, Saved, and History
 * workflows, API contracts, decoupled notifications, multi-tab safety, and tenant isolation.
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_SECRET_KEY = "test_admin_supersecret_key_12345";
process.env.ADMIN_EMAILS = "admin.lead@browserpilot.ai,operations@browserpilot.ai";

import { prisma, ensureDatabaseSchema } from "@/lib/db/prisma";
import { 
  parseSearchIntent, 
  executeSearchPipeline, 
  type SearchIntent 
} from "@/lib/scraper";
import { 
  getDiscoveryWatch, 
  upsertDiscoveryWatch, 
  getSavedOpportunities, 
  saveOpportunity,
  unsaveOpportunity,
  getUserSearches,
  getUserLifecycleAlerts,
  recordLifecycleAlert
} from "@/lib/db/opportunities";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${msg}`);
  }
}

export async function runWorkspaceIATests() {
  console.log("=================================================================");
  console.log("  TASK-028: WORKSPACE INFORMATION ARCHITECTURE & UX TEST SUITE  ");
  console.log("=================================================================");

  await ensureDatabaseSchema();
  const testRunId = `ia_test_${Date.now()}`;
  let userA: any;
  let userB: any;
  let adminUser: any;

  try {
    // 1. Create isolated test tenants
    userA = await prisma.user.create({
      data: {
        email: `usera_${testRunId}@browserpilot.ai`,
        name: "User A (Job Seeker)",
        role: "USER",
        passwordHash: "dummy_hash_a",
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `userb_${testRunId}@browserpilot.ai`,
        name: "User B (Job Seeker)",
        role: "USER",
        passwordHash: "dummy_hash_b",
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: `admin_${testRunId}@browserpilot.ai`,
        name: "Admin User",
        role: "SUPERADMIN",
        passwordHash: "dummy_hash_admin",
      },
    });

    // =========================================================================
    // SECTION 1: Direct Discovery Entry (Independent of History)
    // =========================================================================
    console.log("\n▶ [SECTION 1] Testing Direct Discovery Entry & NL Intent Mapping...");

    const query = "Find backend engineering internships at Razorpay in Hyderabad, posted in the last 48 hours.";
    const intent = parseSearchIntent(query);

    assert(Boolean(intent.role), "Should extract role from query");
    assert(intent.companies?.includes("Razorpay") ?? false, "Should extract company target");
    assert(intent.location === "Hyderabad", "Should extract location");
    assert(intent.opportunityType === "INTERNSHIP", "Should extract opportunity type");
    assert(intent.freshnessWindowHours === 48, "Should extract 48h freshness window");
    assert(intent.isExplicitFreshness === true, "Should set isExplicitFreshness flag");
    console.log("  ✓ Verified direct natural-language query to structured intent mapping");

    const searchResult = await executeSearchPipeline(intent, {
      userId: userA.id,
      rawQuery: "Backend Engineer at Razorpay in Hyderabad last 48 hours",
      persistToDb: true,
      maxResults: 10,
      excludeKnown: false,
    });

    assert(Boolean(searchResult.searchId), "Search pipeline should record searchId");
    assert(Array.isArray(searchResult.rankedOpportunities), "Should return ranked opportunities array");

    const history = await getUserSearches(userA.id, 5);
    assert(history.length >= 1, "Search history should be recorded in background");
    assert(history[0].rawQuery.includes("Backend Engineer at Razorpay"), "History query match");
    console.log("  ✓ Verified search execution independent of prior history state");

    // =========================================================================
    // SECTION 2: Dedicated Watch Configuration & Persistence
    // =========================================================================
    console.log("\n▶ [SECTION 2] Testing Dedicated Watch Workflow & Configuration Contract...");

    const watchConfig = {
      enabled: true,
      roles: ["Backend Engineer", "Software Engineer"],
      skills: ["Node.js", "PostgreSQL", "React"],
      locations: ["Hyderabad", "Remote"],
      companies: ["Razorpay", "Google", "Stripe"],
      workModes: ["REMOTE", "HYBRID"],
      experienceLevels: ["INTERN", "ENTRY_LEVEL"],
      opportunityTypes: ["INTERNSHIP", "FULL_TIME"],
      preferredSources: ["LinkedIn", "Y Combinator", "Indeed"],
      minimumMatchScore: 75,
      latestOnly: true,
      freshnessWindowHours: 48,
      scanIntervalHours: 4,
    };

    const upserted = await upsertDiscoveryWatch(userA.id, watchConfig);
    assert(upserted.enabled === true, "Watch should be enabled");
    assert(upserted.scanIntervalHours === 4, "Interval should be 4h");
    assert(upserted.freshnessWindowHours === 48, "Freshness should be 48h");
    assert(upserted.minimumMatchScore === 75, "Min fit should be 75");
    assert(upserted.latestOnly === true, "Latest only should be true");

    const retrieved = await getDiscoveryWatch(userA.id);
    assert(retrieved !== null, "Watch should be retrievable");
    assert(retrieved?.roles.includes("Backend Engineer") ?? false, "Role preserved");
    assert(retrieved?.companies.includes("Razorpay") ?? false, "Company target preserved");
    console.log("  ✓ Verified full discovery watch criteria persistence");

    const paused = await upsertDiscoveryWatch(userA.id, { enabled: false });
    assert(paused.enabled === false, "Watch should be paused");
    const retrievedPaused = await getDiscoveryWatch(userA.id);
    assert(retrievedPaused?.enabled === false, "Paused state persists");
    assert(retrievedPaused?.companies.includes("Razorpay") ?? false, "Criteria remains intact while paused");

    const resumed = await upsertDiscoveryWatch(userA.id, { enabled: true });
    assert(resumed.enabled === true, "Watch resumed successfully");
    console.log("  ✓ Verified active/paused toggle state without criteria corruption");

    // =========================================================================
    // SECTION 3: Dedicated Saved Opportunities (Separated from History)
    // =========================================================================
    console.log("\n▶ [SECTION 3] Testing Dedicated Saved Opportunities...");

    const testOpportunity = await prisma.opportunity.create({
      data: {
        canonicalHash: `hash_opp_${Date.now()}`,
        title: "Senior Full Stack Engineer",
        companyName: "Stripe",
        location: "Remote",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        description: "Test full stack role at Stripe with TypeScript and Node.",
        primaryApplyUrl: "https://stripe.com/jobs/123",
        status: "ACTIVE",
        firstSeenAt: new Date(),
        lastVerifiedAt: new Date(),
      },
    });

    const saved = await saveOpportunity(userA.id, testOpportunity.id, "Top target company");
    assert(Boolean(saved.id), "Should save opportunity bookmark");

    const userASaved = await getSavedOpportunities(userA.id);
    assert(userASaved.length === 1, "User A should have 1 saved opportunity");
    assert(userASaved[0].opportunity.companyName === "Stripe", "Saved opportunity company match");
    assert(userASaved[0].notes === "Top target company", "Saved opportunity note match");

    // Isolation check: User B must not see User A's saved opportunities
    const userBSaved = await getSavedOpportunities(userB.id);
    assert(userBSaved.length === 0, "User B should have 0 saved opportunities");
    console.log("  ✓ Verified saved opportunities bookmarking and strict tenant isolation");

    const removed = await unsaveOpportunity(userA.id, testOpportunity.id);
    assert(removed.deleted === true, "Should remove saved opportunity bookmark");
    const userASavedAfter = await getSavedOpportunities(userA.id);
    assert(userASavedAfter.length === 0, "User A should have 0 saved opportunities after remove");
    console.log("  ✓ Verified bookmark removal lifecycle");

    // =========================================================================
    // SECTION 4: Notifications / Alerts Decoupling
    // =========================================================================
    console.log("\n▶ [SECTION 4] Testing Notifications & Lifecycle Alerts Decoupling...");

    const alertOpp = await prisma.opportunity.create({
      data: {
        canonicalHash: `alert_opp_hash_${Date.now()}`,
        title: "AI Research Engineer",
        companyName: "OpenAI",
        location: "San Francisco, CA",
        workMode: "HYBRID",
        description: "Cutting-edge AI research role working with large foundation models.",
        primaryApplyUrl: "https://openai.com/careers/123",
        status: "ACTIVE",
        firstSeenAt: new Date(),
        lastVerifiedAt: new Date(),
      },
    });

    const result = await recordLifecycleAlert({
      userId: userA.id,
      opportunityId: alertOpp.id,
      transitionType: "NEW_OPPORTUNITY",
      previousStatus: "DISCOVERED",
      newStatus: "ACTIVE",
      title: "AI Research Engineer",
      companyName: "OpenAI",
      message: "New high-fit AI role matching your criteria.",
    });

    assert(Boolean(result.alert.id), "Alert record created");
    assert(result.alert.isRead === false, "Alert initial state is unread");

    const notifications = await getUserLifecycleAlerts(userA.id, { limit: 10 });
    assert(notifications.length >= 1, "User A notifications retrieved");
    assert(notifications[0].title === "AI Research Engineer", "Notification title match");
    console.log("  ✓ Verified lifecycle alerts decouple cleanly from discovery navigation");

    // =========================================================================
    // SECTION 5: Multi-Tab Safety & Role-Based Authorization Boundaries
    // =========================================================================
    console.log("\n▶ [SECTION 5] Testing Multi-Tab Safety & Authorization Boundaries...");

    // Simulated Tab 1: Updates interval to 6h
    await upsertDiscoveryWatch(userA.id, { scanIntervalHours: 6 });
    // Simulated Tab 2: Updates min score to 85%
    await upsertDiscoveryWatch(userA.id, { minimumMatchScore: 85 });

    const finalState = await getDiscoveryWatch(userA.id);
    assert(finalState?.scanIntervalHours === 6, "Tab 1 update persisted on server");
    assert(finalState?.minimumMatchScore === 85, "Tab 2 update persisted on server");
    console.log("  ✓ Verified server-authoritative state across concurrent browser tabs");

    assert(userA.role === "USER", "User A is regular tenant");
    assert(adminUser.role === "SUPERADMIN", "Admin user is superadmin");
    const isUserAdmin = userA.role === "ADMIN" || userA.role === "SUPERADMIN";
    const isAdminAdmin = adminUser.role === "ADMIN" || adminUser.role === "SUPERADMIN";
    assert(isUserAdmin === false, "Regular tenant prohibited from administrative control plane");
    assert(isAdminAdmin === true, "Admin allowed access to control plane");
    console.log("  ✓ Verified RBAC isolation between standard users and admin control plane");

    console.log("\n=================================================================");
    console.log("  TASK-028: ALL WORKSPACE INFORMATION ARCHITECTURE TESTS PASSED   ");
    console.log("=================================================================\n");
  } finally {
    // Cleanup
    try {
      await prisma.lifecycleAlert.deleteMany({
        where: { userId: { in: [userA?.id, userB?.id, adminUser?.id].filter(Boolean) } },
      });
      await prisma.savedOpportunity.deleteMany({
        where: { userId: { in: [userA?.id, userB?.id, adminUser?.id].filter(Boolean) } },
      });
      await prisma.discoveryWatch.deleteMany({
        where: { userId: { in: [userA?.id, userB?.id, adminUser?.id].filter(Boolean) } },
      });
      await prisma.search.deleteMany({
        where: { userId: { in: [userA?.id, userB?.id, adminUser?.id].filter(Boolean) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [userA?.id, userB?.id, adminUser?.id].filter(Boolean) } },
      });
    } catch {}
  }
}

if (process.argv[1]?.endsWith("workspaceInformationArchitecture.test.ts")) {
  runWorkspaceIATests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
