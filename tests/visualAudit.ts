import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/db/prisma";

const ARTIFACTS_DIR = "C:/Users/sr2ma/.gemini/antigravity/brain/fc848437-18d8-4bb3-8bc1-c9038e6941fe";
const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=================================================");
  console.log("  FULL-STACK VISUAL & UI/UX AUDIT VERIFIER       ");
  console.log("=================================================\n");

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  // 1. Ensure test user exists with known credentials
  const testEmail = "visual-auditor@browserpilot.ai";
  const rawPassword = "AuditPassword2026!";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  console.log("[Setup] Preparing test user in database...");
  const testUser = await prisma.user.upsert({
    where: { email: testEmail },
    create: {
      name: "Lead UI Auditor",
      email: testEmail,
      passwordHash,
      role: "ADMIN",
    },
    update: {
      passwordHash,
      role: "ADMIN",
    },
  });

  const secret = process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars";
  const sessionToken = await encode({
    token: {
      id: testUser.id,
      name: testUser.name || "Lead UI Auditor",
      email: testUser.email,
      role: testUser.role || "ADMIN",
      sub: testUser.id,
    },
    secret,
  });
  console.log("[Setup] Generated NextAuth session token.");

  // Also ensure at least one opportunity exists for dossier verification
  let opp = await prisma.opportunity.findFirst();
  if (!opp) {
    opp = await prisma.opportunity.create({
      data: {
        title: "Senior Full-Stack Architect (Next.js & AI)",
        companyName: "Stripe",
        location: "Remote",
        workMode: "REMOTE",
        experienceLevel: "SENIOR",
        primaryApplyUrl: "https://stripe.com/jobs/senior-fullstack",
        description: "Leading frontend and autonomous browser execution pipelines using Next.js, React 19, and distributed AI agents.",
        requirements: JSON.stringify(["7+ years React & TypeScript", "Distributed Systems", "PostgreSQL"]),
        skills: JSON.stringify(["React", "TypeScript", "Next.js", "Tailwind CSS", "PostgreSQL"]),
        canonicalHash: "hash_stripe_senior_fs_01",
      },
    });
  }
  const oppId = opp.id;
  console.log(`[Setup] Target test opportunity ID: ${oppId}`);

  // Launch Playwright Browser
  const browser = await chromium.launch({ headless: true });

  // ----------------------------------------------------
  // VIEWPORT 1: Desktop (1440x900)
  // ----------------------------------------------------
  console.log("\n[Audit] 1. Auditing Desktop Viewport (1440x900)...");
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();

  // 1. Login Page
  console.log("  -> Visiting /login");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_01_login_desktop.png"), fullPage: true });

  // 2. Signup Page
  console.log("  -> Visiting /signup");
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_02_signup_desktop.png"), fullPage: true });

  // 3. Inject Session Token into desktop context
  console.log("  -> Injecting NextAuth session cookie for authenticated views...");
  await desktopContext.addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  // 4. User Dashboard (/app)
  console.log("  -> Visiting /app (Dashboard)");
  await page.goto(`${BASE_URL}/app`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_03_dashboard_desktop.png"), fullPage: true });

  // 5. Test Search Capsule Hover & Focus States
  console.log("  -> Testing Search Capsule Hover & Glowing Focus...");
  const searchInput = page.locator('textarea, input[placeholder*="Search"], input[placeholder*="Find"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.hover();
    await searchInput.focus();
    await searchInput.fill("Staff Frontend Engineer in Bangalore");
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_04_search_capsule_active.png") });
  }

  // 6. Test (i) InfoBadge Popover Interaction
  console.log("  -> Testing (i) InfoBadge Progressive Disclosure Popover...");
  const infoBadges = page.locator('button:has-text("ⓘ"), button[aria-label*="info" i], .info-badge, [data-testid="info-badge"]');
  const count = await infoBadges.count();
  if (count > 0) {
    await infoBadges.first().click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_05_infobadge_popover_open.png") });
  }

  // 7. Autonomous Watch Page (/app/watch)
  console.log("  -> Visiting /app/watch");
  await page.goto(`${BASE_URL}/app/watch`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_06_watch_desktop.png"), fullPage: true });

  // 8. Search History (/app/history)
  console.log("  -> Visiting /app/history");
  await page.goto(`${BASE_URL}/app/history`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_07_history_desktop.png"), fullPage: true });

  // 9. Saved Opportunities (/app/saved)
  console.log("  -> Visiting /app/saved");
  await page.goto(`${BASE_URL}/app/saved`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_08_saved_desktop.png"), fullPage: true });

  // 10. Notifications Feed (/app/notifications)
  console.log("  -> Visiting /app/notifications");
  await page.goto(`${BASE_URL}/app/notifications`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_09_notifications_desktop.png"), fullPage: true });

  // 11. Multi-Gateway Checkout (/app/checkout)
  console.log("  -> Visiting /app/checkout");
  await page.goto(`${BASE_URL}/app/checkout?plan=pro&interval=monthly`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_10_checkout_desktop.png"), fullPage: true });

  // 12. Opportunity Dossier (/app/opportunities/[id])
  console.log(`  -> Visiting /app/opportunities/${oppId}`);
  await page.goto(`${BASE_URL}/app/opportunities/${oppId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_11_opportunity_dossier_desktop.png"), fullPage: true });

  // 13. Admin Observatory Overview (/ops-sec-7f9c2d1b8e4a)
  console.log("  -> Visiting /ops-sec-7f9c2d1b8e4a (Admin Overview)");
  await page.goto(`${BASE_URL}/ops-sec-7f9c2d1b8e4a?admin_key=dev-admin-secret`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_12_admin_overview_desktop.png"), fullPage: true });

  // 14. Admin Agentic Observatory (/ops-sec-7f9c2d1b8e4a/agentic)
  console.log("  -> Visiting /ops-sec-7f9c2d1b8e4a/agentic");
  await page.goto(`${BASE_URL}/ops-sec-7f9c2d1b8e4a/agentic?admin_key=dev-admin-secret`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_13_admin_agentic_desktop.png"), fullPage: true });

  // 15. Admin Discovery Runs (/ops-sec-7f9c2d1b8e4a/runs)
  console.log("  -> Visiting /ops-sec-7f9c2d1b8e4a/runs");
  await page.goto(`${BASE_URL}/ops-sec-7f9c2d1b8e4a/runs?admin_key=dev-admin-secret`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_14_admin_runs_desktop.png"), fullPage: true });

  // 16. Admin Users & Quotas (/ops-sec-7f9c2d1b8e4a/users)
  console.log("  -> Visiting /ops-sec-7f9c2d1b8e4a/users");
  await page.goto(`${BASE_URL}/ops-sec-7f9c2d1b8e4a/users?admin_key=dev-admin-secret`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_15_admin_users_desktop.png"), fullPage: true });

  // 17. Admin Universal Audit Logs (/ops-sec-7f9c2d1b8e4a/logs)
  console.log("  -> Visiting /ops-sec-7f9c2d1b8e4a/logs (Universal Audit Log)");
  await page.goto(`${BASE_URL}/ops-sec-7f9c2d1b8e4a/logs?admin_key=dev-admin-secret`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_20_admin_logs_desktop.png"), fullPage: true });

  // 18. Security & Trust (/security)
  console.log("  -> Visiting /security");
  await page.goto(`${BASE_URL}/security`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_21_security_desktop.png"), fullPage: true });

  // Save authenticated state for mobile context
  const storageState = await desktopContext.storageState();
  await desktopContext.close();

  // ----------------------------------------------------
  // VIEWPORT 2: Mobile Touch Viewport (375x812 - iPhone X/12/14)
  // ----------------------------------------------------
  console.log("\n[Audit] 2. Auditing Mobile Touch Viewport (375x812)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    storageState,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  });
  const mobilePage = await mobileContext.newPage();

  // Mobile Dashboard with Bottom Dock
  console.log("  -> Visiting /app on Mobile (checking DaisyUI Bottom Dock)");
  await mobilePage.goto(`${BASE_URL}/app`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_16_dashboard_mobile_375.png"), fullPage: true });

  // Mobile Watch Page
  console.log("  -> Visiting /app/watch on Mobile");
  await mobilePage.goto(`${BASE_URL}/app/watch`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_17_watch_mobile_375.png"), fullPage: true });

  // Mobile Checkout
  console.log("  -> Visiting /app/checkout on Mobile");
  await mobilePage.goto(`${BASE_URL}/app/checkout?plan=pro&interval=monthly`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_18_checkout_mobile_375.png"), fullPage: true });

  // Mobile Opportunity Dossier
  console.log(`  -> Visiting /app/opportunities/${oppId} on Mobile`);
  await mobilePage.goto(`${BASE_URL}/app/opportunities/${oppId}`, { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, "audit_19_opportunity_dossier_mobile_375.png"), fullPage: true });

  await mobileContext.close();
  await browser.close();

  console.log("\n=================================================");
  console.log("  ALL 19 AUDIT SCREENSHOTS CAPTURED SUCCESSFULLY! ");
  console.log("=================================================");
  console.log(`Screenshots saved to: ${ARTIFACTS_DIR}`);
}

main()
  .catch((err) => {
    console.error("Visual Audit Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
