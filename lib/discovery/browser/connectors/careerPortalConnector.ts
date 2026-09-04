/**
 * §COMPANY CAREER PORTAL BROWSER CONNECTOR (TASK-039)
 * 
 * Directly scrapes and parses company-hosted `/careers` and `/jobs` pages.
 */

import { BrowserSourceConnector, type BrowserConnectorContext } from "../browserSourceConnector";
import { type SearchIntent, type RawJobCandidate, type ProviderLimits } from "@/lib/scraper/providers/baseProvider";
import { type BrowserSessionRecord, type BrowserSessionValidationResult } from "../browserSessionTypes";

export class CareerPortalBrowserConnector extends BrowserSourceConnector {
  public readonly name = "Company Careers";
  public readonly sourceType = "COMPANY_CAREERS" as const;

  public async verifySession(
    session: BrowserSessionRecord,
    rawState?: Record<string, unknown> | null
  ): Promise<BrowserSessionValidationResult> {
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
    // CareerPortalBrowserConnector must NEVER fabricate synthetic candidates (e.g. defaultCompanies, mock career portal links).
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

export const careerPortalBrowserConnector = new CareerPortalBrowserConnector();
