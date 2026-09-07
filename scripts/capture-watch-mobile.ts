import { chromium } from "playwright";
import { prisma } from "../lib/db/prisma";
import { encode } from "next-auth/jwt";
import * as path from "path";

async function main() {
  const secret = process.env.NEXTAUTH_SECRET || "browserpilot-secret-development-key-32chars";
  const testUser = await prisma.user.findFirst({
    where: { email: "ui_foundation@test.com" },
  });

  if (!testUser) throw new Error("User not found");

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
  const browser = await chromium.launch({ headless: true });

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
  await mobilePage.goto("http://localhost:3000/app/watch", { waitUntil: "domcontentloaded", timeout: 30000 });
  await mobilePage.waitForSelector("h1:has-text('Autonomous Watch')", { timeout: 20000 });
  await mobilePage.waitForTimeout(2000);

  const watchMobilePath = path.join(artifactDir, "watch_retrofit_mobile.png");
  await mobilePage.screenshot({ path: watchMobilePath, fullPage: false });
  console.log(`[Watch Mobile] ✓ Saved: ${watchMobilePath}`);

  await mobileContext.close();
  await browser.close();
}

main().catch(console.error).finally(() => prisma.$disconnect());
