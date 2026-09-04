/**
 * §CANONICAL SEARCH PLANNER (TASK-050)
 * 
 * Synthesizes a structured, capability-aware SearchActionPlan from natural-language queries,
 * canonical search intent, and multi-source BrainContext.
 */

import { GoogleGenAI } from "@google/genai";
import {
  type SearchActionPlan,
  type PlannedSearchAction,
  type PlanConstraints,
} from "./searchActionPlan";
import { validateSearchActionPlan, type PlanValidationResult } from "./searchPlanValidator";
import { type BrainContext } from "@/lib/ai/brain/brainTypes";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";
import { getEffectiveGeminiApiKey, detectOptimalGeminiModel, DEFAULT_GEMINI_MODEL } from "@/lib/ai/modelSelector";
import { recordAIUsageEvent } from "@/lib/ai/governance/providerGovernance";

export interface SearchPlannerOptions {
  userId?: string | null;
  allowedDomains?: string[];
  apiKeyOverride?: string;
  maxActionsBudget?: number;
  requireAiPlanning?: boolean;
  signal?: AbortSignal;
}

export interface SearchPlannerResult {
  plan: SearchActionPlan;
  validation: PlanValidationResult;
  modelTelemetry?: {
    provider: string;
    modelName: string;
    durationMs: number;
    tokensUsed?: number;
  };
  aiConfigurationStatus?: "CONFIGURED" | "MODEL_CONFIGURATION_REQUIRED" | "DETERMINISTIC_ONLY";
  aiConfigurationMessage?: string;
}

