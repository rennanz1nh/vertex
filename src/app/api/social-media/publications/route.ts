import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createPublication, getPublication, listPublications } from "@/lib/social-media/publication-service";
import { maybeAutoApproveAndPublish } from "@/lib/social-media/auto-publish-service";
import { APPROVAL_STATUSES, PUBLICATION_STATUSES, SOCIAL_PLATFORMS } from "@/lib/social-media/types";
import type { ApprovalStatus, PublicationStatus, SocialPlatform } from "@/lib/social-media/types";

export const dynamic = "force-dynamic";
// A creation call can now trigger AUTO-mode publishing inline (see below) — same budget as the
// dedicated publish route, since publishPublication's own polling can take up to ~60s.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const params = request.nextUrl.searchParams;
  const statusParam = params.get("status");
  const approvalParam = params.get("approval_status");
  const status = statusParam && (PUBLICATION_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as PublicationStatus) : undefined;
  const approvalStatus = approvalParam && (APPROVAL_STATUSES as readonly string[]).includes(approvalParam) ? (approvalParam as ApprovalStatus) : undefined;
  const videoId = params.get("video_id") ?? undefined;
  const limit = Number(params.get("limit") ?? "25");

  try {
    const publications = await listPublications({ status, approvalStatus, videoId, limit: Number.isFinite(limit) ? limit : 25 });
    return NextResponse.json({ publications });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list publications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const { video_id: videoId, platform, account_id: accountId } = body ?? {};
  if (typeof videoId !== "string" || typeof accountId !== "string" || !(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) {
    return NextResponse.json({ error: "video_id, platform, and account_id are required" }, { status: 400 });
  }

  try {
    const result = await createPublication({ videoId, platform: platform as SocialPlatform, accountId, actor: { source: "hub_ui", userId: auth.userId } });
    await maybeAutoApproveAndPublish(result.publication.id);
    const finalPublication = (await getPublication(result.publication.id)) ?? result.publication;
    return NextResponse.json({ publication: finalPublication, already_existed: result.isExisting });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create publication" }, { status: 500 });
  }
}
