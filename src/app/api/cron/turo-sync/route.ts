import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runServerSync } from "@/lib/turo-server-sync";
import { activeTuroTokenRow, TURO_STALE_HOURS } from "@/lib/turo-token-row";
import { notifyPush } from "@/lib/notify";

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

  const supabase = getSupabase();
  const result = await runServerSync(supabase);

  // Push "Turo sem sincronizar" when the data is older than TURO_STALE_HOURS, at most every 6h.
  const { data: row } = await activeTuroTokenRow<{ id: string; last_synced_at: string | null; stale_alert_at: string | null }>(
    supabase,
    "id, last_synced_at, stale_alert_at",
  );
  let staleAlert = false;
  if (row) {
    const hours = row.last_synced_at ? (Date.now() - new Date(row.last_synced_at).getTime()) / 3_600_000 : Infinity;
    const lastAlert = row.stale_alert_at ? new Date(row.stale_alert_at).getTime() : 0;
    if (hours >= TURO_STALE_HOURS && Date.now() - lastAlert > 6 * 3_600_000) {
      await notifyPush("turo_sync_stale", { hours: Number.isFinite(hours) ? Math.floor(hours) : "muitas" }, { priority: "high" });
      await supabase.from("turo_tokens").update({ stale_alert_at: new Date().toISOString() }).eq("id", row.id);
      staleAlert = true;
    }
  }
  return NextResponse.json({ ...result, staleAlert });
}
