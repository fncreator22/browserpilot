import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import fs from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobById } from "@/lib/db/jobs";
import { artifactStorage } from "@/lib/storage";

/**
 * GET /api/artifacts/:jobId/:filename
 * Serves stored screenshot PNGs with multi-tenant ownership validation and strict path traversal guards
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

    // 2. Multi-tenant Ownership Check
    if (userId) {
      const job = await getDbJobById(jobId, userId);
      if (!job) {
        return NextResponse.json(
          { error: "UNAUTHORIZED", message: "Job artifact access denied." },
          { status: 403 }
        );
      }
    }

    const filePath = artifactStorage.getArtifactPath(jobId, filename);
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
