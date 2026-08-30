/**
 * §DETERMINISTIC FRESHNESS & POSTING DATE INTELLIGENCE
 * Extracts and calculates posting timestamps and freshness classifications
 * without LLMs or non-deterministic heuristics.
 */

export type FreshnessClass = "TODAY" | "RECENT" | "STALE" | "UNKNOWN";

export interface FreshnessSignal {
  postedAt: Date | null;
  discoveredAt: Date;
  lastVerifiedAt?: Date | null;
  freshnessScore: number;
  freshnessClass: FreshnessClass;
  postedAgoText?: string;
}

/**
 * Deterministically parses a posting date string (relative or absolute) into a Date and FreshnessSignal.
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
      postedAgoText: "Posting date unavailable",
    };
  }

  const text = dateText.trim().toLowerCase();
  const refMs = referenceTime.getTime();

  // 1. "Just now", "moments ago", "few seconds ago"
  if (/\b(just now|moments? ago|seconds? ago)\b/.test(text)) {
    return {
      postedAt: new Date(refMs - 5 * 60 * 1000), // ~5 mins ago
      discoveredAt,
      freshnessScore: 15,
      freshnessClass: "TODAY",
      postedAgoText: "Just posted",
    };
  }

  // 2. "Posted today", "today"
  if (/\b(today|posted today)\b/.test(text)) {
    return {
      postedAt: new Date(refMs - 2 * 3600 * 1000), // ~2h ago today
      discoveredAt,
      freshnessScore: 15,
      freshnessClass: "TODAY",
      postedAgoText: "Posted today",
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
      postedAgoText: `${mins}m ago`,
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
      postedAgoText: `${hours}h ago`,
    };
  }

  // 5. "Yesterday", "1 day ago", "X days ago", "Xd ago"
  if (/\byesterday\b/.test(text)) {
    return {
      postedAt: new Date(refMs - 24 * 3600 * 1000),
      discoveredAt,
      freshnessScore: 12,
      freshnessClass: "RECENT",
      postedAgoText: "Yesterday",
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
      postedAgoText: `${days}d ago`,
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
      postedAgoText: `${weeks}w ago`,
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
      postedAgoText: `${months}mo ago`,
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
      postedAgoText: ageDays === 0 ? "Posted today" : `${ageDays}d ago`,
    };
  }

  return {
    postedAt: null,
    discoveredAt,
    freshnessScore: 4,
    freshnessClass: "UNKNOWN",
    postedAgoText: "Posting date unavailable",
  };
}
