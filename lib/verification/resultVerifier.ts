import { type Observation } from "@/schemas/actions";
import { type VerificationStatus } from "@/schemas/results";

export interface ResultVerificationInput {
  goal: string;
  observations: Observation[];
  currentRecoveryAttempt: number; // 0 = initial run, 1 = first recovery, 2 = second recovery
  expectedFields?: string[];
  targetDomains?: string[];
}

export interface ResultVerificationEvaluation {
  status: VerificationStatus;
  confidence: number;
  reason: string;
  satisfiedCriteria: string[];
  missingFields: string[];
  extractedPayload?: unknown;
  suggestedRecoveryAction?: {
    strategy: "FALLBACK_SELECTOR" | "DOM_INSPECT_FIRST" | "WIDER_EXTRACTION" | "SCROLL_OR_REFRESH";
    hint: string;
  };
}

export class ResultVerifier {
  /**
   * Evaluates whether the execution output actually answered the user's goal
   */
  static verify(input: ResultVerificationInput): ResultVerificationEvaluation {
    const { goal, observations, currentRecoveryAttempt, expectedFields = [] } = input;
    const satisfiedCriteria: string[] = [];
    const missingFields: string[] = [];

    // 1. Check for Blocked or Verification Wall
    const blockedObs = observations.find((o) => o.status === "BLOCKED");
    if (blockedObs) {
      return {
        status: "BLOCKED",
        confidence: 1.0,
        reason: blockedObs.error?.userMessage || "Execution was halted due to a security verification or auth wall.",
        satisfiedCriteria: [],
        missingFields: ["ALL_FIELDS_BLOCKED"],
      };
    }

    // 2. Check for Fatal Navigation Failure
    const navObs = observations.find((o) => o.action.tool === "browser.navigate");
    if (navObs && navObs.status === "FAILED") {
      return {
        status: "FAILED",
        confidence: 0.0,
        reason: "Initial navigation to target URL failed completely.",
        satisfiedCriteria: [],
        missingFields: ["PAGE_LOAD_FAILED"],
      };
    }

    // 3. Scan Observations for Extracted Content
    let combinedExtractedData: unknown = null;
    const extractionObservations = observations.filter(
      (o) => o.action.tool === "browser.extractText"
    );

    for (const obs of extractionObservations) {
      if (obs.extractedData !== undefined && obs.extractedData !== null && obs.extractedData !== "") {
        // Exclude empty array or "not found" summaries
        if (Array.isArray(obs.extractedData) && obs.extractedData.length === 0) continue;
        if (typeof obs.extractedData === "string" && obs.extractedData.trim().length === 0) continue;

        combinedExtractedData = obs.extractedData;
        satisfiedCriteria.push(`Extracted content from ${obs.action.tool} (step ${obs.stepIndex})`);
      }
    }

    // 4. Verify Form Submissions or Interactive Success States
    const clickObs = observations.filter((o) => o.action.tool === "browser.click");
    if (clickObs.some((c) => c.status === "SUCCESS")) {
      satisfiedCriteria.push("Interactive action completed");
    }

    // 5. Evaluate Data Sufficiency & Expected Fields
    const hasData = combinedExtractedData !== null;
    const payloadStr = typeof combinedExtractedData === "string" 
      ? combinedExtractedData 
      : combinedExtractedData 
      ? JSON.stringify(combinedExtractedData) 
      : "";

    if (expectedFields.length > 0) {
      for (const field of expectedFields) {
        if (payloadStr.toLowerCase().includes(field.toLowerCase())) {
          satisfiedCriteria.push(`Found required field: "${field}"`);
        } else {
          missingFields.push(field);
        }
      }
    }

    const isPureInteraction =
      !goal.toLowerCase().includes("extract") &&
      !goal.toLowerCase().includes("find") &&
      !goal.toLowerCase().includes("get") &&
      !goal.toLowerCase().includes("table") &&
      clickObs.length > 0;

    // Full Verification Check
    if (
      (hasData && missingFields.length === 0 && (expectedFields.length === 0 || satisfiedCriteria.length >= expectedFields.length)) ||
      (isPureInteraction && satisfiedCriteria.length > 0 && missingFields.length === 0)
    ) {
      return {
        status: "VERIFIED",
        confidence: 0.95,
        reason: "Execution successfully satisfied all goal criteria and verified target data.",
        satisfiedCriteria,
        missingFields: [],
        extractedPayload: combinedExtractedData,
      };
    }

    // 6. Data is Missing or Incomplete -> RECOVER or PARTIAL
    const maxAttemptsExhausted = currentRecoveryAttempt >= 2;

    if (!maxAttemptsExhausted) {
      // Trigger Recovery Attempt
      return {
        status: "RECOVER",
        confidence: 0.3,
        reason: `Target content missing or incomplete (Attempt ${currentRecoveryAttempt + 1}/2). Triggering recovery action.`,
        satisfiedCriteria,
        missingFields: missingFields.length > 0 ? missingFields : ["TARGET_DATA_NOT_FOUND"],
        suggestedRecoveryAction: {
          strategy: "FALLBACK_SELECTOR",
          hint: "Try inspecting the DOM or extracting from parent container selectors.",
        },
      };
    }

    // Recovery attempts exhausted -> Fall back to PARTIAL
    return {
      status: "PARTIAL",
      confidence: 0.5,
      reason: `Execution completed 2 recovery attempts but target information remained incomplete.`,
      satisfiedCriteria,
      missingFields: missingFields.length > 0 ? missingFields : ["PARTIAL_EXTRACTION"],
      extractedPayload: combinedExtractedData || "No structured text could be extracted from target selectors.",
    };
  }
}
