import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidPlatform } from "@/lib/social-platforms";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { platform } = await params;
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: "Plataforma desconhecida" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("social_media_accounts").delete().eq("platform", platform);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