export class SearchPlanner {
  /**
   * Generates a validated SearchActionPlan from user query, intent, and BrainContext.
   */
  public async planSearch(
    rawQuery: string,
    canonicalIntent: SearchIntent,
    brainContext: BrainContext,
    options: SearchPlannerOptions = {}
  ): Promise<SearchPlannerResult> {
    const startTime = Date.now();
    const effectiveKey = getEffectiveGeminiApiKey(options.apiKeyOverride);
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    let aiConfigurationStatus: SearchPlannerResult["aiConfigurationStatus"] = effectiveKey ? "CONFIGURED" : "MODEL_CONFIGURATION_REQUIRED";
    let aiConfigurationMessage = effectiveKey
      ? "AI model configuration active."
      : "AI search planning is unavailable because the required model configuration is missing. Search will proceed using the deterministic engine.";

    if (options.requireAiPlanning && !effectiveKey) {
      const err = new Error("MODEL_CONFIGURATION_REQUIRED: AI search planning is unavailable because the required model configuration is missing.");
      (err as any).category = "MODEL_CONFIGURATION_REQUIRED";
      throw err;
    }

    // Build Constraints from Canonical Intent
    const constraints: PlanConstraints = {
      roles: canonicalIntent.roles || (canonicalIntent.role ? [canonicalIntent.role] : []),
      locations: canonicalIntent.locations || (canonicalIntent.location ? [canonicalIntent.location] : []),
      workModes: canonicalIntent.workModes || (canonicalIntent.workMode ? [canonicalIntent.workMode] : []),
      postedWithinDays: canonicalIntent.postedWithinDays,
      freshnessWindowHours: canonicalIntent.freshnessWindowHours,
      requestedCount: canonicalIntent.requestedCount || 10,
      targetCompanies: canonicalIntent.companies || (canonicalIntent.company ? [canonicalIntent.company] : []),
      isExplicitFreshness: canonicalIntent.isExplicitFreshness,
    };

    let generatedPlan: SearchActionPlan | null = null;
    let modelTelemetry: SearchPlannerResult["modelTelemetry"] = undefined;

    // Check cancellation signal before model planning
    if (options.signal?.aborted) {
      const abortErr = new Error("Search planning cancelled by user.");
      abortErr.name = "AbortError";
      throw abortErr;
    }

    // 1. Model-Based Planning (if API key available)
    if (effectiveKey && !process.env.IS_TEST_HARNESS) {
      try {
        const ai = new GoogleGenAI({ apiKey: effectiveKey });
        const modelName = await detectOptimalGeminiModel(effectiveKey);
        const tModelStart = Date.now();

        const prompt = `User Query: "${rawQuery}"
Canonical Constraints: ${JSON.stringify(constraints)}
Brain Context:
- Target Companies: ${brainContext.companyContext.map((c) => c.item.companyName).join(", ") || "None"}
- Role Semantics: ${brainContext.roleSemantics?.normalizedRole || "None"} (Synonyms: ${brainContext.roleSemantics?.semanticSynonyms.slice(0, 3).join(", ") || "None"})
- User Preferences: ${brainContext.userContext.map((u) => `${u.item.category}: ${u.item.value}`).join("; ") || "None"}
- Platform Knowledge: ${brainContext.platformContext.map((p) => p.item.memoryId).join(", ") || "None"}

Generate an optimal search plan using available capabilities:
- discovery.search_pipeline
- source.search
- company.lookup
- company.ats
- company.careers
- browser.authenticated_search
- evidence.verify_url
- evidence.verify_metadata

Return JSON adhering to SearchActionPlan schema.`;

        const response = await ai.models.generateContent({
          model: modelName || DEFAULT_GEMINI_MODEL,
          contents: prompt,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          generatedPlan = {
            ...parsed,
            planId,
            query: rawQuery,
            constraints,
            createdAt: new Date(),
          };
          modelTelemetry = {
            provider: "Google Gemini",
            modelName: modelName || DEFAULT_GEMINI_MODEL,
            durationMs: Date.now() - tModelStart,
            tokensUsed: response.usageMetadata?.totalTokenCount,
          };

          // Authoritative AI Usage Event Tracking (TASK-065)
          if (options.userId) {
            const usage = response.usageMetadata;
            await recordAIUsageEvent({
              userId: options.userId,
              provider: "Google Gemini",
              model: modelName || DEFAULT_GEMINI_MODEL,
              operation: "ACTION_PLANNING",
              inputTokens: usage?.promptTokenCount || 0,
              outputTokens: usage?.candidatesTokenCount || 0,
              totalTokens: usage?.totalTokenCount || 0,
              durationMs: Date.now() - tModelStart,
              status: "SUCCESS",
            }).catch((uErr) => console.warn("[SearchPlanner] Failed to record AI usage:", uErr));
          }
        }
      } catch (err) {
        if (options.signal?.aborted) {
          throw err;
        }
        console.warn("[SearchPlanner] Gemini model planning failed, falling back to deterministic planning:", err);
      }
    }

    // 2. Deterministic Strategy Synthesis (Autonomous Fallback)
    if (!generatedPlan) {
      generatedPlan = this.synthesizeDeterministicPlan(planId, rawQuery, constraints, brainContext);
      modelTelemetry = {
        provider: "Deterministic Intelligence Engine",
        modelName: "browserpilot-rule-planner-v1",
        durationMs: Date.now() - startTime,
      };
    }

    // 3. Deterministic Plan Validation & Constraint Normalization
    const validation = validateSearchActionPlan(generatedPlan, canonicalIntent, {
      userId: options.userId,
      allowedDomains: options.allowedDomains,
      maxActionsBudget: options.maxActionsBudget || 10,
    });

    return {
      plan: validation.normalizedPlan,
      validation,
      modelTelemetry,
      aiConfigurationStatus,
      aiConfigurationMessage,
    };
  }

  /**
   * Generates a high-signal deterministic action plan tailored to query domain and context.
   */
  public synthesizeDeterministicPlan(
    planId: string,
    rawQuery: string,
    constraints: PlanConstraints,
    brainContext: BrainContext
  ): SearchActionPlan {
    const actions: PlannedSearchAction[] = [];
    const isCompanySpecific = constraints.targetCompanies && constraints.targetCompanies.length > 0;
    const requestedCount = constraints.requestedCount || 10;
    const postedWithinDays = constraints.postedWithinDays || 15;

    if (isCompanySpecific) {
      const company = constraints.targetCompanies![0];
      const compInfo = brainContext.companyContext.find(
        (c) => c.item.companyName.toLowerCase() === company.toLowerCase()
      );

      // Action 1: Company Intelligence & Career Portal Discovery
      actions.push({
        actionId: "act_1_company_lookup",
        capabilityId: "company.lookup",
        priority: 1,
        input: { companyName: company },
        purpose: `Discover verified career portals and ATS endpoint for ${company}`,
        expectedEvidence: "Company career URL and ATS provider mapping",
        maxResults: 1,
        timeoutMs: 5000,
        dependencyIds: [],
      });

      // Action 2: Direct Company ATS or Career Discovery
      actions.push({
        actionId: "act_2_company_ats",
        capabilityId: "company.ats",
        priority: 2,
        input: {
          companyName: company,
          atsProvider: compInfo?.item.atsProvider || "GREENHOUSE",
        },
        purpose: `Query official ATS listings for ${company}`,
        expectedEvidence: "Direct ATS opportunity URLs",
        maxResults: requestedCount,
        timeoutMs: 10000,
        dependencyIds: ["act_1_company_lookup"],
      });

      // Action 3: Targeted Search Pipeline
      actions.push({
        actionId: "act_3_search_pipeline",
        capabilityId: "discovery.search_pipeline",
        priority: 3,
        input: {
          query: rawQuery,
          requestedCount,
          postedWithinDays,
          targetCompanies: [company],
        },
        purpose: `Harvest job opportunities for ${company}`,
        expectedEvidence: "Direct job opportunities with posting dates",
        maxResults: requestedCount,
        timeoutMs: 15000,
        dependencyIds: ["act_2_company_ats"],
      });

      // Action 4: Evidence URL Verification
      actions.push({
        actionId: "act_4_evidence_verify",
        capabilityId: "evidence.verify_url",
        priority: 4,
        input: {
          url: compInfo?.item.officialCareerUrl || `https://${company.toLowerCase()}.com/jobs`,
          companyName: company,
        },
        purpose: "Verify direct job detail classification",
        expectedEvidence: "Exact job classification confirmation",
        maxResults: 1,
        timeoutMs: 5000,
        dependencyIds: ["act_3_search_pipeline"],
      });

      return {
        planId,
        query: rawQuery,
        actions,
        constraints,
        stoppingCriteria: {
          maxResults: requestedCount,
          stopOnTargetCount: true,
          maxPlanningRounds: 2,
        },
        confidence: 0.95,
        reasoningSummary: `Prioritize verified company ATS endpoints and official career discovery for target employer [${company}].`,
        createdAt: new Date(),
      };
    }

    // Generic Search Pipeline
    // Action 1: Multi-Source Swarm Search Pipeline
    actions.push({
      actionId: "act_1_search_pipeline",
      capabilityId: "discovery.search_pipeline",
      priority: 1,
      input: {
        query: rawQuery,
        requestedCount,
        postedWithinDays,
        targetLocations: constraints.locations,
        targetRoles: constraints.roles,
        workModes: constraints.workModes,
      },
      purpose: "Harvest multi-source opportunities matching role and date criteria",
      expectedEvidence: "Direct job detail URLs with posting date metadata",
      maxResults: requestedCount,
      timeoutMs: 15000,
      dependencyIds: [],
    });

    // Action 2: Evidence URL Verification
    actions.push({
      actionId: "act_2_evidence_verify",
      capabilityId: "evidence.verify_url",
      priority: 2,
      input: {
        url: "https://example.com/job/sample-id",
        expectedTitle: constraints.roles?.[0] || "Target Role",
      },
      purpose: "Verify candidate job URLs against exact posting criteria",
      expectedEvidence: "Validated job URL classification",
      maxResults: requestedCount,
      timeoutMs: 5000,
      dependencyIds: ["act_1_search_pipeline"],
    });

    return {
      planId,
      query: rawQuery,
      actions,
      constraints,
      stoppingCriteria: {
        maxResults: requestedCount,
        stopOnTargetCount: true,
        maxPlanningRounds: 2,
      },
      confidence: 0.9,
      reasoningSummary: `Execute multi-source swarm discovery for [${constraints.roles?.join(", ") || "roles"}] in [${constraints.locations?.join(", ") || "locations"}] posted within ${postedWithinDays} days.`,
      createdAt: new Date(),
    };
  }
}

export const searchPlanner = new SearchPlanner();
