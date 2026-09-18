import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function main() {
  const outputDir = path.join(process.cwd(), ".scratch", "scroll-verification");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Test (1440x900)
  console.log("[Desktop] Navigating to landing page...");
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const comparisonSection = page.locator("#comparison");
  await comparisonSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  // Stage 01 Screenshot
  const stage1Path = path.join(outputDir, "comparison_desktop_stage1.png");
  await page.screenshot({ path: stage1Path });
  console.log("Stage 1 captured:", stage1Path);

  // Scroll down to Stage 02 (approx 35% through the section)
  await page.evaluate(() => {
    const comp = document.getElementById("comparison");
    if (comp) {
      const top = comp.getBoundingClientRect().top + window.scrollY;
      const height = comp.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + height * 0.45, behavior: "instant" });
    }
  });
  await page.waitForTimeout(700);

  const stage2Path = path.join(outputDir, "comparison_desktop_stage2.png");
  await page.screenshot({ path: stage2Path });
  console.log("Stage 2 captured:", stage2Path);

  // Scroll down to Stage 03 (approx 85% through the section)
  await page.evaluate(() => {
    const comp = document.getElementById("comparison");
    if (comp) {
      const top = comp.getBoundingClientRect().top + window.scrollY;
      const height = comp.offsetHeight - window.innerHeight;
      window.scrollTo({ top: top + height * 0.85, behavior: "instant" });
    }
  });
  await page.waitForTimeout(700);

  const stage3Path = path.join(outputDir, "comparison_desktop_stage3.png");
  await page.screenshot({ path: stage3Path });
  console.log("Stage 3 captured:", stage3Path);

  // 2. Mobile Viewport Test (390x844)
  console.log("[Mobile] Testing 390x844 viewport...");
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobilePage.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(800);

  const mobileComp = mobilePage.locator("#comparison");
  await mobileComp.scrollIntoViewIfNeeded();
  await mobilePage.waitForTimeout(600);

  const mobilePath = path.join(outputDir, "comparison_mobile_stage1.png");
  await mobilePage.screenshot({ path: mobilePath });
  console.log("Mobile Stage 1 captured:", mobilePath);

  await browser.close();
  console.log("All scroll comparison screenshots successfully captured!");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
