import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { generatePlatformContent } from "@/lib/social-media/content-generation";
import type { SocialPlatform } from "@/lib/social-media/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GENERATABLE_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok"];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const platforms: unknown = body?.platforms;
  if (!Array.isArray(platforms) || platforms.length === 0 || !platforms.every((p) => GENERATABLE_PLATFORMS.includes(p))) {
    return NextResponse.json({ error: `platforms must be a non-empty array from: ${GENERATABLE_PLATFORMS.join(", ")}` }, { status: 400 });
  }

  try {
    const content = await generatePlatformContent(id, platforms as SocialPlatform[], { source: "hub_ui", userId: auth.userId });
    return NextResponse.json({ success: true, content });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Content generation failed" }, { status: 500 });
  }
}
