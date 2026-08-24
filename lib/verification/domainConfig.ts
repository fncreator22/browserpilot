import { config } from "dotenv";

config();

export interface DomainSecurityConfig {
  allowedDomains: string[];
  allowWildcard: boolean;
  allowLocalhost: boolean;
  blockedProtocols: string[];
  blockedIpRanges: string[];
}

/**
 * Global default Domain Security Configuration
 * Configurable via environment without changing application code
 */
export function getDomainSecurityConfig(customAllowed?: string[]): DomainSecurityConfig {
  const envAllowed = process.env.ALLOWED_DOMAINS
    ? process.env.ALLOWED_DOMAINS.split(",").map((d) => d.trim().toLowerCase())
    : [];

  const combinedAllowed = Array.from(
    new Set([...(customAllowed || []), ...envAllowed].map((d) => d.toLowerCase().trim()).filter(Boolean))
  );

  // If wildcard "*" is included or no domain whitelist is specified in dev mode, allowWildcard is true
  const allowWildcard = combinedAllowed.includes("*") || (combinedAllowed.length === 0 && process.env.NODE_ENV !== "production");

  return {
    allowedDomains: combinedAllowed.filter((d) => d !== "*"),
    allowWildcard,
    allowLocalhost: true,
    blockedProtocols: ["file:", "javascript:", "data:", "chrome:", "about:config", "vbscript:"],
    blockedIpRanges: ["169.254.169.254", "0.0.0.0"],
  };
}

/**
 * Validates whether a target URL is permitted under the domain security policy
 */
export function isUrlPermitted(
  targetUrl: string,
  config: DomainSecurityConfig
): { permitted: boolean; reason?: string } {
  try {
    const parsed = new URL(targetUrl);

    // 1. Protocol check
    if (config.blockedProtocols.includes(parsed.protocol.toLowerCase())) {
      return {
        permitted: false,
        reason: `Protocol "${parsed.protocol}" is blocked for security isolation.`,
      };
    }

    if (!["http:", "https:", "about:"].includes(parsed.protocol.toLowerCase())) {
      return {
        permitted: false,
        reason: `Protocol "${parsed.protocol}" is not supported. Only http: and https: are allowed.`,
      };
    }

    if (parsed.protocol.toLowerCase() === "about:") {
      return parsed.pathname === "blank"
        ? { permitted: true }
        : { permitted: false, reason: "Only about:blank is permitted." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. IP range & private subnet checks
    if (config.blockedIpRanges.includes(hostname)) {
      return {
        permitted: false,
        reason: `Direct access to link-local/internal IP ${hostname} is blocked.`,
      };
    }

    // 3. Localhost check
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return config.allowLocalhost
        ? { permitted: true }
        : { permitted: false, reason: "Localhost access is disabled." };
    }

    // 4. Wildcard check
    if (config.allowWildcard) {
      return { permitted: true };
    }

    // 5. Domain whitelist match
    const isDomainMatch = config.allowedDomains.some((allowed) => {
      return hostname === allowed || hostname.endsWith(`.${allowed}`);
    });

    if (!isDomainMatch) {
      return {
        permitted: false,
        reason: `Domain "${hostname}" is not in the allowed domains whitelist [${config.allowedDomains.join(", ")}].`,
      };
    }

    return { permitted: true };
  } catch {
    return {
      permitted: false,
      reason: `Invalid URL format: "${targetUrl}".`,
    };
  }
}
