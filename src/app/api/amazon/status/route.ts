import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_ACCESS_TOKEN ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });

  const { data, error } = await supabase
    .from("amazon_tokens")
    .select("access_token_expires_at, updated_at, seller_id, marketplace_id")
    .eq("environment", "production")
    .single();

  if (error || !data) {
    return NextResponse.json({ connected: false });
  }

  // Connected if row exists — Amazon refresh tokens from self-authorized apps don't expire
  return NextResponse.json({
    connected: true,
    expiresAt: data.access_token_expires_at,
    lastConnected: data.updated_at,
    sellerId: data.seller_id,
    marketplaceId: data.marketplace_id,
  });
}
