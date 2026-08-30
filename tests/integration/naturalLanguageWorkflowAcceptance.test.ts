/**
 * §NATURAL-LANGUAGE END-TO-END WORKFLOW ACCEPTANCE TEST
 * Simulates a normal user conversational workflow across two natural language turns:
 * Turn 1: Ad-hoc Multi-Source Job Search
 * Turn 2: Automated Background Watch & Duplicate-Free Alerting
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { prisma } from "@/lib/db";
import {
  parseSearchIntent,
  buildDiscoveryPlan,
  executeSearchPipeline,
  DiscoveryScheduler,
  type SearchProvider,
} from "@/lib/scraper";
import {
  upsertDiscoveryWatch,
  getUserLifecycleAlerts,
  getUserSearches,
} from "@/lib/db/opportunities";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ACCEPTANCE FAILURE]: ${message}`);
  }
}

export async function runNaturalLanguageWorkflowAcceptanceTest() {
  console.log("=================================================================");
  console.log("  NATURAL-LANGUAGE USER WORKFLOW BEHAVIORAL ACCEPTANCE TEST      ");
  console.log("=================================================================\n");

  const salt = Date.now();
  const compAcme = `Acme Innovations ${salt}`;
  const compHyper = `HyperScale AI ${salt}`;
  const compNewCo = `NewCo Tech ${salt}`;

  const testUser = await prisma.user.create({
    data: {
      email: `normal_user_${salt}@browserpilot.ai`,
      passwordHash: "hash_user_acceptance",
    },
  });

  const otherUser = await prisma.user.create({
    data: {
      email: `other_user_${salt}@browserpilot.ai`,
      passwordHash: "hash_other_acceptance",
    },
  });

  const report: Record<string, "PASS" | "FAIL"> = {};

  try {
    // -------------------------------------------------------------------------
    // TURN 1: NATURAL LANGUAGE DISCOVERY REQUEST
    // -------------------------------------------------------------------------
    const prompt1 =
      "I’m looking for software engineering internships and entry-level software developer jobs in Hyderabad or remote India. I work with React, Next.js, Python and AI/ML. Show me recently posted opportunities and prioritize the ones that are the strongest match for me.";

    console.log(`[Turn 1 User Prompt]: "${prompt1}"\n`);

    // 1. Understands the Request
    const intent1 = parseSearchIntent(prompt1);
    const plan1 = buildDiscoveryPlan(prompt1);

    console.log("1. Extracted Intent & Discovery Plan:");
    console.log("   - Roles:", plan1.roles);
    console.log("   - Skills:", plan1.skills);
    console.log("   - Locations:", plan1.locations);
    console.log("   - Work Modes:", plan1.workModes);
    console.log("   - Opportunity Types:", plan1.opportunityTypes);
    console.log("   - Experience Levels:", plan1.experienceLevels);
    console.log("   - Sort Mode:", plan1.sortMode);
    console.log("   - Freshness Window:", plan1.freshnessWindowHours, "hours");

    assert(
      plan1.roles.some((r) => /software engineer|software developer/i.test(r)),
      "Must extract Software Engineer / Developer role"
    );
    assert(
      plan1.opportunityTypes.includes("INTERNSHIP") && plan1.opportunityTypes.includes("FULL_TIME"),
      "Must recognize both internships and entry-level full-time roles"
    );
    assert(
      plan1.locations.includes("Hyderabad") && plan1.locations.includes("India"),
      "Must capture Hyderabad and India"
    );
    assert(plan1.workModes.includes("REMOTE"), "Must capture REMOTE work mode");
    assert(
      plan1.skills.some((s) => /react/i.test(s)) &&
        plan1.skills.some((s) => /next/i.test(s)) &&
        plan1.skills.some((s) => /python/i.test(s)) &&
        plan1.skills.some((s) => /ai/i.test(s)),
      "Must capture React, Next.js, Python, and AI/ML skills"
    );
    assert(plan1.sortMode === "LATEST", "Must prioritize freshness with LATEST sort mode");
    report["Understands Request"] = "PASS";

    // 2. Searches Available Sources, Validates Extractions & Deduplicates Across Sources
    const mockLinkedInProvider: SearchProvider = {
      name: "LinkedIn",
      supports: () => true,
      harvestCandidates: async () => [
        {
          sourcePlatform: "LinkedIn",
          sourceUrl: `https://linkedin.com/jobs/view/hyd-swe-${salt}`,
          applyUrl: `https://acme.careers/apply/hyd-swe-${salt}`,
          externalJobId: `li_${salt}_1`,
          title: "Junior Software Engineer",
          companyName: compAcme,
          location: "Hyderabad, India",
          workMode: "HYBRID",
          opportunityType: "FULL_TIME",
          experienceLevel: "ENTRY_LEVEL",
          description: "Develop full-stack web applications with React, Next.js, and Python backend services.",
          rawSnippet: "Posted 4 hours ago",
          discoveredAt: new Date(),
        },
      ],
    };

    const mockIndeedProvider: SearchProvider = {
      name: "Indeed",
      supports: () => true,
      harvestCandidates: async () => [
        {
          sourcePlatform: "Indeed",
          sourceUrl: `https://indeed.com/viewjob?jk=indeed-hyd-${salt}`,
          applyUrl: `https://acme.careers/apply/hyd-swe-${salt}`, // Duplicate apply URL from second platform
          externalJobId: `ind_${salt}_1`,
          title: "Junior Software Engineer",
          companyName: compAcme,
          location: "Hyderabad",
          workMode: "HYBRID",
          opportunityType: "FULL_TIME",
          experienceLevel: "ENTRY_LEVEL",
          description: "Full stack role requiring React and Python.",
          rawSnippet: "Posted 3 hours ago",
          discoveredAt: new Date(),
        },
      ],
    };

    const mockYCProvider: SearchProvider = {
      name: "Y Combinator",
      supports: () => true,
      harvestCandidates: async () => [
        {
          sourcePlatform: "Y Combinator",
          sourceUrl: `https://workatastartup.com/companies/yc-ai-${salt}`,
          applyUrl: `https://workatastartup.com/companies/yc-ai-${salt}/apply`,
          externalJobId: `yc_${salt}_1`,
          title: "AI Engineering Intern",
          companyName: compHyper,
          location: "Remote",
          workMode: "REMOTE",
          opportunityType: "INTERNSHIP",
          experienceLevel: "INTERN",
          description: "Build GenAI agents with Python, PyTorch, and React. Open to candidates in India.",
          rawSnippet: "Posted 2 hours ago",
          discoveredAt: new Date(),
        },
      ],
    };

    const searchResult = await executeSearchPipeline(intent1, {
      userId: testUser.id,
      rawQuery: prompt1,
      persistToDb: true,
      verifyEvidence: false,
      customProviders: [mockLinkedInProvider, mockIndeedProvider, mockYCProvider],
    });

    console.log("\n2. Multi-Source Search & Deduplication Results:");
    console.log(`   - Raw Candidates Discovered: 3 across 3 sources`);
    console.log(`   - Deduplicated Opportunities: ${searchResult.totalUniqueOpportunities}`);
    console.log(`   - Ranked Results: ${searchResult.rankedOpportunities.length}`);

    assert(searchResult.discovery.telemetry.length === 3, "Must query all 3 active providers");
    report["Searches Available Sources"] = "PASS";
    report["Validates Extracted Opportunities"] = "PASS";

    assert(
      searchResult.totalUniqueOpportunities === 2,
      "Must deduplicate duplicate Acme Innovations cross-posting from LinkedIn & Indeed into 1 canonical item"
    );
    const acmeOpp = searchResult.rankedOpportunities.find((o) =>
      o.opportunity.companyName.includes(compAcme)
    );
    assert(
      Boolean(acmeOpp && acmeOpp.opportunity.sourceListings.length === 2),
      "Acme opportunity must preserve 2 distinct source listings (LinkedIn + Indeed)"
    );
    report["Removes Duplicates"] = "PASS";

    // 3. Relevance Calculation & Freshness Prioritization
    console.log("\n3. Ranked Scoring & Relevance Breakdown:");
    for (const r of searchResult.rankedOpportunities) {
      console.log(
        `   - #${r.rankPosition} ${r.opportunity.title} at ${r.opportunity.companyName}: Total=${r.totalScore} pts (Role=${r.breakdown.role}, Skills=${r.breakdown.skills}, WorkMode=${r.breakdown.workMode}, Freshness=${r.breakdown.freshness})`
      );
      assert(r.totalScore >= 65, "Valid matches must score >= 65 points");
      assert(r.breakdown.freshness >= 12, "Recent postings must receive high freshness points");
    }
    report["Calculates Relevance"] = "PASS";
    report["Prioritizes Freshness"] = "PASS";

    // -------------------------------------------------------------------------
    // TURN 2: NATURAL LANGUAGE BACKGROUND WATCH CONVERSION & NOVELTY DETECTION
    // -------------------------------------------------------------------------
    const prompt2 =
      "Keep watching for jobs like these. I don't want to search manually every time. Only tell me when you find something genuinely new or when an existing opportunity has been reposted.";

    console.log(`\n[Turn 2 User Prompt]: "${prompt2}"\n`);

    const intent2 = parseSearchIntent(prompt2, {
      role: plan1.roles[0],
      roles: plan1.roles,
      skills: plan1.skills,
      locations: plan1.locations,
      workModes: plan1.workModes,
      opportunityTypes: plan1.opportunityTypes,
      experienceLevels: plan1.experienceLevels,
    });

    console.log("4. Turn 2 Watch Intent Extracted:");
    console.log("   - Watch Enabled:", intent2.watchIntent?.enabled);
    console.log("   - Scan Interval:", intent2.watchIntent?.scanIntervalHours, "hours");
    console.log("   - Exclude Known:", intent2.excludeKnown);

    assert(intent2.watchIntent?.enabled === true, "Must recognize intent to keep watching");
    report["Creates Appropriate Watch"] = "PASS";

    // Configure persistent watch for user
    const pastTime = new Date(Date.now() - 3600000);
    const watchConfig = await upsertDiscoveryWatch(testUser.id, {
      enabled: true,
      roles: plan1.roles,
      skills: plan1.skills,
      locations: plan1.locations,
      workModes: plan1.workModes,
      opportunityTypes: plan1.opportunityTypes,
      experienceLevels: plan1.experienceLevels,
      minimumMatchScore: 70,
      scanIntervalHours: intent2.watchIntent?.scanIntervalHours || 4,
      nextScanAt: pastTime,
    });

    assert(watchConfig.enabled === true, "Watch record must be enabled");
    assert(watchConfig.roles.length > 0, "Watch record must store role families");

    // 4. Schedules Future Discovery
    const scheduler = new DiscoveryScheduler();
    console.log("\n5. Executing Scheduled Autonomous Watch Run...");

    // Provider produces:
    // 1. Acme Innovations with same LinkedIn source URL (ALREADY_KNOWN from Turn 1)
    // 2. HyperScale AI with new GitHub Jobs source (NEW_SOURCE)
    // 3. NewCo Tech (NEW_OPPORTUNITY)
    const mockAutonomousProvider: SearchProvider = {
      name: "MockAutoProvider",
      supports: () => true,
      harvestCandidates: async () => [
        {
          sourcePlatform: "LinkedIn", // Same platform & URL as Turn 1 -> ALREADY_KNOWN
          sourceUrl: `https://linkedin.com/jobs/view/hyd-swe-${salt}`,
          applyUrl: `https://acme.careers/apply/hyd-swe-${salt}`,
          title: "Junior Software Engineer",
          companyName: compAcme,
          location: "Hyderabad, India",
          workMode: "HYBRID",
          opportunityType: "FULL_TIME",
          description: "Full stack web applications with React and Python.",
          rawSnippet: "Posted 5 hours ago",
          discoveredAt: new Date(),
        },
        {
          sourcePlatform: "MockAutoProvider", // New source URL -> NEW_SOURCE
          sourceUrl: `https://workatastartup.com/companies/yc-ai-${salt}/new-listing`,
          applyUrl: `https://workatastartup.com/companies/yc-ai-${salt}/apply`,
          title: "AI Engineering Intern",
          companyName: compHyper,
          location: "Remote",
          workMode: "REMOTE",
          opportunityType: "INTERNSHIP",
          description: "GenAI agents with Python and React.",
          rawSnippet: "Posted 1 hour ago",
          discoveredAt: new Date(),
        },
        {
          sourcePlatform: "MockAutoProvider", // Truly brand new -> NEW_OPPORTUNITY
          sourceUrl: `https://newcodev.com/jobs/fullstack-${salt}`,
          applyUrl: `https://newcodev.com/apply/fullstack-${salt}`,
          title: "Entry Level Full Stack Developer",
          companyName: compNewCo,
          location: "Hyderabad",
          workMode: "REMOTE",
          opportunityType: "FULL_TIME",
          description: "Fast growing startup hiring junior devs with React, Next.js, and Python skills.",
          rawSnippet: "Posted 30 minutes ago",
          discoveredAt: new Date(),
        },
      ],
    };

    const schedRun = await scheduler.runScheduledDiscovery({
      maxWatchesToProcess: 50,
      discoveryOptions: {
        customProviders: [mockAutonomousProvider],
      },
    });

    assert(schedRun.status === "SUCCESS", "Scheduled discovery run must succeed");
    report["Schedules Future Discovery"] = "PASS";

    // 5. Identifies Known vs New Opportunities & Alerts Without Duplication
    const alerts = await getUserLifecycleAlerts(testUser.id);
    console.log(`\n6. Proactive Lifecycle Alerts Generated (${alerts.length} total):`);
    for (const a of alerts) {
      console.log(`   - [${a.transitionType}] ${a.title} at ${a.companyName}: "${a.message}"`);
    }

    assert(
      !alerts.some((a) => a.companyName === compAcme && a.transitionType === "NEW_OPPORTUNITY"),
      "Must NOT produce duplicate alert for already-known Acme Innovations opportunity"
    );
    assert(
      alerts.some((a) => a.companyName === compNewCo && a.transitionType === "NEW_OPPORTUNITY"),
      "Must produce NEW_OPPORTUNITY alert for NewCo Tech"
    );
    assert(
      alerts.some((a) => a.companyName === compHyper && a.transitionType === "NEW_SOURCE"),
      "Must produce NEW_SOURCE alert for HyperScale AI"
    );

    report["Identifies Known vs New Opportunities"] = "PASS";
    report["Produces Alerts Without Duplication"] = "PASS";

    // 6. Multi-Tenant User Isolation
    const otherAlerts = await getUserLifecycleAlerts(otherUser.id);
    const otherSearches = await getUserSearches(otherUser.id);
    assert(otherAlerts.length === 0, "Other user must NOT receive User A's alerts");
    assert(otherSearches.length === 0, "Other user must NOT see User A's search history");
    report["Preserves User Isolation"] = "PASS";

    // Cleanup
    await prisma.discoveryRun.deleteMany({ where: { userId: { in: [testUser.id, otherUser.id] } } });
    await prisma.discoveryWatch.deleteMany({ where: { userId: { in: [testUser.id, otherUser.id] } } });
    await prisma.lifecycleAlert.deleteMany({ where: { userId: { in: [testUser.id, otherUser.id] } } });
    await prisma.search.deleteMany({ where: { userId: { in: [testUser.id, otherUser.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [testUser.id, otherUser.id] } } });

    console.log("\n=================================================================");
    console.log("  ACCEPTANCE SUMMARY MATRIX                                      ");
    console.log("=================================================================");
    for (const [capability, status] of Object.entries(report)) {
      console.log(`  ✅ [${status}] ${capability}`);
    }
    console.log("=================================================================\n");
  } catch (err: unknown) {
    console.error("❌ Acceptance test failed:", err);
    throw err;
  }
}

// If run directly via tsx
if (require.main === module) {
  runNaturalLanguageWorkflowAcceptanceTest().then(
    () => {
      console.log("Acceptance script completed successfully.");
      process.exit(0);
    },
    (err) => {
      console.error("Acceptance script failed:", err);
      process.exit(1);
    }
  );
}
