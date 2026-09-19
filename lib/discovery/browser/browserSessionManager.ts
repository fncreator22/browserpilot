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

    if (record.status === "EXPIRED") {
      return {
        isValid: false,
        status: "EXPIRED",
        reason: "Session expired or rejected by remote platform",
        userFacingMessage: `Your ${source} session has expired. Please log in again to renew access.`,
        expiresAt: record.expiresAt,
      };
    }

    if (record.status === "DISCONNECTED") {
      return {
        isValid: false,
        status: "DISCONNECTED",
        reason: "Session is disconnected",
        userFacingMessage: `Your ${source} session is disconnected.`,
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
   * Automated re-auth signal handler for HTTP 401/403 or anti-bot challenge detection.
   * Marks the session as EXPIRED or REQUIRES_VERIFICATION, writes error telemetry to metadata,
   * and notifies callers that user re-authentication is required.
   */
  public async handleAuthFailure(
    userId: string,
    source: string,
    statusCode: number,
    failureReason?: string
  ): Promise<{
    sessionExpired: boolean;
    reauthRequired: boolean;
    status: BrowserSessionStatus;
    reason: string;
    userFacingMessage: string;
  }> {
    const normalizedSource = source.toUpperCase();
    const isExpired = statusCode === 401;
    const isForbidden = statusCode === 403;
    const nextStatus: BrowserSessionStatus = isExpired ? "EXPIRED" : isForbidden ? "REQUIRES_VERIFICATION" : "EXPIRED";

    const reason = failureReason || (isExpired
      ? `HTTP 401 Unauthorized: ${source} session token or cookie expired.`
      : isForbidden
      ? `HTTP 403 Forbidden: ${source} anti-bot or access challenge triggered.`
      : `HTTP ${statusCode} authentication error on ${source}.`);

    const userFacingMessage = isExpired
      ? `Your ${source} session has expired. Please reconnect your account to continue discovering roles.`
      : `Your ${source} session encountered a security check (HTTP 403). Please reconnect or verify your session.`;

    try {
      let record = await prisma.browserSession.findUnique({
        where: {
          userId_source: {
            userId,
            source: normalizedSource,
          },
        },
      });

      if (!record) {
        // Fallback to alias matching if source was an alias (e.g. twitter -> x_twitter)
        const cleanSource = source.toLowerCase();
        const { SOURCE_ALIASES } = await import("@/lib/plugins/pluginMarketplaceService");
        const aliases = SOURCE_ALIASES[cleanSource] || [];
        for (const alias of aliases) {
          const candidate = await prisma.browserSession.findUnique({
            where: {
              userId_source: {
                userId,
                source: alias.toUpperCase(),
              },
            },
          });
          if (candidate) {
            record = candidate;
            break;
          }
        }
      }

      if (record) {
        let meta: Record<string, unknown> = {};
        try {
          meta = JSON.parse(record.metadata || "{}");
        } catch {}

        meta.lastAuthFailure = {
          statusCode,
          reason,
          timestamp: new Date().toISOString(),
        };
        meta.reauthRequired = true;

        await prisma.browserSession.update({
          where: { id: record.id },
          data: {
            status: nextStatus,
            metadata: JSON.stringify(meta),
            updatedAt: new Date(),
          },
        });
      }
    } catch (err: any) {
      console.warn(`[BrowserSessionManager] handleAuthFailure update notice:`, err?.message || err);
    }

    return {
      sessionExpired: true,
      reauthRequired: true,
      status: nextStatus,
      reason,
      userFacingMessage,
    };
  }

  /**
   * Health check verifying whether session is active, expired, or flagged with reauthRequired.
   */
  public async checkSessionHealth(
    userId: string,
    source: string
  ): Promise<BrowserSessionValidationResult & { reauthRequired: boolean; failureReason?: string }> {
    const validation = await this.verifySession(userId, source);
    const normalizedSource = source.toUpperCase();

    const record = await prisma.browserSession.findUnique({
      where: {
        userId_source: {
          userId,
          source: normalizedSource,
        },
      },
    });

    let reauthRequired = !validation.isValid && validation.status !== "DISCONNECTED";
    let failureReason: string | undefined = validation.reason;

    if (record && !validation.isValid) {
      try {
        const meta = JSON.parse(record.metadata || "{}");
        if (meta.reauthRequired || meta.lastAuthFailure) {
          reauthRequired = true;
          if (!failureReason && meta.lastAuthFailure?.reason) {
            failureReason = meta.lastAuthFailure.reason;
          }
        }
      } catch {}
    }

    return {
      ...validation,
      reauthRequired,
      failureReason,
    };
  }

  /**
   * Imports a structured BYOC (Bring Your Own Cookie / Session Token) session with AES-256-GCM encryption.
   */
  public async importByocSession(
    userId: string,
    source: string,
    payload: {
      cookieString?: string;
      token?: string;
      username?: string;
      expiresInMs?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<BrowserSessionRecord> {
    const normalizedSource = source.toUpperCase();
    if (payload.cookieString && payload.cookieString.length > 65536) {
      throw new Error("BYOC cookieString exceeds maximum permitted length of 64KB.");
    }
    if (payload.token && payload.token.length > 16384) {
      throw new Error("BYOC token exceeds maximum permitted length of 16KB.");
    }
    const { parseCookieHeader } = await import("@/lib/security/credentialEncryption");

    const parsedCookies = payload.cookieString ? parseCookieHeader(payload.cookieString) : undefined;
    const sessionState = {
      cookieString: payload.cookieString,
      cookies: parsedCookies,
      token: payload.token,
      importedAt: new Date().toISOString(),
      ...(payload.metadata || {}),
    };

    const authMethod: BrowserAuthMethod = payload.token ? "SESSION_TOKEN" : "COOKIE_JAR";

    return this.createOrUpdateSession(userId, normalizedSource, sessionState, {
      authMethod,
      username: payload.username || (payload.token ? "Token Authorized" : "BYOC Cookie Session"),
      expiresInMs: payload.expiresInMs || 30 * 24 * 60 * 60 * 1000,
      metadata: {
        isByoc: true,
        cookieCount: parsedCookies ? Object.keys(parsedCookies).length : 0,
        hasToken: Boolean(payload.token),
        ...(payload.metadata || {}),
      },
    });
  }

  /**
   * Retrieves all expired or reauth-flagged sessions for a user.
   */
  public async getExpiredSessions(userId: string): Promise<BrowserSessionRecord[]> {
    const now = new Date();
    const records = await prisma.browserSession.findMany({
      where: {
        userId,
        OR: [
          { status: "EXPIRED" },
          { status: "REQUIRES_VERIFICATION" },
          {
            status: "CONNECTED",
            expiresAt: { lte: now },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    return records.map((r) => this.mapToRecord(r));
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
