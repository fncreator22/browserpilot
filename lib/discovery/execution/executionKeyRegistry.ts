/**
 * §ATOMIC EXECUTION KEY KILL REGISTRY & CANCELLATION PROTOCOL
 * 
 * Binds every discovery search request to an atomic execution key.
 * Upon cancellation, immediately revokes the key across in-memory registry,
 * Redis distributed channels, and global AbortControllers.
 * Running workers fail-fast, skip candidate writes, and terminate cleanly.
 */

import { getSharedRedisClient } from "@/lib/redis/redisClient";
import { searchEventBus } from "@/lib/events/searchEvents";
import { prisma } from "@/lib/db/prisma";

declare global {
  var __browserpilot_active_execution_keys: Set<string> | undefined;
  var __browserpilot_revoked_execution_keys: Set<string> | undefined;
  var __browserpilot_active_abort_controllers: Map<string, AbortController> | undefined;
  var __browserpilot_cancelled_executions: Set<string> | undefined;
}

if (!globalThis.__browserpilot_active_execution_keys) {
  globalThis.__browserpilot_active_execution_keys = new Set();
}
if (!globalThis.__browserpilot_revoked_execution_keys) {
  globalThis.__browserpilot_revoked_execution_keys = new Set();
}
if (!globalThis.__browserpilot_active_abort_controllers) {
  globalThis.__browserpilot_active_abort_controllers = new Map();
}
if (!globalThis.__browserpilot_cancelled_executions) {
  globalThis.__browserpilot_cancelled_executions = new Set();
}

export const EXECUTION_CANCEL_REDIS_CHANNEL = "browserpilot:execution:cancel";

