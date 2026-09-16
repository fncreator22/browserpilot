import { NextRequest, NextResponse } from "next/server";
import { enhancePrompt } from "@/lib/ai/promptEnhancer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "INVALID_PROMPT", message: "A non-empty prompt is required." },
        { status: 400 }
      );
    }

    const enhanced = await enhancePrompt(prompt);
    return NextResponse.json(enhanced);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "ENHANCE_FAILED", message: (err as Error).message },
      { status: 500 }
    );
  }
}
