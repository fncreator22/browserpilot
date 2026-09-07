import { chromium } from "playwright";
import { prisma } from "../lib/db/prisma";
import { encode } from "next-auth/jwt";
import * as path from "path";

async function setupTestData(userId: string) {
  console.log(`[Setup] Setting up genuine Stripe opportunities for user ${userId}...`);

  await prisma.search.updateMany({
    where: {
      userId,
      status: { in: ["RUNNING", "QUEUED", "PLANNING"] },
    },
    data: {
      status: "COMPLETED",
      stoppingReason: "SUPERSEDED",
    },
  });

  const opps = await prisma.opportunity.findMany({
    where: {
      companyName: "Stripe",
      sourceListings: {
        some: {
          verificationStatus: "VERIFIED",
          sourcePlatform: "Greenhouse",
        },
      },
    },
    take: 3,
    include: { sourceListings: true },
    orderBy: { firstSeenAt: "desc" },
  });

  if (opps.length === 0) {
    throw new Error("No genuine Stripe opportunities found in database!");
  }

  const search = await prisma.search.create({
    data: {
      userId,
      rawQuery: "Software & Reliability Engineers at Stripe",
      status: "COMPLETED",
      totalFound: opps.length,
      stoppingReason: "TARGET_SATISFIED",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  for (let i = 0; i < opps.length; i++) {
    await prisma.searchResult.create({
      data: {
        searchId: search.id,
        opportunityId: opps[i].id,
        rankPosition: i + 1,
        matchScore: 96 - i * 6,
      },
    });
  }

  console.log(`[Setup] ✓ Created search ${search.id} with ${opps.length} Stripe opportunities.`);
  return search.id;
}

async function main() {
  const secret = process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars";
  const testUser = await prisma.user.findFirst({
    where: { email: "ui_foundation@test.com" },
  });

  if (!testUser) {
    throw new Error("Could not find test user ui_foundation@test.com");
  }

  await setupTestData(testUser.id);

  console.log("[Auth] Generating NextAuth JWT token for", testUser.email);
  const sessionToken = await encode({
    token: {
      id: testUser.id,
      name: testUser.name || "Engineering Lead",
      email: testUser.email,
      role: testUser.role || "USER",
      sub: testUser.id,
    },
    secret,
  });

  const artifactDir = "C:/Users/sr2ma/.gemini/antigravity/brain/2cf2fa4f-8fe9-493b-bda6-875f632b32d2";

  console.log("[Browser] Launching Chromium...");
  const browser = await chromium.launch({ headless: true });

  // ==========================================
  // 1. DISCOVER DESKTOP (1440x900)
  // ==========================================
  console.log("--- 1. Capturing Discover Desktop (1440x900) ---");
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

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

  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto("http://localhost:3000/app", { waitUntil: "domcontentloaded", timeout: 30000 });

  // Wait for sidebar and opportunity cards
  await desktopPage.waitForSelector("aside[aria-label='Application Sidebar']", { timeout: 20000 });
  await desktopPage.waitForSelector("text=Stripe", { timeout: 20000 });
  await desktopPage.waitForTimeout(3000);

  const discoverDesktopPath = path.join(artifactDir, "discover_retrofit_desktop.png");
  await desktopPage.screenshot({ path: discoverDesktopPath, fullPage: false });
  console.log(`[Discover Desktop] ✓ Saved: ${discoverDesktopPath}`);

  // ==========================================
  // 2. DISCOVER SLIDE-OVER DETAIL PANEL (1440x900)
  // ==========================================
  console.log("--- 2. Capturing Slide-Over Job Detail Panel on Discover ---");
  const cardToClick = await desktopPage.$(".group.rounded-xl");
  if (cardToClick) {
    console.log("Clicking opportunity card to open slide-over panel...");
    await cardToClick.click();
    await desktopPage.waitForSelector("div[role='dialog'][aria-labelledby='slide-over-title']", { timeout: 10000 });
    await desktopPage.waitForTimeout(2000);

    const slideOverPath = path.join(artifactDir, "discover_retrofit_slideover.png");
    await desktopPage.screenshot({ path: slideOverPath, fullPage: false });
    console.log(`[Discover Slide-Over] ✓ Saved: ${slideOverPath}`);

    // Close panel
    const closeBtn = await desktopPage.$("button[aria-label='Close panel']");
    if (closeBtn) await closeBtn.click();
    await desktopPage.waitForTimeout(1000);
  } else {
    console.warn("No card found to click for slide-over!");
  }

  // ==========================================
  // 3. WATCHES DESKTOP (1440x900)
  // ==========================================
  console.log("--- 3. Capturing Watches Desktop (1440x900) ---");
  await desktopPage.goto("http://localhost:3000/app/watch", { waitUntil: "domcontentloaded", timeout: 30000 });
  await desktopPage.waitForSelector("aside[aria-label='Application Sidebar']", { timeout: 20000 });
  await desktopPage.waitForSelector("text=Autonomous Watch", { timeout: 20000 });
  await desktopPage.waitForTimeout(2500);

  const watchDesktopPath = path.join(artifactDir, "watch_retrofit_desktop.png");
  await desktopPage.screenshot({ path: watchDesktopPath, fullPage: false });
  console.log(`[Watch Desktop] ✓ Saved: ${watchDesktopPath}`);

  await desktopContext.close();

  // ==========================================
  // 4. DISCOVER MOBILE (375x812)
  // ==========================================
  console.log("--- 4. Capturing Discover Mobile (375x812) ---");
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  await mobileContext.addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("http://localhost:3000/app", { waitUntil: "domcontentloaded", timeout: 30000 });
  await mobilePage.waitForSelector("header", { timeout: 20000 });
  await mobilePage.waitForSelector("text=Stripe", { timeout: 20000 });
  await mobilePage.waitForTimeout(2500);

  const discoverMobilePath = path.join(artifactDir, "discover_retrofit_mobile.png");
  await mobilePage.screenshot({ path: discoverMobilePath, fullPage: false });
  console.log(`[Discover Mobile] ✓ Saved: ${discoverMobilePath}`);

  // ==========================================
  // 5. WATCHES MOBILE (375x812)
  // ==========================================
  console.log("--- 5. Capturing Watches Mobile (375x812) ---");
  await mobilePage.goto("http://localhost:3000/app/watch", { waitUntil: "domcontentloaded", timeout: 30000 });
  await mobilePage.waitForSelector("header", { timeout: 20000 });
  await mobilePage.waitForSelector("text=Autonomous Watch", { timeout: 20000 });
  await mobilePage.waitForTimeout(2500);

  const watchMobilePath = path.join(artifactDir, "watch_retrofit_mobile.png");
  await mobilePage.screenshot({ path: watchMobilePath, fullPage: false });
  console.log(`[Watch Mobile] ✓ Saved: ${watchMobilePath}`);

  await mobileContext.close();
  await browser.close();
  console.log("[Done] All 5 retrofit screenshots captured successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
