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
import { parseSearchIntent, parseSearchIntentAsync } from "@/lib/scraper/intentParser";
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
import { evidenceVerificationEngine } from "@/lib/ai/evidence";
import { correctionLoopController } from "./correction";
import { globalVerificationSandbox, type VerificationRequest } from "@/lib/ai/verification";
import { executionKeyRegistry } from "@/lib/discovery/execution/executionKeyRegistry";
import { executeDeepReachScan } from "@/lib/discovery/deepreach/deepReachService";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";

import {
  classifySearchFailure,
  evaluateSearchTerminalState,
  sanitizeSearchTelemetry,
} from "@/lib/ai/errors/searchFailureModel";

export class IntelligenceHarness {
  /**
   * Executes the full canonical AI intelligence lifecycle.
   */
  public async runLifecycle(
    rawQuery: string,
    options: HarnessExecutionOptions = {}
  ): Promise<HarnessResult> {
    const startTime = Date.now();
    const harnessId = options.executionId || `harness_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const correlationId = options.correlationId || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const userId = options.userId || null;
    const stageTimings: Record<string, number> = {};

    const recordStage = (stage: string, duration: number) => {
      stageTimings[stage] = duration;
    };

    const checkCancelled = (): boolean => {
      if (options.signal?.aborted) return true;
      const targetId = options.executionId || harnessId;
      if (targetId) {
        if (executionKeyRegistry.isKeyRevoked(targetId)) return true;
        if ((globalThis as any).__browserpilot_cancelled_executions?.has(targetId)) {
          return true;
        }
      }
      return false;
    };

    // Pre-flight cancellation check
    if (checkCancelled()) {
      const abortContext: HarnessContext = {
        harnessId,
        userId,
        rawQuery,
        currentStage: "FAILED",
        correlationId,
        explicitConstraints: { requestedCount: 10 },
        userMemories: [],
        platformKnowledge: [],
        availableCapabilities: [],
        toolExecutions: [],
        observations: [],
        telemetry: {
          harnessId,
          correlationId,
          userIdHash: userId ? `usr_${userId.slice(0, 6)}` : undefined,
          currentStage: "FAILED",
          totalDurationMs: 0,
          stageTimings: {},
          toolsExecuted: [],
          memoriesRetrievedCount: 0,
          platformKnowledgeCount: 0,
          observationsCount: 0,
          verifiedCount: 0,
          status: "CANCELLED",
          terminalState: "CANCELLED",
          errorCategory: "CANCELLED",
        },
      };

      return {
        harnessId,
        success: false,
        rankedOpportunities: [],
        context: abortContext,
        telemetry: abortContext.telemetry,
        decision: {
          outcome: "PARTIAL",
          rationale: "Execution aborted by client cancellation signal.",
          verifiedCount: 0,
          requestedCount: 10,
          canContinue: false,
          userExplanation: "Search execution was cancelled.",
        },
      };
    }

    // -------------------------------------------------------------------------
    // STAGE 1: QUERY & INTENT
    // -------------------------------------------------------------------------
    options.onStageTransition?.("intent", { label: "Parsing Intent" });
    const tIntentStart = Date.now();
    const parsedIntent = await parseSearchIntentAsync(rawQuery, {
      userId,
      apiKey: options.apiKey,
      puterToken: options.puterToken,
      filterOverrides: options.explicitFilters,
    });
    recordStage("INTENT", Date.now() - tIntentStart);

    const explicitConstraints = {
      roles: parsedIntent.roles || (parsedIntent.role ? [parsedIntent.role] : []),
      locations: parsedIntent.locations || (parsedIntent.location ? [parsedIntent.location] : []),
      workModes: parsedIntent.workModes || (parsedIntent.workMode ? [parsedIntent.workMode] : []),
      freshnessWindowHours: parsedIntent.freshnessWindowHours,
      postedWithinDays: parsedIntent.postedWithinDays,
      requestedCount: parsedIntent.requestedCount || 6,
      isExplicitFreshness: parsedIntent.isExplicitFreshness,
      targetCompanies: parsedIntent.companies || (parsedIntent.company ? [parsedIntent.company] : []),
    };
    if (typeof options.maxResultsBudget === "number" && options.maxResultsBudget > 0) {
      explicitConstraints.requestedCount = Math.min(explicitConstraints.requestedCount, options.maxResultsBudget);
    }

    // Cancellation check after intent
    if (checkCancelled()) {
      const abortContext: HarnessContext = {
        harnessId,
        userId,
        rawQuery,
        currentStage: "FAILED",
        correlationId,
        explicitConstraints,
        userMemories: [],
        platformKnowledge: [],
        availableCapabilities: [],
        toolExecutions: [],
        observations: [],
        telemetry: {
          harnessId,
          correlationId,
          userIdHash: userId ? `usr_${userId.slice(0, 6)}` : undefined,
          currentStage: "FAILED",
          totalDurationMs: Date.now() - startTime,
          stageTimings,
          toolsExecuted: [],
          memoriesRetrievedCount: 0,
          platformKnowledgeCount: 0,
          observationsCount: 0,
          verifiedCount: 0,
          status: "CANCELLED",
          terminalState: "CANCELLED",
          errorCategory: "CANCELLED",
        },
      };

      return {
        harnessId,
        success: false,
        rankedOpportunities: [],
        context: abortContext,
        telemetry: abortContext.telemetry,
        decision: {
          outcome: "PARTIAL",
          rationale: "Execution aborted after intent parsing.",
          verifiedCount: 0,
          requestedCount: explicitConstraints.requestedCount,
          canContinue: false,
          userExplanation: "Search execution was cancelled.",
        },
      };
    }

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
      correlationId,
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
        correlationId,
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

    const makeCancelledResult = (rationale: string): HarnessResult => {
      context.currentStage = "FAILED";
      context.telemetry.status = "CANCELLED";
      context.telemetry.terminalState = "CANCELLED";
      context.telemetry.errorCategory = "CANCELLED";
      return {
        harnessId,
        success: false,
        rankedOpportunities: [],
        context,
        telemetry: context.telemetry,
        decision: {
          outcome: "PARTIAL",
          rationale,
          verifiedCount: 0,
          requestedCount: explicitConstraints.requestedCount,
          canContinue: false,
          userExplanation: "Search execution was cancelled.",
        },
      };
    };

    // -------------------------------------------------------------------------
    // STAGE 3: PLAN & VALIDATE PLAN
    // -------------------------------------------------------------------------
    options.onStageTransition?.("plan", { label: "Planning Search" });
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

    // Check cancellation before planning
    if (checkCancelled()) {
      return makeCancelledResult("Execution cancelled before plan generation.");
    }

    // Generate Typed Search Action Plan using SearchPlanner & BrainContext (TASK-050 & TASK-063)
    let searchPlanResult: any;
    try {
      searchPlanResult = await searchPlanner.planSearch(
        rawQuery,
        contextualIntent,
        brainContext,
        {
          userId,
          allowedDomains: options.allowedDomains,
          apiKeyOverride: options.apiKey,
          puterTokenOverride: options.puterToken,
          signal: options.signal,
        }
      );
    } catch (modelErr) {
      const failure = classifySearchFailure(modelErr, {
        stage: "PLANNING",
        operation: "searchPlanner",
        correlationId,
      });

      if (checkCancelled() || failure.category === "CANCELLED") {
        return makeCancelledResult("Execution cancelled during search planning.");
      }

      context.telemetry.modelFailures = (context.telemetry.modelFailures || 0) + 1;
      context.telemetry.errorCategory = failure.category;
      searchPlanResult = {
        plan: {
          planId: `plan_fallback_${Date.now()}`,
          originalQuery: rawQuery,
          strategy: "MULTI_SOURCE_HARVEST",
          actions: [
            {
              actionId: "act_fallback_1",
              capabilityId: "discovery.search_pipeline",
              priority: 1,
              dependencyIds: [],
              timeoutMs: 10000,
              input: { query: rawQuery, requestedCount: explicitConstraints.requestedCount },
            },
          ],
        },
      };
    }
    context.searchActionPlan = searchPlanResult.plan;

    // Global Verification Sandbox Gate (TASK-063 Pre-Execution Validation)
    const sandboxRequest: VerificationRequest = {
      requestId: `req_${correlationId}`,
      userIdHash: globalVerificationSandbox.hashUserId(userId),
      correlationId,
      originalQuery: rawQuery,
      canonicalIntent: contextualIntent,
      proposedPlan: searchPlanResult.plan,
      requestedCapabilities: (searchPlanResult.plan.actions || []).map((a: any) => a.capabilityId),
      requestedSources: contextualIntent.sources || [],
      constraints: searchPlanResult.plan.constraints,
      expectedEvidence: (searchPlanResult.plan.actions || []).map((a: any) => a.expectedEvidence).filter(Boolean),
      securityChecks: ["ssrf_check", "hard_constraints", "synthetic_firewall", "domain_barrier"],
      createdAt: new Date(),
    };

    const sandboxDecision = globalVerificationSandbox.verifyExecutionPlan(sandboxRequest);
    (context as any).sandboxDecision = sandboxDecision;

    if (sandboxDecision.decision === "REJECT") {
      return {
        harnessId,
        success: false,
        rankedOpportunities: [],
        context,
        telemetry: context.telemetry,
        decision: {
          outcome: "PARTIAL",
          rationale: `Execution plan rejected by Global Verification Sandbox: ${sandboxDecision.reason}`,
          verifiedCount: 0,
          requestedCount: explicitConstraints.requestedCount,
          canContinue: false,
          userExplanation: "Execution plan rejected due to security or integrity constraints.",
        },
      };
    }

    // Also generate Action Plan for browser-level preflight validation
    let actionPlan: any;
    try {
      actionPlan = await generateActionPlan(rawQuery, {
        allowedDomains: options.allowedDomains,
        maxStepsBudget: 15,
        apiKey: options.apiKey,
        userId,
        signal: options.signal,
      });
    } catch {
      actionPlan = {
        goal: rawQuery,
        steps: [{ id: "step_1", action: "NAVIGATE", url: "https://www.google.com" }],
      };
    }
    context.plan = actionPlan;

    // Validate Plan Pre-Execution
    const planValidation = validateActionPlan(actionPlan, {
      allowedDomains: options.allowedDomains,
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

    // Check cancellation signal before execution begins
    if (checkCancelled()) {
      return makeCancelledResult("Execution cancelled before execution stage.");
    }

    // -------------------------------------------------------------------------
    // STAGE 4: EXECUTE & OBSERVE (TASK-050 Intelligent Tool Orchestration)
    // -------------------------------------------------------------------------
    options.onStageTransition?.("harvest", { label: "Querying ATS Portals" });
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
      signal: options.signal,
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

    if (orchestrationResult.sourceStatusSummary) {
      context.telemetry.requestedSources = orchestrationResult.sourceStatusSummary.requestedSources;
      context.telemetry.eligibleSources = orchestrationResult.sourceStatusSummary.eligibleSources;
      context.telemetry.attemptedSources = orchestrationResult.sourceStatusSummary.attemptedSources;
      context.telemetry.successfulSources = orchestrationResult.sourceStatusSummary.successfulSources;
      context.telemetry.failedSources = orchestrationResult.sourceStatusSummary.failedSources;
      context.telemetry.skippedSources = orchestrationResult.sourceStatusSummary.skippedSources;
      context.telemetry.sourcesWithNoMatches = orchestrationResult.sourceStatusSummary.sourcesWithNoMatches;
    }

    let harvestedCandidates = orchestrationResult.harvestedCandidates;

    // Safety fallback: if no candidates harvested by individual actions, run discovery search pipeline
    if (harvestedCandidates.length === 0) {
      if (checkCancelled()) {
        return makeCancelledResult("Execution cancelled before fallback harvest.");
      }

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
        executionId: options.executionId || harnessId,
        persistToDb: false,
        maxResults: explicitConstraints.requestedCount,
        customProviders: options.customProviders,
        verifyEvidence: options.verifyEvidence,
        signal: options.signal,
      });

      harvestedCandidates = pipelineResult.discovery?.candidates || [];
      if (pipelineResult.sourceStatusSummary) {
        context.telemetry.requestedSources = pipelineResult.sourceStatusSummary.requestedSources;
        context.telemetry.eligibleSources = pipelineResult.sourceStatusSummary.eligibleSources;
        context.telemetry.attemptedSources = pipelineResult.sourceStatusSummary.attemptedSources;
        context.telemetry.successfulSources = pipelineResult.sourceStatusSummary.successfulSources;
        context.telemetry.failedSources = pipelineResult.sourceStatusSummary.failedSources;
        context.telemetry.skippedSources = pipelineResult.sourceStatusSummary.skippedSources;
        context.telemetry.sourcesWithNoMatches = pipelineResult.sourceStatusSummary.sourcesWithNoMatches;
      }
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

    // -------------------------------------------------------------------------
    // R1: Cross-Platform Social Media Discovery (DeepReach: X, Reddit, YouTube, LinkedIn)
    // -------------------------------------------------------------------------
    if (!checkCancelled() && (!options.customProviders || options.customProviders.length === 0)) {
      try {
        options.onStageTransition?.("deepreach", { label: "Scouting Social Channels (Reddit, X, YouTube, LinkedIn)" });
        const tDeepReachStart = Date.now();

        const harvestedCompanyNames = Array.from(
          new Set(
            harvestedCandidates
              .map((c) => c.companyName)
              .filter((c): c is string => Boolean(c && c.length >= 2 && !c.toLowerCase().includes("unknown")))
          )
        ).slice(0, 2);

        const targetCompaniesToScan = explicitConstraints.targetCompanies && explicitConstraints.targetCompanies.length > 0
          ? explicitConstraints.targetCompanies.slice(0, 2)
          : (contextualIntent.companies && contextualIntent.companies.length > 0
            ? contextualIntent.companies.slice(0, 2)
            : (harvestedCompanyNames.length > 0
              ? harvestedCompanyNames
              : ["Stripe", "OpenAI"]));

        const primaryRole = explicitConstraints.roles[0] || "Software Engineer";

        // Query DeepReach across target companies in parallel with error isolation
        const deepReachScans = await Promise.allSettled(
          targetCompaniesToScan.map((company) =>
            executeDeepReachScan({
              companyName: company,
              roleTitle: primaryRole,
              skills: contextualIntent.skills,
              maxCandidates: 5,
              includeRecruiters: true,
              timeoutMs: 5000,
              checkLiveness: false, // will be verified unified in Stage 5
            })
          )
        );

        let totalSocialHarvested = 0;
        for (const scanRes of deepReachScans) {
          if (scanRes.status === "fulfilled" && scanRes.value) {
            const deepResult = scanRes.value;
            for (const deepJob of deepResult.jobs || []) {
              const platformKey = deepJob.sourcePlatform === "TWITTER" ? "X" : deepJob.sourcePlatform;
              const socialCandidate: RawJobCandidate = {
                sourcePlatform: platformKey,
                sourceUrl: deepJob.sourceUrl || deepJob.applyUrl,
                applyUrl: deepJob.applyUrl,
                externalJobId: `dr_${Math.random().toString(36).slice(2, 9)}`,
                title: deepJob.title,
                companyName: deepJob.companyName,
                location: deepJob.location || "Remote",
                workMode: deepJob.workMode || "REMOTE",
                opportunityType: "FULL_TIME",
                description: deepJob.description || `${deepJob.title} opportunity discovered on ${platformKey}`,
                rawSnippet: deepJob.description,
                discoveredAt: new Date(),
                postedAt: new Date(),
              };
              harvestedCandidates.push(socialCandidate);
              totalSocialHarvested++;
            }
          }
        }

        if (totalSocialHarvested > 0) {
          context.toolExecutions.push({
            toolName: "discovery.deepreach",
            status: "SUCCESS",
            durationMs: Date.now() - tDeepReachStart,
            inputPayload: { companies: targetCompaniesToScan, role: primaryRole },
            outputSummary: `DeepReach harvested ${totalSocialHarvested} social opportunities across Reddit, X, YouTube, and LinkedIn.`,
            candidatesHarvested: totalSocialHarvested,
            rawCandidates: [],
          });
          context.telemetry.toolsExecuted.push("discovery.deepreach");
        }
      } catch (deepReachErr) {
        console.warn("[IntelligenceHarness] DeepReach social scan warning:", deepReachErr);
      }
    }

    recordStage("EXECUTE", Date.now() - tExecStart);

    // -------------------------------------------------------------------------
    // STAGE 5: VERIFY & EVIDENCE QUALITY GATE EVALUATION (TASK-051)
    // -------------------------------------------------------------------------
    if (checkCancelled()) {
      return makeCancelledResult("Execution cancelled before verification stage.");
    }
    options.onStageTransition?.("verify", { label: "Verifying URLs" });
    const tVerifyStart = Date.now();
    context.currentStage = "VERIFY";

    const startTimeDate = new Date(startTime);
    const totalHarvestedCount = harvestedCandidates.length;

    // Run unified evidence verification (Normalization, Deterministic Firewall, Semantic Judge, Quality Gate)
    const batchVerification = await evidenceVerificationEngine.verifyCandidateBatch(
      harvestedCandidates,
      discoveryPlan,
      {
        userId,
        apiKey: options.apiKey,
        referenceTime: startTimeDate,
        signal: options.signal,
      }
    );

    context.compositeVerificationResults = batchVerification.verificationResults;

    const gateEvaluations = harvestedCandidates.map((c) =>
      evaluateCandidateQualityGate(c, discoveryPlan, startTimeDate)
    );

    const eligibleCandidates = batchVerification.eligibleCandidates;
    const deduplicated = deduplicateCandidates(eligibleCandidates);
    const ranked = rankOpportunities(deduplicated, contextualIntent);

    const allRejections = batchVerification.verificationResults.flatMap((r) => r.rejectionReasons);

    const verification: HarnessVerificationResult = {
      status: ranked.length > 0 ? "VERIFIED" : "REJECTED",
      candidatesEvaluated: totalHarvestedCount,
      candidatesAccepted: ranked.length,
      candidatesRejected: Math.max(0, totalHarvestedCount - ranked.length),
      qualityGateEvaluations: gateEvaluations,
      verifiedOpportunities: ranked,
      rejectionReasons: allRejections,
    };
    context.verification = verification;
    context.telemetry.verifiedCount = ranked.length;
    recordStage("VERIFY", Date.now() - tVerifyStart);

    // -------------------------------------------------------------------------
    // STAGE 6: DECIDE & AUTONOMOUS CORRECTION LOOP (TASK-052)
    // -------------------------------------------------------------------------
    if (checkCancelled()) {
      return makeCancelledResult("Execution cancelled before correction loop.");
    }
    options.onStageTransition?.("rank", { label: "Scoring & Ranking" });
    const tDecideStart = Date.now();
    context.currentStage = "DECIDE";

    const requestedCount = explicitConstraints.requestedCount;
    let finalRanked = ranked;
    let finalEligibleCandidates = eligibleCandidates;

    // Enter autonomous correction loop if initial search produced a shortfall (< 5 or < requestedCount)
    if ((finalEligibleCandidates.length < requestedCount || finalEligibleCandidates.length < 5) && !options.dryRunPlanOnly) {
      if (checkCancelled()) {
        return makeCancelledResult("Execution cancelled before correction loop iteration.");
      }

      const loopRes = await correctionLoopController.runLoop(
        harvestedCandidates,
        batchVerification.verificationResults,
        rawQuery,
        contextualIntent,
        discoveryPlan,
        {
          userId,
          customProviders: options.customProviders,
          referenceTime: startTimeDate,
          signal: options.signal,
        }
      );

      context.correctionLoopResult = loopRes.loopResult;
      finalEligibleCandidates = loopRes.eligibleCandidates;
      finalRanked = loopRes.rankedOpportunities;
      context.compositeVerificationResults = loopRes.loopResult.allVerificationResults;
    }

    const verifiedCount = finalRanked.length;

    // Evaluate canonical terminal state and invariants (TASK-057)
    const terminalEval = evaluateSearchTerminalState({
      verifiedCount,
      requestedCount,
      isCancelled: checkCancelled() || context.telemetry.status === "CANCELLED",
      isFailed: context.telemetry.status === "FAILED",
    });

    const isComplete = terminalEval.terminalState === "COMPLETED";
    const isPartial = terminalEval.terminalState === "PARTIAL";

    let outcome: HarnessDecision["outcome"] = isComplete ? "COMPLETE" : isPartial ? "PARTIAL" : "NEEDS_MORE_EVIDENCE";

    const decision: HarnessDecision = {
      outcome,
      rationale: terminalEval.explanation,
      verifiedCount,
      requestedCount,
      canContinue: (outcome as HarnessDecisionOutcome) === "CONTINUE",
      userExplanation: terminalEval.explanation,
    };
    context.decision = decision;
    recordStage("DECIDE", Date.now() - tDecideStart);

    if (checkCancelled()) {
      return makeCancelledResult("Execution cancelled before completion.");
    }

    // Finalize Telemetry & Status
    const totalDurationMs = Date.now() - startTime;
    const isCancelled = checkCancelled() || options.signal?.aborted || context.telemetry.status === "CANCELLED";
    if (isCancelled) {
      return makeCancelledResult("Execution cancelled before completion.");
    }

    context.currentStage = "COMPLETE";
    options.onStageTransition?.("complete", { label: "Complete", count: finalRanked.length });
    context.telemetry.totalDurationMs = totalDurationMs;
    context.telemetry.status = verifiedCount > 0 ? "SUCCESS" : "PARTIAL";
    context.telemetry.terminalState = terminalEval.terminalState;

    // Deep secret-safe sanitization
    const sanitizedTelemetry = sanitizeSearchTelemetry(context.telemetry);
    context.telemetry = sanitizedTelemetry;

    return {
      harnessId,
      success: verifiedCount > 0 || isComplete,
      decision,
      rankedOpportunities: finalRanked,
      context,
      telemetry: sanitizedTelemetry,
    };
  }
}

export const intelligenceHarness = new IntelligenceHarness();
