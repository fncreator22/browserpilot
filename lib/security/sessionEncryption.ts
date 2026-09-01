/**
 * §SESSION ENCRYPTION & CREDENTIAL SECURITY ADAPTER (TASK-039)
 * 
 * Provides authenticated symmetric encryption (AES-256-GCM) for browser storage states,
 * cookies, tokens, and credentials. Supports pluggable envelope encryption for AWS KMS readiness.
 */

import crypto from "node:crypto";

export interface SessionEncryptionAdapter {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

export class LocalAesGcmEncryptionAdapter implements SessionEncryptionAdapter {
  private readonly algorithm = "aes-256-gcm";
  private readonly key: Buffer;

  constructor(secretKey?: string) {
    const rawSecret =
      secretKey ||
      process.env.SESSION_ENCRYPTION_KEY ||
      process.env.ENCRYPTION_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      "browserpilot-development-encryption-master-secret-key-32b";

    // Derive 32-byte key via SHA-256
    this.key = crypto.createHash("sha256").update(rawSecret).digest();
  }

  public async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.randomBytes(12); // 96-bit IV standard for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    // Format: iv:tag:ciphertext
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  }

  public async decrypt(ciphertext: string): Promise<string> {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted payload format: expected iv:tag:ciphertext");
    }

    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}

/**
 * AWS KMS Envelope Encryption Adapter Stub (AWS Deployment Lock active)
 */
export class AwsKmsEnvelopeEncryptionAdapter implements SessionEncryptionAdapter {
  private localFallback = new LocalAesGcmEncryptionAdapter();

  public async encrypt(plaintext: string): Promise<string> {
    // In local / development mode, defer to local AES-GCM
    return this.localFallback.encrypt(plaintext);
  }

  public async decrypt(ciphertext: string): Promise<string> {
    return this.localFallback.decrypt(ciphertext);
  }
}

// Global active adapter singleton
let activeEncryptionAdapter: SessionEncryptionAdapter = new LocalAesGcmEncryptionAdapter();

export function setSessionEncryptionAdapter(adapter: SessionEncryptionAdapter): void {
  activeEncryptionAdapter = adapter;
}

export async function encryptSessionPayload(data: unknown): Promise<string> {
  const jsonStr = JSON.stringify(data);
  return activeEncryptionAdapter.encrypt(jsonStr);
}

export async function decryptSessionPayload<T>(ciphertext: string): Promise<T> {
  const decryptedStr = await activeEncryptionAdapter.decrypt(ciphertext);
  return JSON.parse(decryptedStr) as T;
}

/**
 * Masks sensitive session states, cookies, or storage tokens for safe telemetry / logging.
 */
export function maskSessionState(state: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!state) return {};

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === "string") {
      const lowerKey = key.toLowerCase();
      const isSensitiveKey =
        lowerKey.includes("token") ||
        lowerKey.includes("cookie") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("key") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("session") ||
        lowerKey.includes("csrf") ||
        lowerKey.includes("li_at") ||
        lowerKey.includes("jsessionid") ||
        lowerKey.includes("sid") ||
        lowerKey.includes("jwt") ||
        value.length > 20;

      if (isSensitiveKey) {
        masked[key] = value.length > 8 ? `${value.slice(0, 4)}••••${value.slice(-3)}` : "••••••••";
      } else {
        masked[key] = value;
      }
    } else if (Array.isArray(value)) {
      masked[key] = `[Array: ${value.length} items]`;
    } else if (typeof value === "object" && value !== null) {
      masked[key] = "{...}";
    } else {
      masked[key] = value;
    }
  }

  return masked;
}
