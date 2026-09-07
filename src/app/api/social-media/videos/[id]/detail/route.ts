import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getVideo, getSignedVideoUrl, getSignedThumbnailUrl } from "@/lib/social-media/video-service";
import { getLatestAnalysis } from "@/lib/social-media/video-analysis";
import { getPlatformContent } from "@/lib/social-media/content-generation";
import { listPublications } from "@/lib/social-media/publication-service";

export const dynamic = "force-dynamic";

const GENERATABLE_PLATFORMS = ["instagram", "tiktok"] as const;

/** Everything the Vídeos page's detail drawer needs in one call: video, analysis, per-platform content, and this video's publications. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  try {
    const video = await getVideo(id);
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    const [videoUrl, thumbnailUrl, analysis, publications, ...content] = await Promise.all([
      getSignedVideoUrl(video),
      getSignedThumbnailUrl(video),
      getLatestAnalysis(id),
      listPublications({ videoId: id, limit: 25 }),
      ...GENERATABLE_PLATFORMS.map((platform) => getPlatformContent(id, platform)),
    ]);

    const contentByPlatform = Object.fromEntries(GENERATABLE_PLATFORMS.map((platform, i) => [platform, content[i]]));

    return NextResponse.json({ video, videoUrl, thumbnailUrl, analysis, content: contentByPlatform, publications });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load video detail" }, { status: 500 });
  }
}
