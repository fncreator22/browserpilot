/**
 * §COMPANY LOGO & BRAND RESOLUTION UTILITY
 * 
 * Provides high-fidelity company logo URLs and initials fallbacks.
 * Adheres strictly to the 'Navy Ink on Cool Marble' palette.
 */

const KNOWN_DOMAINS: Record<string, string> = {
  vsolvit: "vsolvit.com",
  google: "google.com",
  microsoft: "microsoft.com",
  apple: "apple.com",
  amazon: "amazon.com",
  meta: "meta.com",
  netflix: "netflix.com",
  stripe: "stripe.com",
  uber: "uber.com",
  airbnb: "airbnb.com",
  palantir: "palantir.com",
  databricks: "databricks.com",
  snowflake: "snowflake.com",
  greenhouse: "greenhouse.io",
  lever: "lever.co",
  ashby: "ashbyhq.com",
  wellfound: "wellfound.com",
  hcltech: "hcltech.com",
  tcs: "tcs.com",
  infosys: "infosys.com",
  wipro: "wipro.com",
  github: "github.com",
  reddit: "reddit.com",
  slack: "slack.com",
  twitter: "x.com",
  x: "x.com",
  linkedin: "linkedin.com",
};

export function resolveCompanyDomain(companyName: string, applyUrl?: string | null): string {
  if (applyUrl) {
    try {
      const parsed = new URL(applyUrl);
      const hostParts = parsed.hostname.split(".");
      if (hostParts.length >= 2) {
        const cleanHost = hostParts.slice(-2).join(".");
        if (!["greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "linkedin.com", "indeed.com"].includes(cleanHost)) {
          return cleanHost;
        }
      }
    } catch {}
  }

  const clean = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (KNOWN_DOMAINS[clean]) {
    return KNOWN_DOMAINS[clean];
  }

  const trimmed = companyName
    .toLowerCase()
    .replace(/\b(inc|llc|corp|corporation|technologies|technology|solutions|group|systems|software|labs)\b/g, "")
    .trim()
    .replace(/[^a-z0-9]/g, "");

  if (trimmed && KNOWN_DOMAINS[trimmed]) {
    return KNOWN_DOMAINS[trimmed];
  }

  return `${clean || "company"}.com`;
}

export function getCompanyLogoUrl(companyName: string, applyUrl?: string | null): string {
  const domain = resolveCompanyDomain(companyName, applyUrl);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function getCompanyInitials(companyName: string): string {
  if (!companyName) return "CO";
  const words = companyName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return companyName.slice(0, 2).toUpperCase();
}
