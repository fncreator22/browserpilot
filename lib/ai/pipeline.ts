import { classifyIntent } from "./intent";
import { generateActionPlan } from "./planner";
import { executeActionPlan, type PlanExecutionResult } from "./toolcall";
import { validateCapabilityPreflight, type CapabilityGuardResult } from "@/lib/capabilities/guard";
import { validateActionPlan, type PlanValidationResult } from "@/lib/verification/planValidator";
import { mapInternalErrorToHuman } from "@/lib/verification/errorMapper";
import { browserPool, type BrowserSession } from "@/worker/browser";
import { type ActionPlan, type IntentClassification } from "@/schemas/jobs";

export interface PipelineExecutionOptions {
  jobId?: string;
  allowedDomains?: string[];
  maxStepsBudget?: number;
  headless?: boolean;
  onIntentClassified?: (intent: IntentClassification) => void;
  onGuardEvaluated?: (guardResult: CapabilityGuardResult) => void;
  onPlanGenerated?: (plan: ActionPlan) => void;
  onPlanValidated?: (validationResult: PlanValidationResult) => void;
  onStepProgress?: (step: number, total: number, tool: string) => void;
}

export interface PipelineResult {
  jobId: string;
  prompt: string;
  intent: IntentClassification;
  guard: CapabilityGuardResult;
  plannerCalled: boolean;
  plan?: ActionPlan;
  planValidation?: PlanValidationResult;
  execution?: PlanExecutionResult;
  success: boolean;
  durationMs: number;
  error?: {
    code: string;
    message: string;
    userMessage: string;
    reasons?: unknown[];
  };
}

/**
 * End-to-End Autonomous Pipeline:
 * Prompt → Intent → Capability Guard (Pre-Flight) → Plan → Plan Validator (Pre-Execution) → App Mapper → Browser Execution
 */
export async function runAutonomousPipeline(
  prompt: string,
  options: PipelineExecutionOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();
  const jobId = options.jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // Step 1: Classify Intent
    const intent = await classifyIntent(prompt);
    options.onIntentClassified?.(intent);

    // Step 2: PRE-FLIGHT CAPABILITY GUARD (Runs BEFORE Planner per §8 / Prompt 09)
    const guard = validateCapabilityPreflight(intent, prompt);
    options.onGuardEvaluated?.(guard);

    if (!guard.allowed) {
      return {
        jobId,
        prompt,
        intent,
        guard,
        plannerCalled: false,
        success: false,
        durationMs: Date.now() - startTime,
        error: {
          code: guard.errorCode || "CAPABILITY_GUARD_REJECTION",
          message: guard.technicalDetail || guard.userMessage,
          userMessage: guard.userMessage,
        },
      };
    }

    // Step 3: Generate ActionPlan (Gemini AI Planner)
    const allowedDomains = options.allowedDomains || intent.targetDomains || [];
    const maxStepsBudget = options.maxStepsBudget || 15;
    const rawPlan = await generateActionPlan(prompt, {
      allowedDomains,
      maxStepsBudget,
    });
    options.onPlanGenerated?.(rawPlan);

    // Step 4: PRE-EXECUTION PLAN VALIDATOR (Runs BEFORE Executor per §10 / Prompt 10)
    const planValidation = validateActionPlan(rawPlan, {
      allowedDomains,
      maxStepsBudget,
    });
    options.onPlanValidated?.(planValidation);

    // Reject-by-default: If plan validation fails, halt immediately before touching executor
    if (!planValidation.valid || !planValidation.validatedPlan) {
      return {
        jobId,
        prompt,
        intent,
        guard,
        plannerCalled: true,
        plan: rawPlan,
        planValidation,
        success: false,
        durationMs: Date.now() - startTime,
        error: {
          code: "PLAN_VALIDATION_FAILED",
          message: planValidation.summary,
          userMessage: "The generated action plan violated business or security rules and was rejected.",
          reasons: planValidation.reasons,
        },
      };
    }

    const approvedPlan = planValidation.validatedPlan;

    // Step 5: Launch Isolated Browser Session
    let session: BrowserSession | null = null;
    try {
      session = await browserPool.createSession({
        jobId,
        allowedDomains: approvedPlan.targetDomains,
        headless: options.headless !== false,
      });

      // Step 6: Execute Plan via Application ToolCall Dispatcher Layer
      const executionResult = await executeActionPlan(session.page, approvedPlan, {
        jobId,
        onStepStart: (stepNum, action) => {
          options.onStepProgress?.(stepNum, approvedPlan.steps.length, action.tool);
        },
      });

      return {
        jobId,
        prompt,
        intent,
        guard,
        plannerCalled: true,
        plan: approvedPlan,
        planValidation,
        execution: executionResult,
        success: executionResult.status === "SUCCESS",
        durationMs: Date.now() - startTime,
      };
    } finally {
      if (session) {
        await session.close();
      }
    }
  } catch (err: unknown) {
    const errorObj = err as Error;
    const mapped = mapInternalErrorToHuman(errorObj);
    const errCode = (errorObj as unknown as { code?: string }).code || "PIPELINE_ERROR";

    return {
      jobId,
      prompt,
      intent: {
        classification: "UNSUPPORTED",
        confidence: 0,
        rationale: "Pipeline execution failed during planning or initialization.",
        targetDomains: [],
        requiredCapabilities: [],
      },
      guard: {
        allowed: false,
        classification: "UNSUPPORTED",
        errorCode: errCode,
        userMessage: mapped.userMessage,
        technicalDetail: mapped.technicalDetail,
        matchedCapabilities: [],
        blockedCapabilities: [],
      },
      plannerCalled: false,
      success: false,
      durationMs: Date.now() - startTime,
      error: {
        code: errCode,
        message: mapped.technicalDetail,
        userMessage: mapped.userMessage,
      },
    };
  }
}
