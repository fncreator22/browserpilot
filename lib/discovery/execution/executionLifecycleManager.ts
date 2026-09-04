/**
 * §EXECUTION LIFECYCLE MANAGER & CONCURRENCY COORDINATOR (TASK-067)
 * 
 * Provides durable execution identity, deterministic state machine enforcement,
 * duplicate execution idempotency, isolated cancellation contexts, late-result protection,
 * multi-tenant boundary checks, and process crash recovery.
 */

import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";
import {
  updateSearchStatusCas,
  touchSearchHeartbeat,
  getActiveUserSearch,
} from "@/lib/db/opportunities";

export type ExecutionLifecycleState =
  | "CREATED"
  | "QUEUED"
  | "RUNNING"
  | "CANCELLING"
  | "COMPLETED"
  | "STOPPED"
  | "FAILED"
  | "RECOVERABLE";

export const ALLOWED_TRANSITIONS: Record<ExecutionLifecycleState, ExecutionLifecycleState[]> = {
  CREATED: ["QUEUED", "RUNNING", "STOPPED", "FAILED"],
  QUEUED: ["RUNNING", "CANCELLING", "STOPPED", "FAILED"],
  RUNNING: ["CANCELLING", "COMPLETED", "STOPPED", "FAILED", "RECOVERABLE"],
  CANCELLING: ["STOPPED", "FAILED"],
  RECOVERABLE: ["RUNNING", "FAILED"],
  COMPLETED: [], // Terminal state
  STOPPED: [],   // Terminal state
  FAILED: ["RECOVERABLE"], // Terminal unless explicit recovery action
};

export interface CanonicalIntentNormalization {
  roles: string[];
  locations: string[];
  workModes: string[];
  skills: string[];
  experienceLevel: string;
  opportunityType: string;
  freshnessWindowHours: number | null;
  minimumMatchScore: number | null;
  targetCompanies: string[];
  requestedCount: number;
}

export interface ActiveExecutionHandle {
  executionId: string;
  userId: string;
  canonicalIntentHash: string;
  abortController: AbortController;
  promise?: Promise<any>;
  heartbeatTimer?: NodeJS.Timeout;
  startedAt: Date;
  lastActive: Date;
}

export class ExecutionLifecycleManager {
  private activeExecutions = new Map<string, ActiveExecutionHandle>();
  private intentExecutionMap = new Map<string, string>(); // `userId:hash` -> executionId
  private staleThresholdMs = 30000; // 30s heartbeat lease before considered stale

  /**
   * Computes a deterministic canonical intent hash and normalized JSON representation.
   */
  public computeCanonicalIntentHash(intent: Partial<SearchIntent>): {
    hash: string;
    canonicalJson: string;
    normalized: CanonicalIntentNormalization;
  } {
    const normalizeList = (items?: string[] | string | null): string[] => {
      if (!items) return [];
      const arr = Array.isArray(items) ? items : [items];
      return Array.from(
        new Set(
          arr
            .map((s) => (typeof s === "string" ? s.trim().toLowerCase().replace(/\s+/g, " ") : ""))
            .filter(Boolean)
        )
      ).sort();
    };

    const roles = normalizeList(intent.roles || intent.role);
    const locations = normalizeList(intent.locations || intent.location);
    const workModes = normalizeList(intent.workModes || intent.workMode);
    const skills = normalizeList(intent.skills);
    const targetCompanies = normalizeList(intent.companies || intent.company);

    const experienceLevel = (intent.experienceLevel || "ENTRY_LEVEL").trim().toUpperCase();
    const opportunityType = (intent.opportunityType || "FULL_TIME").trim().toUpperCase();
    const freshnessWindowHours = typeof intent.freshnessWindowHours === "number" ? intent.freshnessWindowHours : null;
    const minimumMatchScore = typeof intent.minimumMatchScore === "number" ? intent.minimumMatchScore : null;
    const requestedCount = typeof intent.requestedCount === "number" ? intent.requestedCount : 10;

    const normalized: CanonicalIntentNormalization = {
      roles,
      locations,
      workModes,
      skills,
      experienceLevel,
      opportunityType,
      freshnessWindowHours,
      minimumMatchScore,
      targetCompanies,
      requestedCount,
    };

    const canonicalJson = JSON.stringify(normalized);
    const hash = crypto.createHash("sha256").update(canonicalJson).digest("hex");

    return { hash, canonicalJson, normalized };
  }

