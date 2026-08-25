import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface BrowserSessionOptions {
  jobId: string;
  allowedDomains?: string[];
  headless?: boolean;
  viewport?: { width: number; height: number };
  timeoutMs?: number;
}

export interface BrowserSession {
  jobId: string;
  context: BrowserContext;
  page: Page;
  allowedDomains: string[];
  createdAt: Date;
  close: () => Promise<void>;
}

export class BrowserPool {
  private browser: Browser | null = null;
  private isInitializing = false;
  private activeSessions = new Set<string>();
  private maxConcurrentObserved = 0;

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  getMaxConcurrentObserved(): number {
    return this.maxConcurrentObserved;
  }

  resetConcurrencyMetrics(): void {
    this.maxConcurrentObserved = this.activeSessions.size;
  }

  /**
   * Ensure shared Chromium browser instance is launched
   */
  async getBrowser(headless = true): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      if (this.isInitializing) {
        while (this.isInitializing) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (this.browser && this.browser.isConnected()) {
          return this.browser;
        }
      }

      this.isInitializing = true;
      try {
        this.browser = await chromium.launch({
          headless,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
          ],
        });
      } finally {
        this.isInitializing = false;
      }
    }
    return this.browser;
  }

  /**
   * Create an isolated, ephemeral incognito BrowserContext for a specific job
   */
  async createSession(options: BrowserSessionOptions): Promise<BrowserSession> {
    const browser = await this.getBrowser(options.headless !== false);

    const context = await browser.newContext({
      viewport: options.viewport || { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 BrowserPilot/1.0",
      locale: "en-US",
      timezoneId: "UTC",
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();
    page.setDefaultTimeout(options.timeoutMs || 10000);
    page.setDefaultNavigationTimeout(options.timeoutMs || 30000);

    const allowedDomains = (options.allowedDomains || [])
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    // Security domain guard: intercept and block unapproved origins per skills/security.md
    if (allowedDomains.length > 0) {
      await page.route("**/*", async (route) => {
        const requestUrl = route.request().url();
        try {
          const parsed = new URL(requestUrl);
          const hostname = parsed.hostname.toLowerCase();

          // Allow local test server / data / about URLs if needed
          if (hostname === "localhost" || hostname === "127.0.0.1" || parsed.protocol === "about:") {
            return route.continue();
          }

          const isAllowed = allowedDomains.some((allowed) => {
            return hostname === allowed || hostname.endsWith(`.${allowed}`);
          });

          if (!isAllowed && route.request().isNavigationRequest()) {
            console.warn(`[BrowserPool] Blocked unauthorized navigation: ${requestUrl}`);
            return route.abort("accessdenied");
          }

          return route.continue();
        } catch {
          return route.continue();
        }
      });
    }

    this.activeSessions.add(options.jobId);
    if (this.activeSessions.size > this.maxConcurrentObserved) {
      this.maxConcurrentObserved = this.activeSessions.size;
    }

    const session: BrowserSession = {
      jobId: options.jobId,
      context,
      page,
      allowedDomains,
      createdAt: new Date(),
      close: async () => {
        try {
          this.activeSessions.delete(options.jobId);
          await page.close().catch(() => {});
          await context.close().catch(() => {});
        } catch (err) {
          console.error(`[BrowserPool] Error closing session for job ${options.jobId}:`, err);
        }
      },
    };

    return session;
  }

  /**
   * Close the shared browser instance during system shutdown
   */
  async closeAll(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

// Global default singleton browser pool
export const browserPool = new BrowserPool();
