import { chromium } from "playwright";
import { prisma } from "../lib/db/prisma";
import { encode } from "next-auth/jwt";
import * as path from "path";

async function main() {
  const secret = process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars";
  const testUser = await prisma.user.findFirst({
    where: { email: "ui_foundation@test.com" },
  });

  if (!testUser) {
    throw new Error("Could not find test user ui_foundation@test.com");
  }

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

  // 1. DESKTOP VIEWPORT (1440x900)
  console.log("--- 1. Capturing Desktop (1440x900) for /app/watch ---");
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
  const targetUrl = "http://localhost:3000/app/watch";
  console.log(`[Desktop] Navigating to ${targetUrl}...`);
  await desktopPage.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  await desktopPage.waitForSelector("text=Autonomous Watch", { timeout: 20000 });
  await desktopPage.waitForSelector("text=Monitored Sources & ATS Connectors", { timeout: 10000 });
  await desktopPage.waitForSelector("text=Target Companies", { timeout: 10000 });
  await desktopPage.waitForTimeout(2000);

  const desktopScreenshotPath = path.join(artifactDir, "watch_genuine_desktop.png");
  await desktopPage.screenshot({
    path: desktopScreenshotPath,
    fullPage: false,
  });
  console.log(`[Desktop] ✓ Saved: ${desktopScreenshotPath}`);

  // 2. COMMAND PALETTE MODAL (via Ctrl+K)
  console.log("--- 2. Capturing Command Palette on /app/watch ---");
  await desktopPage.keyboard.press("Control+k");
  await desktopPage.waitForSelector("div[role='dialog']", { timeout: 10000 });
  await desktopPage.waitForTimeout(1000);

  const paletteScreenshotPath = path.join(artifactDir, "watch_genuine_command_palette.png");
  await desktopPage.screenshot({
    path: paletteScreenshotPath,
    fullPage: false,
  });
  console.log(`[Command Palette] ✓ Saved: ${paletteScreenshotPath}`);

  await desktopContext.close();

  // 3. MOBILE VIEWPORT (375x812, iPhone scale)
  console.log("--- 3. Capturing Mobile (375x812) for /app/watch ---");
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
  await mobilePage.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

  await mobilePage.waitForSelector("text=Autonomous Watch", { timeout: 20000 });
  await mobilePage.waitForSelector("text=Monitored Sources & ATS Connectors", { timeout: 10000 });
  await mobilePage.waitForTimeout(2000);

  const mobileScreenshotPath = path.join(artifactDir, "watch_genuine_mobile.png");
  await mobilePage.screenshot({
    path: mobileScreenshotPath,
    fullPage: false,
  });
  console.log(`[Mobile] ✓ Saved: ${mobileScreenshotPath}`);

  await mobileContext.close();
  await browser.close();
  console.log("[Done] All 3 screenshots captured successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
