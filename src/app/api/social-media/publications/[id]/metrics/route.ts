import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getPublicationMetrics, getMetricsHistory } from "@/lib/social-media/metrics-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  try {
    const [metrics, history] = await Promise.all([getPublicationMetrics(id), getMetricsHistory(id)]);
    return NextResponse.json({ metrics, history });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load metrics" }, { status: 500 });
  }
}
