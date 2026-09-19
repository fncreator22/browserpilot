/**
 * §COMPANY LOGO & BRAND RESOLUTION UTILITY
 * 
 * Provides high-fidelity company logo URLs and initials fallbacks.
 * Adheres strictly to the 'Navy Ink on Cool Marble' palette.
 */

const KNOWN_DOMAINS: Record<string, string> = {
  vsolvit: "vsolvit.com",
  gitlab: "gitlab.com",
  provectus: "provectus.com",
  neuralconcept: "neuralconcept.com",
  boson: "boson.ai",
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
  salesforce: "salesforce.com",
  adobe: "adobe.com",
  oracle: "oracle.com",
  ibm: "ibm.com",
  spotify: "spotify.com",
  figma: "figma.com",
  canva: "canva.com",
  notion: "notion.so",
  openai: "openai.com",
  anthropic: "anthropic.com",
  shopify: "shopify.com",
  zoom: "zoom.us",
  twilio: "twilio.com",
  square: "squareup.com",
  block: "block.xyz",
  robinhood: "robinhood.com",
  coinbase: "coinbase.com",
  instacart: "instacart.com",
  doordash: "doordash.com",
  lyft: "lyft.com",
  pinterest: "pinterest.com",
  snapchat: "snapchat.com",
  ebay: "ebay.com",
  paypal: "paypal.com",
  intel: "intel.com",
  nvidia: "nvidia.com",
  amd: "amd.com",
  qualcomm: "qualcomm.com",
  atlassian: "atlassian.com",
  datadog: "datadoghq.com",
  hubspot: "hubspot.com",
  cloudflare: "cloudflare.com",
  cisco: "cisco.com",
};

export function resolveCompanyDomain(companyName: string, applyUrl?: string | null): string | null {
  if (applyUrl) {
    try {
      const parsed = new URL(applyUrl);
      const hostParts = parsed.hostname.split(".");
      if (hostParts.length >= 2) {
        const cleanHost = hostParts.slice(-2).join(".");
        const atsHosts = [
          "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", 
          "linkedin.com", "indeed.com", "glassdoor.com", "smartrecruiters.com",
          "myworkdayjobs.com", "breezy.hr", "jobvite.com", "bamboohr.com",
          "ziprecruiter.com", "dice.com", "monster.com"
        ];
        if (!atsHosts.includes(cleanHost)) {
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

  // Gracefully fallback to null instead of guessing speculative .com domains that fail with 404s
  return null;
}

export function getCompanyLogoUrl(companyName?: string | null, applyUrl?: string | null): string | null {
  if (!companyName || !companyName.trim()) return null;
  const cleanName = companyName.trim().toLowerCase();
  if (
    cleanName === "company" || 
    cleanName === "unknown" || 
    cleanName === "unknown company" || 
    cleanName === "various" ||
    cleanName.includes("confidential")
  ) {
    return null;
  }
  const domain = resolveCompanyDomain(companyName, applyUrl);
  if (!domain || domain === "company.com" || domain === "unknown.com") return null;
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
