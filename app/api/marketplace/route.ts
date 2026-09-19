import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// Mathematical freshness decay constant (half-life ~46 hours)
const LAMBDA_DECAY = 0.015;

const WORD_NUMBER_MAP: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  couple: 2,
  three: 3,
  few: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseCountOrWord(val: string): number {
  const n = parseInt(val, 10);
  if (!isNaN(n)) return n;
  return WORD_NUMBER_MAP[val.toLowerCase()] || 1;
}

export function extractSnippetPostingDate(snippet?: string | null, fallbackDate?: Date | string | null): Date {
  if (snippet) {
    const lower = snippet.toLowerCase();
    const now = new Date();

    // 1. Matches relative age expressions with digit or word numerals:
    // e.g. "shared that two weeks ago", "shared 2 weeks ago", "actively hiring 2 weeks ago", "posted 3 days ago", "1 month ago", "2w ago", "3d ago"
    const relMatch = lower.match(/(?:posted|shared|shared\s+that|hiring|active|created|published|listed|updated)?\s*(?:about\s*)?(\d+|one|two|couple|three|few|four|five|six|seven|eight|nine|ten|a|an)\s*(hour|hr|h|day|d|week|wk|w|month|mo)s?\s*ago/);
    if (relMatch) {
      const count = parseCountOrWord(relMatch[1]);
      const unit = relMatch[2];
      if (unit.startsWith("h")) {
        return new Date(now.getTime() - count * 60 * 60 * 1000);
      } else if (unit.startsWith("d")) {
        return new Date(now.getTime() - count * 24 * 60 * 60 * 1000);
      } else if (unit.startsWith("w")) {
        return new Date(now.getTime() - count * 7 * 24 * 60 * 60 * 1000);
      } else if (unit.startsWith("m")) {
        return new Date(now.getTime() - count * 30 * 24 * 60 * 60 * 1000);
      }
    }

    // 2. Specific relative keywords
    if (lower.includes("yesterday")) {
      return new Date(Date.now() - 24 * 60 * 60 * 1000);
    }
    if (lower.includes("just now") || lower.includes("today") || lower.includes("hours ago")) {
      return new Date(Date.now() - 2 * 60 * 60 * 1000);
    }
  }
  if (fallbackDate) {
    return new Date(fallbackDate);
  }
  return new Date();
}

function computeFreshness(date: Date | string) {
  const targetDate = new Date(date);
  const now = new Date();
  const elapsedMs = Math.max(0, now.getTime() - targetDate.getTime());
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
  const decayScore = Math.max(0, Math.round(15 * Math.exp(-LAMBDA_DECAY * elapsedHours) * 10) / 10);

  let label = "Posted today";
  if (elapsedHours >= 24 * 14) {
    const weeks = Math.floor(elapsedHours / (24 * 7));
    label = `Posted ${weeks} weeks ago`;
  } else if (elapsedHours >= 24 * 7) {
    label = "Posted 1 week ago";
  } else if (elapsedHours > 72) {
    const days = Math.floor(elapsedHours / 24);
    label = `Posted ${days} days ago`;
  } else if (elapsedHours > 48) {
    label = "Posted 3 days ago";
  } else if (elapsedHours > 24) {
    label = "Posted 2 days ago";
  } else if (elapsedHours > 1) {
    label = `Posted ${elapsedHours} hours ago`;
  }

  return {
    elapsedHours,
    decayScore,
    label,
    isFresh: elapsedHours <= 72,
  };
}

