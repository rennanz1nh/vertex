import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_ACCESS_TOKEN ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("tiktok_shop_tokens")
    .select("access_token_expires_at, updated_at, last_refresh_error, last_refresh_error_at, shop_name, seller_name")
    .eq("environment", "production")
    .single();

  if (error || !data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    expiresAt: data.access_token_expires_at,
    lastConnected: data.updated_at,
    lastRefreshError: data.last_refresh_error,
    lastRefreshErrorAt: data.last_refresh_error_at,
    shopName: data.shop_name,
    sellerName: data.seller_name,
  });
}
