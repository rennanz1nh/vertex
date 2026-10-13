// Returns the stored host-level data captured from Turo: earnings, reviews,
// structured feedback and payout method. Raw JSON blobs rendered by the tabs.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMasterAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );

  const { data, error } = await supabase
    .from("turo_tokens")
    .select("earnings_data, reviews_data, feedback_data, payout_data, host_data_synced_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    earnings: data?.earnings_data ?? null,
    reviews: data?.reviews_data ?? null,
    feedback: data?.feedback_data ?? null,
    payout: data?.payout_data ?? null,
    syncedAt: data?.host_data_synced_at ?? null,
  });
}
