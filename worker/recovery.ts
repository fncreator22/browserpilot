import { type Page } from "playwright";
import { type BrowserAction, type Observation, BrowserActionSchema } from "@/schemas/actions";
import { 
  type VerifiedResult, 
  type RecoveryAuditStep, 
  VerifiedResultSchema 
} from "@/schemas/results";
import { ResultVerifier, type ResultVerificationEvaluation } from "@/lib/verification/resultVerifier";
import { validateActionPlan } from "@/lib/verification/planValidator";
import { BrowserExecutor } from "./executor";
import { synthesizeFinalAnswer } from "@/lib/ai/synthesizer";

export const MAX_RECOVERY_ATTEMPTS = 2; // Hard cap per Prompt 13 & §14

export interface RecoveryLoopOptions {
  jobId: string;
  goal: string;
  allowedDomains: string[];
  initialObservations: Observation[];
  expectedFields?: string[];
  customRecoveryPlanner?: (attempt: number, reason: string) => Promise<BrowserAction>;
}

/**
 * BOUNDED RECOVERY LOOP (§13-14 / skills/security.md)
 * 
 * Rules:
 * - Hard cap at MAX_RECOVERY_ATTEMPTS (2)
 * - Every recovery action MUST pass Plan Validator before dispatch
 * - Cleanly resolves to VERIFIED, PARTIAL, or BLOCKED
 */
export async function executeRecoveryLoop(
  page: Page,
  options: RecoveryLoopOptions
): Promise<VerifiedResult> {
  const startTime = Date.now();
  const observations = [...options.initialObservations];
  const auditTrail: RecoveryAuditStep[] = [];
  let recoveryAttempt = 0;

  // 1. Initial Verification Pass
  let evaluation: ResultVerificationEvaluation = ResultVerifier.verify({
    goal: options.goal,
    observations,
    currentRecoveryAttempt: recoveryAttempt,
    expectedFields: options.expectedFields,
    targetDomains: options.allowedDomains,
  });

  // 2. Recovery Loop (Max 2 Attempts)
  while (evaluation.status === "RECOVER" && recoveryAttempt < MAX_RECOVERY_ATTEMPTS) {
    recoveryAttempt++;
    console.log(
      `\n[Recovery Loop] 🔄 Initiating Recovery Attempt ${recoveryAttempt}/${MAX_RECOVERY_ATTEMPTS} for Job ${options.jobId}...`
    );
    console.log(`[Recovery Loop] Trigger Reason: ${evaluation.reason}`);

    // Generate alternate recovery action
    const recoveryAction: BrowserAction = options.customRecoveryPlanner
      ? await options.customRecoveryPlanner(recoveryAttempt, evaluation.reason)
      : recoveryAttempt === 1
      ? {
          tool: "browser.inspect",
          parameters: { selector: "body", depth: 2, maxElements: 20 },
          rationale: "Recovery Attempt 1: Inspect DOM structure to identify correct container elements.",
        }
      : {
          tool: "browser.extractText",
          parameters: { selector: "body", extractMultiple: false, maxChars: 5000 },
          rationale: "Recovery Attempt 2: Extract text from broader body container.",
        };

    // CRITICAL: Re-validate recovery action via Plan Validator every time
    const validationResult = validateActionPlan(
      {
        goal: `Recovery Attempt ${recoveryAttempt}: ${options.goal}`,
        targetDomains: options.allowedDomains,
        steps: [
          {
            stepNumber: 1,
            action: recoveryAction,
            rationale: `Recovery Attempt ${recoveryAttempt} dispatch`,
          },
        ],
      },
      { allowedDomains: options.allowedDomains }
    );

    if (!validationResult.valid) {
      console.warn(`[Recovery Loop] Recovery action failed validation: ${validationResult.summary}`);
      break; // Abort recovery if proposed action is unsafe
    }

    // Dispatch recovery action
    const recoveryObs = await BrowserExecutor.execute(page, recoveryAction, {
      jobId: options.jobId,
      stepIndex: observations.length + 1,
    });

    observations.push(recoveryObs);

    const auditStep: RecoveryAuditStep = {
      attemptNumber: recoveryAttempt,
      triggerReason: evaluation.reason,
      recoveryAction: BrowserActionSchema.parse(recoveryAction),
      observation: recoveryObs,
      timestamp: new Date().toISOString(),
    };
    auditTrail.push(auditStep);

    // Re-verify after recovery step
    evaluation = ResultVerifier.verify({
      goal: options.goal,
      observations,
      currentRecoveryAttempt: recoveryAttempt,
      expectedFields: options.expectedFields,
      targetDomains: options.allowedDomains,
    });

    console.log(`[Recovery Loop] Post-attempt ${recoveryAttempt} Evaluation: ${evaluation.status}`);
  }

  // 3. Synthesize User-Facing Answer
  const finalStatus = evaluation.status === "RECOVER" ? "PARTIAL" : evaluation.status;
  const userSummary = await synthesizeFinalAnswer({
    goal: options.goal,
    verificationStatus: finalStatus,
    extractedData: evaluation.extractedPayload,
    observations,
    satisfiedCriteria: evaluation.satisfiedCriteria,
    missingFields: evaluation.missingFields,
  });

  const lastScreenshot = observations
    .slice()
    .reverse()
    .find((o) => o.screenshotPath)?.screenshotPath || null;

  const result: VerifiedResult = {
    jobId: options.jobId,
    goal: options.goal,
    verificationStatus: finalStatus as "VERIFIED" | "PARTIAL" | "FAILED" | "BLOCKED",
    confidence: evaluation.confidence,
    summary: userSummary,
    extractedData: evaluation.extractedPayload,
    satisfiedCriteria: evaluation.satisfiedCriteria,
    missingFields: evaluation.missingFields,
    observations,
    screenshotUrl: lastScreenshot,
    recoveryAttemptsCount: recoveryAttempt,
    recoveryAuditTrail: auditTrail,
    totalDurationMs: Date.now() - startTime,
    completedAt: new Date().toISOString(),
  };

  return VerifiedResultSchema.parse(result);
}
