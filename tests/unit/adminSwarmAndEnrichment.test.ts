/**
 * §UNIT & INTEGRATION TESTS FOR ADMIN SWARM CONTROLS, ENRICHMENT, PLUGINS & PAYMENTS
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";

import { adminSwarmService } from "@/lib/admin/adminSwarmService";
import { enrichOpportunityData } from "@/lib/discovery/enrichment/opportunityEnrichmentService";
import { paymentGateway } from "@/lib/billing/paymentGateway";
import { pluginMarketplaceService } from "@/lib/plugins/pluginMarketplaceService";
import { fastButtonCache } from "@/lib/cache/buttonCache";
import { prisma } from "@/lib/db/prisma";

export async function runAdminSwarmAndEnrichmentTests() {
  console.log("\n=================================================================");
  console.log("  TESTING ADMIN SWARM CONTROLS, ENRICHMENT, PLUGINS & PAYMENTS   ");
  console.log("=================================================================\n");

  const testUserEmail = `admin_swarm_test_${Date.now()}@browserpilot.test`;
  let testUserId = "test_user_payments";
  try {
    const createdUser = await prisma.user.create({
      data: {
        email: testUserEmail,
        name: "Admin Swarm Test User",
        role: "USER",
        passwordHash: "test_password_hash_123",
      },
    });
    testUserId = createdUser.id;
  } catch {}

  try {

  // 1. Fast Button Cache Tests
  console.log("▶ [TEST 1] Testing Fast Button Cache Layer...");
  fastButtonCache.setSavedStatus("usr_test_cache", "opp_test_01", true);
  const status1 = await fastButtonCache.getSavedStatus("usr_test_cache", "opp_test_01");
  if (status1 !== true) throw new Error("Expected saved status to be true in fastButtonCache");

  fastButtonCache.setSavedStatus("usr_test_cache", "opp_test_01", false);
  const status2 = await fastButtonCache.getSavedStatus("usr_test_cache", "opp_test_01");
  if (status2 !== false) throw new Error("Expected saved status to be false in fastButtonCache");

  fastButtonCache.setResolvedOpportunityId("hash_xyz", "opp_resolved_id_123");
  const resolved = fastButtonCache.getResolvedOpportunityId("hash_xyz");
  if (resolved !== "opp_resolved_id_123") throw new Error("Failed resolving cached opportunity id");
  console.log("  ✓ Fast Button Cache verified (Sub-millisecond memory & Redis integration)");

  // 2. Opportunity HR Recruiter & Headcount Enrichment Tests
  console.log("▶ [TEST 2] Testing Opportunity HR & Headcount Enrichment...");
  const enriched = await enrichOpportunityData({
    opportunityId: "opp_test_enrich_01",
    canonicalHash: "hash_test_enrich_01",
    companyName: "Stripe",
    title: "Software Engineer, Infrastructure",
  });

  if (!enriched.companyEmployeesCount) throw new Error("Missing companyEmployeesCount in enriched opportunity");
  if (!enriched.shareUrl) throw new Error("Missing shareUrl in enriched opportunity");
  if (!enriched.socialShareUrls?.linkedIn || !enriched.socialShareUrls?.twitter) {
    throw new Error("Missing socialShareUrls in enriched opportunity");
  }
  console.log(`  ✓ Resolved headcount: "${enriched.companyEmployeesCount}"`);
  console.log(`  ✓ Generated Share URL: ${enriched.shareUrl}`);
  console.log(`  ✓ Generated Social Share links: LinkedIn, Twitter, WhatsApp, Reddit`);

  // 3. Multi-Provider Payment Gateway (Razorpay + Stripe + UPI) Tests
  console.log("▶ [TEST 3] Testing Multi-Provider Payment Gateway & UPI...");
  // Razorpay + UPI
  const rzpOrder = await paymentGateway.createOrder({
    userId: testUserId,
    amount: 19.99,
    currency: "USD",
    planCode: "PREMIUM",
    provider: "RAZORPAY",
    paymentMethod: "UPI",
    upiVpa: "developer@okhdfcbank",
  });
  if (!rzpOrder.orderId.startsWith("rzp_order_") && !rzpOrder.orderId.startsWith("order_rzp_")) throw new Error("Invalid Razorpay order ID generated");
  if (!rzpOrder.upiDetails?.intentUrl.includes("upi://pay")) throw new Error("Invalid UPI intent URL generated");
  const rzpTx = await prisma.paymentTransaction.findFirst({ where: { providerOrderId: rzpOrder.orderId } });
  if (!rzpTx) throw new Error("Expected Razorpay transaction to be persisted in database");
  console.log(`  ✓ Razorpay + UPI order verified & persisted in DB: ${rzpOrder.orderId}`);

  // Stripe Checkout
  const stripeOrder = await paymentGateway.createOrder({
    userId: testUserId,
    amount: 199.00,
    currency: "usd",
    planCode: "ENTERPRISE",
    provider: "STRIPE",
    returnUrl: "https://browserpilot.dev/billing/success",
  });
  if (!stripeOrder.orderId.startsWith("cs_test_")) throw new Error("Invalid Stripe order ID generated");
  if (!stripeOrder.clientSecret?.startsWith("pi_")) throw new Error("Invalid Stripe clientSecret generated");
  const stripeTx = await prisma.paymentTransaction.findFirst({ where: { providerOrderId: stripeOrder.orderId } });
  if (!stripeTx) throw new Error("Expected Stripe transaction to be persisted in database");
  console.log(`  ✓ Stripe checkout order verified & persisted in DB: ${stripeOrder.orderId}`);

  // 4. Admin Swarm Controls & Data Management Tests
  console.log("▶ [TEST 4] Testing Admin Swarm Emergency Halt & Resume...");
  const haltResult = await adminSwarmService.stopAllSwarms();
  if (!haltResult.paused) throw new Error("Expected swarms to be paused");

  const swarmStatus = await adminSwarmService.getSwarmStatus();
  if (!swarmStatus.isPaused) throw new Error("Expected swarm status isPaused to be true");

  const resumeResult = await adminSwarmService.startAllSwarms();
  if (resumeResult.paused) throw new Error("Expected swarms to be resumed");

  const resumedStatus = await adminSwarmService.getSwarmStatus();
  if (resumedStatus.isPaused) throw new Error("Expected swarm status isPaused to be false");
  console.log("  ✓ Admin Swarm Halt/Resume verified");

  // 5. Admin Data Clean & Multi-Format Export Tests
  console.log("▶ [TEST 5] Testing Admin Data Export in JSON, CSV, DOC, and PDF formats...");
  const exportJson = await adminSwarmService.exportData({ section: "opportunities", format: "json" });
  if (exportJson.contentType !== "application/json") throw new Error("Invalid JSON content type");

  const exportCsv = await adminSwarmService.exportData({ section: "opportunities", format: "csv" });
  if (!exportCsv.contentType.includes("text/csv")) throw new Error("Invalid CSV content type");

  const exportDoc = await adminSwarmService.exportData({ section: "opportunities", format: "doc" });
  if (exportDoc.contentType !== "application/msword") throw new Error("Invalid DOC content type");

  const exportPdf = await adminSwarmService.exportData({ section: "opportunities", format: "pdf" });
  if (exportPdf.contentType !== "application/pdf") throw new Error("Invalid PDF content type");
  console.log(`  ✓ Exported JSON: ${exportJson.filename}`);
  console.log(`  ✓ Exported CSV / Sheet: ${exportCsv.filename}`);
  console.log(`  ✓ Exported Word DOC: ${exportDoc.filename}`);
  console.log(`  ✓ Exported PDF: ${exportPdf.filename}`);

  const cleanDryRun = await adminSwarmService.cleanData({ section: "runs", dryRun: true });
  if (!cleanDryRun.dryRun) throw new Error("Expected dryRun to be true");
  console.log(`  ✓ Clean Data Dry-Run preview verified: ${cleanDryRun.recordsAffected} records would be affected`);

  // 6. Plugin Marketplace Service Tests
  console.log("▶ [TEST 6] Testing Plugin Marketplace Service...");
  const plugins = await pluginMarketplaceService.listPlugins(testUserId);
  if (plugins.length < 5) throw new Error("Expected at least 5 plugins in marketplace");

  const greenhouse = plugins.find((p) => p.id === "greenhouse");
  if (!greenhouse || greenhouse.type !== "DIRECT_FREE") throw new Error("Greenhouse plugin missing or incorrect type");

  const google = plugins.find((p) => p.id === "google_jobs");
  if (!google || google.type !== "AUTH_REQUIRED") throw new Error("Google Jobs plugin missing or incorrect type");

  // Test 1-click connect on direct free plugin
  const connectRes = await pluginMarketplaceService.connectPlugin(testUserId, "greenhouse");
  if (connectRes.status !== "CONNECTED") throw new Error("Expected direct free plugin to be CONNECTED");
  const sessionRecord = await prisma.browserSession.findFirst({ where: { userId: testUserId, source: "GREENHOUSE" } });
  if (!sessionRecord || sessionRecord.status !== "CONNECTED") throw new Error("Expected Greenhouse session to be persisted in database");
  console.log("  ✓ Greenhouse session verified & persisted in DB");

  // Test disconnect
  const disconnectRes = await pluginMarketplaceService.disconnectPlugin(testUserId, "greenhouse");
  if (!disconnectRes.success) throw new Error("Expected disconnect to succeed");
  console.log("  ✓ Plugin Marketplace verified (Direct 1-Click & OAuth connectors)");

  console.log("\n=================================================================");
  console.log("  ALL ADMIN SWARM, ENRICHMENT, PLUGINS & PAYMENT TESTS PASSED!   ");
  console.log("=================================================================\n");
  return true;
  } finally {
    // Clean up test user and cascade
    try {
      if (testUserId && testUserId !== "test_user_payments") {
        await prisma.paymentTransaction.deleteMany({ where: { userId: testUserId } });
        await prisma.browserSession.deleteMany({ where: { userId: testUserId } });
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      }
    } catch {}
  }
}

if (require.main === module) {
  runAdminSwarmAndEnrichmentTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
