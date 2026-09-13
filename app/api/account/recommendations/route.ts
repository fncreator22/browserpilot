import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserProfile } from "@/lib/db/onboarding";
import { getUserPuterToken } from "@/lib/ai/governance/providerGovernance";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export interface RecommendationChip {
  label: string;
  goal: string;
  icon: "briefcase" | "layers" | "search" | "sparkles";
}

const DEFAULT_RECOMMENDATIONS: RecommendationChip[] = [
  {
    label: "Remote AI Internships (2026 Batch)",
    icon: "briefcase",
    goal: "Find remote AI and Machine Learning internships for 2026 graduates in India and US at high-growth startups.",
  },
  {
    label: "YC Startup Full Stack Roles",
    icon: "layers",
    goal: "Discover entry-level full stack and frontend engineering opportunities at Y Combinator companies with React and TypeScript.",
  },
  {
    label: "Data Analyst in Bengaluru (Last 30 Days)",
    icon: "search",
    goal: "Find data analyst in bengaluru in last 30 days.",
  },
  {
    label: "Staff & Lead Frontend Engineers",
    icon: "layers",
    goal: "Search for lead or staff frontend engineer opportunities with React, Next.js, and TypeScript.",
  },
];

function generateHeuristicRecommendations(profile: any, recentSearches: any[]): RecommendationChip[] {
  const chips: RecommendationChip[] = [];
  const primaryRole = profile?.preferredRoles?.[0] || recentSearches?.[0]?.parsedRole;
  const secondaryRole = profile?.preferredRoles?.[1];
  const primaryLoc = profile?.preferredLocations?.[0] || recentSearches?.[0]?.parsedLocation;
  const skills = profile?.targetSkills || [];
  const skillStr = skills.slice(0, 3).join(" and ");

  if (primaryRole) {
    if (primaryLoc) {
      chips.push({
        label: `${primaryRole} in ${primaryLoc}`,
        icon: "search",
        goal: `Search for verified ${primaryRole} opportunities in ${primaryLoc} posted in the last 14 days.`,
      });
    }

    chips.push({
      label: `Remote ${primaryRole} Roles`,
      icon: "briefcase",
      goal: `Find remote ${primaryRole} positions${skillStr ? ` requiring ${skillStr}` : ""} at high-growth tech companies.`,
    });
  }

  if (skills.length > 0) {
    chips.push({
      label: `Startups Hiring for ${skills[0]}`,
      icon: "layers",
      goal: `Discover venture-backed startup opportunities looking for ${skills.slice(0, 2).join(" & ")} skills with competitive compensation.`,
    });
  }

  if (secondaryRole) {
    chips.push({
      label: `${secondaryRole} Openings`,
      icon: "sparkles",
      goal: `Explore recent openings for ${secondaryRole} across top verified engineering platforms.`,
    });
  }

  let defIdx = 0;
  while (chips.length < 4 && defIdx < DEFAULT_RECOMMENDATIONS.length) {
    const candidate = DEFAULT_RECOMMENDATIONS[defIdx++];
    if (!chips.some((c) => c.label === candidate.label)) {
      chips.push(candidate);
    }
  }

  return chips.slice(0, 4);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUser = session?.user as any;
    let userId: string | null = sessionUser?.id || null;

    if (!userId && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
      userId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id");
    }

    if (!userId) {
      return NextResponse.json({
        recommendations: DEFAULT_RECOMMENDATIONS,
        personalized: false,
        source: "DEFAULT",
      });
    }

    const [profile, recentSearches, puterToken] = await Promise.all([
      getUserProfile(userId).catch(() => null),
      prisma.search
        .findMany({
          where: { userId },
          orderBy: { startedAt: "desc" },
          take: 5,
          select: { rawQuery: true, parsedRole: true, parsedLocation: true },
        })
        .catch(() => []),
      getUserPuterToken(userId).catch(() => null),
    ]);

    const hasProfileData = Boolean(
      profile &&
        (profile.preferredRoles.length > 0 ||
          profile.preferredLocations.length > 0 ||
          profile.targetSkills.length > 0)
    );

    if (puterToken && (hasProfileData || recentSearches.length > 0)) {
      try {
        const { callPuterChatCompletion } = await import("@/lib/ai/puterClient");
        const profileContext = [
          profile?.preferredRoles?.length ? `Target Roles: ${profile.preferredRoles.join(", ")}` : "",
          profile?.preferredLocations?.length ? `Target Locations: ${profile.preferredLocations.join(", ")}` : "",
          profile?.targetSkills?.length ? `Skills: ${profile.targetSkills.join(", ")}` : "",
          profile?.preferredWorkModes?.length ? `Work Modes: ${profile.preferredWorkModes.join(", ")}` : "",
          recentSearches.length > 0
            ? `Recent Searches: ${recentSearches.map((s: { rawQuery?: string | null }) => s.rawQuery).filter(Boolean).slice(0, 3).join("; ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        const prompt = `Based on the following candidate profile and search history, generate exactly 4 concise, diverse, high-value search query suggestions for job opportunities:
${profileContext}

Output strictly a JSON array with exactly 4 objects matching this format:
[
  {
    "label": "<Concise 3-5 word badge title>",
    "goal": "<Full natural language search prompt for the agent>",
    "icon": "briefcase" | "layers" | "search" | "sparkles"
  }
]`;

        const puterRes = await callPuterChatCompletion({
          token: puterToken,
          userId,
          operation: "PROMPT_ENHANCEMENT",
          messages: [
            {
              role: "system",
              content: "You are an opportunity recommendation intelligence subsystem. Output strictly a JSON array of 4 recommendation objects.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        });

        const cleanJson = puterRes.content.replace(/```json|```/gi, "").trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const validated = parsed.slice(0, 4).map((item: any) => ({
            label: String(item.label || "Opportunity Search").trim(),
            goal: String(item.goal || item.label).trim(),
            icon: ["briefcase", "layers", "search", "sparkles"].includes(item.icon) ? item.icon : "sparkles",
          }));

          return NextResponse.json({
            recommendations: validated,
            personalized: true,
            source: "PUTER",
          });
        }
      } catch (puterErr) {
        console.warn("[RecommendationsAPI] Puter dynamic generation fallback to heuristics:", puterErr);
      }
    }

    if (hasProfileData || recentSearches.length > 0) {
      const heuristicChips = generateHeuristicRecommendations(profile, recentSearches);
      return NextResponse.json({
        recommendations: heuristicChips,
        personalized: true,
        source: "PROFILE_HEURISTIC",
      });
    }

    return NextResponse.json({
      recommendations: DEFAULT_RECOMMENDATIONS,
      personalized: false,
      source: "DEFAULT",
    });
  } catch (error) {
    console.error("[RecommendationsAPI] Error generating recommendations:", error);
    return NextResponse.json({
      recommendations: DEFAULT_RECOMMENDATIONS,
      personalized: false,
      source: "DEFAULT",
    });
  }
}
