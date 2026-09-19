/**
 * EPHEMERAL AUTHENTICATED BROWSER CONTEXT RUNNER
 * 
 * Uses decrypted BrowserSession credentials and cookies stored in PostgreSQL
 * for authenticated plugins (LinkedIn, Google, Indeed, ATS portals) to build
 * isolated disposable Playwright browser contexts.
 * 
 * Guarantees strict per-user sandbox isolation with zero cross-tenant cookie bleed
 * or session leakage between runs.
 */

import type { Browser, BrowserContext, Page } from "playwright";
import { BrowserSessionManager } from "./browserSessionManager";
import { BrowserConnectorError } from "./browserSessionTypes";
import { parseCookieHeader } from "@/lib/security/credentialEncryption";

/**
 * Detects whether the current runtime is a serverless cloud container (e.g. Vercel Lambda, AWS Lambda).
 */
export function isServerlessEnvironment(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.NEXT_RUNTIME === "edge"
  );
}

/**
 * Dynamically loads Playwright chromium to prevent bundling bloat in serverless routes.
 */
async function getPlaywrightChromium() {
  try {
    const pw = await import("playwright");
    return pw.chromium;
  } catch (err) {
    console.warn("[EphemeralBrowserContextRunner] Playwright failed to load dynamically:", err);
    return null;
  }
}

export interface EphemeralCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface EphemeralContextOptions {
  viewport?: { width: number; height: number };
  userAgent?: string;
  proxyUrl?: string;
  timeoutMs?: number;
  browserInstance?: Browser;
  mockContext?: BrowserContext;
}

export interface EphemeralContextHandle {
  context: BrowserContext;
  page: Page;
  userId: string;
  source: string;
  cookiesInjectedCount: number;
  createdAt: Date;
  close: () => Promise<void>;
}

// Canonical source default domains for cookie binding
const DEFAULT_SOURCE_DOMAINS: Record<string, string> = {
  LINKEDIN: ".linkedin.com",
  GOOGLE: ".google.com",
  GOOGLE_JOBS: ".google.com",
  INDEED: ".indeed.com",
  TWITTER: ".twitter.com",
  X_TWITTER: ".x.com",
  X: ".x.com",
  REDDIT: ".reddit.com",
  GREENHOUSE: "boards.greenhouse.io",
  LEVER: "jobs.lever.co",
  ASHBY: "jobs.ashbyhq.com",
  WORKABLE: "apply.workable.com",
};

