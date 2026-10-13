// Full reservation detail including raw_data, for the Reservas detail view.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMasterAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );

  const { data, error } = await supabase
    .from("turo_trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: receipt } = await supabase
    .from("turo_receipts")
    .select("data, trip_total, turo_fee, host_earned")
    .eq("reservation_id", data.turo_trip_id)
    .maybeSingle();

  return NextResponse.json({ trip: data, receipt: receipt ?? null });
}
