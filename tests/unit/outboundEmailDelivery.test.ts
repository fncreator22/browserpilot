/**
 * §TASK-020 OUTBOUND LIFECYCLEALERT EMAIL DELIVERY TESTS
 * Validates reliable, idempotent outbound email delivery for LifecycleAlert records,
 * multi-tenant user email scoping, non-destructive failure tolerance, and template correctness.
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { prisma } from "@/lib/db";
import {
  MockEmailProvider,
  OutboundEmailDispatcher,
  getEmailDispatcher,
  formatLifecycleAlertEmail,
} from "@/lib/notifications";
import {
  AutonomousDiscoveryEngine,
  type SearchProvider,
} from "@/lib/scraper";
import {
  upsertDiscoveryWatch,
  getUserLifecycleAlerts,
} from "@/lib/db/opportunities";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[TASK-020 ASSERTION FAILED]: ${msg}`);
  }
}

export async function runOutboundEmailDeliveryTests() {
  console.log("▶ [TASK-020] Running Outbound LifecycleAlert Email Delivery Tests...");

  const salt = Date.now();
  const mockEmailProvider = new MockEmailProvider();
  const dispatcher = getEmailDispatcher(mockEmailProvider);
  dispatcher.clearDeliveryCache();

  // ---------------------------------------------------------------------------
  // 1. Template Formatting & Truthful Field Rendering
  // ---------------------------------------------------------------------------
  const templateOutput = formatLifecycleAlertEmail({
    to: "candidate@browserpilot.ai",
    alertId: `alert_${salt}`,
    alertType: "NEW_OPPORTUNITY",
    subject: "",
    opportunity: {
      id: `opp_tmpl_${salt}`,
      title: "Senior AI Agent Architect",
      companyName: "Nexus Intelligence",
      location: "Hyderabad, India",
      workMode: "REMOTE",
      opportunityType: "FULL_TIME",
      matchScore: 92,
      postedAgoText: "Posted 2 hours ago",
      matchReason: "Top match on AI, Next.js, and Python skills with remote work preference.",
      primaryApplyUrl: "https://nexus.ai/careers/agent-architect",
      skills: ["AI/ML", "Next.js", "Python", "TypeScript"],
    },
    appBaseUrl: "https://browserpilot.ai",
  });

  assert(templateOutput.subject.includes("[BrowserPilot Alert] NEW OPPORTUNITY: Senior AI Agent Architect at Nexus Intelligence"), "Subject line must be formatted accurately");
  assert(templateOutput.subject.includes("(92% match)"), "Subject must include match percentage");
  assert(templateOutput.textBody.includes("Nexus Intelligence"), "Plain text body must contain company name");
  assert(templateOutput.textBody.includes("https://nexus.ai/careers/agent-architect"), "Plain text body must contain direct apply link");
  assert(templateOutput.textBody.includes("https://browserpilot.ai/app/opportunities/opp_tmpl_"), "Plain text body must contain opportunity details link");
  assert(templateOutput.htmlBody.includes("Senior AI Agent Architect"), "HTML body must contain opportunity title");
  console.log("  ✓ Verified email template formatting and rich field preservation");

  // ---------------------------------------------------------------------------
  // 2. Setup Multi-Tenant User Fixtures
  // ---------------------------------------------------------------------------
  const userAEmail = `candidate_a_${salt}@browserpilot.ai`;
  const userBEmail = `candidate_b_${salt}@browserpilot.ai`;

  const testUserA = await prisma.user.create({
    data: {
      email: userAEmail,
      name: "Candidate Alpha",
      passwordHash: "hash_test_user_a",
    },
  });

  const testUserB = await prisma.user.create({
    data: {
      email: userBEmail,
      name: "Candidate Beta",
      passwordHash: "hash_test_user_b",
    },
  });

  await upsertDiscoveryWatch(testUserA.id, {
    enabled: true,
    roles: ["Software Engineer", "AI Engineer"],
    skills: ["React", "Python"],
    locations: ["Hyderabad", "Remote"],
    workModes: ["REMOTE"],
    opportunityTypes: ["FULL_TIME", "INTERNSHIP"],
    experienceLevels: ["ENTRY_LEVEL"],
    minimumMatchScore: 70,
    scanIntervalHours: 4,
  });

  await upsertDiscoveryWatch(testUserB.id, {
    enabled: true,
    roles: ["DevOps Engineer"],
    skills: ["Kubernetes", "AWS"],
    locations: ["Bengaluru"],
    workModes: ["ON_SITE"],
    opportunityTypes: ["FULL_TIME"],
    experienceLevels: ["MID"],
    minimumMatchScore: 70,
    scanIntervalHours: 4,
  });

  const engine = new AutonomousDiscoveryEngine();

  // ---------------------------------------------------------------------------
  // 3. Scenario 1: NEW_OPPORTUNITY -> Exactly 1 Email Delivered to User A
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 1] Simulating NEW_OPPORTUNITY Discovery & Email Delivery...");
  mockEmailProvider.clear();

  const oppAlphaTitle = "AI Systems Engineer";
  const compAlpha = `Alpha Tech ${salt}`;
  const initialPostDate = new Date(Date.now() - 72 * 3600 * 1000);

  const provider1: SearchProvider = {
    name: "MockLinkedIn",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: `https://linkedin.com/jobs/view/alpha-${salt}`,
        applyUrl: `https://alpha.tech/apply/${salt}`,
        title: oppAlphaTitle,
        companyName: compAlpha,
        location: "Hyderabad, India",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        experienceLevel: "ENTRY_LEVEL",
        description: "Develop AI agents with Python, React, and Next.js.",
        rawSnippet: "Posted 3 days ago",
        discoveredAt: new Date(),
        postedAt: initialPostDate,
      } as any,
    ],
  };

  const run1 = await engine.runAutonomousDiscoveryForUser(testUserA.id, {
    customProviders: [provider1],
    customEmailProvider: mockEmailProvider,
    forceScan: true,
  });

  assert(run1.status === "SUCCESS", "Run 1 must succeed");
  assert(run1.telemetry.newOpportunities === 1, "Must detect 1 NEW_OPPORTUNITY");
  assert(run1.telemetry.notificationsCreated === 1, "Must create 1 LifecycleAlert");
  assert(run1.telemetry.emailsDelivered === 1, "Must deliver exactly 1 outbound email");
  assert(mockEmailProvider.sentEmails.length === 1, "Mock provider must record 1 sent email");
  assert(mockEmailProvider.sentEmails[0].to === userAEmail, "Email recipient must strictly be User A");
  assert(mockEmailProvider.sentEmails[0].alertType === "NEW_OPPORTUNITY", "Email alert type must be NEW_OPPORTUNITY");
  assert(mockEmailProvider.sentEmails[0].opportunity.title === oppAlphaTitle, "Email must contain correct job title");
  console.log("  ✓ Verified NEW_OPPORTUNITY -> exactly 1 email delivered to User A");

  // Backdate firstSeenAt to initialPostDate (3 days ago) to test reposting delta
  const canonicalHash = run1.discoveredOpportunities[0].opportunity.canonicalHash;
  await prisma.opportunity.update({
    where: { canonicalHash },
    data: { firstSeenAt: initialPostDate },
  });

  // ---------------------------------------------------------------------------
  // 4. Scenario 2: Repeat Scan (ALREADY_KNOWN) -> 0 Duplicate Emails
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 2] Simulating Repeat Scan (ALREADY_KNOWN) -> Zero Duplicate Emails...");
  mockEmailProvider.clear();

  const run2 = await engine.runAutonomousDiscoveryForUser(testUserA.id, {
    customProviders: [provider1], // Same candidate & source
    customEmailProvider: mockEmailProvider,
    forceScan: true,
  });

  assert(run2.telemetry.alreadyKnown === 1, "Must classify as ALREADY_KNOWN");
  assert(run2.telemetry.notificationsCreated === 0, "Zero new notifications created");
  assert(run2.telemetry.emailsDelivered === 0, "Zero emails delivered on repeat scan");
  assert(mockEmailProvider.sentEmails.length === 0, "Zero email dispatches recorded (Zero Spam)");
  console.log("  ✓ Verified ALREADY_KNOWN -> 0 duplicate emails generated");

  // ---------------------------------------------------------------------------
  // 5. Scenario 3: NEW_SOURCE -> 1 New Email Delivered
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 3] Simulating NEW_SOURCE Discovery & Email Delivery...");
  mockEmailProvider.clear();

  const provider3: SearchProvider = {
    name: "MockIndeed",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "Indeed", // New platform source for Alpha Tech
        sourceUrl: `https://indeed.com/viewjob?jk=alpha-indeed-${salt}`,
        applyUrl: `https://alpha.tech/apply/${salt}`,
        title: oppAlphaTitle,
        companyName: compAlpha,
        location: "Hyderabad, India",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        experienceLevel: "ENTRY_LEVEL",
        description: "Develop AI agents with Python, React, and Next.js.",
        rawSnippet: "Posted 1 hour ago",
        discoveredAt: new Date(),
        postedAt: initialPostDate,
      } as any,
    ],
  };

  const run3 = await engine.runAutonomousDiscoveryForUser(testUserA.id, {
    customProviders: [provider3],
    customEmailProvider: mockEmailProvider,
    forceScan: true,
  });

  assert(run3.telemetry.newSources === 1, "Must classify as NEW_SOURCE");
  assert(run3.telemetry.notificationsCreated === 1, "Must create notification for NEW_SOURCE");
  assert(run3.telemetry.emailsDelivered === 1, "Must deliver email for NEW_SOURCE");
  assert(mockEmailProvider.sentEmails.length === 1, "Mock provider must record 1 email");
  assert(mockEmailProvider.sentEmails[0].alertType === "NEW_SOURCE", "Alert type must be NEW_SOURCE");
  console.log("  ✓ Verified NEW_SOURCE -> 1 email delivered");

  // ---------------------------------------------------------------------------
  // 6. Scenario 4: REPOSTED -> 1 New Email Delivered
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 4] Simulating REPOSTED Discovery & Email Delivery...");
  mockEmailProvider.clear();

  const freshRepostDate = new Date(); // Posted today (>24h newer than initialPostDate)

  const provider4: SearchProvider = {
    name: "MockLinkedIn",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: `https://linkedin.com/jobs/view/alpha-${salt}`,
        applyUrl: `https://alpha.tech/apply/${salt}`,
        title: oppAlphaTitle,
        companyName: compAlpha,
        location: "Hyderabad, India",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        experienceLevel: "ENTRY_LEVEL",
        description: "Develop AI agents with Python, React, and Next.js.",
        rawSnippet: "Reposted 10 minutes ago",
        discoveredAt: new Date(),
        postedAt: freshRepostDate,
      } as any,
    ],
  };

  const run4 = await engine.runAutonomousDiscoveryForUser(testUserA.id, {
    customProviders: [provider4],
    customEmailProvider: mockEmailProvider,
    forceScan: true,
  });

  assert(run4.telemetry.reposted === 1, "Must classify as REPOSTED");
  assert(run4.telemetry.notificationsCreated === 1, "Must create notification for REPOSTED");
  assert(run4.telemetry.emailsDelivered === 1, "Must deliver email for REPOSTED");
  assert(mockEmailProvider.sentEmails.length === 1, "Mock provider must record 1 email");
  assert(mockEmailProvider.sentEmails[0].alertType === "REPOSTED", "Alert type must be REPOSTED");
  console.log("  ✓ Verified REPOSTED -> 1 email delivered");

  // ---------------------------------------------------------------------------
  // 7. Scenario 5: Email Provider Failure -> LifecycleAlert Remains Persisted
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 5] Verifying Email Failure Non-Destructive Tolerance...");
  mockEmailProvider.clear();
  mockEmailProvider.shouldFail = true;

  const oppBetaTitle = "Full Stack Engineer";
  const compBeta = `Beta Cloud ${salt}`;

  const provider5: SearchProvider = {
    name: "MockYCombinator",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "Y Combinator",
        sourceUrl: `https://workatastartup.com/companies/beta-${salt}`,
        applyUrl: `https://beta.cloud/apply/${salt}`,
        title: oppBetaTitle,
        companyName: compBeta,
        location: "Remote, India",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        experienceLevel: "ENTRY_LEVEL",
        description: "Full stack developer opening with Next.js and Python.",
        rawSnippet: "Posted 5 minutes ago",
        discoveredAt: new Date(),
        postedAt: new Date(),
      } as any,
    ],
  };

  const run5 = await engine.runAutonomousDiscoveryForUser(testUserA.id, {
    customProviders: [provider5],
    customEmailProvider: mockEmailProvider,
    forceScan: true,
  });

  assert(run5.status === "SUCCESS", "Run must complete successfully even if email dispatch fails");
  assert(run5.telemetry.newOpportunities === 1, "Must detect 1 NEW_OPPORTUNITY");
  assert(run5.telemetry.notificationsCreated === 1, "Must create LifecycleAlert in database");
  assert(run5.telemetry.emailsFailed === 1, "Must record 1 failed email in telemetry");

  // Check that the LifecycleAlert was NOT deleted or rolled back in database
  const alertsUserA = await getUserLifecycleAlerts(testUserA.id);
  const betaAlert = alertsUserA.find((a) => a.companyName === compBeta);
  assert(betaAlert !== undefined, "LifecycleAlert must remain safely persisted in DB despite email failure");
  assert(betaAlert!.title === oppBetaTitle, "Persisted alert must retain accurate title");
  console.log("  ✓ Verified email transmission failure is non-destructive (DB LifecycleAlert remains safe)");

  // ---------------------------------------------------------------------------
  // 8. Scenario 6: Multi-Tenant Email Recipient Isolation
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 6] Verifying Multi-Tenant Email Recipient Isolation...");
  mockEmailProvider.clear();
  mockEmailProvider.shouldFail = false;

  const oppDevOpsTitle = "Site Reliability Engineer";
  const compDevOps = `DevOps Systems ${salt}`;

  const providerUserB: SearchProvider = {
    name: "MockLinkedIn",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: `https://linkedin.com/jobs/view/devops-${salt}`,
        applyUrl: `https://devops.systems/apply/${salt}`,
        title: oppDevOpsTitle,
        companyName: compDevOps,
        location: "Bengaluru, India",
        workMode: "ON_SITE",
        opportunityType: "FULL_TIME",
        experienceLevel: "MID",
        description: "Maintain Kubernetes clusters and AWS infrastructure.",
        rawSnippet: "Posted 30 minutes ago",
        discoveredAt: new Date(),
        postedAt: new Date(),
      } as any,
    ],
  };

  const runUserB = await engine.runAutonomousDiscoveryForUser(testUserB.id, {
    customProviders: [providerUserB],
    customEmailProvider: mockEmailProvider,
    forceScan: true,
  });

  assert(runUserB.telemetry.emailsDelivered === 1, "User B must receive 1 email");
  assert(mockEmailProvider.sentEmails.length === 1, "Mock provider recorded 1 email");
  assert(mockEmailProvider.sentEmails[0].to === userBEmail, "Recipient must strictly be User B");
  assert(mockEmailProvider.sentEmails[0].to !== userAEmail, "User A must NEVER receive User B's alert");
  assert(mockEmailProvider.sentEmails[0].opportunity.title === oppDevOpsTitle, "User B email must contain User B's matched role");
  console.log("  ✓ Verified multi-tenant email isolation (User A never receives User B's alert)");

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  await prisma.discoveryWatch.deleteMany({ where: { userId: { in: [testUserA.id, testUserB.id] } } });
  await prisma.lifecycleAlert.deleteMany({ where: { userId: { in: [testUserA.id, testUserB.id] } } });
  await prisma.discoveryRun.deleteMany({ where: { userId: { in: [testUserA.id, testUserB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [testUserA.id, testUserB.id] } } });

  console.log("✓ [TASK-020] All Outbound LifecycleAlert Email Delivery Tests Passed!\n");
}

if (require.main === module) {
  runOutboundEmailDeliveryTests().then(
    () => process.exit(0),
    (err) => {
      console.error("Test failed:", err);
      process.exit(1);
    }
  );
}
