import { z } from "zod";
import { ObservationSchema, BrowserActionSchema } from "./actions";

/**
 * Result Verification Status per §13-14
 */
export const VerificationStatusSchema = z.enum([
  "VERIFIED",
  "RECOVER",
  "PARTIAL",
  "FAILED",
  "BLOCKED",
]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

/**
 * Recovery Audit Step Schema
 */
export const RecoveryAuditStepSchema = z.object({
  attemptNumber: z.number().int().min(1).max(2),
  triggerReason: z.string(),
  recoveryAction: BrowserActionSchema,
  observation: ObservationSchema,
  timestamp: z.string(),
});
export type RecoveryAuditStep = z.infer<typeof RecoveryAuditStepSchema>;

/**
 * Final Verified Result Schema
 * Target shape per Prompt 06/13
 */
export const VerifiedResultSchema = z.object({
  jobId: z.string(),
  goal: z.string(),
  verificationStatus: z.enum(["VERIFIED", "PARTIAL", "FAILED", "BLOCKED"]),
  confidence: z.number().min(0).max(1.0).default(1.0),
  summary: z.string(),
  extractedData: z.unknown().optional(),
  satisfiedCriteria: z.array(z.string()).default([]),
  missingFields: z.array(z.string()).default([]),
  observations: z.array(ObservationSchema),
  screenshotUrl: z.string().nullable().optional(),
  recoveryAttemptsCount: z.number().int().min(0).max(2).default(0),
  recoveryAuditTrail: z.array(RecoveryAuditStepSchema).default([]),
  totalDurationMs: z.number().nonnegative(),
  completedAt: z.string(),
});
export type VerifiedResult = z.infer<typeof VerifiedResultSchema>;
