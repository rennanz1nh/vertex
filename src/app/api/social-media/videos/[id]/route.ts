import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteVideo, getSignedThumbnailUrl, getSignedVideoUrl, getVideo } from "@/lib/social-media/video-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  try {
    const video = await getVideo(id);
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    const [videoUrl, thumbnailUrl] = await Promise.all([getSignedVideoUrl(video), getSignedThumbnailUrl(video)]);
    return NextResponse.json({ video, videoUrl, thumbnailUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load video" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const result = await deleteVideo(id, { source: "hub_ui", userId: auth.userId });
  if (result.success === false) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ success: true });
}
