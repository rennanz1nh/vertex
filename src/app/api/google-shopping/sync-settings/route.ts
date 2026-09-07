import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("google_shopping_sync_automation")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { enabled, run_time, active_weekdays } = body;

  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("google_shopping_sync_automation")
    .select("id")
    .limit(1)
    .maybeSingle();

  const update = {
    enabled: !!enabled,
    run_time: run_time || "09:00",
    active_weekdays: Array.isArray(active_weekdays) && active_weekdays.length > 0 ? active_weekdays : [0, 1, 2, 3, 4, 5, 6],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase.from("google_shopping_sync_automation").update(update).eq("id", existing.id).select().single()
    : await supabase.from("google_shopping_sync_automation").insert(update).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
