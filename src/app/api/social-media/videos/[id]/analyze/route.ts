import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { analyzeVideo } from "@/lib/social-media/video-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  try {
    const result = await analyzeVideo(id, { source: "hub_ui", userId: auth.userId });
    return NextResponse.json({ success: true, analysis_id: result.analysisId, analysis: result.analysis });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis failed" }, { status: 500 });
  }
}
