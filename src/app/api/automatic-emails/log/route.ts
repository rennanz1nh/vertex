import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const triggerKey = searchParams.get("trigger_key");
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

  const supabase = getSupabase();
  let query = supabase
    .from("automatic_email_log")
    .select("id, trigger_key, recipient_email, recipient_name, subject, status, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (triggerKey) query = query.eq("trigger_key", triggerKey);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}
