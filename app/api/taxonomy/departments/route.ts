/**
 * §CAREER BRAIN TAXONOMY REST API
 * GET /api/taxonomy/departments - Returns the complete catalog of departments,
 * subcategories, recognized roles, and dynamic self-learning growth metrics.
 */

import { NextResponse } from "next/server";
import { careerBrainService } from "@/lib/discovery/taxonomy/careerBrainService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = careerBrainService.getTaxonomySummary();
    return NextResponse.json({
      success: true,
      taxonomy: summary,
    });
  } catch (err: unknown) {
    console.error("[GET /api/taxonomy/departments] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve career brain taxonomy." },
      { status: 500 }
    );
  }
}