  /**
   * Checks if an equivalent active execution is currently in-flight for this user.
   */
  public getActiveExecutionForIntent(userId: string, canonicalIntentHash: string): ActiveExecutionHandle | null {
    const key = `${userId}:${canonicalIntentHash}`;
    const existingId = this.intentExecutionMap.get(key);
    if (!existingId) return null;

    const handle = this.activeExecutions.get(existingId);
    if (!handle) {
      this.intentExecutionMap.delete(key);
      return null;
    }

    // Verify handle is still alive
    if (Date.now() - handle.lastActive.getTime() > this.staleThresholdMs) {
      this.unregisterExecution(existingId);
      return null;
    }

    return handle;
  }

  /**
   * Registers a newly started execution in the active registry and initiates heartbeats.
   */
  public registerExecution(
    executionId: string,
    userId: string,
    canonicalIntentHash: string,
    abortController: AbortController,
    promise?: Promise<any>
  ): ActiveExecutionHandle {
    // Clear any previous registration for this executionId if it existed
    if (this.activeExecutions.has(executionId)) {
      this.unregisterExecution(executionId);
    }

    const heartbeatTimer = setInterval(async () => {
      try {
        await touchSearchHeartbeat(executionId);
        const active = this.activeExecutions.get(executionId);
        if (active) {
          active.lastActive = new Date();
        }
      } catch (err) {
        // Non-fatal heartbeat warning
      }
    }, 5000);

    // Ensure timer does not prevent process exit in node
    if (heartbeatTimer.unref) {
      heartbeatTimer.unref();
    }

    const handle: ActiveExecutionHandle = {
      executionId,
      userId,
      canonicalIntentHash,
      abortController,
      promise,
      heartbeatTimer,
      startedAt: new Date(),
      lastActive: new Date(),
    };

    this.activeExecutions.set(executionId, handle);
    this.intentExecutionMap.set(`${userId}:${canonicalIntentHash}`, executionId);

    return handle;
  }

  /**
   * Attaches an execution promise to an existing handle.
   */
  public attachPromise(executionId: string, promise: Promise<any>): void {
    const handle = this.activeExecutions.get(executionId);
    if (handle) {
      handle.promise = promise;
    }
  }

