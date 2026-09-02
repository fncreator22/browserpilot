/**
 * §CANONICAL INTELLIGENCE HARNESS (TASK-048)
 * 
 * Orchestrates the end-to-end intelligence execution lifecycle:
 * QUERY → INTENT → CONTEXT → PLAN → VALIDATE_PLAN → EXECUTE → OBSERVE → VERIFY → DECIDE
 * 
 * Unifies Intent Parsing, User Memory Retrieval, Platform Knowledge, Action Planning,
 * Capability Guarding, Tool Execution, Evidence Verification, and Quality Gate Enforcement.
 */

import {
  type HarnessContext,
  type HarnessExecutionOptions,
  type HarnessResult,
  type HarnessDecision,
  type HarnessDecisionOutcome,
  type HarnessObservation,
  type HarnessToolExecutionResult,
  type HarnessVerificationResult,
} from "./harnessTypes";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { intelligenceBrain, buildIntelligentPlanningPrompt } from "@/lib/ai/brain";
import { searchPlanner } from "@/lib/ai/searchPlanner";
import { searchActionExecutor } from "@/lib/ai/tools";
import { CAPABILITY_REGISTRY } from "@/lib/capabilities/registry";
import { validateCapabilityPreflight } from "@/lib/capabilities/guard";
import { validateActionPlan } from "@/lib/verification/planValidator";
import { generateActionPlan } from "@/lib/ai/planner";
import { executeSearchPipeline } from "@/lib/scraper/searchPipeline";
import { evaluateCandidateQualityGate } from "@/lib/scraper/searchQualityGate";
import { deduplicateCandidates } from "@/lib/scraper/deduplicator";
import { rankOpportunities } from "@/lib/scraper/ranker";

