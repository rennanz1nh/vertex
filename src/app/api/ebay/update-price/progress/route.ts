import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Polled by the price automation page while a run is in flight, to drive the progress bar. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ebay_price_automation_progress")
    .select("status, completed, total, updated_at")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return NextResponse.json({ status: "idle", completed: 0, total: 0 });
  }

  return NextResponse.json(data);
}
