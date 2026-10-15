import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runServerSync } from "@/lib/turo-server-sync";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

/**
 * Read-only refresh of the Turo trips, three times a day (every 8h, see vercel.json).
 * Best effort: Turo's Cloudflare may reject server IPs, in which case the outcome is recorded on
 * turo_tokens (auto_sync_*) and shown in the admin Sincronização tab. Nothing is written to Turo.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runServerSync(getSupabase());
  return NextResponse.json(result);
}
