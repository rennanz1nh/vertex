import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listVideos, registerVideo, getSignedThumbnailUrl } from "@/lib/social-media/video-service";
import { VIDEO_STATUSES } from "@/lib/social-media/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const statusParam = request.nextUrl.searchParams.get("status");
  const status = statusParam && (VIDEO_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as (typeof VIDEO_STATUSES)[number]) : undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "25");

  try {
    const videos = await listVideos({ status, limit: Number.isFinite(limit) ? limit : 25 });
    const withThumbnails = await Promise.all(
      videos.map(async (video) => ({ ...video, thumbnailUrl: await getSignedThumbnailUrl(video) }))
    );
    return NextResponse.json({ videos: withThumbnails });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list videos" }, { status: 500 });
  }
}

/**
 * Registers a video the client already uploaded straight to Supabase Storage
 * (bucket "vertex-social-media", same direct-upload pattern as car photos —
 * see src/components/admin/CarModal.tsx — a video is too large to
 * proxy through a Vercel function body). The client also computes the
 * SHA-256 hash and, for a video file, duration/width/height via the
 * `<video>` element and a thumbnail via canvas capture, since there's no
 * ffmpeg available server-side here (see docs for the automated
 * watch-folder path, where this constraint gets revisited).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const { storagePath, filename, sha256Hash, thumbnailPath, durationSeconds, width, height, fileSize, format } = body ?? {};

  if (typeof storagePath !== "string" || typeof filename !== "string" || typeof sha256Hash !== "string") {
    return NextResponse.json({ error: "storagePath, filename, and sha256Hash are required" }, { status: 400 });
  }

  try {
    const { video, duplicate } = await registerVideo({
      filename,
      storagePath,
      thumbnailPath: typeof thumbnailPath === "string" ? thumbnailPath : null,
      sha256Hash,
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : null,
      width: typeof width === "number" ? width : null,
      height: typeof height === "number" ? height : null,
      fileSize: typeof fileSize === "number" ? fileSize : null,
      format: typeof format === "string" ? format : null,
      source: "manual_upload",
      uploadedBy: auth.userId ?? null,
    });
    return NextResponse.json({ video, duplicate });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to register video" }, { status: 500 });
  }
}
