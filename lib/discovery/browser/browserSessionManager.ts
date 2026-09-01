/**
 * §SECURE BROWSER SESSION MANAGER (TASK-039)
 * 
 * Manages user-owned authenticated browser sessions, encrypted storage states,
 * session verification, expiration enforcement, and secure deletion.
 */

import { prisma } from "@/lib/db/prisma";
import { encryptSessionPayload, decryptSessionPayload, maskSessionState } from "@/lib/security/sessionEncryption";
import {
  type BrowserSessionRecord,
  type BrowserSessionStatus,
  type BrowserAuthMethod,
  type BrowserSessionValidationResult,
} from "./browserSessionTypes";

export class BrowserSessionManager {
  /**
   * Encrypts and persists a user's authenticated browser session.
   */
  public async createOrUpdateSession(
    userId: string,
    source: string,
    rawState: Record<string, unknown>,
    options: {
      authMethod?: BrowserAuthMethod;
      username?: string;
      expiresInMs?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<BrowserSessionRecord> {
    const normalizedSource = source.toUpperCase();
    const encryptedState = await encryptSessionPayload(rawState);
    const now = new Date();
    const expiresAt = options.expiresInMs ? new Date(now.getTime() + options.expiresInMs) : null;

    const record = await prisma.browserSession.upsert({
      where: {
        userId_source: {
          userId,
          source: normalizedSource,
        },
      },
      create: {
        userId,
        source: normalizedSource,
        status: "CONNECTED",
        encryptedState,
        authMethod: options.authMethod || "STORAGE_STATE",
        username: options.username || null,
        expiresAt,
        lastVerifiedAt: now,
        lastUsedAt: now,
        metadata: JSON.stringify(options.metadata || {}),
      },
      update: {
        status: "CONNECTED",
        encryptedState,
        authMethod: options.authMethod || undefined,
        username: options.username || undefined,
        expiresAt,
        lastVerifiedAt: now,
        lastUsedAt: now,
        metadata: JSON.stringify(options.metadata || {}),
        updatedAt: now,
      },
    });

    return this.mapToRecord(record);
  }

  /**
   * Retrieves and decrypts the active session state for a user and source.
   * Returns null if session does not exist, is expired, or is revoked.
   */
  public async getActiveSession(
    userId: string,
    source: string
  ): Promise<{ record: BrowserSessionRecord; rawState: Record<string, unknown> } | null> {
    const normalizedSource = source.toUpperCase();

    const record = await prisma.browserSession.findUnique({
      where: {
        userId_source: {
          userId,
          source: normalizedSource,
        },
      },
    });

    if (!record) return null;

    // Check expiration
    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      if (record.status !== "EXPIRED") {
        await prisma.browserSession.update({
          where: { id: record.id },
          data: { status: "EXPIRED" },
        });
      }
      return null;
    }

    if (record.status !== "CONNECTED") {
      return null;
    }

    try {
      const rawState = await decryptSessionPayload<Record<string, unknown>>(record.encryptedState);

      // Update lastUsedAt
      await prisma.browserSession.update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        record: this.mapToRecord(record),
        rawState,
      };
    } catch (err) {
      console.error(`[BrowserSessionManager] Failed decrypting session for user ${userId}, source ${source}:`, err);
      return null;
    }
  }

  /**
   * Validates session health and expiration.
   */
  public async verifySession(userId: string, source: string): Promise<BrowserSessionValidationResult> {
    const normalizedSource = source.toUpperCase();

    const record = await prisma.browserSession.findUnique({
      where: {
        userId_source: {
          userId,
          source: normalizedSource,
        },
      },
    });

    if (!record) {
      return {
        isValid: false,
        status: "DISCONNECTED",
        reason: "No session found for this source",
        userFacingMessage: `You have not connected your ${source} session yet.`,
      };
    }

    if (record.status === "REVOKED") {
      return {
        isValid: false,
        status: "REVOKED",
        reason: "Session has been revoked by user",
        userFacingMessage: `Your ${source} session was revoked. Please reconnect to resume discovery.`,
      };
    }

    if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
      await prisma.browserSession.update({
        where: { id: record.id },
        data: { status: "EXPIRED" },
      });
      return {
        isValid: false,
        status: "EXPIRED",
        reason: "Session expired",
        userFacingMessage: `Your ${source} session has expired. Please log in again to renew access.`,
        expiresAt: record.expiresAt,
      };
    }

    if (record.status === "REQUIRES_VERIFICATION") {
      return {
        isValid: false,
        status: "REQUIRES_VERIFICATION",
        reason: "Source requires additional verification (CAPTCHA/2FA)",
        userFacingMessage: `${source} requires interactive verification. Please complete verification in your browser.`,
      };
    }

    return {
      isValid: true,
      status: "CONNECTED",
      expiresAt: record.expiresAt,
    };
  }

  /**
   * Revokes a user's session without deleting historical metadata.
   */
  public async revokeSession(userId: string, source: string): Promise<boolean> {
    const normalizedSource = source.toUpperCase();
    try {
      await prisma.browserSession.update({
        where: {
          userId_source: {
            userId,
            source: normalizedSource,
          },
        },
        data: {
          status: "REVOKED",
          encryptedState: "", // wipe sensitive state on revocation
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Permanently deletes a user's session.
   */
  public async deleteSession(userId: string, source: string): Promise<boolean> {
    const normalizedSource = source.toUpperCase();
    try {
      await prisma.browserSession.delete({
        where: {
          userId_source: {
            userId,
            source: normalizedSource,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists all session records for a user with safe masked state.
   */
  public async listUserSessions(userId: string): Promise<BrowserSessionRecord[]> {
    const records = await prisma.browserSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return records.map((r) => this.mapToRecord(r));
  }

  private mapToRecord(record: any): BrowserSessionRecord {
    return {
      id: record.id,
      userId: record.userId,
      source: record.source,
      status: record.status as BrowserSessionStatus,
      authMethod: record.authMethod as BrowserAuthMethod,
      username: record.username,
      expiresAt: record.expiresAt,
      lastVerifiedAt: record.lastVerifiedAt,
      lastUsedAt: record.lastUsedAt,
      metadata: JSON.parse(record.metadata || "{}"),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export const browserSessionManager = new BrowserSessionManager();