// Standard residential desktop user-agent for bot mitigation
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export class EphemeralBrowserContextRunner {
  private sessionManager: BrowserSessionManager;

  // Static per-tenant registry to verify strict isolation and zero cross-tenant bleeding
  private static activeTenantContexts = new Map<string, Set<BrowserContext>>();

  constructor(sessionManager = new BrowserSessionManager()) {
    this.sessionManager = sessionManager;
  }

  /**
   * Returns the count of currently active browser contexts for a user (or globally).
   */
  public static getActiveContextCount(userId?: string): number {
    if (userId) {
      return this.activeTenantContexts.get(userId)?.size || 0;
    }
    let total = 0;
    for (const contexts of this.activeTenantContexts.values()) {
      total += contexts.size;
    }
    return total;
  }

  /**
   * Verifies that no browser context belonging to User A is shared with User B.
   */
  public static assertNoCrossTenantBleed(userIdA: string, userIdB: string): void {
    if (userIdA === userIdB) return;
    const contextsA = this.activeTenantContexts.get(userIdA);
    const contextsB = this.activeTenantContexts.get(userIdB);

    if (!contextsA || !contextsB) return;

    for (const ctx of contextsA) {
      if (contextsB.has(ctx)) {
        throw new Error(
          `SECURITY CRITICAL: Cross-tenant context bleed detected between user "${userIdA}" and user "${userIdB}".`
        );
      }
    }
  }

  /**
   * Normalizes various cookie payload shapes into Playwright compatible Cookie records.
   */
  public normalizeCookies(
    source: string,
    rawState: Record<string, unknown> | null | undefined
  ): EphemeralCookie[] {
    if (!rawState) return [];

    const defaultDomain = DEFAULT_SOURCE_DOMAINS[source.toUpperCase()] || ".example.com";
    const cookies: EphemeralCookie[] = [];

    // Case 1: Standard Playwright storageState { cookies: [...] }
    if (Array.isArray(rawState.cookies)) {
      for (const item of rawState.cookies) {
        if (item && typeof item === "object" && typeof item.name === "string" && typeof item.value === "string") {
          cookies.push({
            name: item.name,
            value: item.value,
            domain: item.domain || defaultDomain,
            path: item.path || "/",
            expires: typeof item.expires === "number" ? item.expires : undefined,
            httpOnly: Boolean(item.httpOnly),
            secure: item.secure !== false,
            sameSite: (item.sameSite as any) || "Lax",
          });
        }
      }
      return cookies;
    }

    // Case 1b: Structured key-value dictionary in rawState.cookies { li_at: "val" } (e.g. BYOC session import)
    if (rawState.cookies && typeof rawState.cookies === "object" && !Array.isArray(rawState.cookies)) {
      for (const [key, val] of Object.entries(rawState.cookies as Record<string, unknown>)) {
        if (typeof val === "string" && val.length > 0 && !["__proto__", "constructor", "prototype"].includes(key)) {
          cookies.push({
            name: key,
            value: val,
            domain: defaultDomain,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
          });
        }
      }
      if (cookies.length > 0) {
        return cookies;
      }
    }

    // Case 1c: Raw cookieString header present (e.g. from BYOC import or fallback)
    if (typeof rawState.cookieString === "string" && rawState.cookieString.trim()) {
      const parsed = parseCookieHeader(rawState.cookieString);
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === "string" && val.length > 0 && !["__proto__", "constructor", "prototype"].includes(key)) {
          cookies.push({
            name: key,
            value: val,
            domain: defaultDomain,
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
          });
        }
      }
      if (cookies.length > 0) {
        return cookies;
      }
    }

    // Case 2: Array of cookie objects directly
    if (Array.isArray(rawState)) {
      for (const item of rawState) {
        if (item && typeof item === "object" && typeof item.name === "string" && typeof item.value === "string") {
          cookies.push({
            name: item.name,
            value: item.value,
            domain: item.domain || defaultDomain,
            path: item.path || "/",
            expires: typeof item.expires === "number" ? item.expires : undefined,
            httpOnly: Boolean(item.httpOnly),
            secure: item.secure !== false,
            sameSite: (item.sameSite as any) || "Lax",
          });
        }
      }
      return cookies;
    }

    // Case 3: Raw key-value dictionary { li_at: "val", JSESSIONID: "val" } (excluding session envelope keys)
    const ignoredKeys = new Set([
      "origins",
      "sessionStorage",
      "cookieString",
      "cookies",
      "token",
      "importedAt",
      "metadata",
      "isByoc",
      "cookieCount",
      "hasToken",
      "username",
      "__proto__",
      "constructor",
      "prototype",
    ]);

    for (const [key, val] of Object.entries(rawState)) {
      if (typeof val === "string" && val.length > 0 && !ignoredKeys.has(key)) {
        cookies.push({
          name: key,
          value: val,
          domain: defaultDomain,
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        });
      }
    }

    return cookies;
  }

  /**
   * Creates an isolated ephemeral Playwright browser context for a specific user and plugin source.
   */
  public async createEphemeralContext(
    userId: string,
    source: string,
    options: EphemeralContextOptions = {}
  ): Promise<EphemeralContextHandle> {
    if (!userId || !source) {
      throw new Error("Cannot create ephemeral browser context: userId and source are required.");
    }

    const normalizedSource = source.toUpperCase();

    // 1. Retrieve and decrypt session credentials from PostgreSQL
    const sessionData = await this.sessionManager.getActiveSession(userId, normalizedSource);
    if (!sessionData) {
      throw new BrowserConnectorError({
        source: normalizedSource,
        category: "AUTH_REQUIRED",
        retryable: false,
        userActionRequired: true,
        message: `No active authenticated session found for user "${userId}" on "${normalizedSource}".`,
        userFacingMessage: `Please connect your ${normalizedSource} account in your Profile to enable authenticated search.`,
        internalCode: "EPHEMERAL_SESSION_NOT_FOUND",
        correlationId: `auth_${Date.now()}_${userId.slice(0, 8)}`,
      });
    }

    // 2. Normalize and prepare cookies
    const normalizedCookies = this.normalizeCookies(normalizedSource, sessionData.rawState);

    // 3. Acquire Browser instance or use mock context for unit tests
    let context: BrowserContext;
    let page: Page;

    let ownsBrowser = false;
    let browserInstanceToClean: Browser | undefined = undefined;

    if (options.mockContext) {
      context = options.mockContext;
      page = await context.newPage();
    } else {
      // Guard against headless browser launch attempts in serverless environments (e.g. Vercel)
      if (isServerlessEnvironment() && !options.browserInstance) {
        throw new BrowserConnectorError({
          source: normalizedSource,
          category: "SYSTEM_FAILURE",
          retryable: false,
          userActionRequired: false,
          message: `Ephemeral Playwright sandbox execution is disabled in serverless cloud environments (Vercel). Falling back to HTTP evidence verification.`,
          userFacingMessage: `Headless browser sandbox is not supported in serverless runtimes. Using direct secure HTTP verification.`,
          internalCode: "SERVERLESS_SANDBOX_BYPASS",
          correlationId: `srvless_${Date.now()}_${userId.slice(0, 8)}`,
        });
      }

      let browser = options.browserInstance;
      if (!browser) {
        const chromiumLauncher = await getPlaywrightChromium();
        if (!chromiumLauncher) {
          throw new BrowserConnectorError({
            source: normalizedSource,
            category: "SYSTEM_FAILURE",
            retryable: false,
            userActionRequired: false,
            message: `Playwright Chromium binary is unavailable in current runtime.`,
            userFacingMessage: `Browser automation engine unavailable in current environment.`,
            internalCode: "CHROMIUM_BINARY_MISSING",
            correlationId: `no_chrom_${Date.now()}_${userId.slice(0, 8)}`,
          });
        }

        ownsBrowser = true;
        browser = await chromiumLauncher.launch({
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        });
        browserInstanceToClean = browser;
      }

      context = await browser.newContext({
        userAgent: options.userAgent || DEFAULT_USER_AGENT,
        viewport: options.viewport || { width: 1280, height: 800 },
        proxy: options.proxyUrl ? { server: options.proxyUrl } : undefined,
        ignoreHTTPSErrors: false,
      });

      page = await context.newPage();
    }

    // 4. Inject decrypted cookies into the isolated ephemeral context
    if (normalizedCookies.length > 0 && typeof context.addCookies === "function") {
      await context.addCookies(normalizedCookies);
    }

    // 5. Register context in per-tenant isolation registry
    if (!EphemeralBrowserContextRunner.activeTenantContexts.has(userId)) {
      EphemeralBrowserContextRunner.activeTenantContexts.set(userId, new Set());
    }
    EphemeralBrowserContextRunner.activeTenantContexts.get(userId)!.add(context);

    // 6. Build disposable lifecycle handle
    let isClosed = false;
    const handle: EphemeralContextHandle = {
      context,
      page,
      userId,
      source: normalizedSource,
      cookiesInjectedCount: normalizedCookies.length,
      createdAt: new Date(),
      close: async () => {
        if (isClosed) return;
        isClosed = true;

        try {
          // Remove from per-tenant registry
          const userSet = EphemeralBrowserContextRunner.activeTenantContexts.get(userId);
          if (userSet) {
            userSet.delete(context);
            if (userSet.size === 0) {
              EphemeralBrowserContextRunner.activeTenantContexts.delete(userId);
            }
          }

          // Close page and context to eradicate in-memory cookies and storage state
          await page.close().catch(() => {});
          await context.close().catch(() => {});

          // Clean up browser instance if owned by this ephemeral runner
          if (ownsBrowser && browserInstanceToClean) {
            await browserInstanceToClean.close().catch(() => {});
          }
        } catch (err) {
          console.warn(`[EphemeralBrowserContextRunner] Error closing context for ${userId}:`, err);
        }
      },
    };

    return handle;
  }

  /**
   * Executes an action inside an ephemeral authenticated context, ensuring guaranteed cleanup.
   */
  public async runWithEphemeralContext<T>(
    userId: string,
    source: string,
    action: (context: BrowserContext, page: Page) => Promise<T>,
    options: EphemeralContextOptions = {}
  ): Promise<T> {
    const handle = await this.createEphemeralContext(userId, source, options);
    try {
      return await action(handle.context, handle.page);
    } finally {
      await handle.close();
    }
  }
}

export const ephemeralBrowserRunner = new EphemeralBrowserContextRunner();
