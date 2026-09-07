import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidPlatform } from "@/lib/social-platforms";
import { fetchSocialInsights } from "@/lib/social-insights";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { platform } = await params;
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: "Plataforma desconhecida" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: account, error } = await supabase
    .from("social_media_accounts")
    .select("access_token, account_id")
    .eq("platform", platform)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!account) return NextResponse.json({ error: "Conta não conectada" }, { status: 404 });

  try {
    const insights = await fetchSocialInsights(platform, account.access_token, account.account_id);
    return NextResponse.json(insights);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Falha ao buscar métricas: ${msg}` }, { status: 502 });
  }
}