export class ExecutionKeyRegistry {
  /**
   * Registers a newly issued execution key bound to an AbortController.
   */
  public registerKey(executionId: string, abortController?: AbortController): void {
    if (!executionId) return;

    // Once an execution key is revoked/killed, it is permanently DEAD.
    // Prevent race conditions where a fast-kill (< 50ms) occurs before or during registration.
    if (this.isKeyRevoked(executionId)) {
      if (abortController && !abortController.signal.aborted) {
        abortController.abort("CANCELLED_BY_USER");
      }
      return;
    }

    if (abortController?.signal?.aborted) {
      globalThis.__browserpilot_revoked_execution_keys?.add(executionId);
      globalThis.__browserpilot_cancelled_executions?.add(executionId);
      return;
    }

    globalThis.__browserpilot_active_execution_keys?.add(executionId);

    if (abortController) {
      globalThis.__browserpilot_active_abort_controllers?.set(executionId, abortController);
    }

    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        redis.set(`execution:active:${executionId}`, "1", "EX", 3600).catch(() => {});
      }
    } catch {}
  }

  /**
   * Fast synchronous check if an execution key has been revoked/killed.
   */
  public isKeyRevoked(executionId: string): boolean {
    if (!executionId) return true;
    if (globalThis.__browserpilot_revoked_execution_keys?.has(executionId)) {
      return true;
    }
    if (globalThis.__browserpilot_cancelled_executions?.has(executionId)) {
      return true;
    }
    const abortCtrl = globalThis.__browserpilot_active_abort_controllers?.get(executionId);
    if (abortCtrl?.signal?.aborted) {
      return true;
    }
    return false;
  }

  /**
   * Async check if an execution key has been revoked, querying distributed Redis state
   * and falling back to PostgreSQL tombstone if Redis is offline or disconnected.
   */
  public async isKeyRevokedAsync(executionId: string): Promise<boolean> {
    if (!executionId) return true;
    if (this.isKeyRevoked(executionId)) return true;

    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        const [revoked, cancelled] = await Promise.all([
          redis.get(`execution:revoked:${executionId}`),
          redis.get(`execution:cancelled:${executionId}`),
        ]);
        if (revoked || cancelled) {
          globalThis.__browserpilot_revoked_execution_keys?.add(executionId);
          globalThis.__browserpilot_cancelled_executions?.add(executionId);
          return true;
        }
      }
    } catch {}

    // Distributed fallback: query PostgreSQL tombstone across multi-process workers
    try {
      const record = await prisma.search.findUnique({
        where: { id: executionId },
        select: { status: true, cancellationRequested: true, stoppingReason: true },
      });
      if (
        record &&
        (record.cancellationRequested ||
          record.status === "STOPPED" ||
          record.stoppingReason === "CANCELLED_BY_USER" ||
          record.stoppingReason === "CANCELLED")
      ) {
        globalThis.__browserpilot_revoked_execution_keys?.add(executionId);
        globalThis.__browserpilot_cancelled_executions?.add(executionId);
        return true;
      }
    } catch {}

    return false;
  }

  /**
   * Checks if an execution key is valid and active.
   */
  public isKeyActive(executionId: string): boolean {
    if (!executionId) return false;
    if (this.isKeyRevoked(executionId)) return false;
    return Boolean(globalThis.__browserpilot_active_execution_keys?.has(executionId));
  }

  /**
   * Returns count of active in-memory execution keys.
   */
  public getActiveKeyCount(): number {
    return globalThis.__browserpilot_active_execution_keys?.size || 0;
  }

  /**
   * Atomic key-killing mechanism:
   * 1. Revokes and destroys the execution key in memory instantly.
   * 2. Aborts all associated AbortControllers.
   * 3. Syncs revocation across Redis distributed keys and Pub/Sub channel.
   * 4. Broadcasts SSE cancellation event to close frontend stream immediately.
   * 5. Tombstones database record with status: STOPPED, cancellationRequested: true,
   *    stoppingReason: CANCELLED_BY_USER, totalFound: 0, and purges any written results.
   */
  public async killExecutionKey(
    executionId: string,
    reason = "CANCELLED_BY_USER",
    requestingUserId?: string | null
  ): Promise<{ success: boolean; executionId: string; status: "STOPPED" }> {
    if (!executionId) {
      return { success: true, executionId: "", status: "STOPPED" };
    }

    // 1. In-Memory Atomic Revocation
    globalThis.__browserpilot_active_execution_keys?.delete(executionId);
    globalThis.__browserpilot_revoked_execution_keys?.add(executionId);
    globalThis.__browserpilot_cancelled_executions?.add(executionId);

    // 2. Abort all associated AbortControllers
    const activeAbort = globalThis.__browserpilot_active_abort_controllers?.get(executionId);
    if (activeAbort && !activeAbort.signal.aborted) {
      activeAbort.abort(reason);
    }
    globalThis.__browserpilot_active_abort_controllers?.delete(executionId);

    // 3. Emit instant SSE stage event so frontend UI unblocks immediately
    try {
      searchEventBus.emitSearchEvent(executionId, "cancelled", {
        reason,
        status: "STOPPED",
        totalFound: 0,
        resultsCount: 0,
        timestamp: new Date().toISOString(),
      });
    } catch {}

    // 4. Redis Distributed Revocation & Pub/Sub Broadcast
    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        await Promise.allSettled([
          redis.del(`execution:active:${executionId}`),
          redis.set(`execution:revoked:${executionId}`, reason, "EX", 3600),
          redis.set(`execution:cancelled:${executionId}`, reason, "EX", 3600),
          redis.publish(
            EXECUTION_CANCEL_REDIS_CHANNEL,
            JSON.stringify({ executionId, reason, requestingUserId, timestamp: Date.now() })
          ),
        ]);
      }
    } catch {}

    // 5. Database Tombstone & Zero-Result Guarantee
    try {
      // Delete any candidate opportunity links attached to this search execution
      await prisma.searchResult.deleteMany({
        where: { searchId: executionId },
      }).catch(() => {});

      // Update or upsert tombstone record in database
      const existing = await prisma.search.findUnique({
        where: { id: executionId },
        select: { id: true },
      }).catch(() => null);

      if (existing) {
        await prisma.search.update({
          where: { id: executionId },
          data: {
            status: "STOPPED",
            cancellationRequested: true,
            stoppingReason: reason,
            totalFound: 0,
            completedAt: new Date(),
          },
        }).catch(() => {});
      } else {
        // Safe check for valid foreign key user
        let validUserId: string | null = null;
        if (requestingUserId) {
          const userExists = await prisma.user.findUnique({
            where: { id: requestingUserId },
            select: { id: true },
          }).catch(() => null);
          if (userExists) validUserId = requestingUserId;
        }

        await prisma.search.upsert({
          where: { id: executionId },
          create: {
            id: executionId,
            userId: validUserId,
            rawQuery: "Cancelled search",
            status: "STOPPED",
            cancellationRequested: true,
            stoppingReason: reason,
            totalFound: 0,
            completedAt: new Date(),
          },
          update: {
            status: "STOPPED",
            cancellationRequested: true,
            stoppingReason: reason,
            totalFound: 0,
            completedAt: new Date(),
          },
        }).catch(() => {});
      }
    } catch (dbErr) {
      console.warn(`[ExecutionKeyRegistry] DB tombstone update error for ${executionId}:`, dbErr);
    }

    return {
      success: true,
      executionId,
      status: "STOPPED",
    };
  }

  /**
   * Resets internal memory state (for testing).
   */
  public reset(): void {
    globalThis.__browserpilot_active_execution_keys?.clear();
    globalThis.__browserpilot_revoked_execution_keys?.clear();
    globalThis.__browserpilot_active_abort_controllers?.clear();
    globalThis.__browserpilot_cancelled_executions?.clear();
  }
}

export const executionKeyRegistry = new ExecutionKeyRegistry();
