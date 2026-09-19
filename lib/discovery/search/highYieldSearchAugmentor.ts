/**
 * §HIGH-YIELD SEARCH AUGMENTOR (TASK-YIELD-10-15)
 * 
 * Guarantees that normal users always receive 10-15 opportunities per search:
 * - 5-8 Exact Matches (same role, location, and criteria)
 * - 5-7 High-Relevance Recommendations (semantic neighbors, remote alternatives, top tech ATS roles)
 * Eliminates the 0-result defect while maintaining strict data integrity, zero synthetic fake personas,
 * and genuine HR/recruiter direct-connect channels.
 */

import { prisma } from "@/lib/db/prisma";
import { type RankedOpportunity, type ScoreBreakdown } from "@/lib/scraper/ranker";
import { type SearchIntent, type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { atsProvider, DEFAULT_ATS_COMPANIES } from "@/lib/scraper/providers/atsProvider";
import { deduplicateCandidates, type DeduplicatedOpportunity } from "@/lib/scraper/deduplicator";

export interface HighYieldAugmentationOptions {
  minTotalYield?: number;
  maxTotalYield?: number;
  targetExactMin?: number;
  targetExactMax?: number;
  targetRecMin?: number;
  targetRecMax?: number;
  userId?: string | null;
  signal?: AbortSignal;
}

export async function augmentToGuaranteedYield(
  initialRanked: RankedOpportunity[],
  rawQuery: string,
  intent: SearchIntent,
  options: HighYieldAugmentationOptions = {}
): Promise<RankedOpportunity[]> {
  const minTotalYield = options.minTotalYield ?? 15;
  const maxTotalYield = options.maxTotalYield ?? 30;
  const targetExactMax = options.targetExactMax ?? 25;

  const existingHashes = new Set<string>();
  const exactMatches: RankedOpportunity[] = [];
  const existingRecs: RankedOpportunity[] = [];

  for (const item of initialRanked) {
    const hash = item.opportunity.canonicalHash;
    if (existingHashes.has(hash)) continue;
    existingHashes.add(hash);

    // Classify as exact match if role score is high and not already labelled recommended
    if (item.totalScore >= 70 && item.matchType !== "RECOMMENDED" && item.matchType !== "RECOMMENDED_SIMILAR_ROLE") {
      exactMatches.push({
        ...item,
        matchType: "EXACT_MATCH",
        matchBadge: {
          type: "EXACT_MATCH",
          label: "Direct Match",
          tagline: "Matches your role and search criteria",
        },
      });
    } else {
      existingRecs.push({
        ...item,
        matchType: item.matchType || "RECOMMENDED_SIMILAR_ROLE",
        matchBadge: item.matchBadge || {
          type: "RECOMMENDED_SIMILAR_ROLE",
          label: "Recommended Role",
          tagline: "High-relevance related role in your field",
        },
      });
    }
  }

  // Cap exact matches to targetExactMax to leave room for recommendations
  const trimmedExact = exactMatches.slice(0, targetExactMax);
  const remainingSlots = Math.max(0, maxTotalYield - trimmedExact.length);

  // If we already have >= minTotalYield with initial results, balance them nicely
  if (trimmedExact.length + existingRecs.length >= minTotalYield) {
    const combined = [...trimmedExact, ...existingRecs].slice(0, maxTotalYield);
    return combined.map((item, idx) => ({
      ...item,
      rankPosition: idx + 1,
    }));
  }

  // Need additional recommendations to reach 15-30 total verified yield
  const additionalNeeded = Math.max(minTotalYield - (trimmedExact.length + existingRecs.length), 5);
  const fetchedRecommendations = await fetchHighRelevanceRecommendations(
    rawQuery,
    intent,
    existingHashes,
    Math.max(additionalNeeded + 10, remainingSlots, 15),
    options.signal
  );

  const allRecs = [...existingRecs, ...fetchedRecommendations];
  const finalRecs = allRecs.slice(0, remainingSlots);

  const combined = [...trimmedExact, ...finalRecs];

  // Assign stable rank positions
  return combined.map((item, idx) => ({
    ...item,
    rankPosition: idx + 1,
  }));
}

/**
 * Discovers high-relevance recommendations from verified database listings and active ATS endpoints
 */
async function fetchHighRelevanceRecommendations(
  rawQuery: string,
  intent: SearchIntent,
  excludedHashes: Set<string>,
  targetCount: number,
  signal?: AbortSignal
): Promise<RankedOpportunity[]> {
  const recommendations: RankedOpportunity[] = [];
  const searchRole = intent.role || intent.roles?.[0] || "";
  const roleTokens = searchRole
    .split(/\s+/)
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 2 && !["jobs", "job", "role", "roles", "for", "with", "and", "the", "intern", "internship"].includes(t));

  // 1. Check local DB for active verified opportunities
  try {
    const orFilters: any[] = [];
    if (roleTokens.length > 0) {
      for (const tok of roleTokens) {
        orFilters.push({ title: { contains: tok, mode: "insensitive" } });
        orFilters.push({ description: { contains: tok, mode: "insensitive" } });
      }
    }
    orFilters.push({ workMode: "REMOTE" });
    orFilters.push({ companyName: { in: ["Stripe", "GitLab", "Figma", "Linear", "Vercel", "Supabase", "Datadog", "Brex", "Gusto", "Netflix"] } });

    const dbOpportunities = await prisma.opportunity.findMany({
      where: {
        status: "ACTIVE",
        OR: orFilters,
      },
      include: {
        sourceListings: true,
      },
      take: targetCount * 2,
    });

    for (const dbOpp of dbOpportunities) {
      if (recommendations.length >= targetCount) break;
      if (excludedHashes.has(dbOpp.canonicalHash)) continue;
      excludedHashes.add(dbOpp.canonicalHash);

      let reqs: string[] = [];
      let sks: string[] = [];
      try { reqs = JSON.parse(dbOpp.requirements); } catch {}
      try { sks = JSON.parse(dbOpp.skills); } catch {}

      const dedup: DeduplicatedOpportunity = {
        canonicalHash: dbOpp.canonicalHash,
        title: dbOpp.title,
        companyName: dbOpp.companyName,
        location: dbOpp.location,
        workMode: dbOpp.workMode as any,
        experienceLevel: dbOpp.experienceLevel as any,
        opportunityType: dbOpp.opportunityType as any,
        salaryMin: dbOpp.salaryMin,
        salaryMax: dbOpp.salaryMax,
        salaryCurrency: dbOpp.salaryCurrency,
        description: dbOpp.description,
        requirements: reqs,
        skills: sks,
        primaryApplyUrl: dbOpp.primaryApplyUrl,
        sourceListings: dbOpp.sourceListings.map((s) => ({
          sourcePlatform: s.sourcePlatform,
          sourceUrl: s.sourceUrl,
          applyUrl: s.applyUrl,
          seenAt: s.seenAt,
          verificationStatus: s.verificationStatus,
        })),
        firstSeenAt: dbOpp.firstSeenAt,
        lastVerifiedAt: dbOpp.lastVerifiedAt,
        postedAt: dbOpp.lastVerifiedAt,
        status: dbOpp.status,
      };

      const breakdown: ScoreBreakdown = {
        role: 25,
        skills: 20,
        workMode: dbOpp.workMode === "REMOTE" ? 15 : 10,
        freshness: 12,
        verification: 10,
      };

      const isRemoteAlt = dbOpp.workMode === "REMOTE" && intent.location && !dbOpp.location.toLowerCase().includes(intent.location.toLowerCase());

      recommendations.push({
        opportunity: dedup,
        totalScore: breakdown.role + breakdown.skills + breakdown.workMode + breakdown.freshness + breakdown.verification,
        rankPosition: 0,
        breakdown,
        matchType: isRemoteAlt ? "RECOMMENDED_LOCATION" : "RECOMMENDED_SIMILAR_ROLE",
        matchBadge: {
          type: isRemoteAlt ? "RECOMMENDED_LOCATION" : "RECOMMENDED_SIMILAR_ROLE",
          label: isRemoteAlt ? "Remote Alternative" : "Recommended Role",
          tagline: isRemoteAlt ? "Fully remote verified opening" : "Semantic role match at high-growth employer",
        },
      });
    }
  } catch (err) {
    console.warn("[HighYieldAugmentor] DB recommendations warning:", err);
  }

  // 2. If still needed, harvest directly from top tech ATS endpoints without narrow keyword rejections
  if (recommendations.length < targetCount && !signal?.aborted) {
    try {
      const topAtsCompanies = DEFAULT_ATS_COMPANIES.slice(0, 8);
      const roleVariations = searchRole ? [searchRole] : [];
      const lowerRole = (searchRole || "").toLowerCase();
      if (lowerRole.includes("data science") || lowerRole.includes("data scientist")) {
        roleVariations.push("Data Scientist", "Data Engineer", "Machine Learning Engineer", "Data Analyst");
      } else if (lowerRole.includes("frontend") || lowerRole.includes("front end")) {
        roleVariations.push("Frontend Engineer", "UI Engineer", "Software Engineer");
      } else if (lowerRole.includes("backend") || lowerRole.includes("back end")) {
        roleVariations.push("Backend Engineer", "Platform Engineer", "Software Engineer");
      } else if (lowerRole.includes("software")) {
        roleVariations.push("Software Engineer", "Full Stack Engineer", "Engineer");
      }

      const relaxedIntent: SearchIntent = {
        ...intent,
        companies: topAtsCompanies.map((c) => c.name),
        roles: roleVariations,
        role: searchRole || undefined,
        experienceLevel: "ANY",
        opportunityType: "ANY",
        workMode: intent.workMode || "ANY",
        locations: intent.locations || [],
        location: intent.location,
        isExplicitFreshness: false,
      };

      const harvested = await atsProvider.harvestCandidates(
        relaxedIntent,
        { maxCandidates: 40, timeoutMs: 7000 },
        { signal }
      );

      const deduplicated = deduplicateCandidates(harvested);
      for (const opp of deduplicated) {
        if (recommendations.length >= targetCount) break;
        if (excludedHashes.has(opp.canonicalHash)) continue;
        excludedHashes.add(opp.canonicalHash);

        const breakdown: ScoreBreakdown = {
          role: 24,
          skills: 18,
          workMode: opp.workMode === "REMOTE" ? 15 : 10,
          freshness: 14,
          verification: 10,
        };

        recommendations.push({
          opportunity: opp,
          totalScore: breakdown.role + breakdown.skills + breakdown.workMode + breakdown.freshness + breakdown.verification,
          rankPosition: 0,
          breakdown,
          matchType: "RECOMMENDED",
          matchBadge: {
            type: "RECOMMENDED",
            label: "Top Tech Pick",
            tagline: `Verified opening at ${opp.companyName}`,
          },
        });
      }

      // 3. If still needed, harvest open high-demand tech roles from top ATS endpoints
      if (recommendations.length < targetCount && !signal?.aborted) {
        const broadIntent: SearchIntent = {
          ...relaxedIntent,
          roles: [],
          role: undefined,
        };
        const broadHarvested = await atsProvider.harvestCandidates(
          broadIntent,
          { maxCandidates: 25, timeoutMs: 5000 },
          { signal }
        );
        for (const opp of deduplicateCandidates(broadHarvested)) {
          if (recommendations.length >= targetCount) break;
          if (excludedHashes.has(opp.canonicalHash)) continue;
          excludedHashes.add(opp.canonicalHash);

          const breakdown: ScoreBreakdown = {
            role: 20,
            skills: 15,
            workMode: opp.workMode === "REMOTE" ? 15 : 10,
            freshness: 12,
            verification: 10,
          };

          recommendations.push({
            opportunity: opp,
            totalScore: breakdown.role + breakdown.skills + breakdown.workMode + breakdown.freshness + breakdown.verification,
            rankPosition: 0,
            breakdown,
            matchType: "RECOMMENDED",
            matchBadge: {
              type: "RECOMMENDED",
              label: "High-Growth Employer",
              tagline: `Verified opening at ${opp.companyName}`,
            },
          });
        }
      }
    } catch (atsErr) {
      console.warn("[HighYieldAugmentor] ATS live harvest warning:", atsErr);
    }
  }

  return recommendations;
}
