import assert from "assert";
import http from "http";
import { 
  monitorSavedOpportunitiesForUser, 
  monitorAllSavedOpportunities 
} from "@/lib/scraper/savedOpportunityMonitor";
import { 
  upsertOpportunity, 
  upsertSourceListing, 
  saveOpportunity, 
  recordLifecycleAlert, 
  getUserLifecycleAlerts, 
  markAlertAsRead, 
  markAllAlertsAsRead, 
  getUnreadAlertCount 
} from "@/lib/db/opportunities";
import { prisma } from "@/lib/db/prisma";

export async function runSavedOpportunityMonitoringIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Saved Opportunity Monitoring & Lifecycle Alerts Tests (TASK-010)...");

  // 1. Setup Local Mock HTTP Fixture Server
  let activeHitCount = 0;
  let expiredHitCount = 0;

  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/mon-active-job") {
      activeHitCount++;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Senior Distributed Systems Engineer - Apex AI</title></head>
          <body>
            <h1>Senior Distributed Systems Engineer</h1>
            <p>About the role: Build ultra-reliable distributed workflows and high-throughput agent platforms.</p>
            <p>Responsibilities: Design fault-tolerant consensus systems, optimize memory footprint, build bounded web execution engines.</p>
            <p>Requirements: 5+ years of experience with TypeScript, Node.js, and low-latency distributed databases.</p>
            <button id="apply-btn">Apply Now</button>
          </body>
        </html>
      `);
    } else if (url === "/mon-expired-job") {
      expiredHitCount++;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Position Closed - Acme Corp</title></head>
          <body>
            <h1>Position Closed</h1>
            <p>This job has expired and the position has been filled. Thank you for your interest.</p>
          </body>
        </html>
      `);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const serverAddress = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${serverAddress.port}`;

  try {
    // 1.1 Clean up any existing saved opportunity records from prior runs
    await prisma.savedOpportunity.deleteMany();

    // 2. Create Distinct Test Tenants
    const tenantA = await prisma.user.create({
      data: {
        email: `tenant-mon-a-${Date.now()}@mon.ai`,
        name: "Monitoring Tenant A",
        passwordHash: "dummy-hash",
      },
    });

    const tenantB = await prisma.user.create({
      data: {
        email: `tenant-mon-b-${Date.now()}@mon.ai`,
        name: "Monitoring Tenant B",
        passwordHash: "dummy-hash",
      },
    });

    // 3. Create Test Opportunities
    // Opp 1: Fresh Opportunity (lastVerifiedAt = now)
    const freshOpp = await upsertOpportunity({
      canonicalHash: `fresh_opp_${Date.now()}`,
      title: "Senior Distributed Systems Engineer",
      companyName: "Apex AI",
      location: "San Francisco, CA",
      workMode: "HYBRID",
      description: "Build ultra-reliable distributed workflows",
      primaryApplyUrl: `${baseUrl}/mon-active-job`,
      status: "ACTIVE",
      lastVerifiedAt: new Date(), // Fresh!
    });

    await upsertSourceListing({
      opportunityId: freshOpp.id,
      sourcePlatform: "YC",
      sourceUrl: `${baseUrl}/mon-active-job`,
      applyUrl: `${baseUrl}/mon-active-job`,
      verificationStatus: "VERIFIED",
    });

    // Opp 2: Stale Opportunity that has Expired
    const staleOpp = await upsertOpportunity({
      canonicalHash: `stale_opp_${Date.now()}`,
      title: "Full Stack Engineer",
      companyName: "Acme Corp",
      location: "Remote",
      workMode: "REMOTE",
      description: "Build user interfaces",
      primaryApplyUrl: `${baseUrl}/mon-expired-job`,
      status: "ACTIVE", // Currently ACTIVE in DB, but web page is now EXPIRED
      lastVerifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 48h stale!
    });

    await upsertSourceListing({
      opportunityId: staleOpp.id,
      sourcePlatform: "LinkedIn",
      sourceUrl: `${baseUrl}/mon-expired-job`,
      applyUrl: `${baseUrl}/mon-expired-job`,
      verificationStatus: "UNVERIFIED",
    });

    // Save both opportunities to Tenant A
    await saveOpportunity(tenantA.id, freshOpp.id, "Top target");
    await saveOpportunity(tenantA.id, staleOpp.id, "Secondary target");

    // 4. Test Monitoring Run 1: Fresh skipping + Stale revalidation + Lifecycle Alert generation
    activeHitCount = 0;
    expiredHitCount = 0;

    const run1 = await monitorSavedOpportunitiesForUser(tenantA.id, {
      ttlMs: 24 * 60 * 60 * 1000,
      allowLocalForTests: true,
      force: false,
    });

    assert.strictEqual(run1.telemetry.scanned, 2, "Must scan all 2 saved opportunities");
    assert.strictEqual(run1.telemetry.freshSkipped, 1, "Must skip fresh opportunity (0 browser launches)");
    assert.strictEqual(run1.telemetry.staleCandidates, 1, "Must revalidate exactly 1 stale opportunity");
    assert.strictEqual(run1.telemetry.expired, 1, "Must detect expired source listing");
    assert.strictEqual(run1.telemetry.notificationsGenerated, 1, "Must generate exactly 1 lifecycle alert for ACTIVE -> EXPIRED transition");
    assert.strictEqual(activeHitCount, 0, "Zero HTTP hits to fresh candidate");
    assert.strictEqual(expiredHitCount, 1, "Exactly 1 HTTP hit to stale expired candidate");
    console.log("  ✓ Verified fresh skipping (0 browser hits) and stale candidate revalidation");
    console.log("  ✓ Verified ACTIVE -> EXPIRED lifecycle transition detection and alert creation");

    // 5. Test Notification Deduplication (Run 2 on unchanged state)
    const run2 = await monitorSavedOpportunitiesForUser(tenantA.id, {
      ttlMs: 24 * 60 * 60 * 1000,
      allowLocalForTests: true,
      force: true, // Force revalidation to test alert deduplication logic
    });

    assert.strictEqual(run2.telemetry.notificationsGenerated, 0, "Must NOT generate duplicate alert when state remains EXPIRED");
    assert.strictEqual(run2.telemetry.notificationsDeduplicated, 1, "Must track deduplicated alert in telemetry");
    console.log("  ✓ Verified deterministic notification deduplication (zero alert spam on repeated runs)");

    // 6. Test Multi-Tenant Notification Isolation & IDOR Protection
    const alertsA = await getUserLifecycleAlerts(tenantA.id);
    const alertsB = await getUserLifecycleAlerts(tenantB.id);

    assert.strictEqual(alertsA.length, 1, "Tenant A must have 1 alert");
    assert.strictEqual(alertsB.length, 0, "Tenant B must have 0 alerts (strict tenant isolation)");

    const alertIdA = alertsA[0].id;
    assert.strictEqual(alertsA[0].isRead, false, "Alert should start unread");

    // Tenant B attempts to mark Tenant A's alert as read (IDOR attack)
    const crossTenantRead = await markAlertAsRead(alertIdA, tenantB.id);
    assert.strictEqual(crossTenantRead, false, "Cross-tenant unauthorized alert update must be rejected");

    // Tenant A legitimately marks alert as read
    const legitimateRead = await markAlertAsRead(alertIdA, tenantA.id);
    assert.strictEqual(legitimateRead, true, "Tenant A marking own alert as read must succeed");

    const unreadCountA = await getUnreadAlertCount(tenantA.id);
    assert.strictEqual(unreadCountA, 0, "Unread count must be 0 after marking read");
    console.log("  ✓ Verified multi-tenant notification isolation and IDOR protection");

    // 7. Test Bulk Notification Read State
    await recordLifecycleAlert({
      userId: tenantA.id,
      opportunityId: freshOpp.id,
      transitionType: "RECOVERED_ACTIVE",
      previousStatus: "EXPIRED",
      newStatus: "ACTIVE",
      title: freshOpp.title,
      companyName: freshOpp.companyName,
      message: "Verified active listing rediscovered",
      idempotencyKey: `recovery_test_${Date.now()}`,
    });

    const unreadBeforeBulk = await getUnreadAlertCount(tenantA.id);
    assert.strictEqual(unreadBeforeBulk, 1);

    const markedCount = await markAllAlertsAsRead(tenantA.id);
    assert.strictEqual(markedCount, 1);

    const unreadAfterBulk = await getUnreadAlertCount(tenantA.id);
    assert.strictEqual(unreadAfterBulk, 0);
    console.log("  ✓ Verified bulk mark-all-as-read functionality");

    // 8. Test Global Background Monitor Execution
    const globalResult = await monitorAllSavedOpportunities({
      ttlMs: 24 * 60 * 60 * 1000,
      allowLocalForTests: true,
      force: false,
    });

    assert.ok(globalResult.usersProcessed >= 1, "Global monitor must process distinct saved users");
    assert.ok(globalResult.totalTelemetry.scanned >= 2, "Global monitor telemetry must aggregate metrics");
    console.log("  ✓ Verified background monitoring entry point and global telemetry aggregation");

  } finally {
    server.close();
    await prisma.savedOpportunity.deleteMany();
    await prisma.lifecycleAlert.deleteMany();
    await prisma.sourceListing.deleteMany();
    await prisma.opportunity.deleteMany();
  }

  console.log("✓ [INTEGRATION] Saved Opportunity Monitoring Tests Passed!\n");
}