  /**
   * Unregisters an execution upon completion, cancellation, or failure.
   */
  public unregisterExecution(executionId: string): void {
    const handle = this.activeExecutions.get(executionId);
    if (handle) {
      if (handle.heartbeatTimer) {
        clearInterval(handle.heartbeatTimer);
      }
      this.intentExecutionMap.delete(`${handle.userId}:${handle.canonicalIntentHash}`);
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Gets an active execution handle by its executionId.
   */
  public getExecutionHandle(executionId: string): ActiveExecutionHandle | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Validates and transitions an execution to a new state using atomic Compare-and-Swap.
   * Throws an error if the transition is deterministic and invalid.
   */
  public async transitionState(
    executionId: string,
    targetState: ExecutionLifecycleState,
    metadata: {
      stoppingReason?: string | null;
      failureReason?: string | null;
      totalFound?: number;
      isRecoverable?: boolean;
      cancellationRequested?: boolean;
      completedAt?: Date | null;
    } = {}
  ): Promise<boolean> {
    const currentRecord = await prisma.search.findUnique({
      where: { id: executionId },
      select: { status: true, userId: true },
    });

    if (!currentRecord) {
      throw new Error(`[ExecutionLifecycle] Execution '${executionId}' not found.`);
    }

    const currentState = currentRecord.status as ExecutionLifecycleState;

    // If already in target state, return idempotently
    if (currentState === targetState) {
      return true;
    }

    // Check deterministic transition validity
    const allowed = ALLOWED_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      throw new Error(
        `[ExecutionLifecycle] Invalid state transition: Cannot transition execution '${executionId}' from '${currentState}' to '${targetState}'.`
      );
    }

    // Atomic CAS update in database
    const updated = await updateSearchStatusCas(
      executionId,
      currentState,
      targetState,
      {
        stoppingReason: metadata.stoppingReason ?? null,
        failureReason: metadata.failureReason ?? null,
        totalFound: metadata.totalFound,
        isRecoverable: metadata.isRecoverable ?? false,
        cancellationRequested: metadata.cancellationRequested ?? (targetState === "CANCELLING" || targetState === "STOPPED"),
        completedAt: targetState === "COMPLETED" || targetState === "STOPPED" || targetState === "FAILED"
          ? new Date()
          : null,
      }
    );

    if (updated && (targetState === "COMPLETED" || targetState === "STOPPED" || targetState === "FAILED")) {
      this.unregisterExecution(executionId);
    }

    return updated;
  }

  /**
   * Cancels a specific execution idempotently and securely.
   * Verifies requesting user identity to guarantee multi-tenant safety.
   */
  public async cancelExecution(
    executionId: string,
    requestingUserId?: string | null,
    reason = "CANCELLED"
  ): Promise<{ success: boolean; status: ExecutionLifecycleState; alreadyStopped?: boolean }> {
    const record = await prisma.search.findUnique({
      where: { id: executionId },
      select: { id: true, userId: true, status: true },
    });

    if (!record) {
      return { success: false, status: "FAILED" };
    }

    // Multi-tenant check: if requestingUserId is provided, verify ownership
    if (requestingUserId && record.userId && record.userId !== requestingUserId) {
      throw new Error(`[ExecutionLifecycle] Unauthorized: User '${requestingUserId}' cannot cancel execution owned by '${record.userId}'.`);
    }

    // Idempotent cancellation: if already stopped or completed, do not corrupt
    if (record.status === "STOPPED") {
      return { success: true, status: "STOPPED", alreadyStopped: true };
    }
    if (record.status === "COMPLETED" || record.status === "FAILED") {
      return { success: true, status: record.status as ExecutionLifecycleState, alreadyStopped: true };
    }

    // Signal abort on the in-memory handle if active
    const handle = this.activeExecutions.get(executionId);
    if (handle) {
      if (!handle.abortController.signal.aborted) {
        handle.abortController.abort(reason);
      }
    }

    // Update database status to STOPPED
    await updateSearchStatusCas(
      executionId,
      ["CREATED", "QUEUED", "RUNNING", "CANCELLING"],
      "STOPPED",
      {
        stoppingReason: reason,
        cancellationRequested: true,
        completedAt: new Date(),
      }
    );

    this.unregisterExecution(executionId);
    return { success: true, status: "STOPPED" };
  }

  /**
   * Checks whether an execution is still active (RUNNING / QUEUED / CREATED).
   * Used for late-result protection: prevents late async callbacks from mutating finished executions.
   */
  public async isExecutionActive(executionId: string): Promise<boolean> {
    const record = await prisma.search.findUnique({
      where: { id: executionId },
      select: { status: true },
    });
    if (!record) return false;
    return ["CREATED", "QUEUED", "RUNNING"].includes(record.status);
  }

  /**
   * Scans for stale RUNNING executions (e.g. following process restart / crash)
   * and transitions them to RECOVERABLE or FAILED with INTERRUPTED_CRASH reason.
   */
  public async recoverStaleExecutions(customThresholdMs?: number): Promise<{
    recoveredCount: number;
    staleExecutionIds: string[];
  }> {
    const threshold = customThresholdMs || this.staleThresholdMs;
    const cutoff = new Date(Date.now() - threshold);

    const staleExecutions = await prisma.search.findMany({
      where: {
        status: "RUNNING",
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        totalFound: true,
      },
    });

    const staleExecutionIds: string[] = [];

    for (const exec of staleExecutions) {
      staleExecutionIds.push(exec.id);
      // Unregister any ghost memory handles
      this.unregisterExecution(exec.id);

      if (exec.totalFound > 0) {
        // Preserves partial results truthfully as RECOVERABLE
        await prisma.search.update({
          where: { id: exec.id },
          data: {
            status: "RECOVERABLE",
            isRecoverable: true,
            stoppingReason: "INTERRUPTED_CRASH",
            failureReason: "Execution was interrupted by process restart or crash. Partial results preserved.",
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.search.update({
          where: { id: exec.id },
          data: {
            status: "FAILED",
            isRecoverable: false,
            stoppingReason: "INTERRUPTED_CRASH",
            failureReason: "Execution lost heartbeat before discovery could complete.",
            updatedAt: new Date(),
          },
        });
      }
    }

    return {
      recoveredCount: staleExecutionIds.length,
      staleExecutionIds,
    };
  }

  /**
   * Resets internal memory state (for testing).
   */
  public reset(): void {
    for (const handle of this.activeExecutions.values()) {
      if (handle.heartbeatTimer) {
        clearInterval(handle.heartbeatTimer);
      }
    }
    this.activeExecutions.clear();
    this.intentExecutionMap.clear();
  }
}

export const executionLifecycleManager = new ExecutionLifecycleManager();
