import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SOCIAL_PLATFORMS, PLATFORM_CONFIG } from "@/lib/social-platforms";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

// Never returns access_token/refresh_token — this is the only client-facing read of
// social_media_accounts, and it deliberately selects just the display-safe columns.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("social_media_accounts")
    .select("id, platform, account_id, account_name, avatar_url, connected_at, updated_at, can_publish, auto_publish_authorized");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byPlatform = new Map((data ?? []).map((row) => [row.platform, row]));

  const platforms = SOCIAL_PLATFORMS.map((id) => {
    const row = byPlatform.get(id);
    return {
      accountId: row?.id ?? null,
      platform: id,
      label: PLATFORM_CONFIG[id].label,
      configured: !!process.env[PLATFORM_CONFIG[id].clientIdEnv],
      connected: !!row,
      accountName: row?.account_name ?? null,
      avatarUrl: row?.avatar_url ?? null,
      connectedAt: row?.connected_at ?? null,
      canPublish: row?.can_publish ?? false,
      autoPublishAuthorized: row?.auto_publish_authorized ?? false,
    };
  });

  return NextResponse.json({ platforms });
}
