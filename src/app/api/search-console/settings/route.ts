import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSiteUrl, saveSiteUrl } from "@/lib/search-console-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const siteUrl = await getSiteUrl();
  return NextResponse.json({ siteUrl });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { siteUrl } = await request.json();
  if (typeof siteUrl !== "string" || !siteUrl.trim()) {
    return NextResponse.json({ error: "siteUrl é obrigatório" }, { status: 400 });
  }
  await saveSiteUrl(siteUrl.trim());
  return NextResponse.json({ siteUrl: siteUrl.trim() });
}
