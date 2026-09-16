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
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { getEffectiveGeminiApiKey, resolveGeminiApiKey, detectOptimalGeminiModel, DEFAULT_GEMINI_MODEL } from "@/lib/ai/modelSelector";
import { recordAIUsageEvent } from "@/lib/ai/governance/providerGovernance";
import { callPuterChatCompletion } from "@/lib/ai/puterClient";
import { callDeepSeekChatCompletion, resolveDeepSeekApiKey } from "@/lib/ai/deepseek";

export interface SearchPlannerOptions {
  userId?: string | null;
  allowedDomains?: string[];
  apiKeyOverride?: string;
  puterTokenOverride?: string;
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
    rawQuery: string | { rawQuery?: string; query?: string; intent?: SearchIntent; brainContext?: BrainContext; options?: SearchPlannerOptions },
    canonicalIntent?: SearchIntent,
    brainContext?: BrainContext,
    options: SearchPlannerOptions = {}
  ): Promise<SearchPlannerResult> {
    let resolvedRawQuery = "";
    let resolvedOptions = options;

    if (typeof rawQuery === "object" && rawQuery !== null) {
      resolvedRawQuery = rawQuery.rawQuery || rawQuery.query || "";
      resolvedOptions = { ...rawQuery.options, ...options };
    } else {
      resolvedRawQuery = rawQuery || "";
    }

    const rawQueryObj = typeof rawQuery === "object" && rawQuery !== null ? rawQuery : null;
    const resolvedIntent: SearchIntent = canonicalIntent || rawQueryObj?.intent || parseSearchIntent(resolvedRawQuery);
    const defaultBrainContext: BrainContext = {
      query: resolvedRawQuery,
      userId: resolvedOptions.userId || null,
      userContext: [],
      platformContext: [],
      searchContext: [],
      companyContext: [],
      roleSemantics: undefined,
      recommendations: [],
      queryReformulations: [],
      budgetMetrics: {
        totalItemsRetrieved: 0,
        itemsIncluded: 0,
        itemsFiltered: 0,
        estimatedTokens: 0,
        budgetLimit: 4000,
      },
      generatedAt: new Date(),
    };
    const resolvedBrainContext: BrainContext = brainContext || rawQueryObj?.brainContext || defaultBrainContext;

    const startTime = Date.now();
    const effectiveKey = await resolveGeminiApiKey(resolvedOptions.apiKeyOverride, resolvedOptions.userId);
    let effectiveDeepSeekKey: string | null = null;
    if (typeof window === "undefined") {
      try {
        effectiveDeepSeekKey = await resolveDeepSeekApiKey(resolvedOptions.apiKeyOverride, resolvedOptions.userId);
      } catch {}
    }
    let effectivePuterToken = resolvedOptions.puterTokenOverride;
    if (!effectivePuterToken && resolvedOptions.userId && typeof window === "undefined") {
      try {
        const { getUserPuterToken } = await import("@/lib/ai/governance/providerGovernance");
        effectivePuterToken = (await getUserPuterToken(resolvedOptions.userId)) || undefined;
      } catch {}
    }
    const hasDeepSeekKey = !!effectiveDeepSeekKey;
    const hasPuterToken = !!effectivePuterToken;
    const hasAnyModel = !!effectiveKey || hasDeepSeekKey || hasPuterToken;
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    let aiConfigurationStatus: SearchPlannerResult["aiConfigurationStatus"] =
      hasAnyModel ? "CONFIGURED" : "MODEL_CONFIGURATION_REQUIRED";
    let aiConfigurationMessage =
      hasAnyModel
        ? `AI model configuration active (${effectiveKey ? "Google Gemini" : hasDeepSeekKey ? "DeepSeek AI" : "Puter AI"}).`
        : "AI search planning is unavailable because the required model configuration is missing. Search will proceed using the deterministic engine.";

    if (resolvedOptions.requireAiPlanning && !hasAnyModel) {
      const err = new Error("MODEL_CONFIGURATION_REQUIRED: AI search planning is unavailable because the required model configuration is missing.");
      (err as any).category = "MODEL_CONFIGURATION_REQUIRED";
      throw err;
    }

    // Build Constraints from Canonical Intent
    const constraints: PlanConstraints = {
      roles: resolvedIntent.roles || (resolvedIntent.role ? [resolvedIntent.role] : []),
      locations: resolvedIntent.locations || (resolvedIntent.location ? [resolvedIntent.location] : []),
      workModes: resolvedIntent.workModes || (resolvedIntent.workMode ? [resolvedIntent.workMode] : []),
      postedWithinDays: resolvedIntent.postedWithinDays,
      freshnessWindowHours: resolvedIntent.freshnessWindowHours,
      requestedCount: resolvedIntent.requestedCount || 10,
      targetCompanies: resolvedIntent.companies || (resolvedIntent.company ? [resolvedIntent.company] : []),
      isExplicitFreshness: resolvedIntent.isExplicitFreshness,
    };

    let generatedPlan: SearchActionPlan | null = null;
    let modelTelemetry: SearchPlannerResult["modelTelemetry"] = undefined;

    // Check cancellation signal before model planning
    if (resolvedOptions.signal?.aborted) {
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

        const prompt = `User Query: "${resolvedRawQuery}"
Canonical Constraints: ${JSON.stringify(constraints)}
Brain Context:
- Target Companies: ${resolvedBrainContext.companyContext?.map((c) => c.item.companyName).join(", ") || "None"}
- Role Semantics: ${resolvedBrainContext.roleSemantics?.normalizedRole || "None"} (Synonyms: ${resolvedBrainContext.roleSemantics?.semanticSynonyms?.slice(0, 3).join(", ") || "None"})
- User Preferences: ${resolvedBrainContext.userContext?.map((u) => `${u.item.category}: ${u.item.value}`).join("; ") || "None"}
- Platform Knowledge: ${resolvedBrainContext.platformContext?.map((p) => p.item.memoryId).join(", ") || "None"}

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

        let effectiveModelUsed = modelName || DEFAULT_GEMINI_MODEL;
        let response;
        try {
          response = await ai.models.generateContent({
            model: effectiveModelUsed,
            contents: prompt,
            config: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          });
        } catch (mErr) {
          const { FALLBACK_GEMINI_MODEL, SECONDARY_FALLBACK_GEMINI_MODEL } = await import("@/lib/ai/modelSelector");
          console.warn(`[SearchPlanner] Primary model ${effectiveModelUsed} failed, attempting ${FALLBACK_GEMINI_MODEL}:`, mErr);
          effectiveModelUsed = FALLBACK_GEMINI_MODEL;
          try {
            response = await ai.models.generateContent({
              model: FALLBACK_GEMINI_MODEL,
              contents: prompt,
              config: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            });
          } catch (fbErr) {
            console.warn(`[SearchPlanner] Fallback ${FALLBACK_GEMINI_MODEL} failed, attempting ${SECONDARY_FALLBACK_GEMINI_MODEL}:`, fbErr);
            effectiveModelUsed = SECONDARY_FALLBACK_GEMINI_MODEL;
            response = await ai.models.generateContent({
              model: SECONDARY_FALLBACK_GEMINI_MODEL,
              contents: prompt,
              config: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            });
          }
        }

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
          const normalizedActions = rawActions.map((a: any) => ({
            ...a,
            dependencyIds: Array.isArray(a.dependencyIds) ? a.dependencyIds : [],
          }));
          generatedPlan = {
            ...parsed,
            actions: normalizedActions,
            planId,
            query: rawQuery,
            constraints,
            createdAt: new Date(),
          };
          modelTelemetry = {
            provider: "Google Gemini",
            modelName: effectiveModelUsed,
            durationMs: Date.now() - tModelStart,
            tokensUsed: response.usageMetadata?.totalTokenCount,
          };

          // Authoritative AI Usage Event Tracking (TASK-065)
          if (options.userId) {
            const usage = response.usageMetadata;
            await recordAIUsageEvent({
              userId: options.userId,
              provider: "Google Gemini",
              model: effectiveModelUsed,
              operation: "ACTION_PLANNING",
              inputTokens: usage?.promptTokenCount || 0,
              outputTokens: usage?.candidatesTokenCount || 0,
              totalTokens: usage?.totalTokenCount || 0,
              durationMs: Date.now() - tModelStart,
              status: "SUCCESS",
            }).catch((uErr) => console.warn("[SearchPlanner] Failed to record AI usage:", uErr));
          }
        }
      } catch (err: any) {
        if (options.signal?.aborted) {
          throw err;
        }
        console.warn("[SearchPlanner] Gemini model planning failed, falling back to deterministic planning:", err);
        if (options.userId) {
          const isQuota = err?.message?.includes("quota") || err?.status === 429;
          const status = isQuota ? "RATE_LIMITED" : "FAILED";
          await recordAIUsageEvent({
            userId: options.userId,
            provider: "Google Gemini",
            model: DEFAULT_GEMINI_MODEL,
            operation: "ACTION_PLANNING",
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            durationMs: 0,
            status,
            errorMessage: String(err?.message || err).slice(0, 500),
          }).catch((uErr) => console.warn("[SearchPlanner] Failed to record AI failure:", uErr));
        }
      }
    }

    // 2. DeepSeek-Based Planning (if user connected DEEPSEEK_BYOK or has active Puter session)
    if (!generatedPlan && (effectiveDeepSeekKey || effectivePuterToken) && !process.env.IS_TEST_HARNESS) {
      try {
        const prompt = `User Query: "${resolvedRawQuery}"
Canonical Constraints: ${JSON.stringify(constraints)}
Brain Context:
- Target Companies: ${resolvedBrainContext.companyContext?.map((c) => c.item.companyName).join(", ") || "None"}
- Role Semantics: ${resolvedBrainContext.roleSemantics?.normalizedRole || "None"} (Synonyms: ${resolvedBrainContext.roleSemantics?.semanticSynonyms?.slice(0, 3).join(", ") || "None"})
- User Preferences: ${resolvedBrainContext.userContext?.map((u) => `${u.item.category}: ${u.item.value}`).join("; ") || "None"}
- Platform Knowledge: ${resolvedBrainContext.platformContext?.map((p) => p.item.memoryId).join(", ") || "None"}

Generate an optimal search plan using available capabilities:
- discovery.search_pipeline
- source.search
- company.lookup
- company.ats
- company.careers
- browser.authenticated_search
- evidence.verify_url
- evidence.verify_metadata

Return strictly valid JSON adhering to SearchActionPlan schema.`;

        const dsRes = await callDeepSeekChatCompletion({
          apiKey: effectiveDeepSeekKey,
          puterToken: effectivePuterToken,
          userId: resolvedOptions.userId || undefined,
          operation: "ACTION_PLANNING",
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "You are BrowserPilot's DeepSeek search planner. Generate strictly valid JSON for a SearchActionPlan matching the user request with fields: query, constraints, actions (array of objects with actionId, capability, parameters, rationale, dependencyIds: string[]).",
            },
            { role: "user", content: prompt },
          ],
        });

        const rawText = dsRes.content;
        const cleanJson = rawText.replace(/```json|```/gi, "").trim();
        const parsed = JSON.parse(cleanJson);

        const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
        const normalizedActions = rawActions.map((a: any, idx: number) => ({
          actionId: a.actionId || `act_${idx + 1}`,
          capabilityId: a.capabilityId || a.capability || "discovery.search_pipeline",
          priority: typeof a.priority === "number" ? Math.min(Math.max(a.priority, 1), 10) : 1,
          input: a.input || a.parameters || {},
          purpose: a.purpose || a.rationale || "Discover matching opportunities",
          expectedEvidence: a.expectedEvidence || "Job vacancy postings and direct application URLs",
          maxResults: typeof a.maxResults === "number" ? a.maxResults : 10,
          timeoutMs: typeof a.timeoutMs === "number" ? a.timeoutMs : 15000,
          dependencyIds: Array.isArray(a.dependencyIds) ? a.dependencyIds : [],
        }));

        if (normalizedActions.length === 0) {
          normalizedActions.push({
            actionId: "act_1",
            capabilityId: "discovery.search_pipeline",
            priority: 1,
            input: { query: resolvedRawQuery, targetRoles: constraints.roles, targetLocations: constraints.locations },
            purpose: "Execute unified search pipeline",
            expectedEvidence: "Verified job vacancies",
            maxResults: 10,
            timeoutMs: 15000,
            dependencyIds: [],
          });
        }

        generatedPlan = {
          ...parsed,
          planId,
          query: resolvedRawQuery,
          actions: normalizedActions,
          constraints: parsed.constraints || constraints,
          stoppingCriteria: parsed.stoppingCriteria || { maxResults: 10, stopOnTargetCount: true, maxPlanningRounds: 2 },
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
          reasoningSummary: (parsed.reasoningSummary || parsed.reasoning || "Generated dynamic DeepSeek search plan").slice(0, 500),
          createdAt: new Date(),
        };

        modelTelemetry = {
          provider: "DeepSeek AI",
          modelName: "deepseek-chat",
          durationMs: dsRes.durationMs,
          tokensUsed: dsRes.totalTokens,
        };
      } catch (err) {
        if (resolvedOptions.signal?.aborted) {
          throw err;
        }
        console.warn("[SearchPlanner] DeepSeek model planning failed, attempting next available planner:", err);
      }
    }

    // 3. Puter-Based Planning (if user connected Puter and Gemini/DeepSeek was not used or failed)
    if (!generatedPlan && effectivePuterToken && !process.env.IS_TEST_HARNESS) {
      try {
        const prompt = `User Query: "${resolvedRawQuery}"
Canonical Constraints: ${JSON.stringify(constraints)}
Brain Context:
- Target Companies: ${resolvedBrainContext.companyContext?.map((c) => c.item.companyName).join(", ") || "None"}
- Role Semantics: ${resolvedBrainContext.roleSemantics?.normalizedRole || "None"} (Synonyms: ${resolvedBrainContext.roleSemantics?.semanticSynonyms?.slice(0, 3).join(", ") || "None"})
- User Preferences: ${resolvedBrainContext.userContext?.map((u) => `${u.item.category}: ${u.item.value}`).join("; ") || "None"}
- Platform Knowledge: ${resolvedBrainContext.platformContext?.map((p) => p.item.memoryId).join(", ") || "None"}

Generate an optimal search plan using available capabilities:
- discovery.search_pipeline
- source.search
- company.lookup
- company.ats
- company.careers
- browser.authenticated_search
- evidence.verify_url
- evidence.verify_metadata

Return strictly valid JSON adhering to SearchActionPlan schema.`;

        const puterRes = await callPuterChatCompletion({
          token: effectivePuterToken,
          userId: resolvedOptions.userId || undefined,
          operation: "ACTION_PLANNING",
          messages: [
            {
              role: "system",
              content:
                "You are BrowserPilot's search planner. Generate strictly valid JSON for a SearchActionPlan matching the user request with fields: query, constraints, actions (array of objects with actionId, capability, parameters, rationale, dependencyIds: string[]).",
            },
            { role: "user", content: prompt },
          ],
        });

        const rawText = puterRes.content;
        const cleanJson = rawText.replace(/```json|```/gi, "").trim();
        const parsed = JSON.parse(cleanJson);

        const rawActions = Array.isArray(parsed.actions) ? parsed.actions : [];
        const normalizedActions = rawActions.map((a: any, idx: number) => ({
          actionId: a.actionId || `act_${idx + 1}`,
          capabilityId: a.capabilityId || a.capability || "discovery.search_pipeline",
          priority: typeof a.priority === "number" ? Math.min(Math.max(a.priority, 1), 10) : 1,
          input: a.input || a.parameters || {},
          purpose: a.purpose || a.rationale || "Discover matching opportunities",
          expectedEvidence: a.expectedEvidence || "Job vacancy postings and direct application URLs",
          maxResults: typeof a.maxResults === "number" ? a.maxResults : 10,
          timeoutMs: typeof a.timeoutMs === "number" ? a.timeoutMs : 15000,
          dependencyIds: Array.isArray(a.dependencyIds) ? a.dependencyIds : [],
        }));

        if (normalizedActions.length === 0) {
          normalizedActions.push({
            actionId: "act_1",
            capabilityId: "discovery.search_pipeline",
            priority: 1,
            input: { query: resolvedRawQuery, targetRoles: constraints.roles, targetLocations: constraints.locations },
            purpose: "Execute unified search pipeline",
            expectedEvidence: "Verified job vacancies",
            maxResults: 10,
            timeoutMs: 15000,
            dependencyIds: [],
          });
        }

        generatedPlan = {
          ...parsed,
          planId,
          query: resolvedRawQuery,
          actions: normalizedActions,
          constraints: parsed.constraints || constraints,
          stoppingCriteria: parsed.stoppingCriteria || { maxResults: 10, stopOnTargetCount: true, maxPlanningRounds: 2 },
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.9,
          reasoningSummary: (parsed.reasoningSummary || parsed.reasoning || "Generated dynamic search action plan").slice(0, 500),
          createdAt: new Date(),
        };

        modelTelemetry = {
          provider: "Puter AI",
          modelName: puterRes.modelUsed,
          durationMs: puterRes.durationMs,
          tokensUsed: puterRes.totalTokens,
        };
      } catch (err) {
        if (resolvedOptions.signal?.aborted) {
          throw err;
        }
        console.warn("[SearchPlanner] Puter AI planning failed or quota exhausted, falling back to deterministic planning:", err);
      }
    }

    // 3. Deterministic Strategy Synthesis (Autonomous Fallback)
    if (!generatedPlan) {
      generatedPlan = this.synthesizeDeterministicPlan(planId, resolvedRawQuery, constraints, resolvedBrainContext);
      modelTelemetry = {
        provider: "Deterministic Intelligence Engine",
        modelName: "browserpilot-rule-planner-v1",
        durationMs: Date.now() - startTime,
      };
    }

    // 3. Deterministic Plan Validation & Constraint Normalization
    const validation = validateSearchActionPlan(generatedPlan, resolvedIntent, {
      userId: resolvedOptions.userId,
      allowedDomains: resolvedOptions.allowedDomains,
      maxActionsBudget: resolvedOptions.maxActionsBudget || 10,
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
      const compInfo = brainContext.companyContext?.find(
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
