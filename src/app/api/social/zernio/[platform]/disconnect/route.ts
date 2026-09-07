import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import type { ZernioPlatform } from "@/lib/social-media/zernio-client";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const VALID_PLATFORMS: ZernioPlatform[] = ["instagram", "tiktok"];
function isValidPlatform(value: string): value is ZernioPlatform {
  return (VALID_PLATFORMS as string[]).includes(value);
}

// Only forgets our own reference, same as the native /api/social/[platform]/disconnect —
// doesn't call Zernio to revoke anything on their side (no confirmed endpoint for that).
export async function POST(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { platform } = await params;
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: "Plataforma desconhecida" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase.from("zernio_social_accounts").delete().eq("platform", platform);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