function safeParseList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
      if (typeof parsed === "string" && parsed.trim().length > 0) return [parsed.trim()];
    } catch {
      if (raw.trim().length > 0) {
        return raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  return [];
}

import { resolveCompanyPersonnel } from "@/lib/discovery/personnel/companyPersonnelDirectory";

export async function GET(request: NextRequest) {

  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "ALL";
    const workMode = searchParams.get("workMode")?.trim() || "ANY";
    const experienceLevel = searchParams.get("experienceLevel")?.trim() || "ANY";
    const postedWithinDays = searchParams.get("postedWithinDays") ? parseInt(searchParams.get("postedWithinDays")!, 10) : null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(60, Math.max(1, parseInt(searchParams.get("limit") || "24", 10)));
    const sort = searchParams.get("sort") || "latest";

    // Build Prisma query conditions
    const where: any = {
      status: "ACTIVE",
    };

    if (workMode && workMode !== "ANY") {
      where.workMode = workMode;
    }

    if (experienceLevel && experienceLevel !== "ANY") {
      where.experienceLevel = experienceLevel;
    }

    if (postedWithinDays && postedWithinDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - postedWithinDays);
      where.lastVerifiedAt = { gte: cutoff };
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { skills: { contains: q, mode: "insensitive" } },
      ];
    }

    // Role or category filtering
    if (category && category !== "ALL") {
      const categoryKeywords: Record<string, string[]> = {
        AI_ML: ["AI", "Machine Learning", "LLM", "Data", "Vision", "ML", "PyTorch"],
        INFRASTRUCTURE: ["DevOps", "Cloud", "Kubernetes", "AWS", "Infrastructure", "Platform", "SRE", "Backend"],
        FRONTEND: ["Frontend", "React", "Next.js", "Full Stack", "TypeScript", "UI", "Web"],
        PRODUCT_DESIGN: ["Product Manager", "Design", "UX", "UI/UX", "Product"],
        FINTECH: ["Fintech", "Payment", "Risk", "Trading", "Banking"],
        MARKETING: ["Marketing", "Growth", "SEO", "Content", "Brand", "Campaign"],
        SALES: ["Sales", "Account Executive", "BDR", "SDR", "RevOps", "Business Development"],
        OPERATIONS: ["Operations", "Ops", "Chief of Staff", "Strategy", "Logistics", "Program Manager"],
        FINANCE: ["Finance", "Accounting", "Financial", "Fintech", "Tax", "Audit", "Treasury"],
        HEALTHCARE: ["Healthcare", "Health", "Clinical", "Biotech", "Medical", "Pharma"],
        CUSTOMER_SUCCESS: ["Customer Success", "Support", "Client Success", "Account Manager", "CX"],
        LEGAL: ["Legal", "Counsel", "Compliance", "Regulatory", "Attorney"],
        DESIGN: ["Design", "Designer", "UX", "UI", "Graphic", "Creative", "Art Director"],
      };

      const keywords = categoryKeywords[category];
      if (keywords && keywords.length > 0) {
        const catConditions = keywords.map((k) => ({
          title: { contains: k, mode: "insensitive" },
        }));
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { OR: catConditions }];
          delete where.OR;
        } else {
          where.OR = catConditions;
        }
      }
    }

    // Ensure only genuine verified companies appear (exclude placeholders/demos/frontier tests)
    const excludePatterns = ["Acme", "Demo", "Test", "Frontier", "Placeholder", "Example"];
    const excludeDemos = [
      ...excludePatterns.map((pat) => ({ companyName: { contains: pat, mode: "insensitive" as const } })),
      { title: { contains: "[Demo]", mode: "insensitive" as const } },
      { title: { contains: "Demo", mode: "insensitive" as const } },
    ];
    if (where.AND) {
      where.AND.push({ NOT: excludeDemos });
    } else {
      where.NOT = excludeDemos;
    }

    // Determine sorting
    let orderBy: any = { lastVerifiedAt: "desc" };
    if (sort === "salary") {
      orderBy = { salaryMax: "desc" };
    } else if (sort === "oldest") {
      orderBy = { firstSeenAt: "asc" };
    }

    let total = await prisma.opportunity.count({ where });

    if (total === 0 && (!q || q.length === 0)) {
      // Auto-prime database with initial batch of genuine top tech ATS opportunities
      try {
        const { atsProvider } = await import("@/lib/scraper/providers/atsProvider");
        await atsProvider.harvestCandidates(
          { role: "Software Engineer", queryHint: "Software Engineer" },
          { maxCandidates: 30, timeoutMs: 10000 }
        );
        total = await prisma.opportunity.count({ where });
      } catch (seedErr) {
        console.warn("[MarketplaceAPI] Auto-prime error:", seedErr);
      }
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sourceListings: {
          select: {
            sourcePlatform: true,
            applyUrl: true,
            verificationStatus: true,
            rawSnippet: true,
            seenAt: true,
          },
          take: 3,
        },
        companyContacts: {
          select: {
            id: true,
            fullName: true,
            roleTitle: true,
            department: true,
            profileUrl: true,
            email: true,
            personalEmail: true,
            phone: true,
            isVerified: true,
            sourcePlatform: true,
          },
          take: 5,
        },
        savedByUsers: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
      },
    });

    const items = opportunities.map((opp) => {
      // Priority: Compute freshness based on actual external posting date in snippet or firstSeenAt
      const primarySnippet = opp.sourceListings[0]?.rawSnippet || opp.description;
      const originalPostingDate = extractSnippetPostingDate(primarySnippet, opp.firstSeenAt);
      const freshness = computeFreshness(originalPostingDate);
      const isSaved = Array.isArray(opp.savedByUsers) && opp.savedByUsers.length > 0;

      const resolvedContacts = (opp.companyContacts && opp.companyContacts.length > 0)
        ? opp.companyContacts
        : resolveCompanyPersonnel(opp.companyName).map((p) => ({
            id: `${opp.id}_${p.fullName.replace(/\s+/g, '_')}`,
            fullName: p.fullName,
            roleTitle: p.roleTitle,
            department: p.department || null,
            profileUrl: p.profileUrl || null,
            email: p.email || null,
            personalEmail: p.personalEmail || null,
            phone: p.phone || null,
            isVerified: true,
            sourcePlatform: p.sourcePlatform || "LINKEDIN",
          }));

      const cleanCompanyName = opp.companyName.replace(/\s+\d{6,}$/, "").trim();
      const cleanTitle = opp.title.replace(/^\[Demo\]\s*/i, "").trim();

      return {
        id: opp.id,
        canonicalHash: opp.canonicalHash,
        title: cleanTitle,
        companyName: cleanCompanyName,
        location: opp.location,
        workMode: opp.workMode,
        experienceLevel: opp.experienceLevel,
        opportunityType: opp.opportunityType,
        salaryMin: opp.salaryMin,
        salaryMax: opp.salaryMax,
        salaryCurrency: opp.salaryCurrency || "USD",
        description: opp.description,
        requirements: safeParseList(opp.requirements),
        skills: safeParseList(opp.skills),
        primaryApplyUrl: opp.primaryApplyUrl,
        firstSeenAt: opp.firstSeenAt,
        lastVerifiedAt: opp.lastVerifiedAt,
        rawSnippet: opp.sourceListings[0]?.rawSnippet || null,
        companyContacts: resolvedContacts,
        status: opp.status,
        freshness,
        isSaved,
        sources: opp.sourceListings.map((s) => ({
          platform: s.sourcePlatform,
          applyUrl: s.applyUrl,
          verified: s.verificationStatus === "VERIFIED",
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error("[MarketplaceAPI] GET error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err.message || "Failed to load marketplace opportunities." },
      { status: 500 }
    );
  }
}
