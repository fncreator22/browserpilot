import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import fs from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import { artifactStorage } from "@/lib/storage";

/**
 * GET /api/artifacts/:jobId/:filename
 * Serves stored screenshot PNGs with multi-tenant ownership validation and strict path traversal guards.
 *
 * B9 FIX: Now handles both storage backends:
 *  - VercelBlobStorage: The DB artifact.storageKey is a full Blob URL (https://...).
 *    We redirect to it — the browser fetches from Vercel's CDN directly.
 *  - LocalArtifactStorage: Read from disk and serve inline (dev/Docker mode).
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ jobId: string; filename: string }> }
) {
  const params = await props.params;
  const { jobId, filename } = params;

  // 1. Strict Path Traversal & Filename Sanitization Guard
  if (
    !filename ||
    !jobId ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0") ||
    !/^[a-zA-Z0-9._-]+$/.test(filename)
  ) {
    return NextResponse.json(
      { error: "INVALID_FILENAME", message: "Malicious or invalid filename path." },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || null;

    // 2. Multi-tenant Ownership Check — also fetch the stored blob URL if available
    const rawJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, userId: true },
    });

    if (!rawJob) {
      return NextResponse.json(
        { error: "JOB_NOT_FOUND", message: `Job ${jobId} does not exist.` },
        { status: 404 }
      );
    }

    if (rawJob.userId && userId && rawJob.userId !== userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Job artifact access denied." },
        { status: 403 }
      );
    }

    // 3. Check DB artifacts table for this file's storageKey
    //    If storageKey is a Blob URL (https://...), redirect to it.
    //    If storageKey is a local FS path (or empty), serve from disk.
    const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");

    const dbArtifact = await prisma.artifactRecord.findFirst({
      where: { jobId, filename: safeFilename },
      select: { storageKey: true },
    });

    // B9 FIX: If storageKey is a full Blob URL, redirect to it instead of reading disk
    if (dbArtifact?.storageKey && dbArtifact.storageKey.startsWith("https://")) {
      return NextResponse.redirect(dbArtifact.storageKey, { status: 302 });
    }

    // Fallback: read from local filesystem (dev / Docker worker)
    const filePath = artifactStorage.getArtifactPath(safeJobId, safeFilename);
    const fileBuffer = await fs.readFile(filePath);

    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".json"
        ? "application/json"
        : "application/octet-stream";

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "ARTIFACT_NOT_FOUND", message: `Artifact ${filename} for job ${jobId} was not found.` },
      { status: 404 }
    );
  }
}
