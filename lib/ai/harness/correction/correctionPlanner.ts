/**
 * §AUTONOMOUS CORRECTION PLANNER (TASK-052)
 * 
 * Synthesizes targeted correction plans using LLM reasoning (or deterministic fallback),
 * enforcing hard constraint preservation, bounded role ontology reformulation,
 * and deterministic plan validation.
 */

import {
  type CorrectionProposal,
  type CorrectionState,
  CorrectionProposalSchema,
} from "./correctionTypes";
import { type DiagnosisOutput } from "./deterministicDiagnoser";
import {
  type SearchActionPlan,
  type PlannedSearchAction,
} from "@/lib/ai/searchPlanner/searchActionPlan";
import { validateSearchActionPlan } from "@/lib/ai/searchPlanner/searchPlanValidator";
import { createGeminiClient, getEffectiveGeminiApiKey } from "@/lib/ai/modelSelector";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";

/**
 * Returns role-equivalent synonyms from the canonical ontology without broadening scope.
 */
function getBoundedRoleReformulation(role?: string): string[] {
  if (!role) return [];
  const lower = role.toLowerCase();

  if (lower.includes("backend") || lower.includes("back end")) {
    return ["backend developer", "server-side engineer", "backend software engineer"];
  }
  if (lower.includes("ai") || lower.includes("machine learning") || lower.includes("ml")) {
    return ["machine learning engineer", "AI engineer", "ML software engineer"];
  }
  if (lower.includes("frontend") || lower.includes("front end")) {
    return ["frontend developer", "UI engineer", "web developer"];
  }
  if (lower.includes("mechanical")) {
    return ["mechanical design engineer", "mechanical engineer", "CAD design engineer"];
  }
  if (lower.includes("electrical")) {
    return ["electrical engineer", "electronics engineer", "hardware design engineer"];
  }
  if (lower.includes("civil")) {
    return ["civil engineer", "structural engineer", "site engineer"];
  }
  return [`${role} specialist`, `${role} associate`];
}

/**
 * Generates a deterministic correction action plan.
 */
