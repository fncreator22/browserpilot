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

export class LocalArtifactStorage implements IArtifactStorage {
  private baseDir: string;

  constructor(customPath?: string) {
    this.baseDir = customPath || process.env.ARTIFACT_STORAGE_PATH || path.join(process.cwd(), "storage", "artifacts");
  }

  private getJobDirectory(jobId: string): string {
    // Sanitize jobId to prevent directory traversal
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
    // URL accessible via Next.js API or static endpoint in future phases
    return `/api/artifacts/${safeJobId}/${safeFilename}`;
  }

  async deleteArtifact(jobId: string, filename: string): Promise<void> {
    const filePath = this.getArtifactPath(jobId, filename);
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  async deleteJobArtifacts(jobId: string): Promise<void> {
    const jobDir = this.getJobDirectory(jobId);
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  async listArtifacts(jobId: string): Promise<string[]> {
    const jobDir = this.getJobDirectory(jobId);
    try {
      return await fs.readdir(jobDir);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }
}

// Global default singleton storage instance
export const artifactStorage = new LocalArtifactStorage();