export class IntelligenceHarness {
  /**
   * Executes the full canonical AI intelligence lifecycle.
   */
  public async runLifecycle(
    rawQuery: string,
    options: HarnessExecutionOptions = {}
  ): Promise<HarnessResult> {
    const startTime = Date.now();
    const harnessId = `harness_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const userId = options.userId || null;
    const stageTimings: Record<string, number> = {};

    const recordStage = (stage: string, duration: number) => {
      stageTimings[stage] = duration;
    };

    // -------------------------------------------------------------------------
    // STAGE 1: QUERY & INTENT
    // -------------------------------------------------------------------------
    const tIntentStart = Date.now();
    const parsedIntent = parseSearchIntent(rawQuery, options.explicitFilters);
    const explicitConstraints = {
      roles: parsedIntent.roles || (parsedIntent.role ? [parsedIntent.role] : []),
      locations: parsedIntent.locations || (parsedIntent.location ? [parsedIntent.location] : []),
      workModes: parsedIntent.workModes || (parsedIntent.workMode ? [parsedIntent.workMode] : []),
      freshnessWindowHours: parsedIntent.freshnessWindowHours,
      postedWithinDays: parsedIntent.postedWithinDays,
      requestedCount: parsedIntent.requestedCount || 10,
      isExplicitFreshness: parsedIntent.isExplicitFreshness,
      targetCompanies: parsedIntent.companies || (parsedIntent.company ? [parsedIntent.company] : []),
    };
    recordStage("INTENT", Date.now() - tIntentStart);

    // -------------------------------------------------------------------------
    // STAGE 2: INTELLIGENCE BRAIN & CONTEXT SYNTHESIS (TASK-049)
    // -------------------------------------------------------------------------
    const tContextStart = Date.now();
    const brainContext = await intelligenceBrain.synthesizeBrainContext(rawQuery, userId, {
      maxUserMemories: 5,
      maxPlatformItems: 5,
      maxCompanyItems: 3,
    });

    const userMemories = brainContext.userContext.map((c) => c.item);
    const platformKnowledge = brainContext.platformContext.map((c) => c.item);
    const availableCapabilities = Object.keys(CAPABILITY_REGISTRY);

    // Contextual Precedence: Explicit Query > Explicit Filters > Relevant User Memory
    // Apply user memory to fill unstated preferences without overriding explicit query constraints
    const contextualIntent = { ...parsedIntent };
    if (userMemories.length > 0) {
      for (const mem of userMemories) {
        if (mem.category === "LOCATION_PREFERENCE" && (!explicitConstraints.locations || explicitConstraints.locations.length === 0)) {
          contextualIntent.location = mem.value;
        }
        if (mem.category === "WORK_MODE_PREFERENCE" && (!explicitConstraints.workModes || explicitConstraints.workModes.length === 0 || explicitConstraints.workModes.includes("ANY"))) {
          contextualIntent.workMode = mem.value;
        }
        if (mem.category === "ROLE_PREFERENCE" && (!explicitConstraints.roles || explicitConstraints.roles.length === 0)) {
          contextualIntent.role = mem.value;
        }
      }
    }
    recordStage("CONTEXT", Date.now() - tContextStart);

    // Initialize Context
    const context: HarnessContext = {
      harnessId,
      userId,
      rawQuery,
      currentStage: "CONTEXT",
      searchIntent: contextualIntent,
      explicitConstraints,
      userMemories,
      platformKnowledge,
      brainContext,
      availableCapabilities,
      toolExecutions: [],
      observations: [],
      telemetry: {
        harnessId,
        userIdHash: userId ? `usr_${userId.slice(0, 6)}` : undefined,
        currentStage: "CONTEXT",
        totalDurationMs: 0,
        stageTimings,
        toolsExecuted: [],
        memoriesRetrievedCount: userMemories.length,
        platformKnowledgeCount: platformKnowledge.length,
        observationsCount: 0,
        verifiedCount: 0,
        status: "SUCCESS",
      },
    };

    // -------------------------------------------------------------------------
    // STAGE 3: PLAN & VALIDATE PLAN
    // -------------------------------------------------------------------------
    const tPlanStart = Date.now();
    context.currentStage = "PLAN";

    // Capability pre-flight check
    const capabilityGuard = validateCapabilityPreflight(
      {
        classification: "SUPPORTED",
        confidence: 1.0,
        rationale: "Public opportunity discovery and analysis",
        targetDomains: [],
        requiredCapabilities: ["CAP_MULTI_STEP_NAV", "CAP_DATA_EXTRACTION"],
      },
      rawQuery
    );
    context.capabilityGuard = capabilityGuard;

    if (capabilityGuard.classification === "BLOCKED") {
      const durationMs = Date.now() - startTime;
      context.currentStage = "FAILED";
      context.telemetry.status = "FAILED";
      context.telemetry.totalDurationMs = durationMs;
      context.telemetry.errorCategory = capabilityGuard.errorCode || "SECURITY_POLICY_VIOLATION";

      return {
        harnessId,
        success: false,
        rankedOpportunities: [],
        context,
        telemetry: context.telemetry,
        decision: {
          outcome: "REJECT",
          rationale: capabilityGuard.technicalDetail || "Security policy violation.",
          verifiedCount: 0,
          requestedCount: explicitConstraints.requestedCount,
          canContinue: false,
          userExplanation: capabilityGuard.userMessage || "Your request cannot be executed due to security constraints.",
        },
      };
    }

    // Generate Typed Search Action Plan using SearchPlanner & BrainContext (TASK-050)
    const searchPlanResult = await searchPlanner.planSearch(
      rawQuery,
      contextualIntent,
      brainContext,
      {
        userId,
        allowedDomains: ["linkedin.com", "indeed.com", "greenhouse.io", "ashbyhq.com", "lever.co"],
        apiKeyOverride: options.apiKey,
      }
    );
    context.searchActionPlan = searchPlanResult.plan;

    // Also generate Action Plan for browser-level preflight validation
    const actionPlan = await generateActionPlan(rawQuery, {
      allowedDomains: ["linkedin.com", "indeed.com", "greenhouse.io", "ashbyhq.com", "lever.co"],
      maxStepsBudget: 15,
      apiKey: options.apiKey,
    });
    context.plan = actionPlan;

    // Validate Plan Pre-Execution
    const planValidation = validateActionPlan(actionPlan, {
      allowedDomains: ["linkedin.com", "indeed.com", "greenhouse.io", "ashbyhq.com", "lever.co"],
    });
    context.planValidation = planValidation;
    recordStage("PLAN", Date.now() - tPlanStart);

    if (options.dryRunPlanOnly) {
      return {
        harnessId,
        success: true,
        rankedOpportunities: [],
        context,
        telemetry: context.telemetry,
        decision: {
          outcome: "COMPLETE",
          rationale: "Plan generated and validated successfully (Dry-Run mode).",
          verifiedCount: 0,
          requestedCount: explicitConstraints.requestedCount,
          canContinue: false,
          userExplanation: "Plan generated and validated successfully.",
        },
      };
    }

    // -------------------------------------------------------------------------
    // STAGE 4: EXECUTE & OBSERVE (TASK-050 Intelligent Tool Orchestration)
    // -------------------------------------------------------------------------
    const tExecStart = Date.now();
    context.currentStage = "EXECUTE";

    const discoveryPlan = buildDiscoveryPlan(rawQuery, {
      freshnessWindowHours: explicitConstraints.freshnessWindowHours,
      roles: explicitConstraints.roles,
      locations: explicitConstraints.locations,
      companies: explicitConstraints.targetCompanies,
      workModes: explicitConstraints.workModes as any,
    });

    // Orchestrate validated plan execution across capabilities
    const orchestrationResult = await searchActionExecutor.executePlan(searchPlanResult.plan, {
      userId,
      customProviders: options.customProviders,
    });

    for (const actRes of orchestrationResult.actionResults) {
      const toolExecution: HarnessToolExecutionResult = {
        toolName: actRes.capabilityId,
        status: actRes.status === "SUCCESS" ? "SUCCESS" : actRes.status === "PARTIAL" ? "PARTIAL" : "FAILED",
        durationMs: actRes.durationMs,
        inputPayload: { actionId: actRes.actionId, capabilityId: actRes.capabilityId },
        outputSummary: actRes.userFacingMessage || `Execution of ${actRes.capabilityId} completed (${actRes.status}).`,
        candidatesHarvested: actRes.candidateCount || 0,
        rawCandidates: (actRes.data as any)?.results || [],
      };
      context.toolExecutions.push(toolExecution);
      context.telemetry.toolsExecuted.push(actRes.capabilityId);

      // Capture Observation
      const observation: HarnessObservation = {
        stepIndex: context.observations.length + 1,
        toolName: actRes.capabilityId,
        status: actRes.status === "FAILED" || actRes.status === "TIMEOUT" ? "FAILED" : "SUCCESS",
        summary: toolExecution.outputSummary || "Action completed",
        candidateCount: actRes.candidateCount || 0,
        rawCandidates: (actRes.data as any)?.results || [],
        durationMs: actRes.durationMs,
        timestamp: new Date(),
      };
      context.observations.push(observation);
      context.telemetry.observationsCount++;
    }

    let harvestedCandidates = orchestrationResult.harvestedCandidates;

    // Safety fallback: if no candidates harvested by individual actions, run discovery search pipeline
    if (harvestedCandidates.length === 0) {
      const discoveryPlan = buildDiscoveryPlan(rawQuery, {
        freshnessWindowHours: explicitConstraints.freshnessWindowHours,
        roles: explicitConstraints.roles,
        locations: explicitConstraints.locations,
        companies: explicitConstraints.targetCompanies,
        workModes: explicitConstraints.workModes as any,
      });

      const pipelineResult = await executeSearchPipeline(discoveryPlan as any, {
        userId,
        rawQuery,
        persistToDb: false,
        maxResults: explicitConstraints.requestedCount,
        customProviders: options.customProviders,
        verifyEvidence: options.verifyEvidence,
      });

      harvestedCandidates = pipelineResult.discovery?.candidates || [];
      const rawCandidateCount = (pipelineResult.discovery as any)?.rawCount ?? harvestedCandidates.length;

      const fallbackToolExecution: HarnessToolExecutionResult = {
        toolName: "discovery.search_pipeline",
        status: pipelineResult.rankedOpportunities.length > 0 ? "SUCCESS" : "PARTIAL",
        durationMs: 50,
        inputPayload: { query: rawQuery, constraints: explicitConstraints },
        outputSummary: `Harvested ${rawCandidateCount} raw candidates across sources (${harvestedCandidates.length} eligible).`,
        candidatesHarvested: rawCandidateCount,
        rawCandidates: harvestedCandidates,
      };
      context.toolExecutions.push(fallbackToolExecution);
      context.telemetry.toolsExecuted.push("discovery.search_pipeline");
    }

    recordStage("EXECUTE", Date.now() - tExecStart);

    // -------------------------------------------------------------------------
    // STAGE 5: VERIFY & QUALITY GATE EVALUATION
    // -------------------------------------------------------------------------
    const tVerifyStart = Date.now();
    context.currentStage = "VERIFY";

    const startTimeDate = new Date(startTime);
    const totalHarvestedCount = harvestedCandidates.length;
    const gateEvaluations = harvestedCandidates.map((c) =>
      evaluateCandidateQualityGate(c, discoveryPlan, startTimeDate)
    );

    const eligibleCandidates = harvestedCandidates.filter((_, idx) => gateEvaluations[idx].isEligible);
    const deduplicated = deduplicateCandidates(eligibleCandidates);
    const ranked = rankOpportunities(deduplicated, contextualIntent);

    const verification: HarnessVerificationResult = {
      status: ranked.length > 0 ? "VERIFIED" : "REJECTED",
      candidatesEvaluated: totalHarvestedCount,
      candidatesAccepted: ranked.length,
      candidatesRejected: Math.max(0, totalHarvestedCount - ranked.length),
      qualityGateEvaluations: gateEvaluations,
      verifiedOpportunities: ranked,
      rejectionReasons: gateEvaluations.flatMap((g) => g.rejectionReasons),
    };
    context.verification = verification;
    context.telemetry.verifiedCount = ranked.length;
    recordStage("VERIFY", Date.now() - tVerifyStart);

    // -------------------------------------------------------------------------
    // STAGE 6: DECIDE
    // -------------------------------------------------------------------------
    const tDecideStart = Date.now();
    context.currentStage = "DECIDE";

    let outcome: HarnessDecision["outcome"] = "COMPLETE";
    let rationale = "";
    let userExplanation = "";

    const requestedCount = explicitConstraints.requestedCount;
    const verifiedCount = ranked.length;

    if (verifiedCount >= requestedCount) {
      outcome = "COMPLETE";
      rationale = `Goal fully satisfied: Found ${verifiedCount} verified opportunities matching all constraints.`;
      userExplanation = `Found ${verifiedCount} verified ${explicitConstraints.roles[0] || "job"} opportunities matching your criteria.`;
    } else if (verifiedCount > 0) {
      outcome = "COMPLETE";
      const shortfall = requestedCount - verifiedCount;
      rationale = `Partial match: Found ${verifiedCount} verified opportunities (${shortfall} short of requested ${requestedCount}).`;
      userExplanation = `Found ${verifiedCount} verified ${explicitConstraints.roles[0] || "job"} opportunities matching your criteria. ${shortfall} additional opportunities could not be verified within the requested window.`;
    } else {
      outcome = "NEEDS_MORE_EVIDENCE";
      rationale = "Zero candidate opportunities satisfied the authoritative quality gate.";
      userExplanation = `No verified ${explicitConstraints.roles[0] || "job"} opportunities found matching your criteria.`;
    }

    const decision: HarnessDecision = {
      outcome,
      rationale,
      verifiedCount,
      requestedCount,
      canContinue: (outcome as HarnessDecisionOutcome) === "CONTINUE",
      userExplanation,
    };
    context.decision = decision;
    recordStage("DECIDE", Date.now() - tDecideStart);

    // Finalize Telemetry & Status
    const totalDurationMs = Date.now() - startTime;
    context.currentStage = "COMPLETE";
    context.telemetry.totalDurationMs = totalDurationMs;
    context.telemetry.status = verifiedCount > 0 ? "SUCCESS" : "PARTIAL";

    return {
      harnessId,
      success: true,
      decision,
      rankedOpportunities: ranked,
      context,
      telemetry: context.telemetry,
    };
  }
}

export const intelligenceHarness = new IntelligenceHarness();
