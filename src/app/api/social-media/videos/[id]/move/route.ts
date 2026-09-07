import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { moveVideo } from "@/lib/social-media/video-service";
import { VIDEO_STATUSES } from "@/lib/social-media/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!status || !(VIDEO_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VIDEO_STATUSES.join(", ")}` }, { status: 400 });
  }

  try {
    const video = await moveVideo(id, status, { source: "hub_ui", userId: auth.userId });
    return NextResponse.json({ video });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to move video" }, { status: 500 });
  }
}
