/**
 * §ABSTRACT BROWSER SOURCE CONNECTOR (TASK-039)
 * 
 * Provider-agnostic browser connector base contract handling session-based crawling,
 * opportunity extraction, expiration detection, and structured error reporting.
 */

import { type SearchIntent, type RawJobCandidate, type ProviderLimits } from "@/lib/scraper/providers/baseProvider";
import { type SourceType } from "@/lib/discovery/sources/sourceTypes";
import {
  type BrowserSessionRecord,
  type BrowserSessionValidationResult,
  BrowserConnectorError,
} from "./browserSessionTypes";

export interface BrowserConnectorContext {
  userId?: string;
  sessionRecord?: BrowserSessionRecord | null;
  rawSessionState?: Record<string, unknown> | null;
  customFetch?: typeof fetch;
  signal?: AbortSignal;
  correlationId?: string;
}

export abstract class BrowserSourceConnector {
  public abstract readonly name: string;
  public abstract readonly sourceType: SourceType;

  public supports(intent: SearchIntent): boolean {
    return true;
  }

  public abstract verifySession(
    session: BrowserSessionRecord,
    rawState?: Record<string, unknown> | null
  ): Promise<BrowserSessionValidationResult>;

  public abstract search(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: BrowserConnectorContext
  ): Promise<RawJobCandidate[]>;

  public abstract crawl(
    targetUrl: string,
    context?: BrowserConnectorContext
  ): Promise<RawJobCandidate[]>;

  public detectExpiration(pageContent: string): boolean {
    const lower = pageContent.toLowerCase();
    return (
      lower.includes("sign in to continue") ||
      lower.includes("session expired") ||
      lower.includes("please log in") ||
      lower.includes("unauthorized")
    );
  }

  public detectCaptcha(pageContent: string): boolean {
    const lower = pageContent.toLowerCase();
    return (
      lower.includes("recaptcha") ||
      lower.includes("hcaptcha") ||
      lower.includes("cloudflare challenge") ||
      lower.includes("verify you are human") ||
      lower.includes("security check")
    );
  }

  public reportStructuredError(
    err: unknown,
    category: import("./browserSessionTypes").BrowserErrorCode,
    correlationId = `corr_${Date.now()}`
  ): BrowserConnectorError {
    const rawMessage = err instanceof Error ? err.message : String(err);

    let userFacing = `A temporary issue occurred while searching ${this.name}.`;
    let userActionRequired = false;
    let retryable = true;

    switch (category) {
      case "AUTH_REQUIRED":
        userFacing = `Authentication is required to search ${this.name}. Please connect your account.`;
        userActionRequired = true;
        retryable = false;
        break;
      case "SESSION_EXPIRED":
        userFacing = `Your ${this.name} session has expired. Please reconnect to resume discovery.`;
        userActionRequired = true;
        retryable = false;
        break;
      case "CAPTCHA_DETECTED":
        userFacing = `${this.name} presented a verification check. Please solve the challenge in your browser.`;
        userActionRequired = true;
        retryable = false;
        break;
      case "RATE_LIMITED":
        userFacing = `${this.name} is temporarily rate limiting requests. BrowserPilot will retry shortly.`;
        retryable = true;
        break;
      case "SOURCE_BLOCKED":
        userFacing = `${this.name} is currently inaccessible. Falling back to alternative sources.`;
        retryable = false;
        break;
      default:
        break;
    }

    return new BrowserConnectorError({
      source: this.name,
      category,
      retryable,
      userActionRequired,
      message: rawMessage,
      userFacingMessage: userFacing,
      internalCode: `ERR_${this.name.toUpperCase()}_${category}`,
      correlationId,
    });
  }
}
