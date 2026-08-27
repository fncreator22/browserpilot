import fs from "node:fs/promises";
import path from "node:path";

export interface IArtifactStorage {
  saveArtifact(jobId: string, filename: string, data: Buffer | Uint8Array | string): Promise<string>;
  getArtifactPath(jobId: string, filename: string): string;
  getArtifactUrl(jobId: string, filename: string): string;
  deleteArtifact(jobId: string, filename: string): Promise<void>;
  deleteJobArtifacts(jobId: string): Promise<void>;
  listArtifacts(jobId: string): Promise<string[]>;
}

// ─────────────────────────────────────────────────────────────
// LOCAL FILESYSTEM STORAGE
// Used in local dev and Docker worker containers where the
// disk is persistent across requests.
// ─────────────────────────────────────────────────────────────
export class LocalArtifactStorage implements IArtifactStorage {
  private baseDir: string;

  constructor(customPath?: string) {
    this.baseDir =
      customPath ||
      process.env.ARTIFACT_STORAGE_PATH ||
      path.join(process.cwd(), "storage", "artifacts");
  }

  private getJobDirectory(jobId: string): string {
    const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.baseDir, safeJobId);
  }

  async saveArtifact(jobId: string, filename: string, data: Buffer | Uint8Array | string): Promise<string> {
    const jobDir = this.getJobDirectory(jobId);
    await fs.mkdir(jobDir, { recursive: true });
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(jobDir, safeFilename);
    if (typeof data === "string") {
      await fs.writeFile(filePath, data, "utf8");
    } else {
      await fs.writeFile(filePath, data);
    }
    return filePath;
  }

  getArtifactPath(jobId: string, filename: string): string {
    const jobDir = this.getJobDirectory(jobId);
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(jobDir, safeFilename);
  }

  getArtifactUrl(jobId: string, filename: string): string {
    const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    return `/api/artifacts/${safeJobId}/${safeFilename}`;
  }

  async deleteArtifact(jobId: string, filename: string): Promise<void> {
    const filePath = this.getArtifactPath(jobId, filename);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async deleteJobArtifacts(jobId: string): Promise<void> {
    const jobDir = this.getJobDirectory(jobId);
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async listArtifacts(jobId: string): Promise<string[]> {
    const jobDir = this.getJobDirectory(jobId);
    try {
      return await fs.readdir(jobDir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// VERCEL BLOB STORAGE  (B9 FIX)
// Used in Vercel serverless / Lambda deployments where the
// local filesystem is ephemeral and NOT shared across instances.
//
// Requires env var: BLOB_READ_WRITE_TOKEN
// Set it in: Vercel Dashboard → Project → Settings → Environment Variables
// Get token from: vercel.com/dashboard → Storage → Blob → your store → tokens
//
// Screenshots saved here are accessible from any Lambda instance
// via the returned public Blob URL, solving the cross-Lambda artifact bug.
// ─────────────────────────────────────────────────────────────
export class VercelBlobStorage implements IArtifactStorage {
  async saveArtifact(jobId: string, filename: string, data: Buffer | Uint8Array | string): Promise<string> {
    const { put } = await import("@vercel/blob");
    const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const blobPath = `artifacts/${safeJobId}/${safeFilename}`;

    const buffer = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: safeFilename.endsWith(".png") ? "image/png" : "application/octet-stream",
      addRandomSuffix: false,
    });

    // Return the public Blob URL — this is accessible from any Lambda instance
    return blob.url;
  }

  /**
   * For Blob storage, getArtifactPath is not meaningful (there is no local path).
   * Returns the Blob URL pattern. The serve route should use the DB storageKey
   * (which IS the full Blob URL) instead of calling this.
   */
  getArtifactPath(_jobId: string, _filename: string): string {
    return "";
  }

  /**
   * Returns the Next.js proxy route URL for the artifact.
   * Note: When using VercelBlobStorage, the DB storageKey already IS the full
   * blob URL. The serve route (/api/artifacts/...) redirects to it.
   */
  getArtifactUrl(jobId: string, filename: string): string {
    const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    return `/api/artifacts/${safeJobId}/${safeFilename}`;
  }

  async deleteArtifact(_jobId: string, _filename: string): Promise<void> {
    // Blob deletion requires the full URL (stored in DB as storageKey).
    // This is a no-op here — deletion is handled via storageKey in pipelineEngine.
  }

  async deleteJobArtifacts(_jobId: string): Promise<void> {
    // No-op: Blob doesn't support prefix deletion without listing.
    // Implement when cleanup is needed using list() + del() from @vercel/blob.
  }

  async listArtifacts(_jobId: string): Promise<string[]> {
    // No-op: use DB artifacts table for listing, not Blob directly.
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT-AWARE ADAPTER SELECTION
//
// Logic:
//  1. If BLOB_READ_WRITE_TOKEN is set → use VercelBlobStorage (production)
//  2. Otherwise → use LocalArtifactStorage (local dev / Docker worker)
//
// This means the same codebase works correctly in both environments
// with zero manual configuration in app code.
// ─────────────────────────────────────────────────────────────
function createArtifactStorage(): IArtifactStorage {
  const hasBlobToken = !!(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasBlobToken) {
    console.log("[ArtifactStorage] Using VercelBlobStorage (BLOB_READ_WRITE_TOKEN is set)");
    return new VercelBlobStorage();
  }

  console.log("[ArtifactStorage] Using LocalArtifactStorage (no BLOB_READ_WRITE_TOKEN)");
  return new LocalArtifactStorage();
}

// Global default singleton storage instance — auto-selects based on environment
export const artifactStorage = createArtifactStorage();
