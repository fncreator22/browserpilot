/**
 * §DETERMINISTIC FRESHNESS & POSTING DATE INTELLIGENCE
 * Extracts and calculates posting timestamps and freshness classifications
 * without LLMs or non-deterministic heuristics.
 */

export type FreshnessClass = "TODAY" | "RECENT" | "STALE" | "UNKNOWN";
export type DateSemantic = "POSTED" | "UPDATED" | "REPOSTED" | "UNKNOWN";
export type MetadataConfidence = "VERIFIED" | "PARTIAL" | "UNVERIFIED";

export interface FreshnessSignal {
  postedAt: Date | null;
  discoveredAt: Date;
  lastVerifiedAt?: Date | null;
  freshnessScore: number;
  freshnessClass: FreshnessClass;
  dateSemantic: DateSemantic;
  postedAgoText?: string;
  confidence: MetadataConfidence;
}

/**
 * Deterministically parses a posting date string (relative or absolute) into a Date and FreshnessSignal.
 * Distinguishes original posting dates from "updated" or "reposted" dates.
 * 
 * @param dateText Raw date or relative age snippet (e.g. "Posted 2 hours ago", "3d ago", "Aug 28, 2026")
 * @param referenceTime The base timestamp to evaluate against (defaults to now)
 */
export function parsePostingDate(
  dateText?: string | null,
  referenceTime: Date = new Date()
): FreshnessSignal {
  const discoveredAt = new Date();

  if (!dateText || typeof dateText !== "string" || dateText.trim().length === 0) {
    return {
      postedAt: null,
      discoveredAt,
      freshnessScore: 4,
      freshnessClass: "UNKNOWN",
      dateSemantic: "UNKNOWN",
      postedAgoText: "Posting date unavailable",
      confidence: "UNVERIFIED",
    };
  }

  const text = dateText.trim().toLowerCase();
  const refMs = referenceTime.getTime();

  // Detect semantic qualifier
  let dateSemantic: DateSemantic = "POSTED";
  if (/\b(updated|modified|refreshed)\b/.test(text)) {
    dateSemantic = "UPDATED";
  } else if (/\b(reposted|re-posted)\b/.test(text)) {
    dateSemantic = "REPOSTED";
  }

  // 1. "Just now", "moments ago", "few seconds ago"
  if (/\b(just now|moments? ago|seconds? ago)\b/.test(text)) {
    return {
      postedAt: new Date(refMs - 5 * 60 * 1000), // ~5 mins ago
      discoveredAt,
      freshnessScore: 15,
      freshnessClass: "TODAY",
      dateSemantic,
      postedAgoText: dateSemantic === "UPDATED" ? "Updated moments ago" : dateSemantic === "REPOSTED" ? "Reposted moments ago" : "Just posted",
      confidence: "VERIFIED",
    };
  }

  // 2. "Posted today", "today"
  if (/\b(today|posted today)\b/.test(text)) {
    return {
      postedAt: new Date(refMs - 2 * 3600 * 1000), // ~2h ago today
      discoveredAt,
      freshnessScore: 15,
      freshnessClass: "TODAY",
      dateSemantic,
      postedAgoText: dateSemantic === "UPDATED" ? "Updated today" : dateSemantic === "REPOSTED" ? "Reposted today" : "Posted today",
      confidence: "VERIFIED",
    };
  }

  // 3. "X minutes ago", "X mins ago", "Xm ago"
  const minMatch = text.match(/(\d+)\s*(?:minutes?|mins?|m)\s*ago/);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    return {
      postedAt: new Date(refMs - mins * 60 * 1000),
      discoveredAt,
      freshnessScore: 15,
      freshnessClass: "TODAY",
      dateSemantic,
      postedAgoText: dateSemantic === "UPDATED" ? `Updated ${mins}m ago` : dateSemantic === "REPOSTED" ? `Reposted ${mins}m ago` : `${mins}m ago`,
      confidence: "VERIFIED",
    };
  }

  // 4. "X hours ago", "X hrs ago", "Xh ago"
  const hourMatch = text.match(/(\d+)\s*(?:hours?|hrs?|h)\s*ago/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    const score = hours <= 24 ? 15 : 12;
    const fClass: FreshnessClass = hours <= 24 ? "TODAY" : "RECENT";
    return {
      postedAt: new Date(refMs - hours * 3600 * 1000),
      discoveredAt,
      freshnessScore: score,
      freshnessClass: fClass,
      dateSemantic,
      postedAgoText: dateSemantic === "UPDATED" ? `Updated ${hours}h ago` : dateSemantic === "REPOSTED" ? `Reposted ${hours}h ago` : `${hours}h ago`,
      confidence: "VERIFIED",
    };
  }

  // 5. "Yesterday", "1 day ago", "X days ago", "Xd ago"
  if (/\byesterday\b/.test(text)) {
    return {
      postedAt: new Date(refMs - 24 * 3600 * 1000),
      discoveredAt,
      freshnessScore: 12,
      freshnessClass: "RECENT",
      dateSemantic,
      postedAgoText: dateSemantic === "UPDATED" ? "Updated yesterday" : dateSemantic === "REPOSTED" ? "Reposted yesterday" : "Yesterday",
      confidence: "VERIFIED",
    };
  }

  const dayMatch = text.match(/(\d+)\s*(?:days?|d)\s*ago/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    let score = 15;
    let fClass: FreshnessClass = "TODAY";

    if (days <= 1) {
      score = 14;
      fClass = "TODAY";
    } else if (days <= 3) {
      score = 12;
      fClass = "RECENT";
    } else if (days <= 7) {
      score = 9;
      fClass = "RECENT";
    } else if (days <= 14) {
      score = 6;
      fClass = "RECENT";
    } else {
      score = 2;
      fClass = "STALE";
    }

    return {
      postedAt: new Date(refMs - days * 24 * 3600 * 1000),
      discoveredAt,
      freshnessScore: score,
      freshnessClass: fClass,
      dateSemantic,
      postedAgoText: dateSemantic === "UPDATED" ? `Updated ${days}d ago` : dateSemantic === "REPOSTED" ? `Reposted ${days}d ago` : `${days}d ago`,
      confidence: "VERIFIED",
    };
  }

  // 6. "X weeks ago", "Xw ago"
  const weekMatch = text.match(/(\d+)\s*(?:weeks?|w)\s*ago/);
  if (weekMatch) {
    const weeks = parseInt(weekMatch[1], 10);
    const score = weeks === 1 ? 7 : weeks === 2 ? 4 : 1;
    const fClass: FreshnessClass = weeks <= 2 ? "RECENT" : "STALE";
    return {
      postedAt: new Date(refMs - weeks * 7 * 24 * 3600 * 1000),
      discoveredAt,
      freshnessScore: score,
      freshnessClass: fClass,
      dateSemantic,
      postedAgoText: dateSemantic === "UPDATED" ? `Updated ${weeks}w ago` : dateSemantic === "REPOSTED" ? `Reposted ${weeks}w ago` : `${weeks}w ago`,
      confidence: "VERIFIED",
    };
  }

  // 7. "X months ago", "30+ days ago"
  const monthMatch = text.match(/(\d+)\s*(?:months?|mo)\s*ago/) || text.match(/30\+\s*days?\s*ago/);
  if (monthMatch) {
    const months = parseInt(monthMatch[1] || "1", 10);
    return {
      postedAt: new Date(refMs - months * 30 * 24 * 3600 * 1000),
      discoveredAt,
      freshnessScore: 0,
      freshnessClass: "STALE",
      dateSemantic,
      postedAgoText: dateSemantic === "UPDATED" ? `Updated ${months}mo ago` : dateSemantic === "REPOSTED" ? `Reposted ${months}mo ago` : `${months}mo ago`,
      confidence: "VERIFIED",
    };
  }

  // 8. Absolute Date Parsing (ISO or standard format e.g. "2026-08-28", "Aug 28, 2026")
  const parsed = Date.parse(dateText);
  if (!isNaN(parsed)) {
    const parsedDate = new Date(parsed);
    const ageDays = Math.max(0, Math.floor((refMs - parsedDate.getTime()) / (24 * 3600 * 1000)));

    let score = 15;
    let fClass: FreshnessClass = "TODAY";

    if (ageDays <= 1) {
      score = 15;
      fClass = "TODAY";
    } else if (ageDays <= 3) {
      score = 12;
      fClass = "RECENT";
    } else if (ageDays <= 7) {
      score = 9;
      fClass = "RECENT";
    } else if (ageDays <= 21) {
      score = 5;
      fClass = "RECENT";
    } else {
      score = 1;
      fClass = "STALE";
    }

    return {
      postedAt: parsedDate,
      discoveredAt,
      freshnessScore: score,
      freshnessClass: fClass,
      dateSemantic: "POSTED",
      postedAgoText: ageDays === 0 ? "Posted today" : `${ageDays}d ago`,
      confidence: "VERIFIED",
    };
  }

  return {
    postedAt: null,
    discoveredAt,
    freshnessScore: 4,
    freshnessClass: "UNKNOWN",
    dateSemantic: "UNKNOWN",
    postedAgoText: "Posting date unavailable",
    confidence: "UNVERIFIED",
  };
}