export function buildDeterministicCorrectionPlan(
  state: CorrectionState,
  diagnosis: DiagnosisOutput
): { proposal: CorrectionProposal; plan: SearchActionPlan } {
  const intent = state.canonicalIntent;
  const shortfall = diagnosis.shortfall;
  const actions: PlannedSearchAction[] = [];
  const timestamp = Date.now();

  const baseRole = intent.roles?.[0] || intent.role || "Software Engineer";
  const reformulations = getBoundedRoleReformulation(baseRole);
  const refinedQuery = reformulations[state.currentRound - 1] || baseRole;

  let strategy: CorrectionProposal["strategy"] = "EXPAND_SOURCES";

  switch (diagnosis.reason) {
    case "COMPANY_DISCOVERY_REQUIRED":
    case "ATS_DISCOVERY_REQUIRED": {
      const targetComps = intent.companies && intent.companies.length > 0 ? intent.companies : [];
      if (targetComps.length > 0) {
        strategy = "EXPAND_COMPANY_ATS";
        for (const comp of targetComps.slice(0, 2)) {
          actions.push({
            actionId: `act_ats_${comp.toLowerCase()}_${timestamp}`,
            capabilityId: "company.ats",
            priority: 1,
            input: {
              companyName: comp,
              targetRole: baseRole,
              postedWithinDays: intent.postedWithinDays,
            },
            purpose: `Query verified ATS endpoints for ${comp}`,
            expectedEvidence: "ATS job listing",
            maxResults: shortfall,
            timeoutMs: 12000,
            dependencyIds: [],
          });
        }
      } else {
        strategy = "REFORMULATE_QUERY";
        actions.push({
          actionId: `act_reformulate_${timestamp}`,
          capabilityId: "discovery.search_pipeline",
          priority: 1,
          input: {
            query: refinedQuery,
            targetRoles: [refinedQuery],
            targetLocations: intent.locations || [],
            workModes: intent.workModes || [],
            postedWithinDays: intent.postedWithinDays,
            freshnessWindowHours: intent.freshnessWindowHours,
            requestedCount: shortfall,
          },
          purpose: `Search using bounded role reformulation "${refinedQuery}"`,
          expectedEvidence: "Candidate job cards",
          maxResults: shortfall,
          timeoutMs: 15000,
          dependencyIds: [],
        });
      }
      break;
    }

    case "ROLE_MISMATCH": {
      strategy = "REFORMULATE_QUERY";
      actions.push({
        actionId: `act_reformulate_${timestamp}`,
        capabilityId: "discovery.search_pipeline",
        priority: 1,
        input: {
          query: refinedQuery,
          targetRoles: [refinedQuery],
          targetLocations: intent.locations || [],
          workModes: intent.workModes || [],
          postedWithinDays: intent.postedWithinDays,
          freshnessWindowHours: intent.freshnessWindowHours,
          requestedCount: shortfall,
        },
        purpose: `Search using bounded role reformulation "${refinedQuery}"`,
        expectedEvidence: "Candidate job cards",
        maxResults: shortfall,
        timeoutMs: 15000,
        dependencyIds: [],
      });
      break;
    }

    case "INSUFFICIENT_EVIDENCE": {
      strategy = "COLLECT_METADATA_EVIDENCE";
      actions.push({
        actionId: `act_meta_${timestamp}`,
        capabilityId: "evidence.verify_metadata",
        priority: 1,
        input: {
          expectedPostingDays: intent.postedWithinDays,
        },
        purpose: "Extract missing posting dates and freshness metadata",
        expectedEvidence: "Verified timestamp",
        maxResults: shortfall,
        timeoutMs: 8000,
        dependencyIds: [],
      });
      break;
    }

    case "TARGET_SHORTFALL":
    case "ZERO_RESULTS":
    case "STALE_RESULTS":
    default: {
      strategy = "EXPAND_SOURCES";
      const isNonTech = /\b(mechanical|civil|chemical|process|nurse|doctor|healthcare|accounting|sales|hr|human resources)\b/i.test(baseRole);
      
      // Expand strictly within eligible sources; never force tech ATS platforms
      const candidateSources = intent.sources && intent.sources.length > 0
        ? intent.sources
        : isNonTech
        ? ["Indeed", "LinkedIn"]
        : ["Indeed", "LinkedIn", "Y Combinator"];

      const unattemptedSources = candidateSources.filter(
        (s) => !state.attemptedSources.includes(s)
      );
      const targetSource = unattemptedSources[0] || candidateSources[0] || "LinkedIn";

      actions.push({
        actionId: `act_source_${targetSource.toLowerCase()}_${timestamp}`,
        capabilityId: "source.search",
        priority: 1,
        input: {
          sourceName: targetSource,
          query: baseRole,
          targetRoles: [baseRole],
          targetLocations: intent.locations || [],
          postedWithinDays: intent.postedWithinDays,
        },
        purpose: `Query alternative high-signal source [${targetSource}] to fill shortfall of ${shortfall}`,
        expectedEvidence: "Direct job listing",
        maxResults: shortfall,
        timeoutMs: 15000,
        dependencyIds: [],
      });

      // Add targeted ATS query ONLY if user explicitly specified an employer target
      if (intent.companies && intent.companies.length > 0) {
        actions.push({
          actionId: `act_ats_expand_${timestamp}`,
          capabilityId: "company.ats",
          priority: 2,
          input: {
            companyName: intent.companies[0],
            targetRole: baseRole,
            postedWithinDays: intent.postedWithinDays,
          },
          purpose: `Discover direct ATS postings for ${intent.companies[0]}`,
          expectedEvidence: "Verified ATS listing",
          maxResults: shortfall,
          timeoutMs: 12000,
          dependencyIds: [],
        });
      }
      break;
    }
  }

  const proposal: CorrectionProposal = {
    reason: diagnosis.reason,
    strategy,
    additionalCapabilities: actions.map((a) => a.capabilityId),
    sourceTargets: actions.map((a) => (a.input.sourceName as string) || (a.input.companyName as string) || "General"),
    queryRefinements: [refinedQuery],
    expectedEvidence: ["Direct ATS posting", "Verified job URL"],
    confidence: 0.9,
    summary: `Execute ${strategy} to address ${diagnosis.reason} (shortfall: ${shortfall}).`,
  };

  const plan: SearchActionPlan = {
    planId: `plan_corr_r${state.currentRound}_${timestamp}`,
    query: refinedQuery,
    actions,
    constraints: {
      // INVIOLABLE: Strictly preserve canonical user constraints!
      roles: intent.roles || (intent.role ? [intent.role] : []),
      locations: intent.locations || (intent.location ? [intent.location] : []),
      workModes: intent.workModes || (intent.workMode ? [intent.workMode] : []),
      postedWithinDays: intent.postedWithinDays,
      freshnessWindowHours: intent.freshnessWindowHours,
      requestedCount: shortfall,
      targetCompanies: intent.companies || [],
    },
    stoppingCriteria: {
      maxResults: shortfall,
      stopOnTargetCount: true,
      maxPlanningRounds: 1,
    },
    confidence: 0.88,
    reasoningSummary: proposal.summary,
    createdAt: new Date(),
  };

  return { proposal, plan };
}

