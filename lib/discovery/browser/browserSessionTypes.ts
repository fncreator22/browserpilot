/**
 * §AUTHENTICATED BROWSER SESSION & CONNECTOR TYPES (TASK-039)
 * 
 * Canonical definitions, health statuses, and 11 structured error categories
 * for user-authorized browser crawling.
 */

export type BrowserSessionStatus =
  | "CONNECTED"
  | "EXPIRED"
  | "REVOKED"
  | "REQUIRES_VERIFICATION"
  | "DISCONNECTED";

export type BrowserAuthMethod =
  | "STORAGE_STATE"
  | "COOKIE_JAR"
  | "SESSION_TOKEN"
  | "CREDENTIAL_VAULT";

export type BrowserErrorCode =
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "USER_ACTION_REQUIRED"
  | "RATE_LIMITED"
  | "SOURCE_BLOCKED"
  | "CAPTCHA_DETECTED"
  | "TEMPORARY_FAILURE"
  | "NETWORK_FAILURE"
  | "EXTRACTION_FAILURE"
  | "INVALID_SOURCE"
  | "SYSTEM_FAILURE";

export interface BrowserConnectorErrorPayload {
  source: string;
  category: BrowserErrorCode;
  retryable: boolean;
  userActionRequired: boolean;
  message: string;
  userFacingMessage: string;
  internalCode: string;
  correlationId: string;
}

export class BrowserConnectorError extends Error {
  public readonly source: string;
  public readonly category: BrowserErrorCode;
  public readonly retryable: boolean;
  public readonly userActionRequired: boolean;
  public readonly userFacingMessage: string;
  public readonly internalCode: string;
  public readonly correlationId: string;

  constructor(payload: BrowserConnectorErrorPayload) {
    super(payload.message);
    this.name = "BrowserConnectorError";
    this.source = payload.source;
    this.category = payload.category;
    this.retryable = payload.retryable;
    this.userActionRequired = payload.userActionRequired;
    this.userFacingMessage = payload.userFacingMessage;
    this.internalCode = payload.internalCode;
    this.correlationId = payload.correlationId;
  }

  public toJSON(): BrowserConnectorErrorPayload {
    return {
      source: this.source,
      category: this.category,
      retryable: this.retryable,
      userActionRequired: this.userActionRequired,
      message: this.message,
      userFacingMessage: this.userFacingMessage,
      internalCode: this.internalCode,
      correlationId: this.correlationId,
    };
  }
}

export interface BrowserSessionRecord {
  id: string;
  userId: string;
  source: string;
  status: BrowserSessionStatus;
  authMethod: BrowserAuthMethod;
  username?: string | null;
  expiresAt?: Date | null;
  lastVerifiedAt?: Date | null;
  lastUsedAt?: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrowserSessionValidationResult {
  isValid: boolean;
  status: BrowserSessionStatus;
  reason?: string;
  userFacingMessage?: string;
  expiresAt?: Date | null;
}
