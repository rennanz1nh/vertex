import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { zernioConfigured, type ZernioPlatform } from "@/lib/social-media/zernio-client";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

const ZERNIO_PLATFORMS: { id: ZernioPlatform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
];

// Never returns any Zernio credential — this table doesn't even store one (Zernio holds
// the real Instagram/TikTok tokens on their side), only the account reference/name/avatar.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = getSupabase();
  const { data, error } = await supabase.from("zernio_social_accounts").select("id, platform, account_name, avatar_url, connected_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byPlatform = new Map((data ?? []).map((row) => [row.platform, row]));
  const configured = zernioConfigured();

  const platforms = ZERNIO_PLATFORMS.map(({ id, label }) => {
    const row = byPlatform.get(id);
    return {
      accountId: row?.id ?? null,
      platform: id,
      label,
      configured,
      connected: !!row,
      accountName: row?.account_name ?? null,
      avatarUrl: row?.avatar_url ?? null,
      connectedAt: row?.connected_at ?? null,
      canPublish: !!row,
      autoPublishAuthorized: false,
    };
  });

  return NextResponse.json({ platforms });
}
