/**
 * §URL LIVELINESS VERIFIER & TRUTH GATE (TASK-063)
 * 
 * Performs bounded real network dereferencing, SSRF protection,
 * redirect re-validation, deterministic closure detection, and
 * job-detail vs generic portal classification.
 */

import { type LivelinessClassification, type UrlLivelinessResult } from "./sandboxTypes";
import { classifyJobUrl } from "@/lib/scraper/normalizer";

export interface UrlVerificationOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  signal?: AbortSignal;
  customFetch?: typeof fetch;
  allowTestLocalhost?: boolean;
}

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // AWS/Cloud metadata IP
  /^0\.0\.0\.0$/,
  /^::1$/,
];

const DETERMINISTIC_CLOSURE_SIGNATURES = [
  /the job you are looking for is no longer open/i,
  /this job is no longer available/i,
  /job no longer available/i,
  /position has been filled/i,
  /this job has expired/i,
  /this posting has expired/i,
  /application closed/i,
  /applications? (?:are )?closed/i,
  /no longer accepting applications/i,
  /role (?:is )?closed/i,
  /posting has closed/i,
  /this position is closed/i,
  /this job is closed/i,
  /job not found/i,
  /position not found/i,
  /posting not found/i,
  /this vacancy has expired/i,
  /career opportunity no longer exists/i,
  /we are no longer taking applications/i,
];

const CAPTCHA_SIGNATURES = [
  /cf-chl-bypass/i,
  /challenge-platform/i,
  /verify you are human/i,
  /security check to access/i,
  /please complete the security check/i,
  /attention required! \| cloudflare/i,
  /ddos-guard/i,
  /perimeterx/i,
  /incapsula/i,
  /distil networks/i,
  /recaptcha/i,
  /hcaptcha/i,
];

export class UrlLivelinessVerifier {
  /**
   * Safely validates a URL string against SSRF and protocol misuse.
   */
  public isSafePublicUrl(rawUrl: string, allowTestLocalhost = false): { safe: boolean; reason?: string; parsed?: URL } {
    try {
      const parsed = new URL(rawUrl.trim());
      
      // 1. Protocol check: strictly http or https
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { safe: false, reason: `Unsafe protocol [${parsed.protocol}]. Only HTTP and HTTPS are permitted.` };
      }

      // 2. Prohibit embedded credentials
      if (parsed.username || parsed.password) {
        return { safe: false, reason: "Embedded URL credentials prohibited." };
      }

      const hostname = parsed.hostname.toLowerCase();

      // 3. Prohibit localhost unless explicitly allowed for controlled unit testing
      if ((hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") && !allowTestLocalhost) {
        return { safe: false, reason: `Prohibited loopback/localhost host [${hostname}].` };
      }

      // 4. Prohibit private IP ranges (SSRF protection)
      if (!allowTestLocalhost) {
        for (const pattern of PRIVATE_IP_PATTERNS) {
          if (pattern.test(hostname)) {
            return { safe: false, reason: `Prohibited private or cloud metadata IP [${hostname}].` };
          }
        }
      }

      return { safe: true, parsed };
    } catch {
      return { safe: false, reason: `Malformed URL string [${rawUrl}].` };
    }
  }

  /**
   * Bounded real network verification of a candidate job URL.
   */
  public async verifyUrlLiveness(
    targetUrl: string,
    options: UrlVerificationOptions = {}
  ): Promise<UrlLivelinessResult> {
    const tStart = Date.now();
    const timeoutMs = options.timeoutMs || 5000;
    const maxRedirects = options.maxRedirects !== undefined ? options.maxRedirects : 3;
    const maxBytes = options.maxBytes || 256 * 1024; // 256 KB max
    const effectiveFetch = options.customFetch || globalThis.fetch;
    const allowTestLocalhost = options.allowTestLocalhost ?? (process.env.IS_TEST_HARNESS === "true");

    // 1. Pre-network safe URL validation
    const safetyCheck = this.isSafePublicUrl(targetUrl, allowTestLocalhost);
    if (!safetyCheck.safe || !safetyCheck.parsed) {
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        statusCode: 0,
        classification: "BLOCKED",
        isVerified: false,
        redirectCount: 0,
        closureSignalDetected: false,
        closureReason: safetyCheck.reason,
        captchaDetected: false,
        latencyMs: Date.now() - tStart,
      };
    }

