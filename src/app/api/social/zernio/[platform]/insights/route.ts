import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { getZernioInstagramInsights } from "@/lib/social-media/zernio-client";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Instagram only for now — Zernio's TikTok account-insights endpoint has a different
// response shape (follower/following/likes/video counters, no reach) that hasn't been
// built yet since nobody has connected TikTok via Zernio to test against.
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { platform } = await params;
  if (platform !== "instagram") {
    return NextResponse.json({ error: "Métricas via Zernio ainda só cobrem Instagram" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: account, error } = await supabase
    .from("zernio_social_accounts")
    .select("zernio_account_id")
    .eq("platform", platform)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!account) return NextResponse.json({ error: "Conta não conectada" }, { status: 404 });

  const insights = await getZernioInstagramInsights(account.zernio_account_id);
  return NextResponse.json(insights);
}