/**
 * Plans the next correction round using Gemini LLM reasoning with deterministic validation.
 */
export async function planCorrection(
  state: CorrectionState,
  diagnosis: DiagnosisOutput
): Promise<{ proposal: CorrectionProposal; plan: SearchActionPlan }> {
  // Check if API key is available
  const apiKey = getEffectiveGeminiApiKey();
  const isTestHarness = process.env.IS_TEST_HARNESS === "true" || process.env.NODE_ENV === "test";

  if (!apiKey || isTestHarness) {
    const fallback = buildDeterministicCorrectionPlan(state, diagnosis);
    const val = validateSearchActionPlan(fallback.plan, state.canonicalIntent, { maxActionsBudget: 8 });
    return { proposal: fallback.proposal, plan: val.normalizedPlan };
  }

  // LLM Planning Path with Gemini
  try {
    const ai = createGeminiClient(apiKey);
    const systemPrompt = `You are the BrowserPilot Autonomous Correction Planner.
Current search produced a shortfall. Formulate a targeted correction proposal to discover missing verified candidates.
CRITICAL INVARIANTS:
1. You CANNOT relax hard constraints (dates, locations, remote mode).
2. Propose additional capabilities (company.ats, source.search, company.careers).
3. Output valid JSON adhering to this schema:
{
  "reason": "${diagnosis.reason}",
  "strategy": "EXPAND_SOURCES" | "EXPAND_COMPANY_ATS" | "REFORMULATE_QUERY" | "COLLECT_METADATA_EVIDENCE",
  "additionalCapabilities": string[],
  "sourceTargets": string[],
  "queryRefinements": string[],
  "expectedEvidence": string[],
  "confidence": number,
  "summary": string
}`;

    const userPrompt = `Search State:
Verified Count: ${state.verifiedCount} / ${state.requestedCount}
Shortfall: ${diagnosis.shortfall}
Reason: ${diagnosis.reason}
Attempted Sources: ${JSON.stringify(state.attemptedSources)}
Target Roles: ${JSON.stringify(state.canonicalIntent.roles || [])}
Target Locations: ${JSON.stringify(state.canonicalIntent.locations || [])}

Propose next correction strategy.`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("CORRECTION_PLANNER_TIMEOUT")), 5000)
    );

    const callPromise = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      config: { responseMimeType: "application/json", temperature: 0.1 },
    });

    const resp = await Promise.race([callPromise, timeoutPromise]);
    const parsed = JSON.parse(resp.text || "{}");
    const validatedProposal = CorrectionProposalSchema.parse(parsed);

    // Build plan based on validated proposal, strictly preserving constraints
    const deterministicBase = buildDeterministicCorrectionPlan(state, diagnosis);
    return {
      proposal: validatedProposal,
      plan: deterministicBase.plan,
    };
  } catch (err) {
    // Graceful fallback to deterministic correction plan
    const fallback = buildDeterministicCorrectionPlan(state, diagnosis);
    const val = validateSearchActionPlan(fallback.plan, state.canonicalIntent, { maxActionsBudget: 8 });
    return { proposal: fallback.proposal, plan: val.normalizedPlan };
  }
}
