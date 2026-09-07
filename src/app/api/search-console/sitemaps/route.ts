import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listSitemaps, submitSitemap, searchConsoleErrorStatus } from "@/lib/search-console-api";
import { getSiteUrl } from "@/lib/search-console-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const sitemaps = await listSitemaps();
    return NextResponse.json({ sitemaps });
  } catch (e: unknown) {
    const { status, message } = searchConsoleErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Resubmits the site's sitemap.xml — same effect as clicking "Enviar" in Search Console. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const siteUrl = await getSiteUrl();
    const sitemapUrl = body.sitemapUrl || `${siteUrl.replace(/\/+$/, "")}/sitemap.xml`;
    await submitSitemap(sitemapUrl);
    return NextResponse.json({ ok: true, sitemapUrl });
  } catch (e: unknown) {
    const { status, message } = searchConsoleErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}