/**
 * Evaluates whether a candidate's metadata is verified, partial, or unverified.
 */
export function evaluateMetadataConfidence(item: {
  title?: string;
  companyName?: string;
  postedAt?: Date | null;
  sourceUrl?: string;
  applyUrl?: string;
}): MetadataConfidence {
  const hasTitle = Boolean(item.title && item.title.trim().length > 2);
  const hasCompany = Boolean(item.companyName && !/^(unknown|n\/a|null|undefined)$/i.test(item.companyName.trim()));
  const hasUrl = Boolean(item.sourceUrl || item.applyUrl);
  const hasDate = Boolean(item.postedAt instanceof Date && !isNaN(item.postedAt.getTime()));

  if (!hasTitle || !hasCompany || !hasUrl) {
    return "UNVERIFIED";
  }

  if (hasDate) {
    return "VERIFIED";
  }

  return "PARTIAL";
}

/**
 * §DETERMINISTIC FRESHNESS BOUNDARY EVALUATOR (TASK-027)
 * Evaluates whether a candidate or opportunity satisfies a given freshness window constraint.
 * 
 * Rules:
 * 1. Default (isExplicitConstraint === false): returns true (preserves existing discovery behavior).
 * 2. Explicit constraint (isExplicitConstraint === true):
 *    - Unknown or missing date (postedAt == null) does NOT satisfy explicit time window -> returns false.
 *    - Invalid date string -> returns false.
 *    - Future posted date (clock drift / forward timestamp) is clamped safely to reference time.
 *    - Timezone-normalized comparison: ageHours = (refUtcMs - postedUtcMs) / 3,600,000.
 *    - Returns true if ageHours <= freshnessWindowHours; otherwise false.
 * 
 * @param postedAt The posting date of the candidate (Date, ISO string, or null)
 * @param freshnessWindowHours The maximum age in hours allowed (e.g. 24, 48, 72, 168)
 * @param isExplicitConstraint Whether this is an explicit user constraint (true) or default (false)
 * @param referenceTime The reference time to evaluate against (defaults to new Date())
 */
export function isWithinFreshnessWindow(
  postedAt?: Date | string | null,
  freshnessWindowHours: number = 168,
  isExplicitConstraint: boolean = false,
  referenceTime: Date = new Date()
): boolean {
  // If no explicit constraint was requested by the user, preserve open discovery
  if (!isExplicitConstraint) {
    return true;
  }

  // Under explicit constraint, unknown or missing date must NOT falsely satisfy the boundary
  if (!postedAt) {
    return false;
  }

  const parsedDate = postedAt instanceof Date ? postedAt : new Date(postedAt);
  if (isNaN(parsedDate.getTime())) {
    return false;
  }

  const refMs = referenceTime.getTime();
  const postedMs = parsedDate.getTime();

  // If posted in future beyond allowable 5-minute clock drift margin, clamp to reference time
  const effectivePostedMs = postedMs > refMs ? refMs : postedMs;

  // Calculate age in hours (timezone-independent UTC ms comparison)
  const ageHours = (refMs - effectivePostedMs) / (3600 * 1000);

  // Exact boundary comparison
  return ageHours <= freshnessWindowHours;
}

