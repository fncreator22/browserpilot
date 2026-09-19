/**
 * §CREDENTIAL ENCRYPTION AT REST (AES-256-GCM)
 * 
 * Provides NIST-compliant authenticated encryption for third-party credentials
 * (Gemini BYOK keys, Puter bearer tokens, etc.) stored in PostgreSQL.
 * Format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */

import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const PREFIX = "enc:v1:";

export interface ByocSessionPayload {
  cookies?: Record<string, string>;
  rawCookieString?: string;
  token?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Checks if a string is in the encrypted format
 */
export function isEncryptedCredential(value?: string | null): boolean {
  if (!value) return false;
  return value.trim().startsWith(PREFIX);
}

/**
 * Parses a standard HTTP Cookie header string into key-value pairs
 */
export function parseCookieHeader(cookieString?: string | null): Record<string, string> {
  if (!cookieString || typeof cookieString !== "string" || !cookieString.trim()) return {};
  const maxSafeLen = 65536; // 64KB safety limit
  const sanitizedInput = cookieString.length > maxSafeLen ? cookieString.slice(0, maxSafeLen) : cookieString;
  const cookies: Record<string, string> = Object.create(null);
  const pairs = sanitizedInput.split(";");
  const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !forbiddenKeys.has(key)) {
        cookies[key] = val;
      }
    } else if (trimmed && !forbiddenKeys.has(trimmed)) {
      cookies[trimmed] = "";
    }
  }
  return cookies;
}

/**
 * Determines whether a session expiration date has passed
 */
export function isSessionExpired(expiresAt?: Date | string | null): boolean {
  if (!expiresAt) return false;
  const expDate = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return expDate.getTime() <= Date.now();
}

/**
 * Derives a consistent 32-byte encryption key from environment secret
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.CREDENTIAL_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "browserpilot-credential-encryption-secret-32b";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext credential using AES-256-GCM.
 * If already encrypted with enc:v1:, returns as-is.
 */
export function encryptCredential(plaintext?: string | null): string | null {
  if (!plaintext || !plaintext.trim()) return null;
  const clean = plaintext.trim();

  // Idempotency: Do not re-encrypt already encrypted payloads
  if (clean.startsWith(PREFIX)) return clean;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(clean, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${PREFIX}${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted credential.
 * If the input is unencrypted legacy plaintext, returns it as-is for backward compatibility.
 */
export function decryptCredential(ciphertext?: string | null): string | null {
  if (!ciphertext || !ciphertext.trim()) return null;
  const clean = ciphertext.trim();

  if (!clean.startsWith(PREFIX)) {
    // Legacy plaintext fallback
    return clean;
  }

  try {
    const parts = clean.slice(PREFIX.length).split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted credential format");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[CredentialEncryption] Decryption failed:", (err as Error).message);
    return null;
  }
}

/**
 * Encrypts a structured BYOC session payload (cookies, tokens, metadata) into an AES-256-GCM ciphertext.
 */
export function encryptByocSession(payload: ByocSessionPayload): string | null {
  if (!payload) return null;
  const jsonStr = JSON.stringify(payload);
  return encryptCredential(jsonStr);
}

/**
 * Decrypts an AES-256-GCM ciphertext into a structured ByocSessionPayload.
 */
export function decryptByocSession(ciphertext?: string | null): ByocSessionPayload | null {
  if (!ciphertext) return null;
  const decrypted = decryptCredential(ciphertext);
  if (!decrypted) return null;
  try {
    const parsed = JSON.parse(decrypted);
    return parsed as ByocSessionPayload;
  } catch {
    return {
      rawCookieString: decrypted,
      token: decrypted,
    };
  }
}

/**
 * Returns a safe masked version of a credential without exposing secrets.
 */
export function maskCredential(rawOrEncrypted?: string | null): string | null {
  if (!rawOrEncrypted) return null;
  const decrypted = decryptCredential(rawOrEncrypted);
  if (!decrypted) return null;

  if (decrypted.length > 8) {
    const prefix = decrypted.slice(0, Math.min(6, Math.floor(decrypted.length / 3)));
    const suffix = decrypted.slice(-Math.min(4, Math.floor(decrypted.length / 4)));
    return `${prefix}••••••••${suffix}`;
  }
  return "••••••••";
}

/**
 * Performs database-level migration of all plaintext credentials to AES-256-GCM encrypted form.
 */
export async function migratePlaintextCredentials(): Promise<{
  migratedUsers: number;
  migratedProviders: number;
}> {
  let migratedUsers = 0;
  let migratedProviders = 0;

  // 1. Migrate users.geminiApiKey
  const usersWithKeys = await prisma.user.findMany({
    where: {
      geminiApiKey: {
        not: null,
      },
    },
    select: {
      id: true,
      geminiApiKey: true,
    },
  });

  for (const u of usersWithKeys) {
    if (u.geminiApiKey && !u.geminiApiKey.startsWith(PREFIX)) {
      const encrypted = encryptCredential(u.geminiApiKey);
      if (encrypted) {
        await prisma.user.update({
          where: { id: u.id },
          data: { geminiApiKey: encrypted },
        });
        migratedUsers++;
      }
    }
  }

  // 2. Migrate provider_connections.encryptedCredential
  const connectionsWithKeys = await prisma.providerConnection.findMany({
    where: {
      encryptedCredential: {
        not: null,
      },
    },
    select: {
      id: true,
      encryptedCredential: true,
    },
  });

  for (const conn of connectionsWithKeys) {
    if (conn.encryptedCredential && !conn.encryptedCredential.startsWith(PREFIX)) {
      const encrypted = encryptCredential(conn.encryptedCredential);
      if (encrypted) {
        await prisma.providerConnection.update({
          where: { id: conn.id },
          data: { encryptedCredential: encrypted },
        });
        migratedProviders++;
      }
    }
  }

  return { migratedUsers, migratedProviders };
}
