import { classifyIntent } from "./intent";
import { generateActionPlan } from "./planner";
import { type PlanExecutionResult } from "./toolcall";
import { validateCapabilityPreflight, type CapabilityGuardResult } from "@/lib/capabilities/guard";
import { validateActionPlan, type PlanValidationResult } from "@/lib/verification/planValidator";
import { mapInternalErrorToHuman } from "@/lib/verification/errorMapper";
import { type ActionPlan, type IntentClassification } from "@/schemas/jobs";

export interface PipelineExecutionOptions {
  jobId?: string;
  allowedDomains?: string[];
  maxStepsBudget?: number;
  headless?: boolean;
  apiKey?: string;
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
  tokensUsed?: number;
  memoryMb?: number;
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
    const intent = await classifyIntent(prompt, { apiKey: options.apiKey });
    options.onIntentClassified?.(intent);

    // Step 2: PRE-FLIGHT CAPABILITY GUARD (Runs BEFORE Planner per §8 / Prompt 09)
    const guard = validateCapabilityPreflight(intent, prompt);
    options.onGuardEvaluated?.(guard);

    if (guard.classification === "BLOCKED" || guard.classification === "REQUIRES_AUTH") {
      return {
        jobId,
        prompt,
        intent,
        guard,
        plannerCalled: false,
        success: false,
        durationMs: Date.now() - startTime,
        tokensUsed: (intent as any).tokensUsed,
        error: {
          code: guard.errorCode || (guard.classification === "REQUIRES_AUTH" ? "REQUIRES_AUTHENTICATION" : "SECURITY_POLICY_VIOLATION"),
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
      apiKey: options.apiKey,
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

    // Step 5: Launch Browser Session (Playwright in full environment, Serverless Fetch in Lambda)
    let session: any = null;
    let executionResult: PlanExecutionResult;

    try {
      try {
        const { browserPool } = await import("@/worker/browser");
        session = await browserPool.createSession({
          jobId,
          allowedDomains: approvedPlan.targetDomains,
          headless: options.headless !== false,
        });
      } catch (browserLaunchErr) {
        const reason = (browserLaunchErr as Error).message || "unknown";
        console.warn(
          `[Pipeline] ⚠️  Chromium unavailable — falling back to serverless fetch executor.\n` +
          `  Reason: ${reason}\n` +
          `  Impact: browser.screenshot steps will return null (no Playwright binaries on Vercel Lambda).\n` +
          `  Fix: Deploy worker container on Fly.io/Railway or use Vercel Puppeteer layer.`
        );
      }

      // Step 6: Execute Plan via Application ToolCall Dispatcher Layer
      if (session) {
        // Start Live CDP Screencast & Virtual Cursor Stream
        const { startBrowserScreencast, stopBrowserScreencast } = await import("@/lib/browser/screencast");
        await startBrowserScreencast(session.page, jobId, { quality: 65, everyNthFrame: 1 });

        try {
          const { executeActionPlan } = await import("./toolcall");
          executionResult = await executeActionPlan(session.page, approvedPlan, {
            jobId,
            onStepStart: (stepNum, action) => {
              options.onStepProgress?.(stepNum, approvedPlan.steps.length, action.tool);
            },
          });
        } finally {
          // Stop CDP Screencast stream
          await stopBrowserScreencast(jobId);
        }
      } else {
        const { executeServerlessActionPlan } = await import("./serverlessExecutor");
        executionResult = await executeServerlessActionPlan(approvedPlan, {
          jobId,
          onStepStart: (stepNum, action) => {
            options.onStepProgress?.(stepNum, approvedPlan.steps.length, action.tool);
          },
        });
      }

      const intentTokens = (intent as unknown as { tokensUsed?: number }).tokensUsed || 0;
      const planTokens = (rawPlan as unknown as { tokensUsed?: number }).tokensUsed || 0;
      const totalTokens = intentTokens + planTokens;
      const rssMemoryMb = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;

      const hasFailed = executionResult.status !== "SUCCESS";
      const executionError = hasFailed
        ? executionResult.error || (executionResult.finalObservation?.error ? {
            code: executionResult.finalObservation.error.code || "ACTION_EXECUTION_ERROR",
            message: executionResult.finalObservation.error.message || "Action execution error",
            userMessage: executionResult.finalObservation.error.userMessage || "An error occurred during browser action execution.",
          } : undefined)
        : undefined;

      return {
        jobId,
        prompt,
        intent,
        guard,
        plannerCalled: true,
        plan: approvedPlan,
        planValidation,
        execution: executionResult,
        success: !hasFailed,
        durationMs: Date.now() - startTime,
        tokensUsed: totalTokens,
        memoryMb: rssMemoryMb,
        error: executionError,
      };
    } finally {
      if (session) {
        await session.close().catch(() => {});
      }
    }
  } catch (err: unknown) {
    const totalDurationMs = Date.now() - startTime;
    const humanError = mapInternalErrorToHuman(err);

    return {
      jobId,
      prompt,
      intent: {
        classification: "UNSUPPORTED",
        confidence: 0,
        rationale: "Pipeline caught fatal execution error.",
        targetDomains: [],
        requiredCapabilities: [],
      },
      guard: {
        allowed: false,
        classification: "UNSUPPORTED",
        userMessage: humanError.userMessage,
        matchedCapabilities: [],
        blockedCapabilities: [],
      },
      plannerCalled: false,
      success: false,
      durationMs: totalDurationMs,
      error: {
        code: humanError.code,
        message: humanError.technicalDetail || humanError.userMessage,
        userMessage: humanError.userMessage,
      },
    };
  }
}