    // 2. Check initial syntactic classification
    const initialUrlType = classifyJobUrl(targetUrl);
    if (initialUrlType === "SEARCH_RESULTS") {
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        statusCode: 0,
        classification: "SEARCH_RESULTS_PAGE",
        isVerified: false,
        redirectCount: 0,
        closureSignalDetected: false,
        closureReason: "URL syntactically identifies as search results page",
        captchaDetected: false,
        latencyMs: Date.now() - tStart,
      };
    }
    if (initialUrlType === "COMPANY_CAREER_ROOT" || initialUrlType === "ATS_COMPANY_ROOT" || initialUrlType === "SOURCE_HOME") {
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        statusCode: 0,
        classification: "GENERIC_PORTAL",
        isVerified: false,
        redirectCount: 0,
        closureSignalDetected: false,
        closureReason: `URL syntactically identifies as generic root portal (${initialUrlType})`,
        captchaDetected: false,
        latencyMs: Date.now() - tStart,
      };
    }
    if (initialUrlType === "APPLICATION_PORTAL") {
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        statusCode: 0,
        classification: "APPLICATION_PORTAL",
        isVerified: false,
        redirectCount: 0,
        closureSignalDetected: false,
        closureReason: "URL points to generic application portal rather than specific job detail",
        captchaDetected: false,
        latencyMs: Date.now() - tStart,
      };
    }

    // 3. Network Fetch with Timeout & Redirect Loop Control
    let currentUrl = targetUrl;
    let redirectCount = 0;
    let finalStatus = 0;
    let bodyText = "";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      while (redirectCount <= maxRedirects) {
        if (options.signal?.aborted || controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const res = await effectiveFetch(currentUrl, {
          method: "GET",
          headers: {
            "User-Agent": "BrowserPilot-TruthGate/1.0 (Public Opportunity Liveliness Verifier)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          redirect: "manual",
          signal: controller.signal,
        });

        finalStatus = res.status;

        // Check for redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(res.status)) {
          const location = res.headers.get("location");
          if (!location) {
            break;
          }

          redirectCount++;
          if (redirectCount > maxRedirects) {
            return {
              url: targetUrl,
              finalUrl: currentUrl,
              statusCode: finalStatus,
              classification: "UNREACHABLE",
              isVerified: false,
              redirectCount,
              closureSignalDetected: false,
              closureReason: "Exceeded maximum redirect limit",
              captchaDetected: false,
              latencyMs: Date.now() - tStart,
            };
          }

          // Resolve relative or absolute redirect destination
          const nextUrl = new URL(location, currentUrl).toString();
          
          // Re-validate SSRF and protocol safety at each hop!
          const nextSafety = this.isSafePublicUrl(nextUrl, allowTestLocalhost);
          if (!nextSafety.safe) {
            return {
              url: targetUrl,
              finalUrl: nextUrl,
              statusCode: finalStatus,
              classification: "BLOCKED",
              isVerified: false,
              redirectCount,
              closureSignalDetected: false,
              closureReason: `Redirect target prohibited: ${nextSafety.reason}`,
              captchaDetected: false,
              latencyMs: Date.now() - tStart,
            };
          }

          currentUrl = nextUrl;
          continue;
        }

        // Read bounded response body
        if (res.body) {
          const reader = res.body.getReader();
          let totalBytes = 0;
          const chunks: Uint8Array[] = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done || !value) break;
            chunks.push(value);
            totalBytes += value.length;
            if (totalBytes >= maxBytes) {
              await reader.cancel();
              break;
            }
          }

          // Decode text
          const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });
          bodyText = chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
        } else {
          bodyText = await res.text();
        }

        break;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === "AbortError" && !options.signal?.aborted;
      const isCancelled = options.signal?.aborted;

      if (isTimeout) {
        return {
          url: targetUrl,
          finalUrl: currentUrl,
          statusCode: 0,
          classification: "TIMEOUT",
          isVerified: false,
          redirectCount,
          closureSignalDetected: false,
          closureReason: `Request timed out after ${timeoutMs}ms`,
          captchaDetected: false,
          latencyMs: Date.now() - tStart,
        };
      }

      if (isCancelled) {
        return {
          url: targetUrl,
          finalUrl: currentUrl,
          statusCode: 0,
          classification: "UNREACHABLE",
          isVerified: false,
          redirectCount,
          closureSignalDetected: false,
          closureReason: "Request cancelled by user AbortSignal",
          captchaDetected: false,
          latencyMs: Date.now() - tStart,
        };
      }

      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: 0,
        classification: "UNREACHABLE",
        isVerified: false,
        redirectCount,
        closureSignalDetected: false,
        closureReason: err?.message || "Network unreachable",
        captchaDetected: false,
        latencyMs: Date.now() - tStart,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - tStart;

    // 4. Evaluate HTTP Status Codes
    if (finalStatus === 404) {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: 404,
        classification: "DEAD_NOT_FOUND",
        isVerified: false,
        redirectCount,
        closureSignalDetected: true,
        closureReason: "HTTP 404 Not Found",
        captchaDetected: false,
        latencyMs,
      };
    }

    if (finalStatus === 410) {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: 410,
        classification: "LIVE_CLOSED_JOB",
        isVerified: false,
        redirectCount,
        closureSignalDetected: true,
        closureReason: "HTTP 410 Gone (Permanently Closed)",
        captchaDetected: false,
        latencyMs,
      };
    }

    if (finalStatus === 403) {
      const isCaptcha = CAPTCHA_SIGNATURES.some((p) => p.test(bodyText));
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: 403,
        classification: isCaptcha ? "CAPTCHA_DETECTED" : "BLOCKED",
        isVerified: false,
        redirectCount,
        closureSignalDetected: false,
        closureReason: isCaptcha ? "CAPTCHA/Security challenge detected" : "HTTP 403 Forbidden",
        captchaDetected: isCaptcha,
        latencyMs,
      };
    }

    if (finalStatus === 429) {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: 429,
        classification: "RATE_LIMITED",
        isVerified: false,
        redirectCount,
        closureSignalDetected: false,
        closureReason: "HTTP 429 Too Many Requests (Rate Limited)",
        captchaDetected: false,
        latencyMs,
      };
    }

    if (finalStatus >= 500) {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: finalStatus,
        classification: "UNREACHABLE",
        isVerified: false,
        redirectCount,
        closureSignalDetected: false,
        closureReason: `HTTP ${finalStatus} Server Error`,
        captchaDetected: false,
        latencyMs,
      };
    }

    // 5. Reclassify Final Redirect Destination (Section 19)
    const finalUrlType = classifyJobUrl(currentUrl);
    if (finalUrlType === "SEARCH_RESULTS") {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: finalStatus,
        classification: "SEARCH_RESULTS_PAGE",
        isVerified: false,
        redirectCount,
        closureSignalDetected: false,
        closureReason: `Redirected to search results page (${currentUrl})`,
        captchaDetected: false,
        latencyMs,
      };
    }
    if (finalUrlType === "COMPANY_CAREER_ROOT" || finalUrlType === "ATS_COMPANY_ROOT" || finalUrlType === "SOURCE_HOME") {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: finalStatus,
        classification: "GENERIC_PORTAL",
        isVerified: false,
        redirectCount,
        closureSignalDetected: false,
        closureReason: `Redirected to generic career root portal (${currentUrl})`,
        captchaDetected: false,
        latencyMs,
      };
    }
    if (finalUrlType === "APPLICATION_PORTAL") {
      return {
        url: targetUrl,
        finalUrl: currentUrl,
        statusCode: finalStatus,
        classification: "APPLICATION_PORTAL",
        isVerified: false,
        redirectCount,
        closureSignalDetected: false,
        closureReason: `Redirected to generic application portal (${currentUrl})`,
        captchaDetected: false,
        latencyMs,
      };
    }

    // 6. Check for In-Page CAPTCHA Signals (HTTP 200 CAPTCHA)
    for (const pattern of CAPTCHA_SIGNATURES) {
      if (pattern.test(bodyText)) {
        return {
          url: targetUrl,
          finalUrl: currentUrl,
          statusCode: finalStatus,
          classification: "CAPTCHA_DETECTED",
          isVerified: false,
          redirectCount,
          closureSignalDetected: false,
          closureReason: "In-page CAPTCHA or bot-challenge detected",
          captchaDetected: true,
          latencyMs,
        };
      }
    }

    // 7. Check for In-Page Closed Job Signatures (Section 16)
    for (const pattern of DETERMINISTIC_CLOSURE_SIGNATURES) {
      if (pattern.test(bodyText)) {
        return {
          url: targetUrl,
          finalUrl: currentUrl,
          statusCode: finalStatus,
          classification: "LIVE_CLOSED_JOB",
          isVerified: false,
          redirectCount,
          closureSignalDetected: true,
          closureReason: `Closure signature detected in page content: ${pattern.source}`,
          captchaDetected: false,
          latencyMs,
        };
      }
    }

    // 8. Extract Basic Page Evidence (Title, Meta)
    const titleMatch = bodyText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const rawPageTitle = titleMatch ? titleMatch[1].trim() : undefined;

    // Check if title itself signals closed or generic
    if (rawPageTitle) {
      if (/404|not found|page not found/i.test(rawPageTitle)) {
        return {
          url: targetUrl,
          finalUrl: currentUrl,
          statusCode: finalStatus,
          classification: "DEAD_NOT_FOUND",
          isVerified: false,
          redirectCount,
          closureSignalDetected: true,
          closureReason: `Page title indicates not found: "${rawPageTitle}"`,
          captchaDetected: false,
          latencyMs,
        };
      }
      if (/job closed|position closed|expired|closed/i.test(rawPageTitle)) {
        return {
          url: targetUrl,
          finalUrl: currentUrl,
          statusCode: finalStatus,
          classification: "LIVE_CLOSED_JOB",
          isVerified: false,
          redirectCount,
          closureSignalDetected: true,
          closureReason: `Page title indicates closed job: "${rawPageTitle}"`,
          captchaDetected: false,
          latencyMs,
        };
      }
    }

    // Successful live open job detail
    return {
      url: targetUrl,
      finalUrl: currentUrl,
      statusCode: finalStatus,
      classification: "LIVE_OPEN_JOB",
      isVerified: true,
      redirectCount,
      closureSignalDetected: false,
      captchaDetected: false,
      latencyMs,
      extractedEvidence: {
        title: rawPageTitle,
        isSpecificJob: true,
      },
    };
  }
}

export const urlLivelinessVerifier = new UrlLivelinessVerifier();
