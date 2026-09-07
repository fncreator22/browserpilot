import { chromium } from "playwright";
import * as path from "path";

async function run() {
  const artifactDir = "C:/Users/sr2ma/.gemini/antigravity/brain/2cf2fa4f-8fe9-493b-bda6-875f632b32d2";
  const fullScreenshotPath = path.join(artifactDir, "admin_connector_registry_dashboard.png");
  const viewportScreenshotPath = path.join(artifactDir, "admin_connector_registry_viewport.png");

  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log("Navigating to Admin Connectors Dashboard...");
  await page.goto("http://localhost:3000/admin/connectors?admin_key=dev-admin-secret", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  console.log("Waiting for connectors table to render...");
  await page.waitForSelector("table", { timeout: 20000 });
  
  console.log("Waiting for data to finish loading...");
  try {
    await page.waitForSelector("text=Loading connector registry", { state: "detached", timeout: 30000 });
  } catch {
    console.log("Loading selector timed out or already gone");
  }
  await page.waitForTimeout(2000); // Allow counters to settle

  console.log("Capturing viewport screenshot...");
  await page.screenshot({ path: viewportScreenshotPath, fullPage: false });

  console.log("Capturing full page screenshot...");
  await page.screenshot({ path: fullScreenshotPath, fullPage: true });

  const modalScreenshotPath = path.join(artifactDir, "admin_connector_registry_modal.png");
  console.log("Opening Add/Edit Connector modal...");
  await page.click("button:has-text('Add Connector')");
  await page.waitForSelector("text=Register New Connector", { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: modalScreenshotPath, fullPage: false });
  console.log("Modal screenshot captured:", modalScreenshotPath);

  console.log("Screenshots captured successfully:");
  console.log(" - Full:", fullScreenshotPath);
  console.log(" - Viewport:", viewportScreenshotPath);
  console.log(" - Modal:", modalScreenshotPath);

  await browser.close();
}

run().catch((err) => {
  console.error("Screenshot capture error:", err);
  process.exit(1);
});
