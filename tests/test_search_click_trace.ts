import { chromium } from "playwright";

async function testSearchClick() {
  console.log("=================================================");
  console.log("PART C: TRACING SEARCH BUTTON CLICK IN BROWSER");
  console.log("=================================================");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const networkRequests: Array<{ url: string; method: string }> = [];
  const networkResponses: Array<{ url: string; status: number }> = [];

  page.on("console", (msg) => {
    console.log(`[Browser Console ${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.log(`[Browser PageError] ${err.message}`);
  });

  page.on("request", (req) => {
    networkRequests.push({ url: req.url(), method: req.method() });
    console.log(`[Network Request] ${req.method()} ${req.url()}`);
  });

  page.on("response", (res) => {
    networkResponses.push({ url: res.url(), status: res.status() });
    console.log(`[Network Response] ${res.status()} ${res.url()}`);
  });

  console.log("\n1. Navigating to http://localhost:3000/...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

  console.log("\n2. Checking TaskInput on Landing Page...");
  const textarea = page.locator("textarea").first();
  await textarea.waitFor({ timeout: 5000 });
  console.log("Found textarea on landing page.");

  console.log("\n3. Filling query 'AI intern'...");
  await textarea.fill("AI intern");

  console.log("\n4. Clicking 'Find Opportunities' button...");
  const searchBtn = page.locator("button:has-text('Find Opportunities')").first();
  await searchBtn.click();

  console.log("\n5. Observing UI and Network for 5 seconds...");
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(500);
    const btnText = await page.locator("button:has-text('Find Opportunities'), button:has-text('Searching'), button:has-text('Cancel')").first().innerText().catch(() => "none");
    console.log(`  T+${((i + 1) * 0.5).toFixed(1)}s: Button="${btnText.replace(/\n/g, ' ')}"`);
  }

  await browser.close();
  console.log("\nTrace completed.");
}

testSearchClick().catch(console.error);
