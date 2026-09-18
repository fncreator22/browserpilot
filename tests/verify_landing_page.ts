import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function run() {
  const artifactDir = 'C:\\Users\\sr2ma\\.gemini\\antigravity\\brain\\7039fbc0-99e5-4c31-8f4d-ce45f3c9fb27';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Context (1440x900)
  console.log('[1/5] Launching Desktop context (1440x900)...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await desktopContext.newPage();

  console.log('Navigating to http://localhost:3000/ ...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Capture Hero Section View
  const heroPath = path.join(artifactDir, 'verified_marble_landing_hero.png');
  await page.screenshot({ path: heroPath, fullPage: false });
  console.log('Saved Landing Hero screenshot to:', heroPath);

  // Scroll down to the 3D Cave Stage
  console.log('[2/5] Capturing 3D Cave Stage...');
  await page.evaluate(() => {
    window.scrollTo({ top: 750, behavior: 'instant' });
  });
  await page.waitForTimeout(1500);
  const cavePath = path.join(artifactDir, 'verified_marble_landing_cave.png');
  await page.screenshot({ path: cavePath, fullPage: false });
  console.log('Saved Cave Stage screenshot to:', cavePath);

  // Scroll to Solutions & Interactive Capabilities
  console.log('[3/5] Capturing Solutions & Capabilities...');
  await page.evaluate(() => {
    window.scrollTo({ top: 1800, behavior: 'instant' });
  });
  await page.waitForTimeout(1500);
  const solutionsPath = path.join(artifactDir, 'verified_marble_landing_solutions.png');
  await page.screenshot({ path: solutionsPath, fullPage: false });
  console.log('Saved Solutions & Capabilities screenshot to:', solutionsPath);

  // Capture Full Page
  console.log('[4/5] Capturing Full Landing Page...');
  const fullPath = path.join(artifactDir, 'verified_marble_landing_full.png');
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log('Saved Full Landing Page screenshot to:', fullPath);

  // 2. Mobile Context (390x844)
  console.log('[5/5] Launching Mobile context (390x844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);

  const mobileHeroPath = path.join(artifactDir, 'verified_marble_landing_mobile.png');
  await mobilePage.screenshot({ path: mobileHeroPath, fullPage: false });
  console.log('Saved Mobile Landing screenshot to:', mobileHeroPath);

  await browser.close();
  console.log('All visual screenshots successfully generated!');
}

run().catch((err) => {
  console.error('Visual verification failed:', err);
  process.exit(1);
});
