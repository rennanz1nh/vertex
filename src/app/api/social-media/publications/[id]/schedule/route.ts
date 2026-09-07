import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { schedulePublication } from "@/lib/social-media/publication-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const scheduledAt = typeof body?.scheduled_at === "string" ? body.scheduled_at : null;
  const timezone = typeof body?.timezone === "string" && body.timezone.trim() ? body.timezone : "UTC";
  if (!scheduledAt) return NextResponse.json({ error: "scheduled_at is required" }, { status: 400 });

  try {
    const publication = await schedulePublication(id, scheduledAt, timezone, { source: "hub_ui", userId: auth.userId });
    return NextResponse.json({ publication });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to schedule publication" }, { status: 500 });
  }
}
