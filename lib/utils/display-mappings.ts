/**
 * Display Mappings & Text Humanization Utility
 * 
 * Maps internal database enums, uppercase codes, and system telemetry into
 * human-readable, accessible display labels according to the BrowserPilot
 * design system (Source Serif 4 / Inter editorial guidelines).
 */

export function humanizeStatus(status?: string | null): string {
  if (!status) return "Verified Live";
  const s = status.trim().toUpperCase();

  switch (s) {
    case "VERIFIED_LIVE":
    case "VERIFIED":
    case "LIVE":
      return "Verified Live";
    case "VERIFYING":
    case "IN_PROGRESS":
    case "SCANNING":
      return "Verifying...";
    case "STALE":
      return "Stale (>14d)";
    case "EXPIRED_CLOSED":
    case "EXPIRED":
    case "CLOSED":
    case "UNAVAILABLE":
      return "Expired / Closed";
    case "PENDING":
      return "Pending Verification";
    case "BLOCKED":
      return "Temporarily Blocked";
    case "FAILED":
    case "ERROR":
      return "Verification Failed";
    default: {
      return s
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    }
  }
}

export function humanizeConnectorType(type?: string | null): string {
  if (!type) return "Direct ATS";
  const t = type.trim().toUpperCase();

  switch (t) {
    case "DIRECT_ATS":
    case "ATS":
      return "Direct ATS";
    case "CAREER_PORTAL":
    case "CAREERS_PORTAL":
    case "COMPANY_CAREERS":
      return "Careers Portal";
    case "AGGREGATOR":
    case "JOB_BOARD":
      return "Job Board / Aggregator";
    case "ATS_PORTAL":
      return "ATS Portal";
    default:
      return t
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
  }
}

export function humanizeOpportunityType(type?: string | null): string {
  if (!type) return "Full-time";
  const t = type.trim().toUpperCase();

  switch (t) {
    case "FULL_TIME":
    case "FULLTIME":
      return "Full-time";
    case "PART_TIME":
    case "PARTTIME":
      return "Part-time";
    case "INTERNSHIP":
    case "INTERN":
      return "Internship";
    case "CONTRACT":
    case "CONTRACTOR":
      return "Contract";
    case "FREELANCE":
      return "Freelance";
    default:
      return t
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
  }
}

export function humanizeWorkMode(mode?: string | null): string {
  if (!mode) return "Remote";
  const m = mode.trim().toUpperCase();

  switch (m) {
    case "REMOTE":
      return "Remote";
    case "HYBRID":
      return "Hybrid";
    case "ONSITE":
    case "ON_SITE":
    case "IN_OFFICE":
      return "On-site";
    default:
      return m
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
  }
}

export function humanizeClassification(classification?: string | null): string {
  if (!classification) return "New Opportunity";
  const c = classification.trim().toUpperCase();

  switch (c) {
    case "NEW_OPPORTUNITY":
      return "New Opportunity";
    case "NEW_SOURCE":
      return "New Source";
    case "REPOSTED":
      return "Reposted";
    case "ALREADY_KNOWN":
      return "Already Monitored";
    default:
      return c
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
  }
}
