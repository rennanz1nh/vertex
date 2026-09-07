import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_ACCESS_TOKEN ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from("ebay_tokens")
    .select("access_token_expires_at, updated_at, last_refresh_error, last_refresh_error_at")
    .eq("environment", "production")
    .single();

  if (error || !data) {
    return NextResponse.json({ connected: false });
  }

  // A stored last_refresh_error only counts as a *current* problem if it happened AFTER
  // the last successful token update. Reconnecting (OAuth callback) bumps updated_at but
  // historically didn't clear last_refresh_error, which left the UI stuck on
  // "Falha - Reconectar" forever even though the token was freshly valid. Compare the
  // two timestamps so a stale error is treated as resolved.
  const errorAt = data.last_refresh_error_at ? new Date(data.last_refresh_error_at).getTime() : 0;
  const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
  const isStaleError = errorAt > 0 && updatedAt > 0 && errorAt <= updatedAt;
  const activeRefreshError = isStaleError ? null : data.last_refresh_error;

  // Connected if row exists — refresh token is valid for ~18 months
  return NextResponse.json({
    connected: true,
    expiresAt: data.access_token_expires_at,
    lastConnected: data.updated_at,
    lastRefreshError: activeRefreshError,
    lastRefreshErrorAt: activeRefreshError ? data.last_refresh_error_at : null,
  });
}
