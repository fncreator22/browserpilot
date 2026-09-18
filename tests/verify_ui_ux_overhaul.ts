import { chromium } from 'playwright';
import { encode } from 'next-auth/jwt';
import { prisma } from 'c:/Users/sr2ma/Documents/github/browserAI/lib/db/prisma';
import path from 'path';
import fs from 'fs';

async function run() {
  const artifactDir = 'C:\\Users\\sr2ma\\.gemini\\antigravity\\brain\\7039fbc0-99e5-4c31-8f4d-ce45f3c9fb27';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const testUser = await prisma.user.findFirst();
  if (!testUser) {
    throw new Error('No user found in database');
  }

  const secret = process.env.NEXTAUTH_SECRET || 'browserpilot-secret-development-key-32chars';
  const sessionToken = await encode({
    token: { sub: testUser.id, id: testUser.id, email: testUser.email, name: testUser.name },
    secret
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([{
    name: 'next-auth.session-token',
    value: sessionToken,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }]);

  const page = await context.newPage();

  console.log('[1/7] Navigating to /app in LIGHT MODE (Discovery Workspace)...');
  await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  });
  await page.waitForTimeout(1200);

  const discoveryPath = path.join(artifactDir, 'verified_marble_discovery_workspace.png');
  await page.screenshot({ path: discoveryPath, fullPage: false });
  console.log('Saved Discovery Workspace screenshot to:', discoveryPath);

  console.log('[2/7] Navigating to /app/watch in LIGHT MODE (Autonomous Watch)...');
  await page.goto('http://localhost:3000/app/watch', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const watchPath = path.join(artifactDir, 'verified_marble_autonomous_watch.png');
  await page.screenshot({ path: watchPath, fullPage: false });
  console.log('Saved Autonomous Watch screenshot to:', watchPath);

  console.log('[3/7] Navigating to /app/plans in LIGHT MODE (Plans & Quotas Matrix)...');
  await page.goto('http://localhost:3000/app/plans', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
  });
  await page.waitForTimeout(1000);

  const lightPlansPath = path.join(artifactDir, 'verified_light_mode_plans.png');
  await page.screenshot({ path: lightPlansPath, fullPage: false });
  console.log('Saved Light Mode Plans screenshot to:', lightPlansPath);

  console.log('[4/7] Switching to DARK MODE on /app/plans...');
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  });
  await page.waitForTimeout(1200);

  const darkPlansPath = path.join(artifactDir, 'verified_dark_mode_plans.png');
  await page.screenshot({ path: darkPlansPath, fullPage: false });
  console.log('Saved Dark Mode Plans screenshot to:', darkPlansPath);

  console.log('[5/7] Navigating to /app and opening Settings Modal (AI Providers & Keys)...');
  await page.goto('http://localhost:3000/app', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  });
  await page.waitForTimeout(1000);

  // Click profile / settings button
  const settingsBtn = page.locator('button[title="User Settings & Profile"]').first();
  await settingsBtn.click();
  await page.waitForTimeout(1000);

  const providersTab = page.locator('button:has-text("AI Providers & Keys")').first();
  await providersTab.click();
  await page.waitForTimeout(1000);

  const settingsProvidersPath = path.join(artifactDir, 'verified_settings_providers.png');
  await page.screenshot({ path: settingsProvidersPath, fullPage: false });
  console.log('Saved Settings Providers screenshot to:', settingsProvidersPath);

  console.log('[6/7] Clicking Subscription & Quotas tab in Settings Sidebar...');
  const quotasTab = page.locator('button:has-text("Subscription & Quotas")').first();
  await quotasTab.click();
  await page.waitForTimeout(1000);

  const settingsQuotasPath = path.join(artifactDir, 'verified_settings_quotas.png');
  await page.screenshot({ path: settingsQuotasPath, fullPage: false });
  console.log('Saved Settings Quotas screenshot to:', settingsQuotasPath);

  console.log('[7/7] Clicking Notification Preferences tab in Settings Modal...');
  const notifTab = page.locator('button:has-text("Notification Preferences")').first();
  await notifTab.click();
  await page.waitForTimeout(1000);

  const settingsNotifPath = path.join(artifactDir, 'verified_settings_notifications.png');
  await page.screenshot({ path: settingsNotifPath, fullPage: false });
  console.log('Saved Settings Notifications screenshot to:', settingsNotifPath);

  await browser.close();
  console.log('All 7 verification screenshots successfully captured!');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
