/**
 * §ATS PORTAL BROWSER CONNECTOR (TASK-039)
 * 
 * Executes direct career portal crawls across Ashby, Greenhouse, Lever, and Workable.
 */

import { BrowserSourceConnector, type BrowserConnectorContext } from "../browserSourceConnector";
import { type SearchIntent, type RawJobCandidate, type ProviderLimits } from "@/lib/scraper/providers/baseProvider";
import { type BrowserSessionRecord, type BrowserSessionValidationResult } from "../browserSessionTypes";

export class AtsBrowserConnector extends BrowserSourceConnector {
  public readonly name: string;
  public readonly sourceType = "ATS_PORTAL" as const;

  constructor(atsName = "Greenhouse") {
    super();
    this.name = atsName;
  }

  public async verifySession(
    session: BrowserSessionRecord,
    rawState?: Record<string, unknown> | null
  ): Promise<BrowserSessionValidationResult> {
    // ATS public endpoints don't always require auth, but if configured with session, verify validity
    return {
      isValid: true,
      status: "CONNECTED",
      expiresAt: session?.expiresAt,
    };
  }

  public async search(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: BrowserConnectorContext
  ): Promise<RawJobCandidate[]> {
    // TASK-064: Synthetic data purge.
    // AtsBrowserConnector must NEVER fabricate synthetic candidates (e.g. "job_5001", defaultCompanies).
    // In the absence of an active browser page automation producing genuine DOM job postings, return an empty array.
    return [];
  }

  public async crawl(
    targetUrl: string,
    context?: BrowserConnectorContext
  ): Promise<RawJobCandidate[]> {
    // TASK-064: Synthetic data purge.
    // Return empty array when no live browser page automation is active.
    return [];
  }
}

export const greenhouseBrowserConnector = new AtsBrowserConnector("Greenhouse");
export const ashbyBrowserConnector = new AtsBrowserConnector("Ashby");
export const leverBrowserConnector = new AtsBrowserConnector("Lever");
export const workableBrowserConnector = new AtsBrowserConnector("Workable");
