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
 * Checks if target IP/hostname is a private subnet, loopback, or cloud metadata endpoint
 */
export function isPrivateOrMetadataHost(hostname: string): boolean {
  // 1. Cloud metadata endpoints & loopback IPs
  if (
    hostname === "169.254.169.254" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "metadata.google.internal" ||
    hostname.startsWith("169.254.")
  ) {
    return true;
  }

  // 2. IPv4 Private Ranges (RFC 1918):
  // 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }
  // 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  return false;
}

/**
 * Global default Domain Security Configuration
 */
export function getDomainSecurityConfig(customAllowed?: string[]): DomainSecurityConfig {
  const isTest = process.env.NODE_ENV === "test" || process.env.IS_TEST_HARNESS === "true";
  const envAllowed = process.env.ALLOWED_DOMAINS
    ? process.env.ALLOWED_DOMAINS.split(",").map((d) => d.trim().toLowerCase())
    : [];

  const combinedAllowed = Array.from(
    new Set([...(customAllowed || []), ...envAllowed].map((d) => d.toLowerCase().trim()).filter(Boolean))
  );

  // If no specific domain restriction is specified, permit public internet destinations (while SSRF guards block private IPs/metadata)
  const allowWildcard = combinedAllowed.length === 0 || combinedAllowed.includes("*");

  return {
    allowedDomains: combinedAllowed.filter((d) => d !== "*"),
    allowWildcard,
    allowLocalhost: isTest,
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
    const protocol = parsed.protocol.toLowerCase();

    // 1. Protocol check
    if (config.blockedProtocols.includes(protocol)) {
      return {
        permitted: false,
        reason: `Protocol "${protocol}" is blocked for security isolation.`,
      };
    }

    if (!["http:", "https:", "about:"].includes(protocol)) {
      return {
        permitted: false,
        reason: `Protocol "${protocol}" is not supported. Only http: and https: are allowed.`,
      };
    }

    if (protocol === "about:") {
      return parsed.pathname === "blank"
        ? { permitted: true }
        : { permitted: false, reason: "Only about:blank is permitted." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Unconditional SSRF Guard: Private subnets, link-local, and cloud metadata endpoints
    if (isPrivateOrMetadataHost(hostname)) {
      return {
        permitted: false,
        reason: `Security SSRF Halt: Access to private network or metadata address "${hostname}" is prohibited.`,
      };
    }

    // 3. Localhost check (Allowed only in test harness mode for local test fixtures)
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const isTest = process.env.NODE_ENV === "test" || process.env.IS_TEST_HARNESS === "true";
      if (!config.allowLocalhost && !isTest) {
        return {
          permitted: false,
          reason: `Security SSRF Halt: Localhost access is disabled in production.`,
        };
      }
      return { permitted: true };
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
