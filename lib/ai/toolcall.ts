import { type Page } from "playwright";
import { 
  type ActionPlan, 
  type PlannedStep, 
  ActionPlanSchema 
} from "@/schemas/jobs";
import { 
  type BrowserAction, 
  type Observation, 
  BrowserActionSchema 
} from "@/schemas/actions";
import { BrowserExecutor } from "@/worker/executor";
import { isJobCancelled } from "@/lib/queue/cancellation";

export interface PlanExecutionResult {
  jobId: string;
  goal: string;
  totalSteps: number;
  completedSteps: number;
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  observations: Observation[];
  finalObservation?: Observation;
  screenshotPaths: string[];
  totalElapsedMs: number;
  error?: {
    code: string;
    message: string;
    userMessage: string;
  };
}

export interface PlanExecutionOptions {
  jobId: string;
  onStepStart?: (stepNumber: number, action: BrowserAction) => void;
  onStepComplete?: (stepNumber: number, observation: Observation) => void;
  stopOnFailure?: boolean;
}

/**
 * APPLICATION-CONTROLLED DISPATCHER LAYER
 * 
 * STRUCTURAL SECURITY BOUNDARY (§6 / skills/security.md):
 * Gemini NEVER invokes Playwright or any system APIs directly.
 * Gemini outputs a static, un-executable ActionPlan data object.
 * 
 * This application function (`executeActionPlan`) explicitly takes over:
 * 1. Validates the plan data with Zod (`ActionPlanSchema`)
 * 2. Iterates through the steps in application loop
 * 3. Validates each action payload against `BrowserActionSchema`
 * 4. Calls the sandboxed `BrowserExecutor.execute(page, action)`
 */
export async function executeActionPlan(
  page: Page,
  plan: ActionPlan,
  options: PlanExecutionOptions
): Promise<PlanExecutionResult> {
  const startTime = Date.now();
  const validatedPlan = ActionPlanSchema.parse(plan);
  const observations: Observation[] = [];
  const screenshotPaths: string[] = [];
  let overallStatus: "SUCCESS" | "FAILED" | "BLOCKED" = "SUCCESS";
  let fatalError: PlanExecutionResult["error"] | undefined;

  for (let i = 0; i < validatedPlan.steps.length; i++) {
    const plannedStep: PlannedStep = validatedPlan.steps[i];
    const stepNumber = i + 1;

    options.onStepStart?.(stepNumber, plannedStep.action);

    // Immediate cancellation checkpoint (§Prompt C4)
    if (isJobCancelled(options.jobId)) {
      overallStatus = "BLOCKED";
      fatalError = {
        code: "USER_CANCELLED",
        message: "Job execution was aborted by user request.",
        userMessage: "Task was cancelled by user request.",
      };
      break;
    }

    // Explicit application-side parameter validation before execution
    const validatedAction = BrowserActionSchema.parse(plannedStep.action);

    // Dispatch action via Playwright Executor
    const observation = await BrowserExecutor.execute(page, validatedAction, {
      jobId: options.jobId,
      stepIndex: stepNumber,
      captureScreenshot: plannedStep.checkpointScreenshot,
    });

    observations.push(observation);
    if (observation.screenshotPath) {
      screenshotPaths.push(observation.screenshotPath);
    }

    options.onStepComplete?.(stepNumber, observation);

    // Halt execution if a step fails or hits a verification wall
    if (observation.status === "BLOCKED") {
      overallStatus = "BLOCKED";
      fatalError = observation.error || {
        code: "VERIFICATION_BLOCKED",
        message: "Verification challenge encountered.",
        userMessage: "Execution halted due to an anti-bot challenge.",
      };
      break;
    }

    if (observation.status === "FAILED" && !plannedStep.isOptional) {
      if (options.stopOnFailure !== false) {
        overallStatus = "FAILED";
        fatalError = observation.error || {
          code: "STEP_EXECUTION_FAILED",
          message: `Step ${stepNumber} (${validatedAction.tool}) failed.`,
          userMessage: "A planned action could not be completed on the page.",
        };
        break;
      }
    }
  }

  const totalElapsedMs = Date.now() - startTime;
  const finalObservation = observations[observations.length - 1];

  return {
    jobId: options.jobId,
    goal: validatedPlan.goal,
    totalSteps: validatedPlan.steps.length,
    completedSteps: observations.filter((o) => o.status === "SUCCESS").length,
    status: overallStatus,
    observations,
    finalObservation,
    screenshotPaths,
    totalElapsedMs,
    error: fatalError,
  };
}

/**
 * Execute a single tool step directly with validation
 */
export async function executeSingleStep(
  page: Page,
  action: BrowserAction,
  options: { jobId: string; stepIndex?: number; captureScreenshot?: boolean }
): Promise<Observation> {
  const validatedAction = BrowserActionSchema.parse(action);
  return BrowserExecutor.execute(page, validatedAction, {
    jobId: options.jobId,
    stepIndex: options.stepIndex ?? 1,
    captureScreenshot: options.captureScreenshot,
  });
}
