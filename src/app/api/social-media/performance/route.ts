import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getPerformanceOverview } from "@/lib/social-media/metrics-service";
import { SOCIAL_PLATFORMS } from "@/lib/social-media/types";
import type { SocialPlatform } from "@/lib/social-media/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const params = request.nextUrl.searchParams;
  const platformParam = params.get("platform");
  const platform = platformParam && (SOCIAL_PLATFORMS as readonly string[]).includes(platformParam) ? (platformParam as SocialPlatform) : undefined;
  const limitParam = Number(params.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam) ? limitParam : 50;

  try {
    const publications = await getPerformanceOverview({ platform, limit });
    return NextResponse.json({ publications });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load performance overview" }, { status: 500 });
  }
}
